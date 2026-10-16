// api.js
// Charger data (Open Charge Map) and geocoding (Mapbox).

const TESLA_OPERATOR = 'Tesla (Tesla-only charging)';

// Open Charge Map usage types: 2 = Private - Restricted Access, 6 = Private - For Staff, Visitors or Customers
const PRIVATE_USAGE_TYPE_IDS = [2, 6];

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

async function fetchJson(path, params) {
    const response = await fetch(`${path}?${new URLSearchParams(params)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Couldn't load chargers (status ${response.status})`);
    return response.json();
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

    if (filters.publicOnly) {
        result = result.filter(charger => !PRIVATE_USAGE_TYPE_IDS.includes(charger.UsageType?.ID));
    }

    const hasOtherFilters = Object.entries(filters).some(([key, value]) =>
        !['operationalOnly', 'publicOnly'].includes(key) && value === true
    );
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
    const chargers = await fetchJson('/api/chargers', { lat, lon });
    return applyFilters(chargers, filters);
}

export async function getChargerById(id) {
    const chargers = await fetchJson('/api/charger', { id });
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
