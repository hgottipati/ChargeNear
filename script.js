let map;
let propertyMarker;

const propertyIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
});

const chargerIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
});

function initMap(lat, lon) {
    if (map) map.remove();
    map = L.map('map').setView([lat, lon], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    propertyMarker = L.marker([lat, lon], { icon: propertyIcon }).addTo(map).bindPopup("Your Location");
}

async function getCoordinates(address) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const response = await fetch(url, {
        headers: { "User-Agent": "ev-friendly-hosts/1.0 (your-email@example.com)" }
    });
    const data = await response.json();
    console.log("Nominatim response:", data);
    if (data.length > 0) {
        return { lat: data[0].lat, lon: data[0].lon };
    }
    throw new Error("Address not found");
}

async function getChargers(lat, lon, distance, fastOnly) {
    const apiKey = "b61c6aab-6cef-43a9-af78-215cb02d1464"; // Your real key here
    const url = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${lat}&longitude=${lon}&distance=${distance}&distanceunit=Miles&maxresults=10&key=${apiKey}`;
    const response = await fetch(url);
    let chargers = await response.json();
    console.log("Chargers:", chargers);
    if (fastOnly) {
        chargers = chargers.filter(charger => 
            charger.Connections.some(conn => conn.LevelID === 3)
        );
    }
    return chargers;
}

function addChargersToMap(chargers) {
    chargers.forEach(charger => {
        const lat = charger.AddressInfo.Latitude;
        const lon = charger.AddressInfo.Longitude;
        const name = charger.AddressInfo.Title;
        L.marker([lat, lon], { icon: chargerIcon }).addTo(map).bindPopup(name);
    });
}

async function showChargers() {
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
    }
}

// Get user's current location
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({ lat: position.coords.latitude, lon: position.coords.longitude });
                },
                (error) => {
                    reject(error);
                }
            );
        } else {
            reject(new Error("Geolocation not supported"));
        }
    });
}

// Load map with current location or fallback
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const defaultAddress = urlParams.get('address');
    
    if (defaultAddress) {
        document.getElementById("address").value = defaultAddress;
        showChargers();
    } else {
        try {
            const { lat, lon } = await getCurrentLocation();
            initMap(lat, lon);
            const distance = document.getElementById("distance").value;
            const fastOnly = document.getElementById("fastOnly").checked;
            const chargers = await getChargers(lat, lon, distance, fastOnly);
            addChargersToMap(chargers);
        } catch (error) {
            console.log("Geolocation failed:", error.message);
            // Fallback to a default address (e.g., Austin, TX)
            document.getElementById("address").value = "123 Main St, Austin, TX";
            showChargers();
        }
    }
}

// Run on page load
window.onload = init;