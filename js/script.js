// script.js
import { initMap, addCurrentLocationMarker, addSearchedLocationMarker, addChargersToMap } from './mapUtils.js';
import { getCurrentLocation, showChargers, currentLocationCoords } from './location.js';
import { setupUI, locateUser } from './ui.js';
import { getChargers } from './api.js';

async function init() {
    console.log("Initializing application...");
    const urlParams = new URLSearchParams(window.location.search);
    const defaultAddress = urlParams.get('address');
    const sharedChargerId = urlParams.get('chargerId');
    const fastOnly = urlParams.get('fastOnly') === 'true' || document.getElementById("fastOnly").checked;

    document.getElementById("fastOnly").checked = fastOnly;

    // Pass only the needed functions to setupUI
    setupUI(addChargersToMap, addCurrentLocationMarker, addSearchedLocationMarker);

    const loading = document.getElementById("loading");
    const modal = document.getElementById("location-error-modal");
    const messageElement = document.getElementById("location-error-message");
    
    let initialLat, initialLon;

    try {
        if (loading) loading.style.display = "block";

        // If we have a shared charger ID, get its location first
        if (sharedChargerId) {
            console.log("Loading shared charger:", sharedChargerId);
            const filters = {
                fastOnly: false,
                level2Only: false,
                teslaSupercharger: false,
                teslaDestination: false,
                chargepointOnly: false,
                electrifyAmerica: false,
                evgo: false,
                blink: false,
                operationalOnly: false
            };
            
            const chargers = await getChargers(47.6062, -122.3321, filters);
            const targetCharger = chargers.find(c => c.ID === sharedChargerId);
            
            if (targetCharger) {
                initialLat = targetCharger.AddressInfo.Latitude;
                initialLon = targetCharger.AddressInfo.Longitude;
            }
        }

        // If no shared charger or charger not found, try user's location
        if (!initialLat || !initialLon) {
            try {
                console.log("Requesting user location...");
                const { lat, lon } = await getCurrentLocation();
                initialLat = lat;
                initialLon = lon;
                currentLocationCoords.lat = lat;
                currentLocationCoords.lon = lon;
                console.log("Geolocation succeeded:", { lat, lon });
            } catch (geoError) {
                console.error("Geolocation error:", geoError);
                // Use default location
                initialLat = 47.6062;
                initialLon = -122.3321;
                throw geoError;
            }
        }

        // Initialize map with our coordinates
        await initMap(initialLat, initialLon);
        console.log("Map initialized successfully");

        // If we have a shared charger, show it
        if (sharedChargerId) {
            const filters = {
                fastOnly: false,
                level2Only: false,
                teslaSupercharger: false,
                teslaDestination: false,
                chargepointOnly: false,
                electrifyAmerica: false,
                evgo: false,
                blink: false,
                operationalOnly: false
            };
            
            const chargers = await getChargers(initialLat, initialLon, filters);
            const targetCharger = chargers.find(c => c.ID === sharedChargerId);
            
            if (targetCharger) {
                addChargersToMap([targetCharger], [initialLon, initialLat]);
                
                // Trigger click on the marker to show details
                setTimeout(() => {
                    const marker = window.markers.find(m => m.chargerId === sharedChargerId);
                    if (marker) {
                        marker.getElement().click();
                    }
                }, 1000);
            }
        } else {
            // Normal flow - show all chargers
            const chargers = await getChargers(initialLat, initialLon, fastOnly);
            addChargersToMap(chargers, [initialLon, initialLat]);
            if (currentLocationCoords.lat && currentLocationCoords.lon) {
                addCurrentLocationMarker(currentLocationCoords.lat, currentLocationCoords.lon);
            }
        }

        document.getElementById("address").value = "";
        document.body.setAttribute('data-map-ready', 'true');

    } catch (error) {
        console.error("Error during initialization:", error);
        
        // Only show location error modal if geolocation actually failed
        if (!initialLat || !initialLon) {
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

window.locateUser = locateUser;

// Function to handle shared charger URLs
async function handleSharedCharger() {
    const urlParams = new URLSearchParams(window.location.search);
    const chargerId = urlParams.get('chargerId');
    
    if (chargerId) {
        try {
            const { getChargers } = await import('./api.js');
            const { addChargersToMap } = await import('./mapUtils.js');
            
            // Get the charger details
            const filters = {
                fastOnly: false,
                level2Only: false,
                teslaSupercharger: false,
                teslaDestination: false,
                chargepointOnly: false,
                electrifyAmerica: false,
                evgo: false,
                blink: false,
                operationalOnly: false
            };
            
            // First get all chargers in the area
            const chargers = await getChargers(47.6062, -122.3321, filters); // Default to Seattle coordinates
            const targetCharger = chargers.find(c => c.ID === chargerId);
            
            if (targetCharger) {
                const map = await window.getMap();
                // Center map on the charger location
                map.flyTo({
                    center: [targetCharger.AddressInfo.Longitude, targetCharger.AddressInfo.Latitude],
                    zoom: 15,
                    essential: true
                });
                
                // Add the charger to the map
                addChargersToMap([targetCharger], [targetCharger.AddressInfo.Longitude, targetCharger.AddressInfo.Latitude]);
                
                // Trigger click on the marker to show details
                setTimeout(() => {
                    const marker = window.markers.find(m => m.chargerId === chargerId);
                    if (marker) {
                        marker.getElement().click();
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Error handling shared charger:', error);
        }
    }
}

// Call the function when the page loads
document.addEventListener('DOMContentLoaded', () => {
    handleSharedCharger();
});

// Start the app
init();