import { getChargers, geocode } from './api.js';
import { escapeHtml, milesBetween, tidyName } from './format.js';

const SITE = 'https://chargenear.org/';
const MAX_COUNT = 5;

const params = new URLSearchParams(window.location.search);
const address = (params.get('address') || '').trim();
const propertyName = (params.get('name') || '').trim();
const count = Math.min(Math.max(parseInt(params.get('count'), 10) || 3, 1), MAX_COUNT);
const fastOnly = params.get('fastOnly') === 'true';

const list = document.getElementById('charger-list');

const PLUG_NAMES = [
    [/ccs/i, 'CCS'],
    [/chademo/i, 'CHAdeMO'],
    [/tesla|nacs/i, 'Tesla / NACS'],
    [/j1772|type 1/i, 'J1772'],
    [/nema/i, 'Wall outlet']
];

function formatDistance(miles) {
    return miles < 0.1 ? '<0.1 mi' : `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

const SAME_SITE_MILES = 0.03;

// DOE lists each post in a garage separately; guests care about the site, not the post.
function groupBySite(entries) {
    const sites = [];
    for (const entry of entries) {
        const { lat, lon } = entry.point;
        const site = sites.find(existing => milesBetween(existing.point, { lat, lon }) < SAME_SITE_MILES);
        if (site) {
            site.chargers.push(entry.charger);
        } else {
            sites.push({ point: entry.point, miles: entry.miles, chargers: [entry.charger] });
        }
    }
    return sites;
}

function plugNames(connections) {
    const names = new Set();
    for (const conn of connections) {
        const title = conn.ConnectionType?.Title || '';
        const match = PLUG_NAMES.find(([pattern]) => pattern.test(title));
        if (match) names.add(match[1]);
    }
    return [...names];
}

function speed(connections) {
    const fast = connections.some(conn => conn.LevelID === 3);
    const maxKw = Math.max(0, ...connections.map(conn => conn.PowerKW || 0));
    const ports = connections.reduce((sum, conn) => sum + (conn.Quantity || 0), 0);
    const label = fast ? 'DC fast' : 'Level 2';
    return {
        fast,
        text: [label, maxKw ? `up to ${Math.round(maxKw)} kW` : null, ports > 1 ? `${ports} ports` : null].filter(Boolean).join(' · ')
    };
}

function itemHtml(site) {
    const charger = site.chargers[0];
    const info = charger.AddressInfo;
    const connections = site.chargers.flatMap(each => each.Connections || []);
    const { fast, text } = speed(connections);
    const plugs = plugNames(connections);
    const networks = [...new Set(site.chargers.map(each => each.OperatorInfo?.Title || 'Unknown network'))];
    const directions = `https://www.google.com/maps/dir/?api=1&destination=${info.Latitude},${info.Longitude}`;
    const details = `${SITE}?chargerId=${encodeURIComponent(charger.ID)}`;
    const title = site.chargers.length > 1 && info.AddressLine1 ? info.AddressLine1 : tidyName(info.Title) || 'EV charger';
    const address = site.chargers.length > 1 ? `${site.chargers.length} charging stations here` : info.AddressLine1;

    return `
        <li class="nearby-item">
            <span class="nearby-icon ${fast ? 'is-fast' : ''}" aria-hidden="true"><i class="fa-solid fa-bolt"></i></span>
            <div class="nearby-info">
                <a class="nearby-name" href="${details}" target="_blank" rel="noopener">${escapeHtml(title)}</a>
                ${address ? `<p class="nearby-address">${escapeHtml(address)}</p>` : ''}
                <p class="nearby-meta">${escapeHtml(networks.slice(0, 2).join(', '))} · ${escapeHtml(text)}</p>
                ${plugs.length ? `<p class="nearby-plugs">${plugs.map(plug => `<span>${escapeHtml(plug)}</span>`).join('')}</p>` : ''}
                <p class="nearby-report" data-report-for="${escapeHtml(charger.ID)}"></p>
            </div>
            <div class="nearby-side">
                <span class="nearby-distance">${formatDistance(site.miles)}</span>
                <a class="btn btn-primary nearby-directions" href="${directions}" target="_blank" rel="noopener"
                   aria-label="Directions to ${escapeHtml(title)}">
                    <i class="fa-solid fa-diamond-turn-right"></i><span>Directions</span>
                </a>
            </div>
        </li>`;
}

function showStatus(message) {
    list.innerHTML = `<li class="nearby-status">${escapeHtml(message)}</li>`;
}

async function showReports(chargers) {
    await Promise.all(chargers.map(async charger => {
        try {
            const response = await fetch(`/api/reports?id=${encodeURIComponent(charger.ID)}`);
            if (!response.ok) return;
            const { lastWorked, lastFailed } = await response.json();
            const slot = list.querySelector(`[data-report-for="${CSS.escape(String(charger.ID))}"]`);
            if (!slot || (!lastWorked && !lastFailed)) return;
            const failed = lastFailed && (!lastWorked || lastFailed > lastWorked);
            const days = Math.floor((Date.now() - new Date(failed ? lastFailed : lastWorked)) / 86400000);
            const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
            slot.className = `nearby-report ${failed ? 'is-bad' : 'is-good'}`;
            slot.textContent = failed ? `Reported not working ${when}` : `Reported working ${when}`;
        } catch {
            // Driver reports are a bonus; the list is still useful without them.
        }
    }));
}

async function init() {
    document.getElementById('card-title').textContent = propertyName ? `EV charging near ${propertyName}` : 'EV charging nearby';

    if (!address) {
        showStatus('Add ?address= to the link to show chargers near a place.');
        return;
    }

    const mapLink = new URL(SITE);
    mapLink.searchParams.set('address', address);
    if (fastOnly) mapLink.searchParams.set('fastOnly', 'true');
    document.getElementById('full-map').href = mapLink.toString();

    try {
        const place = await geocode(address);
        document.getElementById('card-subtitle').textContent = place.label;

        const chargers = await getChargers(place.lat, place.lon, { operationalOnly: true, publicOnly: true, fastOnly });
        const sorted = chargers
            .map(charger => {
                const point = { lat: charger.AddressInfo.Latitude, lon: charger.AddressInfo.Longitude };
                return { charger, point, miles: milesBetween(place, point) };
            })
            .sort((a, b) => a.miles - b.miles);
        const sites = groupBySite(sorted).slice(0, count);

        if (sites.length === 0) {
            showStatus(fastOnly ? 'No public fast chargers found nearby.' : 'No public chargers found nearby.');
            return;
        }

        list.innerHTML = sites.map(itemHtml).join('');
        showReports(sites.map(site => site.chargers[0]));
    } catch (error) {
        window.reportError?.(error);
        showStatus(error.message?.startsWith('No results') ? error.message : "Couldn't load chargers right now. Please try again later.");
    }
}

init();
