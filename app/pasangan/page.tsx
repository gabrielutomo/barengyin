"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";

export default function PasanganPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [couple, setCouple] = useState<{
    id: string;
    name: string;
    wallet_mode: string;
    default_split_ratio_a: number;
    default_split_ratio_b: number;
    pin_hash?: string | null;
  } | null>(null);
  const [partner, setPartner] = useState<{ id: string; full_name: string; email?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Invite state
  const [inviteLink, setInviteLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // PIN Configuration State
  const [pinInput, setPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [savedPinPlain, setSavedPinPlain] = useState<string | null>(null);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinForm, setShowPinForm] = useState(false);

  // Join Couple via PIN state (manual input)
  const [showJoinSection, setShowJoinSection] = useState(false);
  const [joinTokenInput, setJoinTokenInput] = useState("");
  const [joinPinInput, setJoinPinInput] = useState("");
  const [isJoiningCouple, setIsJoiningCouple] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Wallet mode settings state
  const [walletMode, setWalletMode] = useState("combined");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const myDisplayName = profile?.full_name || "Saya";
  const partnerDisplayName = partner?.full_name || "Pasangan";

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/masuk");
        return;
      }

      setCurrentUser({ id: user.id, email: user.email });

      // 1. Profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      const myName = prof?.full_name || user.email?.split("@")[0] || "Saya";
      setProfile({ full_name: myName });

      // 2. Couple
      const { data: members } = await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("profile_id", user.id)
        .order("joined_at", { ascending: false })
        .limit(1);

      const activeCoupleId = members?.[0]?.couple_id;
      if (activeCoupleId) {
        const { data: cRow } = await supabase
          .from("couples")
          .select("*")
          .eq("id", activeCoupleId)
          .maybeSingle();

        if (cRow) {
          let currentName = cRow.name;
          if (currentName && currentName.includes("Gabriel Utomo")) {
            currentName = currentName.replace("Gabriel Utomo", myName);
            cRow.name = currentName;
            supabase.from("couples").update({ name: currentName }).eq("id", cRow.id).then();
          }
          setCouple(cRow);
          setWalletMode(cRow.wallet_mode || "combined");
        }

        // Partner
        const { data: pMembers } = await supabase
          .from("couple_members")
          .select("profile_id")
          .eq("couple_id", activeCoupleId)
          .neq("profile_id", user.id)
          .limit(1);

        if (pMembers && pMembers.length > 0) {
          const { data: pProf } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("id", pMembers[0].profile_id)
            .maybeSingle();
          if (pProf) setPartner(pProf);
        }

        // Generate or get active invite link
        const { data: existingInvite } = await supabase
          .from("couple_invites")
          .select("invite_token")
          .eq("couple_id", activeCoupleId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          (typeof window !== "undefined" ? window.location.origin : "");

        if (existingInvite?.invite_token) {
          setInviteLink(`${baseUrl}/invite/${existingInvite.invite_token}`);
        } else {
          const token = Math.random().toString(36).substring(2, 9) + Math.random().toString(36).substring(2, 9);
          const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

          await supabase.from("couple_invites").insert({
            couple_id: activeCoupleId,
            invite_token: token,
            invited_by: user.id,
            status: "pending",
            expires_at: expiresAt,
          });

          setInviteLink(`${baseUrl}/invite/${token}`);
        }
      }
    } catch (err) {
      console.warn("Could not load couple info:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [router, supabase]);

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    showToast("Tautan undangan berhasil disalin ke clipboard!");
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleShareWhatsApp = () => {
    if (!inviteLink) return;
    const pinNotice = savedPinPlain
      ? `\n3. Masukkan PIN Pasangan kita: *${savedPinPlain}*`
      : `\n3. Masukkan 4-Digit PIN Pasangan yang telah aku atur`;

    const text = encodeURIComponent(
      `Hai sayang! Yuk kelola keuangan dan catat pengeluaran bareng aku di Barengyin:\n\n1. Buka link undangan: ${inviteLink}\n2. Daftar akunmu terlebih dahulu (jika belum punya)${pinNotice} untuk langsung masuk ke akun bersama kita!\n\nYuk mulai kelola keuangan berdua tanpa drama!`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // Configure PIN (Yang Invite Pasangannya yang Set PIN)
  const handleSaveCouplePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
      setPinError("PIN harus terdiri dari 4 digit angka!");
      return;
    }

    if (pinInput !== confirmPinInput) {
      setPinError("Konfirmasi PIN tidak cocok dengan PIN baru!");
      return;
    }

    setIsSavingPin(true);

    try {
      const res = await fetch("/api/couple/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: pinInput,
          coupleId: couple?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan PIN Pasangan.");
      }

      setSavedPinPlain(pinInput);
      setCouple((prev) => (prev ? { ...prev, pin_hash: "configured" } : prev));
      setShowPinForm(false);
      setPinInput("");
      setConfirmPinInput("");
      showToast("PIN Pasangan aktif! Bagikan tautan & PIN ini ke pasanganmu.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan PIN";
      setPinError(msg);
    } finally {
      setIsSavingPin(false);
    }
  };

  // Join Couple with PIN (Alternative direct entry)
  const handleJoinWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);

    let cleanToken = joinTokenInput.trim();
    // Support pasting full URL like http://.../invite/xyz123
    if (cleanToken.includes("/invite/")) {
      const parts = cleanToken.split("/invite/");
      cleanToken = parts[parts.length - 1].split("?")[0];
    }

    if (!cleanToken) {
      setJoinError("Masukkan tautan atau token undangan dari pasanganmu!");
      return;
    }

    if (joinPinInput.length !== 4 || !/^\d{4}$/.test(joinPinInput)) {
      setJoinError("Masukkan 4 digit PIN Pasangan yang diberikan pasanganmu!");
      return;
    }

    setIsJoiningCouple(true);

    try {
      const res = await fetch("/api/couple/join-with-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteToken: cleanToken,
          pin: joinPinInput,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Gagal bergabung ke dompet bersama.");
      }

      showToast("Selamat! Kamu berhasil bergabung ke akun bersama!");
      setShowJoinSection(false);
      setJoinTokenInput("");
      setJoinPinInput("");
      // Reload page data to reflect new couple
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat verifikasi PIN";
      setJoinError(msg);
    } finally {
      setIsJoiningCouple(false);
    }
  };

  const handleSaveWalletMode = async () => {
    if (!couple) return;
    setIsSavingSettings(true);
    try {
      const { error } = await supabase
        .from("couples")
        .update({ wallet_mode: walletMode })
        .eq("id", couple.id);

      if (error) throw error;
      showToast("Pengaturan mode dompet berhasil diperbarui!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memperbarui pengaturan dompet.";
      alert(`Terjadi kesalahan: ${msg}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen selection:bg-primary-container selection:text-black">
      {/* TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#D4F34A] border-[3px] border-black shadow-[4px_4px_0px_#000] p-3.5 rounded-lg flex items-center gap-2 font-headline-sm uppercase font-bold text-on-surface animate-bounce">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* SIDEBAR */}
      <AppSidebar
        activeNav="pasangan"
        coupleName={couple?.name || `Dompet ${myDisplayName}`}
        partnerName={partner?.full_name}
        isPartnerConnected={Boolean(partner)}
      />

      {/* MAIN CONTENT */}
      <div className="pl-0 md:pl-60 pb-20 md:pb-12 min-h-screen">
        {/* TOP HEADER */}
        <header className="fixed top-0 left-0 md:left-60 right-0 h-16 bg-surface-container-lowest border-b-[3px] border-black z-40 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
            <span className="font-label-badge text-label-badge uppercase px-2.5 sm:px-3 py-1 bg-secondary-container text-on-surface border-[2px] border-black shadow-[2px_2px_0px_#000] rounded-sm font-black flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-sm">favorite</span>
              <span className="truncate">RUANG PASANGAN</span>
            </span>
            <span className="hidden sm:inline font-body-sm text-xs text-on-surface-variant font-bold truncate">
              • {couple?.name || "Dompet Bersama"}
            </span>
          </div>

          <Link
            href="/dashboard"
            prefetch={true}
            className="text-xs font-headline-sm uppercase font-black px-3 py-1.5 bg-white border-2 border-black rounded shadow-[2px_2px_0px_#000] hover:bg-slate-100 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span className="hidden sm:inline">Ke Dashboard</span>
            <span className="sm:hidden">Dashboard</span>
          </Link>
        </header>

        {/* MAIN BODY */}
        <main className="pt-24 pb-16 px-6 sm:px-8 max-w-5xl mx-auto space-y-8">
          {/* HERO PROFILE STATUS */}
          <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
              <div>
                <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                  STATUS RUANG DOMPET
                </span>
                <h1 className="font-headline-lg uppercase font-black text-2xl mt-1 tracking-tight">
                  {couple?.name || `Dompet ${myDisplayName}`}
                </h1>
              </div>
              <span className={`font-label-badge text-xs uppercase font-black px-3 py-1.5 border-2 border-black rounded ${
                partner ? "bg-[#D4F34A] text-black" : "bg-[#FDE047] text-black"
              }`}>
                {partner ? "✓ Terhubung Berdua (Duo Sync)" : "⏳ Menunggu Pasangan Bergabung"}
              </span>
            </div>

            {/* DUO AVATAR CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Profile 1: Kamu */}
              <div className="p-4 bg-surface-container-low border-[3px] border-black rounded-lg shadow-[3px_3px_0px_#000] flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#38BDF8] border-[3px] border-black flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_#000]">
                  {myDisplayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-label-badge text-[10px] uppercase font-black px-1.5 py-0.5 bg-primary-container border border-black rounded inline-block mb-1">
                    Akun Kamu (Owner)
                  </div>
                  <h3 className="font-headline-sm uppercase font-black text-base">{myDisplayName}</h3>
                  <p className="font-body-sm text-xs text-on-surface-variant font-semibold">
                    {currentUser?.email || "Pengelola Utama"}
                  </p>
                </div>
              </div>

              {/* Profile 2: Pasangan */}
              <div className="p-4 bg-surface-container-low border-[3px] border-black rounded-lg shadow-[3px_3px_0px_#000] flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-secondary-container border-[3px] border-black flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_#000]">
                  {partner ? partner.full_name.charAt(0).toUpperCase() : "?"}
                </div>
                <div>
                  <div className="font-label-badge text-[10px] uppercase font-black px-1.5 py-0.5 bg-secondary-container border border-black rounded inline-block mb-1">
                    Pasangan Kamu
                  </div>
                  <h3 className="font-headline-sm uppercase font-black text-base">
                    {partner ? partner.full_name : "Belum Bergabung"}
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant font-semibold">
                    {partner ? "Aktif tersinkronisasi" : "Atur PIN dan bagikan tautan undangan di bawah"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: ATUR PIN PASANGAN (Yang Mengundang Mengatur PIN) */}
          <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">dialpad</span>
                <h2 className="font-headline-sm uppercase font-black text-lg">
                  PIN Pasangan Dompet Bersama (4 Digit)
                </h2>
              </div>
              <span className={`font-label-badge text-xs uppercase font-black px-2.5 py-1 border-2 border-black rounded self-start sm:self-auto ${
                couple?.pin_hash ? "bg-[#D4F34A] text-black" : "bg-[#FDE047] text-black"
              }`}>
                {couple?.pin_hash ? "✓ PIN Pasangan Aktif" : "⚠ Belum Diatur"}
              </span>
            </div>

            <p className="font-body-sm text-xs text-on-surface-variant font-bold leading-relaxed">
              Sebagai pihak yang mengundang, kamu yang mengatur 4-digit PIN ini. Saat pasanganmu mendaftar akun dan memasukkan PIN yang sama, kalian akan langsung terhubung ke akun dompet bersama!
            </p>

            {pinError && (
              <div className="p-3 bg-[#ffdad6] border-2 border-black rounded font-body-sm text-xs font-bold text-[#ba1a1a]">
                ⚠ {pinError}
              </div>
            )}

            {couple?.pin_hash && !showPinForm ? (
              <div className="p-4 bg-[#f0fdf4] border-2 border-black rounded-lg space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-[#166534]">
                    <span className="material-symbols-outlined text-lg">verified_user</span>
                    <span>PIN Pasangan telah tersimpan untuk dompet ini.</span>
                  </div>
                  {savedPinPlain && (
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 border-2 border-black rounded">
                      <span className="text-[11px] font-bold text-on-surface-variant uppercase">PIN Kamu:</span>
                      <span className="font-numeric-stat font-black text-sm tracking-widest bg-[#D4F34A] px-1.5 rounded">
                        {savedPinPlain}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPinForm(true);
                      setPinError(null);
                    }}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-black border-2 border-black rounded font-headline-sm uppercase font-bold text-xs shadow-[2px_2px_0px_#000] cursor-pointer"
                  >
                    Ganti PIN Pasangan
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveCouplePin} className="p-5 bg-surface-container-low border-[3px] border-black rounded-lg space-y-4">
                <div className="flex items-center gap-2 font-headline-sm uppercase font-black text-xs">
                  <span className="w-2.5 h-2.5 bg-secondary-container border border-black rounded-full" />
                  <span>{couple?.pin_hash ? "Ubah 4-Digit PIN Pasangan:" : "Buat 4-Digit PIN Pasangan:"}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-label-badge uppercase block mb-1.5 text-[11px] font-bold">
                      4 Digit PIN Baru:
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      placeholder="••••"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                      className="w-full border-[3px] border-black rounded p-3 font-numeric-stat text-center text-2xl font-black tracking-widest bg-white focus:outline-none focus:bg-primary-container"
                    />
                  </div>

                  <div>
                    <label className="font-label-badge uppercase block mb-1.5 text-[11px] font-bold">
                      Ulangi Konfirmasi PIN:
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      placeholder="••••"
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                      className="w-full border-[3px] border-black rounded p-3 font-numeric-stat text-center text-2xl font-black tracking-widest bg-white focus:outline-none focus:bg-primary-container"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSavingPin}
                    className="px-6 py-3 bg-primary-container hover:bg-[#a6e6ff] text-black border-[3px] border-black rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingPin ? "Menyimpan..." : "Simpan & Aktifkan PIN Pasangan"}
                  </button>

                  {couple?.pin_hash && (
                    <button
                      type="button"
                      onClick={() => setShowPinForm(false)}
                      className="px-4 py-3 bg-white text-black border-2 border-black rounded font-headline-sm uppercase font-bold text-xs hover:bg-slate-100 cursor-pointer"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* SECTION 2: UNDANGAN PASANGAN (INVITE GENERATOR & SHARE) */}
          <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-black pb-3">
              <span className="material-symbols-outlined text-primary text-2xl">person_add</span>
              <h2 className="font-headline-sm uppercase font-black text-lg">
                Tautan Rahasia &amp; Undangan Pasangan
              </h2>
            </div>

            <div className="p-3 bg-secondary-container/30 border-2 border-black rounded-lg text-xs font-bold text-on-surface leading-relaxed">
              📌 <strong>Alur Pasangan:</strong> Kirimkan tautan ini ke pasanganmu. Pasanganmu wajib melakukan <strong>registrasi buat akun terlebih dahulu</strong>, lalu memasukkan <strong>PIN Pasangan</strong> yang sama untuk otomatis masuk ke akun bersama ini.
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
              <input
                type="text"
                readOnly
                value={inviteLink || "Memuat tautan undangan..."}
                className="flex-1 border-[3px] border-black rounded p-3 bg-white font-mono text-xs font-bold truncate focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-5 py-3 border-[3px] border-black rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  copiedLink ? "bg-[#D4F34A]" : "bg-primary-container hover:bg-[#a6e6ff]"
                }`}
              >
                <span className="material-symbols-outlined text-base">
                  {copiedLink ? "check" : "content_copy"}
                </span>
                <span>{copiedLink ? "Disalin!" : "Salin Link"}</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="px-5 py-3 bg-[#22C55E] hover:bg-[#16a34a] text-white border-[3px] border-black rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                <span>Kirim via WhatsApp</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 pt-1 text-[11px] font-bold text-on-surface-variant">
              <span className="material-symbols-outlined text-[15px] text-primary">info</span>
              <span>
                {inviteLink.includes("localhost")
                  ? "💡 Tautan saat ini memakai localhost (komputer lokal). Begitu aplikasi dideploy ke Vercel, tautan otomatis menggunakan domain Vercel / domain publik kamu!"
                  : "💡 Tautan resmi siap dibagikan ke pasangan kamu."}
              </span>
            </div>
          </div>

          {/* SECTION 3: ALTERNATIF GABUNG DENGAN PIN (Bagi Pengguna Yang Menerima Undangan) */}
          {!partner && (
            <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-2xl">link</span>
                  <h2 className="font-headline-sm uppercase font-black text-lg">
                    Punya Undangan dari Pasangan?
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowJoinSection(!showJoinSection)}
                  className="font-headline-sm uppercase font-black text-xs px-3 py-1 bg-surface-container border-2 border-black rounded hover:bg-surface-container-high"
                >
                  {showJoinSection ? "Tutup Form" : "Buka Form Gabung"}
                </button>
              </div>

              <p className="font-body-sm text-xs text-on-surface-variant font-bold leading-relaxed">
                Jika pasanganmu sudah membuat dompet bersama dan memberikan tautan serta PIN, kamu bisa langsung menghubungkan akunmu di sini.
              </p>

              {showJoinSection && (
                <form onSubmit={handleJoinWithPin} className="p-4 bg-surface-container-low border-2 border-black rounded-lg space-y-3">
                  {joinError && (
                    <div className="p-3 bg-[#ffdad6] border-2 border-black rounded font-body-sm text-xs font-bold text-[#ba1a1a]">
                      ⚠ {joinError}
                    </div>
                  )}

                  <div>
                    <label className="font-label-badge uppercase block mb-1 text-[11px] font-bold">
                      Tautan atau Kode Undangan dari Pasangan:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Tempel link undangan (contoh: https://.../invite/token) atau token"
                      value={joinTokenInput}
                      onChange={(e) => setJoinTokenInput(e.target.value)}
                      className="w-full border-2 border-black rounded p-2.5 font-mono text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-label-badge uppercase block mb-1 text-[11px] font-bold">
                      4 Digit PIN Pasangan yang Diberikan:
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      placeholder="••••"
                      value={joinPinInput}
                      onChange={(e) => setJoinPinInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                      className="w-40 border-2 border-black rounded p-2.5 font-numeric-stat text-center text-xl font-black tracking-widest bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isJoiningCouple}
                    className="px-6 py-2.5 bg-primary-container hover:bg-[#a6e6ff] text-black border-2 border-black rounded font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                  >
                    {isJoiningCouple ? "Memverifikasi..." : "Verifikasi PIN & Masuk Akun Bersama"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* SECTION 4: PENGATURAN MODE DOMPET BERSAMA */}
          <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-black pb-3">
              <span className="material-symbols-outlined text-primary text-2xl">account_balance_wallet</span>
              <h2 className="font-headline-sm uppercase font-black text-lg">
                Mode Dompet &amp; Rasio Split
              </h2>
            </div>

            <div className="space-y-3">
              <label className="font-label-badge uppercase block text-xs font-bold">
                Pilih Mode Pengelolaan Uang:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Mode 1: Combined */}
                <div
                  onClick={() => setWalletMode("combined")}
                  className={`p-4 border-[3px] border-black rounded-lg cursor-pointer transition-all ${
                    walletMode === "combined"
                      ? "bg-primary-container shadow-[4px_4px_0px_#000]"
                      : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-headline-sm uppercase font-black text-sm">
                      1. Dompet Gabungan (Combined)
                    </span>
                    <span className="material-symbols-outlined text-lg">
                      {walletMode === "combined" ? "radio_button_checked" : "radio_button_unchecked"}
                    </span>
                  </div>
                  <p className="font-body-sm text-xs text-on-surface-variant font-medium">
                    Satu kantong dompet bersama untuk semua pengeluaran kencan, makan, dan kebutuhan bersama.
                  </p>
                </div>

                {/* Mode 2: Separate */}
                <div
                  onClick={() => setWalletMode("separate")}
                  className={`p-4 border-[3px] border-black rounded-lg cursor-pointer transition-all ${
                    walletMode === "separate"
                      ? "bg-primary-container shadow-[4px_4px_0px_#000]"
                      : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-headline-sm uppercase font-black text-sm">
                      2. Dompet Terpisah (Separate)
                    </span>
                    <span className="material-symbols-outlined text-lg">
                      {walletMode === "separate" ? "radio_button_checked" : "radio_button_unchecked"}
                    </span>
                  </div>
                  <p className="font-body-sm text-xs text-on-surface-variant font-medium">
                    Dompet masing-masing tetap individual, Barengyin hanya menghitung porsi talangan split (50:50).
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isSavingSettings}
                  onClick={handleSaveWalletMode}
                  className="px-6 py-3 bg-secondary-container hover:bg-[#ff8063] text-black border-[3px] border-black rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingSettings ? "Menyimpan..." : "Simpan Pengaturan Mode Dompet"}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
