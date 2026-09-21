# Parity report — Home (`/`)

Measured 2026-09-20 with `scripts/parity-probe.js`-style `getComputedStyle` + `getBoundingClientRect`
reads in the browser pane, app on `:3000` (fresh `next dev`, `.next` cleared) against the artboards on
`:4000` (`design/serve.json` rewrites, D36 — images resolve). Thresholds: `design/reports/README.md`.
Every row is a measured number; `y` is document offset. A Δ outside tolerance is either fixed or linked
to a `design/DEVIATIONS.md` row.

## 1440 × 900 — `home-desktop`

| element | prop | design | app | Δ | ok |
|---|---|---|---|---|---|
| document | scrollWidth | 1440 | 1440 | 0 | ✓ |
| header bar | height / bg | 88 / rgba(11,11,13,.92) | 88 / rgba(11,11,13,.92) | 0 | ✓ |
| logo | height | 64 | 64 | 0 | ✓ |
| nav "Tires" (active) | font / ls / color | 500 13/13 / 1.3px / #F4F4F5 | same | 0 | ✓ |
| nav "Wheels" (inactive) | color | rgba(244,244,245,.68) | rgba(244,244,245,.68) | 0 | ✓ (`--color-on-photo-muted`) |
| nav row | gap / y | 40 / 28 | 40 / 28 | 0 | ✓ |
| phone CTA | h / gap / font / ls / pad / border | 44 / 10 / 13 / 1.04 / 20 / #C9F23A | same | 0 | ✓ |
| hero | height | 900 | 900 | 0 | ✓ |
| hero scrim | background-image | to top, --bg 0%, --scrim-strong 22%, --scrim-soft 55%, 100% | same | — | ✓ |
| hero eyebrow | font / ls / color / x,y | 500 12/12 / 1.92 / #C9F23A / 48,240.8 | same | 0 | ✓ |
| h1 | font / lh / ls / color / max-w / x,y | 700 120 / 110.4 / −1.8 / #F4F4F5 / 1100 / 48,280.8 | same | 0 | ✓ |
| hero lede | font / lh / max-w / opacity / y | 400 20 / 30 / 560 / .82 / 640 | same | 0 | ✓ |
| finder panel | margin-top / pad / bg / border / w,y | −120 / 32 / #16161A / #35353B / 1344,780 | same | 0 | ✓ |
| finder row | grid-template-columns / gap | 273.5 328.2 328.2 300 / 16 | same | 0 | ✓ (`finder-grid`) |
| finder label | font / ls / color | 500 11/11 / 1.32 / #8B909A | same | 0 | ✓ |
| finder control | h / pad-l / bg / font | 56 / 16 / #1F1F24 / 700 16 (div) | 56 / 16 / #1F1F24 / 700 17 (select) | value 17 = artboard value span | ✓ |
| finder control | border-color | #35353B | #69696F | — | DEVIATIONS #14 |
| finder CTA | h / w / font / ls / gap | 56 / 300 / 500 14 / 1.12 / 12 | same | 0 | ✓ |
| tiles header row | display / y / h | flex space-between / 1041 / 51.5 | same | 0 | ✓ |
| tiles eyebrow | font / ls / x | 500 12 / 1.68 / 48 | same | 0 | ✓ |
| tiles h2 | font / lh / ls | 700 56 / 51.52 / −0.84 | same | 0 | ✓ |
| tiles grid | columns / rows / gap / y | 885.3 442.7 / 320 320 / 16 / 1132.5 | same | 0 | ✓ (`category-grid`) |
| tile Tires | w,h / label font / label x,y | 885.3×656 / 700 88 / 81,1648.6 | same | 0 | ✓ |
| tile Wheels | w,h / x | 442.7×320 / 949.3 | same | 0 | ✓ |
| tile Tires image | object-position | 70% 30% | 50% 50% | — | DEVIATIONS #23 |
| winter promo | columns / min-h / h / margin-top / y | 840 600 / 640 / 768.3 / 120 / 1908.5 | same | 0 | ✓ |
| promo copy | bg / pad / gap / w | rgba(201,242,58,.12) / 80 64 / 24 / 600 | same | 0 | ✓ |
| promo h2 | font / lh / ls / w | 700 88 / 80.96 / −1.32 / 472 | same | 0 | ✓ |
| promo body | font / lh / max-w | 400 17 / 25.5 / 440 | same | 0 | ✓ |
| promo chip | h / pad / font / ls / border | 36 / 14 / 500 12 / 1.2 / #A7A7AE | same | 0 | ✓ |
| promo CTA | h / pad / font / ls / margin-top / w | 56 / 28 / 500 14 / 1.12 / 8 / 202.1 | same | 0 | ✓ |
| how-it-works grid | columns / border-top / y | 336×4 / #35353B / 2848.8 | same | 0 | ✓ |
| hiw cell | w / pad / gap | 312 / 32 0 0 24 / 20 | same | 0 | ✓ |
| hiw numeral | font / lh / ls / color / y | 700 56 / 56 / none / #8B909A / 2881.8 | same | 0 | ✓ |
| hiw title | font / lh / ls | 700 28 / 25.76 / −0.42 | same | 0 | ✓ |
| featured section | pad-top / y | 120 / 3074.3 | same | 0 | ✓ |
| featured h2 | font / y | 700 56 / 3222.3 | same | 0 | ✓ |
| featured track | columns / gap / y | 324×4 / 16 / 3313.9 | same | 0 | ✓ |
| product card | w,h / bg / border | 324×544.3 / #16161A / #1F1F24 | same | 0 | ✓ |
| brand strip | margin-top / pad / columns / bg / y | 120 / 40 48 / 168×8 / #1F1F24 / 3978.1 | same | 0 | ✓ |
| brand item | font / lh / ls / color | 700 26 / 26 / 0.52 / #8B909A | same | 0 | ✓ |
| contact section | pad / columns / gap / y | 120 48 / 540 756 / 48 / 4112.1 | same | 0 | ✓ (`contact-grid`) |
| contact h2 / p | font / max-w | 700 56 / 400 17, 420 | same | 0 | ✓ |
| contact card | w / pad / gap / border / x,y | 370 / 32 / 20 / #35353B / 636,4232.1 | same | 0 | ✓ |
| contact name | font / lh / ls | 700 40 / 36.8 / −0.6 | same | 0 | ✓ |
| contact phone | h / font / lh / gap / pad / border / w | 56 / 700 18 / 18 / 12 / 20 / #C9F23A / 184.6 | same | 0 | ✓ |
| contact photo | w,h / x,y | 756×280 / 636,4426.9 | same | 0 | ✓ |
| footer | pad / border-top / y | 80 48 40 / #35353B / 4826.9 | same | 0 | ✓ |
| footer grid | columns / gap | 720 600 / 24 | 722.2 597.8 / 24 | 2.2 | ✓ (11-col 6:5) |
| footer left column | h | 184 | 169 | −15 | DEVIATIONS #20 (social row omitted) |
| footer heading / link | font | 500 11 ls 1.32 / 400 15 lh 19.5 pad 4 0 | same | 0 | ✓ |
| footer bottom | margin-top / pad-top / font | 48 / 24 / 400 13 lh 18.2 #8B909A | same | 0 | ✓ |

## 390 × 844 — `home-mobile`

| element | prop | design | app | Δ | ok |
|---|---|---|---|---|---|
| document | scrollWidth | 390 | 390 | 0 | ✓ |
| header bar | h / pad | 68 / 16 | 68 / 16 | 0 | ✓ |
| logo / call circle / hamburger | h / size | 52 / 44 / 44 | same | 0 | ✓ |
| call circle | bg / radius | #C9F23A / 50% | #C9F23A / 50% (`rounded-full`) | 0 | ✓ |
| hero | h | 720 | 720 | 0 | ✓ |
| hero scrim | background-image | to top, --bg 0%, --scrim-strong 28%, --scrim-mid 60%, --scrim-soft 100% | same | — | ✓ |
| hero eyebrow | font / lh / ls / y | 500 11 / 15.4 / 1.54 / 318.5 | same | 0 | ✓ |
| h1 | font / lh / ls / y | 700 56 / 51.52 / −0.84 / 349.9 | same | 0 | ✓ |
| hero lede | font / lh / opacity / y | 400 16 / 24 / .82 / 572 | same | 0 | ✓ |
| finder | margin-top / pad / gap / w,y | −72 / 20 / 12 / 358,648 | same | 0 | ✓ |
| finder control | h / pad-l / font | 52 / 14 / 700 16 | same | 0 | ✓ |
| finder CTA | h / margin-top / font / w | 52 / 4 / 500 14 / 316 | same | 0 | ✓ |
| tiles eyebrow / h2 | font / y | 500 11 ls 1.54 / 700 40, 1045 / 1076 | same | 0 | ✓ |
| tiles column | gap / y | 12 / 1169.6 | same | 0 | ✓ |
| tile Tires / Wheels | w,h | 358×300 / 358×200 | same | 0 | ✓ |
| tile label / sub | font / x | 700 56 / 500 13 ls 1.04 op .75 / 37 | same | 0 | ✓ |
| promo | margin-top / photo h / y | 56 / 280 / 1949.6 | same | 0 | ✓ |
| promo copy | pad / gap | 8 16 48 / 16 | same | 0 | ✓ |
| promo h2 / body / chip / CTA | font | 700 48 / 400 15 / 500 12 pad 12 / 500 14 h 52 w 358 pad 24 | same | 0 | ✓ |
| promo overlay | gradient stop 2 | rgba(13,2,2,0) | transparent | — | DEVIATIONS #22 |
| hiw row | columns / pad / gap | 56 1fr / 20 0 / 12 | flex 56 + 1fr / 20 0 / 12 | 0 | ✓ |
| hiw numeral | font / lh / ls | 700 40 / 40 / none | same | 0 | ✓ |
| hiw title / body | font | 700 24 lh 22.08 no ls / 400 14 lh 21 | same | 0 | ✓ |
| featured section | pad / y | 56 0 0 16 / 3204 | same | 0 | ✓ |
| featured h2 / next | font / size | 700 40 / 44 circle | same | 0 | ✓ |
| featured track | columns / gap / w | 260×4 / 12 / 374 | flex 260 / 12 / 374 (scroll-snap) | 0 | ✓ (D30) |
| right fade | w / x | 72 / 318 | same | 0 | ✓ |
| brand strip | margin-top / pad / gap / y | 56 / 20 16 / 28 / 3903.7 | same | 0 | ✓ |
| brand item | font / ls | 700 20 lh 20 / 0.4 | same | 0 | ✓ |
| contact | pad / gap / y | 56 16 0 / 24 / 3965.7 | same | 0 | ✓ |
| contact h2 / p | font | 700 40 / 400 15 | same | 0 | ✓ |
| contact card | pad / gap / w | 20 / 14 / 358 | same | 0 | ✓ |
| contact phone | h / font / lh / gap / w | 52 / 700 17 / 17 / 10 / 316 | same | 0 | ✓ |
| hours label | font / ls | 500 10 / 1.2 | same | 0 | ✓ |
| contact photo | display | absent | hidden (`hidden sm:block`) | — | DEVIATIONS #8 |
| footer wrapper | margin-top / y | 56 / 4642.9 | same | 0 | ✓ |
| footer | pad / grid / links grid | 56 16 120 / 1 col gap 40 / 159 159 gap 40 | same | 0 | ✓ |
| footer | height | 821.4 | 757.4 | −64 | DEVIATIONS #20 (social row omitted) |

## Overflow-only checks

| width | scrollWidth | note |
|---|---|---|
| 375 | 375 | none |
| 768 | 768 after fix | promo h2 first shipped at 88px in the 45% tablet column and overflowed by 11px; now 56px at 720–1099 (DESIGN.md §8 tablet ramp) |
| 1280 | 1280 | none |
| 1440 | 1440 | none |

## Tablet band (720–1099) — spec-derived, no artboard

No export exists at these widths; values come from DESIGN.md §8 (D41). Measured at 768: header 88px,
links collapsed to the drawer, phone CTA visible; hero 760px, h1 88px; finder 2×2 (311 311); page
padding 32; section gap 80. Not parity rows — recorded so nobody measures them against a baseline that
does not exist.

## States and interactions verified

- Drawer: opens on the hamburger, `<dialog>` modal, focus lands inside, Esc closes, focus returns.
- Finder: native `<select>` ×3, GET submit to `/results?year=&make=&model=`, echoed on the stub.
- Every link target resolves: `/wheels` `/accessories` `/about` `/privacy` `/terms` `/results`
  `/products/<slug>` → 200; unknown slug → 404 (styled `not-found.tsx`).
- `npm run check` clean; slop grep zero hits in code (comment/doc mentions only).

## Not run

- ~~Lighthouse~~ — run 2026-09-21 (mobile, production build, three runs; runner in `README.md`), after
  the hero `<Image>` gained `fetchPriority="high"` (Lighthouse flagged the preload without it):
  Performance **91 / 91 / 91** (gate ≥ 90 ✓), Accessibility **100** ✓, CLS **0** ✓, LCP **3.5 s** ×3
  (gate ≤ 2.5 s ✗). The LCP element is the hero image, discoverable and eager; the simulated cost is
  document → render-blocking CSS (11 KB) → paint under slow-4G throttling. Closing it needs critical-CSS
  inlining or a smaller document; not done. Before the hero change: 89 / 100 / 0 / 3.8 s.
