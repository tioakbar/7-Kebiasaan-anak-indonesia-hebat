# Vertikal AI di Cloudflare Workers

GitHub Pages hanya menyajikan file statis. Halaman itu tidak bisa menjalankan PHP dan tidak bisa menyimpan kunci Gemini secara rahasia. Karena itu, backend Vertikal AI dijalankan di **Cloudflare Workers**, yang paket gratisnya sudah cukup. Dashboard tetap di GitHub Pages.

```
Browser (GitHub Pages)  ──token──▶  Cloudflare Worker  ──x-goog-api-key──▶  Gemini
        │                                  │
        └── Google Spreadsheet (Apps Script) / data/kuesioner.json ◀──┘
```

Dengan `SHEET_API_URL`, data diambil langsung dari Google Spreadsheet lewat Apps Script; dashboard memintanya ke Worker setelah guru login (action `data`). Tanpa itu, Worker membaca `data/kuesioner.json` (atau data contoh `data/simulasi/kuesioner.json`) dari GitHub Pages.

`vertikal-ai.js` adalah port dari `api/*.php`. Untuk ratusan kombinasi argumen, hasil semua fungsi statistiknya diuji sama persis dengan versi PHP (`node tests/worker-test.mjs`).

## Pasang lewat dashboard Cloudflare (tanpa install apa pun)

1. Masuk ke <https://dash.cloudflare.com>, lalu buka **Workers & Pages → Create → Create Worker**. Beri nama `vertikal-ai`, lalu klik **Deploy**.
2. Klik **Edit code**, hapus isi contoh, tempel **seluruh isi** `worker/vertikal-ai.js`, lalu klik **Deploy**.
3. Buka **Settings → Variables and Secrets** dan tambahkan isian berikut.

   | Nama | Tipe | Isi |
   |---|---|---|
   | `GEMINI_API_KEY` | **Secret** | Kunci Gemini (`AIza…` atau `AQ.…`) |
   | `VERTIKAL_AI_ACCESS_CODE` | **Secret** | Kode akses guru, minimal 8 karakter |
   | `SITE_URL` | Text | URL dashboard, mis. `https://akun.github.io/web3d/` |
   | `ALLOWED_ORIGINS` | Text | `https://akun.github.io` |
   | `GEMINI_MODEL` | Text | Opsional, default `gemini-3.8-flash` |
   | `GEMINI_THINKING` | Text | Opsional, `low` (default, cepat), `medium`, atau `high` |
   | `SHEET_API_URL` | Text | Opsional (disarankan): URL Web App Apps Script, lihat `apps-script/README.md` |
   | `SHEET_API_TOKEN` | **Secret** | Token dari `siapkanVertikal()` di Apps Script |

4. Salin URL Worker dari halaman Overview, mis. `https://vertikal-ai.akun.workers.dev/`.
5. Di `index.html`, ganti meta berikut, lalu push ke GitHub:

   ```html
   <meta name="vertikal-ai-endpoint" content="https://vertikal-ai.akun.workers.dev/">
   ```

6. Buka dashboard di GitHub Pages, klik tombol Vertikal AI, lalu masukkan kode akses.

Kunci tidak pernah masuk ke repo atau ke browser, karena hanya Worker yang menyimpannya.

### Membuka `index.html` langsung dari folder (file://)

Halaman yang dibuka sebagai file punya origin `null`. Kalau ini ingin dipakai, tambahkan `null` ke `ALLOWED_ORIGINS`, misalnya `https://akun.github.io, null`.

Opsi ini cukup aman, karena setiap permintaan tetap butuh token hasil login dengan kode akses. Meski begitu, sebaiknya opsi ini hanya dipakai saat mencoba.

### Rate limit yang tahan restart (opsional)

Tanpa konfigurasi tambahan, batas permintaan disimpan di memori Worker. Batas ini bisa ter-reset saat Worker di-restart. Supaya permanen:

1. Buat KV namespace di **Storage & Databases → KV**.
2. Hubungkan ke Worker di **Settings → Bindings → KV namespace** dengan nama `VAI_KV`.

## Pasang lewat CLI (alternatif)

```sh
cd worker
# edit SITE_URL dan ALLOWED_ORIGINS di wrangler.toml
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put VERTIKAL_AI_ACCESS_CODE
npx wrangler deploy
```

## Keamanan

- **Login:** kode akses ditukar dengan token bertanda tangan HMAC-SHA256. Token berlaku 8 jam dan disimpan di `sessionStorage` tab, bukan cookie, karena cookie lintas domain diblokir browser. Mengganti kode akses atau kunci Gemini membatalkan semua token lama.
- **Konteks percakapan:** id interaksi Gemini ditandatangani bersama id sesi, jadi tidak bisa dipalsukan atau dipakai sesi lain.
- **Origin:** origin di luar `ALLOWED_ORIGINS` ditolak. Setiap permintaan juga wajib membawa header `X-Vertikal-AI: 1`.
- **Batasan per IP:**
  - 12 pertanyaan per 10 menit;
  - 150 pertanyaan per hari;
  - 6 percobaan login per 15 menit;
  - pesan maksimal 800 karakter;
  - timeout Gemini 90 detik per panggilan;
  - maksimal 6 putaran model dan 8 pemanggilan fungsi per pertanyaan.
- **Isi kiriman ke Gemini:** hanya hasil agregat. Kelompok dengan responden di bawah `CONFIG.minN` disembunyikan, termasuk penyembunyian sekunder.
- **Pengecekan angka:** angka di jawaban yang tidak ada di hasil fungsi memicu satu permintaan perbaikan. Kalau angka itu masih ada, angkanya ditandai di chat.

**Catatan data:** file `data/kuesioner.json` di GitHub Pages bisa diunduh siapa pun yang tahu alamatnya. Isinya tetap anonim (kolom nama dan email sudah dibuang lewat tombol "Simpan untuk GitHub"). Login hanya melindungi endpoint AI, bukan file itu. Kalau repo publik, pastikan sekolah setuju data per baris yang anonim itu terbuka.

**Batas paket gratis:** Workers gratis memberi 10 ms CPU per permintaan. Waktu menunggu Gemini tidak dihitung, dan data diparse sekali lalu di-cache 60 detik. Kalau muncul error "exceeded CPU", aktifkan Workers Paid.
