import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { hashPin } from "@/lib/pin-auth";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Check user authentication
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Kamu harus mendaftar atau masuk ke akun Barengyin terlebih dahulu sebelum memasukkan PIN Pasangan.",
          requiresAuth: true,
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { inviteToken, pin } = body;

    if (!inviteToken || typeof inviteToken !== "string" || !inviteToken.trim()) {
      return NextResponse.json(
        { success: false, error: "Tautan atau kode undangan tidak valid." },
        { status: 400 }
      );
    }

    if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin.trim())) {
      return NextResponse.json(
        { success: false, error: "Masukkan 4 digit PIN Pasangan (angka)." },
        { status: 400 }
      );
    }

    const cleanToken = inviteToken.trim();
    const cleanPin = pin.trim();
    const admin = createAdminClient();

    // 2. Fetch invite details
    const { data: invite, error: inviteErr } = await admin
      .from("couple_invites")
      .select("*")
      .eq("invite_token", cleanToken)
      .maybeSingle();

    if (inviteErr || !invite) {
      return NextResponse.json(
        { success: false, error: "Undangan tidak ditemukan atau tautan sudah tidak aktif." },
        { status: 404 }
      );
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error:
            invite.status === "accepted"
              ? "Undangan ini sudah pernah digunakan dan diterima sebelumnya."
              : "Undangan ini sudah tidak aktif.",
        },
        { status: 400 }
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: "Undangan telah kedaluwarsa. Minta pasanganmu membuat undangan baru." },
        { status: 400 }
      );
    }

    if (invite.invited_by === user.id) {
      return NextResponse.json(
        { success: false, error: "Kamu tidak dapat menerima undangan yang kamu buat sendiri." },
        { status: 400 }
      );
    }

    // 3. Fetch couple details
    const { data: couple, error: coupleErr } = await admin
      .from("couples")
      .select("*")
      .eq("id", invite.couple_id)
      .maybeSingle();

    if (coupleErr || !couple) {
      return NextResponse.json(
        { success: false, error: "Dompet pasangan tidak ditemukan." },
        { status: 404 }
      );
    }

    if (!couple.pin_hash) {
      return NextResponse.json(
        {
          success: false,
          error: "Pasanganmu belum mengatur PIN Pasangan. Minta pasanganmu mengatur PIN di menu Ruang Pasangan terlebih dahulu.",
        },
        { status: 400 }
      );
    }

    // 4. Verify PIN matches couples.pin_hash
    const enteredHash = await hashPin(cleanPin);
    if (enteredHash !== couple.pin_hash) {
      return NextResponse.json(
        {
          success: false,
          error: "PIN Pasangan tidak cocok. Pastikan kamu memasukkan 4-digit PIN yang sama dengan yang telah diatur oleh pasanganmu!",
        },
        { status: 400 }
      );
    }

    // 5. Success: Join couple
    const myDisplayName =
      user.user_metadata?.full_name || user.email?.split("@")[0] || "Pasangan";

    // 5a. Ensure user profile exists
    await admin.from("profiles").upsert(
      {
        id: user.id,
        full_name: myDisplayName,
        pin_hash: enteredHash,
      },
      { onConflict: "id" }
    );

    // 5b. Check and clean up previous solo empty couple if user had one
    const { data: prevMemberships } = await admin
      .from("couple_members")
      .select("couple_id, role")
      .eq("profile_id", user.id);

    if (prevMemberships && prevMemberships.length > 0) {
      for (const m of prevMemberships) {
        if (m.couple_id !== couple.id) {
          // Check if it's a solo couple with no partner
          const { count: partnerCount } = await admin
            .from("couple_members")
            .select("*", { count: "exact", head: true })
            .eq("couple_id", m.couple_id)
            .neq("profile_id", user.id);

          if (!partnerCount || partnerCount === 0) {
            // Check if there are any transactions
            const { count: txCount } = await admin
              .from("transactions")
              .select("*", { count: "exact", head: true })
              .eq("couple_id", m.couple_id);

            if (!txCount || txCount === 0) {
              // Safe to clean up solo couple membership
              await admin
                .from("couple_members")
                .delete()
                .eq("couple_id", m.couple_id)
                .eq("profile_id", user.id);
            }
          }
        }
      }
    }

    // 5c. Add user to couple_members as partner
    const { error: joinErr } = await admin.from("couple_members").upsert(
      {
        couple_id: couple.id,
        profile_id: user.id,
        role: "partner",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "couple_id,profile_id" }
    );

    if (joinErr) {
      throw new Error("Gagal menghubungkan ke dompet bersama: " + joinErr.message);
    }

    // 5d. Mark invite as accepted
    await admin
      .from("couple_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    // 5e. Update couple name if still solo name
    let updatedCoupleName = couple.name;
    if (couple.name.startsWith("Dompet ") && !couple.name.includes("&")) {
      updatedCoupleName = `${couple.name} & ${myDisplayName}`;
      await admin
        .from("couples")
        .update({ name: updatedCoupleName })
        .eq("id", couple.id);
    }

    return NextResponse.json({
      success: true,
      coupleId: couple.id,
      coupleName: updatedCoupleName,
      message: "PIN Benar! Kamu resmi bergabung ke Dompet Bersama!",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat verifikasi PIN";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
