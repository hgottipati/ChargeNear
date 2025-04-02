export async function getChargers(lat, lon, distance, fastOnly) {
    try {
        const url = `https://74ohkix1sb.execute-api.us-east-1.amazonaws.com/prod?lat=${lat}&lon=${lon}&distance=${distance}&fastOnly=${fastOnly}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch chargers: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching chargers:", error.message);
        throw error;
    }
}

export async function getAddressSuggestions(query) {
    try {
        if (typeof MAPBOX_TOKEN === 'undefined') {
            throw new Error("Mapbox token is not defined. Please ensure config.js is loaded correctly.");
        }
        const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`
        );
        const data = await response.json();
        return data.features.map(feature => feature.place_name);
    } catch (error) {
        console.error("Error fetching address suggestions:", error.message);
        return [];
    }
}