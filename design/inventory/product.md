# Product (PDP) — extracted inventory

Sources (read-only, values below are measured from these files verbatim):

- `/Users/raghavvirmani/platinum-wheels/design/assets/product-desktop.html` — 373 lines, `width:1440px`, `<meta name="viewport" content="width=1440, initial-scale=1">`, screen label `03 Product — Desktop`
- `/Users/raghavvirmani/platinum-wheels/design/assets/product-mobile.html` — 335 lines, `width:390px`, `<meta name="viewport" content="width=390, initial-scale=1">`, screen label `03 Product — Mobile`
- `/Users/raghavvirmani/platinum-wheels/design/DESIGN.md` — 323 lines

**Authority note.** Both artboards declare theme "Track Night": ground `--bg:#0B0B0D`, accent `--accent:#C9F23A` (acid lime). DESIGN.md describes "Cinematic Dark": `#000000` + racing red `#e10600`. Per the project owner, the artboards win on colour. Artboard values below are authoritative; DESIGN.md divergences are collected in §6 and are **not** reconciled here.

**AMBIGUOUS — breakpoint.** Neither artboard contains a single `@media` rule. They are two fixed-width static exports (1440 and 390). The pixel width at which desktop layout becomes mobile layout is **not present in the export** and cannot be measured. DESIGN.md §8 names 1320 / 1100 / 720 / 400, but nothing in the artboards confirms those. Every "changes between them" note below describes *what* differs between the two artboards, not *where*.

---

## 1. Section manifest (artboard order, top to bottom)

### 1. `site-header`
- **Purpose:** Fixed-height brand bar: logo, primary nav, phone CTA.
- **Desktop** (`product-desktop.html:77-99`): `height:88px`, `padding:0 48px`, `display:flex; align-items:center; justify-content:space-between`, `background:var(--scrim-strong)` (`rgba(11,11,13,.92)`), `border-bottom:1px solid var(--border)`, `width:100%`. Three children: logo link, `<nav>` (`display:flex; gap:40px`), phone CTA. No max-width, no centred container.
- **Mobile** (`product-mobile.html:74-89`): `height:68px`, `padding:0 16px`, same flex/scrim/border. Two children: logo link, and a `display:flex; gap:8px` cluster holding a 44×44 round accent call button plus a 44×44 transparent hamburger `<button>`.
- **Change:** height 88 → 68; side padding 48 → 16; logo img height 64px → 52px; the 4-item text nav and the bordered "Call 647-989-6178" pill are replaced by an icon-only circular call button + hamburger. Desktop has **no** hamburger; mobile has **no** text nav.
- Not sticky: no `position` declared on the header in either file.

### 2. `breadcrumb`
- **Purpose:** Home / Results / current product trail.
- **Desktop:** does not exist as its own section — it is the **first child of the buy panel** (`product-desktop.html:107`), so it sits in the right 45% column, not above the gallery.
- **Mobile** (`product-mobile.html:90`): standalone block, `padding:16px 16px 0`, full width, above the gallery.
- **Change:** hoisted out of the buy panel to page level; last crumb text also differs (desktop `Zeta Antarctica Sport`, mobile `Antarctica Sport`).

### 3. `pdp-gallery` + `buy-panel` (the split)
- **Purpose:** Product image on the left, purchase/inquiry decision column on the right.
- **Desktop** (`product-desktop.html:101`): `padding:32px 48px 0; display:grid; grid-template-columns:55fr 45fr; gap:64px; align-items:start`. **No max-width** — the grid spans the full 1440 artboard minus 48px side padding = 1344px content. Free space after the 64px gap = 1280px → **gallery 704px, buy panel 576px**. The split ratio is therefore **55/45, not 60/40**.
- **Buy panel is sticky on desktop:** `position:sticky; top:96px` (`product-desktop.html:106`), `display:flex; flex-direction:column; gap:20px`.
- **Mobile:** the two become separate stacked blocks. Gallery (`product-mobile.html:91`) is a **full-bleed** `margin-top:16px` block with *no* side padding → 390×390 image box. Buy panel (`product-mobile.html:92`) is `padding:32px 16px 0; display:flex; flex-direction:column; gap:16px`.
- **Change:** grid → stack, gallery first; gallery gains the badge overlay that desktop keeps inside the buy panel; gallery loses its `1px solid var(--border)` frame and its explicit `background:var(--bg)`; panel gap 20px → 16px; sticky is dropped.
- **Mobile sticky bottom bar: NONE.** `grep` for `position:fixed` and `position:sticky` across `product-mobile.html` returns zero matches. The only sticky element on either artboard is the desktop buy panel. (The mobile footer carries `padding:56px 16px 120px` — a 120px bottom reserve that would fit such a bar — but no bar element is present. Do not invent one.)

### 4. `specifications`
- **Purpose:** 6-row key/value spec table.
- **Desktop** (`product-desktop.html:126-131`): `padding:96px 48px 0; display:flex; flex-direction:column; gap:32px`. Table wrapper `border-top:1px solid var(--border-strong)`. Rows: `display:grid; grid-template-columns:1fr 1fr; padding:0 24px; height:56px`. Row width 1344px → 672px per cell.
- **Mobile** (`product-mobile.html:102-105`): `padding:112px 16px 0; gap:20px`. Rows `padding:0 12px; height:48px`, same `1fr 1fr`. Row width 358px → 179px per cell.
- **Change:** top padding 96 → 112; gap 32 → 20; row height 56 → 48; row side padding 24 → 12; heading 40px → 32px; key/value type 16px → 14px. Columns stay `1fr 1fr` — the table does **not** become a key-above-value stack on mobile.

### 5. `quote-band`
- **Purpose:** Banded inquiry form ("Get your quote" → "Tell us where to send it.").
- **Desktop** (`product-desktop.html:132-157`): `margin-top:120px; background:var(--surface-2); border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:96px 48px`. Inner `display:grid; grid-template-columns:5fr 7fr; gap:64px; align-items:start` → 1280px free → **left 533.333px, right 746.667px** (a 5/7 = ~42/58 split, flipped relative to the gallery split). Left = eyebrow + H2 + paragraph + "Inquiring about" chip. Right = form.
- **Mobile** (`product-mobile.html:106-123`): `margin-top:56px; padding:56px 16px; display:flex; flex-direction:column; gap:24px`. Single column; the same band background and top/bottom borders.
- **Change:** 5fr/7fr grid → single stacked column; band padding 96/48 → 56/16; margin-top 120 → 56; H2 88px → 48px; **the body paragraph is dropped entirely on mobile** (`grep -c '<p '` on `product-mobile.html` = 0); the "Inquiring about" chip changes from an inline row (`padding:14px 16px`, label+value side by side, gap 12px) to a stacked block (`padding:12px 14px`, `flex-direction:column`, gap 4px); form field heights 56 → 52; the desktop 2-col field grid collapses to a flex column; the Quantity/Preferred-contact `1fr 2fr` row becomes two stacked fields; textarea 120px → 100px; submit goes from an inline-flex `padding:0 40px` auto-width button to a full-width `display:flex` button.

### 6. `similar-products`
- **Purpose:** 4 related product cards.
- **Desktop** (`product-desktop.html:159-315`): `padding:120px 48px; display:flex; flex-direction:column; gap:40px`. Grid `repeat(4,minmax(0,1fr)); gap:16px` → (1344 − 48)/4 = **324px per card**.
- **Mobile** (`product-mobile.html:124-277`): `padding:56px 0 0 16px; display:flex; flex-direction:column; gap:20px; overflow:hidden`. Grid `repeat(4,260px); gap:12px` → track total 4×260 + 3×12 = **1076px** inside a 374px-wide box, clipped by `overflow:hidden`.
- **Change:** fluid 4-up grid → fixed 260px horizontal track deliberately overflowing a left-padded, right-bleeding container. Heading 56px → 40px; section gap 40 → 20.
- **Behaviour implied:** a horizontally scrolled carousel. **AMBIGUOUS:** the container declares `overflow:hidden`, not `auto`/`scroll`, and there is no scroll-snap, no arrows and no scrollbar markup — so the static export clips cards 2–4 rather than scrolling them. Treat "horizontal scroller" as intent, not as a measured behaviour.

### 7. `site-footer`
- **Purpose:** Logo, socials, three link columns, legal line.
- **Desktop** (`product-desktop.html:317-372`): `padding:80px 48px 40px; border-top:1px solid var(--border-strong)`. Top grid `1.2fr 1fr; gap:24px` → 1320px free → left 720px, right 600px; right subdivides `1fr 1fr 1fr; gap:24px` → 184px per column. Bottom bar `margin-top:48px; padding-top:24px; border-top:1px solid var(--border); justify-content:space-between`.
- **Mobile** (`product-mobile.html:279-333`): wrapped in a `margin-top:56px` div. `padding:56px 16px 120px`. Top grid `1fr; gap:40px`; link grid `1fr 1fr; gap:40px` with three children → two columns on row 1, "Legal" wraps to row 2. Content 358px → 159px per column. Same bottom bar values (`margin-top:48px; padding-top:24px`).
- **Change:** 1.2fr/1fr → single column; link columns 3 → 2 (+wrap); gaps 24 → 40; padding 80/48/40 → 56/16/120. Logo image stays 120px tall in both.

---

## 2. Per-section detail

Shorthand: `font:<weight> <size>/<line-height> <family-var>`. Colour is the resolved token (hexes in §5). All radii come from `--radius-ctl:2px` unless stated. Global rules in both files: `*{box-sizing:border-box}`, `html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:var(--font-body);-webkit-font-smoothing:antialiased}`, `a{color:var(--text);text-decoration:none}`, `a:hover{color:var(--text-muted)}`, `img{display:block}`.

### 2.1 `site-header`

**Desktop, DOM order** (`product-desktop.html:77-99`)

1. Wrapper `<div>` — `height:88px; padding:0 48px; display:flex; align-items:center; justify-content:space-between; background:var(--scrim-strong); border-bottom:1px solid var(--border); font-family:var(--font-body); color:var(--on-photo, #F4F4F5); width:100%; box-sizing:border-box`.
2. Logo `<a href="#">` — `display:flex; align-items:center; gap:10px; text-decoration:none; color:var(--on-photo, #F4F4F5)`.
   - `<img src="assets/logo/platinum-wheels-logo-transparent.png" alt="Platinum Wheels" style="height:64px;width:auto;display:block">`. No `object-fit`. Rendered box: 64px tall, width auto.
3. `<nav>` — `display:flex; gap:40px`. Four `<a href="#">`, all `font:500 13px/1 var(--font-body); letter-spacing:.1em; text-transform:uppercase; padding:8px 0`:
   - `Tires` — `color:var(--on-photo, #F4F4F5)`, `border-bottom:2px solid var(--accent)` (active state).
   - `Wheels` — `color:rgba(244,244,245,.68)`, `border-bottom:2px solid transparent`.
   - `Accessories` — same as Wheels.
   - `Contact` — same as Wheels.
4. Phone CTA `<a href="tel:+16479896178" class="x112">` — `display:inline-flex; align-items:center; gap:10px; height:44px; padding:0 20px; border:1px solid var(--accent); color:var(--on-photo, #F4F4F5); border-radius:var(--radius-ctl); font:500 13px/1 var(--font-body); letter-spacing:.08em; text-transform:uppercase; white-space:nowrap`. Contains a 16×16 phone `<svg>` (`stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round`) then the text.
   - Copy verbatim: `Call 647-989-6178`
   - **Hover (`.x112`):** `background:var(--accent) !important; color:var(--on-accent) !important`.

**Mobile, DOM order** (`product-mobile.html:74-89`)

1. Wrapper — as desktop but `height:68px; padding:0 16px`.
2. Logo `<a>` + `<img ... style="height:52px;width:auto;display:block">`, same src/alt.
3. Cluster `<div style="display:flex;align-items:center;gap:8px">`:
   - `<a href="tel:+16479896178" aria-label="Call now">` — `width:44px; height:44px; border-radius:50%; background:var(--accent); color:var(--on-accent); display:inline-flex; align-items:center; justify-content:center`. 18×18 phone svg, `stroke-width:1.8`. No visible label text. **No hover class.**
   - `<button type="button" aria-label="Menu">` — `width:44px; height:44px; background:transparent; border:0; color:var(--on-photo, #F4F4F5); display:inline-flex; align-items:center; justify-content:center; cursor:pointer`. 22×22 three-line svg, `stroke-width:1.6; stroke-linecap:round`. **No hover class.**

### 2.2 `breadcrumb`

- **Desktop** (`:107`, inside buy panel): `<span style="font:500 12px/1 var(--font-body);letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim)">`. Separators are `<span style="margin:0 6px">/</span>`. Current crumb wrapped in `<span style="color:var(--text)">`.
  - Copy verbatim: `Home / Results / Zeta Antarctica Sport` (separators rendered with 6px side margins).
- **Mobile** (`:90`): wrapper `<div style="padding:16px 16px 0">`, span `font:500 11px/1 var(--font-body); letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim)`. Separators are plain inline text, no margin spans. Current crumb in `<span style="color:var(--text)">`.
  - Copy verbatim: `Home / Results / Antarctica Sport`

### 2.3 `pdp-gallery` — see §4 for the full spec.

### 2.4 `buy-panel` — see §3 for the full spec.

### 2.5 `specifications`

**Desktop** (`product-desktop.html:126-131`)

1. Section `<div style="padding:96px 48px 0;display:flex;flex-direction:column;gap:32px">`.
2. `<h2 style="margin:0;font:var(--display-weight) calc(40px * var(--scale-h2))/var(--display-leading) var(--font-display);letter-spacing:var(--display-tracking);text-transform:var(--display-transform)">` → resolved **700 40px/0.92 Barlow Condensed, letter-spacing −0.015em, uppercase, colour inherited `--text`**.
   - Copy verbatim: `Specifications`
3. Table wrapper `<div style="border-top:1px solid var(--border-strong)">`.
4. Six rows, each `display:grid; grid-template-columns:1fr 1fr; padding:0 24px; height:56px; align-items:center; border-bottom:1px solid var(--border)`. Backgrounds alternate: rows 1,3,5 `background:var(--surface)`; rows 2,4,6 `background:transparent`.
   - Key `<span style="font:400 16px/1 var(--font-body);color:var(--text-muted)">` — left-aligned.
   - Value `<span style="font:700 16px/1 var(--font-body);font-variant-numeric:tabular-nums;text-align:right;color:var(--text)">` — right-aligned.
   - Rows verbatim: `Brand` / `Zeta` · `Model` / `Antarctica Sport` · `Size` / `215/55R16` · `Season` / `Winter (studdable)` · `Load / speed` / `97T XL` · `3PMSF` / `Yes`.

**Mobile** (`product-mobile.html:102-105`) — identical structure and identical copy. Deltas: section `padding:112px 16px 0; gap:20px`; h2 `calc(32px * var(--scale-h2))`; rows `padding:0 12px; height:48px`; key `font:400 14px/1`; value `font:700 14px/1`.

No hover state on spec rows in either file.

### 2.6 `quote-band`

**Desktop** (`product-desktop.html:132-157`)

Band: `margin-top:120px; background:var(--surface-2); border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:96px 48px`. Inner grid `5fr 7fr; gap:64px; align-items:start`.

*Left column* (`display:flex; flex-direction:column; gap:24px`):
1. Eyebrow `<span style="font:500 12px/1 var(--font-body);letter-spacing:.16em;text-transform:uppercase;color:var(--accent)">` → **accent-coloured text**.
   - Copy: `Get your quote`
2. `<h2>` — `700 calc(88px)/0.92 Barlow Condensed, −0.015em, uppercase`, `margin:0`, colour `--text`.
   - Copy: `Tell us where to send it.`
3. `<p style="margin:0;font:400 17px/1.5 var(--font-body);color:var(--text-muted);max-width:420px">`
   - Copy: `We check the fitment against your Civic, confirm stock, and reply with a firm price and a secure payment link.`
4. "Inquiring about" chip `<div style="display:inline-flex;align-items:center;gap:12px;padding:14px 16px;background:var(--surface);border:1px solid var(--border-strong);align-self:flex-start">`:
   - Label `font:500 11px/1 var(--font-body); letter-spacing:.12em; text-transform:uppercase; color:var(--text-dim)` → `Inquiring about`
   - Value `font:700 14px/1.3 var(--font-body)`, colour inherited `--text` → `Zeta Antarctica Sport 215/55R16 · 2021 Honda Civic`

*Right column* (`display:flex; flex-direction:column; gap:32px`):
1. Field grid `display:grid; grid-template-columns:1fr 1fr; gap:16px`. Every label is `font:500 12px/1 var(--font-body); letter-spacing:.12em; text-transform:uppercase`; every required marker is `<span style="color:var(--accent)">*</span>`; label→field gap 8px.
   - `Full name *` — `grid-column:1/3` (full width). Field: `height:56px; background:var(--bg); border:1px solid var(--border-strong); border-radius:var(--radius-ctl); display:flex; align-items:center; padding:0 16px; font:400 16px/1 var(--font-body); color:var(--text)`. Value `Priya Sandhu`.
   - `Email *` — **focused state shown**: `border:1px solid var(--accent); outline:2px solid var(--accent); outline-offset:-1px`, otherwise identical box. Value `priya.s@` followed by a caret: `<span style="width:1px;height:20px;background:var(--text);display:inline-block;margin-left:1px"></span>`.
   - `Phone *` — same box as Full name but `color:var(--text-dim)` (placeholder). Value `(905) 000-0000`.
2. Optional group `<div style="border-top:1px solid var(--border-strong);padding-top:24px;display:flex;flex-direction:column;gap:16px">`:
   - `<span style="font:500 11px/1 var(--font-body);letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim)">Optional</span>`
   - Grid `1fr 2fr; gap:16px`. Labels here add `color:var(--text-muted)`.
     - `Quantity` → select box `height:56px; background:var(--bg); border:1px solid var(--border-strong); border-radius:var(--radius-ctl); display:flex; align-items:center; justify-content:space-between; padding:0 16px; font:700 16px/1 var(--font-body); font-variant-numeric:tabular-nums`. Value `4 tires` + 16×16 chevron svg `stroke:var(--text-muted); stroke-width:1.6`.
     - `Preferred contact` → segmented control `height:56px; display:grid; grid-template-columns:1fr 1fr 1fr; border:1px solid var(--border-strong); border-radius:var(--radius-ctl); overflow:hidden`. Each segment `display:flex; align-items:center; justify-content:center; font:500 14px/1 var(--font-body); border-right:1px solid var(--border-strong)`. Selected segment (`Phone`) `background:var(--text); color:var(--on-accent)`; `Email` and `WhatsApp` `background:transparent; color:var(--text-muted)`. Note: the **last** segment also carries `border-right`, so the control renders a double edge on the right.
   - `Message` label + textarea box `height:120px; background:var(--bg); border:1px solid var(--border-strong); border-radius:var(--radius-ctl); padding:16px; font:400 16px/1.5 var(--font-body); color:var(--text-dim)`. Placeholder copy verbatim: `Anything we should know — current tires, storage, install timing…` (em dash, horizontal-ellipsis character).
   - Consent `<label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer">` — box `width:20px; height:20px; border:1px solid var(--text-dim); border-radius:var(--radius-ctl); flex:none; margin-top:1px`; text `font:400 14px/1.5 var(--font-body); color:var(--text-muted)`.
     - Copy: `Yes, send me seasonal offers and tire tips from Platinum Wheels. You can unsubscribe anytime.`
3. Submit `<a href="#" style="display:inline-flex;align-items:center;justify-content:center;gap:12px;height:60px;padding:0 40px;background:var(--accent-hover);color:var(--on-accent);border-radius:var(--radius-ctl);font:500 15px/1 var(--font-body);letter-spacing:.08em;text-transform:uppercase;transform:translateY(1px)">` inside a `gap:12px; align-items:flex-start` wrapper.
   - Copy: `Send inquiry →` (the arrow is `<span aria-hidden="true">→</span>`).
   - **This button is drawn in its hover/pressed state**: fill is `--accent-hover` (#DDFF6B) not `--accent`, plus `transform:translateY(1px)`. It carries **no** `.xN` hover class.

**Mobile** (`product-mobile.html:106-123`) — same copy except the `<p>` is absent and the Message placeholder is shortened.
- Band `margin-top:56px; padding:56px 16px; display:flex; flex-direction:column; gap:24px`.
- Eyebrow `font:500 11px/1; letter-spacing:.16em; color:var(--accent)` → `Get your quote`.
- `<h2>` `calc(48px * var(--scale-h2))` → `Tell us where to send it.`
- Chip: `display:flex; flex-direction:column; gap:4px; padding:12px 14px; background:var(--surface); border:1px solid var(--border-strong)`; label `font:500 10px/1; letter-spacing:.12em; color:var(--text-dim)` → `Inquiring about`; value `font:700 14px/1.3` → `Zeta Antarctica Sport 215/55R16 · 2021 Honda Civic`.
- Field stack `display:flex; flex-direction:column; gap:14px`; per field `gap:6px`; labels `font:500 11px/1; letter-spacing:.12em; uppercase`; boxes `height:52px; padding:0 14px; font:400 16px/1`. Full name box declares **no** explicit `color` (inherits `--text`); Phone box `color:var(--text-dim)`; Email box carries the same `border:1px solid var(--accent); outline:2px solid var(--accent); outline-offset:-1px` focus treatment and the same 1px caret span.
- Optional group `border-top:1px solid var(--border-strong); padding-top:20px; gap:14px`; `Optional` label `font:500 10px/1; letter-spacing:.14em`.
- Quantity and Preferred contact are stacked (no `1fr 2fr` grid); both boxes `height:52px; padding:0 14px`. Segmented control identical structure, `height:52px`, segment type still `font:500 14px/1`.
- Message box `height:100px; padding:14px; font:400 15px/1.5; color:var(--text-dim)`. Placeholder copy verbatim: `Anything we should know…`
- Consent label: identical copy; text `font:400 13px/1.5`; the `cursor:pointer` declaration is **absent** on mobile.
- Submit `<a>`: `display:flex; height:56px; background:var(--accent); color:var(--on-accent); font:500 14px/1; letter-spacing:.08em; gap:12px` — full width, **normal** (non-hover) fill, no `translateY`. Copy `Send inquiry →`.

### 2.7 `similar-products`

**Desktop** (`product-desktop.html:159-315`)

1. Section `padding:120px 48px; display:flex; flex-direction:column; gap:40px`.
2. Heading wrapper `display:flex; flex-direction:column; gap:12px` → `<h2 style="margin:0;font:var(--display-weight) calc(56px * var(--scale-h2))/var(--display-leading) var(--font-display);letter-spacing:var(--display-tracking);text-transform:var(--display-transform)">`
   - Copy: `Similar products`
3. Grid `repeat(4,minmax(0,1fr)); gap:16px`.

Card shell (identical for all four): `background:var(--surface); border:1px solid var(--border); transform:none; transition:border-color 150ms cubic-bezier(.2,0,0,1),transform 150ms cubic-bezier(.2,0,0,1); display:flex; flex-direction:column; position:relative; font-family:var(--font-body); color:var(--text); height:100%`. No radius, no shadow.

Card image area: `position:relative; aspect-ratio:1/1; background:var(--bg); overflow:hidden`.
- `<img style="width:100%;height:100%;object-fit:contain;padding:6%;box-sizing:border-box;display:block;opacity:1">`
- Scrim overlay `position:absolute; inset:0; background:radial-gradient(ellipse at center, transparent 50%, var(--scrim-mid) 100%)`.
- Badge rail `position:absolute; top:16px; left:16px; right:16px; display:flex; gap:6px; flex-wrap:wrap`.
- Brand stamp `position:absolute; top:16px; right:16px; font:700 11px/24px var(--font-display); letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted)`.

Card body: `padding:24px; display:flex; flex-direction:column; gap:8px; flex:1`.
- Brand `font:700 15px/1.1 var(--font-body); color:var(--text)`
- Name `font:var(--display-weight) calc(28px * var(--scale-h3))/var(--display-leading) var(--font-display); letter-spacing:var(--display-tracking); text-transform:uppercase; color:var(--text); overflow-wrap:break-word`
- Size row `display:flex; align-items:center; gap:8px; flex-wrap:wrap` → size `font:700 15px/1.2 var(--font-body); font-variant-numeric:tabular-nums; color:var(--text-muted)`; optional 3PMSF cluster `<span title="Three-peak mountain snowflake" style="display:inline-flex;align-items:center;gap:4px;color:var(--text-muted)">` with a 16×16 svg (`stroke-width:1.5`, inner path `stroke-width:1.2`) + `<span style="font:500 11px/1 var(--font-body);letter-spacing:.08em">3PMSF</span>`
- Price row `display:flex; align-items:baseline; gap:6px; margin-top:4px; flex-wrap:wrap; color:var(--text)` → `from` (`font:500 13px/1; letter-spacing:.06em; uppercase; color:var(--text-muted)`) + amount (`font:700 28px/1; font-variant-numeric:tabular-nums`) + `/ tire` (`font:400 13px/1; color:var(--text-dim)`)
- CTA row `display:flex; flex-direction:row; gap:8px; margin-top:auto; padding-top:8px` → `<a>` `flex:1; display:inline-flex; align-items:center; justify-content:center; height:48px; padding:0 20px; background:var(--accent); color:var(--on-accent); border-radius:var(--radius-ctl); font:500 13px/1 var(--font-body); letter-spacing:.04em; text-transform:uppercase; min-width:0; text-align:center`. Copy: `Request a quote`

The four cards, in DOM order (all four CTAs read `Request a quote`):

| # | Image src | alt | Badge | Brand stamp | Brand | Name | Size | 3PMSF | Price | Card class | CTA class |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `assets/products/zmax-winterhawk.png` | `ZMAX Winterhawk` | `Winter` (accent fill) | `ZMAX` | `ZMAX` | `Winterhawk` | `215/55R16 · 97T XL` | yes | `from $119 CAD / tire` | `x115` | `x116` |
| 2 | `assets/products/mazzini-snowleopard.png` | `Mazzini Snowleopard` | `Winter` (accent fill) | `Mazzini` | `Mazzini` | `Snowleopard` | `215/55R16 · 97T XL` | yes | `from $115 CAD / tire` | `x117` | `x118` |
| 3 | `assets/products/zeta-antarctica-sport.png` | `Zeta Antarctica Sport` | `Winter` (accent fill) | `Zeta` | `Zeta` | `Antarctica Sport` | `235/40R18 · 95T XL` | yes | `from $149 CAD / tire` | `x119` | `x120` |
| 4 | `assets/products/zmax-landgema.png` | `ZMAX Landgema` | `All-Season` (outline) | `ZMAX` | `ZMAX` | `Landgema` | `235/40R18 · 95W XL` | no | `from $124 CAD / tire` | `x121` | `x122` |

Badge styles: `Winter` = `height:24px; padding:0 10px; background:var(--accent); color:var(--on-accent); font:500 11px/24px var(--font-body); letter-spacing:.1em; text-transform:uppercase`. `All-Season` = `height:24px; padding:0 10px; border:1px solid var(--text-muted); color:var(--text-muted); font:500 11px/22px var(--font-body); letter-spacing:.1em; text-transform:uppercase`.

**Mobile** (`product-mobile.html:124-277`) — same four cards, same copy, same order, same images/alts/prices/sizes/badges. Deltas:
- Section `padding:56px 0 0 16px; gap:20px; overflow:hidden`; h2 `calc(40px * var(--scale-h2))`; there is no heading wrapper div.
- Grid `repeat(4,260px); gap:12px`.
- Badge rail and brand stamp inset `top/left/right:10px` (desktop 16px).
- Card body `padding:14px`; brand `font:700 12px/1.1`; name `calc(24px * var(--scale-h3))`; size `font:700 14px/1.2`; `from` `font:500 12px/1`; price `font:700 24px/1`; `/ tire` `font:400 12px/1`; CTA `height:44px; font:500 12px/1`.
- Classes: cards `x135`, `x137`, `x139`, `x141`; CTAs `x136`, `x138`, `x140`, `x142`.

### 2.8 `site-footer`

Desktop (`product-desktop.html:317-372`) / Mobile (`product-mobile.html:279-333`) — identical copy throughout.

1. `<footer style="background:var(--bg);border-top:1px solid var(--border-strong);padding:80px 48px 40px;…">` (mobile: `padding:56px 16px 120px`, and the whole footer is wrapped in `<div style="margin-top:56px">`).
2. Top grid — desktop `1.2fr 1fr; gap:24px`; mobile `1fr; gap:40px`.
3. Brand block `display:flex; flex-direction:column; gap:16px; align-items:flex-start`:
   - `<img src="assets/logo/platinum-wheels-logo-transparent.png" alt="Platinum Wheels" style="height:120px;width:auto;display:block">` — same at both breakpoints, no `object-fit`.
   - Social row `display:flex; gap:8px; margin-top:8px` — three `<a href="#">`, each `width:40px; height:40px; border:1px solid var(--border-strong); display:inline-flex; align-items:center; justify-content:center; color:var(--text-muted)`, containing an 18×18 svg at `stroke-width:1.5`. `aria-label` values in order: `Instagram`, `Facebook`, `Google Business`. Classes desktop `x123/x124/x125`, mobile `x143/x144/x145`.
4. Link grid — desktop `1fr 1fr 1fr; gap:24px`; mobile `1fr 1fr; gap:40px`. Three columns, each `display:flex; flex-direction:column; gap:12px`:
   - Heading `<span style="font:500 11px/1 var(--font-body);letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim)">`
   - Links `<a href="#" style="font:400 15px/1.3 var(--font-body);color:var(--text-muted);padding:4px 0">`
   - `Shop`: `Tires` (x126/x146), `Wheels` (x127/x147), `Accessories` (x128/x148), `Winter 2026` (x129/x149)
   - `Company`: `About the shop` (x130/x150), `How it works` (x131/x151), `Contact` (x132/x152)
   - `Legal`: `Privacy Policy` (x133/x153), `Terms & Conditions` (x134/x154 — source is `Terms &amp; Conditions`)
5. Bottom bar `margin-top:48px; padding-top:24px; border-top:1px solid var(--border); display:flex; justify-content:space-between; flex-wrap:wrap; gap:12px` — two `<span style="font:400 13px/1.4 var(--font-body);color:var(--text-dim)">`:
   - `© 2026 Platinum Wheels and Tire Solutions Inc.`
   - `Brampton, Ontario · Prices in CAD, before tax`

### 2.9 Interactive states — full `.xN` resolution

Every `.xN:hover` rule in the head is `!important`. Desktop declares `x112`–`x134`, mobile `x135`–`x154`; every declared class is used exactly once in the body of its file.

| Class | File | Element | Hover effect |
|---|---|---|---|
| `x112` | desktop | header `Call 647-989-6178` CTA | `background:var(--accent); color:var(--on-accent)` |
| `x113` | desktop | buy-panel primary CTA `Request a quote` | `background:var(--accent-hover)` |
| `x114` | desktop | buy-panel secondary CTA `Call us` | `background:var(--text); color:var(--on-accent)` |
| `x115`,`x117`,`x119`,`x121` | desktop | similar-product cards 1–4 (shell) | `border-color:var(--accent-hover); transform:translateY(-2px)` |
| `x116`,`x118`,`x120`,`x122` | desktop | similar-product card CTAs 1–4 | `background:var(--accent-hover)` |
| `x123`,`x124`,`x125` | desktop | footer socials Instagram / Facebook / Google Business | `color:var(--text); border-color:var(--text)` |
| `x126`–`x134` | desktop | footer links Tires, Wheels, Accessories, Winter 2026, About the shop, How it works, Contact, Privacy Policy, Terms & Conditions | `color:var(--text)` |
| `x135`,`x137`,`x139`,`x141` | mobile | similar-product cards 1–4 (shell) | `border-color:var(--accent-hover); transform:translateY(-2px)` |
| `x136`,`x138`,`x140`,`x142` | mobile | similar-product card CTAs 1–4 | `background:var(--accent-hover)` |
| `x143`,`x144`,`x145` | mobile | footer socials Instagram / Facebook / Google Business | `color:var(--text); border-color:var(--text)` |
| `x146`–`x154` | mobile | footer links (same nine, same order) | `color:var(--text)` |

Elements with **no** hover class: all nav links (they fall back to the global `a:hover{color:var(--text-muted)}`), the mobile call button and hamburger, both mobile buy-panel CTAs, both `Send inquiry` buttons, every quantity chip, every form field, every spec row.

Only transition declared anywhere: `transition:border-color 150ms cubic-bezier(.2,0,0,1),transform 150ms cubic-bezier(.2,0,0,1)` on the four card shells (each file). Button/link hovers have no transition → instant.

---

## 3. The buy panel — full spec

### Desktop container
`product-desktop.html:106` — `position:sticky; top:96px; display:flex; flex-direction:column; gap:20px`. Computed width **576px** (45fr of 1280px free space inside a 1344px content row). No padding, no background, no border, no max-width.

### Mobile container
`product-mobile.html:92` — `padding:32px 16px 0; display:flex; flex-direction:column; gap:16px`. Width 390px, content 358px. Not sticky. No sticky bottom bar exists (see §1.3).

### Element order

| # | Element | Desktop | Mobile |
|---|---|---|---|
| 1 | Breadcrumb | inside panel (`:107`) | hoisted above the gallery (`:90`) |
| 2 | Badge row | inside panel (`:108`) | moved onto the image as an overlay (`:91`) |
| 3 | Brand label | `:109` | `:94` |
| 4 | Title `<h1>` | `:109` | `:94` |
| 5 | Size numeral | `:109` | `:94` |
| 6 | Price block | `:110` | `:95` + `:96` (split onto two rows) |
| 7 | Quantity control | `:111-115` | `:97-99` |
| 8 | CTA pair | `:117-120` | `:100` |
| 9 | Install / fitment trust line | **absent** | **absent** |
| 10 | Spec table | **not in the panel** — it is its own page section below the split | same |

### 3.1 Badge row
Desktop `display:flex; gap:8px; align-items:center`, three badges:
- `Winter` — `height:24px; padding:0 10px; background:var(--accent); color:var(--on-accent); font:500 11px/24px var(--font-body); letter-spacing:.1em; text-transform:uppercase`
- `3PMSF` — `display:inline-flex; align-items:center; gap:6px; height:24px; padding:0 10px; border:1px solid var(--text-muted); color:var(--text-muted); font:500 11px/1 var(--font-body); letter-spacing:.1em; text-transform:uppercase`, with a 14×14 snowflake-mountain svg before the text
- `M+S` — `height:24px; padding:0 10px; border:1px solid var(--text-muted); color:var(--text-muted); font:500 11px/22px var(--font-body); letter-spacing:.1em; text-transform:uppercase`

Mobile: same three badges, same copy, but positioned `position:absolute; top:16px; left:16px; display:flex; gap:6px` over the gallery image, and `3PMSF` drops the svg and uses the plain outline style (`font:500 11px/22px`).

### 3.2 Title block
`display:flex; flex-direction:column; gap:8px` (mobile `gap:6px`).

| Element | Desktop | Mobile | Copy verbatim |
|---|---|---|---|
| Brand label | `font:500 13px/1 var(--font-body); letter-spacing:.14em; text-transform:uppercase; color:var(--text-muted)` | `font:500 12px/1 …` same tracking/transform/colour | `Zeta` |
| Title `<h1>` | `margin:0; font:700 calc(88px * var(--scale-h2))/0.92 'Barlow Condensed'; letter-spacing:-0.015em; text-transform:uppercase`, colour inherited `--text` | same but `calc(56px * var(--scale-h2))` | `Antarctica Sport` |
| Size numeral | `font:700 22px/1 var(--font-body); font-variant-numeric:tabular-nums; color:var(--text-muted)` | `font:700 18px/1 …` same | `215/55R16 97T XL` |

**Title size: 88px desktop → 56px mobile** (`--scale-h2` is `1` in both files, so the `calc()` resolves to the literal px).

### 3.3 Price block

**Desktop** (`:110`) — one baseline row: `display:flex; align-items:baseline; gap:12px; padding-top:8px`
1. `from` — `font:500 13px/1 var(--font-body); letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted)`
2. `$129 CAD` — `font:700 64px/1 var(--font-body); font-variant-numeric:tabular-nums; letter-spacing:-.02em`, colour inherited `--text`
3. `per tire · before tax` — `font:400 14px/1.3 var(--font-body); color:var(--text-dim)`

**Mobile** (`:95`,`:96`) — two rows:
1. Row: `display:flex; align-items:baseline; gap:10px` → `from` (`font:500 12px/1; letter-spacing:.08em; uppercase; color:var(--text-muted)`) + `$129 CAD` (`font:700 48px/1; font-variant-numeric:tabular-nums; letter-spacing:-.02em`)
2. Sibling span `font:400 13px/1 var(--font-body); color:var(--text-dim); margin-top:-8px` → `per tire · before tax`

**Exact format string:** `from` · `$<amount> CAD` · `per tire · before tax`. Currency code is inside the numeral span and shares its 700/64px (48px mobile) treatment. No cents, no decimals, no strike-through, no compare-at price. Separator between "per tire" and "before tax" is ` · ` (U+00B7 with surrounding spaces).

### 3.4 Quantity control
Wrapper `display:flex; flex-direction:column; gap:10px; padding-top:8px`. Header row `display:flex; justify-content:space-between; align-items:baseline` holding one span:
- `How many?` — `font:500 12px/1 var(--font-body); letter-spacing:.12em; text-transform:uppercase`, colour inherited `--text`. (The `justify-content:space-between` row has a single child — no second element such as a stock count.)

Option grid:
- Desktop: `display:grid; grid-template-columns:1fr 1fr 1fr 1.6fr; gap:8px` inside 576px → each `1fr` = 120px, the `1.6fr` = 192px.
- Mobile: `grid-template-columns:1fr 1fr 1fr 1.5fr; gap:8px` inside 358px → each `1fr` = 74.222px, the `1.5fr` = 111.333px.

Four cells:
1. `1` — `height:52px` (mobile 48px); `display:inline-flex; align-items:center; justify-content:center; background:transparent; color:var(--text-muted); border:1px solid var(--border-strong); font:700 17px/1 var(--font-body); font-variant-numeric:tabular-nums` (mobile `font:700 16px/1`, **no** `font-variant-numeric`)
2. `2` — identical to `1`
3. `4` — **selected state**: `background:var(--text); color:var(--on-accent); border:1px solid var(--text)`, same type
4. `Custom` — `height:52px` (mobile 48px); `background:var(--surface-2); border:1px solid var(--border-strong); display:flex; align-items:center; justify-content:space-between; padding:0 14px` (mobile `0 12px`). Label `font:400 15px/1 var(--font-body); color:var(--text-dim)` (mobile `font:400 14px/1`). Trailing chevron svg 16×16 (mobile 14×14), `stroke:var(--text-muted); stroke-width:1.6`.

No +/− stepper, no numeric input, no radius on the cells (radius is only on the CTAs).

### 3.5 CTA pair
Wrapper `display:flex; flex-direction:column; gap:10px; padding-top:8px` (mobile `gap:8px; padding-top:8px`).

**Primary** — `<a href="#" class="x113">` (mobile: no class)
- Label verbatim: `Request a quote` (sentence case — **not** `ADD TO CART`, and there is no cart anywhere in the artboard)
- Fill `background:var(--accent)` = `#C9F23A`
- Text colour `var(--on-accent)` = `#0B0B0D`
- Box: `display:flex; align-items:center; justify-content:center; height:60px` (mobile `56px`), full column width (576px desktop / 358px mobile). **No horizontal padding is declared** — the button is stretch-width with centred label.
- Type: `font:500 15px/1 var(--font-body)` (mobile `500 14px/1`), `letter-spacing:.08em` (tracking), `text-transform:uppercase`
- Radius `var(--radius-ctl)` = 2px
- Hover (desktop only): `background:var(--accent-hover)` = `#DDFF6B`

**Secondary** — `<a href="tel:+16479896178" class="x114">` (mobile: no class)
- Label verbatim: `Call us`, preceded by an 18×18 phone svg (mobile 16×16), `gap:12px` (mobile `10px`)
- `background` not set (transparent); `border:1px solid var(--text)`; `color:var(--text)`
- `height:60px` (mobile `56px`), `border-radius:var(--radius-ctl)`, `font:500 15px/1` (mobile `500 14px/1`), `letter-spacing:.08em`, `text-transform:uppercase`
- Hover (desktop only): `background:var(--text); color:var(--on-accent)`

### 3.6 Install / fitment trust line
**Absent from the buy panel on both artboards.** There is no "Installed in Brampton…" line, no shipping line, no stock line, no return line anywhere in the panel. The only fitment sentence on the page lives in the quote band, desktop only (`product-desktop.html:135`):

> `We check the fitment against your Civic, confirm stock, and reply with a firm price and a secure payment link.`

and the only fitment data point is the quote-band chip value `Zeta Antarctica Sport 215/55R16 · 2021 Honda Civic`. Do not synthesise a trust line into the panel.

### 3.7 Spec table
Not part of the buy panel — it is section `specifications`, a full-bleed page section below the split (see §2.5). Summary:

| Property | Desktop | Mobile |
|---|---|---|
| Wrapper edge | `border-top:1px solid var(--border-strong)` (#35353B) | same |
| Row height | `56px` fixed | `48px` fixed |
| Row grid | `1fr 1fr` (672px / 672px) | `1fr 1fr` (179px / 179px) |
| Row side padding | `0 24px` | `0 12px` |
| Divider | `border-bottom:1px solid var(--border)` (#1F1F24) on every row incl. the last | same |
| Zebra | odd rows (1,3,5) `background:var(--surface)`; even rows `transparent` | same |
| Key type | `400 16px/1 Barlow`, `color:var(--text-muted)`, left-aligned | `400 14px/1`, same |
| Value type | `700 16px/1 Barlow`, `font-variant-numeric:tabular-nums`, `text-align:right`, `color:var(--text)` | `700 14px/1`, same |
| Vertical align | `align-items:center` | same |
| Row hover | none declared | none declared |

Six rows, keys then values, verbatim: `Brand`/`Zeta`, `Model`/`Antarctica Sport`, `Size`/`215/55R16`, `Season`/`Winter (studdable)`, `Load / speed`/`97T XL`, `3PMSF`/`Yes`.

---

## 4. Gallery spec

### Desktop (`product-desktop.html:102-104`)
- Column wrapper: `display:flex; flex-direction:column; gap:12px`. It contains **exactly one child** — the main image box. The 12px gap is therefore inert in this export; it is the slot a thumbnail strip would occupy.
- **Thumbnails: none.** No thumb strip, no dots, no arrows, no counter in either artboard.
- Main image box: `position:relative; aspect-ratio:1/1; background:var(--bg); overflow:hidden; border:1px solid var(--border)`. Computed **704 × 704 px** (border-box, since `*{box-sizing:border-box}` is global).
- `<img src="assets/products/zeta-antarctica-sport.png" alt="Zeta Antarctica Sport" style="width:100%;height:100%;object-fit:contain;padding:8%;box-sizing:border-box;display:block">` — `object-fit:contain`, 8% inset on all four sides (percentage padding resolves against the 702px content inline size ≈ 56.16px).
- Overlay: `position:absolute; inset:0; background:radial-gradient(ellipse at center,transparent 55%,var(--scrim-mid) 100%)` — note **no space** after the comma, and a `55%` stop (the similar-product cards use `50%` and a spaced form).
- No badges overlaid on the desktop gallery; badges live in the buy panel.

### Mobile (`product-mobile.html:91`)
- Single block, **no column wrapper, no gap, no border, no `background` declaration** (inherits `--bg` from the screen wrapper).
- Box: `margin-top:16px; position:relative; aspect-ratio:1/1; overflow:hidden`. Full-bleed, zero side padding → **390 × 390 px**.
- Same `<img>` src/alt and the identical `width:100%;height:100%;object-fit:contain;padding:8%;box-sizing:border-box;display:block`.
- Same `radial-gradient(ellipse at center,transparent 55%,var(--scrim-mid) 100%)` overlay.
- Badge overlay added: `position:absolute; top:16px; left:16px; display:flex; gap:6px` with `Winter` / `3PMSF` / `M+S` (see §3.1).

### Behaviour implied by the markup
- Static, single-image. No `<button>`, no thumb list, no `data-*` hooks, no scroll container, no zoom affordance, no lightbox trigger, no `cursor` change. Nothing in the export implies a lightbox or a swipe gallery.
- The desktop column's `flex-direction:column; gap:12px` is the only structural hint that additional images were anticipated below the hero image. **AMBIGUOUS:** whether the production gallery is meant to be multi-image cannot be determined from this export — there is exactly one product photo per artboard.
- Aspect ratio is 1:1 at both sizes. Image ground is the page ground (`--bg` #0B0B0D), so the cut-out PNG sits *in* the frame; `object-fit:contain` means the photo is never cropped.

---

## 5. Value inventory

### 5.1 Colours

`:root` is byte-identical in both files (`product-desktop.html:11-40`, `product-mobile.html:11-40`).

| Token / literal | Resolved value | Where used |
|---|---|---|
| `--bg` | `#0B0B0D` | page/body ground; desktop gallery box fill; card image ground (all 4 cards, both files); all form field fills (Full name, Email, Phone, Quantity, Message); footer background |
| `--surface` | `#16161A` | card shell fill (4 cards × 2 files); spec-table odd rows (1,3,5) both files; "Inquiring about" chip fill both files |
| `--surface-2` | `#1F1F24` | quote band background both files; `Custom` quantity cell fill both files |
| `--border` | `#1F1F24` | header bottom border; desktop gallery box border; card shell border; spec-row bottom borders; quote-band top+bottom borders; footer bottom-bar top border |
| `--border-strong` | `#35353B` | quantity cells 1/2 border; `Custom` cell border; spec-table wrapper top border; all form field borders (non-focused); segmented-control outer border and its 3 segment right-borders; Optional group top border; footer top border; footer social icon borders |
| `--text` | `#F4F4F5` | body default ink; h1/h2 (inherited); spec values; card brand + card name; selected quantity cell fill `4`; selected segment fill `Phone`; secondary CTA border+text; breadcrumb current crumb; form value text; caret span; all `.xN:hover` text/border targets |
| `--text-muted` | `#A7A7AE` | brand label above h1; size numeral under h1; `from` labels; `per tire` no — see `--text-dim`; spec keys; card size + 3PMSF + `from`; outline badge border+text (`3PMSF`, `M+S`, `All-Season`); brand stamp on cards; footer links; consent copy; desktop quote paragraph; unselected segments; chevron svg strokes; global `a:hover` |
| `--text-dim` | `#8B909A` | breadcrumb (non-current); `per tire · before tax`; card `/ tire`; `Inquiring about` label; `Optional` label; Phone field placeholder; Message placeholder; consent checkbox border; footer column headings; footer legal line |
| `--accent` | `#C9F23A` | `Winter` badge fill (buy panel + 3 cards, both files); buy-panel primary CTA fill; all 4 card CTA fills; desktop header phone-CTA border; desktop nav active underline (`Tires`); mobile header round call-button fill; `Get your quote` eyebrow text; the three required `*` markers; Email field focus border + 2px outline; mobile `Send inquiry` fill |
| `--accent-hover` | `#DDFF6B` | desktop `Send inquiry` fill (drawn pre-hovered); every `:hover` fill/border in `x113`, `x115`–`x122`, `x135`–`x142` |
| `--on-accent` | `#0B0B0D` | text on every accent fill; text on the `--text`-filled selected quantity cell and selected segment; `x112`/`x114` hover text |
| `--on-photo` | `#F4F4F5` | header text/link colour (always written as `var(--on-photo, #F4F4F5)` with an inline fallback) |
| `--scrim-strong` | `rgba(11,11,13,.92)` | header background, both files |
| `--scrim-mid` | `rgba(11,11,13,.68)` | terminal stop of all 5 radial-gradient overlays per file (1 gallery + 4 cards) |
| `rgba(244,244,245,.68)` (literal) | — | desktop nav inactive links `Wheels`, `Accessories`, `Contact` only |
| `#F4F4F5` (literal) | — | the `var(--on-photo, #F4F4F5)` fallback, 4× desktop / 3× mobile |
| `transparent` (literal) | — | inactive nav underlines; quantity cells 1/2 fill; unselected segments; spec even rows; hamburger background; both radial-gradient start stops |
| `--accent-subtle` | `rgba(201,242,58,0.12)` | **declared, zero uses** in either product artboard |
| `--winter` | `#8FC9F2` | **declared, zero uses** |
| `--all-season` | `#D9C29A` | **declared, zero uses** |
| `--canvas-bg` | `#050505` | **declared, zero uses** |
| `--scrim-soft` | `rgba(11,11,13,.38)` | **declared, zero uses** |

Gradients (the only ones present): `radial-gradient(ellipse at center,transparent 55%,var(--scrim-mid) 100%)` on the gallery image; `radial-gradient(ellipse at center, transparent 50%, var(--scrim-mid) 100%)` on each of the 4 card images. No linear gradients, no shadows, no `backdrop-filter` anywhere.

### 5.2 Type

Font tokens: `--font-display:'Barlow Condensed',sans-serif`, `--font-body:'Barlow',sans-serif`. Display tokens: `--display-weight:700`, `--display-leading:0.92`, `--display-tracking:-0.015em`, `--display-transform:uppercase`, `--scale-hero:1`, `--scale-h2:1`, `--scale-h3:1`.

Google Fonts link requests `Barlow Condensed:wght@600;700`, `Barlow:wght@400;500;700`, `Michroma`, `Manrope:wght@400;500;700;800`. **Michroma and Manrope are loaded but never referenced**; Barlow Condensed 600 is loaded but never used (only 700 via `--display-weight`).

| # | Family / weight / size / line-height / tracking / transform | Colour | Role |
|---|---|---|---|
| T1 | Barlow Condensed 700 / 88px / 0.92 / −0.015em / uppercase | `--text` | Desktop PDP `<h1>`; desktop quote-band `<h2>` |
| T2 | Barlow Condensed 700 / 56px / 0.92 / −0.015em / uppercase | `--text` | Desktop `Similar products` `<h2>`; **mobile PDP `<h1>`** |
| T3 | Barlow Condensed 700 / 48px / 0.92 / −0.015em / uppercase | `--text` | Mobile quote-band `<h2>` |
| T4 | Barlow Condensed 700 / 40px / 0.92 / −0.015em / uppercase | `--text` | Desktop `Specifications` `<h2>`; mobile `Similar products` `<h2>` |
| T5 | Barlow Condensed 700 / 32px / 0.92 / −0.015em / uppercase | `--text` | Mobile `Specifications` `<h2>` |
| T6 | Barlow Condensed 700 / 28px / 0.92 / −0.015em / uppercase | `--text` | Desktop card product name |
| T7 | Barlow Condensed 700 / 24px / 0.92 / −0.015em / uppercase | `--text` | Mobile card product name |
| T8 | Barlow Condensed 700 / 11px / 24px / +0.08em / uppercase | `--text-muted` | Card brand stamp (image top-right), both files |
| T9 | Barlow 700 / 64px / 1 / −0.02em, tabular-nums | `--text` | Desktop PDP price |
| T10 | Barlow 700 / 48px / 1 / −0.02em, tabular-nums | `--text` | Mobile PDP price |
| T11 | Barlow 700 / 28px / 1 / tabular-nums | `--text` | Desktop card price |
| T12 | Barlow 700 / 24px / 1 / tabular-nums | `--text` | Mobile card price |
| T13 | Barlow 700 / 22px / 1 / tabular-nums | `--text-muted` | Desktop PDP size numeral |
| T14 | Barlow 700 / 18px / 1 / tabular-nums | `--text-muted` | Mobile PDP size numeral |
| T15 | Barlow 700 / 17px / 1 / tabular-nums | `--text-muted` (selected: `--on-accent`) | Desktop quantity cells |
| T16 | Barlow 700 / 16px / 1 / tabular-nums | `--text` | Desktop spec values; desktop Quantity select value |
| T17 | Barlow 700 / 16px / 1 (no tabular-nums) | `--text-muted` / `--on-accent` | Mobile quantity cells; mobile Quantity select value (`700 16px/1`, tabular only on the select) |
| T18 | Barlow 700 / 15px / 1.2 / tabular-nums | `--text-muted` | Desktop card size line |
| T19 | Barlow 700 / 15px / 1.1 | `--text` | Desktop card brand |
| T20 | Barlow 700 / 14px / 1 / tabular-nums | `--text` | Mobile spec values |
| T21 | Barlow 700 / 14px / 1.2 / tabular-nums | `--text-muted` | Mobile card size line |
| T22 | Barlow 700 / 14px / 1.3 | `--text` | `Inquiring about` chip value, both files |
| T23 | Barlow 700 / 12px / 1.1 | `--text` | Mobile card brand |
| T24 | Barlow 500 / 15px / 1 / +0.08em / uppercase | `--on-accent` / `--text` | Desktop buy-panel CTAs; desktop `Send inquiry` |
| T25 | Barlow 500 / 14px / 1 / +0.08em / uppercase | `--on-accent` / `--text` | Mobile buy-panel CTAs; mobile `Send inquiry` |
| T26 | Barlow 500 / 14px / 1 (no tracking, no transform) | `--on-accent` / `--text-muted` | Segmented-control segments, both files |
| T27 | Barlow 500 / 13px / 1 / +0.10em / uppercase | `--on-photo` / `rgba(244,244,245,.68)` | Desktop nav links |
| T28 | Barlow 500 / 13px / 1 / +0.08em / uppercase | `--on-photo` / `--text-muted` | Desktop header phone CTA; desktop PDP `from` label |
| T29 | Barlow 500 / 13px / 1 / +0.14em / uppercase | `--text-muted` | Desktop brand label above `<h1>` |
| T30 | Barlow 500 / 13px / 1 / +0.06em / uppercase | `--text-muted` | Desktop card `from` |
| T31 | Barlow 500 / 13px / 1 / +0.04em / uppercase | `--on-accent` | Desktop card CTA |
| T32 | Barlow 500 / 12px / 1 / +0.10em / uppercase | `--text-dim` | Desktop breadcrumb |
| T33 | Barlow 500 / 12px / 1 / +0.12em / uppercase | `--text` / `--text-muted` | Desktop `How many?`; desktop form labels (required labels inherit `--text`, optional labels `--text-muted`) |
| T34 | Barlow 500 / 12px / 1 / +0.16em / uppercase | `--accent` | Desktop `Get your quote` eyebrow |
| T35 | Barlow 500 / 12px / 1 / +0.14em / uppercase | `--text-muted` | Mobile brand label above `<h1>` |
| T36 | Barlow 500 / 12px / 1 / +0.08em / uppercase | `--text-muted` | Mobile PDP `from` |
| T37 | Barlow 500 / 12px / 1 / +0.12em / uppercase | `--text` | Mobile `How many?` |
| T38 | Barlow 500 / 12px / 1 / +0.06em / uppercase | `--text-muted` | Mobile card `from` |
| T39 | Barlow 500 / 12px / 1 / +0.04em / uppercase | `--on-accent` | Mobile card CTA |
| T40 | Barlow 500 / 11px / 24px / +0.10em / uppercase | `--on-accent` | `Winter` badge (filled), both files |
| T41 | Barlow 500 / 11px / 22px / +0.10em / uppercase | `--text-muted` | Outline badges `M+S`, `All-Season`, and mobile `3PMSF` |
| T42 | Barlow 500 / 11px / 1 / +0.10em / uppercase | `--text-muted` | Desktop buy-panel `3PMSF` badge; mobile breadcrumb |
| T43 | Barlow 500 / 11px / 1 / +0.08em | `--text-muted` | Card `3PMSF` inline label (no transform declared) |
| T44 | Barlow 500 / 11px / 1 / +0.12em / uppercase | `--text-dim` | Footer column headings; desktop `Inquiring about` label; mobile form labels |
| T45 | Barlow 500 / 11px / 1 / +0.14em / uppercase | `--text-dim` | Desktop `Optional` label |
| T46 | Barlow 500 / 11px / 1 / +0.16em / uppercase | `--accent` | Mobile `Get your quote` eyebrow |
| T47 | Barlow 500 / 10px / 1 / +0.12em / uppercase | `--text-dim` | Mobile `Inquiring about` label |
| T48 | Barlow 500 / 10px / 1 / +0.14em / uppercase | `--text-dim` | Mobile `Optional` label |
| T49 | Barlow 400 / 17px / 1.5 | `--text-muted` | Desktop quote-band paragraph (only 17px on either artboard) |
| T50 | Barlow 400 / 16px / 1 | `--text` / `--text-dim` | Form field values, both files |
| T51 | Barlow 400 / 16px / 1.5 | `--text-dim` | Desktop Message placeholder |
| T52 | Barlow 400 / 15px / 1.5 | `--text-dim` | Mobile Message placeholder |
| T53 | Barlow 400 / 15px / 1.3 | `--text-muted` | Footer links, both files |
| T54 | Barlow 400 / 15px / 1 | `--text-dim` | Desktop `Custom` cell label |
| T55 | Barlow 400 / 14px / 1.5 | `--text-muted` | Desktop consent copy |
| T56 | Barlow 400 / 14px / 1.3 | `--text-dim` | Desktop `per tire · before tax` |
| T57 | Barlow 400 / 14px / 1 | `--text-muted` / `--text-dim` | Mobile spec keys; mobile `Custom` cell label |
| T58 | Barlow 400 / 13px / 1.5 | `--text-muted` | Mobile consent copy |
| T59 | Barlow 400 / 13px / 1.4 | `--text-dim` | Footer legal line, both files |
| T60 | Barlow 400 / 13px / 1 | `--text-dim` | Desktop card `/ tire`; mobile `per tire · before tax` |
| T61 | Barlow 400 / 12px / 1 | `--text-dim` | Mobile card `/ tire` |
| T62 | Barlow 400 / 16px / 1 | `--text-muted` | Desktop spec keys |

### 5.3 Spacing

DESIGN.md §5 scale: **8 / 16 / 24 / 32 / 48 / 80 / 120**. ⚠ marks a value off that scale.

| Value | Where used |
|---|---|
| `1px` ⚠ | caret span width; `margin-left:1px` on the caret; `margin-top:1px` on the consent checkbox; every hairline border |
| `2px` ⚠ | `--radius-ctl`; nav underline width; focus `outline` width; hover `translateY(-2px)`; `translateY(1px)` ⚠ on desktop `Send inquiry` |
| `4px` ⚠ | card price-row `margin-top:4px`; card 3PMSF cluster `gap:4px`; footer link `padding:4px 0`; mobile chip `gap:4px` |
| `6px` ⚠ | breadcrumb separator `margin:0 6px` (desktop); badge rail `gap:6px`; card price-row `gap:6px`; buy-panel `3PMSF` badge inner `gap:6px`; mobile title block `gap:6px`; mobile field `gap:6px` |
| `8px` | nav link `padding:8px 0`; badge row `gap:8px`; card body `gap:8px`; card CTA row `gap:8px` and `padding-top:8px`; quantity grid `gap:8px`; price block `padding-top:8px`; buy-panel CTA `padding-top:8px` (mobile `gap:8px`); footer social `gap:8px`/`margin-top:8px`; form label→field `gap:8px` (desktop); mobile price `margin-top:-8px` ⚠ (negative) |
| `10px` ⚠ | logo link `gap:10px`; desktop phone CTA `gap:10px`; badge `padding:0 10px`; quantity wrapper `gap:10px`; desktop CTA pair `gap:10px`; mobile card badge/stamp inset `top/left/right:10px`; mobile price row `gap:10px`; mobile secondary CTA `gap:10px` |
| `12px` ⚠ | desktop gallery column `gap:12px`; desktop price row `gap:12px`; footer column `gap:12px`; footer bottom-bar `gap:12px`; consent `gap:12px`; `Inquiring about` chip `gap:12px`; `Send inquiry` `gap:12px`; mobile similar-products grid `gap:12px`; mobile spec row `padding:0 12px`; mobile `Custom` cell `padding:0 12px`; mobile chip `padding:12px 14px`; desktop `Similar products` heading wrapper `gap:12px` |
| `14px` ⚠ | desktop chip `padding:14px 16px`; desktop `Custom` cell `padding:0 14px`; mobile card body `padding:14px`; mobile field `padding:0 14px`; mobile Message `padding:14px`; mobile form stack `gap:14px` |
| `16px` | desktop card badge/stamp inset `top/left/right:16px`; desktop form grid `gap:16px`; desktop field `padding:0 16px`; desktop Message `padding:16px`; mobile side padding; mobile gallery `margin-top:16px`; mobile breadcrumb `padding:16px 16px 0`; mobile buy-panel `gap:16px`; footer brand block `gap:16px`; desktop Optional group `gap:16px` |
| `20px` ⚠ | desktop phone CTA `padding:0 20px`; card CTA `padding:0 20px` (both files); desktop buy-panel `gap:20px`; consent checkbox `20px` square; caret height `20px`; mobile spec section `gap:20px`; mobile similar-products `gap:20px`; mobile Optional `padding-top:20px` |
| `24px` | desktop card body `padding:24px`; desktop spec row `padding:0 24px`; quote-band left column `gap:24px`; mobile quote band `gap:24px`; footer top grid `gap:24px` (desktop) and link grid `gap:24px`; footer bottom bar `padding-top:24px`; desktop Optional `padding-top:24px` |
| `32px` | desktop specs section `gap:32px`; desktop quote right column `gap:32px`; desktop split `padding-top:32px`; mobile buy panel `padding:32px 16px 0` |
| `40px` ⚠ | desktop nav `gap:40px`; desktop `Send inquiry` `padding:0 40px`; desktop similar-products `gap:40px`; footer social icon `40px` square; mobile footer grids `gap:40px` |
| `44px` ⚠ | desktop header phone CTA `height:44px`; mobile call button and hamburger `44×44`; mobile card CTA `height:44px` |
| `48px` | desktop side padding (`0 48px`, `32px 48px 0`, `96px 48px`, `120px 48px`, `80px 48px 40px`); desktop card CTA `height:48px`; mobile spec row `height:48px`; mobile quantity cell `height:48px`; footer bottom bar `margin-top:48px` |
| `52px` ⚠ | desktop quantity cell `height:52px`; mobile logo `height:52px`; mobile form field `height:52px` |
| `56px` ⚠ | desktop spec row `height:56px`; desktop form field/select/segment `height:56px`; mobile buy-panel CTAs `height:56px`; mobile `Send inquiry` `height:56px`; mobile quote band `margin-top:56px` and `padding:56px 16px`; mobile similar-products `padding-top:56px`; mobile footer `margin-top:56px` and `padding-top:56px` |
| `60px` ⚠ | desktop buy-panel CTAs `height:60px`; desktop `Send inquiry` `height:60px` |
| `64px` ⚠ | desktop logo `height:64px`; desktop split `gap:64px`; desktop quote-band grid `gap:64px` |
| `68px` ⚠ | mobile header `height:68px` |
| `80px` | desktop footer `padding-top:80px` |
| `88px` ⚠ | desktop header `height:88px` |
| `96px` ⚠ | desktop buy panel `top:96px`; desktop specs `padding-top:96px`; desktop quote band `padding:96px 48px` (DESIGN.md §5 sanctions 96 for section breaks but omits it from the named scale) |
| `100px` ⚠ | mobile Message box `height:100px` |
| `112px` ⚠ | mobile specs section `padding-top:112px` |
| `120px` | desktop quote band `margin-top:120px`; desktop similar-products `padding:120px 48px`; desktop Message box `height:120px`; footer logo `height:120px` (both files); mobile footer `padding-bottom:120px` |
| `260px` ⚠ | mobile similar-products fixed track column width (`repeat(4,260px)`) |
| `420px` ⚠ | desktop quote paragraph `max-width:420px` (the only `max-width` in either file) |
| `6%` / `8%` ⚠ | card image inset `padding:6%`; gallery image inset `padding:8%` — percentage, off any px scale |
| `1440px` / `390px` | artboard widths |

**Off-scale summary:** 1, 2, 4, 6, 10, 12, 14, 20, 40, 44, 52, 56, 60, 64, 68, 88, 96, 100, 112, 260, 420, plus the `-8px` negative margin and the `6%`/`8%` percentage insets. On-scale values actually used: 8, 16, 24, 32, 48, 80, 120.

**Fixed heights (all of them):** 88, 68, 64, 60, 56, 52, 48, 44, 40, 24, 20, 120, 100 px. **Fixed widths:** 1440, 390, 260, 44, 40, 20, 1 px, plus `max-width:420px`.

### 5.4 Radius and borders

| Value | Where used |
|---|---|
| `--radius-ctl` = `2px` | header phone CTA (desktop); buy-panel primary + secondary CTAs; card CTAs ×4; all form fields (Full name, Email, Phone, Quantity, Message); segmented control; consent checkbox; `Send inquiry`. 15 occurrences desktop / 14 mobile. |
| `50%` ⚠ | mobile header round call button only (`product-mobile.html:81`) — the single pill/circle in either artboard |
| radius `0` (none declared) | card shells, card images, gallery box, badges, spec rows, quantity cells, quote band, footer, all images |
| `1px solid var(--border)` `#1F1F24` | header bottom; desktop gallery box; card shells ×4; spec row bottoms ×6; quote-band top and bottom; footer bottom-bar top |
| `1px solid var(--border-strong)` `#35353B` | quantity cells `1`/`2`; `Custom` cell; spec-table wrapper top; Full name / Phone / Quantity / Message fields; segmented-control outer + 3 segment right-borders; Optional group top; footer top; 3 footer social icons |
| `1px solid var(--text-muted)` `#A7A7AE` | outline badges: buy-panel `3PMSF` + `M+S` (both files), card `All-Season` |
| `1px solid var(--text)` `#F4F4F5` | buy-panel secondary CTA `Call us`; selected quantity cell `4` |
| `1px solid var(--accent)` `#C9F23A` | desktop header phone CTA; Email field (focused) |
| `1px solid var(--text-dim)` `#8B909A` | consent checkbox |
| `2px solid var(--accent)` `#C9F23A` | desktop nav active underline (`Tires`, `border-bottom`) |
| `2px solid transparent` | desktop nav inactive underlines ×3 |
| `outline:2px solid var(--accent)` + `outline-offset:-1px` | Email field focus ring, both files |
| `border:0` | mobile hamburger `<button>` |

Only two border widths exist: **1px** and **2px** (2px only for the nav underline and the focus outline). No 3px+, no dashed, no dotted, no `box-shadow` of any kind in either file.

---

## 6. Conflicts with DESIGN.md

Artboard values are authoritative. Cited lines: `D:` = `design/assets/product-desktop.html`, `M:` = `design/assets/product-mobile.html`, `DM:` = `design/DESIGN.md`.

| What DESIGN.md says | What the artboard does | File + line |
|---|---|---|
| Family "Cinematic Dark"; theme statement "true-black slab (`#000000`)" (`DM:23`) | Theme "Track Night", ground `#0B0B0D` | `D:12`, `M:12` vs `DM:40` |
| `--bg: #000000` (`DM:40`) | `--bg:#0B0B0D` | `D:12`, `M:12` |
| `--bg-alt: #0a0a0a` (`DM:41`) | No `--bg-alt` token exists; the band colour is `--surface-2:#1F1F24` | `D:14`, `D:132` |
| `--surface: #141414` (`DM:42`) | `--surface:#16161A` | `D:13` |
| `--border: #1f1f1f` (`DM:43`) | `--border:#1F1F24` | `D:15` |
| `--rule: #2a2a2a` (`DM:44`) | No `--rule` token; the equivalent is `--border-strong:#35353B` | `D:16` |
| `--text: #ffffff` (`DM:47`) | `--text:#F4F4F5` | `D:17` |
| `--text-muted: #b8b8b8` (`DM:48`) | `--text-muted:#A7A7AE` | `D:18` |
| `--text-dim: #6a6a6a` (`DM:49`) | `--text-dim:#8B909A` | `D:19` |
| **Accent racing red `--accent:#e10600`** (`DM:52`) | **`--accent:#C9F23A` (acid lime)**; DESIGN.md `DM:59` explicitly rejects lime as reading "tech" | `D:20`, `M:20` |
| `--accent-hover:#ff1a12` (`DM:53`) | `--accent-hover:#DDFF6B` | `D:21` |
| `--accent-deep:#9e0400` for card hover border (`DM:54`, `DM:154`) | No `--accent-deep`; card hover uses `--accent-hover` (#DDFF6B), i.e. brighter, not deeper — the opposite of "hover should not compete with the CTA" (`DM:72`) | `D:50`, `M:47` |
| `--on-accent:#000000` (`DM:55`) | `--on-accent:#0B0B0D` | `D:23` |
| **PDP is 60/40 — gallery left (sticky), buy panel right** (`DM:214`); "Split layouts are 60/40 (7/5 columns) or 40/60, never 50/50" (`DM:206`) | **`grid-template-columns:55fr 45fr`** → 704px / 576px. Sticky is honoured (`position:sticky; top:96px`). The quote band uses `5fr 7fr` (≈42/58), which is also not 60/40 | `D:101`, `D:106`, `D:133` |
| Tablet 55/45 is the *tablet* behaviour, desktop stays 60/40 (`DM:275`) | The 1440 desktop artboard already ships the 55/45 ratio | `D:101` |
| PDP title 88 → 56 mobile (`DM:98`, `DM:214`) | 88px desktop, 56px mobile — **agrees** | `D:109`, `M:94` |
| **PDP price 56px** (`DM:118`, `DM:214`) | **64px desktop, 48px mobile** | `D:110`, `M:95` |
| Card/row price 32px (`DM:118`, `DM:153`) | 28px desktop card, 24px mobile card | `D:191`, `M:154` |
| Prices in `--text` white, "never red" (`DM:118`, `DM:120`) | Prices are `--text` (#F4F4F5), not accent — **agrees** | `D:110` |
| **Buy panel CTA label `ADD TO CART`** (`DM:124`, `DM:214`, `DM:280`) | **`Request a quote`** — sentence case, three words, and paired with a second CTA `Call us`. There is no cart, no add-to-cart, and no cart icon anywhere on the PDP | `D:118`, `D:119`, `M:100` |
| CTAs "two words max", uppercase ≤2 words (`DM:124`, `DM:308`) | `Request a quote` (3 words), `Send inquiry` (2), `Call us` (2), `Call 647-989-6178` (2 + number) | `D:92`, `D:118`, `D:154` |
| Button type Barlow 500 14px, tracking +0.06em, padding `14px 28px`, "Height results, not fixed" (`DM:143-144`) | 15px desktop / 14px mobile, tracking `.08em`, **fixed heights** 60/56/48/44px, no horizontal padding on full-width CTAs (`padding:0 20px` on card CTAs, `padding:0 40px` on desktop `Send inquiry`) | `D:118`, `D:154`, `D:196` |
| **One accent per frame; a card with a WINTER badge gets a ghost button, never both accent** (`DM:79`, `DM:155`) | Cards 1–3 show an accent `Winter` badge **and** an accent-filled `Request a quote` button in the same card. The buy panel stacks accent `Winter` badge + accent primary CTA. The quote band stacks accent eyebrow + three accent `*` markers + accent focus ring + accent submit. Desktop nav carries an accent underline **and** an accent-bordered phone CTA | `D:108`+`D:118`; `D:167`+`D:196`; `D:133`+`D:154`; `D:84`+`D:92` |
| Focus ring `2px --accent`, no offset (`DM:75`, `DM:162`) | `outline:2px solid var(--accent)` with `outline-offset:-1px` (inset, not zero) plus an accent border swap | `D:141`, `M:110` |
| Nav height 72px desktop / 56px mobile, background `--bg`, "Not transparent over the hero" (`DM:169`) | 88px desktop / 68px mobile; background `var(--scrim-strong)` = `rgba(11,11,13,.92)`, i.e. translucent | `D:77`, `M:74` |
| Nav left = wordmark `PLATINUM WHEELS` in Barlow Condensed 700 22px; badge only at 40px once transparent (`DM:170`, `DM:15`) | No wordmark. A 64px (desktop) / 52px (mobile) `platinum-wheels-logo-transparent.png` image, and 120px in the footer | `D:79`, `M:77`, `D:320` |
| Container max 1320px, centred, 24px side padding (16 mobile) (`DM:203`) | No container and no `max-width` anywhere (the only `max-width` is `420px` on one paragraph). Side padding 48px desktop, 16px mobile | `D:101`, `D:135` |
| Product grid gutters 24px (`DM:156`) | 16px desktop, 12px mobile | `D:161`, `M:126` |
| Table rows: `border-bottom 1px --rule`, "no fill on odd/even", key 15px, cell padding `0 16px` (`DM:193-195`) | Zebra fill present (`--surface` on rows 1/3/5); key 16px desktop / 14px mobile; cell padding `0 24px` desktop / `0 12px` mobile | `D:129`, `M:104` |
| Input height 48px, fill `--bg-alt`, padding `0 16px` (`DM:160`) | Height 56px desktop / 52px mobile, fill `--bg`, padding `0 16px` / `0 14px` | `D:137`, `M:109` |
| "All radii 0–4px… Nothing is a pill" (`DM:130`, `DM:252`) | Mobile header call button is `border-radius:50%` | `M:81` |
| "No gradient fills except `--hero-fade`… never applied to cards" (`DM:232`) | A `radial-gradient` scrim sits on the gallery image and on all four card images | `D:103`, `D:166` |
| Mobile buy panel = "sticky bottom bar 64px: price left, `ADD TO CART` right" (`DM:280`) | No sticky or fixed element exists in `product-mobile.html`; no bottom bar | `M:1-335` (zero `position:sticky`/`position:fixed` matches) |
| Body copy 15–17px, default 16px/1.5, "Body text stays 16px at every breakpoint" (`DM:105`, `DM:283`) | The only 17px/1.5 run is the desktop quote paragraph, which is **deleted** on mobile; there is no 16px body paragraph on the PDP at all | `D:135`; `M` has zero `<p>` |
| Mobile table rows become "key/value stack: key 11px label above value" (`DM:278`) | Mobile keeps the two-column `1fr 1fr` row | `M:104` |
| Spacing scale 8/16/24/32/48/80/120, "Nothing off-scale" (`DM:204`) | 21 distinct off-scale values in use (see §5.3) | `D`/`M` throughout |
| Mobile section gap 56px, desktop 96–120px (`DM:205`, `DM:272`) | Desktop section gaps 96/120px — agrees. Mobile uses 56px for the quote band and footer but **112px** above `Specifications` | `M:102` |
| Fonts: Barlow Condensed + Barlow only, "No third font" (`DM:87`) | The `<link>` also loads **Michroma** and **Manrope** (400/500/700/800); neither is referenced by any style | `D:9`, `M:9` |
| Display tracking −0.015em, leading 0.92, uppercase, 700 (`DM:96`) | `--display-tracking:-0.015em`, `--display-leading:0.92`, `--display-weight:700`, `--display-transform:uppercase` — **agrees exactly** | `D:29-32` |
| Badge spec: 24px, `0 10px`, 11px +0.10em, line-height 24px; WINTER accent-filled, others muted outline (`DM:179-182`) | Matches, except outline badges use `line-height:22px` (to compensate for the 1px border) | `D:108`, `D:172` |
| Card hover `translateY(-2px)`, 150ms `cubic-bezier(.2,0,0,1)` (`DM:154`) | Exactly that — **agrees** (only the border colour token differs) | `D:50`, `D:163` |

---

## 7. Assets and data needing replacement

### 7.1 External / hotlinked resources
- **Google Fonts** (the only external hosts in either file, `D:7-9`, `M:7-9`):
  - `https://fonts.googleapis.com` (preconnect)
  - `https://fonts.gstatic.com` (preconnect, crossorigin)
  - `https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;700&family=Michroma&family=Manrope:wght@400;500;700;800&display=swap`
  - Michroma and Manrope are fetched but never used; Barlow Condensed 600 is fetched but never used. Self-host and trim to Barlow Condensed 700 + Barlow 400/500/700.
- **No hotlinked images.** All five `src` values are repo-relative under `assets/`.

### 7.2 Local image assets referenced
| src | alt | Used at | On disk |
|---|---|---|---|
| `assets/logo/platinum-wheels-logo-transparent.png` | `Platinum Wheels` | header (64px D / 52px M) and footer (120px both) | present, 2,506,640 bytes — needs optimisation/SVG |
| `assets/products/zeta-antarctica-sport.png` | `Zeta Antarctica Sport` | PDP gallery + similar card 3 | present, 824,024 bytes |
| `assets/products/zmax-winterhawk.png` | `ZMAX Winterhawk` | similar card 1 | present, 593,534 bytes |
| `assets/products/mazzini-snowleopard.png` | `Mazzini Snowleopard` | similar card 2 | present, 906,711 bytes |
| `assets/products/zmax-landgema.png` | `ZMAX Landgema` | similar card 4 | present, 456,634 bytes |

Also present in `assets/products/` but unused by the PDP: `spec1-sp51.png`, `touren-tr76.png`, `touren-tr79.png`. `assets/photos/` holds `accessories.png`, `tires-tile.png`, `wheels-tile.png`, `winter-tacoma.png` — none used here. `assets/logo/platinum-wheels-logo.png` (the white-background original) is unused here.

### 7.3 Hard-coded contact details
| Value | Where |
|---|---|
| `tel:+16479896178` | `D:92` (header), `D:119` (buy panel `Call us`), `M:80` (header round button), `M:100` (buy panel `Call us`) |
| `Call 647-989-6178` (visible label) | `D:92` |
| `Brampton, Ontario · Prices in CAD, before tax` | `D:371`, `M:331` |
| `© 2026 Platinum Wheels and Tire Solutions Inc.` | `D:370`, `M:330` |
| No street address appears on either artboard. |

All 25 non-`tel:` anchors are `href="#"` placeholders (nav ×4, logo ×2, card CTAs ×4, buy-panel primary, `Send inquiry`, socials ×3, footer links ×9 — per file).

### 7.4 Placeholder / sample personal data (must be replaced before launch)
| Field | Value | Where |
|---|---|---|
| Full name (filled value) | `Priya Sandhu` | `D:137`, `M:109` |
| Email (partially typed, caret shown) | `priya.s@` | `D:138`, `M:110` |
| Phone placeholder | `(905) 000-0000` | `D:139`, `M:111` |
| Quantity select value | `4 tires` | `D:146`, `M:115` |
| Preferred contact selected | `Phone` (of `Phone` / `Email` / `WhatsApp`) | `D:147`, `M:116` |
| Message placeholder (desktop) | `Anything we should know — current tires, storage, install timing…` | `D:150` |
| Message placeholder (mobile) | `Anything we should know…` | `M:117` |
| Consent copy | `Yes, send me seasonal offers and tire tips from Platinum Wheels. You can unsubscribe anytime.` | `D:151`, `M:118` |
| Inferred vehicle context | `2021 Honda Civic` (chip), `your Civic` (desktop paragraph) | `D:136`, `D:135`, `M:108` |

### 7.5 The full product record shown (PDP subject)

| Attribute | Value (verbatim) |
|---|---|
| Brand | `Zeta` |
| Product name / title | `Antarctica Sport` |
| Full name as used in copy | `Zeta Antarctica Sport` |
| Breadcrumb leaf (desktop) | `Zeta Antarctica Sport` |
| Breadcrumb leaf (mobile) | `Antarctica Sport` |
| Size string (buy panel) | `215/55R16 97T XL` |
| Price | `$129 CAD` |
| Price qualifiers | `from` … `per tire · before tax` |
| Badges | `Winter` (accent fill), `3PMSF` (outline, with icon on desktop), `M+S` (outline) |
| Image | `assets/products/zeta-antarctica-sport.png`, alt `Zeta Antarctica Sport` |
| Quantity options | `1`, `2`, `4` (selected), `Custom` |
| Primary CTA | `Request a quote` |
| Secondary CTA | `Call us` → `tel:+16479896178` |
| Spec — Brand | `Zeta` |
| Spec — Model | `Antarctica Sport` |
| Spec — Size | `215/55R16` |
| Spec — Season | `Winter (studdable)` |
| Spec — Load / speed | `97T XL` |
| Spec — 3PMSF | `Yes` |
| Quote-band context chip | `Zeta Antarctica Sport 215/55R16 · 2021 Honda Civic` |

Note the size is rendered two ways: `215/55R16 97T XL` (space-separated, buy panel) and `215/55R16 · 97T XL` (middot-separated, similar-product cards). The spec table splits them into `Size` and `Load / speed`.

### 7.6 The four related-product records (sample data)

| Brand | Name | Size | Season badge | 3PMSF | Price | Image |
|---|---|---|---|---|---|---|
| `ZMAX` | `Winterhawk` | `215/55R16 · 97T XL` | `Winter` | yes | `from $119 CAD / tire` | `assets/products/zmax-winterhawk.png` |
| `Mazzini` | `Snowleopard` | `215/55R16 · 97T XL` | `Winter` | yes | `from $115 CAD / tire` | `assets/products/mazzini-snowleopard.png` |
| `Zeta` | `Antarctica Sport` | `235/40R18 · 95T XL` | `Winter` | yes | `from $149 CAD / tire` | `assets/products/zeta-antarctica-sport.png` |
| `ZMAX` | `Landgema` | `235/40R18 · 95W XL` | `All-Season` | no | `from $124 CAD / tire` | `assets/products/zmax-landgema.png` |

Every card CTA reads `Request a quote`. The third card is the **same product as the PDP subject** in a different size — a real "similar products" feed should not return the current product.

### 7.7 Other copy that reads as sample content
- `Winter 2026` footer link (dated campaign label) — `D:339`, `M:301`.
- `© 2026` in the legal line — a hard-coded year.
- `Get your quote` / `Tell us where to send it.` — section copy, appears final.
- Desktop-only paragraph `We check the fitment against your Civic, confirm stock, and reply with a firm price and a secure payment link.` names a specific vehicle; it must be templated or genericised, and note it is **missing entirely from mobile**.
