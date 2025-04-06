import { getChargers } from './api.js';
import { getCurrentLocation, currentLocationCoords } from './location.js';

let mapInstance = null;
let mapReadyPromise = null;
export let markers = [];
export let currentLocationMarker = null;
export let searchedLocationMarker = null;
export let circleLabelMarker = null;
const circleLayerId = 'radius-circle';
const circleSourceId = 'radius-circle-source';

class MapManager {
    constructor() {
        this.map = null;
        this.readyPromise = new Promise((resolve, reject) => {
            this.resolveReady = resolve;
            this.rejectReady = reject;
        });
    }

    async initMap(lat, lon) {
        try {
            if (typeof MAPBOX_TOKEN === 'undefined') {
                throw new Error("Mapbox token is not defined. Please ensure config.js is loaded correctly.");
            }
            mapboxgl.accessToken = MAPBOX_TOKEN;
            this.map = new mapboxgl.Map({
                container: 'map',
                style: 'mapbox://styles/mapbox/streets-v12',
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
}

const mapManager = new MapManager();
export const initMap = mapManager.initMap.bind(mapManager);
export const getMap = mapManager.getMap.bind(mapManager);

// Function to generate a circle polygon (approximated with many points)
export function generateCircle(center, radiusInMiles, points = 64) {
    if (!center || !center[0] || !center[1]) {
        console.error("Invalid center coordinates for circle:", center);
        return null;
    }
    const coords = { lat: center[1], lng: center[0] };
    const kmPerMile = 1.60934;
    const radiusInKm = radiusInMiles * kmPerMile;
    const earthRadius = 6371; // Earth's radius in km
    const pointsArray = [];

    for (let i = 0; i < points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        const dx = radiusInKm * Math.cos(angle);
        const dy = radiusInKm * Math.sin(angle);

        const lat = coords.lat + (dy / earthRadius) * (180 / Math.PI);
        const lng = coords.lng + (dx / earthRadius) * (180 / Math.PI) / Math.cos(coords.lat * Math.PI / 180);

        pointsArray.push([lng, lat]);
    }
    pointsArray.push(pointsArray[0]); // Close the polygon

    return {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [pointsArray]
        }
    };
}

// Function to add or update the circle on the map
export async function addCircleToMap(center, radiusInMiles) {
    if (!center || !radiusInMiles) {
        console.error("Cannot add circle: Invalid center or radius", { center, radiusInMiles });
        return;
    }

    const circleGeoJSON = generateCircle(center, radiusInMiles);
    if (!circleGeoJSON) {
        console.error("Failed to generate circle GeoJSON");
        return;
    }

    try {
        const map = await getMap();
        if (!map.loaded()) {
            map.on('load', () => {
                addCircleLayer(map, center, radiusInMiles, circleGeoJSON);
            });
        } else {
            addCircleLayer(map, center, radiusInMiles, circleGeoJSON);
        }
    } catch (error) {
        console.error("Error adding circle to map:", error.message);
    }
}

function addCircleLayer(map, center, radiusInMiles, circleGeoJSON) {
    if (map.getSource(circleSourceId)) {
        map.getSource(circleSourceId).setData(circleGeoJSON);
    } else {
        map.addSource(circleSourceId, {
            type: 'geojson',
            data: circleGeoJSON
        });

        map.addLayer({
            id: circleLayerId,
            type: 'fill',
            source: circleSourceId,
            paint: {
                'fill-color': '#EEC218',
                'fill-opacity': 0.3
            }
        });

        map.addLayer({
            id: `${circleLayerId}-outline`,
            type: 'line',
            source: circleSourceId,
            paint: {
                'line-color': '#EEC218',
                'line-width': 2
            }
        });
    }

    if (circleLabelMarker) {
        circleLabelMarker.remove();
    }

    let labelText;
    if (radiusInMiles <= 1) {
        const walkingTimeMinutes = Math.round((radiusInMiles / 3) * 60);
        labelText = `${walkingTimeMinutes} min walk`;
    } else {
        labelText = `${radiusInMiles} miles`;
    }

    const kmPerMile = 1.60934;
    const radiusInKm = radiusInMiles * kmPerMile;
    const earthRadius = 6371;
    const angle = 0;
    const dx = radiusInKm * Math.cos(angle);
    const dy = radiusInKm * Math.sin(angle);
    const labelLat = center[1] + (dy / earthRadius) * (180 / Math.PI);
    const labelLon = center[0] + (dx / earthRadius) * (180 / Math.PI) / Math.cos(center[1] * Math.PI / 180);

    const labelEl = document.createElement('div');
    labelEl.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    labelEl.style.color = 'white';
    labelEl.style.padding = '2px 6px';
    labelEl.style.borderRadius = '3px';
    labelEl.style.fontSize = '12px';
    labelEl.style.whiteSpace = 'nowrap';
    labelEl.innerText = labelText;

    circleLabelMarker = new mapboxgl.Marker({ element: labelEl })
        .setLngLat([labelLon, labelLat])
        .addTo(map);
}

export class GeolocationControl {
    constructor() {}

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        this._container.innerHTML = `
            <button class="mapboxgl-ctrl-icon" title="Get Current Location" style="background: white; border: none; padding: 0;">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#4285F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
            </button>
        `;
        this._container.onclick = async () => {
            try {
                const { lat, lon } = await getCurrentLocation();
                currentLocationCoords.lat = lat;
                currentLocationCoords.lon = lon;
                const map = await getMap();
                map.jumpTo({ center: [lon, lat], zoom: 14 });
                addCurrentLocationMarker(lat, lon);
                const distance = document.getElementById("distance").value || "5";
                const fastOnly = document.getElementById("fastOnly").checked;
                const chargers = await getChargers(lat, lon, distance, fastOnly);
                addChargersToMap(chargers, [lon, lat], parseFloat(distance));
                addCircleToMap([lon, lat], parseFloat(distance));
                document.getElementById("address").value = "Current Location";
            } catch (error) {
                alert("Failed to get current location: " + error.message);
            }
        };
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

export function addCurrentLocationMarker(lat, lon) {
    if (!map) throw new Error("Map not initialized");
    new mapboxgl.Marker({ color: '#0000FF' }) // Blue marker
        .setLngLat([lon, lat])
        .addTo(map);
}

// ... (other functions like addSearchedLocationMarker, addChargersToMap, addCircleToMap remain unchanged)