---
name: Barengyin Design System — Kinetic Neo-Brutalist Duo
stack: Next.js 16 (App Router) + Tailwind CSS + Supabase
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1b1b1b'
  on-surface-variant: '#454935'
  inverse-surface: '#303030'
  inverse-on-surface: '#f1f1f1'
  outline: '#767963'
  outline-variant: '#c6c9af'
  primary: '#556500'
  on-primary: '#ffffff'
  primary-container: '#d4f34a'
  on-primary-container: '#5c6d00'
  secondary: '#ae3115'
  on-secondary: '#ffffff'
  secondary-container: '#fd6a49'
  on-secondary-container: '#640f00'
  tertiary: '#674bb5'
  on-tertiary: '#ffffff'
  tertiary-container: '#ebe1ff'
  on-tertiary-container: '#6f53be'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  background: '#f9f9f9'
  on-background: '#1b1b1b'
  canvas-cream: '#F6F4EE'
  accent-cyan: '#38BDF8'
  accent-yellow: '#FDE047'
  income-green: '#22C55E'
  expense-red: '#EF4444'
typography:
  display-hero: { fontFamily: 'Space Grotesk', fontSize: 56px, fontWeight: 700, lineHeight: 60px, letterSpacing: -0.04em }
  headline-lg: { fontFamily: 'Space Grotesk', fontSize: 32px, fontWeight: 700, lineHeight: 38px, letterSpacing: -0.03em }
  headline-md: { fontFamily: 'Space Grotesk', fontSize: 24px, fontWeight: 700, lineHeight: 30px, letterSpacing: -0.02em }
  headline-sm: { fontFamily: 'Space Grotesk', fontSize: 20px, fontWeight: 600, lineHeight: 26px, letterSpacing: -0.01em }
  body-lg: { fontFamily: 'Space Grotesk', fontSize: 18px, fontWeight: 500, lineHeight: 26px }
  body-md: { fontFamily: 'Space Grotesk', fontSize: 15px, fontWeight: 500, lineHeight: 22px }
  body-sm: { fontFamily: 'Space Grotesk', fontSize: 13px, fontWeight: 500, lineHeight: 18px, letterSpacing: 0.01em }
  label-badge: { fontFamily: 'Space Grotesk', fontSize: 12px, fontWeight: 700, lineHeight: 14px, letterSpacing: 0.06em }
  numeric-stat: { fontFamily: 'Space Grotesk', fontSize: 40px, fontWeight: 700, lineHeight: 44px, letterSpacing: -0.03em }
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
spacing:
  gutter: 1.25rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## 1. Brand & Style

Barengyin memakai bahasa visual **Kinetic Neo-Brutalist Duo** — energik, mentah (raw), tactile, bergaya zine/sticker sheet. Ini sengaja menjauh dari dashboard fintech yang steril dan konservatif, karena produk berbicara soal uang pasangan dengan nada ringan, jujur, dan tanpa drama.

### Prinsip Inti
- **Physical Sticker & Print Tone** — outline tebal, susunan blok asimetris, warna solid jenuh (bukan gradient) meniru kertas gunting, risograph print, dan sticker sheet.
- **Radical Candor & Transparency** — border tegas dan shadow offset keras merepresentasikan kejujuran struktural. Tidak ada yang "disembunyikan" di balik blur atau efek kaca (glassmorphism).
- **Playful Tactility** — komponen interaktif berperilaku seperti saklar mekanis fisik: menekan, bergeser, memberi feedback fisik saat diklik/disentuh.
- **Partner Parity** — bobot visual antara dua pasangan harus selalu seimbang, tidak ada hierarki antara Partner A dan Partner B.

**Aturan mutlak:** dilarang menggunakan gradient, blur/backdrop-filter, atau shadow lembut (soft/blurred shadow) di mana pun dalam UI.

---

## 2. Warna

| Token | Hex | Peran |
|---|---|---|
| Canvas / Surface | `#F9F9F9` (app-wide) / `#F6F4EE` (hero/landing) | Latar utama, newsprint cream, menenangkan kontras border hitam |
| Deep Black | `#000000` | Satu-satunya warna untuk border, shadow offset, teks, ikon, garis pembatas |
| Primary — Chartreuse | `#D4F34A` (container) / `#556500` (on) | Aksi utama, tab aktif, indikator split, status positif |
| Secondary — Tangerine | `#FD6A49` (container) / `#AE3115` (on) | Tag partner, peringatan, split urgent, pengeluaran |
| Tertiary — Lilac | `#EBE1FF` (container) / `#674BB5` (on) | Kategori sekunder, langganan berulang, saldo netral |
| Accent Cyan | `#38BDF8` | Insight analitik, transfer, badge partner A |
| Accent Yellow | `#FDE047` | Badge alert, sorotan bulan aktif pada chart |
| Income / Paid | `#22C55E` | Nominal pemasukan (selalu diawali `+`) |
| Expense / Debt | `#EF4444` | Nominal pengeluaran (selalu diawali `-`) |
| Card Neutral | `#FFFFFF` | Latar kartu/container standar |

**Aturan permukaan:** semua warna tint harus fill solid 100%, dibatasi border hitam eksplisit. Tidak ada blending warna.

---

## 3. Tipografi

Seluruh UI memakai **Space Grotesk** di semua peran teks — memberi kesan teknis dan tegas.

- **Angka & nominal:** selalu `font-weight: 700` dengan `font-variant-numeric: tabular-nums` (agar digit sejajar rapi di tabel/list).
- **Badge kategori/status:** uppercase penuh, `letter-spacing: 0.06em`, ukuran 12px, bold — token `label-badge`.
- **Hierarki:** dibangun dari lompatan ukuran font yang tegas dan kontras bobot, bukan dari gradasi abu-abu.

---

## 4. Layout & Spacing

- **Desktop (≥1024px):** container max-width 1200px, grid 12 kolom, `gutter: 1.25rem`, `margin: 2rem`. Dashboard 2 kolom: konten ledger/chart (7-8 kolom) + ringkasan/quick action (4-5 kolom).
- **Tablet (640–1023px):** grid 8 kolom fluid, `gutter: 1rem`, `margin: 1.5rem`.
- **Mobile (<640px):** single-column, `gutter-mobile: 0.75rem`, `margin-mobile: 1rem`, sidebar navigasi collapse menjadi bottom nav atau drawer dengan border pemisah tetap solid.
- **Kepadatan:** padding internal rapat (`space-sm`–`space-md`) dipasangkan dengan jarak eksterior antar-kartu yang lega (`space-lg`) — kartu terasa seperti item cetak yang berdiri sendiri.

### Struktur Dashboard (Sidebar Kiri)
```
┌─────────────┬────────────────────────────────────────┐
│  Sidebar    │  Top Bar (periode, wallet, avatar, notif)│
│  (fixed,    ├────────────────────────────────────────┤
│  w-60,      │  Header sambutan + quick actions         │
│  border-r-  ├────────────────────────────────────────┤
│  [3px]      │  3 Stat Cards (grid 3 kolom)             │
│  black)     ├──────────────────────┬─────────────────┤
│             │  Chart 6 Bulan (7col)│ Progress Anggaran │
│  - Dashboard│                      │ (5 kol)           │
│  - Transaksi├──────────────────────┴─────────────────┤
│  - Anggaran │  Transaksi Terbaru (Live Feed + filter) │
│  - Laporan  │                                          │
│  - Scan     │                                          │
│  - Pasangan │                                          │
│  - Pengaturan                                          │
│  [profil]   │                                          │
└─────────────┴────────────────────────────────────────┘
```

---

## 5. Elevasi & Kedalaman — "The Mechanical Hard Drop Principle"

Kedalaman bersifat struktural dan terarah. **Dilarang** memakai soft drop shadow, Gaussian blur, atau overlay translusen.

| Level | Penggunaan | Style |
|---|---|---|
| Level 0 (Flat) | Baris list, header tabel, disabled state | `border: 3px solid #000; box-shadow: none;` |
| Level 1 (Default) | Kartu, badge, input | `border: 3px solid #000; box-shadow: 4px 4px 0px #000;` |
| Level 2 (Floating) | Modal, drawer, stat penting | `border: 4px solid #000; box-shadow: 6px 6px 0px #000;` |

**State interaktif (tombol/kartu clickable):**
```css
/* Resting */
transform: translate(0, 0);
box-shadow: 4px 4px 0px #000;

/* Hover */
transform: translate(-1px, -1px);
box-shadow: 5px 5px 0px #000;

/* Active / Pressed */
transform: translate(4px, 4px);
box-shadow: 0px 0px 0px #000;
```

**Modal scrim:** solid `#000000` dengan `opacity: 0.5` (atau pola cross-hatch/halftone SVG). Tidak pakai `backdrop-filter`.

---

## 6. Bentuk (Shapes)

- **Elemen default:** radius 4px.
- **Kartu & modal luar:** radius 8px.
- **Larangan tegas:** bentuk pill penuh (`border-radius: 9999px`) dilarang. Badge, avatar, tombol maksimal radius 6px, tetap dalam profil persegi.

---

## 7. Komponen

### 7.1 Tombol
| Varian | Style |
|---|---|
| Primary | bg `#D4F34A`, teks `#000`, border 3px hitam, shadow `4px 4px 0px #000`, font-weight 700 |
| Destructive | bg `#EF4444`, teks putih, border 3px hitam, shadow `4px 4px 0px #000` |
| Secondary/Ghost | bg putih, teks `#000`, border 3px hitam, shadow `3px 3px 0px #000` |

### 7.2 Kartu & Container
- Standar: bg putih, border 3px hitam, shadow `6px 6px 0px #000`, radius 6px.
- Header section dalam kartu: border-bottom 3px hitam solid, teks uppercase.

### 7.3 Input & Form
- bg putih, border 3px hitam, radius 4px, padding `0.75rem 1rem`.
- Fokus: `box-shadow: 4px 4px 0px #000`, opsional outline tambahan 2px warna primary-container.
- Placeholder: hitam dengan opacity 0.5.

### 7.4 Badge & Chip Kategori
- Sticker persegi kecil, radius 4px, border 2px hitam, shadow `2px 2px 0px #000`.
- Warna kategori: Groceries `#FDE047`, Rent/Home `#38BDF8`, Dates/Fun `#FF6B4A`, Utilities `#A78BFA`.
- Teks: uppercase, `label-badge`.

### 7.5 Checkbox & Radio
- Checkbox persegi 20×20px, border 3px hitam, radius 2px; checked → fill `#D4F34A` + centang hitam tebal.
- Radio: gunakan bentuk berlian atau kotak tajam, hindari lingkaran penuh agar tetap konsisten dengan gaya arsitektural.

### 7.6 List & Ledger Feed
- Baris transaksi: border 2px hitam per-row, fill putih/tint alternatif.
- Kiri: chip tag partner pembayar. Kanan: nominal tabular bold (`+` hijau / `-` merah).

### 7.7 Dual Partner Avatar Indicator
- Avatar persegi berpasangan (36×36px), border 3px hitam, shadow `3px 3px 0px #000`, overlap `margin-right: -8px`.

---

## 8. Implementasi Tailwind (Next.js 16)

`tailwind.config.ts` — extend theme berikut (nilai persis dari token di atas):

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#f9f9f9",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f3f3f3",
        "surface-container": "#eeeeee",
        "surface-container-high": "#e8e8e8",
        "on-surface": "#1b1b1b",
        "on-surface-variant": "#454935",
        primary: "#556500",
        "primary-container": "#d4f34a",
        secondary: "#ae3115",
        "secondary-container": "#fd6a49",
        tertiary: "#674bb5",
        "tertiary-container": "#ebe1ff",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "canvas-cream": "#F6F4EE",
        "accent-cyan": "#38BDF8",
        "accent-yellow": "#FDE047",
        income: "#22C55E",
        expense: "#EF4444",
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
      },
      boxShadow: {
        "hard-1": "4px 4px 0px #000000",
        "hard-2": "6px 6px 0px #000000",
        "hard-press": "0px 0px 0px #000000",
      },
      spacing: {
        gutter: "1.25rem",
        margin: "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
```

Font loading via `next/font/google` di `app/layout.tsx`:

```tsx
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});
```

Contoh utility class komponen tombol primary (React Server/Client Component, Next.js 16 App Router):

```tsx
<button className="
  bg-primary-container text-on-surface
  border-[3px] border-black rounded
  shadow-hard-1 font-bold uppercase
  px-4 py-2.5
  transition-all
  hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0px_#000]
  active:translate-x-1 active:translate-y-1 active:shadow-hard-press
">
  + Catat Transaksi
</button>
```

---

## 9. Prinsip Konsistensi Lintas Halaman

1. **Landing Page** — hero cream (`#F6F4EE`), ilustrasi pop-art dengan sticker badge, semua CTA memakai shadow-hard + border hitam.
2. **Halaman Masuk** — split-screen: panel kiri warna aksen solid (secondary-container) dengan sticker badge fisik, panel kanan form di atas cream `#F7F4EE`, semua field & tombol ikut aturan elevasi Level 1.
3. **Dashboard** — sidebar kiri putih dengan border-right 3px hitam, nav item aktif memakai `bg-primary-container` + border-left 6px hitam; area konten memakai kombinasi Level 1 (stat card, list) dan Level 2 (kartu chart/anggaran yang lebih menonjol).

Warna semantik (`income` hijau, `expense` merah) **konsisten di semua halaman** — dashboard, laporan, maupun notifikasi — agar pasangan bisa langsung mengenali arah aliran uang tanpa membaca label.
