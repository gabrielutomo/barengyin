# Barengyin 💛

> **Aplikasi Keuangan Pasangan #1 di Indonesia**  
> Lacak saldo bersama, split bon otomatis, scan struk belanja dengan AI, dan capai financial goals bareng secara transparan tanpa drama.

---

## ✨ Fitur Utama

- **👫 Ruang Pasangan (Couple Space & Duo Sync):** Kelola dompet bersama berdua dengan sinkronisasi instan antar perangkat.
- **🔒 PIN Pasangan (4 Digit Security):** Pihak pengundang mengatur PIN 4-digit dompet bersama; pasangan cukup mendaftar akun dan memasukkan PIN yang sama untuk langsung terhubung.
- **🧾 Scan Struk AI (Vision OCR):** Foto struk belanjaan (Alfamart, Indomaret, resto, dll.), AI otomatis mengekstrak nominal, tanggal, dan kategori pengeluaran.
- **⚖️ Smart Split (50:50 & Rasio Fleksibel):** Bagi tagihan atau talangan belanja secara otomatis.
- **💰 Dompet & Anggaran Bulanan:** Pisahkan pos belanja, tabungan bersama, dan pantau batas pengeluaran dengan visual indikator neo-brutalisme.
- **🛡️ Cloudflare Turnstile Bot Guard:** Perlindungan pendaftaran akun dari serangan bot tanpa puzzle CAPTCHA rumit.

---

## 🚀 Tech Stack

- **Framework:** [Next.js 16 (App Router)](https://nextjs.org) + React 19
- **Styling:** Tailwind CSS (Neo-brutalism design language)
- **Database & Auth:** [Supabase](https://supabase.com) (PostgreSQL + RLS + Storage)
- **AI OCR:** Qwen-VL (via DashScope Anthropic-compatible SDK) / Anthropic Claude
- **Security:** Cloudflare Turnstile + Web Crypto API (PBKDF2, AES-GCM, SHA-256)

---

## 🛠️ Panduan Memulai (Local Development)

### 1. Klon Repositori & Pasang Dependensi
```bash
git clone https://github.com/gabrielutomo/barengyin.git
cd barengyin
pnpm install
```

### 2. Konfigurasi Environment Variables
Salin `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```
Lengkapi nilai:
- `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `QWEN_API_KEY` (untuk AI scan struk)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` & `TURNSTILE_SECRET_KEY`

### 3. Jalankan Server Pengembangan
```bash
pnpm dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

---

## 📦 Deploy ke Vercel

Aplikasi siap di-deploy langsung ke Vercel:
1. Hubungkan repositori GitHub ini ke dashboard [Vercel](https://vercel.com).
2. Masukkan environment variables dari `.env.local` pada pengaturan proyek di Vercel.
3. Klik **Deploy**!

---

© 2026 Barengyin. Dibuat untuk pasangan Indonesia.
