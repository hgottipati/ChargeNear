import { getChargers } from './api.js';
import { getCurrentLocation, currentLocationCoords } from './location.js';
import { CustomPopup } from './customPopup.js';

let mapInstance = null;
let mapReadyPromise = null;
export let markers = [];
export let currentLocationMarker = null;
export let searchedLocationMarker = null;
let currentPopup = null;

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
                
                // Get all filter states
                const filters = {
                    fastOnly: document.getElementById("fastOnly")?.checked || false,
                    level2Only: document.getElementById("level2Only")?.checked || false,
                    teslaSupercharger: document.getElementById("teslaSupercharger")?.checked || false,
                    teslaDestination: document.getElementById("teslaDestination")?.checked || false,
                    chargepointOnly: document.getElementById("chargepointOnly")?.checked || false,
                    electrifyAmerica: document.getElementById("electrifyAmerica")?.checked || false,
                    evgo: document.getElementById("evgo")?.checked || false,
                    blink: document.getElementById("blink")?.checked || false,
                    operationalOnly: document.getElementById("operationalOnly")?.checked || false,
                    highPower: document.getElementById("highPower")?.checked || false,
                    mediumPower: document.getElementById("mediumPower")?.checked || false,
                    lowPower: document.getElementById("lowPower")?.checked || false
                };
                
                try {
                    // Always fetch chargers, but pass the filters
                    const chargers = await getChargers(center.lat, center.lng, filters);
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

// Make getMap available globally
window.getMap = getMap;

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
                let connectorInfo = '<div style="margin-top: 8px;">';
                if (charger.Connections && charger.Connections.length > 0) {
                    charger.Connections.forEach(conn => {
                        const connectorType = conn.ConnectionType ? conn.ConnectionType.Title : 'Unknown';
                        const powerKW = conn.PowerKW ? `${conn.PowerKW} kW` : 'Unknown power';
                        const quantity = conn.Quantity > 1 ? `(${conn.Quantity} available)` : '';
                        const status = conn.StatusType ? conn.StatusType.Title : 'Unknown';
                        const statusColor = status === 'Operational' ? '#4CAF50' : '#f44336';
                        
                        connectorInfo += `
                            <div style="background: #ffffff; border-radius: 6px; padding: 10px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,53,95,0.05);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <span style="font-weight: 500; color: #00355F;">${connectorType}</span>
                                    <span style="color: ${statusColor}; font-size: 12px; font-weight: 500;">${status}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="color: #5d6d7e; font-size: 12px;">${powerKW}</span>
                                    <span style="color: #5d6d7e; font-size: 12px;">${quantity}</span>
                                </div>
                            </div>
                        `;
                    });
                } else {
                    connectorInfo += '<div style="color: #5d6d7e; font-size: 13px;">Connector information not available</div>';
                }
                connectorInfo += '</div>';
                
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
                const statusColor = isOperational ? '#4CAF50' : '#f44336';
                
                // Determine marker color
                let markerColor = '#4CAF50'; // Default green
                if (!isOperational) {
                    markerColor = '#A67C52'; // Brown for not operational
                } else {
                    // Check for high power (Level 3 or Tesla Supercharger)
                    let isHighPower = false;
                    if (charger.Connections && charger.Connections.length > 0) {
                        isHighPower = charger.Connections.some(conn => conn.LevelID === 3 || (conn.PowerKW && conn.PowerKW >= 150));
                    }
                    // Tesla Supercharger check
                    const isTeslaSupercharger =
                        charger.OperatorInfo &&
                        charger.OperatorInfo.Title &&
                        charger.OperatorInfo.Title.toLowerCase().includes('tesla') &&
                        charger.Connections &&
                        charger.Connections.some(conn => conn.ConnectionType && (
                            conn.ConnectionType.Title === 'NACS / Tesla Supercharger' ||
                            conn.ConnectionType.Title === 'Tesla Supercharger' ||
                            conn.ConnectionType.Title === 'Tesla (Model S/X)'
                        ));
                    if (isHighPower || isTeslaSupercharger) {
                        markerColor = '#FFB347'; // Light orange
                    }
                }
                
                // Get last updated time
                const lastUpdated = charger.DateLastStatusUpdate ? new Date(charger.DateLastStatusUpdate).toLocaleString() : 'Unknown';
                
                // Format the address
                const address = [AddressLine1, Town, StateOrProvince, Postcode].filter(Boolean).join(', ');
                
                // Create the popup HTML
                const popupHTML = `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; padding: 16px; background: #f0f4f8; border-radius: 8px; display: flex; flex-direction: column; gap: 16px;">
                        <div style="border-bottom: 1px solid #e0e7f0; padding-bottom: 12px;">
                            <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #00355F;">${Title || 'Charger'}</h3>
                            <p style="margin: 0; font-size: 13px; color: #5d6d7e;">${operatorName}</p>
                        </div>
                        
                        <div>
                            <p style="margin: 0 0 10px 0; font-size: 13px;">
                                <span style="color: #5d6d7e; display: block; margin-bottom: 3px; font-weight: 500;">Address</span>
                                <span style="color: #00355F;">${address}</span>
                            </p>
                            <p style="margin: 0 0 10px 0; font-size: 13px;">
                                <span style="color: #5d6d7e; display: block; margin-bottom: 3px; font-weight: 500;">Status</span>
                                <span style="color: ${statusColor}; font-weight: 600;">${statusTitle}</span>
                            </p>
                            <p style="margin: 0 0 10px 0; font-size: 13px;">
                                <span style="color: #5d6d7e; display: block; margin-bottom: 3px; font-weight: 500;">Cost</span>
                                <span style="color: #00355F;">${usageCost}</span>
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #5d6d7e;">
                                <i class="fas fa-clock" style="margin-right: 4px;"></i>Last updated: ${lastUpdated}
                            </p>
                        </div>

                        <div style="background: #ffffff; border-radius: 6px; padding: 12px; box-shadow: 0 1px 3px rgba(0,53,95,0.05);">
                            <p style="margin: 0 0 8px 0; font-size: 13px; color: #5d6d7e; font-weight: 500;">Connectors</p>
                            ${connectorInfo}
                        </div>

                        <div style="display: flex; gap: 10px;">
                            <a href="https://www.google.com/maps/dir/?api=1&destination=${Latitude},${Longitude}" 
                               target="_blank" 
                               style="flex: 1; display: inline-flex; align-items: center; justify-content: center; background: #EEC218; color: #00355F; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-size: 13px; font-weight: 500; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(238,194,24,0.2);">
                               <i class="fas fa-directions" style="margin-right: 6px;"></i>Get Directions
                            </a>
                            <div style="position: relative; flex: 1;">
                                <button onclick="toggleShareMenu(this)" 
                                        style="width: 100%; display: inline-flex; align-items: center; justify-content: center; background: #00355F; color: #EEC218; border: none; padding: 10px 18px; border-radius: 6px; font-size: 13px; font-weight: 500; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,53,95,0.2); cursor: pointer;">
                                    <i class="fas fa-share-alt" style="margin-right: 6px;"></i>Share
                                </button>
                                <div class="share-menu" style="display: none; position: absolute; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100000; overflow: hidden; min-width: 200px;">
                                    <button onclick="shareCharger('${Title}', ${Latitude}, ${Longitude}, 'copy')" 
                                            style="width: 100%; text-align: left; padding: 12px 16px; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #333; font-size: 14px; transition: background-color 0.2s; border-bottom: 1px solid #eee;">
                                        <i class="fas fa-link" style="width: 20px; color: #00355F;"></i> Copy Link
                                    </button>
                                    <button onclick="shareCharger('${Title}', ${Latitude}, ${Longitude}, 'twitter')" 
                                            style="width: 100%; text-align: left; padding: 12px 16px; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #333; font-size: 14px; transition: background-color 0.2s; border-bottom: 1px solid #eee;">
                                        <i class="fab fa-twitter" style="width: 20px; color: #1DA1F2;"></i> Share on Twitter
                                    </button>
                                    <button onclick="shareCharger('${Title}', ${Latitude}, ${Longitude}, 'facebook')" 
                                            style="width: 100%; text-align: left; padding: 12px 16px; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #333; font-size: 14px; transition: background-color 0.2s; border-bottom: 1px solid #eee;">
                                        <i class="fab fa-facebook" style="width: 20px; color: #4267B2;"></i> Share on Facebook
                                    </button>
                                    <button onclick="shareCharger('${Title}', ${Latitude}, ${Longitude}, 'whatsapp')" 
                                            style="width: 100%; text-align: left; padding: 12px 16px; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #333; font-size: 14px; transition: background-color 0.2s;">
                                        <i class="fab fa-whatsapp" style="width: 20px; color: #25D366;"></i> Share on WhatsApp
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const marker = new mapboxgl.Marker({ color: markerColor })
                    .setLngLat([Longitude, Latitude])
                    .addTo(map);

                // Add click handler for the marker
                marker.getElement().addEventListener('click', () => {
                    try {
                        console.log("Marker clicked, creating popup...");
                        // Close any existing popup
                        if (currentPopup) {
                            currentPopup.close();
                            currentPopup = null;
                        }

                        // Create and show new popup
                        currentPopup = new CustomPopup();
                        currentPopup.setHTML(popupHTML);
                        
                        // Add the share functions to window scope
                        window.toggleShareMenu = (button) => {
                            console.log('Toggle share menu clicked');
                            const menu = button.nextElementSibling;
                            const isVisible = menu.style.display === 'block';
                            
                            // Close all other share menus first
                            document.querySelectorAll('.share-menu').forEach(m => {
                                if (m !== menu) m.style.display = 'none';
                            });
                            
                            if (!isVisible) {
                                console.log('Opening share menu');
                                const rect = button.getBoundingClientRect();
                                console.log('Button rect:', rect);
                                const viewportHeight = window.innerHeight;
                                const viewportWidth = window.innerWidth;
                                
                                // Force the menu to be visible for measurements
                                menu.style.display = 'block';
                                menu.style.visibility = 'hidden';
                                menu.style.zIndex = '100000'; // Ensure highest z-index
                                
                                // Check if we're on mobile
                                const isMobile = window.innerWidth <= 768;
                                console.log('Is mobile:', isMobile);
                                
                                if (isMobile) {
                                    menu.style.position = 'fixed'; // Fixed positioning for mobile
                                    const menuHeight = menu.offsetHeight;
                                    const menuWidth = menu.offsetWidth;
                                    
                                    // Reset any previous positioning
                                    menu.style.top = '';
                                    menu.style.bottom = '';
                                    menu.style.left = '';
                                    menu.style.right = '';
                                    menu.style.marginTop = '';
                                    menu.style.marginBottom = '';
                                    menu.style.marginLeft = '';
                                    menu.style.marginRight = '';
                                    
                                    // Calculate available space above and below
                                    const spaceAbove = rect.top;
                                    const spaceBelow = viewportHeight - (rect.bottom);
                                    
                                    if (spaceBelow >= menuHeight + 10 || spaceBelow > spaceAbove) {
                                        // Position below the button
                                        menu.style.top = `${rect.bottom + 10}px`;
                                        menu.style.left = `${Math.max(10, rect.left)}px`;
                                        menu.style.width = `${Math.min(menuWidth, viewportWidth - 20)}px`;
                                    } else {
                                        // Position above the button
                                        menu.style.bottom = `${viewportHeight - rect.top + 10}px`;
                                        menu.style.left = `${Math.max(10, rect.left)}px`;
                                        menu.style.width = `${Math.min(menuWidth, viewportWidth - 20)}px`;
                                    }
                                    
                                    // Ensure menu doesn't go off screen
                                    const menuRect = menu.getBoundingClientRect();
                                    if (menuRect.right > viewportWidth - 10) {
                                        menu.style.left = `${viewportWidth - menuWidth - 10}px`;
                                    }
                                } else {
                                    // Desktop positioning
                                    menu.style.position = 'absolute'; // Absolute positioning for desktop
                                    menu.style.width = 'auto';
                                    menu.style.top = '0';
                                    menu.style.left = '100%';
                                    menu.style.marginLeft = '8px';
                                    
                                    const menuWidth = menu.offsetWidth;
                                    if (rect.right + menuWidth + 8 > viewportWidth) {
                                        menu.style.left = 'auto';
                                        menu.style.right = '100%';
                                        menu.style.marginLeft = '0';
                                        menu.style.marginRight = '8px';
                                    }
                                }
                                
                                menu.style.visibility = 'visible';
                                console.log('Share menu positioned and shown');
                                
                                // Add touch event handler for mobile
                                if (isMobile) {
                                    const touchHandler = (e) => {
                                        if (!menu.contains(e.target) && e.target !== button) {
                                            menu.style.display = 'none';
                                            document.removeEventListener('touchstart', touchHandler);
                                        }
                                    };
                                    setTimeout(() => document.addEventListener('touchstart', touchHandler), 0);
                                }
                            } else {
                                console.log('Closing share menu');
                                menu.style.display = 'none';
                            }
                            
                            // Close menu when clicking outside
                            if (!isVisible) {
                                const closeMenu = (e) => {
                                    if (!menu.contains(e.target) && e.target !== button) {
                                        menu.style.display = 'none';
                                        document.removeEventListener('click', closeMenu);
                                    }
                                };
                                setTimeout(() => document.addEventListener('click', closeMenu), 0);
                            }
                        };

                        window.shareCharger = (title, lat, lng, method) => {
                            const text = `Check out this EV charger: ${title}`;
                            const currentUrl = new URL(window.location.href);
                            currentUrl.searchParams.set('chargerId', charger.ID);
                            const url = currentUrl.toString();
                            
                            switch (method) {
                                case 'copy':
                                    navigator.clipboard.writeText(url).then(() => {
                                        // Create and show a temporary success message
                                        const successMsg = document.createElement('div');
                                        successMsg.textContent = 'Link copied to clipboard!';
                                        successMsg.style.cssText = `
                                            position: fixed;
                                            bottom: 20px;
                                            left: 50%;
                                            transform: translateX(-50%);
                                            background: #4CAF50;
                                            color: white;
                                            padding: 12px 24px;
                                            border-radius: 8px;
                                            font-size: 14px;
                                            z-index: 10000;
                                            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                                        `;
                                        document.body.appendChild(successMsg);
                                        setTimeout(() => successMsg.remove(), 3000);
                                    }).catch(err => {
                                        console.error('Failed to copy:', err);
                                        alert('Failed to copy link. Please try again.');
                                    });
                                    break;
                                    
                                case 'twitter':
                                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
                                    break;
                                    
                                case 'facebook':
                                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
                                    break;
                                    
                                case 'whatsapp':
                                    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
                                    break;
                                    
                                default:
                                    if (navigator.share) {
                                        navigator.share({
                                            title: 'ChargeNear',
                                            text: text,
                                            url: url
                                        }).catch(console.error);
                                    } else {
                                        // Fallback to copy
                                        navigator.clipboard.writeText(url).then(() => {
                                            const successMsg = document.createElement('div');
                                            successMsg.textContent = 'Link copied to clipboard!';
                                            successMsg.style.cssText = `
                                                position: fixed;
                                                bottom: 20px;
                                                left: 50%;
                                                transform: translateX(-50%);
                                                background: #4CAF50;
                                                color: white;
                                                padding: 12px 24px;
                                                border-radius: 8px;
                                                font-size: 14px;
                                                z-index: 10000;
                                                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                                            `;
                                            document.body.appendChild(successMsg);
                                            setTimeout(() => successMsg.remove(), 3000);
                                        }).catch(console.error);
                                    }
                            }
                            
                            // Close the share menu
                            const menu = document.querySelector('.share-menu');
                            if (menu) menu.style.display = 'none';
                        };
                        
                        currentPopup.open();
                        console.log("Popup opened successfully");
                    } catch (error) {
                        console.error("Error showing popup:", error);
                    }
                });

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

window.showChargerDetails = async (chargerId) => {
    try {
        const map = await window.getMap();
        if (!map) {
            console.error('Map not available');
            return;
        }

        // Import getChargerDetails if needed
        let getChargerDetails;
        try {
            const api = await import('./api.js');
            getChargerDetails = api.getChargerDetails;
        } catch (error) {
            console.error("Error importing getChargerDetails:", error);
            return;
        }

        const charger = await getChargerDetails(chargerId);
        if (!charger) {
            console.error('Charger details not found');
            return;
        }

        // Center map on the charger location
        const position = {
            lat: charger.AddressInfo.Latitude,
            lng: charger.AddressInfo.Longitude
        };
        
        map.setCenter(position);
        map.setZoom(16);

        // Show the charger's marker info window
        const marker = window.markers.find(m => m.chargerId === chargerId);
        if (marker) {
            google.maps.event.trigger(marker, 'click');
        }
    } catch (error) {
        console.error('Error showing charger details:', error);
    }
};