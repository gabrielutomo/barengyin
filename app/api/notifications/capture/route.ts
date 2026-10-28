import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper: parse string rupiah to number
function parseRupiah(str: string): number {
  const clean = str.split(",")[0].replace(/[^\d]/g, "");
  const num = parseInt(clean, 10);
  return isNaN(num) ? 0 : num;
}

// Clean merchant / title name
function cleanTitle(title: string): string {
  let cleaned = title.trim().replace(/\s+(berhasil|sukses|telah berhasil|menggunakan.*)$/i, "");
  if (!cleaned) return "Transaksi Bank";
  if (cleaned.length > 60) cleaned = cleaned.slice(0, 60);
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Categorization helper
function detectCategory(title: string): string {
  const lower = title.toLowerCase();
  if (
    lower.includes("kopi") ||
    lower.includes("cafe") ||
    lower.includes("resto") ||
    lower.includes("makan") ||
    lower.includes("bakso") ||
    lower.includes("mie") ||
    lower.includes("warung") ||
    lower.includes("mcd") ||
    lower.includes("kfc")
  ) {
    return "Makan & Kencan";
  }
  if (
    lower.includes("indomaret") ||
    lower.includes("alfamart") ||
    lower.includes("supermarket") ||
    lower.includes("groceries") ||
    lower.includes("pasar")
  ) {
    return "Groceries & Rumah";
  }
  if (
    lower.includes("spbu") ||
    lower.includes("pertamina") ||
    lower.includes("shell") ||
    lower.includes("gojek") ||
    lower.includes("grab") ||
    lower.includes("toll") ||
    lower.includes("parkir") ||
    lower.includes("kereta") ||
    lower.includes("mrt")
  ) {
    return "Transportasi";
  }
  if (
    lower.includes("cinema") ||
    lower.includes("xxi") ||
    lower.includes("cgv") ||
    lower.includes("netflix") ||
    lower.includes("spotify") ||
    lower.includes("steam")
  ) {
    return "Hiburan & Nonton";
  }
  if (
    lower.includes("pln") ||
    lower.includes("pdam") ||
    lower.includes("bpjs") ||
    lower.includes("wifi") ||
    lower.includes("indihome") ||
    lower.includes("pulsa")
  ) {
    return "Tagihan & Utilitas";
  }
  return "Lainnya";
}

// Universal Bank Notification Parser
function parseNotification(pkg: string, title: string, text: string) {
  const fullText = `${title} ${text}`.trim();
  const lowerPkg = pkg.toLowerCase();
  const lowerFull = fullText.toLowerCase();

  let sourceBank = "Bank / E-Wallet";
  if (lowerPkg.includes("bca") || lowerFull.includes("bca")) sourceBank = "BCA";
  else if (lowerPkg.includes("mandiri") || lowerPkg.includes("livin") || lowerFull.includes("mandiri") || lowerFull.includes("livin")) sourceBank = "Mandiri";
  else if (lowerPkg.includes("brimo") || lowerPkg.includes("bri") || lowerFull.includes("brimo") || lowerFull.includes("bri")) sourceBank = "BRI";
  else if (lowerPkg.includes("bni") || lowerFull.includes("bni") || lowerFull.includes("wondr")) sourceBank = "BNI";
  else if (lowerPkg.includes("jago") || lowerFull.includes("bank jago")) sourceBank = "Bank Jago";
  else if (lowerPkg.includes("seabank") || lowerFull.includes("seabank")) sourceBank = "SeaBank";
  else if (lowerPkg.includes("gopay") || lowerPkg.includes("gojek") || lowerFull.includes("gopay")) sourceBank = "GoPay";
  else if (lowerPkg.includes("dana") || lowerFull.includes("dana")) sourceBank = "DANA";
  else if (lowerPkg.includes("ovo") || lowerFull.includes("ovo")) sourceBank = "OVO";
  else if (lowerPkg.includes("shopee") || lowerFull.includes("shopeepay")) sourceBank = "ShopeePay";

  const isIncome = /(?:uang masuk|transfer masuk|dana masuk|menerima|diterima|top up|cashback|kredit)/i.test(fullText);
  const txType: "expense" | "income" = isIncome ? "income" : "expense";
  const category = isIncome ? "Pemasukan & Top-up" : "Lainnya";

  // Rule 1: QRIS
  const qrisMatch = fullText.match(
    /(?:transaksi\s+)?qris\s+(?:sebesar\s+)?(?:idr|rp\.?)?\s*([\d\.,]{3,})\s+(?:di|ke|kepada)\s+([a-zA-Z0-9\s&'\.\-_]+?)(?:\s+sukses|\s+berhasil|\.|$|\s+tgl|\s+pada)/i
  );
  if (qrisMatch) {
    const amount = parseRupiah(qrisMatch[1]);
    const rawTitle = qrisMatch[2];
    return {
      amount,
      title: cleanTitle("QRIS: " + rawTitle),
      category: detectCategory(rawTitle),
      type: txType,
      sourceBank,
      success: amount > 0,
    };
  }

  // Rule 2: Transfer / Pembayaran
  const transferMatch = fullText.match(
    /(?:pembayaran|transfer|bayar|kamu telah membayar)\s+(?:sebesar\s+)?(?:idr|rp\.?)?\s*([\d\.,]{3,})\s+(?:ke|di|kepada)\s+([a-zA-Z0-9\s&'\.\-_]+?)(?:\s+sukses|\s+berhasil|\.|$|\s+tgl|\s+pada)/i
  );
  if (transferMatch) {
    const amount = parseRupiah(transferMatch[1]);
    const rawTitle = transferMatch[2];
    return {
      amount,
      title: cleanTitle(rawTitle),
      category: detectCategory(rawTitle),
      type: txType,
      sourceBank,
      success: amount > 0,
    };
  }

  // Rule 3: Universal Fallback
  const amountMatch = fullText.match(/(?:rp\.?|idr)\s*([\d\.,]{3,})/i);
  if (amountMatch) {
    const amount = parseRupiah(amountMatch[1]);
    const merchantMatch = fullText.match(/(?:di|ke|kepada|merchant|toko|outlet)\s+([a-zA-Z0-9\s&'\.\-_]+?)(?:\s+sukses|\s+berhasil|\s+sebesar|\s+menggunakan|\s+rp|\.|\,|$)/i);
    const rawMerchant = merchantMatch ? merchantMatch[1] : `Pembayaran ${sourceBank}`;
    return {
      amount,
      title: cleanTitle(rawMerchant),
      category: detectCategory(rawMerchant),
      type: txType,
      sourceBank,
      success: amount > 0,
    };
  }

  return {
    amount: 0,
    title: `Transaksi ${sourceBank}`,
    category,
    type: txType,
    sourceBank,
    success: false,
  };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the caller with an API key. Identity MUST come from the
    //    key's owner, never from the request body: the previous version
    //    trusted body.user_id, so any anonymous caller could write a
    //    transaction into any user's account.
    const apiKey =
      req.headers.get("X-API-Key") ||
      req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key tidak ditemukan." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { package_name, title, text } = body;

    if (!text) {
      return NextResponse.json({ error: "Text notifikasi tidak boleh kosong" }, { status: 400 });
    }

    // Parse notification
    const parsed = parseNotification(package_name || "", title || "", text);

    if (!parsed.success || parsed.amount <= 0) {
      return NextResponse.json({
        status: "unrecognized",
        message: "Notifikasi diterima namun nominal transaksi tidak ditemukan.",
        parsed,
      });
    }

    // Initialize Supabase admin client to write transaction
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // No anon-key fallback: an unprivileged client here would silently insert
    // zero rows and look like a successful capture.
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Konfigurasi Supabase server tidak ditemukan" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Resolve the API key to its owning profile.
    const { data: keyRow, error: keyErr } = await supabase
      .from("user_api_keys")
      .select("profile_id")
      .eq("api_key", apiKey)
      .maybeSingle();

    if (keyErr || !keyRow) {
      return NextResponse.json(
        { error: "API key tidak valid." },
        { status: 401 }
      );
    }

    const currentDate = new Date().toISOString().slice(0, 10);
    const newTx = {
      // Owner of the API key, NOT the client-supplied user_id.
      created_by: keyRow.profile_id,
      title: parsed.title,
      amount: parsed.amount,
      type: parsed.type,
      category_id: parsed.category,
      scope: "personal", // Default ke ruang pribadi
      status: "pending_review",
      is_auto_captured: true,
      source_app: package_name || parsed.sourceBank,
      raw_notification_text: text,
      transaction_date: currentDate,
      paid_by: "Saya",
      split_method: "none",
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("transactions")
      .insert(newTx)
      .select("id")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        status: "captured",
        message: "Transaksi berhasil di-capture dan menunggu review di dashboard.",
        transaction_id: inserted?.id,
        parsed,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
