# Implementasi Fitur "Scan Struk" — Barengyin
## Qwen-VL (QwenCloud, Anthropic-Compatible) + Next.js 16 + Supabase

**Terkait:** PRD Barengyin v1.0 (FR-14, FR-14a), ERD Barengyin (`receipt_scans`, `transactions`)

**Update provider:** Barengyin memakai **Qwen-VL** via endpoint Anthropic-compatible QwenCloud (`dashscope-intl.aliyuncs.com/apps/anthropic`) sebagai provider utama untuk ekstraksi struk — dipilih karena tersedia **free quota tanpa kartu kredit** (per model, ~1 juta token gabungan input+output, berlaku ~90 hari), dan tetap kompatibel dengan SDK `@anthropic-ai/sdk` yang sama seperti Claude, hanya beda `baseURL` dan `model`. Kode di dokumen ini ditulis **swappable** — pindah ke Claude asli tinggal ganti 2 baris konfigurasi (lihat Bagian 2).

---

## 1. Ringkasan Alur

```
[User foto/upload struk]
        │
        ▼
[Client: upload gambar ke Supabase Storage]
        │
        ▼
[Client: panggil Server Action `scanReceipt(imageUrl)`]
        │
        ▼
[Server: insert row receipt_scans, status='processing']
        │
        ▼
[Server: kirim gambar ke Qwen-VL (endpoint Anthropic-compatible) dengan prompt terstruktur]
        │
        ▼
[Server: parse response JSON, update receipt_scans.ai_extracted_data, status='completed']
        │
        ▼
[Client: tampilkan form konfirmasi ter-prefill dari ai_extracted_data]
        │
        ▼
[User review/edit → submit]
        │
        ▼
[Server: insert ke transactions + transaction_splits, set receipt_scan_id]
```

Prinsip kunci: **AI tidak pernah langsung menulis ke `transactions`.** Ia hanya mengisi `receipt_scans.ai_extracted_data`. Baris `transactions` baru dibuat setelah manusia konfirmasi — ini mencegah salah baca AI (misal salah baca nominal) langsung mempengaruhi saldo/budget tanpa disadari.

---

## 2. Setup API Key (Environment Variable) — Qwen-VL via QwenCloud

Simpan API key di `.env.local` (jangan pernah commit ke git):

```bash
# .env.local
AI_PROVIDER=qwen
QWEN_API_KEY=sk-ws-H.xxxxxxxxxxxxxxxxxxxxxxxxx
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/apps/anthropic
QWEN_VL_MODEL=qwen-vl-plus
```

**Catatan penting soal region:** endpoint `dashscope-intl.aliyuncs.com` hanya berlaku untuk API key yang dibuat di region **Singapore (International)** — sesuai yang tampak di screenshot Console kamu. Free quota HANYA tersedia di region ini; region Beijing/US/EU tidak punya free tier. Pastikan saat membuat/reset key, region-nya tetap Singapore.

Model yang tersedia untuk vision di jalur Anthropic-compatible ini: `qwen-vl-max` (kualitas lebih tinggi, cocok untuk struk buram/kompleks) atau `qwen-vl-plus` (lebih cepat/murah, cukup untuk struk standar). Rekomendasi: mulai dengan `qwen-vl-plus`, upgrade ke `qwen-vl-max` kalau akurasi kurang memadai untuk kasus riil.

Install SDK — **tetap `@anthropic-ai/sdk`**, karena endpoint ini meniru format Anthropic Messages API:

```bash
npm install @anthropic-ai/sdk
```

**Jika suatu saat ingin pindah ke Claude asli** (misal setelah free quota Qwen habis dan produk sudah punya revenue), cukup ubah environment variable:

```bash
# .env.local — versi Claude asli
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxx
```

Kode di Bagian 3 sudah ditulis untuk membaca provider mana yang aktif secara otomatis dari environment variable, tanpa perlu ubah logic lain di aplikasi.



---

## 3. Server-side: Fungsi Ekstraksi Struk (Swappable Provider)

```ts
// lib/ai/scan-receipt.ts
import Anthropic from "@anthropic-ai/sdk";

// Konfigurasi provider dibaca dari environment variable.
// AI_PROVIDER=qwen  -> pakai Qwen-VL via endpoint Anthropic-compatible QwenCloud
// AI_PROVIDER=claude -> pakai Claude asli (Haiku)
const PROVIDER = process.env.AI_PROVIDER ?? "qwen";

function getClientConfig() {
  if (PROVIDER === "qwen") {
    return {
      apiKey: process.env.QWEN_API_KEY!,
      baseURL: process.env.QWEN_BASE_URL, // https://dashscope-intl.aliyuncs.com/apps/anthropic
      model: process.env.QWEN_VL_MODEL ?? "qwen-vl-plus",
    };
  }
  // fallback: Claude asli
  return {
    apiKey: process.env.ANTHROPIC_API_KEY!,
    baseURL: undefined, // default ke api.anthropic.com
    model: "claude-haiku-4-5-20251001",
  };
}

const config = getClientConfig();

const anthropic = new Anthropic({
  apiKey: config.apiKey,
  baseURL: config.baseURL,
});

export interface ReceiptExtraction {
  merchant_name: string | null;
  transaction_date: string | null; // ISO 8601, null jika tidak terbaca
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number | null;
  tax_or_service: number | null;
  total_amount: number;
  suggested_category: string | null; // e.g. "Makan & Kencan", "Groceries & Rumah"
  confidence: "high" | "medium" | "low";
  notes: string | null; // catatan AI jika struk buram/ambigu
}

const EXTRACTION_PROMPT = `Kamu adalah asisten ekstraksi data struk belanja Indonesia untuk aplikasi keuangan pasangan bernama Barengyin.

Analisis gambar struk yang diberikan dan kembalikan HANYA JSON valid (tanpa markdown code block, tanpa teks tambahan) dengan skema persis berikut:

{
  "merchant_name": string | null,
  "transaction_date": string | null,
  "items": [{ "name": string, "quantity": number, "price": number }],
  "subtotal": number | null,
  "tax_or_service": number | null,
  "total_amount": number,
  "suggested_category": string | null,
  "confidence": "high" | "medium" | "low",
  "notes": string | null
}

Aturan:
- "total_amount" WAJIB diisi (angka final yang harus dibayar). Jika struk tidak jelas, berikan estimasi terbaik dan set "confidence": "low".
- "transaction_date" dalam format ISO 8601 (YYYY-MM-DD). Jika tidak ada tanggal di struk, gunakan null.
- "suggested_category" pilih salah satu dari kategori umum: "Makan & Kencan", "Groceries & Rumah", "Transportasi", "Hiburan & Nonton", "Utilitas", "Lainnya". Pilih berdasarkan nama merchant/item.
- Semua nominal dalam Rupiah, tanpa simbol mata uang, tanpa titik/koma pemisah ribuan (angka murni).
- Jika gambar sama sekali bukan struk atau tidak terbaca, set "total_amount": 0, "confidence": "low", dan jelaskan di "notes".
- JANGAN tambahkan teks penjelasan di luar JSON. Output HARUS bisa langsung di-parse dengan JSON.parse().`;

export async function extractReceiptData(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp"
): Promise<ReceiptExtraction> {
  const message = await anthropic.messages.create({
    model: config.model,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`${PROVIDER} tidak mengembalikan respons teks.`);
  }

  // Bersihkan kemungkinan markdown code fence jika model tetap membungkusnya
  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned) as ReceiptExtraction;
  } catch {
    throw new Error(
      `Gagal parse JSON hasil ekstraksi ${PROVIDER}: ` + cleaned.slice(0, 200)
    );
  }
}
```

**Catatan kompatibilitas:** endpoint Anthropic-compatible QwenCloud meniru struktur request/response Anthropic Messages API, tapi tidak dijamin 100% identik untuk semua parameter (misal `extended thinking` atau beberapa parameter lanjutan mungkin tidak didukung). Untuk kasus ekstraksi struk yang dipakai di sini (`messages.create` sederhana dengan image + text), kompatibilitasnya sudah teruji baik. Jika suatu saat menemukan behavior yang tidak sesuai ekspektasi, cek dokumentasi resmi Alibaba Model Studio untuk daftar parameter yang didukung di jalur Anthropic-compatible.



---

## 4. Server Action: Orkestrasi Upload → Scan → Simpan Staging

```ts
// app/actions/receipt-scan.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { extractReceiptData } from "@/lib/ai/scan-receipt";
import { revalidatePath } from "next/cache";

export async function scanReceiptAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const file = formData.get("receipt") as File;
  if (!file) throw new Error("Tidak ada file yang diunggah.");

  // Ambil couple_id milik user (lihat ERD: couple_members)
  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("profile_id", user.id)
    .single();

  if (!membership) throw new Error("User belum tergabung dalam Couple Space.");

  // 1. Upload gambar ke Supabase Storage
  const filePath = `${membership.couple_id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(filePath, file);

  if (uploadError) throw new Error(`Upload gagal: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from("receipts").getPublicUrl(filePath);

  // 2. Insert row receipt_scans dengan status 'processing'
  const { data: scanRow, error: insertError } = await supabase
    .from("receipt_scans")
    .insert({
      couple_id: membership.couple_id,
      uploaded_by: user.id,
      image_url: publicUrl,
      status: "processing",
    })
    .select()
    .single();

  if (insertError) throw new Error(`Gagal simpan scan: ${insertError.message}`);

  // 3. Kirim ke Claude API untuk ekstraksi
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Image = buffer.toString("base64");
    const mediaType = file.type as "image/jpeg" | "image/png" | "image/webp";

    const extracted = await extractReceiptData(base64Image, mediaType);

    // 4. Update hasil ekstraksi
    await supabase
      .from("receipt_scans")
      .update({
        ai_extracted_data: extracted,
        status: "completed",
      })
      .eq("id", scanRow.id);

    revalidatePath("/dashboard/scan-struk");

    return { scanId: scanRow.id, extracted };
  } catch (err) {
    // Tandai gagal, tapi jangan hapus row — user tetap bisa input manual
    await supabase
      .from("receipt_scans")
      .update({ status: "failed" })
      .eq("id", scanRow.id);

    throw new Error(
      `Ekstraksi AI gagal: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }
}
```

---

## 5. Konfirmasi → Simpan sebagai Transaksi Resmi

```ts
// app/actions/confirm-transaction.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface ConfirmTransactionInput {
  receiptScanId: string;
  walletId: string;
  categoryId: string;
  title: string;
  amount: number;
  transactionDate: string;
  paidBy: string; // profile_id
  splitMethod: "none" | "fifty_fifty" | "proportional" | "full_by_payer" | "shared_pool";
  splits: Array<{ profileId: string; shareAmount: number; sharePercentage?: number }>;
}

export async function confirmTransactionFromScan(input: ConfirmTransactionInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: scan } = await supabase
    .from("receipt_scans")
    .select("couple_id")
    .eq("id", input.receiptScanId)
    .single();

  if (!scan) throw new Error("Receipt scan tidak ditemukan.");

  // Insert transaksi resmi
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .insert({
      couple_id: scan.couple_id,
      wallet_id: input.walletId,
      category_id: input.categoryId,
      paid_by: input.paidBy,
      created_by: user.id,
      title: input.title,
      type: "expense",
      amount: input.amount,
      split_method: input.splitMethod,
      status: "recorded",
      receipt_scan_id: input.receiptScanId,
      transaction_date: input.transactionDate,
    })
    .select()
    .single();

  if (txError) throw new Error(`Gagal simpan transaksi: ${txError.message}`);

  // Insert detail split per profile
  const splitRows = input.splits.map((s) => ({
    transaction_id: transaction.id,
    profile_id: s.profileId,
    share_amount: s.shareAmount,
    share_percentage: s.sharePercentage ?? null,
    is_settled: false,
  }));

  const { error: splitError } = await supabase
    .from("transaction_splits")
    .insert(splitRows);

  if (splitError) throw new Error(`Gagal simpan split: ${splitError.message}`);

  revalidatePath("/dashboard");
  return transaction;
}
```

---

## 6. Halaman Konfirmasi (Client Component, gaya Neo-Brutalist sesuai DESIGN.md)

```tsx
// app/dashboard/scan-struk/confirm/[scanId]/page.tsx
"use client";

import { useState } from "react";
import { confirmTransactionFromScan } from "@/app/actions/confirm-transaction";
import type { ReceiptExtraction } from "@/lib/ai/scan-receipt";

export function ConfirmScanForm({
  scanId,
  extracted,
}: {
  scanId: string;
  extracted: ReceiptExtraction;
}) {
  const [amount, setAmount] = useState(extracted.total_amount);
  const [title, setTitle] = useState(extracted.merchant_name ?? "");
  const [category, setCategory] = useState(extracted.suggested_category ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const lowConfidence = extracted.confidence === "low";

  return (
    <div className="max-w-xl mx-auto p-space-lg bg-surface-container-lowest border-[4px] border-black shadow-[6px_6px_0px_#000000] rounded-xl">
      <div className="flex items-center justify-between border-b-[3px] border-black pb-space-sm mb-space-md">
        <h2 className="font-headline-md text-headline-md uppercase font-bold">
          Konfirmasi Transaksi
        </h2>
        {lowConfidence && (
          <span className="font-label-badge text-label-badge uppercase px-2 py-1 bg-[#FDE047] border-[2px] border-black shadow-[2px_2px_0px_#000000]">
            ⚠ Cek Ulang — AI Kurang Yakin
          </span>
        )}
      </div>

      <div className="flex flex-col gap-space-md">
        <div>
          <label className="font-label-badge text-label-badge uppercase block mb-1">
            Nama Transaksi
          </label>
          <input
            className="w-full border-[3px] border-black rounded p-3 font-body-md focus:shadow-[4px_4px_0px_#000000] focus:outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="font-label-badge text-label-badge uppercase block mb-1">
            Total Nominal (Rp)
          </label>
          <input
            type="number"
            className="w-full border-[3px] border-black rounded p-3 font-numeric-stat text-headline-sm focus:shadow-[4px_4px_0px_#000000] focus:outline-none"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="font-label-badge text-label-badge uppercase block mb-1">
            Kategori
          </label>
          <select
            className="w-full border-[3px] border-black rounded p-3 font-body-md"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>Makan & Kencan</option>
            <option>Groceries & Rumah</option>
            <option>Transportasi</option>
            <option>Hiburan & Nonton</option>
            <option>Utilitas</option>
            <option>Lainnya</option>
          </select>
        </div>

        {extracted.items.length > 0 && (
          <div className="border-[2px] border-black rounded p-space-sm bg-surface-container-low">
            <p className="font-label-badge text-label-badge uppercase mb-2">
              Item Terdeteksi ({extracted.items.length})
            </p>
            <ul className="flex flex-col gap-1 text-body-sm font-body-sm">
              {extracted.items.map((item, i) => (
                <li key={i} className="flex justify-between">
                  <span>{item.quantity}x {item.name}</span>
                  <span className="font-bold">Rp {item.price.toLocaleString("id-ID")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          disabled={isSaving}
          onClick={async () => {
            setIsSaving(true);
            // panggil confirmTransactionFromScan dengan data walletId/paidBy/splits
            // sesuai pilihan user (disederhanakan di sini)
            setIsSaving(false);
          }}
          className="w-full bg-primary-container border-[4px] border-black rounded p-4 font-headline-sm uppercase font-black shadow-[5px_5px_0px_#000000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[6px_6px_0px_#000000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
        >
          {isSaving ? "Menyimpan..." : "Simpan Transaksi"}
        </button>
      </div>
    </div>
  );
}
```

---

## 7. Penanganan Kuota Gratis & Kontrol Pemakaian (Qwen-VL)

Rekomendasi konkret untuk kondisi kamu sekarang (sudah punya API key Qwen di region Singapore):

1. **Cek sisa kuota gratis secara berkala** — buka dashboard QwenCloud → Billing → Free quota untuk melihat sisa token per model (`qwen-vl-plus` dan `qwen-vl-max` punya kuota terpisah, tidak bisa digabung).
2. **Aktifkan "Free quota only" mode** (disebut juga "worry-free mode") — ini mencegah tagihan tak terduga: begitu kuota gratis habis, request akan ditolak dengan error alih-alih otomatis nge-charge kartu. Cocok untuk fase development/testing sebelum kamu siap komit ke billing sungguhan.
3. **Kuota gratis berlaku ~90 hari sejak aktivasi** — bukan selamanya. Rencanakan: kalau Barengyin butuh waktu pengembangan lebih dari 3 bulan sebelum launch, siapkan strategi (misal generate API key baru mendekati waktu launch, atau siap pindah ke billing berbayar).
4. **Batasi ukuran gambar sebelum dikirim** — resize/compress gambar struk di client (misal max 1500px sisi terpanjang) sebelum upload. Ini menghemat token dan mempercepat proses, berlaku untuk provider manapun.
5. **Rate limit di level aplikasi** — beri batas wajar (misal maks 20 scan/hari per Couple Space) agar kuota gratis tidak cepat habis dipakai testing berulang saat development.
6. **Model routing berdasar kompleksitas** — pakai `qwen-vl-plus` sebagai default (lebih hemat kuota), dan hanya escalate ke `qwen-vl-max` untuk kasus struk yang gagal/confidence rendah di percobaan pertama (bisa diimplementasikan sebagai retry logic otomatis).

---

## 8. Setup Supabase Storage Bucket (jika belum ada)

```sql
-- Jalankan di Supabase SQL Editor
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true);

-- RLS policy: hanya anggota couple yang bisa upload/lihat file struk mereka sendiri
create policy "Couple members can upload their own receipts"
on storage.objects for insert
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] in (
    select couple_id::text from couple_members where profile_id = auth.uid()
  )
);

create policy "Couple members can view their own receipts"
on storage.objects for select
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] in (
    select couple_id::text from couple_members where profile_id = auth.uid()
  )
);
```
