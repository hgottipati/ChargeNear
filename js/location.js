import { getMap } from './mapUtils.js';
import { getChargers } from './api.js';

export let currentLocationCoords = { lat: null, lon: null };

export async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            console.error("Geolocation not supported by this browser");
            reject(new Error("Geolocation is not supported by this browser."));
            return;
        }

        console.log("Requesting current location...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                console.log(`Location fetched successfully: lat=${lat}, lon=${lon}`);
                resolve({ lat, lon });
            },
            (error) => {
                console.error("Geolocation error:", error.message, "Code:", error.code);
                // Provide more specific error messages based on the code
                let errorMessage = "Couldn’t get your location.";
                if (error.code === 1) {
                    errorMessage = "Location access denied by user.";
                } else if (error.code === 2) {
                    errorMessage = "Unable to determine your location. Please ensure location services are enabled on your device.";
                } else if (error.code === 3) {
                    errorMessage = "Location request timed out. Please check your network connection.";
                }
                reject(new Error(errorMessage));
            },
            { timeout: 15000, enableHighAccuracy: true } // Increased timeout to 15 seconds
        );
    });
}

export async function showChargers(addChargersToMap, addCircleToMap, addCurrentLocationMarker, addSearchedLocationMarker) {
    console.log("showChargers called with arguments:", {
        addChargersToMap: typeof addChargersToMap,
        addCircleToMap: typeof addCircleToMap,
        addCurrentLocationMarker: typeof addCurrentLocationMarker,
        addSearchedLocationMarker: typeof addSearchedLocationMarker
    });

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
            if (currentLocationCoords.lat && currentLocationCoords.lon) {
                lat = currentLocationCoords.lat;
                lon = currentLocationCoords.lon;
            } else {
                const coords = await getCurrentLocation();
                lat = coords.lat;
                lon = coords.lon;
                currentLocationCoords.lat = lat;
                currentLocationCoords.lon = lon;
            }

            const map = await getMap();
            map.jumpTo({ center: [lon, lat], zoom: 14 });
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