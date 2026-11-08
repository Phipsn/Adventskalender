// ---------- Countdown ----------
// Bis zum 1. Advent, danach bis zum Finale am 4. Advent (12:00 Uhr).
const countdownTargets = [
    { date: new Date('2026-11-29T00:00:00+01:00'), label: 'Bis zum 1. Advent' },
    { date: new Date('2026-12-20T12:00:00+01:00'), label: 'Bis zum Finale am 4. Advent' }
];

function updateCountdown() {
    const box = document.getElementById('countdown');
    if (!box) return;
    const now = new Date();
    const target = countdownTargets.find(t => t.date > now);
    if (!target) { box.hidden = true; return; }

    const diff = target.date - now;
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('countdownLabel').textContent = target.label;
    document.getElementById('cdDays').textContent = Math.floor(diff / 86400000);
    document.getElementById('cdHours').textContent = pad(Math.floor(diff / 3600000) % 24);
    document.getElementById('cdMinutes').textContent = pad(Math.floor(diff / 60000) % 60);
    document.getElementById('cdSeconds').textContent = pad(Math.floor(diff / 1000) % 60);
    box.hidden = false;
}
updateCountdown();
setInterval(updateCountdown, 1000);

// ---------- Türchen-Kalender ----------
(function buildDoors() {
    const grid = document.getElementById('doors');
    if (!grid) return;

    const start = new Date(2026, 10, 29); // 29. November 2026 (1. Advent)
    const end = new Date(2026, 11, 24);   // 24. Dezember 2026
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const advents = { '29.11': '1. Advent', '6.12': '2. Advent', '13.12': '3. Advent', '20.12': '4. Advent' };

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.getDate() + '.' + (d.getMonth() + 1);
        const wd = d.getDay();
        let type = 'story', tag = '';
        if (d > new Date(2026, 11, 20)) { type = 'after'; }
        if (wd === 0 || wd === 3 || wd === 6 || key === '29.11') { type = 'riddle'; tag = 'Rätsel'; }
        if (key === '20.12') { type = 'final'; tag = 'Finale'; }
        if (key === '24.12') { type = 'winner'; tag = 'Gewinner:in'; }
        if (d > new Date(2026, 11, 20) && type === 'riddle') { type = 'after'; tag = ''; }

        const door = document.createElement('div');
        door.className = 'door ' + type + (d < today ? ' past' : '') + (d.getTime() === today.getTime() ? ' today' : '');
        door.innerHTML =
            (tag ? `<span class="door-tag">${tag}</span>` : '') +
            `<span class="door-wd">${weekdays[wd]}</span>` +
            `<span class="door-num">${d.getDate()}</span>` +
            (advents[key] ? `<span class="door-advent">${advents[key]}</span>` : '');
        grid.appendChild(door);
    }
})();

// ---------- Mobiles Menü nach Klick schließen ----------
document.querySelectorAll('.site-nav .nav-link').forEach(link => {
    link.addEventListener('click', () => {
        const menu = document.getElementById('navbarNav');
        if (menu && menu.classList.contains('show') && window.bootstrap) {
            bootstrap.Collapse.getOrCreateInstance(menu).hide();
        }
    });
});
