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

// ---------- Türchen-Kalender: vergangene Tage und heute markieren ----------
(function markDoors() {
    const today = new Date();
    const iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    document.querySelectorAll('.door[data-date]').forEach(door => {
        if (door.dataset.date < iso) door.classList.add('past');
        if (door.dataset.date === iso) door.classList.add('today');
    });
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
