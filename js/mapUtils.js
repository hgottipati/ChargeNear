import { locateUser } from './location.js';
import { CustomPopup } from './customPopup.js';
import { getSelectedRadius } from './filters.js';
import { showToast } from './toast.js';
import { setupReports } from './reports.js';
import { escapeHtml, milesBetween, tidyName } from './format.js';

let markers = new Map();
export let currentLocationMarker = null;
export let searchedLocationMarker = null;
let propertyMarker = null;
let currentPopup = null;
let walkingTimeMarkers = [];
let circleCenter = null;

// The host's property from an embed or shared link. It stays put while guests search elsewhere.
export const property = { lat: null, lon: null, label: '' };

export function walkCircleCenter(lat, lon) {
    return property.lat === null ? [lon, lat] : [property.lon, property.lat];
}

const MARKER_COLORS = {
    operational: '#16a34a',
    highPower: '#f59e0b',
    offline: '#94a3b8'
};

class MapManager {
    constructor() {
        this.map = null;
        this.readyPromise = new Promise((resolve, reject) => {
            this.resolveReady = resolve;
            this.rejectReady = reject;
        });
    }

    initMap(lat, lon, zoom = 13) {
        if (this.map) {
            this.map.jumpTo({ center: [lon, lat], zoom });
            return this.readyPromise;
        }

        mapboxgl.accessToken = window.MAPBOX_TOKEN;

        this.map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [lon, lat],
            zoom,
            customAttribution: 'Charger data: <a href="https://afdc.energy.gov/stations" target="_blank" rel="noopener">U.S. DOE</a>, © <a href="https://openchargemap.org" target="_blank" rel="noopener">Open Charge Map</a>'
        });

        this.map.on('load', () => {
            window.isMapReady = true;
            this.resolveReady(this.map);
        });

        this.map.on('error', event => {
            console.error('Mapbox error:', event.error || event);
        });

        this.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
        this.map.addControl(new GeolocationControl(), 'top-right');
        this.map.addControl(new StyleToggleControl(), 'top-right');
        this.map.addControl(new FilterControl(), 'top-right');

        this.map.on('custom-style-changed', () => {
            const radius = getSelectedRadius();
            if (radius !== 'none' && circleCenter) {
                updateNearbyCircle(circleCenter, radius, { fit: false });
            }
        });

        return this.readyPromise;
    }

    getMap() {
        return this.map ? Promise.resolve(this.map) : this.readyPromise;
    }
}

const mapManager = new MapManager();

export async function getMap() {
    return mapManager.getMap();
}

window.getMap = getMap;

export function initMap(lat, lon, zoom) {
    return mapManager.initMap(lat, lon, zoom);
}

function controlButton(title, svg) {
    const container = document.createElement('div');
    container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-ctrl-button';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML = svg;
    container.appendChild(button);
    return { container, button };
}

const ICON_ATTRS = 'viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
    locate: `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/></svg>`,
    satellite: `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    streets: `<svg ${ICON_ATTRS}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`,
    filter: `<svg ${ICON_ATTRS}><path d="M4 4h16l-6.5 8.5v5a1.5 1.5 0 0 1-3 0v-5L4 4z"/></svg>`
};

class GeolocationControl {
    onAdd() {
        const { container, button } = controlButton('Show my location', ICONS.locate);
        button.addEventListener('click', () => locateUser());
        this._container = container;
        return container;
    }

    onRemove() {
        this._container.remove();
    }
}

class FilterControl {
    onAdd() {
        const { container, button } = controlButton('Filter chargers', ICONS.filter);
        button.id = 'filter-button';
        const badge = document.createElement('span');
        badge.className = 'filter-count';
        badge.id = 'filter-count';
        badge.hidden = true;
        button.appendChild(badge);
        button.addEventListener('click', () => document.dispatchEvent(new CustomEvent('chargenear:open-filters')));
        this._container = container;
        setTimeout(() => document.dispatchEvent(new CustomEvent('chargenear:filters-changed')));
        return container;
    }

    onRemove() {
        this._container.remove();
    }
}

class StyleToggleControl {
    onAdd(map) {
        const { container, button } = controlButton('Switch to satellite view', ICONS.satellite);
        let satellite = false;
        button.addEventListener('click', () => {
            satellite = !satellite;
            map.setStyle(satellite ? 'mapbox://styles/mapbox/satellite-streets-v12' : 'mapbox://styles/mapbox/streets-v12');
            const title = satellite ? 'Switch to street view' : 'Switch to satellite view';
            button.title = title;
            button.setAttribute('aria-label', title);
            button.innerHTML = satellite ? ICONS.streets : ICONS.satellite;
            map.once('style.load', () => map.fire('custom-style-changed'));
        });
        this._container = container;
        return container;
    }

    onRemove() {
        this._container.remove();
    }
}

export function addCurrentLocationMarker(lat, lon) {
    if (currentLocationMarker) currentLocationMarker.remove();

    const el = document.createElement('div');
    el.className = 'current-location-dot';
    el.title = 'Your location';

    getMap().then(map => {
        currentLocationMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([lon, lat])
            .addTo(map);
    });
}

export function addSearchedLocationMarker(lat, lon, label) {
    if (searchedLocationMarker) searchedLocationMarker.remove();

    getMap().then(map => {
        searchedLocationMarker = new mapboxgl.Marker({ color: '#00355F' })
            .setLngLat([lon, lat])
            .setPopup(new mapboxgl.Popup({ offset: 30 }).setHTML(`<strong>${escapeHtml(label)}</strong>`))
            .addTo(map);
        searchedLocationMarker.getElement().setAttribute('aria-label', `Searched location: ${label}`);
    });
}

export function addPropertyMarker(lat, lon, label) {
    Object.assign(property, { lat, lon, label });
    if (propertyMarker) propertyMarker.remove();

    const el = document.createElement('div');
    el.className = 'property-marker';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `Property: ${label}`);
    el.innerHTML = `
        <span class="property-label">${escapeHtml(label)}</span>
        <span class="property-pin"><i class="fa-solid fa-house" aria-hidden="true"></i></span>`;

    getMap().then(map => {
        propertyMarker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([lon, lat])
            .addTo(map);
    });
}

function propertyDistanceHtml(lat, lon) {
    if (property.lat === null) return '';
    const miles = milesBetween(property, { lat, lon });
    const distance = miles < 0.1 ? 'Under 0.1 mi' : `${miles.toFixed(1)} mi`;
    const walk = miles <= 2 ? ` · about ${Math.max(1, Math.round(miles * 20))} min walk` : '';
    return `<p class="property-distance"><i class="fa-solid fa-person-walking" aria-hidden="true"></i>
        ${escapeHtml(distance)} from ${escapeHtml(property.label)}${walk}</p>`;
}

const RADIUS_OPTIONS = {
    '5min': { miles: 0.25, label: '5 min walk' },
    '15min': { miles: 0.75, label: '15 min walk' },
    '1mile': { miles: 1.0, label: '20 min walk' }
};

function circleOffset(center, radiusInMiles, angle) {
    const latDegrees = radiusInMiles / 69;
    const lngDegrees = radiusInMiles / (69 * Math.cos(center[1] * Math.PI / 180));
    return [center[0] + lngDegrees * Math.sin(angle), center[1] + latDegrees * Math.cos(angle)];
}

function createCircle(center, radiusInMiles) {
    const points = [];
    for (let i = 0; i <= 64; i++) {
        points.push(circleOffset(center, radiusInMiles, (i / 64) * 2 * Math.PI));
    }
    return points;
}

export async function updateNearbyCircle(center, radiusType, { fit = true } = {}) {
    if (!center || !center[0] || !center[1]) return;

    await removeNearbyCircle();
    circleCenter = center;

    const option = RADIUS_OPTIONS[radiusType];
    if (!option) return;

    const map = await getMap();
    const coordinates = createCircle(center, option.miles);

    map.addSource('nearby-circle', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coordinates] }, properties: {} }
    });

    const beforeLayer = map.getLayer('waterway-label') ? 'waterway-label' : undefined;
    map.addLayer({
        id: 'nearby-circle-fill',
        type: 'fill',
        source: 'nearby-circle',
        paint: { 'fill-color': '#EEC218', 'fill-opacity': 0.25 }
    }, beforeLayer);
    map.addLayer({
        id: 'nearby-circle-border',
        type: 'line',
        source: 'nearby-circle',
        paint: { 'line-color': '#00355F', 'line-width': 2, 'line-dasharray': [2, 1.5] }
    }, beforeLayer);

    const label = document.createElement('div');
    label.className = 'walking-time-marker';
    label.textContent = option.label;
    walkingTimeMarkers.push(
        new mapboxgl.Marker({ element: label, anchor: 'center' })
            .setLngLat(circleOffset(center, option.miles, Math.PI / 4))
            .addTo(map)
    );

    if (!fit) return;
    const lngs = coordinates.map(p => p[0]);
    const lats = coordinates.map(p => p[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, duration: 800 });
}

export async function removeNearbyCircle() {
    const map = await getMap();
    walkingTimeMarkers.forEach(marker => marker.remove());
    walkingTimeMarkers = [];
    if (map.getLayer('nearby-circle-fill')) map.removeLayer('nearby-circle-fill');
    if (map.getLayer('nearby-circle-border')) map.removeLayer('nearby-circle-border');
    if (map.getSource('nearby-circle')) map.removeSource('nearby-circle');
}

function isHighPower(charger) {
    return (charger.Connections || []).some(conn => conn.LevelID === 3 || conn.PowerKW >= 150);
}

function markerColor(charger) {
    if (charger.StatusType?.Title !== 'Operational') return MARKER_COLORS.offline;
    return isHighPower(charger) ? MARKER_COLORS.highPower : MARKER_COLORS.operational;
}

function statusPill(statusTitle) {
    if (!statusTitle) return '<span class="status-pill is-unknown">Status unknown</span>';
    const cls = statusTitle === 'Operational' ? 'is-up' : 'is-down';
    return `<span class="status-pill ${cls}">${escapeHtml(statusTitle)}</span>`;
}

const STALE_AFTER_DAYS = 365;

function lastVerifiedDate(charger) {
    const value = charger.DateLastVerified || charger.DateLastStatusUpdate;
    if (!value) return null;
    // Date-only values (DOE) are calendar days, not UTC midnight.
    return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
}

export function isStale(charger) {
    const verified = lastVerifiedDate(charger);
    return !verified || (Date.now() - verified.getTime()) / 86400000 > STALE_AFTER_DAYS;
}

function formatDate(date) {
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Open Charge Map hours look like "MON: 24 hours | TUE: ..."; DOE hours like "Mon: 6:00am-10:00pm; Tue: ..." or "24 hours daily".
function formatAccessNotes(text) {
    if (!text) return null;
    if (/^24 hours daily\.?$/i.test(text.trim())) return 'Open 24/7';
    const parts = text.split(/[|;]/).map(part => part.trim()).filter(Boolean);
    const dayPattern = /^(MON|TUE|WED|THU|FRI|SAT|SUN):\s*(.+)$/i;
    const days = parts.map(part => part.match(dayPattern));
    if (days.length === 7 && days.every(Boolean)) {
        const hours = new Set(days.map(match => match[2].toLowerCase()));
        if (hours.size === 1) {
            const value = days[0][2];
            return /^24 hours$/i.test(value) ? 'Open 24/7' : `Daily: ${value}`;
        }
    }
    return parts.join('\n');
}

function freshnessNote(charger) {
    const verified = lastVerifiedDate(charger);
    if (!verified) {
        return '<p class="freshness is-stale"><i class="fa-solid fa-triangle-exclamation"></i> Never verified — this listing may be outdated.</p>';
    }
    if (isStale(charger)) {
        return `<p class="freshness is-stale"><i class="fa-solid fa-triangle-exclamation"></i> Not verified since ${escapeHtml(formatDate(verified))} — this listing may be outdated.</p>`;
    }
    return `<p class="freshness"><i class="fa-solid fa-circle-check"></i> Verified ${escapeHtml(formatDate(verified))}</p>`;
}

const SOURCES = {
    nrel: {
        name: 'U.S. Department of Energy',
        reportUrl: charger => `https://afdc.energy.gov/stations#/station/${encodeURIComponent(charger.SourceID)}`,
        reportLabel: 'Report it to the DOE station locator'
    },
    ocm: {
        name: 'Open Charge Map community',
        reportUrl: charger => `https://map.openchargemap.io/?id=${encodeURIComponent(charger.ID)}`,
        reportLabel: 'Report it on Open Charge Map'
    }
};

function chargerCardHtml(charger) {
    const { Latitude, Longitude, Title, AddressLine1, Town, StateOrProvince, Postcode, AccessComments } = charger.AddressInfo;
    const address = [AddressLine1, Town, StateOrProvince, Postcode].filter(Boolean).join(', ');
    const operator = charger.OperatorInfo?.Title || 'Unknown network';
    const cost = charger.UsageCost || 'Not listed';
    const access = charger.UsageType?.Title || 'Not listed';
    const hours = formatAccessNotes(AccessComments);
    const notes = charger.GeneralComments;
    const source = SOURCES[charger.Source] || SOURCES.ocm;

    const connectors = (charger.Connections || []).map(conn => {
        const meta = [
            conn.PowerKW ? `${conn.PowerKW} kW` : null,
            conn.Quantity > 1 ? `×${conn.Quantity}` : null
        ].filter(Boolean).join(' · ');
        return `
            <div class="connector">
                <span class="connector-name">${escapeHtml(conn.ConnectionType?.Title || 'Unknown connector')}</span>
                <span class="connector-meta">${escapeHtml(meta || '—')}</span>
            </div>`;
    }).join('') || '<p class="charger-updated">Connector details not available.</p>';

    return `
        <div class="charger-card">
            <div class="charger-card-header">
                <h3>${escapeHtml(tidyName(Title) || 'EV charger')}</h3>
                <p class="charger-operator">${escapeHtml(operator)}</p>
                ${statusPill(charger.StatusType?.Title)}
            </div>
            ${propertyDistanceHtml(Latitude, Longitude)}
            ${freshnessNote(charger)}
            <div data-report-summary aria-live="polite"></div>
            <dl class="charger-field">
                <dt>Address</dt>
                <dd>${escapeHtml(address || 'Not listed')}</dd>
                <dt>Access</dt>
                <dd>${escapeHtml(access)}</dd>
                ${hours ? `<dt>Hours</dt><dd class="preserve-lines">${escapeHtml(hours)}</dd>` : ''}
                <dt>Cost</dt>
                <dd>${escapeHtml(cost)}</dd>
                ${notes ? `<dt>${charger.Source === 'nrel' ? 'Where to find it' : 'Notes'}</dt><dd class="preserve-lines">${escapeHtml(notes)}</dd>` : ''}
                <dt>Source</dt>
                <dd>${escapeHtml(source.name)}</dd>
            </dl>
            <div class="charger-connectors">
                <h4>Connectors</h4>
                ${connectors}
            </div>
            <div class="charger-actions">
                <a class="btn btn-primary" href="https://www.google.com/maps/dir/?api=1&destination=${Latitude},${Longitude}" target="_blank" rel="noopener">
                    <i class="fa-solid fa-diamond-turn-right"></i> Directions
                </a>
                <button type="button" class="btn btn-secondary" data-share-charger="${escapeHtml(charger.ID)}">
                    <i class="fa-solid fa-share-nodes"></i> Share
                </button>
            </div>
            <div class="report-box" data-report-box aria-live="polite"></div>
            <a class="report-link" href="${escapeHtml(source.reportUrl(charger))}" target="_blank" rel="noopener">
                <i class="fa-regular fa-flag"></i> Not here or wrong info? ${escapeHtml(source.reportLabel)}
            </a>
        </div>`;
}

async function shareCharger(charger) {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('chargerId', charger.ID);
    const title = tidyName(charger.AddressInfo?.Title) || 'EV charger';

    if (navigator.share) {
        try {
            await navigator.share({ title: `${title} · ChargeNear`, url: url.toString() });
        } catch (error) {
            if (error.name !== 'AbortError') console.error('Share failed:', error);
        }
        return;
    }

    try {
        await navigator.clipboard.writeText(url.toString());
        showToast('Link copied to clipboard', 'success');
    } catch {
        showToast("Couldn't copy the link. Please try again.", 'error');
    }
}

export function openChargerDetails(charger) {
    currentPopup ||= new CustomPopup();
    currentPopup.setHTML(chargerCardHtml(charger));
    currentPopup.container.querySelector('[data-share-charger]')
        ?.addEventListener('click', () => shareCharger(charger));
    setupReports(currentPopup.container, String(charger.ID));
    currentPopup.open();
}

const CLUSTER_SOURCE = 'chargers';
let chargerFeatures = { type: 'FeatureCollection', features: [] };
let chargersById = new Map();
let clusterSyncBound = false;

function ensureClusterSource(map) {
    if (map.getSource(CLUSTER_SOURCE)) return;
    map.addSource(CLUSTER_SOURCE, {
        type: 'geojson',
        data: chargerFeatures,
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: 14
    });
    // querySourceFeatures only sees sources that a layer uses, so keep an invisible one.
    map.addLayer({
        id: 'chargers-index',
        type: 'circle',
        source: CLUSTER_SOURCE,
        paint: { 'circle-radius': 0, 'circle-opacity': 0 }
    });
}

function chargerMarker(map, charger, lngLat) {
    const marker = new mapboxgl.Marker({ color: markerColor(charger) }).setLngLat(lngLat).addTo(map);
    const el = marker.getElement();
    el.style.cursor = 'pointer';
    el.classList.toggle('is-stale', isStale(charger));
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-label', tidyName(charger.AddressInfo.Title) || 'EV charger');
    el.addEventListener('click', event => {
        event.stopPropagation();
        openChargerDetails(charger);
    });
    el.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openChargerDetails(charger);
        }
    });
    return marker;
}

function clusterMarker(map, clusterId, count, lngLat) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'cluster-marker';
    el.classList.toggle('is-large', count >= 25);
    el.textContent = count;
    el.setAttribute('aria-label', `${count} chargers here. Zoom in`);
    el.addEventListener('click', event => {
        event.stopPropagation();
        map.getSource(CLUSTER_SOURCE).getClusterExpansionZoom(clusterId, (error, zoom) => {
            if (!error) map.easeTo({ center: lngLat, zoom });
        });
    });
    return new mapboxgl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
}

function syncMarkers(map) {
    if (!map.getSource(CLUSTER_SOURCE) || !map.isSourceLoaded(CLUSTER_SOURCE)) return;

    const visible = new Map();
    for (const feature of map.querySourceFeatures(CLUSTER_SOURCE)) {
        const props = feature.properties;
        if (!props.cluster && !chargersById.has(props.id)) continue;
        const key = props.cluster ? `cluster-${props.cluster_id}-${props.point_count}` : `charger-${props.id}`;
        if (visible.has(key)) continue;

        let marker = markers.get(key);
        if (!marker) {
            const lngLat = feature.geometry.coordinates;
            marker = props.cluster
                ? clusterMarker(map, props.cluster_id, props.point_count, lngLat)
                : chargerMarker(map, chargersById.get(props.id), lngLat);
        }
        visible.set(key, marker);
    }

    markers.forEach((marker, key) => {
        if (!visible.has(key)) marker.remove();
    });
    markers = visible;
}

export function addChargersToMap(chargers, center) {
    if (!center || !center[0] || !center[1]) return;

    chargersById = new Map();
    chargerFeatures = {
        type: 'FeatureCollection',
        features: chargers
            .filter(charger => charger.AddressInfo?.Latitude && charger.AddressInfo?.Longitude)
            .map(charger => {
                chargersById.set(charger.ID, charger);
                return {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [charger.AddressInfo.Longitude, charger.AddressInfo.Latitude] },
                    properties: { id: charger.ID }
                };
            })
    };

    getMap().then(map => {
        markers.forEach(marker => marker.remove());
        markers = new Map();

        ensureClusterSource(map);
        map.getSource(CLUSTER_SOURCE).setData(chargerFeatures);

        if (!clusterSyncBound) {
            clusterSyncBound = true;
            map.on('render', () => syncMarkers(map));
            map.on('sourcedata', event => {
                if (event.sourceId === CLUSTER_SOURCE && event.isSourceLoaded) syncMarkers(map);
            });
            map.on('style.load', () => ensureClusterSource(map));
        }
    });
}
