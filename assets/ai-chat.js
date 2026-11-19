/* ==========================================================================
   Vertikal AI: floating chat asisten analisis 7 KAIH.
   Komponen terpisah dari dashboard (assets/app.js). Membaca info sumber data
   dashboard dari window.KAIH_DATA_INFO (event "kaih:data") hanya untuk
   mengecek apakah dashboard dan server memakai data yang sama.

   Komunikasi dengan backend lewat window.VertikalAPI (assets/vertikal-api.js).
   ========================================================================== */
(() => {
  'use strict';

  const API = window.VertikalAPI;
  const REMOTE = API.remote;
  const MAX_CHARS = 800;
  const STORE = 'vertikal-ai.log.v1';
  // Saran memakai nama kelas yang benar-benar ada di data dashboard.
  function suggestions() {
    const cls = window.KAIH_DATA_INFO?.classes || [];
    const pair = ['XII', 'XI', 'X'].map((g) => cls.filter((c) => c.grade === g).map((c) => c.name)).find((l) => l.length >= 2) || [];
    return [
      'Bagaimana kondisi sekolah secara keseluruhan?',
      cls.length ? `Bagaimana hasil kelas ${(cls.find((c) => c.grade === 'XII') || cls[0]).name}?` : 'Kelas apa saja yang tersedia?',
      pair.length ? `Bandingkan kelas ${pair[0]} dan ${pair[1]}.` : 'Jenjang mana yang indeksnya paling rendah?',
      'Bagaimana perkembangan tidur cepat dari pengisian pertama sampai terakhir?',
      'Apa penyebab siswa sulit bangun pagi?',
    ];
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const timeNow = () => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const SPARK = '<svg class="vai-spark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path class="s1" d="M10 3.5l1.6 4.3a3 3 0 0 0 1.8 1.8L17.7 11l-4.3 1.6a3 3 0 0 0-1.8 1.8L10 18.7l-1.6-4.3a3 3 0 0 0-1.8-1.8L2.3 11l4.3-1.6a3 3 0 0 0 1.8-1.8z"/><path class="s2" d="M18.5 2.5l.6 1.6a1.2 1.2 0 0 0 .8.8l1.6.6-1.6.6a1.2 1.2 0 0 0-.8.8l-.6 1.6-.6-1.6a1.2 1.2 0 0 0-.8-.8l-1.6-.6 1.6-.6a1.2 1.2 0 0 0 .8-.8z"/><path class="s3" d="M18.5 15.5l.5 1.3a1 1 0 0 0 .7.7l1.3.5-1.3.5a1 1 0 0 0-.7.7l-.5 1.3-.5-1.3a1 1 0 0 0-.7-.7l-1.3-.5 1.3-.5a1 1 0 0 0 .7-.7z"/></svg>';
  const ICON_X = '<svg class="vai-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  /* ---------- DOM ---------- */
  const root = document.createElement('div');
  root.className = 'vai';
  root.innerHTML = `
    <section class="vai-panel" id="vai-panel" role="dialog" aria-modal="false" aria-labelledby="vai-title" aria-hidden="true">
      <header class="vai-head">
        <span class="vai-avatar" aria-hidden="true">${SPARK}</span>
        <div><h2 class="vai-title" id="vai-title">Vertikal AI</h2><p class="vai-sub">Asisten Analisis 7 KAIH</p></div>
        <div class="vai-head-actions">
          <button class="vai-icon-btn" type="button" data-vai-new title="Percakapan baru" aria-label="Percakapan baru"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
          <button class="vai-icon-btn" type="button" data-vai-close title="Tutup" aria-label="Tutup Vertikal AI"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
      </header>
      <p class="vai-notice" data-vai-notice role="status"></p>
      <div class="vai-log" data-vai-log aria-live="polite"></div>
      <form class="vai-form" data-vai-form novalidate>
        <div class="vai-field">
          <textarea class="vai-input" rows="1" maxlength="${MAX_CHARS}" placeholder="Tanyakan tentang data 7 KAIH…" aria-label="Pertanyaan untuk Vertikal AI" data-vai-input></textarea>
          <button class="vai-send" type="submit" aria-label="Kirim" data-vai-send disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button>
        </div>
        <div class="vai-hint"><span>Enter kirim · Shift+Enter baris baru</span><span data-vai-count>0/${MAX_CHARS}</span></div>
      </form>
    </section>
    <button class="vai-fab" type="button" aria-controls="vai-panel" aria-expanded="false" aria-label="Buka Vertikal AI">${SPARK}${ICON_X}</button>`;
  document.body.append(root);

  const $ = (s) => root.querySelector(s);
  const fab = $('.vai-fab');
  const panel = $('.vai-panel');
  const log = $('[data-vai-log]');
  const form = $('[data-vai-form]');
  const input = $('[data-vai-input]');
  const send = $('[data-vai-send]');
  const notice = $('[data-vai-notice]');
  const newBtn = $('[data-vai-new]');

  const state = { open: false, status: null, busy: false, ready: false, history: loadHistory() };

  /* ---------- server ---------- */
  const api = (body) => API.call(body);
  // Login dari dashboard (atau sesi berakhir): muat ulang status saat panel dibuka berikutnya.
  window.addEventListener('vertikal:auth', () => { state.status = null; if (state.open && !state.busy) boot(); });

  /* ---------- sinkron data dashboard vs server ---------- */
  function dashboardInfo() {
    const d = window.KAIH_DATA_INFO;
    if (!d) return null;
    const rounds = {};
    Object.entries(d.rounds).forEach(([id, r]) => { rounds[id] = { fp: r.fp, from: r.from }; });
    return { source: d.source, rounds };
  }
  function renderNotice() {
    const ds = state.status?.dataset;
    if (!ds) { notice.textContent = ''; notice.className = 'vai-notice'; return; }
    const d = window.KAIH_DATA_INFO;
    const ids = [...new Set([...Object.keys(d?.rounds || {}), ...Object.keys(ds.rounds || {})])].map(Number).sort((a, b) => a - b);
    const diff = d ? ids.filter((id) => (d.rounds[id]?.fp || null) !== (ds.rounds[id]?.fp || null)) : [];
    let cls = 'ok'; let text;
    if (ds.mode === 'kosong') { cls = 'warn'; text = ds.source === 'sheet' ? 'Spreadsheet belum bisa dibaca atau belum ada isian. Vertikal AI belum bisa menganalisis.' : 'Server belum punya data (spreadsheet belum tersambung dan data/kuesioner.json belum ada). Vertikal AI belum bisa menganalisis.'; }
    else if (diff.length) {
      cls = 'warn';
      const local = d?.origin === 'upload';
      text = `Dashboard menampilkan data berbeda dari data server${local ? ' (upload lokal di browser ini)' : d?.source === 'sample' ? ' (dashboard memakai data contoh)' : ''}. Jawaban AI memakai data server, bukan angka yang terlihat di dashboard.`;
    } else if (ds.mode === 'simulasi') { cls = 'sim'; text = 'Mode simulasi: AI dan dashboard memakai data contoh yang sama. Angkanya bukan hasil nyata SMA Plus PGRI Cibinong.'; }
    else text = 'AI memakai data server yang sama dengan yang tampil di dashboard.';
    if (state.status && state.status.key_configured === false) { cls = 'warn'; text = 'GEMINI_API_KEY belum diatur di server, jadi Vertikal AI belum bisa menjawab. ' + text; }
    notice.className = `vai-notice ${cls}`;
    notice.textContent = text;
  }
  window.addEventListener('kaih:data', renderNotice);

  /* ---------- markdown aman: escape dulu, lalu format terbatas ---------- */
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  }
  function renderMarkdown(md) {
    const lines = esc(md.replace(/\r/g, '')).split('\n');
    let html = ''; let list = null; let para = [];
    const flushPara = () => { if (para.length) { html += `<p>${inline(para.join('<br>'))}</p>`; para = []; } };
    const flushList = () => { if (list) { html += `</${list}>`; list = null; } };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const t = line.trim();
      if (!t) { flushPara(); flushList(); continue; }
      if (/^\|.*\|$/.test(t) && /^\|?\s*:?-{2,}/.test((lines[i + 1] || '').trim())) {
        flushPara(); flushList();
        const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
        let tbl = `<div class="vai-table"><table><thead><tr>${cells(t).map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>`;
        i += 2;
        while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) { tbl += `<tr>${cells(lines[i]).map((c) => `<td>${c}</td>`).join('')}</tr>`; i++; }
        i--;
        html += tbl + '</tbody></table></div>';
        continue;
      }
      const h = t.match(/^#{1,4}\s+(.*)$/);
      if (h) { flushPara(); flushList(); html += `<h4>${inline(h[1])}</h4>`; continue; }
      const ul = t.match(/^[-*•]\s+(.*)$/);
      const ol = t.match(/^\d+[.)]\s+(.*)$/);
      if (ul || ol) {
        flushPara();
        const kind = ul ? 'ul' : 'ol';
        if (list !== kind) { flushList(); html += `<${kind}>`; list = kind; }
        html += `<li>${inline((ul || ol)[1])}</li>`;
        continue;
      }
      flushList();
      para.push(t);
    }
    flushPara(); flushList();
    return html;
  }

  /* ---------- log percakapan (sessionStorage per tab) ---------- */
  function loadHistory() { try { return JSON.parse(sessionStorage.getItem(STORE)) || []; } catch { return []; } }
  function saveHistory() { try { sessionStorage.setItem(STORE, JSON.stringify(state.history.slice(-40))); } catch { /* abaikan */ } }

  function scrollDown() { requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; }); }
  function addMessage(m, persist = true) {
    const el = document.createElement('div');
    el.className = `vai-msg ${m.role}${m.error ? ' err' : ''}`;
    const body = m.role === 'ai' && !m.error ? renderMarkdown(m.text) : esc(m.text);
    let extra = '';
    if (m.unverified?.length) extra += `<div class="vai-warn">Angka ${m.unverified.map(esc).join(', ')} tidak ditemukan pada hasil perhitungan sistem. Abaikan angka tersebut dan cek di dashboard.</div>`;
    if (m.meta) extra += `<span class="vai-meta">${esc(m.meta)}</span>`;
    el.innerHTML = `<div class="vai-bubble">${body}</div>${extra}<span class="vai-time">${esc(m.time || '')}</span>`;
    log.append(el);
    if (persist) { state.history.push(m); saveHistory(); }
    // Jawaban AI: tampilkan dari awal jawabannya; pesan lain: gulir ke bawah.
    if (m.role === 'ai' && persist) requestAnimationFrame(() => { log.scrollTop = el.offsetTop - log.offsetTop - 12; });
    else scrollDown();
    return el;
  }
  function showWelcome() {
    log.innerHTML = '';
    addMessage({ role: 'ai', text: 'Halo, Bapak/Ibu Guru! Saya **Vertikal AI**. Tanyakan hasil 7 KAIH per kelas, jenjang, kebiasaan, hambatan, atau perkembangan antar pengisian. Semua angka dihitung oleh sistem dari data agregat, tanpa data per siswa.', time: timeNow() }, false);
    const wrap = document.createElement('div');
    wrap.className = 'vai-suggest';
    wrap.innerHTML = suggestions().map((q, i) => `<button type="button" class="vai-chip" style="--i:${i}">${esc(q)}</button>`).join('');
    wrap.addEventListener('click', (e) => { const b = e.target.closest('.vai-chip'); if (b) ask(b.textContent); });
    log.append(wrap);
  }
  function restore() {
    showWelcome();
    state.history.forEach((m) => addMessage(m, false));
  }

  function typing() {
    const el = document.createElement('div');
    el.className = 'vai-msg ai';
    el.innerHTML = '<div class="vai-bubble vai-typing" aria-label="Vertikal AI sedang menyusun jawaban"><span></span><span></span><span></span></div>';
    log.append(el);
    scrollDown();
    return el;
  }

  /* ---------- login ---------- */
  function showLogin(msg) {
    state.ready = false;
    form.hidden = true; newBtn.hidden = true;
    log.innerHTML = `<form class="vai-login" data-vai-login>
      <h3>Masuk dengan kode akses guru</h3>
      <p>Data sekolah hanya bisa dianalisis oleh guru yang berwenang. Minta kode akses ke admin.</p>
      <input type="password" autocomplete="current-password" maxlength="200" placeholder="Kode akses" aria-label="Kode akses guru" required>
      <span class="vai-err" role="alert">${esc(msg || '')}</span>
      <button class="btn btn-primary" type="submit">Masuk</button>
    </form>`;
    const f = log.querySelector('[data-vai-login]');
    const inp = f.querySelector('input');
    setTimeout(() => inp.focus(), 80);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!inp.value) return;
      f.querySelector('button').disabled = true;
      const r = await API.login(inp.value);
      if (r.ok) inp.value = ''; // event vertikal:auth memicu boot()
      else { f.querySelector('.vai-err').textContent = r.error || 'Gagal masuk.'; f.querySelector('button').disabled = false; inp.select(); }
    });
  }
  function showBlocked(text) {
    state.ready = false;
    form.hidden = true; newBtn.hidden = true;
    root.classList.add('is-off');
    log.innerHTML = '';
    addMessage({ role: 'ai', error: true, text, time: timeNow() }, false);
  }

  async function boot() {
    root.classList.remove('is-off');
    const SETUP = 'Admin perlu memasang backend Vertikal AI di Cloudflare Workers, lalu mengisi URL Worker pada <meta name="vertikal-ai-endpoint"> di index.html (panduan: worker/README.md).';
    if (!REMOTE && location.protocol === 'file:') return showBlocked(`Vertikal AI belum tersambung ke backend. ${SETUP}`);
    const s = await api(null);
    if (s.network) return showBlocked(REMOTE ? 'Backend Vertikal AI tidak bisa dihubungi. Periksa URL Worker dan ALLOWED_ORIGINS di Cloudflare (origin halaman ini harus terdaftar).' : 'Server Vertikal AI tidak bisa dihubungi. Pastikan Apache di XAMPP berjalan.');
    if (s.nophp) return showBlocked(`Backend Vertikal AI tidak ditemukan di hosting ini (GitHub Pages tidak menjalankan PHP). ${SETUP}`);
    if (!s.ok) return showBlocked(s.error || 'Vertikal AI belum bisa dipakai.');
    state.status = s;
    if (!s.access_configured) return showBlocked('Akses Vertikal AI belum dikonfigurasi. Admin perlu mengatur VERTIKAL_AI_ACCESS_CODE dan GEMINI_API_KEY di server.');
    if (!s.authed) { renderNotice(); return showLogin(); }
    renderNotice();
    if (s.key_configured === false) root.classList.add('is-off');
    form.hidden = false; newBtn.hidden = false;
    state.ready = true;
    restore();
    updateSend();
    setTimeout(() => input.focus(), 80);
  }

  /* ---------- tanya ---------- */
  async function ask(text) {
    text = text.trim();
    if (!text || state.busy || !state.ready) return;
    state.busy = true;
    log.querySelector('.vai-suggest')?.remove();
    addMessage({ role: 'user', text, time: timeNow() });
    input.value = ''; autosize(); updateSend();
    const t = typing();
    const r = await api({ action: 'ask', message: text, dashboard: dashboardInfo(), conv: API.conv.get() || undefined });
    t.remove();
    if (r.ok) {
      const meta = r.meta || {};
      const src = meta.mode === 'simulasi' ? 'Sumber: data simulasi server' : 'Sumber: data server';
      addMessage({
        role: 'ai', text: r.answer, time: timeNow(), unverified: meta.unverified_numbers || [],
        meta: `${src}${meta.sync && !meta.sync.match ? ' (berbeda dari dashboard)' : ''}${meta.tools?.length ? ` · ${meta.tools.length} perhitungan` : ''}`,
      });
    } else if (r.code === 'auth' || r.status === 401) {
      showLogin('Sesi berakhir. Masukkan kode akses lagi.');
    } else {
      addMessage({ role: 'ai', error: true, text: r.network ? 'Server tidak bisa dihubungi. Coba lagi.' : (r.error || 'Vertikal AI belum bisa menjawab.'), time: timeNow() }, false);
    }
    state.busy = false;
    updateSend();
    if (state.ready) input.focus();
  }

  /* ---------- buka/tutup ---------- */
  function setOpen(open) {
    state.open = open;
    root.classList.toggle('is-open', open);
    fab.setAttribute('aria-expanded', String(open));
    fab.setAttribute('aria-label', open ? 'Tutup Vertikal AI' : 'Buka Vertikal AI');
    panel.setAttribute('aria-hidden', String(!open));
    if (open) {
      if (!state.status) boot();
      else if (state.ready) setTimeout(() => input.focus(), 120);
    } else fab.focus({ preventScroll: true });
  }
  fab.addEventListener('click', () => setOpen(!state.open));
  $('[data-vai-close]').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.open) setOpen(false); });
  newBtn.addEventListener('click', async () => {
    if (state.busy) return;
    await api({ action: 'reset' });
    API.conv.clear();
    state.history = []; saveHistory();
    showWelcome();
    input.focus();
  });

  /* ---------- input ---------- */
  function autosize() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 120)}px`; }
  function updateSend() {
    $('[data-vai-count]').textContent = `${input.value.length}/${MAX_CHARS}`;
    send.disabled = state.busy || !input.value.trim();
  }
  input.addEventListener('input', () => { autosize(); updateSend(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); }
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
})();
