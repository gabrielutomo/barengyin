"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { formatRupiahInput, parseRupiahInput } from "@/lib/currency";

interface ExtractedItem {
  name: string;
  quantity?: number;
  price?: number;
}

interface ExtractedData {
  merchant_name: string | null;
  total_amount: number;
  suggested_category: string;
  items?: ExtractedItem[];
}

export default function ScanStrukPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [couple, setCouple] = useState<{ id: string; name: string } | null>(null);
  const [partner, setPartner] = useState<{ id: string; full_name: string } | null>(null);

  // File and Camera state
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // AI OCR state
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);

  // Confirmation Form Fields
  const [merchantName, setMerchantName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [category, setCategory] = useState("Makan & Kencan");
  const [paidBy, setPaidBy] = useState("Saya");
  const [splitMethod, setSplitMethod] = useState("fifty_fifty");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const myDisplayName = profile?.full_name || "Saya";
  const partnerDisplayName = partner?.full_name || "Pasangan";

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/masuk");
          return;
        }

        setCurrentUser({ id: user.id, email: user.email });

        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        const myName = prof?.full_name || user.email?.split("@")[0] || "Saya";
        setProfile({ full_name: myName });
        setPaidBy(myName);

        const { data: members } = await supabase
          .from("couple_members")
          .select("couple_id")
          .eq("profile_id", user.id)
          .limit(1);

        const activeCoupleId = members?.[0]?.couple_id;
        if (activeCoupleId) {
          const { data: cRow } = await supabase
            .from("couples")
            .select("id, name")
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
        }
      } catch (err) {
        console.warn("Could not load user data:", err);
      }
    }

    loadData();
  }, [router, supabase]);

  // Process File Selection
  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setScanError(null);
    setExtractedData(null);
  };

  // Trigger AI Scan
  const handleProcessScan = async () => {
    if (!selectedFile) return;

    setIsScanning(true);
    setScanError(null);

    const formData = new FormData();
    formData.append("receipt", selectedFile);

    try {
      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (json.success && json.data) {
        const data: ExtractedData = json.data;
        setExtractedData(data);
        setMerchantName(data.merchant_name || "Struk Belanja");
        setTotalAmount(data.total_amount ? formatRupiahInput(data.total_amount) : "");
        if (data.suggested_category) {
          setCategory(data.suggested_category);
        }
        showToast("Struk berhasil dibaca oleh AI Vision!");
      } else {
        throw new Error(json.error || "Gagal memproses struk dengan AI.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses gambar.";
      setScanError(msg);
      // Fallback data agar pengguna tetap bisa mengisi secara manual
      setExtractedData({
        merchant_name: "Struk Belanja",
        total_amount: 0,
        suggested_category: "Makan & Kencan",
        items: [],
      });
      setMerchantName("Struk Belanja");
    } finally {
      setIsScanning(false);
    }
  };

  // Save Scanned Transaction to Supabase
  const handleSaveToTransactions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couple || !currentUser || !merchantName.trim() || !totalAmount) return;

    const numAmount = parseRupiahInput(totalAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Masukkan nominal transaksi yang valid.");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.from("transactions").insert({
        couple_id: couple.id,
        created_by: currentUser.id,
        creator_name: myDisplayName,
        title: merchantName.trim(),
        amount: numAmount,
        type: "expense",
        category_id: category,
        paid_by: paidBy,
        split_method: splitMethod,
        transaction_date: new Date().toISOString().split("T")[0],
        description: extractedData?.items && extractedData.items.length > 0
          ? extractedData.items.map((it) => `${it.name} (${it.quantity || 1}x)`).join(", ")
          : "Dicatat via AI Scan Struk",
      });

      if (error) throw error;

      showToast(`Transaksi "${merchantName}" berhasil disimpan!`);
      // Reset form & view
      setSelectedFile(null);
      setImagePreview(null);
      setExtractedData(null);
      setMerchantName("");
      setTotalAmount("");

      // Redirect ke halaman transaksi
      setTimeout(() => {
        router.push("/transaksi");
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan transaksi hasil scan.";
      alert(`Terjadi kesalahan: ${msg}`);
    } finally {
      setIsSaving(false);
    }
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
        activeNav="scan"
        coupleName={couple?.name || `Dompet ${myDisplayName}`}
        partnerName={partner?.full_name}
        isPartnerConnected={Boolean(partner)}
      />

      {/* MAIN CONTENT AREA */}
      <div className="pl-0 md:pl-60 pb-20 md:pb-12 min-h-screen">
        {/* TOP HEADER */}
        <header className="fixed top-0 left-0 md:left-60 right-0 h-16 bg-surface-container-lowest border-b-[3px] border-black z-40 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
            <span className="font-label-badge text-label-badge uppercase px-2.5 sm:px-3 py-1 bg-[#FDE047] text-on-surface border-[2px] border-black shadow-[2px_2px_0px_#000] rounded-sm font-black flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-sm">photo_camera</span>
              <span className="truncate">SCAN STRUK AI</span>
            </span>
            <span className="hidden sm:inline font-body-sm text-xs text-on-surface-variant font-bold truncate">
              • {couple?.name || "Dompet Bersama"}
            </span>
          </div>

          <Link
            href="/transaksi"
            prefetch={true}
            className="text-xs font-headline-sm uppercase font-black px-3 py-1.5 bg-white border-2 border-black rounded shadow-[2px_2px_0px_#000] hover:bg-slate-100 flex items-center gap-1"
          >
            <span className="hidden sm:inline">Daftar Transaksi</span>
            <span className="sm:hidden">Transaksi</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </header>

        {/* MAIN BODY */}
        <main className="pt-24 pb-16 px-6 sm:px-8 max-w-5xl mx-auto space-y-8">
          {/* INTRO HERO BANNER */}
          <div className="bg-surface-container-lowest border-[3px] border-black shadow-[5px_5px_0px_#000] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="font-headline-lg uppercase font-black text-xl tracking-tight">
                Scan Bon Belanja Otomatis
              </h1>
              <p className="font-body-sm text-xs text-on-surface-variant font-bold">
                Jepret langsung via kamera HP atau unggah foto struk. AI Vision akan mengekstrak merchant, harga, dan item secara instan!
              </p>
            </div>

            {/* Quick Action Camera & Upload Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* HIDDEN INPUTS */}
              {/* 1. Direct Camera Input (Opens native mobile camera instantly) */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(file);
                }}
              />
              {/* 2. Standard Gallery File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(file);
                }}
              />

              {/* CAMERA BUTTON */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-4 py-2.5 bg-primary-container hover:bg-[#a6e6ff] text-on-surface border-[3px] border-black rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">photo_camera</span>
                <span>Buka Kamera HP</span>
              </button>

              {/* GALLERY UPLOAD BUTTON */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-on-surface border-[3px] border-black rounded font-headline-sm uppercase font-black text-xs shadow-[3px_3px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">upload_file</span>
                <span>Pilih dari Galeri</span>
              </button>
            </div>
          </div>

          {/* TWO COLUMN WORKSPACE: UPLOAD / PREVIEW (LEFT) + AI EXTRACTION VERIFICATION (RIGHT) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: DROPZONE / CAMERA PREVIEW */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl shadow-[6px_6px_0px_#000] p-6 space-y-4">
                <div className="flex items-center justify-between border-b-2 border-black pb-3">
                  <h3 className="font-headline-sm uppercase font-black text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">receipt</span>
                    <span>Foto Struk Belanja</span>
                  </h3>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setImagePreview(null);
                        setExtractedData(null);
                      }}
                      className="font-label-badge text-[10px] uppercase font-black px-2 py-0.5 border border-black rounded bg-[#ffdad6] text-[#ba1a1a] hover:bg-white cursor-pointer"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>

                {!imagePreview ? (
                  /* DROPZONE */
                  <div
                    onClick={() => cameraInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFileChange(file);
                    }}
                    className="border-[3px] border-dashed border-black rounded-xl p-8 text-center bg-surface-container-low hover:bg-[#eff6ff] transition-colors cursor-pointer space-y-3"
                  >
                    <div className="w-16 h-16 mx-auto rounded-full bg-primary-container border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                      <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                    </div>
                    <div>
                      <div className="font-headline-sm uppercase font-black text-sm">
                        Sentuh untuk Buka Kamera
                      </div>
                      <p className="font-body-sm text-xs text-on-surface-variant font-bold mt-1">
                        atau seret &amp; lepas gambar struk (JPG, PNG, WebP)
                      </p>
                    </div>
                  </div>
                ) : (
                  /* PREVIEW BOX */
                  <div className="space-y-4">
                    <div className="relative rounded-lg border-2 border-black overflow-hidden bg-black/5 max-h-[380px] flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Preview Struk"
                        className="max-h-[380px] w-auto object-contain"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={handleProcessScan}
                      className="w-full py-3.5 bg-[#D4F34A] hover:bg-[#c2e439] text-black border-[3px] border-black rounded font-headline-sm uppercase font-black text-sm shadow-[4px_4px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-xl">
                        {isScanning ? "sync" : "auto_fix_high"}
                      </span>
                      <span>{isScanning ? "Memindai dengan AI..." : "Ekstrak Data Struk (AI)"}</span>
                    </button>
                  </div>
                )}

                {scanError && (
                  <div className="p-3 bg-[#ffdad6] border-2 border-[#ba1a1a] rounded text-xs font-bold text-[#ba1a1a] flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">error</span>
                    <span>{scanError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: VERIFICATION & EDIT FORM */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-surface-container-lowest border-[4px] border-black rounded-xl shadow-[6px_6px_0px_#000] p-6 space-y-4">
                <div className="border-b-2 border-black pb-3">
                  <h3 className="font-headline-sm uppercase font-black text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">fact_check</span>
                    <span>Verifikasi &amp; Simpan Hasil Scan</span>
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant font-bold mt-0.5">
                    Periksa kembali data yang dideteksi AI sebelum disimpan ke Dompet Bersama
                  </p>
                </div>

                <form onSubmit={handleSaveToTransactions} className="space-y-4">
                  {/* Merchant Name */}
                  <div>
                    <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                      Nama Merchant / Toko
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kopi Kenangan, Superindo"
                      value={merchantName}
                      onChange={(e) => setMerchantName(e.target.value)}
                      className="w-full border-[3px] border-black rounded p-2.5 font-body-md font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                    />
                  </div>

                  {/* Total Amount */}
                  <div>
                    <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                      Total Belanja (Rp) • <span className="text-primary lowercase font-normal">titik otomatis</span>
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
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(formatRupiahInput(e.target.value))}
                        className="w-full pl-12 pr-4 py-2.5 border-[3px] border-black rounded font-numeric-stat text-2xl font-bold focus:shadow-[3px_3px_0px_#000] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Items list preview (if extracted) */}
                  {extractedData?.items && extractedData.items.length > 0 && (
                    <div className="p-3 bg-surface-container-low border-2 border-black rounded space-y-1.5 max-h-36 overflow-y-auto">
                      <div className="font-label-badge uppercase text-[10px] font-black text-on-surface-variant">
                        Item Dideteksi:
                      </div>
                      {extractedData.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs font-bold">
                          <span className="truncate flex-1">{item.name} {item.quantity ? `(${item.quantity}x)` : ""}</span>
                          {item.price ? <span className="ml-2 whitespace-nowrap">Rp {item.price.toLocaleString("id-ID")}</span> : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Kategori */}
                  <div>
                    <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                      Kategori
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full border-[3px] border-black rounded p-2.5 font-body-md font-bold bg-white cursor-pointer"
                    >
                      <option>Makan & Kencan</option>
                      <option>Groceries & Rumah</option>
                      <option>Transportasi</option>
                      <option>Hiburan & Nonton</option>
                      <option>Tagihan & Utilitas</option>
                      <option>Kesehatan & Skincare</option>
                      <option>Lainnya</option>
                    </select>
                  </div>

                  {/* Payer & Split */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-label-badge uppercase block mb-1 text-xs font-bold">
                        Dibayar Oleh
                      </label>
                      <select
                        value={paidBy}
                        onChange={(e) => setPaidBy(e.target.value)}
                        className="w-full border-[3px] border-black rounded p-2.5 font-body-md font-bold bg-white cursor-pointer"
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
                        value={splitMethod}
                        onChange={(e) => setSplitMethod(e.target.value)}
                        className="w-full border-[3px] border-black rounded p-2.5 font-body-md font-bold bg-white cursor-pointer"
                      >
                        <option value="fifty_fifty">Split 50 : 50</option>
                        <option value="proportional">Proporsional (60:40)</option>
                        <option value="full_by_payer">Ditanggung Penuh</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving || !merchantName.trim() || !totalAmount}
                    className="w-full py-3 bg-primary-container text-black border-[3px] border-black rounded font-headline-sm uppercase font-black text-sm shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {isSaving ? "Menyimpan ke Dompet..." : "Konfirmasi & Simpan Transaksi"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
