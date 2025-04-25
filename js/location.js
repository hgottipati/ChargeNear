import { getMap } from './mapUtils.js';
import { getChargers } from './api.js';

export let currentLocationCoords = { lat: null, lon: null };

export async function getCurrentLocation() {
    console.log("Attempting to get current location...");
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            console.error("Geolocation is not supported by this browser.");
            reject(new Error("Geolocation is not supported by your browser."));
            return;
        }
        
        console.log("Geolocation is supported, requesting position...");
        
        navigator.geolocation.getCurrentPosition(
            position => {
                console.log("Successfully retrieved current location:", {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                });
            },
            error => {
                console.error("Error getting current location:", {
                    message: error.message,
                    code: error.code,
                    PERMISSION_DENIED: error.code === 1,
                    POSITION_UNAVAILABLE: error.code === 2,
                    TIMEOUT: error.code === 3
                });
                
                // Give a more specific error message based on the error code
                let errorMessage = "Failed to get your location.";
                if (error.code === 1) {
                    errorMessage = "Location access was denied. Please allow location access in your browser settings.";
                } else if (error.code === 2) {
                    errorMessage = "Your location is not available. Please check your device's location services.";
                } else if (error.code === 3) {
                    errorMessage = "Getting your location timed out. Please try again.";
                }
                
                reject(Object.assign(error, { userMessage: errorMessage }));
            },
            { 
                timeout: 15000, 
                enableHighAccuracy: true,
                maximumAge: 0 // Don't use cached position
            }
        );
    });
}

export async function showChargers(addChargersToMap, addCurrentLocationMarker, addSearchedLocationMarker) {
    let address = document.getElementById("address").value;
    const fastOnly = document.getElementById("fastOnly").checked;
    const teslaSupercharger = document.getElementById("teslaSupercharger").checked;
    const teslaDestination = document.getElementById("teslaDestination").checked;
    const chargepointOnly = document.getElementById("chargepointOnly").checked;
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
            const chargers = await getChargers(lat, lon, fastOnly, teslaSupercharger, teslaDestination, chargepointOnly);
            addChargersToMap(chargers, [lon, lat]);
        } else {
            if (typeof window.MAPBOX_TOKEN === 'undefined') {
                console.error("Mapbox token is not defined");
                throw new Error("Mapbox token is not defined. Please ensure config.js is loaded correctly.");
            }
            
            try {
                console.log(`Geocoding address: ${address}`);
                const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${window.MAPBOX_TOKEN}`);
                const data = await response.json();
                console.log("Geocoding response:", data);
                
                if (!data.features || data.features.length === 0) {
                    throw new Error("Address not found. Please try a different address.");
                }

                [lon, lat] = data.features[0].center;
                console.log(`Address geocoded to lat: ${lat}, lon: ${lon}`);
                
                const map = await getMap();
                map.jumpTo({ center: [lon, lat], zoom: 14 });
                addSearchedLocationMarker(lat, lon, address);
                const chargers = await getChargers(lat, lon, fastOnly, teslaSupercharger, teslaDestination, chargepointOnly);
                addChargersToMap(chargers, [lon, lat]);
            } catch (error) {
                console.error("Error geocoding address:", error);
                throw error;
            }
        }
    } catch (error) {
        console.error("Error in showChargers:", error.message);
        alert("Error: " + error.message);
    } finally {
        if (loading) loading.style.display = "none";
    }
}