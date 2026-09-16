import { NextRequest, NextResponse } from "next/server";
import { extractReceiptData } from "@/lib/ai/scan-receipt";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("receipt") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Tidak ada file gambar struk yang diunggah." },
        { status: 400 }
      );
    }

    // Security check: File size limit (5MB max)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Ukuran file terlalu besar. Maksimal 5 MB." },
        { status: 413 }
      );
    }

    // Security check: Allowed MIME types
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const fileType = file.type?.toLowerCase() || "";
    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json(
        { error: "Format file tidak didukung. Harap gunakan format JPG, PNG, atau WEBP." },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Image = buffer.toString("base64");
    const mediaType = fileType as "image/jpeg" | "image/png" | "image/webp";

    const extracted = await extractReceiptData(base64Image, mediaType);

    return NextResponse.json({ success: true, data: extracted });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan saat memproses struk AI";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
