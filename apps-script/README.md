# Menyambungkan spreadsheet kuesioner ke dashboard

Panduan ini menyambungkan spreadsheet **(ALL) KUESIONER - 7 Kebiasaan Anak Indonesia Hebat** ke dashboard dan Vertikal AI. Setelah tersambung, data selalu terbaru tanpa upload manual.

```
Google Form ──▶ Spreadsheet (privat) ──▶ Apps Script (Code.gs) ──token──▶ Cloudflare Worker / PHP ──login guru──▶ Dashboard + Vertikal AI
```

- **Setiap tab respons = satu periode pengisian.** Nama tab menjadi label periode, misalnya "7 November", dan urutan tab menjadi urutan periode. Untuk periode baru cukup tambah tab. Tab yang bukan berisi respons diabaikan.
- **Nama dan email siswa tidak pernah keluar dari spreadsheet.** Keduanya hanya dipakai di dalam script untuk membuang isian ganda; yang dipakai adalah isian terakhir tiap siswa per periode.
- **Hanya backend yang memegang token.** Browser guru tidak pernah memanggil script ini langsung. Dashboard meminta data ke backend setelah guru login dengan kode akses.

## Pasang (sekali saja, oleh pemilik spreadsheet)

1. Buka spreadsheet, lalu pilih **Ekstensi → Apps Script**.
2. Hapus isi `Code.gs`, tempel **seluruh isi** `apps-script/Code.gs`, lalu klik **Simpan**.
3. Di toolbar, pilih fungsi **`siapkanVertikal`** lalu klik **Jalankan**. Izinkan akses dengan akun sekolah. Setelah selesai:
   - **Log eksekusi** menampilkan `DATA_TOKEN`. Salin token itu dan jangan dibagikan.
   - Tab baru **Master Kelas** muncul, berisi kelas yang sudah pernah mengisi. Lakukan dua hal di tab ini:
     - isi kolom **Jumlah Siswa** dari data TU, supaya persentase partisipasi bisa dihitung;
     - tambahkan kelas yang belum pernah mengisi sama sekali.
   - Kolom **Email Wali Kelas** boleh dikosongkan dulu. Kolom ini disiapkan untuk akses per wali kelas nanti dan tidak dikirim ke dashboard.
4. Klik **Terapkan → Deployment baru**, pilih jenis **Aplikasi web**, lalu isi:
   - *Jalankan sebagai*: **Saya** (pemilik spreadsheet).
   - *Yang memiliki akses*: **Siapa saja**.

   Pilihan "Siapa saja" dibutuhkan supaya backend bisa memanggilnya. Tanpa token yang benar, script hanya membalas `unauthorized` dan tidak mengirim data.
5. Klik **Terapkan**, lalu salin **URL aplikasi web** (berakhiran `/exec`).
6. Isi dua variabel di backend:

   | Backend | `SHEET_API_URL` | `SHEET_API_TOKEN` |
   |---|---|---|
   | Cloudflare Worker | Variabel tipe *Text* | Variabel tipe **Secret** |
   | XAMPP | `SetEnv SHEET_API_URL "…/exec"` di `httpd-vertikal-ai.conf` | `SetEnv SHEET_API_TOKEN "…"` |

7. Buka dashboard dan masuk dengan kode akses guru. Label di bawah sidebar akan menjadi **"Tersambung ke Google Spreadsheet"**.

## Pemakaian rutin

- **Periode baru:** buat tab respons baru (misalnya dari Form periode berikutnya). Tab baru otomatis muncul sebagai periode terakhir, paling lambat 1 menit kemudian.
- **Kelas baru atau jumlah siswa berubah:** ubah tab **Master Kelas**.
- **Nama kelas di Form salah ketik:** halaman *Laporan dan data* menandai nama kelas yang tidak ada di Master Kelas.
- **Script diperbarui:** tempel `Code.gs` versi baru, lalu buka **Terapkan → Kelola deployment → Edit → Versi baru**. URL tidak berubah.
- **Token bocor:** jalankan **`gantiTokenVertikal`**, lalu perbarui `SHEET_API_TOKEN` di backend.

## Perbaikan yang disarankan di Google Form

- Soal 11: aktifkan validasi jawaban **"Pilih paling banyak 2"**. Saat ini banyak isian memilih 3–4 hambatan.
- Pilihan jenjang **"KelasXI"** sebaiknya ditulis **"Kelas XI"**, supaya sama dengan X dan XII. Script sudah membaca keduanya.
- Teks pengantar Form: karena nama dan email dikumpulkan, jangan sebut kuesioner ini anonim. Jelaskan bahwa hasilnya hanya ditampilkan per kelas.
