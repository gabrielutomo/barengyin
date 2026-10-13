"use client";

import { useSpace, SpaceMode } from "@/lib/context/space-context";
import { useState } from "react";

export function SpaceSelectorModal() {
  const { space, setSpace, showSelectorModal, setShowSelectorModal, goToPersonalSpace, goToCoupleSpace } = useSpace();
  const [remember, setRemember] = useState(true);

  if (!showSelectorModal) return null;

  const handleSelect = (mode: SpaceMode) => {
    setShowSelectorModal(false);
    if (mode === "personal") {
      goToPersonalSpace();
    } else {
      goToCoupleSpace();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface border-4 border-black rounded-lg shadow-[8px_8px_0px_#000000] p-6 sm:p-8 relative overflow-hidden">
        {/* Top Pattern Decorator */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-black/10">
          <div className="flex items-center gap-2">
            <span className="bg-primary-container px-2 py-0.5 border-2 border-black rounded text-xs font-black tracking-wider uppercase shadow-[2px_2px_0px_#000000]">
              Pilih Sesi Barengyin
            </span>
          </div>
          <button
            onClick={() => setShowSelectorModal(false)}
            className="w-8 h-8 rounded border-2 border-black flex items-center justify-center hover:bg-neutral-100 transition-colors font-bold text-sm"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {/* Headline */}
        <div className="mt-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-black font-space-grotesk tracking-tight text-on-surface">
            Mau Masuk Sesi Mana?
          </h2>
          <p className="text-sm text-neutral-600 mt-1.5 font-medium">
            Pilih ruang keuangan yang ingin kamu buka saat ini. Kamu bisa berganti kapan saja.
          </p>
        </div>

        {/* Options */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Option 1: Ruang Berdua */}
          <button
            type="button"
            onClick={() => handleSelect("couple")}
            className={`text-left p-5 rounded-lg border-3 border-black transition-all group flex flex-col justify-between ${
              space === "couple"
                ? "bg-secondary-container shadow-[4px_4px_0px_#000000] -translate-y-0.5"
                : "bg-surface-container-lowest hover:bg-secondary-container/20 shadow-[2px_2px_0px_#000000] hover:shadow-[4px_4px_0px_#000000] hover:-translate-y-0.5"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">💑</span>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-black text-white rounded">
                  Bareng Pasangan
                </span>
              </div>
              <h3 className="font-black text-lg text-on-surface">
                Ruang Berdua
              </h3>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                Kelola dompet bersama, split bill otomatis, dan pantau anggaran kencan bersama pasangan.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t-2 border-black/10 flex items-center justify-between">
              <span className="text-xs font-bold text-black">Masuk Ruang Ini</span>
              <span className="material-symbols-outlined text-sm font-bold group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </button>

          {/* Option 2: Ruang Personal */}
          <button
            type="button"
            onClick={() => handleSelect("personal")}
            className={`text-left p-5 rounded-lg border-3 border-black transition-all group flex flex-col justify-between ${
              space === "personal"
                ? "bg-primary-container shadow-[4px_4px_0px_#000000] -translate-y-0.5"
                : "bg-surface-container-lowest hover:bg-primary-container/20 shadow-[2px_2px_0px_#000000] hover:shadow-[4px_4px_0px_#000000] hover:-translate-y-0.5"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">👤</span>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-primary text-black rounded border border-black">
                  100% Privat
                </span>
              </div>
              <h3 className="font-black text-lg text-on-surface">
                Ruang Pribadi
              </h3>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                Catatan keuangan sendiri. <strong>Tidak dibagikan</strong> ke pasangan. Cocok untuk tabungan rahasia & jajan sendiri.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t-2 border-black/10 flex items-center justify-between">
              <span className="text-xs font-bold text-black">Masuk Ruang Ini</span>
              <span className="material-symbols-outlined text-sm font-bold group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </button>
        </div>

        {/* Bottom Note */}
        <div className="mt-6 pt-4 border-t-2 border-black/10 flex items-center justify-center">
          <p className="text-xs text-neutral-500 text-center font-medium">
            💡 Kamu bisa beralih antara <strong>Ruang Berdua</strong> dan <strong>Ruang Pribadi</strong> kapan pun lewat tombol di pojok atas atau menu sidebar.
          </p>
        </div>
      </div>
    </div>
  );
}
