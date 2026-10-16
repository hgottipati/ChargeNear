// api.js
// Charger data (Open Charge Map) and geocoding (Mapbox).

const OCM_API_KEY = 'b61c6aab-6cef-43a9-af78-215cb02d1464';
const OCM_BASE = 'https://api.openchargemap.io/v3/poi/';
const SEARCH_RADIUS_MILES = 100;
const CORS_PROXY = 'https://corsproxy.io/?';

const TESLA_OPERATOR = 'Tesla (Tesla-only charging)';

const NETWORK_FILTERS = {
    chargepointOnly: 'chargepoint',
    electrifyAmerica: 'electrify america',
    evgo: 'evgo',
    blink: 'blink',
    volta: 'volta',
    shellRecharge: 'shell',
    evConnect: 'ev connect',
    semaConnect: 'semaconnect'
};

async function fetchOcm(params) {
    const query = new URLSearchParams({ output: 'json', key: OCM_API_KEY, ...params });
    const url = `${OCM_BASE}?${query}`;
    try {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Open Charge Map responded with ${response.status}`);
        return await response.json();
    } catch (directError) {
        console.warn('Direct Open Charge Map call failed, retrying through proxy:', directError.message);
        const response = await fetch(CORS_PROXY + encodeURIComponent(url), { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Couldn't load chargers (status ${response.status})`);
        return await response.json();
    }
}

function hasConnection(charger, predicate) {
    return Array.isArray(charger.Connections) && charger.Connections.some(predicate);
}

function operatorTitle(charger) {
    return (charger.OperatorInfo?.Title || '').toLowerCase();
}

function isTeslaSupercharger(charger) {
    return charger.OperatorInfo?.Title === TESLA_OPERATOR && hasConnection(charger, conn =>
        ['NACS / Tesla Supercharger', 'Tesla Supercharger', 'Tesla (Model S/X)'].includes(conn.ConnectionType?.Title) ||
        (conn.LevelID === 3 && conn.PowerKW >= 72)
    );
}

function isTeslaDestination(charger) {
    return charger.OperatorInfo?.Title === TESLA_OPERATOR && hasConnection(charger, conn =>
        ['Tesla Destination', 'Tesla (Model S/X)'].includes(conn.ConnectionType?.Title) ||
        (conn.LevelID === 2 && conn.PowerKW && conn.PowerKW < 72)
    );
}

export function applyFilters(chargers, filters = {}) {
    let result = chargers;

    if (filters.operationalOnly) {
        result = result.filter(charger => charger.StatusType?.Title === 'Operational');
    }

    const hasOtherFilters = Object.entries(filters).some(([key, value]) => key !== 'operationalOnly' && value === true);
    if (!hasOtherFilters) return result;

    return result.filter(charger =>
        (filters.fastOnly && hasConnection(charger, conn => conn.LevelID === 3)) ||
        (filters.level2Only && hasConnection(charger, conn => conn.LevelID === 2)) ||
        (filters.teslaSupercharger && isTeslaSupercharger(charger)) ||
        (filters.teslaDestination && isTeslaDestination(charger)) ||
        Object.entries(NETWORK_FILTERS).some(([key, needle]) => filters[key] && operatorTitle(charger).includes(needle)) ||
        (filters.highPower && hasConnection(charger, conn => conn.PowerKW >= 150)) ||
        (filters.mediumPower && hasConnection(charger, conn => conn.PowerKW >= 50 && conn.PowerKW < 150)) ||
        (filters.lowPower && hasConnection(charger, conn => conn.PowerKW && conn.PowerKW < 50))
    );
}

export async function getChargers(lat, lon, filters = {}) {
    const chargers = await fetchOcm({
        latitude: lat,
        longitude: lon,
        distance: SEARCH_RADIUS_MILES,
        distanceunit: 'Miles',
        maxresults: 100
    });
    return applyFilters(chargers, filters);
}

export async function getChargerById(id) {
    const chargers = await fetchOcm({ chargepointid: id });
    return chargers[0] || null;
}

export async function geocode(query) {
    const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${window.MAPBOX_TOKEN}&limit=1`
    );
    if (!response.ok) throw new Error("Couldn't search for that location. Please try again.");
    const data = await response.json();
    const feature = data.features?.[0];
    if (!feature) throw new Error(`No results for "${query}". Try a city, address, or zip code.`);
    const [lon, lat] = feature.center;
    return { lat, lon, label: feature.place_name };
}

export async function getAddressSuggestions(query) {
    const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${window.MAPBOX_TOKEN}&autocomplete=true&limit=5`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return (data.features || []).map(feature => feature.place_name);
}
