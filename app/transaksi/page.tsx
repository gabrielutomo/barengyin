"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { formatRupiahInput, parseRupiahInput } from "@/lib/currency";

interface TransactionItem {
  id: string;
  couple_id: string;
  title: string;
  description?: string | null;
  amount: number;
  type: "expense" | "income";
  category_id?: string | null;
  paid_by: string;
  split_method: string;
  transaction_date: string;
  created_by: string;
  creator_name?: string | null;
  updated_by?: string | null;
  updater_name?: string | null;
  created_at: string;
  updated_at?: string | null;
}

const CATEGORIES = [
  { name: "Makan & Kencan", icon: "restaurant", color: "bg-secondary-container" },
  { name: "Groceries & Rumah", icon: "shopping_bag", color: "bg-[#FDE047]" },
  { name: "Transportasi", icon: "directions_car", color: "bg-[#38BDF8]" },
  { name: "Hiburan & Nonton", icon: "live_tv", color: "bg-tertiary-container" },
  { name: "Tagihan & Utilitas", icon: "receipt", color: "bg-[#c6c9af]" },
  { name: "Kesehatan & Skincare", icon: "medical_services", color: "bg-[#FFDAD2]" },
  { name: "Gaji & Pemasukan", icon: "payments", color: "bg-[#D4F34A]" },
  { name: "Lainnya", icon: "local_mall", color: "bg-surface-container" },
];

export default function TransaksiPage() {
  const router = useRouter();
  const supabase = createClient();

  // Auth & Profile State
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url?: string } | null>(null);
  const [couple, setCouple] = useState<{ id: string; name: string; wallet_mode: string } | null>(null);
  const [partner, setPartner] = useState<{ id: string; full_name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data State
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [filterPayer, setFilterPayer] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Modal State: Create / Edit
  const [showFormModal, setShowFormModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editId, setEditId] = useState<string | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formType, setFormType] = useState<"expense" | "income">("expense");
  const [formCategory, setFormCategory] = useState("Makan & Kencan");
  const [formPaidBy, setFormPaidBy] = useState("Saya");
  const [formSplitMethod, setFormSplitMethod] = useState("fifty_fifty");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formDescription, setFormDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State: Delete Confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTx, setDeletingTx] = useState<TransactionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const myDisplayName = profile?.full_name || "Saya";
  const partnerDisplayName = partner?.full_name || "Pasangan";

  // Load Data
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
        const { data: profRow } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        const myName =
          profRow?.full_name ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Saya";

        setProfile({
          full_name: myName,
          avatar_url: profRow?.avatar_url,
        });
        setFormPaidBy(myName);

        // 2. Couple
        const { data: memberRows } = await supabase
          .from("couple_members")
          .select("couple_id, role")
          .eq("profile_id", user.id)
          .limit(1);

        const activeCoupleId = memberRows?.[0]?.couple_id;
        if (activeCoupleId) {
          const { data: cRow } = await supabase
            .from("couples")
            .select("id, name, wallet_mode")
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
        console.warn("Error loading transactions:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router, supabase]);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Open Create Form
  const handleOpenCreateModal = () => {
    setModalMode("add");
    setEditId(null);
    setFormTitle("");
    setFormAmount("");
    setFormType("expense");
    setFormCategory("Makan & Kencan");
    setFormPaidBy(myDisplayName);
    setFormSplitMethod("fifty_fifty");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormDescription("");
    setShowFormModal(true);
  };

  // Open Edit Form
  const handleOpenEditModal = (tx: TransactionItem) => {
    setModalMode("edit");
    setEditId(tx.id);
    setFormTitle(tx.title);
    setFormAmount(formatRupiahInput(tx.amount));
    setFormType(tx.type);
    setFormCategory(tx.category_id || "Makan & Kencan");
    setFormPaidBy(tx.paid_by || myDisplayName);
    setFormSplitMethod(tx.split_method || "fifty_fifty");
    setFormDate(tx.transaction_date || new Date().toISOString().slice(0, 10));
    setFormDescription(tx.description || "");
    setShowFormModal(true);
  };

  // Save (Create or Update)
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formAmount || !couple || !currentUser) return;

    const numAmount = parseRupiahInput(formAmount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setIsSubmitting(true);

    try {
      if (modalMode === "add") {
        // CREATE
        const newRecord = {
          couple_id: couple.id,
          created_by: currentUser.id,
          creator_name: myDisplayName,
          updated_by: currentUser.id,
          updater_name: myDisplayName,
          title: formTitle.trim(),
          amount: numAmount,
          type: formType,
          category_id: formCategory,
          paid_by: formPaidBy,
          split_method: formSplitMethod,
          transaction_date: formDate,
          description: formDescription.trim() || null,
        };

        const { data: inserted, error: insertErr } = await supabase
          .from("transactions")
          .insert(newRecord)
          .select("*")
          .single();

        if (insertErr) throw insertErr;

        const createdItem: TransactionItem = {
          ...inserted,
          amount: Number(inserted.amount),
        };

        setTransactions([createdItem, ...transactions]);
        showToast(`Transaksi "${formTitle}" berhasil dicatat oleh ${myDisplayName}!`);
      } else if (modalMode === "edit" && editId) {
        // UPDATE
        const updateRecord = {
          title: formTitle.trim(),
          amount: numAmount,
          type: formType,
          category_id: formCategory,
          paid_by: formPaidBy,
          split_method: formSplitMethod,
          transaction_date: formDate,
          description: formDescription.trim() || null,
          updated_by: currentUser.id,
          updater_name: myDisplayName,
          updated_at: new Date().toISOString(),
        };

        const { error: updateErr } = await supabase
          .from("transactions")
          .update(updateRecord)
          .eq("id", editId);

        if (updateErr) throw updateErr;

        setTransactions(
          transactions.map((t) =>
            t.id === editId
              ? {
                  ...t,
                  ...updateRecord,
                }
              : t
          )
        );
        showToast(`Transaksi "${formTitle}" berhasil diperbarui oleh ${myDisplayName}!`);
      }

      setShowFormModal(false);
    } catch (err: unknown) {
      let msg = "Gagal menyimpan transaksi";
      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        msg = String((err as { message: unknown }).message);
      }
      console.error("Error saving transaction:", err);
      alert(`Terjadi kesalahan: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Delete Prompt
  const handlePromptDelete = (tx: TransactionItem) => {
    setDeletingTx(tx);
    setShowDeleteModal(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingTx) return;
    setIsDeleting(true);

    try {
      const { error: delErr } = await supabase
        .from("transactions")
        .delete()
        .eq("id", deletingTx.id);

      if (delErr) throw delErr;

      setTransactions(transactions.filter((t) => t.id !== deletingTx.id));
      showToast(`Transaksi "${deletingTx.title}" telah dihapus.`);
      setShowDeleteModal(false);
      setDeletingTx(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus transaksi";
      alert(`Terjadi kesalahan: ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Computed Summaries
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

  // Filtered List
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchCat = t.category_id?.toLowerCase().includes(q) || false;
        const matchCreator = t.creator_name?.toLowerCase().includes(q) || false;
        const matchUpdater = t.updater_name?.toLowerCase().includes(q) || false;
        if (!matchTitle && !matchCat && !matchCreator && !matchUpdater) return false;
      }
      // Type
      if (filterType !== "all" && t.type !== filterType) return false;
      // Payer
      if (filterPayer !== "all") {
        if (filterPayer === "mine" && t.paid_by !== myDisplayName && t.paid_by !== "Saya") return false;
        if (filterPayer === "partner" && t.paid_by !== partnerDisplayName && t.paid_by !== "Pasangan") return false;
      }
      // Category
      if (filterCategory !== "all" && t.category_id !== filterCategory) return false;

      return true;
    });
  }, [transactions, searchQuery, filterType, filterPayer, filterCategory, myDisplayName, partnerDisplayName]);

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen selection:bg-primary-container selection:text-black">
      {/* FLOATING TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#D4F34A] border-[3px] border-black shadow-[4px_4px_0px_#000] p-3.5 rounded-lg flex items-center gap-2 font-headline-sm uppercase font-bold text-on-surface animate-bounce">
          <span className="material-symbols-outlined text-[20px]">
            check_circle
          </span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* REUSABLE SIDEBAR */}
      <AppSidebar
        activeNav="transaksi"
        coupleName={couple?.name || `Dompet ${myDisplayName}`}
        partnerName={partner?.full_name}
        isPartnerConnected={Boolean(partner)}
      />

      {/* MAIN CONTENT AREA */}
      <div className="pl-0 md:pl-60 pb-20 md:pb-12 min-h-screen">
        {/* TOP BAR FIXED HEADER */}
        <header className="fixed top-0 left-0 md:left-60 right-0 h-16 bg-surface-container-lowest border-b-[3px] border-black z-40 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
            <span className="font-label-badge text-label-badge uppercase px-2.5 sm:px-3 py-1 bg-[#D4F34A] text-on-surface border-[2px] border-black shadow-[2px_2px_0px_#000] rounded-sm font-black flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-sm">receipt_long</span>
              <span className="truncate">TRANSAKSI</span>
            </span>
            <span className="hidden sm:inline font-body-sm text-xs text-on-surface-variant font-bold truncate">
              • {couple?.name || "Dompet Bersama"}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleOpenCreateModal}
              className="bg-primary-container text-on-surface border-[3px] border-black px-3 sm:px-4 py-1.5 rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span className="hidden sm:inline">Catat Transaksi</span>
              <span className="sm:hidden">Catat</span>
            </button>
          </div>
        </header>

        {/* MAIN BODY */}
        <main className="pt-24 pb-16 px-6 sm:px-8 max-w-7xl mx-auto space-y-8">
          {/* 1. HERO METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Transaksi */}
            <div className="bg-surface-container-lowest border-[3px] border-black rounded-lg p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                  TOTAL TERCATAT
                </span>
                <span className="w-8 h-8 rounded bg-surface-container border-2 border-black flex items-center justify-center font-bold text-sm">
                  #
                </span>
              </div>
              <div className="mt-3">
                <div className="font-numeric-stat text-3xl font-black">
                  {transactions.length}
                </div>
                <div className="font-body-sm text-xs text-on-surface-variant font-bold mt-0.5">
                  Transaksi tersimpan di dompet
                </div>
              </div>
            </div>

            {/* Total Pengeluaran */}
            <div className="bg-secondary-container/40 border-[3px] border-black rounded-lg p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                  TOTAL PENGELUARAN
                </span>
                <span className="w-8 h-8 rounded bg-[#ffdad6] text-[#ba1a1a] border-2 border-black flex items-center justify-center font-bold text-sm">
                  ↓
                </span>
              </div>
              <div className="mt-3">
                <div className="font-numeric-stat text-3xl font-black text-[#ba1a1a]">
                  Rp {totalExpense.toLocaleString("id-ID")}
                </div>
                <div className="font-body-sm text-xs text-on-surface-variant font-bold mt-0.5">
                  {transactions.filter((t) => t.type === "expense").length} pengeluaran bersama
                </div>
              </div>
            </div>

            {/* Total Pemasukan */}
            <div className="bg-[#D4F34A]/30 border-[3px] border-black rounded-lg p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                  TOTAL PEMASUKAN
                </span>
                <span className="w-8 h-8 rounded bg-[#D4F34A] border-2 border-black flex items-center justify-center font-bold text-sm">
                  ↑
                </span>
              </div>
              <div className="mt-3">
                <div className="font-numeric-stat text-3xl font-black text-[#15803d]">
                  Rp {totalIncome.toLocaleString("id-ID")}
                </div>
                <div className="font-body-sm text-xs text-on-surface-variant font-bold mt-0.5">
                  {transactions.filter((t) => t.type === "income").length} pemasukan / top-up
                </div>
              </div>
            </div>
          </div>

          {/* 2. FILTER & SEARCH TOOLBAR */}
          <div className="bg-surface-container-lowest border-[3px] border-black rounded-lg p-4 shadow-[4px_4px_0px_#000] space-y-4">
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Cari transaksi, merchant, nama penginput atau pengedit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border-[2px] border-black rounded font-body-md font-bold text-sm bg-white focus:outline-none focus:shadow-[3px_3px_0px_#000] transition-shadow"
                />
              </div>

              {/* Type Pills */}
              <div className="flex items-center gap-1.5 w-full md:w-auto">
                <button
                  onClick={() => setFilterType("all")}
                  className={`px-3 py-2 border-2 border-black rounded font-headline-sm uppercase text-xs font-black transition-all cursor-pointer ${
                    filterType === "all"
                      ? "bg-primary-container shadow-[2px_2px_0px_#000]"
                      : "bg-white hover:bg-surface-container-low"
                  }`}
                >
                  Semua ({transactions.length})
                </button>
                <button
                  onClick={() => setFilterType("expense")}
                  className={`px-3 py-2 border-2 border-black rounded font-headline-sm uppercase text-xs font-black transition-all cursor-pointer ${
                    filterType === "expense"
                      ? "bg-[#ffdad6] text-[#ba1a1a] shadow-[2px_2px_0px_#000]"
                      : "bg-white hover:bg-surface-container-low"
                  }`}
                >
                  Pengeluaran
                </button>
                <button
                  onClick={() => setFilterType("income")}
                  className={`px-3 py-2 border-2 border-black rounded font-headline-sm uppercase text-xs font-black transition-all cursor-pointer ${
                    filterType === "income"
                      ? "bg-[#D4F34A] shadow-[2px_2px_0px_#000]"
                      : "bg-white hover:bg-surface-container-low"
                  }`}
                >
                  Pemasukan
                </button>
              </div>

              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full md:w-auto border-2 border-black rounded px-3 py-2 bg-white font-headline-sm uppercase text-xs font-bold cursor-pointer focus:outline-none"
              >
                <option value="all">Semua Kategori</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. TRANSACTIONS LIST / TABLE */}
          <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl shadow-[6px_6px_0px_#000] overflow-hidden">
            {/* Table Header Controls */}
            <div className="p-4 border-b-[3px] border-black bg-surface-container-low flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl">
                  format_list_bulleted
                </span>
                <h2 className="font-headline-sm uppercase font-black text-sm">
                  Daftar Transaksi ({filteredTransactions.length})
                </h2>
              </div>

              <div className="font-body-sm text-xs text-on-surface-variant font-bold">
                Menampilkan transaksi resmi berdua yang tersinkronisasi ke Dashboard.
              </div>
            </div>

            {isLoading ? (
              <div className="p-12 text-center font-headline-sm uppercase font-bold animate-pulse">
                Memuat data transaksi...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary-container border-2 border-black mx-auto flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">
                    search_off
                  </span>
                </div>
                <div className="font-headline-sm uppercase font-black text-base">
                  Tidak Ada Transaksi Ditemukan
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant max-w-sm mx-auto font-semibold">
                  {searchQuery || filterType !== "all" || filterCategory !== "all"
                    ? "Coba ubah filter pencarian untuk melihat transaksi lainnya."
                    : "Mulai catat pengeluaran atau pemasukan bersama kamu sekarang!"}
                </p>
                <button
                  onClick={handleOpenCreateModal}
                  className="mt-2 bg-primary-container text-black border-2 border-black px-4 py-2 rounded font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] hover:bg-[#a6e6ff] cursor-pointer"
                >
                  + Tambah Transaksi Pertama
                </button>
              </div>
            ) : (
              <div className="divide-y-2 divide-black/15">
                {filteredTransactions.map((tx) => {
                  const catObj =
                    CATEGORIES.find((c) => c.name === tx.category_id) || {
                      name: tx.category_id || "Lainnya",
                      icon: "receipt_long",
                      color: "bg-surface-container",
                    };

                  return (
                    <div
                      key={tx.id}
                      className="p-4 sm:p-5 hover:bg-surface-container-low/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: Icon & Details */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-lg border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000] ${catObj.color}`}
                        >
                          <span className="material-symbols-outlined text-2xl">
                            {catObj.icon}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-headline-sm text-base sm:text-lg font-black uppercase text-on-surface truncate">
                              {tx.title}
                            </span>
                            <span className="font-label-badge text-[10px] bg-white border border-black px-1.5 py-0.5 rounded font-black uppercase">
                              {catObj.name}
                            </span>
                          </div>

                          {tx.description && (
                            <p className="font-body-sm text-xs text-on-surface-variant line-clamp-1 font-semibold">
                              {tx.description}
                            </p>
                          )}

                          {/* AUDITING USER INFO (PEMBERI CATATAN & PENGEDIT) */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 font-body-sm text-[11px]">
                            {/* Input User Pill */}
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high border-2 border-black text-on-surface font-black shadow-[1.5px_1.5px_0px_#000]">
                              <span className="w-4 h-4 rounded-full bg-[#38BDF8] border border-black flex items-center justify-center text-[9px] font-black text-black">
                                {(tx.creator_name || (currentUser && tx.created_by === currentUser.id ? myDisplayName : partnerDisplayName)).charAt(0).toUpperCase()}
                              </span>
                              <span>Diinput oleh: <strong className="text-black">{tx.creator_name || (currentUser && tx.created_by === currentUser.id ? myDisplayName : partnerDisplayName)}</strong></span>
                            </span>

                            {/* Edit User Pill (if updated) */}
                            {Boolean(tx.updater_name && (tx.updater_name !== tx.creator_name || tx.updated_at)) && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FEF3C7] border-2 border-black text-amber-950 font-black shadow-[1.5px_1.5px_0px_#000]">
                                <span className="material-symbols-outlined text-[14px] text-amber-700">
                                  edit_note
                                </span>
                                <span>Diedit oleh: <strong className="text-amber-900">{tx.updater_name}</strong></span>
                              </span>
                            )}

                            {/* Date & Split Badges */}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-black text-on-surface-variant font-bold text-[10px]">
                              <span className="material-symbols-outlined text-[13px]">
                                calendar_today
                              </span>
                              <span>{tx.transaction_date}</span>
                            </span>

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-black text-on-surface-variant font-bold text-[10px]">
                              <span className="material-symbols-outlined text-[13px]">payments</span>
                              <span>Dibayar: <strong>{tx.paid_by}</strong> ({tx.split_method === "fifty_fifty" ? "50:50" : tx.split_method === "proportional" ? "60:40" : "Penuh"})</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Nominal & Action Buttons */}
                      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-black/10">
                        <div className="text-left md:text-right">
                          <div
                            className={`font-numeric-stat text-xl sm:text-2xl font-black ${
                              tx.type === "income"
                                ? "text-[#15803d]"
                                : "text-on-surface"
                            }`}
                          >
                            {tx.type === "income" ? "+" : "-"} Rp{" "}
                            {tx.amount.toLocaleString("id-ID")}
                          </div>
                          <span
                            className={`font-label-badge text-[10px] uppercase font-black px-1.5 py-0.5 border border-black rounded inline-block ${
                              tx.type === "income"
                                ? "bg-[#D4F34A]"
                                : "bg-secondary-container"
                            }`}
                          >
                            {tx.type === "income" ? "Pemasukan" : "Pengeluaran"}
                          </span>
                        </div>

                        {/* Action Buttons: Edit & Delete */}
                        <div className="flex items-center gap-1.5 ml-2">
                          <button
                            onClick={() => handleOpenEditModal(tx)}
                            className="w-9 h-9 bg-white hover:bg-primary-container border-2 border-black rounded shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-all cursor-pointer"
                            title="Edit Transaksi"
                          >
                            <span className="material-symbols-outlined text-lg">
                              edit
                            </span>
                          </button>
                          <button
                            onClick={() => handlePromptDelete(tx)}
                            className="w-9 h-9 bg-white hover:bg-[#ffdad6] text-[#ba1a1a] border-2 border-black rounded shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-all cursor-pointer"
                            title="Hapus Transaksi"
                          >
                            <span className="material-symbols-outlined text-lg">
                              delete
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* MODAL: TAMBAH / EDIT TRANSAKSI */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-container-lowest border-[4px] border-black shadow-[8px_8px_0px_#000000] rounded-xl p-6 sm:p-8 max-w-lg w-full relative my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowFormModal(false)}
              className="absolute top-4 right-4 w-8 h-8 border-2 border-black rounded bg-[#FDE047] flex items-center justify-center font-bold text-sm shadow-[2px_2px_0px_#000] hover:bg-white cursor-pointer"
            >
              ✕
            </button>

            <div className="border-b-[3px] border-black pb-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-9 h-9 bg-primary-container border-2 border-black rounded flex items-center justify-center shadow-[2px_2px_0px_#000]">
                  <span className="material-symbols-outlined text-xl">
                    {modalMode === "add" ? "add_card" : "edit_note"}
                  </span>
                </span>
                <div>
                  <h3 className="font-headline-md uppercase font-black text-xl">
                    {modalMode === "add"
                      ? "Catat Transaksi Baru"
                      : "Edit Transaksi"}
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant font-bold">
                    Kelola data pengeluaran dan pemasukan bersama
                  </p>
                </div>
              </div>

              {/* Audit Banner */}
              {modalMode === "add" ? (
                <div className="bg-[#eff6ff] border-2 border-[#1e40af] p-2.5 rounded text-xs flex items-center gap-2 font-bold text-[#1e3a8a]">
                  <span className="material-symbols-outlined text-base text-[#2563eb]">
                    person
                  </span>
                  <span>Transaksi akan dicatat &amp; diinput oleh: <u className="text-black">{myDisplayName}</u></span>
                </div>
              ) : (
                <div className="bg-[#fffbeb] border-2 border-[#b45309] p-2.5 rounded text-xs flex flex-wrap items-center justify-between gap-2 font-bold text-[#78350f]">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-[#b45309]">
                      fingerprint
                    </span>
                    <span>
                      Dibuat oleh:{" "}
                      <u className="text-black">
                        {transactions.find((t) => t.id === editId)?.creator_name || "Anggota"}
                      </u>
                    </span>
                  </div>
                  <div className="text-[11px] bg-white px-2 py-0.5 border border-[#b45309] rounded">
                    Diedit oleh: <u className="text-black">{myDisplayName}</u>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-4">
              {/* Type Switch: Pengeluaran vs Pemasukan */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormType("expense")}
                  className={`py-2.5 border-[3px] border-black rounded font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer transition-all ${
                    formType === "expense"
                      ? "bg-secondary-container text-black"
                      : "bg-white hover:bg-slate-100"
                  }`}
                >
                  Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() => setFormType("income")}
                  className={`py-2.5 border-[3px] border-black rounded font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer transition-all ${
                    formType === "income"
                      ? "bg-[#D4F34A] text-black"
                      : "bg-white hover:bg-slate-100"
                  }`}
                >
                  Pemasukan
                </button>
              </div>

              {/* Judul */}
              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Judul Transaksi / Nama Toko
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Belanja Bulanan Superindo"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border-[3px] border-black rounded p-3 font-body-md font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                />
              </div>

              {/* Nominal */}
              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Nominal (Rp) • <span className="text-primary lowercase font-normal">titik otomatis</span>
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
                    value={formAmount}
                    onChange={(e) => setFormAmount(formatRupiahInput(e.target.value))}
                    className="w-full pl-12 pr-4 py-3 border-[3px] border-black rounded font-numeric-stat text-2xl font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                  />
                </div>
              </div>

              {/* Kategori & Tanggal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                    Kategori
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full border-[3px] border-black rounded p-3 font-body-md font-bold bg-white cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full border-[3px] border-black rounded p-3 font-body-md font-bold bg-white"
                  />
                </div>
              </div>

              {/* Dibayar Oleh & Aturan Split */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                    Dibayar Oleh
                  </label>
                  <select
                    value={formPaidBy}
                    onChange={(e) => setFormPaidBy(e.target.value)}
                    className="w-full border-[3px] border-black rounded p-3 font-body-md font-bold bg-white cursor-pointer"
                  >
                    <option value={myDisplayName}>{myDisplayName} (Saya)</option>
                    <option value={partnerDisplayName}>{partnerDisplayName} (Pasangan)</option>
                    <option value="Keduanya">Keduanya (Setoran Bersama)</option>
                  </select>
                </div>

                <div>
                  <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                    Aturan Split
                  </label>
                  <select
                    value={formSplitMethod}
                    onChange={(e) => setFormSplitMethod(e.target.value)}
                    className="w-full border-[3px] border-black rounded p-3 font-body-md font-bold bg-white cursor-pointer"
                  >
                    <option value="fifty_fifty">Split 50 : 50</option>
                    <option value="proportional">Proporsional (60 : 40)</option>
                    <option value="full_by_payer">Ditanggung Penuh</option>
                  </select>
                </div>
              </div>

              {/* Keterangan / Deskripsi */}
              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Catatan / Keterangan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full border-[3px] border-black rounded p-2.5 font-body-md font-medium focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="flex-1 py-3 bg-surface-container border-[3px] border-black rounded font-headline-sm uppercase font-bold text-xs hover:bg-surface-container-high cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-2 py-3 bg-primary-container text-black border-[3px] border-black rounded font-headline-sm uppercase font-black text-sm shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Menyimpan..."
                    : modalMode === "add"
                    ? "Simpan Transaksi"
                    : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS */}
      {showDeleteModal && deletingTx && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border-[4px] border-black shadow-[8px_8px_0px_#000000] rounded-xl p-6 max-w-sm w-full relative">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-[#ffdad6] text-[#ba1a1a] border-2 border-black mx-auto flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-2xl">
                  delete_forever
                </span>
              </div>
              <h3 className="font-headline-md uppercase font-black text-lg">
                Hapus Transaksi?
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant mt-1 font-semibold leading-relaxed">
                Apakah kamu yakin ingin menghapus transaksi <strong>&quot;{deletingTx.title}&quot;</strong> senilai{" "}
                <strong>Rp {deletingTx.amount.toLocaleString("id-ID")}</strong>?
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingTx(null);
                }}
                className="flex-1 py-2.5 bg-surface-container border-2 border-black rounded font-headline-sm uppercase font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-[#ffdad6] text-[#ba1a1a] border-2 border-black rounded font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] hover:bg-[#ffb4ab] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
