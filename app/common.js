// Gemeinsame Helfer für Teilnehmer- und Admin-Seite
(function () {
    const cfg = window.APP_CONFIG || {};
    const ready = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);

    const sb = ready
        ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
              auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
          })
        : null;

    const BUCKET = 'raetsel';

    function esc(text) {
        return String(text ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // Einfache Formatierung aus dem Editor:
    // # Überschrift, **fett**, *kursiv*, --- Trennlinie, Leerzeile = neuer Absatz
    function renderBody(text) {
        const inline = s => esc(s)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>');
        return String(text || '')
            .replace(/\r/g, '')
            .split(/\n{2,}/)
            .map(block => block.trim())
            .filter(Boolean)
            .map(block => {
                if (block === '---') return '<hr>';
                const h = block.match(/^(#{1,2})\s+(.*)$/s);
                if (h) return h[1].length === 1 ? `<h3>${inline(h[2])}</h3>` : `<h4>${inline(h[2])}</h4>`;
                return `<p>${inline(block).replace(/\n/g, '<br>')}</p>`;
            })
            .join('');
    }

    const dateFmt = new Intl.DateTimeFormat('de-DE', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
    });
    const exactFmt = new Intl.DateTimeFormat('de-DE', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
        fractionalSecondDigits: 3, timeZone: 'Europe/Berlin'
    });

    const fmtDate = ts => (ts ? dateFmt.format(new Date(ts)) + ' Uhr' : '');
    const fmtExact = ts => (ts ? exactFmt.format(new Date(ts)) + ' Uhr' : '');

    // Signierte Links für private Dateien (1 Stunde gültig)
    async function signFiles(files) {
        if (!files || !files.length) return [];
        const { data, error } = await sb.storage.from(BUCKET)
            .createSignedUrls(files.map(f => f.path), 3600);
        if (error) throw error;
        return files.map((f, i) => ({ ...f, url: data[i] && data[i].signedUrl }));
    }

    function renderFiles(files) {
        return files.map(f => {
            if (!f.url) return '';
            if ((f.type || '').startsWith('image/')) {
                return `<a href="${esc(f.url)}" target="_blank" rel="noopener"><img class="entry-img" src="${esc(f.url)}" alt="${esc(f.name)}" loading="lazy"></a>`;
            }
            return `<a class="file-link" href="${esc(f.url)}" target="_blank" rel="noopener">📄 ${esc(f.name)} öffnen</a>`;
        }).join('');
    }

    function errorText(err) {
        const msg = (err && (err.message || err.error_description)) || String(err);
        if (/rate limit/i.test(msg)) return 'Zu viele Versuche. Bitte warte kurz und versuche es dann erneut.';
        return msg;
    }

    function toast(text, kind = 'ok') {
        let box = document.getElementById('toast');
        if (!box) {
            box = document.createElement('div');
            box.id = 'toast';
            document.body.appendChild(box);
        }
        box.textContent = text;
        box.className = 'show ' + kind;
        clearTimeout(box._t);
        box._t = setTimeout(() => { box.className = ''; }, 4000);
    }

    async function sendLoginLink(email) {
        const redirect = window.location.origin + window.location.pathname;
        const { error } = await sb.auth.signInWithOtp({
            email, options: { emailRedirectTo: redirect, shouldCreateUser: true }
        });
        if (error) throw error;
    }

    async function loadProfile() {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return null;
        const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (error) throw error;
        return data || { id: session.user.id, email: session.user.email, approved: false, is_admin: false };
    }

    function show(id) {
        document.querySelectorAll('[data-view]').forEach(el => {
            el.hidden = el.dataset.view !== id;
        });
    }

    window.App = { sb, ready, BUCKET, esc, renderBody, fmtDate, fmtExact, signFiles, renderFiles,
                   errorText, toast, sendLoginLink, loadProfile, show };
})();
