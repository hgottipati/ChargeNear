// mapUtils.js
import mapboxgl from 'mapbox-gl';

let map = null;

export async function initMap(lat, lon) {
    console.log("Starting map initialization...");
    
    try {
        // Ensure Mapbox token is defined (should be in config.js)
        if (!mapboxgl.accessToken) {
            throw new Error("Mapbox access token is not defined. Please check config.js.");
        }

        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [lon, lat],
            zoom: 12
        });

        await new Promise((resolve) => {
            map.on('load', () => {
                console.log("Map loaded successfully");
                resolve();
            });
        });

        return map;
    } catch (error) {
        console.error("Error initializing map:", error.message);
        throw error;
    }
}

export async function getMap() {
    if (!map) {
        throw new Error("Map not initialized. Call initMap first.");
    }
    return map;
}

export function addCurrentLocationMarker(lat, lon) {
    if (!map) throw new Error("Map not initialized");
    new mapboxgl.Marker({ color: '#0000FF' }) // Blue marker
        .setLngLat([lon, lat])
        .addTo(map);
}

// ... (other functions like addSearchedLocationMarker, addChargersToMap, addCircleToMap remain unchanged)