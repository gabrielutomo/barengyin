"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export interface CategoryData {
  name: string;
  amount: number;
  icon?: string;
  color?: string;
  percentage?: number;
}

interface CategoryPieChartProps {
  data: CategoryData[];
  totalExpense: number;
  periodLabel?: string;
}

// Theme colors aligned with Barengyin Neo-Brutalist design
const THEME_PALETTE: Record<string, { color: string; icon: string }> = {
  "makan & kencan": { color: "#FD6A49", icon: "restaurant" },
  "groceries & rumah": { color: "#FDE047", icon: "shopping_bag" },
  transportasi: { color: "#38BDF8", icon: "directions_car" },
  "hiburan & nonton": { color: "#A855F7", icon: "live_tv" },
  "tagihan & utilitas": { color: "#94A3B8", icon: "receipt" },
  "kesehatan & skincare": { color: "#FF85A2", icon: "medical_services" },
  gaji: { color: "#D4F34A", icon: "payments" },
  investasi: { color: "#22C55E", icon: "trending_up" },
  lainnya: { color: "#CBD5E1", icon: "category" },
  umum: { color: "#D4F34A", icon: "receipt_long" },
};

const FALLBACK_COLORS = [
  "#FD6A49",
  "#FDE047",
  "#38BDF8",
  "#A855F7",
  "#D4F34A",
  "#FF85A2",
  "#2DD4BF",
  "#FB923C",
  "#94A3B8",
];

function getCoordinatesForPercent(percent: number, radius: number, cx = 120, cy = 120) {
  // Start from top (-90 deg / -PI/2)
  const angle = percent * 2 * Math.PI - Math.PI / 2;
  const x = cx + radius * Math.cos(angle);
  const y = cy + radius * Math.sin(angle);
  return { x, y };
}

export function CategoryPieChart({
  data,
  totalExpense,
  periodLabel = "Bulan Ini",
}: CategoryPieChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Normalize data with color and icons
  const normalizedData = useMemo(() => {
    if (!data || data.length === 0 || totalExpense <= 0) return [];

    return data
      .filter((item) => item.amount > 0)
      .map((item, idx) => {
        const key = item.name.toLowerCase().trim();
        const config = THEME_PALETTE[key];
        const color =
          item.color || config?.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
        const icon = item.icon || config?.icon || "category";
        const percentage = Math.round((item.amount / totalExpense) * 100);

        return {
          ...item,
          color,
          icon,
          percentage: percentage > 0 ? percentage : 1,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [data, totalExpense]);

  // Generate SVG slice paths
  const slices = useMemo(() => {
    if (normalizedData.length === 0) return [];

    const total = normalizedData.reduce((sum, item) => sum + item.amount, 0);
    if (total <= 0) return [];

    let accumulatedPercent = 0;
    const R_OUTER = 98;
    const R_INNER = 58;
    const CX = 120;
    const CY = 120;

    // Special case: Only 1 category (100%)
    if (normalizedData.length === 1) {
      const item = normalizedData[0];
      // Draw 2 half-arcs to prevent SVG full-circle collapse
      const p1 = `M 120 ${CY - R_OUTER} A ${R_OUTER} ${R_OUTER} 0 0 1 120 ${CY + R_OUTER} L 120 ${CY + R_INNER} A ${R_INNER} ${R_INNER} 0 0 0 120 ${CY - R_INNER} Z`;
      const p2 = `M 120 ${CY + R_OUTER} A ${R_OUTER} ${R_OUTER} 0 0 1 120 ${CY - R_OUTER} L 120 ${CY - R_INNER} A ${R_INNER} ${R_INNER} 0 0 0 120 ${CY + R_INNER} Z`;

      return [
        {
          index: 0,
          item,
          path: `${p1} ${p2}`,
          percentage: 100,
        },
      ];
    }

    return normalizedData.map((item, idx) => {
      const slicePercent = item.amount / total;
      const startPercent = accumulatedPercent;
      const endPercent = accumulatedPercent + slicePercent;
      accumulatedPercent = endPercent;

      const startOuter = getCoordinatesForPercent(startPercent, R_OUTER, CX, CY);
      const endOuter = getCoordinatesForPercent(endPercent, R_OUTER, CX, CY);
      const startInner = getCoordinatesForPercent(startPercent, R_INNER, CX, CY);
      const endInner = getCoordinatesForPercent(endPercent, R_INNER, CX, CY);

      const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

      const path = [
        `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)}`,
        `A ${R_OUTER} ${R_OUTER} 0 ${largeArcFlag} 1 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)}`,
        `L ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)}`,
        `A ${R_INNER} ${R_INNER} 0 ${largeArcFlag} 0 ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)}`,
        "Z",
      ].join(" ");

      return {
        index: idx,
        item,
        path,
        percentage: Math.round(slicePercent * 100),
      };
    });
  }, [normalizedData]);

  // Active slice for center display
  const activeItem = hoveredIdx !== null ? normalizedData[hoveredIdx] : null;

  return (
    <div className="bg-surface-container-lowest border-[4px] border-black shadow-[6px_6px_0px_#000] rounded-xl overflow-hidden">
      {/* CARD HEADER */}
      <div className="p-4 border-b-[3px] border-black bg-surface-container-low flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#FDE047] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
            <span className="material-symbols-outlined text-lg text-black">pie_chart</span>
          </div>
          <div>
            <h2 className="font-headline-sm uppercase font-black text-sm leading-tight">
              Distribusi Pengeluaran per Kategori
            </h2>
            <p className="font-body-sm text-[11px] text-on-surface-variant font-bold">
              Visualisasi proporsi alokasi dana belanja ({periodLabel})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-label-badge text-[10px] uppercase font-black px-2.5 py-1 bg-[#D4F34A] border-2 border-black rounded shadow-[1.5px_1.5px_0px_#000]">
            {normalizedData.length} Kategori Aktif
          </span>
        </div>
      </div>

      {/* CARD BODY */}
      <div className="p-5 sm:p-6">
        {normalizedData.length === 0 ? (
          /* EMPTY STATE */
          <div className="py-12 px-4 text-center space-y-3 bg-surface-container-low/40 border-2 border-dashed border-black/30 rounded-xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-surface-container border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_#000]">
              <span className="material-symbols-outlined text-2xl text-on-surface-variant">
                donut_large
              </span>
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="font-headline-sm uppercase font-black text-sm">
                Belum Ada Pengeluaran Terdata
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant font-bold">
                Grafik donat akan otomatis muncul setelah kalian mencatat pengeluaran di Dompet Bersama.
              </p>
            </div>
            <Link
              href="/transaksi"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D4F34A] hover:bg-[#c2e439] text-black border-2 border-black rounded font-headline-sm uppercase text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>+ Catat Pengeluaran Pertama</span>
            </Link>
          </div>
        ) : (
          /* CHART + LEGEND CONTENT */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* LEFT: DONUT SVG */}
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-56 h-56 sm:w-64 sm:h-64">
                <svg
                  viewBox="0 0 240 240"
                  className="w-full h-full drop-shadow-[3px_3px_0px_#000] transition-transform duration-200"
                >
                  {slices.map((slice) => {
                    const isHovered = hoveredIdx === slice.index;
                    return (
                      <path
                        key={slice.index}
                        d={slice.path}
                        fill={slice.item.color}
                        stroke="#000000"
                        strokeWidth={isHovered ? "3.5" : "2.5"}
                        strokeLinejoin="round"
                        className="cursor-pointer transition-all duration-150 origin-center hover:opacity-95"
                        style={{
                          transform: isHovered ? "scale(1.03)" : "scale(1)",
                          transformOrigin: "120px 120px",
                        }}
                        onMouseEnter={() => setHoveredIdx(slice.index)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      />
                    );
                  })}
                </svg>

                {/* CENTER DONUT HOLE INFORMATION */}
                <div
                  className="absolute inset-0 m-auto w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-surface-container-lowest border-2 border-black flex flex-col items-center justify-center text-center p-2 pointer-events-none shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)]"
                >
                  {activeItem ? (
                    <>
                      <span className="font-label-badge text-[9px] uppercase font-black text-on-surface-variant truncate max-w-[90px]">
                        {activeItem.name}
                      </span>
                      <span className="font-numeric-stat text-xs sm:text-sm font-black text-black leading-tight mt-0.5">
                        Rp {activeItem.amount.toLocaleString("id-ID")}
                      </span>
                      <span className="font-label-badge text-[10px] font-black px-1.5 py-0.2 bg-[#FDE047] border border-black rounded mt-1">
                        {activeItem.percentage}%
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-label-badge text-[9px] uppercase font-black text-on-surface-variant leading-tight">
                        TOTAL BELANJA
                      </span>
                      <span className="font-numeric-stat text-xs sm:text-sm font-black text-black leading-tight mt-0.5">
                        Rp {totalExpense.toLocaleString("id-ID")}
                      </span>
                      <span className="font-body-sm text-[10px] font-bold text-on-surface-variant mt-0.5">
                        {normalizedData.length} Kategori
                      </span>
                    </>
                  )}
                </div>
              </div>

              <p className="font-body-sm text-[11px] text-on-surface-variant font-bold text-center mt-3">
                💡 Sentuh atau hover irisan donat untuk melihat detail
              </p>
            </div>

            {/* RIGHT: DETAILED CATEGORY LIST & PROGRESS BARS */}
            <div className="md:col-span-7 space-y-2.5">
              <div className="text-xs font-headline-sm uppercase font-black text-on-surface-variant flex items-center justify-between pb-1 border-b border-black/20">
                <span>Rincian Berdasarkan Kategori</span>
                <span>Nominal &amp; Porsi</span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 no-scrollbar">
                {normalizedData.map((item, idx) => {
                  const isHovered = hoveredIdx === idx;
                  return (
                    <div
                      key={item.name}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className={`p-2.5 rounded-lg border-2 border-black transition-all cursor-pointer ${
                        isHovered
                          ? "bg-surface-container-high shadow-[3px_3px_0px_#000] -translate-y-0.5"
                          : "bg-surface-container-low hover:bg-surface-container shadow-[2px_2px_0px_#000]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Color Badge + Icon */}
                          <div
                            className="w-7 h-7 rounded border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]"
                            style={{ backgroundColor: item.color }}
                          >
                            <span className="material-symbols-outlined text-sm text-black">
                              {item.icon}
                            </span>
                          </div>

                          <span className="font-headline-sm text-xs uppercase font-black truncate text-on-surface">
                            {item.name}
                          </span>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <span className="font-numeric-stat text-xs font-black text-black">
                            Rp {item.amount.toLocaleString("id-ID")}
                          </span>
                          <span
                            className="font-label-badge text-[10px] font-black px-1.5 py-0.5 border border-black rounded shadow-[1px_1px_0px_#000]"
                            style={{ backgroundColor: item.color }}
                          >
                            {item.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Mini visual ratio bar */}
                      <div className="w-full bg-white h-2 border border-black rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Insight Footer */}
              {normalizedData[0] && (
                <div className="pt-2">
                  <div className="p-3 bg-[#EBE1FF] border-2 border-black rounded shadow-[2px_2px_0px_#000] flex items-center gap-2 text-xs font-bold text-on-surface">
                    <span className="material-symbols-outlined text-base text-primary">priority_high</span>
                    <span>
                      Pengeluaran terbesar ada di kategori <b>{normalizedData[0].name}</b> ({normalizedData[0].percentage}% dari total anggaran keluar).
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
