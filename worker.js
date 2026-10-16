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

async function cached(key, ctx, produce) {
    const cacheKey = new Request(`https://cache.chargenear.org/${key}`);
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;

    const data = await produce();
    const response = json(data, 200, { 'cache-control': `public, max-age=${CACHE_SECONDS}` });
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
