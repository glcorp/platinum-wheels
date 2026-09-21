# Parity report — Product (`/products/[slug]`)

Measured 2026-09-21 with `getComputedStyle` + `getBoundingClientRect` reads in the browser pane, app on
`:3000` (fresh `next dev` after the `globals.css` additions) against `design/inventory/product.md`, the
extracted baseline, with the artboards served on `:4000` (`design/serve.json` rewrites, D36). Thresholds:
`design/reports/README.md`. Every row is a measured number; `Δ` outside tolerance is either fixed or
linked to a `design/DEVIATIONS.md` row.

App URL for the artboard's staged state:
`/products/zeta-antarctica-sport?year=2021&make=Honda&model=Civic&qty=4`. The drawn form values
(`Priya Sandhu` / `priya.s@` / the focused-Email caret) are sample data and do not ship — DEVIATIONS #36.

## 1440 × 900 — `product-desktop`

| element | prop | design | app | Δ | ok |
|---|---|---|---|---|---|
| document | scrollWidth | 1440 | 1440 | 0 | ✓ |
| header bar | h / logo / phone CTA | 88 / 64 / 44 | 88 / 64 / 44 | 0 | ✓ (shared, `home.md`) |
| split | columns / gap | 704 576 / 64 | 704 576 / 64 | 0 | ✓ `pdp-split`, 55/45 not 60/40 |
| gallery box | w,h / border / bg / aspect | 704×704 / 1px #1F1F24 / #0B0B0D / 1:1 | same | 0 | ✓ |
| gallery img | inset / object-fit | 8% = 56.16 / contain | 56.156 / contain | 0.004 | ✓ |
| gallery vignette | gradient | `transparent 55%, rgba(11,11,13,.68) 100%` | same (sRGB, not oklab) | 0 | ✓ `photo-vignette-gallery` |
| breadcrumb | font / ls / case / color | 500 12/12 / 1.2 / upper / #8B909A | same | 0 | ✓ |
| breadcrumb | leaf copy | `Home / Results / Zeta Antarctica Sport` | same | 0 | ✓ |
| breadcrumb links | tap height | 13 (as drawn) | 13 + `tap-extend` band | — | DEVIATIONS #41 |
| badge `Winter` | h / pad-l / bg / color / font / lh / ls | 24 / 10 / #C9F23A / #0B0B0D / 500 11 / 24 / 1.1 | same | 0 | ✓ |
| badge `M+S` | h / border / color / lh | 24 / 1px #A7A7AE / #A7A7AE / 22 | same | 0 | ✓ |
| badge row | count | 3 (`Winter` `3PMSF` `M+S`) | 3 | 0 | ✓ `M+S` derived, DEVIATIONS #40 |
| brand label | font / ls / case / color | 500 13/13 / 1.82 / upper / #A7A7AE | same | 0 | ✓ |
| `<h1>` | family / size / lh / ls / case | Barlow Condensed 700 88 / 80.96 / −1.32 / upper | same | 0 | ✓ one `h1` on the page |
| size numeral | font / tabular / color | 700 22/22 / yes / #A7A7AE | same | 0 | ✓ |
| price `from` | font / ls / case / color | 500 13 / 1.04 / upper / #A7A7AE | same | 0 | ✓ |
| price amount | font / ls / color / tabular | 700 64 / −1.28 / #F4F4F5 / yes | same (`$129 CAD`) | 0 | ✓ `Price context="pdp"` |
| price suffix | font / lh / color | 400 14 / 18.2 / #8B909A | same (`per tire · before tax`) | 0 | ✓ D21 |
| quantity grid | columns / gap / cell h | 120 120 120 192 / 8 / 52 | same | 0 | ✓ |
| quantity cell `4` | bg / color (selected) | #F4F4F5 / #0B0B0D | same, `aria-current` | 0 | ✓ links, DEVIATIONS #43 |
| CTA primary | h / font / ls / case / bg / ink / radius | 60 / 500 15 / 1.2 / upper / #C9F23A / #0B0B0D / 2 | same | 0 | ✓ `Request a quote` |
| CTA secondary | h / bg / border / color | 60 / transparent / 1px #F4F4F5 / #F4F4F5 | same | 0 | ✓ `Call us` |
| CTA pair | gap | 10 | 10 | 0 | ✓ |
| buy panel | position / top | sticky / 96 | sticky / 96 | 0 | ✓ |
| buy panel | trust line | none | none | 0 | ✓ D47(2) |
| `Specifications` h2 | size / lh / ls | 40 / 36.8 / −0.6 | same | 0 | ✓ |
| spec row | h / pad-x / border-bottom | 56 / 24 / 1px #1F1F24 | same | 0 | ✓ |
| spec zebra | odd / even bg | #16161A / transparent | same | 0 | ✓ |
| spec key | font / color / align | 400 16 / #A7A7AE / left | same | 0 | ✓ |
| spec value | font / align / tabular | 700 16 / right / yes | same | 0 | ✓ |
| spec rows | copy | 6 rows, `Winter (studdable)` | same, derived | 0 | ✓ D53(1), DEVIATIONS #40 |
| quote band | margin-top / pad / bg / border-top | 120 / 96 48 / #1F1F24 / 1px | same | 0 | ✓ |
| quote grid | columns / gap | 533.333 746.667 / 64 | 533.328 746.664 / 64 | 0.005 | ✓ `quote-grid` |
| eyebrow | font / ls / case / color | 500 12 / 1.92 / upper / #C9F23A | same | 0 | ✓ |
| quote `<h2>` | size / lh / ls | 88 / 80.96 / −1.32 | same | 0 | ✓ |
| quote paragraph | font / lh / max-w / color | 400 17 / 25.5 / 420 / #A7A7AE | same | 0 | ✓ vehicle clause templated, #40 |
| chip | display / gap / pad / bg / border | flex / 12 / 14 16 / #16161A / 1px #35353B | same | 0 | ✓ |
| chip label | font / ls / color | 500 11 / 1.32 / #8B909A | same | 0 | ✓ |
| form field | h / radius / pad-l | 56 / 2 / 16 | 56 / 2 / 16 | 0 | ✓ |
| form field | border-color | #35353B | #69696F | — | DEVIATIONS #14 |
| form field | fill / value font | #0B0B0D / 400 16 | #1F1F24 / 700 17 | — | DEVIATIONS #36 |
| textarea | h / pad / font | 120 / 16 / 400 16 | 120 / 16 / 400 16 | 0 | ✓ |
| segmented control | h / border / radius / columns | 56 / 1px #35353B / 2 / 1fr ×3 | same (161.703 ×3) | 0 | ✓ |
| segmented control | separators | `border-right` on all 3 | `border-left` on 2 and 3 | — | DEVIATIONS #38 |
| segment type | font / ls / case | 500 14 / none / none | same | 0 | ✓ the one non-uppercase control |
| segment selected | bg / ink | #F4F4F5 / #0B0B0D | same (`Phone`) | 0 | ✓ native radios, #38 |
| `Send inquiry` | h / font / ls / case / pad-l | 60 / 500 15 / 1.2 / upper / 40 | same | 0 | ✓ |
| `Send inquiry` | bg / transform | #DDFF6B / translateY(1px) | #C9F23A / none | — | DEVIATIONS #37 (drawn pre-hovered) |
| CASL checkbox | checked | unticked | unticked | 0 | ✓ `docs/decisions.md:118` |
| `Similar products` | pad / row-gap | 120 48 / 40 | same | 0 | ✓ |
| `Similar products` h2 | size | 56 | 56 | 0 | ✓ |
| similar grid | columns / gap / cards | 324 ×4 / 16 / 4 | same | 0 | ✓ |
| similar set | membership | 4 drawn SKUs incl. the PDP subject | same season, self excluded | — | DEVIATIONS #40 |

## 390 × 844 — `product-mobile`

| element | prop | design | app | Δ | ok |
|---|---|---|---|---|---|
| document | scrollWidth | 390 | 390 | 0 | ✓ |
| breadcrumb | font / ls / color | 500 11/11 / 1.1 / #8B909A | same | 0 | ✓ |
| breadcrumb | leaf copy | `Home / Results / Antarctica Sport` | same (brand dropped) | 0 | ✓ |
| gallery | w,h / margin-top / border / bg | 390×390 / 16 / none / none | same | 0 | ✓ full-bleed |
| gallery badges | count / inset / gap | 3 / 16 16 / 6 | same | 0 | ✓ |
| buy panel | badge count | 0 (they overlay the image) | 0 | 0 | ✓ |
| buy panel | pad / gap / position | 32 16 0 / 16 / static | same | 0 | ✓ no sticky bar, D6 |
| `<h1>` | size / lh | 56 / 51.52 | same | 0 | ✓ |
| brand label | size / ls | 12 / 1.68 | same | 0 | ✓ |
| size numeral | font | 700 18 | same | 0 | ✓ |
| price amount | size / ls | 48 / −0.96 | same | 0 | ✓ |
| price suffix | size / lh | 400 13 / 13 | same | 0 | ✓ second row, as drawn |
| quantity grid | columns / gap / cell h | 74.222 ×3 + 111.333 / 8 / 48 | 74.219 74.219 74.227 111.328 / 8 / 48 | ≤0.006 | ✓ |
| CTA primary | h / font / ls | 56 / 500 14 / 1.12 | same | 0 | ✓ |
| specs section | pad-top / gap | 112 / 20 | same | 0 | ✓ mobile pad > desktop, as drawn |
| `Specifications` h2 | size | 32 | 32 | 0 | ✓ |
| spec row | h / pad-l | 48 / 12 | same | 0 | ✓ |
| spec key | size | 14 | 14 | 0 | ✓ |
| quote band | margin-top / pad | 56 / 56 16 | same | 0 | ✓ |
| quote `<h2>` | size | 48 | 48 | 0 | ✓ |
| quote paragraph | presence | absent | absent | 0 | ✓ mobile deletes it, as drawn |
| form field | h / font | 52 / 400 16 | 52 / 700 16 | — | DEVIATIONS #36 |
| textarea | h / font | 100 / 400 15 | 100 / 400 16 | — | DEVIATIONS #12 (iOS zoom floor) |
| `Similar products` | pad / row-gap | 56 0 0 16 / 20 | same | 0 | ✓ right-bleeding, as drawn |
| `Similar products` h2 | size | 40 | 40 | 0 | ✓ |
| similar track | columns / gap | 260 ×4 / 12 | same | 0 | ✓ |
| similar track | overflow-x | hidden (clips cards 2–4) | auto + scroll-snap | — | DEVIATIONS #40 |

## Tablet band (720–1099)

Not parity rows — no artboard exists at these widths (D41). The band keeps the mobile stacked
arrangement with 32px page padding; **the split, the gallery frame and the sticky panel all activate at
`md:` 1100, not DESIGN.md §8's 720**, because a 45% column at 720 measures 266px and cannot hold an 88px
display title. Same arithmetic that moved the `/results` rail (D46). Type still crosses at `sm:` 720,
which is where the ratified `Price context="pdp"` already crosses. Logged as DEVIATIONS #39. Measured at
768 and 1024: no overflow, no clipped control.

## Behaviour verified

- **`?qty=` (D50):** `?qty=2` selects cell `2` (`#F4F4F5` fill, `aria-current="true"`); every cell href
  preserves `year`/`make`/`model` and changes only `qty`; the quote form's Quantity select defaults to
  `2 tires`. Server rendered — no client state, survives reload.
- **Breadcrumb back-link (D53(6)):** `/results?year=2021&make=Honda&model=Civic` — `qty` stripped.
  With no query: `/results`.
- **No vehicle in the URL (D53(6)):** the chip drops its vehicle half (`Zeta Antarctica Sport
  215/55R16`) and the fitment sentence genericises to "against your vehicle". No vehicle is invented.
- **Quote form (D51):** invalid submit → `aria-invalid` on the offending fields, per-field messages
  (`Enter a valid email address.` / `Enter a 10-digit Canadian phone number.`), typed values preserved.
  Valid submit → the form is replaced by a `role="status"` panel that takes focus. `actions.ts` performs
  **no** network or disk write; the delivery call is a marked `TODO`.
- **Unavailable SKU:** `/products/zmax-winterhawk-215-50r17` (`available: false`) returns 200 and renders.
  See Open #1 — the PDP has no unavailable treatment because no artboard draws one.
- **Overflow:** none at 375, 390, 768, 1024, 1440. The elements extending past 375 are the similar-row
  cards inside their own scroll container; `document.scrollWidth === clientWidth` at every width.
- **Console:** no errors or warnings at any width.
- **Gallery image:** source is 1000×1000 (D19); the browser selects the `w=1920` candidate, which the
  optimiser caps at the 1000px source. `sizes` is `(min-width: 1100px) 704px, 100vw` — the crossover must
  match the **frame's** (`md:` 1100), not the type's (`sm:` 720): an earlier `720px` spelling declared a
  704px slot across a band where the gallery is full-bleed, which makes a browser pick a candidate about a
  third of the rendered width and upscale it. Anything that changes where the split activates has to
  change this string too.

## Build

`next build` reports `/products/[slug]` as **ƒ (dynamic)**, not `○`. Reading `searchParams` for `?qty=`
(D50) is what forces it, so `generateStaticParams` over the nine seed slugs would be dead code and is
deliberately absent (`page.tsx`). The page is still fully server rendered — there is no client fetch and
no loading state; only the quote form ships JavaScript.

## Gates

Scope is UI only (D54): a page is done when these are green **except** a parked row. The LCP row below is
parked, not failed.

| Gate | State |
|---|---|
| `npm run check` (tsc + eslint) | clean |
| Slop grep | zero — no arbitrary values, no default palette, no raw hex, no cart language, no `any`, no default exports, no path or phone literals |
| `"use client"` | one new file (`quote-form.tsx`), six in the build, none under `src/app/` |
| `"use server"` | one (`actions.ts`) |
| Sample data | none ships; `(905) 000-0000` survives as a `placeholder` attribute only |
| Lighthouse (mobile, prod build, 2 runs) | perf **93 / 95** · a11y **100** · CLS **0** · TBT 10 / 0 ms · FCP 0.9 s · **LCP 3.2 / 3.0 s** |
| Keyboard walk-through | 27 focusables in `main`, order breadcrumb → quantity → CTAs → form → similar scroller → cards; no trap, no positive `tabindex` |
| Reduced motion | covered by the global `@media (prefers-reduced-motion: reduce)` block in `globals.css` (code-level; not runtime-emulated) |

## Open

1. **PARKED (D54). No unavailable state on the PDP.** `docs/decisions.md:116` specifies dimmed media, a
   `Currently unavailable` badge and an `Inquire about restock` CTA for the *card*; neither product
   artboard draws an unavailable PDP, so none was authored. A visitor landing on
   `/products/zmax-winterhawk-215-50r17` sees a normal `Request a quote` panel. Undrawn state →
   **owner** decides whether to author one (it would join `/styleguide`).
2. **Form success state is not on `/styleguide` yet.** It is authored (`quote-form.tsx`) and
   `HANDOFF.md` §6.2 wants it there with loading and error.
3. **PARKED (D54). LCP is 3.0–3.2 s against a 2.5 s gate** — the same red row `/` (3.5 s) and `/results` (2.6–3.2 s)
   carry, and the same cause: the simulated slow-4G document → CSS → paint chain, not this page. The
   gallery image is the LCP candidate and already ships `loading="eager"` + `fetchPriority="high"`
   (`HANDOFF.md` §8.6); everything else is green (perf 93–95, a11y 100, CLS 0, TBT ≤10 ms). Closing it
   needs critical-CSS inlining or a smaller document, which is a build-wide change — root `llm.md` §7.12,
   **owner**.
4. **`bf-cache` is the one failing binary audit** in both runs — back/forward-cache eligibility. Not an
   accessibility or parity failure; noted so the next `audit` pass does not rediscover it.
