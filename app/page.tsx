"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen flex flex-col antialiased selection:bg-primary-container selection:text-black">
      {/* HEADER / NAVBAR */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest border-b-[3px] border-black">
        <div className="h-20 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Logo href="/" size="md" />


          <nav className="hidden md:flex items-center gap-space-lg">
            <a
              href="#fitur"
              className="font-headline-sm uppercase tracking-wider py-space-xs px-space-sm transition-all hover:bg-primary-container hover:shadow-[2px_2px_0px_#000000] border-2 border-transparent hover:border-black rounded-sm"
            >
              Fitur
            </a>
            <a
              href="#cara-kerja"
              className="font-headline-sm uppercase tracking-wider py-space-xs px-space-sm transition-all hover:bg-primary-container hover:shadow-[2px_2px_0px_#000000] border-2 border-transparent hover:border-black rounded-sm"
            >
              Cara Kerja
            </a>
            <a
              href="#faq"
              className="font-headline-sm uppercase tracking-wider py-space-xs px-space-sm transition-all hover:bg-primary-container hover:shadow-[2px_2px_0px_#000000] border-2 border-transparent hover:border-black rounded-sm"
            >
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-space-md">
            <Link
              href="/masuk"
              className="font-headline-sm text-headline-sm text-on-surface uppercase px-space-md py-space-xs border-[3px] border-black bg-surface-container-lowest shadow-[3px_3px_0px_#000000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#000000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all rounded-sm"
            >
              Masuk
            </Link>
            <Link
              href="/masuk?mode=register"
              className="font-headline-sm text-headline-sm text-on-surface uppercase px-space-md py-space-xs border-[3px] border-black bg-primary-container shadow-[4px_4px_0px_#000000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all rounded-sm font-bold"
            >
              Daftar Gratis
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="w-full pt-20 flex-1 bg-surface">
        <div className="flex flex-col w-full">
          {/* HERO SECTION */}
          <section className="w-full bg-[#F7F4EB] border-b-[4px] border-black py-space-xl overflow-hidden relative">
            <div className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin flex flex-col items-center text-center relative z-10">
              {/* Top Badge */}
              <div className="inline-flex items-center gap-space-xs bg-[#FDE047] border-[3px] border-black px-space-md py-space-xs shadow-[4px_4px_0px_#000000] rotate-[-1deg] hover:rotate-0 transition-transform mb-space-lg rounded-sm">
                <span className="font-label-badge text-label-badge text-black uppercase tracking-wider font-bold">
                  ✨ APLIKASI KEUANGAN PASANGAN #1 DI INDONESIA
                </span>
              </div>

              {/* Display Headline */}
              <h1 className="font-display-hero text-display-hero-mobile md:text-display-hero text-on-surface uppercase tracking-tight max-w-4xl mx-auto leading-none mb-space-md">
                Catat Pengeluaran &amp; Pemasukan Berdua,{" "}
                <span className="bg-primary-container px-space-xs border-[3px] border-black inline-block mt-2 shadow-[4px_4px_0px_#000000] -rotate-1 rounded-sm">
                  Tanpa Drama.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="font-body-lg text-body-lg text-on-surface max-w-2xl mx-auto mb-space-xl font-medium">
                Barengyin bantu kamu dan pasangan lacak saldo bersama, split bon
                otomatis, dan capai financial goals bareng secara transparan
                &amp; seru.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-space-md w-full max-w-md mb-space-lg">
                <Link
                  href="/masuk?mode=register"
                  className="w-full sm:w-auto font-headline-sm text-headline-sm uppercase px-space-lg py-space-md bg-primary-container text-black border-[4px] border-black shadow-[6px_6px_0px_#000000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-space-xs rounded font-bold"
                >
                  Mulai Gratis Sekarang →
                </Link>
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto font-headline-sm text-headline-sm uppercase px-space-lg py-space-md bg-surface-container-lowest text-black border-[4px] border-black shadow-[6px_6px_0px_#000000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-space-xs rounded font-bold"
                >
                  Lihat Live Demo ⚡
                </Link>
              </div>

              {/* Social Proof Badge */}
              <div className="inline-flex items-center gap-space-xs bg-surface-container-lowest border-[2px] border-black px-space-md py-space-xs shadow-[3px_3px_0px_#000000] mb-space-xl text-black font-body-sm text-body-sm font-bold rounded-sm">
                <span className="material-symbols-outlined text-secondary text-sm">
                  favorite
                </span>
                <span>
                  Dipercaya 15.000+ pasangan aktif • Bebas drama tiap akhir bulan
                </span>
              </div>

              {/* Hero Visual Card with Stickers */}
              <div className="relative w-full max-w-xl mx-auto mt-space-sm">
                {/* Floating Stickers */}
                <div className="absolute -top-4 -left-4 md:-left-10 z-20 bg-secondary-container text-black font-label-badge text-label-badge uppercase px-space-md py-space-xs border-[3px] border-black shadow-[4px_4px_0px_#000000] rotate-[-6deg] rounded-sm font-bold">
                  SPLIT 50:50! 🔥
                </div>
                <div className="absolute top-1/3 -right-3 md:-right-8 z-20 bg-[#FDE047] text-black font-label-badge text-label-badge uppercase px-space-md py-space-xs border-[3px] border-black shadow-[4px_4px_0px_#000000] rotate-[8deg] rounded-sm font-bold">
                  KOPI SUSU RP 38K ☕
                </div>
                <div className="absolute -bottom-5 left-1/4 z-20 bg-primary-container text-black font-label-badge text-label-badge uppercase px-space-md py-space-xs border-[3px] border-black shadow-[4px_4px_0px_#000000] rotate-[-3deg] rounded-sm font-bold">
                  HEMAT RP 2.4JT BULAN INI 💸
                </div>

                {/* Main Card Wrapper */}
                <div className="bg-surface-container-lowest border-[4px] border-black p-space-md shadow-[8px_8px_0px_#000000] rounded-xl relative">
                  <div className="w-full aspect-square border-[3px] border-black overflow-hidden bg-surface-variant flex items-center justify-center relative rounded">
                    <Image
                      alt="Ilustrasi playful couple Barengyin bergaya pop-art neo-brutalist"
                      src="/assets/playful_couple_popart.png"
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>
                  <div className="mt-space-md flex justify-between items-center bg-surface-container-low border-[3px] border-black p-space-sm rounded">
                    <div className="flex items-center gap-space-sm">
                      <span className="w-3.5 h-3.5 rounded-full bg-[#22C55E] border-[2px] border-black inline-block animate-pulse"></span>
                      <span className="font-body-sm font-bold text-on-surface uppercase">
                        Sinkronisasi Dompet Berdua
                      </span>
                    </div>
                    <span className="font-label-badge text-label-badge bg-black text-white px-space-sm py-space-xs rounded-sm">
                      ONLINE BARENG
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 1: KENAPA BARENGYIN? */}
          <section className="w-full py-space-xl bg-surface" id="fitur">
            <div className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl gap-space-sm">
                <div>
                  <span className="font-label-badge text-label-badge bg-secondary text-white px-space-sm py-space-xs border-[2px] border-black shadow-[2px_2px_0px_#000000] uppercase rounded-sm">
                    #1 Kenapa Barengyin?
                  </span>
                  <h2 className="font-headline-lg text-headline-lg uppercase mt-space-sm font-black">
                    Tiga Jurus Ampuh Dompet Adem Ayem
                  </h2>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
                  Dirancang khusus untuk gaya hidup berpasangan—mulai dari kencan
                  santai sampai tabungan masa depan.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
                {/* Feature 1 */}
                <div className="bg-surface-container-lowest border-[4px] border-black p-space-lg shadow-[6px_6px_0px_#000000] rounded-xl flex flex-col justify-between hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_#000000] transition-all">
                  <div>
                    <div className="w-14 h-14 bg-secondary-container border-[3px] border-black shadow-[3px_3px_0px_#000000] flex items-center justify-center mb-space-md rounded">
                      <span className="material-symbols-outlined text-3xl text-black">
                        call_split
                      </span>
                    </div>
                    <h3 className="font-headline-md text-headline-md uppercase mb-space-sm font-bold">
                      Split Pengeluaran Instan
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface mb-space-md">
                      Tentukan porsi 50:50, proporsional gaji, atau gantian bayar.
                      Saldo langsung sinkron otomatis tanpa perlu nagih-nagih
                      canggung.
                    </p>
                  </div>
                  <div className="pt-space-sm border-t-[3px] border-black">
                    <span className="font-label-badge text-label-badge bg-[#FDE047] text-black px-space-sm py-space-xs border-[2px] border-black shadow-[2px_2px_0px_#000000] inline-block uppercase rounded-sm">
                      #AntiCanggung
                    </span>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="bg-surface-container-lowest border-[4px] border-black p-space-lg shadow-[6px_6px_0px_#000000] rounded-xl flex flex-col justify-between hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_#000000] transition-all">
                  <div>
                    <div className="w-14 h-14 bg-primary-container border-[3px] border-black shadow-[3px_3px_0px_#000000] flex items-center justify-center mb-space-md rounded">
                      <span className="material-symbols-outlined text-3xl text-black">
                        visibility
                      </span>
                    </div>
                    <h3 className="font-headline-md text-headline-md uppercase mb-space-sm font-bold">
                      Riwayat Super Transparan
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface mb-space-md">
                      Semua pengeluaran tercatat rapi per kategori (kencan,
                      groceries, liburan). Notifikasi real-time ke HP
                      masing-masing saat ada transaksi baru.
                    </p>
                  </div>
                  <div className="pt-space-sm border-t-[3px] border-black">
                    <span className="font-label-badge text-label-badge bg-primary-container text-black px-space-sm py-space-xs border-[2px] border-black shadow-[2px_2px_0px_#000000] inline-block uppercase rounded-sm">
                      #RealTimeSync
                    </span>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="bg-surface-container-lowest border-[4px] border-black p-space-lg shadow-[6px_6px_0px_#000000] rounded-xl flex flex-col justify-between hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_#000000] transition-all">
                  <div>
                    <div className="w-14 h-14 bg-tertiary-container border-[3px] border-black shadow-[3px_3px_0px_#000000] flex items-center justify-center mb-space-md rounded">
                      <span className="material-symbols-outlined text-3xl text-black">
                        document_scanner
                      </span>
                    </div>
                    <h3 className="font-headline-md text-headline-md uppercase mb-space-sm font-bold">
                      Scan Struk Pakai AI
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface mb-space-md">
                      Cukup foto struk makan malam atau belanja bulanan. AI
                      Barengyin otomatis baca total, item, dan bagi tagihan dalam
                      hitungan detik!
                    </p>
                  </div>
                  <div className="pt-space-sm border-t-[3px] border-black">
                    <span className="font-label-badge text-label-badge bg-[#EBE1FF] text-black px-space-sm py-space-xs border-[2px] border-black shadow-[2px_2px_0px_#000000] inline-block uppercase rounded-sm">
                      #OtomatisAI
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: MOCK DASHBOARD PREVIEW */}
          <section
            className="w-full py-space-xl bg-surface-container-low border-y-[4px] border-black"
            id="demo"
          >
            <div className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin">
              <div className="text-center max-w-xl mx-auto mb-space-xl">
                <span className="font-label-badge text-label-badge bg-black text-white px-space-sm py-space-xs border-[2px] border-black uppercase shadow-[2px_2px_0px_#D4F34A] rounded-sm">
                  Intip Dalamnya
                </span>
                <h2 className="font-headline-lg text-headline-lg uppercase mt-space-sm font-black">
                  Dashboard Anti Pusing, Serba Rapi
                </h2>
              </div>

              {/* Brutalist Browser Mockup */}
              <div className="max-w-4xl mx-auto bg-surface-container-lowest border-[4px] border-black shadow-[8px_8px_0px_#000000] rounded-xl overflow-hidden transform md:-rotate-1 hover:rotate-0 transition-transform">
                {/* Browser Top Bar */}
                <div className="bg-surface-container-highest border-b-[3px] border-black px-space-md py-space-xs flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <span className="w-3.5 h-3.5 rounded-full bg-error border-[2px] border-black inline-block"></span>
                    <span className="w-3.5 h-3.5 rounded-full bg-[#FDE047] border-[2px] border-black inline-block"></span>
                    <span className="w-3.5 h-3.5 rounded-full bg-primary-container border-[2px] border-black inline-block"></span>
                  </div>
                  <div className="bg-surface-container-lowest border-[2px] border-black px-space-md py-space-xs font-label-badge text-label-badge text-on-surface truncate max-w-[260px] md:max-w-md rounded-sm">
                    app.barengyin.com/dashboard - Aris &amp; Nisa&apos;s Vault
                  </div>
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-sm font-bold">
                      lock
                    </span>
                  </div>
                </div>

                {/* Inner Content Snapshot */}
                <div className="p-space-md md:p-space-lg bg-surface">
                  {/* Top Row: Balance Card & Quick Ratio */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md mb-space-md">
                    <div className="md:col-span-2 bg-primary-container border-[3px] border-black p-space-md shadow-[4px_4px_0px_#000000] rounded">
                      <div className="flex justify-between items-start mb-space-xs">
                        <span className="font-label-badge text-label-badge uppercase font-bold text-on-surface">
                          Total Saldo Bersama (Maret 2024)
                        </span>
                        <span className="font-label-badge text-label-badge bg-black text-white px-space-xs py-space-xs uppercase rounded-sm">
                          SINKRON AKTIF
                        </span>
                      </div>
                      <div className="font-numeric-stat text-numeric-stat-mobile md:text-numeric-stat text-on-surface mb-space-xs">
                        Rp 18.450.000
                      </div>
                      <div className="flex items-center gap-space-sm font-body-sm text-body-sm font-bold">
                        <span className="text-primary font-bold">
                          ▲ Rp 3.200.000 vs bulan lalu
                        </span>
                        <span>• 24 Transaksi dicatat</span>
                      </div>
                    </div>

                    <div className="bg-surface-container-lowest border-[3px] border-black p-space-md shadow-[4px_4px_0px_#000000] flex flex-col justify-between rounded">
                      <div>
                        <span className="font-label-badge text-label-badge uppercase font-bold text-on-surface">
                          Split Kontribusi
                        </span>
                        <div className="flex items-center justify-between mt-space-sm mb-space-xs">
                          <span className="font-body-sm text-body-sm font-bold">
                            Aris (55%)
                          </span>
                          <span className="font-body-sm text-body-sm font-bold">
                            Nisa (45%)
                          </span>
                        </div>
                        <div className="w-full h-4 bg-surface-variant border-[2px] border-black flex overflow-hidden rounded-sm">
                          <div
                            className="h-full bg-secondary"
                            style={{ width: "55%" }}
                          ></div>
                          <div
                            className="h-full bg-[#FDE047]"
                            style={{ width: "45%" }}
                          ></div>
                        </div>
                      </div>
                      <div className="font-label-badge text-label-badge bg-surface-container-high p-space-xs border-[2px] border-black mt-space-sm text-center rounded-sm">
                        SEIMBANG • TIDAK ADA UTANG
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Recent Shared Feeds */}
                  <div className="bg-surface-container-lowest border-[3px] border-black p-space-md shadow-[4px_4px_0px_#000000] rounded">
                    <div className="flex items-center justify-between pb-space-sm border-b-[3px] border-black mb-space-sm">
                      <span className="font-headline-sm text-headline-sm uppercase font-bold">
                        Transaksi Terbaru
                      </span>
                      <Link
                        href="/dashboard"
                        className="font-label-badge text-label-badge uppercase bg-surface-container border-[2px] border-black px-space-sm py-space-xs hover:bg-black hover:text-white transition-colors rounded-sm"
                      >
                        + Buka Dashboard
                      </Link>
                    </div>

                    {/* Ledger Feed Items */}
                    <div className="space-y-space-sm">
                      {/* Item 1 */}
                      <div className="flex items-center justify-between p-space-sm border-[2px] border-black bg-surface hover:bg-surface-container transition-colors rounded">
                        <div className="flex items-center gap-space-sm">
                          <span className="font-label-badge text-label-badge bg-secondary-container px-space-sm py-space-xs border-[2px] border-black uppercase rounded-sm">
                            DATES
                          </span>
                          <div>
                            <div className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                              Tiket XXI Dune Part 2 + Popcorn
                            </div>
                            <div className="font-body-sm text-body-sm text-on-surface-variant">
                              Dibayar oleh Aris • Split 50%
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-headline-sm text-headline-sm text-secondary font-bold">
                            - Rp 195.000
                          </div>
                          <div className="font-label-badge text-label-badge text-on-surface-variant">
                            Hari ini, 19:30
                          </div>
                        </div>
                      </div>

                      {/* Item 2 */}
                      <div className="flex items-center justify-between p-space-sm border-[2px] border-black bg-surface hover:bg-surface-container transition-colors rounded">
                        <div className="flex items-center gap-space-sm">
                          <span className="font-label-badge text-label-badge bg-[#FDE047] px-space-sm py-space-xs border-[2px] border-black uppercase rounded-sm">
                            GROCERIES
                          </span>
                          <div>
                            <div className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                              Belanja Mingguan Superindo
                            </div>
                            <div className="font-body-sm text-body-sm text-on-surface-variant">
                              Dibayar oleh Nisa • Split 50%
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-headline-sm text-headline-sm text-secondary font-bold">
                            - Rp 542.800
                          </div>
                          <div className="font-label-badge text-label-badge text-on-surface-variant">
                            Kemarin, 14:15
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: CARA KERJA */}
          <section className="w-full py-space-xl bg-surface" id="cara-kerja">
            <div className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin">
              <div className="text-center max-w-xl mx-auto mb-space-xl">
                <span className="font-label-badge text-label-badge bg-primary-container text-black px-space-sm py-space-xs border-[2px] border-black uppercase shadow-[2px_2px_0px_#000000] rounded-sm">
                  Gampang Banget
                </span>
                <h2 className="font-headline-lg text-headline-lg uppercase mt-space-sm font-black">
                  Cara Kerja Dalam 3 Langkah Simpel
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
                  Nggak butuh spreadsheet rumit. Cuma butuh waktu 60 detik untuk
                  setup dompet bersama.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
                {/* Step 1 */}
                <div className="bg-surface-container-lowest border-[4px] border-black p-space-lg shadow-[6px_6px_0px_#000000] rounded-xl relative">
                  <div className="w-16 h-16 bg-[#FDE047] border-[3px] border-black shadow-[4px_4px_0px_#000000] flex items-center justify-center font-numeric-stat text-numeric-stat text-black mb-space-md rounded">
                    01
                  </div>
                  <h3 className="font-headline-md text-headline-md uppercase mb-space-sm font-bold">
                    Undang Pasangan via Link Rahasia
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface">
                    Bikin akun Barengyin, lalu kirim tautan invite spesial ke
                    WhatsApp pasangan kamu. Sekali klik, kalian langsung
                    terhubung satu brankas.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-surface-container-lowest border-[4px] border-black p-space-lg shadow-[6px_6px_0px_#000000] rounded-xl relative">
                  <div className="w-16 h-16 bg-secondary-container border-[3px] border-black shadow-[4px_4px_0px_#000000] flex items-center justify-center font-numeric-stat text-numeric-stat text-black mb-space-md rounded">
                    02
                  </div>
                  <h3 className="font-headline-md text-headline-md uppercase mb-space-sm font-bold">
                    Pilih Mode Dompet: Gabung atau Pisah
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface">
                    Atur aturan main kalian: mau bagi rata 50:50 untuk pengeluaran
                    bersama, bayar proporsional persentase gaji, atau dompet
                    gabungan total.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="bg-surface-container-lowest border-[4px] border-black p-space-lg shadow-[6px_6px_0px_#000000] rounded-xl relative">
                  <div className="w-16 h-16 bg-primary-container border-[3px] border-black shadow-[4px_4px_0px_#000000] flex items-center justify-center font-numeric-stat text-numeric-stat text-black mb-space-md rounded">
                    03
                  </div>
                  <h3 className="font-headline-md text-headline-md uppercase mb-space-sm font-bold">
                    Input atau Scan Struk &amp; Santai Bareng
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface">
                    Tiap jajan atau bayar sewa kos, tinggal jepret struknya.
                    Barengyin yang hitungin selisihnya, kalian tinggal fokus
                    pacaran bahagia.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: TESTIMONIAL & FAQ */}
          <section
            className="w-full py-space-xl bg-[#F7F4EB] border-t-[4px] border-black"
            id="faq"
          >
            <div className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
                {/* Left Column: Testimonial Sticker */}
                <div className="lg:col-span-5 flex flex-col items-start">
                  <span className="font-label-badge text-label-badge bg-secondary text-white px-space-sm py-space-xs border-[2px] border-black uppercase shadow-[2px_2px_0px_#000000] mb-space-md rounded-sm">
                    Cerita Asli Pengguna
                  </span>
                  <div className="bg-surface-container-lowest border-[4px] border-black p-space-lg shadow-[8px_8px_0px_#000000] rotate-[-2deg] rounded-xl relative">
                    <span className="font-display-hero text-display-hero text-primary absolute -top-8 -left-2 select-none leading-none">
                      “
                    </span>
                    <p className="font-headline-sm text-headline-sm uppercase text-on-surface mt-space-sm mb-space-md relative z-10 leading-snug font-bold">
                      Dulu sering ribut tiap akhir bulan nanya uang lari ke mana,
                      sekarang tinggal buka Barengyin! Semua clear, kencan jadi
                      bebas rasa bersalah.
                    </p>
                    <div className="flex items-center gap-space-sm pt-space-sm border-t-[3px] border-black">
                      <div className="w-10 h-10 rounded-full bg-[#FDE047] border-[2px] border-black flex items-center justify-center font-bold">
                        DR
                      </div>
                      <div>
                        <div className="font-headline-sm text-body-md uppercase font-bold">
                          Dion &amp; Rania
                        </div>
                        <div className="font-body-sm text-body-sm text-on-surface-variant font-bold">
                          Pacaran 3 Tahun • Jakarta Selatan
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Interactive FAQ Accordion */}
                <div className="lg:col-span-7 flex flex-col gap-space-md">
                  <h3 className="font-headline-lg text-headline-lg uppercase mb-space-xs font-black">
                    Pertanyaan Yang Sering Ditanyain
                  </h3>

                  {/* FAQ Item 1 */}
                  <div className="bg-surface-container-lowest border-[3px] border-black shadow-[4px_4px_0px_#000000] rounded">
                    <button
                      className="w-full text-left p-space-md font-headline-sm text-headline-sm uppercase flex justify-between items-center bg-surface-container-low hover:bg-primary-container transition-colors cursor-pointer font-bold"
                      onClick={() => toggleFaq(0)}
                    >
                      <span>Apakah data perbankan kami aman?</span>
                      <span className="material-symbols-outlined font-bold">
                        {openFaq === 0 ? "remove" : "add"}
                      </span>
                    </button>
                    {openFaq === 0 && (
                      <div className="p-space-md font-body-md text-body-md border-t-[3px] border-black bg-surface-container-lowest">
                        Sangat aman! Barengyin tidak pernah meminta password
                        rekening atau PIN bank kamu. Barengyin murni mencatat
                        transaksi manual atau via foto struk belanjaan secara
                        terenkripsi end-to-end.
                      </div>
                    )}
                  </div>

                  {/* FAQ Item 2 */}
                  <div className="bg-surface-container-lowest border-[3px] border-black shadow-[4px_4px_0px_#000000] rounded">
                    <button
                      className="w-full text-left p-space-md font-headline-sm text-headline-sm uppercase flex justify-between items-center bg-surface-container-low hover:bg-primary-container transition-colors cursor-pointer font-bold"
                      onClick={() => toggleFaq(1)}
                    >
                      <span>Bisa dipakai kalau belum menikah?</span>
                      <span className="material-symbols-outlined font-bold">
                        {openFaq === 1 ? "remove" : "add"}
                      </span>
                    </button>
                    {openFaq === 1 && (
                      <div className="p-space-md font-body-md text-body-md border-t-[3px] border-black bg-surface-container-lowest">
                        Tentu saja! Banyak pengguna Barengyin yang masih pacaran
                        atau tunangan untuk split bon nonton, makan bareng, dan
                        nabung liburan bersama secara fair.
                      </div>
                    )}
                  </div>

                  {/* FAQ Item 3 */}
                  <div className="bg-surface-container-lowest border-[3px] border-black shadow-[4px_4px_0px_#000000] rounded">
                    <button
                      className="w-full text-left p-space-md font-headline-sm text-headline-sm uppercase flex justify-between items-center bg-surface-container-low hover:bg-primary-container transition-colors cursor-pointer font-bold"
                      onClick={() => toggleFaq(2)}
                    >
                      <span>Apakah aplikasi ini beneran gratis?</span>
                      <span className="material-symbols-outlined font-bold">
                        {openFaq === 2 ? "remove" : "add"}
                      </span>
                    </button>
                    {openFaq === 2 && (
                      <div className="p-space-md font-body-md text-body-md border-t-[3px] border-black bg-surface-container-lowest">
                        100% Gratis untuk fitur pencatatan bareng, split
                        kalkulator, dan riwayat transaksi. Kuota scan struk AI
                        juga tersedia gratis agar kamu bisa langsung coba tanpa
                        ribet!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: FINAL CTA BAR */}
          <section className="w-full bg-primary-container border-t-[4px] border-black py-space-xl">
            <div className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin text-center">
              <h2 className="font-display-hero text-display-hero-mobile md:text-display-hero uppercase tracking-tight text-on-surface mb-space-md leading-none font-black">
                Siap Kelola Uang Bareng Lebih Rukun?
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface max-w-xl mx-auto mb-space-lg font-bold">
                Bergabung dengan 15.000+ pasangan lainnya hari ini. Cuma butuh 1
                menit buat bikin dompet pertama kalian!
              </p>
              <Link
                href="/masuk?mode=register"
                className="inline-flex items-center gap-space-sm font-headline-md text-headline-md uppercase px-space-xl py-space-md bg-surface-container-lowest text-black border-[4px] border-black shadow-[6px_6px_0px_#000000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_#000000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all rounded font-bold"
              >
                Mulai Bareng Pasangan Sekarang →
              </Link>
            </div>
          </section>

          {/* FOOTER SUB-NAV */}
          <div className="w-full bg-[#F7F4EB] border-t-[4px] border-black py-space-lg">
            <div className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin flex flex-col md:flex-row justify-between items-center gap-space-md">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-space-md font-headline-sm text-headline-sm uppercase text-on-surface font-semibold">
                <a className="hover:underline" href="#">
                  Tentang Kami
                </a>
                <a className="hover:underline" href="#fitur">
                  Fitur
                </a>
                <a className="hover:underline" href="#">
                  Keamanan Data
                </a>
                <a className="hover:underline" href="#">
                  Syarat &amp; Ketentuan
                </a>
                <a className="hover:underline" href="#">
                  Kebijakan Privasi
                </a>
                <a className="hover:underline" href="#">
                  Hubungi Kami
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="w-full bg-surface-container-highest border-t-[3px] border-black py-space-md">
        <div className="max-w-[1200px] mx-auto px-margin-mobile lg:px-margin flex flex-col md:flex-row justify-between items-center gap-space-md">
          <div className="flex items-center gap-space-sm">
            <span className="font-headline-md text-headline-md uppercase text-on-surface tracking-tight font-black">
              Barengyin.
            </span>
            <span className="font-label-badge text-label-badge px-space-sm py-space-xs bg-secondary-container text-on-surface border-[2px] border-black uppercase shadow-[2px_2px_0px_#000000] rounded-sm font-bold">
              Couples Expense &amp; Income Tracker
            </span>
          </div>
          <div className="font-body-sm text-body-sm font-bold text-on-surface-variant">
            © 2026 Barengyin. Dibuat untuk pasangan saling percaya.
          </div>
        </div>
      </footer>
    </div>
  );
}
