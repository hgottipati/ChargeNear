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

            // Add map controls
            this.map.addControl(new mapboxgl.NavigationControl());
            this.map.addControl(new StyleToggleControl(), 'top-right');
            this.map.addControl(new GeolocationControl(), 'top-right');

            // When the map style changes, we need to reload the markers
            this.map.on('custom-style-changed', async () => {
                try {
                    // Re-add markers after style change
                    markers.forEach(marker => marker.addTo(this.map));
                    
                    // Re-add current location marker if it exists
                    if (currentLocationCoords.lat && currentLocationCoords.lon) {
                        addCurrentLocationMarker(currentLocationCoords.lat, currentLocationCoords.lon);
                    }
                    
                    // Re-add searched location marker if it exists
                    if (searchedLocationMarker) {
                        searchedLocationMarker.addTo(this.map);
                    }
                } catch (error) {
                    console.error("Error reloading markers after style change:", error);
                }
            });

            this.map.on('moveend', async () => {
                const map = await this.getMap();
                const center = map.getCenter();
                
                // Safely get checkbox states
                const fastOnly = document.getElementById("fastOnly")?.checked || false;
                const teslaSupercharger = document.getElementById("teslaSupercharger")?.checked || false;
                const teslaDestination = document.getElementById("teslaDestination")?.checked || false;
                const chargepointOnly = document.getElementById("chargepointOnly")?.checked || false;
                
                try {
                    const chargers = await getChargers(center.lat, center.lng, fastOnly, teslaSupercharger, teslaDestination, chargepointOnly);
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
                
                // Safely get checkbox states
                const fastOnly = document.getElementById("fastOnly")?.checked || false;
                const teslaSupercharger = document.getElementById("teslaSupercharger")?.checked || false;
                const teslaDestination = document.getElementById("teslaDestination")?.checked || false;
                const chargepointOnly = document.getElementById("chargepointOnly")?.checked || false;
                
                console.log(`GeolocationControl: Fetching chargers for [${lat}, ${lon}], fastOnly: ${fastOnly}, teslaSupercharger: ${teslaSupercharger}, teslaDestination: ${teslaDestination}, chargepointOnly: ${chargepointOnly}`);
                const chargers = await getChargers(lat, lon, fastOnly, teslaSupercharger, teslaDestination, chargepointOnly);
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
    // Log a sample charger to see the data structure
    if (chargers.length > 0) {
        console.log("Sample charger data:", chargers[0]);
    }
    
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
                
                const { Latitude, Longitude, Title, AddressLine1, Town, StateOrProvince, Postcode } = charger.AddressInfo;
                
                // Format the connector information
                let connectorInfo = '<p><strong>Connectors:</strong></p><ul style="margin-top: 5px; padding-left: 20px;">';
                if (charger.Connections && charger.Connections.length > 0) {
                    charger.Connections.forEach(conn => {
                        const connectorType = conn.ConnectionType ? conn.ConnectionType.Title : 'Unknown';
                        const powerKW = conn.PowerKW ? `${conn.PowerKW} kW` : 'Unknown power';
                        const quantity = conn.Quantity > 1 ? `(${conn.Quantity} available)` : '';
                        connectorInfo += `<li>${connectorType} - ${powerKW} ${quantity}</li>`;
                    });
                } else {
                    connectorInfo += '<li>Connector information not available</li>';
                }
                connectorInfo += '</ul>';
                
                // Get operator information
                const operatorName = charger.OperatorInfo ? charger.OperatorInfo.Title : 'Unknown operator';
                
                // Get usage cost if available
                let usageCost = 'Cost information not available';
                if (charger.UsageCost) {
                    usageCost = charger.UsageCost;
                }
                
                // Get status information
                const statusTitle = charger.StatusType ? charger.StatusType.Title : 'Unknown status';
                const isOperational = statusTitle === 'Operational';
                const statusColor = isOperational ? 'green' : 'red';
                
                // Format the address
                const address = [AddressLine1, Town, StateOrProvince, Postcode].filter(Boolean).join(', ');
                
                // Create the popup HTML
                const popup = new mapboxgl.Popup({maxWidth: '300px'})
                    .setHTML(`
                        <div style="font-family: Arial, sans-serif;">
                            <h3 style="margin-bottom: 5px;">${Title || 'Charger'}</h3>
                            <p style="margin-top: 0; color: gray;">${operatorName}</p>
                            <p><strong>Address:</strong> ${address}</p>
                            <p><strong>Status:</strong> <span style="color: ${statusColor};">${statusTitle}</span></p>
                            <p><strong>Cost:</strong> ${usageCost}</p>
                            ${connectorInfo}
                            <div style="margin-top: 10px;">
                                <a href="https://www.google.com/maps/dir/?api=1&destination=${Latitude},${Longitude}" 
                                   target="_blank" style="color: #4285F4; text-decoration: none;">
                                   Get Directions
                                </a>
                            </div>
                        </div>
                    `);
                    
                // Set marker color based on status
                const markerColor = isOperational ? 'green' : 'orange';
                
                const marker = new mapboxgl.Marker({ color: markerColor })
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

// Create a custom style toggle control
class StyleToggleControl {
    constructor() {
        this.satellite = false;
    }

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        
        // Create the toggle button with a better satellite icon
        this._container.innerHTML = `
            <button id="style-toggle" class="mapboxgl-ctrl-icon" title="Switch to Satellite View" style="background: white; border: none; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#4285F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
            </button>
        `;
        
        const button = this._container.querySelector('#style-toggle');
        
        button.onclick = () => {
            this.satellite = !this.satellite;
            
            // Change the map style based on the toggle state
            if (this.satellite) {
                // Switch to satellite view
                map.setStyle('mapbox://styles/mapbox/satellite-streets-v12');
                button.title = 'Switch to Street View';
                button.innerHTML = `
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#4285F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                        <line x1="15" y1="3" x2="15" y2="21"></line>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="3" y1="15" x2="21" y2="15"></line>
                    </svg>
                `;
            } else {
                // Switch to street view
                map.setStyle('mapbox://styles/mapbox/streets-v12');
                button.title = 'Switch to Satellite View';
                button.innerHTML = `
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#4285F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                `;
            }
            
            // Dispatch a style change event that we can listen to
            map.once('style.load', () => {
                console.log("Map style changed and reloaded");
                map.fire('custom-style-changed');
            });
        };
        
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}