import { getMap } from './mapUtils.js';
import { getChargers } from './api.js';

export let currentLocationCoords = { lat: null, lon: null };

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
            { timeout: 15000, enableHighAccuracy: true }
        );
    });
}

export async function showChargers(addChargersToMap, addCircleToMap, addCurrentLocationMarker, addSearchedLocationMarker) {
    let address = document.getElementById("address").value;
    const distance = document.getElementById("distance").value || "5";
    const fastOnly = document.getElementById("fastOnly").checked;
    const loading = document.getElementById("loading");

    // If address is empty, default to "current location"
    if (!address.trim()) {
        address = "current location";
    }

    try {
        if (loading) loading.style.display = "block";

        let lat, lon;

        if (address.toLowerCase() === "current location") {
            if (currentLocationCoords.lat && currentLocationCoords.lon) {
                lat = currentLocationCoords.lat;
                lon = currentLocationCoords.lon;
            } else {
                try {
                    const coords = await getCurrentLocation();
                    lat = coords.lat;
                    lon = coords.lon;
                    currentLocationCoords.lat = lat;
                    currentLocationCoords.lon = lon;
                } catch (error) {
                    // If geolocation fails, fall back to the default location
                    console.log("Failed to get current location, using default:", error.message);
                    lat = 47.6290525; // Default latitude (Seattle, WA)
                    lon = -122.3758909; // Default longitude
                    address = "1111 Expedia Group Wy W, Seattle, WA 98119"; // Default address for marker
                }
            }

            const map = await getMap();
            map.jumpTo({ center: [lon, lat], zoom: 14 });
            if (address.toLowerCase() === "current location") {
                addCurrentLocationMarker(lat, lon);
            } else {
                // If we fell back to the default location, use a searched location marker
                addSearchedLocationMarker(lat, lon, address);
            }
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
            map.jumpTo({ center: [lon, lat], zoom: 14 });
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