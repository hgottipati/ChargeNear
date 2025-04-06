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

            this.map.on('load', () => {
                console.log("Map loaded successfully with center:", [lon, lat]);
                this.resolveReady(this.map);
            });

            this.map.on('error', (error) => {
                console.error("Mapbox error:", error);
                this.rejectReady(new Error("Failed to load map: " + error.message));
            });

            this.map.addControl(new mapboxgl.NavigationControl());
            this.map.addControl(new GeolocationControl(), 'top-right');

            this.map.on('moveend', async () => {
                const map = await this.getMap();
                const center = map.getCenter();
                const bounds = map.getBounds();
                const distance = Math.round(
                    mapboxgl.MercatorCoordinate.fromLngLat(bounds.getNorthEast())
                        .distanceTo(mapboxgl.MercatorCoordinate.fromLngLat(bounds.getSouthWest())) / 1609.34
                ) / 2;

                const fastOnly = document.getElementById("fastOnly").checked;
                try {
                    const chargers = await getChargers(center.lat, center.lng, distance, fastOnly);
                    addChargersToMap(chargers, [center.lng, center.lat], parseFloat(document.getElementById("distance").value || "5"));
                    addCircleToMap([center.lng, center.lat], parseFloat(document.getElementById("distance").value || "5"));
                } catch (error) {
                    console.error("Error fetching chargers on map move:", error.message);
                }
            });
        } catch (error) {
            console.error("Error initializing map:", error.message);
            alert("Error initializing map: " + error.message);
            this.rejectReady(error);
        }
    }

    async getMap() {
        if (this.map) {
            await this.readyPromise;
            return this.map;
        }
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
                map.flyTo({ center: [lon, lat], zoom: 14 });
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
    if (currentLocationMarker) {
        currentLocationMarker.remove();
    }

    const el = document.createElement('div');
    el.style.backgroundColor = '#4285F4';
    el.style.width = '12px';
    el.style.height = '12px';
    el.style.borderRadius = '50%';
    el.style.border = '2px solid white';
    el.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';

    getMap().then(map => {
        currentLocationMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([lon, lat])
            .addTo(map);
    }).catch(error => {
        console.error("Error adding current location marker:", error.message);
    });
}

export function addSearchedLocationMarker(lat, lon, address) {
    if (searchedLocationMarker) {
        searchedLocationMarker.remove();
    }

    const el = document.createElement('div');
    el.style.width = '30px';
    el.style.height = '40px';
    el.style.backgroundImage = 'url("data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" fill="none">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 8.013 10.432 21.666 11.15 22.62.37.5.92.5 1.29 0C13.568 33.666 24 20.013 24 12 24 5.373 18.627 0 12 0z" fill="#FF0000"/>
            <circle cx="12" cy="12" r="4" fill="#FFFFFF"/>
        </svg>
    `) + '")';
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.cursor = 'pointer';
    el.style.transform = 'translate(-50%, -100%)';

    getMap().then(map => {
        searchedLocationMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([lon, lat])
            .setPopup(new mapboxgl.Popup().setHTML(`<h3>${address}</h3>`))
            .addTo(map);
    }).catch(error => {
        console.error("Error adding searched location marker:", error.message);
    });
}

export function addChargersToMap(chargers, center, radiusInMiles) {
    if (!center || !center[0] || !center[1]) {
        console.error("Invalid center coordinates for chargers:", center);
        return;
    }

    markers.forEach(marker => marker.remove());
    markers = [];

    const kmPerMile = 1.60934;
    const radiusInKm = radiusInMiles * kmPerMile;
    const earthRadius = 6371;

    getMap().then(map => {
        chargers.forEach(charger => {
            const { Latitude, Longitude, Title } = charger.AddressInfo;
            const walkingDistance = charger.walkingDistanceMiles || 'N/A';

            const dLat = (Latitude - center[1]) * (Math.PI / 180);
            const dLon = (Longitude - center[0]) * (Math.PI / 180);
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(center[1] * (Math.PI / 180)) * Math.cos(Latitude * (Math.PI / 180)) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distanceInKm = earthRadius * c;
            const distanceInMiles = distanceInKm / kmPerMile;

            const isWithinRadius = distanceInMiles <= radiusInMiles;

            const popup = new mapboxgl.Popup()
                .setHTML(`
                    <h3>${Title}</h3>
                    <p>Walking Distance: ${walkingDistance} miles</p>
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${Latitude},${Longitude}" target="_blank">Get Directions</a>
                `);
            const marker = new mapboxgl.Marker({ color: isWithinRadius ? 'green' : 'blue' })
                .setLngLat([Longitude, Latitude])
                .setPopup(popup)
                .addTo(map);
            markers.push(marker);
        });
    }).catch(error => {
        console.error("Error adding chargers to map:", error.message);
    });
}