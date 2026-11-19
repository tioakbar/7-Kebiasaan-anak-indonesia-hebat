# Dashboard Monitoring 7 KAIH — SMA Plus PGRI Cibinong

Dashboard pemantauan Kuesioner 7 Kebiasaan Anak Indonesia Hebat (7 KAIH) oleh Tim VERTIKAL.

- **Tampilan umum (siswa dan pengunjung):** rekap sekolah dan per jenjang (X, XI, XII), tanpa nama kelas.
- **Guru (tombol "Masuk guru"):** rincian per kelas, Rapor kelas untuk wali kelas, unduh laporan PDF/Word/CSV, dan Vertikal AI.

## Isi folder

| Folder/file | Fungsi |
|---|---|
| `index.html`, `assets/`, `site.webmanifest` | Halaman dashboard (disajikan GitHub Pages) |
| `data/simulasi/` | Data contoh, dipakai bila backend belum tersambung |
| `worker/` | Backend di Cloudflare Workers: login guru, data dari spreadsheet, Vertikal AI |
| `apps-script/` | Kode Apps Script di Google Spreadsheet kuesioner |

## Keamanan

Kode akses guru, token spreadsheet, dan kunci Gemini **tidak** disimpan di repo ini. Semuanya disimpan sebagai *secret* di Cloudflare Worker dan Script Properties Apps Script. Nama dan email siswa tidak pernah keluar dari spreadsheet.

Panduan pemasangan lengkap ada di dokumen *Panduan Pemasangan Dashboard 7 KAIH* (Word).
