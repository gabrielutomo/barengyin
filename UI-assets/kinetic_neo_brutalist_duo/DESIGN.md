---
name: Kinetic Neo-Brutalist Duo
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
  surface-tint: '#556500'
  primary: '#556500'
  on-primary: '#ffffff'
  primary-container: '#d4f34a'
  on-primary-container: '#5c6d00'
  inverse-primary: '#b6d32a'
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
  on-error-container: '#93000a'
  primary-fixed: '#d1f047'
  primary-fixed-dim: '#b6d32a'
  on-primary-fixed: '#181e00'
  on-primary-fixed-variant: '#3f4c00'
  secondary-fixed: '#ffdad2'
  secondary-fixed-dim: '#ffb4a3'
  on-secondary-fixed: '#3d0600'
  on-secondary-fixed-variant: '#8c1900'
  tertiary-fixed: '#e8ddff'
  tertiary-fixed-dim: '#cebdff'
  on-tertiary-fixed: '#21005e'
  on-tertiary-fixed-variant: '#4f319c'
  background: '#f9f9f9'
  on-background: '#1b1b1b'
  surface-variant: '#e2e2e2'
typography:
  display-hero:
    fontFamily: Space Grotesk
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 60px
    letterSpacing: -0.04em
  display-hero-mobile:
    fontFamily: Space Grotesk
    fontSize: 38px
    fontWeight: '700'
    lineHeight: 42px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.03em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: 0em
  body-md:
    fontFamily: Space Grotesk
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Space Grotesk
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-badge:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
  numeric-stat:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.03em
  numeric-stat-mobile:
    fontFamily: Space Grotesk
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes a high-energy, raw, tactile zine aesthetic tailored for shared partner finances. It departs completely from conservative, sterile fintech dashboards in favor of an unapologetic, candid Neo-Brutalism that treats money conversations with levity, clarity, and zero drama. 

### Core Aesthetics
- **Physical Sticker & Print Tone:** Heavy structural outlines, asymmetric block arrangements, and flat, saturated color fills evoke the feel of cut paper, risograph prints, and sticker sheets.
- **Radical Candor & Transparency:** Stark, high-contrast borders and sharp offsets convey structural honesty. Nothing is hidden beneath blurred surfaces, gradient overlays, or faux-depth glassmorphism.
- **Playful Tactility:** Interactive components act like physical mechanical switches—snapping, dropping, and translating upon click or tap to deliver satisfying physical feedback.
- **Partner Parity:** Visual weight is strictly balanced to represent two individuals managing a single shared balance sheet without friction or hierarchy.

## Colors

The palette pairs high-voltage accents with a calm, tactile newsprint background to balance punchy visual impact with extended reading comfort.

### Color Tokens & Roles
- **Canvas / Primary Surface (`#F6F4EE`):** Warm newsprint cream. Grounding surface that softens contrast against raw black strokes while preserving paper texture feel.
- **Deep Black (`#000000`):** Pure pigment used exclusively for all borders, offset drop shadows, typography, icons, and structural divider rules.
- **Primary Accent (`#D4F34A`):** Electric Chartreuse / Lime. Assigned to primary actions, interactive focus rings, active tabs, and split balances.
- **Secondary Accent (`#FF6B4A`):** Energetic Tangerine. Deployed for user-assigned partner tags, warnings, urgent splits, and highlight badges.
- **Tertiary Accent (`#A78BFA`):** Electric Lilac. Assigned to secondary category groups, recurring subscriptions, and neutral balances.
- **Cyan Accent (`#38BDF8`):** Vivid Sky. Used for analytics insights, transfers, and system utility badges.
- **Semantic Ledger Colors:**
  - Income / Paid: `#22C55E` (Bold Spring Green)
  - Expense / Debt: `#EF4444` (Punchy Coral Red)
  - Tag / Badge Alert: `#FDE047` (Canary Yellow)
  - Card Neutral Surface: `#FFFFFF` (Stark White)

### Surface & Border Rules
- Gradients, color blending, and backdrop blurs are strictly forbidden.
- Tinted surfaces must always use 100% solid fills, bounded by explicit black borders.

## Typography

Typography relies uniformly on **Space Grotesk** across all roles to project an unapologetic, mechanical, and technical edge.

### Type Rules
- **Numerical Weight:** All monetary figures, splits, and date timestamps use `fontWeight: 700` with tabular number spacing enabled (`font-variant-numeric: tabular-nums`).
- **Uppercase Tracker Badges:** Category labels, transaction states, and partner tags must use `label-badge` styling with full uppercase transformation and wide letter-spacing (`0.06em`).
- **Hierarchy Separation:** Clear visual distinction is achieved through stark font size jumps and heavy weight contrast rather than low-contrast grey tones.

## Layout & Spacing

The layout is built on a responsive fixed-max-width grid, keeping financial ledgers dense, readable, and tightly organized.

### Grid & Breakpoints
- **Desktop (1024px+):** Max-width 1200px centered container. 12-column grid with `gutter: 1.25rem` and outer page `margin: 2rem`. Dual-column dashboard: Partner ledger split (8 columns) and balance summary / quick add (4 columns).
- **Tablet (640px - 1023px):** 8-column fluid grid, `gutter: 1rem`, `margin: 1.5rem`. Collapsible dual ledger.
- **Mobile (< 640px):** Single-column layout, `gutter-mobile: 0.75rem`, `margin-mobile: 1rem`. Sticky bottom mechanical action dock with permanent border separation.

### Spacing Rhythm
- Density is deliberate: tighter internal padding (`space-sm` to `space-md`) paired with generous exterior card gaps (`space-lg`) gives items the self-contained presence of printed cards.

## Elevation & Depth

Depth in this design system is exclusively structural, tactile, and directional. Soft drop shadows, Gaussian blurs, and translucent overlays are strictly excluded.

### The Mechanical Hard Drop Principle
Elevation is conveyed through solid, unblurred pitch-black offsets positioned diagonally down-and-right (`45deg` or `x: y`).

- **Surface Level 0 (Flat):** `box-shadow: none; border: 3px solid #000000;` Used for embedded list rows, table headers, and disabled states.
- **Surface Level 1 (Default Cards, Badges, Inputs):** `box-shadow: 4px 4px 0px #000000; border: 3px solid #000000;`
- **Surface Level 2 (Floating Modals, Drawers, Key Stats):** `box-shadow: 6px 6px 0px #000000; border: 4px solid #000000;`
- **Interactive Press Transform:**
  - Resting state: `transform: translate(0, 0); box-shadow: 4px 4px 0px #000000;`
  - Hover state: `transform: translate(-1px, -1px); box-shadow: 5px 5px 0px #000000;`
  - Active / Pressed state: `transform: translate(4px, 4px); box-shadow: 0px 0px 0px #000000;`
- **Modal Scrim / Backdrop:** Solid `#000000` with `opacity: 0.5` (or a cross-hatch/halftone SVG mask pattern). Never use backdrop filters or blur.

## Shapes

Corner radii are kept tight and structured. Roundedness level 1 ensures corners feel intentionally finished without softening the deliberate brutalist edge.

### Corner Execution
- **Default Elements:** 4px radius (`border-radius: 0.25rem`).
- **Cards & Outer Modals:** 8px radius (`border-radius: 0.5rem`).
- **Strict Prohibition:** Full-rounded pill shapes (`border-radius: 9999px`) are banned. Badges, avatar clips, and buttons must stay within rectangular profiles with maximum 6px radii.

## Components

### 1. Buttons
- **Primary Action:** Background `#D4F34A`, text `#000000`, border `3px solid #000000`, hard shadow `4px 4px 0px #000000`, font weight 700. Active press collapses offset to `0px 0px 0px #000000` with `translate(4px, 4px)`.
- **Destructive Action:** Background `#EF4444`, text `#FFFFFF`, border `3px solid #000000`, shadow `4px 4px 0px #000000`.
- **Secondary / Ghost:** Background `#FFFFFF`, text `#000000`, border `3px solid #000000`, shadow `3px 3px 0px #000000`.

### 2. Cards & Containers
- Standard container: `#FFFFFF` background with `3px solid #000000` border, `6px 6px 0px #000000` hard shadow, and `border-radius: 6px`.
- Section headers within cards feature an edge-to-edge solid `#000000` border-bottom rule (`border-bottom: 3px solid #000000`) with uppercase headline text.

### 3. Inputs & Forms
- Background `#FFFFFF`, border `3px solid #000000`, border-radius `4px`, padding `0.75rem 1rem`.
- Focus state: `box-shadow: 4px 4px 0px #000000; outline: none; background: #FFF; border-color: #000000;` with an optional 2px offset border in `#D4F34A`.
- Placeholder text in `#000000` with `opacity: 0.5`.

### 4. Expense Badges & Chips
- Compact rectangular stickers (`border-radius: 4px`), border `2px solid #000000`, hard shadow `2px 2px 0px #000000`.
- Category tags use vivid solid fills: Groceries (`#FDE047`), Rent/Home (`#38BDF8`), Dates/Fun (`#FF6B4A`), Utilities (`#A78BFA`).
- Typography: Uppercase `label-badge`.

### 5. Checkboxes & Radio Controls
- Square checkbox (`20px x 20px`), border `3px solid #000000`, border-radius `2px`.
- Checked state: `#D4F34A` fill with a bold black checkmark glyph.
- Radio buttons: Hard diamond or sharp-edged square indicators; avoid circular radio buttons where possible to maintain the architectural edge.

### 6. Lists & Ledger Feeds
- Expenses render as grouped ledger rows. Each row is encased in `border: 2px solid #000000` with a alternating subtle tint or clean white fill.
- Left-side indicator: Assigned partner tag chip.
- Right-side indicator: Bold tabular amount (`numeric-stat` styling at `20px`), prepended with `+` in `#22C55E` or `-` in `#EF4444`.

### 7. Dual Partner Avatar Indicator
- Paired square avatars (`36px x 36px`), border `3px solid #000000`, hard shadow `3px 3px 0px #000000`, overlapping by `margin-right: -8px` with distinct border separation.