# Product Requirements Document (PRD)
## Barengyin — Couples Expense & Income Tracker

**Versi Dokumen:** 1.0
**Tanggal:** 14 September 2026
**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + Auth + Storage + Realtime)
**Sumber Analisis:** UI hasil Google Stitch — Landing Page, Halaman Masuk, Dashboard (referensi terlampir)

---

## 1. Latar Belakang & Tujuan

Barengyin adalah aplikasi web pencatatan pengeluaran dan pemasukan yang dirancang khusus untuk **pasangan** (couples), bukan individu. Masalah yang ingin diselesaikan: pasangan sering kesulitan melacak siapa membayar apa, bagaimana pembagian (split) biaya bersama, dan berapa progres tabungan/anggaran bersama — yang berpotensi memicu konflik finansial ("financial drama").

**Tagline produk:** *"Catat pengeluaran & pemasukan berdua, tanpa drama."*

### Tujuan Produk
- Memungkinkan dua orang (pasangan) mengelola satu atau lebih dompet bersama secara transparan.
- Menyediakan mekanisme split biaya yang fleksibel (50:50, proporsional, dibayar salah satu pihak, ditanggung berdua).
- Memberi visibilitas cepat atas kondisi keuangan bersama (saldo, budget, tren pengeluaran) lewat dashboard.
- Mempermudah pencatatan transaksi lewat scan struk otomatis (AI/OCR).

---

## 2. Target Pengguna

- Pasangan berpacaran atau menikah di Indonesia yang ingin mengelola keuangan bersama tanpa harus punya rekening gabungan secara resmi.
- Pengguna yang nyaman dengan pencatatan digital tapi ingin sesuatu yang lebih personal/playful dibanding aplikasi finance korporat yang kaku.

Berdasarkan copy di landing page: *"Dulu sering ribut tiap akhir bulan nanya uang lari ke mana, sekarang udah clear, kencan jadi bebas rasa bersalah."* — pain point utama adalah **kurangnya transparansi** dan **rasa bersalah/curiga** terkait pengeluaran bersama.

---

## 3. Lingkup (Scope) — Berdasarkan 3 Halaman yang Dianalisis

### 3.1 Landing Page
**Tujuan:** Konversi pengunjung menjadi pengguna terdaftar.

Komponen yang teridentifikasi dari desain:
- Navbar: logo, menu (Fitur, Cara Kerja, FAQ), tombol Masuk & Daftar Gratis
- Hero section: headline "Catat Pengeluaran & Pemasukan Berdua Tanpa Drama", 2 CTA (Mulai Gratis, Lihat Live Demo), badge sosial proof ("Dipercaya 15.000+ pasangan aktif"), ilustrasi hero
- Section "Kenapa Barengyin?" — 3 fitur unggulan:
  1. **Split Pengeluaran Instan** — tentukan porsi 50:50, proporsional, atau gantian bayar
  2. **Riwayat Super Transparan** — semua pengeluaran tercatat rapi per kategori, notifikasi real-time tiap ada transaksi baru
  3. **Scan Struk Pakai AI** — foto struk, AI otomatis baca item dan nominal
- Preview dashboard (screenshot produk dalam frame browser)
- Section "Cara Kerja Dalam 3 Langkah":
  1. Undang pasangan via link rahasia (invite link)
  2. Pilih mode dompet: Gabung atau Pisah
  3. Input atau scan struk & santai bareng
- Section testimoni singkat (cerita pengguna)
- FAQ accordion — pertanyaan yang teridentifikasi:
  - Apakah data perbankan kami aman?
  - Bisa dipakai kalau belum menikah?
  - Apakah aplikasi ini beneran gratis?
- CTA penutup + footer (Tentang Kami, Fitur, Keamanan Data, Syarat & Ketentuan, Kebijakan Privasi, Hubungi Kami)

### 3.2 Halaman Masuk (Login)
**Tujuan:** Autentikasi pengguna ke akun/dompet bersama.

Field & elemen yang teridentifikasi:
- Email (input, wajib)
- Kata Sandi / Password (input dengan toggle show/hide, wajib)
- Link "Lupa Password?"
- Checkbox "Ingat sesi kami berdua di laptop ini" (remember me)
- Tombol utama "Masuk Sekarang"
- Login alternatif: "Lanjutkan dengan Google" (OAuth)
- Opsi tambahan: **"Masuk dengan PIN Pasangan (4 Digit)"** — mekanisme quick-access khusus dalam konteks dompet bersama
- Link ke halaman Daftar (Sign Up) — belum ada di scope desain awal, tapi wajib ada sebagai flow terusan
- Footer: Syarat & Ketentuan, Kebijakan Privasi, Pusat Bantuan

### 3.3 Dashboard
**Tujuan:** Pusat kendali harian pasangan atas kondisi keuangan bersama.

Struktur (sesuai revisi kamu: navbar & daftar fitur di **sidebar kiri**, bukan navbar atas seperti referensi awal):

**Sidebar Kiri (Navigasi Utama):**
1. Dashboard
2. Transaksi
3. Anggaran (Budget)
4. Laporan
5. Scan Struk
6. Pasangan (partner/couple settings)
7. Pengaturan
8. Widget status pasangan di bagian bawah sidebar (nama kedua pasangan, status "Duo Sync", rasio split default)

**Top Bar:**
- Selector periode (bulan aktif) + label dompet aktif (misal "Dompet Gabungan")
- Avatar pasangan (2 avatar bertumpuk) + tombol "Catat Cepat"
- Notifikasi (bell icon dengan badge jumlah)

**Konten Utama:**
1. **Header sambutan** — "Halo, [Nama A] & [Nama B]!" + badge status real-time sync + ringkasan singkat (persentase hemat) + tombol aksi cepat: Scan Bon, + Catat Transaksi
2. **3 Kartu Statistik Utama:**
   - Total Pemasukan Bersama (dengan breakdown kontribusi per pasangan + % perubahan dari bulan lalu)
   - Total Pengeluaran Bersama (dengan progress bar terhadap limit budget bulanan)
   - Sisa Saldo & Tabungan (dengan status kesehatan keuangan + progress target tabungan bernama, misal "Target Bali")
3. **Grafik Pengeluaran 6 Bulan Terakhir** — bar chart dual-series (Pengeluaran vs Tabungan) per bulan, dengan insight otomatis (AI-generated insight banner)
4. **Progress Anggaran per Kategori** — daftar kategori budget (Makan & Kencan, Groceries & Rumah, Transportasi, Hiburan & Nonton, dst.) dengan progress bar dan opsi tambah kategori baru
5. **Transaksi Terbaru (Live Feed)** — list transaksi dengan filter tab (Semua, Dibayar A, Dibayar B, Split 50:50), tiap baris menampilkan: ikon kategori, nama transaksi, siapa yang bayar, jenis split, nominal (warna hijau untuk masuk, merah untuk keluar), tanggal — plus link "Lihat Semua Transaksi"

---

## 4. Functional Requirements

### 4.1 Autentikasi & Akun
- FR-1: Pengguna dapat mendaftar dengan email + password.
- FR-2: Pengguna dapat login dengan email + password.
- FR-3: Pengguna dapat login dengan Google OAuth.
- FR-4: Pengguna dapat reset password lewat email.
- FR-5: Pengguna dapat mengaktifkan PIN 4 digit sebagai metode login cepat khusus perangkat bersama (shared device), sebagai lapisan tambahan setelah akun utama pernah login di device tersebut.
- FR-6: Sesi dapat "diingat" (persistent session) di perangkat tertentu.

### 4.2 Manajemen Pasangan (Couple/Household)
- FR-7: Pengguna dapat membuat sebuah **Couple Space** (ruang keuangan bersama) setelah mendaftar.
- FR-8: Pengguna dapat mengundang pasangan lewat link invite rahasia (dengan token unik, expiring).
- FR-9: Pasangan yang menerima invite akan tergabung ke Couple Space yang sama.
- FR-10: Pengguna dapat memilih mode dompet: **Gabung** (satu shared wallet) atau **Pisah** (masing-masing wallet individual namun tetap tercatat dalam satu Couple Space untuk kebutuhan split & laporan).
- FR-11: Setiap Couple Space punya rasio split default (misal 50:50) yang dapat diubah.

### 4.3 Transaksi
- FR-12: Pengguna dapat mencatat transaksi manual (pengeluaran/pemasukan) dengan field: nominal, kategori, tanggal, catatan, siapa yang membayar, metode split.
- FR-13: Pengguna dapat memilih metode split per transaksi: 50:50, proporsional (custom %), dibayar penuh salah satu pihak, atau ditanggung bersama (no split/shared pool).
- FR-14: Pengguna dapat mengunggah/scan foto struk; sistem mengekstrak nominal & item lewat AI (Qwen-VL via QwenCloud, endpoint Anthropic-compatible) untuk mempercepat input. Hasil ekstraksi wajib direview/dikonfirmasi pengguna sebelum resmi tersimpan sebagai transaksi (lihat FR-14a).
- FR-14a: Layar konfirmasi menampilkan hasil ekstraksi AI dalam form yang sudah terisi otomatis (merchant, tanggal, item, total) namun tetap dapat diedit penuh oleh pengguna sebelum disimpan.
- FR-15: Transaksi dapat difilter berdasarkan pembayar, kategori, rentang tanggal, dan jenis split.
- FR-16: Transaksi tercatat real-time dan terlihat oleh kedua pasangan (live feed, via Supabase Realtime).

### 4.4 Anggaran (Budget)
- FR-17: Pengguna dapat membuat kategori anggaran bulanan dengan batas nominal.
- FR-18: Sistem menghitung otomatis progres pemakaian tiap kategori terhadap batasnya.
- FR-19: Sistem memunculkan notifikasi/insight saat mendekati atau melampaui batas anggaran.

### 4.5 Tabungan & Target
- FR-20: Pengguna dapat membuat target tabungan bersama (misal "Target Bali") dengan nominal tujuan dan (opsional) tenggat waktu.
- FR-21: Sistem menampilkan progres target tabungan terhadap saldo yang dialokasikan.

### 4.6 Dashboard & Laporan
- FR-22: Dashboard menampilkan ringkasan bulanan: total pemasukan, total pengeluaran, sisa saldo, per kontribusi masing-masing pasangan.
- FR-23: Dashboard menampilkan tren pengeluaran 6 bulan terakhir dalam bentuk grafik.
- FR-24: Sistem menghasilkan insight otomatis berbasis data historis (misal: "Pengeluaran makan di luar turun 14%").
- FR-25: Pengguna dapat mengekspor/lihat laporan lebih detail di halaman Laporan (di luar scope 3 halaman awal, tapi disebut di navigasi).

### 4.7 Notifikasi
- FR-26: Pengguna menerima notifikasi in-app saat pasangan mencatat transaksi baru, mendekati limit budget, atau mencapai milestone tabungan.

---

## 5. Non-Functional Requirements

- NFR-1: **Realtime sync** — perubahan transaksi oleh salah satu pasangan harus terlihat oleh pasangan lain tanpa refresh manual (Supabase Realtime channel per Couple Space).
- NFR-2: **Keamanan data** — password di-hash oleh Supabase Auth; PIN 4 digit disimpan ter-hash, bukan plaintext; Row Level Security (RLS) di Supabase memastikan satu Couple Space hanya bisa diakses oleh anggotanya.
- NFR-3: **Privasi** — sesuai FAQ landing page, sistem tidak pernah meminta kredensial rekening bank asli; input transaksi manual/scan struk, bukan bank-linking otomatis (di versi ini).
- NFR-4: **Responsif** — layout harus adaptif dari mobile hingga desktop (sidebar collapsible di mobile).
- NFR-5: **Performa** — dashboard utama (stat cards, chart, live feed) harus termuat < 2 detik pada koneksi rata-rata Indonesia.
- NFR-6: **Aksesibilitas** — kontras warna dan ukuran target sentuh (touch target) memenuhi standar WCAG AA minimal, khususnya karena desain memakai warna solid kontras tinggi.
- NFR-7: **Skalabilitas data** — struktur data mendukung Couple Space dengan riwayat transaksi bertahun-tahun tanpa penurunan performa berarti (pagination pada listing transaksi).

---

## 6. User Flow Utama

1. **Onboarding:** Pengunjung → Landing Page → klik "Mulai Gratis" → Daftar (email/password atau Google) → verifikasi email → buat Couple Space → pilih mode dompet (Gabung/Pisah) → generate invite link → kirim ke pasangan.
2. **Pasangan bergabung:** Pasangan klik invite link → daftar/login → otomatis tergabung ke Couple Space yang sama.
3. **Login harian:** Pengguna → Halaman Masuk → email/password, Google, atau PIN 4 digit (jika sudah pernah login di device tsb) → Dashboard.
4. **Catat transaksi (manual):** Dashboard → tombol "+ Catat Transaksi" → isi form (nominal, kategori, split, pembayar) → simpan → muncul di Live Feed & mempengaruhi stat cards.
5. **Catat transaksi (scan struk):** Dashboard/Sidebar → "Scan Struk" → ambil/upload foto → AI ekstrak data → pengguna konfirmasi/edit → simpan sebagai transaksi.
6. **Pantau anggaran:** Dashboard → lihat Progress Anggaran → jika mendekati limit, dapat notifikasi → opsional tambah kategori baru.

---

## 7. Out of Scope (Versi Awal / MVP)

- Integrasi langsung ke rekening bank (open banking) — secara eksplisit dihindari karena isu kepercayaan/keamanan (lihat FAQ).
- Multi-currency.
- Dukungan lebih dari 2 anggota per Couple Space (grup keluarga besar) — fokus MVP adalah pasangan (2 orang).
- Aplikasi mobile native (MVP adalah web app responsif).

---

## 8. Asumsi

- Autentikasi, database, storage (untuk foto struk), dan realtime sepenuhnya memakai layanan Supabase.
- AI untuk scan struk memakai **Qwen-VL** (`qwen-vl-plus`, upgrade ke `qwen-vl-max` bila perlu) via **QwenCloud Anthropic-compatible endpoint** (`dashscope-intl.aliyuncs.com/apps/anthropic`, region Singapore) — dipilih karena tersedia free quota tanpa kartu kredit, dan cukup kuat untuk ekstraksi struk berbahasa Indonesia. Dipanggil dari server (Route Handler/Server Action Next.js) menggunakan `@anthropic-ai/sdk` (kompatibel karena endpoint meniru format Anthropic Messages API), bukan langsung dari client, agar API key tidak pernah terekspos ke browser.
- Provider AI ditulis **swappable** melalui environment variable (`AI_PROVIDER=qwen` atau `claude`) — memudahkan migrasi ke Claude asli di kemudian hari tanpa mengubah skema database atau alur konfirmasi.
- Free quota Qwen berlaku per model (dipisah antara `qwen-vl-plus` dan `qwen-vl-max`), sekitar 1 juta token gabungan input+output, berlaku ~90 hari sejak aktivasi — bukan permanen. Setelah habis dan tanpa billing aktif, request akan ditolak (bukan otomatis dikenai biaya), aman dari tagihan tak terduga selama fase development.
- Halaman "Laporan" dan "Pengaturan" disebut di navigasi tapi detailnya belum didesain — akan diturunkan pada iterasi berikutnya, PRD ini hanya mendefinisikan keberadaannya di IA (information architecture).
