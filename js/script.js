import { initMap, addCurrentLocationMarker, addSearchedLocationMarker, addChargersToMap, addCircleToMap } from './mapUtils.js';
<<<<<<< HEAD
import { getCurrentLocation, showChargers, currentLocationCoords } from './location.js';
import { setupUI } from './ui.js';

async function init() {
=======
import { getCurrentLocation, showChargers, currentLocationCoords, currentCenter } from './location.js';
import { setupUI } from './ui.js';
import { getChargers } from './api.js';

async function init() {
    // Set the header height immediately to ensure the map has the correct height
    const header = document.getElementById('header');
    const headerHeight = header.offsetHeight;
    document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);

>>>>>>> 01003a91c29e51d6a7a2c13d930fdcdb4d1b97c6
    const urlParams = new URLSearchParams(window.location.search);
    const defaultAddress = urlParams.get('address');
    const distance = urlParams.get('distance') || document.getElementById("distance").value || "5";
    const fastOnly = urlParams.get('fastOnly') === 'true' || document.getElementById("fastOnly").checked;

    document.getElementById("distance").value = distance;
    document.getElementById("fastOnly").checked = fastOnly;

<<<<<<< HEAD
    setupUI(showChargers, addChargersToMap, addCircleToMap);

=======
>>>>>>> 01003a91c29e51d6a7a2c13d930fdcdb4d1b97c6
    const loading = document.getElementById("loading");

    try {
        if (loading) loading.style.display = "block";
        const { lat, lon } = await getCurrentLocation();
        currentLocationCoords = { lat, lon };
<<<<<<< HEAD
        await initMap(lat, lon);
=======
        currentCenter = { lat, lon };
        await initMap(lat, lon);

        setupUI(showChargers, addChargersToMap, addCircleToMap);

        const addressInput = document.getElementById('address');
        addressInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                showChargers(addChargersToMap, addCircleToMap, addCurrentLocationMarker, addSearchedLocationMarker);
            }
        });

>>>>>>> 01003a91c29e51d6a7a2c13d930fdcdb4d1b97c6
        addCurrentLocationMarker(lat, lon);
        const chargers = await getChargers(lat, lon, distance, fastOnly);
        addChargersToMap(chargers, [lon, lat], parseFloat(distance));
        addCircleToMap([lon, lat], parseFloat(distance));
        document.getElementById("address").value = "";
<<<<<<< HEAD
=======

        // Set the data-map-ready attribute to enable the UI
        document.body.setAttribute('data-map-ready', 'true');
>>>>>>> 01003a91c29e51d6a7a2c13d930fdcdb4d1b97c6
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
        userMessage += " Using default location. Click OK to try again or enter an address manually.";
        if (confirm(userMessage)) {
            try {
                const { lat, lon } = await getCurrentLocation();
                currentLocationCoords = { lat, lon };
<<<<<<< HEAD
                await initMap(lat, lon);
=======
                currentCenter = { lat, lon };
                await initMap(lat, lon);

                setupUI(showChargers, addChargersToMap, addCircleToMap);
                const addressInput = document.getElementById('address');
                addressInput.addEventListener('keypress', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        showChargers(addChargersToMap, addCircleToMap, addCurrentLocationMarker, addSearchedLocationMarker);
                    }
                });

>>>>>>> 01003a91c29e51d6a7a2c13d930fdcdb4d1b97c6
                addCurrentLocationMarker(lat, lon);
                const chargers = await getChargers(lat, lon, distance, fastOnly);
                addChargersToMap(chargers, [lon, lat], parseFloat(distance));
                addCircleToMap([lon, lat], parseFloat(distance));
                document.getElementById("address").value = "";
<<<<<<< HEAD
=======

                document.body.setAttribute('data-map-ready', 'true');
>>>>>>> 01003a91c29e51d6a7a2c13d930fdcdb4d1b97c6
                return;
            } catch (retryError) {
                console.log("Retry failed:", retryError.message);
            }
        }

        const defaultLat = 47.6290525;
        const defaultLon = -122.3758909;
<<<<<<< HEAD
        await initMap(defaultLat, defaultLon);
=======
        currentCenter = { lat: defaultLat, lon: defaultLon };
        await initMap(defaultLat, defaultLon);

        setupUI(showChargers, addChargersToMap, addCircleToMap);
        const addressInput = document.getElementById('address');
        addressInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                showChargers(addChargersToMap, addCircleToMap, addCurrentLocationMarker, addSearchedLocationMarker);
            }
        });

>>>>>>> 01003a91c29e51d6a7a2c13d930fdcdb4d1b97c6
        const chargers = await getChargers(defaultLat, defaultLon, distance, fastOnly);
        addChargersToMap(chargers, [defaultLon, defaultLat], parseFloat(distance));
        addSearchedLocationMarker(defaultLat, defaultLon, "1111 Expedia Group Wy W, Seattle, WA 98119");
        addCircleToMap([defaultLon, defaultLat], parseFloat(distance));
        document.getElementById("address").value = "";
<<<<<<< HEAD
=======

        document.body.setAttribute('data-map-ready', 'true');
>>>>>>> 01003a91c29e51d6a7a2c13d930fdcdb4d1b97c6
    } finally {
        if (loading) loading.style.display = "none";
    }
}

<<<<<<< HEAD
// Expose showChargers globally so it can be called from index.html
window.showChargers = () => showChargers(addChargersToMap, addCircleToMap, addCurrentLocationMarker, addSearchedLocationMarker);

// Start the app
=======
window.showChargers = () => showChargers(addChargersToMap, addCircleToMap, addCurrentLocationMarker, addSearchedLocationMarker);

>>>>>>> 01003a91c29e51d6a7a2c13d930fdcdb4d1b97c6
init();