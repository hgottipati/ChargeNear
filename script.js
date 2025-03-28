let map;
let propertyMarker;

function initMap(lat, lon) {
    if (map) map.remove();
    map = L.map('map').setView([lat, lon], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);
    propertyMarker = L.marker([lat, lon]).addTo(map).bindPopup("Your Property");
}

async function getCoordinates(address) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.length > 0) {
        return { lat: data[0].lat, lon: data[0].lon };
    }
    throw new Error("Address not found");
}

async function getChargers(lat, lon) {
    const apiKey = "b61c6aab-6cef-43a9-af78-215cb02d1464"; // Replace with your Open Charge Map API key
    const url = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${lat}&longitude=${lon}&distance=10&distanceunit=Miles&maxresults=10&key=${apiKey}`;
    const response = await fetch(url);
    const chargers = await response.json();
    return chargers;
}

function addChargersToMap(chargers) {
    chargers.forEach(charger => {
        const lat = charger.AddressInfo.Latitude;
        const lon = charger.AddressInfo.Longitude;
        const name = charger.AddressInfo.Title;
        L.marker([lat, lon]).addTo(map).bindPopup(name);
    });
}

async function showChargers() {
    const address = document.getElementById("address").value;
    try {
        const { lat, lon } = await getCoordinates(address);
        initMap(lat, lon);
        const chargers = await getChargers(lat, lon);
        addChargersToMap(chargers);
    } catch (error) {
        alert("Error: " + error.message);
    }
}

const urlParams = new URLSearchParams(window.location.search);
const defaultAddress = urlParams.get('address');
if (defaultAddress) {
    document.getElementById("address").value = defaultAddress;
    showChargers();
}