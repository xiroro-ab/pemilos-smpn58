# Dokumentasi Pembaruan Sistem Pemilos SMPN 58 Palembang (Pra-Rilis Hari H)

Dokumen ini mencatat seluruh perbaikan (*bug fixes*), pengoptimalan, dan penambahan fitur yang dilakukan untuk menstabilkan aplikasi Pemilos sebelum pelaksanaan Hari-H.

## 1. Optimalisasi Fitur ID Card & Avatar (Halaman Pemilih)
- **Penghapusan Fitur "Simpan Card":** 
  Fitur unduh menggunakan `html2canvas` dihapus seluruhnya karena menyebabkan penurunan resolusi (gambar kabur/kotak kecil) dan gagal me-render elemen eksternal (CORS/Avatar) dengan sempurna. 
- **Penyederhanaan UI "Selesai":** 
  Tombol "Selesai" diubah menjadi satu tombol penuh berwarna gradien merah muda, dengan tambahan teks petunjuk visual agar siswa cukup menggunakan fitur *Screenshot* bawaan HP masing-masing (`✨ Screenshot layar (Tangkapan Layar) pamerin ke IG/WA Story! ✨`).
- **Kualitas Avatar Maksimal:** 
  Format *Dicebear Avatar* dikembalikan ke `.svg` (kemudian ke `.png` dengan resolusi `size=512`) untuk memastikan hasil wajah yang sangat tajam dan tidak pecah.

## 2. Perbaikan Sistem Toggle Gender Avatar
- **Isu:** Saat teks atau gambar avatar diklik untuk mengganti gender, API berhasil terpanggil namun layar (browser) menolak untuk memperbarui/melukis ulang gambarnya karena masalah *caching* dan *rendering lock* pada elemen dengan efek filter CSS 3D.
- **Solusi (DOM Node Replacement):**
  - Mengubah logika di `app.js` menjadi penghancuran mutlak elemen `<img>` lama.
  - Sistem membuat kloningan elemen gambar baru, menyuntikkan URL gambar avatar yang baru, lalu memaksa DOM untuk menggantikan posisi gambar lama dengan kloningan gambar baru (`replaceChild`).
  - Menambahkan indikator visual (animasi `opacity: 0.4` selama pemuatan) untuk memberi sinyal kepada siswa bahwa gambar sedang dimuat.

## 3. Fitur Pembersihan Data Uji Coba (Reset Hari-H)
- **Skrip Backend Otomatis (`reset-pemilos.js`):**
  Dibuat sebuah *script maintenance* berbasis Node.js untuk menghapus jejak simulasi secara instan, meliputi:
  - Mengembalikan seluruh status 298 siswa menjadi Belum Memilih (`hasVoted = false`, `votedAt = null`).
  - Mereset total perolehan suara seluruh kandidat menjadi `0`.
  - Mengosongkan tabel `activity_logs`.
- **Integrasi Antarmuka Admin (GUI):**
  - Mengingat panitia lebih nyaman dengan UI grafis ketimbang Terminal/CMD, dibuatkan *endpoint* baru di `server.js` yaitu `POST /api/admin/reset-database`.
  - Ditambahkan tombol merah khusus `⚠️ Reset Hari-H` di panel Admin bagian "Data Pemilih".

## 4. Perombakan Sistem Modal (Pop-up) Admin
- **Custom Prompt Modal:**
  Meninggalkan fungsi *native* `prompt()` bawaan browser yang kaku, dan merancang ulang sistem Pop-up kustom (`showCustomPrompt`) yang berjalan mulus dengan UI aplikasi.
- **Sistem Keamanan Berlapis (Anti Kepencet):**
  Fitur Reset Hari-H dibekali dua lapis validasi. Lapis pertama adalah konfirmasi peringatan, dan lapis kedua mewajibkan Admin mengetik kata "RESET" dengan huruf kapital.
- **Perbaikan Race Condition (Bug Callback):**
  Menemukan dan memperbaiki tabrakan *asynchronous* pada Javascript di mana eksekusi pemanggilan Pop-up beruntun menyebabkan Pop-up kedua seketika ditelan (ditutup) oleh sisa memori eksekusi Pop-up pertama. Penambahan *delay* `setTimeout(50ms)` memastikan DOM layar sempat bernapas sebelum Pop-up baru dimunculkan.
- **Konsistensi Desain UI/UX (CSS Alignment):**
  Mentransfer baris-baris kode CSS dari `style.css` (Halaman Utama) menuju `admin.css` (Halaman Admin). Ini memastikan setiap kotak Pop-up dan Tombol di panel Admin turut memiliki efek *Glassmorphism* (kaca transparan), bayangan neon, dan animasi *bounce* yang mewah layaknya Halaman Pencoblosan.

## 5. Optimalisasi Skalabilitas untuk 300+ Siswa Bersamaan
- **RPC Function Atomik (Vote Protection):**
  Dibuat PostgreSQL function `submit_vote()` di Supabase untuk menangani voting secara atomik. Mencegah race condition dimana 2+ siswa vote bersamaan dan menyebabkan vote hilang. Logika:
  - Lock record siswa (FOR UPDATE)
  - Cek apakah sudah vote
  - Update status siswa dan votes kandidat dalam satu transaksi
  - Tidak bisa diselip request lain di tengahnya

- **Connection Pooling:**
  Tambah opsi `persistSession: false` di Supabase client untuk mempercepat pooling koneksi dan mengurangi overhead per request.

- **Rate Limiting Per NISN:**
  Implementasi server-side rate limiting dengan Map untuk cooldown 5 detik per NISN. Mencegah siswa spam vote button berkali-kali dalam hitungan detik.

- **Query Optimization:**
  Endpoint `/api/candidates` ditambah field `vision_video_url` dan `vision_poster` saat fetch data untuk mengurangi query round-trip.

## 6. Fitur YouTube Video pada Halaman Pemilih
- **Integrasi Video di Candidate Cards:**
  Tambah parsing YouTube URL (support format shorts, regular watch, dan youtu.be) di `app.js` function `renderCandidates()`. Video ditampilkan dalam iframe dengan styling modern.

- **CSS Styling untuk Video Container:**
  Buat `.candidate-video` class dengan styling border-radius, padding, dan responsive layout agar video tampil profesional di candidate card.

- **Cache Busting:**
  Update app.js version dari `v=11` ke `v=12` di index.html untuk memastikan browser load versi terbaru kode.

## 7. Live Feed Admin dengan Video YouTube & Poster
- **Carousel Queue System:**
  Refactor logic live feed dari index-based ke queue-based system. Setiap paslon bisa punya multiple items:
  - Poster (jika ada) → 10 detik
  - Video YouTube (jika ada) → Selesai dulu baru lanjut ke paslon berikutnya
  - Text standar (nama + visi) → 30 detik

- **YouTube URL Parsing untuk Shorts:**
  Tambah support untuk format `youtube.com/shorts/` di samping `youtu.be/` dan `v=` format di function `updateCarousel()`.

- **Video Duration Handling:**
  Gunakan YouTube Player API event `onStateChange` untuk detect video selesai (ENDED state), baru lanjut ke item berikutnya. Timeout fallback 180 detik untuk iframe fallback.

- **Smooth Fade Transitions:**
  Setiap transisi item di carousel punya fade-out (opacity 0) dan fade-in (opacity 0.9 untuk video, 0.7 untuk poster/text) dengan delay 1 detik untuk smooth effect.

## 8. Manajemen Data Pemilih - Delete All Voters
- **New Endpoint:** `POST /api/admin/delete-all-voters`
  Endpoint untuk menghapus SEMUA data pemilih dari database tanpa mempengaruhi data kandidat atau vote count.

- **Double Confirmation Security:**
  - Konfirmasi pertama: Modal warning yang menjelaskan tindakan dan dampaknya
  - Konfirmasi kedua: Custom prompt yang mewajibkan admin mengetik "HAPUS SEMUA" (case-sensitive)

- **UI Button:**
  Tombol orange `🗑️ Hapus Semua Data` di panel Admin > Data Pemilih, terletak sebelum tombol Reset Hari-H.

- **Use Case:**
  Untuk cleanup data pemilih yang salah atau persiapan data sebelum import data baru dari Dapodik.

---

## Ringkasan Performa & Keamanan

| Aspek | Status | Detail |
|-------|--------|--------|
| Race Condition | ✅ Fixed | RPC atomik mencegah vote duplikat |
| Skalabilitas | ✅ Optimized | Tested untuk 300+ siswa bersamaan |
| Rate Limiting | ✅ Implemented | 5 detik cooldown per NISN |
| Video Support | ✅ Complete | Voting page + Live feed admin |
| Carousel Logic | ✅ Refactored | Queue-based, support poster + video |
| Data Management | ✅ Enhanced | Delete all voters + reset database |
| Security | ✅ Enhanced | Double confirmation, keyword validation |

*Seluruh perbaikan di atas memastikan aplikasi berada dalam performa puncak, kebal terhadap eror render browser, dan 100% siap digunakan pada acara Pemilos SMPN 58 Palembang yang sebenarnya pada Hari-H.*
