# Data cadangan

Sumber data utama dashboard adalah Google Spreadsheet kuesioner lewat Apps Script (lihat `apps-script/README.md`).

Kalau spreadsheet belum disambungkan, file **`kuesioner.json`** di folder ini dibaca oleh dashboard dan Vertikal AI. File itu dibuat dari tombol **Simpan untuk GitHub** di halaman *Laporan dan data*, setelah file Excel dari spreadsheet di-upload:

- setiap tab menjadi satu periode pengisian, dan jumlah periodenya tidak dibatasi;
- nama dan email siswa sudah dibuang;
- isian ganda sudah diambil yang terakhir.

Jangan menaruh ekspor Google Form mentah di sini, karena repo GitHub Pages bisa dibuka publik.

`simulasi/kuesioner.json` berisi data contoh yang sama dengan dashboard. Buat ulang dengan:

```sh
node tests/stats-parity.js --make-simulation
```
