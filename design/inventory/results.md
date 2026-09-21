# Results page — extraction inventory

Sources (read in full, not modified):

- `design/assets/results-desktop.html` — 558 lines, artboard `width:1440px`, `data-screen-label="02 Results — Desktop"`
- `design/assets/results-mobile.html` — 359 lines, artboard `width:390px`, `data-screen-label="02 Results — Mobile"`
- `design/assets/results-mobile-filters.html` — 88 lines, artboard `width:390px;height:844px;overflow:hidden`, `data-screen-label="02 Results — Mobile · Filters"`
- `design/DESIGN.md` — 323 lines, written spec (theme "Cinematic Dark")

**Authority note.** The artboards use theme **Track Night** (`--bg:#0B0B0D`, `--accent:#C9F23A` acid lime). DESIGN.md describes **Cinematic Dark** (`#000000` + `#e10600` racing red). Per the project owner, the artboards win on colour. Everything in §1–§5 is measured from the artboards. §6 lists where DESIGN.md disagrees.

**Token block.** All three files carry a byte-identical `:root` at lines 11–40. Resolved values:

| Token | Value | Line |
|---|---|---|
| `--bg` | `#0B0B0D` | 12 |
| `--surface` | `#16161A` | 13 |
| `--surface-2` | `#1F1F24` | 14 |
| `--border` | `#1F1F24` | 15 |
| `--border-strong` | `#35353B` | 16 |
| `--text` | `#F4F4F5` | 17 |
| `--text-muted` | `#A7A7AE` | 18 |
| `--text-dim` | `#8B909A` | 19 |
| `--accent` | `#C9F23A` | 20 |
| `--accent-hover` | `#DDFF6B` | 21 |
| `--accent-subtle` | `rgba(201,242,58,0.12)` | 22 |
| `--on-accent` | `#0B0B0D` | 23 |
| `--on-photo` | `#F4F4F5` | 24 |
| `--winter` | `#8FC9F2` | 25 |
| `--all-season` | `#D9C29A` | 26 |
| `--font-display` | `'Barlow Condensed',sans-serif` | 27 |
| `--font-body` | `'Barlow',sans-serif` | 28 |
| `--radius-ctl` | `2px` | 29 |
| `--display-tracking` | `-0.015em` | 30 |
| `--display-leading` | `0.92` | 31 |
| `--display-weight` | `700` | 32 |
| `--display-transform` | `uppercase` | 33 |
| `--scale-hero` / `--scale-h2` / `--scale-h3` | `1` | 34–36 |
| `--canvas-bg` | `#050505` | 37 |
| `--scrim-strong` | `rgba(11,11,13,.92)` | 38 |
| `--scrim-mid` | `rgba(11,11,13,.68)` | 39 |
| `--scrim-soft` | `rgba(11,11,13,.38)` | 40 |

Declared but **never referenced** in any of the three results files: `--accent-subtle`, `--winter`, `--all-season`, `--canvas-bg`, `--scrim-soft`.

**Font loading.** All three files load one stylesheet: `https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;700&family=Michroma&family=Manrope:wght@400;500;700;800&display=swap`. **Michroma and Manrope are loaded but never used** on the results page. Barlow Condensed 600 is loaded but never used (only `--display-weight:700` is applied). Used body weights: 400, 500, 700.

**Global base rules** (identical in all three, lines 42–47):
`*{box-sizing:border-box}` · `html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:var(--font-body);-webkit-font-smoothing:antialiased}` · `a{color:var(--text);text-decoration:none}` · `a:hover{color:var(--text-muted)}` · `img{display:block}` · `.screen{width:1440px|390px;margin:0 auto}`

**No `@media` query exists in any of the three files** (verified: 0 matches). No `<script>`. The only transition declared anywhere is on the product card.

---

## 1. Section manifest (artboard order, top to bottom)

Notation: "D" = results-desktop.html @1440, "M" = results-mobile.html @390, "F" = results-mobile-filters.html @390.

### 1. `site-header`
Sticky-looking top bar: logo, primary nav, phone CTA.

- **D** (L86): `height:88px`, `padding:0 48px`, flex row, `justify-content:space-between`, `background:var(--scrim-strong)`, `border-bottom:1px solid var(--border)`, full 1440 width, no max-width. Logo `height:64px`. Nav `display:flex;gap:40px`.
- **M** (L76): `height:68px`, `padding:0 16px`, same flex structure. Logo `height:52px`. Text nav replaced by a 44×44 round accent call button + a 44×44 transparent hamburger button, `gap:8px`.
- **Change:** height 88 → 68; side padding 48 → 16; logo 64 → 52; 4-item inline text nav + 190px-ish pill CTA → 2 icon buttons. Crossover width **not in the files**.

### 2. `results-toolbar`
Breadcrumb, active-vehicle chip, result count, sort control.

- **D** (L110): `padding:32px 48px 0`, flex row, `justify-content:space-between`, `gap:24px`. Left cluster `display:flex;align-items:center;gap:20px` holding breadcrumb + vehicle chip (40px) + "Change vehicle" link + count. Right cluster `gap:12px`: "Sort" label + a `min-width:200px` `height:44px` select box.
- **M** (L93): `padding:20px 16px 0`, flex **column**, `gap:12px`. Row 1 breadcrumb; row 2 flex row `justify-content:space-between` with vehicle chip (44px) and "Change vehicle"; row 3 count. Sort moves out of this block entirely into section 3.
- **Change:** one row → three stacked rows; inline sort select → sticky bar; vehicle chip 40 → 44px; count 15px → 14px.

### 3. `filter-sort-sticky-bar` — **mobile only**
- **M** (L98): `position:sticky;top:68px;margin-top:16px;padding:12px 16px;background:var(--scrim-strong);border-top:1px solid var(--border);border-bottom:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr;gap:8px;z-index:3`. Two 44px controls: "Filters (3)" (1px `--text` border) and "Sort: Best match" (1px `--border-strong`). Track width 390−32−8 = **350 / 2 = 175px each**.
- **D:** no equivalent. Its two jobs are split between the sort select in section 2 and the always-open rail in section 4.

### 4. `filter-rail` (D) / `filter-sheet` (F)
- **D** (L119, the `<aside>` at L121): lives as the first column of the results grid — `padding:40px 48px 0;display:grid;grid-template-columns:280px 1fr;gap:48px;align-items:start`. Aside is `position:sticky;top:96px;display:flex;flex-direction:column;gap:32px`, **fixed 280px wide**. Five groups, each `border-top:1px solid var(--border-strong);padding-top:20px`.
- **M:** absent from the scrolling page; opened as the overlay sheet in `results-mobile-filters.html` (see §4).
- **Change:** persistent 280px left rail → full-bleed bottom sheet 700px tall over a `--scrim-mid` scrim.

### 5. `results-column`
- **D** (L151): second grid column, `display:flex;flex-direction:column;gap:80px`. Computed width **1016px** (1440 − 48 − 48 side padding − 280 rail − 48 gap).
- **M:** not a column — sections 6/7/8 are siblings of the page root at full width.

### 6. `best-matches`
- **D** (L153–154): header wrapper `display:flex;flex-direction:column;gap:12px`, `<h2>` 40px; then `display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px`. **6 cards**, 2 rows.
  **Grid maths at 1440:** track = 1016px; 3 columns, 2 × 16px gaps = 32; **card width = (1016 − 32) / 3 = 328px** exactly. Card is `box-sizing:border-box` with a 1px border → 326px inner; square image area = **326 × 326**.
- **M** (L102–104): section `padding:40px 16px 0;display:flex;flex-direction:column;gap:20px`; header wrapper `gap:10px`, `<h2>` 32px; grid `grid-template-columns:minmax(0,1fr);gap:12px`. **3 cards**, 1 column.
  **Grid maths at 390:** track = 390 − 16 − 16 = **358px**; card width 358, inner 356, image area **356 × 356**.
- **Change:** 3-up → 1-up; gutter 16 → 12; h2 40 → 32; card 328 → 358px (cards get *wider* on mobile); 6 cards → 3 cards. **No 2-up artboard exists**, so the intermediate step is unmeasured.

### 7. `similar-matches`
- **D** (L383–384): header wrapper `display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--border-strong);padding-top:32px`, `<h2>` 40px; same 3-up grid `gap:16px`. **3 cards**, 1 row.
- **M** (L220–222): section `padding:56px 16px 0;gap:20px`; header wrapper `gap:8px;border-top:1px solid var(--border-strong);padding-top:24px`, `<h2>` 32px; 1-up grid `gap:12px`. **2 cards**.
- **Change:** divider padding-top 32 → 24; group separation 80px (parent flex gap) → 56px (section padding-top).

### 8. `load-more`
- **D** (L498): own flex child, `display:flex;justify-content:center;padding-bottom:120px`. Button `height:56px;padding:0 40px`, centred, hugs content.
- **M** (L299): lives *inside* the similar-matches section, `margin-top:12px`, `height:52px`, stretches full 358px width.
- **Change:** centred auto-width 56px → full-width 52px; 120px bottom air on desktop only.

### 9. `call-cta-panel` — **mobile only**
- **M** (L301): `margin:56px 16px 0;background:var(--surface);border:1px solid var(--border-strong);padding:24px;display:flex;flex-direction:column;gap:14px`. Width 358px. No desktop counterpart.

### 10. `site-footer`
- **D** (L502): `background:var(--bg);border-top:1px solid var(--border-strong);padding:80px 48px 40px`. Outer `display:grid;grid-template-columns:1.2fr 1fr;gap:24px`. Inner link grid `1fr 1fr 1fr;gap:24px`.
  **Maths:** content 1344; 1344 − 24 gap = 1320 split 1.2 : 1 → **720px** brand block / **600px** link block; each link column (600 − 48)/3 = **184px**.
- **M** (L303): `padding:56px 16px 120px`, preceded by a wrapper with `margin-top:56px`. Outer `grid-template-columns:1fr;gap:40px`. Inner link grid `1fr 1fr;gap:40px` → three groups in two columns, so "Legal" wraps to row 2. Each column (358 − 40)/2 = **159px**.
- **Change:** 2-col shell → 1-col; 3-col links → 2-col (with wrap); gaps 24 → 40; padding `80/48/40` → `56/16/120`.

### Breakpoint derivation — what the files do and do not tell us
The exports are fixed-width static snapshots with **zero media queries**. They give two measured endpoints (1440 and 390) and nothing in between.

- **AMBIGUOUS:** the actual pixel widths at which any of the above switch are **not present in any artboard**. They cannot be measured, only chosen. The only stated source is DESIGN.md §8 — breakpoints **1320 / 1100 / 720 / 400** with product grid "4-up (3 <1100) / 3-up / 2-up / 1-up <400" — and the artboards **contradict** its 4-up-at-1320 claim (see §6).
- Hard constraints the artboards do impose: the desktop rail is a **fixed 280px** (not fractional) and the main gap is **48px**, so below roughly 1440 the 3-up cards shrink from 328px with the rail unchanged; the desktop layout has **no `max-width`** — it is 1440px of full-bleed with 48px side padding.
- The mobile card at 358px is *wider* than the desktop card at 328px, so any 2-up mobile/tablet step would produce cards narrower than both measured states. Unverified.

---

## 2. Per-section detail

### 2.1 `site-header`

**D** (L86–106) · **M** (L76–91) · **F** (L56–71, identical to M)

| # | Element | Box | Type | Copy / asset |
|---|---|---|---|---|
| 1 | `<div>` bar | D `height:88px;padding:0 48px` · M/F `height:68px;padding:0 16px`; `display:flex;align-items:center;justify-content:space-between;background:var(--scrim-strong);border-bottom:1px solid var(--border);width:100%` | `font-family:var(--font-body);color:var(--on-photo, #F4F4F5)` | — |
| 2 | `<a>` logo link | `display:flex;align-items:center;gap:10px` | — | `href="#"` |
| 3 | `<img>` logo | D `height:64px;width:auto` · M/F `height:52px;width:auto`; `display:block`; no `object-fit` declared (intrinsic) | — | `src="assets/logo/platinum-wheels-logo-transparent.png"`, `alt="Platinum Wheels"` |
| 4 | `<nav>` — **D only** | `display:flex;gap:40px` | — | — |
| 5 | Nav link 1 (active) | `padding:8px 0;border-bottom:2px solid var(--accent)` | `font:500 13px/1 var(--font-body);letter-spacing:.1em;text-transform:uppercase;color:var(--on-photo, #F4F4F5)` | `Tires` |
| 6–8 | Nav links 2–4 | `padding:8px 0;border-bottom:2px solid transparent` | same, but `color:rgba(244,244,245,.68)` | `Wheels` · `Accessories` · `Contact` |
| 9 | Phone CTA — **D only**, `class="x58"` | `display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 20px;border:1px solid var(--accent);border-radius:var(--radius-ctl);white-space:nowrap` | `font:500 13px/1 var(--font-body);letter-spacing:.08em;text-transform:uppercase;color:var(--on-photo, #F4F4F5)` | `Call 647-989-6178`, `href="tel:+16479896178"` |
| 9a | Phone icon | `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">` | — | handset path |
| 10 | Icon cluster — **M/F only** | `display:flex;align-items:center;gap:8px` | — | — |
| 11 | Call FAB — **M/F only** | `width:44px;height:44px;border-radius:50%;background:var(--accent);color:var(--on-accent);display:inline-flex;align-items:center;justify-content:center` | — | `aria-label="Call now"`, `href="tel:+16479896178"`; svg 18×18, `stroke-width:1.8` |
| 12 | Menu button — **M/F only** | `width:44px;height:44px;background:transparent;border:0;cursor:pointer;color:var(--on-photo, #F4F4F5)` | — | `aria-label="Menu"`; svg 22×22, `stroke-width:1.6`, `M3 7h18M3 12h18M3 17h18` |

**Hover state:** `.x58:hover{background:var(--accent) !important;color:var(--on-accent) !important}` — the desktop phone pill fills lime with `--bg` text. Nothing else in the header has a hover rule (the global `a:hover{color:var(--text-muted)}` still applies to the logo link).

> **Note:** `--on-photo` is `#F4F4F5` in `:root`, so the `var(--on-photo, #F4F4F5)` fallback is redundant. `border-bottom:2px solid var(--accent)` on the active nav item is one of only two 2px borders on the page.

### 2.2 `results-toolbar`

**D** (L110–118)

| # | Element | Box | Type | Copy |
|---|---|---|---|---|
| 1 | Row wrapper | `padding:32px 48px 0;display:flex;align-items:center;justify-content:space-between;gap:24px` | — | — |
| 2 | Left cluster | `display:flex;align-items:center;gap:20px` | — | — |
| 3 | Breadcrumb | — | `font:500 12px/1 var(--font-body);letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim)` | `Home` |
| 3a | Separator | `margin:0 6px` | inherits | `/` |
| 3b | Current | `color:var(--text)` | inherits | `Results` |
| 4 | Vehicle chip | `display:inline-flex;align-items:center;gap:10px;height:40px;padding:0 14px;background:var(--surface);border:1px solid var(--border-strong)` — no radius declared (0) | `font:700 14px/1 var(--font-body)`, colour inherits `--text` | `2021 Honda Civic` |
| 4a | Car icon | `<svg width="18" height="18" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">` | — | car body path + two `r="1.5"` wheels |
| 5 | Change link | — | `font:500 13px/1 var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);text-decoration:underline;text-underline-offset:4px` | `Change vehicle` |
| 6 | Count | — | `font:400 15px/1 var(--font-body);color:var(--text-muted);font-variant-numeric:tabular-nums` | `12 matches · 6 similar` |
| 7 | Sort cluster | `display:flex;align-items:center;gap:12px` | — | — |
| 8 | Sort label | — | `font:500 11px/1 var(--font-body);letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim)` | `Sort` |
| 9 | Sort box | `height:44px;min-width:200px;background:var(--surface-2);border:1px solid var(--border-strong);border-radius:var(--radius-ctl);display:flex;align-items:center;justify-content:space-between;padding:0 14px;gap:16px` | value `font:700 14px/1 var(--font-body)` | `Best match` |
| 9a | Chevron | `<svg width="16" height="16" stroke="var(--text-muted)" stroke-width="1.6"><path d="M6 9l6 6 6-6">` | — | — |

**M** (L93–97): wrapper `padding:20px 16px 0;display:flex;flex-direction:column;gap:12px`. Breadcrumb 11px (D: 12px), same tracking/colour. Row 2 `display:flex;align-items:center;justify-content:space-between;gap:12px`: vehicle chip identical but `height:44px`; "Change vehicle" is `font:500 12px/1;letter-spacing:.06em` with `padding:12px 0` added for touch. Count `font:400 14px/1` (D: 15px). No sort control.

**No hover rules** on any toolbar element.

### 2.3 `filter-sort-sticky-bar` (mobile only)

**M** (L98–101)

| # | Element | Box | Type | Copy |
|---|---|---|---|---|
| 1 | Bar | `position:sticky;top:68px;margin-top:16px;padding:12px 16px;background:var(--scrim-strong);border-top:1px solid var(--border);border-bottom:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr;gap:8px;z-index:3` | — | — |
| 2 | Filters control | `display:inline-flex;align-items:center;justify-content:center;gap:10px;height:44px;border:1px solid var(--text)` — no radius, no background | `font:500 12px/1 var(--font-body);letter-spacing:.06em;text-transform:uppercase;text-align:center`, colour inherits `--text` | `Filters (3)` |
| 2a | Sliders icon | `<svg width="16" height="16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4">` | — | — |
| 3 | Sort control | same box but `border:1px solid var(--border-strong)` | same type | `Sort: Best match` |
| 3a | Chevron | `<svg width="14" height="14" stroke="var(--text-muted)" stroke-width="1.6">` | — | — |

Both are `<span>`, not buttons/links. No hover rules.

### 2.4 `filter-rail` (desktop)

**D** (L121–150), `<aside style="display:flex;flex-direction:column;gap:32px;position:sticky;top:96px">`, width fixed at 280px by the parent grid.

**Header row** (L122): `display:flex;justify-content:space-between;align-items:baseline`.
- Title: `font:var(--display-weight) calc(28px * var(--scale-h3))/1 var(--font-display);text-transform:uppercase` → **Barlow Condensed 700, 28px, line-height 1, no letter-spacing declared** (note: *not* `--display-tracking`, *not* `0.92`). Copy `Filters`.
- Link: `font:500 12px/1 var(--font-body);letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);text-decoration:underline;text-underline-offset:4px`. Copy `Clear all`.

**Group shell** (×5, L123 / L128 / L134 / L136 / L144): `display:flex;flex-direction:column;gap:14px` (Price group uses `gap:20px`) `;border-top:1px solid var(--border-strong);padding-top:20px`. Each opens with `display:flex;justify-content:space-between` holding a label `font:500 12px/1 var(--font-body);letter-spacing:.12em;text-transform:uppercase` (colour inherits `--text`) and a collapse chevron `<svg width="16" height="16" stroke="var(--text-muted)" stroke-width="1.6"><path d="M18 15l-6-6-6 6">` (pointing **up** = expanded).

1. **`Category`** (L123–127) — list `display:flex;flex-direction:column;gap:4px`. Each row: `display:flex;justify-content:space-between;align-items:center;height:40px;padding:0 12px;font:500 15px/1 var(--font-body)`. Selected row `background:var(--text);color:var(--on-accent)`; unselected `background:transparent;color:var(--text-muted)`. Count span `font:400 13px/1 var(--font-body);color:var(--text-dim);font-variant-numeric:tabular-nums`.
   Rows: `Tires` **18** (selected) · `Wheels` **42** · `Accessories` **9**.
2. **`Tire size`** (L128–133) — `display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px` → each field **(280 − 16)/3 = 88px**. Field = column `gap:6px` with a caption `font:500 10px/1 var(--font-body);letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim)` over a box `height:44px;background:var(--surface-2);border:1px solid var(--border-strong);display:flex;align-items:center;justify-content:space-between;padding:0 10px` (no radius) containing `font:700 15px/1 var(--font-body);font-variant-numeric:tabular-nums` and a 14×14 chevron.
   Captions/values: `Width` **215** · `Profile` **55** · `Rim` **R16**.
   Then an `<a>` `display:inline-flex;align-items:center;justify-content:center;height:44px;border:1px solid var(--text);color:var(--text);border-radius:var(--radius-ctl);font:500 13px/1 var(--font-body);letter-spacing:.08em;text-transform:uppercase`. Copy `Apply`. Stretches to 280px. **No hover rule.**
3. **`Season`** (L134–135) — `display:flex;gap:8px;flex-wrap:wrap`. Chip: `height:40px;padding:0 16px;display:inline-flex;align-items:center;font:500 14px/1 var(--font-body)`, no radius. Unselected `background:transparent;color:var(--text-muted);border:1px solid var(--border-strong)`. Selected `background:var(--text);color:var(--on-accent);border:1px solid var(--text)`.
   Chips: `All-season` · `Winter` (**selected**) · `Summer`.
4. **`Brand`** (L136–143) — `display:flex;flex-direction:column;gap:2px`. Each `<label style="display:flex;align-items:center;gap:12px;height:40px;cursor:pointer">`. Checkbox `width:18px;height:18px;border-radius:var(--radius-ctl)`; checked → `border:1px solid var(--text);background:var(--text)` + `<svg width="12" height="12" stroke="var(--on-accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7">`; unchecked → `border:1px solid var(--text-dim);background:transparent`, empty. Name `font:400 15px/1 var(--font-body);color:var(--text);flex:1`. Count `font:400 13px/1 var(--font-body);color:var(--text-dim);font-variant-numeric:tabular-nums`.
   `Zeta` **4** ✓ · `ZMAX` **5** ✓ · `Mazzini` **3** · `Michelin` **2** · `Bridgestone` **2** · `Continental` **1** · `Pirelli` **1** · `Hankook` **1**.
5. **`Price per tire`** (L144–147) — group `gap:20px`. Track `position:relative;height:20px;margin:0 8px` containing four absolutely positioned spans:
   - rail `left:0;right:0;top:9px;height:2px;background:var(--border-strong)`
   - fill `left:14%;right:42%;top:9px;height:2px;background:var(--text)`
   - handle A `left:14%;top:2px;width:16px;height:16px;margin-left:-8px;background:var(--text);border-radius:var(--radius-ctl)`
   - handle B `right:42%;top:2px;width:16px;height:16px;margin-right:-8px;background:var(--text);border-radius:var(--radius-ctl)`
   Value row `display:flex;justify-content:space-between`, both `font:700 15px/1 var(--font-body);font-variant-numeric:tabular-nums`: `$140` / `$275`.
   Bounds row `display:flex;justify-content:space-between`, both `font:400 12px/1 var(--font-body);color:var(--text-dim)`: `$100` / `$400`.

**No hover rules exist on any rail control.**

### 2.5 `best-matches` / `similar-matches` headings

- **D** `<h2 style="margin:0;font:var(--display-weight) calc(40px * var(--scale-h2))/var(--display-leading) var(--font-display);letter-spacing:var(--display-tracking);text-transform:var(--display-transform)">` → Barlow Condensed **700 / 40px / 0.92 / −0.015em / uppercase**, colour inherits `--text`. Copy `Best matches` (L153), `Similar matches` (L383).
- **M** identical but `calc(32px * var(--scale-h2))` → **32px**. Copy identical (L103, L221).

Card grids and cards: see §3.

### 2.6 `load-more`

- **D** (L498) `class="x77"`: `display:inline-flex;align-items:center;justify-content:center;height:56px;padding:0 40px;border:1px solid var(--accent);color:var(--text);border-radius:var(--radius-ctl);font:500 14px/1 var(--font-body);letter-spacing:.08em;text-transform:uppercase`. Parent centres it and adds `padding-bottom:120px`.
  Hover: `.x77:hover{background:var(--accent) !important;color:var(--on-accent) !important}` — lime fill, `--bg` text.
- **M** (L299): same declarations except `height:52px`, `margin-top:12px`, no padding (stretches full width). **No hover class on mobile.**

### 2.7 `call-cta-panel` (mobile only)

**M** (L301): `margin:56px 16px 0;background:var(--surface);border:1px solid var(--border-strong);padding:24px;display:flex;flex-direction:column;gap:14px`.

| # | Element | Type | Copy |
|---|---|---|---|
| 1 | Heading | `font:var(--display-weight) calc(36px * var(--scale-h2))/1 var(--font-display);text-transform:uppercase` — **36px, line-height 1, no letter-spacing declared** | `Not sure which one?` |
| 2 | Body | `font:400 14px/1.5 var(--font-body);color:var(--text-muted)` | `Call the shop. We'll check your size and quote in minutes.` (straight apostrophe `'`) |
| 3 | CTA `<a href="tel:+16479896178">` | `display:inline-flex;align-items:center;justify-content:center;gap:10px;height:52px;border:1px solid var(--accent);color:var(--text);border-radius:var(--radius-ctl);font:700 16px/1 var(--font-body);font-variant-numeric:tabular-nums` — no icon despite `gap:10px` | `Call 647-989-6178` |

No hover rules. 36px is the only use of that display size anywhere in the three files.

### 2.8 `site-footer`

**D** (L502–556) · **M** (L303–357) — structurally identical, box values differ.

| # | Element | D box | M box | Type | Copy |
|---|---|---|---|---|---|
| 1 | `<footer>` | `background:var(--bg);border-top:1px solid var(--border-strong);padding:80px 48px 40px;width:100%` | `…padding:56px 16px 120px` | `font-family:var(--font-body);color:var(--text)` | — |
| 2 | Outer grid | `grid-template-columns:1.2fr 1fr;gap:24px` | `grid-template-columns:1fr;gap:40px` | — | — |
| 3 | Brand block | `display:flex;flex-direction:column;gap:16px;align-items:flex-start` | same | — | — |
| 4 | Logo `<img>` | `height:120px;width:auto;display:block` | **same 120px** | — | `src="assets/logo/platinum-wheels-logo-transparent.png"` `alt="Platinum Wheels"` |
| 5 | Social row | `display:flex;gap:8px;margin-top:8px` | same | — | — |
| 6–8 | Social links `x78/x79/x80` (D), `x100/x101/x102` (M) | `width:40px;height:40px;border:1px solid var(--border-strong);display:inline-flex;align-items:center;justify-content:center;color:var(--text-muted)` — no radius | same | — | `aria-label="Instagram"` (18×18 rect rx=4 + circle r=4 + dot), `aria-label="Facebook"`, `aria-label="Google Business"` (pin + circle) — all `stroke-width:1.5` |
| 9 | Link grid | `grid-template-columns:1fr 1fr 1fr;gap:24px` | `grid-template-columns:1fr 1fr;gap:40px` | — | — |
| 10 | Column | `display:flex;flex-direction:column;gap:12px` | same | — | — |
| 11 | Column heading | — | — | `font:500 11px/1 var(--font-body);letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim)` | `Shop` · `Company` · `Legal` |
| 12 | Link | `padding:4px 0` | same | `font:400 15px/1.3 var(--font-body);color:var(--text-muted)` | see below |
| 13 | Bottom bar | `margin-top:48px;padding-top:24px;border-top:1px solid var(--border);display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px` | same | `font:400 13px/1.4 var(--font-body);color:var(--text-dim)` | `© 2026 Platinum Wheels and Tire Solutions Inc.` / `Brampton, Ontario · Prices in CAD, before tax` |

Footer link copy, verbatim and in order:
**Shop** — `Tires`, `Wheels`, `Accessories`, `Winter 2026`
**Company** — `About the shop`, `How it works`, `Contact`
**Legal** — `Privacy Policy`, `Terms & Conditions` (source: `Terms &amp; Conditions`)

Hover rules: `.x78/.x79/.x80` and `.x100/.x101/.x102` → `{color:var(--text) !important;border-color:var(--text) !important}`. `.x81`–`.x89` and `.x103`–`.x111` → `{color:var(--text) !important}`. Note these `!important` colour rules override the global `a:hover{color:var(--text-muted)}`, which would otherwise darken them.

---

## 3. The product card — full spec

Nine instances on desktop, five on mobile. The markup is byte-identical between instances apart from image/alt, badge, brand, name, size, price and CTA variant.

### 3.1 Card box

```
background:var(--surface)            #16161A
border:1px solid var(--border)       #1F1F24        (hover/frozen-hover variant: var(--accent-hover) #DDFF6B)
border-radius                        not declared → 0
transform:none                       (frozen-hover variant: translateY(-2px))
transition:border-color 150ms cubic-bezier(.2,0,0,1),transform 150ms cubic-bezier(.2,0,0,1)
display:flex;flex-direction:column;position:relative;height:100%
font-family:var(--font-body);color:var(--text)
```
No box-shadow anywhere. No padding on the card itself.

- **D** rendered width **328px** (grid track), inner 326px.
- **M** rendered width **358px**, inner 356px.

### 3.2 Image area

```
position:relative;aspect-ratio:1/1;background:var(--bg);overflow:hidden
```
- **D** 326 × 326px · **M** 356 × 356px.

**`<img>`**: `width:100%;height:100%;object-fit:contain;padding:6%;box-sizing:border-box;display:block;opacity:1` (unavailable variant: `opacity:0.35`).
6% resolves against the inline size, so the rendered picture box is **D 286.88 × 286.88px** (326 − 2 × 19.56) and **M 313.28 × 313.28px** (356 − 2 × 21.36).

**Vignette overlay** (sibling, always present): `position:absolute;inset:0;background:radial-gradient(ellipse at center, transparent 50%, var(--scrim-mid) 100%)` → transparent centre fading to `rgba(11,11,13,.68)` at the corners. It sits **above** the image, so the badge row and brand tag render over it.

### 3.3 Badge row

Container: `position:absolute;top:16px;left:16px;right:16px;display:flex;gap:6px;flex-wrap:wrap` on **D**; `top:10px;left:10px;right:10px` on **M**. All else identical. The markup has three optional slots in fixed order — **Winter**, **All-Season**, **Currently unavailable** — and at most one is ever filled across all 14 card instances.

| Variant | Exact declarations | Resolved | Copy (source case) |
|---|---|---|---|
| Winter | `height:24px;padding:0 10px;background:var(--accent);color:var(--on-accent);font:500 11px/24px var(--font-body);letter-spacing:.1em;text-transform:uppercase` — **no border** | fill `#C9F23A`, text `#0B0B0D` | `Winter` |
| All-Season | `height:24px;padding:0 10px;border:1px solid var(--text-muted);color:var(--text-muted);font:500 11px/22px var(--font-body);letter-spacing:.1em;text-transform:uppercase` — no background | transparent, border+text `#A7A7AE` | `All-Season` |
| Currently unavailable | `height:24px;padding:0 10px;border:1px solid var(--text-dim);color:var(--text-dim);background:var(--surface-2);font:500 11px/22px var(--font-body);letter-spacing:.1em;text-transform:uppercase` | fill `#1F1F24`, border+text `#8B909A` | `Currently unavailable` |

Note the line-height trick: the filled badge uses `/24px` (no border), the outlined ones `/22px` (22 + 2 × 1px border = 24). All three render at exactly 24px tall. No radius declared → 0.

### 3.4 Brand tag (image corner)

`position:absolute;top:16px;right:16px` (**M** `top:10px;right:10px`); `font:700 11px/24px var(--font-display);letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)`. **This is Barlow Condensed**, unlike every other 11px label on the page. Copy = brand name.

### 3.5 Card body

`padding:24px` (**D**) / `padding:14px` (**M**); `display:flex;flex-direction:column;gap:8px;flex:1`.

| # | Element | D type | M type | Colour |
|---|---|---|---|---|
| 1 | Name block wrapper | `display:flex;flex-direction:column` | same | — |
| 2 | Brand label | `font:700 15px/1.1 var(--font-body)` | `font:700 12px/1.1 var(--font-body)` | `var(--text)` |
| 3 | Product name | `font:700 calc(28px * 1)/0.92 var(--font-display);letter-spacing:-0.015em;text-transform:uppercase;overflow-wrap:break-word` | same at **24px** | `var(--text)` |
| 4 | Size row | `display:flex;align-items:center;gap:8px;flex-wrap:wrap` | same | — |
| 5 | Size numeral | `font:700 15px/1.2 var(--font-body);font-variant-numeric:tabular-nums` | `font:700 14px/1.2 …` | `var(--text-muted)` |
| 6 | 3PMSF marker (optional) | `display:inline-flex;align-items:center;gap:4px`; svg 16×16 `stroke-width:1.5` (+ inner path `stroke-width:1.2`), `title="Three-peak mountain snowflake"`; label `font:500 11px/1 var(--font-body);letter-spacing:.08em` | identical on M | `var(--text-muted)` |
| 7 | Price block | `display:flex;align-items:baseline;gap:6px;margin-top:4px;flex-wrap:wrap;color:var(--text)` | same | wrapper colour is `var(--text-dim)` on the unavailable card |
| 8 | "from" | `font:500 13px/1 var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)` | `font:500 12px/1 …` | `var(--text-muted)` (explicit, so unaffected by the dim wrapper) |
| 9 | Price numeral | `font:700 28px/1 var(--font-body);font-variant-numeric:tabular-nums` — **no colour declared, inherits the wrapper** | `font:700 24px/1 …` | `var(--text)` normally, **`var(--text-dim)` on the unavailable card** |
| 10 | Unit | `font:400 13px/1 var(--font-body);color:var(--text-dim)` | `font:400 12px/1 …` | `var(--text-dim)` |
| 11 | CTA row | `display:flex;flex-direction:row;gap:8px;margin-top:auto;padding-top:8px` | same | — |

**Price format string, verbatim:** three separate spans rendering as `from` · `$<amount> CAD` · `/ tire`. The numeral span content is literally e.g. `$119 CAD` — currency symbol, integer amount, space, `CAD`, no cents, no decimal. The unit span is literally `/ tire` (space between slash and word). Rendered: `FROM $119 CAD / tire` ("from" is uppercased by `text-transform`, the rest is not transformed).

### 3.6 CTA button

Two variants, mutually exclusive; both `flex:1;display:inline-flex;align-items:center;justify-content:center;padding:0 20px;border-radius:var(--radius-ctl);text-transform:uppercase;text-decoration:none;min-width:0;text-align:center` and `letter-spacing:.04em`.

| Variant | D | M | Fill / border | Copy | Hover |
|---|---|---|---|---|---|
| Primary | `height:48px;font:500 13px/1 var(--font-body)` | `height:44px;font:500 12px/1 …` | `background:var(--accent);color:var(--on-accent)`; no border | `Request a quote` | `background:var(--accent-hover) !important` (→ `#DDFF6B`) |
| Ghost (unavailable) | `height:48px;font:500 13px/1` | `height:44px;font:500 12px/1` | `border:1px solid var(--text);color:var(--text);background:transparent` | `Inquire about restock` | `background:var(--text) !important;color:var(--on-accent) !important` |

### 3.7 Card hover

Every card carries an odd-numbered hover class: `.xN:hover{border-color:var(--accent-hover) !important;transform:translateY(-2px) !important}`. Combined with the inline `transition`, this is a 150ms `cubic-bezier(.2,0,0,1)` border + lift. **The border goes to `--accent-hover` (`#DDFF6B`), i.e. the *brightest* lime — not a deep/desaturated tone.** No shadow, no image zoom, no opacity change.

Class map (desktop): card `x59` / CTA `x60` · `x61`/`x62` · `x63`/`x64` · `x65`/`x66` · `x67`/`x68` · `x69`/`x70` · `x71`/`x72` · `x73`/`x74` · `x75`/`x76`.
Class map (mobile): `x90`/`x91` · `x92`/`x93` · `x94`/`x95` · `x96`/`x97` · `x98`/`x99`.

### 3.8 Frozen hover instance

In **both** artboards, card #2 of Best matches (**ZMAX Winterhawk, 215/55R16**) is exported *in* its hover state: `border:1px solid var(--accent-hover)` and `transform:translateY(-2px)` are baked into the inline style (D L194, M L143). This is a deliberate state demo, not a second card style.

### 3.9 "Unavailable" variant — complete delta

Desktop card #8 (L427–459), mobile card #5 (L261–…). Relative to the default card:
1. `<img … opacity:0.35>` instead of `opacity:1` — image dimmed, **the vignette overlay is unchanged and still at full strength**.
2. Badge slot 3 used: `Currently unavailable` (dim outline on `--surface-2`) instead of a season badge.
3. Price wrapper colour `var(--text-dim)` instead of `var(--text)` → the numeral goes dim; "from" stays `--text-muted`.
4. CTA switches to the ghost variant with copy `Inquire about restock`.
5. The card box itself, brand label, product name and size numeral are **unchanged** (still full `--text`).
6. No 3PMSF marker.
7. The card still carries its normal hover class (`x73` / `x98`) — it lifts and borders lime on hover exactly like an available card.

### 3.10 Variation between card instances

Everything below is the complete list of per-instance differences observed:
- image `src` + `alt` (4 distinct images across 9 desktop cards)
- badge slot (Winter / All-Season / Currently unavailable — never two at once, never zero)
- brand tag + brand label text
- product name text
- size numeral text
- presence/absence of the 3PMSF marker — present on every Winter card, absent on every All-Season card **and** on the unavailable card
- price numeral text
- CTA variant + copy
- frozen hover state on one card per artboard
- desktop-only: nothing else. Best-matches and Similar-matches cards are byte-identical in styling; only the section heading and grid position differ.

---

## 4. Filter sheet (`results-mobile-filters.html`)

Artboard root: `width:390px;height:844px;background:var(--bg);position:relative;overflow:hidden` (L53). The page is clipped to one iPhone-sized viewport — only the header and a truncated breadcrumb block exist behind the sheet; there are no cards.

### 4.1 Background layers (paint order)

1. **Header** (L56–71) — identical to `results-mobile.html`, **not dimmed, not covered** (it sits above the scrim in document order? no — see below).
2. **Dimmed page content** (L72): `padding:20px 16px 0;display:flex;flex-direction:column;gap:12px;opacity:.35`. Contains only a breadcrumb `font:500 11px/1 var(--font-body);letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim)` reading `Home / Results` (as one flat string, unlike the three-span version in the other files), and a vehicle chip `display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 14px;background:var(--surface);border:1px solid var(--border-strong);font:700 14px/1 var(--font-body);align-self:flex-start` reading `2021 Honda Civic` — **with no car icon and no "Change vehicle" link**, unlike the mobile results page.
3. **Scrim** (L73): `position:absolute;inset:0;background:var(--scrim-mid)` → `rgba(11,11,13,.68)`. **Flat, no blur, no backdrop-filter.** `inset:0` on the artboard root means it covers the header too.
4. **Panel** (L74): see below.

> **AMBIGUOUS:** the breadcrumb block carries its own `opacity:.35` *and* the full-bleed scrim covers it, so the content behind the sheet is dimmed twice. Whether that double-dim is intentional or an export artifact cannot be determined from the file. Likewise, the header is covered by the scrim, which contradicts the usual pattern of leaving the nav clear; the file simply does it.

### 4.2 Panel

```
position:absolute;left:0;right:0;bottom:0;height:700px
background:var(--surface)                    #16161A
border-top:1px solid var(--border-strong)    #35353B
display:flex;flex-direction:column
```
Bottom-anchored, **full 390px width, no side insets, no corner radius, no drag handle**. 700px of 844px = the panel's top edge sits at **y = 144px**, leaving 144px of scrimmed page above it (the 68px header plus 76px of content). Entry animation: **none declared** — the export is a static open state.

Three stacked regions: header (fixed) → scroll body (`flex:1`) → footer (fixed).

### 4.3 Sheet header (L75)

`display:flex;justify-content:space-between;align-items:center;padding:20px 16px;border-bottom:1px solid var(--border-strong)`.
- Title: `font:var(--display-weight) calc(28px * var(--scale-h3))/1 var(--font-display);text-transform:uppercase` — Barlow Condensed 700 / 28px / lh 1 / no tracking. Copy `Filters`. Identical to the desktop rail title.
- Right cluster `display:flex;gap:16px;align-items:center`:
  - `Clear all` — `font:500 12px/1 var(--font-body);letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);text-decoration:underline;text-underline-offset:4px`. Identical to desktop.
  - Close box — `width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--border-strong)`, no radius, containing `<svg width="18" height="18" stroke="var(--text)" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18">`. It is a `<span>`, not a button.

### 4.4 Scroll body (L76)

`padding:8px 16px;display:flex;flex-direction:column;flex:1;overflow:hidden`. Inner content width **358px**.
Each group: `display:flex;flex-direction:column;gap:12px;padding:16px 0;border-bottom:1px solid var(--border-strong)` — **horizontal hairlines between groups**, versus the desktop rail's `border-top` + `padding-top:20px` + `gap:32px`. The last group (Price) has no `border-bottom`.

1. **`Category`** (L77) — has a chevron (`M18 15l-6-6-6 6`). Rendered as **three chips** in `display:flex;gap:8px`, each `height:44px;padding:0 16px;display:inline-flex;align-items:center;font:500 14px/1 var(--font-body)`:
   - `Tires` — **selected**: `background:var(--text);color:var(--on-accent);border:1px solid var(--border-strong)` ← note the border is `--border-strong`, **not** `--text`
   - `Wheels`, `Accessories` — `background:transparent;color:var(--text-muted);border:1px solid var(--border-strong)`
   **No counts** (desktop shows 18 / 42 / 9).
2. **`Tire size`** (L78) — has a chevron. `display:grid;grid-template-columns:1fr 1fr 1fr 88px;gap:8px;align-items:end` → each field **(358 − 88 − 24)/3 = 82px**, Apply pinned at **88px**. Fields identical to desktop (`height:44px;background:var(--surface-2);border:1px solid var(--border-strong);padding:0 10px`, caption `font:500 10px/1;letter-spacing:.1em;uppercase;color:var(--text-dim)`, value `font:700 15px/1;tabular-nums`, 14×14 chevron). Values `Width` **215**, `Profile` **55**, `Rim` **R16**.
   Apply: `height:44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--text);font:500 12px/1 var(--font-body);letter-spacing:.08em;text-transform:uppercase`. Desktop's Apply is 13px and full-width on its own row; here it is 12px and inline in the grid.
3. **`Season`** (L79) — **no chevron** (bare label span). Chips `display:flex;gap:8px`, each `height:44px;padding:0 16px;font:500 14px/1 var(--font-body)`:
   - `All-season` — `background:transparent;color:var(--text-muted);border:1px solid var(--border-strong)`
   - `Winter` — **selected**: `background:var(--text);color:var(--on-accent);border:1px solid var(--text)`
   - `Summer` — unselected
   Desktop chips are `height:40px`; these are `height:44px`. Otherwise identical, including the `border:1px solid var(--text)` on the selected chip (which Category's selected chip does *not* get).
4. **`Brand`** (L80) — **no chevron**; group `gap:8px`. `display:grid;grid-template-columns:1fr 1fr` — **two columns**, versus desktop's single flex column with `gap:2px`. Each `<label style="display:flex;align-items:center;gap:10px;height:44px">` (desktop: `gap:12px;height:40px;cursor:pointer` — **`cursor:pointer` is dropped here**). Checkbox identical (18×18, `--radius-ctl`, `--text` fill + `--on-accent` tick when checked, `--text-dim` border when not). Name `font:400 15px/1 var(--font-body)` with **no explicit colour** (inherits `--text`) and **no `flex:1`** — so the count sits immediately after the name rather than pushed right. Count `font:400 12px/1 var(--font-body);color:var(--text-dim)` (desktop: 13px, plus `font-variant-numeric:tabular-nums` which is **absent here**).
   Same eight brands and counts as desktop: `Zeta` 4 ✓ · `ZMAX` 5 ✓ · `Mazzini` 3 · `Michelin` 2 · `Bridgestone` 2 · `Continental` 1 · `Pirelli` 1 · `Hankook` 1.
5. **`Price per tire`** (L81) — **no chevron**; group `gap:16px`, no bottom border. Slider markup byte-identical to desktop (same 14% / 42% positions, same 16px square handles with `--radius-ctl`). Value row `$140` / `$275` at `font:700 15px/1 var(--font-body)` — **`font-variant-numeric:tabular-nums` is missing here** (desktop has it). **The `$100` / `$400` bounds row present on desktop is absent.**

### 4.5 Sheet footer / apply action (L83)

`padding:12px 16px 20px;border-top:1px solid var(--border-strong);background:var(--surface)`.
Action `<a href="#">`: `display:flex;align-items:center;justify-content:center;height:52px;background:var(--accent);color:var(--on-accent);border-radius:var(--radius-ctl);font:500 14px/1 var(--font-body);letter-spacing:.08em;text-transform:uppercase`. Copy **`Show 12 matches`**. Full 358px width. **No hover class** (the file has an empty `<style>` hover block — zero `.xN` rules).

There is no separate "Clear" button in the footer; clearing lives only in the sheet header as the `Clear all` text link.

### 4.6 Differences from the desktop filter rail — summary

| | Desktop rail | Mobile sheet |
|---|---|---|
| Container | 280px sticky aside, `top:96px`, on `--bg` | 390 × 700px bottom-anchored panel on `--surface` over an `--scrim-mid` scrim |
| Group separation | `border-top` + `padding-top:20px`, `gap:32px` between groups | `border-bottom` + `padding:16px 0`, no outer gap |
| Group `gap` | 14px (20px for Price) | 12px (8px Brand, 16px Price) |
| Collapse chevrons | all 5 groups | Category and Tire size only |
| Category | list rows, `height:40px`, with counts 18/42/9 | 3 chips, `height:44px`, no counts |
| Tire size layout | `1fr 1fr 1fr` (88px fields) + full-width Apply below | `1fr 1fr 1fr 88px` (82px fields) with Apply inline |
| Apply type | `font:500 13px/1` | `font:500 12px/1` |
| Season chips | `height:40px` | `height:44px` |
| Brand layout | 1 column, `gap:2px`, rows 40px, name `flex:1`, count 13px tabular | 2 columns, rows 44px, name not flexed, count 12px non-tabular |
| Price | slider + values + `$100`/`$400` bounds row, values tabular | slider + values only, values **non-tabular** |
| Close / dismiss | none (always open) | 44×44 bordered ✕ in the header |
| Commit action | none — filters apply live; only the Tire-size `Apply` exists | sticky footer `Show 12 matches`, accent fill, 52px |
| Clear | `Clear all` link in the rail header | `Clear all` link in the sheet header (identical styling) |

---

## 5. Value inventory

### 5.1 Colours

Every distinct colour reference that appears in the three results files, with where it is used. Literal hexes in the body: only `#F4F4F5` (as the `var(--on-photo, #F4F4F5)` fallback) and `rgba(244,244,245,.68)`.

| Value | Resolved | Used for |
|---|---|---|
| `var(--bg)` | `#0B0B0D` | `html,body` ground; artboard root; footer ground; **card image-area ground** |
| `var(--surface)` | `#16161A` | product card ground; vehicle chip fill (D+M+F); mobile "Not sure which one?" panel; filter-sheet panel; filter-sheet footer bar |
| `var(--surface-2)` | `#1F1F24` | desktop sort select fill; tire-size field fills (D+F); **"Currently unavailable" badge fill** |
| `var(--border)` | `#1F1F24` | product card border (rest); header `border-bottom`; mobile sticky bar top+bottom; footer bottom-bar `border-top` |
| `var(--border-strong)` | `#35353B` | vehicle chip border; sort select border; tire-size field borders; unselected chip borders (Season D+F, Category F); filter-group hairlines (D `border-top` ×5, F `border-bottom` ×5); similar-matches divider; footer `border-top`; social-icon borders; mobile CTA panel border; sheet panel `border-top`, header `border-bottom`, footer `border-top`, close-box border; price-slider rail |
| `var(--text)` | `#F4F4F5` | body colour; headings; card brand label + product name; price numeral (available cards); active nav item; vehicle chip text; sort value; breadcrumb current segment; filter group labels; **selected filter fill** (Category row D, chips D+F, checkbox fill); checkbox checked border; price-slider fill + handles; tire-size `Apply` border+text; mobile `Filters (3)` border; ghost CTA border+text; Load more text; all `:hover` targets in `.x74`–`.x89` / `.x99`–`.x111` |
| `var(--text-muted)` | `#A7A7AE` | card size numeral; card "from"; card brand tag; 3PMSF marker; "All-Season" badge border+text; "Change vehicle" link; `Clear all` link; result count; unselected category rows/chips text; SVG chevron strokes; footer links; social icons; mobile CTA panel body copy; global `a:hover` |
| `var(--text-dim)` | `#8B909A` | breadcrumb; `Sort` label; tire-size field captions; facet counts; price bounds `$100`/`$400`; card `/ tire` unit; **unavailable card price numeral**; "Currently unavailable" badge border+text; unchecked checkbox border; footer column headings; footer bottom-bar copy |
| `var(--accent)` | `#C9F23A` | **Winter badge fill** ×5 D / ×3 M; **`Request a quote` fill** ×8 D / ×4 M; desktop active nav `border-bottom:2px`; desktop phone-pill border; Load more border (D+M); mobile call-FAB fill (M+F); mobile "Call 647-989-6178" border; filter-sheet `Show 12 matches` fill |
| `var(--accent-hover)` | `#DDFF6B` | card hover `border-color` (every `.xN` odd rule); frozen-hover card inline border (D L194, M L143); primary CTA hover fill |
| `var(--on-accent)` | `#0B0B0D` | text on Winter badge; text on `Request a quote`; text on selected filter fills; checkbox tick stroke; text on `Show 12 matches`; call-FAB icon; hover text on `.x58`/`.x74`/`.x77`/`.x99` |
| `var(--on-photo)` | `#F4F4F5` | header bar text colour and its per-element restatements (always with a redundant `#F4F4F5` fallback) |
| `var(--scrim-strong)` | `rgba(11,11,13,.92)` | header bar background (all 3 files); mobile sticky filter/sort bar background |
| `var(--scrim-mid)` | `rgba(11,11,13,.68)` | card image vignette end-stop (×14); filter-sheet scrim |
| `rgba(244,244,245,.68)` | — | the three inactive desktop nav links (`Wheels`, `Accessories`, `Contact`) — **the only raw rgba literal in the markup**; ≈ `--text` at 68% |
| `#F4F4F5` literal | — | `var(--on-photo, #F4F4F5)` fallback, 4× D / 3× M+F |
| `transparent` | — | inactive nav `border-bottom`; unselected chip/row/checkbox fills; ghost CTA background; menu-button background; vignette start-stop |
| **Unused tokens** | `--accent-subtle` `rgba(201,242,58,0.12)`, `--winter` `#8FC9F2`, `--all-season` `#D9C29A`, `--canvas-bg` `#050505`, `--scrim-soft` `rgba(11,11,13,.38)` | declared in `:root` in all three files, referenced nowhere on the results page |

### 5.2 Type

Every distinct family/weight/size/line-height/tracking/transform combination.

**Display — `var(--font-display)` = Barlow Condensed**

| Spec | Role | Where |
|---|---|---|
| 700 / 40px / 0.92 / −0.015em / uppercase | Section heading | D `Best matches` L153, `Similar matches` L383 |
| 700 / 32px / 0.92 / −0.015em / uppercase | Section heading | M `Best matches` L103, `Similar matches` L221 |
| 700 / 36px / **1** / no tracking / uppercase | Panel heading | M `Not sure which one?` L301 |
| 700 / 28px / 0.92 / −0.015em / uppercase | Card product name | D, 9 cards |
| 700 / 24px / 0.92 / −0.015em / uppercase | Card product name | M, 5 cards |
| 700 / 28px / **1** / no tracking / uppercase | Filter panel title `Filters` | D L122, F L75 |
| 700 / 11px / **24px** / +0.08em / uppercase | Card brand tag over image | D+M, 14 cards |

**Body / UI — `var(--font-body)` = Barlow**

| Spec | Role |
|---|---|
| 700 / 28px / 1 / tabular | Card price numeral (D) |
| 700 / 24px / 1 / tabular | Card price numeral (M) |
| 700 / 16px / 1 / tabular | Mobile `Call 647-989-6178` panel CTA |
| 700 / 15px / 1.1 | Card brand label (D) |
| 700 / 12px / 1.1 | Card brand label (M) |
| 700 / 15px / 1.2 / tabular | Card size numeral (D) |
| 700 / 14px / 1.2 / tabular | Card size numeral (M) |
| 700 / 15px / 1 / tabular | Tire-size field values; price-slider values (D) |
| 700 / 15px / 1 / **non-tabular** | Price-slider values (F only) |
| 700 / 14px / 1 | Vehicle chip; sort select value |
| 500 / 15px / 1 | Category facet rows (D) |
| 500 / 14px / 1 | Season/Category chips (D+F); Load more (D+M); `Show 12 matches` (F) |
| 500 / 13px / 1 / +0.1em / uppercase | Desktop nav items; phone-pill CTA |
| 500 / 13px / 1 / +0.08em / uppercase | `Change vehicle` (D); tire-size `Apply` (D) |
| 500 / 13px / 1 / +0.06em / uppercase | Card `from` (D) |
| 500 / 13px / 1 / +0.04em / uppercase | Card CTA (D) |
| 500 / 12px / 1 / +0.12em / uppercase | Filter group labels (D+F) |
| 500 / 12px / 1 / +0.1em / uppercase | Breadcrumb (D) |
| 500 / 12px / 1 / +0.08em / uppercase | `Clear all` (D+F); `Apply` (F) |
| 500 / 12px / 1 / +0.06em / uppercase | `Change vehicle` (M); `Filters (3)`; `Sort: Best match` |
| 500 / 12px / 1 / +0.04em / uppercase | Card CTA (M) |
| 500 / 12px / 1 (no tracking) | Card `from` (M) — declared `letter-spacing:.06em`, uppercase |
| 500 / 11px / **24px** / +0.1em / uppercase | Winter badge (filled) |
| 500 / 11px / **22px** / +0.1em / uppercase | All-Season and Currently-unavailable badges (outlined) |
| 500 / 11px / 1 / +0.12em / uppercase | `Sort` label (D); footer column headings |
| 500 / 11px / 1 / +0.1em / uppercase | Breadcrumb (M+F) |
| 500 / 11px / 1 / +0.08em | 3PMSF marker label — **not uppercased, source is already `3PMSF`** |
| 500 / 10px / 1 / +0.1em / uppercase | Tire-size field captions (D+F) |
| 400 / 15px / 1.3 | Footer links |
| 400 / 15px / 1 | Brand facet names (D+F) |
| 400 / 15px / 1 / tabular | Result count (D) |
| 400 / 14px / 1.5 | Mobile CTA panel body copy |
| 400 / 14px / 1 / tabular | Result count (M) |
| 400 / 13px / 1.4 | Footer bottom-bar copy |
| 400 / 13px / 1 / tabular | Facet counts (D) |
| 400 / 13px / 1 | Card `/ tire` unit (D) |
| 400 / 12px / 1 | Price bounds `$100`/`$400` (D); facet counts (F); card `/ tire` unit (M) |

`font-variant-numeric:tabular-nums` appears on: card size numeral, card price numeral, tire-size field values, facet counts (D only), result count, price-slider values (D only), mobile panel phone CTA. It is **absent** from the mobile "$140/$275" sheet values and the sheet facet counts.

### 5.3 Spacing

`✓` = on DESIGN.md's declared scale (8 / 16 / 24 / 32 / 48 / 80 / 120). `✗` = off-scale.

| Value | ✓/✗ | Used for |
|---|---|---|
| `2px` | ✗ | brand facet list `gap` (D); `--radius-ctl`; price-slider rail/fill height; active-nav `border-bottom` |
| `4px` | ✗ | category facet list `gap` (D); 3PMSF marker `gap`; card price block `margin-top:4px`; footer link `padding:4px 0` |
| `6px` | ✗ | badge row `gap`; card price block `gap`; tire-size field column `gap`; breadcrumb separator `margin:0 6px` |
| `8px` | ✓ | card body `gap`; card CTA row `gap` + `padding-top`; chip row `gap`; tire-size grid `gap`; sticky bar `gap`; social row `gap` + `margin-top`; price-slider `margin:0 8px`; mobile header icon `gap`; sheet body `padding:8px 16px`; brand group `gap` (F); nav link `padding:8px 0` |
| `10px` | ✗ | logo link `gap`; phone-pill `gap`; vehicle chip `gap`; badge `padding:0 10px`; tire-size field `padding:0 10px`; sticky-bar control `gap`; mobile CTA `gap`; sheet brand label `gap`; **mobile card badge inset `top/left/right:10px`** |
| `12px` | ✗ | toolbar sort cluster `gap`; card grid `gap` (M); brand checkbox `gap` (D); mobile toolbar `gap`; footer column `gap`; footer bottom-bar `gap`; sheet group `gap`; category facet row `padding:0 12px`; Load more `margin-top` (M); `Change vehicle` `padding:12px 0` (M); sticky bar `padding:12px 16px`; sheet footer `padding:12px 16px 20px` |
| `14px` | ✗ | filter group `gap` (D); vehicle chip `padding:0 14px`; sort select `padding:0 14px`; **mobile card body `padding:14px`**; mobile CTA panel `gap` |
| `16px` | ✓ | **product grid gutter (D)**; sort select `gap`; chip `padding:0 16px`; footer brand block `gap`; sticky bar `margin-top`; price-slider handle 16×16; sheet header cluster `gap`; sheet group `padding:16px 0`; sheet price group `gap`; **desktop card badge inset `top/left/right:16px`**; all mobile side padding |
| `20px` | ✗ | toolbar left cluster `gap`; filter group `padding-top` (D); price group `gap` (D); card CTA `padding:0 20px`; phone-pill `padding:0 20px`; sheet header `padding:20px 16px`; mobile toolbar `padding:20px 16px 0`; sheet footer bottom `20px` |
| `24px` | ✓ | toolbar row `gap`; **desktop card body `padding:24px`**; mobile CTA panel `padding:24px`; footer outer+inner grid `gap` (D); footer bottom-bar `padding-top`; mobile similar-matches header `padding-top` |
| `32px` | ✓ | filter rail `gap` between groups; results-section `gap` (D); desktop similar-matches header `padding-top`; desktop toolbar `padding-top:32px` |
| `40px` | ✗ | desktop nav `gap:40px`; Load more `padding:0 40px` (D); footer bottom padding `40px` (D); mobile footer grid `gap:40px`; mobile best-matches `padding-top:40px`; desktop results grid `padding-top:40px`; social icon 40×40; many facet-row heights |
| `48px` | ✓ | desktop side padding (`0 48px`, `32px 48px 0`, `40px 48px 0`, `80px 48px 40px`); results grid `gap:48px`; footer bottom-bar `margin-top:48px`; desktop card CTA `height:48px` |
| `56px` | ✗ | Load more `height:56px` (D); mobile similar-matches `padding-top:56px`; mobile CTA panel `margin-top:56px`; mobile footer `margin-top:56px`; mobile footer `padding-top:56px` |
| `80px` | ✓ | results column `gap:80px` (D); footer `padding-top:80px` (D) |
| `120px` | ✓ | Load more row `padding-bottom:120px` (D); footer logo `height:120px`; mobile footer `padding-bottom:120px` |
| `6%` | ✗ | card image `padding:6%` (percentage — the only non-px spacing on the page) |

Fixed heights / widths (all measured, none from a scale):
`2px` slider rail · `16px` slider handle · `18px` checkbox + facet icons · `20px` slider track box · `24px` badge · `40px` (category rows, season chips, brand rows, vehicle chip D, social icons) · `44px` (phone pill, sort select, tire-size fields, mobile vehicle chip, mobile CTA, sticky-bar controls, `Apply`, sheet chips, sheet brand rows, call FAB, menu button, close box) · `48px` desktop card CTA · `52px` mobile Load more + mobile panel CTA + sheet apply · `56px` desktop Load more · `64px` desktop header logo · `68px` mobile header · `88px` desktop header, desktop tire-size field width, sheet `Apply` column width · `120px` footer logo · `200px` sort select `min-width` · `280px` filter rail · `326px` computed card inner (D) · `328px` computed card track (D) · `356px` computed card inner (M) · `358px` computed card track (M) · `700px` sheet panel · `844px` sheet artboard · `1016px` computed results column (D) · `390px` / `1440px` artboard widths.

Off-scale values in heaviest use: **6px, 10px, 12px, 14px, 20px, 40px, 44px, 56px**. The card grid gutter (16px D / 12px M) is not the 24px DESIGN.md specifies.

### 5.4 Radius and borders

**Radius**

| Value | Used for |
|---|---|
| `var(--radius-ctl)` = **2px** | every control: phone pill, sort select, tire-size `Apply`, card CTA (both variants), Load more (D+M), price-slider handles, brand checkboxes, mobile panel CTA, sheet `Show 12 matches`. 23× D / 7× M / 11× F |
| `50%` | mobile + sheet call FAB only (44px circle) |
| **not declared (= 0)** | product card, card image area, **all badges**, vehicle chip, tire-size field boxes, all chips, category facet rows, social icon squares, sheet close box, sheet panel, `Filters (3)` / `Sort: Best match` controls |

**Borders** — every distinct width + colour pair:

| Border | Count (D / M / F) | Used for |
|---|---|---|
| `1px solid var(--border)` `#1F1F24` | 8 / 4 / 0 | product card at rest (9 D / 4 M) — plus the `border-bottom`/`border-top` variants below |
| `1px solid var(--border-strong)` `#35353B` | 10 / 6 / 10 | vehicle chip, sort select, tire-size fields, unselected chips, social icons, mobile CTA panel, sheet close box |
| `1px solid var(--text)` `#F4F4F5` | 5 / 2 / 4 | selected Season chip, checked checkbox, tire-size `Apply`, ghost card CTA, `Filters (3)` |
| `1px solid var(--text-muted)` `#A7A7AE` | 3 / 1 / 0 | **All-Season badge only** |
| `1px solid var(--text-dim)` `#8B909A` | 7 / 1 / 6 | unchecked checkboxes; **Currently-unavailable badge** |
| `1px solid var(--accent)` `#C9F23A` | 2 / 2 / 0 | desktop phone pill, Load more (D+M), mobile panel phone CTA |
| `1px solid var(--accent-hover)` `#DDFF6B` | 1 / 1 / 0 | the frozen-hover card (inline) |
| `border-color:var(--accent-hover) !important` | 9 / 5 / 0 | every card `:hover` rule |
| `1px solid var(--border)` as `border-bottom` | 1 / 2 / 1 | header bar; mobile sticky bar bottom |
| `1px solid var(--border)` as `border-top` | 1 / 2 / 0 | footer bottom-bar; mobile sticky bar top |
| `1px solid var(--border-strong)` as `border-top` | 7 / 2 / 2 | 5 filter groups (D), similar-matches divider, footer, sheet panel, sheet footer |
| `1px solid var(--border-strong)` as `border-bottom` | 0 / 0 | 5 / sheet header + 4 filter groups (F) |
| `2px solid var(--accent)` | 1 / 0 / 0 | **active nav underline — the only accent 2px border on the page** |
| `2px solid transparent` | 3 / 0 / 0 | inactive nav underline placeholders |
| `border:0` | 0 / 1 / 1 | mobile menu `<button>` |

The only non-1px borders anywhere are the nav underlines (2px). There are no borders wider than 2px and no `outline` declarations (so **no focus styling exists in the export at all**).

---

## 6. Conflicts with DESIGN.md

| # | DESIGN.md says | The artboard does | File + line |
|---|---|---|---|
| 1 | `--bg: #000000` "true-black slab", "Black is a material" (§1, §2) | `--bg:#0B0B0D` | all 3 files L12 |
| 2 | `--bg-alt: #0a0a0a` alternating band token (§2) | **Token does not exist.** There is no `--bg-alt` and no alternating band anywhere on the results page | `:root` L11–40 |
| 3 | `--surface: #141414` | `--surface:#16161A` | L13 |
| 4 | `--border: #1f1f1f` | `--border:#1F1F24` | L15 |
| 5 | `--rule: #2a2a2a` hairline-on-`--bg` token (§2) | **Token does not exist.** Replaced by `--border-strong:#35353B`, a lighter hairline | L16 |
| 6 | `--text: #ffffff` pure white for headlines and prices (§2, §3) | `--text:#F4F4F5` — nothing on the page is pure white | L17 |
| 7 | `--text-muted: #b8b8b8` | `--text-muted:#A7A7AE` | L18 |
| 8 | `--text-dim: #6a6a6a` | `--text-dim:#8B909A` — considerably lighter | L19 |
| 9 | `--accent: #e10600` racing red; "the only one that reads as automotive without reading as… 'tech' (lime)" (§2) | `--accent:#C9F23A` — acid lime, the exact hue DESIGN.md argues against | L20 |
| 10 | `--accent-hover: #ff1a12` (brighter red) | `--accent-hover:#DDFF6B` | L21 |
| 11 | `--accent-deep: #9e0400`, used for card hover border — "Deep, not bright: hover should not compete with the CTA" (§2, §4) | **No `--accent-deep` token.** Card hover uses `--accent-hover` `#DDFF6B`, the *brightest* value — i.e. exactly the competing-with-the-CTA case DESIGN.md forbids | D L48 etc. (`.x59:hover`), M L47 etc. |
| 12 | `--on-accent: #000000` | `--on-accent:#0B0B0D` | L23 |
| 13 | Two families only, "No third font" (§3) | Four families requested: Barlow Condensed, Barlow, **Michroma**, **Manrope**. The last two are never used | D L9, M L9, F L9 |
| 14 | Card body padding 24px; order badge → brand (11px) → name (Barlow Condensed 700 **28px**) → size (Barlow 700 **15px**) → price (**32px**) → button (§4) | D matches the order and 24px/28px/15px, but **price is 28px, not 32px**. M uses padding **14px**, brand 12px, name 24px, size 14px, price 24px | D L173/L181, M L131/L138 |
| 15 | "Cards sit in a grid with **24px gutters**" (§4); "Grid: 12 columns, 24px gutter, max content width **1320px**, centred container with **24px** side padding (16px on mobile)" (§5) | Gutter **16px** (D) / **12px** (M). **No max-width at all** — the 1440 artboard is full-bleed. Side padding **48px** (D), 16px (M) | D L154/L384/L119, M L104/L222 |
| 16 | Product grids "4-up at 1320, 3-up under 1100, 2-up under 720, 1-up under 400" (§5, §8) | **3-up at 1440**, 1-up at 390. No 4-up and no 2-up state exists in any export | D L154, M L104 |
| 17 | "Image area: square, black (`--bg`) ground, product photo on black, **no inset border**… cut out onto pure black so the card ground and image ground are the same colour" (§4, §6); "**No gradient fills** except `--hero-fade`… never applied to cards" (§6) | Every card image carries `radial-gradient(ellipse at center, transparent 50%, var(--scrim-mid) 100%)` — a vignette gradient on a card, ×14 | D L161, M L111 |
| 18 | "Nothing is a pill" / all radii 0–4px (§4) | The mobile call button is `border-radius:50%` — a 44px circle | M L83, F L62 |
| 19 | **Badge colour rule:** "**Only WINTER gets colour**" and WINTER = `--accent` fill + black text; ALL-SEASON and everything else = transparent + `1px --text-muted` outline (§4) | Structurally honoured: Winter = `--accent` fill + `--on-accent` text; All-Season = transparent + `1px --text-muted` outline. **But** (a) the accent is lime, not red; (b) a third variant DESIGN.md does not define exists — `Currently unavailable`, with a `--surface-2` **fill**, `--text-dim` border and `--text-dim` text, which is not the "outline, muted" treatment; (c) tokens `--winter:#8FC9F2` and `--all-season:#D9C29A` are declared and never used, implying an abandoned per-season colour scheme | D L162 / L239 / L432; M L112 / L189 / L270; tokens L25–26 |
| 20 | Badge "Placed top-left inside the card image at **16px inset**" (§4) | D: 16px ✓. **M: 10px** | M L110 |
| 21 | Badge line-height 24px, height 24px, padding `0 10px`, radius 0, Barlow 500 11px +0.10em (§4) | Matches exactly, except outlined variants use `/22px` line-height to compensate for the 1px border (net 24px). Not a conflict, a refinement | D L162/L239 |
| 22 | **Chip:** height **36px**, padding `0 14px`, radius **2px**, Barlow 500 **13px sentence case**, `1px solid --border`, text `--text-muted`. Selected: fill `--text`, text `#000`, border `--text`. "Chips grow to **40px** on touch" (§4, §8) | Height **40px** (D) / **44px** (F). Padding `0 16px`. **No radius declared (0)**. Font **14px**. Border is `--border-strong` `#35353B`, not `--border` `#1F1F24`. Selected fill `--text` + `--on-accent` text ✓. **Category's selected chip in the sheet keeps a `--border-strong` border** while Season's selected chip gets `--text` — inconsistent between the two chip groups in the same panel | D L135; F L77 (Category), F L79 (Season) |
| 23 | Chip row "preceded by a 12px label (`FILTER BY`)" (§4) | Labels are 12px +0.12em uppercase ✓ but read `Category` / `Season`; no `FILTER BY` label anywhere | D L134, F L79 |
| 24 | **Table row / list row:** row height **56px min**, `border-bottom: 1px solid --rule`, header row `--surface` fill 48px, cell padding `0 16px`, first cell flush left. Row hover `--bg-alt`. Selected row `2px solid --accent` left edge (§4) | **No table exists on the results page.** The closest analogue is the Category facet list: rows **40px**, **no dividers at all**, `padding:0 12px` (not `0 16px`, and not flush-left), selected state is a **full `--text` fill**, not a 2px left edge, and there is **no hover rule** | D L125 |
| 25 | Row/list dividers use `--rule` `#2a2a2a` (§2, §4) | All group dividers use `--border-strong` `#35353B`; the card/footer hairlines use `--border` `#1F1F24`. Two hairline weights of colour, neither `#2a2a2a` | D L123/L383/L502 |
| 26 | **One-accent-per-frame rule** (§2): the accent appears once per card/row/viewport; "A product card with a WINTER badge therefore has a **secondary (ghost)** add-to-cart button, not a primary one"; "two accent elements must never touch or sit adjacent" | **Violated on every Winter card.** Each Winter card carries a lime badge **and** a lime-filled `Request a quote` button = 2 accent elements per card. Counts below | D L162 + L188 (card 1), and 4 more pairs |
| 27 | Focus ring `2px --accent`, no offset (§2, §4); "Touch targets ≥44px" (§8) | **No `:focus`, `outline` or `box-shadow` rule exists anywhere in the three files.** Touch targets are honoured on mobile (44px throughout) | all 3 files |
| 28 | "Transitions: `background-color 0ms`. Hover is an instant fill change, not a fade." Card hover 150ms `cubic-bezier(.2,0,0,1)` (§4) | Card transition is exactly `border-color 150ms cubic-bezier(.2,0,0,1),transform 150ms cubic-bezier(.2,0,0,1)` ✓ — and `background-color` is not in the transition list, so fills are instant ✓. **Matches.** | D L158 |
| 29 | "Mobile: `no hover states`; tap = active state" (§8) | `results-mobile.html` ships 22 `:hover` rules (`.x90`–`.x111`), including card lift + border | M L47–68 |
| 30 | Prices "always Barlow 700 with tabular-nums… Currency symbol and cents are the same size and weight — no superscript cents, no small `$`. Price scale: **32px in cards**" (§3) | 700 + tabular ✓, no superscript ✓. Size **28px** (D) / **24px** (M). Format is `$129 CAD` — **no cents at all**, plus separate `from` and `/ tire` affixes | D L181 |
| 31 | "Prices are never red" / never accent (§3) | Honoured — prices are `--text`, or `--text-dim` when unavailable | D L180 |
| 32 | Modal is "a level-2 panel on a `rgba(0,0,0,0.8)` scrim — flat black, **not blurred**" (§6) | Sheet scrim is `var(--scrim-mid)` = `rgba(11,11,13,.68)` — right idea, different value; flat and unblurred ✓ | F L73 |
| 33 | Nav height 72px desktop / 56px mobile; wordmark `PLATINUM WHEELS` in Barlow Condensed 700 22px (the badge PNG "must be used as a cut-out… use the **wordmark** in the nav") (§0, §4) | Header is **88px** (D) / **68px** (M). **No wordmark exists** — the nav shows `platinum-wheels-logo-transparent.png` at 64px (D) / 52px (M); the footer shows it at 120px | D L86/L88, M L76/L78 |
| 34 | Section breaks 96–120px desktop, 56px mobile (§5, §8) | Desktop group gap is **80px** (`gap:80px` on the results column); footer opens with 80px. Mobile uses 56px ✓ | D L151, M L220 |
| 35 | CTAs "two words max: `ADD TO CART`, `BOOK INSTALL`" (§3) | `Request a quote` (3 words), `Inquire about restock` (3 words), `Show 12 matches` (3), `Change vehicle` (2), `Load more` (2), `Clear all` (2) | D L188/L453/L498 |
| 36 | Button padding `14px 28px` (height results, not fixed) (§4) | Buttons use **fixed heights** with `padding:0 20px` / `0 40px` / none | D L188/L498 |

### One-accent-per-frame — measured counts

**Per card** (an accent-coloured element = lime fill, lime border, or lime 2px rule):

| Card variant | Accent elements | Verdict |
|---|---|---|
| Winter card (D ×5, M ×3) | 2 — Winter badge fill + `Request a quote` fill | **Violates.** DESIGN.md explicitly requires a ghost button here |
| Winter card in frozen-hover state (D card 2, M card 2) | 3 — badge + CTA + `--accent-hover` border | **Violates** |
| All-Season card (D ×3, M ×1) | 1 — `Request a quote` fill | Honoured |
| Unavailable card (D ×1, M ×1) | 0 — dim badge + ghost CTA | Honoured (under-spends) |

**Per viewport.** The exports are single continuous artboards, so "one viewport" is **AMBIGUOUS** — there are no scroll-position markers. Counting accent-carrying elements across each whole artboard:

- **results-desktop.html — 17 accent elements:** active nav underline (L93) · phone-pill border (L102) · 5 Winter badges (L162, L200, L274, L312, L392) · 8 `Request a quote` fills (L188, L226, L262, L300, L338, L374, L418, L490) · frozen-hover card border (L194) · Load more border (L498).
- **results-mobile.html — 11:** call FAB fill (L83) · 3 Winter badges (L112, L150, L230) · 4 `Request a quote` fills (L138, L176, L212, L256) · frozen-hover card border (L143) · Load more border (L299) · panel phone-CTA border (L301).
- **results-mobile-filters.html — 2:** call FAB fill (L62) · `Show 12 matches` fill (L83). Note the header FAB is *behind* the scrim, so effectively one.

Even taking the loosest reading — one card = one frame — the desktop artboard puts three cards side by side in a row with 6 accent elements visible at once, plus a lime nav underline and a lime phone pill above them. **The artboard does not honour the one-accent-per-frame rule.** It treats lime as a general "interactive" colour, not a scalpel.

### Internal inconsistencies within the artboards (not DESIGN.md conflicts)

1. Season chip copy is `All-season` (lowercase s) in the filter rail and sheet, but the card badge is `All-Season` (capital S). D L135 vs D L239.
2. The sheet's price values drop `font-variant-numeric:tabular-nums` that the desktop rail has. F L81 vs D L146.
3. The sheet's brand counts are 12px non-tabular; the rail's are 13px tabular. F L80 vs D L136.
4. The sheet's selected **Category** chip keeps a `--border-strong` border while the selected **Season** chip gets a `--text` border. F L77 vs F L79.
5. The sheet's Season / Brand / Price groups have no collapse chevron; Category and Tire size do; all five have one on desktop.
6. Facet counts do not reconcile with the result count: brand counts total 19 (4+5+3+2+2+1+1+1), category counts are Tires 18 / Wheels 42 / Accessories 9, and the header reads `12 matches · 6 similar` while the sheet's apply button reads `Show 12 matches`. Nine cards are rendered on desktop, five on mobile.
7. `var(--on-photo, #F4F4F5)` supplies a fallback for a token that is always defined.
8. Desktop's `Filters` rail has no hover states on any control; the footer and cards do.

---

## 7. Assets and data needing replacement

### 7.1 External / hotlinked resources

| Resource | Where | Note |
|---|---|---|
| `https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;700&family=Michroma&family=Manrope:wght@400;500;700;800&display=swap` | all 3 files, L9 (+ `preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com`, L7–8) | The **only** external request in the three files. Michroma and Manrope are dead weight on this page; Barlow Condensed 600 is also unused. |

**No hotlinked images.** Every `src` is a relative local path.

### 7.2 Local image assets referenced

| Path | Used by | On disk | Rendered box |
|---|---|---|---|
| `assets/logo/platinum-wheels-logo-transparent.png` | header (D L88, M L78, F L58) and footer (D L505, M L306) of every file | present, 2,506,640 bytes | header 64px tall (D) / 52px (M+F); footer 120px tall; `width:auto`, no `object-fit` |
| `assets/products/zeta-antarctica-sport.png` | D cards 1 & 5, M card 1 | present, 824,024 bytes | see §3.2 |
| `assets/products/zmax-winterhawk.png` | D cards 2 & 8, M cards 2 & 5 | present, 593,534 bytes | " |
| `assets/products/zmax-landgema.png` | D cards 3, 6 & 9, M card 3 | present, 456,634 bytes | " |
| `assets/products/mazzini-snowleopard.png` | D cards 4 & 7, M card 4 | present, 906,711 bytes | " |

`alt` text equals `"<Brand> <Name>"` in every case: `Zeta Antarctica Sport`, `ZMAX Winterhawk`, `ZMAX Landgema`, `Mazzini Snowleopard`. Logo `alt="Platinum Wheels"`.

Unused by the results page but present in `design/assets/`: `products/spec1-sp51.png`, `products/touren-tr76.png`, `products/touren-tr79.png`, `logo/platinum-wheels-logo.png` (the white-background original DESIGN.md §0 warns about), `photos/accessories.png`, `photos/tires-tile.png`, `photos/wheels-tile.png`, `photos/winter-tacoma.png`.

**Replacement flags:** only 4 product images exist for 9 SKUs, so 5 of the 9 desktop cards reuse a photo already shown elsewhere on the same page (`zeta-antarctica-sport.png` twice, `zmax-winterhawk.png` twice, `zmax-landgema.png` three times, `mazzini-snowleopard.png` twice). Real per-SKU photography is needed. Files are 0.45–2.5 MB PNGs and need conversion/optimisation.

### 7.3 Contact details and business data (appear to be real, not placeholders — verify before shipping)

| Value | Where |
|---|---|
| `Call 647-989-6178` / `href="tel:+16479896178"` | D header L102; M header L83 + panel CTA L301; F header L62 |
| `© 2026 Platinum Wheels and Tire Solutions Inc.` | D L554, M L355 |
| `Brampton, Ontario · Prices in CAD, before tax` | D L555, M L356 |
| Social links — all three are `href="#"` | D L507–509, M L308–310. `aria-label` values: `Instagram`, `Facebook`, `Google Business` |
| All nav, footer and CTA links are `href="#"` | everywhere except the two `tel:` links |
| No street address anywhere on the results page | — |

### 7.4 Sample product data (seed data)

The active-vehicle context is `2021 Honda Civic` throughout (D L111, M L94, F L72). The tire-size filter is preset to **215 / 55 / R16** in every file. Season filter preset to **Winter**; brand filter preset to **Zeta + ZMAX** checked; price range shown as **$140–$275** within bounds **$100–$400**; sort = **Best match**; mobile filter count badge = **(3)**.

**Distinct SKUs, in artboard order.** Desktop carries all nine; mobile carries the subset marked ✓M.

| # | Section | Brand | Name | Size | Price | Badge | 3PMSF | CTA | Image | ✓M |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Best matches | `Zeta` | `Antarctica Sport` | `215/55R16 · 97T XL` | `$129 CAD` | `Winter` | yes | `Request a quote` | zeta-antarctica-sport.png | ✓ |
| 2 | Best matches | `ZMAX` | `Winterhawk` | `215/55R16 · 97T XL` | `$119 CAD` | `Winter` | yes | `Request a quote` | zmax-winterhawk.png | ✓ (both artboards show this card in hover state) |
| 3 | Best matches | `ZMAX` | `Landgema` | `215/55R16 · 97V XL` | `$99 CAD` | `All-Season` | no | `Request a quote` | zmax-landgema.png | ✓ |
| 4 | Best matches | `Mazzini` | `Snowleopard` | `215/55R16 · 97T XL` | `$115 CAD` | `Winter` | yes | `Request a quote` | mazzini-snowleopard.png | — |
| 5 | Best matches | `Zeta` | `Antarctica Sport` | `235/40R18 · 95T XL` | `$149 CAD` | `Winter` | yes | `Request a quote` | zeta-antarctica-sport.png | — |
| 6 | Best matches | `ZMAX` | `Landgema` | `235/40R18 · 95W XL` | `$124 CAD` | `All-Season` | no | `Request a quote` | zmax-landgema.png | — |
| 7 | Similar matches | `Mazzini` | `Snowleopard` | `225/50R17 · 98T XL` | `$132 CAD` | `Winter` | yes | `Request a quote` | mazzini-snowleopard.png | ✓ |
| 8 | Similar matches | `ZMAX` | `Winterhawk` | `215/50R17 · 95T XL` | `$127 CAD` | `Currently unavailable` | no | `Inquire about restock` | zmax-winterhawk.png (opacity 0.35) | ✓ |
| 9 | Similar matches | `ZMAX` | `Landgema` | `225/45R17 · 94W XL` | `$109 CAD` | `All-Season` | no | `Request a quote` | zmax-landgema.png | — |

Size-string format: `<width>/<ratio>R<rim>` with **no spaces**, then ` · ` (space, middot, space), then `<load index><speed rating> XL`. Every SKU carries the `XL` suffix. Speed ratings seen: `T`, `V`, `W`.

Price-string format: `$<integer> CAD`, always preceded by an uppercased `from` and followed by `/ tire`. **No cents anywhere. No sale/original price variant appears.**

**Facet seed data (brand list, in rail order):** `Zeta` 4 · `ZMAX` 5 · `Mazzini` 3 · `Michelin` 2 · `Bridgestone` 2 · `Continental` 1 · `Pirelli` 1 · `Hankook` 1. Michelin, Bridgestone, Continental and Hankook and Pirelli appear **only** as facet rows — no product card uses them.
**Category seed data:** `Tires` 18 · `Wheels` 42 · `Accessories` 9.
**Result count copy:** `12 matches · 6 similar` — inconsistent with the 6 + 3 (desktop) and 3 + 2 (mobile) cards actually rendered, and with the facet totals. Treat all counts as placeholder.

Other copy strings that are shipping copy, not lorem: `Best matches`, `Similar matches`, `Load more`, `Filters`, `Filters (3)`, `Clear all`, `Apply`, `Category`, `Tire size`, `Width`, `Profile`, `Rim`, `Season`, `Brand`, `Price per tire`, `Sort`, `Best match`, `Sort: Best match`, `Change vehicle`, `Home`, `Results`, `Show 12 matches`, `Not sure which one?`, `Call the shop. We'll check your size and quote in minutes.`, `Winter 2026`, `About the shop`, `How it works`, `Privacy Policy`, `Terms & Conditions`.
