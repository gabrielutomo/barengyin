"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Logo } from "@/components/ui/logo";
import { Turnstile, TurnstileRef } from "@/components/turnstile";
import {
  getPinVaultInfo,
  unlockPinVault,
  PinVaultInfo,
} from "@/lib/pin-auth";

function MasukForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";

  const [mode, setMode] = useState<"login" | "register" | "pin">("login");
  const [showPinModal, setShowPinModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [vaultInfo, setVaultInfo] = useState<PinVaultInfo | null>(null);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileRef>(null);

  const resetTurnstile = () => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  };

  useEffect(() => {
    const info = getPinVaultInfo();
    setVaultInfo(info);
    if (info.hasVault && initialMode !== "register") {
      setMode("pin");
    } else {
      setMode(initialMode);
    }
  }, [initialMode]);

  const supabase = createClient();

  const ensureUserHasCouple = async (userId: string, name: string) => {
    try {
      // 1. Ensure profile exists
      await supabase.from("profiles").upsert(
        {
          id: userId,
          full_name: name,
        },
        { onConflict: "id" }
      );

      // 2. Check if user belongs to any couple
      const { data: memberRows } = await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("profile_id", userId)
        .limit(1);

      if (!memberRows || memberRows.length === 0) {
        const coupleName = `Dompet ${name}`;
        const { data: newCouple, error: coupleErr } = await supabase
          .from("couples")
          .insert({
            name: coupleName,
            wallet_mode: "combined",
            created_by: userId,
          })
          .select("id")
          .single();

        if (newCouple && !coupleErr) {
          await supabase.from("couple_members").insert({
            couple_id: newCouple.id,
            profile_id: userId,
            role: "owner",
          });

          await supabase.from("wallets").insert({
            couple_id: newCouple.id,
            name: "Dompet Utama Bersama",
            type: "shared",
            current_balance: 0,
          });
        }
      }
    } catch (err) {
      console.warn("Couple initialization notice:", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const cleanEmail = email.trim();
      if (!cleanEmail || !cleanEmail.includes("@")) {
        throw new Error("Masukkan alamat email yang valid.");
      }
      if (password.length < 6) {
        throw new Error("Kata sandi minimal 6 karakter demi keamanan akun bersama.");
      }

      if (mode === "register") {
        if (!turnstileToken) {
          throw new Error("Silakan selesaikan verifikasi dengan mengklik 'Saya bukan robot' terlebih dahulu.");
        }

        // Canonical server-side siteverify
        const verifyRes = await fetch("/api/verify-turnstile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: turnstileToken,
            action: "signup",
          }),
        });
        const verifyResult = await verifyRes.json();
        if (!verifyResult.success) {
          resetTurnstile();
          throw new Error(verifyResult.error || "Verifikasi bot Cloudflare gagal. Silakan verifikasi ulang.");
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });
        if (error) throw error;

        if (data.session && data.user) {
          await ensureUserHasCouple(data.user.id, fullName.trim() || cleanEmail.split("@")[0]);
          setSuccessMessage("Akun berhasil dibuat! Mengalihkan...");
          const nextUrl = searchParams.get("next") || "/dashboard";
          setTimeout(() => {
            router.push(nextUrl);
          }, 800);
        } else {
          setSuccessMessage(
            "Pendaftaran berhasil! Silakan periksa inbox email kamu jika tautan konfirmasi aktif, atau langsung masuk dengan email & kata sandi kamu."
          );
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;

        if (data.user) {
          const displayName =
            data.user.user_metadata?.full_name || cleanEmail.split("@")[0];
          await ensureUserHasCouple(data.user.id, displayName);
        }
        const nextUrl = searchParams.get("next") || "/dashboard";
        router.push(nextUrl);
      }
    } catch (err: unknown) {
      resetTurnstile();
      const msg =
        err instanceof Error ? err.message : "Terjadi kesalahan saat otentikasi";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinChange = (index: number, val: string) => {
    const clean = val.replace(/[^0-9]/g, "");
    const char = clean ? clean[clean.length - 1] : "";

    const newPin = [...pin];
    newPin[index] = char;
    setPin(newPin);

    // auto focus next input
    if (char && index < 3) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }

    // auto submit if 4th digit entered
    if (char && index === 3) {
      newPin[3] = char;
      if (newPin.every((d) => d !== "")) {
        handlePinSubmit(newPin.join(""));
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
        handlePinSubmit(currentPin.join(""));
      } else {
        const nextInput = document.getElementById(`pin-${emptyIndex + 1}`);
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
        const prevInput = document.getElementById(`pin-${i}`);
        prevInput?.focus();
        break;
      }
    }
  };

  const handleKeypadClear = () => {
    setPin(["", "", "", ""]);
    const firstInput = document.getElementById("pin-0");
    firstInput?.focus();
  };

  const handlePinSubmit = async (customPin?: string) => {
    const pinStr = customPin || pin.join("");
    if (pinStr.length !== 4) {
      setErrorMessage("Masukkan 4 digit PIN kamu!");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Decrypt credentials using PIN
      const payload = await unlockPinVault(pinStr);

      if (!payload.email || !payload.password) {
        throw new Error("Kredensial brankas tidak lengkap. Silakan masuk via email & sandi.");
      }

      setSuccessMessage("PIN Benar! Membuka dompet bersama...");

      // 2. Authenticate directly to Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password,
      });

      if (error) {
        throw new Error(
          error.message === "Invalid login credentials"
            ? "Kata sandi akun telah berubah. Silakan masuk dengan email & sandi terbaru."
            : error.message
        );
      }

      if (data.user) {
        const displayName =
          payload.userName ||
          data.user.user_metadata?.full_name ||
          payload.email.split("@")[0];
        await ensureUserHasCouple(data.user.id, displayName);
      }

      // 3. Direct to dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 400);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "PIN salah. Silakan periksa kembali.";
      setErrorMessage(msg);
      setPin(["", "", "", ""]);
      const firstInput = document.getElementById("pin-0");
      firstInput?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="w-full min-h-screen bg-surface selection:bg-primary-container selection:text-black">
      <div className="w-full min-h-screen bg-surface flex flex-col lg:flex-row border-b-4 border-black">
        {/* LEFT SIDE: Brand Showcase (42% Desktop) */}
        <div className="w-full lg:w-[42%] bg-secondary-container p-6 sm:p-10 lg:p-12 flex flex-col justify-between border-b-4 lg:border-b-0 lg:border-r-4 border-black relative overflow-hidden">
          {/* Subtle Decorative Grid Background */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(#000 2px, transparent 2px)",
              backgroundSize: "24px 24px",
            }}
          ></div>

          {/* Top Brand Header */}
          <div className="relative z-10">
            <Logo href="/" size="lg" />

            <p className="font-headline-md text-headline-md text-on-surface mt-6 leading-tight max-w-md font-bold">
              Kelola keuangan berdua jadi{" "}
              <span className="bg-primary-container px-1 py-0.5 border-2 border-black inline-block -rotate-1 shadow-[2px_2px_0px_#000000]">
                lebih gampang
              </span>{" "}
              &amp; tanpa drama.
            </p>
          </div>

          {/* Center Visual Graphic with Overlapping Badges */}
          <div className="relative my-8 lg:my-10 z-10 flex flex-col items-center">
            <div className="w-full max-w-sm bg-surface-container-lowest border-4 border-black rounded-md shadow-[8px_8px_0px_#000000] p-4 relative group">
              <div className="w-full aspect-square border-[3px] border-black rounded overflow-hidden bg-primary-container/20 relative">
                <Image
                  alt="Barengyin Pasangan Keuangan"
                  src="/assets/playful_couple_popart.png"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                  priority
                />
              </div>

              {/* Floating Sticker Badges */}
              <div className="absolute -top-4 -right-4 bg-primary-container border-[3px] border-black px-3 py-1.5 rounded shadow-[4px_4px_0px_#000000] rotate-3 flex items-center gap-1.5 transform hover:-translate-y-1 transition-transform">
                <span className="material-symbols-outlined text-[18px] text-black">
                  auto_awesome
                </span>
                <span className="font-label-badge text-label-badge tracking-wider text-black font-black">
                  50:50 SPLIT
                </span>
              </div>

              <div className="absolute top-1/2 -left-5 -translate-y-1/2 bg-surface-container-lowest border-[3px] border-black px-3 py-1.5 rounded shadow-[4px_4px_0px_#000000] -rotate-6 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#22C55E] rounded-full border border-black"></span>
                <span className="font-label-badge text-label-badge tracking-wider text-black font-black">
                  TABUNGAN NIKAH: 78%
                </span>
              </div>

              <div className="absolute -bottom-3 -right-2 bg-[#FDE047] border-[3px] border-black px-3 py-1.5 rounded shadow-[4px_4px_0px_#000000] rotate-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-black">
                  verified_user
                </span>
                <span className="font-label-badge text-label-badge tracking-wider text-black font-black">
                  PRIVASI TERJAMIN
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Micro-Proof Card */}
          <div className="relative z-10 bg-surface border-[3px] border-black p-3.5 rounded shadow-[4px_4px_0px_#000000] flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded border-2 border-black bg-primary-container flex items-center justify-center font-bold text-xs text-on-surface shadow-[2px_2px_0px_#000000]">
                R
              </div>
              <div className="w-8 h-8 rounded border-2 border-black bg-[#FDE047] flex items-center justify-center font-bold text-xs text-on-surface shadow-[2px_2px_0px_#000000]">
                A
              </div>
              <div className="w-8 h-8 rounded border-2 border-black bg-secondary flex items-center justify-center font-bold text-xs text-white shadow-[2px_2px_0px_#000000]">
                +2k
              </div>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface font-semibold leading-tight">
              Bergabung bersama 15,000+ pasangan cerdas finansial di Indonesia.
            </p>
          </div>
        </div>

        {/* RIGHT SIDE: Authentication Form (58% Desktop) */}
        <div className="w-full lg:w-[58%] bg-[#F7F4EB] p-6 sm:p-12 lg:p-16 flex flex-col justify-between">
          {/* Top Action Bar */}
          <div className="flex items-center justify-between pb-8 border-b-2 border-black/20">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-primary-container border-2 border-black"></span>
              <span className="font-label-badge text-label-badge uppercase tracking-wider text-on-surface font-black">
                PORTAL MASUK PASANGAN
              </span>
            </div>
          </div>

          {/* Main Login Container */}
          <div className="w-full max-w-lg mx-auto py-8 sm:py-12">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                {vaultInfo?.hasVault && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("pin");
                      setPin(["", "", "", ""]);
                      setErrorMessage(null);
                    }}
                    className={`px-4 py-1.5 border-[3px] border-black font-label-badge uppercase rounded transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
                      mode === "pin"
                        ? "bg-[#D4F34A] shadow-[3px_3px_0px_#000]"
                        : "bg-white hover:bg-slate-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">dialpad</span>
                    <span>Masuk via PIN</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setErrorMessage(null);
                    resetTurnstile();
                  }}
                  className={`px-4 py-1.5 border-[3px] border-black font-label-badge uppercase rounded transition-all cursor-pointer font-bold ${
                    mode === "login"
                      ? "bg-primary-container shadow-[3px_3px_0px_#000]"
                      : "bg-white hover:bg-slate-100"
                  }`}
                >
                  Masuk Akun
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setErrorMessage(null);
                    resetTurnstile();
                  }}
                  className={`px-4 py-1.5 border-[3px] border-black font-label-badge uppercase rounded transition-all cursor-pointer font-bold ${
                    mode === "register"
                      ? "bg-primary-container shadow-[3px_3px_0px_#000]"
                      : "bg-white hover:bg-slate-100"
                  }`}
                >
                  Daftar Baru
                </button>
              </div>

              <h1 className="font-headline-lg text-headline-lg sm:text-[36px] text-on-surface font-black tracking-tight leading-none">
                {mode === "pin"
                  ? "Masuk dengan PIN Pasangan"
                  : mode === "login"
                  ? "Masuk ke Barengyin"
                  : "Daftar Akun Berdua"}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 font-body-md text-body-md text-on-surface">
                <span>
                  {mode === "pin"
                    ? "Bukan akun atau perangkat kamu?"
                    : mode === "login"
                    ? "Belum punya akun bersama?"
                    : "Sudah pernah mendaftar?"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (mode === "pin") {
                      setMode("login");
                    } else {
                      setMode(mode === "login" ? "register" : "login");
                    }
                    setErrorMessage(null);
                    resetTurnstile();
                  }}
                  className="font-bold underline decoration-2 decoration-secondary hover:bg-secondary-container px-1 transition-colors cursor-pointer"
                >
                  {mode === "pin"
                    ? "Masuk dengan Email & Kata Sandi →"
                    : mode === "login"
                    ? "Daftar gratis di sini →"
                    : "Masuk ke akunmu →"}
                </button>
              </div>
            </div>

            {/* Error / Success Notifications */}
            {errorMessage && (
              <div className="mb-6 p-3 bg-[#ffdad6] border-[3px] border-black shadow-[3px_3px_0px_#000000] rounded font-body-sm font-bold text-[#ba1a1a] flex items-center justify-between">
                <span>⚠ {errorMessage}</span>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="font-bold text-xs"
                >
                  ✕
                </button>
              </div>
            )}
            {successMessage && (
              <div className="mb-6 p-3 bg-primary-container border-[3px] border-black shadow-[3px_3px_0px_#000000] rounded font-body-sm font-bold text-on-surface flex items-center justify-between">
                <span>✓ {successMessage}</span>
              </div>
            )}

            {mode === "pin" ? (
              /* QUICK ACCESS PIN CONTAINER */
              <div className="bg-surface-container-lowest border-[4px] border-black shadow-[6px_6px_0px_#000000] rounded-xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b-2 border-black/15">
                  <div className="w-12 h-12 rounded-full bg-primary-container border-[3px] border-black flex items-center justify-center font-bold text-base shadow-[2px_2px_0px_#000]">
                    <span className="material-symbols-outlined text-2xl">
                      favorite
                    </span>
                  </div>
                  <div>
                    <div className="font-label-badge uppercase text-[11px] font-black bg-[#D4F34A] px-2 py-0.5 border border-black inline-block rounded-xs">
                      Akses Cepat Aktif
                    </div>
                    <h2 className="font-headline-md text-xl sm:text-2xl font-black uppercase text-on-surface mt-0.5">
                      {vaultInfo?.coupleName || "Dompet Bersama"}
                    </h2>
                    <p className="font-body-sm text-xs text-on-surface-variant font-semibold">
                      {vaultInfo?.userName ? `Halo, ${vaultInfo.userName}!` : vaultInfo?.emailHint || "Perangkat Terverifikasi"}
                    </p>
                  </div>
                </div>

                <div className="text-center mb-5">
                  <p className="font-body-md text-sm font-bold text-on-surface">
                    Masukkan 4 digit PIN Pasangan untuk langsung membuka dashboard:
                  </p>
                </div>

                {/* 4 Digit Boxes */}
                <div className="flex justify-center gap-3 sm:gap-4 mb-6">
                  {[0, 1, 2, 3].map((idx) => (
                    <input
                      key={idx}
                      id={`pin-${idx}`}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={pin[idx]}
                      onChange={(e) => handlePinChange(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !pin[idx] && idx > 0) {
                          const prev = document.getElementById(`pin-${idx - 1}`);
                          prev?.focus();
                        }
                      }}
                      className="w-14 h-16 sm:w-16 sm:h-20 border-[3.5px] border-black text-center font-numeric-stat text-3xl sm:text-4xl font-black bg-surface-container-low rounded-lg focus:outline-none focus:bg-primary-container focus:shadow-[4px_4px_0px_#000] transition-all"
                    />
                  ))}
                </div>

                {/* On-screen Numeric Keypad */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5 max-w-xs mx-auto mb-6">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeypadPress(num)}
                      className="h-12 sm:h-14 bg-white hover:bg-primary-container border-[3px] border-black rounded-lg font-numeric-stat text-2xl font-bold shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleKeypadClear}
                    className="h-12 sm:h-14 bg-[#ffdad6] hover:bg-[#ffb4ab] border-[3px] border-black rounded-lg font-headline-sm uppercase text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center text-[#ba1a1a]"
                    title="Hapus Semua"
                  >
                    C
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress("0")}
                    className="h-12 sm:h-14 bg-white hover:bg-primary-container border-[3px] border-black rounded-lg font-numeric-stat text-2xl font-bold shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleKeypadBackspace}
                    className="h-12 sm:h-14 bg-surface-container hover:bg-surface-container-high border-[3px] border-black rounded-lg font-headline-sm shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center"
                    title="Hapus Satu Digit"
                  >
                    <span className="material-symbols-outlined text-2xl">backspace</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isLoading || pin.join("").length !== 4}
                  onClick={() => handlePinSubmit()}
                  className="w-full bg-primary-container text-on-surface border-[4px] border-black rounded p-4 font-headline-sm text-headline-sm tracking-wide uppercase font-black shadow-[5px_5px_0px_#000000] hover:translate-x-1 hover:translate-y-1 hover:shadow-[2px_2px_0px_#000000] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined font-black">
                    {isLoading ? "sync" : "lock_open"}
                  </span>
                  <span>{isLoading ? "Membuka Dompet..." : "Buka Dompet Sekarang"}</span>
                </button>

                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setPin(["", "", "", ""]);
                    }}
                    className="text-xs font-bold font-headline-sm uppercase underline decoration-2 hover:bg-secondary-container px-2 py-1 cursor-pointer transition-colors"
                  >
                    Masuk dengan Email &amp; Kata Sandi Akun &rarr;
                  </button>
                </div>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleAuth}>
                {/* Notice if arriving via invite link */}
                {mode === "register" && searchParams.get("next") && (
                  <div className="p-3.5 bg-secondary-container/30 border-[3px] border-black rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5 font-headline-sm uppercase font-black text-xs text-on-surface">
                      <span className="material-symbols-outlined text-base text-secondary">favorite</span>
                      <span>Undangan Dompet Bersama Terdeteksi</span>
                    </div>
                    <p className="font-body-sm text-xs font-bold text-on-surface leading-relaxed">
                      Catatan: Selesaikan pembuatan akunmu terlebih dahulu. Setelah terdaftar, kamu akan memasukkan PIN Pasangan yang sama untuk langsung terhubung ke akun bersama.
                    </p>
                  </div>
                )}

                {/* Full Name for Register */}
                {mode === "register" && (
                  <div className="flex flex-col gap-2">
                    <label
                      className="font-label-badge text-label-badge uppercase font-bold tracking-wider text-on-surface flex items-center gap-1.5"
                      htmlFor="fullName"
                    >
                      <span className="w-2 h-2 bg-on-surface inline-block"></span>
                      NAMA LENGKAP KAMU
                    </label>
                    <input
                      className="w-full bg-surface-container-lowest border-[3px] border-black rounded p-3.5 font-body-md text-body-md text-on-surface placeholder:text-black/40 focus:outline-none focus:shadow-[4px_4px_0px_#000000] transition-shadow"
                      id="fullName"
                      name="fullName"
                      placeholder="contoh: Aris Pratama"
                      required
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                )}

                {/* 1. Email Input */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label
                      className="font-label-badge text-label-badge uppercase font-bold tracking-wider text-on-surface flex items-center gap-1.5"
                      htmlFor="email"
                    >
                      <span className="w-2 h-2 bg-on-surface inline-block"></span>
                      EMAIL KAMU
                    </label>
                    <span className="font-body-sm text-[11px] text-on-surface-variant font-bold">
                      AKUN TERHUBUNG
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      className="w-full bg-surface-container-lowest border-[3px] border-black rounded p-3.5 font-body-md text-body-md text-on-surface placeholder:text-black/40 focus:outline-none focus:shadow-[4px_4px_0px_#000000] transition-shadow"
                      id="email"
                      name="email"
                      placeholder="nama@domain.com"
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* 2. Password Input */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label
                      className="font-label-badge text-label-badge uppercase font-bold tracking-wider text-on-surface flex items-center gap-1.5"
                      htmlFor="password"
                    >
                      <span className="w-2 h-2 bg-on-surface inline-block"></span>
                      KATA SANDI
                    </label>
                    <a
                      className="font-body-sm text-[11px] text-on-surface-variant font-bold hover:underline hover:text-black"
                      href="#"
                    >
                      LUPA SANDI?
                    </a>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      className="w-full bg-surface-container-lowest border-[3px] border-black rounded p-3.5 pr-14 font-body-md text-body-md text-on-surface placeholder:text-black/40 focus:outline-none focus:shadow-[4px_4px_0px_#000000] transition-shadow"
                      id="password"
                      name="password"
                      placeholder="••••••••••••"
                      required
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-surface-container border-2 border-black rounded flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer"
                      id="togglePassword"
                      onClick={() => setShowPassword(!showPassword)}
                      title="Tampilkan / Sembunyikan Sandi"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-on-surface text-[18px]">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 3. Checkbox: Keep logged in */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-3 cursor-pointer select-none group">
                    <input
                      defaultChecked
                      className="sr-only peer"
                      id="remember"
                      type="checkbox"
                    />
                    <div className="w-6 h-6 border-[3px] border-black rounded bg-surface-container-lowest peer-checked:bg-primary-container peer-checked:border-black flex items-center justify-center shadow-[2px_2px_0px_#000000] group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-all">
                      <span className="material-symbols-outlined text-black text-[18px] font-black hidden peer-checked:block">
                        check
                      </span>
                    </div>
                    <span className="font-body-md text-body-sm sm:text-body-md text-on-surface font-semibold">
                      Ingat sesi kami berdua
                    </span>
                  </label>
                </div>

                {/* Cloudflare Turnstile Bot Verification Widget */}
                <div className="w-full flex justify-center">
                  <Turnstile
                    ref={turnstileRef}
                    action={mode === "register" ? "signup" : "login"}
                    onVerify={(token) => {
                      setTurnstileToken(token);
                      setErrorMessage(null);
                    }}
                    onError={() => {
                      setTurnstileToken(null);
                    }}
                    onExpire={() => {
                      setTurnstileToken(null);
                    }}
                  />
                </div>

                {/* 4. Primary Submit Button */}
                <button
                  className="w-full bg-primary-container text-on-surface border-[4px] border-black rounded p-4 font-headline-sm text-headline-sm tracking-wide uppercase font-black shadow-[5px_5px_0px_#000000] hover:translate-x-1 hover:translate-y-1 hover:shadow-[2px_2px_0px_#000000] active:translate-x-[5px] active:translate-y-[5px] active:shadow-[0px_0px_0px_#000000] transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
                  type="submit"
                  disabled={isLoading}
                >
                  <span>
                    {isLoading
                      ? "Memproses..."
                      : mode === "login"
                        ? "Masuk Sekarang"
                        : "Daftar Akun Berdua"}
                  </span>
                  <span className="material-symbols-outlined text-[24px] font-black">
                    arrow_forward
                  </span>
                </button>

                {/* 7. Quick Passcode Couple Option */}
                <div className="pt-2 text-center">
                  <button
                    onClick={() => {
                      if (vaultInfo?.hasVault) {
                        setMode("pin");
                      } else {
                        setShowPinModal(true);
                      }
                    }}
                    className="inline-flex items-center gap-2 font-body-sm text-body-sm font-bold text-on-surface bg-surface-container-high/60 border-2 border-black px-4 py-2 rounded shadow-[3px_3px_0px_#000000] hover:bg-surface-container-highest active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#000000] transition-all cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      dialpad
                    </span>
                    <span>Masuk dengan PIN Pasangan (4 Digit)</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Pinned Footer Legal Links */}
          <div className="pt-8 border-t-2 border-black/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-label-badge text-label-badge text-on-surface font-bold tracking-wider">
              <a className="hover:underline underline-offset-4 decoration-2" href="#">
                SYARAT &amp; KETENTUAN
              </a>
              <span>•</span>
              <a className="hover:underline underline-offset-4 decoration-2" href="#">
                KEBIJAKAN PRIVASI
              </a>
              <span>•</span>
              <a className="hover:underline underline-offset-4 decoration-2" href="#">
                PUSAT BANTUAN
              </a>
            </div>
            <div className="font-body-sm text-[12px] text-on-surface font-bold">
              © 2026 Barengyin.
            </div>
          </div>
        </div>
      </div>

      {/* PIN QUICK ACCESS / HELP MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border-[4px] border-black shadow-[8px_8px_0px_#000000] rounded-xl p-6 sm:p-8 max-w-sm w-full relative">
            <button
              onClick={() => setShowPinModal(false)}
              className="absolute top-4 right-4 w-8 h-8 border-2 border-black rounded bg-[#FDE047] flex items-center justify-center font-bold text-sm shadow-[2px_2px_0px_#000] hover:bg-white cursor-pointer"
            >
              ✕
            </button>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-primary-container border-[3px] border-black rounded mx-auto flex items-center justify-center shadow-[3px_3px_0px_#000] mb-3">
                <span className="material-symbols-outlined text-2xl">
                  dialpad
                </span>
              </div>
              <h3 className="font-headline-md uppercase font-black">
                {vaultInfo?.hasVault ? "PIN Pasangan" : "PIN Pasangan & Akun Bersama"}
              </h3>
              <p className="font-body-sm text-on-surface-variant mt-2 leading-relaxed">
                {vaultInfo?.hasVault
                  ? "Akses cepat untuk laptop & gadget bersama."
                  : "Untuk bergabung ke akun bersama menggunakan PIN Pasangan, kamu harus mendaftar akun terlebih dahulu. Pihak yang mengundang adalah yang mengatur PIN. Setelah mendaftar, masukkan PIN yang sama untuk masuk ke akun bersama!"}
              </p>
            </div>

            {vaultInfo?.hasVault ? (
              <div className="space-y-4">
                <div className="flex justify-center gap-3 mb-6">
                  {[0, 1, 2, 3].map((idx) => (
                    <input
                      key={idx}
                      id={`modal-pin-${idx}`}
                      type="password"
                      maxLength={1}
                      value={pin[idx]}
                      onChange={(e) => handlePinChange(idx, e.target.value)}
                      className="w-12 h-14 border-[3px] border-black text-center font-numeric-stat text-2xl font-bold bg-surface-container-low rounded focus:outline-none focus:bg-primary-container focus:shadow-[3px_3px_0px_#000]"
                    />
                  ))}
                </div>

                <button
                  onClick={() => handlePinSubmit()}
                  disabled={isLoading}
                  className="w-full bg-primary-container text-black border-[3px] border-black rounded p-3 font-headline-sm uppercase font-black shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? "Membuka..." : "Buka Dompet"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 bg-surface-container border-2 border-black rounded text-xs font-semibold space-y-1.5 text-left">
                  <div className="font-bold text-black uppercase text-[11px] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">info</span>
                    <span>Alur Akses PIN Pasangan:</span>
                  </div>
                  <div className="text-on-surface-variant font-medium">1. Pasangan yang mengundang mengatur PIN 4 digit di Ruang Pasangan.</div>
                  <div className="text-on-surface-variant font-medium">2. Pasangan yang diundang mendaftar akun Barengyin terlebih dahulu.</div>
                  <div className="text-on-surface-variant font-medium">3. Masukkan PIN yang sama untuk masuk &amp; terhubung ke akun bersama.</div>
                </div>

                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setMode("register");
                    resetTurnstile();
                  }}
                  className="w-full bg-primary-container text-black border-[3px] border-black rounded p-3.5 font-headline-sm uppercase font-black shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer text-center"
                >
                  Daftar Akun Baru Sekarang &rarr;
                </button>

                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setMode("login");
                    const emailInput = document.getElementById("email");
                    emailInput?.focus();
                  }}
                  className="w-full bg-white text-black border-2 border-black rounded p-2.5 font-headline-sm uppercase font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Sudah Punya Akun? Masuk di Sini
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function MasukPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center font-headline-md">Memuat Portal Masuk...</div>}>
      <MasukForm />
    </Suspense>
  );
}

