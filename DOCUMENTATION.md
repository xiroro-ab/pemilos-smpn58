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

---
*Seluruh perbaikan di atas memastikan aplikasi berada dalam performa puncak, kebal terhadap eror render browser, dan 100% siap digunakan pada acara Pemilos SMPN 58 Palembang yang sebenarnya.*
