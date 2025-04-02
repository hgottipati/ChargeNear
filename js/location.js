import { getMap } from './mapUtils.js';
import { getChargers } from './api.js'; // Add this import

export let currentLocationCoords = null;

export async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser."));
        }
        navigator.geolocation.getCurrentPosition(
            position => {
                console.log("Successfully retrieved current location:", position.coords);
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                });
            },
            error => {
                console.error("Error getting current location:", error.message, "Code:", error.code);
                reject(error);
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    });
}

export async function showChargers(addChargersToMap, addCircleToMap, addCurrentLocationMarker, addSearchedLocationMarker) {
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

            const map = await getMap();
            map.flyTo({ center: [lon, lat], zoom: 14 });
            addCurrentLocationMarker(lat, lon);
            const chargers = await getChargers(lat, lon, distance, fastOnly);
            addChargersToMap(chargers, [lon, lat], parseFloat(distance));
            addCircleToMap([lon, lat], parseFloat(distance));
        } else {
            if (typeof MAPBOX_TOKEN === 'undefined') {
                throw new Error("Mapbox token is not defined. Please ensure config.js is loaded correctly.");
            }
            const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}`);
            const data = await response.json();
            console.log("Geocoding response:", data);
            if (!data.features || data.features.length === 0) {
                throw new Error("Address not found. Please try a different address.");
            }

            [lon, lat] = data.features[0].center;
            const map = await getMap();
            map.flyTo({ center: [lon, lat], zoom: 14 });
            addSearchedLocationMarker(lat, lon, address);
            const chargers = await getChargers(lat, lon, distance, fastOnly);
            addChargersToMap(chargers, [lon, lat], parseFloat(distance));
            addCircleToMap([lon, lat], parseFloat(distance));
        }
    } catch (error) {
        console.error("Error in showChargers:", error.message);
        alert("Error: " + error.message);
    } finally {
        if (loading) loading.style.display = "none";
    }
}