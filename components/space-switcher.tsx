"use client";

import { useSpace } from "@/lib/context/space-context";

export function SpaceSwitcher({ className = "" }: { className?: string }) {
  const { space, toggleSpace, setShowSelectorModal } = useSpace();

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={toggleSpace}
        className={`px-3 py-1.5 rounded-md border-2 border-black font-space-grotesk font-bold text-xs flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
          space === "couple"
            ? "bg-secondary-container text-black hover:bg-secondary-container/90"
            : "bg-primary-container text-black hover:bg-primary-container/90"
        }`}
        title="Klik untuk beralih ruang keuangan"
      >
        <span className="text-sm">
          {space === "couple" ? "💑" : "👤"}
        </span>
        <span className="font-extrabold tracking-tight">
          {space === "couple" ? "Ruang Berdua" : "Ruang Pribadi"}
        </span>
        <span className="material-symbols-outlined text-[14px] text-neutral-600">
          sync_alt
        </span>
      </button>

      <button
        type="button"
        onClick={() => setShowSelectorModal(true)}
        className="p-1.5 rounded-md border-2 border-black bg-surface hover:bg-neutral-100 transition-colors shadow-[2px_2px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        title="Pilih mode sesi"
      >
        <span className="material-symbols-outlined text-[14px] block text-black">
          tune
        </span>
      </button>
    </div>
  );
}
