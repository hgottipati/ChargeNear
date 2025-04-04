// script.js
import { initMap, addCurrentLocationMarker, addSearchedLocationMarker, addChargersToMap, addCircleToMap } from './mapUtils.js';
import { getCurrentLocation, showChargers, currentLocationCoords } from './location.js';
import { setupUI } from './ui.js';
import { getChargers } from './api.js';

// Global flag to indicate map readiness
window.isMapReady = false;

async function init() {
    console.log("Starting app initialization...");

    try {
        // Hardcode a location (New York, NY) for testing
        const lat = 40.7128;
        const lon = -74.0060;

        console.log("Initializing map...");
        await initMap(lat, lon);
        console.log("Map initialized successfully");

        // Add a marker to confirm the map is working
        console.log("Adding marker...");
        addCurrentLocationMarker(lat, lon);

        document.body.setAttribute('data-map-ready', 'true');
        window.isMapReady = true;
        console.log("App initialization complete");
    } catch (error) {
        console.error("Error during initialization:", error.message);
        alert("Failed to initialize the app: " + error.message);
    }
}

// Expose showChargers globally
window.showChargers = () => showChargers(addChargersToMap, addCircleToMap, addCurrentLocationMarker, addSearchedLocationMarker);

// Start the app
init();