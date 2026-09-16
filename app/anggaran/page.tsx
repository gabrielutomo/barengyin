"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { formatRupiahInput, parseRupiahInput } from "@/lib/currency";

interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  colorHex: string;
  spent: number;
  limit: number;
}

const DEFAULT_BUDGETS: BudgetCategory[] = [
  {
    id: "b-1",
    name: "Makan & Kencan",
    icon: "restaurant",
    colorHex: "bg-secondary-container",
    spent: 0,
    limit: 4000000,
  },
  {
    id: "b-2",
    name: "Groceries & Rumah",
    icon: "shopping_bag",
    colorHex: "bg-primary-container",
    spent: 0,
    limit: 3500000,
  },
  {
    id: "b-3",
    name: "Transportasi",
    icon: "directions_car",
    colorHex: "bg-[#FDE047]",
    spent: 0,
    limit: 1500000,
  },
  {
    id: "b-4",
    name: "Hiburan & Nonton",
    icon: "live_tv",
    colorHex: "bg-tertiary-container",
    spent: 0,
    limit: 1000000,
  },
  {
    id: "b-5",
    name: "Tagihan & Utilitas",
    icon: "receipt",
    colorHex: "bg-[#c6c9af]",
    spent: 0,
    limit: 1000000,
  },
];

const AVAILABLE_ICONS = [
  { name: "restaurant", label: "Makan" },
  { name: "shopping_bag", label: "Belanja" },
  { name: "directions_car", label: "Transport" },
  { name: "live_tv", label: "Hiburan" },
  { name: "receipt", label: "Tagihan" },
  { name: "medical_services", label: "Kesehatan" },
  { name: "local_mall", label: "Lainnya" },
];

export default function AnggaranPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [couple, setCouple] = useState<{ id: string; name: string } | null>(null);
  const [partner, setPartner] = useState<{ id: string; full_name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Budget List & Modal state
  const [budgets, setBudgets] = useState<BudgetCategory[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formLimit, setFormLimit] = useState("");
  const [formIcon, setFormIcon] = useState("restaurant");

  // Custom Delete Modal State (NO BROWSER CONFIRM POPUP)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingBudget, setDeletingBudget] = useState<BudgetCategory | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const myDisplayName = profile?.full_name || "Saya";

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const getStorageKey = (coupleId?: string) => `barengyin_budgets_${coupleId || "default"}`;

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
        let activeCoupleData = null;

        if (activeCoupleId) {
          const { data: cRow } = await supabase
            .from("couples")
            .select("id, name")
            .eq("id", activeCoupleId)
            .maybeSingle();
          if (cRow) {
            setCouple(cRow);
            activeCoupleData = cRow;
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
        }

        // 3. Load Budgets with Persistence (localStorage)
        const storageKey = getStorageKey(activeCoupleData?.id);
        const savedBudgets = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
        let initialList: BudgetCategory[] = DEFAULT_BUDGETS;

        if (savedBudgets) {
          try {
            initialList = JSON.parse(savedBudgets);
          } catch {
            initialList = DEFAULT_BUDGETS;
          }
        } else {
          // Persist defaults for this couple
          localStorage.setItem(storageKey, JSON.stringify(DEFAULT_BUDGETS));
        }

        // 4. Calculate actual spent from real Supabase transactions
        if (activeCoupleId) {
          const { data: txRows } = await supabase
            .from("transactions")
            .select("category_id, amount, type")
            .eq("couple_id", activeCoupleId)
            .eq("type", "expense");

          if (txRows) {
            initialList = initialList.map((b) => {
              const matchSpent = txRows
                .filter((t) => t.category_id?.trim().toLowerCase() === b.name.trim().toLowerCase())
                .reduce((sum, t) => sum + Number(t.amount), 0);
              return {
                ...b,
                spent: matchSpent,
              };
            });
          }
        }

        setBudgets(initialList);
      } catch (err) {
        console.warn("Could not load budget data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router, supabase]);

  // Aggregate stats
  const totalLimit = useMemo(
    () => budgets.reduce((acc, b) => acc + b.limit, 0),
    [budgets]
  );
  const totalSpent = useMemo(
    () => budgets.reduce((acc, b) => acc + b.spent, 0),
    [budgets]
  );
  const overallPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const remainingBudget = Math.max(0, totalLimit - totalSpent);

  const handleOpenAdd = () => {
    setEditId(null);
    setFormName("");
    setFormLimit("");
    setFormIcon("restaurant");
    setShowModal(true);
  };

  const handleOpenEdit = (b: BudgetCategory) => {
    setEditId(b.id);
    setFormName(b.name);
    setFormLimit(formatRupiahInput(b.limit));
    setFormIcon(b.icon);
    setShowModal(true);
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formLimit) return;
    const numLimit = parseRupiahInput(formLimit);
    if (isNaN(numLimit) || numLimit <= 0) return;

    let updated: BudgetCategory[];

    if (editId) {
      updated = budgets.map((b) =>
        b.id === editId
          ? { ...b, name: formName.trim(), limit: numLimit, icon: formIcon }
          : b
      );
      showToast(`Anggaran "${formName}" berhasil diperbarui!`);
    } else {
      const newB: BudgetCategory = {
        id: `b-${Date.now()}`,
        name: formName.trim(),
        icon: formIcon,
        colorHex: "bg-tertiary-container",
        spent: 0,
        limit: numLimit,
      };
      updated = [...budgets, newB];
      showToast(`Kategori anggaran "${formName}" berhasil dibuat!`);
    }

    setBudgets(updated);
    // Persist to localStorage
    const storageKey = getStorageKey(couple?.id);
    localStorage.setItem(storageKey, JSON.stringify(updated));

    setShowModal(false);
  };

  // Open Custom Delete Modal
  const handlePromptDelete = (b: BudgetCategory) => {
    setDeletingBudget(b);
    setShowDeleteModal(true);
  };

  // Confirm Delete Action (Permanently saved)
  const handleConfirmDelete = () => {
    if (!deletingBudget) return;

    const updated = budgets.filter((b) => b.id !== deletingBudget.id);
    setBudgets(updated);

    // Save to localStorage so it NEVER comes back on reload
    const storageKey = getStorageKey(couple?.id);
    localStorage.setItem(storageKey, JSON.stringify(updated));

    showToast(`Kategori "${deletingBudget.name}" berhasil dihapus permanen.`);
    setShowDeleteModal(false);
    setDeletingBudget(null);
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
        activeNav="anggaran"
        coupleName={couple?.name || `Dompet ${myDisplayName}`}
        partnerName={partner?.full_name}
        isPartnerConnected={Boolean(partner)}
      />

      {/* MAIN CONTAINER */}
      <div className="pl-0 md:pl-60 pb-20 md:pb-12 min-h-screen">
        {/* TOP HEADER */}
        <header className="fixed top-0 left-0 md:left-60 right-0 h-16 bg-surface-container-lowest border-b-[3px] border-black z-40 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
            <span className="font-label-badge text-label-badge uppercase px-2.5 sm:px-3 py-1 bg-primary-container text-on-surface border-[2px] border-black shadow-[2px_2px_0px_#000] rounded-sm font-black flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-sm">pie_chart</span>
              <span className="truncate">ANGGARAN</span>
            </span>
            <span className="hidden sm:inline font-body-sm text-xs text-on-surface-variant font-bold truncate">
              • {couple?.name || "Dompet Bersama"}
            </span>
          </div>

          <button
            onClick={handleOpenAdd}
            className="bg-primary-container text-on-surface border-[3px] border-black px-3 sm:px-4 py-1.5 rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span className="hidden sm:inline">Tambah Anggaran</span>
            <span className="sm:hidden">Tambah</span>
          </button>
        </header>

        {/* MAIN BODY */}
        <main className="pt-24 pb-16 px-6 sm:px-8 max-w-7xl mx-auto space-y-8">
          {/* 1. HERO METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Total Plafon Anggaran */}
            <div className="bg-surface-container-lowest border-[3px] border-black rounded-lg p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                  TOTAL PLAFON ANGGARAN
                </span>
                <span className="w-8 h-8 rounded bg-primary-container border-2 border-black flex items-center justify-center font-bold text-sm">
                  Rp
                </span>
              </div>
              <div className="mt-3">
                <div className="font-numeric-stat text-2xl sm:text-3xl font-black">
                  Rp {totalLimit.toLocaleString("id-ID")}
                </div>
                <div className="font-body-sm text-xs text-on-surface-variant font-bold mt-0.5">
                  Batas belanja gabungan per bulan
                </div>
              </div>
            </div>

            {/* Card 2: Terpakai Saat Ini */}
            <div className="bg-secondary-container/30 border-[3px] border-black rounded-lg p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                  TERPAKAI BULAN INI
                </span>
                <span className="w-8 h-8 rounded bg-[#ffdad6] text-[#ba1a1a] border-2 border-black flex items-center justify-center font-bold text-sm">
                  {overallPct}%
                </span>
              </div>
              <div className="mt-3">
                <div className="font-numeric-stat text-2xl sm:text-3xl font-black text-secondary">
                  Rp {totalSpent.toLocaleString("id-ID")}
                </div>
                <div className="font-body-sm text-xs text-on-surface-variant font-bold mt-0.5">
                  {overallPct > 80 ? "⚠️ Mendekati batas maksimal" : "✓ Masih dalam batas aman"}
                </div>
              </div>
            </div>

            {/* Card 3: Sisa Kuota Belanja */}
            <div className="bg-[#D4F34A]/30 border-[3px] border-black rounded-lg p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                  SISA KUOTA BELANJA
                </span>
                <span className="w-8 h-8 rounded bg-[#D4F34A] border-2 border-black flex items-center justify-center font-bold text-sm">
                  ✓
                </span>
              </div>
              <div className="mt-3">
                <div className="font-numeric-stat text-2xl sm:text-3xl font-black text-[#15803d]">
                  Rp {remainingBudget.toLocaleString("id-ID")}
                </div>
                <div className="font-body-sm text-xs text-on-surface-variant font-bold mt-0.5">
                  Dapat dialihkan ke Tabungan Impian
                </div>
              </div>
            </div>
          </div>

          {/* 2. OVERALL BUDGET PROGRESS BAR */}
          <div className="bg-surface-container-lowest border-[3px] border-black rounded-xl p-5 sm:p-6 shadow-[5px_5px_0px_#000] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-headline-sm uppercase font-black text-base">
                  Penggunaan Anggaran Bersama Bulan Ini
                </h3>
                <p className="font-body-sm text-xs text-on-surface-variant font-bold">
                  Berdasarkan transaksi pengeluaran yang tercatat di Dompet Bersama
                </p>
              </div>
              <span className={`font-label-badge text-xs uppercase font-black px-2.5 py-1 border-2 border-black rounded ${
                overallPct > 100 ? "bg-[#ffdad6] text-[#ba1a1a]" : overallPct > 80 ? "bg-[#FEF3C7] text-amber-900" : "bg-[#D4F34A] text-black"
              }`}>
                {overallPct}% Terpakai
              </span>
            </div>

            <div className="w-full bg-surface-container-low h-5 border-[3px] border-black rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all ${
                  overallPct > 100 ? "bg-[#ba1a1a]" : overallPct > 80 ? "bg-amber-500" : "bg-[#22C55E]"
                }`}
                style={{ width: `${Math.min(100, overallPct)}%` }}
              />
            </div>
          </div>

          {/* 3. CATEGORY BUDGET CARDS GRID */}
          <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl shadow-[6px_6px_0px_#000] overflow-hidden">
            <div className="p-4 border-b-[3px] border-black bg-surface-container-low flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl">category</span>
                <h2 className="font-headline-sm uppercase font-black text-sm">
                  Daftar Pagu Anggaran per Kategori ({budgets.length})
                </h2>
              </div>
              <div className="font-body-sm text-xs text-on-surface-variant font-bold">
                Atur batas agar pengeluaran berdua tetap seimbang dan terkontrol.
              </div>
            </div>

            {isLoading ? (
              <div className="p-12 text-center font-headline-sm uppercase font-bold animate-pulse">
                Memuat data anggaran...
              </div>
            ) : budgets.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary-container border-2 border-black mx-auto flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">pie_chart</span>
                </div>
                <div className="font-headline-sm uppercase font-black text-base">
                  Belum Ada Anggaran Kategori
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant max-w-sm mx-auto font-semibold">
                  Mulai atur pagu anggaran kategori belanja kamu dan pasangan sekarang.
                </p>
                <button
                  onClick={handleOpenAdd}
                  className="mt-2 bg-primary-container text-black border-2 border-black px-4 py-2 rounded font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] hover:bg-[#a6e6ff] cursor-pointer"
                >
                  + Tambah Anggaran Pertama
                </button>
              </div>
            ) : (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {budgets.map((b) => {
                  const pct = b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0;
                  const isOver = pct > 100;
                  const isWarn = pct > 80 && !isOver;

                  return (
                    <div
                      key={b.id}
                      className="p-4 bg-surface-container-lowest border-[3px] border-black rounded-lg shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-3 hover:bg-surface-container-low/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center ${b.colorHex} shadow-[2px_2px_0px_#000]`}>
                            <span className="material-symbols-outlined text-xl">
                              {b.icon}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-headline-sm uppercase font-black text-sm text-on-surface">
                              {b.name}
                            </h4>
                            <span className="font-body-sm text-xs text-on-surface-variant font-bold">
                              Batas: Rp {b.limit.toLocaleString("id-ID")}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons: Edit & Delete */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(b)}
                            className="w-8 h-8 border-2 border-black rounded bg-white hover:bg-primary-container flex items-center justify-center cursor-pointer shadow-[1px_1px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                            title="Edit Anggaran"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button
                            onClick={() => handlePromptDelete(b)}
                            className="w-8 h-8 border-2 border-black rounded bg-white hover:bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center cursor-pointer shadow-[1px_1px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                            title="Hapus Kategori"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between font-body-sm text-xs font-bold">
                          <span className={isOver ? "text-[#ba1a1a] font-black" : "text-on-surface"}>
                            Terpakai: Rp {b.spent.toLocaleString("id-ID")}
                          </span>
                          <span className={`font-black ${isOver ? "text-[#ba1a1a]" : isWarn ? "text-amber-800" : "text-[#15803d]"}`}>
                            {pct}% {isOver ? "(Melebihi Batas!)" : isWarn ? "(Peringatan)" : ""}
                          </span>
                        </div>
                        <div className="w-full bg-surface-container-low h-3 border-2 border-black rounded-full overflow-hidden p-0.5">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isOver ? "bg-[#ba1a1a]" : isWarn ? "bg-amber-500" : "bg-[#22C55E]"
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[11px] font-bold text-on-surface-variant">
                        <span>Sisa: Rp {Math.max(0, b.limit - b.spent).toLocaleString("id-ID")}</span>
                        <Link href="/transaksi" className="text-primary underline hover:text-black font-headline-sm uppercase text-[10px] font-black">
                          Lihat Transaksi &rarr;
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* MODAL 1: TAMBAH / EDIT ANGGARAN */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border-[4px] border-black shadow-[8px_8px_0px_#000000] rounded-xl p-6 max-w-md w-full relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-8 h-8 border-2 border-black rounded bg-[#FDE047] flex items-center justify-center font-bold text-sm shadow-[2px_2px_0px_#000] hover:bg-white cursor-pointer"
            >
              ✕
            </button>

            <div className="border-b-[3px] border-black pb-3 mb-4">
              <h3 className="font-headline-md uppercase font-black text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">pie_chart</span>
                <span>{editId ? "Edit Anggaran Kategori" : "Tambah Anggaran Kategori"}</span>
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant font-bold">
                Tentukan batas maksimal pengeluaran bulanan
              </p>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Nama Kategori Anggaran
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Makan & Kencan, Belanja Rumah"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border-[3px] border-black rounded p-3 font-body-md font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Plafon Maksimal (Rp per bulan) • <span className="text-primary lowercase font-normal">titik otomatis</span>
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
                    value={formLimit}
                    onChange={(e) => setFormLimit(formatRupiahInput(e.target.value))}
                    className="w-full pl-12 pr-4 py-3 border-[3px] border-black rounded font-numeric-stat text-2xl font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Pilih Ikon
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {AVAILABLE_ICONS.map((ic) => (
                    <button
                      key={ic.name}
                      type="button"
                      onClick={() => setFormIcon(ic.name)}
                      className={`p-2 border-2 border-black rounded flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        formIcon === ic.name
                          ? "bg-primary-container shadow-[2px_2px_0px_#000]"
                          : "bg-white hover:bg-slate-100"
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">{ic.name}</span>
                      <span className="font-label-badge text-[9px] uppercase font-bold truncate w-full text-center">
                        {ic.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-surface-container border-[3px] border-black rounded font-headline-sm uppercase font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-2 py-3 bg-primary-container text-black border-[3px] border-black rounded font-headline-sm uppercase font-black text-sm shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                >
                  {editId ? "Simpan Perubahan" : "Simpan Anggaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CUSTOM NEO-BRUTALIST KONFIRMASI HAPUS (BUKAN ALERT BROWSER!) */}
      {showDeleteModal && deletingBudget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border-[4px] border-black shadow-[8px_8px_0px_#000000] rounded-xl p-6 max-w-sm w-full relative">
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-[#ffdad6] text-[#ba1a1a] border-[3px] border-black mx-auto flex items-center justify-center mb-3 shadow-[3px_3px_0px_#000]">
                <span className="material-symbols-outlined text-3xl">
                  delete_forever
                </span>
              </div>
              <h3 className="font-headline-md uppercase font-black text-lg">
                Hapus Anggaran Kategori?
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant mt-2 font-semibold leading-relaxed">
                Apakah kamu yakin ingin menghapus kategori <strong>&quot;{deletingBudget.name}&quot;</strong> dengan plafon <strong>Rp {deletingBudget.limit.toLocaleString("id-ID")}</strong>?
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingBudget(null);
                }}
                className="flex-1 py-2.5 bg-surface-container border-[2px] border-black rounded font-headline-sm uppercase font-bold text-xs hover:bg-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-[#ffdad6] text-[#ba1a1a] border-[2px] border-black rounded font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] hover:bg-[#ffb4ab] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
