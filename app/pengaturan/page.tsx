"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import {
  hashPin,
  setupPinVault,
  getPinVaultInfo,
  removePinVault,
} from "@/lib/pin-auth";

export default function PengaturanPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url?: string } | null>(null);
  const [couple, setCouple] = useState<{ id: string; name: string } | null>(null);
  const [partner, setPartner] = useState<{ id: string; full_name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form Profile State
  const [editFullName, setEditFullName] = useState("");
  const [editCoupleName, setEditCoupleName] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // PIN Vault State
  const [hasPinConfigured, setHasPinConfigured] = useState(false);
  const [showPinForm, setShowPinForm] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [accountPasswordForPin, setAccountPasswordForPin] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const myDisplayName = profile?.full_name || "Saya";

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    async function loadData() {
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
        setProfile({ full_name: myName, avatar_url: prof?.avatar_url });
        setEditFullName(myName);

        // 2. Couple
        const { data: members } = await supabase
          .from("couple_members")
          .select("couple_id")
          .eq("profile_id", user.id)
          .limit(1);

        const activeCoupleId = members?.[0]?.couple_id;
        if (activeCoupleId) {
          const { data: cRow } = await supabase
            .from("couples")
            .select("id, name")
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
            setEditCoupleName(cRow.name || `Dompet ${myName}`);
          }

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
        }

        // 3. Check Local PIN Vault
        const vaultInfo = getPinVaultInfo();
        setHasPinConfigured(Boolean(vaultInfo?.hasVault));
      } catch (err) {
        console.warn("Could not load account settings:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router, supabase]);

  // Save Name & Couple Name
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !editFullName.trim()) return;

    const newName = editFullName.trim();
    const oldName = profile?.full_name || "Gabriel Utomo";

    setIsUpdatingProfile(true);
    try {
      // 1. Update public.profiles
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: currentUser.id,
            full_name: newName,
          },
          { onConflict: "id" }
        );

      if (error) throw error;

      // 2. Sync Supabase Auth user metadata
      try {
        await supabase.auth.updateUser({
          data: { full_name: newName, name: newName },
        });
      } catch (authErr) {
        console.warn("Could not update auth user metadata:", authErr);
      }

      // 3. Sync or customize Couple / Dompet Name
      let targetCoupleName = editCoupleName.trim();
      if (couple?.id) {
        if (!targetCoupleName || targetCoupleName.includes("Gabriel Utomo") || targetCoupleName === `Dompet ${oldName}` || targetCoupleName === "Dompet Bersama") {
          targetCoupleName = targetCoupleName ? targetCoupleName.replace("Gabriel Utomo", newName) : `Dompet ${newName}`;
          setEditCoupleName(targetCoupleName);
        }

        const { error: coupleErr } = await supabase
          .from("couples")
          .update({ name: targetCoupleName })
          .eq("id", couple.id);

        if (!coupleErr) {
          setCouple((prev) => (prev ? { ...prev, name: targetCoupleName } : null));
        }
      }

      // 4. Update past transactions in database
      try {
        await supabase
          .from("transactions")
          .update({
            creator_name: newName,
            paid_by: newName,
          })
          .eq("created_by", currentUser.id);
      } catch (txErr) {
        console.warn("Could not bulk update past transactions:", txErr);
      }

      setProfile({
        full_name: newName,
        avatar_url: profile?.avatar_url,
      });
      showToast("Nama profil dan dompet berhasil diperbarui!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memperbarui profil.";
      alert(`Terjadi kesalahan: ${msg}`);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Configure PIN
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinError("PIN harus terdiri dari 4 digit angka!");
      return;
    }

    if (newPin !== confirmPin) {
      setPinError("Konfirmasi PIN tidak cocok dengan PIN baru!");
      return;
    }

    if (!accountPasswordForPin) {
      setPinError("Masukkan kata sandi akun untuk verifikasi keamanan brankas!");
      return;
    }

    if (!currentUser?.email) {
      setPinError("Email akun tidak ditemukan.");
      return;
    }

    setIsSavingPin(true);

    try {
      // 1. Verifikasi kredensial akun dengan Supabase
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: accountPasswordForPin,
      });

      if (authErr) {
        setPinError("Kata sandi akun salah. Pastikan kata sandi kamu benar.");
        setIsSavingPin(false);
        return;
      }

      // 2. Hash PIN untuk database Supabase & simpan ke couple
      await fetch("/api/couple/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: newPin,
          coupleId: couple?.id,
        }),
      });

      // 3. Enkripsi brankas lokal dengan Web Crypto AES-GCM
      await setupPinVault(newPin, {
        email: currentUser.email,
        password: accountPasswordForPin,
        coupleName: couple?.name || `Dompet ${myDisplayName}`,
        userName: myDisplayName,
      });

      setHasPinConfigured(true);
      setShowPinForm(false);
      setNewPin("");
      setConfirmPin("");
      setAccountPasswordForPin("");
      showToast("PIN Pasangan aktif! Sekarang kamu bisa masuk cepat.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan PIN.";
      setPinError(msg);
    } finally {
      setIsSavingPin(false);
    }
  };

  // Remove PIN
  const handleRemovePin = async () => {
    if (!confirm("Apakah kamu yakin ingin menonaktifkan PIN Pasangan di perangkat ini?")) {
      return;
    }

    try {
      removePinVault();
      if (currentUser?.id) {
        await supabase
          .from("profiles")
          .update({ pin_hash: null })
          .eq("id", currentUser.id);
      }
      setHasPinConfigured(false);
      setShowPinForm(false);
      showToast("PIN Pasangan telah dinonaktifkan di perangkat ini.");
    } catch (err) {
      console.warn("Could not remove PIN:", err);
    }
  };

  // Lock Screen
  const handleLockScreen = () => {
    router.push("/masuk");
  };

  // Sign Out
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Sign out notice:", err);
    }
    router.push("/masuk");
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
        activeNav="pengaturan"
        coupleName={couple?.name || `Dompet ${myDisplayName}`}
        partnerName={partner?.full_name}
        isPartnerConnected={Boolean(partner)}
      />

      {/* MAIN CONTAINER */}
      <div className="pl-0 md:pl-60 pb-20 md:pb-12 min-h-screen">
        {/* TOP HEADER */}
        <header className="fixed top-0 left-0 md:left-60 right-0 h-16 bg-surface-container-lowest border-b-[3px] border-black z-40 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
            <span className="font-label-badge text-label-badge uppercase px-2.5 sm:px-3 py-1 bg-surface-container text-on-surface border-[2px] border-black shadow-[2px_2px_0px_#000] rounded-sm font-black flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-sm">settings</span>
              <span className="truncate">PENGATURAN</span>
            </span>
            <span className="hidden sm:inline font-body-sm text-xs text-on-surface-variant font-bold truncate">
              • {couple?.name || "Dompet Bersama"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-headline-sm uppercase font-black px-3 sm:px-3.5 py-1.5 bg-[#ffdad6] text-[#ba1a1a] border-2 border-black rounded shadow-[2px_2px_0px_#000] hover:bg-white flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span className="hidden sm:inline">Keluar Akun</span>
            <span className="sm:hidden">Keluar</span>
          </button>
        </header>

        {/* MAIN BODY */}
        <main className="pt-24 pb-16 px-6 sm:px-8 max-w-4xl mx-auto space-y-8">
          {/* SECTION 1: PROFIL PENGGUNA */}
          <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-black pb-3">
              <span className="material-symbols-outlined text-primary text-2xl">account_circle</span>
              <h2 className="font-headline-sm uppercase font-black text-lg">
                Profil Pengguna
              </h2>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#38BDF8] border-[3px] border-black flex items-center justify-center font-black text-2xl shadow-[3px_3px_0px_#000]">
                  {myDisplayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-headline-sm uppercase font-black text-base">{myDisplayName}</div>
                  <div className="font-body-sm text-xs text-on-surface-variant font-bold">
                    Email terdaftar: <u>{currentUser?.email}</u>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Nama Tampilan (Full Name)
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full border-[3px] border-black rounded p-3 font-body-md font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Nama Dompet Bersama (Rekening Pasangan)
                </label>
                <input
                  type="text"
                  value={editCoupleName}
                  onChange={(e) => setEditCoupleName(e.target.value)}
                  placeholder="Contoh: Dompet Gabriel, Dompet Kami"
                  className="w-full border-[3px] border-black rounded p-3 font-body-md font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none bg-white"
                />
                <span className="text-[11px] text-on-surface-variant font-bold block mt-1">
                  Nama ini yang akan tampil di navbar atas, dompet, laporan, dan sidebar.
                </span>
              </div>

              <button
                type="submit"
                disabled={isUpdatingProfile}
                className="px-6 py-3 bg-primary-container hover:bg-[#a6e6ff] text-black border-[3px] border-black rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
              >
                {isUpdatingProfile ? "Menyimpan..." : "Simpan Perubahan Profil & Dompet"}
              </button>
            </form>
          </div>

          {/* SECTION 2: PIN PASANGAN (4-DIGIT QUICK LOGIN VAULT) */}
          <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">pin</span>
                <h2 className="font-headline-sm uppercase font-black text-lg">
                  PIN Pasangan (4-Digit Quick Lock)
                </h2>
              </div>
              <span className={`font-label-badge text-xs uppercase font-black px-2.5 py-1 border-2 border-black rounded ${
                hasPinConfigured ? "bg-[#D4F34A] text-black" : "bg-surface-container text-on-surface-variant"
              }`}>
                {hasPinConfigured ? "✓ PIN Aktif" : "Belum Aktif"}
              </span>
            </div>

            <p className="font-body-sm text-xs text-on-surface-variant font-bold leading-relaxed">
              PIN 4-digit ini berfungsi sebagai kunci akses instan dompet bersama. Sebagai pihak pengundang, kamu mengatur PIN ini agar pasanganmu dapat memasukkan PIN yang sama setelah mendaftar akun untuk langsung masuk ke akun bersama. Dilindungi brankas enkripsi lokal (Web Crypto AES-GCM) dan hash aman.
            </p>

            {hasPinConfigured && !showPinForm ? (
              <div className="p-4 bg-[#eff6ff] border-2 border-[#1e40af] rounded-lg space-y-3">
                <div className="flex items-center gap-2 font-bold text-xs text-[#1e3a8a]">
                  <span className="material-symbols-outlined text-lg text-[#2563eb]">verified_user</span>
                  <span>PIN Pasangan telah terkonfigurasi di perangkat ini.</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleLockScreen}
                    className="px-4 py-2 bg-primary-container text-black border-2 border-black rounded font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] hover:bg-[#a6e6ff] cursor-pointer"
                  >
                    Kunci Layar Sekarang (Lock)
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPinForm(true)}
                    className="px-4 py-2 bg-white text-black border-2 border-black rounded font-headline-sm uppercase font-bold text-xs shadow-[2px_2px_0px_#000] hover:bg-slate-100 cursor-pointer"
                  >
                    Ganti PIN
                  </button>

                  <button
                    type="button"
                    onClick={handleRemovePin}
                    className="px-4 py-2 bg-[#ffdad6] text-[#ba1a1a] border-2 border-black rounded font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] hover:bg-white cursor-pointer"
                  >
                    Nonaktifkan PIN
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {!showPinForm ? (
                  <button
                    type="button"
                    onClick={() => setShowPinForm(true)}
                    className="px-5 py-2.5 bg-[#FDE047] hover:bg-[#fae870] text-black border-[3px] border-black rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                  >
                    + Pasang PIN Pasangan Sekarang
                  </button>
                ) : (
                  <form onSubmit={handleSavePin} className="p-4 bg-surface-container-low border-2 border-black rounded-lg space-y-3">
                    <h4 className="font-headline-sm uppercase font-black text-xs">
                      Atur 4-Digit PIN Pasangan:
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-label-badge uppercase block mb-1 text-[11px] font-bold">
                          PIN Baru (4 Digit Angka)
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          required
                          placeholder="••••"
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                          className="w-full border-2 border-black rounded p-2.5 font-numeric-stat text-center text-xl font-bold tracking-widest bg-white"
                        />
                      </div>

                      <div>
                        <label className="font-label-badge uppercase block mb-1 text-[11px] font-bold">
                          Konfirmasi PIN Baru
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          required
                          placeholder="••••"
                          value={confirmPin}
                          onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                          className="w-full border-2 border-black rounded p-2.5 font-numeric-stat text-center text-xl font-bold tracking-widest bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-label-badge uppercase block mb-1 text-[11px] font-bold">
                        Kata Sandi Akun (Verifikasi Keamanan)
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Kata sandi akun kamu..."
                        value={accountPasswordForPin}
                        onChange={(e) => setAccountPasswordForPin(e.target.value)}
                        className="w-full border-2 border-black rounded p-2.5 font-body-md bg-white text-xs font-bold"
                      />
                    </div>

                    {pinError && (
                      <div className="p-2.5 bg-[#ffdad6] border border-[#ba1a1a] rounded text-xs font-bold text-[#ba1a1a]">
                        {pinError}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPinForm(false);
                          setPinError(null);
                        }}
                        className="px-4 py-2 border-2 border-black rounded font-headline-sm uppercase text-xs font-bold bg-white"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingPin}
                        className="px-5 py-2 bg-primary-container text-black border-2 border-black rounded font-headline-sm uppercase text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                      >
                        {isSavingPin ? "Mengamankan..." : "Aktifkan PIN"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
