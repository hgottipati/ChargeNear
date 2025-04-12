import { getChargers } from './api.js';
import { getCurrentLocation, currentLocationCoords } from './location.js';

let mapInstance = null;
let mapReadyPromise = null;
export let markers = [];
export let currentLocationMarker = null;
export let searchedLocationMarker = null;

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
            console.log(`Initializing map at lat: ${lat}, lon: ${lon}`);
            
            // Check if MAPBOX_TOKEN is available
            if (typeof window.MAPBOX_TOKEN === 'undefined') {
                throw new Error("Mapbox token is not defined. Please ensure config.js is loaded correctly.");
            }
            
            // Initialize Mapbox map
            mapboxgl.accessToken = window.MAPBOX_TOKEN;
            console.log("Setting mapboxgl.accessToken");
            
            this.map = new mapboxgl.Map({
                container: 'map',
                style: 'mapbox://styles/mapbox/streets-v12',
                center: [lon, lat],
                zoom: 14
            });

            // Create a reference to this MapManager instance
            const that = this;

            // Set up map load handler
            this.map.on('load', () => {
                console.log("Map loaded successfully");
                window.isMapReady = true;
                that.resolveReady(that.map);
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
                const fastOnly = document.getElementById("fastOnly").checked;
                try {
                    const chargers = await getChargers(center.lat, center.lng, fastOnly);
                    addChargersToMap(chargers, [center.lng, center.lat]);
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
            return this.map;
        } else {
            try {
                console.log("Waiting for map to be ready...");
                return await this.readyPromise;
            } catch (error) {
                console.error("Error getting map:", error);
                return null;
            }
        }
    }
}

const mapManager = new MapManager();

// Export the async function to get the map
export async function getMap() {
    try {
        const map = await mapManager.getMap();
        if (!map) {
            console.error("Map instance is null or undefined");
        }
        return map;
    } catch (error) {
        console.error("Error getting map:", error);
        return null;
    }
}

// Export the initMap function
export async function initMap(lat, lon) {
    try {
        console.log(`Initializing map at [${lat}, ${lon}]`);
        await mapManager.initMap(lat, lon);
        return mapManager.getMap();
    } catch (error) {
        console.error("Error initializing map:", error);
        throw error;
    }
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
                console.log("GeolocationControl: Requesting current location...");
                const { lat, lon } = await getCurrentLocation();
                console.log(`GeolocationControl: Got location [${lat}, ${lon}]`);
                
                currentLocationCoords.lat = lat;
                currentLocationCoords.lon = lon;
                
                const map = await getMap();
                if (!map) {
                    throw new Error("Map not available");
                }
                
                map.jumpTo({ center: [lon, lat], zoom: 14 });
                addCurrentLocationMarker(lat, lon);
                
                const fastOnly = document.getElementById("fastOnly").checked;
                
                console.log(`GeolocationControl: Fetching chargers for [${lat}, ${lon}], fastOnly: ${fastOnly}`);
                const chargers = await getChargers(lat, lon, fastOnly);
                console.log(`GeolocationControl: Fetched ${chargers.length} chargers`);
                
                addChargersToMap(chargers, [lon, lat]);
                document.getElementById("address").value = "Current Location";
            } catch (error) {
                console.error("GeolocationControl error:", error);
                alert("Failed to get current location: " + (error.userMessage || error.message));
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

export function addChargersToMap(chargers, center) {
    if (!center || !center[0] || !center[1]) {
        console.error("Invalid center coordinates for chargers:", center);
        return;
    }

    console.log(`Adding ${chargers.length} chargers to map with center [${center[0]}, ${center[1]}]`);
    
    markers.forEach(marker => marker.remove());
    markers = [];

    getMap().then(map => {
        if (!map) {
            console.error("Map is not available");
            return;
        }
        
        chargers.forEach(charger => {
            try {
                // Handle both OCM API structure and our mock data
                if (!charger.AddressInfo || !charger.AddressInfo.Latitude || !charger.AddressInfo.Longitude) {
                    console.warn("Invalid charger data:", charger);
                    return;
                }
                
                const { Latitude, Longitude, Title } = charger.AddressInfo;
                const walkingDistance = charger.walkingDistanceMiles || 'N/A';

                const popup = new mapboxgl.Popup()
                    .setHTML(`
                        <h3>${Title || 'Charger'}</h3>
                        <p>Walking Distance: ${walkingDistance} miles</p>
                        <a href="https://www.google.com/maps/dir/?api=1&destination=${Latitude},${Longitude}" target="_blank">Get Directions</a>
                    `);
                const marker = new mapboxgl.Marker({ color: 'blue' })
                    .setLngLat([Longitude, Latitude])
                    .setPopup(popup)
                    .addTo(map);
                markers.push(marker);
            } catch (error) {
                console.error("Error adding marker for charger:", error, charger);
            }
        });
    }).catch(error => {
        console.error("Error adding chargers to map:", error);
    });
}