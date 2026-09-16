"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { formatRupiahInput, parseRupiahInput } from "@/lib/currency";

interface WalletTransaction {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense";
  category_id?: string | null;
  paid_by?: string | null;
  transaction_date: string;
  created_at: string;
  description?: string | null;
}

export default function DompetPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [couple, setCouple] = useState<{ id: string; name: string } | null>(null);
  const [partner, setPartner] = useState<{ id: string; full_name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Transactions list for wallet cashflow
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal: Masukkan Gaji / Top-up Kas
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [incomeTitle, setIncomeTitle] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeCategory, setIncomeCategory] = useState("Gaji & Pemasukan");
  const [incomeDepositor, setIncomeDepositor] = useState("Saya");
  const [incomeDate, setIncomeDate] = useState(new Date().toISOString().slice(0, 10));
  const [incomeNotes, setIncomeNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myDisplayName = profile?.full_name || "Saya";
  const partnerDisplayName = partner?.full_name || "Pasangan";

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadWalletData = async () => {
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

      // Profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      const myName = prof?.full_name || user.email?.split("@")[0] || "Saya";
      setProfile({ full_name: myName });
      setIncomeDepositor(myName);

      // Couple
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
        if (cRow) setCouple(cRow);

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

        // Transactions
        const { data: txRows } = await supabase
          .from("transactions")
          .select("*")
          .eq("couple_id", activeCoupleId)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false });

        if (txRows) {
          setTransactions(
            txRows.map((t) => ({
              ...t,
              amount: Number(t.amount),
            }))
          );
        }
      }
    } catch (err) {
      console.warn("Could not load wallet data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, [router, supabase]);

  // Aggregate stats
  const totalIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const totalExpense = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const currentBalance = totalIncome - totalExpense;

  // Handle Save Income / Gaji
  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couple || !currentUser || !incomeTitle.trim() || !incomeAmount) return;

    const rawNum = parseRupiahInput(incomeAmount);
    if (rawNum <= 0) {
      alert("Masukkan nominal yang valid.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newRecord = {
        couple_id: couple.id,
        created_by: currentUser.id,
        creator_name: myDisplayName,
        title: incomeTitle.trim(),
        amount: rawNum,
        type: "income" as const,
        category_id: incomeCategory,
        paid_by: incomeDepositor,
        split_method: "shared_pool",
        transaction_date: incomeDate,
        description: incomeNotes.trim() || "Setoran kas / gaji bersama",
      };

      const { data: inserted, error } = await supabase
        .from("transactions")
        .insert(newRecord)
        .select("*")
        .single();

      if (error) throw error;

      setTransactions([
        {
          ...inserted,
          amount: Number(inserted.amount),
        },
        ...transactions,
      ]);

      showToast(`Pemasukan "${incomeTitle}" senilai Rp ${rawNum.toLocaleString("id-ID")} berhasil ditambahkan ke dompet!`);
      setShowIncomeModal(false);
      setIncomeTitle("");
      setIncomeAmount("");
      setIncomeNotes("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menambahkan uang masuk.";
      alert(`Terjadi kesalahan: ${msg}`);
    } finally {
      setIsSubmitting(false);
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
        activeNav="dompet"
        coupleName={couple?.name || `Dompet ${myDisplayName}`}
        partnerName={partner?.full_name}
        isPartnerConnected={Boolean(partner)}
      />

      {/* MAIN CONTENT */}
      <div className="pl-0 md:pl-60 pb-20 md:pb-12 min-h-screen">
        {/* TOP FIXED HEADER */}
        <header className="fixed top-0 left-0 md:left-60 right-0 h-16 bg-surface-container-lowest border-b-[3px] border-black z-40 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
            <span className="font-label-badge text-label-badge uppercase px-2.5 sm:px-3 py-1 bg-primary-container text-on-surface border-[2px] border-black shadow-[2px_2px_0px_#000] rounded-sm font-black flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
              <span className="truncate">DOMPET BERSAMA</span>
            </span>
            <span className="hidden sm:inline font-body-sm text-xs text-on-surface-variant font-bold truncate">
              • {couple?.name || "Dompet Bersama"}
            </span>
          </div>

          <button
            onClick={() => setShowIncomeModal(true)}
            className="bg-[#D4F34A] hover:bg-[#c2e439] text-black border-[3px] border-black px-3 sm:px-4 py-1.5 rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            <span className="hidden sm:inline">+ Masukkan Gaji / Top-up</span>
            <span className="sm:hidden">+ Top-up</span>
          </button>
        </header>

        {/* MAIN BODY */}
        <main className="pt-24 pb-16 px-6 sm:px-8 max-w-7xl mx-auto space-y-8">
          {/* 1. HERO BALANCE BANNER */}
          <div className="bg-surface-container-lowest border-[4px] border-black shadow-[6px_6px_0px_#000] rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                SALDO KAS BERSAMA SAAT INI
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-sm text-2xl font-bold">Rp</span>
                <span
                  className={`font-numeric-stat text-4xl sm:text-5xl font-black ${
                    currentBalance >= 0 ? "text-on-surface" : "text-[#ba1a1a]"
                  }`}
                >
                  {currentBalance.toLocaleString("id-ID")}
                </span>
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant font-bold">
                Saldo otomatis bertambah saat memasukkan gaji / top-up dan berkurang saat transaksi pengeluaran dicatat.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowIncomeModal(true)}
                className="px-5 py-3 bg-[#D4F34A] hover:bg-[#c2e439] text-black border-[3px] border-black rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                <span>+ Masukkan Gaji / Top-up</span>
              </button>

              <Link
                href="/transaksi"
                className="px-5 py-3 bg-white hover:bg-slate-100 text-black border-[3px] border-black rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">shopping_cart</span>
                <span>Catat Pengeluaran</span>
              </Link>
            </div>
          </div>

          {/* 2. CASHFLOW SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Kas Masuk */}
            <div className="bg-[#D4F34A]/20 border-[3px] border-black rounded-xl p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                    Total Kas Masuk &amp; Gaji
                  </span>
                  <div className="font-numeric-stat text-2xl sm:text-3xl font-black text-[#15803d] mt-1">
                    Rp {totalIncome.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="w-10 h-10 bg-[#D4F34A] border-2 border-black shadow-[2px_2px_0px_#000] rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl text-black">trending_up</span>
                </div>
              </div>
              <div className="pt-2 border-t border-black/15 flex items-center justify-between text-xs font-bold text-[#15803d]">
                <span>{transactions.filter((t) => t.type === "income").length} setoran / gaji masuk</span>
                <span className="font-headline-sm uppercase font-black">MASUK &uarr;</span>
              </div>
            </div>

            {/* Total Kas Keluar */}
            <div className="bg-secondary-container/30 border-[3px] border-black rounded-xl p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                    Total Pengeluaran Bersama
                  </span>
                  <div className="font-numeric-stat text-2xl sm:text-3xl font-black text-secondary mt-1">
                    Rp {totalExpense.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="w-10 h-10 bg-secondary-container border-2 border-black shadow-[2px_2px_0px_#000] rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl text-black">shopping_cart</span>
                </div>
              </div>
              <div className="pt-2 border-t border-black/15 flex items-center justify-between text-xs font-bold text-secondary">
                <span>{transactions.filter((t) => t.type === "expense").length} transaksi belanja terpotong</span>
                <span className="font-headline-sm uppercase font-black">KELUAR &darr;</span>
              </div>
            </div>

            {/* Status Kas Bersama */}
            <div className="bg-[#38BDF8]/20 border-[3px] border-black rounded-xl p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                    Status Kesehatan Kas
                  </span>
                  <div className="font-headline-sm text-2xl sm:text-3xl font-black text-[#0369a1] mt-1 uppercase">
                    {currentBalance > 0 ? "Surplus Aman" : currentBalance === 0 ? "Seimbang" : "Defisit"}
                  </div>
                </div>
                <div className="w-10 h-10 bg-[#38BDF8] border-2 border-black shadow-[2px_2px_0px_#000] rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl text-black">verified</span>
                </div>
              </div>
              <div className="pt-2 border-t border-black/15 flex items-center justify-between text-xs font-bold text-[#0369a1]">
                <span>Arus kas: {currentBalance >= 0 ? "Sehat terkendali" : "Perlu setor kas"}</span>
                <span className="font-headline-sm uppercase font-black">
                  {currentBalance >= 0 ? "NORMAL" : "PERHATIAN"}
                </span>
              </div>
            </div>
          </div>

          {/* 3. MUTASI TRANSAKSI DOMPET BERSAMA */}
          <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl shadow-[6px_6px_0px_#000] overflow-hidden">
            <div className="p-4 border-b-[3px] border-black bg-surface-container-low flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl">receipt_long</span>
                <h2 className="font-headline-sm uppercase font-black text-sm">
                  Riwayat Mutasi Dompet Bersama ({transactions.length})
                </h2>
              </div>
              <span className="font-body-sm text-xs text-on-surface-variant font-bold">
                Mencatat semua uang masuk (+ gaji/top-up) dan uang keluar (- pengeluaran)
              </span>
            </div>

            {isLoading ? (
              <div className="p-12 text-center font-headline-sm uppercase font-bold animate-pulse">
                Memuat data mutasi dompet...
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary-container border-2 border-black mx-auto flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                </div>
                <div className="font-headline-sm uppercase font-black text-base">
                  Belum Ada Mutasi di Dompet Bersama
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant max-w-sm mx-auto font-semibold">
                  Mulai masukkan setoran gaji atau catat pengeluaran bersama pertama kalian.
                </p>
                <button
                  type="button"
                  onClick={() => setShowIncomeModal(true)}
                  className="mt-2 bg-[#D4F34A] text-black border-2 border-black px-4 py-2 rounded font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] hover:bg-[#c2e439] cursor-pointer"
                >
                  + Masukkan Uang Kas Pertama
                </button>
              </div>
            ) : (
              <div className="divide-y-2 border-b-2 border-black">
                {transactions.map((tx) => {
                  const isIncome = tx.type === "income";
                  return (
                    <div
                      key={tx.id}
                      className="p-4 sm:p-5 hover:bg-surface-container-low/30 transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-lg border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000] ${
                            isIncome ? "bg-[#D4F34A]" : "bg-secondary-container"
                          }`}
                        >
                          <span className="material-symbols-outlined text-2xl">
                            {isIncome ? "trending_up" : "shopping_cart"}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-headline-sm text-sm sm:text-base uppercase font-black truncate">
                              {tx.title}
                            </h4>
                            <span
                              className={`font-label-badge text-[10px] uppercase font-black px-1.5 py-0.5 border border-black rounded ${
                                isIncome ? "bg-[#D4F34A]" : "bg-white"
                              }`}
                            >
                              {isIncome ? "Kas Masuk / Gaji" : "Pengeluaran"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-on-surface-variant font-bold mt-1 flex-wrap">
                            <span>{isIncome ? "Disetor oleh:" : "Dibayar oleh:"} <strong>{tx.paid_by || "Saya"}</strong></span>
                            <span>•</span>
                            <span>{tx.transaction_date}</span>
                            {tx.description && (
                              <>
                                <span>•</span>
                                <span className="italic">{tx.description}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`font-numeric-stat text-lg sm:text-xl font-black ${
                            isIncome ? "text-[#15803d]" : "text-[#ba1a1a]"
                          }`}
                        >
                          {isIncome ? "+" : "-"} Rp {tx.amount.toLocaleString("id-ID")}
                        </div>
                        <span className="font-label-badge text-[10px] uppercase font-bold text-on-surface-variant">
                          {tx.category_id || (isIncome ? "Setoran Kas" : "Belanja")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* MODAL: MASUKKAN GAJI / TOP-UP KAS BERSAMA */}
      {showIncomeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border-[4px] border-black shadow-[8px_8px_0px_#000000] rounded-xl p-6 sm:p-8 max-w-md w-full relative">
            <button
              onClick={() => setShowIncomeModal(false)}
              className="absolute top-4 right-4 w-8 h-8 border-2 border-black rounded bg-[#FDE047] flex items-center justify-center font-bold text-sm shadow-[2px_2px_0px_#000] hover:bg-white cursor-pointer"
            >
              ✕
            </button>

            <div className="border-b-[3px] border-black pb-3 mb-4">
              <h3 className="font-headline-md uppercase font-black text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-[#15803d]">payments</span>
                <span>Masukkan Gaji / Top-Up Kas</span>
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant font-bold">
                Tambah saldo kas dompet bersama kalian berdua
              </p>
            </div>

            <form onSubmit={handleSaveIncome} className="space-y-4">
              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Nama Sumber / Keterangan
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gaji Bulan Ini, Top-up Kas Kencan"
                  value={incomeTitle}
                  onChange={(e) => setIncomeTitle(e.target.value)}
                  className="w-full border-[3px] border-black rounded p-3 font-body-md font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                />
              </div>

              {/* NOMINAL WITH AUTO-RUPIAH FORMATTING (TITIK OTOMATIS) */}
              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Nominal Setoran (Rp) • <span className="text-primary lowercase font-normal">titik otomatis</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-headline-sm font-bold text-lg text-on-surface-variant">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0"
                    value={incomeAmount}
                    onChange={(e) => setIncomeAmount(formatRupiahInput(e.target.value))}
                    className="w-full pl-12 pr-4 py-3 border-[3px] border-black rounded font-numeric-stat text-2xl font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                    Kategori Pemasukan
                  </label>
                  <select
                    value={incomeCategory}
                    onChange={(e) => setIncomeCategory(e.target.value)}
                    className="w-full border-[3px] border-black rounded p-2.5 font-body-md font-bold bg-white cursor-pointer"
                  >
                    <option>Gaji & Pemasukan</option>
                    <option>Top-up Kas Bersama</option>
                    <option>Bonus & Hadiah</option>
                    <option>Pemasukan Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                    Disetor Oleh
                  </label>
                  <select
                    value={incomeDepositor}
                    onChange={(e) => setIncomeDepositor(e.target.value)}
                    className="w-full border-[3px] border-black rounded p-2.5 font-body-md font-bold bg-white cursor-pointer"
                  >
                    <option value={myDisplayName}>{myDisplayName} (Saya)</option>
                    <option value={partnerDisplayName}>{partnerDisplayName} (Pasangan)</option>
                    <option value="Keduanya">Keduanya (Patungan)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Tanggal Setor
                </label>
                <input
                  type="date"
                  required
                  value={incomeDate}
                  onChange={(e) => setIncomeDate(e.target.value)}
                  className="w-full border-[3px] border-black rounded p-2.5 font-body-md font-bold bg-white"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowIncomeModal(false)}
                  className="flex-1 py-3 bg-surface-container border-[3px] border-black rounded font-headline-sm uppercase font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-2 py-3 bg-[#D4F34A] hover:bg-[#c2e439] text-black border-[3px] border-black rounded font-headline-sm uppercase font-black text-sm shadow-[4px_4px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "+ Tambah ke Dompet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
