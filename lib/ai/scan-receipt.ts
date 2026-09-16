import Anthropic from "@anthropic-ai/sdk";

const PROVIDER = process.env.AI_PROVIDER ?? "qwen";

function getClientConfig() {
  if (PROVIDER === "qwen") {
    return {
      apiKey: process.env.QWEN_API_KEY || "",
      baseURL: process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/apps/anthropic",
      model: process.env.QWEN_VL_MODEL || "qwen-vl-plus",
    };
  }
  return {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    baseURL: undefined,
    model: "claude-haiku-4-5-20251001",
  };
}

export interface ReceiptExtraction {
  merchant_name: string | null;
  transaction_date: string | null;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number | null;
  tax_or_service: number | null;
  total_amount: number;
  suggested_category: string | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
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
  const config = getClientConfig();

  if (!config.apiKey) {
    throw new Error("API Key untuk AI OCR belum disetel di .env.local (QWEN_API_KEY).");
  }

  const anthropic = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

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

  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned) as ReceiptExtraction;
  } catch {
    throw new Error(
      `Gagal parse JSON hasil ekstraksi ${PROVIDER}: ` + cleaned.slice(0, 200)
    );
  }
}
