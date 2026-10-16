const OCM_BASE = 'https://api.openchargemap.io/v3/poi/';
const OCM_CACHE_SECONDS = 600;
const SEARCH_RADIUS_MILES = 100;
const MAX_RESULTS = 100;

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

async function cachedOcm(params, env, ctx) {
    const query = new URLSearchParams({ output: 'json', ...params });
    const cacheKey = new Request(`https://ocm-cache.chargenear.org/?${query}`);
    const cache = caches.default;

    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    if (env.OCM_API_KEY) query.set('key', env.OCM_API_KEY);
    const upstream = await fetch(`${OCM_BASE}?${query}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'ChargeNear (https://chargenear.org)' }
    });
    if (!upstream.ok) {
        console.error('Open Charge Map error', upstream.status, query.toString().replace(/key=[^&]+/, 'key=…'));
        return json({ error: 'Charger data is temporarily unavailable.' }, 502);
    }

    const response = new Response(upstream.body, {
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': `public, max-age=${OCM_CACHE_SECONDS}`
        }
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
}

async function handleChargers(url, env, ctx) {
    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return json({ error: 'lat and lon are required.' }, 400);
    }
    return cachedOcm({
        latitude: roundCoord(lat),
        longitude: roundCoord(lon),
        distance: SEARCH_RADIUS_MILES,
        distanceunit: 'Miles',
        maxresults: MAX_RESULTS
    }, env, ctx);
}

async function handleCharger(url, env, ctx) {
    const id = url.searchParams.get('id');
    if (!/^\d{1,10}$/.test(id || '')) return json({ error: 'A numeric id is required.' }, 400);
    return cachedOcm({ chargepointid: id }, env, ctx);
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

        const response = await route(request, env, ctx);
        return isLocal(url) ? response : withHeaders(response, SECURITY_HEADERS);
    }
};
