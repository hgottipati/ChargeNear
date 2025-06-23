// This file handles API requests for the ChargeNear application, including fetching charger data and address suggestions.

export async function getChargers(lat, lon, filters) {
    try {
        console.log(`Attempting to fetch chargers for lat: ${lat}, lon: ${lon}, filters:`, filters);
        
        const distance = 100;
        const apiKey = 'b61c6aab-6cef-43a9-af78-215cb02d1464';
        const ocmApiUrl = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${lat}&longitude=${lon}&distance=${distance}&distanceunit=Miles&maxresults=100&key=${apiKey}`;
        
        console.log(`API Request URL: ${ocmApiUrl}`);
        
        try {
            const response = await fetch(ocmApiUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            let chargers = await response.json();
            console.log(`Total chargers before filtering: ${chargers.length}`);
            
            // Apply filters (simplified for brevity, can be expanded)
            if (filters.operationalOnly) {
                chargers = chargers.filter(charger => 
                    charger.StatusType && charger.StatusType.Title === 'Operational'
                );
            }

            return chargers;
        } catch (directError) {
            console.warn("Direct API call failed, trying with CORS proxy:", directError);
            
            const corsProxy = 'https://corsproxy.io/?';
            const proxyUrl = corsProxy + encodeURIComponent(ocmApiUrl);
            
            const proxyResponse = await fetch(proxyUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!proxyResponse.ok) {
                throw new Error(`Proxy request failed with status: ${proxyResponse.status}`);
            }
            
            let chargers = await proxyResponse.json();
            
            if (filters.operationalOnly) {
                chargers = chargers.filter(charger => 
                    charger.StatusType && charger.StatusType.Title === 'Operational'
                );
            }
            
            return chargers;
        }
    } catch (error) {
        console.error('Failed to fetch chargers:', error);
        return [];
    }
}

export async function getAddressSuggestions(query) {
    if (!query || query.length < 3) {
        return [];
    }
    const apiKey = 'pk.eyJ1IjoiaGdvdHRpcGF0aSIsImEiOiJjbTh0cjRzazMwZXFvMnNxMmExNTdqZjBlIn0.JffbXqKwr5oh2_kMapNyDw';
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${apiKey}&autocomplete=true`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch address suggestions');
        }
        const data = await response.json();
        return data.features;
    } catch (error) {
        console.error(error);
        return [];
    }
} 