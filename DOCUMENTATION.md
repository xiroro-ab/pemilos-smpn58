# Dokumentasi E-Voting Pemilos SMPN 58 Palembang

Dokumen ini berisi seluruh alur logika, struktur desain, serta catatan perbaikan (*fixes*) penting dari aplikasi E-Voting Pemilos. Tujuan dokumen ini adalah sebagai panduan atau memori (konteks) agar AI atau pengembang di masa depan dapat melanjutkan proyek tanpa kebingungan atau mengulangi kesalahan yang sama.

---

## 🏗️ 1. Arsitektur Sistem

- **Frontend:** HTML5, Vanilla JavaScript, Vanilla CSS.
- **Backend:** Node.js dengan framework Express.
- **Database:** Supabase (PostgreSQL) menggunakan `@supabase/supabase-js`.
- **Hosting:** Vercel (Frontend & Serverless Backend).
- **Desain UI:** *Glassmorphism*, *Dark Mode*, *Neon Effects* (Premium & Modern).

### 1.1. Struktur File Utama
- `/public/index.html` : Halaman utama (Login Siswa, Halaman Coblos, & Hasil ID Card).
- `/public/admin.html` : Halaman khusus admin (Dashboard Statistik, Live Feed Animasi, Pengaturan Data).
- `/public/style.css` & `/public/admin.css` : File desain dan animasi (UI/UX).
- `/public/app.js` : Logika khusus siswa (Login, Voting, Animasi *Confetti*).
- `/public/admin.js` : Logika khusus admin (Polling Dashboard, Live Race Bar, Import CSV, Unggah Paslon).
- `server.js` : Backend Server API untuk mengatur transaksi *Vote*, Autentikasi, dan menjembatani *query* ke Supabase.

---

## 🔄 2. Alur Logika (User Flow)

### A. Alur Pemilih (Siswa) - `app.js`
1. **Login:** Siswa memasukkan NISN (atau ID). Backend mencocokkan di tabel `students`. Jika `hasVoted: true`, sistem menolak login (anti-dobel).
2. **Perekaman Perangkat:** Saat login, IP perangkat dicatat di `login_logs` untuk audit.
3. **Voting:** Setelah login, siswa melihat daftar kandidat (diambil secara dinamis dari tabel `candidates`). Setelah menekan *Coblos*, transaksi suara dikirim ke backend.
4. **Keamanan Transaksi:** Backend memvalidasi kembali token NISN. Jika sah, kolom `votes` pada kandidat ditambah 1, dan `hasVoted` pada siswa menjadi `true`. Ini dilakukan dalam operasi yang dijamin tidak bisa ganda.
5. **ID Card Canva:** Setelah mencoblos, siswa disajikan "Voter Pass" premium berbentuk ID Card vertikal. ID card ini memuat Avatar dinamis (DiceBear Micah), nama siswa, barcode, dan fitur tombol **Simpan Card** untuk dibagikan ke Media Sosial.

### B. Alur Admin & Live Feed - `admin.js`
1. **Dashboard Utama:** Menampilkan ringkasan (Total Partisipasi, Siswa Memilih, Golput) serta daftar riwayat aktivitas log (`activity_logs`).
2. **Live Feed Arena (Grafik Bar):**
   - Menggunakan teknik *Polling* (pengambilan data otomatis) ke backend setiap 1,5 detik.
   - Perhitungan tinggi batang grafik (Progress Bar) tidak menggunakan presentase linear murni, melainkan **Kurva Akar Kuadrat (*Square Root Scale*)**. 
   - **Tujuan Akar Kuadrat:** Agar 1 atau 2 suara awal (dari total 1000 siswa) langsung terlihat signifikan perbedaannya secara visual (naik belasan pixel), dan akan presisi mencapai 100% tinggi penuh saat suara sudah mencapai batas maksimum.
3. **Live Carousel & Danmaku:**
   - Nama-nama siswa yang baru saja mencoblos akan berjalan dari kanan ke kiri layar (Animasi Danmaku).
   - Background dan profil/poster paslon berganti secara otomatis (Slider/Carousel) setiap **10 detik**.
4. **Pengaturan Kandidat (Foto & Video):**
   - Admin dapat mengunggah foto profil (Avatar) maupun Poster Kampanye.
   - **Kompresi Canvas:** Gambar akan dikompresi *Client-Side* menggunakan HTML Canvas menjadi `.jpeg` sebelum dikirim ke server.
5. **Import Siswa (CSV):** Fitur mass-upload untuk memasukkan ratusan data siswa sekaligus ke database Supabase.

---

## 🛠️ 3. Catatan Bug Kritis & Perbaikan (Crucial Fixes)
*Harap perhatikan poin ini agar kesalahan yang sama tidak terulang di masa depan!*

1. **Bug Timeout Database & Vercel Payload Limit (4.5MB) ❌**
   - **Masalah:** Sistem tiba-tiba blank (putih) dan Live Feed berhenti. Akar masalahnya adalah Admin mengunggah gambar "Poster" beresolusi super besar. Vercel Serverless Function memiliki batas maksimum transfer data (Payload) sebesar 4.5MB. Jika data JSON yang dikirim backend lebih dari itu, Vercel akan otomatis menggagalkan *request*.
   - **Solusi Permanen:** Fitur unggah foto (`previewPoster` dan `previewFile` di `admin.js`) sekarang sudah disisipkan logika kompresi `canvas`. Dimensi maksimal dibatasi 1200px (untuk poster) dan 600px (untuk avatar) dengan kualitas JPEG `0.6`. Backend kini kebal dari limit Payload Vercel.

2. **Bug Avatar "Kepala Gundul" / Format DiceBear ❌**
   - **Masalah:** API DiceBear V7 untuk gaya `avataaars` sangat sensitif terhadap array atau parameter ganda (seperti `top=longHair,straight...`), yang menyebabkan API mengembalikan Error 400 atau merender avatar menjadi kepala botak.
   - **Solusi Permanen:** Penggunaan *style* `avataaars` ditiadakan untuk menghindari kerumitan. Sistem diganti menggunakan **DiceBear Micah** (`/7.x/micah/svg?seed=...`). Micah secara *default* sudah merender wajah, bahu, dan rambut/baju premium dengan jaminan anti-gagal tanpa perlu parameter ekstra.

3. **Bug Animasi Danmaku (Notifikasi Live) Overlap ❌**
   - **Masalah:** Animasi teks siswa berjalan (dari kanan ke kiri) saling menimpa (*overlap*) karena menggunakan elemen dengan posisi vertikal (*top*) secara acak (*random*). 
   - **Solusi Permanen:** Danmaku dibagi menggunakan jalur tetap (misalnya 5 jalur horizontal/track). Setiap elemen ditempatkan pada slot jalurnya masing-masing secara bergiliran agar rapi layaknya video *Live Streaming*.

4. **Keseimbangan Tombol ID Card ❌**
   - **Masalah:** Tombol "Simpan Card" dan "Selesai" tidak sama besar.
   - **Solusi Permanen:** Class `.btn-primary` di `style.css` secara paksa menggunakan `width: 100%`. Sehingga bila kedua tombol diletakkan bersebelahan menggunakan *flexbox*, lebarnya akan berantakan. Solusinya adalah mendefinisikan *inline-style* `width: 100%;` secara eksplisit pada kedua tombol dalam *wrapper* `display: flex`.

---

## 🎨 4. Desain & Estetika (Aturan UI)
Jika Anda (AI) ditugaskan untuk menambahkan menu baru, Anda **WAJIB** mengikuti panduan estetika berikut:
- **Jangan gunakan warna datar standar!** Gunakan gradien yang menarik (misal: `linear-gradient(135deg, var(--primary) 0%, #a855f7 100%)`).
- Tambahkan properti *box-shadow* lembut berwarna primer dengan opacity ringan.
- Elemen kartu (Cards) harus memiliki `border-radius: 20px` atau lebih, serta efek kaca `backdrop-filter: blur(10px)` *(Glassmorphism)*.
- Pertahankan font kekinian, pesan-pesan interaktif bergaya *Gen-Z*, serta *Micro-animations* (hover scale / translateY). 
- Aplikasi ini bukan purwarupa (MVP) murahan, tampilan harus selalu dijaga di tingkat *Super Premium*.

---

*File ini digenerate otomatis berdasarkan riwayat pengerjaan proyek dari Fase 1 hingga penyelesaian sistem.*
