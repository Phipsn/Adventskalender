// Admin-Seite: Rätsel anlegen, Teilnehmer freischalten, Abgaben und Rangliste
(function () {
    const { sb, ready, BUCKET, esc, renderBody, fmtDate, fmtExact, signFiles, renderFiles,
            errorText, toast, sendLoginLink, loadProfile, show } = window.App;

    const $ = id => document.getElementById(id);
    let entries = [];
    let current = null;      // geöffneter Eintrag
    let removedPaths = [];   // Dateien, die beim Speichern gelöscht werden

    if (!ready) { show('setup'); return; }

    // ---------- Anmeldung ----------
    $('loginForm').addEventListener('submit', async e => {
        e.preventDefault();
        try {
            await sendLoginLink($('loginEmail').value.trim());
            toast('Link verschickt! Schau in dein Postfach.');
        } catch (err) { toast(errorText(err), 'error'); }
    });
    $('logoutBtn').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

    let busy = false;
    async function start() {
        if (busy) return;
        busy = true;
        try {
            const profile = await loadProfile();
            if (!profile) return show('login');
            $('userBox').hidden = false;
            $('userName').textContent = profile.display_name || profile.email;
            if (!profile.is_admin) return show('denied');
            show('main');
            await loadEntries();
        } catch (err) {
            toast(errorText(err), 'error');
        } finally {
            busy = false;
        }
    }
    sb.auth.onAuthStateChange(event => { if (event === 'SIGNED_IN') start(); });

    // ---------- Tabs ----------
    $('tabs').addEventListener('click', e => {
        const tab = e.target.dataset.tab;
        if (!tab) return;
        document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        document.querySelectorAll('[data-tab-panel]').forEach(p => { p.hidden = p.dataset.tabPanel !== tab; });
        if (tab === 'teilnehmer') loadUsers();
        if (tab === 'abgaben') loadSubmissionSelect();
        if (tab === 'rangliste') loadRanking();
    });

    // ---------- Rätsel-Liste ----------
    async function loadEntries() {
        const { data, error } = await sb.from('entries').select('*').order('release_at');
        if (error) return toast(errorText(error), 'error');
        entries = data;
        renderEntryList();
    }

    function statusBadge(e) {
        if (!e.published) return '<span class="badge">Entwurf</span>';
        if (new Date(e.release_at) > new Date()) return '<span class="badge gold">geplant</span>';
        return '<span class="badge green">sichtbar</span>';
    }

    function renderEntryList() {
        $('entryList').innerHTML = entries.length ? entries.map(e => `
            <li data-id="${e.id}" class="${current && current.id === e.id ? 'active' : ''}">
                <div class="t">${e.is_final ? '🏆 ' : ''}${esc(e.title)}</div>
                <div class="d">${fmtDate(e.release_at)} ${statusBadge(e)}</div>
            </li>`).join('') : '<li class="muted">Noch keine Einträge</li>';
    }

    $('entryList').addEventListener('click', e => {
        const li = e.target.closest('li[data-id]');
        if (li) openEntry(entries.find(x => x.id === li.dataset.id));
    });

    $('newEntryBtn').addEventListener('click', () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(18, 0, 0, 0);
        openEntry({
            id: crypto.randomUUID(), isNew: true, title: '', kind: 'raetsel', body: '', files: [],
            release_at: d.toISOString(), published: false, is_final: false, reveal_result: false
        });
    });

    function toLocalInput(ts) {
        const d = new Date(ts);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    async function openEntry(entry) {
        current = { ...entry, files: [...(entry.files || [])] };
        removedPaths = [];
        $('noSelection').hidden = true;
        $('entryForm').hidden = false;
        $('formTitle').textContent = entry.isNew ? 'Neuer Eintrag' : 'Eintrag bearbeiten';
        $('deleteBtn').hidden = Boolean(entry.isNew);
        $('f-title').value = entry.title;
        $('f-kind').value = entry.kind;
        $('f-release').value = toLocalInput(entry.release_at);
        $('body').value = entry.body || '';
        $('f-published').checked = entry.published;
        $('f-final').checked = entry.is_final;
        $('f-reveal').checked = entry.reveal_result;
        $('f-solutions').value = '';
        updateKind();
        updatePreview();
        renderEntryList();
        await renderFileList();

        if (!entry.isNew) {
            const { data } = await sb.from('solutions').select('answers').eq('entry_id', entry.id).maybeSingle();
            if (current && current.id === entry.id) $('f-solutions').value = (data ? data.answers : []).join('\n');
        }
        if (window.innerWidth < 860) $('entryForm').scrollIntoView({ behavior: 'smooth' });
    }

    function updateKind() {
        const isRiddle = $('f-kind').value === 'raetsel';
        $('solutionBlock').hidden = !isRiddle;
        $('finalCheck').hidden = !isRiddle;
        $('revealCheck').hidden = !isRiddle;
    }
    $('f-kind').addEventListener('change', updateKind);

    // ---------- Dateien ----------
    async function renderFileList() {
        let signed = [];
        try { signed = await signFiles(current.files); } catch (err) { console.warn(err); }
        $('fileList').innerHTML = signed.map((f, i) => `
            <div class="file-row" data-i="${i}">
                ${(f.type || '').startsWith('image/') && f.url ? `<img src="${esc(f.url)}" alt="">` : '<span style="font-size:32px">📄</span>'}
                <span class="name">${esc(f.name)}</span>
                <button type="button" class="btn small ghost" data-act="up" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="btn small ghost" data-act="down" ${i === signed.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" class="btn small ghost" data-act="remove">Entfernen</button>
            </div>`).join('');
    }

    $('fileList').addEventListener('click', e => {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const i = Number(btn.closest('.file-row').dataset.i);
        const f = current.files;
        if (btn.dataset.act === 'up') [f[i - 1], f[i]] = [f[i], f[i - 1]];
        if (btn.dataset.act === 'down') [f[i + 1], f[i]] = [f[i], f[i + 1]];
        if (btn.dataset.act === 'remove') removedPaths.push(f.splice(i, 1)[0].path);
        renderFileList();
    });

    async function uploadFiles(list) {
        for (const file of list) {
            if (file.size > 50 * 1024 * 1024) { toast(`${file.name} ist größer als 50 MB`, 'error'); continue; }
            const safe = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '_');
            const path = `${current.id}/${Date.now()}-${safe}`;
            toast(`Lade ${file.name} hoch …`);
            const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
            if (error) { toast(errorText(error), 'error'); continue; }
            current.files.push({ path, name: file.name, type: file.type });
        }
        await renderFileList();
        toast('Hochgeladen. Speichern nicht vergessen!');
    }

    const drop = $('drop');
    drop.addEventListener('click', () => $('fileInput').click());
    $('fileInput').addEventListener('change', e => { uploadFiles([...e.target.files]); e.target.value = ''; });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => {
        e.preventDefault();
        drop.classList.remove('over');
        uploadFiles([...e.dataTransfer.files]);
    });

    // ---------- Text-Editor ----------
    function updatePreview() {
        const html = renderBody($('body').value);
        $('preview').innerHTML = html || '<p class="muted">Vorschau</p>';
    }
    $('body').addEventListener('input', updatePreview);

    document.querySelector('.toolbar').addEventListener('click', e => {
        const btn = e.target.closest('button[data-fmt]');
        if (!btn) return;
        const ta = $('body');
        const { selectionStart: s, selectionEnd: en, value: v } = ta;
        const sel = v.slice(s, en) || 'Text';
        const wrap = {
            bold: `**${sel}**`,
            italic: `*${sel}*`,
            h1: `\n\n# ${sel}\n\n`,
            h2: `\n\n## ${sel}\n\n`,
            hr: `\n\n---\n\n`
        }[btn.dataset.fmt];
        ta.value = v.slice(0, s) + wrap + v.slice(en);
        ta.focus();
        updatePreview();
    });

    // ---------- Speichern / Löschen ----------
    $('entryForm').addEventListener('submit', async e => {
        e.preventDefault();
        const kind = $('f-kind').value;
        const row = {
            id: current.id,
            title: $('f-title').value.trim(),
            kind,
            body: $('body').value,
            files: current.files,
            release_at: new Date($('f-release').value).toISOString(),
            published: $('f-published').checked,
            is_final: kind === 'raetsel' && $('f-final').checked,
            reveal_result: kind === 'raetsel' && $('f-reveal').checked
        };
        const answers = $('f-solutions').value.split('\n').map(s => s.trim()).filter(Boolean);
        if (kind === 'raetsel' && row.published && !answers.length) {
            if (!confirm('Für dieses Rätsel ist noch keine Lösung eingetragen. Trotzdem veröffentlichen?')) return;
        }

        const { error } = await sb.from('entries').upsert(row);
        if (error) return toast(errorText(error), 'error');

        if (kind === 'raetsel') {
            const res = await sb.from('solutions').upsert({ entry_id: row.id, answers });
            if (res.error) return toast(errorText(res.error), 'error');
        }
        if (removedPaths.length) {
            await sb.storage.from(BUCKET).remove(removedPaths);
            removedPaths = [];
        }
        current.isNew = false;
        $('deleteBtn').hidden = false;
        $('formTitle').textContent = 'Eintrag bearbeiten';
        toast('Gespeichert');
        await loadEntries();
    });

    $('deleteBtn').addEventListener('click', async () => {
        if (!confirm(`„${current.title}“ wirklich löschen? Alle Abgaben dazu werden ebenfalls gelöscht.`)) return;
        const paths = [...current.files.map(f => f.path), ...removedPaths];
        const { error } = await sb.from('entries').delete().eq('id', current.id);
        if (error) return toast(errorText(error), 'error');
        if (paths.length) await sb.storage.from(BUCKET).remove(paths);
        current = null;
        $('entryForm').hidden = true;
        $('noSelection').hidden = false;
        toast('Gelöscht');
        await loadEntries();
    });

    // ---------- Vorschau als Teilnehmer ----------
    $('previewBtn').addEventListener('click', async () => {
        let files = [];
        try { files = await signFiles(current.files); } catch (err) { console.warn(err); }
        const kind = $('f-kind').value;
        const label = kind === 'raetsel' ? ($('f-final').checked ? 'Finalrätsel' : 'Rätsel') : 'Geschichte';
        $('previewContent').innerHTML = `
            <article class="card entry">
                <span class="eyebrow">${label}</span>
                <h2>${esc($('f-title').value)}</h2>
                <div class="meta">${fmtDate(new Date($('f-release').value))}</div>
                ${renderFiles(files)}
                <div class="entry-body">${renderBody($('body').value)}</div>
                ${kind === 'raetsel' ? `<div class="answer-box"><label style="margin-top:0">Deine Antwort</label>
                    <div class="inline-form" style="margin-top:0"><input type="text" disabled><button class="btn gold" disabled>Abgeben</button></div></div>` : ''}
            </article>`;
        $('previewModal').hidden = false;
    });
    $('closePreview').addEventListener('click', () => { $('previewModal').hidden = true; });

    // ---------- Teilnehmer ----------
    async function loadUsers() {
        const { data, error } = await sb.from('profiles').select('*').order('created_at');
        if (error) return toast(errorText(error), 'error');
        $('userRows').innerHTML = data.map(p => `
            <tr data-id="${p.id}">
                <td>${esc(p.display_name || '–')}</td>
                <td>${esc(p.email)}</td>
                <td class="num">${fmtDate(p.created_at)}</td>
                <td><label class="check" style="margin:0"><input type="checkbox" data-field="approved" ${p.approved ? 'checked' : ''}></label></td>
                <td><label class="check" style="margin:0"><input type="checkbox" data-field="is_admin" ${p.is_admin ? 'checked' : ''}></label></td>
            </tr>`).join('') || '<tr><td colspan="5" class="muted">Noch niemand angemeldet</td></tr>';
    }

    $('userRows').addEventListener('change', async e => {
        const field = e.target.dataset.field;
        if (!field) return;
        const id = e.target.closest('tr').dataset.id;
        const { error } = await sb.from('profiles').update({ [field]: e.target.checked }).eq('id', id);
        if (error) { e.target.checked = !e.target.checked; return toast(errorText(error), 'error'); }
        toast('Gespeichert');
    });

    // ---------- Abgaben ----------
    function loadSubmissionSelect() {
        const riddles = entries.filter(e => e.kind === 'raetsel');
        const prev = $('subEntry').value;
        $('subEntry').innerHTML = riddles.map(e =>
            `<option value="${e.id}">${e.is_final ? '🏆 ' : ''}${esc(e.title)}</option>`).join('');
        if (prev && riddles.some(e => e.id === prev)) $('subEntry').value = prev;
        else {
            const released = riddles.filter(e => new Date(e.release_at) <= new Date());
            if (released.length) $('subEntry').value = released[released.length - 1].id;
        }
        loadSubmissions();
    }
    $('subEntry').addEventListener('change', loadSubmissions);

    async function loadSubmissions() {
        const id = $('subEntry').value;
        if (!id) { $('subRows').innerHTML = '<tr><td colspan="5" class="muted">Noch keine Rätsel</td></tr>'; return; }
        const { data, error } = await sb.from('submissions')
            .select('id,answer,created_at,is_correct,profiles(display_name,email)')
            .eq('entry_id', id).order('created_at');
        if (error) return toast(errorText(error), 'error');
        let rank = 0;
        $('subRows').innerHTML = data.map((s, i) => `
            <tr data-id="${s.id}" class="${s.is_correct && rank === 0 ? 'podium-1' : ''}">
                <td class="num">${s.is_correct ? ++rank + '.' : ''}</td>
                <td>${esc(s.profiles ? (s.profiles.display_name || s.profiles.email) : '?')}</td>
                <td>${esc(s.answer)}</td>
                <td class="num">${fmtExact(s.created_at)}</td>
                <td><label class="check" style="margin:0"><input type="checkbox" ${s.is_correct ? 'checked' : ''}></label></td>
            </tr>`).join('') || '<tr><td colspan="5" class="muted">Noch keine Abgaben</td></tr>';
    }

    $('subRows').addEventListener('change', async e => {
        const id = e.target.closest('tr').dataset.id;
        const { error } = await sb.from('submissions').update({ is_correct: e.target.checked }).eq('id', id);
        if (error) return toast(errorText(error), 'error');
        toast('Bewertung geändert');
        loadSubmissions();
    });

    // ---------- Rangliste ----------
    async function loadRanking() {
        const { data, error } = await sb.rpc('admin_ranking');
        if (error) return toast(errorText(error), 'error');
        $('rankRows').innerHTML = data.map((r, i) => `
            <tr class="${i === 0 && r.final_solved_at && r.all_previous_solved ? 'podium-1' : ''}">
                <td class="num">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1 + '.'}</td>
                <td>${esc(r.display_name || r.email)}</td>
                <td class="num">${r.correct_count}</td>
                <td>${r.all_previous_solved ? '✓' : `${r.correct_count - (r.final_solved_at ? 1 : 0)} von ${r.required_count}`}</td>
                <td class="num">${r.final_solved_at ? fmtExact(r.final_solved_at) : '–'}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="muted">Noch keine Teilnehmer</td></tr>';
    }
    $('rankRefresh').addEventListener('click', loadRanking);

    start();
})();
