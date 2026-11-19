/* ==========================================================================
   Monitoring 7 KAIH — SMA Plus PGRI Cibinong
   Dashboard analisis Kuesioner Pemantauan Kebiasaan 7 KAIH (11 soal PG),
   dipakai terus-menerus: setiap periode pengisian (tab spreadsheet) menambah
   satu titik pada perkembangan sekolah, jenjang, dan kelas.

   Data asli: Google Spreadsheet lewat backend Vertikal (apps-script/README.md).
   Cadangan: data/kuesioner.json di repo, atau file yang di-upload di halaman
   Laporan dan data. Tanpa itu semua, dashboard memakai data contoh.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
  const avg = (arr) => (arr.length ? arr.reduce((t, x) => t + x, 0) / arr.length : 0);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const nf = (d) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtPct = (v, d = 0) => nf(d).format(v * 100) + '%';
  const fmtNum = (v) => nf(0).format(v);
  const fmtIdx = (v) => nf(1).format(v * 100);
  const fmtPts = (v) => (v > 0.0005 ? '+' : v < -0.0005 ? '−' : '') + nf(1).format(Math.abs(v * 100));
  const fmtDate = (d, o) => d.toLocaleDateString('id-ID', o);
  const fmtTime = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const sameDay = (a, b) => isoDate(a) === isoDate(b);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ------------------------------------------------------------------
     CONFIG (ubah di sini)
     ------------------------------------------------------------------ */
  const CONFIG = {
    // Data cadangan di repo (GitHub Pages), hasil tombol "Simpan untuk GitHub" di halaman Data.
    dataFile: 'data/kuesioner.json',
    // Jumlah kelas per program di tiap jenjang (dipakai bila tab "Master Kelas" belum ada).
    kelas: {
      X: { Internasional: 4, Unggulan: 8, Reguler: 7 },
      XI: { Internasional: 4, Unggulan: 8, Reguler: 10 },
      XII: { Internasional: 4, Unggulan: 8, Reguler: 9 },
    },
    minN: 5,        // kelas dengan responden < minN tidak ditampilkan rinciannya
    target: 0.8,    // target partisipasi
  };

  /* ------------------------------------------------------------------
     Instrumen v4.1
     ------------------------------------------------------------------ */
  const HABITS = [
    { name: 'Bangun pagi', short: 'Bangun', soal: 3, color: '#f5a04a', rule: 'Bangun paling lambat 05.00 WIB',
      q: 'Dalam 3 hari terakhir, berapa hari kamu bangun pagi paling lambat pukul 05.00 WIB?', match: /bangun pagi/i },
    { name: 'Beribadah', short: 'Ibadah', soal: 4, color: '#3fb59a', rule: 'Ibadah wajib atau berdoa',
      q: 'Dalam 3 hari terakhir, berapa hari kamu melaksanakan ibadah wajib atau berdoa sesuai agama atau kepercayaanmu?', match: /ibadah/i },
    { name: 'Olahraga', short: 'Olahraga', soal: 5, color: '#5b9bf5', rule: 'Aktivitas fisik minimal 30 menit',
      q: 'Dalam 3 hari terakhir, berapa hari kamu melakukan olahraga atau aktivitas fisik minimal 30 menit dalam sehari?', match: /olahraga atau aktivitas fisik/i },
    { name: 'Makan sehat', short: 'Makan', soal: 6, color: '#6cbf4f', rule: 'Isi Piringku minimal 1 kali sehari',
      q: 'Dalam 3 hari terakhir, berapa hari kamu makan makanan utama sesuai standar Isi Piringku minimal 1 kali makan dalam sehari?', match: /isi piringku/i },
    { name: 'Gemar belajar', short: 'Belajar', soal: 7, color: '#7c5ce6', rule: 'Belajar mandiri minimal 30 menit',
      q: 'Dalam 3 hari terakhir, berapa hari kamu membaca buku atau belajar hal baru atas kemauan sendiri minimal 30 menit?', match: /membaca buku|belajar hal baru/i },
    { name: 'Bermasyarakat', short: 'Masyarakat', soal: 8, color: '#f27fa2', rule: 'Kegiatan masyarakat atau membantu orang lain',
      q: 'Dalam 3 hari terakhir, berapa hari kamu ikut serta dalam kegiatan masyarakat atau membantu orang lain?', match: /kegiatan masyarakat|membantu orang lain/i },
    { name: 'Tidur cepat', short: 'Tidur', soal: 9, color: '#4b2fb8', rule: 'Tidur paling lambat 22.00 WIB',
      q: 'Dalam 3 hari terakhir, berapa hari kamu tidur malam paling lambat pukul 22.00 WIB?', match: /tidur malam/i },
  ];
  const TIDUR = 6;
  const BARRIERS = [
    { code: 'A', name: 'Tugas sekolah / PR menumpuk', text: 'Tugas sekolah / PR menumpuk' },
    { code: 'B', name: 'Terlalu asyik main HP, game, atau media sosial', text: 'Terlalu asyik main HP, game, atau media sosial' },
    { code: 'C', name: 'Kesibukan ekstrakurikuler / organisasi', text: 'Kesibukan kegiatan ekstrakurikuler / organisasi' },
    { code: 'D', name: 'Jarak / waktu perjalanan rumah-sekolah', text: 'Jarak / waktu perjalanan rumah-sekolah yang jauh' },
    { code: 'E', name: 'Kurang pengingat atau dorongan dari sekitar', text: 'Kurang pengingat atau dorongan dari sekitar' },
    { code: 'F', name: 'Tidak ada hambatan', text: 'Tidak ada hambatan' },
    { code: 'G', name: 'Lainnya', text: 'Lainnya' },
  ];
  const BAR = Object.fromEntries(BARRIERS.map((b) => [b.code, b]));
  const GRADES = ['X', 'XI', 'XII'];
  const PROGRAMS = ['Internasional', 'Unggulan', 'Reguler'];
  // Periode dan kelas yang sedang tampil: satu periode per tab spreadsheet (atau per tab file
  // upload), kelas dari tab "Master Kelas". Diisi oleh applyBridge().
  let ROUNDS = [];
  let ROMBEL = [];
  const DAY_COLORS = ['#ffb3c7', '#ffd6a8', '#c9b8ff', '#6646d6'];
  const DAY_TEXT = ['#2b2350', '#2b2350', '#2b2350', '#ffffff'];
  const NIGHT_COLORS = ['#bfe8d6', '#ffe3a8', '#ffbf9e', '#f58b9b'];

  function gradeOf(s) {
    const m = String(s || '').toUpperCase().match(/\b(XII|XI|X)\b/) || String(s || '').toUpperCase().match(/^(XII|XI|X)(?=[-\s]|$)/);
    return m ? m[1] : null;
  }

  /* ------------------------------------------------------------------
     DATA
     Semua sumber memakai format yang sama dengan apps-script/Code.gs:
       { periode: [{ id, label, mulai, selesai, n, isu }], kelas: [{ kelas, jenjang, jumlah_siswa }],
         baris: [[id periode, kelas, jenjang, "0123012" (Soal 3–9), Soal 10, "AB" (Soal 11)]] }
     Urutan sumber: Google Spreadsheet (setelah login guru) → file upload di browser ini →
     data/kuesioner.json di repo → data contoh.
     Baris bersih: { round, late, grade, rombel, h[7] (0–3), gawai (0–3), bar[kode] }
     ------------------------------------------------------------------ */
  const NOW = new Date();
  const noIssues = () => ({ invalid: 0, conflict: 0, unknownRombel: 0, other: 0 });
  // source: 'sample' | 'real'. origin: 'sheet' | 'upload' | 'repo' | 'sample'.
  const DATA = { rows: [], source: 'sample', origin: 'sample', asOf: NOW, from: {}, issues: noIssues(), live: { state: 'off' }, teacher: false, loginAvailable: false };

  // Daftar kelas bawaan sekolah: setiap jenjang punya kelas Internasional, Unggulan, dan Reguler.
  // Dipakai untuk data contoh; data asli memakai tab "Master Kelas".
  const SCHOOL_CLASSES = GRADES.flatMap((g) => PROGRAMS.flatMap((p) => Array.from({ length: CONFIG.kelas[g][p] || 0 }, (_, i) => `${g} ${p} ${i + 1}`)));
  const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const classKey = (s) => cleanName(s).toUpperCase().replace(/\s*[-–—]\s*/g, '-');

  /* ---------- membaca file isian Form (upload) ---------- */
  function parseCSV(text, delim = ',') {
    const out = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); out.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); out.push(row); }
    return out.filter((r) => r.some((c) => String(c).trim()));
  }
  // Excel Indonesia menyimpan CSV dengan titik koma, dan teks soal sendiri berisi koma.
  // Pilih pemisah yang membuat kolom soal paling banyak dikenali dan jumlah kolom tiap baris sama.
  function tableFromText(text) {
    text = String(text).replace(/^﻿/, '');
    let best = null;
    [',', ';', '\t'].forEach((d) => {
      const t = parseCSV(text, d);
      const even = t.length > 1 ? t.slice(1).filter((r) => r.length === t[0].length).length / (t.length - 1) : 0;
      const score = t.length ? formScore(t[0]) + even : -1;
      if (!best || score > best.score) best = { t, score };
    });
    return best.t;
  }
  const formScore = (head) => HABITS.filter((h) => head.some((c) => h.match.test(String(c)))).length + (head.some((c) => /memakai hp/i.test(String(c))) ? 1 : 0);
  const looksLikeForm = (table) => table.length > 1 && formScore(table[0]) >= 6;

  // Stempel waktu: Date (Excel) atau teks d/m/y maupun m/d/y. Urutan dipilih per file:
  // tafsiran yang membuat rentang tanggal isian paling pendek (satu periode = beberapa hari).
  function parseStamp(s, order) {
    if (s instanceof Date) return isNaN(s) ? null : s;
    const m = String(s ?? '').match(/(\d{1,4})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T,]+(\d{1,2})[:.](\d{2}))?/);
    if (!m) { const d = s === '' || s == null ? null : new Date(s); return d && !isNaN(d) ? d : null; }
    let [, a, b, c, hh, mm] = m.map((x) => Number(x || 0));
    if (a > 999) return new Date(a, b - 1, c, hh, mm);
    if (c < 100) c += 2000;
    return order === 'md' ? new Date(c, a - 1, b, hh, mm) : new Date(c, b - 1, a, hh, mm);
  }
  function stampOrder(values) {
    const span = (o) => {
      const t = values.map((v) => parseStamp(v, o)).filter(Boolean).map((d) => d.getTime());
      return t.length ? Math.max(...t) - Math.min(...t) : 0;
    };
    return span('md') < span('dm') ? 'md' : 'dm';
  }
  const daysOf = (v) => {
    if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 3 ? v : NaN;
    const m = String(v ?? '').match(/[0-3]/);
    return m ? Number(m[0]) : NaN;
  };
  function barrierCodes(cell, isu) {
    let rest = String(cell ?? '');
    const codes = [];
    BARRIERS.forEach((b) => {
      const i = rest.toLowerCase().indexOf(b.text.toLowerCase());
      if (i >= 0) { codes.push(b.code); rest = rest.slice(0, i) + rest.slice(i + b.text.length); }
    });
    if (/[a-z]/i.test(rest.replace(/[,;]/g, ''))) { if (!codes.includes('G')) codes.push('G'); isu.lainnya_teks_bebas++; }
    if (codes.length > 2) isu.hambatan_lebih_dari_2++;
    return codes.join('');
  }

  /* Satu tab/CSV isian Form → satu periode. Sama dengan buildData() di apps-script/Code.gs:
     nama dan email hanya dipakai untuk membuang isian ganda (isian terakhir dipakai), lalu dibuang. */
  function formToPeriod(table, pid, spelling) {
    const head = table[0].map((h) => cleanName(h));
    const find = (re) => head.findIndex((h) => re.test(h));
    const cH = HABITS.map((h) => find(h.match));
    const cG = find(/memakai hp/i);
    const missing = HABITS.filter((h, i) => cH[i] < 0).map((h) => `Soal ${h.soal}`);
    if (cG < 0) missing.push('Soal 10');
    if (missing.length) throw new Error(`kolom ${missing.join(', ')} tidak ditemukan`);
    const cTs = Math.max(0, find(/timestamp|stempel waktu|cap waktu/i));
    const cBar = find(/hambatan/i);
    const cJenjang = find(/jenjang/i);
    const cEmail = find(/e-?mail/i);
    const used = new Set([cJenjang, cBar, cG, ...cH]);
    const cKelas = []; const cNama = [];
    head.forEach((h, i) => {
      if (used.has(i)) return;
      if (/^(kelas|rombel)/i.test(h)) cKelas.push(i);
      else if (/^nama/i.test(h)) cNama.push(i);
    });
    const order = stampOrder(table.slice(1).map((r) => r[cTs]));
    const isu = { total: 0, dibuang_tidak_lengkap: 0, duplikat: 0, tanpa_identitas: 0, hambatan_lebih_dari_2: 0, lainnya_teks_bebas: 0 };
    const latest = new Map(); const noId = [];
    let tsMin = null; let tsMax = null;
    for (const r of table.slice(1)) {
      if (!r.some((c) => c !== '' && c != null)) continue;
      isu.total++;
      let kelas = '';
      for (const i of cKelas) { kelas = cleanName(r[i]); if (kelas) break; }
      kelas = spelling.get(classKey(kelas)) || kelas;
      const jenjang = gradeOf(kelas) || gradeOf(cJenjang >= 0 ? r[cJenjang] : '');
      const h = cH.map((i) => daysOf(r[i]));
      const g = daysOf(r[cG]);
      if (!jenjang || !kelas || h.some(isNaN) || isNaN(g)) { isu.dibuang_tidak_lengkap++; continue; }
      const ts = parseStamp(r[cTs], order);
      if (ts) { if (!tsMin || ts < tsMin) tsMin = ts; if (!tsMax || ts > tsMax) tsMax = ts; }
      const out = [pid, kelas, jenjang, h.join(''), g, barrierCodes(cBar >= 0 ? r[cBar] : '', isu)];
      const email = cEmail >= 0 ? cleanName(r[cEmail]).toLowerCase() : '';
      let nama = '';
      for (const i of cNama) { nama = cleanName(r[i]).toLowerCase(); if (nama) break; }
      const key = email || (nama ? `${classKey(kelas)}|${nama}` : '');
      if (!key) { isu.tanpa_identitas++; noId.push(out); continue; }
      const t = ts ? ts.getTime() : 0;
      const prev = latest.get(key);
      if (prev) { isu.duplikat++; if (t >= prev.t) latest.set(key, { t, row: out }); } else latest.set(key, { t, row: out });
    }
    const rows = [...latest.values()].map((x) => x.row).concat(noId);
    return { rows, mulai: tsMin ? isoDate(tsMin) : null, selesai: tsMax ? isoDate(tsMax) : null, isu };
  }
  // Tab "Master Kelas" (bila ikut di file Excel): kelas, jumlah siswa. Email wali kelas tidak disimpan.
  function masterFromTable(table) {
    const head = table[0].map((h) => String(h).toLowerCase());
    const cK = head.findIndex((h) => /kelas|rombel/.test(h) && !/wali|email/.test(h));
    const cN = head.findIndex((h) => /jumlah|siswa/.test(h));
    if (cK < 0) return null;
    return table.slice(1).map((r) => ({ kelas: cleanName(r[cK]), n: cN >= 0 ? Number(r[cN]) : NaN }))
      .filter((x) => x.kelas).map((x) => ({ kelas: x.kelas, jenjang: gradeOf(x.kelas), jumlah_siswa: x.n > 0 ? x.n : null }));
  }

  let xlsxLib = null;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return (xlsxLib ||= new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => ok(window.XLSX);
      s.onerror = () => { xlsxLib = null; fail(new Error('pembaca Excel gagal dimuat. Cek internet, atau simpan file sebagai CSV')); };
      document.head.append(s);
    }));
  }
  // Hasil: [{ name, table }], satu per tab (CSV = satu tab bernama sesuai file).
  async function readFile(file) {
    if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
      const X = await loadXLSX();
      const wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      return wb.SheetNames.map((name) => ({
        name,
        table: X.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' })
          .filter((r) => r.some((c) => String(c).trim())),
      }));
    }
    return [{ name: file.name.replace(/\.[^.]+$/, ''), table: tableFromText(await file.text()) }];
  }

  /* ---------- data upload: tersimpan di localStorage browser ini (tanpa nama/email) ---------- */
  const STORE_KEY = 'kaih7.periode.v2';
  function readStore() { try { const j = JSON.parse(localStorage.getItem(STORE_KEY)); return j && Array.isArray(j.periode) ? j : null; } catch { return null; } }
  function writeStore(j) { try { if (j) localStorage.setItem(STORE_KEY, JSON.stringify(j)); else localStorage.removeItem(STORE_KEY); return true; } catch { return false; } }
  try { localStorage.removeItem('kaih7.uploads.v1'); } catch { /* format lama (4 kotak) tidak dipakai lagi */ }

  // Periode diurutkan menurut tanggal isian; nomor periode dibuat ulang (1 = paling awal).
  function renumber(j) {
    const order = [...j.periode].sort((a, b) => (a.mulai || '9999').localeCompare(b.mulai || '9999') || String(a.label).localeCompare(String(b.label), 'id', { numeric: true }));
    const map = new Map(order.map((p, i) => [p.id, i + 1]));
    j.periode = order.map((p) => ({ ...p, id: map.get(p.id) }));
    j.baris = j.baris.filter((b) => map.has(b[0])).map((b) => [map.get(b[0]), ...b.slice(1)]);
    return j;
  }
  function classListFrom(rows, master) {
    if (master && master.length) {
      const known = new Set(master.map((m) => m.kelas));
      const extra = [...new Map(rows.filter((b) => !known.has(b[1])).map((b) => [b[1], b[2]]))].map(([kelas, jenjang]) => ({ kelas, jenjang, jumlah_siswa: null, di_luar_master: true }));
      return [...master, ...extra];
    }
    return [...new Map(rows.map((b) => [b[1], b[2]]))].map(([kelas, jenjang]) => ({ kelas, jenjang, jumlah_siswa: null }));
  }

  async function handleUpload(file) {
    const box = $('[data-source-panel]');
    box?.classList.add('busy');
    try {
      const tabs = await readFile(file);
      const masterTab = tabs.find((t) => /master\s*kelas/i.test(t.name));
      const forms = tabs.filter((t) => t !== masterTab && looksLikeForm(t.table));
      if (!forms.length) throw new Error('isian Form 7 KAIH tidak ditemukan. Pastikan baris pertama berisi teks soal');
      const store = readStore() || { periode: [], kelas: [], baris: [], master_kelas: false };
      const master = masterTab ? masterFromTable(masterTab.table) : (store.master_kelas ? store.kelas.filter((k) => !k.di_luar_master) : null);
      // Ejaan nama kelas mengikuti Master Kelas (sama dengan Apps Script).
      const spelling = new Map((master || []).map((m) => [classKey(m.kelas), m.kelas]));
      const added = [];
      forms.forEach((t, k) => {
        // Tab dengan nama yang sama menggantikan periode lama (mis. setelah ada isian susulan).
        const old = store.periode.find((p) => p.label === t.name);
        if (old) { store.periode = store.periode.filter((p) => p !== old); store.baris = store.baris.filter((b) => b[0] !== old.id); }
        const id = 100000 + k;
        const p = formToPeriod(t.table, id, spelling);
        if (!p.rows.length) return;
        store.periode.push({ id, label: t.name, mulai: p.mulai, selesai: p.selesai, n: p.rows.length, isu: p.isu });
        store.baris.push(...p.rows);
        added.push(`${t.name} (${fmtNum(p.rows.length)})`);
      });
      if (!added.length) throw new Error('tidak ada baris isian yang lengkap');
      renumber(store);
      store.master_kelas = !!(master && master.length);
      store.kelas = classListFrom(store.baris, master);
      store.dibuat = new Date().toISOString();
      if (!writeStore(store)) throw new Error('penyimpanan browser penuh');
      await reload(Math.max(...store.periode.map((p) => p.id)));
      toast(`${added.length} periode masuk: ${added.join(', ')}.`);
    } catch (err) {
      toast(`Gagal membaca ${file.name}: ${err.message}.`);
    } finally {
      box?.classList.remove('busy');
    }
  }
  async function deleteUploadPeriod(id) {
    const store = readStore();
    const p = store?.periode.find((x) => x.id === id);
    if (!p || !confirm(`Hapus periode "${p.label}" dari data upload di browser ini?`)) return;
    store.periode = store.periode.filter((x) => x.id !== id);
    store.baris = store.baris.filter((b) => b[0] !== id);
    writeStore(store.periode.length ? renumber(store) : null);
    await reload();
    toast(`Periode "${p.label}" dihapus.`);
  }
  async function clearUploads() {
    if (!readStore() || !confirm('Hapus semua data upload dari browser ini?')) return;
    writeStore(null);
    await reload();
    toast('Data upload dihapus.');
  }
  // File untuk folder data/ di GitHub: format sama, tanpa nama/email.
  function exportForRepo() {
    const store = readStore(); if (!store) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(store)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'kuesioner.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast(`kuesioner.json diunduh. Unggah ke folder ${CONFIG.dataFile.split('/')[0]}/ di repo GitHub.`);
  }

  /* ---------- sumber data ---------- */
  // Google Spreadsheet lewat backend Vertikal (apps-script/Code.gs). Butuh login guru.
  // DATA.live.state: off (tidak dipakai) | nobackend (server tanpa PHP) | login (perlu masuk) | error | on
  async function loadLive() {
    const api = window.VertikalAPI;
    DATA.live = { state: 'off' };
    if (!api) return null;
    // Backend PHP lokal tapi halaman dibuka tanpa Apache (file:// atau Live Server VS Code).
    if (!api.available) { if (!api.remote) DATA.live = { state: 'nobackend' }; return null; }
    const st = await api.call(null);
    if (!api.remote && (st.nophp || st.network)) { DATA.live = { state: 'nobackend' }; return null; }
    DATA.teacher = !!(st.ok && st.authed);
    DATA.loginAvailable = !!(st.ok && st.access_configured);
    if (!st.ok || !st.sheet) return null;
    // Tanpa login guru: tampilan publik (data asli tingkat sekolah dan jenjang, tanpa rincian kelas).
    const d = await api.call({ action: st.authed ? 'data' : 'public' });
    if (!d.ok || !['sheet', 'public'].includes(d.source)) { DATA.live = { state: 'error', error: d.error || 'Spreadsheet belum bisa dibaca.' }; return null; }
    DATA.live = { state: d.source === 'sheet' ? 'on' : 'public' };
    return d;
  }
  // Tampilan publik: halaman per kelas, filter kelas, unduhan, upload, dan Vertikal AI khusus guru.
  const isPublic = () => DATA.origin === 'public';
  async function fetchRepoData() {
    if (!CONFIG.dataFile || location.protocol === 'file:') return null;
    try {
      const res = await fetch(CONFIG.dataFile, { cache: 'no-store' });
      const j = res.ok ? await res.json() : null;
      return j && Array.isArray(j.periode) && Array.isArray(j.baris) ? j : null;
    } catch { return null; }
  }

  function applyBridge(d, origin) {
    const day = (s) => (s ? new Date(`${s}T00:00:00`) : null);
    ROUNDS = (d.periode || []).map((p) => ({ id: Number(p.id), label: String(p.label), main: day(p.mulai), makeup: day(p.selesai), isu: p.isu || null }))
      .filter((r) => r.id > 0).sort((a, b) => a.id - b.id);
    const kelas = d.kelas && d.kelas.length ? d.kelas : classListFrom(d.baris || [], null);
    ROMBEL = kelas.map((k) => ({ name: String(k.kelas), size: k.jumlah_siswa > 0 ? k.jumlah_siswa : null, grade: k.jenjang || gradeOf(k.kelas), outside: !!k.di_luar_master }));
    const rows = [];
    for (const b of d.baris || []) {
      const grade = gradeOf(b[2]) || gradeOf(b[1]);
      if (!/^[0-3]{7}$/.test(String(b[3])) || ![0, 1, 2, 3].includes(Number(b[4])) || !grade) { DATA.issues.invalid++; continue; }
      rows.push({ round: Number(b[0]), late: false, grade, rombel: String(b[1]), h: String(b[3]).split('').map(Number), gawai: Number(b[4]), bar: String(b[5]).split('').filter((c) => BAR[c]) });
    }
    DATA.rows = cleanRows(rows);
    DATA.origin = origin;
    DATA.source = origin === 'sample' ? 'sample' : 'real';
    DATA.master = !!d.master_kelas;
    DATA.asOf = d.dibuat ? new Date(d.dibuat) : NOW;
    ROUNDS.forEach((r) => { DATA.from[r.id] = origin; });
  }

  async function loadAll() {
    DATA.issues = noIssues(); DATA.from = {};
    const live = await loadLive();
    if (live && !(live.periode || []).length) DATA.live = { state: 'error', error: 'spreadsheet belum berisi tab isian' };
    if (live && ['on', 'public'].includes(DATA.live.state)) applyBridge(live, DATA.live.state === 'on' ? 'sheet' : 'public');
    else {
      const store = readStore();
      const repo = store ? null : await fetchRepoData();
      if (store) applyBridge(store, 'upload');
      else if (repo) applyBridge(repo, 'repo');
      else applyBridge(sampleData(), 'sample');
    }
    cache.clear();
    const note = { sheet: 'Tersambung ke Google Spreadsheet', public: 'Data sekolah terbaru', upload: 'Data upload di browser ini', repo: 'Data dari repo', sample: 'Menampilkan data contoh' };
    $('[data-source-note]').textContent = note[DATA.origin];
    updateTeacherUi();
    publishDataInfo();
  }

  // Sidik jari per periode (FNV-1a 32-bit atas baris bersih yang diurutkan), sama dengan
  // kaih_fingerprint() di api/data-service.php. Dipakai Vertikal AI untuk mengecek apakah
  // dashboard dan server memakai data yang sama, tanpa mengirim data mentah.
  function fingerprint(rows) {
    if (!rows.length) return null;
    const lines = rows.map((r) => `${r.grade}|${r.rombel}|${r.h.join('')}|${r.gawai}|${[...r.bar].sort().join('')}|${r.late ? 1 : 0}`).sort();
    const bytes = new TextEncoder().encode(lines.join('\n'));
    let h = 0x811c9dc5;
    for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  function publishDataInfo() {
    const rounds = {};
    ROUNDS.forEach((r) => {
      const rows = DATA.rows.filter((x) => x.round === r.id);
      rounds[r.id] = { n: rows.length, from: DATA.from[r.id] || null, fp: fingerprint(rows), label: r.label };
    });
    window.KAIH_DATA_INFO = { source: DATA.source, origin: DATA.origin, rounds, classes: ROMBEL.map((rb) => ({ name: rb.name, grade: rb.grade })) };
    window.dispatchEvent(new CustomEvent('kaih:data', { detail: window.KAIH_DATA_INFO }));
  }

  /* DATA CONTOH: semua kelas sekolah, pengisian mingguan, kebiasaan saling terkait seperti data nyata.
     Format sama dengan data asli; data/simulasi/kuesioner.json dibuat dari fungsi ini. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function sampleData() {
    const rng = mulberry32(20261116);
    const pick = (w) => { const e = Object.entries(w); let t = rng() * sum(e, (x) => x[1]); for (const [k, v] of e) if ((t -= v) <= 0) return k; return e[0][0]; };
    const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const periode = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(2026, 8, 21 + i * 7);
      const e = new Date(d); e.setDate(d.getDate() + 2);
      return { id: i + 1, label: `${d.getDate()} ${MONTHS[d.getMonth()]}`, mulai: isoDate(d), selesai: isoDate(e) };
    });
    const base = [0.72, 0.88, 0.47, 0.64, 0.5, 0.49, 0.5];
    const gradeAdj = { X: 0.04, XI: 0, XII: -0.06 };
    const progAdj = { Internasional: 0.04, Unggulan: 0.03, Reguler: -0.03 };
    const kelas = []; const baris = [];
    SCHOOL_CLASSES.forEach((name) => {
      const grade = gradeOf(name); const prog = PROGRAMS.find((p) => name.includes(p));
      const size = 28 + Math.floor(rng() * 9);
      kelas.push({ kelas: name, jenjang: grade, jumlah_siswa: size });
      const off = (rng() - 0.5) * 0.12 + progAdj[prog];
      const part = clamp(0.7 + (rng() - 0.5) * 0.3 - (grade === 'XII' ? 0.08 : 0), 0.35, 0.95);
      const kids = Array.from({ length: size }, () => ({ trait: (rng() - 0.5) * 0.32, phone: rng(), eager: rng() }));
      periode.forEach((p, ri) => {
        kids.forEach((k) => {
          // Partisipasi pelan-pelan turun, kebiasaan pelan-pelan membaik.
          if (rng() > clamp(part + (k.eager - 0.5) * 0.35 - ri * 0.025, 0.05, 0.99)) return;
          const gawai = clamp(Math.floor(k.phone * 3.6 + (rng() - 0.5) * 1.5 - ri * 0.05 + (grade === 'XII' ? 0.45 : 0)), 0, 3);
          const h = base.map((q0, i) => {
            let q = q0 + gradeAdj[grade] + off + k.trait + ri * 0.012;
            if (i === TIDUR) q += 0.16 - gawai * 0.14;
            q = clamp(q, 0.03, 0.97);
            return (rng() < q) + (rng() < q) + (rng() < q);
          });
          let bar;
          if (rng() < 0.03 + (avg(h) / 3) * 0.16) bar = 'F';
          else {
            const w = { A: 0.3 + (grade === 'XII' ? 0.22 : 0), B: 0.1 + gawai * 0.13, C: 0.14, D: 0.09, E: 0.14, G: 0.025 };
            const first = pick(w); delete w[first];
            bar = rng() < 0.55 ? first + pick(w) : first;
            if (rng() < 0.025) bar += 'F'; // isian bertentangan, dibersihkan nanti
          }
          baris.push([p.id, name, grade, h.join(''), gawai, bar]);
        });
      });
    });
    periode.forEach((p) => { p.n = baris.filter((b) => b[0] === p.id).length; });
    return { periode, kelas, master_kelas: true, baris, dibuat: '2026-11-16T07:00:00.000Z' };
  }

  // Pembersihan sesuai catatan Form: "Tidak ada hambatan" bersama pilihan lain dicatat lalu dibuang.
  function cleanRows(rows) {
    rows.forEach((r) => {
      if (r.bar.includes('F') && r.bar.length > 1) { r.bar = r.bar.filter((c) => c !== 'F'); DATA.issues.conflict++; }
      if (!knownRombel(r.rombel)) { DATA.issues.unknownRombel++; }
    });
    return rows;
  }

  /* ------------------------------------------------------------------
     Agregasi
     ------------------------------------------------------------------ */
  function stats(rows) {
    const n = rows.length;
    const dist = HABITS.map(() => [0, 0, 0, 0]);
    const gawai = [0, 0, 0, 0];
    const bars = Object.fromEntries(BARRIERS.map((b) => [b.code, 0]));
    const consHist = Array(8).fill(0);
    let consSum = 0; let late = 0;
    rows.forEach((r) => {
      r.h.forEach((v, i) => dist[i][v]++);
      gawai[r.gawai]++;
      r.bar.forEach((c) => bars[c]++);
      const c = r.h.filter((v) => v === 3).length;
      consHist[c]++; consSum += c;
      if (r.late) late++;
    });
    const index = dist.map((d) => (n ? (d[1] + 2 * d[2] + 3 * d[3]) / (3 * n) : 0));
    const cons = dist.map((d) => (n ? d[3] / n : 0));
    return {
      n, late, dist, index, cons, consHist, gawai, bars,
      overall: avg(index),
      consOverall: avg(cons),
      consAvg: n ? consSum / n : 0,
      all7: n ? consHist[7] / n : 0,
      gawaiRisk: n ? (gawai[2] + gawai[3]) / n : 0,
    };
  }

  const cache = new Map();
  const scopeOk = (r, grade) => grade === 'all' || r.grade === grade;
  // Tanpa argumen jenjang = cakupan filter aktif (jenjang, dan satu kelas bila dipilih).
  const inScope = (r, grade) => (grade === undefined ? scopeOk(r, state.grade) && (!state.kelas || r.rombel === state.kelas) : scopeOk(r, grade));
  const rowsOf = (round, grade) => DATA.rows.filter((r) => r.round === round && inScope(r, grade));
  function statsOf(round, grade) {
    const k = `${round}|${grade ?? `${state.grade}|${state.kelas || ''}`}`;
    if (!cache.has(k)) cache.set(k, stats(rowsOf(round, grade)));
    return cache.get(k);
  }
  function statsRombel(round, name) {
    const k = `${round}|rb:${name}`;
    if (!cache.has(k)) cache.set(k, stats(DATA.rows.filter((r) => r.round === round && r.rombel === name)));
    return cache.get(k);
  }
  const rombelScope = () => ROMBEL.filter((rb) => scopeOk(rb, state.grade) && (!state.kelas || rb.name === state.kelas));
  // Jumlah siswa (data TU); null bila ada kelas di cakupan yang jumlahnya belum diisi.
  const popOf = (grade) => {
    const list = grade === undefined ? rombelScope() : ROMBEL.filter((rb) => scopeOk(rb, grade));
    if (!list.length || list.some((rb) => !rb.size)) return null;
    return sum(list, (rb) => rb.size);
  };
  const partOf = (n, pop) => (pop ? n / pop : null);
  const fmtPart = (v, d = 0) => (v === null ? '–' : fmtPct(v, d));
  const knownRombel = (name) => ROMBEL.some((rb) => rb.name === name);
  const roundById = (id) => ROUNDS.find((r) => r.id === id) || ROUNDS[0];
  const roundsWithData = () => ROUNDS.filter((r) => DATA.rows.some((x) => x.round === r.id));
  const prevRoundId = () => roundsWithData().map((r) => r.id).filter((id) => id < state.round).pop() ?? null;
  const scopeName = (g) => (g === undefined && state.kelas ? `kelas ${state.kelas}` : (g ?? state.grade) === 'all' ? 'semua jenjang' : `kelas ${g ?? state.grade}`);
  const idxRow = (r) => avg(r.h) / 3;

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  const state = {
    route: null,
    grade: 'all',
    round: 1,
    habit: null,
    compare: false,
    metric: 'index',
    focus: null,
    sort: { key: 'index', dir: 'desc' },
  };

  /* ------------------------------------------------------------------
     Motion helpers
     ------------------------------------------------------------------ */
  function countTo(el, v, fmt) {
    if (!el) return;
    const token = (el._count = (el._count || 0) + 1);
    if (reduceMotion.matches) { el.textContent = fmt(v); return; }
    const t0 = performance.now() + 250;
    const tick = (t) => {
      if (el._count !== token) return;
      const p = clamp((t - t0) / 1000, 0, 1);
      el.textContent = fmt(v * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const trendTag = (d, label, invert = false) => {
    const good = invert ? d < 0 : d > 0;
    const cls = Math.abs(d) < 0.0005 ? '' : good ? 'up' : 'down';
    return `<b class="${cls}">${fmtPts(d)} poin</b> ${label}`;
  };
  function sparkPath(values) {
    if (!values.length) return '';
    const s = values.length === 1 ? [values[0], values[0]] : values;
    const lo = Math.min(...s), hi = Math.max(...s), span = hi - lo || 1;
    return s.map((v, i) => `${i ? 'L' : 'M'}${((i / (s.length - 1)) * 100).toFixed(1)} ${(29 - ((v - lo) / span) * 26).toFixed(1)}`).join(' ');
  }
  const replay = (el) => { if (!el) return; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; };

  /* ------------------------------------------------------------------
     Chart building blocks (HTML for bars, SVG for lines and donuts)
     ------------------------------------------------------------------ */
  function stackBar(counts, colors, textColors, names, i = 0) {
    const n = sum(counts, (c) => c) || 1;
    return `<div class="stack" style="--i:${i}">${counts.map((c, k) => {
      const p = (c / n) * 100;
      if (!c) return '';
      return `<span class="seg" style="--w:${p.toFixed(2)}%;--c:${colors[k]};--t:${textColors[k]}" data-tip="${esc(names[k])}: ${fmtPct(c / n, 1)} (${fmtNum(c)} siswa)">${p >= 11 ? Math.round(p) + '%' : ''}</span>`;
    }).join('')}</div>`;
  }
  function legend(el, names, colors) {
    el.innerHTML = names.map((n, k) => `<li><span class="dot" style="--c:${colors[k]}"></span>${n}</li>`).join('');
  }
  function hrow({ label, sub = '', value, frac, color = 'var(--amber)', tip = '', target = null, i = 0, cls = '' }) {
    return `<div class="hrow ${cls}" style="--i:${i}">
      <span class="hrow-label">${label}${sub ? `<small>${sub}</small>` : ''}</span>
      <div class="hrow-track"${target !== null ? ` style="--target:${(target * 100).toFixed(1)}%"` : ''}>
        <div class="hrow-fill" style="--w:${(clamp(frac, 0, 1) * 100).toFixed(2)}%;--c:${color}"${tip ? ` data-tip="${esc(tip)}"` : ''}></div>
      </div>
      <span class="hrow-val num">${value}</span>
    </div>`;
  }
  function col({ label, sub = '', value, segs, max = 1, target = null, i = 0, tip = '' }) {
    const total = sum(segs, (s) => s.v);
    return `<div class="col" style="--i:${i}">
      <div class="col-track"${target !== null ? ` style="--target:${((target / max) * 100).toFixed(1)}%"` : ''}>
        <div class="col-bar" style="--h:${((total / max) * 100).toFixed(2)}%"${tip ? ` data-tip="${esc(tip)}"` : ''}>
          <span class="col-val num">${value}</span>
          ${segs.map((s) => `<span class="col-seg" style="--f:${total ? s.v / total : 0};--c:${s.c}"></span>`).join('')}
        </div>
      </div>
      <span class="col-label">${label}${sub ? `<small>${sub}</small>` : ''}</span>
    </div>`;
  }
  function donut(counts, colors) {
    const n = sum(counts, (c) => c) || 1;
    let off = 0;
    const segs = counts.map((c, k) => {
      const p = (c / n) * 100;
      const el = `<circle class="donut-seg" cx="60" cy="60" r="46" pathLength="100" transform="rotate(-90 60 60)"
        style="--i:${k};stroke:${colors[k]};stroke-dasharray:${p.toFixed(2)} ${(100 - p).toFixed(2)};stroke-dashoffset:${(-off).toFixed(2)}"/>`;
      off += p;
      return el;
    }).join('');
    return `<svg class="donut" viewBox="0 0 120 120" aria-hidden="true"><circle class="donut-track" cx="60" cy="60" r="46"/>${segs}</svg>`;
  }
  const heatAlpha = (v, lo = 0.3, hi = 0.95) => clamp((v - lo) / (hi - lo), 0.04, 1);
  const heatCell = (v, tip, i, extra = '') => {
    const a = heatAlpha(v);
    return `<td class="heat num${a > 0.36 ? ' on-light' : ''}${extra}" style="--a:${a.toFixed(3)};--i:${i}" data-tip="${esc(tip)}">${nf(0).format(v * 100)}</td>`;
  };

  /* Line chart: series = [{ name, color, values[], width, area, dim, dash }] */
  let uid = 0;
  function lineChart(wrap, opt) {
    const svg = $('svg', wrap);
    const W = Math.max(280, wrap.clientWidth);
    const H = opt.height || 280;
    const pad = { l: 44, r: 24, t: 18, b: 44 };
    const n = opt.labels.length;
    const x = (i) => (n === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i * (W - pad.l - pad.r)) / (n - 1));
    const y = (v) => pad.t + (1 - (v - opt.lo) / (opt.hi - opt.lo)) * (H - pad.t - pad.b);
    const id = `lc${++uid}`;
    let out = '<defs>';
    opt.series.forEach((s, k) => {
      if (s.area) out += `<linearGradient id="${id}-a${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity="0.3"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;
    });
    out += '</defs>';
    for (let k = 0; k <= 4; k++) {
      const t = opt.lo + ((opt.hi - opt.lo) * k) / 4;
      out += `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/>`;
      out += `<text class="axis-text" x="${pad.l - 10}" y="${y(t) + 4}" text-anchor="end">${opt.fmtAxis(t)}</text>`;
    }
    // Banyak periode di ruang sempit: tampilkan sebagian label saja (pertama, terakhir, dan selang tetap).
    const gap = n > 1 ? (W - pad.l - pad.r) / (n - 1) : W;
    const minGap = Math.max(...opt.labels.map((l) => String(l[0]).length)) * 7 + 20; // perkiraan lebar label + jarak
    const every = Math.max(1, Math.ceil(minGap / gap));
    const shown = new Set();
    for (let i = 0; i < n; i += every) shown.add(i);
    if (!shown.has(n - 1)) {
      const lastShown = Math.max(...shown);
      if ((n - 1 - lastShown) * gap < minGap) shown.delete(lastShown);
      shown.add(n - 1);
    }
    opt.labels.forEach((l, i) => {
      if (!shown.has(i)) return;
      const anchor = every > 1 && i === 0 ? 'start' : every > 1 && i === n - 1 ? 'end' : 'middle';
      out += `<text class="axis-text axis-x" x="${x(i)}" y="${H - 22}" text-anchor="${anchor}">${esc(l[0])}</text>`;
      if (l[1] && every === 1) out += `<text class="axis-text axis-sub" x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(l[1])}</text>`;
    });
    opt.series.forEach((s, k) => {
      const pts = s.values.map((v, i) => (v === null || v === undefined ? null : [x(i), y(v)]));
      const segs = []; let cur = [];
      pts.forEach((p) => { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } });
      if (cur.length) segs.push(cur);
      segs.forEach((sg) => {
        const d = sg.map((p, j) => `${j ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        if (s.area && sg.length > 1) out += `<path class="area${s.dim ? ' is-dim' : ''}" style="--i:${k}" fill="url(#${id}-a${k})" d="${d} L${sg[sg.length - 1][0].toFixed(1)},${y(opt.lo)} L${sg[0][0].toFixed(1)},${y(opt.lo)} Z"/>`;
        out += `<path class="ln${s.dash ? ' ln-dash' : ''}${s.dim ? ' is-dim' : ''}" pathLength="1" style="--i:${k};stroke:${s.color};stroke-width:${s.width || 2.5}" d="${d}"/>`;
      });
      pts.forEach((p, i) => {
        if (!p) return;
        out += `<circle class="pt${s.dim ? ' is-dim' : ''}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${s.width > 3 ? 5.5 : 4}" style="--i:${k};--j:${i};stroke:${s.color}"/>`;
        if (s.labels) out += `<text class="pt-label" x="${p[0].toFixed(1)}" y="${(p[1] + (s.below ? 22 : -13)).toFixed(1)}" text-anchor="middle" style="--j:${i}">${opt.fmt(s.values[i])}</text>`;
      });
    });
    out += `<line class="cursor-line" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>`;
    out += `<rect class="hover-layer" x="${pad.l - 20}" y="${pad.t}" width="${W - pad.l - pad.r + 40}" height="${H - pad.t - pad.b}"/>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.height = `${H}px`;
    svg.innerHTML = out;
    wrap._g = { opt, x, y, W, n };

    if (!wrap._bound) {
      wrap._bound = true;
      svg.addEventListener('pointermove', (e) => {
        if (!e.target.classList.contains('hover-layer')) return;
        const g = wrap._g; const r = svg.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * g.W;
        let best = 0; for (let i = 1; i < g.n; i++) if (Math.abs(g.x(i) - px) < Math.abs(g.x(best) - px)) best = i;
        showPoint(wrap, best);
      });
      svg.addEventListener('pointerleave', () => { if (document.activeElement !== wrap) hidePoint(wrap); });
      if (wrap.tabIndex >= 0) {
        wrap.addEventListener('focus', () => showPoint(wrap, wrap._g.n - 1));
        wrap.addEventListener('blur', () => hidePoint(wrap));
        wrap.addEventListener('keydown', (e) => {
          const g = wrap._g; let i = wrap._i ?? g.n - 1;
          if (e.key === 'ArrowLeft') i--; else if (e.key === 'ArrowRight') i++; else return;
          e.preventDefault(); showPoint(wrap, clamp(i, 0, g.n - 1));
        });
      }
    }
  }
  function showPoint(wrap, i) {
    const g = wrap._g; wrap._i = i;
    const line = $('.cursor-line', wrap);
    line.setAttribute('x1', g.x(i)); line.setAttribute('x2', g.x(i)); line.setAttribute('visibility', 'visible');
    $$('.pt', wrap).forEach((p) => p.classList.toggle('is-hot', Number(p.style.getPropertyValue('--j')) === i));
    const tip = $('.chart-tip', wrap);
    const rows = g.opt.series.filter((s) => !s.dim && s.values[i] !== null && s.values[i] !== undefined);
    tip.innerHTML = `<strong>${esc(g.opt.labels[i].join(' · '))}</strong>` +
      (rows.length ? rows.map((s) => `<p><span><i style="background:${s.color}"></i>${esc(s.name)}</span><b class="num">${g.opt.fmt(s.values[i])}</b></p>`).join('') : '<p>Belum ada data</p>');
    tip.hidden = false;
    const scale = wrap.clientWidth / g.W;
    const tw = tip.offsetWidth;
    tip.style.left = `${clamp(g.x(i) * scale - tw / 2, 0, wrap.clientWidth - tw)}px`;
    const top = Math.min(...rows.map((s) => g.y(s.values[i])), 200);
    tip.style.top = `${Math.max(0, top - tip.offsetHeight - 16)}px`;
  }
  function hidePoint(wrap) {
    const tip = $('.chart-tip', wrap); if (tip) tip.hidden = true;
    $('.cursor-line', wrap)?.setAttribute('visibility', 'hidden');
    $$('.pt.is-hot', wrap).forEach((p) => p.classList.remove('is-hot'));
    wrap._i = null;
  }
  // Nama periode = nama tab spreadsheet, mis. "7 November".
  const rLabel = (r) => r.label;
  // Rentang tanggal periode, mis. "9–11 Nov".
  function rRange(r) {
    if (!r.main) return '';
    const end = r.makeup && !sameDay(r.main, r.makeup) ? r.makeup : null;
    if (!end) return fmtDate(r.main, { day: 'numeric', month: 'short' });
    return r.main.getMonth() === end.getMonth()
      ? `${r.main.getDate()}–${fmtDate(end, { day: 'numeric', month: 'short' })}`
      : `${fmtDate(r.main, { day: 'numeric', month: 'short' })}–${fmtDate(end, { day: 'numeric', month: 'short' })}`;
  }
  // Label sumbu grafik: nama periode dan tanggal isian.
  const roundLabels = (rounds = ROUNDS) => rounds.map((r) => [rLabel(r), rRange(r)]);
  const shortLabel = (r) => (r.main ? fmtDate(r.main, { day: 'numeric', month: 'short' }) : r.label);

  /* ------------------------------------------------------------------
     Rosette: tujuh kelopak, searah jarum jam dari pagi hingga malam
     ------------------------------------------------------------------ */
  const R = 140;
  const CORE = 46;
  const STEP = 360 / 7;
  const polar = (r, deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
  };
  const PETAL_D = `M0 0 C ${-R * 0.3} ${-R * 0.26}, ${-R * 0.3} ${-R * 0.74}, 0 ${-R} C ${R * 0.3} ${-R * 0.74}, ${R * 0.3} ${-R * 0.26}, 0 0Z`;

  function buildRosette() {
    const svg = $('#rosette');
    const half = (STEP / 2) * (Math.PI / 180);
    const hr = R + 26;
    const hx = Math.sin(half) * hr;
    const hy = -Math.cos(half) * hr;
    let out = `
      <defs>
        <linearGradient id="petal-fill" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style="stop-color:var(--caramel);stop-opacity:0.2"/>
          <stop offset="0.55" style="stop-color:var(--amber-deep);stop-opacity:0.62"/>
          <stop offset="1" style="stop-color:var(--amber);stop-opacity:0.95"/>
        </linearGradient>
        <linearGradient id="petal-fill-on" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style="stop-color:var(--amber);stop-opacity:0.38"/>
          <stop offset="1" style="stop-color:var(--amber-light);stop-opacity:1"/>
        </linearGradient>
      </defs>`;
    [0.25, 0.5, 0.75, 1].forEach((f) => { out += `<circle class="ring${f === 1 ? ' ring-outer' : ''}" r="${R * f}"/>`; });
    HABITS.forEach((_, i) => {
      const [x, y] = polar(R, i * STEP);
      out += `<line class="spoke" x1="0" y1="0" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"/>`;
    });
    HABITS.forEach((h, i) => {
      out += `
        <g class="petal" data-i="${i}" tabindex="0" role="button" aria-pressed="false" transform="rotate(${(i * STEP).toFixed(3)})">
          <path class="hit" d="M0 0 L ${(-hx).toFixed(2)} ${hy.toFixed(2)} A ${hr} ${hr} 0 0 1 ${hx.toFixed(2)} ${hy.toFixed(2)} Z"/>
          <path class="petal-shape" style="--i:${i}" d="${PETAL_D}"/>
        </g>`;
    });
    out += `<polygon class="prev-poly" hidden></polygon>`;
    out += `<circle class="core" r="${CORE}"/>
      <text class="core-value num" y="6" data-core></text>
      <text class="core-label" y="24">indeks</text>`;
    HABITS.forEach((_, i) => {
      const [x, y] = polar(R + 22, i * STEP);
      out += `<g class="marker" data-i="${i}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})" aria-hidden="true"><circle r="12"/><text>${i + 1}</text></g>`;
    });
    svg.innerHTML = out;

    $$('.petal', svg).forEach((g) => {
      const i = Number(g.dataset.i);
      g.addEventListener('click', () => selectHabit(i));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectHabit(i); }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); focusPetal((i + 1) % 7); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); focusPetal((i + 6) % 7); }
      });
      g.addEventListener('pointerenter', () => setHover(i, true));
      g.addEventListener('pointerleave', () => setHover(i, false));
    });
  }
  const focusPetal = (i) => $(`.petal[data-i="${i}"]`).focus();
  function setHover(i, on) {
    $(`.petal[data-i="${i}"]`)?.classList.toggle('is-hover', on);
    $(`.habit-row[data-i="${i}"]`)?.classList.toggle('is-hover', on);
  }

  function renderRosette(s, prev, animate) {
    const svg = $('#rosette');
    $$('.petal', svg).forEach((g) => {
      const i = Number(g.dataset.i);
      const v = s.index[i];
      g.setAttribute('aria-label', `${i + 1}. ${HABITS[i].name}, indeks ${fmtIdx(v)}`);
      g.setAttribute('aria-pressed', String(i === state.habit));
      const shape = $('.petal-shape', g);
      if (animate && !reduceMotion.matches) {
        shape.style.setProperty('--v', '0');
        requestAnimationFrame(() => requestAnimationFrame(() => shape.style.setProperty('--v', v.toFixed(4))));
      } else shape.style.setProperty('--v', v.toFixed(4));
    });
    $$('.marker', svg).forEach((m) => m.classList.toggle('is-on', Number(m.dataset.i) === state.habit));
    countTo($('[data-core]', svg), s.overall, fmtIdx);
    const poly = $('.prev-poly', svg);
    if (prev) poly.setAttribute('points', prev.index.map((v, i) => polar(R * v, i * STEP).map((n) => n.toFixed(2)).join(',')).join(' '));
    poly.toggleAttribute('hidden', !state.compare || !prev);
    $('[data-compare]').disabled = !prev;
    svg.setAttribute('aria-label', `Indeks tujuh kebiasaan periode ${rLabel(roundById(state.round))}, rata-rata ${fmtIdx(s.overall)}. Pilih kelopak untuk melihat detail.`);
  }

  function renderHabitList(s, prev) {
    const ol = $('[data-habit-list]');
    ol.innerHTML = HABITS.map((h, i) => {
      const d = prev ? s.index[i] - prev.index[i] : 0;
      const cls = !prev ? '' : d > 0.0005 ? 'up' : d < -0.0005 ? 'down' : '';
      return `<li style="--i:${i}"><button type="button" class="habit-row" data-i="${i}" aria-pressed="${i === state.habit}">
          <span class="habit-num" aria-hidden="true">${i + 1}</span>
          <span class="habit-name">${h.name}</span>
          <span class="habit-val num">${fmtIdx(s.index[i])}</span>
          <span class="habit-delta num ${cls}">${prev ? fmtPts(d) : '–'}<span class="sr-only"> poin dari pengisian sebelumnya</span></span>
        </button></li>`;
    }).join('');
    $$('.habit-row', ol).forEach((b) => {
      const i = Number(b.dataset.i);
      b.addEventListener('click', () => selectHabit(i));
      b.addEventListener('pointerenter', () => setHover(i, true));
      b.addEventListener('pointerleave', () => setHover(i, false));
    });
    const i = state.habit;
    const ranked = rombelScope().map((rb) => ({ rb, s: statsRombel(state.round, rb.name) })).filter((x) => x.s.n >= CONFIG.minN).sort((a, b) => b.s.index[i] - a.s.index[i]);
    const best = ranked[0]; const worst = ranked[ranked.length - 1];
    $('[data-habit-detail]').innerHTML = `
      <h3>${i + 1}. ${HABITS[i].name}</h3>
      <p>${HABITS[i].rule}. ${fmtPct(s.cons[i])} siswa konsisten 3 dari 3 hari.</p>
      ${best ? `<dl>
        <div><dt>Rombel tertinggi</dt><dd class="num">${best.rb.name}, ${fmtIdx(best.s.index[i])}</dd></div>
        <div><dt>Rombel terendah</dt><dd class="num">${worst.rb.name}, ${fmtIdx(worst.s.index[i])}</dd></div>
      </dl>` : ''}`;
  }

  function selectHabit(i) {
    state.habit = i;
    if (state.route === 'ringkasan') {
      const s = statsOf(state.round); const p = prevRoundId();
      renderRosette(s, p ? statsOf(p) : null, false);
      renderHabitList(s, p ? statsOf(p) : null);
    } else if (state.route === 'kebiasaan') {
      $$('[data-dist-list] .stack-row').forEach((r) => r.setAttribute('aria-pressed', String(Number(r.dataset.i) === i)));
      renderHabitFocus(); renderHabitGrades();
      $$('[data-verdict-list] .verdict-row').forEach((r) => r.classList.toggle('is-on', Number(r.dataset.vi) === i));
    }
  }

  /* ------------------------------------------------------------------
     Page: Ringkasan
     ------------------------------------------------------------------ */
  function renderRingkasan(animate) {
    const s = statsOf(state.round);
    const pid = prevRoundId();
    const prev = pid ? statsOf(pid) : null;
    const pop = popOf();
    const part = partOf(s.n, pop);
    const prevName = pid ? rLabel(roundById(pid)) : '';
    const order = [...HABITS.keys()].sort((a, b) => s.index[b] - s.index[a]);
    const strong = order[0]; const weak = order[6];

    const who = state.kelas ? `kelas ${state.kelas} ` : state.grade === 'all' ? '' : `kelas ${state.grade} `;
    $('[data-hero-lead]').textContent = `${rLabel(roundById(state.round))}: ${fmtNum(s.n)} ${pop ? `dari ${fmtNum(pop)} ` : ''}siswa ${who}sudah mengisi kuesioner.`;
    $('[data-hero-sub]').textContent =
      `Indeks 7 KAIH ${fmtIdx(s.overall)}${prev ? `, ${s.overall >= prev.overall ? 'naik' : 'turun'} ${nf(1).format(Math.abs((s.overall - prev.overall) * 100))} poin dari ${prevName}` : ''}. ` +
      `${HABITS[weak].name} masih paling rendah (${fmtIdx(s.index[weak])}).`;

    const series = roundsWithData().map((r) => ({ r, s: statsOf(r.id) }));
    const sp = { part: series.map((x) => (pop ? x.s.n / pop : x.s.n)), overall: series.map((x) => x.s.overall), consAvg: series.map((x) => x.s.consAvg), gawaiRisk: series.map((x) => x.s.gawaiRisk) };
    $$('[data-spark]').forEach((p) => { p.setAttribute('d', sparkPath(sp[p.dataset.spark])); replay(p); });

    countTo($('[data-kpi="resp"]'), s.n, fmtNum);
    countTo($('[data-kpi="index"]'), s.overall, fmtIdx);
    countTo($('[data-kpi="cons"]'), s.consAvg, (v) => `${nf(1).format(v)} dari 7`);
    countTo($('[data-kpi="gawai"]'), s.gawaiRisk, (v) => fmtPct(v, 1));
    $('[data-kpi-meta="resp"]').innerHTML = `Partisipasi <b>${fmtPart(part, 1)}</b>${pop || isPublic() ? '' : ' (isi jumlah siswa di Master Kelas)'}`;
    $('[data-kpi-meta="index"]').innerHTML = prev ? trendTag(s.overall - prev.overall, `dari ${prevName}`) : 'Pengisian pertama';
    $('[data-kpi-meta="cons"]').innerHTML = `<b>${fmtPct(s.all7, 1)}</b> siswa konsisten di ketujuhnya`;
    $('[data-kpi-meta="gawai"]').innerHTML = prev ? trendTag(s.gawaiRisk - prev.gawaiRisk, `dari ${prevName}`, true) : 'Lebih dari 30 menit setelah berbaring';

    if (state.habit === null) state.habit = weak;
    renderRosette(s, prev, animate);
    renderHabitList(s, prev);
    renderInsights(s, prev, strong, weak);
    renderTimeline();
    renderPulse(s, prev);
  }

  /* Kartu "Sekilas periode ini" di banner: partisipasi, tren Indeks 7 KAIH, dan tiga sorotan. */
  function renderPulse(s, prev) {
    const r = roundById(state.round);
    const pop = popOf();
    const part = partOf(s.n, pop);
    const series = roundsWithData().filter((x) => x.id <= state.round).map((x) => statsOf(x.id)).filter((x) => x.n && !(state.kelas && x.n < CONFIG.minN));
    const maxN = Math.max(...roundsWithData().map((x) => statsOf(x.id).n), 1);
    const ringV = part === null ? s.n / maxN : clamp(part, 0, 1);
    $('[data-pulse-title]').textContent = `Sekilas ${state.kelas ? `kelas ${state.kelas}` : state.grade === 'all' ? 'periode ini' : `kelas ${state.grade}`}`;
    const arc = $('[data-pulse-arc]');
    arc.style.setProperty('--v', (ringV * 100).toFixed(1));
    arc.classList.toggle('is-low', part !== null && part < CONFIG.target);
    replay(arc);
    if (part === null) {
      countTo($('[data-pulse-value]'), s.n, fmtNum);
      $('[data-pulse-caption]').textContent = 'responden';
    } else {
      countTo($('[data-pulse-value]'), part, (v) => fmtPct(v));
      $('[data-pulse-caption]').textContent = `partisipasi · target ${fmtPct(CONFIG.target)}`;
    }
    const vals = series.map((x) => x.overall);
    const line = sparkPath(vals);
    $('[data-pulse-spark]').setAttribute('d', line);
    $('[data-pulse-area]').setAttribute('d', line ? `${line} L100 32 L0 32 Z` : '');
    replay($('[data-pulse-spark]'));
    $('[data-pulse-trend]').innerHTML = vals.length > 1
      ? `Indeks 7 KAIH <b class="num">${fmtIdx(vals[0])} → ${fmtIdx(vals[vals.length - 1])}</b><span>${fmtNum(vals.length)} periode sampai ${esc(rLabel(r))}</span>`
      : `Indeks 7 KAIH <b class="num">${fmtIdx(s.overall)}</b><span>tren muncul mulai periode kedua</span>`;

    const items = [];
    // Kelas dengan indeks tertinggi di cakupan ini (hanya kelas dengan responden cukup).
    const classes = rombelScope().map((rb) => ({ rb, st: statsRombel(state.round, rb.name) })).filter((x) => x.st.n >= CONFIG.minN);
    if (!state.kelas && classes.length > 1) {
      const best = classes.sort((a, b) => b.st.overall - a.st.overall)[0];
      items.push({ ico: 'top', label: 'Indeks tertinggi', value: best.rb.name, meta: fmtIdx(best.st.overall) });
    } else if (state.kelas && s.n >= CONFIG.minN) {
      const g = statsOf(state.round, gradeOf(state.kelas));
      items.push({ ico: 'top', label: `Dibanding kelas ${gradeOf(state.kelas)}`, value: `${fmtPts(s.overall - g.overall)} poin`, meta: `indeks ${fmtIdx(s.overall)}` });
    }
    if (prev && prev.n) {
      const d = HABITS.map((_, i) => s.index[i] - prev.index[i]);
      const k = d.indexOf(Math.max(...d));
      items.push(d[k] > 0.0005
        ? { ico: 'up', label: 'Paling membaik', value: HABITS[k].name, meta: `${fmtPts(d[k])} poin` }
        : { ico: 'down', label: 'Belum ada yang membaik', value: 'dari periode lalu', meta: '' });
    }
    const late = rombelScope().filter((rb) => rb.size && statsRombel(state.round, rb.name).n / rb.size < CONFIG.target).length;
    items.push(pop && state.kelas
      ? { ico: 'warn', label: 'Belum mengisi', value: `${fmtNum(Math.max(0, pop - s.n))} siswa`, meta: `dari ${fmtNum(pop)}` }
      : pop
      ? { ico: 'warn', label: 'Di bawah target isi', value: `${fmtNum(late)} kelas`, meta: `dari ${fmtNum(rombelScope().length)}` }
      : { ico: 'cal', label: 'Periode tercatat', value: `${fmtNum(roundsWithData().length)} periode`, meta: ROUNDS[0] ? `sejak ${rLabel(ROUNDS[0])}` : '' });
    $('[data-pulse-list]').innerHTML = items.slice(0, 3).map((it, i) => `<li class="pulse-item ${it.ico}" style="--i:${i}">
      <span class="pulse-ico" aria-hidden="true"></span>
      <span class="pulse-text"><small>${esc(it.label)}</small><b>${esc(it.value)}</b></span>
      <span class="pulse-meta num">${esc(it.meta)}</span></li>`).join('');
  }

  function gawaiSleep(rows) {
    return [0, 1, 2, 3].map((g) => {
      const rs = rows.filter((r) => r.gawai === g);
      return { g, n: rs.length, cons: rs.length ? rs.filter((r) => r.h[TIDUR] === 3).length / rs.length : 0, idx: rs.length ? avg(rs.map((r) => r.h[TIDUR])) / 3 : 0 };
    });
  }

  function renderInsights(s, prev, strong, weak) {
    const items = [];
    items.push({ tone: 'good', title: `${HABITS[strong].name} paling kuat`, text: `Indeks ${fmtIdx(s.index[strong])}; ${fmtPct(s.cons[strong])} siswa menjalankannya 3 dari 3 hari.` });
    items.push({ tone: 'warn', title: `${HABITS[weak].name} paling perlu didorong`, text: `Indeks ${fmtIdx(s.index[weak])}; ${fmtPct(s.dist[weak][0] / (s.n || 1))} siswa tidak sekali pun menjalankannya dalam 3 hari terakhir.` });
    const gs = gawaiSleep(rowsOf(state.round));
    const lo = gs[0]; const hiRows = rowsOf(state.round).filter((r) => r.gawai >= 2);
    const hiCons = hiRows.length ? hiRows.filter((r) => r.h[TIDUR] === 3).length / hiRows.length : 0;
    if (lo.n && hiRows.length) items.push({ tone: 'info', title: 'HP di kasur berkaitan dengan tidur larut', text: `Tidur cepat konsisten ${fmtPct(lo.cons)} pada siswa tanpa HP di kasur, tetapi hanya ${fmtPct(hiCons)} pada yang ≥ 2 malam.` });
    const topBar = BARRIERS.filter((b) => b.code !== 'F').sort((a, b) => s.bars[b.code] - s.bars[a.code])[0];
    items.push({ tone: 'info', title: `Hambatan teratas: ${topBar.name}`, text: `Dipilih ${fmtPct(s.bars[topBar.code] / (s.n || 1))} responden. ${fmtPct(s.bars.F / (s.n || 1))} merasa tidak ada hambatan.` });
    if (state.grade === 'all') {
      const g = GRADES.map((gr) => ({ gr, s: statsOf(state.round, gr) })).filter((x) => x.s.n).sort((a, b) => b.s.overall - a.s.overall);
      if (g.length > 1) items.push({ tone: 'neutral', title: `Kelas ${g[0].gr} unggul, kelas ${g[g.length - 1].gr} tertinggal`, text: `Indeks ${fmtIdx(g[0].s.overall)} berbanding ${fmtIdx(g[g.length - 1].s.overall)}, selisih ${nf(1).format((g[0].s.overall - g[g.length - 1].s.overall) * 100)} poin.` });
    }
    if (prev) {
      const d = HABITS.map((_, i) => s.index[i] - prev.index[i]);
      const k = d.indexOf(Math.max(...d));
      if (d[k] > 0.005) items.push({ tone: 'good', title: `${HABITS[k].name} paling membaik`, text: `Naik ${nf(1).format(d[k] * 100)} poin dari ${rLabel(roundById(prevRoundId()))}.` });
    }
    $('[data-insights]').innerHTML = items.slice(0, 5).map((it, i) => `<li class="insight ${it.tone}" style="--i:${i}">
      <span class="insight-ico" aria-hidden="true"></span>
      <div><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div></li>`).join('');
  }

  // Riwayat pengisian: periode terbaru di atas, paling banyak 6.
  function renderTimeline() {
    const pop = popOf();
    const list = [...ROUNDS].reverse().slice(0, 6);
    const maxN = Math.max(...list.map((r) => statsOf(r.id).n), 1);
    $('[data-timeline]').innerHTML = list.map((r, i) => {
      const s = statsOf(r.id); const has = s.n > 0;
      const part = partOf(s.n, pop);
      const w = part === null ? s.n / maxN : part;
      return `<li class="tl done${r.id === state.round ? ' is-current' : ''}" style="--i:${i}">
        <button type="button" class="tl-btn" data-pick-round="${r.id}" ${has ? '' : 'disabled'} aria-pressed="${r.id === state.round}">
          <span class="tl-dot" aria-hidden="true"></span>
          <span class="tl-body">
            <span class="tl-head"><b>${esc(rLabel(r))}</b>${i === 0 ? '<span class="chip-status">Terbaru</span>' : ''}</span>
            <span class="tl-date">${rRange(r) ? `diisi ${rRange(r)}` : 'tanpa tanggal'}</span>
            ${has ? `<span class="tl-bar"><span style="--w:${(clamp(w, 0, 1) * 100).toFixed(1)}%"></span></span>
            <span class="tl-meta num">${fmtNum(s.n)} responden${part === null ? '' : ` · ${fmtPct(part, 1)}`}</span>` : '<span class="tl-meta">Belum ada isian</span>'}
          </span>
        </button></li>`;
    }).join('') + (ROUNDS.length > 6 ? `<li class="tl-more"><a href="#/tren">Lihat semua ${fmtNum(ROUNDS.length)} periode</a></li>` : '');
    $$('[data-pick-round]').forEach((b) => b.addEventListener('click', () => setRound(Number(b.dataset.pickRound))));
  }

  /* ------------------------------------------------------------------
     Page: 7 Kebiasaan
     ------------------------------------------------------------------ */
  const DAY_NAMES = ['0 hari', '1 hari', '2 hari', '3 hari'];
  function renderKebiasaan() {
    const s = statsOf(state.round);
    if (state.habit === null) state.habit = s.index.indexOf(Math.min(...s.index));
    legend($('[data-day-legend]'), DAY_NAMES, DAY_COLORS);
    $('[data-dist-list]').innerHTML = HABITS.map((h, i) => `
      <button type="button" class="stack-row" data-i="${i}" aria-pressed="${i === state.habit}" style="--i:${i}">
        <span class="stack-label"><span class="habit-num">${i + 1}</span>${h.name}</span>
        ${stackBar(s.dist[i], DAY_COLORS, DAY_TEXT, DAY_NAMES, i)}
        <span class="stack-val num">${fmtIdx(s.index[i])}</span>
      </button>`).join('');
    $$('[data-dist-list] .stack-row').forEach((b) => b.addEventListener('click', () => selectHabit(Number(b.dataset.i))));
    renderHabitFocus();
    renderHabitGrades();
    renderVerdictList(s);

    const max = Math.max(...s.consHist.map((c) => c / (s.n || 1)), 0.01);
    $('[data-hist-desc]').innerHTML = `Berapa kebiasaan yang dijalankan 3 dari 3 hari oleh tiap siswa. Rata-rata <b>${nf(1).format(s.consAvg)}</b> kebiasaan; ${fmtPct(s.all7, 1)} siswa konsisten di ketujuhnya.`;
    $('[data-hist]').innerHTML = s.consHist.map((c, k) => col({
      label: String(k), value: fmtPct(c / (s.n || 1)), max, i: k,
      segs: [{ v: c / (s.n || 1), c: `color-mix(in srgb, #f27fa2 ${100 - k * 14}%, #6646d6)` }],
      tip: `${k} kebiasaan konsisten: ${fmtNum(c)} siswa`,
    })).join('');
  }

  function renderHabitFocus() {
    const i = state.habit; const h = HABITS[i];
    const s = statsOf(state.round);
    const pid = prevRoundId(); const prev = pid ? statsOf(pid) : null;
    const d = prev ? s.cons[i] - prev.cons[i] : null;
    $('[data-habit-focus]').innerHTML = `
      <p class="eyebrow">Soal ${h.soal} · Kebiasaan ${i + 1}</p>
      <h2 class="panel-title" id="focus-title">${h.name}</h2>
      <p class="panel-desc">${esc(h.q)}</p>
      <div class="focus-donut">
        ${donut(s.dist[i], DAY_COLORS)}
        <div class="donut-center"><b class="num" data-focus-cons></b><span>konsisten</span></div>
      </div>
      <ul class="focus-list">${s.dist[i].map((c, k) => `<li style="--i:${k}"><span class="dot" style="--c:${DAY_COLORS[k]}"></span>${DAY_NAMES[k]}<b class="num">${fmtPct(c / (s.n || 1), 1)}</b><small class="num">${fmtNum(c)}</small></li>`).join('')}</ul>
      <p class="focus-foot"><span class="rule-chip">${h.rule}</span>${d !== null ? `<span class="kpi-meta">${trendTag(d, `konsisten dari ${rLabel(roundById(pid))}`)}</span>` : ''}</p>
      <div class="focus-trend">
        <p class="focus-sub">Tren ${esc(h.name)} per periode</p>
        <ul class="legend" aria-hidden="true"><li><span class="dot" style="--c:${h.color}"></span>Indeks</li><li><span class="dot" style="--c:#f5a04a"></span>% konsisten</li></ul>
        <div class="chart chart-mini" data-focus-trend tabindex="0" aria-label="Tren indeks ${esc(h.name)} per periode"><svg class="chart-svg chart-svg-sm" aria-hidden="true"></svg><div class="chart-tip" hidden></div></div>
      </div>
      <div class="focus-analysis">
        <p class="focus-sub">Kesimpulan</p>
        <p class="focus-verdict" data-focus-verdict></p>
        <p class="focus-advice" data-focus-advice></p>
        <details class="focus-more"><summary>Lihat angka pendukung</summary><p data-focus-analysis></p></details>
      </div>`;
    countTo($('[data-focus-cons]'), s.cons[i], (v) => fmtPct(v));

    // Tren kebiasaan ini: indeks dan % konsisten tiap periode (cakupan aktif).
    const small = (x) => state.kelas && x.n < CONFIG.minN;
    const ss = ROUNDS.map((r) => { const x = statsOf(r.id); return x.n && !small(x) ? x : null; });
    lineChart($('[data-focus-trend]'), {
      labels: roundLabels(), height: 170, lo: 0, hi: 1,
      series: [
        { name: '% konsisten', color: '#f5a04a', width: 2, dash: true, below: true, values: ss.map((x) => (x ? x.cons[i] : null)) },
        { name: 'Indeks', color: h.color, width: 3.5, area: true, labels: ROUNDS.length <= 5, values: ss.map((x) => (x ? x.index[i] : null)) },
      ],
      fmt: fmtIdx, fmtAxis: (t) => nf(0).format(t * 100),
    });

    // Analisis singkat: tren, peringkat, kelompok "0 hari", dan perbedaan jenjang.
    const got = ROUNDS.map((r, k) => ({ r, x: ss[k] })).filter((p) => p.x && p.r.id <= state.round);
    const parts = [];
    if (got.length >= 2) {
      const a = got[0]; const b = got[got.length - 1]; const dd = b.x.index[i] - a.x.index[i];
      parts.push(`Indeks ${upDown(dd)} dari ${fmtIdx(a.x.index[i])} (${rLabel(a.r)}) menjadi ${fmtIdx(b.x.index[i])} (${rLabel(b.r)}), ${pts(dd)}.`);
    } else parts.push('Tren muncul setelah minimal dua periode berisi data.');
    const rank = 1 + s.index.filter((v) => v > s.index[i]).length;
    parts.push(`Peringkat ke-${rank} dari 7 kebiasaan; ${fmtPct(s.dist[i][0] / (s.n || 1))} siswa tidak sekali pun menjalankannya dalam 3 hari terakhir.`);
    if (state.grade === 'all' && !state.kelas) {
      const gs = GRADES.map((g) => ({ g, x: statsOf(state.round, g) })).filter((p) => p.x.n >= CONFIG.minN).sort((p, q) => q.x.index[i] - p.x.index[i]);
      if (gs.length > 1) parts.push(`Tertinggi di kelas ${gs[0].g} (${fmtIdx(gs[0].x.index[i])}), terendah di kelas ${gs[gs.length - 1].g} (${fmtIdx(gs[gs.length - 1].x.index[i])}).`);
    }
    if (i === TIDUR) {
      const rows = rowsOf(state.round); const hi = rows.filter((r) => r.gawai >= 2); const lo = rows.filter((r) => r.gawai === 0);
      if (hi.length >= CONFIG.minN && lo.length >= CONFIG.minN) {
        const c = (rs) => rs.filter((r) => r.h[TIDUR] === 3).length / rs.length;
        parts.push(`Siswa yang memakai HP di kasur ≥ 2 malam lebih jarang tidur cepat (${fmtPct(c(hi))} konsisten) dibanding yang tidak (${fmtPct(c(lo))}).`);
      }
    } else if (prev) {
      const dd = s.index[i] - prev.index[i];
      parts.push(`Dibanding ${rLabel(roundById(pid))}, indeksnya ${upDown(dd)}${Math.abs(dd) > 0.0005 ? ` ${pts(dd)}` : ''}.`);
    }
    $('[data-focus-analysis]').textContent = parts.join(' ');
    $('[data-focus-verdict]').textContent = habitVerdict(i, s);
    $('[data-focus-advice]').innerHTML = `<b>Saran:</b> ${esc(habitAdvice(i, s))}`;
  }

  function renderHabitGrades() {
    const i = state.habit;
    $('[data-hgrade-desc]').textContent = `${HABITS[i].name} per jenjang pada periode ${rLabel(roundById(state.round))}. Angka di kanan = indeks.`;
    $('[data-hgrade-list]').innerHTML = GRADES.map((g, k) => {
      const s = statsOf(state.round, g);
      return `<div class="stack-row static${state.grade === g ? ' is-on' : ''}" style="--i:${k}">
        <span class="stack-label">Kelas ${g}<small class="num">${fmtNum(s.n)} resp.</small></span>
        ${s.n ? stackBar(s.dist[i], DAY_COLORS, DAY_TEXT, DAY_NAMES, k) : '<div class="stack empty-stack">Belum ada data</div>'}
        <span class="stack-val num">${s.n ? fmtIdx(s.index[i]) : '–'}</span>
      </div>`;
    }).join('');
  }

  /* ------------------------------------------------------------------
     Page: Tren
     ------------------------------------------------------------------ */
  function renderTren() {
    const key = state.metric === 'index' ? 'index' : 'cons';
    const all = key === 'index' ? 'overall' : 'consOverall';
    const small = (n) => state.kelas && n < CONFIG.minN;
    const ss = ROUNDS.map((r) => { const s = statsOf(r.id); return s.n && !small(s.n) ? s : null; });
    const got = ss.filter(Boolean);
    const vals = got.flatMap((s) => [...s[key], s[all]]);
    const lo = Math.max(0, Math.floor((Math.min(...vals) - 0.05) * 10) / 10);
    const hi = Math.min(1, Math.ceil((Math.max(...vals) + 0.05) * 10) / 10);
    const metricName = key === 'index' ? 'Indeks 7 KAIH' : 'Rata-rata % konsisten';

    $('[data-trend-chips]').innerHTML = `<button type="button" class="chip" data-focus="" aria-pressed="${state.focus === null}"><span class="dot" style="--c:var(--ivory)"></span>Semua</button>` +
      HABITS.map((h, i) => `<button type="button" class="chip" data-focus="${i}" aria-pressed="${state.focus === i}" style="--i:${i}"><span class="dot" style="--c:${h.color}"></span>${h.name}</button>`).join('');
    $$('[data-trend-chips] .chip').forEach((b) => b.addEventListener('click', () => {
      state.focus = b.dataset.focus === '' ? null : Number(b.dataset.focus);
      renderTren();
    }));

    const series = HABITS.map((h, i) => ({
      name: h.name, color: h.color, width: state.focus === i ? 3.5 : 2,
      dim: state.focus !== null && state.focus !== i, area: state.focus === i, labels: state.focus === i,
      values: ss.map((s) => (s ? s[key][i] : null)),
    }));
    series.push({ name: metricName, color: '#2b2350', width: state.focus === null ? 4 : 2.5, area: state.focus === null, labels: state.focus === null, dash: state.focus !== null, values: ss.map((s) => (s ? s[all] : null)) });
    if (state.focus !== null) series.push(series.splice(state.focus, 1)[0]);
    const wrap = $('[data-trend-chart]');
    lineChart(wrap, { labels: roundLabels(), series, lo, hi, height: 320, fmt: (v) => (key === 'index' ? fmtIdx(v) : fmtPct(v)), fmtAxis: (t) => (key === 'index' ? nf(0).format(t * 100) : fmtPct(t)) });

    const first = got[0]; const last = got[got.length - 1];
    $('[data-trend-summary]').textContent = got.length > 1
      ? `${metricName} ${scopeName()}: ${key === 'index' ? fmtIdx(first[all]) : fmtPct(first[all])} pada periode ${rLabel(ROUNDS[ss.indexOf(first)])} menjadi ${key === 'index' ? fmtIdx(last[all]) : fmtPct(last[all])} pada periode ${rLabel(ROUNDS[ss.indexOf(last)])}.`
      : 'Tren muncul setelah minimal dua periode pengisian.';
    wrap.setAttribute('aria-label', `Grafik tren ${metricName} per pengisian. ${$('[data-trend-summary]').textContent} Gunakan panah kiri dan kanan untuk membaca nilai.`);

    // Partisipasi per pengisian
    const pop = popOf();
    $('[data-part-desc]').textContent = pop ? `Responden dibagi jumlah siswa (data TU). Garis putus-putus = target ${fmtPct(CONFIG.target)}.` : 'Jumlah responden per pengisian. Isi jumlah siswa di Master Kelas untuk melihat persentase partisipasi.';
    const maxN = Math.max(...ss.filter(Boolean).map((x) => x.n), 1);
    $('[data-part-rounds]').innerHTML = ROUNDS.map((r, i) => {
      const s = ss[i];
      if (!s) return col({ label: shortLabel(r), sub: '', value: '–', segs: [{ v: 0, c: 'transparent' }], i, target: pop ? CONFIG.target : null });
      // Jumlah siswa belum diisi: tinggi kolom = jumlah responden relatif terhadap periode terbanyak.
      if (!pop) return col({ label: shortLabel(r), sub: '', value: fmtNum(s.n), i, segs: [{ v: s.n / maxN, c: 'var(--amber)' }], tip: `${rLabel(r)}: ${fmtNum(s.n)} responden` });
      return col({ label: shortLabel(r), sub: '', value: fmtPct(s.n / pop), i, target: CONFIG.target, segs: [{ v: s.n / pop, c: 'var(--amber)' }], tip: `${rLabel(r)}: ${fmtNum(s.n)} dari ${fmtNum(pop)} siswa` });
    }).join('');

    // Perubahan per kebiasaan
    const box = $('[data-delta-list]');
    if (got.length < 2) { box.innerHTML = '<p class="empty">Perlu minimal dua pengisian.</p>'; $('[data-delta-desc]').textContent = ''; return; }
    const fr = ROUNDS[ss.indexOf(first)]; const lr = ROUNDS[ss.indexOf(last)];
    $('[data-delta-desc]').textContent = `Selisih ${key === 'index' ? 'indeks' : '% konsisten'} ${rLabel(fr)} ke ${rLabel(lr)}, diurutkan dari yang paling membaik.`;
    const deltas = HABITS.map((h, i) => ({ h, i, d: last[key][i] - first[key][i] })).sort((a, b) => b.d - a.d);
    const m = Math.max(...deltas.map((x) => Math.abs(x.d)), 0.01);
    box.innerHTML = deltas.map((x, k) => `<div class="drow" style="--i:${k}">
      <span class="drow-label"><span class="dot" style="--c:${x.h.color}"></span>${x.h.name}</span>
      <div class="drow-track"><span class="drow-fill ${x.d >= 0 ? 'pos' : 'neg'}" style="--w:${((Math.abs(x.d) / m) * 50).toFixed(2)}%"></span></div>
      <span class="drow-val num ${x.d >= 0 ? 'up' : 'down'}">${fmtPts(x.d)}</span></div>`).join('');
  }

  /* ------------------------------------------------------------------
     Page: Kelas dan jenjang
     ------------------------------------------------------------------ */
  function renderKelas() {
    const list = rombelScope().map((rb) => {
      const s = statsRombel(state.round, rb.name);
      return { rb, s, part: partOf(s.n, rb.size), ok: s.n >= CONFIG.minN };
    });
    $('[data-heat-desc]').textContent = `Indeks (0–100) tiap kebiasaan per rombel, ${rLabel(roundById(state.round))}. Warna makin pekat = makin baik. Pilih judul kolom untuk mengurutkan.`;

    const cols = [
      { key: 'name', label: 'Rombel' }, { key: 'n', label: 'Resp.' }, { key: 'part', label: 'Partisipasi' },
      ...HABITS.map((h, i) => ({ key: `h${i}`, label: h.short, num: i + 1 })), { key: 'index', label: 'Indeks' },
    ];
    const val = (x, k) => (k === 'name' ? x.rb.name : k === 'n' ? x.s.n : k === 'part' ? (x.part ?? -1) : k === 'index' ? (x.ok ? x.s.overall : -1) : x.ok ? x.s.index[Number(k.slice(1))] : -1);
    const { key, dir } = state.sort;
    list.sort((a, b) => { const va = val(a, key), vb = val(b, key); const c = typeof va === 'string' ? va.localeCompare(vb, 'id', { numeric: true }) : va - vb; return dir === 'asc' ? c : -c; });
    $('[data-heat-head]').innerHTML = `<tr>${cols.map((c) => `<th scope="col" aria-sort="${key === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}"${key === c.key ? ' class="col-on"' : ''}>
      <button type="button" class="sort-btn" data-sort="${c.key}">${c.num ? `<span class="sort-num">${c.num}</span>` : ''}${c.label}<span class="sort-dir" aria-hidden="true">${key === c.key ? (dir === 'asc' ? '▲' : '▼') : ''}</span></button></th>`).join('')}</tr>`;
    let cell = 0;
    $('[data-heat-body]').innerHTML = list.map((x) => {
      if (!x.ok) return `<tr><td>${esc(x.rb.name)}</td><td class="num">${fmtNum(x.s.n)}</td><td class="cell-part num">${fmtPart(x.part)}</td><td class="small-n" colspan="8">Responden kurang dari ${CONFIG.minN}, rincian disembunyikan</td></tr>`;
      return `<tr><td>${esc(x.rb.name)}</td><td class="num">${fmtNum(x.s.n)}${x.rb.size ? `<small>/${x.rb.size}</small>` : ''}</td><td class="cell-part num${x.part !== null && x.part < CONFIG.target ? ' low' : ''}">${fmtPart(x.part)}</td>
        ${HABITS.map((h, i) => heatCell(x.s.index[i], `${x.rb.name} · ${h.name}: indeks ${fmtIdx(x.s.index[i])}, ${fmtPct(x.s.cons[i])} konsisten`, cell++, key === `h${i}` ? ' col-on' : '')).join('')}
        ${heatCell(x.s.overall, `${x.rb.name}: indeks 7 KAIH ${fmtIdx(x.s.overall)}`, cell++, ' heat-total')}</tr>`;
    }).join('');
    $$('[data-sort]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.sort;
      state.sort = { key: k, dir: state.sort.key === k && state.sort.dir === 'desc' ? 'asc' : k === 'name' ? 'asc' : 'desc' };
      renderKelas();
    }));

    // Partisipasi per rombel
    // Kelas tanpa jumlah siswa (Master Kelas belum diisi) ditampilkan dengan jumlah responden saja.
    const maxN = Math.max(...list.map((x) => x.s.n), 1);
    const byPart = [...list].sort((a, b) => (b.part ?? -1) - (a.part ?? -1) || b.s.n - a.s.n);
    $('[data-part-rombel]').innerHTML = byPart.map((x, i) => (x.part === null
      ? hrow({ label: x.rb.name, value: `${fmtNum(x.s.n)} <small>resp.</small>`, frac: x.s.n / maxN, i, color: 'var(--amber-light)', tip: `${x.rb.name}: ${fmtNum(x.s.n)} responden (jumlah siswa belum diisi)` })
      : hrow({ label: x.rb.name, value: `${fmtPct(x.part)} <small>${fmtNum(x.s.n)}/${x.rb.size}</small>`, frac: x.part, i, target: CONFIG.target,
        color: x.part < CONFIG.target ? 'var(--chart-coral)' : 'var(--amber)', tip: `${x.rb.name}: ${fmtNum(x.s.n)} dari ${x.rb.size} siswa` }))).join('');

    // Jenjang
    const gs = GRADES.map((g) => ({ g, s: statsOf(state.round, g), pop: popOf(g) }));
    const pr = (x) => (x.pop ? x.s.n / x.pop : null);
    const best = [...gs].sort((a, b) => (pr(b) ?? b.s.n) - (pr(a) ?? a.s.n));
    $('[data-grade-summary]').textContent = gs.every((x) => x.pop)
      ? `Kelas ${best[0].g} paling aktif mengisi (${fmtPct(pr(best[0]))}), kelas ${best[2].g} paling rendah (${fmtPct(pr(best[2]))}).`
      : `Responden terbanyak dari kelas ${best[0].g} (${fmtNum(best[0].s.n)}). Isi jumlah siswa di Master Kelas untuk melihat partisipasi.`;
    $('[data-grade-list]').innerHTML = gs.map((x, i) => `
      <div class="grade${state.grade !== 'all' && state.grade !== x.g ? ' is-dim' : ''}" style="--i:${i}">
        <div class="grade-head"><span class="grade-name">Kelas ${x.g}</span><span class="grade-meta num">${fmtNum(x.s.n)}${x.pop ? ` dari ${fmtNum(x.pop)}` : ''} siswa</span></div>
        ${x.pop ? `<div class="bar-row"><div class="bar-track"><div class="bar-fill amber" style="--v:${(x.s.n / x.pop).toFixed(4)}"></div></div><span class="bar-val num">${fmtPct(x.s.n / x.pop)}</span></div>` : ''}
        <div class="bar-row"><div class="bar-track thin"><div class="bar-fill ivory" style="--v:${x.s.overall.toFixed(4)}"></div></div><span class="bar-val num">${fmtIdx(x.s.overall)}</span></div>
      </div>`).join('');

    // Perlu perhatian
    const valid = list.filter((x) => x.ok);
    const lowIdx = [...valid].sort((a, b) => a.s.overall - b.s.overall).slice(0, 2).map((x) => x.rb.name);
    const lowPart = (x) => x.part !== null && x.part < CONFIG.target;
    const flagged = list.filter((x) => lowPart(x) || lowIdx.includes(x.rb.name))
      .sort((a, b) => (a.part ?? 1) - (b.part ?? 1)).slice(0, 4);
    $('[data-attention]').innerHTML = flagged.length ? flagged.map((x, i) => {
      const weak = x.ok ? x.s.index.indexOf(Math.min(...x.s.index)) : null;
      return `<li class="attention" style="--i:${i}">
        <div><p class="attention-name">${esc(x.rb.name)}</p>
        <p class="attention-meta num">${x.part === null ? `${fmtNum(x.s.n)} responden` : `Partisipasi ${fmtPct(x.part)} (${fmtNum(x.s.n)}/${x.rb.size})`}${x.ok ? ` · indeks ${fmtIdx(x.s.overall)}` : ''}</p></div>
        <div class="tags">${lowPart(x) ? '<span class="tag tag-coral">Partisipasi rendah</span>' : ''}${lowIdx.includes(x.rb.name) ? '<span class="tag tag-violet">Indeks terendah</span>' : ''}${weak !== null ? `<span class="tag">Terlemah: ${HABITS[weak].name}</span>` : ''}</div>
      </li>`;
    }).join('') : '<li class="empty">Semua rombel memenuhi target.</li>';
  }

  /* ------------------------------------------------------------------
     Page: Gawai dan tidur
     ------------------------------------------------------------------ */
  const NIGHT_NAMES = ['0 malam', '1 malam', '2 malam', '3 malam'];
  function renderGawai() {
    const s = statsOf(state.round);
    const rows = rowsOf(state.round);
    const pid = prevRoundId(); const prev = pid ? statsOf(pid) : null;
    const n = s.n || 1;
    const kpis = [
      { cls: 'kpi-sky', label: 'Tanpa HP di kasur (0 malam)', v: s.gawai[0] / n, fmt: (v) => fmtPct(v, 1), meta: prev ? trendTag(s.gawai[0] / n - prev.gawai[0] / (prev.n || 1), `dari ${rLabel(roundById(pid))}`) : 'Pengisian pertama' },
      { cls: 'kpi-pink', label: 'HP di kasur ≥ 2 malam', v: s.gawaiRisk, fmt: (v) => fmtPct(v, 1), meta: prev ? trendTag(s.gawaiRisk - prev.gawaiRisk, `dari ${rLabel(roundById(pid))}`, true) : 'Faktor risiko tidur larut' },
      { cls: 'kpi-lilac', label: 'Indeks Tidur cepat', v: s.index[TIDUR], fmt: fmtIdx, meta: `${fmtPct(s.cons[TIDUR])} tidur ≤ 22.00 tiap malam` },
    ];
    $('[data-gawai-kpis]').innerHTML = kpis.map((k, i) => `<div class="kpi ${k.cls}" style="--i:${i}">
      <p class="kpi-label">${k.label}</p><p class="kpi-value num" data-gk="${i}"></p><p class="kpi-meta">${k.meta}</p></div>`).join('');
    kpis.forEach((k, i) => countTo($(`[data-gk="${i}"]`), k.v, k.fmt));
    revealNow($$('[data-gawai-kpis] .kpi'));

    const max = Math.max(...s.gawai.map((c) => c / n), 0.01);
    $('[data-gawai-dist]').innerHTML = s.gawai.map((c, k) => col({ label: NIGHT_NAMES[k], value: fmtPct(c / n), max, i: k, segs: [{ v: c / n, c: NIGHT_COLORS[k] }], tip: `${NIGHT_NAMES[k]}: ${fmtNum(c)} siswa` })).join('');

    const gs = gawaiSleep(rows);
    const lo = gs[0]; const hi = gs[3];
    $('[data-gx-desc]').textContent = `% siswa yang tidur ≤ 22.00 selama 3 malam, dikelompokkan menurut malam memakai HP di kasur.${lo.n && hi.n ? ` Selisih kelompok 0 dan 3 malam: ${nf(0).format((lo.cons - hi.cons) * 100)} poin.` : ''}`;
    $('[data-gx-list]').innerHTML = gs.map((x, i) => hrow({
      label: NIGHT_NAMES[x.g], sub: `${fmtNum(x.n)} siswa`, value: x.n ? fmtPct(x.cons) : '–', frac: x.cons, i,
      color: NIGHT_COLORS[x.g], tip: x.n ? `${NIGHT_NAMES[x.g]}: tidur cepat konsisten ${fmtPct(x.cons, 1)}, indeks ${fmtIdx(x.idx)}` : '',
    })).join('');

    legend($('[data-night-legend]'), NIGHT_NAMES, NIGHT_COLORS);
    $('[data-gawai-grade]').innerHTML = GRADES.map((g, k) => {
      const gsS = statsOf(state.round, g);
      return `<div class="stack-row static${state.grade === g ? ' is-on' : ''}" style="--i:${k}">
        <span class="stack-label">Kelas ${g}<small class="num">${fmtNum(gsS.n)} resp.</small></span>
        ${gsS.n ? stackBar(gsS.gawai, NIGHT_COLORS, DAY_TEXT.map(() => '#2b2350'), NIGHT_NAMES, k) : '<div class="stack empty-stack">Belum ada data</div>'}
        <span class="stack-val num">${gsS.n ? fmtPct(gsS.gawaiRisk) : '–'}</span></div>`;
    }).join('');

    const ss = ROUNDS.map((r) => { const x = statsOf(r.id); return x.n && !(state.kelas && x.n < CONFIG.minN) ? x : null; });
    lineChart($('[data-gawai-trend]'), {
      labels: roundLabels(), height: 240, lo: 0, hi: 1,
      series: [
        { name: 'HP di kasur ≥ 2 malam', color: '#f27fa2', width: 3, area: true, labels: true, below: true, values: ss.map((x) => (x ? x.gawaiRisk : null)) },
        { name: 'Indeks Tidur cepat', color: '#4b2fb8', width: 3, labels: true, values: ss.map((x) => (x ? x.index[TIDUR] : null)) },
      ],
      fmt: (v) => nf(0).format(v * 100), fmtAxis: (t) => nf(0).format(t * 100),
    });
  }

  /* ------------------------------------------------------------------
     Page: Hambatan
     ------------------------------------------------------------------ */
  function renderHambatan() {
    const s = statsOf(state.round);
    const rows = rowsOf(state.round);
    const n = s.n || 1;
    const order = [...BARRIERS].sort((a, b) => s.bars[b.code] - s.bars[a.code]);
    const max = Math.max(...order.map((b) => s.bars[b.code] / n), 0.01);
    $('[data-bar-desc]').textContent = `Soal 11, % responden yang memilih tiap hambatan. Siswa boleh memilih maksimal 2, jadi totalnya bisa lebih dari 100%.`;
    $('[data-bar-list]').innerHTML = order.map((b, i) => hrow({
      label: b.name, value: fmtPct(s.bars[b.code] / n, 1), frac: s.bars[b.code] / n / max, i,
      color: b.code === 'F' ? 'var(--chart-teal)' : b.code === 'B' ? 'var(--chart-coral)' : 'var(--amber)',
      tip: `${b.name}: ${fmtNum(s.bars[b.code])} siswa`, cls: b.code === 'F' ? 'is-good' : '',
    })).join('');

    const gsS = GRADES.map((g) => statsOf(state.round, g));
    $('[data-bar-grade]').innerHTML = `<thead><tr><th scope="col">Hambatan</th>${GRADES.map((g) => `<th scope="col">${g}</th>`).join('')}</tr></thead><tbody>` +
      order.map((b, i) => `<tr><th scope="row">${b.name.replace(/ \/ .*| atau .*|, .*/, '')}</th>${gsS.map((gs, k) => {
        const v = gs.n ? gs.bars[b.code] / gs.n : 0;
        const a = clamp(v / 0.6, 0.05, 1);
        return `<td class="heat num${a > 0.55 ? ' on-light' : ''}" style="--a:${a.toFixed(3)};--i:${i * 3 + k}" data-tip="Kelas ${GRADES[k]} · ${esc(b.name)}: ${fmtPct(v, 1)}">${gs.n ? fmtPct(v) : '–'}</td>`;
      }).join('')}</tr>`).join('') + '</tbody>';

    const allIdx = avg(rows.map(idxRow));
    const items = order.map((b) => { const rs = rows.filter((r) => r.bar.includes(b.code)); return { b, n: rs.length, idx: avg(rs.map(idxRow)) }; }).filter((x) => x.n >= CONFIG.minN);
    const vals = [...items.map((x) => x.idx), allIdx];
    const lo = Math.floor((Math.min(...vals) - 0.04) * 20) / 20; const hi = Math.ceil((Math.max(...vals) + 0.04) * 20) / 20;
    const pos = (v) => ((v - lo) / (hi - lo)) * 100;
    $('[data-bidx-desc]').innerHTML = `Rata-rata indeks 7 KAIH siswa yang memilih tiap hambatan. Garis tengah = rata-rata semua responden (<b>${fmtIdx(allIdx)}</b>).`;
    $('[data-bar-index]').innerHTML = items.sort((a, b) => a.idx - b.idx).map((x, i) => `<div class="drow dot-row" style="--i:${i}">
      <span class="drow-label">${x.b.name}</span>
      <div class="dot-track" style="--ref:${pos(allIdx).toFixed(2)}%"><span class="dot-mark ${x.idx >= allIdx ? 'pos' : 'neg'}" style="--x:${pos(x.idx).toFixed(2)}%" data-tip="${esc(x.b.name)}: indeks ${fmtIdx(x.idx)} (${fmtNum(x.n)} siswa)"></span></div>
      <span class="drow-val num ${x.idx >= allIdx ? 'up' : 'down'}">${fmtIdx(x.idx)}</span></div>`).join('');

    const pairs = new Map();
    rows.filter((r) => r.bar.length === 2).forEach((r) => { const k = [...r.bar].sort().join('+'); pairs.set(k, (pairs.get(k) || 0) + 1); });
    const top = [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const pm = top.length ? top[0][1] : 1;
    $('[data-bar-pairs]').innerHTML = top.length ? top.map(([k, c], i) => {
      const [a, b] = k.split('+');
      return `<li class="pair" style="--i:${i}"><span class="pair-rank">${i + 1}</span><span class="pair-names">${BAR[a].name.replace(/ \/ .*| atau .*|, .*/, '')} <i>+</i> ${BAR[b].name.replace(/ \/ .*| atau .*|, .*/, '')}</span>
        <span class="pair-bar"><span style="--w:${((c / pm) * 100).toFixed(1)}%"></span></span><b class="num">${fmtNum(c)}</b></li>`;
    }).join('') : '<li class="empty">Belum ada siswa yang memilih dua hambatan.</li>';
    $('[data-bar-clean]').textContent = `${fmtNum(DATA.issues.conflict)} isian memilih "Tidak ada hambatan" bersama hambatan lain (semua pengisian). Pilihan "Tidak ada hambatan" pada isian itu dibuang saat pembersihan.`;
  }

  /* ------------------------------------------------------------------
     Page: Laporan dan data
     ------------------------------------------------------------------ */
  // Dibuka di komputer sendiri (Live Server VS Code, file://): arahkan ke Apache XAMPP.
  const LOCAL_URL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:'
    ? `http://localhost/${(location.pathname.match(/\/(?:xampp\/)?htdocs\/([^/]+)\//i) || location.pathname.match(/^\/([^/]+)\/[^/]*$/) || [, 'web3d'])[1]}/`
    : '';

  function renderData() {
    const small = ROMBEL.filter((rb) => { const s = statsRombel(state.round, rb.name); return s.n > 0 && s.n < CONFIG.minN; }).length;
    const over = ROMBEL.filter((rb) => rb.size && statsRombel(state.round, rb.name).n > rb.size).map((rb) => rb.name);
    const tot = (k) => sum(ROUNDS, (r) => (r.isu && r.isu[k]) || 0);
    const noSize = ROMBEL.filter((rb) => !rb.size).length;
    const outside = ROMBEL.filter((rb) => rb.outside).length;
    const checks = [
      { ok: true, t: `${fmtNum(DATA.rows.length)} isian valid dari ${fmtNum(ROUNDS.length)} periode pengisian.` },
      { ok: DATA.issues.invalid + tot('dibuang_tidak_lengkap') === 0, t: `${fmtNum(DATA.issues.invalid + tot('dibuang_tidak_lengkap'))} isian dibuang karena kelas atau jawaban Soal 3–10 kosong.` },
      { ok: tot('duplikat') === 0, warn: true, t: `${fmtNum(tot('duplikat'))} isian ganda (siswa yang sama di periode yang sama) dibuang; yang dipakai isian terakhir.` },
      { ok: DATA.issues.conflict === 0, warn: true, t: `${fmtNum(DATA.issues.conflict)} isian Soal 11 memilih "Tidak ada hambatan" bersama hambatan lain, sudah dibersihkan.` },
      { ok: tot('hambatan_lebih_dari_2') === 0, warn: true, t: `${fmtNum(tot('hambatan_lebih_dari_2'))} isian Soal 11 memilih lebih dari 2 hambatan. Aktifkan validasi "maksimal 2" di Google Form.` },
      { ok: DATA.master && noSize === 0, warn: true, t: DATA.master ? `${fmtNum(noSize)} kelas belum diisi jumlah siswanya di Master Kelas, jadi partisipasinya belum bisa dihitung.` : 'Tab "Master Kelas" belum ada, jadi daftar kelas diambil dari isian dan partisipasi belum bisa dihitung.' },
      { ok: outside === 0, warn: true, t: `${fmtNum(outside)} nama kelas di isian tidak ada di Master Kelas (cek salah ketik di Form).` },
      { ok: over.length === 0, t: over.length ? `Responden melebihi jumlah siswa di ${over.join(', ')}. Cek Master Kelas atau isian ganda.` : 'Tidak ada kelas dengan responden melebihi jumlah siswa.' },
      { ok: small === 0, warn: true, t: `${fmtNum(small)} kelas di periode ${rLabel(roundById(state.round))} punya kurang dari ${CONFIG.minN} responden, rinciannya disembunyikan.` },
    ];
    $('[data-checks]').innerHTML = checks.map((c, i) => `<li class="check ${c.ok ? (c.info ? 'info' : 'ok') : c.warn ? 'warn' : 'bad'}" style="--i:${i}"><span class="check-ico" aria-hidden="true"></span>${esc(c.t)}</li>`).join('');
    $('[data-min-n]').textContent = CONFIG.minN;

    const rangeBar = $('[data-report-range]');
    if (isPublic() || !roundsWithData().length) {
      rangeBar.hidden = true;
      $('[data-reports]').innerHTML = isPublic()
        ? '<li class="empty">Unduh laporan khusus guru. Gunakan tombol <b>Masuk guru</b> di sidebar.</li>'
        : '<li class="empty">Belum ada data untuk dilaporkan.</li>';
      return;
    }
    rangeBar.hidden = false;
    bindRange($('[data-report-from]'), $('[data-report-to]'));
    $('[data-reports]').innerHTML = Object.entries(REPORTS).map(([k, r], i) => `<li class="report" style="--i:${i}">
      <div><h3>${r.label}</h3><p>${r.desc}</p></div>
      <div class="report-btns">
        <button class="btn btn-primary btn-sm" type="button" data-report="${k}" data-fmt="pdf">PDF</button>
        <button class="btn btn-ghost btn-sm" type="button" data-report="${k}" data-fmt="word">Word</button>
        <button class="btn btn-ghost btn-sm" type="button" data-report="${k}" data-fmt="csv">CSV</button>
      </div></li>`).join('');
    $$('[data-report]').forEach((b) => b.addEventListener('click', () => {
      const r = REPORTS[b.dataset.report]; const out = generalReport(b.dataset.report);
      if (b.dataset.fmt === 'csv') { downloadCSV(`${out.name}.csv`, out.rows); toast(`${r.label} diunduh.`); } else exportDoc(b.dataset.fmt, out.name, out.html);
    }));
  }
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /* Laporan CSV (pemisah titik koma untuk Excel lokal Indonesia) */
  const pctCell = (v) => nf(1).format(v * 100);
  function downloadCSV(filename, rows) {
    const cell = (s) => { s = String(s); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  const REPORTS = {
    rombel: {
      label: 'Rekap per rombel', desc: 'Partisipasi, indeks tiap kebiasaan, indeks 7 KAIH, dan HP di kasur.',
      build() {
        return [['Rombel', 'Jenjang', 'Jumlah siswa', 'Responden', 'Partisipasi (%)', ...HABITS.map((h) => `${h.name} (indeks)`), 'Indeks 7 KAIH', 'HP di kasur >= 2 malam (%)'],
          ...rombelScope().map((rb) => { const s = statsRombel(state.round, rb.name); const ok = s.n >= CONFIG.minN;
            return [rb.name, rb.grade, rb.size || '', s.n, rb.size ? pctCell(s.n / rb.size) : '', ...(ok ? [...s.index.map(pctCell), pctCell(s.overall), pctCell(s.gawaiRisk)] : Array(9).fill('sampel kecil'))]; })];
      },
    },
    jenjang: {
      label: 'Rekap per jenjang', desc: 'Ringkasan yang sama per kelas X, XI, dan XII.',
      build() {
        return [['Jenjang', 'Jumlah siswa', 'Responden', 'Partisipasi (%)', ...HABITS.map((h) => `${h.name} (indeks)`), 'Indeks 7 KAIH', 'HP di kasur >= 2 malam (%)'],
          ...GRADES.map((g) => { const s = statsOf(state.round, g); return [g, popOf(g), s.n, pctCell(s.n / popOf(g)), ...s.index.map(pctCell), pctCell(s.overall), pctCell(s.gawaiRisk)]; })];
      },
    },
    kebiasaan: {
      label: 'Sebaran jawaban', desc: 'Persentase 0, 1, 2, dan 3 hari untuk Soal 3–10.',
      build() {
        const s = statsOf(state.round);
        return [['Soal', 'Kebiasaan', '0 hari (%)', '1 hari (%)', '2 hari (%)', '3 hari (%)', 'Indeks', 'Konsisten (%)'],
          ...HABITS.map((h, i) => [h.soal, h.name, ...s.dist[i].map((c) => pctCell(c / (s.n || 1))), pctCell(s.index[i]), pctCell(s.cons[i])]),
          [10, 'HP di kasur > 30 menit (malam)', ...s.gawai.map((c) => pctCell(c / (s.n || 1))), '', '']];
      },
    },
    tren: {
      label: 'Tren antar periode', desc: 'Responden, partisipasi, dan indeks tiap kebiasaan untuk setiap periode di rentang.',
      build(list = roundsWithData()) {
        return [['Pengisian', 'Tanggal', 'Responden', 'Partisipasi (%)', ...HABITS.map((h) => `${h.name} (indeks)`), 'Indeks 7 KAIH', 'HP di kasur >= 2 malam (%)'],
          ...list.map((r) => { const s = statsOf(r.id); const pop = popOf(); return [r.label, r.main ? isoDate(r.main) : '', s.n, pop ? pctCell(s.n / pop) : '', ...(s.n ? [...s.index.map(pctCell), pctCell(s.overall), pctCell(s.gawaiRisk)] : Array(9).fill(''))]; })];
      },
    },
    hambatan: {
      label: 'Rekap hambatan', desc: 'Jumlah dan persentase tiap hambatan Soal 11, total dan per jenjang.',
      build() {
        const s = statsOf(state.round); const gs = GRADES.map((g) => statsOf(state.round, g));
        return [['Hambatan', 'Jumlah', 'Responden (%)', 'Kelas X (%)', 'Kelas XI (%)', 'Kelas XII (%)'],
          ...BARRIERS.map((b) => [b.name, s.bars[b.code], pctCell(s.bars[b.code] / (s.n || 1)), ...gs.map((g) => pctCell(g.bars[b.code] / (g.n || 1)))])];
      },
    },
  };

  /* ------------------------------------------------------------------
     Laporan rapi (Word dan PDF): kop sekolah, tabel, kesimpulan, tanda tangan.
     Word = dokumen HTML yang dibuka Microsoft Word (.doc); PDF = dialog cetak browser
     ("Simpan sebagai PDF"). Keduanya memakai satu templat yang sama.
     ------------------------------------------------------------------ */
  const REPORT_CSS = `
    @page { size: A4; margin: 16mm 15mm; }
    @page land { size: A4 landscape; margin: 14mm 12mm; }
    @page Section1 { size: 595.3pt 841.9pt; margin: 45pt 42pt; }
    @page Section2 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 40pt 36pt; }
    div.Section1 { page: Section1; } div.Section2 { page: Section2; }
    body { font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 10.5pt; color: #222; }
    .land { page: land; }
    .kop { width: 100%; border-collapse: collapse; }
    .kop td { vertical-align: middle; padding: 0 8pt 0 0; }
    .kop-school { font-size: 15pt; font-weight: bold; color: #2b2350; letter-spacing: .5pt; }
    .kop-sub { font-size: 10pt; color: #555; }
    hr.kop-line { border: 0; border-top: 2pt solid #4b2fb8; margin: 6pt 0 10pt; }
    h1 { font-size: 15pt; color: #3b2a8a; margin: 6pt 0 2pt; }
    h2 { font-size: 12pt; color: #3b2a8a; border-bottom: 1pt solid #c9bdf5; padding-bottom: 2pt; margin: 14pt 0 6pt; }
    p { margin: 4pt 0; line-height: 1.45; }
    .sub { color: #555; margin-bottom: 8pt; }
    table.meta { border-collapse: collapse; margin: 4pt 0 6pt; }
    table.meta td { padding: 2pt 10pt 2pt 0; vertical-align: top; }
    table.meta td.k { color: #555; white-space: nowrap; }
    table.data { border-collapse: collapse; width: 100%; margin: 4pt 0 6pt; }
    table.data th { background: #ece6fb; color: #2b2350; font-weight: bold; border: .75pt solid #b9addf; padding: 4pt 5pt; text-align: left; vertical-align: bottom; }
    table.data td { border: .75pt solid #d6cfee; padding: 3.5pt 5pt; vertical-align: top; }
    table.data tr:nth-child(even) td { background: #faf8ff; }
    .small table.data { font-size: 8.5pt; }
    .num { text-align: right; white-space: nowrap; }
    .great { color: #0f6e50; font-weight: bold; } .good { color: #2f5fb8; font-weight: bold; }
    .fair { color: #a35a0c; font-weight: bold; } .low { color: #b8325a; font-weight: bold; }
    .box { border: .75pt solid #c9bdf5; background: #f6f2ff; padding: 6pt 8pt; margin: 6pt 0; }
    .note { color: #666; font-size: 9pt; }
    table.sign { width: 100%; margin-top: 22pt; border-collapse: collapse; }
    table.sign td { width: 50%; text-align: center; vertical-align: top; padding: 0 10pt; }
    .sign-space { height: 52pt; }
    h2 { page-break-after: avoid; } tr, .box, table.sign { page-break-inside: avoid; }
    th.num { text-align: right; }
    .foot { margin-top: 16pt; color: #777; font-size: 8.5pt; border-top: .75pt solid #ddd; padding-top: 4pt; }`;
  const LOGO_URL = new URL('assets/brand/logo.png', location.href).href;
  const td = (v, num) => `<td${num ? ' class="num"' : ''}>${esc(v ?? '')}</td>`;
  const isNumCell = (v) => /^[-−+]?[\d.,]+%?$/.test(String(v ?? '').trim());
  // Tabel dari baris laporan (baris pertama = judul kolom).
  function htmlTable(rows) {
    const [head, ...body] = rows;
    const numCol = head.map((_, i) => body.length && body.every((r) => r[i] === '' || isNumCell(r[i])));
    return `<table class="data"><thead><tr>${head.map((h, i) => `<th${numCol[i] ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((v) => td(v, isNumCell(v))).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function reportHtml({ title, subtitle, meta = [], body, landscape = false, sign = null }) {
    const today = fmtDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' });
    return `<!doctype html><html lang="id" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>${REPORT_CSS}</style></head>
<body class="${landscape ? 'land small' : ''}"><div class="${landscape ? 'Section2' : 'Section1'}">
<table class="kop"><tr><td style="width:60pt"><img src="${LOGO_URL}" width="52" height="65" alt="Logo SMA Plus PGRI Cibinong"></td>
<td><div class="kop-school">SMA PLUS PGRI CIBINONG</div><div class="kop-sub">Pemantauan 7 Kebiasaan Anak Indonesia Hebat (7 KAIH) · Tim VERTIKAL</div></td></tr></table>
<hr class="kop-line">
<h1>${esc(title)}</h1>${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ''}
${meta.length ? `<table class="meta">${meta.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>: ${esc(v)}</td></tr>`).join('')}</table>` : ''}
${body}
${sign ? `<table class="sign"><tr><td>Mengetahui,<br>Kepala SMA Plus PGRI Cibinong<div class="sign-space"></div>(.................................................)</td>
<td>Cibinong, ${today}<br>${esc(sign)}<div class="sign-space"></div>(.................................................)</td></tr></table>` : ''}
<p class="foot">Dibuat dari Dashboard Monitoring 7 KAIH pada ${today}. Hasil kuesioner disajikan per kelompok tanpa nama siswa; kelompok dengan kurang dari ${CONFIG.minN} responden tidak dirinci. Responden tiap periode bisa berbeda, jadi perubahan antarperiode adalah perubahan kelompok.</p>
</div></body></html>`;
  }
  function downloadWord(name, html) {
    const url = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${name}.doc`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("File Word diunduh. Buka dengan Microsoft Word atau Google Docs.");
  }
  // PDF lewat dialog cetak: pilih "Simpan sebagai PDF". Judul dokumen menjadi nama file.
  function printPdf(name, html) {
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    f.onload = () => {
      const w = f.contentWindow;
      w.document.title = name;
      const img = w.document.images[0];
      const go = () => { w.focus(); w.print(); setTimeout(() => f.remove(), 60000); };
      if (img && !img.complete) { img.onload = go; img.onerror = go; } else go();
    };
    f.srcdoc = html;
    document.body.append(f);
    toast('Pilih "Simpan sebagai PDF" di dialog cetak.');
  }
  function exportDoc(fmt, name, html) { if (fmt === 'word') downloadWord(name, html); else printPdf(name, html); }
  // Jalankan fungsi seolah periode lain sedang dipilih (laporan untuk periode tertentu).
  function atRound(id, fn) { const keep = state.round; state.round = id; try { return fn(); } finally { state.round = keep; } }

  /* Rentang periode untuk laporan (dari–sampai) */
  function rangeOptions(sel, value) {
    sel.innerHTML = roundsWithData().map((r) => `<option value="${r.id}"${r.id === value ? ' selected' : ''}>${esc(r.label)}</option>`).join('');
  }
  function reportRange() {
    const has = roundsWithData().map((r) => r.id);
    let from = state.rangeFrom && has.includes(state.rangeFrom) ? state.rangeFrom : has[0];
    let to = state.rangeTo && has.includes(state.rangeTo) ? state.rangeTo : state.round;
    if (from > to) [from, to] = [to, from];
    return { from, to, rounds: roundsWithData().filter((r) => r.id >= from && r.id <= to) };
  }
  const rangeText = ({ from, to }) => (from === to ? rLabel(roundById(to)) : `${rLabel(roundById(from))} s.d. ${rLabel(roundById(to))}`);
  function bindRange(fromSel, toSel, onChange) {
    const { from, to } = reportRange();
    rangeOptions(fromSel, from); rangeOptions(toSel, to);
    fromSel.onchange = () => { state.rangeFrom = Number(fromSel.value); onChange?.(); };
    toSel.onchange = () => { state.rangeTo = Number(toSel.value); onChange?.(); };
  }

  function rangeTrend(list) {
    const ok = list.map((r) => ({ r, s: statsOf(r.id) })).filter((x) => x.s.n >= CONFIG.minN);
    if (ok.length < 2) return 'Arah perkembangan belum bisa disimpulkan karena baru ada satu periode berisi data pada rentang ini.';
    const a = ok[0]; const b = ok[ok.length - 1];
    return `Kebiasaan siswa ${trendWord(b.s.overall - a.s.overall)} dari ${rLabel(a.r)} ke ${rLabel(b.r)} (Indeks 7 KAIH ${fmtIdx(a.s.overall)} menjadi ${fmtIdx(b.s.overall)}).${b.s.n < a.s.n * 0.6 ? ' Jumlah pengisi turun jauh, jadi periode terakhir belum tentu mewakili semua siswa.' : ''}`;
  }

  /* Laporan umum (kartu di menu Laporan): tabel + kesimpulan singkat */
  const scopeText = () => (state.kelas ? `Kelas ${state.kelas}` : state.grade === 'all' ? 'Seluruh sekolah' : `Jenjang kelas ${state.grade}`);
  const fillText = (id) => {
    const s = statsOf(id); const pop = popOf();
    return pop ? `${fmtNum(s.n)} dari ${fmtNum(pop)} siswa mengisi (${fmtPct(s.n / pop, 1)})` : `${fmtNum(s.n)} siswa mengisi`;
  };
  const REPORT_VERDICT = { rombel: 'kelas', jenjang: 'kebiasaan', kebiasaan: 'kebiasaan', hambatan: 'hambatan' };
  // Laporan satu periode diulang untuk tiap periode di rentang; tren memakai seluruh rentang sekaligus.
  function generalReport(key) {
    const r = REPORTS[key]; const range = reportRange();
    const meta = [['Cakupan', scopeText()], ['Rentang periode', rangeText(range)], ['Jumlah periode', `${range.rounds.length} periode`]];
    const name = `7kaih-${key}-${slug(state.kelas || (state.grade === 'all' ? 'sekolah' : `kelas-${state.grade}`))}-${slug(rangeText(range))}`;
    if (key === 'tren') {
      const rows = r.build(range.rounds);
      return { name, rows, html: reportHtml({
        title: 'Laporan Tren Antar Periode', subtitle: r.desc, landscape: true, meta,
        body: `<div class="box"><b>Kesimpulan:</b> ${esc(rangeTrend(range.rounds))}</div><h2>Tabel</h2>${htmlTable(rows)}`,
      }) };
    }
    const parts = range.rounds.map((p) => ({ p, rows: atRound(p.id, () => r.build()) }));
    const v = REPORT_VERDICT[key];
    const body = parts.map(({ p, rows }, i) => `${i && parts.length > 1 ? '<br clear="all" style="page-break-before:always">' : ''}
      <h2>${esc(rLabel(p))}${rRange(p) ? ` (diisi ${esc(rRange(p))})` : ''}</h2>
      <p><b>Pengisian:</b> ${esc(fillText(p.id))}.</p>
      ${v && statsOf(p.id).n ? `<div class="box"><b>Kesimpulan:</b> ${esc(atRound(p.id, () => VERDICT[v]()))}</div>` : ''}
      ${htmlTable(rows)}`).join('');
    const head = parts[0].rows[0];
    return { name, html: reportHtml({ title: `Laporan ${r.label}`, subtitle: r.desc, landscape: head.length > 8, meta, body }),
      rows: [['Periode', ...head], ...parts.flatMap(({ p, rows }) => rows.slice(1).map((x) => [p.label, ...x]))] };
  }

  /* Rapor kelas untuk wali kelas: partisipasi, hasil, perkembangan, hambatan, kesimpulan */
  function raporReport(name) {
    const rb = ROMBEL.find((x) => x.name === name); const g = rb.grade;
    const range = reportRange(); const list = range.rounds;
    const last = [...list].reverse().find((r) => statsRombel(r.id, name).n >= CONFIG.minN) || list[list.length - 1];
    const s = statsRombel(last.id, name); const gs = statsOf(last.id, g); const all = statsOf(last.id, 'all');
    const okRounds = list.filter((r) => statsRombel(r.id, name).n >= CONFIG.minN);
    const partRows = [['Periode', 'Tanggal isi', 'Mengisi', 'Jumlah siswa', 'Partisipasi'], ...list.map((r) => {
      const n = statsRombel(r.id, name).n;
      return [r.label, rRange(r) || '–', fmtNum(n), rb.size ? fmtNum(rb.size) : '–', rb.size ? fmtPct(n / rb.size, 1) : '–'];
    })];
    const avgN = list.length ? sum(list, (r) => statsRombel(r.id, name).n) / list.length : 0;
    let body = `<h2>1. Partisipasi pengisian</h2>${htmlTable(partRows)}
      <p>Rata-rata <b>${nf(0).format(avgN)}${rb.size ? ` dari ${fmtNum(rb.size)}` : ''} siswa</b> mengisi kuesioner tiap periode${rb.size ? ` (${fmtPct(avgN / rb.size)})` : ''}. Target partisipasi sekolah ${fmtPct(CONFIG.target)}.</p>`;
    if (s.n < CONFIG.minN) {
      body += `<div class="box">Pada rentang ini belum ada periode dengan minimal ${CONFIG.minN} responden, jadi hasil kebiasaan kelas belum bisa dirinci demi menjaga anonimitas siswa.</div>`;
    } else {
      const habitRows = `<table class="data"><thead><tr><th>Kebiasaan</th><th>Indeks kelas</th><th>Kelas ${g}</th><th>Sekolah</th><th>Status</th><th>Konsisten 3/3 hari</th></tr></thead><tbody>${HABITS.map((h, i) => {
        const [, lv, cls] = levelOf(s.index[i]);
        return `<tr>${td(h.name)}${td(fmtIdx(s.index[i]), true)}${td(fmtIdx(gs.index[i]), true)}${td(fmtIdx(all.index[i]), true)}<td class="${cls}">${lv}</td>${td(fmtPct(s.cons[i]), true)}</tr>`;
      }).join('')}<tr>${td('Indeks 7 KAIH')}${td(fmtIdx(s.overall), true)}${td(fmtIdx(gs.overall), true)}${td(fmtIdx(all.overall), true)}<td class="${levelOf(s.overall)[2]}">${levelOf(s.overall)[1]}</td>${td('')}</tr></tbody></table>`;
      body += `<h2>2. Hasil kebiasaan (periode ${esc(rLabel(last))}, ${fmtNum(s.n)} responden)</h2>${habitRows}
        <p class="note">Indeks 0–100 = rata-rata hari menjalankan kebiasaan dalam 3 hari terakhir ÷ 3 × 100. Status: ≥ 85 sangat baik, 70–85 baik, 55–70 cukup, &lt; 55 perlu perhatian.</p>`;
      const trendRows = [['Periode', `Kelas ${name}`, `Kelas ${g}`, 'Sekolah'], ...list.map((r) => {
        const k = statsRombel(r.id, name);
        return [r.label, k.n >= CONFIG.minN ? fmtIdx(k.overall) : 'data belum cukup', fmtIdx(statsOf(r.id, g).overall), fmtIdx(statsOf(r.id, 'all').overall)];
      })];
      body += `<h2>3. Perkembangan Indeks 7 KAIH</h2>${htmlTable(trendRows)}`;
      const bars = BARRIERS.filter((b) => b.code !== 'F').sort((a, b) => s.bars[b.code] - s.bars[a.code]).slice(0, 3);
      body += `<h2>4. Hambatan yang paling sering dipilih</h2>${htmlTable([['Hambatan', 'Dipilih', '% responden'], ...bars.map((b) => [b.name, fmtNum(s.bars[b.code]), fmtPct(s.bars[b.code] / s.n)]), ['Tidak ada hambatan', fmtNum(s.bars.F), fmtPct(s.bars.F / s.n)]])}`;
      // Kesimpulan berbahasa sehari-hari.
      const order = [...HABITS.keys()].sort((a, b) => s.index[b] - s.index[a]);
      const lv = levelOf(s.overall)[1]; const diff = s.overall - gs.overall;
      const lines = [`Secara umum kebiasaan siswa kelas ${name} ${lv === 'perlu perhatian' ? 'masih perlu perhatian' : `sudah ${lv}`} (Indeks 7 KAIH ${fmtIdx(s.overall)}), ${diff >= 0 ? 'di atas' : 'di bawah'} rata-rata kelas ${g} (${fmtPts(diff)} poin).`,
        `Kebiasaan terkuat adalah ${HABITS[order[0]].name.toLowerCase()}, sedangkan ${HABITS[order[6]].name.toLowerCase()} dan ${HABITS[order[5]].name.toLowerCase()} paling perlu didorong.`];
      if (okRounds.length >= 2) {
        const a = statsRombel(okRounds[0].id, name); const b = statsRombel(okRounds[okRounds.length - 1].id, name);
        lines.push(`Sejak ${rLabel(okRounds[0])}, indeks kelas ${trendWord(b.overall - a.overall)} (${fmtIdx(a.overall)} menjadi ${fmtIdx(b.overall)}).`);
      }
      if (rb.size) lines.push(s.n / rb.size < CONFIG.target ? `Partisipasi periode terakhir ${fmtPct(s.n / rb.size)}, masih di bawah target ${fmtPct(CONFIG.target)}; ajak siswa yang belum mengisi.` : `Partisipasi periode terakhir ${fmtPct(s.n / rb.size)}, sudah memenuhi target.`);
      body += `<h2>5. Kesimpulan dan saran</h2><div class="box">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
        <p><b>Saran tindak lanjut:</b></p><ul>${[order[6], order[5]].map((i) => `<li><b>${esc(HABITS[i].name)}:</b> ${esc(ADVICE[i])}</li>`).join('')}<li><b>${esc(bars[0].name)}:</b> bahas bersama siswa cara mengatasinya, karena paling banyak dipilih sebagai hambatan.</li></ul>`;
    }
    return { name: `rapor-7kaih-${slug(name)}-${slug(rangeText(range))}`, html: reportHtml({
      title: `Rapor Kebiasaan Kelas ${name}`, subtitle: 'Laporan untuk wali kelas: hasil kuesioner 7 KAIH kelas ini dibanding jenjang dan sekolah.',
      meta: [['Kelas', name], ['Jenjang', `Kelas ${g}`], ['Wali kelas', '.................................................'], ['Rentang periode', rangeText(range)], ['Jumlah siswa', rb.size ? `${fmtNum(rb.size)} siswa` : 'belum diisi di Master Kelas']],
      body, sign: 'Wali Kelas',
    }) };
  }

  /* ------------------------------------------------------------------
     Toast + tooltip
     ------------------------------------------------------------------ */
  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    $('#toasts').append(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 4000);
  }
  const tipEl = $('.tip');
  const placeTip = (e) => {
    const w = tipEl.offsetWidth; const h = tipEl.offsetHeight;
    tipEl.style.left = `${clamp(e.clientX - w / 2, 8, window.innerWidth - w - 8)}px`;
    tipEl.style.top = `${e.clientY - h - 14 < 8 ? e.clientY + 18 : e.clientY - h - 14}px`;
  };
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (!t || !t.dataset.tip) { tipEl.hidden = true; return; }
    tipEl.textContent = t.dataset.tip; tipEl.hidden = false; placeTip(e);
  });
  document.addEventListener('pointermove', (e) => { if (!tipEl.hidden) placeTip(e); });
  document.addEventListener('scroll', () => { tipEl.hidden = true; }, { passive: true });


  /* ------------------------------------------------------------------
     Page: Rapor kelas (untuk wali kelas; hanya angka kelas, tanpa nama siswa)
     ------------------------------------------------------------------ */
  const byClassName = (a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade) || a.name.localeCompare(b.name, 'id', { numeric: true });
  function classOptions(selected, first) {
    return `<option value="">${first}</option>${GRADES.map((g) => {
      const l = ROMBEL.filter((rb) => rb.grade === g).sort(byClassName);
      return l.length ? `<optgroup label="Kelas ${g}">${l.map((rb) => `<option value="${esc(rb.name)}"${rb.name === selected ? ' selected' : ''}>${esc(rb.name)}</option>`).join('')}</optgroup>` : '';
    }).join('')}`;
  }
  function renderRapor() {
    const sel = $('[data-rapor-kelas]');
    sel.innerHTML = classOptions(state.kelas, 'Pilih kelas…');
    const parts = $$('[data-rapor-part]');
    const r = roundById(state.round);
    const rb = state.kelas ? ROMBEL.find((x) => x.name === state.kelas) : null;
    if (!rb) {
      $('[data-rapor-title]').textContent = 'Rapor kelas';
      $('[data-rapor-desc]').textContent = 'Pilih kelas untuk melihat rapor kebiasaan kelas itu per periode, dibanding jenjang dan seluruh sekolah. Yang tampil hanya angka kelas, tanpa nama siswa.';
      $('[data-rapor-kpis]').innerHTML = '';
      $('[data-rapor-export]').hidden = true;
      parts.forEach((p) => { p.hidden = true; });
      return;
    }
    $('[data-rapor-export]').hidden = !roundsWithData().length;
    if (roundsWithData().length) bindRange($('[data-rapor-from]'), $('[data-rapor-to]'));
    const s = statsRombel(r.id, rb.name);
    const gs = statsOf(r.id, rb.grade);
    const all = statsOf(r.id, 'all');
    const part = partOf(s.n, rb.size);
    $('[data-rapor-title]').textContent = `Rapor ${rb.name}`;
    $('[data-rapor-desc]').textContent = `${rLabel(r)}${rRange(r) ? ` (diisi ${rRange(r)})` : ''} · ${fmtNum(s.n)} responden${rb.size ? ` dari ${fmtNum(rb.size)} siswa (${fmtPct(part)})` : ''}. Dibandingkan dengan kelas ${rb.grade} dan seluruh sekolah.`;
    if (s.n < CONFIG.minN) {
      $('[data-rapor-kpis]').innerHTML = `<p class="rapor-hidden">${s.n ? `Hanya ${fmtNum(s.n)} responden` : 'Belum ada responden'} pada periode ini. Untuk menjaga anonimitas, rapor kelas baru ditampilkan bila ada minimal ${CONFIG.minN} responden. Pilih periode lain atau dorong siswa mengisi.</p>`;
      parts.forEach((p) => { p.hidden = true; });
      return;
    }
    parts.forEach((p) => { p.hidden = false; });
    const kpis = [
      { cls: 'kpi-lilac', label: 'Indeks 7 KAIH (0–100)', v: s.overall, fmt: fmtIdx, meta: trendTag(s.overall - gs.overall, `dari rata-rata kelas ${rb.grade}`) },
      { cls: 'kpi-peach', label: 'Kebiasaan konsisten per siswa', v: s.consAvg, fmt: (v) => `${nf(1).format(v)} dari 7`, meta: `Kelas ${rb.grade}: ${nf(1).format(gs.consAvg)} dari 7` },
      { cls: 'kpi-sky', label: 'HP di kasur ≥ 2 malam', v: s.gawaiRisk, fmt: (v) => fmtPct(v, 1), meta: trendTag(s.gawaiRisk - gs.gawaiRisk, `dari rata-rata kelas ${rb.grade}`, true) },
    ];
    $('[data-rapor-kpis]').innerHTML = kpis.map((k, i) => `<div class="kpi ${k.cls}" style="--i:${i}"><p class="kpi-label">${k.label}</p><p class="kpi-value num" data-rk="${i}"></p><p class="kpi-meta">${k.meta}</p></div>`).join('');
    kpis.forEach((k, i) => countTo($(`[data-rk="${i}"]`), k.v, k.fmt));
    revealNow($$('[data-rapor-kpis] .kpi'));

    $('[data-rapor-table]').innerHTML = `<thead><tr><th scope="col">Kebiasaan</th><th scope="col">Kelas</th><th scope="col">Kelas ${rb.grade}</th><th scope="col">Sekolah</th><th scope="col">Selisih</th><th scope="col">Konsisten</th></tr></thead><tbody>${HABITS.map((h, i) => {
      const d = s.index[i] - gs.index[i];
      return `<tr style="--i:${i}"><th scope="row"><span class="dot" style="--c:${h.color}"></span>${h.name}</th>
        <td class="num strong">${fmtIdx(s.index[i])}</td><td class="num">${fmtIdx(gs.index[i])}</td><td class="num">${fmtIdx(all.index[i])}</td>
        <td class="num ${d >= 0.0005 ? 'up' : d <= -0.0005 ? 'down' : ''}">${fmtPts(d)}</td><td class="num">${fmtPct(s.cons[i])}</td></tr>`;
    }).join('')}</tbody>`;

    // Catatan otomatis: temuan dari angka kelas, bukan penilaian siswa.
    const order = [...HABITS.keys()].sort((a, b) => s.index[b] - s.index[a]);
    const gaps = HABITS.map((_, i) => s.index[i] - gs.index[i]);
    const worstGap = gaps.indexOf(Math.min(...gaps));
    const notes = [
      { tone: 'good', title: `${HABITS[order[0]].name} paling kuat`, text: `Indeks ${fmtIdx(s.index[order[0]])}; ${fmtPct(s.cons[order[0]])} responden menjalankannya 3 dari 3 hari.` },
      { tone: 'warn', title: `${HABITS[order[6]].name} paling perlu didorong`, text: `Indeks ${fmtIdx(s.index[order[6]])}; ${fmtPct(s.dist[order[6]][0] / s.n)} responden tidak sekali pun menjalankannya dalam 3 hari terakhir.` },
    ];
    if (gaps[worstGap] < -0.03) notes.push({ tone: 'info', title: `${HABITS[worstGap].name} di bawah rata-rata jenjang`, text: `${fmtPts(gaps[worstGap])} poin dibanding kelas ${rb.grade} (${fmtIdx(gs.index[worstGap])}).` });
    const prevOk = ROUNDS.filter((x) => x.id < r.id).map((x) => ({ x, st: statsRombel(x.id, rb.name) })).filter((p) => p.st.n >= CONFIG.minN).pop();
    if (prevOk) {
      const d = s.overall - prevOk.st.overall;
      notes.push({ tone: d >= 0 ? 'good' : 'warn', title: `Indeks 7 KAIH ${d >= 0 ? 'naik' : 'turun'} dari ${rLabel(prevOk.x)}`, text: `${fmtIdx(prevOk.st.overall)} menjadi ${fmtIdx(s.overall)} (${fmtPts(d)} poin). Responden tiap periode bisa berbeda.` });
    }
    const topBar = BARRIERS.filter((b) => b.code !== 'F').sort((a, b) => s.bars[b.code] - s.bars[a.code])[0];
    notes.push({ tone: 'neutral', title: `Hambatan teratas: ${topBar.name}`, text: `Dipilih ${fmtPct(s.bars[topBar.code] / s.n)} responden kelas ini.` });
    if (part !== null && part < CONFIG.target) notes.push({ tone: 'warn', title: 'Partisipasi di bawah target', text: `${fmtPct(part)} dari target ${fmtPct(CONFIG.target)}. Ingatkan siswa yang belum mengisi.` });
    $('[data-rapor-notes]').innerHTML = notes.slice(0, 5).map((it, i) => `<li class="insight ${it.tone}" style="--i:${i}"><span class="insight-ico" aria-hidden="true"></span><div><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div></li>`).join('');

    const series = ROUNDS.map((x) => ({ k: statsRombel(x.id, rb.name), g: statsOf(x.id, rb.grade), a: statsOf(x.id, 'all') }));
    lineChart($('[data-rapor-trend]'), {
      labels: roundLabels(), height: 240, lo: 0, hi: 1,
      series: [
        { name: 'Sekolah', color: '#2b2350', width: 2, dash: true, values: series.map((p) => (p.a.n ? p.a.overall : null)) },
        { name: `Kelas ${rb.grade}`, color: '#f27fa2', width: 2.5, values: series.map((p) => (p.g.n ? p.g.overall : null)) },
        { name: rb.name, color: '#7c5ce6', width: 4, area: true, labels: true, values: series.map((p) => (p.k.n >= CONFIG.minN ? p.k.overall : null)) },
      ],
      fmt: fmtIdx, fmtAxis: (t) => nf(0).format(t * 100),
    });

    const bars = [...BARRIERS].sort((a, b) => s.bars[b.code] - s.bars[a.code]);
    const max = Math.max(...bars.map((b) => s.bars[b.code] / s.n), 0.01);
    $('[data-rapor-bars]').innerHTML = bars.map((b, i) => hrow({
      label: b.name, value: fmtPct(s.bars[b.code] / s.n), frac: s.bars[b.code] / s.n / max, i,
      color: b.code === 'F' ? 'var(--chart-teal)' : b.code === 'B' ? 'var(--chart-coral)' : 'var(--amber)', tip: `${b.name}: ${fmtNum(s.bars[b.code])} responden`,
    })).join('');
  }
  $('[data-rapor-kelas]').addEventListener('change', (e) => {
    state.kelas = e.target.value || null;
    if (state.kelas) setGrade(gradeOf(state.kelas) || 'all');
    buildKelasCtl();
    rerender();
  });
  $$('[data-rapor-dl]').forEach((b) => b.addEventListener('click', () => {
    if (!state.kelas || isPublic()) return;
    const out = raporReport(state.kelas);
    exportDoc(b.dataset.raporDl, out.name, out.html);
  }));

  /* Penjaga: halaman khusus guru di tampilan publik, dan filter kelas dengan responden < minN */
  const TEACHER_ONLY = { kelas: 'Rincian per kelas', rapor: 'Rapor kelas' };
  function applyGuard() {
    const g = $('[data-scope-guard]');
    if (isPublic() && TEACHER_ONLY[state.route]) {
      $('#main').classList.add('is-guarded');
      g.hidden = false;
      g.innerHTML = `<h2 class="panel-title">${TEACHER_ONLY[state.route]} khusus guru</h2>
        <p class="panel-desc">Tampilan umum hanya menampilkan hasil seluruh sekolah dan per jenjang (X, XI, XII). Wali kelas dan guru dapat masuk untuk melihat hasil tiap kelas.</p>
        ${DATA.loginAvailable ? '<button class="btn btn-primary" type="button" data-guard-login>Masuk guru</button>' : ''}`;
      $('[data-guard-login]')?.addEventListener('click', () => showLiveGate(true));
      return true;
    }
    const s = state.kelas && !['data', 'rapor'].includes(state.route) ? statsOf(state.round) : null;
    const hide = !!s && s.n < CONFIG.minN;
    $('#main').classList.toggle('is-guarded', hide);
    g.hidden = !hide;
    if (hide) {
      g.innerHTML = `<h2 class="panel-title">Rincian kelas ${esc(state.kelas)} disembunyikan</h2>
        <p class="panel-desc">${s.n ? `Hanya ${fmtNum(s.n)} responden` : 'Belum ada responden'} pada ${esc(rLabel(roundById(state.round)))}. Untuk menjaga anonimitas, data satu kelas baru ditampilkan bila ada minimal ${CONFIG.minN} responden.</p>
        <button class="btn btn-ghost" type="button" data-guard-clear>Lihat semua kelas</button>`;
      $('[data-guard-clear]').addEventListener('click', () => { state.kelas = null; buildKelasCtl(); rerender(); });
    }
    return hide;
  }

  /* Login guru (satu login juga membuka Vertikal AI). Hanya dibuka dari tombol "Masuk guru". */
  function showLiveGate() {
    let el = $('.live-gate');
    if (!el) {
      el = document.createElement('div');
      el.className = 'live-gate';
      el.innerHTML = `<form class="live-card" role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <span class="live-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>
        <h2 id="gate-title">Masuk guru</h2>
        <p>Untuk guru dan wali kelas SMA Plus PGRI Cibinong: membuka hasil per kelas, Rapor kelas, unduhan laporan, dan Vertikal AI. Nama siswa tidak pernah ditampilkan.</p>
        <input type="password" autocomplete="current-password" maxlength="200" placeholder="Kode akses guru" aria-label="Kode akses guru" required>
        <span class="gate-err" role="alert"></span>
        <div class="gate-actions"><button class="btn btn-primary" type="submit">Masuk</button><button class="link-btn" type="button" data-gate-skip>Batal</button></div>
      </form>`;
      document.body.append(el);
      const form = $('form', el); const inp = $('input', el);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!inp.value) return;
        $('button[type="submit"]', el).disabled = true;
        const r = await window.VertikalAPI.login(inp.value);
        $('button[type="submit"]', el).disabled = false;
        if (r.ok) { inp.value = ''; el.hidden = true; $('.gate-err', el).textContent = ''; } // event vertikal:auth memuat ulang data
        else { $('.gate-err', el).textContent = r.error || 'Gagal masuk.'; inp.select(); }
      });
      $('[data-gate-skip]', el).addEventListener('click', () => { el.hidden = true; });
      el.addEventListener('click', (e) => { if (e.target === el) el.hidden = true; });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) el.hidden = true; });
    }
    el.hidden = false;
    setTimeout(() => $('input', el).focus(), 60);
  }

  // Tombol guru di sidebar: "Masuk guru" atau "Keluar" sesuai status.
  function updateTeacherUi() {
    document.body.classList.toggle('is-public', isPublic());
    document.body.classList.toggle('is-teacher', !!DATA.teacher);
    // Tampilan umum bisa dilihat siswa: sapaan netral.
    $('[data-greet]').textContent = isPublic() ? `${DATA.greet}!` : `${DATA.greet}, Bapak/Ibu Guru!`;
    $('.brand-hello').textContent = isPublic() ? 'Halo, warga SMA Plus!' : 'Halo, Bapak/Ibu Guru!';
    const b = $('[data-teacher-btn]');
    b.hidden = !DATA.loginAvailable && !DATA.teacher;
    b.dataset.mode = DATA.teacher ? 'logout' : 'login';
    $('span', b).textContent = DATA.teacher ? 'Keluar (guru)' : 'Masuk guru';
  }
  $('[data-teacher-btn]').addEventListener('click', async (e) => {
    if (e.currentTarget.dataset.mode === 'logout') { await window.VertikalAPI.logout(); return; }
    showLiveGate();
  });
  window.addEventListener('vertikal:auth', (e) => {
    // Login guru (dari dashboard atau chat) membuka rincian per kelas; keluar kembali ke tampilan umum.
    reload().then(() => {
      if (DATA.live?.state === 'error') toast(DATA.live.error);
      else toast(e.detail?.authed ? 'Masuk sebagai guru. Rincian per kelas terbuka.' : 'Keluar dari mode guru.');
    });
  });

  /* ------------------------------------------------------------------
     Hasil analisis otomatis di setiap halaman (dari angka periode dan filter aktif)
     ------------------------------------------------------------------ */
  const pts = (v) => `${fmtPts(v)} poin`;
  const upDown = (v, up = 'naik', down = 'turun') => (v > 0.0005 ? up : v < -0.0005 ? down : 'tetap');
  // Periode berdata sampai periode terpilih, dengan statistik cakupan aktif.
  const LEVELS = [[0.85, 'sangat baik', 'great'], [0.7, 'baik', 'good'], [0.55, 'cukup', 'fair'], [0, 'perlu perhatian', 'low']];
  const levelOf = (v) => LEVELS.find(([t]) => v >= t);
  const trendWord = (d) => (d > 0.03 ? 'terus membaik' : d > 0.005 ? 'sedikit membaik' : d < -0.03 ? 'menurun' : d < -0.005 ? 'sedikit menurun' : 'cenderung stabil');
  const ADVICE = [
    'Ajak siswa menetapkan jam tidur dan jam bangun, lalu cek bersama di apel atau jam wali kelas.',
    'Pertahankan lewat kegiatan keagamaan rutin, misalnya doa bersama dan kultum pagi.',
    'Tambah peluang bergerak: senam pagi, jalan kaki atau bersepeda ke sekolah, atau tantangan olahraga mingguan antarkelas.',
    'Ingatkan menu Isi Piringku lewat wali kelas dan kantin, dan libatkan orang tua untuk bekal dari rumah.',
    'Sediakan waktu literasi 15–30 menit dan pojok baca di kelas; beri ruang siswa berbagi bacaan.',
    'Buka kegiatan sosial sederhana: kerja bakti kelas, bakti sosial, atau piket lingkungan bergilir.',
    'Kampanyekan batas HP sebelum tidur dan komunikasikan jam tidur dengan orang tua.',
  ];
  function habitTrend(i) {
    const ser = scopeSeries();
    return ser.length >= 2 ? { a: ser[0], b: ser[ser.length - 1], d: ser[ser.length - 1].s.index[i] - ser[0].s.index[i] } : null;
  }
  // Kesimpulan satu kebiasaan dalam kalimat sehari-hari.
  function habitVerdict(i, s) {
    const h = HABITS[i]; const v = s.index[i]; const lv = levelOf(v)[1];
    const t = habitTrend(i);
    const zero = s.dist[i][0] / (s.n || 1); const full = s.cons[i];
    const rank = 1 + s.index.filter((x) => x > v).length;
    let txt = `${h.name} ${lv === 'perlu perhatian' ? 'masih perlu perhatian' : `sudah ${lv}`}${t ? ` dan ${trendWord(t.d)} sejak ${rLabel(t.a.r)}` : ''}.`;
    txt += full >= 0.7 ? ` Sebagian besar siswa (${fmtPct(full)}) menjalankannya setiap hari.`
      : full >= 0.4 ? ` Sekitar ${fmtPct(full)} siswa menjalankannya setiap hari.`
      : ` Baru ${fmtPct(full)} siswa yang menjalankannya setiap hari.`;
    if (zero >= 0.15) txt += ` Masih ada ${fmtPct(zero)} siswa yang sama sekali tidak menjalankannya dalam 3 hari terakhir.`;
    if (rank === 1) txt += ' Ini kebiasaan terkuat siswa saat ini.';
    else if (rank === 7) txt += ' Ini kebiasaan paling lemah, jadi layak menjadi prioritas.';
    if (t && t.d < -0.03) txt += ' Penurunannya perlu dicari tahu penyebabnya.';
    return txt;
  }
  function habitAdvice(i, s) {
    return levelOf(s.index[i])[2] === 'great'
      ? 'Pertahankan dan jadikan contoh; arahkan energi pembinaan ke kebiasaan yang masih lemah.'
      : ADVICE[i];
  }
  function renderVerdictList(s) {
    const t0 = scopeSeries();
    $('[data-verdict-desc]').textContent = t0.length >= 2
      ? `Status menurut indeks periode ${rLabel(roundById(state.round))}; arah tren dibanding ${rLabel(t0[0].r)}. Pilih baris untuk melihat detail.`
      : `Status menurut indeks periode ${rLabel(roundById(state.round))}. Pilih baris untuk melihat detail.`;
    $('[data-verdict-list]').innerHTML = HABITS.map((h, i) => {
      const [, lv, cls] = levelOf(s.index[i]);
      const t = habitTrend(i);
      const dir = !t ? '' : t.d > 0.005 ? 'up' : t.d < -0.005 ? 'down' : 'flat';
      const arrow = { up: '▲', down: '▼', flat: '●' }[dir] || '';
      return `<li style="--i:${i}"><button type="button" class="verdict-row${i === state.habit ? ' is-on' : ''}" data-vi="${i}">
        <span class="vr-name"><span class="dot" style="--c:${h.color}"></span>${h.name}</span>
        <span class="vr-chip ${cls}">${lv}</span>
        <span class="vr-trend ${dir}">${t ? `${arrow} ${trendWord(t.d)}` : 'belum ada tren'}</span>
      </button></li>`;
    }).join('');
    $$('[data-verdict-list] .verdict-row').forEach((b) => b.addEventListener('click', () => {
      selectHabit(Number(b.dataset.vi));
      $('[data-habit-focus]').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
    }));
  }

  // Satu kalimat kesimpulan di atas panel "Hasil analisis" tiap halaman.
  const VERDICT = {
    kebiasaan() {
      const s = statsOf(state.round);
      const order = [...HABITS.keys()].sort((a, b) => s.index[b] - s.index[a]);
      return `Secara umum kebiasaan siswa ${levelOf(s.overall)[1] === 'perlu perhatian' ? 'masih perlu perhatian' : `sudah ${levelOf(s.overall)[1]}`} (Indeks 7 KAIH ${fmtIdx(s.overall)}). ${HABITS[order[0]].name} sudah menjadi kekuatan, sedangkan ${HABITS[order[6]].name.toLowerCase()} perlu menjadi prioritas pembinaan.`;
    },
    tren() {
      const ser = scopeSeries();
      if (ser.length < 2) return 'Arah perkembangan belum bisa disimpulkan karena baru ada satu periode berisi data.';
      const a = ser[0]; const b = ser[ser.length - 1]; const d = b.s.overall - a.s.overall;
      const fewer = b.s.n < a.s.n * 0.6;
      return `Kebiasaan siswa ${trendWord(d)} sejak ${rLabel(a.r)} (Indeks 7 KAIH ${fmtIdx(a.s.overall)} menjadi ${fmtIdx(b.s.overall)}).${fewer ? ' Namun jumlah pengisi turun jauh, jadi hasil periode terakhir belum tentu mewakili semua siswa.' : ''}`;
    },
    kelas() {
      const ok = rombelScope().map((rb) => ({ rb, s: statsRombel(state.round, rb.name) })).filter((x) => x.s.n >= CONFIG.minN).sort((a, b) => b.s.overall - a.s.overall);
      if (ok.length < 2) return 'Belum cukup kelas dengan data yang memadai untuk dibandingkan.';
      const gap = ok[0].s.overall - ok[ok.length - 1].s.overall;
      return `Perbedaan antarkelas ${gap > 0.15 ? 'cukup lebar' : gap > 0.07 ? 'sedang' : 'tidak terlalu jauh'} (${nf(1).format(gap * 100)} poin). Pembinaan sebaiknya dimulai dari ${ok[ok.length - 1].rb.name}, dan praktik baik ${ok[0].rb.name} bisa ditularkan.`;
    },
    gawai() {
      const s = statsOf(state.round);
      return `${s.gawaiRisk >= 0.4 ? 'Kebiasaan main HP sebelum tidur masih tinggi' : s.gawaiRisk >= 0.25 ? 'Kebiasaan main HP sebelum tidur cukup banyak' : 'Kebiasaan main HP sebelum tidur relatif rendah'}: ${fmtPct(s.gawaiRisk)} siswa melakukannya ≥ 2 malam, dan mereka cenderung lebih jarang tidur cepat.`;
    },
    hambatan() {
      const s = statsOf(state.round);
      const top = BARRIERS.filter((b) => b.code !== 'F').sort((a, b) => s.bars[b.code] - s.bars[a.code])[0];
      return `Hambatan terbesar siswa adalah "${top.name.toLowerCase()}" (${fmtPct(s.bars[top.code] / (s.n || 1))} responden), jadi solusi paling berdampak dimulai dari sana.`;
    },
  };

  function scopeSeries() {
    return roundsWithData().filter((r) => r.id <= state.round).map((r) => ({ r, s: statsOf(r.id) }))
      .filter((x) => x.s.n && !(state.kelas && x.s.n < CONFIG.minN));
  }

  const ANALYSIS = {
    kebiasaan() {
      const s = statsOf(state.round); const pid = prevRoundId(); const prev = pid ? statsOf(pid) : null;
      const order = [...HABITS.keys()].sort((a, b) => s.index[b] - s.index[a]);
      const out = [
        { tone: 'good', title: `${HABITS[order[0]].name} paling kuat`, text: `Indeks ${fmtIdx(s.index[order[0]])}; ${fmtPct(s.cons[order[0]])} siswa konsisten 3 dari 3 hari.` },
        { tone: 'warn', title: `${HABITS[order[6]].name} paling lemah`, text: `Indeks ${fmtIdx(s.index[order[6]])}, terpaut ${nf(1).format((s.index[order[0]] - s.index[order[6]]) * 100)} poin dari kebiasaan terkuat.` },
      ];
      const zero = [...HABITS.keys()].sort((a, b) => s.dist[b][0] - s.dist[a][0])[0];
      out.push({ tone: 'neutral', title: `${fmtPct(s.dist[zero][0] / (s.n || 1))} siswa 0 hari ${HABITS[zero].name}`, text: `Proporsi jawaban "0 hari" tertinggi ada di ${HABITS[zero].name}. Kelompok ini sasaran utama pembinaan.` });
      if (prev) {
        const d = HABITS.map((_, i) => s.index[i] - prev.index[i]);
        const up = d.indexOf(Math.max(...d)); const dn = d.indexOf(Math.min(...d));
        out.push({ tone: d[up] > 0.0005 ? 'good' : 'info', title: `Dibanding ${rLabel(roundById(pid))}`, text: `${HABITS[up].name} paling membaik (${pts(d[up])})${d[dn] < -0.0005 ? `, ${HABITS[dn].name} paling menurun (${pts(d[dn])})` : ''}.` });
      }
      out.push({ tone: 'info', title: `Rata-rata ${nf(1).format(s.consAvg)} dari 7 kebiasaan konsisten`, text: `Hanya ${fmtPct(s.all7, 1)} siswa konsisten di ketujuh kebiasaan sekaligus.` });
      return out;
    },
    tren() {
      const ser = scopeSeries();
      if (ser.length < 2) return [{ tone: 'info', title: 'Tren belum bisa dibaca', text: 'Perlu minimal dua periode pengisian yang berisi data.' }];
      const a = ser[0]; const b = ser[ser.length - 1];
      const d = b.s.overall - a.s.overall;
      const hd = HABITS.map((_, i) => b.s.index[i] - a.s.index[i]);
      const up = hd.indexOf(Math.max(...hd)); const dn = hd.indexOf(Math.min(...hd));
      const steps = ser.slice(1).map((x, k) => x.s.overall - ser[k].s.overall);
      const rising = steps.filter((v) => v > 0.0005).length;
      const out = [
        { tone: d >= 0 ? 'good' : 'warn', title: `Indeks 7 KAIH ${upDown(d)} ${nf(1).format(Math.abs(d * 100))} poin`, text: `Dari ${fmtIdx(a.s.overall)} (${rLabel(a.r)}) menjadi ${fmtIdx(b.s.overall)} (${rLabel(b.r)}), ${scopeName()}.` },
        { tone: 'info', title: `Naik di ${rising} dari ${steps.length} pergantian periode`, text: rising === steps.length ? 'Membaik terus dari periode ke periode.' : rising === 0 ? 'Belum pernah naik antar periode; perlu evaluasi program.' : 'Perkembangan belum stabil; pantau periode berikutnya.' },
        { tone: hd[up] > 0 ? 'good' : 'neutral', title: `${HABITS[up].name} paling membaik`, text: `${pts(hd[up])} sejak ${rLabel(a.r)}.${hd[dn] < -0.0005 ? ` ${HABITS[dn].name} justru turun ${pts(hd[dn])}.` : ''}` },
      ];
      const nd = b.s.n - a.s.n;
      out.push({ tone: nd < 0 ? 'warn' : 'good', title: `Responden ${upDown(nd, 'bertambah', 'berkurang')} ${fmtNum(Math.abs(nd))}`, text: `${fmtNum(a.s.n)} pada ${rLabel(a.r)} menjadi ${fmtNum(b.s.n)} pada ${rLabel(b.r)}. Responden tiap periode bisa berbeda, jadi perubahan adalah perubahan kelompok, bukan tiap siswa.` });
      return out;
    },
    kelas() {
      const list = rombelScope().map((rb) => ({ rb, s: statsRombel(state.round, rb.name) }));
      const ok = list.filter((x) => x.s.n >= CONFIG.minN).sort((a, b) => b.s.overall - a.s.overall);
      const out = [];
      if (ok.length >= 2) {
        const top = ok[0]; const low = ok[ok.length - 1];
        out.push({ tone: 'good', title: `${top.rb.name} tertinggi`, text: `Indeks 7 KAIH ${fmtIdx(top.s.overall)} dengan ${fmtNum(top.s.n)} responden.` });
        out.push({ tone: 'warn', title: `${low.rb.name} terendah`, text: `Indeks ${fmtIdx(low.s.overall)}, selisih ${nf(1).format((top.s.overall - low.s.overall) * 100)} poin dari kelas tertinggi. Kebiasaan terlemahnya: ${HABITS[low.s.index.indexOf(Math.min(...low.s.index))].name}.` });
        const spread = HABITS.map((_, i) => Math.max(...ok.map((x) => x.s.index[i])) - Math.min(...ok.map((x) => x.s.index[i])));
        const w = spread.indexOf(Math.max(...spread));
        out.push({ tone: 'info', title: `Kesenjangan terbesar: ${HABITS[w].name}`, text: `Selisih ${nf(1).format(spread[w] * 100)} poin antar kelas; praktik baik dari kelas teratas bisa ditularkan.` });
      }
      const sized = list.filter((x) => x.rb.size);
      if (sized.length) {
        const low = sized.filter((x) => x.s.n / x.rb.size < CONFIG.target).length;
        out.push({ tone: low ? 'warn' : 'good', title: `${fmtNum(low)} dari ${fmtNum(sized.length)} kelas di bawah target isi`, text: `Target partisipasi ${fmtPct(CONFIG.target)}. Ingatkan wali kelas yang partisipasinya rendah.` });
      }
      const hidden = list.filter((x) => x.s.n > 0 && x.s.n < CONFIG.minN).length;
      const none = list.filter((x) => x.s.n === 0).length;
      if (hidden || none) out.push({ tone: 'neutral', title: `${fmtNum(hidden + none)} kelas belum cukup data`, text: `${fmtNum(none)} kelas belum mengisi dan ${fmtNum(hidden)} kelas kurang dari ${CONFIG.minN} responden (rincian disembunyikan).` });
      return out.length ? out : [{ tone: 'info', title: 'Belum cukup data per kelas', text: `Perlu minimal dua kelas dengan ${CONFIG.minN} responden atau lebih.` }];
    },
    gawai() {
      const s = statsOf(state.round); const pid = prevRoundId(); const prev = pid ? statsOf(pid) : null;
      const rows = rowsOf(state.round);
      const g0 = gawaiSleep(rows)[0];
      const hi = rows.filter((r) => r.gawai >= 2);
      const hiCons = hi.length ? hi.filter((r) => r.h[TIDUR] === 3).length / hi.length : 0;
      const out = [{ tone: s.gawaiRisk > 0.4 ? 'warn' : 'info', title: `${fmtPct(s.gawaiRisk)} memakai HP di kasur ≥ 2 malam`, text: `${fmtPct(s.gawai[3] / (s.n || 1))} bahkan melakukannya ketiga malam.` }];
      if (g0.n >= CONFIG.minN && hi.length >= CONFIG.minN) {
        out.push({ tone: 'info', title: `Konsisten tidur cepat ${nf(0).format((g0.cons - hiCons) * 100)} poin lebih rendah`, text: `Konsisten tidur ≤ 22.00: ${fmtPct(g0.cons)} pada siswa tanpa HP di kasur, ${fmtPct(hiCons)} pada yang ≥ 2 malam. Ini keterkaitan, bukan bukti sebab-akibat.` });
      }
      if (prev) out.push({ tone: s.gawaiRisk <= prev.gawaiRisk ? 'good' : 'warn', title: `HP di kasur ${upDown(s.gawaiRisk - prev.gawaiRisk, 'naik', 'turun')} ${nf(1).format(Math.abs((s.gawaiRisk - prev.gawaiRisk) * 100))} poin`, text: `Dibanding ${rLabel(roundById(pid))} (${fmtPct(prev.gawaiRisk)}).` });
      if (state.grade === 'all' && !state.kelas) {
        const gs = GRADES.map((g) => ({ g, s: statsOf(state.round, g) })).filter((x) => x.s.n).sort((a, b) => b.s.gawaiRisk - a.s.gawaiRisk);
        if (gs.length > 1) out.push({ tone: 'neutral', title: `Kelas ${gs[0].g} paling banyak HP di kasur`, text: `${fmtPct(gs[0].s.gawaiRisk)} dibanding ${fmtPct(gs[gs.length - 1].s.gawaiRisk)} di kelas ${gs[gs.length - 1].g}.` });
      }
      return out;
    },
    hambatan() {
      const s = statsOf(state.round); const n = s.n || 1;
      const rows = rowsOf(state.round);
      const order = BARRIERS.filter((b) => b.code !== 'F').sort((a, b) => s.bars[b.code] - s.bars[a.code]);
      const out = [
        { tone: 'warn', title: `${order[0].name} hambatan teratas`, text: `Dipilih ${fmtPct(s.bars[order[0].code] / n)} responden, disusul ${order[1].name.toLowerCase()} (${fmtPct(s.bars[order[1].code] / n)}).` },
        { tone: 'good', title: `${fmtPct(s.bars.F / n)} merasa tidak ada hambatan`, text: 'Siswa ini bisa dilibatkan sebagai teladan sebaya.' },
      ];
      const pairs = new Map();
      rows.forEach((r) => { if (r.bar.length === 2) { const k = [...r.bar].sort().join(''); pairs.set(k, (pairs.get(k) || 0) + 1); } });
      const top = [...pairs].sort((a, b) => b[1] - a[1])[0];
      if (top) out.push({ tone: 'info', title: 'Pasangan hambatan terbanyak', text: `${BAR[top[0][0]].name} + ${BAR[top[0][1]].name.toLowerCase()} (${fmtNum(top[1])} siswa).` });
      const idx = BARRIERS.filter((b) => b.code !== 'F').map((b) => { const rs = rows.filter((r) => r.bar.includes(b.code)); return { b, n: rs.length, v: rs.length ? avg(rs.map(idxRow)) : 0 }; })
        .filter((x) => x.n >= CONFIG.minN).sort((a, b) => a.v - b.v)[0];
      if (idx) out.push({ tone: 'neutral', title: `Pemilih "${idx.b.name}" indeksnya terendah`, text: `Rata-rata indeks ${fmtIdx(idx.v)} dibanding ${fmtIdx(s.overall)} seluruh responden. Ini keterkaitan, bukan sebab-akibat.` });
      return out;
    },
  };
  function renderAnalysis(route) {
    const box = $(`[data-analysis="${route}"]`);
    if (!box || !ANALYSIS[route]) return;
    const r = roundById(state.round);
    $(`[data-analysis-desc="${route}"]`).textContent = `Dibuat otomatis dari data ${route === 'tren' ? `semua periode sampai ${rLabel(r)}` : `periode ${rLabel(r)}`}, ${scopeName()}.`;
    let v = box.parentElement.querySelector('.analysis-verdict');
    if (!v) { v = document.createElement('p'); v.className = 'analysis-verdict'; box.before(v); }
    v.innerHTML = VERDICT[route] ? `<b>Kesimpulan:</b> ${esc(VERDICT[route]())}` : '';
    box.innerHTML = ANALYSIS[route]().slice(0, 4).map((it, i) => `<li class="insight ${it.tone}" style="--i:${i}"><span class="insight-ico" aria-hidden="true"></span><div><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div></li>`).join('');
  }

  /* ------------------------------------------------------------------
     Router: tiap menu = satu halaman (#/ringkasan, #/kebiasaan, ...)
     ------------------------------------------------------------------ */
  const ROUTES = {
    ringkasan: { title: 'Ringkasan', render: renderRingkasan },
    kebiasaan: { title: 'Analisis 7 kebiasaan', render: renderKebiasaan },
    tren: { title: 'Tren antar pengisian', render: renderTren, allRounds: true },
    kelas: { title: 'Kelas dan jenjang', render: renderKelas },
    rapor: { title: 'Rapor kelas', render: renderRapor },
    gawai: { title: 'Gawai dan tidur', render: renderGawai },
    hambatan: { title: 'Hambatan kebiasaan', render: renderHambatan },
    data: { title: 'Laporan dan data', render: renderData },
  };

  const revealIO = new IntersectionObserver((entries) => {
    let n = 0;
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.style.setProperty('--d', `${n++ * 80}ms`);
      en.target.classList.add('is-in');
      revealIO.unobserve(en.target);
    });
  }, { threshold: 0.06 });
  function revealNow(els) { els.forEach((el) => { el.classList.remove('is-in'); revealIO.observe(el); }); }

  function go() {
    const key = location.hash.replace(/^#\/?/, '');
    const route = ROUTES[key] ? key : 'ringkasan';
    const changed = state.route !== route;
    const first = state.route === null;
    state.route = route;
    $$('.view').forEach((v) => {
      const on = v.dataset.view === route;
      v.hidden = !on;
      v.classList.toggle('is-active', on);
    });
    $$('.nav-link').forEach((a) => {
      if (a.getAttribute('href') === `#/${route}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('[data-page-title]').textContent = ROUTES[route].title;
    replay($('[data-page-title]'));
    document.title = `${ROUTES[route].title} | Monitoring 7 KAIH`;
    $('[data-round-ctl]').hidden = !!ROUTES[route].allRounds;
    const view = $(`.view[data-view="${route}"]`);
    if (changed) revealNow($$('.welcome, .kpi, .panel', view));
    if (!applyGuard()) { ROUTES[route].render(true); renderAnalysis(route); }
    if (changed && !first) { window.scrollTo(0, 0); $('#main').focus({ preventScroll: true }); }
    if (document.body.classList.contains('drawer-open')) setDrawer(false);
  }
  const rerender = () => { if (!applyGuard()) { ROUTES[state.route].render(true); renderAnalysis(state.route); } };

  // Muat ulang data setelah upload/hapus, lalu pindah ke pengisian yang baru masuk.
  async function reload(roundId) {
    await loadAll();
    const has = roundsWithData().map((r) => r.id);
    state.round = has.includes(roundId) ? roundId : has.includes(state.round) ? state.round : has[has.length - 1] || 1;
    buildRoundCtl();
    buildKelasCtl();
    updateToday();
    rerender();
  }

  /* ------------------------------------------------------------------
     Controls
     ------------------------------------------------------------------ */
  function buildRoundCtl() {
    const has = new Set(roundsWithData().map((r) => r.id));
    $('[data-round-ctl]').innerHTML = `<select class="pick-select round-select" data-round-select aria-label="Pilih periode pengisian">${[...ROUNDS].reverse().map((r, i) => `<option value="${r.id}"${has.has(r.id) ? '' : ' disabled'}${r.id === state.round ? ' selected' : ''}>${esc(rLabel(r))}${i === 0 ? ' (terbaru)' : ''}</option>`).join('')}</select>`;
    $('[data-round-select]').addEventListener('change', (e) => setRound(Number(e.target.value)));
  }
  function setRound(id) {
    state.round = id;
    $$('[data-round]').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.round) === id)));
    if ($('[data-round-select]')) $('[data-round-select]').value = String(id);
    updateToday();
    rerender();
  }
  function updateToday() {
    const r = roundById(state.round);
    if (!r) { $('[data-today]').textContent = 'Belum ada periode pengisian'; return; }
    const when = rRange(r) ? `diisi ${rRange(r)}${r.main ? ` ${r.main.getFullYear()}` : ''}` : '';
    $('[data-today]').textContent = `${DATA.source === 'sample' ? 'Data contoh · ' : ''}Periode ${r.label}${when ? ` · ${when}` : ''}`;
  }

  /* Filter kelas: berlaku di semua halaman, seperti filter jenjang */
  function buildKelasCtl() {
    const sel = $('[data-kelas]');
    if (state.kelas && !knownRombel(state.kelas)) state.kelas = null;
    const groups = GRADES.filter((g) => state.grade === 'all' || g === state.grade)
      .map((g) => [g, ROMBEL.filter((rb) => rb.grade === g).map((rb) => rb.name).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }))])
      .filter(([, l]) => l.length);
    sel.innerHTML = `<option value="">Semua kelas</option>${groups.map(([g, l]) => `<optgroup label="Kelas ${g}">${l.map((n) => `<option value="${esc(n)}"${n === state.kelas ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('')}`;
    sel.classList.toggle('is-on', !!state.kelas);
  }
  function setGrade(g) {
    state.grade = g;
    $$('[data-grade]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.grade === g)));
  }
  $('[data-kelas]').addEventListener('change', (e) => {
    state.kelas = e.target.value || null;
    if (state.kelas) setGrade(gradeOf(state.kelas) || 'all');
    buildKelasCtl();
    rerender();
  });
  $$('[data-grade]').forEach((b) => b.addEventListener('click', () => {
    state.grade = b.dataset.grade;
    if (state.kelas && state.grade !== 'all' && gradeOf(state.kelas) !== state.grade) state.kelas = null;
    if (state.grade === 'all') state.kelas = null;
    buildKelasCtl();
    $$('[data-grade]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    rerender();
  }));
  $$('[data-metric]').forEach((b) => b.addEventListener('click', () => {
    state.metric = b.dataset.metric;
    $$('[data-metric]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderTren();
  }));
  $('[data-compare]').addEventListener('click', (e) => {
    state.compare = !state.compare;
    e.currentTarget.setAttribute('aria-pressed', String(state.compare));
    e.currentTarget.textContent = state.compare ? 'Sembunyikan pengisian sebelumnya' : 'Tampilkan pengisian sebelumnya';
    const p = prevRoundId();
    renderRosette(statsOf(state.round), p ? statsOf(p) : null, false);
  });

  let resizeFrame = 0;
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { if (state.route === 'tren') renderTren(); if (state.route === 'gawai') renderGawai(); });
  });

  /* Drawer (tablet/mobile) */
  const menuBtn = $('.menu-btn');
  const scrim = $('.scrim');
  function setDrawer(open) {
    document.body.classList.toggle('drawer-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Tutup navigasi' : 'Buka navigasi');
    scrim.hidden = !open;
    if (open) setTimeout(() => $('.nav-link').focus(), 50);
  }
  menuBtn.addEventListener('click', () => setDrawer(!document.body.classList.contains('drawer-open')));
  scrim.addEventListener('click', () => { setDrawer(false); menuBtn.focus(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) { setDrawer(false); menuBtn.focus(); }
  });

  /* Motion: banner parallax, KPI tilt (delegated, so generated cards tilt too) */
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const banner = $('[data-parallax]');
  banner.addEventListener('pointermove', (e) => {
    if (reduceMotion.matches || !finePointer.matches) return;
    const r = banner.getBoundingClientRect();
    banner.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    banner.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  });
  banner.addEventListener('pointerleave', () => { banner.style.setProperty('--px', 0); banner.style.setProperty('--py', 0); });
  let tiltCard = null;
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.kpi');
    if (tiltCard && tiltCard !== card) { tiltCard.style.setProperty('--rx', '0deg'); tiltCard.style.setProperty('--ry', '0deg'); }
    tiltCard = card;
    if (!card || reduceMotion.matches || !finePointer.matches) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--ry', `${((x - 0.5) * 12).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${((0.5 - y) * 10).toFixed(2)}deg`);
    card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
  });

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  async function init() {
    const hour = NOW.getHours();
    DATA.greet = `Selamat ${hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam'}`;
    $('[data-updated]').textContent = fmtTime(NOW);
    await loadAll();
    const has = roundsWithData();
    state.round = has.length ? has[has.length - 1].id : 1;
    buildRoundCtl();
    buildKelasCtl();
    updateToday();
    buildRosette();
    $('.topbar').classList.add('is-in');
    window.addEventListener('hashchange', go);
    // Disematkan di Google Sites (iframe): unduh/cetak bisa dibatasi, jadi tawarkan tab penuh.
    const framed = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const openTab = $('[data-open-tab]');
    if (framed) {
      const sync = () => { openTab.href = location.href; };
      openTab.hidden = false; sync();
      window.addEventListener('hashchange', sync);
    }
    go();
    if (DATA.live?.state === 'error') toast(DATA.live.error);
    if (DATA.live?.state === 'nobackend') toast(`Data asli tidak terbaca: halaman dibuka tanpa server PHP. ${LOCAL_URL ? `Buka ${LOCAL_URL}` : 'Hubungkan backend Vertikal.'}`);
  }
  init();
})();
