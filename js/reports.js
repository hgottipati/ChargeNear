import { showToast } from './toast.js';

const REASONS = {
    not_there: "Charger isn't there",
    broken: 'Broken or offline',
    blocked: 'Spot was blocked',
    restricted: 'Access restricted',
    wrong_info: 'Wrong plug or info'
};

function timeAgo(iso) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    return months === 1 ? 'a month ago' : `${months} months ago`;
}

function summaryHtml(summary) {
    const { worked, failed, lastWorked, lastFailed, lastFailedReason } = summary;
    if (!worked && !failed) return '';

    const failedMoreRecently = lastFailed && (!lastWorked || lastFailed > lastWorked);
    const total = `${worked + failed} driver report${worked + failed === 1 ? '' : 's'} in 90 days`;
    if (failedMoreRecently) {
        const reason = REASONS[lastFailedReason] ? ` (${REASONS[lastFailedReason].toLowerCase()})` : '';
        return `<p class="community-status is-bad"><i class="fa-solid fa-circle-xmark"></i>
            Reported not working ${timeAgo(lastFailed)}${reason} · ${total}</p>`;
    }
    return `<p class="community-status is-good"><i class="fa-solid fa-user-check"></i>
        Drivers reported it working ${timeAgo(lastWorked)} · ${total}</p>`;
}

function renderSummary(card, summary) {
    const slot = card.querySelector('[data-report-summary]');
    if (slot) slot.innerHTML = summaryHtml(summary);
}

async function submit(card, chargerId, outcome, reason) {
    const box = card.querySelector('[data-report-box]');
    box.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
        const response = await fetch('/api/report', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chargerId, outcome, reason })
        });
        const data = await response.json();
        if (!response.ok) {
            box.innerHTML = '<p class="report-thanks is-muted"></p>';
            box.firstChild.textContent = data.error || "Couldn't save your report.";
            return;
        }
        renderSummary(card, data);
        box.innerHTML = '<p class="report-thanks"><i class="fa-solid fa-heart"></i> Thanks — this helps the next driver.</p>';
    } catch (error) {
        window.reportError?.(error);
        showToast("Couldn't save your report. Please try again.", 'error');
        box.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
}

function showReasons(card, chargerId) {
    const box = card.querySelector('[data-report-box]');
    box.innerHTML = `
        <p class="report-question">What went wrong?</p>
        <div class="report-reasons">
            ${Object.entries(REASONS).map(([key, label]) =>
                `<button type="button" class="chip-button" data-reason="${key}">${label}</button>`).join('')}
        </div>`;
    box.querySelectorAll('[data-reason]').forEach(button => {
        button.addEventListener('click', () => submit(card, chargerId, 'failed', button.dataset.reason));
    });
    box.querySelector('[data-reason]').focus();
}

export function setupReports(card, chargerId) {
    const box = card.querySelector('[data-report-box]');
    if (!box) return;

    box.innerHTML = `
        <p class="report-question">Did this charger work for you?</p>
        <div class="report-buttons">
            <button type="button" class="btn btn-secondary" data-outcome="worked"><i class="fa-solid fa-thumbs-up"></i> It worked</button>
            <button type="button" class="btn btn-secondary" data-outcome="failed"><i class="fa-solid fa-thumbs-down"></i> Didn't work</button>
        </div>`;
    box.querySelector('[data-outcome="worked"]').addEventListener('click', () => submit(card, chargerId, 'worked'));
    box.querySelector('[data-outcome="failed"]').addEventListener('click', () => showReasons(card, chargerId));

    fetch(`/api/reports?id=${encodeURIComponent(chargerId)}`)
        .then(response => (response.ok ? response.json() : null))
        .then(summary => summary && renderSummary(card, summary))
        .catch(() => {});
}
