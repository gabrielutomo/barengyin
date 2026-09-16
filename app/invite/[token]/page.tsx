"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Logo } from "@/components/ui/logo";

interface InviteData {
  id: string;
  couple_id: string;
  invite_token: string;
  invited_by: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  coupleName?: string;
  inviterName?: string;
}

export default function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email?: string;
    fullName?: string;
  } | null>(null);

  // PIN state
  const [pin, setPin] = useState(["", "", "", ""]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadInviteAndUser() {
      setIsLoading(true);
      try {
        // 1. Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setCurrentUser({
            id: user.id,
            email: user.email,
            fullName:
              user.user_metadata?.full_name || user.email?.split("@")[0],
          });
        }

        // 2. Fetch invite details
        const { data: inviteRow, error: invErr } = await supabase
          .from("couple_invites")
          .select("*")
          .eq("invite_token", token)
          .maybeSingle();

        if (invErr || !inviteRow) {
          setErrorMsg("Undangan tidak ditemukan atau tautan tidak valid.");
          return;
        }

        let coupleName = "Dompet Bersama";
        let inviterName = "Pasangan Kamu";

        // Fetch couple name
        const { data: coupleRow } = await supabase
          .from("couples")
          .select("name")
          .eq("id", inviteRow.couple_id)
          .maybeSingle();
        if (coupleRow?.name) coupleName = coupleRow.name;

        // Fetch inviter profile
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", inviteRow.invited_by)
          .maybeSingle();
        if (profileRow?.full_name) inviterName = profileRow.full_name;

        setInvite({
          ...inviteRow,
          coupleName,
          inviterName,
        });
      } catch (err: unknown) {
        console.error("Error loading invite:", err);
        setErrorMsg("Gagal memuat detail undangan. Pastikan tautan valid.");
      } finally {
        setIsLoading(false);
      }
    }

    loadInviteAndUser();
  }, [token, supabase]);

  const handlePinChange = (index: number, val: string) => {
    const clean = val.replace(/[^0-9]/g, "");
    const char = clean ? clean[clean.length - 1] : "";

    const newPin = [...pin];
    newPin[index] = char;
    setPin(newPin);

    // Auto advance focus
    if (char && index < 3) {
      const nextInput = document.getElementById(`invite-pin-${index + 1}`);
      nextInput?.focus();
    }

    // Auto submit on 4th digit
    if (char && index === 3) {
      newPin[3] = char;
      if (newPin.every((d) => d !== "")) {
        handleVerifyAndJoin(newPin.join(""));
      }
    }
  };

  const handleKeypadPress = (digit: string) => {
    const currentPin = [...pin];
    const emptyIndex = currentPin.findIndex((d) => d === "");
    if (emptyIndex !== -1) {
      currentPin[emptyIndex] = digit;
      setPin(currentPin);
      if (emptyIndex === 3) {
        handleVerifyAndJoin(currentPin.join(""));
      } else {
        const nextInput = document.getElementById(`invite-pin-${emptyIndex + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleKeypadBackspace = () => {
    const currentPin = [...pin];
    for (let i = 3; i >= 0; i--) {
      if (currentPin[i] !== "") {
        currentPin[i] = "";
        setPin(currentPin);
        const prevInput = document.getElementById(`invite-pin-${i}`);
        prevInput?.focus();
        break;
      }
    }
  };

  const handleVerifyAndJoin = async (overridePin?: string) => {
    const pinStr = overridePin || pin.join("");
    if (pinStr.length !== 4) {
      setErrorMsg("Masukkan 4 digit PIN Pasangan yang diberikan pengundang!");
      return;
    }

    if (!currentUser) {
      router.push(`/masuk?mode=register&next=/invite/${token}`);
      return;
    }

    setIsVerifyingPin(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/couple/join-with-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteToken: token,
          pin: pinStr,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "PIN Pasangan tidak cocok atau undangan tidak valid.");
      }

      setSuccessMsg(
        result.message || "PIN Pasangan Cocok! Kamu resmi bergabung ke Dompet Bersama!"
      );

      setTimeout(() => {
        router.push("/dashboard");
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memverifikasi PIN.";
      setErrorMsg(msg);
      setPin(["", "", "", ""]);
      const firstInput = document.getElementById("invite-pin-0");
      firstInput?.focus();
    } finally {
      setIsVerifyingPin(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 selection:bg-primary-container selection:text-black">
      {/* Background Grid Pattern */}
      <div
        className="fixed inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#000 2px, transparent 2px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 w-full max-w-md bg-surface-container-lowest border-[4px] border-black shadow-[8px_8px_0px_#000000] rounded-xl p-6 sm:p-8">
        {/* Header Logo */}
        <div className="flex justify-center mb-6">
          <Logo href="/" size="md" />
        </div>

        {isLoading ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-headline-sm uppercase font-black text-on-surface">
              Memverifikasi Undangan...
            </p>
          </div>
        ) : errorMsg && !invite ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-[#ffdad6] border-[3px] border-black rounded-xl flex items-center justify-center mx-auto mb-4 shadow-[3px_3px_0px_#000]">
              <span className="material-symbols-outlined text-3xl text-[#ba1a1a]">
                error
              </span>
            </div>
            <h2 className="font-headline-md uppercase font-black text-on-surface mb-2">
              Undangan Tidak Valid
            </h2>
            <p className="font-body-md text-on-surface-variant mb-6">{errorMsg}</p>
            <Link
              href="/masuk"
              className="inline-block w-full py-3 bg-primary-container border-[3px] border-black rounded font-headline-sm uppercase font-black shadow-[3px_3px_0px_#000] text-center"
            >
              Kembali ke Masuk
            </Link>
          </div>
        ) : (
          <div>
            {/* Invite Badge */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="w-3 h-3 bg-[#22C55E] border-2 border-black rounded-full animate-pulse" />
              <span className="font-label-badge text-label-badge uppercase font-black tracking-wider bg-secondary-container px-2 py-0.5 border-2 border-black rounded-xs shadow-[2px_2px_0px_#000]">
                UNDANGAN PASANGAN RESMI
              </span>
            </div>

            {/* Graphic Icon */}
            <div className="w-20 h-20 bg-primary-container border-[3px] border-black rounded-2xl mx-auto flex items-center justify-center shadow-[4px_4px_0px_#000] mb-5">
              <span className="material-symbols-outlined text-4xl text-on-surface">
                favorite
              </span>
            </div>

            <h1 className="font-headline-md sm:text-[24px] uppercase font-black text-center text-on-surface leading-tight mb-2">
              Undangan Dompet Bersama
            </h1>

            <p className="font-body-md text-center text-on-surface-variant mb-5">
              <strong className="text-on-surface font-black">
                {invite?.inviterName || "Pasanganmu"}
              </strong>{" "}
              mengundangmu untuk bergabung ke dompet{" "}
              <span className="bg-[#FDE047] px-1.5 py-0.5 border border-black font-bold text-on-surface inline-block">
                {invite?.coupleName || "Dompet Bersama"}
              </span>
            </p>

            {/* ERROR OR SUCCESS ALERTS */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-[#ffdad6] border-[3px] border-black rounded font-body-sm font-bold text-[#ba1a1a] shadow-[2px_2px_0px_#000]">
                ⚠ {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 bg-[#D4F34A] border-[3px] border-black rounded font-body-sm font-bold text-black shadow-[2px_2px_0px_#000] animate-bounce">
                ✓ {successMsg}
              </div>
            )}

            {/* KONDISI 1: USER BELUM LOGIN / BELUM REGISTRASI */}
            {!currentUser ? (
              <div className="space-y-4">
                <div className="p-4 bg-secondary-container/30 border-[3px] border-black rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5 font-headline-sm uppercase font-black text-xs text-on-surface">
                    <span className="material-symbols-outlined text-base text-secondary">info</span>
                    <span>Catatan Wajib Registrasi</span>
                  </div>
                  <p className="font-body-sm text-xs text-on-surface-variant font-bold leading-relaxed">
                    Kamu harus <strong>mendaftar dan membuat akun Barengyin terlebih dahulu</strong> sebelum memasukkan PIN Pasangan untuk masuk ke akun bersama ini.
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  <Link
                    href={`/masuk?mode=register&next=/invite/${token}`}
                    className="w-full py-4 bg-primary-container text-on-surface border-[4px] border-black rounded-lg font-headline-sm uppercase font-black shadow-[4px_4px_0px_#000000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#000000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 text-center"
                  >
                    <span>1. Daftar Akun Baru Terlebih Dahulu</span>
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </Link>

                  <Link
                    href={`/masuk?mode=login&next=/invite/${token}`}
                    className="w-full py-3 bg-white text-on-surface border-[3px] border-black rounded-lg font-headline-sm uppercase font-bold shadow-[3px_3px_0px_#000] hover:bg-slate-100 transition-all flex items-center justify-center text-center text-xs"
                  >
                    Sudah Punya Akun? Masuk di Sini
                  </Link>
                </div>
              </div>
            ) : (
              /* KONDISI 2: USER SUDAH LOGIN -> MASUKKAN PIN YANG SAMA */
              <div className="space-y-4">
                <div className="p-3 bg-surface-container-low border-2 border-black rounded-lg flex items-center justify-between">
                  <div className="text-xs font-bold text-on-surface">
                    <span className="text-on-surface-variant block text-[10px] uppercase font-black">
                      Akun Kamu:
                    </span>
                    <span>{currentUser.fullName} ({currentUser.email})</span>
                  </div>
                  <span className="font-label-badge text-[10px] uppercase font-black px-2 py-0.5 bg-[#D4F34A] border border-black rounded">
                    Terverifikasi
                  </span>
                </div>

                <div className="text-center pt-2">
                  <span className="font-label-badge uppercase text-[11px] font-black bg-secondary-container px-2.5 py-1 border border-black rounded-xs inline-block mb-1.5">
                    Langkah Terakhir
                  </span>
                  <h3 className="font-headline-sm uppercase font-black text-sm text-on-surface">
                    Masukkan 4-Digit PIN Pasangan:
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                    Ketik PIN yang sama yang telah diatur oleh <strong>{invite?.inviterName || "pasanganmu"}</strong>:
                  </p>
                </div>

                {/* 4 Digit Boxes */}
                <div className="flex justify-center gap-3 sm:gap-4 my-2">
                  {[0, 1, 2, 3].map((idx) => (
                    <input
                      key={idx}
                      id={`invite-pin-${idx}`}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={pin[idx]}
                      onChange={(e) => handlePinChange(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !pin[idx] && idx > 0) {
                          const prev = document.getElementById(`invite-pin-${idx - 1}`);
                          prev?.focus();
                        }
                      }}
                      className="w-13 h-16 sm:w-14 sm:h-18 border-[3.5px] border-black text-center font-numeric-stat text-2xl sm:text-3xl font-black bg-surface-container-low rounded-lg focus:outline-none focus:bg-primary-container focus:shadow-[3px_3px_0px_#000] transition-all"
                    />
                  ))}
                </div>

                {/* On-screen Keypad */}
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto pt-1">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className="h-11 bg-white hover:bg-slate-100 border-2 border-black rounded font-numeric-stat text-lg font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPin(["", "", "", ""])}
                    className="h-11 bg-[#ffdad6] hover:bg-white text-[#ba1a1a] border-2 border-black rounded font-headline-sm uppercase text-[11px] font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  >
                    Hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress("0")}
                    className="h-11 bg-white hover:bg-slate-100 border-2 border-black rounded font-numeric-stat text-lg font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleKeypadBackspace}
                    className="h-11 bg-surface-container hover:bg-white border-2 border-black rounded font-headline-sm uppercase text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-lg">backspace</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleVerifyAndJoin()}
                  disabled={isVerifyingPin}
                  className="w-full py-4 mt-2 bg-primary-container text-on-surface border-[4px] border-black rounded-lg font-headline-sm uppercase font-black shadow-[4px_4px_0px_#000000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#000000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">verified</span>
                  <span>
                    {isVerifyingPin
                      ? "Memverifikasi PIN..."
                      : "Verifikasi PIN & Masuk Akun Bersama"}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
