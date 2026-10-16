import { mergeStations, nrelToCharger } from './stations.js';

const OCM_BASE = 'https://api.openchargemap.io/v3/poi/';
const NREL_BASE = 'https://developer.nlr.gov/api/alt-fuel-stations/v1';
const CACHE_SECONDS = 600;
const OCM_RADIUS_MILES = 100;
const OCM_MAX_RESULTS = 100;
const NREL_RADIUS_MILES = 25;
const NREL_MAX_RESULTS = 200;

// No X-Frame-Options or frame-ancestors: hosts embed the map in iframes.
const SECURITY_HEADERS = {
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'geolocation=(self), camera=(), microphone=()'
};

function isLocal(url) {
    return ['localhost', '127.0.0.1'].includes(url.hostname);
}

function withHeaders(response, headers) {
    const result = new Response(response.body, response);
    for (const [name, value] of Object.entries(headers)) result.headers.set(name, value);
    return result;
}

function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders }
    });
}

function configScript(env) {
    return new Response(`window.MAPBOX_TOKEN = ${JSON.stringify(env.MAPBOX_TOKEN || '')};\n`, {
        headers: {
            'content-type': 'application/javascript; charset=utf-8',
            'cache-control': 'no-store'
        }
    });
}

// Rounding to ~1 km lets nearby searches share a cached response.
function roundCoord(value) {
    return Number(value).toFixed(2);
}

async function cached(key, ctx, produce, maxAge = CACHE_SECONDS) {
    const cacheKey = new Request(`https://cache.chargenear.org/${key}`);
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;

    const data = await produce();
    const response = json(data, 200, { 'cache-control': `public, max-age=${maxAge}` });
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    return response;
}

async function fetchJson(url, headers = {}) {
    const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'ChargeNear (https://chargenear.org)', ...headers }
    });
    if (!response.ok) throw new Error(`${new URL(url).hostname} responded with ${response.status}`);
    return response.json();
}

function fetchOcm(params, env) {
    const query = new URLSearchParams({ output: 'json', ...params });
    if (env.OCM_API_KEY) query.set('key', env.OCM_API_KEY);
    return fetchJson(`${OCM_BASE}?${query}`);
}

function fetchNrel(path, params, env) {
    const query = new URLSearchParams(params);
    return fetchJson(`${NREL_BASE}${path}?${query}`, { 'X-Api-Key': env.NREL_API_KEY });
}

async function handleChargers(url, env, ctx) {
    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return json({ error: 'lat and lon are required.' }, 400);
    }
    const latitude = roundCoord(lat);
    const longitude = roundCoord(lon);

    return cached(`chargers?lat=${latitude}&lon=${longitude}&v=2`, ctx, async () => {
        const [ocm, nrel] = await Promise.allSettled([
            fetchOcm({ latitude, longitude, distance: OCM_RADIUS_MILES, distanceunit: 'Miles', maxresults: OCM_MAX_RESULTS }, env),
            env.NREL_API_KEY
                ? fetchNrel('/nearest.json', { latitude, longitude, radius: NREL_RADIUS_MILES, fuel_type: 'ELEC', status: 'E,T', country: 'all', limit: NREL_MAX_RESULTS }, env)
                : Promise.resolve({ fuel_stations: [] })
        ]);
        for (const result of [ocm, nrel]) {
            if (result.status === 'rejected') console.error('Charger source failed', result.reason?.message);
        }
        if (ocm.status === 'rejected' && nrel.status === 'rejected') throw new Error('All charger sources failed');

        const center = { Latitude: Number(latitude), Longitude: Number(longitude) };
        return mergeStations(
            nrel.status === 'fulfilled' ? nrel.value.fuel_stations || [] : [],
            ocm.status === 'fulfilled' ? ocm.value : [],
            center
        );
    });
}

async function handleCharger(url, env, ctx) {
    const id = url.searchParams.get('id') || '';
    const match = id.match(/^(n?)(\d{1,10})$/);
    if (!match) return json({ error: 'A valid id is required.' }, 400);
    const [, prefix, number] = match;

    return cached(`charger?id=${id}`, ctx, async () => {
        if (prefix === 'n') {
            const data = await fetchNrel(`/${number}.json`, {}, env);
            return data.alt_fuel_station ? [nrelToCharger(data.alt_fuel_station)] : [];
        }
        return fetchOcm({ chargepointid: number }, env);
    });
}

const SITE_URL = 'https://chargenear.org/';
const GEOCODE_CACHE_SECONDS = 30 * 86400;
// Search Box /forward is billed per request beyond Mapbox's free tier; stay well under it.
const SEARCH_BOX_MONTHLY_CAP = 2000;

// The token is URL-restricted, so server-side requests identify the site they serve.
function fetchMapbox(path, params, env) {
    const query = new URLSearchParams({ access_token: env.MAPBOX_TOKEN, ...params });
    return fetchJson(`https://api.mapbox.com${path}?${query}`, { Referer: SITE_URL });
}

async function claimSearchBoxRequest(env) {
    const month = new Date().toISOString().slice(0, 7);
    const row = await env.DB.prepare(
        `INSERT INTO geocode_usage (month, requests) VALUES (?1, 1)
         ON CONFLICT (month) DO UPDATE SET requests = requests + 1
         RETURNING requests`
    ).bind(month).first();
    return row.requests <= SEARCH_BOX_MONTHLY_CAP;
}

const IGNORED_WORDS = new Set(['the', 'and']);

function queryWords(text) {
    return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 2 && !IGNORED_WORDS.has(word));
}

// Share of the typed words found in a result, so "NE" or "Ave" still match "Northeast" or "Avenue".
function coverage(query, resultText) {
    const words = queryWords(query);
    if (words.length === 0) return 1;
    const resultWords = queryWords(resultText);
    return words.filter(word => resultWords.some(each => each.startsWith(word))).length / words.length;
}

// The Geocoding API is free and good at addresses, zips and cities, but not businesses or landmarks.
const TRUSTED_GEOCODING_TYPES = new Set(['address', 'postcode', 'place', 'district', 'region', 'country']);

async function searchBoxForward(query, near, env) {
    const params = { q: query, limit: '5', language: 'en' };
    if (near) params.proximity = `${near.lon},${near.lat}`;
    const data = await fetchMapbox('/search/searchbox/v1/forward', params, env);
    // Ranking can put a shop inside a landmark above the landmark itself, so pick the closest wording match.
    let best = null;
    for (const feature of data.features || []) {
        const { name, full_address: fullAddress, place_formatted: place, feature_type: type } = feature.properties;
        const label = type === 'poi' || !fullAddress ? [name, fullAddress || place].filter(Boolean).join(', ') : fullAddress;
        const score = coverage(query, label);
        if (!best || score > best.score) {
            const [lon, lat] = feature.geometry.coordinates;
            best = { score, result: { lat, lon, label } };
        }
    }
    return best;
}

async function geocodingForward(query, near, env) {
    const params = { limit: '1' };
    if (near) params.proximity = `${near.lon},${near.lat}`;
    const data = await fetchMapbox(`/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`, params, env);
    const feature = data.features?.[0];
    if (!feature) return null;
    const [lon, lat] = feature.center;
    return {
        result: { lat, lon, label: feature.place_name },
        trusted: TRUSTED_GEOCODING_TYPES.has(feature.place_type?.[0]) && coverage(query, feature.place_name) === 1
    };
}

async function handleGeocode(url, env, ctx) {
    const query = (url.searchParams.get('q') || '').trim().replace(/\s+/g, ' ').slice(0, 200);
    if (!query) return json({ error: 'q is required.' }, 400);

    const [nearLat, nearLon] = (url.searchParams.get('near') || '').split(',').map(Number);
    const near = Number.isFinite(nearLat) && Number.isFinite(nearLon) && Math.abs(nearLat) <= 90 && Math.abs(nearLon) <= 180
        ? { lat: nearLat.toFixed(1), lon: nearLon.toFixed(1) }
        : null;
    const key = `geocode?q=${encodeURIComponent(query.toLowerCase())}&near=${near ? `${near.lat},${near.lon}` : ''}&v=3`;

    return cached(key, ctx, async () => {
        const geocoded = await geocodingForward(query, near, env);
        if (geocoded?.trusted) return geocoded.result;

        if (await claimSearchBoxRequest(env)) {
            try {
                const searched = await searchBoxForward(query, near, env);
                if (searched && searched.score >= 0.6) return searched.result;
            } catch (error) {
                console.error('Search Box failed', error.message);
            }
        }
        return geocoded?.result || null;
    }, GEOCODE_CACHE_SECONDS);
}

const REPORT_REASONS = ['not_there', 'broken', 'blocked', 'restricted', 'wrong_info'];
const REPORT_WINDOW_DAYS = 90;
const REPORTS_PER_DAY = 20;
const CHARGER_ID_PATTERN = /^n?\d{1,10}$/;

// A daily-rotating hash, so reports can be rate-limited without storing IP addresses.
async function reporterId(request, env) {
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    const day = new Date().toISOString().slice(0, 10);
    const data = new TextEncoder().encode(`${ip}|${day}|${env.REPORT_SALT || 'chargenear'}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].slice(0, 12).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function handleReport(request, env) {
    if (request.method !== 'POST') return json({ error: 'POST only.' }, 405);

    let body;
    try {
        body = JSON.parse((await request.text()).slice(0, 1000));
    } catch {
        return json({ error: 'Invalid report.' }, 400);
    }
    const chargerId = String(body.chargerId || '');
    const outcome = body.outcome;
    const reason = outcome === 'failed' && REPORT_REASONS.includes(body.reason) ? body.reason : null;
    if (!CHARGER_ID_PATTERN.test(chargerId) || !['worked', 'failed'].includes(outcome)) {
        return json({ error: 'Invalid report.' }, 400);
    }

    const reporter = await reporterId(request, env);
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { duplicate, today } = await env.DB.prepare(
        `SELECT
            SUM(CASE WHEN charger_id = ?1 AND created_at > ?2 THEN 1 ELSE 0 END) AS duplicate,
            COUNT(*) AS today
         FROM reports WHERE reporter = ?3`
    ).bind(chargerId, since, reporter).first();
    if (duplicate > 0) return json({ error: 'You already reported this charger recently. Thanks!' }, 429);
    if (today >= REPORTS_PER_DAY) return json({ error: 'Too many reports today. Please try again tomorrow.' }, 429);

    await env.DB.prepare(
        'INSERT INTO reports (charger_id, outcome, reason, reporter, created_at) VALUES (?1, ?2, ?3, ?4, ?5)'
    ).bind(chargerId, outcome, reason, reporter, new Date().toISOString()).run();

    return json(await reportSummary(chargerId, env), 201);
}

async function reportSummary(chargerId, env) {
    const since = new Date(Date.now() - REPORT_WINDOW_DAYS * 86400 * 1000).toISOString();
    const row = await env.DB.prepare(
        `SELECT
            SUM(CASE WHEN outcome = 'worked' THEN 1 ELSE 0 END) AS worked,
            SUM(CASE WHEN outcome = 'failed' THEN 1 ELSE 0 END) AS failed,
            MAX(CASE WHEN outcome = 'worked' THEN created_at END) AS last_worked,
            MAX(CASE WHEN outcome = 'failed' THEN created_at END) AS last_failed
         FROM reports WHERE charger_id = ?1 AND created_at > ?2`
    ).bind(chargerId, since).first();
    const lastFailure = row.last_failed
        ? await env.DB.prepare(
            "SELECT reason FROM reports WHERE charger_id = ?1 AND outcome = 'failed' ORDER BY created_at DESC LIMIT 1"
        ).bind(chargerId).first()
        : null;

    return {
        worked: row.worked || 0,
        failed: row.failed || 0,
        lastWorked: row.last_worked,
        lastFailed: row.last_failed,
        lastFailedReason: lastFailure?.reason || null
    };
}

async function handleReportSummary(url, env) {
    const chargerId = url.searchParams.get('id') || '';
    if (!CHARGER_ID_PATTERN.test(chargerId)) return json({ error: 'A valid id is required.' }, 400);
    return json(await reportSummary(chargerId, env), 200, { 'cache-control': 'no-store' });
}

async function handleLog(request) {
    if (request.method !== 'POST') return json({ error: 'POST only.' }, 405);
    const body = (await request.text()).slice(0, 4000);
    try {
        const report = JSON.parse(body);
        console.error('Client error', JSON.stringify({
            message: String(report.message || '').slice(0, 500),
            source: String(report.source || '').slice(0, 300),
            stack: String(report.stack || '').slice(0, 2000),
            page: String(report.page || '').slice(0, 300),
            userAgent: request.headers.get('user-agent') || ''
        }));
    } catch {
        return json({ error: 'Invalid report.' }, 400);
    }
    return new Response(null, { status: 204 });
}

async function route(request, env, ctx) {
    const url = new URL(request.url);

    switch (url.pathname) {
        case '/config.js': return configScript(env);
        case '/api/chargers': return handleChargers(url, env, ctx);
        case '/api/charger': return handleCharger(url, env, ctx);
        case '/api/geocode': return handleGeocode(url, env, ctx);
        case '/api/log': return handleLog(request);
        case '/api/report': return handleReport(request, env);
        case '/api/reports': return handleReportSummary(url, env);
        default: return env.ASSETS.fetch(request);
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (!isLocal(url) && (url.protocol === 'http:' || url.hostname.startsWith('www.'))) {
            url.protocol = 'https:';
            url.hostname = url.hostname.replace(/^www\./, '');
            return Response.redirect(url.toString(), 301);
        }

        let response;
        try {
            response = await route(request, env, ctx);
        } catch (error) {
            console.error('Request failed', url.pathname, error.message);
            response = json({ error: 'Charger data is temporarily unavailable.' }, 502);
        }
        return isLocal(url) ? response : withHeaders(response, SECURITY_HEADERS);
    }
};
