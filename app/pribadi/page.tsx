"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SpaceSwitcher } from "@/components/space-switcher";
import { PendingNotificationsCard, PendingTransaction } from "@/components/pending-notifications-card";
import { formatRupiahInput, parseRupiahInput } from "@/lib/currency";

interface PersonalTransaction {
  id: string;
  title: string;
  amount: number;
  type: "expense" | "income";
  category_id?: string | null;
  transaction_date: string;
  description?: string | null;
  created_at: string;
}

const CATEGORIES = [
  { name: "Makan & Jajan", icon: "restaurant", color: "bg-secondary-container" },
  { name: "Groceries & Belanja", icon: "shopping_bag", color: "bg-[#FDE047]" },
  { name: "Transportasi Pribadi", icon: "directions_car", color: "bg-[#38BDF8]" },
  { name: "Hiburan & Hobi", icon: "sports_esports", color: "bg-tertiary-container" },
  { name: "Tagihan & Pulsa", icon: "receipt", color: "bg-[#c6c9af]" },
  { name: "Kesehatan & Skincare", icon: "medical_services", color: "bg-[#FFDAD2]" },
  { name: "Gaji & Pemasukan", icon: "payments", color: "bg-[#D4F34A]" },
  { name: "Lainnya", icon: "local_mall", color: "bg-surface-container" },
];

export default function PribadiPage() {
  const router = useRouter();
  const supabase = createClient();

  // User State (Strictly personal, NO couple bleed)
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data State
  const [transactions, setTransactions] = useState<PersonalTransaction[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState<PendingTransaction[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Modal State: Create / Edit
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editId, setEditId] = useState<string | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formType, setFormType] = useState<"expense" | "income">("expense");
  const [formCategory, setFormCategory] = useState("Makan & Jajan");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formDescription, setFormDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State: Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTx, setDeletingTx] = useState<PersonalTransaction | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadPersonalData = async () => {
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

      // 1. Profile only
      const { data: profRow } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      const myName = profRow?.full_name || user.email?.split("@")[0] || "Saya";
      setProfile({ full_name: myName });

      // 2. Lookup couple ID in background ONLY for "promosikan ke couple" action
      const { data: memRows } = await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("profile_id", user.id)
        .limit(1);

      if (memRows && memRows.length > 0) {
        setCoupleId(memRows[0].couple_id);
      }

      // 3. Strictly Personal Recorded Transactions
      const { data: txRows } = await supabase
        .from("transactions")
        .select("id, title, amount, type, category_id, transaction_date, description, created_at")
        .eq("created_by", user.id)
        .eq("scope", "personal")
        .eq("status", "recorded")
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

      // 4. Pending Review Notifications (Captured from HP)
      const { data: pendingRows } = await supabase
        .from("transactions")
        .select("*")
        .eq("created_by", user.id)
        .eq("status", "pending_review")
        .order("created_at", { ascending: false });

      if (pendingRows) {
        setPendingNotifications(pendingRows as PendingTransaction[]);
      }
    } catch (err) {
      console.warn("Error loading personal space:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPersonalData();
  }, [router, supabase]);

  // Aggregate Personal Metrics
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

  const personalBalance = totalIncome - totalExpense;

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterCategory !== "all" && t.category_id !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchCat = (t.category_id || "").toLowerCase().includes(q);
        const matchDesc = (t.description || "").toLowerCase().includes(q);
        return matchTitle || matchCat || matchDesc;
      }
      return true;
    });
  }, [transactions, filterType, filterCategory, searchQuery]);

  // Handle Form Open
  const handleOpenAdd = () => {
    setModalMode("add");
    setEditId(null);
    setFormTitle("");
    setFormAmount("");
    setFormType("expense");
    setFormCategory("Makan & Jajan");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormDescription("");
    setShowModal(true);
  };

  const handleOpenEdit = (tx: PersonalTransaction) => {
    setModalMode("edit");
    setEditId(tx.id);
    setFormTitle(tx.title);
    setFormAmount(formatRupiahInput(tx.amount));
    setFormType(tx.type);
    setFormCategory(tx.category_id || "Makan & Jajan");
    setFormDate(tx.transaction_date || new Date().toISOString().slice(0, 10));
    setFormDescription(tx.description || "");
    setShowModal(true);
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formAmount || !currentUser) return;

    const numAmount = parseRupiahInput(formAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast("Nominal tidak valid!");
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === "add") {
        const newRecord = {
          couple_id: null, // Strictly null for personal
          scope: "personal",
          created_by: currentUser.id,
          creator_name: profile?.full_name || "Saya",
          title: formTitle.trim(),
          amount: numAmount,
          type: formType,
          category_id: formCategory,
          paid_by: profile?.full_name || "Saya",
          split_method: "none",
          transaction_date: formDate,
          description: formDescription.trim() || null,
          status: "recorded",
        };

        const { data, error } = await supabase
          .from("transactions")
          .insert(newRecord)
          .select("*")
          .single();

        if (error) throw error;
        if (data) {
          setTransactions((prev) => [{ ...data, amount: Number(data.amount) }, ...prev]);
          showToast("Catatan pribadi tersimpan! 👤");
        }
      } else if (editId) {
        const updatePayload = {
          title: formTitle.trim(),
          amount: numAmount,
          type: formType,
          category_id: formCategory,
          transaction_date: formDate,
          description: formDescription.trim() || null,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("transactions")
          .update(updatePayload)
          .eq("id", editId)
          .eq("created_by", currentUser.id);

        if (error) throw error;

        setTransactions((prev) =>
          prev.map((t) => (t.id === editId ? { ...t, ...updatePayload } : t))
        );
        showToast("Catatan pribadi diperbarui! ✨");
      }

      setShowModal(false);
    } catch (err: any) {
      showToast("Gagal menyimpan: " + (err.message || "Terjadi kesalahan"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (!deletingTx || !currentUser) return;
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", deletingTx.id)
        .eq("created_by", currentUser.id);

      if (error) throw error;

      setTransactions((prev) => prev.filter((t) => t.id !== deletingTx.id));
      showToast("Catatan berhasil dihapus! 🗑️");
      setShowDeleteModal(false);
      setDeletingTx(null);
    } catch (err: any) {
      showToast("Gagal menghapus: " + err.message);
    }
  };

  // Promote to Couple Space
  const handlePromoteToCouple = async (tx: PersonalTransaction) => {
    if (!coupleId) {
      showToast("Kamu belum terhubung dengan dompet bersama pasangan.");
      return;
    }

    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          scope: "couple",
          couple_id: coupleId,
          split_method: "fifty_fifty",
          updated_at: new Date().toISOString(),
        })
        .eq("id", tx.id)
        .eq("created_by", currentUser?.id);

      if (error) throw error;

      setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
      showToast("Dipindahkan ke Dompet Bersama! 💑");
    } catch (err: any) {
      showToast("Gagal memindahkan: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-surface font-space-grotesk text-on-surface">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-black text-white px-4 py-2.5 rounded-lg border-2 border-primary-container shadow-[4px_4px_0px_#38BDF8] text-xs font-black animate-in fade-in">
          {toastMsg}
        </div>
      )}

      {/* App Sidebar */}
      <AppSidebar />

      {/* MAIN CONTAINER */}
      <div className="pl-0 md:pl-60 pb-20 md:pb-12 min-h-screen">
        {/* TOP BAR FIXED HEADER */}
        <header className="fixed top-0 left-0 md:left-60 right-0 h-16 bg-surface-container-lowest border-b-[3px] border-black z-40 px-3 sm:px-8 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden min-w-0">
            <span className="font-label-badge text-xs uppercase px-2.5 sm:px-3 py-1 bg-primary-container text-black border-[2px] border-black shadow-[2px_2px_0px_#000] rounded-sm font-black flex items-center gap-1.5 shrink-0">
              <span className="text-sm">👤</span>
              <span>RUANG PRIBADI</span>
            </span>
            <span className="hidden sm:inline font-body-sm text-xs text-neutral-600 font-bold truncate">
              • 100% Privat (Hanya Kamu yang Tahu)
            </span>
          </div>

          {/* Quick Space Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <SpaceSwitcher />

            <Link
              href="/dashboard"
              className="font-label-badge text-xs uppercase px-2.5 sm:px-3 py-1.5 bg-secondary-container hover:bg-[#e4cbff] text-black border-[2px] border-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 font-black rounded-sm"
              title="Buka Dompet Bersama Pasangan"
            >
              <span>💑</span>
              <span className="hidden sm:inline">Dompet Bersama</span>
            </Link>
          </div>
        </header>

        {/* MAIN BODY */}
        <main className="pt-20 sm:pt-24 pb-20 md:pb-16 px-3 sm:px-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* AUTO-CAPTURED NOTIFICATIONS REVIEW WIDGET */}
          <PendingNotificationsCard
            items={pendingNotifications}
            coupleId={coupleId}
            onItemProcessed={(id) => {
              setPendingNotifications((prev) => prev.filter((item) => item.id !== id));
              loadPersonalData();
            }}
          />

          {/* 1. HERO BANNER: RUANG PRIBADI */}
          <div className="bg-primary-container/20 border-[4px] border-black shadow-[6px_6px_0px_#000] rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-headline-lg uppercase font-black text-2xl tracking-tight">
                  Ruang Keuangan Pribadi, {profile?.full_name || "Kamu"}! 👤
                </h1>
                <span className="font-label-badge text-[11px] uppercase font-black px-2.5 py-0.5 bg-primary-container text-black border-2 border-black rounded shadow-[2px_2px_0px_#000]">
                  Privat & Rahasia
                </span>
              </div>
              <p className="font-body-sm text-xs text-neutral-700 font-bold max-w-xl">
                Ini adalah brankas catatan keuangan pribadi kamu. Saldo, jajan, dan mutasi di ruang ini <strong>tidak dibagikan ke pasangan</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-4 py-2.5 bg-primary-container hover:bg-[#a6e6ff] text-black border-2 border-black rounded-lg font-headline-sm uppercase text-xs font-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>Catat Pengeluaran Pribadi</span>
              </button>
            </div>
          </div>

          {/* 2. STATS CARDS (PERSONAL ONLY) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Saldo Bersih Pribadi */}
            <div className="bg-surface-container-lowest border-[3px] border-black rounded-lg p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-black text-neutral-600">
                  ARUS KAS PRIBADI (SALDO)
                </span>
                <span className="w-8 h-8 rounded-full bg-primary-container border-2 border-black flex items-center justify-center font-bold text-sm">
                  👛
                </span>
              </div>
              <div className="mt-3">
                <div className={`text-2xl sm:text-3xl font-black ${personalBalance >= 0 ? "text-black" : "text-red-600"}`}>
                  Rp {personalBalance.toLocaleString("id-ID")}
                </div>
                <div className="text-xs text-neutral-500 font-bold mt-1">
                  Pemasukan dikurangi pengeluaran pribadi
                </div>
              </div>
            </div>

            {/* Total Pengeluaran Pribadi */}
            <div className="bg-[#ffdad6]/40 border-[3px] border-black rounded-lg p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-black text-neutral-600">
                  PENGELUARAN PRIBADI
                </span>
                <span className="w-8 h-8 rounded-full bg-[#ffdad6] border-2 border-black flex items-center justify-center font-bold text-sm text-[#ba1a1a]">
                  ↓
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-[#ba1a1a]">
                  Rp {totalExpense.toLocaleString("id-ID")}
                </div>
                <div className="text-xs text-neutral-500 font-bold mt-1">
                  {transactions.filter((t) => t.type === "expense").length} transaksi jajan & belanja
                </div>
              </div>
            </div>

            {/* Total Pemasukan Pribadi */}
            <div className="bg-[#D4F34A]/30 border-[3px] border-black rounded-lg p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-black text-neutral-600">
                  PEMASUKAN PRIBADI
                </span>
                <span className="w-8 h-8 rounded-full bg-[#D4F34A] border-2 border-black flex items-center justify-center font-bold text-sm">
                  ↑
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-black">
                  Rp {totalIncome.toLocaleString("id-ID")}
                </div>
                <div className="text-xs text-neutral-500 font-bold mt-1">
                  {transactions.filter((t) => t.type === "income").length} pemasukan / gaji pribadi
                </div>
              </div>
            </div>
          </div>

          {/* 3. TOOLBAR & FILTER */}
          <div className="bg-surface-container-lowest border-[3px] border-black rounded-lg p-4 shadow-[4px_4px_0px_#000] space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-lg">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Cari transaksi pribadi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-black rounded font-bold text-xs sm:text-sm bg-white focus:outline-none focus:shadow-[2px_2px_0px_#000]"
                />
              </div>

              {/* Filter Type */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {(["all", "expense", "income"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 rounded border-2 border-black text-xs font-black uppercase transition-all ${
                      filterType === t
                        ? "bg-black text-white shadow-[2px_2px_0px_#38BDF8]"
                        : "bg-white hover:bg-neutral-100 text-black"
                    }`}
                  >
                    {t === "all" ? "Semua" : t === "expense" ? "Pengeluaran" : "Pemasukan"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. DAFTAR TRANSAKSI PRIBADI */}
          <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl p-5 sm:p-6 shadow-[6px_6px_0px_#000]">
            <div className="flex items-center justify-between pb-4 border-b-2 border-black/10 mb-4">
              <h2 className="font-headline-sm font-black text-lg text-black uppercase tracking-tight flex items-center gap-2">
                <span>Daftar Mutasi Pribadi</span>
                <span className="text-xs px-2 py-0.5 bg-neutral-200 text-neutral-800 rounded font-bold">
                  {filteredTransactions.length}
                </span>
              </h2>

              <button
                type="button"
                onClick={handleOpenAdd}
                className="text-xs font-black text-black underline hover:text-primary transition-colors flex items-center gap-1"
              >
                + Tambah Catatan
              </button>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-sm font-bold text-neutral-500">
                Memuat catatan pribadi kamu...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="text-4xl">🔐</div>
                <h3 className="font-black text-base text-black">Belum Ada Catatan Pribadi</h3>
                <p className="text-xs text-neutral-600 max-w-sm mx-auto font-medium">
                  Catat pengeluaran rahasia atau jajan pribadi kamu di sini. Pasangan tidak akan bisa melihat data ini.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="px-4 py-2 bg-primary-container border-2 border-black rounded font-black text-xs shadow-[2px_2px_0px_#000]"
                >
                  Mulai Catat Sekarang
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3.5 sm:p-4 rounded-lg border-2 border-black bg-white hover:bg-neutral-50 shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-transform"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase px-2 py-0.5 rounded border border-black bg-neutral-100">
                          {tx.category_id || "Umum"}
                        </span>
                        <span className="font-black text-sm text-black truncate">
                          {tx.title}
                        </span>
                      </div>

                      <div className="text-xs text-neutral-500 font-bold flex items-center gap-2">
                        <span>📅 {tx.transaction_date}</span>
                        {tx.description && <span>• {tx.description}</span>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div
                        className={`font-black text-base sm:text-lg ${
                          tx.type === "expense" ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {tx.type === "expense" ? "-" : "+"}Rp {tx.amount.toLocaleString("id-ID")}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePromoteToCouple(tx)}
                          className="px-2 py-1 bg-secondary-container hover:bg-secondary-container/80 text-[10px] font-black border border-black rounded shadow-[1px_1px_0px_#000]"
                          title="Pindahkan ke Dompet Bersama Pasangan (Bagi 50:50)"
                        >
                          💑 Ke Bersama
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tx)}
                          className="w-7 h-7 rounded border border-black flex items-center justify-center hover:bg-neutral-100"
                          title="Edit Catatan"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDeletingTx(tx);
                            setShowDeleteModal(true);
                          }}
                          className="w-7 h-7 rounded border border-black flex items-center justify-center hover:bg-red-100 text-red-600"
                          title="Hapus Catatan"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* MODAL: TAMBAH / EDIT TRANSAKSI PRIBADI */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-surface border-4 border-black rounded-xl p-6 shadow-[8px_8px_0px_#000] relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
              <h3 className="font-headline-sm font-black text-lg text-black uppercase">
                {modalMode === "add" ? "Catat Transaksi Pribadi 👤" : "Edit Catatan Pribadi"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded border-2 border-black flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Tipe Transaksi */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormType("expense")}
                  className={`flex-1 py-2 rounded-lg border-2 border-black font-black text-xs uppercase ${
                    formType === "expense" ? "bg-[#ffdad6] text-[#ba1a1a] shadow-[2px_2px_0px_#000]" : "bg-white"
                  }`}
                >
                  Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() => setFormType("income")}
                  className={`flex-1 py-2 rounded-lg border-2 border-black font-black text-xs uppercase ${
                    formType === "income" ? "bg-[#D4F34A] text-black shadow-[2px_2px_0px_#000]" : "bg-white"
                  }`}
                >
                  Pemasukan
                </button>
              </div>

              {/* Judul */}
              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                  Nama Catatan / Merchant
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kopi Sore, Baju Zara, Gaji Pokok"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full p-2.5 border-2 border-black rounded-lg font-bold text-sm bg-white focus:outline-none focus:shadow-[3px_3px_0px_#000]"
                />
              </div>

              {/* Nominal */}
              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                  Nominal (Rp)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Rp 0"
                  value={formAmount}
                  onChange={(e) => setFormAmount(formatRupiahInput(e.target.value))}
                  className="w-full p-2.5 border-2 border-black rounded-lg font-black text-lg bg-white focus:outline-none focus:shadow-[3px_3px_0px_#000]"
                />
              </div>

              {/* Kategori */}
              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                  Kategori
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full p-2.5 border-2 border-black rounded-lg font-bold text-xs bg-white focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tanggal */}
              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full p-2.5 border-2 border-black rounded-lg font-bold text-xs bg-white focus:outline-none"
                />
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                  Keterangan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan rahasia kamu..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-2 border-2 border-black rounded-lg font-bold text-xs bg-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-lg border-2 border-black bg-neutral-100 font-black text-xs uppercase"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-lg border-2 border-black bg-primary-container text-black font-black text-xs uppercase shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Catatan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {showDeleteModal && deletingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white border-4 border-black rounded-xl p-6 shadow-[8px_8px_0px_#000] text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h3 className="font-black text-lg text-black">Hapus Catatan Ini?</h3>
            <p className="text-xs text-neutral-600 font-medium">
              Transaksi <strong>{deletingTx.title}</strong> (Rp {deletingTx.amount.toLocaleString("id-ID")}) akan dihapus permanen dari ruang pribadi kamu.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2 rounded-lg border-2 border-black bg-neutral-100 font-black text-xs uppercase"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2 rounded-lg border-2 border-black bg-red-500 text-white font-black text-xs uppercase shadow-[2px_2px_0px_#000]"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
