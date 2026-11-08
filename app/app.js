// Teilnehmer-Seite: anmelden, Rätsel lesen, Antwort abgeben
(function () {
    const { sb, ready, esc, renderBody, fmtDate, fmtExact, signFiles, renderFiles,
            errorText, toast, sendLoginLink, loadProfile, show } = window.App;

    let profile = null;
    let countdownTimer = null;

    if (!ready) { show('setup'); return; }

    document.getElementById('loginForm').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        try {
            await sendLoginLink(document.getElementById('loginEmail').value.trim());
            document.getElementById('loginSent').hidden = false;
            toast('Link verschickt!');
        } catch (err) {
            toast(errorText(err), 'error');
        } finally {
            btn.disabled = false;
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await sb.auth.signOut();
        location.reload();
    });

    document.querySelectorAll('.name-form').forEach(form => form.addEventListener('submit', async e => {
        e.preventDefault();
        const name = form.querySelector('.name-input').value.trim();
        if (!name) return;
        const { error } = await sb.rpc('set_display_name', { new_name: name });
        if (error) return toast(errorText(error), 'error');
        profile.display_name = name;
        toast('Gespeichert');
        document.getElementById('nameCard').hidden = true;
        document.getElementById('userName').textContent = name;
    }));

    let busy = false;
    async function start() {
        if (busy) return;
        busy = true;
        try {
            await run();
        } finally {
            busy = false;
        }
    }

    async function run() {
        try {
            profile = await loadProfile();
        } catch (err) {
            toast(errorText(err), 'error');
        }
        if (!profile) { show('login'); return; }

        document.getElementById('userBox').hidden = false;
        document.getElementById('userName').textContent = profile.display_name || profile.email;

        if (!profile.approved && !profile.is_admin) {
            if (profile.display_name) document.getElementById('pendingName').value = profile.display_name;
            show('pending');
            return;
        }
        document.getElementById('nameCard').hidden = Boolean(profile.display_name);
        show('main');
        await loadEntries();
    }

    async function loadEntries() {
        const [entriesRes, subsRes, nextRes] = await Promise.all([
            sb.from('entries')
              .select('id,title,kind,body,files,release_at,is_final')
              .eq('published', true)
              .lte('release_at', new Date().toISOString())
              .order('release_at', { ascending: false }),
            sb.rpc('my_submissions'),
            sb.rpc('next_release')
        ]);
        if (entriesRes.error) return toast(errorText(entriesRes.error), 'error');

        const subs = new Map((subsRes.data || []).map(s => [s.entry_id, s]));
        const box = document.getElementById('entries');
        const entries = entriesRes.data || [];
        document.getElementById('emptyState').hidden = entries.length > 0;

        const html = await Promise.all(entries.map(async e => {
            let files = [];
            try { files = await signFiles(e.files); } catch (err) { console.warn(err); }
            return entryCard(e, files, subs.get(e.id));
        }));
        box.innerHTML = html.join('');
        box.querySelectorAll('.answer-form').forEach(f => f.addEventListener('submit', submitAnswer));

        startCountdown(nextRes.data);
    }

    function entryCard(e, files, sub) {
        const label = e.is_final ? 'Finalrätsel' : (e.kind === 'raetsel' ? 'Rätsel' : 'Geschichte');
        let answer = '';
        if (e.kind === 'raetsel') {
            answer = sub ? submittedBox(sub) : `
                <form class="answer-box answer-form" data-id="${e.id}">
                    <label for="a-${e.id}" style="margin-top:0">Deine Antwort</label>
                    <div class="inline-form" style="margin-top:0">
                        <input type="text" id="a-${e.id}" maxlength="500" required autocomplete="off">
                        <button class="btn gold" type="submit">Abgeben</button>
                    </div>
                    <p class="hint">Es zählt nur die erste Antwort. Sie kann danach nicht mehr geändert werden.</p>
                </form>`;
        }
        return `
            <article class="card entry" id="e-${e.id}">
                <span class="eyebrow">${label}</span>
                <h2>${esc(e.title)}</h2>
                <div class="meta">${fmtDate(e.release_at)}</div>
                ${renderFiles(files)}
                <div class="entry-body">${renderBody(e.body)}</div>
                ${answer}
            </article>`;
    }

    function submittedBox(sub) {
        let result = '';
        if (sub.is_correct === true) result = '<span class="badge green">Richtig!</span>';
        if (sub.is_correct === false) result = '<span class="badge red">Leider falsch</span>';
        return `
            <div class="answer-box done">
                <div class="row"><strong>Deine Antwort:</strong> ${esc(sub.answer)} ${result}</div>
                <p class="hint">Abgegeben am ${fmtExact(sub.submitted_at || sub.created_at)}</p>
            </div>`;
    }

    async function submitAnswer(e) {
        e.preventDefault();
        const form = e.target;
        const input = form.querySelector('input');
        const answer = input.value.trim();
        if (!answer) return;
        if (!confirm(`Antwort „${answer}“ wirklich abgeben? Sie kann nicht mehr geändert werden.`)) return;

        form.querySelector('button').disabled = true;
        const { data, error } = await sb.rpc('submit_answer', { p_entry_id: form.dataset.id, p_answer: answer });
        if (error) {
            form.querySelector('button').disabled = false;
            return toast(errorText(error), 'error');
        }
        const row = Array.isArray(data) ? data[0] : data;
        form.outerHTML = submittedBox({ answer, submitted_at: row.submitted_at, is_correct: row.is_correct });
        toast('Antwort gespeichert!');
    }

    function startCountdown(ts) {
        clearInterval(countdownTimer);
        const box = document.getElementById('countdown');
        if (!ts) { box.hidden = true; return; }
        const target = new Date(ts).getTime();
        const tick = () => {
            const ms = target - Date.now();
            if (ms <= 0) {
                clearInterval(countdownTimer);
                box.hidden = true;
                // kleine Verzögerung, damit die Server-Uhr sicher weiter ist
                setTimeout(loadEntries, 1500);
                return;
            }
            const s = Math.floor(ms / 1000);
            const d = Math.floor(s / 86400);
            const h = String(Math.floor(s % 86400 / 3600)).padStart(2, '0');
            const m = String(Math.floor(s % 3600 / 60)).padStart(2, '0');
            const sec = String(s % 60).padStart(2, '0');
            document.getElementById('countdownValue').textContent =
                (d > 0 ? `${d} ${d === 1 ? 'Tag' : 'Tagen'} ` : '') + `${h}:${m}:${sec}`;
        };
        box.hidden = false;
        tick();
        countdownTimer = setInterval(tick, 1000);
    }

    sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' && !profile) start();
    });

    start();
})();
