import { getChargers, getAddressSuggestions } from './api.js'; // Add these imports
import { currentLocationCoords } from './location.js'; // Add this import

export function setupUI(showChargers, addChargersToMap, addCircleToMap) {
    const addressInput = document.getElementById("address");
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

    document.getElementById("distance").addEventListener("change", async () => {
        const address = document.getElementById("address").value;
        const distance = document.getElementById("distance").value || "5";
        const fastOnly = document.getElementById("fastOnly").checked;

        let lat, lon;
        if (address.toLowerCase() === "current location" && currentLocationCoords) {
            lat = currentLocationCoords.lat;
            lon = currentLocationCoords.lon;
        } else {
            const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}`);
            const data = await response.json();
            if (!data.features || data.features.length === 0) return;
            [lon, lat] = data.features[0].center;
        }

        const chargers = await getChargers(lat, lon, distance, fastOnly);
        addChargersToMap(chargers, [lon, lat], parseFloat(distance));
        addCircleToMap([lon, lat], parseFloat(distance));
    });
}