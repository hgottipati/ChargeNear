import { showToast } from './toast.js';
import { geocode } from './api.js';

const SITE = 'https://chargenear.org/';

const form = document.getElementById('embed-form');
const addressInput = document.getElementById('embed-address');
const nameInput = document.getElementById('embed-name');
const countInput = document.getElementById('embed-count');
const radiusInput = document.getElementById('embed-radius');
const fastInput = document.getElementById('embed-fast');
const countOption = document.getElementById('embed-count-option');
const radiusOption = document.getElementById('embed-radius-option');
const preview = document.getElementById('embed-preview');
const code = document.getElementById('embed-code');
const copyButton = document.getElementById('copy-embed');
const resolved = document.getElementById('embed-resolved');
let resolvedFor = null;

async function showResolvedAddress() {
    const address = addressInput.value.trim();
    if (address === resolvedFor) return;
    resolvedFor = address;
    if (!address) {
        resolved.textContent = '';
        return;
    }
    try {
        const place = await geocode(address);
        if (address !== resolvedFor) return;
        resolved.innerHTML = '<i class="fa-solid fa-location-dot" aria-hidden="true"></i> ';
        resolved.append(`Pinned at: ${place.label}. Not right? Use the street address instead.`);
    } catch (error) {
        if (address === resolvedFor) resolved.textContent = error.message;
    }
}

function embedType() {
    return document.querySelector('input[name="embed-type"]:checked').value;
}

function cardHeight() {
    return 120 + Number(countInput.value) * 112;
}

function embedUrl(origin) {
    const isCard = embedType() === 'card';
    const params = new URLSearchParams();
    const address = addressInput.value.trim();
    if (address) params.set('address', address);
    if (nameInput.value.trim()) params.set('name', nameInput.value.trim());
    if (isCard && countInput.value !== '3') params.set('count', countInput.value);
    if (!isCard && address && radiusInput.value !== 'none') params.set('radius', radiusInput.value);
    if (fastInput.checked) params.set('fastOnly', 'true');
    const query = params.toString();
    const base = isCard ? `${origin}card` : origin;
    return query ? `${base}?${query}` : base;
}

function render() {
    const isCard = embedType() === 'card';
    const height = isCard ? cardHeight() : 500;
    countOption.hidden = !isCard;
    radiusOption.hidden = isCard;

    showResolvedAddress();
    preview.src = embedUrl(`${window.location.origin}/`);
    preview.style.height = `${height}px`;
    preview.style.maxWidth = isCard ? '480px' : '';

    const title = isCard ? 'Nearest EV chargers' : 'Nearby EV chargers';
    const allow = isCard ? '' : ' allow="geolocation"';
    code.textContent =
        `<iframe src="${embedUrl(SITE)}"\n` +
        `        width="100%" height="${height}" style="border:0; border-radius:12px;${isCard ? ' max-width:480px;' : ''}"\n` +
        `       ${allow} loading="lazy" title="${title}"></iframe>`;
}

form.addEventListener('submit', event => {
    event.preventDefault();
    render();
});

document.querySelectorAll('input[name="embed-type"]').forEach(input => input.addEventListener('change', render));
[fastInput, countInput, radiusInput].forEach(input => input.addEventListener('change', render));
nameInput.addEventListener('change', render);

copyButton.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(code.textContent);
        showToast('Embed code copied', 'success');
    } catch {
        showToast('Copy failed. Select the code and copy it manually.', 'error');
    }
});

render();
