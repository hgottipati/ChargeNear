import { getMap, addChargersToMap, addCurrentLocationMarker, addSearchedLocationMarker, updateNearbyCircle } from './mapUtils.js';
import { getChargers, geocode } from './api.js';
import { getActiveFilters, getSelectedRadius } from './filters.js';
import { showToast } from './toast.js';

export const DEFAULT_LOCATION = { lat: 47.6062, lon: -122.3321, label: 'Seattle, WA' };

export let currentLocationCoords = { lat: null, lon: null };

// The point the user last searched for or located; filters and the walking circle use it.
export const searchCenter = { lat: DEFAULT_LOCATION.lat, lon: DEFAULT_LOCATION.lon };

const LOCATION_ERRORS = {
    1: 'Location access is turned off. Search for a place instead, or allow location in your browser settings.',
    2: "Your location isn't available right now. Search for a place instead.",
    3: 'Finding your location took too long. Please try again.'
};

export function getCurrentLocation({ timeout = 10000 } = {}) {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(Object.assign(new Error('Geolocation unsupported'), { userMessage: "Your browser doesn't support location. Search for a place instead." }));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            position => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
            error => reject(Object.assign(error, { userMessage: LOCATION_ERRORS[error.code] || "Couldn't get your location." })),
            { timeout, enableHighAccuracy: true, maximumAge: 60000 }
        );
    });
}

export function setLoading(isLoading) {
    document.getElementById('loading')?.classList.toggle('is-visible', isLoading);
}

export async function showChargersAround(lat, lon, { recenter = true } = {}) {
    searchCenter.lat = lat;
    searchCenter.lon = lon;
    document.dispatchEvent(new CustomEvent('chargenear:searched'));
    const map = await getMap();
    if (recenter) map.jumpTo({ center: [lon, lat], zoom: 14 });
    const chargers = await getChargers(lat, lon, getActiveFilters());
    addChargersToMap(chargers, [lon, lat]);
    if (chargers.length === 0) {
        showToast('No chargers match your filters here. Try zooming out or changing filters.', 'info');
    }
    const radius = getSelectedRadius();
    if (radius !== 'none') updateNearbyCircle([lon, lat], radius);
}

export async function locateUser({ quiet = false } = {}) {
    try {
        const { lat, lon } = await getCurrentLocation();
        setLoading(true);
        currentLocationCoords.lat = lat;
        currentLocationCoords.lon = lon;
        addCurrentLocationMarker(lat, lon);
        document.getElementById('address').value = '';
        await showChargersAround(lat, lon);
        return true;
    } catch (error) {
        if (!quiet) showToast(error.userMessage || "Couldn't get your location.", 'error');
        return false;
    } finally {
        setLoading(false);
    }
}

export async function searchLocation(query) {
    const trimmed = query.trim();
    if (!trimmed) return locateUser();

    setLoading(true);
    try {
        const { lat, lon, label } = await geocode(trimmed);
        addSearchedLocationMarker(lat, lon, label);
        await showChargersAround(lat, lon);
    } catch (error) {
        showToast(error.message || 'Something went wrong. Please try again.', 'error');
    } finally {
        setLoading(false);
    }
}
