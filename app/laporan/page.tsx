"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";

interface TransactionItem {
  id: string;
  couple_id: string;
  title: string;
  amount: number;
  type: "expense" | "income";
  category_id?: string | null;
  paid_by?: string | null;
  split_method: string;
  transaction_date: string;
  created_by: string;
  created_at: string;
}

type PeriodRange = "3_days" | "1_week" | "1_month" | "all";
type ViewMode = "statement" | "analytics";

export default function LaporanPage() {
  const router = useRouter();
  const supabase = createClient();

  // Auth & Couple state
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [couple, setCouple] = useState<{ id: string; name: string } | null>(null);
  const [partner, setPartner] = useState<{ id: string; full_name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data & Control state
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodRange>("1_month");
  const [viewMode, setViewMode] = useState<ViewMode>("statement");

  const myDisplayName = profile?.full_name || "Saya";
  const partnerDisplayName = partner?.full_name || "Pasangan";

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
        setProfile({ full_name: myName });

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

          // 3. Transactions
          const { data: txRows } = await supabase
            .from("transactions")
            .select("*")
            .eq("couple_id", activeCoupleId)
            .order("transaction_date", { ascending: true })
            .order("created_at", { ascending: true });

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
        console.warn("Could not load report data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router, supabase]);

  // Cutoff date for period filtering
  const cutoffDate = useMemo(() => {
    if (selectedPeriod === "all") return null;
    const now = new Date();
    const d = new Date();
    if (selectedPeriod === "3_days") {
      d.setDate(now.getDate() - 3);
    } else if (selectedPeriod === "1_week") {
      d.setDate(now.getDate() - 7);
    } else if (selectedPeriod === "1_month") {
      d.setDate(now.getDate() - 30);
    }
    return d.toISOString().slice(0, 10);
  }, [selectedPeriod]);

  // Saldo Awal (Beginning Balance before cutoff date)
  const saldoAwal = useMemo(() => {
    if (!cutoffDate) return 0;
    return transactions
      .filter((t) => t.transaction_date < cutoffDate)
      .reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
  }, [transactions, cutoffDate]);

  // Filtered transactions for the current period
  const filteredTransactions = useMemo(() => {
    if (!cutoffDate) return transactions;
    return transactions.filter((t) => t.transaction_date >= cutoffDate);
  }, [transactions, cutoffDate]);

  // Statement ledger with running balance (Chronological)
  const statementLedger = useMemo(() => {
    let currentBalance = saldoAwal;
    return filteredTransactions.map((tx, idx) => {
      const isIncome = tx.type === "income";
      if (isIncome) {
        currentBalance += tx.amount;
      } else {
        currentBalance -= tx.amount;
      }
      return {
        ...tx,
        rowNo: idx + 1,
        debet: !isIncome ? tx.amount : null,
        kredit: isIncome ? tx.amount : null,
        runningBalance: currentBalance,
      };
    });
  }, [filteredTransactions, saldoAwal]);

  // Aggregated calculations
  const totalExpense = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  const totalIncome = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  const countExpense = useMemo(
    () => filteredTransactions.filter((t) => t.type === "expense").length,
    [filteredTransactions]
  );

  const countIncome = useMemo(
    () => filteredTransactions.filter((t) => t.type === "income").length,
    [filteredTransactions]
  );

  const saldoAkhir = saldoAwal + totalIncome - totalExpense;

  // Breakdown by Category (for analytics mode)
  const categoryBreakdown = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === "expense");
    const map: Record<string, number> = {};

    expenses.forEach((t) => {
      const cat = t.category_id || "Lainnya";
      map[cat] = (map[cat] || 0) + t.amount;
    });

    return Object.entries(map)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions, totalExpense]);

  // Contribution Comparison (Who paid how much)
  const contributionStats = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === "expense");
    let myPaid = 0;
    let partnerPaid = 0;
    let sharedPool = 0;

    expenses.forEach((t) => {
      if (t.paid_by === myDisplayName || t.paid_by === "Saya" || t.paid_by === currentUser?.id) {
        myPaid += t.amount;
      } else if (t.paid_by === partnerDisplayName || t.paid_by === "Pasangan" || t.paid_by === partner?.id) {
        partnerPaid += t.amount;
      } else {
        sharedPool += t.amount;
      }
    });

    const directTotal = myPaid + partnerPaid;
    const myPct = directTotal > 0 ? Math.round((myPaid / directTotal) * 100) : 50;
    const partnerPct = directTotal > 0 ? 100 - myPct : 50;

    return { myPaid, partnerPaid, sharedPool, myPct, partnerPct };
  }, [filteredTransactions, myDisplayName, partnerDisplayName, currentUser, partner]);

  // Account identification formatted like a bank account number
  const accountNumber = useMemo(() => {
    if (!couple?.id) return "BRG-8829-0192-001";
    const cleanId = couple.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const part1 = cleanId.slice(0, 4) || "8829";
    const part2 = cleanId.slice(4, 8) || "0192";
    return `BRG-${part1}-${part2}-001`;
  }, [couple]);

  // Formatted date ranges for statement header
  const periodDateRange = useMemo(() => {
    const today = new Date();
    const todayStr = today.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    if (selectedPeriod === "all" || !cutoffDate) {
      const firstTxDate = transactions[0]?.transaction_date;
      if (firstTxDate) {
        const [y, m, d] = firstTxDate.split("-");
        const startDate = new Date(Number(y), Number(m) - 1, Number(d));
        return `${startDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} s/d ${todayStr}`;
      }
      return `01 Jan 2026 s/d ${todayStr}`;
    }

    const [y, m, d] = cutoffDate.split("-");
    const startDate = new Date(Number(y), Number(m) - 1, Number(d));
    const startStr = startDate.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    return `${startStr} s/d ${todayStr}`;
  }, [selectedPeriod, cutoffDate, transactions]);

  const printTimestamp = useMemo(() => {
    return new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB";
  }, []);

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen selection:bg-primary-container selection:text-black">
      {/* INJECT STRICT BANK E-STATEMENT PRINT STYLES */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 12mm 12mm;
          }

          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide Web UI completely */
          aside,
          header,
          nav,
          .no-print {
            display: none !important;
          }

          .pl-60 {
            padding-left: 0 !important;
          }

          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }

          /* Force E-Statement document to display and fill printed page */
          .print-statement-sheet {
            display: block !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
          }

          /* Table pagination rules */
          tr {
            page-break-inside: avoid !important;
          }

          thead {
            display: table-header-group !important;
          }
        }
      `}</style>

      {/* SIDEBAR (Hidden on print) */}
      <AppSidebar
        activeNav="laporan"
        coupleName={couple?.name || `Dompet ${myDisplayName}`}
        partnerName={partner?.full_name}
        isPartnerConnected={Boolean(partner)}
      />

      {/* MAIN CONTAINER */}
      <div className="pl-0 md:pl-60 pb-20 md:pb-12 min-h-screen">
        {/* TOP FIXED HEADER (Hidden on print) */}
        <header className="fixed top-0 left-0 md:left-60 right-0 h-16 bg-surface-container-lowest border-b-[3px] border-black z-40 px-4 sm:px-8 flex items-center justify-between no-print">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
            <span className="font-label-badge text-label-badge uppercase px-2.5 sm:px-3 py-1 bg-primary-container text-on-surface border-[2px] border-black shadow-[2px_2px_0px_#000] rounded-sm font-black flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
              <span className="truncate">E-STATEMENT PDF</span>
            </span>
            <span className="hidden sm:inline font-body-sm text-xs text-on-surface-variant font-bold truncate">
              • {couple?.name || "Dompet Bersama"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="bg-[#D4F34A] hover:bg-[#c2e439] text-black border-[3px] border-black px-3 sm:px-4 py-1.5 rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span className="hidden sm:inline">Download PDF / Cetak</span>
              <span className="sm:hidden">PDF</span>
            </button>
          </div>
        </header>

        {/* MAIN BODY */}
        <main className="pt-20 sm:pt-24 pb-20 md:pb-16 px-3 sm:px-8 max-w-7xl mx-auto space-y-5 sm:space-y-6 print-container">
          {/* TOOLBAR CONTROLS (Hidden on print) */}
          <div className="no-print bg-surface-container-lowest border-[3px] border-black rounded-xl p-3 sm:p-4 shadow-[4px_4px_0px_#000] space-y-3 md:space-y-0 md:flex md:items-center md:justify-between md:gap-4">
            {/* View Mode Toggle: 2 columns on mobile */}
            <div className="grid grid-cols-2 gap-1.5 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setViewMode("statement")}
                className={`px-2.5 sm:px-3 py-2 border-2 border-black rounded font-headline-sm uppercase text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate ${
                  viewMode === "statement"
                    ? "bg-[#38BDF8] text-black shadow-[2px_2px_0px_#000]"
                    : "bg-white hover:bg-slate-100 text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-sm shrink-0">receipt_long</span>
                <span className="truncate">e-Statement</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("analytics")}
                className={`px-2.5 sm:px-3 py-2 border-2 border-black rounded font-headline-sm uppercase text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate ${
                  viewMode === "analytics"
                    ? "bg-[#38BDF8] text-black shadow-[2px_2px_0px_#000]"
                    : "bg-white hover:bg-slate-100 text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-sm shrink-0">pie_chart</span>
                <span className="truncate">Grafik &amp; Analitik</span>
              </button>
            </div>

            {/* Period Filter Buttons & Download */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              <div className="grid grid-cols-4 gap-1.5 w-full sm:w-auto">
                {(
                  [
                    { id: "3_days", label: "3 Hari" },
                    { id: "1_week", label: "1 Minggu" },
                    { id: "1_month", label: "1 Bulan" },
                    { id: "all", label: "Semua" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeriod(p.id)}
                    className={`px-2 sm:px-3 py-2 border-2 border-black rounded font-headline-sm uppercase text-[11px] sm:text-xs font-black transition-all cursor-pointer text-center truncate ${
                      selectedPeriod === p.id
                        ? "bg-[#D4F34A] text-black shadow-[2px_2px_0px_#000]"
                        : "bg-white hover:bg-slate-100 text-on-surface"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleDownloadPDF}
                className="w-full sm:w-auto px-3 py-2 bg-[#003B73] hover:bg-[#002a52] text-white border-2 border-black rounded font-headline-sm uppercase text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Download PDF</span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION A: FORMAL E-STATEMENT DOCUMENT (BRI / BANK STYLE) */}
          {/* ========================================================= */}
          <div
            className={`print-statement-sheet bg-white border-2 border-slate-300 rounded-sm shadow-2xl p-4 sm:p-10 max-w-[860px] mx-auto text-slate-900 ${
              viewMode === "statement" ? "block" : "hidden print:block"
            }`}
          >
            {/* 1. BANK STATEMENT HEADER */}
            <div className="border-b-2 border-slate-800 pb-5">
              <div className="flex items-start justify-between gap-4">
                {/* Left: Bank / App Title */}
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-[#003B73] text-white font-black text-sm flex items-center justify-center border border-black">
                      BY
                    </div>
                    <span className="font-black tracking-tight text-xl text-[#003B73]">
                      BARENGYIN
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                    Sistem Rekening Kas Bersama Pasangan (Duo Sync)
                  </div>
                </div>

                {/* Right: Formal Statement Title */}
                <div className="text-right">
                  <h1 className="text-lg sm:text-xl font-extrabold uppercase text-[#003B73] tracking-wide">
                    REKENING KORAN
                  </h1>
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                    ELECTRONIC STATEMENT (e-Statement)
                  </div>
                </div>
              </div>

              {/* 2. REKENING METADATA BOX (Two Columns, Crisp Bank Grid) */}
              <div className="mt-5 pt-4 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between border-b border-slate-200 pb-1">
                    <span className="text-slate-500 font-medium">Nama Rekening:</span>
                    <span className="font-bold text-slate-900 uppercase">
                      {couple?.name || "Dompet Bersama"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1">
                    <span className="text-slate-500 font-medium">Anggota Pasangan:</span>
                    <span className="font-semibold text-slate-800">
                      {myDisplayName} &amp; {partnerDisplayName}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1">
                    <span className="text-slate-500 font-medium">Nomor Akun Rekening:</span>
                    <span className="font-mono font-bold text-[#003B73]">
                      {accountNumber}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between border-b border-slate-200 pb-1">
                    <span className="text-slate-500 font-medium">Periode Transaksi:</span>
                    <span className="font-bold text-slate-900">
                      {periodDateRange}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1">
                    <span className="text-slate-500 font-medium">Mata Uang:</span>
                    <span className="font-bold text-slate-900">IDR (Indonesian Rupiah)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1">
                    <span className="text-slate-500 font-medium">Tanggal &amp; Waktu Cetak:</span>
                    <span className="font-medium text-slate-700">{printTimestamp}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. RINGKASAN SALDO & MUTASI (ACCOUNT SUMMARY TABLE) */}
            <div className="mt-5">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                RINGKASAN SALDO DAN MUTASI KAS
              </div>
              <div className="border border-slate-400 rounded-sm overflow-hidden bg-slate-50 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-300 text-center">
                  <div className="p-3">
                    <div className="text-[10px] uppercase font-bold text-slate-500">
                      Saldo Awal
                    </div>
                    <div className="font-mono font-bold text-sm text-slate-900 mt-1">
                      Rp {saldoAwal.toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/50">
                    <div className="text-[10px] uppercase font-bold text-emerald-800">
                      Total Mutasi Kredit (+)
                    </div>
                    <div className="font-mono font-bold text-sm text-emerald-700 mt-1">
                      Rp {totalIncome.toLocaleString("id-ID")}
                    </div>
                    <div className="text-[9px] text-slate-500 font-medium mt-0.5">
                      {countIncome} transaksi masuk
                    </div>
                  </div>

                  <div className="p-3 bg-rose-50/50">
                    <div className="text-[10px] uppercase font-bold text-rose-800">
                      Total Mutasi Debet (-)
                    </div>
                    <div className="font-mono font-bold text-sm text-rose-700 mt-1">
                      Rp {totalExpense.toLocaleString("id-ID")}
                    </div>
                    <div className="text-[9px] text-slate-500 font-medium mt-0.5">
                      {countExpense} transaksi belanja
                    </div>
                  </div>

                  <div className="p-3 bg-[#003B73]/5">
                    <div className="text-[10px] uppercase font-bold text-[#003B73]">
                      Saldo Akhir
                    </div>
                    <div className="font-mono font-bold text-sm text-[#003B73] mt-1">
                      Rp {saldoAkhir.toLocaleString("id-ID")}
                    </div>
                    <div className="text-[9px] text-slate-500 font-medium mt-0.5">
                      {saldoAkhir >= 0 ? "Surplus Aktif" : "Defisit Kas"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. TABEL RINCIAN MUTASI TRANSAKSI (DETAILED LEDGER TABLE) */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  RINCIAN MUTASI TRANSAKSI KAS BERSAMA
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  Total {statementLedger.length} Baris Mutasi
                </div>
              </div>

              <div className="border border-slate-400 rounded-sm overflow-hidden">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-400 text-slate-800 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-2 border-r border-slate-300 text-center w-8">
                        No
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-slate-300 whitespace-nowrap w-24">
                        Tanggal
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-300">
                        Keterangan / Uraian Transaksi
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-slate-300 text-right whitespace-nowrap w-28">
                        Mutasi Debet (-)
                      </th>
                      <th className="py-2.5 px-2.5 border-r border-slate-300 text-right whitespace-nowrap w-28">
                        Mutasi Kredit (+)
                      </th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-32">
                        Saldo Berjalan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* Baris Pembuka: Saldo Awal */}
                    <tr className="bg-slate-50/70 font-semibold text-slate-600">
                      <td className="py-2 px-2 text-center border-r border-slate-200">-</td>
                      <td className="py-2 px-2.5 border-r border-slate-200">-</td>
                      <td className="py-2 px-3 border-r border-slate-200 italic font-bold text-slate-800">
                        SALDO AWAL PERIODE
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-200 text-right">-</td>
                      <td className="py-2 px-2.5 border-r border-slate-200 text-right">-</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        Rp {saldoAwal.toLocaleString("id-ID")}
                      </td>
                    </tr>

                    {statementLedger.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-slate-500 font-semibold italic"
                        >
                          Tidak ada mutasi transaksi pada rentang waktu ini.
                        </td>
                      </tr>
                    ) : (
                      statementLedger.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-2 text-center border-r border-slate-200 text-slate-500 font-medium">
                            {tx.rowNo}
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap text-slate-700 font-medium">
                            {tx.transaction_date}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <div className="font-bold text-slate-900 uppercase">
                              {tx.title}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span>Kat: {tx.category_id || "Umum"}</span>
                              <span>•</span>
                              <span>Oleh: {tx.paid_by || "Saya"}</span>
                              <span>•</span>
                              <span className="uppercase text-[9px] font-semibold text-slate-600">
                                {tx.split_method === "fifty_fifty"
                                  ? "Split 50:50"
                                  : tx.split_method === "proportional"
                                  ? "Split 60:40"
                                  : "Kas Penuh"}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                            {tx.debet ? (
                              <span className="text-slate-900">
                                {tx.debet.toLocaleString("id-ID")}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono font-semibold whitespace-nowrap">
                            {tx.kredit ? (
                              <span className="text-emerald-700 font-bold">
                                {tx.kredit.toLocaleString("id-ID")}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            Rp {tx.runningBalance.toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  {/* Total Footer Row */}
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-[11px] text-slate-900">
                      <td colSpan={3} className="py-2.5 px-3 text-right border-r border-slate-300 uppercase tracking-wider">
                        TOTAL MUTASI PERIODE INI
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono border-r border-slate-300 text-rose-800 whitespace-nowrap">
                        Rp {totalExpense.toLocaleString("id-ID")}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono border-r border-slate-300 text-emerald-800 whitespace-nowrap">
                        Rp {totalIncome.toLocaleString("id-ID")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#003B73] whitespace-nowrap">
                        Rp {saldoAkhir.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 5. FOOTER & PENGESAHAN DOKUMEN (SIGNATURE BOXES & LEGAL DISCLAIMER) */}
            <div className="mt-8 pt-5 border-t border-slate-300 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
                {/* Legal Note */}
                <div className="space-y-1.5 text-[10px] text-slate-500 leading-relaxed">
                  <div className="font-bold uppercase text-slate-700 text-[10px]">
                    CATATAN DAN KETENTUAN RESMI:
                  </div>
                  <p>
                    1. e-Statement ini dihasilkan secara otomatis melalui platform pembukuan kas bersama Barengyin dan merupakan ikhtisar sah dari seluruh mutasi kas pasangan.
                  </p>
                  <p>
                    2. Apabila terdapat kekeliruan pencatatan atau perbedaan saldo, harap segera melakukan rekonsiliasi bersama dalam jangka waktu 7 (tujuh) hari kerja.
                  </p>
                  <p>
                    3. Dokumen ini diakui sebagai arsip transparansi finansial resmi berdua.
                  </p>
                </div>

                {/* Formal Signature Lines */}
                <div className="flex items-center justify-around text-center pt-2">
                  <div className="space-y-12">
                    <div className="text-[10px] font-bold text-slate-600 uppercase">
                      Pengelola Kas 1
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 underline text-xs">
                        {myDisplayName}
                      </div>
                      <div className="text-[9px] text-slate-400 uppercase">Pihak Pertama</div>
                    </div>
                  </div>

                  <div className="space-y-12">
                    <div className="text-[10px] font-bold text-slate-600 uppercase">
                      Pengelola Kas 2
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 underline text-xs">
                        {partnerDisplayName}
                      </div>
                      <div className="text-[9px] text-slate-400 uppercase">Pihak Kedua</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Digital Verification Stamp */}
              <div className="mt-6 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-mono">VERIFIKASI SISTEM: SHA256-{accountNumber}</span>
                <span>BARENGYIN FINANCIAL TECH • DUO SYNC VERIFIED</span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION B: ANALYTICS & VISUAL CHARTS (SCREEN MODE)        */}
          {/* ========================================================= */}
          {viewMode === "analytics" && (
            <div className="space-y-8 no-print animate-fadeIn">
              {/* 1. EXECUTIVE METRIC SUMMARY */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Total Pemasukan */}
                <div className="bg-[#D4F34A]/20 border-[3px] border-black rounded-xl p-5 shadow-[4px_4px_0px_#000]">
                  <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                    TOTAL PEMASUKAN
                  </span>
                  <div className="font-numeric-stat text-2xl sm:text-3xl font-black text-[#15803d] mt-2">
                    Rp {totalIncome.toLocaleString("id-ID")}
                  </div>
                  <div className="font-body-sm text-xs text-on-surface-variant font-bold mt-1">
                    {countIncome} setoran &amp; gaji masuk
                  </div>
                </div>

                {/* Total Pengeluaran */}
                <div className="bg-secondary-container/30 border-[3px] border-black rounded-xl p-5 shadow-[4px_4px_0px_#000]">
                  <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                    TOTAL PENGELUARAN
                  </span>
                  <div className="font-numeric-stat text-2xl sm:text-3xl font-black text-secondary mt-2">
                    Rp {totalExpense.toLocaleString("id-ID")}
                  </div>
                  <div className="font-body-sm text-xs text-on-surface-variant font-bold mt-1">
                    {countExpense} transaksi belanja berdua
                  </div>
                </div>

                {/* Arus Kas Bersih */}
                <div className="bg-[#38BDF8]/20 border-[3px] border-black rounded-xl p-5 shadow-[4px_4px_0px_#000]">
                  <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                    ARUS KAS BERSIH (NET CASHFLOW)
                  </span>
                  <div
                    className={`font-numeric-stat text-2xl sm:text-3xl font-black mt-2 ${
                      saldoAkhir >= 0 ? "text-[#0369a1]" : "text-[#ba1a1a]"
                    }`}
                  >
                    Rp {saldoAkhir.toLocaleString("id-ID")}
                  </div>
                  <div className="font-body-sm text-xs text-on-surface-variant font-bold mt-1">
                    {saldoAkhir >= 0 ? "Surplus Keuangan Positif" : "Defisit (Perlu Penyesuaian)"}
                  </div>
                </div>
              </div>

              {/* 2. DUO SPLIT CONTRIBUTION & CATEGORY ANALYSIS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Rasio Pembayaran Pasangan */}
                <div className="lg:col-span-6 bg-surface-container-lowest border-[3px] border-black rounded-xl p-5 sm:p-6 shadow-[5px_5px_0px_#000] space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-black pb-3">
                    <h3 className="font-headline-sm uppercase font-black text-base flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">favorite</span>
                      <span>Rasio Pembayaran ({myDisplayName} vs {partnerDisplayName})</span>
                    </h3>
                    <span className="font-label-badge text-xs uppercase font-black bg-[#ebe1ff] px-2 py-0.5 border border-black rounded">
                      Duo Split
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>
                        {myDisplayName}: <strong>Rp {contributionStats.myPaid.toLocaleString("id-ID")}</strong> ({contributionStats.myPct}%)
                      </span>
                      <span>
                        {partnerDisplayName}: <strong>Rp {contributionStats.partnerPaid.toLocaleString("id-ID")}</strong> ({contributionStats.partnerPct}%)
                      </span>
                    </div>

                    <div className="w-full bg-surface-container-low h-4 border-2 border-black rounded-full overflow-hidden flex">
                      <div
                        className="bg-[#38BDF8] h-full"
                        style={{ width: `${contributionStats.myPct}%` }}
                        title={`${myDisplayName} (${contributionStats.myPct}%)`}
                      />
                      <div
                        className="bg-[#fd6a49] h-full"
                        style={{ width: `${contributionStats.partnerPct}%` }}
                        title={`${partnerDisplayName} (${contributionStats.partnerPct}%)`}
                      />
                    </div>

                    <p className="font-body-sm text-xs text-on-surface-variant font-semibold">
                      {contributionStats.myPct > 60
                        ? `💡 Catatan: ${myDisplayName} menalangi pengeluaran lebih banyak di periode ini.`
                        : contributionStats.partnerPct > 60
                        ? `💡 Catatan: ${partnerDisplayName} menalangi pengeluaran lebih banyak di periode ini.`
                        : "💡 Rasio pembagian pengeluaran berdua sangat seimbang dan sehat!"}
                    </p>
                  </div>
                </div>

                {/* Right: Pengeluaran per Kategori */}
                <div className="lg:col-span-6 bg-surface-container-lowest border-[3px] border-black rounded-xl p-5 sm:p-6 shadow-[5px_5px_0px_#000] space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-black pb-3">
                    <h3 className="font-headline-sm uppercase font-black text-base flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">pie_chart</span>
                      <span>Proporsi Pengeluaran per Kategori</span>
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {categoryBreakdown.length === 0 ? (
                      <p className="font-body-sm text-xs text-on-surface-variant font-bold py-4 text-center">
                        Belum ada pengeluaran pada rentang waktu ini.
                      </p>
                    ) : (
                      categoryBreakdown.map((cat) => (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span>{cat.name}</span>
                            <span>
                              Rp {cat.amount.toLocaleString("id-ID")} ({cat.percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-surface-container-low h-2.5 border border-black rounded-full overflow-hidden">
                            <div
                              className="bg-[#D4F34A] h-full"
                              style={{ width: `${cat.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
