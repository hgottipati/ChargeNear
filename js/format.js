// Excludes codes that are also common words (IN, OR, ME, OK, HI).
const US_STATES = 'AL AK AZ AR CA CO CT DE DC FL GA ID IL IA KS KY LA MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const KEEP_UPPERCASE = new Set(['EV', 'CC', 'UW', 'UWB', 'USA', 'LLC', 'NW', 'SE', 'SW', 'II', 'III', 'HQ', 'REI', 'QFC', 'YMCA', ...US_STATES]);

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

export function tidyName(name) {
    if (!name || /[a-z]/.test(name)) return name;
    return name.split(/(\s+|-|\/)/).map(word => {
        if (KEEP_UPPERCASE.has(word) || !/[A-Z]/.test(word)) return word;
        return word.charAt(0) + word.slice(1).toLowerCase();
    }).join('');
}
