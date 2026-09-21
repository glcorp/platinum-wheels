# Home — extracted inventory

Sources (read-only):
- `design/assets/home-desktop.html` — 437 lines, artboard `width:1440px` (`.screen`, line 47; screen root, line 89), viewport meta `width=1440`.
- `design/assets/home-mobile.html` — 392 lines, artboard `width:390px` (`.screen`, line 47; screen root, line 72), viewport meta `width=390`.
- `design/DESIGN.md` — 323 lines.

**Theme authority.** Both artboards declare the same `:root` (desktop lines 11–40, mobile lines 11–40): ground `#0B0B0D`, accent `#C9F23A` ("Track Night"). Per the project owner's ruling these are authoritative. DESIGN.md's "Cinematic Dark" `#000000` + `#e10600` values are recorded in §4 as conflicts only, not reconciled here.

**Two artboards, no media queries.** Neither file contains a single `@media` rule. Every style is an inline `style="..."` attribute. The only breakpoint evidence available is the pair of fixed artboard widths (1440 / 390) plus the fixed pixel values that constrain each layout. Where a threshold is stated below as COMPUTED it is arithmetic on declared values, not a value found in the file.

---

## 1. Section manifest (artboard order, top to bottom)

Desktop side padding is **48px** everywhere; mobile is **16px**. Desktop inter-section rhythm is **120px**; mobile is **56px**. No `max-width` container exists on either artboard — content is flush to the artboard minus side padding (desktop content width = **1344px** COMPUTED; mobile = **358px** COMPUTED).

### 1. `hero`
Full-bleed photo with the nav overlaid on top, eyebrow + h1 + subhead anchored to the lower-left.

- **Desktop** (lines 91–124): wrapper `position:relative; height:900px; overflow:hidden`. Photo `position:absolute; inset:0; object-fit:cover; object-position:center 60%`. Scrim `linear-gradient(to top, var(--bg) 0%, var(--scrim-strong) 22%, var(--scrim-soft) 55%, var(--scrim-soft) 100%)`. Nav absolutely positioned at `top:0; left:0; right:0`. Text block `position:absolute; left:48px; right:48px; bottom:200px; gap:28px; max-width:1100px`.
- **Mobile** (lines 73–99): wrapper `height:720px`. Photo `object-position:70% 60%`. Scrim `linear-gradient(to top, var(--bg) 0%, var(--scrim-strong) 28%, var(--scrim-mid) 60%, var(--scrim-soft) 100%)`. Text block `left:16px; right:16px; bottom:100px; gap:16px`, **no `max-width`**.
- **Change:** height 900 → 720; side inset 48 → 16; bottom inset 200 → 100; stack gap 28 → 16; headline 120px → 56px; subhead 20px → 16px; photo focal point `center 60%` → `70% 60%`; scrim adds a `--scrim-mid` stop at 60% on mobile. Headline max-width 1100px is dropped.

### 2. `nav` (child of hero, absolutely positioned)
Logo lockup left, primary links centre-right, phone CTA right.

- **Desktop** (lines 95–118): `height:88px; padding:0 48px; display:flex; justify-content:space-between; background:var(--scrim-strong); border-bottom:1px solid var(--border); width:100%`. Not sticky — `position:absolute` via its wrapper. Logo image `height:64px; width:auto`. Link row `display:flex; gap:40px`. Phone CTA `height:44px; padding:0 20px; border:1px solid var(--accent)`.
- **Mobile** (lines 77–92): `height:68px; padding:0 16px`, same background/border. Logo image `height:52px`. Right cluster `display:flex; gap:8px` holding a `44×44` circular accent call button (`border-radius:50%`) and a `44×44` transparent hamburger `<button>`.
- **Change:** height 88 → 68; logo 64 → 52; the four text links and the bordered "Call 647-989-6178" pill are replaced entirely by two 44×44 icon targets. COMPUTED minimum width for the desktop bar: logo (auto) + 4 links `gap:40` + a `white-space:nowrap` phone pill — the pill is the first thing to collide, so the desktop arrangement cannot be held far below 1440 without measuring rendered text. AMBIGUOUS: the export gives no intermediate state, so the desktop→mobile nav switch point is not recoverable from these files.

### 3. `finder` (vehicle-search panel, overlapping the hero)
Year / Make / Model selects plus the primary "Find my tires" CTA.

- **Desktop** (lines 126–147): `position:relative; margin:-120px 48px 0; z-index:2; background:var(--surface); border:1px solid var(--border-strong); padding:32px; gap:16px`. Inner `display:grid; grid-template-columns:1fr 1.2fr 1.2fr 300px; gap:16px; align-items:end`. COMPUTED: inner content 1278px → 1fr = 273.529px, 1.2fr = 328.235px, CTA fixed 300px.
- **Mobile** (lines 100–109): `margin:-72px 16px 0; padding:20px; flex-direction:column; gap:12px` — four stacked full-width children.
- **Change:** overlap −120 → −72; panel padding 32 → 20; 4-column row → 1 column; gap 16 → 12; field label→control gap 8 → 6; control height 56 → 52; control padding `0 16px` → `0 14px`; value type 17px → 16px; CTA height 56 → 52 and gains `margin-top:4px`. COMPUTED: the desktop row needs 300 + 3×16 + three legible text selects; below roughly 1184px of panel width the `300px` CTA column starts eating the selects — but this threshold is derived, not declared.

### 4. `category-tiles` — "01 — Shop by category"
Three photo tiles linking to Tires / Wheels / Accessories.

- **Desktop** (lines 148–155): section `padding:120px 48px 0; gap:40px`. Header row `display:flex; align-items:flex-end; justify-content:space-between` (eyebrow left, h2 right). Grid `grid-template-columns:2fr 1fr; grid-template-rows:320px 320px; gap:16px`; the Tires tile spans `grid-row:1/3`. COMPUTED: 2fr = 885.333px, 1fr = 442.666px, tall tile 656px high.
- **Mobile** (lines 110–118): section `padding:56px 16px 0; gap:20px`. Eyebrow, h2 and tiles are three siblings in a column (the desktop header row is broken apart). Tiles are `display:flex; flex-direction:column; gap:12px` with fixed heights **300px / 200px / 200px**.
- **Change:** 2×2 asymmetric grid → vertical stack; gap 16 → 12; section gap 40 → 20; tile label 88/56/56 → 56/40/40; tile text inset `left:32px; bottom:32px` → `left:20px; bottom:20px`; tile label stack gap 12 → 8; "Browse →" 14px → 13px; the big tile's scrim mid-stop moves 30% → 35%.

### 5. `winter-promo` — "Winter 2026"
Full-bleed photo + tinted copy panel with two spec chips and a primary CTA.

- **Desktop** (lines 157–169): `margin-top:120px; display:grid; grid-template-columns:7fr 5fr; min-height:640px`, **no side padding — full bleed to 1440**. COMPUTED: photo column 840px, copy column 600px. Copy panel `background:var(--accent-subtle); padding:80px 64px; justify-content:center; gap:24px; align-items:flex-start`. Photo carries a right-edge wash `linear-gradient(to right, transparent 60%, var(--accent-subtle) 100%)`.
- **Mobile** (lines 119–128): `margin-top:56px`. Photo block `height:280px` above the copy panel; photo overlay is `linear-gradient(to top, var(--accent-subtle) 0%, rgba(13,2,2,0) 50%)`. Copy panel `padding:8px 16px 48px; gap:16px`.
- **Change:** 7/5 side-by-side → photo-above-copy stack; photo becomes fixed 280px; copy padding `80px 64px` → `8px 16px 48px`; gap 24 → 16; h2 88 → 48; body 17 → 15; chip padding `0 14px` → `0 12px`; CTA height 56 → 52, `padding:0 28px` → `0 24px`, auto width → `width:100%`, and loses its `margin-top:8px`. The horizontal photo wash is replaced by a vertical one using a different (non-token) transparent colour.

### 6. `how-it-works` — "02 — How it works"
Four numbered steps.

- **Desktop** (lines 171–184): section `padding:120px 48px 0; gap:40px`. Grid `grid-template-columns:repeat(4,minmax(0,1fr)); border-top:1px solid var(--border-strong)`. Each cell `padding:32px 24px 0 0; border-right:1px solid var(--border); margin-right:24px; gap:20px` — vertical rules between columns, including a trailing one after step 04.
- **Mobile** (lines 129–134): section `padding:56px 16px 0; gap:20px`. Wrapper `border-top:1px solid var(--border-strong)`; each row `display:grid; grid-template-columns:56px 1fr; gap:12px; padding:20px 0; border-bottom:1px solid var(--border)` — horizontal rules instead of vertical.
- **Change:** 4 columns → 4 rows; separator axis flips from `border-right` to `border-bottom`; numeral 56 → 40 and loses `font-variant-numeric:tabular-nums`; step title 28 → 24 and loses `letter-spacing:var(--display-tracking)`; body 15 → 14; intra-cell gap 20 → 6 (title/body) with a 12px numeral/text gap.

### 7. `featured-tires` — "03 — Featured tires"
Four product cards.

- **Desktop** (lines 186–341): section `padding:120px 48px 0; gap:40px`. Header row: left column (eyebrow + h2, `gap:16px`), right cluster of two `48×48` arrow buttons, `gap:8px` — prev bordered `var(--border-strong)` / `var(--text-dim)`, next bordered `var(--text)` / `var(--text)`. Grid `repeat(4,minmax(0,1fr)); gap:16px`. COMPUTED card width 324px.
- **Mobile** (lines 135–305): section `padding:56px 0 0 16px; gap:20px; overflow:hidden` — note the **zero right padding**, intentional bleed. Header row has `padding-right:16px; gap:16px` and a single `44×44` circular "Next" affordance (`border-radius:50%`). Track `display:grid; grid-template-columns:repeat(4,260px); gap:12px` inside a `position:relative` wrapper. COMPUTED track width 1076px against 374px of visible width. A right fade `position:absolute; top:0; bottom:0; right:0; width:72px; background:linear-gradient(to right,transparent,var(--bg)); pointer-events:none` (line 297). Below it a progress indicator: four bars `height:3px`, first `width:28px; background:var(--accent)`, the other three `width:12px; background:var(--border-strong)`, `gap:6px; padding-top:4px`.
- **Change:** 4-up fluid grid → fixed 260px horizontal track clipped by `overflow:hidden`; two square arrows → one round arrow plus dot indicators; heading 56 → 40; gap 16 → 12. **AMBIGUOUS:** the mobile track is a carousel visually but the export declares `overflow:hidden` on the section with no `overflow-x:auto` or scroll-snap anywhere — the scrolling mechanism is implied by the fade and dots, not specified.

### 8. `brand-strip`
Twelve brand wordmarks on a banded row.

- **Desktop** (line 343–345): `margin-top:120px; background:var(--surface-2); border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:40px 48px; display:grid; grid-template-columns:repeat(8,minmax(0,1fr)); align-items:center` — **no `gap` declared**. COMPUTED: 12 items in 8 columns = row 1 of 8 + row 2 of 4 left-aligned with 4 empty cells; each cell 168px.
- **Mobile** (line 306–308): `margin-top:56px`, same band fills/borders, `padding:20px 16px; display:flex; gap:28px; align-items:center; overflow:hidden`; each wordmark `white-space:nowrap; flex:none`.
- **Change:** 8-column wrapped grid → single clipped flex row; type 26px → 20px; padding `40px 48px` → `20px 16px`. Desktop wordmarks carry hover classes `x12`–`x23`; **mobile wordmarks carry no class at all** — no hover on mobile.

### 9. `contact` — "04 — Contact"
Shop identity + two named contacts.

- **Desktop** (lines 347–379): `padding:120px 48px; display:grid; grid-template-columns:5fr 7fr; gap:48px; align-items:stretch`. COMPUTED: left 540px, right 756px. Left column (`gap:32px`): eyebrow → h2 → paragraph → hours block → email block. Right column `display:grid; grid-template-columns:1fr 1fr; gap:16px; align-content:start` holding two contact cards (COMPUTED 370px each) and, spanning `grid-column:1/3`, a `height:280px` photo panel with caption.
- **Mobile** (lines 309–334): `padding:56px 16px 0; gap:24px`, single column. Order: eyebrow → h2 → paragraph → **contact cards** → hours block → email block. **The 280px photo panel and its "Call or text. We answer." caption do not exist on mobile.**
- **Change:** 5/7 two-column → one column; the hours + email blocks move from *above* the cards (left column) to *below* them; the photo panel is dropped; h2 56 → 40; paragraph 17 → 15 and loses `max-width:420px`; card padding 32 → 20, gap 20 → 14; card name 40 → 28; call button height 56 → 52, auto width → `width:100%`, `padding:0 20px` → none, type 18 → 17, icon gap 12 → 10; field labels 11px → 10px; hours value 17 → 16; email 17 → 16. Mobile adds `border-top:1px solid var(--border-strong); padding-top:16px` to the hours block.

### 10. `footer`

- **Desktop** (lines 381–433): `background:var(--bg); border-top:1px solid var(--border-strong); padding:80px 48px 40px`. Top `display:grid; grid-template-columns:1.2fr 1fr; gap:24px` (COMPUTED 720px / 600px). Left: logo `height:120px` + three 40×40 social squares (`gap:8px; margin-top:8px`). Right: `grid-template-columns:1fr 1fr 1fr; gap:24px` (COMPUTED 184px each). Bottom bar `margin-top:48px; padding-top:24px; border-top:1px solid var(--border); justify-content:space-between; flex-wrap:wrap; gap:12px`.
- **Mobile** (lines 335–388): wrapper `margin-top:56px`. Footer `padding:56px 16px 120px`. Top `grid-template-columns:1fr; gap:40px`. Link block `grid-template-columns:1fr 1fr; gap:40px` with three children → 2 + 1 wrap (COMPUTED 159px columns). Bottom bar identical to desktop.
- **Change:** 2-column top → stacked; 3 link columns → 2 (+wrap); column gap 24 → 40; padding `80px 48px 40px` → `56px 16px 120px` (the 120px bottom pad reserves space for a mobile system bar / sticky CTA). Logo stays **120px** at both sizes. Bottom bar is byte-identical in both files.

### Breakpoint derivation — honest summary
The export encodes exactly two states. The values that actually force a change, and their COMPUTED minimum widths, are:
| Constraint | Declared value | COMPUTED minimum artboard width to hold the desktop form |
|---|---|---|
| Featured grid at 4-up with mobile's 260px card floor | `repeat(4,minmax(0,1fr)); gap:16px` + 96px side padding | 1136px |
| Finder row | `1fr 1.2fr 1.2fr 300px; gap:16px`, panel padding 32, side margin 48 | not derivable without text metrics — AMBIGUOUS |
| Winter promo 7fr/5fr with `max-width:440px` body | `7fr 5fr`, copy padding `80px 64px` | 1296px before the 440px measure is squeezed |
| Brand strip 8-up at 26px | `repeat(8,minmax(0,1fr))`, no gap | "Bridgestone"/"Continental" at 26px set the floor — AMBIGUOUS |
Everything else (nav collapse, tile stacking, contact reflow) has no declared threshold in these files.

---

## 2. Per-section detail

Shared shorthand used below: `font:<weight> <size>/<line-height> <family>`. `--font-display` = `'Barlow Condensed',sans-serif`; `--font-body` = `'Barlow',sans-serif`. `--display-weight` = 700, `--display-leading` = 0.92, `--display-tracking` = -0.015em, `--display-transform` = uppercase, `--scale-hero` / `--scale-h2` / `--scale-h3` all = 1 in both files (so `calc(120px * var(--scale-hero))` resolves to 120px, etc.).

Global rules from the `<style>` block (both files, lines 41–46):
- `*{box-sizing:border-box}`
- `html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:var(--font-body);-webkit-font-smoothing:antialiased}`
- `a{color:var(--text);text-decoration:none}` and `a:hover{color:var(--text-muted)}` — a base link hover that most inline-styled links override.
- `img{display:block}`

Fonts requested (line 9, both files): `Barlow+Condensed:wght@600;700`, `Barlow:wght@400;500;700`, `Michroma`, `Manrope:wght@400;500;700;800`, `display=swap`. **Michroma and Manrope are loaded but never referenced by any rule or inline style in either file.** Barlow Condensed 600 is also loaded but never used (only 700 via `--display-weight`).

---

### 2.1 `hero`

| # | Element | Desktop | Mobile |
|---|---|---|---|
| 1 | Background `<img>` | `src="https://vossenwheels.com/wp-content/uploads/2025/11/Vossen-Forged-GEN-01-Aerolip-Ferrari-F40-LM-SupercarRon-015-scaled.jpg"`, `alt=""`, `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 60%`. Rendered box 1440×900. (line 92) | same src, `alt=""`, `object-position:70% 60%`. Rendered box 390×720. (line 74) |
| 2 | Scrim `<div>` | `position:absolute;inset:0;background:linear-gradient(to top,var(--bg) 0%,var(--scrim-strong) 22%,var(--scrim-soft) 55%,var(--scrim-soft) 100%)` (line 93) | `...var(--bg) 0%,var(--scrim-strong) 28%,var(--scrim-mid) 60%,var(--scrim-soft) 100%` (line 75) |
| 3 | Eyebrow `<span>` | `font:500 12px/1 var(--font-body); letter-spacing:.16em; text-transform:uppercase; color:var(--accent)` (line 120) | `font:500 11px/1.4 var(--font-body); letter-spacing:.14em; text-transform:uppercase; color:var(--accent)` (line 95) |
| 4 | `<h1>` | `margin:0; font:var(--display-weight) calc(120px * var(--scale-hero))/var(--display-leading) var(--font-display); letter-spacing:var(--display-tracking); text-transform:var(--display-transform); color:var(--on-photo); text-wrap:balance` (line 121) | `font:var(--display-weight) calc(56px * var(--scale-h2))/var(--display-leading) var(--font-display)` — note it references **`--scale-h2`, not `--scale-hero`**; no `text-wrap:balance` (line 96) |
| 5 | Subhead `<p>` | `margin:0; font:400 20px/1.5 var(--font-body); color:var(--on-photo); opacity:.82; max-width:560px` (line 122) | `font:400 16px/1.5 var(--font-body); color:var(--on-photo); opacity:.82`, no max-width (line 97) |

Copy (identical in both files, verbatim):
- Eyebrow: `Brampton · Tires · Wheels · Accessories`
- H1: `The right tires. Confirmed by people who know.`
- Subhead: `Search by your vehicle. We match, confirm fitment and quote — you just drive.` (em dash U+2014)

Interactive states: none — no `xN` class in the hero.

---

### 2.2 `nav`

**Desktop** (lines 95–118). Bar: `height:88px; padding:0 48px; display:flex; align-items:center; justify-content:space-between; background:var(--scrim-strong); border-bottom:1px solid var(--border); font-family:var(--font-body); color:var(--on-photo, #F4F4F5); width:100%; box-sizing:border-box`.

1. Logo link `<a href="#">` — `display:flex; align-items:center; gap:10px; text-decoration:none; color:var(--on-photo, #F4F4F5)`. Contains `<img src="assets/logo/platinum-wheels-logo-transparent.png" alt="Platinum Wheels" style="height:64px;width:auto;display:block">`. No `object-fit`. **No text wordmark anywhere in the nav.**
2. `<nav>` — `display:flex; gap:40px`. Four `<a href="#">`, all `font:500 13px/1 var(--font-body); letter-spacing:.1em; text-transform:uppercase; padding:8px 0`.
   - `Tires` (line 102) — active: `color:var(--on-photo, #F4F4F5); border-bottom:2px solid var(--accent)`
   - `Wheels` (104), `Accessories` (106), `Contact` (108) — rest: `color:rgba(244,244,245,.68); border-bottom:2px solid transparent`
3. Phone CTA `<a href="tel:+16479896178" class="x1">` (line 109) — `display:inline-flex; align-items:center; gap:10px; height:44px; padding:0 20px; border:1px solid var(--accent); color:var(--on-photo, #F4F4F5); border-radius:var(--radius-ctl); font:500 13px/1 var(--font-body); letter-spacing:.08em; text-transform:uppercase; white-space:nowrap`. Inline 16×16 phone SVG (`stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round`) + text `Call 647-989-6178`.
   - **Hover `.x1`:** `background:var(--accent) !important; color:var(--on-accent) !important` — outline pill fills lime, text goes to `#0B0B0D`. Border stays `var(--accent)`.

**Mobile** (lines 77–92). Bar: `height:68px; padding:0 16px`, otherwise identical background/border/flex.

1. Logo link — same structure, `<img ... style="height:52px;width:auto;display:block">`.
2. Right cluster `<div style="display:flex;align-items:center;gap:8px">`:
   - `<a href="tel:+16479896178" aria-label="Call now">` — `width:44px; height:44px; border-radius:50%; background:var(--accent); color:var(--on-accent); display:inline-flex; align-items:center; justify-content:center`. 18×18 phone SVG, `stroke-width:1.8`. **No hover class.**
   - `<button type="button" aria-label="Menu">` — `width:44px; height:44px; background:transparent; border:0; color:var(--on-photo, #F4F4F5); display:inline-flex; align-items:center; justify-content:center; cursor:pointer`. 22×22 three-bar SVG, `stroke-width:1.6; stroke-linecap:round`. **No hover class, and no drawer markup exists in the export** — AMBIGUOUS: the mobile menu's contents are not specified by this file.

---

### 2.3 `finder`

**Desktop** (lines 126–147). Panel: `position:relative; margin:-120px 48px 0; z-index:2; background:var(--surface); border:1px solid var(--border-strong); padding:32px; display:flex; flex-direction:column; gap:16px`. Row: `display:grid; grid-template-columns:1fr 1.2fr 1.2fr 300px; gap:16px; align-items:end`.

Three identical field groups (`display:flex; flex-direction:column; gap:8px`), in DOM order `Year` / `Make` / `Model`:
- Label `<span>` — `font:500 11px/1 var(--font-body); letter-spacing:.12em; text-transform:uppercase; color:var(--text-dim)`. Copy: `Year`, `Make`, `Model`.
- Control `<div>` — `height:56px; background:var(--surface-2); border:1px solid var(--border-strong); border-radius:var(--radius-ctl); display:flex; align-items:center; justify-content:space-between; padding:0 16px`. Contains value `<span style="font:700 17px/1 var(--font-body);color:var(--text)">` and a 16×16 chevron SVG (`stroke:var(--text-muted); stroke-width:1.6; path d="M6 9l6 6 6-6"`).
- Values: `2021`, `Honda`, `Civic`. These are **not** `<select>` elements — they are static divs.

CTA `<a href="#" class="x2">` (line 144) — `display:inline-flex; align-items:center; justify-content:center; gap:12px; height:56px; background:var(--accent); color:var(--on-accent); border-radius:var(--radius-ctl); font:500 14px/1 var(--font-body); letter-spacing:.08em; text-transform:uppercase; text-decoration:none`. Copy: `Find my tires ` + `<span aria-hidden="true">→</span>`.
- **Hover `.x2`:** `background:var(--accent-hover) !important` (→ `#DDFF6B`).

**Mobile** (lines 100–109). Panel: `margin:-72px 16px 0; padding:20px; gap:12px`. Field groups `gap:6px`; control `height:52px; padding:0 14px`; value `font:700 16px/1 var(--font-body)` — **no explicit `color`**, inherits `var(--text)` from `body`. CTA `height:52px; margin-top:4px`, same fill/type as desktop, **no hover class**.

---

### 2.4 `category-tiles`

**Desktop** (lines 148–155). Section `padding:120px 48px 0; display:flex; flex-direction:column; gap:40px`.

1. Header row `display:flex; align-items:flex-end; justify-content:space-between`:
   - Eyebrow `<span>` — `font:500 12px/1 var(--font-body); letter-spacing:.14em; text-transform:uppercase; color:var(--text-dim)`. Copy: `01 — Shop by category` (em dash).
   - `<h2>` — `margin:0; font:var(--display-weight) calc(56px * var(--scale-h2))/var(--display-leading) var(--font-display); letter-spacing:var(--display-tracking); text-transform:var(--display-transform)`. Copy: `Everything between you and the road.`
2. Grid `grid-template-columns:2fr 1fr; grid-template-rows:320px 320px; gap:16px`. Each tile is `<a href="#">` with `position:relative; overflow:hidden; display:block; text-decoration:none; color:var(--on-photo); border:1px solid var(--border)`, containing image + scrim + a caption stack at `left:32px; bottom:32px; gap:12px`.

| Tile | Image | Fit | Scrim | Label size | Sub-label |
|---|---|---|---|---|---|
| Tires (`grid-row:1/3`, COMPUTED 885.333×656) | `assets/products/zeta-antarctica-sport.png`, `alt=""` | `object-fit:contain; object-position:70% 30%; padding:6%; box-sizing:border-box` | `to top, var(--bg) 0%, var(--scrim-mid) 30%, transparent 70%` | 88px | `Browse →` |
| Wheels (COMPUTED 442.666×320) | `assets/products/spec1-sp51.png`, `alt=""` | `object-fit:contain; padding:6%` (no object-position) | `to top, var(--bg) 0%, var(--scrim-mid) 35%, transparent 75%` | 56px | `Browse →` |
| Accessories (COMPUTED 442.666×320) | `assets/photos/accessories.png`, `alt=""` | `object-fit:cover` (no padding) | same as Wheels | 56px | `Browse →` |

Tile label `<span>`: `font:var(--display-weight) calc(<88|56>px * var(--scale-h2))/var(--display-leading) var(--font-display); letter-spacing:var(--display-tracking); text-transform:var(--display-transform)` (colour inherited: `var(--on-photo)`).
Tile sub-label `<span>`: `font:500 14px/1 var(--font-body); letter-spacing:.08em; text-transform:uppercase; color:var(--on-photo); opacity:.75`. Copy verbatim `Browse →` (space + U+2192).
Copy: `Tires`, `Wheels`, `Accessories`.

**Interactive states: none.** No tile carries an `xN` class on either artboard, so the global `a:hover{color:var(--text-muted)}` is the only effect, and each tile's inline `color:var(--on-photo)` does **not** override a `:hover` rule — so tile text does shift to `#A7A7AE` on hover. Flagging as likely unintended.

**Mobile** (lines 110–118). Section `padding:56px 16px 0; gap:20px`. Eyebrow `font:500 11px/1 ...; letter-spacing:.14em`; h2 at 40px. Tiles stacked `flex-direction:column; gap:12px`, heights `300px` / `200px` / `200px`, caption at `left:20px; bottom:20px; gap:8px`, labels `56px` / `40px` / `40px`, sub-label `font:500 13px/1`. All three scrims use the `35% / 75%` stops.

---

### 2.5 `winter-promo`

**Desktop** (lines 157–169). Wrapper `margin-top:120px; display:grid; grid-template-columns:7fr 5fr; min-height:640px`.

1. Photo cell `position:relative; overflow:hidden`. `<img src="assets/photos/winter-tacoma.png" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`. COMPUTED box 840×640. Overlay `position:absolute;inset:0;background:linear-gradient(to right,transparent 60%,var(--accent-subtle) 100%)`.
2. Copy cell `background:var(--accent-subtle); padding:80px 64px; display:flex; flex-direction:column; justify-content:center; gap:24px; align-items:flex-start`. COMPUTED box 600×640.
   - Eyebrow `<span>` — `font:500 12px/1 var(--font-body); letter-spacing:.16em; text-transform:uppercase; color:var(--accent)`. Copy: `Winter 2026`
   - `<h2>` — `margin:0; font:var(--display-weight) calc(88px * var(--scale-h2))/var(--display-leading) var(--font-display); letter-spacing:var(--display-tracking); text-transform:var(--display-transform); text-wrap:balance`. Copy: `Book your winter set before the first snow.`
   - `<p>` — `margin:0; font:400 17px/1.5 var(--font-body); color:var(--text-muted); max-width:440px`. Copy verbatim: `Ontario roads sit below 7 °C from November to March. All-seasons harden and lose grip — a proper winter compound doesn't.` (note the space before `°C`, the em dash, and the typographic apostrophe U+2019 in `doesn't`).
   - Chip row `display:flex; gap:8px`:
     - `3PMSF` chip — `display:inline-flex; align-items:center; gap:8px; height:36px; padding:0 14px; border:1px solid var(--text-muted); color:var(--text); font:500 12px/1 var(--font-body); letter-spacing:.1em; text-transform:uppercase`. No radius (so 0). 16×16 snowflake-over-mountain SVG, `stroke-width:1.5`, inner path `stroke-width:1.2`.
     - `M+S` chip — same box without the icon or `gap`.
   - CTA `<a href="#" class="x3">` (line 167) — `display:inline-flex; align-items:center; justify-content:center; height:56px; padding:0 28px; background:var(--accent); color:var(--on-accent); border-radius:var(--radius-ctl); font:500 14px/1 var(--font-body); letter-spacing:.08em; text-transform:uppercase; text-decoration:none; margin-top:8px`. Copy: `Shop winter tires`.
     - **Hover `.x3`:** `background:var(--accent-hover) !important`.

**Mobile** (lines 119–128). Wrapper `margin-top:56px`. Photo block `position:relative; height:280px; overflow:hidden`, same src/`object-fit:cover`, overlay `linear-gradient(to top,var(--accent-subtle) 0%,rgba(13,2,2,0) 50%)` — **`rgba(13,2,2,0)` is a hard-coded near-black-red literal, not a token; the only non-token colour on the mobile artboard.** Copy cell `background:var(--accent-subtle); padding:8px 16px 48px; gap:16px`. Eyebrow 11px/.16em. H2 at 48px, no `text-wrap:balance`. Paragraph `font:400 15px/1.5`, no max-width, and the copy differs: `Ontario roads sit below 7 °C from November to March. All-seasons harden and lose grip — a winter compound doesn't.` (**"a proper winter compound" on desktop, "a winter compound" on mobile**). Chips `padding:0 12px` and **omit `color:var(--text)`**. CTA `height:52px; padding:0 24px; width:100%; box-sizing:border-box`, **no `margin-top`, no hover class**.

---

### 2.6 `how-it-works`

**Desktop** (lines 171–184). Section `padding:120px 48px 0; display:flex; flex-direction:column; gap:40px`.
- Eyebrow `<span>` — `font:500 12px/1 var(--font-body); letter-spacing:.14em; text-transform:uppercase; color:var(--text-dim)`. Copy: `02 — How it works`
- Grid `display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); border-top:1px solid var(--border-strong)`.
- Each of four cells: `padding:32px 24px 0 0; border-right:1px solid var(--border); margin-right:24px; display:flex; flex-direction:column; gap:20px`.
  - Numeral `<span>` — `font:var(--display-weight) calc(56px * var(--scale-h2))/1 var(--font-display); color:var(--text-dim); font-variant-numeric:tabular-nums`. **No `letter-spacing`, no `text-transform`.**
  - Title `<span>` — `font:var(--display-weight) calc(28px * var(--scale-h3))/var(--display-leading) var(--font-display); letter-spacing:var(--display-tracking); text-transform:var(--display-transform)`.
  - Body `<span>` — `font:400 15px/1.5 var(--font-body); color:var(--text-muted)`.

| # | Title (verbatim) | Body (verbatim) |
|---|---|---|
| `01` | `Search your vehicle` | `Year, make, model. No tire codes to decipher.` |
| `02` | `Pick a match, send an inquiry` | `Best matches first, similar sizes below. Choose one and tell us how many.` |
| `03` | `We confirm fitment & send a quote` (source `&amp;`) | `A person checks your exact trim and stock, then emails a firm price.` |
| `04` | `Pay via secure link, collect from us` | `No payment on this site. Pay the quote, then pick up or book install.` |

Note: `border-right` and `margin-right:24px` are applied to **all four** cells including the last, leaving a trailing vertical hairline and a 24px right gap at the grid's right edge.

**Mobile** (lines 129–134). Section `padding:56px 16px 0; gap:20px`. Eyebrow at 11px. Wrapper `border-top:1px solid var(--border-strong)`. Each row `display:grid; grid-template-columns:56px 1fr; gap:12px; padding:20px 0; border-bottom:1px solid var(--border)`. Numeral `font:var(--display-weight) calc(40px * var(--scale-h2))/1 var(--font-display); color:var(--text-dim)` — **`font-variant-numeric:tabular-nums` is dropped**. Text stack `gap:6px`; title `calc(24px * var(--scale-h3))/var(--display-leading)` with `text-transform:uppercase` but **no `letter-spacing`**; body `font:400 14px/1.5 var(--font-body); color:var(--text-muted)`. Copy identical to desktop.

**Interactive states: none.**

---

### 2.7 `featured-tires`

**Desktop** (lines 186–341). Section `padding:120px 48px 0; display:flex; flex-direction:column; gap:40px`.

Header row `display:flex; align-items:flex-end; justify-content:space-between`:
- Left stack `display:flex; flex-direction:column; gap:16px` — eyebrow `font:500 12px/1 var(--font-body); letter-spacing:.14em; text-transform:uppercase; color:var(--text-dim)`, copy `03 — Featured tires`; `<h2>` at `calc(56px * var(--scale-h2))`, copy `Winter sets, in stock now.`
- Right cluster `display:flex; gap:8px` — two `<span>` (not buttons):
  - Prev: `width:48px; height:48px; border:1px solid var(--border-strong); display:inline-flex; align-items:center; justify-content:center; color:var(--text-dim)`, 18×18 chevron-left SVG `stroke-width:1.5`.
  - Next: `width:48px; height:48px; border:1px solid var(--text); ... color:var(--text)`, 18×18 chevron-right SVG.
  - No `xN` class on either, no radius, no `aria-label`.

Grid `display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px`.

**Product card, desktop** (shared shell; classes `x4`/`x6`/`x8`/`x10` at lines 190/228/266/302):
`background:var(--surface); border:1px solid var(--border); transform:none; transition:border-color 150ms cubic-bezier(.2,0,0,1),transform 150ms cubic-bezier(.2,0,0,1); display:flex; flex-direction:column; position:relative; font-family:var(--font-body); color:var(--text); height:100%`. No radius, no shadow.
- **Hover `.x4/.x6/.x8/.x10`:** `border-color:var(--accent-hover) !important; transform:translateY(-2px) !important` — 2px lift and border → `#DDFF6B`.

Card DOM order:
1. Image well `<div>` — `position:relative; aspect-ratio:1/1; background:var(--bg); overflow:hidden`. COMPUTED 324×324.
   - `<img>` — `width:100%; height:100%; object-fit:contain; padding:6%; box-sizing:border-box; display:block; opacity:1`.
   - Vignette `<div>` — `position:absolute; inset:0; background:radial-gradient(ellipse at center, transparent 50%, var(--scrim-mid) 100%)`.
   - Badge rail `<div>` — `position:absolute; top:16px; left:16px; right:16px; display:flex; gap:6px; flex-wrap:wrap`.
     - WINTER badge — `height:24px; padding:0 10px; background:var(--accent); color:var(--on-accent); font:500 11px/24px var(--font-body); letter-spacing:.1em; text-transform:uppercase`. Copy: `Winter` (source case is title case; rendered uppercase by `text-transform`).
     - ALL-SEASON badge — `height:24px; padding:0 10px; border:1px solid var(--text-muted); color:var(--text-muted); font:500 11px/22px var(--font-body); letter-spacing:.1em; text-transform:uppercase`. Copy: `All-Season`. **Line-height is 22px here vs 24px on the filled badge** (compensating for the 1px border top+bottom).
   - Brand mark `<span>` — `position:absolute; top:16px; right:16px; font:700 11px/24px var(--font-display); letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted)`.
2. Body `<div>` — `padding:24px; display:flex; flex-direction:column; gap:8px; flex:1`.
   - Brand `<span>` — `font:700 15px/1.1 var(--font-body); color:var(--text)`.
   - Model `<span>` — `font:var(--display-weight) calc(28px * var(--scale-h3))/var(--display-leading) var(--font-display); letter-spacing:var(--display-tracking); text-transform:var(--display-transform); color:var(--text); overflow-wrap:break-word`.
   - Spec row `display:flex; align-items:center; gap:8px; flex-wrap:wrap`:
     - Size `<span>` — `font:700 15px/1.2 var(--font-body); font-variant-numeric:tabular-nums; color:var(--text-muted)`.
     - 3PMSF mark (when present) — `<span title="Three-peak mountain snowflake" style="display:inline-flex;align-items:center;gap:4px;color:var(--text-muted)">`, 16×16 SVG + `<span style="font:500 11px/1 var(--font-body);letter-spacing:.08em">3PMSF</span>`.
   - Price row `display:flex; align-items:baseline; gap:6px; margin-top:4px; flex-wrap:wrap; color:var(--text)`:
     - `from` — `font:500 13px/1 var(--font-body); letter-spacing:.06em; text-transform:uppercase; color:var(--text-muted)`.
     - Price — `font:700 28px/1 var(--font-body); font-variant-numeric:tabular-nums` (colour inherited `var(--text)`).
     - `/ tire` — `font:400 13px/1 var(--font-body); color:var(--text-dim)`.
   - Action row `display:flex; flex-direction:row; gap:8px; margin-top:auto; padding-top:8px`:
     - `<a href="#">` — `flex:1; display:inline-flex; align-items:center; justify-content:center; height:48px; padding:0 20px; background:var(--accent); color:var(--on-accent); border-radius:var(--radius-ctl); font:500 13px/1 var(--font-body); letter-spacing:.04em; text-transform:uppercase; text-decoration:none; min-width:0; text-align:center`. Copy: `Request a quote`.
     - **Hover `.x5/.x7/.x9/.x11`:** `background:var(--accent-hover) !important`.

Card data (identical on both artboards):

| Slot | Image `src` | `alt` | Brand mark | Brand | Model | Size | Badge | 3PMSF | Price | Desktop classes (card / button) | Mobile classes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `assets/products/zeta-antarctica-sport.png` | `Zeta Antarctica Sport` | `Zeta` | `Zeta` | `Antarctica Sport` | `215/55R16 · 97T XL` | `Winter` (filled) | yes | `$129 CAD` | x4 / x5 | x38 / x39 |
| 2 | `assets/products/zmax-winterhawk.png` | `ZMAX Winterhawk` | `ZMAX` | `ZMAX` | `Winterhawk` | `215/55R16 · 97T XL` | `Winter` (filled) | yes | `$119 CAD` | x6 / x7 | x40 / x41 |
| 3 | `assets/products/zmax-landgema.png` | `ZMAX Landgema` | `ZMAX` | `ZMAX` | `Landgema` | `215/55R16 · 97V XL` | `All-Season` (outline) | no | `$99 CAD` | x8 / x9 | x42 / x43 |
| 4 | `assets/products/mazzini-snowleopard.png` | `Mazzini Snowleopard` | `Mazzini` | `Mazzini` | `Snowleopard` | `215/55R16 · 97T XL` | `Winter` (filled) | yes | `$115 CAD` | x10 / x11 | x44 / x45 |

Size separator is U+00B7 (`·`) with spaces. Price strings include the literal ` CAD` suffix and no cents.

**Mobile** (lines 135–305). Section `padding:56px 0 0 16px; gap:20px; overflow:hidden`. Header row `padding-right:16px; gap:16px`; left stack `gap:12px`; eyebrow 11px; h2 at 40px; right affordance is one `<span aria-label="Next">` — `width:44px; height:44px; flex:none; border:1px solid var(--border-strong); border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:var(--text)`, 18×18 arrow-right SVG `stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round`.

Track `display:grid; grid-template-columns:repeat(4,260px); gap:12px` inside `<div style="position:relative">`. Right fade `position:absolute; top:0; bottom:0; right:0; width:72px; background:linear-gradient(to right,transparent,var(--bg)); pointer-events:none`. Progress bars `display:flex; gap:6px; padding-top:4px` — `28×3 var(--accent)` then three `12×3 var(--border-strong)`.

Mobile card deltas from desktop: badge rail inset `top:10px; left:10px; right:10px`; brand mark `top:10px; right:10px`; body `padding:14px`; brand `font:700 12px/1.1`; model `calc(24px * var(--scale-h3))`; size `font:700 14px/1.2`; `from` `font:500 12px/1`; price `font:700 24px/1`; `/ tire` `font:400 12px/1`; button `height:44px; font:500 12px/1`. Everything else (fills, borders, transition, gaps, badge metrics, 3PMSF mark) is byte-identical.

---

### 2.8 `brand-strip`

**Desktop** (lines 343–345). `margin-top:120px; background:var(--surface-2); border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:40px 48px; display:grid; grid-template-columns:repeat(8,minmax(0,1fr)); align-items:center`. **No `gap`.**
Each item `<span>` — `font:var(--display-weight) calc(26px * var(--scale-h3))/1 var(--font-display); letter-spacing:.02em; text-transform:uppercase; color:var(--text-dim); text-align:center`, classes `x12`–`x23` in order.
- **Hover `.x12`–`.x23`:** `color:var(--text) !important` (`#8B909A` → `#F4F4F5`).

Copy in DOM order (12 items, identical on both artboards):
`Zeta`, `ZMAX`, `Mazzini`, `Touren`, `Spec-1`, `Michelin`, `Bridgestone`, `Continental`, `Pirelli`, `Goodyear`, `Hankook`, `Toyo`

**Mobile** (lines 306–308). `margin-top:56px; background:var(--surface-2); border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:20px 16px; display:flex; gap:28px; align-items:center; overflow:hidden`. Each `<span>` — `font:var(--display-weight) calc(20px * var(--scale-h3))/1 var(--font-display); letter-spacing:.02em; text-transform:uppercase; color:var(--text-dim); white-space:nowrap; flex:none`. **No `text-align`, no class, no hover.** The row is clipped — only the first few brands are visible at 390px.

---

### 2.9 `contact`

**Desktop** (lines 347–379). Section `padding:120px 48px; display:grid; grid-template-columns:5fr 7fr; gap:48px; align-items:stretch`.

Left column `display:flex; flex-direction:column; gap:32px`:
1. Eyebrow — `font:500 12px/1 var(--font-body); letter-spacing:.14em; text-transform:uppercase; color:var(--text-dim)`. Copy: `04 — Contact`
2. `<h2>` — `calc(56px * var(--scale-h2))/var(--display-leading)`, `letter-spacing:var(--display-tracking)`, uppercase. Copy: `Platinum Wheels`
3. `<p>` — `margin:0; font:400 17px/1.5 var(--font-body); color:var(--text-muted); max-width:420px`. Copy: `Wheels, tires & accessories in Brampton, ON` (source `&amp;`)
4. Hours block `display:flex; flex-direction:column; gap:6px`:
   - Label — `font:500 11px/1 var(--font-body); letter-spacing:.12em; text-transform:uppercase; color:var(--text-dim)`. Copy: `Phone & inquiry hours`
   - Value — `font:700 17px/1.4 var(--font-body); font-variant-numeric:tabular-nums`. Copy: `Every day: 9 am – 8 pm` (en dash U+2013)
5. Email block `gap:6px`:
   - Label — same label style. Copy: `Email`
   - `<a href="mailto:sales@platinumwheels.ca">` — `font:400 17px/1.5 var(--font-body); color:var(--text-muted); text-decoration:underline; text-underline-offset:3px`. Copy: `sales@platinumwheels.ca`. No `xN` class; inherits the global `a:hover` → `var(--text-muted)` (no visible change).

Right column `display:grid; grid-template-columns:1fr 1fr; gap:16px; align-content:start`:
- Two contact cards — `background:var(--surface); border:1px solid var(--border-strong); padding:32px; display:flex; flex-direction:column; gap:20px; align-items:flex-start`. COMPUTED 370px wide.
  - Name `<span>` — `font:var(--display-weight) calc(40px * var(--scale-h2))/var(--display-leading) var(--font-display); letter-spacing:var(--display-tracking); text-transform:var(--display-transform)`. Copy: `Inderpal Singh`, `Harman Singh`.
  - Phone `<a>` — `display:inline-flex; align-items:center; gap:12px; height:56px; padding:0 20px; border:1px solid var(--accent); color:var(--text); border-radius:var(--radius-ctl); font:700 18px/1 var(--font-body); font-variant-numeric:tabular-nums; text-decoration:none; margin-top:auto`. 18×18 phone SVG `stroke-width:1.6`. `href="tel:+16479896178"` → `647-989-6178` (class `x24`, line 365); `href="tel:+13659980990"` → `365-998-0990` (class `x25`, line 370).
  - **Hover `.x24`/`.x25`:** `background:var(--accent) !important; color:var(--on-accent) !important`.
- Photo panel `grid-column:1/3; position:relative; border:1px solid var(--border); overflow:hidden; height:280px`. `<img src="assets/photos/winter-tacoma.png" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block">`. Overlay `linear-gradient(to top,var(--scrim-strong) 0%,transparent 65%)`. Caption `<span style="position:absolute;left:24px;bottom:24px;font:500 15px/1.4 var(--font-body);color:var(--on-photo)">Call or text. We answer.</span>`.

**Mobile** (lines 309–334). Section `padding:56px 16px 0; display:flex; flex-direction:column; gap:24px`. DOM order: eyebrow (11px) → h2 (40px) → `<p style="font:400 15px/1.5 ...">` (no max-width) → cards wrapper (`display:flex; flex-direction:column; gap:12px`) → hours block → email block.
- Card — `padding:20px; gap:14px`. Name at `calc(28px * var(--scale-h3))`. Phone `<a>` — `display:flex; align-items:center; justify-content:center; gap:10px; height:52px; width:100%; box-sizing:border-box; border:1px solid var(--accent); color:var(--text); border-radius:var(--radius-ctl); font:700 17px/1 var(--font-body); font-variant-numeric:tabular-nums; text-decoration:none`. **No `xN` class → no hover on mobile.**
- Hours block adds `border-top:1px solid var(--border-strong); padding-top:16px`. Its label and the Email label are `font:500 10px/1 var(--font-body); letter-spacing:.12em` (**10px, vs 11px on desktop**). Hours value `font:700 16px/1.4`. Email link `font:400 16px/1.5`.
- **The photo panel and the string `Call or text. We answer.` are absent from the mobile artboard.**

---

### 2.10 `footer`

**Desktop** (lines 381–433). `<footer style="background:var(--bg);border-top:1px solid var(--border-strong);padding:80px 48px 40px;font-family:var(--font-body);color:var(--text);box-sizing:border-box;width:100%">`.

1. Top `display:grid; grid-template-columns:1.2fr 1fr; gap:24px`
   - Left `display:flex; flex-direction:column; gap:16px; align-items:flex-start`:
     - `<img src="assets/logo/platinum-wheels-logo-transparent.png" alt="Platinum Wheels" style="height:120px;width:auto;display:block">`
     - Social row `display:flex; gap:8px; margin-top:8px`. Three `<a href="#">` — `width:40px; height:40px; border:1px solid var(--border-strong); display:inline-flex; align-items:center; justify-content:center; color:var(--text-muted); text-decoration:none`. `aria-label` values `Instagram` (x26), `Facebook` (x27), `Google Business` (x28). All 18×18 SVG `stroke-width:1.5`; the Instagram glyph uses `<rect ... rx="4">`.
     - **Hover `.x26`/`.x27`/`.x28`:** `color:var(--text) !important; border-color:var(--text) !important`.
   - Right `display:grid; grid-template-columns:1fr 1fr 1fr; gap:24px`. Three columns, each `display:flex; flex-direction:column; gap:12px`:
     - Heading `<span>` — `font:500 11px/1 var(--font-body); letter-spacing:.12em; text-transform:uppercase; color:var(--text-dim)`
     - Links `<a href="#">` — `font:400 15px/1.3 var(--font-body); color:var(--text-muted); text-decoration:none; padding:4px 0`
     - **Hover `.x29`–`.x37`:** `color:var(--text) !important`

| Column heading | Links (verbatim, in order) | Desktop classes | Mobile classes |
|---|---|---|---|
| `Shop` | `Tires`, `Wheels`, `Accessories`, `Winter 2026` | x29–x32 | x49–x52 |
| `Company` | `About the shop`, `How it works`, `Contact` | x33–x35 | x53–x55 |
| `Legal` | `Privacy Policy`, `Terms & Conditions` (source `&amp;`) | x36, x37 | x56, x57 |

2. Bottom bar `margin-top:48px; padding-top:24px; border-top:1px solid var(--border); display:flex; justify-content:space-between; flex-wrap:wrap; gap:12px`. Two `<span>`, both `font:400 13px/1.4 var(--font-body); color:var(--text-dim)`:
   - `© 2026 Platinum Wheels and Tire Solutions Inc.`
   - `Brampton, Ontario · Prices in CAD, before tax`

**Mobile** (lines 335–388). Wrapper `<div style="margin-top:56px">`. Footer `padding:56px 16px 120px`. Top `grid-template-columns:1fr; gap:40px`. Link block `grid-template-columns:1fr 1fr; gap:40px` (three children → 2 + 1 wrap). Logo still `height:120px`. Everything else — social squares, heading/link type, bottom bar — is identical to desktop.

---

## 3. Value inventory

### 3.1 Colours

All token definitions are in the `:root` block, **identical in both files, lines 11–40**.

| Value | Token | Where used |
|---|---|---|
| `#0B0B0D` | `--bg` | `html,body` background; screen root background; hero/category/product-card image wells (`background:var(--bg)`); category + hero scrim gradient stops; mobile carousel right-fade endpoint; footer background. Desktop 10 refs, mobile 11. |
| `#16161A` | `--surface` | Finder panel fill; product card fill; contact cards. 7 refs each file. |
| `#1F1F24` | `--surface-2` | Finder control (select) fill; brand-strip band fill. 4 refs each file. |
| `#1F1F24` | `--border` | Nav bottom hairline; category tile borders; product card border; how-it-works cell rules (desktop `border-right` / mobile `border-bottom`); brand-strip top+bottom hairlines; contact photo panel border; footer bottom-bar top rule. **Same hex as `--surface-2`.** Desktop 16, mobile 15. |
| `#35353B` | `--border-strong` | Finder panel border; finder control borders; how-it-works grid `border-top`; featured "prev" arrow border; contact card borders; footer `border-top`; footer social squares; mobile "Next" circle; mobile carousel inactive progress bars; mobile hours-block `border-top`. Desktop 12, mobile 16. |
| `#F4F4F5` | `--text` | Body default colour; finder value text; chip text (desktop); product card brand + model + price; brand-strip hover; featured "next" arrow border+fill; contact phone link text; card hover targets. Desktop 26, mobile 20. |
| `#F4F4F5` | literal `#F4F4F5` | Fallback inside `var(--on-photo, #F4F4F5)` on the nav bar, logo link and (desktop) nav items / (mobile) hamburger. Desktop 4 occurrences, mobile 3. **Redundant — `--on-photo` is always defined.** |
| `#A7A7AE` | `--text-muted` | All body copy; card size numerals; `from` label; brand mark in card; ALL-SEASON badge border+text; 3PMSF marks; winter chips' border; footer links; email link; SVG chevron strokes; global `a:hover`. 41 refs in both files. |
| `#8B909A` | `--text-dim` | Section eyebrows; field labels; how-it-works numerals; brand-strip wordmarks; `/ tire`; footer column headings; footer bottom-bar text; featured "prev" arrow. Desktop 35, mobile 34. |
| `#C9F23A` | `--accent` | Hero eyebrow text; winter eyebrow text; nav active underline (`2px solid`); nav phone-CTA border; "Find my tires" fill; "Shop winter tires" fill; WINTER badge fill; card "Request a quote" fill; contact phone-link borders; mobile nav call circle fill; mobile active progress bar. 15 refs in both files. |
| `#DDFF6B` | `--accent-hover` | **Only inside the `<style>` hover rules** — `.x2/.x3/.x5/.x7/.x9/.x11` (`background`) and `.x4/.x6/.x8/.x10` (`border-color`) desktop; `.x38–.x45` mobile. 0 inline references. |
| `rgba(201,242,58,0.12)` | `--accent-subtle` | Winter-promo copy panel fill and the winter photo's edge wash. 2 refs in both files. Over `--bg` this composites to approximately `#242B18` (COMPUTED, not declared). |
| `#0B0B0D` | `--on-accent` | Text/icon colour on every accent fill: finder CTA, winter CTA, WINTER badge, card quote buttons, mobile call circle, and the `.x1/.x24/.x25` hover text. Desktop 9, mobile 10. |
| `#F4F4F5` | `--on-photo` | Nav text/logo colour; hero headline + subhead; category tile text; contact photo caption. Desktop 13, mobile 11. |
| `#8FC9F2` | `--winter` | **Declared, never used** in either file. |
| `#D9C29A` | `--all-season` | **Declared, never used** in either file. |
| `#050505` | `--canvas-bg` | **Declared, never used** in either file. |
| `rgba(11,11,13,.92)` | `--scrim-strong` | Nav bar background; hero scrim stop; desktop contact photo overlay. Desktop 3, mobile 2. |
| `rgba(11,11,13,.68)` | `--scrim-mid` | Category tile scrims; product-card radial vignette; mobile hero scrim. Desktop 7, mobile 8. |
| `rgba(11,11,13,.38)` | `--scrim-soft` | Hero scrim upper stops. Desktop 2, mobile 1. |
| `rgba(244,244,245,.68)` | literal | Desktop only, 3 occurrences (lines 104, 106, 108) — inactive nav link colour. **No token exists for it.** |
| `rgba(13,2,2,0)` | literal | Mobile only, 1 occurrence (line 120) — transparent stop in the winter photo overlay. **Not a token; the RGB channel is a red residue (13,2,2) that is invisible at alpha 0 but will banding-shift if the alpha is ever raised.** |
| `transparent` | keyword | Category tile scrim end stops; nav inactive `border-bottom:2px solid transparent`; card vignette inner stop; mobile hamburger background; mobile carousel fade start; desktop winter wash start; desktop contact photo overlay end. |

Gradients (no token):
- Desktop hero: `linear-gradient(to top,var(--bg) 0%,var(--scrim-strong) 22%,var(--scrim-soft) 55%,var(--scrim-soft) 100%)`
- Mobile hero: `linear-gradient(to top,var(--bg) 0%,var(--scrim-strong) 28%,var(--scrim-mid) 60%,var(--scrim-soft) 100%)`
- Category tile (tall, desktop): `linear-gradient(to top,var(--bg) 0%,var(--scrim-mid) 30%,transparent 70%)`
- Category tile (others, both files): `linear-gradient(to top,var(--bg) 0%,var(--scrim-mid) 35%,transparent 75%)`
- Winter photo (desktop): `linear-gradient(to right,transparent 60%,var(--accent-subtle) 100%)`
- Winter photo (mobile): `linear-gradient(to top,var(--accent-subtle) 0%,rgba(13,2,2,0) 50%)`
- Product card vignette: `radial-gradient(ellipse at center, transparent 50%, var(--scrim-mid) 100%)`
- Contact photo (desktop): `linear-gradient(to top,var(--scrim-strong) 0%,transparent 65%)`
- Carousel fade (mobile): `linear-gradient(to right,transparent,var(--bg))`

### 3.2 Type

`--font-display` = `'Barlow Condensed',sans-serif`; `--font-body` = `'Barlow',sans-serif`. Display weight is always 700 (`--display-weight`); display leading 0.92 (`--display-leading`); display tracking −0.015em (`--display-tracking`); display transform uppercase.

**Display family (Barlow Condensed 700)**

| Size | Line-height | Tracking | Transform | Role | Artboard / count |
|---|---|---|---|---|---|
| 120px | 0.92 | −0.015em | uppercase | Hero H1 | Desktop ×1 (uses `--scale-hero`) |
| 88px | 0.92 | −0.015em | uppercase | Tall category tile label; winter-promo H2 | Desktop ×2 |
| 56px | 0.92 | −0.015em | uppercase | Section H2 ×3 (`Everything…`, `Winter sets…`, `Platinum Wheels`) + small category tile labels ×2 | Desktop ×5 |
| 56px | **1** | none | none | How-it-works step numerals, `font-variant-numeric:tabular-nums` | Desktop ×4 |
| 56px | 0.92 | −0.015em | uppercase | Hero H1 (via `--scale-h2`); tall category tile label | Mobile ×2 |
| 48px | 0.92 | −0.015em | uppercase | Winter-promo H2 | Mobile ×1 |
| 40px | 0.92 | −0.015em | uppercase | Contact card names (`Inderpal Singh`, `Harman Singh`) | Desktop ×2 |
| 40px | 0.92 | −0.015em | uppercase | Section H2 ×3 + small category tile labels ×2 | Mobile ×5 |
| 40px | **1** | none | none | How-it-works numerals — **no `tabular-nums`** | Mobile ×4 |
| 28px | 0.92 | −0.015em | uppercase | Product card model name; how-it-works step title | Desktop ×8 |
| 28px | 0.92 | −0.015em | uppercase | Contact card names | Mobile ×2 |
| 26px | **1** | **+0.02em** | uppercase | Brand-strip wordmarks | Desktop ×12 |
| 24px | 0.92 | −0.015em | uppercase | Product card model name | Mobile ×4 |
| 24px | 0.92 | **none** | uppercase | How-it-works step title — **tracking omitted** | Mobile ×4 |
| 20px | **1** | **+0.02em** | uppercase | Brand-strip wordmarks | Mobile ×12 |
| 11px | **24px** | +0.08em | uppercase | Product card brand mark (top-right of image well) — display family at label size | Both ×4 |

**Body family (Barlow)**

| Weight / size / LH | Tracking | Transform | Colour | Role | Count |
|---|---|---|---|---|---|
| 400 / 20px / 1.5 | — | — | `--on-photo` @ .82 | Hero subhead | D ×1 |
| 400 / 17px / 1.5 | — | — | `--text-muted` | Winter body; contact paragraph; email link | D ×3 |
| 400 / 16px / 1.5 | — | — | `--on-photo` @ .82 / `--text-muted` | Hero subhead; email link | M ×2 |
| 400 / 15px / 1.5 | — | — | `--text-muted` | How-it-works body (D); winter body + contact paragraph (M) | D ×4, M ×2 |
| 400 / 15px / 1.3 | — | — | `--text-muted` | Footer links (`padding:4px 0`) | Both ×9 |
| 400 / 14px / 1.5 | — | — | `--text-muted` | How-it-works body | M ×4 |
| 400 / 13px / 1 | — | — | `--text-dim` | `/ tire` suffix | D ×4 |
| 400 / 13px / 1.4 | — | — | `--text-dim` | Footer bottom-bar legal lines | Both ×2 |
| 400 / 12px / 1 | — | — | `--text-dim` | `/ tire` suffix | M ×4 |
| 500 / 15px / 1.4 | — | — | `--on-photo` | Contact photo caption | D ×1 |
| 500 / 14px / 1 | +0.08em | uppercase | `--on-accent` / `--on-photo`@.75 | Primary CTAs (finder, winter); category tile `Browse →` | D ×5, M ×2 |
| 500 / 13px / 1 | +0.1em | uppercase | `--on-photo` / `rgba(244,244,245,.68)` | Nav items | D ×4 |
| 500 / 13px / 1 | +0.08em | uppercase | `--on-accent` / `--on-photo`@.75 | Nav phone CTA; category `Browse →` (M) | D, M |
| 500 / 13px / 1 | +0.06em | uppercase | `--text-muted` | Card price `from` label | D ×4 |
| 500 / 13px / 1 | +0.04em | uppercase | `--on-accent` | Card `Request a quote` | D ×4 |
| 500 / 12px / 1 | +0.16em | uppercase | `--accent` | Hero eyebrow; winter eyebrow | D ×2 |
| 500 / 12px / 1 | +0.14em | uppercase | `--text-dim` | Section eyebrows `01 —` … `04 —` | D ×4 |
| 500 / 12px / 1 | +0.1em | uppercase | `--text` / inherited | Winter spec chips `3PMSF`, `M+S` | Both ×2 |
| 500 / 12px / 1 | +0.06em / +0.04em | uppercase | `--text-muted` / `--on-accent` | Card `from` label; card quote button | M ×4 each |
| 500 / 11px / 1 | +0.12em | uppercase | `--text-dim` | Finder field labels; contact block labels (D); footer column headings | Both |
| 500 / 11px / 1 | +0.14em | uppercase | `--text-dim` | Section eyebrows | M ×4 |
| 500 / 11px / 1 | +0.08em | — | `--text-muted` | `3PMSF` mark inside card spec row | Both ×4 |
| 500 / 11px / 1.4 | +0.14em | uppercase | `--accent` | Hero eyebrow | M ×1 |
| 500 / 11px / **24px** | +0.1em | uppercase | `--on-accent` on `--accent` | WINTER badge | Both ×3 |
| 500 / 11px / **22px** | +0.1em | uppercase | `--text-muted`, 1px outline | ALL-SEASON badge | Both ×1 |
| 500 / 11px / 1 | +0.16em | uppercase | `--accent` | Winter eyebrow | M ×1 |
| 500 / 10px / 1 | +0.12em | uppercase | `--text-dim` | Contact block labels | M ×2 |
| 700 / 28px / 1 | — | — | `--text`, tabular | Card price | D ×4 |
| 700 / 24px / 1 | — | — | `--text`, tabular | Card price | M ×4 |
| 700 / 18px / 1 | — | — | `--text`, tabular | Contact card phone number | D ×2 |
| 700 / 17px / 1 | — | — | `--text` | Finder control value | D ×3 |
| 700 / 17px / 1 | — | — | `--text`, tabular | Contact card phone number | M ×2 |
| 700 / 17px / 1.4 | — | — | `--text`, tabular | Opening-hours value | D ×1 |
| 700 / 16px / 1 | — | — | inherited `--text` | Finder control value | M ×3 |
| 700 / 16px / 1.4 | — | — | `--text`, tabular | Opening-hours value | M ×1 |
| 700 / 15px / 1.1 | — | — | `--text` | Card brand name | D ×4 |
| 700 / 15px / 1.2 | — | — | `--text-muted`, tabular | Card size numeral | D ×4 |
| 700 / 14px / 1.2 | — | — | `--text-muted`, tabular | Card size numeral | M ×4 |
| 700 / 12px / 1.1 | — | — | `--text` | Card brand name | M ×4 |

Distinct letter-spacing values in use: `.02em`, `.04em`, `.06em`, `.08em`, `.1em`, `.12em`, `.14em`, `.16em`, and `var(--display-tracking)` (−0.015em). `font-variant-numeric:tabular-nums` appears 15× desktop / 11× mobile.

### 3.3 Spacing and fixed sizes

Flagged values are those **off** DESIGN.md's declared 8 / 16 / 24 / 32 / 48 / 80 / 120 scale (§5, line 204).

**Desktop — padding**

| Value | Where | Off-scale? |
|---|---|---|
| `120px 48px 0` | Category, how-it-works, featured sections | — |
| `120px 48px` | Contact section | — |
| `80px 48px 40px` | Footer | **40 off-scale** |
| `80px 64px` | Winter copy panel | **64 off-scale** |
| `40px 48px` | Brand strip | **40 off-scale** |
| `32px` | Finder panel; contact cards | — |
| `32px 24px 0 0` | How-it-works cells | — |
| `24px` | Product card body | — |
| `0 48px` | Nav bar | — |
| `0 28px` | Winter CTA | **28 off-scale** |
| `0 20px` | Nav phone CTA, card quote buttons, contact phone links | **20 off-scale** |
| `0 16px` | Finder controls | — |
| `0 14px` | Winter spec chips | **14 off-scale** |
| `0 10px` | Badges | **10 off-scale** |
| `4px 0` | Footer links | **4 off-scale** |
| `8px 0` | Nav items | — |
| `6%` | Product image inset (percentage, not px) | **non-scalar** |
| `padding-top:24px` | Footer bottom bar | — |
| `padding-top:8px` | Card action rows | — |

**Desktop — gap:** `4px`, `6px`, `8px`, `10px`, `12px`, `16px`, `20px`, `24px`, `28px`, `32px`, `40px`, `48px`. **Off-scale: 4, 6, 10, 12, 20, 28, 40.**

**Desktop — margin:** `-120px 48px 0` (finder overlap); `margin-top:120px` ×2 (winter promo, brand strip); `margin-top:48px` (footer bottom bar); `margin-top:8px` ×2; `margin-top:4px` ×4 (**off-scale**); `margin-right:24px` ×4 (how-it-works cells); `margin-top:auto` ×6; `margin:0` ×8 (h1/h2/p resets).

**Desktop — fixed height / width**

| Value | Where | Off-scale? |
|---|---|---|
| `height:900px` | Hero | — (but not on the 8-scale) |
| `min-height:640px` | Winter promo | — |
| `grid-template-rows:320px 320px` | Category tiles | — |
| `height:280px` | Contact photo panel | — |
| `height:120px` | Footer logo | — |
| `height:88px` | Nav bar | — |
| `height:64px` | Nav logo | **64 off-scale** |
| `height:56px` ×7 | Finder controls, finder CTA, winter CTA, contact phone links | — |
| `height:48px` ×6 | Card quote buttons ×4, featured arrows ×2 (also `width:48px`) | — |
| `height:44px` | Nav phone CTA | **44 off-scale** |
| `height:40px` / `width:40px` ×3 | Footer social squares | **40 off-scale** |
| `height:36px` ×2 | Winter spec chips | **36 off-scale** |
| `height:24px` ×4 | Badges | — |
| `width:1440px` | Artboard | — |
| `width:300px` | Finder CTA grid column | — |
| `max-width:1100px` / `560px` / `440px` / `420px` | Hero block, hero subhead, winter body, contact paragraph | **all off-scale** |

**Mobile — padding**

| Value | Where | Off-scale? |
|---|---|---|
| `56px 16px 0` | Category, how-it-works, contact sections | **56 off-scale** |
| `56px 0 0 16px` | Featured section (zero right padding) | **56 off-scale** |
| `56px 16px 120px` | Footer | **56 off-scale** |
| `8px 16px 48px` | Winter copy panel | — |
| `20px 16px` | Brand strip | **20 off-scale** |
| `20px` | Finder panel, contact cards | **20 off-scale** |
| `20px 0` | How-it-works rows | **20 off-scale** |
| `14px` | Product card body | **14 off-scale** |
| `0 24px` | Winter CTA | — |
| `0 20px` | Card quote buttons | **20 off-scale** |
| `0 16px` | Nav bar | — |
| `0 14px` | Finder controls | **14 off-scale** |
| `0 12px` | Winter spec chips | **12 off-scale** |
| `0 10px` | Badges | **10 off-scale** |
| `4px 0` | Footer links | **4 off-scale** |
| `6%` | Product image inset | **non-scalar** |
| `padding-top:16px` | Hours block | — |
| `padding-top:8px` | Card action rows | — |
| `padding-top:4px` | Carousel progress row | **4 off-scale** |
| `padding-right:16px` | Featured header row | — |

**Mobile — gap:** `4px`, `6px`, `8px`, `10px`, `12px`, `14px`, `16px`, `20px`, `24px`, `28px`, `40px`. **Off-scale: 4, 6, 10, 12, 14, 20, 28, 40.**

**Mobile — margin:** `-72px 16px 0` (finder overlap, **72 off-scale**); `margin-top:56px` ×3 (**off-scale**); `margin-top:48px` (footer bottom bar); `margin-top:8px`; `margin-top:4px` ×5 (**off-scale**); `margin-top:auto` ×4; `margin:0` ×8.

**Mobile — fixed height / width**

| Value | Where | Off-scale? |
|---|---|---|
| `height:720px` | Hero | — |
| `height:300px` / `200px` ×2 | Category tiles | **300, 200 off-scale** |
| `height:280px` ×1 | Winter photo | — |
| `height:120px` | Footer logo | — |
| `height:68px` | Nav bar | **68 off-scale** |
| `height:52px` ×8 | Nav logo, finder controls ×3, finder CTA, winter CTA, contact phone links ×2 | **52 off-scale** |
| `height:44px` / `width:44px` ×7 | Nav call circle, hamburger, "Next" circle, card quote buttons ×4 | **44 off-scale** |
| `width:40px; height:40px` ×3 | Footer social squares | **40 off-scale** |
| `height:36px` ×2 | Winter spec chips | **36 off-scale** |
| `height:24px` ×4 | Badges | — |
| `height:3px` ×4, `width:28px` ×1, `width:12px` ×3 | Carousel progress bars | **3, 28, 12 off-scale** |
| `width:72px` | Carousel right fade | **72 off-scale** |
| `grid-template-columns:repeat(4,260px)` | Carousel track | **260 off-scale** |
| `grid-template-columns:56px 1fr` ×4 | How-it-works numeral column | **56 off-scale** |
| `width:390px` | Artboard | — |
| `max-width` | **none anywhere on the mobile artboard** | — |

### 3.4 Radius and borders

**Radius**

| Value | Token | Where |
|---|---|---|
| `2px` | `--radius-ctl` | Every control on both artboards: nav phone CTA (D), finder controls ×3, finder CTA, winter CTA, card quote buttons ×4, contact phone links ×2. Desktop 12 refs, mobile 11. |
| `50%` | — | Mobile only, 2 refs: nav call circle (line 84) and featured "Next" circle (line 141). |
| `4px` | — | Inside the Instagram SVG glyph only (`<rect ... rx="4">`), not a layout radius. |
| `0` (implicit) | — | Product cards, contact cards, finder panel, category tiles, badges, winter spec chips, footer social squares, featured arrow squares, brand strip, all images. No `border-radius` declared on any of these. |

**Borders**

| Declaration | Count D / M | Applied to |
|---|---|---|
| `1px solid var(--border)` → `#1F1F24` | 16 / 15 | Nav `border-bottom`; category tiles ×3; product cards ×4; how-it-works cell rules ×4; brand strip `border-top` + `border-bottom`; footer bottom-bar `border-top`; contact photo panel (D only) |
| `1px solid var(--border-strong)` → `#35353B` | 12 / 16 | Finder panel; finder controls ×3; how-it-works `border-top`; featured "prev" arrow (D) / "Next" circle (M); contact cards ×2; footer `border-top`; footer social ×3; mobile hours-block `border-top` |
| `1px solid var(--accent)` → `#C9F23A` | 3 / 2 | Nav phone CTA (D only); contact phone links ×2 |
| `1px solid var(--text-muted)` → `#A7A7AE` | 3 / 3 | Winter spec chips ×2; ALL-SEASON badge ×1 |
| `1px solid var(--text)` → `#F4F4F5` | 1 / 0 | Featured "next" arrow square (D only) |
| `2px solid var(--accent)` | 1 / 0 | Nav active item `border-bottom` (`Tires`) |
| `2px solid transparent` | 3 / 0 | Nav inactive items `border-bottom` (`Wheels`, `Accessories`, `Contact`) |
| `border:0` | 0 / 1 | Mobile hamburger `<button>` |

Only border widths in use: **1px** and **2px**. No `outline`, no `box-shadow`, no `filter`, no `backdrop-filter` anywhere in either file.

**Motion.** One transition declaration, 4× per artboard, on the product card shell only: `transition:border-color 150ms cubic-bezier(.2,0,0,1),transform 150ms cubic-bezier(.2,0,0,1)`. Every other hover (fills, colour swaps) is instant because no transition is declared on those elements.

---

## 4. Conflicts with DESIGN.md

Artboard values are authoritative per the owner's ruling. This table records the disagreements only.

| # | DESIGN.md says | The artboard does | Artboard file + line |
|---|---|---|---|
| 1 | `--bg: #000000` (line 40) | `--bg:#0B0B0D` | desktop:12, mobile:12 |
| 2 | `--bg-alt: #0a0a0a` for alternating bands / input fill (line 41) | **Token does not exist.** Input fill and the brand band both use `--surface-2:#1F1F24` | desktop:14, mobile:14 |
| 3 | `--surface: #141414` (line 42) | `--surface:#16161A` | desktop:13, mobile:13 |
| 4 | `--border: #1f1f1f` (line 43) | `--border:#1F1F24` | desktop:15, mobile:15 |
| 5 | `--rule: #2a2a2a` for hairlines on `--bg` (line 44) | **Token does not exist.** Replaced by `--border-strong:#35353B` | desktop:16, mobile:16 |
| 6 | `--text: #ffffff` (line 47) | `--text:#F4F4F5` | desktop:17, mobile:17 |
| 7 | `--text-muted: #b8b8b8` (line 48) | `--text-muted:#A7A7AE` | desktop:18, mobile:18 |
| 8 | `--text-dim: #6a6a6a` (line 49) | `--text-dim:#8B909A` | desktop:19, mobile:19 |
| 9 | `--accent: #e10600` racing red (line 52) | `--accent:#C9F23A` acid lime | desktop:20, mobile:20 |
| 10 | `--accent-hover: #ff1a12` (line 53) | `--accent-hover:#DDFF6B` | desktop:21, mobile:21 |
| 11 | `--accent-deep: #9e0400` for card-hover border / pressed / diagonal stripe (line 54) | **Token does not exist.** Card hover uses `--accent-hover` (the *brighter* value), inverting the doc's "deep, not bright" rule | desktop:51,53,55,57 (`.x4/.x6/.x8/.x10`) |
| 12 | `--on-accent: #000000` (line 55) | `--on-accent:#0B0B0D` | desktop:23, mobile:23 |
| 13 | No `--on-photo`, `--scrim-*`, `--surface-2`, `--border-strong`, `--winter`, `--all-season`, `--canvas-bg` tokens defined | All seven exist. `--winter:#8FC9F2`, `--all-season:#D9C29A`, `--canvas-bg:#050505` are declared but **never referenced** | desktop:24–26, 36–39 |
| 14 | "yellow… 'sale'… lime 'tech'" explicitly rejected as accent candidates (line 59) | The accent **is** lime | desktop:20 |
| 15 | Nav height **72px desktop, 56px mobile** (line 169) | **88px desktop, 68px mobile** | desktop:95, mobile:77 |
| 16 | Nav is sticky on desktop; "Not transparent over the hero" (line 169) | Nav is `position:absolute` inside the hero, background `var(--scrim-strong)` = `rgba(11,11,13,.92)` — i.e. semi-transparent and overlaid on the hero photo, not sticky | desktop:94–95, mobile:76–77 |
| 17 | Nav left = **wordmark text** `PLATINUM WHEELS`, Barlow Condensed 700 22px, tracking −1%; badge only at 40px once a transparent cut-out exists (lines 15, 170) | Nav left is the **image badge** at `height:64px` (desktop) / `height:52px` (mobile). No text wordmark exists anywhere in either file | desktop:97, mobile:79 |
| 18 | The supplied logo "has a flat white background, no transparency"; "use the wordmark until a transparent cut-out exists" (lines 14, 260) | Both artboards reference `assets/logo/platinum-wheels-logo-transparent.png` — a file that **does exist** on disk (2.5 MB). DESIGN.md's blocker appears already resolved but the doc was not updated | desktop:97, 384; mobile:79, 339 |
| 19 | Footer badge at **120px** (line 15) | Footer logo `height:120px` — **matches** on both artboards (recorded for completeness) | desktop:384, mobile:339 |
| 20 | Utility bar above the nav (36px, address · phone · EN/FR · account) optional (line 171) | **Absent.** No utility bar, no EN/FR toggle, no account link | — (nothing in file) |
| 21 | Right side of nav: search icon, account icon, cart icon with count; 16px black-on-white cart square (line 173) | Desktop right = one phone CTA pill. Mobile right = call circle + hamburger. **No search, account or cart of any kind** | desktop:109–114, mobile:83–91 |
| 22 | Input height **48px**, fill `--bg-alt`, padding `0 16px`, text 16px Barlow 400, label 12px uppercase +10% tracking with 8px gap (line 160) | Desktop: `height:56px`, fill `var(--surface-2)`, padding `0 16px`, value **700 17px**, label **11px** +0.12em, gap 8px. Mobile: `height:52px`, padding `0 14px`, value 700 16px, gap 6px | desktop:131,136,141; mobile:102,104,106 |
| 23 | Container **max content width 1320px, centred, 24px side padding (16px mobile)** (line 203) | **No `max-width` container exists.** Desktop is flush to 1440 with **48px** side padding (content 1344px COMPUTED); mobile 390 with 16px | desktop:95,126,148,347,381; mobile:77,100,110,309,336 |
| 24 | Grid: 12 columns, **24px gutter** (line 203) | Gutters are **16px** (desktop category grid, featured grid, finder row, contact right column) and **12px** (mobile). 24px appears only in the footer top grid and the how-it-works cell `margin-right` | desktop:127,150,188,361,382 |
| 25 | Product grid 4-up at 1320, with defined steps at 1100 / 720 / 400 (lines 213, 267) | 4-up at 1440 with 48px padding; mobile is a fixed 4×260px clipped track, not a 2-up or 1-up grid. **No breakpoints of any kind in the files** | desktop:188, mobile:144 |
| 26 | Section breaks 96–120px desktop, **56px mobile** (line 205) | 120px desktop, 56px mobile — **matches** (recorded for completeness) | desktop:148,157,171,186,343,347; mobile:110,119,129,135,306,309,335 |
| 27 | Button padding `14px 28px`; "Height results, not fixed" (line 144) | Every button has a **fixed height** and zero vertical padding: 56 / 48 / 44 desktop, 52 / 44 mobile | desktop:109,144,167,222; mobile:108,126,178 |
| 28 | Primary button text +0.06em tracking, 14px (line 143) | Finder + winter CTAs are 14px +0.08em; card quote buttons are 13px (D) / 12px (M) +0.04em; nav phone CTA 13px +0.08em | desktop:109,144,167,222 |
| 29 | Card body padding **24px**; card order badge → brand label (11px) → name (28px) → size (Barlow 700 15px) → price (32px) → button (line 153) | Desktop matches padding 24px, name 28px, size 700 15px — but the **brand label is 700 15px, not 11px**, and the **price is 28px, not 32px**. Mobile card padding is 14px, price 24px | desktop:203–218; mobile:159–174 |
| 30 | Card hover: border → `--accent-deep` (the deep red), translateY(−2px), 150ms (line 154) | Border → `--accent-hover` (`#DDFF6B`, the *brightest* accent), translateY(−2px), 150ms `cubic-bezier(.2,0,0,1)` | desktop:51,53,55,57 |
| 31 | "if a WINTER badge is present, the button is ghost. Otherwise primary. Never both accent." (line 155) — the one-accent rule (line 79) | Cards 1, 2 and 4 carry a **filled lime WINTER badge AND a filled lime primary button** in the same frame | desktop:196+222, 234+260, 308+334; mobile:152+178, 190+216, 264+290 |
| 32 | Badge: WINTER fill `--accent`; ALL-SEASON transparent 1px `--text-muted`; both 11px/24px line-height (lines 179–181) | Structure matches but the ALL-SEASON badge uses **`line-height:22px`** while the filled one uses 24px | desktop:272, mobile:228 |
| 33 | Chip: height 36px, padding `0 14px`, radius **2px**, 13px **sentence case** (line 187) | `3PMSF` / `M+S` chips are height 36px, padding `0 14px` (D) / `0 12px` (M), **radius 0**, **12px uppercase +0.1em** | desktop:164–165, mobile:125 |
| 34 | CTAs are "two words max: `ADD TO CART`, `BOOK INSTALL`, `FIND MY SIZE`" (line 124) | CTAs are `Find my tires` (3 words), `Shop winter tires` (3), `Request a quote` (3), `Call 647-989-6178`, `Browse →`. All in title/sentence case in source (uppercased by `text-transform`) | desktop:144,167,222,113,151 |
| 35 | **Cart** model throughout: `ADD TO CART` button on cards (line 153), cart icon with count in nav (line 173), cart rows and quantity steppers (lines 197, 278), buy panel with `ADD TO CART` (line 214) | **Quote model, no cart anywhere.** Card CTA is `Request a quote`; step 02 reads `Pick a match, send an inquiry`; step 04 reads `Pay via secure link, collect from us` with body `No payment on this site. Pay the quote, then pick up or book install.` | desktop:222,178,182; mobile:178, 132 |
| 36 | Price scale 32px in cards; "Currency symbol and cents are the same size… no superscript cents" (line 118) | Price is **28px** desktop / **24px** mobile, and is rendered as `$129 CAD` — a whole-dollar figure with a ` CAD` suffix, no cents at all | desktop:216, mobile:172 |
| 37 | Prices are `--text` white, never red; "same size for a $190 tyre and a $1,900 wheel" (lines 120, 244) | Prices are `var(--text)` `#F4F4F5` — **matches** | desktop:216 |
| 38 | Display scale desktop 40/56/88/120, mobile 32/40/56 (line 97) | Desktop uses 120, 88, 56, 40, **28** and **26**. Mobile uses 56, **48**, 40, **28**, **24** and **20**. 28/26/24/20 and mobile's 48 are not on the doc's scale; the doc's mobile 32 is unused | desktop:206,344; mobile:96,126,132,307 |
| 39 | Body text "stays 16px at every breakpoint; the reading size does not [shrink]" (line 283) | Body shrinks on mobile: how-it-works body 15 → 14; winter body 17 → 15; contact paragraph 17 → 15; hero subhead 20 → 16 | mobile:132,126,311,97 |
| 40 | "Barlow Condensed / Barlow… No third font" (lines 4, 87) | Font link also loads **Michroma** and **Manrope 400/500/700/800**, plus Barlow Condensed **600** — none referenced by any rule | desktop:9, mobile:9 |
| 41 | "All radii 0–4px… Nothing is a pill." (line 130) | Mobile uses `border-radius:50%` twice — the nav call button and the featured "Next" affordance | mobile:84, 141 |
| 42 | "No gradient fills except `--hero-fade`… never applied to cards" (line 232) | Gradients are used on hero (both), all three category tiles, the winter photo, the **product card image well** (`radial-gradient` vignette), the contact photo panel, and the mobile carousel fade | desktop:93,151,152,153,158,193,375; mobile:75,114,115,116,120,149,297 |
| 43 | Focus ring `2px --accent`, no offset (line 75); input focus ring (line 162) | **No `:focus`, `:focus-visible`, `:active` or `:disabled` rule exists in either file.** Only `:hover` | desktop:48–84, mobile:48–68 |
| 44 | Photography: "real photography only — tyre/wheel as sculpture on black… No lifestyle stock" (lines 242, 306) | Hero is a hotlinked Ferrari F40 LM press photo from `vossenwheels.com` — a third-party supercar image, not a tyre or wheel on black | desktop:92, mobile:74 |
| 45 | Services section: numbered `01`–`06` (Installation, Alignment, Balancing, Seasonal changeover, TPMS, Rotation), rows 88px, hairline dividers (line 211) | No services section exists. The numbered block is a **4-step "How it works"** process, not a service list | desktop:171–184, mobile:129–134 |
| 46 | Finder sits in the left 7 columns with an install offer in the right 5; tabs `BY VEHICLE` · `BY SIZE` · `BY SKU`; button `FIND TYRES` (line 209) | Finder is a full-width panel overlapping the hero by −120px, **no tabs**, no install-offer column, button reads `Find my tires` | desktop:126–147 |
| 47 | Brand grid: 6 columns, 32px type (line 210) | **8 columns**, 26px desktop; single clipped flex row at 20px on mobile. 12 brands in 8 columns leaves 4 empty cells on row 2 | desktop:343–344, mobile:306–307 |
| 48 | Spelling "tyre / tyres" throughout DESIGN.md | Artboards use **"tire / tires"** exclusively (`Find my tires`, `/ tire`, `Shop winter tires`, `No tire codes to decipher.`) | desktop:113,144,167,218,178 |
| 49 | Hero `100vw × min(88vh, 900px)`, mobile `100svh` (lines 208, 277) | Fixed pixel heights: 900px desktop, 720px mobile. No viewport units anywhere in either file | desktop:91, mobile:73 |
| 50 | Diagonal `--accent-deep` stripe divider, max twice per page (line 215) | Not present | — |

---

## 5. Assets and data needing replacement

### 5.1 Hotlinked external image — blocking

| Item | Exact value |
|---|---|
| Hero background, both artboards | `https://vossenwheels.com/wp-content/uploads/2025/11/Vossen-Forged-GEN-01-Aerolip-Ferrari-F40-LM-SupercarRon-015-scaled.jpg` |
| Used at | `home-desktop.html:92` (`object-position:center 60%`), `home-mobile.html:74` (`object-position:70% 60%`) |
| `alt` | `""` (empty on both) |

This is the only external request in either file besides Google Fonts. It is a third-party product photo on Vossen Wheels' own CDN, credited in the filename to a photographer (`SupercarRon`). It is hotlinked, not vendored — there is no local copy under `design/assets/`. It needs replacing with owned photography before launch.

### 5.2 Local assets referenced

All of these exist on disk under `design/assets/`:

| Path | Referenced by | Size on disk |
|---|---|---|
| `assets/logo/platinum-wheels-logo-transparent.png` | nav + footer, both artboards (4 refs) | 2,506,640 bytes |
| `assets/photos/accessories.png` | category tile 3, both (2 refs) | 3,473,409 bytes |
| `assets/photos/winter-tacoma.png` | winter promo (both) + desktop contact panel (3 refs) | 4,688,846 bytes |
| `assets/products/zeta-antarctica-sport.png` | category tile 1 + product card 1, both (4 refs) | 824,024 bytes |
| `assets/products/spec1-sp51.png` | category tile 2, both (2 refs) | 3,884,782 bytes |
| `assets/products/zmax-winterhawk.png` | product card 2, both (2 refs) | 593,534 bytes |
| `assets/products/zmax-landgema.png` | product card 3, both (2 refs) | 456,634 bytes |
| `assets/products/mazzini-snowleopard.png` | product card 4, both (2 refs) | 906,711 bytes |

Present on disk but **never referenced by either home artboard**: `assets/logo/platinum-wheels-logo.png` (the white-background original, 2,110,698 bytes), `assets/photos/tires-tile.png`, `assets/photos/wheels-tile.png`, `assets/products/touren-tr76.png`, `assets/products/touren-tr79.png`.

Note: `tires-tile.png` and `wheels-tile.png` exist and are named for the category tiles, but the artboards use `zeta-antarctica-sport.png` and `spec1-sp51.png` (product cut-outs, `object-fit:contain` with 6% padding) for those tiles instead. AMBIGUOUS: whether the tile photos are the intended assets and the artboard substituted product cut-outs, or vice versa, is not decidable from these files.

Every image file is between 0.45 MB and 4.7 MB PNG. Total referenced weight is roughly 17.3 MB; all need compression/format conversion before shipping.

### 5.3 Contact data found in the artboards

These are real-looking, not obviously placeholder, and must be confirmed with the owner before shipping:

| Value | Where |
|---|---|
| `647-989-6178` / `tel:+16479896178` | desktop nav CTA (line 109, 113), desktop contact card "Inderpal Singh" (line 365), mobile nav call circle (line 84), mobile contact card (line 317) |
| `365-998-0990` / `tel:+13659980990` | desktop contact card "Harman Singh" (line 370), mobile contact card (line 322) |
| `sales@platinumwheels.ca` / `mailto:sales@platinumwheels.ca` | desktop line 358, mobile line 332 |
| `Inderpal Singh` | desktop line 364, mobile line 316 |
| `Harman Singh` | desktop line 369, mobile line 321 |
| `Every day: 9 am – 8 pm` | desktop line 354, mobile line 329 |
| `Wheels, tires & accessories in Brampton, ON` | desktop line 351, mobile line 312 |
| `Brampton, Ontario · Prices in CAD, before tax` | desktop line 430, mobile line 385 |
| `© 2026 Platinum Wheels and Tire Solutions Inc.` | desktop line 429, mobile line 384 |

**No street address appears anywhere in either artboard**, despite DESIGN.md §4 specifying a "Brampton address" in the utility bar (line 171). The `Google Business` social link (`aria-label`, desktop line 388 / mobile line 343) has `href="#"`.

### 5.4 Sample / placeholder data

| Item | Exact values | Where |
|---|---|---|
| Vehicle finder pre-fill | `2021` / `Honda` / `Civic` | desktop lines 131, 136, 141; mobile 102, 104, 106. Static `<div>`s, not `<select>`s — the whole finder is non-functional markup. |
| Product catalogue (4 SKUs) | `Zeta Antarctica Sport` `215/55R16 · 97T XL` `$129 CAD`; `ZMAX Winterhawk` `215/55R16 · 97T XL` `$119 CAD`; `ZMAX Landgema` `215/55R16 · 97V XL` `$99 CAD`; `Mazzini Snowleopard` `215/55R16 · 97T XL` `$115 CAD` | desktop 190–338, mobile 146–294. All four share the same size `215/55R16` — consistent with the Civic pre-fill, so this is a staged search result, not a real featured set. |
| Brand strip (12 names) | `Zeta`, `ZMAX`, `Mazzini`, `Touren`, `Spec-1`, `Michelin`, `Bridgestone`, `Continental`, `Pirelli`, `Goodyear`, `Hankook`, `Toyo` | desktop 344, mobile 307. Mixes house/budget brands with major manufacturers — stock authorisation needs confirming per brand. |
| Seasonal campaign label | `Winter 2026` | Winter promo eyebrow (desktop 160, mobile 123) and footer Shop link (desktop 402, mobile 357). Hard-coded year. |
| Copyright year | `2026` | desktop 429, mobile 384. Hard-coded. |
| Every link target | `href="#"` on all nav items, category tiles, CTAs, card quote buttons, social links and footer links. Only `tel:` and `mailto:` hrefs are real. | throughout |
| Copy divergence to resolve | Desktop winter body says `a proper winter compound doesn't`; mobile says `a winter compound doesn't`. | desktop 162, mobile 126 |

### 5.5 Dead tokens and unreferenced font families

Carry forward only if a use is found; otherwise drop.

- `--winter:#8FC9F2` — declared, 0 references.
- `--all-season:#D9C29A` — declared, 0 references. (The ALL-SEASON badge uses `--text-muted` instead.)
- `--canvas-bg:#050505` — declared, 0 references.
- `--accent-hover:#DDFF6B` — 0 *inline* references; used only inside the `<style>` `:hover` rules.
- `--scale-hero` — referenced exactly once (desktop hero H1). The mobile H1 uses `--scale-h2` instead, so `--scale-hero` is dead on the mobile artboard.
- Google Fonts request includes `Michroma` and `Manrope:wght@400;500;700;800` and `Barlow+Condensed:wght@600` — none used.
