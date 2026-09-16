"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";

interface AppSidebarProps {
  activeNav?: "dashboard" | "dompet" | "transaksi" | "tabungan" | "anggaran" | "laporan" | "scan" | "pasangan" | "pengaturan";
  coupleName?: string;
  partnerName?: string;
  isPartnerConnected?: boolean;
  onOpenScanModal?: () => void;
  onOpenInviteModal?: () => void;
  onOpenAccountModal?: () => void;
}

export function AppSidebar({
  activeNav,
  coupleName = "Dompet Bersama",
  partnerName,
  isPartnerConnected = false,
  onOpenInviteModal,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine current active based on prop or pathname
  const currentActive =
    activeNav ||
    (pathname?.startsWith("/dompet")
      ? "dompet"
      : pathname?.startsWith("/transaksi")
      ? "transaksi"
      : pathname?.startsWith("/tabungan")
      ? "tabungan"
      : pathname?.startsWith("/anggaran")
      ? "anggaran"
      : pathname?.startsWith("/laporan")
      ? "laporan"
      : pathname?.startsWith("/scan-struk")
      ? "scan"
      : pathname?.startsWith("/pasangan")
      ? "pasangan"
      : pathname?.startsWith("/pengaturan")
      ? "pengaturan"
      : "dashboard");

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP FIXED SIDEBAR (Visible only on md: screens and above) */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-surface-container-lowest border-r-[3px] border-black z-50 flex-col justify-between overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col">
          {/* Logo Header */}
          <div className="h-16 px-4 border-b-[3px] border-black flex items-center bg-surface-container-low overflow-hidden">
            <Logo href="/dashboard" size="sm" showBadge={false} />
          </div>

          {/* Navigation Items with instant prefetching */}
          <nav className="flex flex-col p-3 gap-1.5">
            {/* 1. Dashboard */}
            <Link
              href="/dashboard"
              prefetch={true}
              className={`flex items-center gap-3 px-3 py-2.5 transition-all text-left rounded cursor-pointer ${
                currentActive === "dashboard"
                  ? "bg-primary-container text-on-surface font-black border-l-[5px] border-black shadow-[2px_2px_0px_#000000]"
                  : "hover:bg-surface-container-low text-on-surface font-bold"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                grid_view
              </span>
              <span className="font-headline-sm text-body-md uppercase">
                Dashboard
              </span>
            </Link>

            {/* 2. Dompet Bersama */}
            <Link
              href="/dompet"
              prefetch={true}
              className={`flex items-center gap-3 px-3 py-2.5 transition-all text-left rounded cursor-pointer ${
                currentActive === "dompet"
                  ? "bg-primary-container text-on-surface font-black border-l-[5px] border-black shadow-[2px_2px_0px_#000000]"
                  : "hover:bg-surface-container-low text-on-surface font-bold"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                account_balance_wallet
              </span>
              <span className="font-headline-sm text-body-md uppercase">
                Dompet Bersama
              </span>
            </Link>

            {/* 3. Transaksi */}
            <Link
              href="/transaksi"
              prefetch={true}
              className={`flex items-center gap-3 px-3 py-2.5 transition-all text-left rounded cursor-pointer ${
                currentActive === "transaksi"
                  ? "bg-primary-container text-on-surface font-black border-l-[5px] border-black shadow-[2px_2px_0px_#000000]"
                  : "hover:bg-surface-container-low text-on-surface font-bold"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                receipt_long
              </span>
              <span className="font-headline-sm text-body-md uppercase">
                Transaksi
              </span>
            </Link>

            {/* 4. Tabungan Bersama */}
            <Link
              href="/tabungan"
              prefetch={true}
              className={`flex items-center gap-3 px-3 py-2.5 transition-all text-left rounded cursor-pointer ${
                currentActive === "tabungan"
                  ? "bg-primary-container text-on-surface font-black border-l-[5px] border-black shadow-[2px_2px_0px_#000000]"
                  : "hover:bg-surface-container-low text-on-surface font-bold"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                savings
              </span>
              <span className="font-headline-sm text-body-md uppercase">
                Tabungan
              </span>
            </Link>

            {/* 5. Anggaran */}
            <Link
              href="/anggaran"
              prefetch={true}
              className={`flex items-center gap-3 px-3 py-2.5 transition-all text-left rounded cursor-pointer ${
                currentActive === "anggaran"
                  ? "bg-primary-container text-on-surface font-black border-l-[5px] border-black shadow-[2px_2px_0px_#000000]"
                  : "hover:bg-surface-container-low text-on-surface font-bold"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                pie_chart
              </span>
              <span className="font-headline-sm text-body-md uppercase">
                Anggaran
              </span>
            </Link>

            {/* 6. Laporan */}
            <Link
              href="/laporan"
              prefetch={true}
              className={`flex items-center gap-3 px-3 py-2.5 transition-all text-left rounded cursor-pointer ${
                currentActive === "laporan"
                  ? "bg-primary-container text-on-surface font-black border-l-[5px] border-black shadow-[2px_2px_0px_#000000]"
                  : "hover:bg-surface-container-low text-on-surface font-bold"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                insights
              </span>
              <span className="font-headline-sm text-body-md uppercase">
                Laporan
              </span>
            </Link>

            {/* 7. Scan Struk */}
            <Link
              href="/scan-struk"
              prefetch={true}
              className={`flex items-center gap-3 px-3 py-2.5 transition-all text-left rounded cursor-pointer ${
                currentActive === "scan"
                  ? "bg-primary-container text-on-surface font-black border-l-[5px] border-black shadow-[2px_2px_0px_#000000]"
                  : "hover:bg-surface-container-low text-on-surface font-bold"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                document_scanner
              </span>
              <span className="font-headline-sm text-body-md uppercase">
                Scan Struk
              </span>
            </Link>

            {/* 8. Pasangan */}
            <Link
              href="/pasangan"
              prefetch={true}
              className={`flex items-center gap-3 px-3 py-2.5 transition-all text-left rounded cursor-pointer ${
                currentActive === "pasangan"
                  ? "bg-primary-container text-on-surface font-black border-l-[5px] border-black shadow-[2px_2px_0px_#000000]"
                  : "hover:bg-surface-container-low text-on-surface font-bold"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                favorite
              </span>
              <span className="font-headline-sm text-body-md uppercase">
                Pasangan
              </span>
            </Link>

            {/* 9. Pengaturan */}
            <Link
              href="/pengaturan"
              prefetch={true}
              className={`flex items-center gap-3 px-3 py-2.5 transition-all text-left rounded cursor-pointer ${
                currentActive === "pengaturan"
                  ? "bg-primary-container text-on-surface font-black border-l-[5px] border-black shadow-[2px_2px_0px_#000000]"
                  : "hover:bg-surface-container-low text-on-surface font-bold"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                settings
              </span>
              <span className="font-headline-sm text-body-md uppercase">
                Pengaturan
              </span>
            </Link>
          </nav>
        </div>

        {/* Desktop Footer Widget: Status Pasangan */}
        <div className="p-3 border-t-[3px] border-black bg-surface-container-low">
          <Link
            href="/dompet"
            prefetch={true}
            className="block p-3 border-[3px] border-black bg-surface-container-lowest shadow-[3px_3px_0px_#000000] rounded hover:translate-x-0.5 hover:translate-y-0.5 transition-all group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-label-badge text-[10px] uppercase px-1.5 py-0.5 bg-tertiary-container text-on-surface border border-black rounded-xs font-black group-hover:bg-primary-container transition-colors">
                DUO KAS SYNC
              </span>
              <span className="font-label-badge text-[10px] uppercase text-primary font-black underline">
                Dompet &rarr;
              </span>
            </div>
            <div className="font-headline-sm text-xs text-on-surface uppercase truncate font-black">
              {coupleName}
            </div>
            <div className="font-body-sm text-[11px] text-on-surface-variant truncate font-semibold mt-1">
              {isPartnerConnected ? (
                <span className="text-[#22C55E] font-black flex items-center gap-1">
                  <span>✓</span>
                  <span className="truncate">Terhubung {partnerName ? `(${partnerName})` : ""}</span>
                </span>
              ) : (
                <span
                  onClick={(e) => {
                    if (onOpenInviteModal) {
                      e.preventDefault();
                      onOpenInviteModal();
                    }
                  }}
                  className="text-secondary font-black underline hover:text-black cursor-pointer text-left block truncate"
                >
                  + Undang Pasangan
                </span>
              )}
            </div>
          </Link>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE BOTTOM NAVIGATION BAR (Visible only on mobile screens < md:) */}
      {/* ========================================================================= */}
      {/* 2. MOBILE BOTTOM NAVIGATION BAR (Visible only on mobile screens < md:) */}
      {/* ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-lowest border-t-[3px] border-black z-50 flex items-center justify-between px-1 py-1 shadow-[0_-3px_0px_#000]">
        {/* Mobile Nav 1: Dashboard */}
        <Link
          href="/dashboard"
          prefetch={true}
          className={`flex-1 min-w-0 max-w-[20%] flex flex-col items-center justify-center py-1.5 px-0.5 rounded transition-all active:scale-95 border-2 ${
            currentActive === "dashboard"
              ? "bg-primary-container text-black border-black shadow-[2px_2px_0px_#000]"
              : "border-transparent text-on-surface hover:bg-surface-container-low"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] leading-none shrink-0">grid_view</span>
          <span className="text-[10px] font-black uppercase tracking-tight leading-none mt-1 truncate max-w-full text-center">
            Beranda
          </span>
        </Link>

        {/* Mobile Nav 2: Dompet */}
        <Link
          href="/dompet"
          prefetch={true}
          className={`flex-1 min-w-0 max-w-[20%] flex flex-col items-center justify-center py-1.5 px-0.5 rounded transition-all active:scale-95 border-2 ${
            currentActive === "dompet"
              ? "bg-primary-container text-black border-black shadow-[2px_2px_0px_#000]"
              : "border-transparent text-on-surface hover:bg-surface-container-low"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] leading-none shrink-0">account_balance_wallet</span>
          <span className="text-[10px] font-black uppercase tracking-tight leading-none mt-1 truncate max-w-full text-center">
            Dompet
          </span>
        </Link>

        {/* Mobile Nav 3: Transaksi */}
        <Link
          href="/transaksi"
          prefetch={true}
          className={`flex-1 min-w-0 max-w-[20%] flex flex-col items-center justify-center py-1.5 px-0.5 rounded transition-all active:scale-95 border-2 ${
            currentActive === "transaksi"
              ? "bg-primary-container text-black border-black shadow-[2px_2px_0px_#000]"
              : "border-transparent text-on-surface hover:bg-surface-container-low"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] leading-none shrink-0">receipt_long</span>
          <span className="text-[10px] font-black uppercase tracking-tight leading-none mt-1 truncate max-w-full text-center">
            Transaksi
          </span>
        </Link>

        {/* Mobile Nav 4: Tabungan */}
        <Link
          href="/tabungan"
          prefetch={true}
          className={`flex-1 min-w-0 max-w-[20%] flex flex-col items-center justify-center py-1.5 px-0.5 rounded transition-all active:scale-95 border-2 ${
            currentActive === "tabungan"
              ? "bg-primary-container text-black border-black shadow-[2px_2px_0px_#000]"
              : "border-transparent text-on-surface hover:bg-surface-container-low"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] leading-none shrink-0">savings</span>
          <span className="text-[10px] font-black uppercase tracking-tight leading-none mt-1 truncate max-w-full text-center">
            Tabungan
          </span>
        </Link>

        {/* Mobile Nav 5: Menu Drawer Toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`flex-1 min-w-0 max-w-[20%] flex flex-col items-center justify-center py-1.5 px-0.5 rounded transition-all cursor-pointer active:scale-95 border-2 ${
            ["anggaran", "laporan", "scan", "pasangan", "pengaturan"].includes(currentActive)
              ? "bg-[#D4F34A] text-black border-black shadow-[2px_2px_0px_#000]"
              : "border-transparent text-on-surface hover:bg-surface-container-low"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] leading-none shrink-0">widgets</span>
          <span className="text-[10px] font-black uppercase tracking-tight leading-none mt-1 truncate max-w-full text-center">
            Menu
          </span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* 3. MOBILE SLIDE-OVER DRAWER (For remaining features & settings) */}
      {/* ========================================================================= */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 transition-opacity animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="fixed right-0 top-0 bottom-0 w-[84%] max-w-xs bg-surface-container-lowest border-l-[3px] border-black z-50 flex flex-col justify-between overflow-y-auto p-4 shadow-[-6px_0px_0px_#000]">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                <Logo href="/dashboard" size="sm" showBadge={false} />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 rounded border-2 border-black bg-primary-container flex items-center justify-center font-bold text-sm shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  title="Tutup Menu"
                >
                  ✕
                </button>
              </div>

              {/* Couple Info Card */}
              <div className="p-3 bg-surface-container-low border-2 border-black rounded-lg shadow-[3px_3px_0px_#000]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-badge text-[9px] uppercase px-1.5 py-0.5 bg-tertiary-container border border-black rounded-xs font-black">
                    DUO KAS
                  </span>
                  <span className="text-[10px] font-black text-[#22C55E]">
                    {isPartnerConnected ? "SYNC AKTIF" : "BELUM TERHUBUNG"}
                  </span>
                </div>
                <div className="font-headline-sm text-xs font-black uppercase text-on-surface truncate">
                  {coupleName}
                </div>
                <div className="font-body-sm text-[11px] text-on-surface-variant font-semibold mt-0.5 truncate">
                  {isPartnerConnected ? `Partner: ${partnerName || "Pasangan"}` : "Undang pasangan di menu Pasangan"}
                </div>
              </div>

              {/* Navigation Links */}
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant px-1">
                  Semua Fitur Barengyin
                </div>

                {/* Anggaran */}
                <Link
                  href="/anggaran"
                  prefetch={true}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded border-2 border-black transition-all ${
                    currentActive === "anggaran"
                      ? "bg-primary-container font-black shadow-[3px_3px_0px_#000]"
                      : "bg-white hover:bg-slate-50 font-bold shadow-[2px_2px_0px_#000]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">pie_chart</span>
                  <span className="font-headline-sm text-xs uppercase">Anggaran Bulanan</span>
                </Link>

                {/* Laporan PDF */}
                <Link
                  href="/laporan"
                  prefetch={true}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded border-2 border-black transition-all ${
                    currentActive === "laporan"
                      ? "bg-primary-container font-black shadow-[3px_3px_0px_#000]"
                      : "bg-white hover:bg-slate-50 font-bold shadow-[2px_2px_0px_#000]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">insights</span>
                  <span className="font-headline-sm text-xs uppercase">Laporan &amp; e-Statement</span>
                </Link>

                {/* Scan Struk AI */}
                <Link
                  href="/scan-struk"
                  prefetch={true}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded border-2 border-black transition-all ${
                    currentActive === "scan"
                      ? "bg-primary-container font-black shadow-[3px_3px_0px_#000]"
                      : "bg-white hover:bg-slate-50 font-bold shadow-[2px_2px_0px_#000]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">document_scanner</span>
                  <span className="font-headline-sm text-xs uppercase">Scan Struk AI</span>
                </Link>

                {/* Pasangan */}
                <Link
                  href="/pasangan"
                  prefetch={true}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded border-2 border-black transition-all ${
                    currentActive === "pasangan"
                      ? "bg-primary-container font-black shadow-[3px_3px_0px_#000]"
                      : "bg-white hover:bg-slate-50 font-bold shadow-[2px_2px_0px_#000]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">favorite</span>
                  <span className="font-headline-sm text-xs uppercase">Pasangan &amp; Kas Sync</span>
                </Link>

                {/* Pengaturan */}
                <Link
                  href="/pengaturan"
                  prefetch={true}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded border-2 border-black transition-all ${
                    currentActive === "pengaturan"
                      ? "bg-primary-container font-black shadow-[3px_3px_0px_#000]"
                      : "bg-white hover:bg-slate-50 font-bold shadow-[2px_2px_0px_#000]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">settings</span>
                  <span className="font-headline-sm text-xs uppercase">Pengaturan &amp; PIN</span>
                </Link>
              </div>
            </div>

            {/* Bottom Quick CTA */}
            <div className="pt-4 border-t-2 border-black flex flex-col gap-2">
              <Link
                href="/dompet"
                prefetch={true}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 bg-[#D4F34A] border-2 border-black font-headline-sm text-xs uppercase font-black shadow-[2px_2px_0px_#000] rounded text-center block"
              >
                Lihat Dompet Bersama &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
