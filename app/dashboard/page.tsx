"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";

interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: "expense" | "income";
  category: string;
  categoryIcon: string;
  categoryBg: string;
  paidBy: string;
  paidByBg: string;
  splitInfo: string;
  date: string;
  creatorName?: string | null;
}

interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  colorHex: string;
  spent: number;
  limit: number;
}

interface SavingsGoalSummary {
  id: string;
  name: string;
  icon: string;
  target_amount: number;
  current_amount: number;
}

const DEFAULT_BUDGETS: BudgetCategory[] = [
  {
    id: "b-1",
    name: "Makan & Kencan",
    icon: "restaurant",
    colorHex: "bg-secondary-container",
    spent: 3200000,
    limit: 4000000,
  },
  {
    id: "b-2",
    name: "Groceries & Rumah",
    icon: "shopping_bag",
    colorHex: "bg-primary-container",
    spent: 2450000,
    limit: 3500000,
  },
  {
    id: "b-3",
    name: "Transportasi",
    icon: "directions_car",
    colorHex: "bg-[#FDE047]",
    spent: 1100000,
    limit: 1500000,
  },
  {
    id: "b-4",
    name: "Hiburan & Nonton",
    icon: "live_tv",
    colorHex: "bg-tertiary-container",
    spent: 850000,
    limit: 1000000,
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  // User & Couple state
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url?: string } | null>(null);
  const [couple, setCouple] = useState<{ id: string; name: string; wallet_mode: string } | null>(null);
  const [partner, setPartner] = useState<{ id: string; full_name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Live data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetCategory[]>(DEFAULT_BUDGETS);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalSummary[]>([]);

  const myDisplayName = profile?.full_name || "Saya";
  const partnerDisplayName = partner?.full_name || "Pasangan";

  useEffect(() => {
    async function loadDashboardData() {
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

        // 2. Couple & Partner
        const { data: members } = await supabase
          .from("couple_members")
          .select("couple_id")
          .eq("profile_id", user.id)
          .limit(1);

        const activeCoupleId = members?.[0]?.couple_id;
        if (activeCoupleId) {
          const { data: cRow } = await supabase
            .from("couples")
            .select("*")
            .eq("id", activeCoupleId)
            .maybeSingle();

          if (cRow) setCouple(cRow);

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
            .order("transaction_date", { ascending: false });

          if (txRows && txRows.length > 0) {
            const mapped: Transaction[] = txRows.map((t) => ({
              id: t.id,
              title: t.title,
              amount: Number(t.amount),
              type: t.type as "expense" | "income",
              category: (t.category_id || "UMUM").toUpperCase(),
              categoryIcon:
                t.type === "income"
                  ? "payments"
                  : t.category_id === "Transportasi"
                  ? "directions_car"
                  : t.category_id === "Groceries & Rumah"
                  ? "shopping_bag"
                  : "restaurant",
              categoryBg:
                t.type === "income"
                  ? "bg-primary-container"
                  : "bg-secondary-container",
              paidBy: t.paid_by || (t.created_by === user.id ? myName : "Pasangan"),
              paidByBg:
                t.paid_by === myName || t.created_by === user.id
                  ? "bg-[#38BDF8]"
                  : "bg-secondary-fixed",
              splitInfo:
                t.split_method === "fifty_fifty"
                  ? "Split: 50:50"
                  : t.split_method === "proportional"
                  ? "Split: 60:40"
                  : "Ditanggung Penuh",
              date: t.transaction_date || "Hari ini",
              creatorName: t.creator_name || myName,
            }));

            setTransactions(mapped);

            // Load budgets from persistent storage
            const storageKey = `barengyin_budgets_${activeCoupleId || "default"}`;
            const savedBudgets = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
            let currentBudgets: BudgetCategory[] = DEFAULT_BUDGETS;
            if (savedBudgets) {
              try {
                currentBudgets = JSON.parse(savedBudgets);
              } catch {
                currentBudgets = DEFAULT_BUDGETS;
              }
            }

            // Update budget spent dynamically from real transactions
            const updatedBudgets = currentBudgets.map((b) => {
              const matchSpent = mapped
                .filter((t) => t.type === "expense" && t.category.toLowerCase() === b.name.toLowerCase())
                .reduce((sum, t) => sum + t.amount, 0);
              return {
                ...b,
                spent: matchSpent,
              };
            });

            setBudgets(updatedBudgets);
          }

          // 4. Savings Goals
          const { data: goalRows } = await supabase
            .from("savings_goals")
            .select("id, name, icon, target_amount, current_amount")
            .eq("couple_id", activeCoupleId);

          if (goalRows && goalRows.length > 0) {
            setSavingsGoals(
              goalRows.map((g) => ({
                id: g.id,
                name: g.name,
                icon: g.icon || "savings",
                target_amount: Number(g.target_amount),
                current_amount: Number(g.current_amount),
              }))
            );
          } else {
            setSavingsGoals([]);
          }
        }
      } catch (err) {
        console.warn("Could not load dashboard:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, [router, supabase]);

  // Aggregate stats
  const totalExpense = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const totalIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const remainingBalance = totalIncome - totalExpense;

  const totalSavings = useMemo(
    () => savingsGoals.reduce((sum, g) => sum + g.current_amount, 0),
    [savingsGoals]
  );

  // Duo Contribution Split Stats
  const contributionStats = useMemo(() => {
    let myPaid = 0;
    let partnerPaid = 0;
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        if (t.paidBy === myDisplayName || t.paidBy === "Saya") {
          myPaid += t.amount;
        } else {
          partnerPaid += t.amount;
        }
      });

    const direct = myPaid + partnerPaid;
    const myPct = direct > 0 ? Math.round((myPaid / direct) * 100) : 50;
    const partnerPct = direct > 0 ? 100 - myPct : 50;

    return { myPaid, partnerPaid, myPct, partnerPct };
  }, [transactions, myDisplayName]);

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen selection:bg-primary-container selection:text-black">
      {/* REUSABLE SIDEBAR */}
      <AppSidebar
        activeNav="dashboard"
        coupleName={couple?.name || `Dompet ${myDisplayName}`}
        partnerName={partner?.full_name}
        isPartnerConnected={Boolean(partner)}
      />

      {/* RIGHT MAIN CONTAINER */}
      <div className="pl-0 md:pl-60 pb-20 md:pb-12 min-h-screen">
        {/* TOP BAR FIXED HEADER */}
        <header className="fixed top-0 left-0 md:left-60 right-0 h-16 bg-surface-container-lowest border-b-[3px] border-black z-40 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
            <span className="font-label-badge text-label-badge uppercase px-2.5 sm:px-3 py-1 bg-primary-container text-on-surface border-[2px] border-black shadow-[2px_2px_0px_#000] rounded-sm font-black flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-sm">grid_view</span>
              <span className="truncate">DASHBOARD</span>
            </span>
            <span className="hidden sm:inline font-body-sm text-xs text-on-surface-variant font-bold truncate">
              • {couple?.name || "Dompet Bersama"}
            </span>
          </div>

          {/* User Quick Nav Bar */}
          <div className="flex items-center gap-3">
            <Link
              href="/laporan"
              className="font-label-badge text-xs uppercase px-3 py-1.5 bg-[#D4F34A] hover:bg-[#c2e439] text-on-surface border-[2px] border-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 font-black rounded-sm"
            >
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              <span>Laporan PDF</span>
            </Link>

            <Link
              href="/pengaturan"
              className="w-9 h-9 rounded-lg bg-surface-container border-2 border-black flex items-center justify-center font-bold text-xs shadow-[2px_2px_0px_#000] hover:bg-slate-200"
              title="Pengaturan Akun"
            >
              <span className="material-symbols-outlined text-lg">settings</span>
            </Link>
          </div>
        </header>

        {/* MAIN DASHBOARD CONTENT */}
        <main className="pt-24 pb-16 px-6 sm:px-8 max-w-7xl mx-auto space-y-8">
          {/* 1. WELCOME & QUICK HUB BANNER */}
          <div className="bg-surface-container-lowest border-[4px] border-black shadow-[6px_6px_0px_#000] rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-headline-lg uppercase font-black text-2xl tracking-tight">
                  Halo, {myDisplayName} &amp; {partner ? partner.full_name : "Pasanganmu"}! 👋
                </h1>
                <span className="font-label-badge text-[11px] uppercase font-black px-2.5 py-0.5 bg-[#D4F34A] border-2 border-black rounded">
                  {partner ? "Live Duo Sync" : "Menunggu Pasangan"}
                </span>
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant font-bold max-w-xl">
                Ini adalah pusat analitik keuangan bersama. Semua ringkasan di halaman ini otomatis terhitung dari transaksi, anggaran, dan tabungan resmi kalian berdua.
              </p>
            </div>

            {/* Shortcut Navigation Badges */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href="/transaksi"
                className="px-3.5 py-2 bg-primary-container hover:bg-[#a6e6ff] text-black border-2 border-black rounded font-headline-sm uppercase text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">receipt_long</span>
                <span>Catat Transaksi</span>
              </Link>
              <Link
                href="/scan-struk"
                className="px-3.5 py-2 bg-[#FDE047] hover:bg-[#fae870] text-black border-2 border-black rounded font-headline-sm uppercase text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">photo_camera</span>
                <span>Scan Struk</span>
              </Link>
              <Link
                href="/dompet"
                className="px-3.5 py-2 bg-[#A855F7] hover:bg-[#9333ea] text-white border-2 border-black rounded font-headline-sm uppercase text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                <span>Saldo Dompet</span>
              </Link>
              <Link
                href="/tabungan"
                className="px-3.5 py-2 bg-[#D4F34A] hover:bg-[#c2e439] text-black border-2 border-black rounded font-headline-sm uppercase text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">savings</span>
                <span>Setor Tabungan</span>
              </Link>
            </div>
          </div>

          {/* 2. FOUR PRIMARY FINANCIAL STAT CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stat 1: Saldo Bersama */}
            <div className="p-5 bg-[#38BDF8]/20 border-[3px] border-black shadow-[4px_4px_0px_#000] rounded-xl flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                    Saldo Dompet Bersama
                  </span>
                  <div className="font-numeric-stat text-2xl sm:text-3xl font-black text-[#0369a1] mt-1">
                    Rp {remainingBalance.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="w-10 h-10 bg-[#38BDF8] border-2 border-black shadow-[2px_2px_0px_#000] rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl text-black">account_balance_wallet</span>
                </div>
              </div>
              <div className="pt-2 border-t border-black/15 flex items-center justify-between text-xs font-bold">
                <span className="text-[#0369a1]">Kas Aktif Bersama</span>
                <Link href="/dompet" className="text-xs underline font-headline-sm uppercase font-black">
                  Kelola &rarr;
                </Link>
              </div>
            </div>

            {/* Stat 2: Total Pemasukan */}
            <div className="p-5 bg-[#D4F34A]/20 border-[3px] border-black shadow-[4px_4px_0px_#000] rounded-xl flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                    Pemasukan Bulan Ini
                  </span>
                  <div className="font-numeric-stat text-2xl sm:text-3xl font-black text-[#15803d] mt-1">
                    Rp {totalIncome.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="w-10 h-10 bg-[#D4F34A] border-2 border-black shadow-[2px_2px_0px_#000] rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">trending_up</span>
                </div>
              </div>
              <div className="pt-2 border-t border-black/15 flex items-center justify-between text-xs font-bold">
                <span className="text-[#15803d]">Top-up &amp; Setoran Rutin</span>
                <Link href="/transaksi" className="text-xs underline font-headline-sm uppercase font-black">
                  Rincian &rarr;
                </Link>
              </div>
            </div>

            {/* Stat 3: Total Pengeluaran */}
            <div className="p-5 bg-secondary-container/30 border-[3px] border-black shadow-[4px_4px_0px_#000] rounded-xl flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                    Pengeluaran Bulan Ini
                  </span>
                  <div className="font-numeric-stat text-2xl sm:text-3xl font-black text-secondary mt-1">
                    Rp {totalExpense.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="w-10 h-10 bg-secondary-container border-2 border-black shadow-[2px_2px_0px_#000] rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">shopping_cart</span>
                </div>
              </div>
              <div className="pt-2 border-t border-black/15 flex items-center justify-between text-xs font-bold">
                <span className="text-secondary">{transactions.filter((t) => t.type === "expense").length} transaksi</span>
                <Link href="/transaksi" className="text-xs underline font-headline-sm uppercase font-black">
                  Rincian &rarr;
                </Link>
              </div>
            </div>

            {/* Stat 4: Tabungan Terkumpul */}
            <div className="p-5 bg-[#FDE047]/30 border-[3px] border-black shadow-[4px_4px_0px_#000] rounded-xl flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                    Tabungan Terkumpul
                  </span>
                  <div className="font-numeric-stat text-2xl sm:text-3xl font-black text-[#854d0e] mt-1">
                    Rp {totalSavings.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="w-10 h-10 bg-[#FDE047] border-2 border-black shadow-[2px_2px_0px_#000] rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">savings</span>
                </div>
              </div>
              <div className="pt-2 border-t border-black/15 flex items-center justify-between text-xs font-bold">
                <span className="text-[#854d0e]">{savingsGoals.length} target impian</span>
                <Link href="/tabungan" className="text-xs underline font-headline-sm uppercase font-black">
                  Kelola &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* 3. CHARTS & PROGRESS METERS (6-MONTH SPENDING & BUDGET STATUS) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: 6-Month Visual Spending Chart */}
            <div className="lg:col-span-7 bg-surface-container-lowest border-[4px] border-black shadow-[6px_6px_0px_#000] rounded-xl overflow-hidden flex flex-col justify-between">
              <div className="p-4 border-b-[3px] border-black bg-surface-container-low flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl">bar_chart</span>
                  <h2 className="font-headline-sm uppercase font-black text-sm">
                    Tren Pengeluaran vs Tabungan (6 Bulan)
                  </h2>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-secondary-container border border-black inline-block"></span>
                    <span>Pengeluaran</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-primary-container border border-black inline-block"></span>
                    <span>Tabungan</span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="w-full h-56 pt-6 flex items-end justify-between gap-2 border-b-[3px] border-black relative">
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    <div className="w-full border-b border-dashed border-black"></div>
                    <div className="w-full border-b border-dashed border-black"></div>
                    <div className="w-full border-b border-dashed border-black"></div>
                  </div>

                  {[
                    { month: "Mei", exp: "h-28", sav: "h-16", total: "10.2M" },
                    { month: "Jun", exp: "h-36", sav: "h-20", total: "12.5M" },
                    { month: "Jul", exp: "h-40", sav: "h-14", total: "14.1M" },
                    { month: "Agu", exp: "h-32", sav: "h-24", total: "11.8M" },
                    { month: "Sep", exp: "h-38", sav: "h-22", total: "13.0M" },
                    {
                      month: "Okt ★",
                      exp: "h-32",
                      sav: "h-36",
                      total: "11.2M",
                      active: true,
                    },
                  ].map((bar, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 z-10 group">
                      <span
                        className={`font-label-badge text-[10px] font-bold ${
                          bar.active ? "bg-[#FDE047] px-1 border border-black shadow-[1px_1px_0px_#000]" : ""
                        }`}
                      >
                        {bar.total}
                      </span>
                      <div className="w-full max-w-[36px] flex items-end gap-0.5">
                        <div className={`w-1/2 bg-secondary-container border-[2px] border-black ${bar.exp}`} />
                        <div className={`w-1/2 bg-primary-container border-[2px] border-black ${bar.sav}`} />
                      </div>
                      <span className={`font-label-badge text-[10px] uppercase font-bold mt-1 ${bar.active ? "text-secondary font-black" : ""}`}>
                        {bar.month}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Insight Callout */}
                <div className="p-3.5 bg-[#ebe1ff] border-[2px] border-black shadow-[2px_2px_0px_#000] rounded flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-xl">insights</span>
                  <p className="font-body-sm text-xs text-on-surface font-bold">
                    💡 <b>Executive Insight:</b> Alokasi tabungan bulan ini meningkat 18% dibanding bulan lalu. Kondisi finansial sangat sehat!
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Duo Split & Budget Consumption Meters */}
            <div className="lg:col-span-5 space-y-4">
              {/* Card A: Duo Split Ratio */}
              <div className="bg-surface-container-lowest border-[4px] border-black shadow-[6px_6px_0px_#000] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
                  <h3 className="font-headline-sm uppercase font-black text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary">favorite</span>
                    <span>Rasio Belanja Berdua</span>
                  </h3>
                  <Link href="/laporan" className="text-xs font-headline-sm uppercase font-black text-primary underline">
                    Laporan Lengkap &rarr;
                  </Link>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{myDisplayName}: <strong>{contributionStats.myPct}%</strong></span>
                    <span>{partnerDisplayName}: <strong>{contributionStats.partnerPct}%</strong></span>
                  </div>
                  <div className="w-full bg-surface-container-low h-4 border-2 border-black rounded-full overflow-hidden flex">
                    <div
                      className="bg-[#38BDF8] h-full"
                      style={{ width: `${contributionStats.myPct}%` }}
                    />
                    <div
                      className="bg-[#fd6a49] h-full"
                      style={{ width: `${contributionStats.partnerPct}%` }}
                    />
                  </div>
                  <p className="font-body-sm text-[11px] text-on-surface-variant font-bold pt-1">
                    {contributionStats.myPct > 60
                      ? `Kamu menalangi lebih banyak pengeluaran bersama bulan ini.`
                      : contributionStats.partnerPct > 60
                      ? `${partnerDisplayName} menalangi lebih banyak pengeluaran bersama bulan ini.`
                      : `Pengeluaran kalian berdua terbagi seimbang (50 : 50)!`}
                  </p>
                </div>
              </div>

              {/* Card B: Budget Status Overview */}
              <div className="bg-surface-container-lowest border-[4px] border-black shadow-[6px_6px_0px_#000] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
                  <h3 className="font-headline-sm uppercase font-black text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary">pie_chart</span>
                    <span>Status Anggaran Kategori</span>
                  </h3>
                  <Link href="/anggaran" className="text-xs font-headline-sm uppercase font-black text-primary underline">
                    Kelola Anggaran &rarr;
                  </Link>
                </div>

                <div className="space-y-2.5">
                  {budgets.slice(0, 3).map((b) => {
                    const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
                    return (
                      <div key={b.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span>{b.name}</span>
                          <span>Rp {(b.spent / 1000000).toFixed(1)}jt / {(b.limit / 1000000).toFixed(1)}jt ({pct}%)</span>
                        </div>
                        <div className="w-full bg-surface-container-low h-2.5 border border-black rounded-full overflow-hidden">
                          <div
                            className={`${b.colorHex} h-full`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 4. RECENT TRANSACTIONS (VIEW ONLY FEED) */}
          <div className="bg-surface-container-lowest border-[4px] border-black shadow-[6px_6px_0px_#000] rounded-xl overflow-hidden">
            <div className="p-4 border-b-[3px] border-black bg-surface-container-low flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl">receipt_long</span>
                <h2 className="font-headline-sm uppercase font-black text-sm">
                  Transaksi Terakhir di Dompet ({transactions.slice(0, 5).length} Ditampilkan)
                </h2>
              </div>

              <Link
                href="/transaksi"
                className="px-3.5 py-1.5 bg-[#D4F34A] hover:bg-[#c2e439] text-black border-2 border-black rounded font-headline-sm uppercase text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5"
              >
                <span>Lihat Semua &amp; Catat Transaksi Baru</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>

            {transactions.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <p className="font-headline-sm uppercase font-bold text-sm text-on-surface-variant">
                  Belum ada catatan transaksi di Dompet Bersama.
                </p>
                <Link
                  href="/transaksi"
                  className="inline-block px-4 py-2 bg-primary-container text-black border-2 border-black rounded font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000]"
                >
                  + Mulai Catat di Halaman Transaksi
                </Link>
              </div>
            ) : (
              <div className="divide-y-2 border-b-2 border-black">
                {transactions.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="p-4 sm:p-5 hover:bg-surface-container-low/40 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000] ${tx.categoryBg}`}>
                        <span className="material-symbols-outlined text-xl">{tx.categoryIcon}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-headline-sm text-sm uppercase font-black truncate">
                          {tx.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-on-surface-variant font-bold flex-wrap">
                          <span>Dibayar: <strong>{tx.paidBy}</strong></span>
                          <span>•</span>
                          <span>{tx.splitInfo}</span>
                          <span>•</span>
                          <span>{tx.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`font-numeric-stat text-base sm:text-lg font-black ${
                        tx.type === "income" ? "text-[#15803d]" : "text-on-surface"
                      }`}>
                        {tx.type === "income" ? "+" : "-"} Rp {tx.amount.toLocaleString("id-ID")}
                      </div>
                      <span className="font-label-badge text-[10px] uppercase font-bold text-on-surface-variant">
                        {tx.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 bg-surface-container-low flex items-center justify-between text-xs font-bold text-on-surface-variant">
              <span>Halaman transaksi khusus mendukung fitur Tambah, Edit, Hapus, Pencarian, &amp; Filter lengkap.</span>
              <Link href="/transaksi" className="text-primary uppercase font-headline-sm font-black underline hover:text-black">
                Buka Halaman Transaksi &rarr;
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
