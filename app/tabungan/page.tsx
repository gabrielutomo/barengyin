"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { formatRupiahInput, parseRupiahInput } from "@/lib/currency";

interface SavingsGoalItem {
  id: string;
  couple_id: string;
  name: string;
  icon: string;
  target_amount: number;
  current_amount: number;
  target_date?: string | null;
  status: "active" | "achieved" | "archived";
  created_by?: string | null;
  creator_name?: string | null;
  updated_by?: string | null;
  updater_name?: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface ContributionItem {
  id: string;
  savings_goal_id: string;
  profile_id: string;
  contributor_name: string;
  notes?: string | null;
  amount: number;
  contributed_at: string;
}

const GOAL_ICONS = [
  { name: "favorite", label: "Pernikahan & Cinta", color: "bg-secondary-container" },
  { name: "flight", label: "Liburan & Traveling", color: "bg-[#38BDF8]" },
  { name: "home", label: "DP Rumah & Hunian", color: "bg-[#FDE047]" },
  { name: "savings", label: "Dana Darurat Bersama", color: "bg-[#D4F34A]" },
  { name: "directions_car", label: "Kendaraan Impian", color: "bg-tertiary-container" },
  { name: "child_friendly", label: "Persiapan Buah Hati", color: "bg-[#FFDAD2]" },
  { name: "celebration", label: "Target / Hadiah Spesial", color: "bg-[#c6c9af]" },
];

export default function TabunganPage() {
  const router = useRouter();
  const supabase = createClient();

  // Auth & Profile State
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [couple, setCouple] = useState<{ id: string; name: string } | null>(null);
  const [partner, setPartner] = useState<{ id: string; full_name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data State
  const [goals, setGoals] = useState<SavingsGoalItem[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "achieved">("all");

  // Modal State: Create / Edit Goal
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editId, setEditId] = useState<string | null>(null);

  // Goal Form Fields
  const [formName, setFormName] = useState("");
  const [formTargetAmount, setFormTargetAmount] = useState("");
  const [formInitialAmount, setFormInitialAmount] = useState("");
  const [formTargetDate, setFormTargetDate] = useState("");
  const [formIcon, setFormIcon] = useState("savings");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State: Deposit Contribution (+ Nabung)
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositGoal, setDepositGoal] = useState<SavingsGoalItem | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositContributor, setDepositContributor] = useState("Saya");
  const [depositNotes, setDepositNotes] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);

  // Modal State: Delete Confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState<SavingsGoalItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal State: Contribution History (Audit Log Penyetor)
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyGoal, setHistoryGoal] = useState<SavingsGoalItem | null>(null);
  const [contributions, setContributions] = useState<ContributionItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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

        setProfile({ full_name: myName });
        setDepositContributor(myName);

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

          // 3. Savings Goals
          const { data: goalRows } = await supabase
            .from("savings_goals")
            .select("*")
            .eq("couple_id", activeCoupleId)
            .order("created_at", { ascending: false });

          if (goalRows) {
            setGoals(
              goalRows.map((g) => ({
                ...g,
                target_amount: Number(g.target_amount),
                current_amount: Number(g.current_amount),
              }))
            );
          }
        }
      } catch (err) {
        console.warn("Error loading savings goals:", err);
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

  // Open Create Goal Modal
  const handleOpenCreateGoal = () => {
    setModalMode("add");
    setEditId(null);
    setFormName("");
    setFormTargetAmount("");
    setFormInitialAmount("");
    setFormTargetDate("");
    setFormIcon("savings");
    setShowGoalModal(true);
  };

  // Open Edit Goal Modal
  const handleOpenEditGoal = (goal: SavingsGoalItem) => {
    setModalMode("edit");
    setEditId(goal.id);
    setFormName(goal.name);
    setFormTargetAmount(formatRupiahInput(goal.target_amount));
    setFormInitialAmount(formatRupiahInput(goal.current_amount));
    setFormTargetDate(goal.target_date || "");
    setFormIcon(goal.icon || "savings");
    setShowGoalModal(true);
  };

  // Save Goal (Create or Update)
  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formTargetAmount || !couple || !currentUser) return;

    const numTarget = parseRupiahInput(formTargetAmount);
    const numInitial = parseRupiahInput(formInitialAmount);
    if (isNaN(numTarget) || numTarget <= 0) return;

    setIsSubmitting(true);

    try {
      if (modalMode === "add") {
        // CREATE
        const newGoal = {
          couple_id: couple.id,
          name: formName.trim(),
          icon: formIcon,
          target_amount: numTarget,
          current_amount: numInitial || 0,
          target_date: formTargetDate || null,
          status: (numInitial >= numTarget ? "achieved" : "active") as "active" | "achieved",
          created_by: currentUser.id,
          creator_name: myDisplayName,
          updated_by: currentUser.id,
          updater_name: myDisplayName,
        };

        const { data: inserted, error: insertErr } = await supabase
          .from("savings_goals")
          .insert(newGoal)
          .select("*")
          .single();

        if (insertErr) throw insertErr;

        const createdItem: SavingsGoalItem = {
          ...inserted,
          target_amount: Number(inserted.target_amount),
          current_amount: Number(inserted.current_amount),
        };

        setGoals([createdItem, ...goals]);
        showToast(`Target tabungan "${formName}" berhasil dibuat oleh ${myDisplayName}!`);
      } else if (modalMode === "edit" && editId) {
        // UPDATE
        const updateGoal = {
          name: formName.trim(),
          icon: formIcon,
          target_amount: numTarget,
          target_date: formTargetDate || null,
          updated_by: currentUser.id,
          updater_name: myDisplayName,
          updated_at: new Date().toISOString(),
        };

        const { error: updateErr } = await supabase
          .from("savings_goals")
          .update(updateGoal)
          .eq("id", editId);

        if (updateErr) throw updateErr;

        setGoals(
          goals.map((g) =>
            g.id === editId
              ? {
                  ...g,
                  ...updateGoal,
                  status: g.current_amount >= numTarget ? "achieved" : "active",
                }
              : g
          )
        );
        showToast(`Target tabungan "${formName}" berhasil diperbarui oleh ${myDisplayName}!`);
      }

      setShowGoalModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan target tabungan";
      alert(`Terjadi kesalahan: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Deposit Modal (+ Nabung Bareng)
  const handleOpenDepositModal = (goal: SavingsGoalItem) => {
    setDepositGoal(goal);
    setDepositAmount("");
    setDepositContributor(myDisplayName);
    setDepositNotes("");
    setShowDepositModal(true);
  };

  // Submit Deposit
  const handleSaveDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositGoal || !depositAmount || !currentUser) return;

    const numDeposit = parseRupiahInput(depositAmount);
    if (isNaN(numDeposit) || numDeposit <= 0) return;

    setIsDepositing(true);

    try {
      const newCurrentAmount = depositGoal.current_amount + numDeposit;
      const isNowAchieved = newCurrentAmount >= depositGoal.target_amount;

      // 1. Update savings_goals current_amount
      const { error: updateErr } = await supabase
        .from("savings_goals")
        .update({
          current_amount: newCurrentAmount,
          status: isNowAchieved ? "achieved" : depositGoal.status,
          updated_by: currentUser.id,
          updater_name: depositContributor,
          updated_at: new Date().toISOString(),
        })
        .eq("id", depositGoal.id);

      if (updateErr) throw updateErr;

      // 2. Insert contribution history
      try {
        await supabase.from("savings_contributions").insert({
          savings_goal_id: depositGoal.id,
          profile_id: currentUser.id,
          contributor_name: depositContributor,
          notes: depositNotes.trim() || null,
          amount: numDeposit,
        });
      } catch {
        // graceful if table doesn't have all columns yet
      }

      // 3. Update local state
      setGoals(
        goals.map((g) =>
          g.id === depositGoal.id
            ? {
                ...g,
                current_amount: newCurrentAmount,
                status: isNowAchieved ? "achieved" : g.status,
                updater_name: depositContributor,
                updated_at: new Date().toISOString(),
              }
            : g
        )
      );

      showToast(
        `Setoran Rp ${numDeposit.toLocaleString("id-ID")} berhasil ditambahkan oleh ${depositContributor}!`
      );
      setShowDepositModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menambah setoran tabungan";
      alert(`Terjadi kesalahan: ${msg}`);
    } finally {
      setIsDepositing(false);
    }
  };

  // Open Delete Prompt
  const handlePromptDelete = (goal: SavingsGoalItem) => {
    setDeletingGoal(goal);
    setShowDeleteModal(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingGoal) return;
    setIsDeleting(true);

    try {
      const { error: delErr } = await supabase
        .from("savings_goals")
        .delete()
        .eq("id", deletingGoal.id);

      if (delErr) throw delErr;

      setGoals(goals.filter((g) => g.id !== deletingGoal.id));
      showToast(`Target "${deletingGoal.name}" telah dihapus.`);
      setShowDeleteModal(false);
      setDeletingGoal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus target tabungan";
      alert(`Terjadi kesalahan: ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Contribution History Modal (Audit Log Penyetor)
  const handleOpenHistoryModal = async (goal: SavingsGoalItem) => {
    setHistoryGoal(goal);
    setShowHistoryModal(true);
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("savings_contributions")
        .select("*")
        .eq("savings_goal_id", goal.id)
        .order("contributed_at", { ascending: false });

      if (!error && data) {
        setContributions(
          data.map((c) => ({
            ...c,
            amount: Number(c.amount),
          }))
        );
      } else {
        setContributions([]);
      }
    } catch {
      setContributions([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Computed Summaries
  const totalSaved = useMemo(
    () => goals.reduce((sum, g) => sum + g.current_amount, 0),
    [goals]
  );

  const totalTarget = useMemo(
    () => goals.reduce((sum, g) => sum + g.target_amount, 0),
    [goals]
  );

  const overallProgress = totalTarget > 0 ? Math.min(Math.round((totalSaved / totalTarget) * 100), 100) : 0;

  // Filtered Goals
  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = g.name.toLowerCase().includes(q);
        const matchCreator = g.creator_name?.toLowerCase().includes(q) || false;
        const matchUpdater = g.updater_name?.toLowerCase().includes(q) || false;
        if (!matchName && !matchCreator && !matchUpdater) return false;
      }
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      return true;
    });
  }, [goals, searchQuery, statusFilter]);

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
        activeNav="tabungan"
        coupleName={couple?.name || `Dompet ${myDisplayName}`}
        partnerName={partner?.full_name}
        isPartnerConnected={Boolean(partner)}
      />

      {/* MAIN CONTENT AREA */}
      <div className="pl-0 md:pl-60 pb-20 md:pb-12 min-h-screen">
        {/* TOP BAR FIXED HEADER */}
        <header className="fixed top-0 left-0 md:left-60 right-0 h-16 bg-surface-container-lowest border-b-[3px] border-black z-40 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
            <span className="font-label-badge text-label-badge uppercase px-2.5 sm:px-3 py-1 bg-[#FDE047] text-on-surface border-[2px] border-black shadow-[2px_2px_0px_#000] rounded-sm font-black flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-sm">savings</span>
              <span className="truncate">TABUNGAN BERSAMA</span>
            </span>
            <span className="hidden sm:inline font-body-sm text-xs text-on-surface-variant font-bold truncate">
              • {couple?.name || "Dompet Bersama"}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleOpenCreateGoal}
              className="bg-primary-container text-on-surface border-2 sm:border-[3px] border-black px-2.5 sm:px-4 py-1.5 rounded font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] sm:shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center gap-1 shrink-0"
            >
              <span className="material-symbols-outlined text-sm sm:text-base">add</span>
              <span className="hidden sm:inline">Buat Target Tabungan</span>
              <span className="sm:hidden">Target</span>
            </button>
          </div>
        </header>

        {/* MAIN BODY */}
        <main className="pt-20 sm:pt-24 pb-20 md:pb-16 px-3 sm:px-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* 1. HERO FINANCIAL GOALS METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Terkumpul */}
            <div className="bg-[#D4F34A]/30 border-[3px] border-black rounded-lg p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                  TOTAL TERKUMPUL
                </span>
                <span className="w-8 h-8 rounded bg-[#D4F34A] border-2 border-black flex items-center justify-center font-bold text-sm">
                  💰
                </span>
              </div>
              <div className="mt-3">
                <div className="font-numeric-stat text-2xl sm:text-3xl font-black text-[#15803d]">
                  Rp {totalSaved.toLocaleString("id-ID")}
                </div>
                <div className="font-body-sm text-xs text-on-surface-variant font-bold mt-0.5">
                  Dari semua target bersama
                </div>
              </div>
            </div>

            {/* Total Target */}
            <div className="bg-surface-container-lowest border-[3px] border-black rounded-lg p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                  TOTAL TARGET IMPIAN
                </span>
                <span className="w-8 h-8 rounded bg-surface-container border-2 border-black flex items-center justify-center font-bold text-sm">
                  🎯
                </span>
              </div>
              <div className="mt-3">
                <div className="font-numeric-stat text-2xl sm:text-3xl font-black">
                  Rp {totalTarget.toLocaleString("id-ID")}
                </div>
                <div className="font-body-sm text-xs text-on-surface-variant font-bold mt-0.5">
                  Akumulasi {goals.length} target
                </div>
              </div>
            </div>

            {/* Rata-Rata Capaian */}
            <div className="bg-secondary-container/40 border-[3px] border-black rounded-lg p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                  RATA-RATA PROGRES
                </span>
                <span className="w-8 h-8 rounded bg-secondary-container border-2 border-black flex items-center justify-center font-bold text-sm">
                  %
                </span>
              </div>
              <div className="mt-3">
                <div className="font-numeric-stat text-2xl sm:text-3xl font-black text-secondary">
                  {overallProgress}%
                </div>
                <div className="font-body-sm text-xs text-on-surface-variant font-bold mt-0.5">
                  Pencapaian keseluruhan
                </div>
              </div>
            </div>

            {/* Target Tercapai */}
            <div className="bg-primary-container/30 border-[3px] border-black rounded-lg p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-badge text-xs uppercase font-black text-on-surface-variant">
                  TARGET TERCAPAI
                </span>
                <span className="w-8 h-8 rounded bg-[#22C55E] text-white border-2 border-black flex items-center justify-center font-bold text-sm">
                  ✓
                </span>
              </div>
              <div className="mt-3">
                <div className="font-numeric-stat text-2xl sm:text-3xl font-black text-primary">
                  {goals.filter((g) => g.status === "achieved").length} / {goals.length}
                </div>
                <div className="font-body-sm text-xs text-on-surface-variant font-bold mt-0.5">
                  Impian selesai terpenuhi
                </div>
              </div>
            </div>
          </div>

          {/* 2. FILTER & CONTROLS */}
          <div className="bg-surface-container-lowest border-[3px] border-black rounded-lg p-4 shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
                search
              </span>
              <input
                type="text"
                placeholder="Cari target impian, nama pembuat atau penyetor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-[2px] border-black rounded font-body-md font-bold text-sm bg-white focus:outline-none focus:shadow-[3px_3px_0px_#000] transition-shadow"
              />
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-2 border-2 border-black rounded font-headline-sm uppercase text-xs font-black transition-all cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-primary-container shadow-[2px_2px_0px_#000]"
                    : "bg-white hover:bg-surface-container-low"
                }`}
              >
                Semua ({goals.length})
              </button>
              <button
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-2 border-2 border-black rounded font-headline-sm uppercase text-xs font-black transition-all cursor-pointer ${
                  statusFilter === "active"
                    ? "bg-[#FDE047] shadow-[2px_2px_0px_#000]"
                    : "bg-white hover:bg-surface-container-low"
                }`}
              >
                Sedang Nabung
              </button>
              <button
                onClick={() => setStatusFilter("achieved")}
                className={`px-3 py-2 border-2 border-black rounded font-headline-sm uppercase text-xs font-black transition-all cursor-pointer ${
                  statusFilter === "achieved"
                    ? "bg-[#D4F34A] shadow-[2px_2px_0px_#000]"
                    : "bg-white hover:bg-surface-container-low"
                }`}
              >
                Tercapai 🎉
              </button>
            </div>
          </div>

          {/* 3. GRID KARTU TARGET TABUNGAN */}
          {isLoading ? (
            <div className="p-16 text-center font-headline-sm uppercase font-bold animate-pulse">
              Memuat data target tabungan bersama...
            </div>
          ) : filteredGoals.length === 0 ? (
            <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl p-12 text-center shadow-[6px_6px_0px_#000] space-y-3">
              <div className="w-16 h-16 rounded-full bg-primary-container border-[3px] border-black mx-auto flex items-center justify-center shadow-[3px_3px_0px_#000]">
                <span className="material-symbols-outlined text-3xl">
                  savings
                </span>
              </div>
              <h3 className="font-headline-md uppercase font-black text-xl">
                Belum Ada Target Tabungan
              </h3>
              <p className="font-body-sm text-sm text-on-surface-variant max-w-md mx-auto font-semibold">
                Wujudkan impian berdua seperti nikah, liburan bersama, atau DP rumah dengan menabung secara transparan dan terencana.
              </p>
              <button
                onClick={handleOpenCreateGoal}
                className="mt-3 bg-primary-container text-black border-[3px] border-black px-6 py-2.5 rounded font-headline-sm uppercase font-black text-sm shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_#000] transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined">add</span>
                <span>Buat Target Tabungan Pertama</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredGoals.map((g) => {
                const percent =
                  g.target_amount > 0
                    ? Math.min(Math.round((g.current_amount / g.target_amount) * 100), 100)
                    : 0;
                const isDone = g.status === "achieved" || percent >= 100;
                const remaining = Math.max(0, g.target_amount - g.current_amount);

                const iconObj =
                  GOAL_ICONS.find((i) => i.name === g.icon) || {
                    name: "savings",
                    label: "Tabungan",
                    color: "bg-[#D4F34A]",
                  };

                return (
                  <div
                    key={g.id}
                    className="bg-surface-container-lowest border-[4px] border-black rounded-xl p-5 sm:p-6 shadow-[6px_6px_0px_#000] flex flex-col justify-between space-y-4 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[4px_4px_0px_#000] transition-all"
                  >
                    {/* Card Top: Icon, Name & Status */}
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-lg border-[3px] border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000] ${iconObj.color}`}
                          >
                            <span className="material-symbols-outlined text-2xl text-black">
                              {iconObj.name}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-headline-md text-lg sm:text-xl font-black uppercase text-on-surface line-clamp-1">
                              {g.name}
                            </h3>
                            <div className="flex items-center gap-2 font-body-sm text-xs text-on-surface-variant font-bold mt-0.5">
                              {g.target_date && (
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-sm">
                                    event
                                  </span>
                                  <span>Tenggat: {g.target_date}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`font-label-badge text-[11px] px-2 py-0.5 border-2 border-black rounded font-black uppercase shrink-0 ${
                            isDone
                              ? "bg-[#22C55E] text-white"
                              : "bg-[#FDE047] text-black"
                          }`}
                        >
                          {isDone ? "Tercapai 🎉" : `${percent}%`}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5 my-3">
                        <div className="w-full h-5 border-[3px] border-black rounded-full bg-surface-container-low overflow-hidden p-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isDone ? "bg-[#22C55E]" : "bg-primary-container"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between font-body-sm text-xs font-bold pt-1">
                          <div>
                            <span className="text-on-surface-variant">Terkumpul: </span>
                            <strong className="text-[#15803d] font-numeric-stat text-base">
                              Rp {g.current_amount.toLocaleString("id-ID")}
                            </strong>
                          </div>
                          <div className="text-right">
                            <span className="text-on-surface-variant">Target: </span>
                            <strong className="text-black font-numeric-stat text-base">
                              Rp {g.target_amount.toLocaleString("id-ID")}
                            </strong>
                          </div>
                        </div>

                        {!isDone && (
                          <div className="font-body-sm text-[11px] text-on-surface-variant font-bold text-right">
                            Sisa target: Rp {remaining.toLocaleString("id-ID")}
                          </div>
                        )}
                      </div>

                      {/* AUDITING INFORMATION (PEMBUAT & PENGEDIT / PENYETOR) */}
                      <div className="pt-3 border-t-2 border-black/15 flex flex-wrap items-center gap-2 font-body-sm text-[11px]">
                        {/* Creator Pill */}
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high border-2 border-black text-on-surface font-black shadow-[1.5px_1.5px_0px_#000]">
                          <span className="w-4 h-4 rounded-full bg-[#38BDF8] border border-black flex items-center justify-center text-[9px] font-black text-black">
                            {(g.creator_name || (currentUser && g.created_by === currentUser.id ? myDisplayName : partnerDisplayName)).charAt(0).toUpperCase()}
                          </span>
                          <span>Target dibuat oleh: <strong className="text-black">{g.creator_name || (currentUser && g.created_by === currentUser.id ? myDisplayName : partnerDisplayName)}</strong></span>
                        </span>

                        {/* Updater / Contributor Pill */}
                        {g.updater_name && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FEF3C7] border-2 border-black text-amber-950 font-black shadow-[1.5px_1.5px_0px_#000]">
                            <span className="material-symbols-outlined text-[13px] text-amber-700">
                              history_edu
                            </span>
                            <span>Setoran / edit terakhir: <strong className="text-amber-900">{g.updater_name}</strong></span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions: Nabung, Riwayat, Edit, Hapus */}
                    <div className="pt-2 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <button
                        onClick={() => handleOpenDepositModal(g)}
                        className="flex-1 py-2.5 bg-[#D4F34A] hover:bg-[#c4e637] text-black border-[2.5px] border-black rounded-lg font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-base">
                          add_circle
                        </span>
                        <span>+ Setor Tabungan</span>
                      </button>

                      <button
                        onClick={() => handleOpenHistoryModal(g)}
                        className="px-3 py-2.5 bg-white hover:bg-surface-container border-[2.5px] border-black rounded-lg font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1"
                        title="Lihat Riwayat Penyetor"
                      >
                        <span className="material-symbols-outlined text-base text-primary">
                          receipt_long
                        </span>
                        <span className="text-[11px]">Riwayat</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditGoal(g)}
                        className="w-10 h-10 bg-white hover:bg-surface-container border-[2.5px] border-black rounded-lg shadow-[2px_2px_0px_#000] flex items-center justify-center transition-all cursor-pointer"
                        title="Edit Target"
                      >
                        <span className="material-symbols-outlined text-lg">
                          edit
                        </span>
                      </button>

                      <button
                        onClick={() => handlePromptDelete(g)}
                        className="w-10 h-10 bg-white hover:bg-[#ffdad6] text-[#ba1a1a] border-[2.5px] border-black rounded-lg shadow-[2px_2px_0px_#000] flex items-center justify-center transition-all cursor-pointer"
                        title="Hapus Target"
                      >
                        <span className="material-symbols-outlined text-lg">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* MODAL: BUAT / EDIT TARGET TABUNGAN */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-container-lowest border-[4px] border-black shadow-[8px_8px_0px_#000000] rounded-xl p-6 sm:p-8 max-w-md w-full relative my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowGoalModal(false)}
              className="absolute top-4 right-4 w-8 h-8 border-2 border-black rounded bg-[#FDE047] flex items-center justify-center font-bold text-sm shadow-[2px_2px_0px_#000] hover:bg-white cursor-pointer"
            >
              ✕
            </button>

            <div className="border-b-[3px] border-black pb-3 mb-5">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 bg-primary-container border-2 border-black rounded flex items-center justify-center shadow-[2px_2px_0px_#000]">
                  <span className="material-symbols-outlined text-xl">
                    savings
                  </span>
                </span>
                <div>
                  <h3 className="font-headline-md uppercase font-black text-xl">
                    {modalMode === "add" ? "Target Tabungan Baru" : "Edit Target Tabungan"}
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant font-bold">
                    Oleh: <span className="text-black underline">{myDisplayName}</span>
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Nama Impian / Target
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dana Pernikahan 2027"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border-[3px] border-black rounded p-3 font-body-md font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Target Nominal Total (Rp) • <span className="text-primary lowercase font-normal">titik otomatis</span>
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
                    value={formTargetAmount}
                    onChange={(e) => setFormTargetAmount(formatRupiahInput(e.target.value))}
                    className="w-full pl-12 pr-4 py-3 border-[3px] border-black rounded font-numeric-stat text-2xl font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                  />
                </div>
              </div>

              {modalMode === "add" && (
                <div>
                  <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                    Setoran Awal (Rp) — Opsional • <span className="text-primary lowercase font-normal">titik otomatis</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-headline-sm font-bold text-base text-on-surface-variant">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formInitialAmount}
                      onChange={(e) => setFormInitialAmount(formatRupiahInput(e.target.value))}
                      className="w-full pl-12 pr-4 py-3 border-[3px] border-black rounded font-numeric-stat text-xl font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Target Tanggal Tercapai (Opsional)
                </label>
                <input
                  type="date"
                  value={formTargetDate}
                  onChange={(e) => setFormTargetDate(e.target.value)}
                  className="w-full border-[3px] border-black rounded p-3 font-body-md font-bold bg-white"
                />
              </div>

              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Icon Impian
                </label>
                <select
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  className="w-full border-[3px] border-black rounded p-3 font-body-md font-bold bg-white cursor-pointer"
                >
                  {GOAL_ICONS.map((i) => (
                    <option key={i.name} value={i.name}>
                      {i.label} ({i.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
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
                    ? "Buat Target"
                    : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SETOR TABUNGAN (+ NABUNG BARENG) */}
      {showDepositModal && depositGoal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border-[4px] border-black shadow-[8px_8px_0px_#000000] rounded-xl p-6 sm:p-8 max-w-md w-full relative">
            <button
              onClick={() => setShowDepositModal(false)}
              className="absolute top-4 right-4 w-8 h-8 border-2 border-black rounded bg-[#FDE047] flex items-center justify-center font-bold text-sm shadow-[2px_2px_0px_#000] hover:bg-white cursor-pointer"
            >
              ✕
            </button>

            <div className="border-b-[3px] border-black pb-3 mb-5">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 bg-[#D4F34A] border-2 border-black rounded flex items-center justify-center shadow-[2px_2px_0px_#000]">
                  <span className="material-symbols-outlined text-xl">
                    payments
                  </span>
                </span>
                <div>
                  <h3 className="font-headline-md uppercase font-black text-xl">
                    Setor Tabungan
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant font-bold truncate max-w-[220px]">
                    Untuk: <strong className="text-black">{depositGoal.name}</strong>
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveDeposit} className="space-y-4">
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
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(formatRupiahInput(e.target.value))}
                    className="w-full pl-12 pr-4 py-3 border-[3px] border-black rounded font-numeric-stat text-2xl font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Disetor Oleh
                </label>
                <select
                  value={depositContributor}
                  onChange={(e) => setDepositContributor(e.target.value)}
                  className="w-full border-[3px] border-black rounded p-3 font-body-md font-bold bg-white cursor-pointer"
                >
                  <option value={myDisplayName}>{myDisplayName} (Saya)</option>
                  <option value={partnerDisplayName}>{partnerDisplayName} (Pasangan)</option>
                  <option value="Keduanya">Keduanya (Patungan Bersama)</option>
                </select>
              </div>

              <div>
                <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                  Catatan Setoran (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sisa THR / Bonus Projek"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  className="w-full border-[3px] border-black rounded p-3 font-body-md font-medium focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="flex-1 py-3 bg-surface-container border-[3px] border-black rounded font-headline-sm uppercase font-bold text-xs hover:bg-surface-container-high cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isDepositing}
                  className="flex-2 py-3 bg-[#D4F34A] text-black border-[3px] border-black rounded font-headline-sm uppercase font-black text-sm shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDepositing ? "Menyimpan..." : "Konfirmasi Setoran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS GOAL */}
      {showDeleteModal && deletingGoal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border-[4px] border-black shadow-[8px_8px_0px_#000000] rounded-xl p-6 max-w-sm w-full relative">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-[#ffdad6] text-[#ba1a1a] border-2 border-black mx-auto flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-2xl">
                  delete_forever
                </span>
              </div>
              <h3 className="font-headline-md uppercase font-black text-lg">
                Hapus Target Impian?
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant mt-1 font-semibold leading-relaxed">
                Apakah kamu yakin ingin menghapus target <strong>&quot;{deletingGoal.name}&quot;</strong>? Semua progres dan riwayat setoran pada target ini akan terhapus.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingGoal(null);
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

      {/* MODAL: RIWAYAT SETORAN & KONTRIBUTOR (AUDIT LOG TABUNGAN) */}
      {showHistoryModal && historyGoal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border-[4px] border-black shadow-[8px_8px_0px_#000000] rounded-xl p-6 sm:p-7 max-w-lg w-full relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => {
                setShowHistoryModal(false);
                setHistoryGoal(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 border-2 border-black rounded bg-[#FDE047] flex items-center justify-center font-bold text-sm shadow-[2px_2px_0px_#000] hover:bg-white cursor-pointer"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div className="border-b-[3px] border-black pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 bg-primary-container border-2 border-black rounded flex items-center justify-center shadow-[2px_2px_0px_#000]">
                  <span className="material-symbols-outlined text-xl">
                    history
                  </span>
                </span>
                <div>
                  <h3 className="font-headline-md uppercase font-black text-lg sm:text-xl">
                    Riwayat Penyetor Tabungan
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant font-bold truncate max-w-[280px]">
                    Target: <strong className="text-black">{historyGoal.name}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Target Status Summary */}
            <div className="p-3 bg-surface-container-low border-2 border-black rounded-lg mb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-black text-on-surface-variant block">
                  Total Terkumpul
                </span>
                <span className="font-numeric-stat text-lg font-black text-[#15803d]">
                  Rp {historyGoal.current_amount.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-black text-on-surface-variant block">
                  Target Akhir
                </span>
                <span className="font-numeric-stat text-lg font-black text-black">
                  Rp {historyGoal.target_amount.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {isLoadingHistory ? (
                <div className="p-8 text-center font-headline-sm uppercase font-bold text-xs animate-pulse">
                  Memuat riwayat setoran...
                </div>
              ) : contributions.length === 0 ? (
                <div className="p-8 text-center space-y-2 border-2 border-dashed border-black rounded-lg">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant">
                    receipt_long
                  </span>
                  <div className="font-headline-sm uppercase font-bold text-xs">
                    Belum Ada Catatan Setoran Rinci
                  </div>
                  <p className="font-body-sm text-[11px] text-on-surface-variant font-semibold">
                    Setoran awal sebesar Rp {historyGoal.current_amount.toLocaleString("id-ID")} diinput saat pembuatan target oleh <strong>{historyGoal.creator_name || "Anggota"}</strong>.
                  </p>
                </div>
              ) : (
                contributions.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-white border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#38BDF8] border-2 border-black flex items-center justify-center font-black text-xs shrink-0 shadow-[1px_1px_0px_#000]">
                        {c.contributor_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-headline-sm text-xs font-black uppercase text-black truncate">
                            {c.contributor_name}
                          </span>
                          <span className="text-[10px] text-on-surface-variant font-semibold">
                            • {new Date(c.contributed_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        {c.notes && (
                          <p className="font-body-sm text-[11px] text-on-surface-variant italic truncate">
                            &ldquo;{c.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="font-numeric-stat text-sm sm:text-base font-black text-[#15803d] shrink-0">
                      + Rp {c.amount.toLocaleString("id-ID")}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Bottom Close */}
            <div className="pt-4 mt-2 border-t-2 border-black/15">
              <button
                type="button"
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryGoal(null);
                }}
                className="w-full py-2.5 bg-surface-container hover:bg-surface-container-high border-2 border-black rounded font-headline-sm uppercase font-black text-xs shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              >
                Tutup Riwayat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
