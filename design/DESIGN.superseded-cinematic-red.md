# Platinum Wheels and Tire Solutions — Design System

Brampton, Ontario · tyres, wheels, accessories · consumer retail
Family: **Cinematic Dark** · Accent: **Racing Red** · Type: **Barlow Condensed / Barlow**

Reference sites studied (structure and content, not styling): vertextires.ca (services menu, brand grid, install booking, FAQ), canadaoffroad.com (search by vehicle / size / SKU as the front door, brand tiles, FR/EN), vossenwheels.com (cinematic dark, video hero, wheel + vehicle galleries, "starting at $1,900 ea." pricing).

---

## 0. Logo

`assets/logo/platinum-wheels-logo.png` (2000×2000, supplied). Circular chrome badge: tyre and multi-spoke wheel at three-quarter angle, chrome wing bars, black plate with chrome **PLATINUM** and spaced **WHEELS** beneath.

- The supplied file has a **flat white background, no transparency**. On the black site it must be used as a cut-out; a transparent PNG/SVG is needed before launch. Until then, render it inside a white square plate only where a white plate is acceptable (invoices, print), and use the **wordmark** in the nav.
- Nav wordmark: `PLATINUM WHEELS` in Barlow Condensed 700, 22px, uppercase, tracking −1%, white. The badge sits in the footer (120px) and on the homepage hero only if a transparent version exists.
- Minimum size 48px. Clear space = 1/8 of the badge diameter on every side. Never recolour, never add glow or shadow, never place on `--accent`.
- The badge is already chrome-on-black, which is the whole palette: it needs no accent near it. A red element within 48px of the logo breaks the one-accent rule.

---

## 1. Visual theme & atmosphere

The site is a dark studio. Every page is a true-black slab (`#000000`) on which one object sits under a single hard light: a tyre, a wheel, a tread macro. Photography is treated as sculpture, not decoration. Text is white, oversized, condensed and uppercase, set flush-left against the photo so the two share one edge. One red element per frame carries the eye: a CTA, a hairline, a price numeral. Nothing else is coloured.

The mood is a quiet showroom at night, not a race broadcast. Motion is decisive and brief. Depth comes from tonal steps and 1px hairlines, never from shadows or blur. The same frame must hold a $190 all-season tyre and a $1,900 forged wheel with equal confidence: the price size, the photo treatment and the layout do not change with price, only the copy does.

Three things to keep in view:

- **Black is a material, not an absence.** Let it breathe. Sections break with 96–120px of air, not with boxes.
- **The object is the hero.** Type sits beside or beneath it; it never competes with it.
- **Red is a scalpel.** One cut per frame.

---

## 2. Colour palette & roles (CSS tokens)

```css
:root {
  /* Ground — tonal steps */
  --bg:          #000000;   /* page, hero slabs, nav */
  --bg-alt:      #0a0a0a;   /* alternating section bands, input fill */
  --surface:     #141414;   /* cards, drawers, table header, dropdowns */
  --border:      #1f1f1f;   /* card edges, input borders, hairlines on --surface */
  --rule:        #2a2a2a;   /* hairlines on --bg, table row dividers, nav underline */

  /* Ink */
  --text:        #ffffff;   /* headlines, prices, body on dark */
  --text-muted:  #b8b8b8;   /* body copy, labels, ALL-SEASON badge */
  --text-dim:    #6a6a6a;   /* meta, placeholders, disabled */

  /* Accent — racing red */
  --accent:        #e10600; /* primary CTA fill, WINTER badge, the one red element */
  --accent-hover:  #ff1a12; /* CTA hover fill (instant) */
  --accent-deep:   #9e0400; /* card hover border, pressed state, diagonal stripe */
  --on-accent:     #000000; /* text on accent fill */
}
```

**Why racing red.** Of the four candidates it is the only one that reads as automotive without reading as "warning" (yellow), "sale" (orange) or "tech" (lime). On pure black it holds saturation at small sizes (a 1px rule, a 12px badge) where the others wash out or vibrate.

### Roles

| Role | Token | Notes |
|---|---|---|
| Page ground | `--bg` | Never lightened for "sections"; use `--bg-alt` bands instead |
| Alternate band | `--bg-alt` | At most every other section |
| Card / panel | `--surface` + `1px --border` | Cards always have the hairline; the tonal step alone is too subtle on photos |
| Row divider | `1px --rule` | Tables, nav underline, spec lists |
| Body copy | `--text-muted` | Body is never pure white; headlines and prices are |
| Meta / placeholder | `--text-dim` | Minimum contrast use — never below 12px |
| Primary CTA | `--accent` fill, `--on-accent` text | |
| Card hover | border → `--accent-deep` | Deep, not bright: hover should not compete with the CTA |
| WINTER badge | `--accent` fill, black text | |
| ALL-SEASON badge | transparent, `1px --text-muted` outline, `--text-muted` text | |
| Focus ring | `2px --accent`, no offset | |

### The one-accent rule

Within any visual frame (a hero, a card, a table row, a modal, one viewport of a section) the accent appears **once**. It may be a button, a numeral, a 1–2px rule, a badge or a stripe — but only one, and two accent elements must never touch or sit adjacent. A product card with a WINTER badge therefore has a **secondary (ghost)** add-to-cart button, not a primary one. A hero with a red CTA has a white price. If a frame seems to need two, the frame is doing two jobs; split it.

Never use the accent for: body text, icons at rest, backgrounds larger than a badge, borders on inputs at rest, hover text colour.

---

## 3. Typography rules

Two families, loaded from Google Fonts. No third font, no serif, never Inter.

```css
--font-display: "Barlow Condensed", "Oswald", "Arial Narrow", sans-serif;
--font-body:    "Barlow", "IBM Plex Sans", Helvetica, sans-serif;
```

### Display (Barlow Condensed 700)

- Always uppercase, weight 700, tracking `-0.015em` (range −1% to −2%), line-height `0.92`.
- Desktop scale: **40 / 56 / 88 / 120**. Mobile scale: **32 / 40 / 56** (120 and 88 both collapse to 56).
- 120 is reserved for the homepage hero and campaign landers, one per page. 88 for section heroes and PDP titles. 56 for section headings. 40 for card group titles and modal titles.
- Flush-left. Never centred, never justified, never letterspaced wide.
- Display type may overlap the photo edge by up to one column; it never sits over the subject's highlight.
- Maximum two lines at 120/88; three at 56.

### Body & UI (Barlow 400/500)

- 15–17px; default 16px, line-height 1.5, colour `--text-muted`. Product descriptions at 17px, dense UI (cart, spec tables) at 15px.
- Paragraph measure 60–72 characters; on the 60/40 split the text column caps at 560px.
- Weight 500 for UI controls and inline emphasis. 700 is reserved for numerals.
- Sentence case for everything except labels and buttons.

### Labels (Barlow 500)

- 11–12px, uppercase, tracking `+0.10em`, colour `--text-muted` (or `--text-dim` for tertiary meta).
- Used for: eyebrow above headlines, field labels, badge text, table headers, spec keys, nav items at small sizes.

### Numerals

- Prices and tyre sizes (`215/55R16`, `18×8.5 ET35`) are always Barlow 700 with `font-variant-numeric: tabular-nums lining-nums`.
- Price scale: 32px in cards and rows, 56px on the PDP, in `--text`. Currency symbol and cents are the same size and weight — no superscript cents, no small `$`.
- Tyre sizes render as a single unbroken run: `215/55R16`, no spaces. Wheel sizes use `×`, not `x`.
- Prices are never red. Sale prices: current price in `--text`, original in `--text-dim` with line-through, same size. The word SALE is a label, not a colour.

### Copy voice

Short, declarative, specific. Brands and sizes over adjectives. "Michelin X-Ice Snow · 215/55R16" beats "Premium winter performance". CTAs are two words max: `ADD TO CART`, `BOOK INSTALL`, `FIND MY SIZE`. Address the customer as "you"; refer to the shop as "we". No exclamation marks, no emoji.

---

## 4. Component stylings

All radii 0–4px. Default radius **2px** on interactive elements, **0** on cards, tables, images and badges. Nothing is a pill.

### Button

| | Primary | Secondary (ghost) | Tertiary (text) |
|---|---|---|---|
| Fill | `--accent` | transparent | transparent |
| Border | none | `1px solid --text` | none |
| Text | `--on-accent` (black) | `--text` | `--text` |
| Hover | fill → `--accent-hover` (instant) | fill → `--text`, text → `#000` | underline 1px `--text` |
| Active | fill → `--accent-deep` | fill → `--text-muted` | opacity 0.7 |
| Disabled | fill `--surface`, text `--text-dim`, border `--border` | border `--border`, text `--text-dim` | text `--text-dim` |

- Type: Barlow 500, 14px, uppercase, tracking `+0.06em`, line-height 1.
- Padding `14px 28px`. Small: `10px 20px`, 13px. Height results, not fixed.
- Radius 2px. Focus: `box-shadow: 0 0 0 2px var(--accent)` with **no offset**; on a primary button the ring is white instead (accent-on-accent is invisible).
- Transitions: `background-color 0ms`. Hover is an instant fill change, not a fade.
- Icon buttons: 44×44 minimum, ghost style, icon 20px, stroke 1.5.

### Card (product)

- `background: --surface; border: 1px solid --border; border-radius: 0; padding: 0`.
- Image area: square, black (`--bg`) ground, product photo on black, no inset border. Aspect 1:1 for tyres and wheels, 4:3 for accessories.
- Body padding 24px. Order: badge row (optional) → brand label (11px, muted) → product name (Barlow Condensed 700, 28px, uppercase) → size numeral (Barlow 700 15px, tabular) → price (32px, 700) → button.
- Hover: `border-color → --accent-deep; transform: translateY(-2px)`, 150ms `cubic-bezier(.2,0,0,1)`. Photo does not zoom.
- Accent budget: if a WINTER badge is present, the button is ghost. Otherwise primary. Never both accent.
- Cards sit in a grid with 24px gutters and **no card shadow, ever**.

### Input

- Fill `--bg-alt`, `1px solid --border`, radius 2px, height 48px, padding `0 16px`, text 16px Barlow 400 `--text`, placeholder `--text-dim`.
- Label above: 12px uppercase +10% tracking `--text-muted`, 8px gap.
- Hover: border → `--rule`. Focus: `border-color: --accent; box-shadow: 0 0 0 2px --accent`, no offset, 0ms.
- Error: border `--accent`, helper text 13px `--text-muted` (not red — the border is the one accent). Disabled: fill `--surface`, text `--text-dim`.
- Tyre-size finder inputs (width / ratio / rim) are the same component with Barlow 700 tabular numerals and `text-align: center`, widths 96/80/80px, joined by `/` and `R` glyphs in `--text-dim` at 20px.
- Select uses the same box with a 16px chevron (1.5 stroke) in `--text-muted`; no native arrow.

### Nav

- Height 72px desktop, 56px mobile. Background `--bg`, bottom `1px solid --rule`. Not transparent over the hero; not blurred. Sticky on desktop; on mobile it scrolls away and returns on scroll-up.
- Left: wordmark in Barlow Condensed 700, 22px, uppercase, tracking −1%: `PLATINUM WHEELS`. The chrome badge (see §0) is used at 40px beside the wordmark only once a transparent cut-out exists.
- Utility bar above the nav (optional, 36px, `--bg-alt`, bottom `--rule`): Brampton address · phone · `EN / FR` toggle · account. 12px labels in `--text-dim`.
- Centre-left, 32px after wordmark: items in Barlow 500 13px uppercase +10% tracking `--text-muted`. Hover: `--text` (instant). Current: `--text` with a 2px `--accent` underline flush to the nav's bottom hairline — this is the nav's single accent.
- Right: search icon, account icon, cart icon with count. Cart count is a 16px black-on-white square (not a red dot — the underline already spent the accent). 44px hit targets.
- Mega-menu panel: `--surface`, top border `--rule`, items in 4 columns at 1320px max; category headings 11px labels; product links 15px.
- Mobile: full-screen drawer on `--bg`, items in Barlow Condensed 700 40px uppercase, stacked left, 16px gap.

### Badge

- Height 24px, padding `0 10px`, radius 0, Barlow 500 11px uppercase +10% tracking, line-height 24px.
- **WINTER**: fill `--accent`, text `--on-accent`. Spends the frame's accent.
- **ALL-SEASON**: transparent, `1px solid --text-muted`, text `--text-muted`.
- **SUMMER / PERFORMANCE / OEM / SALE**: same treatment as ALL-SEASON (outline, muted). Only WINTER gets colour — it is the shop's seasonal money-maker and the most common decision a Brampton driver makes.
- Placed top-left inside the card image at 16px inset, or inline before the product name in rows. Never more than two badges per card; if two, WINTER first.

### Chip (filter)

- Height 36px, padding `0 14px`, radius 2px, Barlow 500 13px sentence case, `1px solid --border`, text `--text-muted`, fill transparent.
- Hover: border `--rule`, text `--text`. Selected: fill `--text`, text `#000`, border `--text`. Removable chips show a 14px `×` after 8px gap.
- Chips are never accent. A row of chips wraps with 8px gaps; the row is preceded by a 12px label (`FILTER BY`).

### Table row (spec list, cart, compare)

- Row height 56px min, `border-bottom: 1px solid --rule`, no fill on odd/even. Header row: `--surface` fill, 11px labels, `--text-muted`, 48px height.
- Cell padding `0 16px`; first cell flush to the container's left edge (0 left padding), last cell flush right.
- Key column (spec name): 15px `--text-muted`. Value column: 15px `--text`, numerals 700 tabular, right-aligned when numeric.
- Row hover: background `--bg-alt`, instant. Selected row (compare): `2px solid --accent` on the left edge — one accent per table.
- Cart row: thumb 64×64 on `--bg`, name in Barlow Condensed 700 20px, size numeral below, quantity stepper is two 32px ghost icon buttons around a tabular numeral, line price 700 right-aligned.

---

## 5. Layout principles

- **Grid**: 12 columns, 24px gutter, max content width 1320px, centred container with 24px side padding (16px on mobile).
- **Spacing scale**: 8 / 16 / 24 / 32 / 48 / 80 / 120. Nothing off-scale.
- **Section breaks**: 96–120px vertical on desktop, 56px on mobile. Sections are separated by air or a single hairline, not by boxes or colour blocks. Alternate `--bg` / `--bg-alt` bands at most every other section.
- **Asymmetry is the default.** Split layouts are 60/40 (7/5 columns) or 40/60, never 50/50, never centred stacks. The photo takes the 60 when the object is the message; the type takes the 60 when the offer is the message. Flip the split between consecutive sections so the eye zig-zags down the page.
- **Left edge alignment.** Headline, body, CTA, price and image share one left edge inside their column. Ragged right always.
- **Hero**: full-bleed photo at 100vw × min(88vh, 900px), bottom fade (`--hero-fade`) for text contrast, headline at 120px in the lower-left, eyebrow label above, one primary CTA below. The price, if shown, is white.
- **Finder** (the front door, directly under the hero): a `--surface` panel with three tabs as chips — `BY VEHICLE` · `BY SIZE` · `BY SKU` — and a single row of inputs ending in one primary `FIND TYRES` button. Sits in the left 7 columns; the right 5 hold a one-line install offer ("Installed in Brampton. Alignment, balancing, seasonal swap.") in `--text-muted`.
- **Brand grid**: brand names set in Barlow Condensed 700 32px uppercase `--text-muted`, hover → `--text`, in a hairline grid (`--rule` between cells), 6 columns. No logos unless supplied as monochrome white.
- **Services**: numbered list (`01`–`06`) — Installation, Alignment, Balancing, Seasonal changeover, TPMS, Rotation — each row 88px, numeral 700 tabular `--text-dim`, title 40px display, one-line body, hairline dividers. Rows, not tiles.
- **Gallery**: fitted-vehicle photos in a 60/40 pair per row, captions as 11px labels (`AUDI SQ8 · 22×10.5 · GLOSS BLACK`).
- **Product grids**: 4-up at 1320, 3-up under 1100, 2-up under 720, 1-up under 400. Cards are equal height within a row via grid, not fixed heights.
- **PDP**: 60/40 — gallery left (sticky), buy panel right. Buy panel order: brand label → title (88 → 56 mobile) → size numeral → price (56) → season badge → quantity + `ADD TO CART` → install line ("Installed in Brampton from $25/tyre") → spec table.
- **Diagonal stripe**: one 1–2px `--accent-deep` line at 135° spanning the container width, used as a section divider at most **twice per page**. It counts as that section's accent.
- **Whitespace over dividers.** If two sections read as separate without a rule, drop the rule.

---

## 6. Depth & elevation

Depth is contrast, not shadow. Three tonal steps and one hairline weight do all the work.

| Level | Ground | Edge | Used for |
|---|---|---|---|
| 0 | `--bg #000` | — | Page, hero, nav, image grounds |
| 1 | `--bg-alt #0a0a0a` | optional `--rule` top/bottom | Alternate section bands, input fill, row hover |
| 2 | `--surface #141414` | `1px --border` | Cards, drawers, dropdowns, table headers, modals |

- Nothing sits above level 2. A modal is a level-2 panel on a `rgba(0,0,0,0.8)` scrim — flat black, **not blurred**.
- **No drop shadows, no inner shadows, no neumorphism, no backdrop-filter, no glass.**
- **No gradient fills** except `--hero-fade`: a bottom-up black fade over hero photography, opaque black at the baseline to transparent at ~55% height. It exists for text contrast only and is never applied to cards or buttons.
- Hairlines: `--border` on `--surface`; `--rule` on `--bg` and `--bg-alt`. Never a 2px border except the focus ring and the selected-row edge.
- Images: no border, no radius, no vignette beyond what the studio lighting provides. Product photos are cut out onto pure black so the card ground and image ground are the same colour — the tyre appears to sit *in* the card, not *on* a picture.

---

## 7. Do's and Don'ts

**Do**
- Set one accent element per frame and make it the thing you want clicked or read.
- Use real photography: low-key studio on black, tread macros, wet asphalt, Ontario winter road. The subject is always a tyre or wheel.
- Put display type flush-left and let it run large — 88px is normal, not brave.
- Show prices in white Barlow 700 tabular, at the same size for a $190 tyre and a $1,900 wheel.
- Use 60/40 splits and flip them between sections.
- Make hovers instant and lifts 2px.
- Leave 96–120px between sections.
- Use `--text-muted` for body; save pure white for headlines and numbers.

**Don't**
- Don't put two accent elements in one frame, or let a red badge sit next to a red button.
- Don't use drop shadows, blur, glass, gradients (other than the hero fade), or rounded corners past 4px. No pill buttons.
- Don't centre headlines, hero copy or card stacks.
- Don't use lifestyle stock (people smiling by cars), illustrations, 3D renders, or icon grids on flat black to fill a section.
- Don't use purple/blue, gradient text, or a second accent for "info" or "success" states — use white outline and copy.
- Don't set prices in red, superscript cents, or shrink the `$`.
- Don't use Inter, Roboto, Arial, or any serif.
- Don't add parallax, scroll-jacking or auto-playing video on mobile.
- Don't lighten black to make "sections" — use `--bg-alt` bands or air.
- Don't place the white-background logo file directly on black; use the wordmark until a transparent cut-out exists.
- Don't use marquee/ticker bars, emoji in promo copy, or lock icons on brand tiles.

---

## 8. Responsive behaviour

Breakpoints: **≥1320** (container caps), **1100**, **720**, **400**.

| | Desktop ≥1100 | Tablet 720–1099 | Mobile <720 |
|---|---|---|---|
| Display scale | 40/56/88/120 | 40/56/72/88 | 32/40/56 |
| Section gap | 96–120px | 80px | 56px |
| Side padding | 24px | 24px | 16px |
| Product grid | 4-up (3 <1100) | 3-up / 2-up | 2-up (1-up <400) |
| 60/40 splits | side by side | side by side, 55/45 | stack; photo first when the object is the hero, type first when the offer is |
| Nav | 72px, inline items, sticky | 72px, items collapse to menu button | 56px, full-screen drawer, hides on scroll-down |
| Hero | 88vh, headline 120 | 70vh, headline 88 | 100svh, headline 56, CTA full width |
| Table rows | tabular columns | tabular columns | key/value stack: key 11px label above value; cart rows become 2-line cards with hairline dividers |
| Buttons | inline | inline | primary CTA full-width in buy panel and drawers; padding stays 14/28 |
| Buy panel | sticky right column | below gallery | sticky bottom bar 64px: price left, `ADD TO CART` right |
| Motion | hover fills, 2px lifts | same | no hover states; tap = active state; **no parallax** |

- Body text stays 16px at every breakpoint; the display scale shrinks, the reading size does not.
- Images use `object-fit: cover` with focal point set to the subject; the hero fade persists at every size.
- Touch targets ≥44px. Chips grow to 40px on touch.
- Hairlines stay 1px; do not scale with DPR.

---

## 9. Agent prompt guide

Paste this block into any prompt that should produce Platinum Wheels UI.

```
You are designing for Platinum Wheels and Tire Solutions (Brampton, Ontario tyre & wheel retailer).
Style family: Cinematic Dark. Load ./styles.css and use only its tokens.

GROUND: page #000 (--bg). Bands #0a0a0a (--bg-alt). Cards #141414 (--surface) with 1px #1f1f1f border. Hairlines #2a2a2a (--rule).
INK: headlines & prices #fff. Body #b8b8b8. Meta #6a6a6a.
ACCENT: racing red #e10600 (--accent), hover #ff1a12, deep #9e0400. Exactly ONE accent element per visual frame (a CTA, a rule, a numeral, or a WINTER badge). Never two touching. Prices are never red.
TYPE: Barlow Condensed 700 uppercase, tracking -1.5%, line-height .92 for headlines at 40/56/88/120 (mobile 32/40/56). Barlow 400 16px/1.5 for body. Labels Barlow 500 11-12px uppercase +10% tracking. Prices and tyre sizes Barlow 700 tabular-nums. No Inter, no serif.
SHAPE: radius 0-4px. No pills. Primary button: red fill, black uppercase text +6% tracking, padding 14px 28px. Secondary: 1px white ghost. Inputs: #0a0a0a fill, 1px border, focus = 2px red ring, no offset.
DEPTH: tonal steps and 1px hairlines only. No shadows, blur, glass, or gradients — except a bottom black fade over hero photos. Optional single 1-2px diagonal red-deep stripe as section divider, max twice per page.
MOTION: instant hover fills; card hover = border #9e0400 + translateY(-2px), 150ms. No parallax on mobile.
LAYOUT: 12 col, 24px gutter, 1320px max, 8px scale (8/16/24/32/48/80/120). Sections 96-120px apart (56 mobile). Asymmetric 60/40 splits, flush-left type. Never centre everything.
IMAGERY: real photography only — tyre/wheel as sculpture on black, tread macros, wet asphalt, Ontario winter road. Use a striped placeholder labelled with the intended shot if no photo exists. No lifestyle stock, illustrations, 3D renders, icon grids.
BADGES: WINTER = red fill black text. ALL-SEASON and others = 1px #b8b8b8 outline, #b8b8b8 text.
COPY: short, specific, brand + size over adjectives. CTAs ≤2 words uppercase. "You"/"we". No exclamation marks, no emoji.
Same treatment for a $190 tyre and a $1,900 wheel.
```

**Checklist before shipping a screen**
1. Count the red elements per frame. If >1, demote one to white.
2. Is anything centred that could be flush-left?
3. Any shadow, blur, gradient or radius >4px? Remove it.
4. Is the headline at least 56px on desktop?
5. Are prices white, 700, tabular, with full-size `$` and cents?
6. Is the photo a tyre or wheel on black?
7. Sections ≥96px apart on desktop?

---

Files: `styles.css` (token entry) · `tokens/` · `components/core/` (Button, Card, Input, Nav, Badge, Chip, TableRow) · `guidelines/` (specimen cards) · `ui_kits/storefront/` (homepage + PDP) · `readme.md` · `SKILL.md`
