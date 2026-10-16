import { getChargers, getAddressSuggestions } from './api.js';
import { searchCenter, searchLocation, setLoading, showChargersAround } from './location.js';
import { getMap, addChargersToMap, updateNearbyCircle, removeNearbyCircle } from './mapUtils.js';
import { FILTER_IDS, getActiveFilters, countActiveFilters, getSelectedRadius } from './filters.js';
import { showToast } from './toast.js';

const SELECT_ALL_GROUPS = [
    { selectAll: 'selectAllChargerTypes', children: '.charger-type-child' },
    { selectAll: 'selectAllNetwork', children: '.network-child' },
    { selectAll: 'selectAllStatus', children: '.status-child' },
    { selectAll: 'selectAllPower', children: '.power-child' }
];

function setupSearch() {
    const form = document.getElementById('search-form');
    const input = document.getElementById('address');
    const button = document.getElementById('search-button');
    const datalist = document.getElementById('address-suggestions');

    form.addEventListener('submit', async event => {
        event.preventDefault();
        button.disabled = true;
        button.classList.add('is-loading');
        try {
            await searchLocation(input.value);
            input.blur();
        } finally {
            button.disabled = false;
            button.classList.remove('is-loading');
        }
    });

    let debounce;
    input.addEventListener('input', () => {
        clearTimeout(debounce);
        const query = input.value.trim();
        if (query.length < 3) return;
        debounce = setTimeout(async () => {
            try {
                const suggestions = await getAddressSuggestions(query);
                datalist.replaceChildren(...suggestions.map(value => Object.assign(document.createElement('option'), { value })));
            } catch {
                // Suggestions are optional; the search itself still works.
            }
        }, 250);
    });
}

function updateFilterBadges() {
    const badge = document.getElementById('filter-count');
    if (badge) {
        const count = countActiveFilters();
        badge.textContent = count;
        badge.hidden = count === 0;
    }

    document.querySelectorAll('.filter-section').forEach(section => {
        const counter = section.querySelector('.section-count');
        if (!counter) return;
        const checked = section.querySelectorAll('.section-content input[type="checkbox"]:not([id^="selectAll"]):checked').length;
        const radio = section.querySelector('input[type="radio"]:checked');
        if (radio) {
            counter.textContent = radio.value === 'none' ? '' : radio.closest('label').dataset.short;
        } else {
            counter.textContent = checked ? `${checked} on` : '';
        }
    });
}

function syncSelectAll() {
    SELECT_ALL_GROUPS.forEach(({ selectAll, children }) => {
        const parent = document.getElementById(selectAll);
        const items = [...document.querySelectorAll(children)];
        if (!parent || items.length === 0) return;
        const checkedCount = items.filter(item => item.checked).length;
        parent.checked = checkedCount === items.length;
        parent.indeterminate = checkedCount > 0 && checkedCount < items.length;
    });
}

function setupFilters() {
    const modal = document.getElementById('filter-modal');
    const panel = modal.querySelector('.filter-panel');

    let opener = null;
    const open = () => {
        opener = document.activeElement;
        syncSelectAll();
        updateFilterBadges();
        modal.classList.add('is-open');
        panel.querySelector('button')?.focus();
    };
    const close = () => {
        modal.classList.remove('is-open');
        if (opener?.isConnected) opener.focus({ preventScroll: true });
        opener = null;
    };

    document.addEventListener('chargenear:open-filters', open);
    document.addEventListener('chargenear:filters-changed', () => {
        updateFilterBadges();
        renderFilterChips();
    });
    document.getElementById('close-filters').addEventListener('click', close);
    modal.addEventListener('click', event => {
        if (event.target === modal) close();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modal.classList.contains('is-open')) close();
    });

    modal.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.filter-section');
            const collapsed = section.classList.toggle('collapsed');
            header.setAttribute('aria-expanded', String(!collapsed));
        });
    });

    SELECT_ALL_GROUPS.forEach(({ selectAll, children }) => {
        document.getElementById(selectAll)?.addEventListener('change', event => {
            document.querySelectorAll(children).forEach(child => {
                child.checked = event.target.checked;
            });
            updateFilterBadges();
        });
    });

    modal.addEventListener('change', () => {
        syncSelectAll();
        updateFilterBadges();
    });

    document.getElementById('reset-filters').addEventListener('click', () => {
        modal.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
            checkbox.indeterminate = false;
        });
        document.getElementById('operationalOnly').checked = true;
        document.getElementById('publicOnly').checked = true;
        document.getElementById('nearbyNone').checked = true;
        syncSelectAll();
        updateFilterBadges();
    });

    document.getElementById('apply-filters').addEventListener('click', () => {
        close();
        applyCurrentFilters();
    });

    document.getElementById('filter-chips').addEventListener('click', event => {
        const button = event.target.closest('button[data-filter]');
        if (!button) return;
        const input = document.getElementById(button.dataset.filter);
        if (input.type === 'radio') {
            document.getElementById('nearbyNone').checked = true;
        } else {
            input.checked = false;
        }
        syncSelectAll();
        applyCurrentFilters();
    });

    updateFilterBadges();
    renderFilterChips();
}

function chipLabel(input) {
    const label = input.closest('label');
    return label.dataset.short || label.textContent.replace(/\(.*\)/, '').trim();
}

function renderFilterChips() {
    const chips = FILTER_IDS
        .map(id => document.getElementById(id))
        .filter(input => input?.checked)
        .map(input => ({ id: input.id, label: chipLabel(input) }));

    const radius = document.querySelector('input[name="nearbyRadius"]:checked');
    if (radius && radius.value !== 'none') {
        chips.push({ id: radius.id, label: `Within ${chipLabel(radius)}` });
    }

    document.getElementById('filter-chips').innerHTML = chips.map(chip => `
        <li class="filter-chip">${chip.label}
            <button type="button" data-filter="${chip.id}" aria-label="Remove filter: ${chip.label}">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
        </li>`).join('');
}

async function applyCurrentFilters() {
    updateFilterBadges();
    renderFilterChips();
    setLoading(true);
    try {
        const { lat, lon } = searchCenter;
        const chargers = await getChargers(lat, lon, getActiveFilters());
        addChargersToMap(chargers, [lon, lat]);
        if (chargers.length === 0) {
            showToast('No chargers match these filters nearby.', 'info');
        }
        const radius = getSelectedRadius();
        if (radius === 'none') {
            await removeNearbyCircle();
        } else {
            await updateNearbyCircle([lon, lat], radius);
        }
    } catch (error) {
        window.reportError?.(error);
        showToast("Couldn't update chargers. Please try again.", 'error');
    } finally {
        setLoading(false);
    }
}

function setupSearchThisArea() {
    const button = document.getElementById('search-area');

    document.addEventListener('chargenear:searched', () => {
        button.hidden = true;
    });

    getMap().then(map => {
        map.on('moveend', () => {
            const canvas = map.getCanvas();
            const viewport = Math.min(canvas.clientWidth, canvas.clientHeight);
            const searched = map.project([searchCenter.lon, searchCenter.lat]);
            const center = map.project(map.getCenter());
            const movedFar = Math.hypot(searched.x - center.x, searched.y - center.y) > viewport / 3;
            button.hidden = !movedFar;
        });

        button.addEventListener('click', async () => {
            const { lat, lng } = map.getCenter();
            button.disabled = true;
            setLoading(true);
            try {
                await showChargersAround(lat, lng, { recenter: false });
            } catch (error) {
                window.reportError?.(error);
                showToast("Couldn't load chargers here. Please try again.", 'error');
            } finally {
                button.disabled = false;
                setLoading(false);
            }
        });
    });
}

function setupLegend() {
    const legend = document.getElementById('map-legend');
    const toggle = legend.querySelector('.legend-toggle');
    toggle.addEventListener('click', () => {
        const expanded = legend.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(expanded));
    });
}

export function setupUI() {
    setupSearch();
    setupFilters();
    setupSearchThisArea();
    setupLegend();
}
