import { getChargers, getAddressSuggestions } from './api.js';
import { currentLocationCoords, getCurrentLocation } from './location.js';
import { getMap, addChargersToMap, addCurrentLocationMarker, addSearchedLocationMarker } from './mapUtils.js';


export function setupUI(addChargersToMap, addCurrentLocationMarker, addSearchedLocationMarker) {
    const addressInput = document.getElementById("address");
    const distanceSelect = document.getElementById("distance");
    const fastOnlyCheckbox = document.getElementById("fastOnly");
    const teslaSuperchargerCheckbox = document.getElementById("teslaSupercharger");
    const teslaDestinationCheckbox = document.getElementById("teslaDestination");
    const chargepointOnlyCheckbox = document.getElementById("chargepointOnly");

    // Hide the distance dropdown since we no longer need it
    if (distanceSelect) {
        distanceSelect.style.display = 'none';
    }

    // Address input suggestions
    addressInput.addEventListener("input", async () => {
        const query = addressInput.value;
        if (query.length < 3) return;
        const suggestions = await getAddressSuggestions(query);
        const datalist = document.createElement('datalist');
        datalist.id = 'address-suggestions';
        datalist.innerHTML = suggestions.map(s => `<option value="${s}">`).join("");
        addressInput.setAttribute('list', 'address-suggestions');
        if (document.getElementById('address-suggestions')) {
            document.getElementById('address-suggestions').remove();
        }
        document.body.appendChild(datalist);
    });

    // Search on Enter key press
    addressInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            showChargers(addChargersToMap, addCurrentLocationMarker, addSearchedLocationMarker);
        }
    });

    // Optional: Search on blur for mobile
    addressInput.addEventListener('blur', () => {
        if (addressInput.value.trim()) {
            showChargers(addChargersToMap, addCurrentLocationMarker, addSearchedLocationMarker);
        }
    });

    // Function to update chargers based on filter changes
    const updateChargers = async () => {
        const fastOnly = fastOnlyCheckbox.checked;
        const teslaSupercharger = teslaSuperchargerCheckbox.checked;
        const teslaDestination = teslaDestinationCheckbox.checked;
        const chargepointOnly = chargepointOnlyCheckbox.checked;

        try {
            // Wait for the map to be ready
            await new Promise((resolve) => {
                const checkMapReady = () => {
                    if (window.isMapReady) {
                        resolve();
                    } else {
                        setTimeout(checkMapReady, 100);
                    }
                };
                checkMapReady();
            });

            const map = await getMap();
            let lat, lon;

            if (currentLocationCoords.lat && currentLocationCoords.lon && (!addressInput.value || addressInput.value.toLowerCase() === "current location")) {
                lat = currentLocationCoords.lat;
                lon = currentLocationCoords.lon;
            } else if (addressInput.value) {
                try {
                    if (typeof window.MAPBOX_TOKEN === 'undefined') {
                        console.error("Mapbox token is not defined");
                        throw new Error("Mapbox token is not defined. Please ensure config.js is loaded correctly.");
                    }
                    
                    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressInput.value)}.json?access_token=${window.MAPBOX_TOKEN}`);
                    const data = await response.json();
                    console.log("Geocoding response:", data);
                    
                    if (!data.features || data.features.length === 0) {
                        console.warn("No features found in geocoding response");
                        [lon, lat] = map.getCenter().toArray();
                    } else {
                        [lon, lat] = data.features[0].center;
                    }
                } catch (error) {
                    console.error("Error geocoding address:", error);
                    [lon, lat] = map.getCenter().toArray();
                }
            } else {
                [lon, lat] = map.getCenter().toArray();
            }

            const chargers = await getChargers(lat, lon, fastOnly, teslaSupercharger, teslaDestination, chargepointOnly);
            addChargersToMap(chargers, [lon, lat]);
        } catch (error) {
            console.error("Error updating charger filters:", error.message);
            alert("Error updating map: " + error.message);
        }
    };

    // Add event listeners for all filter checkboxes
    fastOnlyCheckbox.addEventListener("change", updateChargers);
    teslaSuperchargerCheckbox.addEventListener("change", updateChargers);
    teslaDestinationCheckbox.addEventListener("change", updateChargers);
    chargepointOnlyCheckbox.addEventListener("change", updateChargers);
}