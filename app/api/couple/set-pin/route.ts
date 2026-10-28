import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { hashPin } from "@/lib/pin-auth";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Verify authenticated user
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json(
        { success: false, error: "Kamu harus mendaftar atau masuk ke akun terlebih dahulu." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { pin, coupleId: customCoupleId } = body;

    // 2. Validate PIN format (4 digits)
    if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin.trim())) {
      return NextResponse.json(
        { success: false, error: "PIN harus terdiri dari 4 digit angka (contoh: 1234)." },
        { status: 400 }
      );
    }

    const cleanPin = pin.trim();
    const hashed = await hashPin(cleanPin);

    const admin = createAdminClient();

    // 3. Find user's couple
    let coupleId = customCoupleId;
    if (!coupleId) {
      const { data: memberRow } = await admin
        .from("couple_members")
        .select("couple_id")
        .eq("profile_id", user.id)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      coupleId = memberRow?.couple_id;
    }

    // If still no couple exists, create one for this user
    if (!coupleId) {
      const displayName =
        user.user_metadata?.full_name || user.email?.split("@")[0] || "Saya";
      const { data: newCouple, error: createErr } = await admin
        .from("couples")
        .insert({
          name: `Dompet ${displayName}`,
          wallet_mode: "combined",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (createErr || !newCouple) {
        throw new Error(createErr?.message || "Gagal membuat ruang dompet bersama");
      }

      coupleId = newCouple.id;

      await admin.from("couple_members").insert({
        couple_id: coupleId,
        profile_id: user.id,
        role: "owner",
      });

      await admin.from("wallets").insert({
        couple_id: coupleId,
        name: "Dompet Utama Bersama",
        type: "shared",
        current_balance: 0,
      });
    }

    // 4. Store the hash in the sealed tables only.
    //    public.couples and public.profiles no longer carry pin_hash.
    const { error: secretErr } = await admin
      .from("couple_secrets")
      .upsert(
        { couple_id: coupleId, pin_hash: hashed, updated_at: new Date().toISOString() },
        { onConflict: "couple_id" }
      );

    if (secretErr) {
      throw new Error(secretErr.message);
    }

    const { error: profileSecretErr } = await admin
      .from("profile_secrets")
      .upsert(
        { id: user.id, pin_hash: hashed, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );

    if (profileSecretErr) {
      throw new Error(profileSecretErr.message);
    }

    return NextResponse.json({
      success: true,
      coupleId,
      message: "PIN Pasangan berhasil disimpan untuk dompet bersama!",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat mengatur PIN";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
