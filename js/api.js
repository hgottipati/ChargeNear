// api.js
// This file handles API requests for the ChargeNear application, including fetching charger data and address suggestions.

export async function getChargers(lat, lon, fastOnly) {
    try {
        console.log(`Attempting to fetch chargers for lat: ${lat}, lon: ${lon}, fastOnly: ${fastOnly}`);
        
        // Fixed distance parameter (required by the API)
        const distance = 50; // Fixed at 50 miles, not related to the UI
        
        // Try using direct OpenChargeMap API first
        const apiKey = 'b61c6aab-6cef-43a9-af78-215cb02d1464'; // Using the same key as the Lambda
        const ocmApiUrl = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${lat}&longitude=${lon}&distance=${distance}&distanceunit=Miles&maxresults=30&key=${apiKey}`;
        
        console.log(`API Request URL: ${ocmApiUrl}`);
        
        try {
            // Try direct API call first
            const response = await fetch(ocmApiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            let chargers = await response.json();
            
            // Apply fast charger filter if needed
            if (fastOnly === true) {
                chargers = chargers.filter(charger => 
                    charger.Connections && charger.Connections.some(conn => conn.LevelID === 3)
                );
            }
            
            console.log(`Fetched ${chargers.length} chargers from lat:${lat}, lon:${lon}`);
            
            if (chargers.length === 0) {
                console.warn("No chargers found in this area");
            }
            
            return chargers;
        } catch (directError) {
            console.warn("Direct API call failed, trying with CORS proxy:", directError);
            
            // Fallback to CORS proxy if direct call fails
            const corsProxy = 'https://corsproxy.io/?';
            const proxyUrl = corsProxy + encodeURIComponent(ocmApiUrl);
            
            console.log(`Trying with CORS proxy: ${proxyUrl}`);
            
            const proxyResponse = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!proxyResponse.ok) {
                throw new Error(`Proxy request failed with status: ${proxyResponse.status}`);
            }
            
            let chargers = await proxyResponse.json();
            
            // Apply fast charger filter if needed
            if (fastOnly === true) {
                chargers = chargers.filter(charger => 
                    charger.Connections && charger.Connections.some(conn => conn.LevelID === 3)
                );
            }
            
            console.log(`Fetched ${chargers.length} chargers via proxy from lat:${lat}, lon:${lon}`);
            return chargers;
        }
    } catch (error) {
        console.error("Error fetching chargers:", error);
        throw error;
    }
}

export async function getAddressSuggestions(query) {
    try {
        if (typeof window.MAPBOX_TOKEN === 'undefined') {
            console.error("Mapbox token is not defined");
            throw new Error("Mapbox token is not defined. Please ensure config.js is loaded correctly.");
        }
        
        console.log(`Getting address suggestions for query: ${query}`);
        const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${window.MAPBOX_TOKEN}&autocomplete=true&limit=5`
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