let map;
let markers = [];
let currentLocationMarker = null;
let searchedLocationMarker = null;
let currentLocationCoords = null;

class GeolocationControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this._container.innerHTML = `
            <button class="mapboxgl-ctrl-icon" title="Get Current Location" style="background: white; border: none; padding: 0;">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#4285F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
            </button>
        `;
        this._container.onclick = async () => {
            try {
                const { lat, lon } = await getCurrentLocation();
                currentLocationCoords = { lat, lon };
                map.flyTo({ center: [lon, lat], zoom: 14 });
                addCurrentLocationMarker(lat, lon);
                const distance = document.getElementById("distance").value || "5";
                const fastOnly = document.getElementById("fastOnly").checked;
                const chargers = await getChargers(lat, lon, distance, fastOnly);
                addChargersToMap(chargers);
                document.getElementById("address").value = "Current Location";
            } catch (error) {
                alert("Failed to get current location: " + error.message);
            }
        };
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

function initMap(lat, lon) {
    try {
        mapboxgl.accessToken = MAPBOX_TOKEN; // Use the token from config.js
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [lon, lat],
            zoom: 12
        });

        console.log("Map initialized successfully");

        map.addControl(new mapboxgl.NavigationControl());
        map.addControl(new GeolocationControl(), 'top-right');

        map.on('moveend', async () => {
            const center = map.getCenter();
            const bounds = map.getBounds();
            const distance = Math.round(
                mapboxgl.MercatorCoordinate.fromLngLat(bounds.getNorthEast())
                    .distanceTo(mapboxgl.MercatorCoordinate.fromLngLat(bounds.getSouthWest())) / 1609.34
            ) / 2;

            const fastOnly = document.getElementById("fastOnly").checked;
            try {
                const chargers = await getChargers(center.lat, center.lng, distance, fastOnly);
                addChargersToMap(chargers);
            } catch (error) {
                console.error("Error fetching chargers on map move:", error.message);
            }
        });
    } catch (error) {
        console.error("Error initializing map:", error.message);
    }
}

function addCurrentLocationMarker(lat, lon) {
    if (currentLocationMarker) {
        currentLocationMarker.remove();
    }

    const el = document.createElement('div');
    el.style.backgroundColor = '#4285F4';
    el.style.width = '12px';
    el.style.height = '12px';
    el.style.borderRadius = '50%';
    el.style.border = '2px solid white';
    el.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';

    currentLocationMarker = new mapboxgl.Marker({ element: el })
        .setLngLat([lon, lat])
        .addTo(map);
}

function addSearchedLocationMarker(lat, lon, address) {
    if (searchedLocationMarker) {
        searchedLocationMarker.remove();
    }

    const el = document.createElement('div');
    el.style.width = '30px';
    el.style.height = '40px';
    el.style.backgroundImage = 'url("data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" fill="none">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 8.013 10.432 21.666 11.15 22.62.37.5.92.5 1.29 0C13.568 33.666 24 20.013 24 12 24 5.373 18.627 0 12 0z" fill="#FF0000"/>
            <circle cx="12" cy="12" r="4" fill="#8B0000"/>
        </svg>
    `) + '")';
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.cursor = 'pointer';
    el.style.transform = 'translate(-50%, -100%)';

    searchedLocationMarker = new mapboxgl.Marker({ element: el })
        .setLngLat([lon, lat])
        .setPopup(new mapboxgl.Popup().setHTML(`<h3>${address}</h3>`))
        .addTo(map);
}

function addChargersToMap(chargers) {
    markers.forEach(marker => marker.remove());
    markers = [];

    chargers.forEach(charger => {
        const { Latitude, Longitude, Title } = charger.AddressInfo;
        const walkingDistance = charger.walkingDistanceMiles || 'N/A';
        const popup = new mapboxgl.Popup()
            .setHTML(`
                <h3>${Title}</h3>
                <p>Walking Distance: ${walkingDistance} miles</p>
                <a href="https://www.google.com/maps/dir/?api=1&destination=${Latitude},${Longitude}" target="_blank">Get Directions</a>
            `);
        const marker = new mapboxgl.Marker({ color: 'blue' })
            .setLngLat([Longitude, Latitude])
            .setPopup(popup)
            .addTo(map);
        markers.push(marker);
    });
}

async function showChargers() {
    const address = document.getElementById("address").value;
    const distance = document.getElementById("distance").value || "5";
    const fastOnly = document.getElementById("fastOnly").checked;
    const loading = document.getElementById("loading");

    if (!address) {
        alert("Please enter an address");
        return;
    }

    try {
        if (loading) loading.style.display = "block";

        let lat, lon;

        if (address.toLowerCase() === "current location") {
            if (currentLocationCoords) {
                lat = currentLocationCoords.lat;
                lon = currentLocationCoords.lon;
            } else {
                const coords = await getCurrentLocation();
                lat = coords.lat;
                lon = coords.lon;
                currentLocationCoords = { lat, lon };
            }

            map.flyTo({ center: [lon, lat], zoom: 14 });
            addCurrentLocationMarker(lat, lon);
            const chargers = await getChargers(lat, lon, distance, fastOnly);
            addChargersToMap(chargers);
        } else {
            const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}`);
            const data = await response.json();
            if (data.features.length === 0) {
                throw new Error("Address not found");
            }

            [lon, lat] = data.features[0].center;
            map.flyTo({ center: [lon, lat], zoom: 14 });
            addSearchedLocationMarker(lat, lon, address);
            const chargers = await getChargers(lat, lon, distance, fastOnly);
            addChargersToMap(chargers);
        }
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        if (loading) loading.style.display = "none";
    }
}

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const defaultAddress = urlParams.get('address');
    const distance = urlParams.get('distance') || document.getElementById("distance").value || "5";
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

    const loading = document.getElementById("loading");
    if (defaultAddress) {
        addressInput.value = defaultAddress;
        await showChargers();
    } else {
        try {
            const defaultLat = 47.6290525;
            const defaultLon = -122.3758909;
            initMap(defaultLat, defaultLon);
            if (loading) loading.style.display = "block";
            const chargers = await getChargers(defaultLat, defaultLon, distance, fastOnly);
            addChargersToMap(chargers);
            addressInput.value = "1111 Expedia Group Wy W, Seattle, WA 98119";
            addSearchedLocationMarker(defaultLat, defaultLon, "1111 Expedia Group Wy W, Seattle, WA 98119");
        } catch (error) {
            console.log("Geolocation failed:", error.message, "Code:", error.code);
            let userMessage = "Couldn’t get your location.";
            if (error.code === 1) {
                userMessage = "Location access denied. Please enable location permissions in your browser settings.";
            } else if (error.code === 2) {
                userMessage = "Geolocation is not available. Please ensure your device supports location services.";
            } else if (error.code === 3) {
                userMessage = "Geolocation request timed out. Please check your network connection.";
            }
            userMessage += " Using default location. Click OK to try again or enter an address manually.";
            if (confirm(userMessage)) {
                try {
                    const { lat, lon } = await getCurrentLocation();
                    initMap(lat, lon);
                    if (loading) loading.style.display = "block";
                    const chargers = await getChargers(lat, lon, distance, fastOnly);
                    addChargersToMap(chargers);
                    return;
                } catch (retryError) {
                    console.log("Retry failed:", retryError.message);
                }
            }
            addressInput.value = "1111 Expedia Group Wy W, Seattle, WA 98119";
            await showChargers();
        } finally {
            if (loading) loading.style.display = "none";
        }
    }
}

async function getCoordinates(address) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    if (data?.features?.length > 0) {
        const [lon, lat] = data.features[0].center;
        return { lat, lon };
    }
    throw new Error("Address not found");
}

async function getAddressSuggestions(query) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5`;
    const response = await fetch(url);
    const data = await response.json();
    return data.features?.map(feature => feature.place_name) || [];
}

async function getChargers(lat, lon, distance, fastOnly) {
    const url = `https://74ohkix1sb.execute-api.us-east-1.amazonaws.com/prod?lat=${lat}&lon=${lon}&distance=${distance}&fastOnly=${fastOnly}`;
    console.log("Fetching chargers from:", url);
    const response = await fetch(url);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP error ${response.status}: ${text}`);
    }
    return await response.json();
}


function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported by this browser"));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log("Geolocation success:", position);
                resolve({ lat: position.coords.latitude, lon: position.coords.longitude });
            },
            (error) => {
                console.error("Geolocation error:", error.message, "Code:", error.code);
                reject(error);
            },
            { 
                enableHighAccuracy: true, 
                timeout: 15000, 
                maximumAge: 0 
            }
        );
    });
}

window.onload = init;