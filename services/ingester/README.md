# 🚀 Barengyin Notification Ingestion Service (Golang + Redis)

Service microservice berkecepatan tinggi (< 2ms) yang dirancang khusus untuk menangkap notifikasi transaksi perbankan dan e-wallet dari ponsel Android ke database **Barengyin**.

---

## 🏗️ Fitur Utama
1. **Ultra-Low Latency:** Ditulis dalam bahasa Golang native, waktu proses parsing regex & deduplikasi hanya `< 1 ms`.
2. **Deduplikasi via Redis:** Mencegah pencatatan ganda (*double-insert*) jika bank mengirimkan 2 notifikasi untuk 1 transaksi yang sama (TTL 5 menit).
3. **Universal Indonesian Bank & E-Wallet Parser:**
   * BCA (BCA Mobile & myBCA)
   * Mandiri (Livin' by Mandiri)
   * BRI (BRImo)
   * BNI (wondr by BNI)
   * Bank Jago
   * SeaBank
   * GoPay, DANA, OVO, ShopeePay, Blu BCA
   * *Universal Fallback Pattern:* Mampu membaca format notifikasi bank lokal mana pun di Indonesia secara otomatis.
4. **Resilient Fail-Open:** Jika Redis offline/restart, service tetap mencatat transaksi langsung ke PostgreSQL tanpa error.

---

## 🐳 Menjalankan Lokal via Docker Compose

```bash
cd services/ingester
docker compose up -d --build
```
Service akan aktif di `http://localhost:8080`.

Cek status:
```bash
curl http://localhost:8080/health
```

---

## ☁️ Panduan Deploy (Railway, Fly.io, atau VPS)

> **Catatan untuk Vercel:**  
> Vercel **tidak mendukung** Docker container atau background daemon seperti Redis/Go.  
> Untuk Vercel, Barengyin sudah memiliki endpoint fallback bawaan di Next.js: `POST /api/notifications/capture`.  
> Jika ingin performa maksimal Go + Redis, deploy service ini ke salah satu platform berikut:

### Opsi 1: Railway (Paling Mudah, 1-Click)
1. Buka [Railway.app](https://railway.app), klik **New Project** > **Deploy from GitHub repo**.
2. Pilih subfolder `services/ingester`.
3. Tambahkan plugin **Redis** bawaan Railway dengan 1 klik.
4. Isi Environment Variables:
   * `NEXT_PUBLIC_SUPABASE_URL`: URL project Supabase Anda
   * `SUPABASE_SERVICE_ROLE_KEY`: Service role secret Supabase Anda
   * `DATABASE_URL`: Connection string PostgreSQL dari Supabase

   Tidak ada shared master key. Autentikasi bersifat per pengguna: request
   diterima jika dan hanya jika API Key-nya ada di tabel `public.user_api_keys`.
5. Railway akan otomatis build Dockerfile dan memberikan domain publik HTTPS (contoh: `https://barengyin-ingester.up.railway.app`).

### Opsi 2: Fly.io (Gratis / Murah)
```bash
cd services/ingester
fly launch
fly secrets set NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
fly deploy
```

---

## 📱 Panduan Setup di HP Android (MacroDroid - 3 Menit)

1. Pasang aplikasi **MacroDroid** (Gratis) dari Google Play Store di HP Anda.
2. Buat Makro baru dengan nama: **"Barengyin Capture"**:
   * **Trigger:**  
     Pilih `Device Events` > `Notification Received` > Pilih aplikasi bank Anda (BCA, Livin, Gojek, dsb.).
   * **Action:**  
     Pilih `Connectivity` > `HTTP Request`:
     * **Method:** `POST`
     * **URL:** `https://domain-anda/v1/notifications/capture` (atau `https://barengyin.com/api/notifications/capture` jika pakai Vercel)
     * **Content Type:** `application/json`
     * **Request Body:**
       ```json
       {
         "package_name": "{not_app_pkg}",
         "title": "{not_title}",
         "text": "{not_text}",
         "post_time": {system_time}
       }
       ```
       Kolom `user_id` **sudah tidak dipakai lagi**. Identitas pemilik transaksi
       ditentukan sepenuhnya dari API Key di header — body request tidak akan
       pernah dipercaya untuk menyatakan siapa pemiliknya. Field lama boleh
       tetap dikirim (diabaikan), tidak akan error.
     * **Headers:**  
       `X-API-Key: <API_KEY_ANDA>` (atau `Authorization: Bearer <API_KEY_ANDA>`)

       API Key bersifat rahasia per pengguna. Ambil nilainya dari halaman
       Pengaturan di Barengyin, atau dari tabel `public.user_api_keys` di
       Supabase. **Jangan** pakai nilai contoh atau key yang dibagikan —
       setiap key hanya berlaku untuk akun pemiliknya.
3. Simpan dan aktifkan izin *Notification Access* untuk MacroDroid di pengaturan HP.
4. Selesai! Setiap kali Anda transaksi QRIS atau transfer, transaksi akan seketika masuk ke Barengyin dan siap di-review di dashboard.
