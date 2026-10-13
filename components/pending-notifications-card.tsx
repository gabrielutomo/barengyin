"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export interface PendingTransaction {
  id: string;
  title: string;
  amount: number;
  type: string;
  source_app?: string | null;
  raw_notification_text?: string | null;
  created_at: string;
  category_id?: string | null;
}

interface PendingNotificationsCardProps {
  items: PendingTransaction[];
  coupleId?: string | null;
  onItemProcessed: (id: string) => void;
}

export function PendingNotificationsCard({
  items,
  coupleId,
  onItemProcessed,
}: PendingNotificationsCardProps) {
  const supabase = createClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!items || items.length === 0) return null;

  const handleApprove = async (tx: PendingTransaction, targetScope: "personal" | "couple") => {
    setProcessingId(tx.id);
    try {
      const updatePayload: Record<string, any> = {
        status: "recorded",
        scope: targetScope,
        updated_at: new Date().toISOString(),
      };

      if (targetScope === "couple" && coupleId) {
        updatePayload.couple_id = coupleId;
        updatePayload.split_method = "fifty_fifty";
      }

      const { error } = await supabase
        .from("transactions")
        .update(updatePayload)
        .eq("id", tx.id);

      if (!error) {
        onItemProcessed(tx.id);
      }
    } catch (e) {
      console.error("Gagal menyetujui transaksi:", e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismiss = async (txId: string) => {
    setProcessingId(txId);
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", txId);
      if (!error) {
        onItemProcessed(txId);
      }
    } catch (e) {
      console.error("Gagal menghapus transaksi:", e);
    } finally {
      setProcessingId(null);
    }
  };

  const getSourceBadge = (pkg?: string | null) => {
    if (!pkg) return { label: "Notifikasi HP", color: "bg-blue-100 text-blue-800" };
    const lower = pkg.toLowerCase();
    if (lower.includes("bca")) return { label: "BCA Mobile", color: "bg-blue-600 text-white" };
    if (lower.includes("mandiri") || lower.includes("livin")) return { label: "Livin Mandiri", color: "bg-yellow-500 text-black" };
    if (lower.includes("bri")) return { label: "BRImo", color: "bg-blue-700 text-white" };
    if (lower.includes("bni")) return { label: "BNI Mobile", color: "bg-orange-600 text-white" };
    if (lower.includes("gojek") || lower.includes("gopay")) return { label: "GoPay", color: "bg-emerald-600 text-white" };
    if (lower.includes("dana")) return { label: "DANA", color: "bg-sky-500 text-white" };
    if (lower.includes("shopee")) return { label: "ShopeePay", color: "bg-orange-500 text-white" };
    if (lower.includes("ovo")) return { label: "OVO", color: "bg-purple-700 text-white" };
    return { label: pkg, color: "bg-neutral-800 text-white" };
  };

  return (
    <div className="bg-amber-100 border-[4px] border-black shadow-[6px_6px_0px_#000] rounded-xl p-5 sm:p-6 mb-6">
      <div className="flex items-center justify-between pb-3 border-b-2 border-black/20 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-amber-400 border-2 border-black flex items-center justify-center text-black font-black text-sm shadow-[2px_2px_0px_#000]">
            ⚡
          </span>
          <div>
            <h3 className="font-headline-sm font-black text-base text-black uppercase tracking-tight flex items-center gap-2">
              Transaksi Terdeteksi dari HP ({items.length})
            </h3>
            <p className="text-xs text-neutral-700 font-semibold">
              Notifikasi pembayaran berhasil di-capture otomatis oleh sistem Ingester.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const badge = getSourceBadge(item.source_app);
          const isBusy = processingId === item.id;

          return (
            <div
              key={item.id}
              className="bg-white border-2 border-black rounded-lg p-3.5 sm:p-4 shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black ${badge.color}`}>
                    {badge.label}
                  </span>
                  <span className="font-extrabold text-sm text-black truncate">
                    {item.title}
                  </span>
                </div>

                <div className="text-lg font-black text-red-600">
                  -Rp {item.amount.toLocaleString("id-ID")}
                </div>

                {item.raw_notification_text && (
                  <p className="text-[11px] text-neutral-500 italic truncate max-w-lg font-medium">
                    &ldquo;{item.raw_notification_text}&rdquo;
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleApprove(item, "personal")}
                  className="px-3 py-1.5 bg-primary-container hover:bg-primary-container/80 text-black border-2 border-black rounded text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Simpan ke Ruang Pribadi (Privat)"
                >
                  👤 Ke Pribadi
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleApprove(item, "couple")}
                  className="px-3 py-1.5 bg-secondary-container hover:bg-secondary-container/80 text-black border-2 border-black rounded text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Simpan ke Ruang Berdua (Bagi 50:50)"
                >
                  💑 Bagi Berdua
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleDismiss(item.id)}
                  className="px-2.5 py-1.5 bg-neutral-100 hover:bg-red-100 text-neutral-700 hover:text-red-700 border-2 border-black rounded text-xs font-black transition-all cursor-pointer disabled:opacity-50"
                  title="Abaikan transaksi ini"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
