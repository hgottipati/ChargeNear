// script.js
import { initMap, addSearchedLocationMarker, openChargerDetails } from './mapUtils.js';
import { DEFAULT_LOCATION, locateUser, setLoading, showChargersAround } from './location.js';
import { setupUI } from './ui.js';
import { getChargerById, geocode } from './api.js';
import { showToast } from './toast.js';

function trackHeaderHeight() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const update = () => document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
    update();
    new ResizeObserver(update).observe(header);
}

async function resolveStartLocation(params) {
    const chargerId = params.get('chargerId');
    const address = params.get('address');

    if (chargerId) {
        try {
            const charger = await getChargerById(chargerId);
            if (charger?.AddressInfo) {
                return { mode: 'charger', lat: charger.AddressInfo.Latitude, lon: charger.AddressInfo.Longitude, charger };
            }
            showToast("That shared charger couldn't be found.", 'error');
        } catch (error) {
            window.reportError?.(error);
            showToast("Couldn't load the shared charger.", 'error');
        }
    }

    if (address) {
        try {
            const result = await geocode(address);
            return { mode: 'address', ...result };
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    return { mode: 'default', ...DEFAULT_LOCATION };
}

async function init() {
    if (document.documentElement.classList.contains('is-embedded')) {
        const brand = document.querySelector('.brand');
        brand.href = 'https://chargenear.org/';
        brand.target = '_blank';
        brand.rel = 'noopener';
    }
    trackHeaderHeight();
    setupUI();

    const params = new URLSearchParams(window.location.search);
    if (params.get('fastOnly') === 'true') {
        document.getElementById('fastOnly').checked = true;
        document.dispatchEvent(new CustomEvent('chargenear:filters-changed'));
    }

    setLoading(true);
    try {
        const start = await resolveStartLocation(params);
        await initMap(start.lat, start.lon, 14);

        if (start.mode === 'address') {
            document.getElementById('address').value = params.get('address');
            addSearchedLocationMarker(start.lat, start.lon, start.label);
        }

        await showChargersAround(start.lat, start.lon);

        if (start.mode === 'charger') {
            openChargerDetails(start.charger);
        } else if (start.mode === 'default') {
            setLoading(false);
            const located = await locateUser({ quiet: true });
            if (!located) {
                showToast(`Showing chargers near ${DEFAULT_LOCATION.label}. Search for a place or tap the location button.`, 'info', 6000);
            }
        }
    } catch (error) {
        window.reportError?.(error);
        showToast("Something went wrong loading chargers. Please refresh the page.", 'error', 6000);
    } finally {
        setLoading(false);
    }
}

init();
