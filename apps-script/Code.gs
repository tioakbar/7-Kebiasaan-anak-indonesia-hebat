/* ==========================================================================
   Vertikal AI: jembatan data dari spreadsheet "(ALL) KUESIONER - 7 Kebiasaan
   Anak Indonesia Hebat" ke dashboard dan Vertikal AI.

   - Setiap tab respons = satu periode pengisian (label = nama tab, urut tab).
   - Tab "Master Kelas" (opsional) = daftar kelas, jumlah siswa, email wali kelas.
   - Nama dan email siswa TIDAK PERNAH dikirim keluar. Keduanya hanya dipakai di
     sini untuk membuang isian ganda (isian terakhir per siswa per periode).
   - Hanya backend (Cloudflare Worker / PHP) yang memegang DATA_TOKEN. Browser
     tidak pernah memanggil script ini langsung.

   Pasang: lihat apps-script/README.md. Jalankan siapkanVertikal() sekali.
   ========================================================================== */

var MASTER_SHEET = 'Master Kelas';
var CACHE_SECONDS = 60;

var HABIT_RE = [/bangun pagi/i, /ibadah/i, /olahraga atau aktivitas fisik/i, /isi piringku/i,
  /membaca buku|belajar hal baru/i, /kegiatan masyarakat|membantu orang lain/i, /tidur malam/i];
var BARRIERS = [
  ['A', 'Tugas sekolah / PR menumpuk'],
  ['B', 'Terlalu asyik main HP, game, atau media sosial'],
  ['C', 'Kesibukan kegiatan ekstrakurikuler / organisasi'],
  ['D', 'Jarak / waktu perjalanan rumah-sekolah yang jauh'],
  ['E', 'Kurang pengingat atau dorongan dari sekitar'],
  ['F', 'Tidak ada hambatan'],
  ['G', 'Lainnya'],
];

/* ---------- endpoint ---------- */

function doGet(e) {
  var token = PropertiesService.getScriptProperties().getProperty('DATA_TOKEN');
  var given = (e && e.parameter && e.parameter.token) || '';
  if (!token || !safeEqual_(given, token)) return json_({ ok: false, error: 'unauthorized' });
  var cache = CacheService.getScriptCache();
  var hit = cache.get('vertikal-data');
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  var text = JSON.stringify(buildData());
  if (text.length < 95000) cache.put('vertikal-data', text, CACHE_SECONDS);
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safeEqual_(a, b) {
  a = String(a); b = String(b);
  var d = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

/* ---------- pembacaan data ---------- */

function gradeOf_(s) {
  var u = String(s == null ? '' : s).toUpperCase();
  var m = u.match(/\b(XII|XI|X)\b/) || u.match(/^(XII|XI|X)(?=[-\s]|$)/);
  return m ? m[1] : null;
}
function cleanName_(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
// Kunci nama kelas: beda huruf besar/kecil, spasi, dan tanda hubung dianggap sama ("X - 2" = "x-2").
function classKey_(s) { return cleanName_(s).toUpperCase().replace(/\s*[-–—]\s*/g, '-'); }
function days_(v) {
  if (typeof v === 'number') return v >= 0 && v <= 3 && Math.floor(v) === v ? v : NaN;
  var m = String(v == null ? '' : v).match(/[0-3]/);
  return m ? Number(m[0]) : NaN;
}
function barriers_(cell, stat) {
  var rest = String(cell == null ? '' : cell);
  var codes = [];
  BARRIERS.forEach(function (b) {
    var i = rest.toLowerCase().indexOf(b[1].toLowerCase());
    if (i >= 0) { codes.push(b[0]); rest = rest.slice(0, i) + rest.slice(i + b[1].length); }
  });
  if (/[a-z]/i.test(rest.replace(/[,;]/g, ''))) { if (codes.indexOf('G') < 0) codes.push('G'); stat.lainnya_teks_bebas++; }
  if (codes.length > 2) stat.hambatan_lebih_dari_2++;
  return codes.join('');
}

function readMaster_(ss) {
  var sh = ss.getSheetByName(MASTER_SHEET);
  if (!sh) return null;
  var v = sh.getDataRange().getValues();
  var head = v[0].map(function (h) { return String(h).toLowerCase(); });
  var cK = head.findIndex(function (h) { return /kelas|rombel/.test(h) && !/wali|email/.test(h); });
  var cN = head.findIndex(function (h) { return /jumlah|siswa/.test(h); });
  if (cK < 0) return null;
  var list = [];
  v.slice(1).forEach(function (r) {
    var k = cleanName_(r[cK]);
    if (!k) return;
    var n = cN >= 0 ? Number(r[cN]) : NaN;
    // Email wali kelas sengaja tidak dikirim (disiapkan untuk akses wali kelas tahap berikutnya).
    list.push({ kelas: k, jenjang: gradeOf_(k), jumlah_siswa: n > 0 ? n : null });
  });
  return list;
}

function buildData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = Session.getScriptTimeZone();
  var master = readMaster_(ss);
  var masterKey = {};
  (master || []).forEach(function (m) { masterKey[classKey_(m.kelas)] = m.kelas; });
  var seen = {};
  var periods = [];
  var rows = [];

  ss.getSheets().forEach(function (sh) {
    if (sh.getName() === MASTER_SHEET) return;
    var v = sh.getDataRange().getValues();
    if (v.length < 1) return;
    var head = v[0].map(function (h) { return String(h).trim(); });
    var find = function (re) { return head.findIndex(function (h) { return re.test(h); }); };
    var cH = HABIT_RE.map(find);
    var cG = find(/memakai hp/i);
    if (cH.some(function (c) { return c < 0; }) || cG < 0) return; // bukan tab respons
    var cTs = Math.max(0, find(/timestamp|stempel waktu|cap waktu/i));
    var cBar = find(/hambatan/i);
    var cJenjang = find(/jenjang/i);
    var cEmail = find(/e-?mail/i);
    var used = [cJenjang, cBar, cG].concat(cH);
    var cKelas = [], cNama = [];
    head.forEach(function (h, i) {
      if (used.indexOf(i) >= 0) return;
      if (/^(kelas|rombel)/i.test(h)) cKelas.push(i);
      else if (/^nama/i.test(h)) cNama.push(i);
    });

    var pid = periods.length + 1;
    var stat = { total: 0, dibuang_tidak_lengkap: 0, duplikat: 0, tanpa_identitas: 0, hambatan_lebih_dari_2: 0, lainnya_teks_bebas: 0 };
    var latest = {}; // kunci siswa -> {ts, row}
    var noId = [];
    var tsMin = null, tsMax = null;

    v.slice(1).forEach(function (r) {
      if (!r.some(function (c) { return c !== '' && c != null; })) return;
      stat.total++;
      var kelas = '';
      for (var k = 0; k < cKelas.length && !kelas; k++) kelas = cleanName_(r[cKelas[k]]);
      kelas = masterKey[classKey_(kelas)] || kelas;
      var jenjang = gradeOf_(kelas) || gradeOf_(cJenjang >= 0 ? r[cJenjang] : '');
      var h = cH.map(function (c) { return days_(r[c]); });
      var g = days_(r[cG]);
      if (!jenjang || !kelas || h.some(isNaN) || isNaN(g)) { stat.dibuang_tidak_lengkap++; return; }
      var ts = r[cTs] instanceof Date ? r[cTs] : new Date(r[cTs]);
      if (!isNaN(ts)) { if (!tsMin || ts < tsMin) tsMin = ts; if (!tsMax || ts > tsMax) tsMax = ts; }
      var out = [pid, kelas, jenjang, h.join(''), g, barriers_(cBar >= 0 ? r[cBar] : '', stat)];
      var email = cEmail >= 0 ? cleanName_(r[cEmail]).toLowerCase() : '';
      var nama = '';
      for (var n = 0; n < cNama.length && !nama; n++) nama = cleanName_(r[cNama[n]]).toLowerCase();
      var key = email || (nama ? classKey_(kelas) + '|' + nama : '');
      if (!key) { stat.tanpa_identitas++; noId.push(out); return; }
      var t = isNaN(ts) ? 0 : ts.getTime();
      if (latest[key]) { stat.duplikat++; if (t >= latest[key].t) latest[key] = { t: t, row: out }; }
      else latest[key] = { t: t, row: out };
    });

    var kept = Object.keys(latest).map(function (k) { return latest[k].row; }).concat(noId);
    kept.forEach(function (r) { seen[r[1]] = r[2]; });
    rows = rows.concat(kept);
    periods.push({
      id: pid, label: sh.getName(),
      mulai: tsMin ? Utilities.formatDate(tsMin, tz, 'yyyy-MM-dd') : null,
      selesai: tsMax ? Utilities.formatDate(tsMax, tz, 'yyyy-MM-dd') : null,
      n: kept.length, isu: stat,
    });
  });

  var kelas = master ? master.slice() : [];
  Object.keys(seen).forEach(function (k) {
    if (!masterKey[classKey_(k)]) kelas.push({ kelas: k, jenjang: seen[k], jumlah_siswa: null, di_luar_master: !!master });
  });
  return {
    ok: true, versi: 1, dibuat: new Date().toISOString(), zona_waktu: tz,
    master_kelas: !!master, periode: periods, kelas: kelas,
    // Baris: [id periode, kelas, jenjang, jawaban Soal 3-9 ("0"-"3" x7), Soal 10 (0-3), kode hambatan Soal 11]
    kolom: ['periode', 'kelas', 'jenjang', 'kebiasaan', 'hp_di_kasur', 'hambatan'],
    baris: rows,
  };
}

/* ---------- penyiapan (jalankan sekali dari editor) ---------- */

function siapkanVertikal() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('DATA_TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('DATA_TOKEN', token);
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(MASTER_SHEET)) {
    var data = buildData();
    var names = data.kelas.map(function (k) { return k.kelas; });
    names.sort(function (a, b) {
      var ga = ['X', 'XI', 'XII'].indexOf(gradeOf_(a)), gb = ['X', 'XI', 'XII'].indexOf(gradeOf_(b));
      return ga - gb || a.localeCompare(b, 'id', { numeric: true });
    });
    var sh = ss.insertSheet(MASTER_SHEET);
    sh.getRange(1, 1, 1, 3).setValues([['Kelas', 'Jumlah Siswa', 'Email Wali Kelas']]).setFontWeight('bold');
    if (names.length) sh.getRange(2, 1, names.length, 1).setValues(names.map(function (n) { return [n]; }));
    sh.setFrozenRows(1);
    sh.autoResizeColumn(1);
  }
  Logger.log('DATA_TOKEN (salin ke secret SHEET_API_TOKEN di Cloudflare Worker):\n' + token);
  Logger.log('Tab "' + MASTER_SHEET + '" siap. Isi kolom Jumlah Siswa dari data TU.');
}

/** Ganti token bila bocor. Setelah itu perbarui SHEET_API_TOKEN di backend. */
function gantiTokenVertikal() {
  PropertiesService.getScriptProperties().deleteProperty('DATA_TOKEN');
  siapkanVertikal();
}
