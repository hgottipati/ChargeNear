// api.js
// This file handles API requests for the ChargeNear application, including fetching charger data and address suggestions.

export async function getChargers(lat, lon, distance, fastOnly) {
    try {
        // Convert distance to a number to ensure consistency
        const radius = parseFloat(distance);
        // Set a higher limit to fetch more chargers (adjust based on API capabilities)
        const limit = 50; // Increase this if the API supports it and more chargers are needed

        // Construct the API URL with query parameters
        // Replace 'https://your-api-endpoint/chargers' with your actual charger data API endpoint
        const url = `https://your-api-endpoint/chargers?lat=${lat}&lon=${lon}&radius=${radius}&fastOnly=${fastOnly}&limit=${limit}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch chargers: ${response.statusText}`);
        }
        
        const data = await response.json();
        const chargers = data.chargers || []; // Adjust based on your API's response structure
        
        // Log the number of chargers fetched for debugging
        console.log(`Fetched ${chargers.length} chargers within ${radius} miles from lat:${lat}, lon:${lon}`, chargers);
        
        return chargers;
    } catch (error) {
        console.error("Error fetching chargers:", error.message);
        throw error; // Re-throw to allow the caller to handle the error
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
        if (!response.ok) {
            throw new Error(`Failed to fetch address suggestions: ${response.statusText}`);
        }
        const data = await response.json();
        const suggestions = data.features.map(feature => feature.place_name);
        
        return suggestions;
    } catch (error) {
        console.error("Error fetching address suggestions:", error.message);
        throw error;
    }
}