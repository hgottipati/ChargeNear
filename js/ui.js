import { getChargers, getAddressSuggestions } from './api.js';
import { currentLocationCoords, getCurrentLocation } from './location.js';
import { getMap, addChargersToMap, addCircleToMap } from './mapUtils.js';

export function setupUI(showChargers, addChargersToMap, addCircleToMap) {
    const addressInput = document.getElementById("address");
    const distanceSelect = document.getElementById("distance");
    const fastOnlyCheckbox = document.getElementById("fastOnly");

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
    addressInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            showChargers();
        }
    });

    // Automatic update when distance changes
    distanceSelect.addEventListener("change", async () => {
        const distance = distanceSelect.value || "5";
        const fastOnly = fastOnlyCheckbox.checked;

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
            } else if (addressInput.value && addressInput.value.toLowerCase() !== "current location") {
                const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressInput.value)}.json?access_token=${MAPBOX_TOKEN}`);
                const data = await response.json();
                if (!data.features || data.features.length === 0) {
                    [lon, lat] = map.getCenter().toArray();
                } else {
                    [lon, lat] = data.features[0].center;
                }
            } else {
                [lon, lat] = map.getCenter().toArray();
            }

            const chargers = await getChargers(lat, lon, distance, fastOnly);
            addChargersToMap(chargers, [lon, lat], parseFloat(distance));
            addCircleToMap([lon, lat], parseFloat(distance));
        } catch (error) {
            console.error("Error updating distance filter:", error.message);
            alert("Error updating map: " + error.message);
        }
    });

    // Wait for the map to be ready before triggering the initial change
    (async () => {
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
        distanceSelect.dispatchEvent(new Event('change'));
    })();
}