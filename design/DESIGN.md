# Platinum Wheels and Tire Solutions — Design System

Brampton, Ontario · tires, wheels, accessories · consumer retail
Family: **Cinematic Dark** · Theme: **Track Night (B)** · Accent: **Acid Lime `#C9F23A`** · Type: **Barlow Condensed / Barlow**

Track Night is the shipped identity. Three alternates were built and reviewed alongside it — Midnight Platinum (chrome accent, Michroma display), Showroom Light (light ground), Ember Garage (orange accent) — and remain in `Storefront Mockups.dc.html` behind the Theme tweak for reference only. Everything below describes Track Night; do not mix tokens across themes.

Reference sites studied (structure and content, not styling): vertextires.ca (brand list, size/vehicle search, service menu), canadaoffroad.com (search by vehicle / size as the front door), vossenwheels.com (cinematic dark, photography as sculpture, "starting at" pricing).

**The site does not take payment.** Every product path ends in *Request a quote* — a person confirms fitment and stock, then sends a firm price. There is no cart, no checkout, no account. Design for inquiry, not transaction.

---

## 0. Logo

`assets/logo/platinum-wheels-logo-transparent.png` — circular chrome badge: tire and multi-spoke wheel at three-quarter angle, chrome wing bars, black plate with chrome **PLATINUM** and spaced **WHEELS** beneath. The transparent cut-out is the working file; the white-plate original (`platinum-wheels-logo.png`) is for print and invoices only.

- Nav: badge at 40px beside the wordmark `PLATINUM WHEELS` in Barlow Condensed 700, 20px, uppercase, tracking −1.5%, `--text`.
- Footer: badge at 72–120px, wordmark below.
- Minimum size 40px. Clear space = 1/8 of the badge diameter on every side. Never recolour, never add glow or shadow, never place on `--accent`.
- The badge is chrome-on-black and reads as its own accent. No lime element within 48px of it.

---

## 1. Visual theme & atmosphere

The site is a dark studio. Every page is a near-black slab on which one object sits under a single hard light: a tire, a wheel, a tread macro. Photography is treated as sculpture, not decoration. Type is white, condensed, uppercase and oversized, set flush-left so headline and photo share one edge. One lime element per frame carries the eye — a CTA, a hairline, a badge, a numeral. Nothing else is coloured.

The mood is a quiet garage at night, not a race broadcast. Motion is decisive and brief. Depth comes from tonal steps and 1px hairlines, never shadow or blur. The same frame must hold a $99 all-season tire and a $1,900 forged wheel with equal confidence: photo treatment, price size and layout do not change with price — only the copy does.

- **Black is a material, not an absence.** Sections break with 96–120px of air, not with boxes.
- **The object is the hero.** Type sits beside or beneath it; it never competes.
- **Lime is a scalpel.** One cut per frame.

---

## 2. Colour palette & roles (CSS tokens)

```css
:root {
  /* Ground — tonal steps */
  --bg:            #0B0B0D;  /* page, hero slabs, nav, image grounds */
  --surface:       #16161A;  /* cards, panels, drawers, table header */
  --surface-2:     #1F1F24;  /* inputs, selects, nested fills, row hover */
  --border:        #1F1F24;  /* card edges, hairlines on --surface */
  --border-strong: #35353B;  /* input borders, panel edges, dividers on --bg */

  /* Ink */
  --text:          #F4F4F5;  /* headlines, prices, values */
  --text-muted:    #A7A7AE;  /* body copy, labels, ALL-SEASON badge */
  --text-dim:      #8B909A;  /* meta, placeholders, disabled */
  --on-photo:      #F4F4F5;  /* any text sitting on photography, in any theme */

  /* Accent — acid lime */
  --accent:        #C9F23A;  /* primary CTA fill, WINTER badge, the one lime element */
  --accent-hover:  #DDFF6B;  /* CTA hover fill, card hover border */
  --accent-subtle: rgba(201,242,58,0.12); /* winter feature band ground only */
  --on-accent:     #0B0B0D;  /* text on accent fill */

  /* Seasonal ink (spec tables, legends — never large areas) */
  --winter:        #8FC9F2;
  --all-season:    #D9C29A;

  /* Photographic scrims (only permitted gradients) */
  --scrim-strong:  rgba(11,11,13,.92);
  --scrim-mid:     rgba(11,11,13,.68);
  --scrim-soft:    rgba(11,11,13,.38);

  --radius-ctl:    2px;
}
```

**Why acid lime.** On a near-black ground it holds saturation at 1px and 11px, where red goes muddy and orange reads as a sale tag. It is unmistakably motorsport without belonging to any manufacturer, and against the chrome logo it reads as instrument lighting rather than branding.

### Roles

| Role | Token | Notes |
|---|---|---|
| Page ground | `--bg` | Never lightened to mark a "section"; use air or `--surface` panels |
| Card / panel | `--surface` + `1px --border` | Cards always carry the hairline; the tonal step alone is too subtle beside photos |
| Input / nested fill | `--surface-2` + `1px --border-strong` | |
| Divider | `1px --border-strong` on `--bg`, `1px --border` on `--surface` | |
| Body copy | `--text-muted` | Body is never pure white; headlines, prices and spec values are |
| Meta / placeholder | `--text-dim` | Never below 11px |
| Text on photography | `--on-photo` over a scrim | Never `--text-muted` on a photo |
| Primary CTA | `--accent` fill, `--on-accent` text | |
| Card hover | border → `--accent-hover`, `translateY(-2px)` | |
| WINTER badge | `--accent` fill, `--on-accent` text | |
| ALL-SEASON badge | transparent, `1px --text-muted` outline, `--text-muted` text | |
| Unavailable badge | `--surface-2` fill, `1px --text-dim`, `--text-dim` text | |
| Focus ring | `2px --accent`, no offset | |

### The one-accent rule

Within any visual frame — a hero, a card, a table, a modal, one viewport of a section — the accent appears **once**. It may be a button, a numeral, a 1–2px rule, a badge or a stripe, but only one, and two accent elements must never touch. A card carrying a WINTER badge therefore gets a ghost *Request a quote* button when it sits beside another accent; in an otherwise quiet grid the badge and CTA are far enough apart to coexist — judge by the frame, not the component.

Never use the accent for: body text, icons at rest, areas larger than a badge or a button, input borders at rest, hover text colour, prices.

---

## 3. Typography rules

Two families from Google Fonts. No third font, no serif, never Inter.

```css
--font-display: "Barlow Condensed", "Oswald", "Arial Narrow", sans-serif;
--font-body:    "Barlow", "IBM Plex Sans", Helvetica, sans-serif;
```

Display metrics are tokenised so a theme can retune them without touching markup: `--display-weight: 700`, `--display-tracking: -0.015em`, `--display-leading: 0.92`, `--display-transform: uppercase`, and a three-step scale ramp `--scale-hero / --scale-h2 / --scale-h3` (all `1` in Track Night). Headline sizes are written as `calc(120px * var(--scale-hero))`, `calc(56px * var(--scale-h2))`, `calc(28px * var(--scale-h3))` — never as bare pixels.

### Display (Barlow Condensed 700)

- Uppercase, 700, tracking −1.5%, line-height 0.92.
- Desktop scale **40 / 56 / 88 / 120**; mobile **32 / 40 / 56**.
- 120 is the homepage hero, once per page. 88 for section heroes and PDP titles. 56 for section headings. 40 for group and card-row titles. 24–28 for product names inside cards.
- Flush-left. Never centred, never justified, never widely letterspaced.
- Display may overlap a photo edge by up to one column; it never sits over the subject's highlight.
- Maximum two lines at 120/88, three at 56.

### Body & UI (Barlow 400/500)

- 15–17px, default 16, line-height 1.5, colour `--text-muted`. Descriptions 17px; dense UI (spec rows, filters) 15px; card meta 14px.
- Measure 60–72 characters; on a 60/40 split the text column caps at 560px.
- Weight 500 for controls and inline emphasis; 700 reserved for numerals.
- Sentence case everywhere except labels and buttons.

### Labels (Barlow 500)

- 11–12px, uppercase, tracking +0.10em to +0.16em, `--text-muted` or `--text-dim`.
- Used for: eyebrows above headlines, field labels, badge text, table headers, spec keys, breadcrumbs, section numbering (`01 — Shop by category`).

### Numerals

- Prices and sizes (`215/55R16`, `97T XL`, `18×8.5 ET35`) are Barlow 700 with `font-variant-numeric: tabular-nums lining-nums`.
- Price scale: 24px in mobile cards, 28px in desktop cards, 56px on the PDP, in `--text`. Full-size `$`, no superscript cents.
- Tire sizes render unbroken: `215/55R16`. Wheel sizes use `×`, not `x`.
- Prices are never lime. Every price is prefixed `from` and suffixed `/ tire` — the quoted price is per tire, before tax and install.

### Copy voice

Short, declarative, specific. Brand and size over adjectives: "Zeta Antarctica Sport · 215/55R16" beats "premium winter performance". CTAs two to three words: `REQUEST A QUOTE`, `FIND MY TIRES`, `CALL US`. Address the customer as "you", the shop as "we". No exclamation marks, no emoji. Never promise a price the shop has not confirmed.

---

## 4. Component stylings

Radius 0–4px; `--radius-ctl: 2px` on interactive elements, 0 on cards, tables, images and badges. Nothing is a pill.

### Button

| | Primary | Secondary (ghost) | Tertiary (text) |
|---|---|---|---|
| Fill | `--accent` | transparent | transparent |
| Border | none | `1px solid --text` | none |
| Text | `--on-accent` | `--text` | `--text` |
| Hover | fill → `--accent-hover`, instant | fill → `--text`, text → `--on-accent` | underline 1px |
| Active | fill → `--accent`, `translateY(1px)` | fill → `--text-muted` | opacity .7 |
| Disabled | fill `--surface`, text `--text-dim` | border `--border`, text `--text-dim` | text `--text-dim` |

- Type: Barlow 500, 13–14px, uppercase, tracking +0.06em, line-height 1.
- Height 48px desktop / 44px mobile; padding `0 20–28px`. Radius 2px.
- Focus: `box-shadow: 0 0 0 2px var(--accent)`, no offset; white ring on a primary button.
- `transition: background-color 0ms` — hover is an instant fill change, never a fade.
- Icon buttons 44×44 minimum, ghost, 20px icon at 1.5 stroke.

### Card (product)

- `background: --surface; border: 1px solid --border; radius: 0`.
- Image area square, `--bg` ground, product cut-out at 6% padding with `object-fit: contain`, plus a radial `--scrim-mid` vignette. **All product cut-outs are normalised to one square canvas** so every card renders the tire at the same optical size.
- Body padding 24px desktop / 14px mobile. Order: badge row → brand (12–15px, 700) → model (display 24–28px) → `size · spec` (700 tabular) + 3PMSF mark → price row (`from` · `$129 CAD` · `/ tire`) → CTA.
- Badges sit top-left inside the image at 16px inset (10px mobile); the brand name sits top-right in display 11px.
- Hover: `border-color → --accent-hover; transform: translateY(-2px)`, 150ms `cubic-bezier(.2,0,0,1)`. The photo does not zoom.
- Unavailable state: image at 35% opacity, `CURRENTLY UNAVAILABLE` badge, price in `--text-dim`, ghost CTA reading `INQUIRE ABOUT RESTOCK`.
- Grid cards are equal-width by track (`minmax(0,1fr)`), equal-height by grid — never fixed heights, never shadows.

### Input

- Fill `--surface-2`, `1px solid --border-strong`, radius 2px, height 56px (48px in compact panels), padding `0 16px`, 17px Barlow 700 for values, `--text-dim` placeholders.
- Label above: 11px uppercase +0.12em tracking, `--text-dim`, 8px gap.
- Hover: border → `--text-dim`. Focus: `border-color: --accent; box-shadow: 0 0 0 2px --accent`, no offset, 0ms.
- Error: border `--accent`, helper text 13px `--text-muted` — the border is the one accent, so error copy is not coloured.
- Selects use the same box with a 16px chevron (1.6 stroke) in `--text-muted`; no native arrow.
- The vehicle finder is three selects (Year / Make / Model) plus one primary button on a single 4-column row inside a `--surface` panel that overlaps the hero by −120px.

### Nav

- Height 88px desktop / 68px mobile. On the homepage it sits transparent over the hero scrim; on every other page it is `--bg` with a `1px --border-strong` bottom hairline.
- Left: badge 40px + wordmark. Centre: `Tires · Wheels · Accessories · Services · Contact` in Barlow 500 13px uppercase +0.12em, `--text-muted`; hover → `--on-photo`, instant. Current item: `--text` with a 2px `--accent` underline flush to the bottom hairline — the nav's single accent.
- Right: phone number in 700 tabular and a ghost `GET A QUOTE` button. No cart, no account icon.
- Text over photography always uses `--on-photo`, never the theme's body ink.
- Mobile: 68px bar, hamburger left of the wordmark, phone icon right; the drawer is full-screen `--bg` with items in display 40px, stacked left, 16px gap.

### Badge

- Height 24px, padding `0 10px`, radius 0, Barlow 500 11px uppercase +0.10em, line-height 24px.
- **WINTER**: `--accent` fill, `--on-accent` text. Spends the frame's accent.
- **ALL-SEASON**: transparent, `1px --text-muted`, `--text-muted` text.
- **SUMMER / OEM / STUDDABLE**: same outline treatment. Only WINTER takes colour — it is the decision most Brampton drivers are making.
- **CURRENTLY UNAVAILABLE**: `--surface-2` fill, `1px --text-dim`, `--text-dim` text.
- Maximum two badges per card; WINTER first. Badge rows wrap rather than overflow.

### Chip (filter)

- Height 36px, padding `0 14px`, radius 2px, Barlow 500 13px sentence case, `1px solid --border-strong`, `--text-muted`, transparent fill.
- Hover: border → `--text-dim`, text → `--text`. Selected: fill `--text`, text `--on-accent`, border `--text`.
- Chips are never lime. Rows wrap at 8px gaps under a 11px label. Counts follow the name in `--text-dim` (`Zeta 4`).

### Table row (spec list, compare)

- Row height 56px, `border-bottom: 1px solid --border`; alternating rows take a `--surface` fill.
- Cell padding `0 16–24px`. Key column 16px `--text-muted`, value column 16px `--text`, 700 tabular, right-aligned.
- Row hover: `--surface-2`, instant.
- Keep spec tables to what the shop actually holds — Brand, Model, Size, Season, Load / speed, 3PMSF. Do not invent tread-depth, UTQG or warranty rows.

---

## 5. Layout principles

- **Grid**: 12 columns, 24px gutter, 1320px max content, 48px page padding desktop / 16px mobile.
- **Spacing scale**: 8 / 16 / 24 / 32 / 48 / 80 / 120. Nothing off-scale.
- **Section breaks**: 96–120px desktop, 56px mobile. Sections are separated by air or one hairline, never by boxes or colour blocks.
- **Asymmetry is the default.** Splits are 60/40 (7/5) or 55/45, never 50/50, never centred stacks. Flip the split between consecutive sections so the eye zig-zags.
- **Left-edge alignment.** Headline, body, CTA, price and image share one left edge within their column. Ragged right always.
- **Hero**: full-bleed photo 900px desktop / 720px mobile, bottom scrim ramp (`--scrim-strong` → transparent at ~55%), eyebrow label, 120px headline, one supporting line at 20px. Nav overlays it.
- **Finder**: a `--surface` panel overlapping the hero by −120px, Year / Make / Model + `FIND MY TIRES`. It is the front door — nothing else competes above the fold.
- **Category tiles**: photographic, in a 2fr/1fr grid (one tall tile, two stacked), label and `Browse →` in `--on-photo` over a scrim.
- **Brand row**: names in display 20px uppercase `--text-dim` in one continuous strip; on mobile it runs off the right edge with a fade and a swipe affordance (circular arrow, 4-dot progress). No logos unless supplied as monochrome white.
- **Results**: filter sidebar left (5 columns of the 12 at 1440), cards 3-up right; mobile is 1-up with a sticky sort/filter bar and a bottom filter sheet.
- **PDP**: 55/45 — single product image left, quote panel right (brand → title 88 → size → price 56 → season badge → quantity → `REQUEST A QUOTE` → `CALL US`). Specifications run **full width** below both columns; Similar products close the page.
- **Contact**: 60/40 with the two named contacts and hours left, a photographic panel right captioned in `--on-photo`.
- **Diagonal stripe**: one 1–2px `--accent` line at 135° spanning the container, used as a section divider at most **twice per page**. It counts as that section's accent.
- **Whitespace over dividers.** If two sections read as separate without a rule, drop the rule.

---

## 6. Depth & elevation

Depth is contrast. Three tonal steps and one hairline weight do all the work.

| Level | Ground | Edge | Used for |
|---|---|---|---|
| 0 | `--bg #0B0B0D` | — | Page, hero, nav, image grounds |
| 1 | `--surface #16161A` | `1px --border` | Cards, panels, drawers, table headers |
| 2 | `--surface-2 #1F1F24` | `1px --border-strong` | Inputs, selects, nested fills, row hover, filter sheet |

- Nothing sits above level 2. A sheet or modal is a level-2 panel over a `--scrim-strong` backdrop — flat, **never blurred**.
- **No drop shadows, no inner shadows, no neumorphism, no `backdrop-filter`, no glass.**
- **No gradient fills** except the photographic scrims: a bottom-up ramp over hero and tile photography for text contrast, and the radial vignette inside product-image grounds. Never on cards, buttons or type.
- Hairlines: `--border` on `--surface`, `--border-strong` on `--bg`. 2px is reserved for the focus ring and the nav's active underline.
- Product photos are cut out onto the same ground as their card, so the tire appears to sit *in* the card, not *on* a picture.

---

## 7. Do's and Don'ts

**Do**
- Put one accent element per frame and make it the thing you want clicked or read.
- Use real photography: low-key studio on black, tread macros, wet asphalt, Ontario winter road. The subject is a tire, wheel or accessory.
- Normalise every product cut-out to the same canvas so card images match in size.
- Set display type flush-left and let it run large — 88px is normal, not brave.
- Show prices in `--text`, 700 tabular, `from … / tire`, at the same size for a $99 tire and a $1,900 wheel.
- Use 60/40 splits and flip them between sections.
- Put `--on-photo` on anything sitting over an image, in every theme.
- Make hovers instant and lifts 2px.
- End every product path in a quote request, and say a person confirms fitment.

**Don't**
- Don't put two accent elements in one frame, or let a WINTER badge sit next to a lime button.
- Don't use shadows, blur, glass, gradients (beyond the photographic scrims) or radius past 4px. No pill buttons.
- Don't centre headlines, hero copy or card stacks.
- Don't imply a cart, checkout, stock count or shipping estimate — the site does not transact.
- Don't invent spec rows, review scores, star ratings or trust badges the shop cannot back.
- Don't use lifestyle stock, illustrations, 3D renders, or icon grids on flat black to fill space.
- Don't use purple/blue, gradient text, or a second accent for "info" or "success" — use white outline and copy.
- Don't set prices in lime, superscript cents, or shrink the `$`.
- Don't write "tyre" — the market is Canadian; it is **tire** everywhere.
- Don't use Inter, Roboto, Arial or any serif.
- Don't add parallax, scroll-jacking or autoplaying video on mobile.

---

## 8. Responsive behaviour

Breakpoints: **≥1320** (container caps), **1100**, **720**, **400**. Artboards are drawn at 1440 and 390.

| | Desktop ≥1100 | Tablet 720–1099 | Mobile <720 |
|---|---|---|---|
| Display scale | 40/56/88/120 | 40/56/72/88 | 32/40/56 |
| Section gap | 96–120px | 80px | 56px |
| Page padding | 48px | 32px | 16px |
| Hero | 900px, headline 120 | 760px, headline 88 | 720px, headline 56 |
| Finder | 4-column row, −120px overlap | 2×2 grid | stacked fields, full-width button |
| Product grid | 4-up featured / 3-up results | 3-up / 2-up | **1-up**, 3 best matches + 2 similar, then `LOAD MORE` |
| Horizontal rows | full grid | full grid | single strip running off the right edge, fade + arrow + dot progress |
| 60/40 splits | side by side | 55/45 | stack; photo first when the object is the hero, type first when the offer is |
| Nav | 88px, inline items | 88px, items collapse | 68px bar, full-screen drawer |
| Results controls | sidebar | sidebar | sticky centred `Sort` + `Filters (3)` bar, filter sheet from the bottom |
| Spec table | full-width two-column rows | same | same rows at 14–20px, 16px padding |
| Buttons | 48px, inline | 48px | 44px, full width in panels |
| Motion | hover fills, 2px lifts | same | no hover; tap = active; **no parallax** |

- Body text stays 15–16px at every breakpoint; the display ramp shrinks, the reading size does not.
- Card type steps down on mobile: model/price 24px, size 14px, CTA 12px, badges 11px with wrapping.
- Images use `object-fit: cover` with the focal point on the subject; product cut-outs use `contain`.
- Touch targets ≥44px. Hairlines stay 1px.

---

## 9. Agent prompt guide

Paste this block into any prompt that should produce Platinum Wheels UI.

```
You are designing for Platinum Wheels and Tire Solutions (Brampton, Ontario — tires, wheels, accessories).
Style family: Cinematic Dark, theme "Track Night". Use only these tokens.

GROUND: page #0B0B0D (--bg). Cards #16161A (--surface) with 1px #1F1F24 border. Inputs/nested #1F1F24 (--surface-2) with 1px #35353B.
INK: headlines, prices, spec values #F4F4F5. Body #A7A7AE. Meta #8B909A. Anything over a photo: #F4F4F5 (--on-photo) over a dark scrim.
ACCENT: acid lime #C9F23A (--accent), hover #DDFF6B, text on accent #0B0B0D. Exactly ONE accent element per visual frame (a CTA, a rule, a numeral, or a WINTER badge). Never two touching. Prices are never lime.
TYPE: Barlow Condensed 700 uppercase, tracking -1.5%, line-height .92 for headlines at 40/56/88/120 (mobile 32/40/56). Barlow 400 16px/1.5 body. Labels Barlow 500 11-12px uppercase +10-16% tracking. Prices and sizes Barlow 700 tabular-nums, written "from $129 CAD / tire". No Inter, no serif.
SHAPE: radius 0-2px. No pills. Primary button: lime fill, #0B0B0D uppercase text +6% tracking, 48px tall (44 mobile). Secondary: 1px white ghost. Inputs: #1F1F24 fill, 1px #35353B, focus = 2px lime ring, no offset.
DEPTH: tonal steps and 1px hairlines only. No shadows, blur, glass or gradients — except dark scrim ramps over photography. Optional single 1-2px diagonal lime stripe as a section divider, max twice per page.
MOTION: instant hover fills; card hover = border #DDFF6B + translateY(-2px), 150ms. No parallax on mobile.
LAYOUT: 12 col, 24px gutter, 1320px max, 48px page padding (16 mobile), 8px scale. Sections 96-120px apart (56 mobile). Asymmetric 60/40 or 55/45 splits, flush-left type. Never centre everything.
COMMERCE: there is NO cart and NO checkout. Every product path ends in "Request a quote"; a person confirms fitment and sends a firm price. Never show stock counts, shipping, ratings or invented specs.
IMAGERY: real photography only — tire/wheel as sculpture on black, tread macros, wet asphalt, Ontario winter road. Product cut-outs all normalised to one square canvas. No lifestyle stock, illustrations, 3D renders, icon grids.
BADGES: WINTER = lime fill, #0B0B0D text. ALL-SEASON and others = 1px #A7A7AE outline, #A7A7AE text. Unavailable = #1F1F24 fill, #8B909A outline and text.
COPY: short, specific, brand + size over adjectives. Spell it "tire", never "tyre". CTAs 2-3 words uppercase. "You"/"we". No exclamation marks, no emoji.
Same treatment for a $99 tire and a $1,900 wheel.
```

**Checklist before shipping a screen**
1. Count the lime elements per frame. If more than one, demote one to white.
2. Is anything centred that could be flush-left?
3. Any shadow, blur, gradient or radius >4px? Remove it.
4. Is text over a photo using `--on-photo` over a scrim?
5. Are prices `--text`, 700, tabular, with `from` and `/ tire`?
6. Do all product images render at the same optical size?
7. Does every buy path end in a quote request, not a cart?
8. Sections ≥96px apart on desktop?

---

## Contact block (canonical)

```
Platinum Wheels
Wheels, tires & accessories in Brampton, ON

Inderpal Singh   647-989-6178
Harman Singh     365-998-0990
Email            sales@platinumwheels.ca
Phone & inquiry hours   Every day: 9 am – 8 pm
```

Brands carried in mockups: Zeta, ZMAX, Mazzini, Touren, Spec-1, plus the majors (Michelin, Bridgestone, Continental, Pirelli, Goodyear, Hankook, Toyo).

---

Files: `Storefront Mockups.dc.html` (seven artboards, four themes) · `TyreCard.dc.html` · `SiteNav.dc.html` · `SiteFooter.dc.html` · `ThemeSpecimen.dc.html` · `styles.css` + `tokens/` · `components/core/` · `guidelines/` · `platinum-wheels/design/` (static HTML export of every artboard in Track Night)
