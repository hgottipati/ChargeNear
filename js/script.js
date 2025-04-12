// script.js
import { initMap, addCurrentLocationMarker, addSearchedLocationMarker, addChargersToMap } from './mapUtils.js';
import { getCurrentLocation, showChargers, currentLocationCoords } from './location.js';
import { setupUI } from './ui.js';
import { getChargers } from './api.js';

async function init() {
    console.log("Initializing application...");
    const urlParams = new URLSearchParams(window.location.search);
    const defaultAddress = urlParams.get('address');
    const fastOnly = urlParams.get('fastOnly') === 'true' || document.getElementById("fastOnly").checked;

    document.getElementById("fastOnly").checked = fastOnly;

    // Pass only the needed functions to setupUI
    setupUI(addChargersToMap, addCurrentLocationMarker, addSearchedLocationMarker);

    const loading = document.getElementById("loading");
    const modal = document.getElementById("location-error-modal");
    const messageElement = document.getElementById("location-error-message");
    
    // Flag to track if geolocation succeeded
    let geolocationSucceeded = false;
    let userLat, userLon;

    try {
        if (loading) loading.style.display = "block";
        console.log("Requesting user location...");
        
        try {
            const { lat, lon } = await getCurrentLocation();
            userLat = lat;
            userLon = lon;
            currentLocationCoords.lat = lat;
            currentLocationCoords.lon = lon;
            geolocationSucceeded = true;
            console.log("Geolocation succeeded:", { lat, lon });
        } catch (geoError) {
            console.error("Geolocation error:", geoError);
            // Will be handled in the main catch block
            throw geoError;
        }
        
        await initMap(userLat, userLon);
        console.log("Map initialized successfully");

        // Add a marker to confirm the map is working
        console.log("Adding marker...");
        addCurrentLocationMarker(userLat, userLon);
        const chargers = await getChargers(userLat, userLon, fastOnly);
        addChargersToMap(chargers, [userLon, userLat]);
        document.getElementById("address").value = "";
        document.body.setAttribute('data-map-ready', 'true');
    } catch (error) {
        console.log("Error during initialization:", error);
        
        // Only show location error modal if geolocation actually failed
        if (!geolocationSucceeded) {
            let userMessage = "Couldn't get your location.";
            if (error.code === 1) {
                userMessage = "Location access denied. Please enable location permissions in your browser settings.";
            } else if (error.code === 2) {
                userMessage = "Geolocation is not available. Please ensure your device supports location services.";
            } else if (error.code === 3) {
                userMessage = "Geolocation request timed out. Please check your network connection.";
            }
            
            // Show the modal and hide loading
            if (loading) loading.style.display = "none";
            messageElement.textContent = `${userMessage} We can use a default location or you can enter an address manually.`;
            modal.style.display = "flex";
            document.body.setAttribute('data-map-ready', 'true'); // Enable buttons

            // Wait for user action
            const userAction = await new Promise((resolve) => {
                document.getElementById("retry-location").onclick = () => {
                    modal.style.display = "none";
                    resolve(true);
                };
                document.getElementById("use-default-location").onclick = () => {
                    modal.style.display = "none";
                    resolve(false);
                };
            });

            if (userAction) {
                // Retry logic
                try {
                    if (loading) loading.style.display = "block";
                    const { lat, lon } = await getCurrentLocation();
                    currentLocationCoords.lat = lat;
                    currentLocationCoords.lon = lon;
                    await initMap(lat, lon);
                    addCurrentLocationMarker(lat, lon);
                    const chargers = await getChargers(lat, lon, fastOnly);
                    addChargersToMap(chargers, [lon, lat]);
                    document.body.setAttribute('data-map-ready', 'true');
                } catch (retryError) {
                    console.log("Retry failed:", retryError.message);
                    alert("Retry failed. Please try again or use the default location.");
                } finally {
                    if (loading) loading.style.display = "none";
                }
            } else {
                // Use default location
                if (loading) loading.style.display = "block";
                const defaultLat = 47.6290525;
                const defaultLon = -122.3758909;
                await initMap(defaultLat, defaultLon);
                const chargers = await getChargers(defaultLat, defaultLon, fastOnly);
                addChargersToMap(chargers, [defaultLon, defaultLat]);
                addSearchedLocationMarker(defaultLat, defaultLon, "1111 Expedia Group Wy W, Seattle, WA 98119");
                document.body.setAttribute('data-map-ready', 'true');
                if (loading) loading.style.display = "none";
            }
        } else {
            // Some other error occurred after geolocation succeeded
            console.error("Non-geolocation error:", error);
            alert("An error occurred: " + error.message);
            document.body.setAttribute('data-map-ready', 'true');
        }
    } finally {
        if (loading) loading.style.display = "none";
    }
}

// Expose showChargers globally so it can be called from index.html
window.showChargers = function() {
    return showChargers(addChargersToMap, addCurrentLocationMarker, addSearchedLocationMarker);
};

// Start the app
init();