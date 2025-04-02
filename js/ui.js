import { getChargers, getAddressSuggestions } from './api.js';
import { currentCenter } from './location.js';

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
        const loading = document.getElementById("loading");
        try {
            if (loading) loading.style.display = "block";

            const distance = document.getElementById("distance").value || "5";
            const fastOnly = document.getElementById("fastOnly").checked;

            if (!currentCenter) {
                throw new Error("No center point set. Please search for a location first.");
            }
            const lat = currentCenter.lat;
            const lon = currentCenter.lon;

            const chargers = await getChargers(lat, lon, distance, fastOnly);
            addChargersToMap(chargers, [lon, lat], parseFloat(distance));
            addCircleToMap([lon, lat], parseFloat(distance));
        } catch (error) {
            console.error("Error updating map with new distance:", error.message);
            alert("Error updating map with new distance: " + error.message);
        } finally {
            if (loading) loading.style.display = "none";
        }
    });
}