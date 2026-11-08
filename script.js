// Mobiles Menü nach Klick auf einen Link schließen
document.querySelectorAll('.site-nav .nav-link').forEach(link => {
    link.addEventListener('click', () => {
        const menu = document.getElementById('navbarNav');
        if (menu && menu.classList.contains('show') && window.bootstrap) {
            bootstrap.Collapse.getOrCreateInstance(menu).hide();
        }
    });
});
