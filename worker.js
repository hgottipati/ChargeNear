// Serves the static site and injects runtime config that must not live in the repo.
// Static files are matched first; only requests with no matching file reach this code.
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/config.js') {
            return new Response(`window.MAPBOX_TOKEN = ${JSON.stringify(env.MAPBOX_TOKEN || '')};\n`, {
                headers: {
                    'content-type': 'application/javascript; charset=utf-8',
                    'cache-control': 'public, max-age=300'
                }
            });
        }

        return env.ASSETS.fetch(request);
    }
};
