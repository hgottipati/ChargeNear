export const FILTER_IDS = [
    'fastOnly', 'level2Only',
    'teslaSupercharger', 'teslaDestination', 'chargepointOnly', 'electrifyAmerica',
    'evgo', 'blink', 'volta', 'shellRecharge', 'evConnect', 'semaConnect',
    'operationalOnly', 'publicOnly',
    'highPower', 'mediumPower', 'lowPower'
];

export function getActiveFilters() {
    const filters = {};
    FILTER_IDS.forEach(id => {
        filters[id] = document.getElementById(id)?.checked || false;
    });
    return filters;
}

export function countActiveFilters() {
    const checked = FILTER_IDS.filter(id => document.getElementById(id)?.checked).length;
    const radius = document.querySelector('input[name="nearbyRadius"]:checked')?.value;
    return checked + (radius && radius !== 'none' ? 1 : 0);
}

export function getSelectedRadius() {
    return document.querySelector('input[name="nearbyRadius"]:checked')?.value || 'none';
}
