
let map;

class GeolocationControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this._container.innerHTML = `
            <button class="mapboxgl-ctrl-icon" title="Get Current Location">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
            </button>
        `;
        this._container.onclick = async () => {
            try {
                const { lat, lon } = await getCurrentLocation();
                map.flyTo({ center: [lon, lat], zoom: 14 });
                // Add current location marker (to be implemented in Step 4)
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

let currentLocationMarker = null;

function addCurrentLocationMarker(lat, lon) {
    // Remove existing marker if it exists
    if (currentLocationMarker) {
        currentLocationMarker.remove();
    }

    // Create a custom dot marker (blue dot like Google Maps)
    const el = document.createElement('div');
    el.style.backgroundColor = '#4285F4'; // Google Maps blue
    el.style.width = '12px';
    el.style.height = '12px';
    el.style.borderRadius = '50%';
    el.style.border = '2px solid white';
    el.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';

    // Add the marker to the map
    currentLocationMarker = new mapboxgl.Marker({ element: el })
        .setLngLat([lon, lat])
        .addTo(map);
}

function initMap(lat, lon) {
    mapboxgl.accessToken = 'pk.eyJ1IjoiaGdvdHRpcGF0aSIsImEiOiJjbTh0cjRzazMwZXFvMnNxMmExNTdqZjBlIn0.JffbXqKwr5oh2_kMapNyDw';
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [lon, lat],
        zoom: 12
    });

    // Add zoom and rotation controls to the map
    map.addControl(new mapboxgl.NavigationControl());

    // Fetch chargers when the map moves
    map.on('moveend', async () => {
        const center = map.getCenter();
        const bounds = map.getBounds();
        // Calculate distance (approximate) using the bounds
        const distance = Math.round(
            mapboxgl.MercatorCoordinate.fromLngLat(bounds.getNorthEast())
                .distanceTo(mapboxgl.MercatorCoordinate.fromLngLat(bounds.getSouthWest())) / 1609.34 // Convert meters to miles
        ) / 2; // Approximate radius

        const fastOnly = document.getElementById("fastOnly").checked;
        try {
            const chargers = await getChargers(center.lat, center.lng, distance, fastOnly);
            addChargersToMap(chargers);
        } catch (error) {
            console.error("Error fetching chargers on map move:", error.message);
        }
    });
}
async function getCoordinates(address) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    if (data?.features?.length > 0) {
        const [lon, lat] = data.features[0].center;
        return { lat, lon };
    }
    throw new Error("Address not found");
}

async function getAddressSuggestions(query) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&limit=5`;
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
let markers = [];

function addChargersToMap(chargers) {
    // Remove existing markers
    markers.forEach(marker => marker.remove());
    markers = [];

    // Add new markers
    chargers.forEach(charger => {
        const { Latitude, Longitude, Title } = charger.AddressInfo;
        const popup = new mapboxgl.Popup()
            .setHTML(`<h3>${Title}</h3><a href="https://www.google.com/maps/dir/?api=1&destination=${Latitude},${Longitude}" target="_blank">Get Directions</a>`);
        const marker = new mapboxgl.Marker({ color: 'blue' })
            .setLngLat([Longitude, Latitude])
            .setPopup(popup)
            .addTo(map);
        markers.push(marker);
    });
}

async function showChargers() {
    const loading = document.getElementById("loading");
    const address = document.getElementById("address").value;
    const distance = document.getElementById("distance").value;
    const fastOnly = document.getElementById("fastOnly").checked;

    try {
        const { lat, lon } = await getCoordinates(address);
        initMap(lat, lon);
        if (loading) loading.style.display = "block";
        const chargers = await getChargers(lat, lon, distance, fastOnly);
        addChargersToMap(chargers);
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        if (loading) loading.style.display = "none";
    }
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
            // Default to Expedia Group office in Seattle
            const defaultLat = 47.6145;
            const defaultLon = -122.3391;
            initMap(defaultLat, defaultLon);
            if (loading) loading.style.display = "block";
            const chargers = await getChargers(defaultLat, defaultLon, distance, fastOnly);
            addChargersToMap(chargers);
            addressInput.value = "2001 6th Ave, Seattle, WA 98121";
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
            addressInput.value = "2001 6th Ave, Seattle, WA 98121";
            await showChargers();
        } finally {
            if (loading) loading.style.display = "none";
        }
    }
}

window.onload = init;