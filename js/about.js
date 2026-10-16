import { showToast } from './toast.js';

const SITE = 'https://chargenear.org/';

const form = document.getElementById('embed-form');
const addressInput = document.getElementById('embed-address');
const fastInput = document.getElementById('embed-fast');
const preview = document.getElementById('embed-preview');
const code = document.getElementById('embed-code');
const copyButton = document.getElementById('copy-embed');

function embedUrl(origin) {
    const params = new URLSearchParams();
    const address = addressInput.value.trim();
    if (address) params.set('address', address);
    if (fastInput.checked) params.set('fastOnly', 'true');
    const query = params.toString();
    return query ? `${origin}?${query}` : origin;
}

function render() {
    preview.src = embedUrl(`${window.location.origin}/`);
    code.textContent =
        `<iframe src="${embedUrl(SITE)}"\n` +
        `        width="100%" height="500" style="border:0; border-radius:12px;"\n` +
        `        allow="geolocation" loading="lazy" title="Nearby EV chargers"></iframe>`;
}

form.addEventListener('submit', event => {
    event.preventDefault();
    render();
});

fastInput.addEventListener('change', render);

copyButton.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(code.textContent);
        showToast('Embed code copied', 'success');
    } catch {
        showToast('Copy failed. Select the code and copy it manually.', 'error');
    }
});

render();
