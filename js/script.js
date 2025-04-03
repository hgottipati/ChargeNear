import { initMap, addCurrentLocationMarker, addSearchedLocationMarker, addChargersToMap, addCircleToMap } from './mapUtils.js';
import { getCurrentLocation, showChargers, currentLocationCoords } from './location.js';
import { setupUI } from './ui.js';
import { getChargers } from './api.js';

// Global flag to indicate map readiness
window.isMapReady = false;

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const defaultAddress = urlParams.get('address');
    const distance = urlParams.get('distance') || document.getElementById("distance").value || "5";
    const fastOnly = urlParams.get('fastOnly') === 'true' || document.getElementById("fastOnly").checked;

    document.getElementById("distance").value = distance;
    document.getElementById("fastOnly").checked = fastOnly;

    // Setup UI but don't trigger map-dependent actions yet
    setupUI(showChargers, addChargersToMap, addCircleToMap);

    const loading = document.getElementById("loading");
    const modal = document.getElementById("location-error-modal");
    const messageElement = document.getElementById("location-error-message");

    try {
        if (loading) loading.style.display = "block";
        const { lat, lon } = await getCurrentLocation();
        currentLocationCoords.lat = lat;
        currentLocationCoords.lon = lon;
        await initMap(lat, lon);
        addCurrentLocationMarker(lat, lon);
        const chargers = await getChargers(lat, lon, distance, fastOnly);
        addChargersToMap(chargers, [lon, lat], parseFloat(distance));
        addCircleToMap([lon, lat], parseFloat(distance));
        document.getElementById("address").value = "";
        document.body.setAttribute('data-map-ready', 'true');
        window.isMapReady = true; // Signal that the map is ready
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

        if (loading) loading.style.display = "none";
        messageElement.textContent = `${userMessage} We can use a default location or you can enter an address manually.`;
        modal.style.display = "flex";
        document.body.setAttribute('data-map-ready', 'true');

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
            try {
                if (loading) loading.style.display = "block";
                const { lat, lon } = await getCurrentLocation();
                currentLocationCoords.lat = lat;
                currentLocationCoords.lon = lon;
                await initMap(lat, lon);
                addCurrentLocationMarker(lat, lon);
                const chargers = await getChargers(lat, lon, distance, fastOnly);
                addChargersToMap(chargers, [lon, lat], parseFloat(distance));
                addCircleToMap([lon, lat], parseFloat(distance));
                document.body.setAttribute('data-map-ready', 'true');
                window.isMapReady = true; // Signal that the map is ready
            } catch (retryError) {
                console.log("Retry failed:", retryError.message);
                alert("Retry failed. Please try again or use the default location.");
            } finally {
                if (loading) loading.style.display = "none";
            }
        } else {
            if (loading) loading.style.display = "block";
            const defaultLat = 47.6290525;
            const defaultLon = -122.3758909;
            await initMap(defaultLat, defaultLon);
            const chargers = await getChargers(defaultLat, defaultLon, distance, fastOnly);
            addChargersToMap(chargers, [defaultLon, defaultLat], parseFloat(distance));
            addSearchedLocationMarker(defaultLat, defaultLon, "1111 Expedia Group Wy W, Seattle, WA 98119");
            addCircleToMap([defaultLon, defaultLat], parseFloat(distance));
            document.body.setAttribute('data-map-ready', 'true');
            window.isMapReady = true; // Signal that the map is ready
            if (loading) loading.style.display = "none";
        }
    } finally {
        if (loading) loading.style.display = "none";
    }

    // Notify UI that the map is ready (in case the above block didn't set it)
    window.isMapReady = true;
}

// Expose showChargers globally so it can be called from index.html
window.showChargers = () => showChargers(addChargersToMap, addCircleToMap, addCurrentLocationMarker, addSearchedLocationMarker);

// Start the app
init();