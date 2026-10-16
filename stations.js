// Converts U.S. DOE (NREL/NLR) Alternative Fuel Station records into the Open Charge Map shape
// the front end already understands, and merges both sources.

const OCM_AFDC_PROVIDER_ID = 2;
const DUPLICATE_METERS = 40;

const CONNECTOR_TITLES = {
    J1772: 'J1772 (Type 1)',
    J1772COMBO: 'CCS (Type 1)',
    CHADEMO: 'CHAdeMO',
    J3271: 'MCS (J3271)',
    NEMA1450: 'NEMA 14-50',
    NEMA515: 'NEMA 5-15',
    NEMA520: 'NEMA 5-20'
};

const NETWORK_NAMES = {
    'ChargePoint Network': 'ChargePoint',
    'Blink Network': 'Blink',
    'eVgo Network': 'EVgo',
    'Tesla': 'Tesla Supercharger',
    'Non-Networked': 'Non-networked',
    BP_PULSE: 'bp pulse',
    SHELL_RECHARGE: 'Shell Recharge',
    RIVIAN_ADVENTURE: 'Rivian Adventure Network',
    RIVIAN_WAYPOINTS: 'Rivian Waypoints',
    CHARGELAB: 'ChargeLab',
    EVMATCH: 'EVmatch',
    AMPUP: 'AmpUp',
    FLO: 'FLO',
    CIRCLE_K: 'Circle K',
    ELECTRIC_ERA: 'Electric Era',
    MERCEDES_BENZ: 'Mercedes-Benz High-Power Charging',
    IONNA: 'IONNA',
    WAWA: 'Wawa',
    EVGATEWAY: 'EV Gateway',
    POWERFLEX: 'PowerFlex',
    SWTCH: 'SWTCH'
};

const STATUS_TITLES = { E: 'Operational', T: 'Temporarily Unavailable', P: 'Planned' };
const LEVEL_IDS = { dc_fast: 3, 2: 2, 1: 1, level2: 2, level1: 1 };

function networkName(code) {
    if (!code) return 'Unknown network';
    if (NETWORK_NAMES[code]) return NETWORK_NAMES[code];
    if (/^[A-Z0-9_]+$/.test(code)) {
        return code.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
    }
    return code;
}

function connectorTitle(type, levelId) {
    if (type === 'TESLA') return levelId === 3 ? 'NACS / Tesla Supercharger' : 'Tesla Destination';
    return CONNECTOR_TITLES[type] || type;
}

function connections(station) {
    const grouped = new Map();
    for (const unit of station.ev_charging_units || []) {
        const levelId = LEVEL_IDS[unit.charging_level] || null;
        for (const [type, connector] of Object.entries(unit.connectors || {})) {
            if (!connector.port_count) continue;
            const key = `${type}:${levelId}`;
            const entry = grouped.get(key) || { type, levelId, power: null, quantity: 0 };
            entry.quantity += connector.port_count;
            entry.power = Math.max(entry.power || 0, connector.power_kw || 0) || null;
            grouped.set(key, entry);
        }
    }

    if (grouped.size === 0) {
        const fast = station.ev_dc_fast_num || 0;
        for (const type of station.ev_connector_types || []) {
            const isDc = ['J1772COMBO', 'CHADEMO', 'J3271'].includes(type) || (type === 'TESLA' && fast > 0);
            grouped.set(type, {
                type,
                levelId: isDc ? 3 : 2,
                power: null,
                quantity: isDc ? fast : station.ev_level2_evse_num || 0
            });
        }
    }

    return [...grouped.values()].map(entry => ({
        ConnectionType: { Title: connectorTitle(entry.type, entry.levelId) },
        LevelID: entry.levelId,
        PowerKW: entry.power,
        Quantity: entry.quantity
    }));
}

function usageType(station) {
    const groups = station.groups_with_access_code || '';
    if (station.access_code === 'private') {
        const detail = /use only|only$/i.test(station.access_days_time || '') ? ` (${station.access_days_time.toLowerCase()})` : '';
        return { ID: 2, Title: `Private${detail}` };
    }
    return { ID: 1, Title: groups && groups !== 'Public' ? groups : 'Public' };
}

export function nrelToCharger(station) {
    return {
        ID: `n${station.id}`,
        Source: 'nrel',
        SourceID: station.id,
        AddressInfo: {
            Title: station.station_name,
            AddressLine1: station.street_address,
            Town: station.city,
            StateOrProvince: station.state,
            Postcode: station.zip,
            Latitude: station.latitude,
            Longitude: station.longitude,
            AccessComments: station.access_days_time
        },
        OperatorInfo: { Title: networkName(station.ev_network) },
        StatusType: { Title: STATUS_TITLES[station.status_code] || 'Unknown' },
        UsageType: usageType(station),
        UsageCost: station.ev_pricing,
        GeneralComments: station.intersection_directions,
        DateLastVerified: station.date_last_confirmed,
        Connections: connections(station)
    };
}

function metersBetween(a, b) {
    const toRad = degrees => degrees * Math.PI / 180;
    const dLat = toRad(b.Latitude - a.Latitude);
    const dLon = toRad(b.Longitude - a.Longitude);
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.Latitude)) * Math.cos(toRad(b.Latitude)) * Math.sin(dLon / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(h));
}

// Keeps every DOE station, plus community-added OCM listings that DOE doesn't have,
// limited to the area the DOE results cover so stale far-away pins don't dominate.
export function mergeStations(nrelStations, ocmChargers, center) {
    const doe = nrelStations.map(nrelToCharger);
    if (doe.length === 0) return ocmChargers;

    const doeIds = new Set(nrelStations.map(station => String(station.id)));
    const coverage = Math.max(...doe.map(charger => metersBetween(center, charger.AddressInfo)));

    const extras = ocmChargers.filter(charger => {
        const info = charger.AddressInfo;
        if (!info?.Latitude || !info?.Longitude) return false;
        if (charger.DataProviderID === OCM_AFDC_PROVIDER_ID) return false;
        if (doeIds.has(String(charger.DataProvidersReference))) return false;
        if (metersBetween(center, info) > coverage) return false;
        return !doe.some(station => metersBetween(station.AddressInfo, info) < DUPLICATE_METERS);
    });

    return [...doe, ...extras];
}
