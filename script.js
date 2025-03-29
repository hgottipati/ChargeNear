mapboxgl.accessToken = 'pk.eyJ1IjoiaGdvdHRpcGF0aSIsImEiOiJjbTh0cjRzazMwZXFvMnNxMmExNTdqZjBlIn0.JffbXqKwr5oh2_kMapNyDw'; // Replace with your token

let map;

function initMap(lat, lon) {
    if (map) map.remove();
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [lon, lat], // Mapbox uses [lon, lat]
        zoom: 13
    });
    const googleMapsLink = `https://www.google.com/maps?q=${lat},${lon}`;
    new mapboxgl.Marker({ color: 'green' })
        .setLngLat([lon, lat])
        .setPopup(new mapboxgl.Popup().setHTML(`Your Location<br><a href="${googleMapsLink}" target="_blank">Open in Google Maps</a>`))
        .addTo(map);
}

async function getCoordinates(address) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    console.log("Mapbox geocoding response:", data);
    if (data.features.length > 0) {
        const [lon, lat] = data.features[0].center;
        return { lat, lon };
    }
    throw new Error("Address not found");
}

async function getAddressSuggestions(query) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&limit=5`;
    const response = await fetch(url);
    const data = await response.json();
    return data.features.map(feature => feature.place_name);
}

async function getChargers(lat, lon, distance, fastOnly) {
    const apiKey = "b61c6aab-6cef-43a9-af78-215cb02d1464"; // Your Open Charge Map key
    const proxyUrl = "https://cors-anywhere.herokuapp.com/";
    const apiUrl = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${lat}&longitude=${lon}&distance=${distance}&distanceunit=Miles&maxresults=10&key=${apiKey}`;
    try {
        const response = await fetch(proxyUrl + apiUrl);
        const text = await response.text();
        console.log("Raw charger response:", text);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${text}`);
        }
        const chargers = JSON.parse(text);
        console.log("Chargers:", chargers);
        if (fastOnly) {
            return chargers.filter(charger => 
                charger.Connections.some(conn => conn.LevelID === 3)
            );
        }
        return chargers;
    } catch (error) {
        console.error("Charger fetch failed:", error.message);
        return [];
    }
}

function addChargersToMap(chargers) {
    chargers.forEach(charger => {
        const lat = charger.AddressInfo.Latitude;
        const lon = charger.AddressInfo.Longitude;
        const name = charger.AddressInfo.Title;
        const googleMapsLink = `https://www.google.com/maps?q=${lat},${lon}`;
        new mapboxgl.Marker({ color: 'blue' })
            .setLngLat([lon, lat])
            .setPopup(new mapboxgl.Popup().setHTML(`${name}<br><a href="${googleMapsLink}" target="_blank">Open in Google Maps</a>`))
            .addTo(map);
    });
}

async function showChargers() {
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "block";
    const address = document.getElementById("address").value;
    const distance = document.getElementById("distance").value;
    const fastOnly = document.getElementById("fastOnly").checked;
    try {
        const { lat, lon } = await getCoordinates(address);
        initMap(lat, lon);
        const chargers = await getChargers(lat, lon, distance, fastOnly);
        addChargersToMap(chargers);
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        if (loading) loading.style.display = "none";
    }
}

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const defaultAddress = urlParams.get('address');
    const distance = urlParams.get('distance') || document.getElementById("distance").value;
    const fastOnly = urlParams.get('fastOnly') === 'true' || document.getElementById("fastOnly").checked;

    document.getElementById("distance").value = distance;
    document.getElementById("fastOnly").checked = fastOnly;

    const addressInput = document.getElementById("address");
    addressInput.addEventListener("input", async () => {
        const query = addressInput.value;
        if (query.length < 3) return;
        const suggestions = await getAddressSuggestions(query);
        const datalist = document.createElement('datalist');
        datalist.id = 'address-suggestions';
        datalist.innerHTML = suggestions.map(s => `<option value="${s}">`).join("");
        addressInput.setAttribute('list', 'address-suggestions');
        if (document.getElementById('address-suggestions')) {
            document.getElementById('address-suggestions').remove();
        }
        document.body.appendChild(datalist);
    });

    if (defaultAddress) {
        addressInput.value = defaultAddress;
        await showChargers();
    } else {
        const loading = document.getElementById("loading");
        if (loading) loading.style.display = "block";
        try {
            const { lat, lon } = await getCurrentLocation();
            initMap(lat, lon);
            const chargers = await getChargers(lat, lon, distance, fastOnly);
            addChargersToMap(chargers);
        } catch (error) {
            console.log("Init geolocation failed:", error);
            if (error.code === 1 || error.code === 2 || error.code === 3 || !navigator.geolocation) {
                alert("Couldn’t get your location—using default instead.");
                addressInput.value = "123 Main St, Austin, TX";
                await showChargers();
            } else {
                alert("Geolocation failed unexpectedly: " + error.message);
            }
        } finally {
            if (loading) loading.style.display = "none";
        }
    }
}

function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
                (error) => {
                    console.log("Geolocation error:", error.code, error.message, error);
                    reject(error);
                },
                { timeout: 15000 } // Increased for mobile
            );
        } else {
            reject(new Error("Geolocation not supported by this browser"));
        }
    });
}

window.onload = init;