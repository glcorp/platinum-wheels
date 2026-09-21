# Parity report — Results (`/results`)

Measured 2026-09-21 with `getComputedStyle` + `getBoundingClientRect` reads in the browser pane, app on
`:3000` (fresh `next dev`, `.next` cleared after the `globals.css` additions) against the artboards on
`:4000` (`design/serve.json` rewrites, D36). Thresholds: `design/reports/README.md`. Every row is a
measured number; `y` is document offset. App URL for the artboard's staged state:
`/results?width=215&profile=55&rim=16&year=2021&make=Honda&model=Civic` (the drawn `Winter` / `Zeta` /
`ZMAX` / `$140–$275` selections are sample data and do not ship — DEVIATIONS #26). A Δ outside tolerance
is either fixed or linked to a `design/DEVIATIONS.md` row.

## 1440 × 900 — `results-desktop`

| element | prop | design | app | Δ | ok |
|---|---|---|---|---|---|
| document | scrollWidth | 1440 | 1440 | 0 | ✓ |
| header bar | h / logo / phone CTA | 88 / 64 / 44 | 88 / 64 / 44 | 0 | ✓ (shared, `home.md`) |
| toolbar | pad / y,h | 32 48 0 / 88,76 | 32 48 0 / 88,76 | 0 | ✓ |
| breadcrumb | font / ls / color / x,y / w | 500 12/12 / 1.2 / #8B909A / 48,136 / 118.6 | same | 0 | ✓ (after adding the two spaces around `/`) |
| vehicle chip | font / bg / border / pad / gap / x,y / w,h | 700 14/14 / #16161A / #35353B / 0 14 / 10 / 186.6,122 / 162.1×40 | same | 0 | ✓ |
| `Change vehicle` | font / ls / color / underline / x,y | 500 13/13 / 0.78 / #A7A7AE / underline 4px / 368.8,135.5 | same | 0 | ✓ (`<summary>` text, D45) |
| count | font / color / tabular / x | 400 15/15 / #A7A7AE / yes / 501.6 | same (`4 matches · 5 similar`) | 0 | ✓ copy computed (D42) |
| sort cluster | gap / x,y / w,h | 12 / 1148.4,120 / 243.6×44 | same | 0 | ✓ |
| `Sort` label | font / ls / color | 500 11/11 / 1.32 / #8B909A | same | 0 | ✓ |
| sort box | h / min-w / bg / radius / pad-l / value font / x | 44 / 200 / #1F1F24 / 2 / 14 / 700 14 / 1192 | same (native `<select>`, pad-r 46) | 0 | ✓ |
| sort box | border-color | #35353B | #69696F | — | DEVIATIONS #14 / #28 |
| grid shell | pad / columns / gap / y | 40 48 0 / 280 1016 / 48 / 164 | same (`results-grid`) | 0 | ✓ |
| rail | w / sticky top / gap / x,y | 280 / 96 / 32 / 48,204 | same | 0 | ✓ |
| rail | height | 1156 | 946 | −210 | DEVIATIONS #25 (3 brand rows, not 8) |
| `Filters` title | font / lh / ls / case | Barlow Condensed 700 28 / 28 / 0 / upper | same | 0 | ✓ |
| `Clear all` | font / ls / color / underline / x,y | 500 12/12 / 0.96 / #A7A7AE / 4px / 259.5,218.5 | same | 0 | ✓ |
| group shell ×5 | border-top / pad-top / gap / y (Category) | #35353B / 20 / 14 (Price 20) / 264 | same | 0 | ✓ |
| group label | font / ls / color / h | 500 12/12 / 1.44 / #F4F4F5 / 16 (chevron row) | same | 0 | ✓ |
| category list | gap | 4 | 4 | 0 | ✓ |
| `Tires` row (selected) | font / bg / color / pad / h / y | 500 15/15 / #F4F4F5 / #0B0B0D / 0 12 / 40 / 315 | same | 0 | ✓ |
| `Wheels` row | color / bg / h / y | #A7A7AE / transparent / 40 / 359 | same (`next/link`) | 0 | ✓ |
| `Tires` count | font / color / tabular | 400 13/13 / #8B909A / yes | same (`9`, not `18`) | 0 | ✓ DEVIATIONS #25 |
| size grid | columns / gap / y,h | 88 88 88 / 8 / 526,60 | same | 0 | ✓ |
| size caption | font / ls / color | 500 10/10 / 1 / #8B909A | same | 0 | ✓ |
| size field | h / bg / radius / pad-l / value font / tabular | 44 / #1F1F24 / 0 / 10 / 700 15 / yes | same (native `<select>`, pad-r 30) | 0 | ✓ |
| size field | border-color | #35353B | #69696F | — | DEVIATIONS #14 / #28 |
| `Apply` | h / font / ls / border / radius / w / y | 44 / 500 13 / 1.04 / #F4F4F5 / 2 / 280 / 600 | same | 0 | ✓ |
| season chip row | gap / y,h | 8 / 727,40 | same | 0 | ✓ |
| chip (rest) | font / color / border / radius / pad / w,h | 500 14/14 / #A7A7AE / #35353B / 0 / 0 16 / 98.7×40 | same | 0 | ✓ (`ChipCheckbox`) |
| chip `Winter` | x / w | 154.7 / 75.1 | same | 0 | ✓ |
| chip (selected, `?season=winter`) | bg / color / border / radius / h | #F4F4F5 / #0B0B0D / #F4F4F5 / 0 / 40 | same (`has-checked:` on the label) | 0 | ✓ |
| brand list | gap / y | 2 / 850 | same | 0 | ✓ |
| brand row | gap / h | 12 / 40 | same | 0 | ✓ |
| brand checkbox | size / radius / border (unchecked) / y | 18 / 2 / #8B909A / 861 | same | 0 | ✓ |
| brand checkbox (checked) | bg / border / tick | #F4F4F5 / #F4F4F5 / 12px #0B0B0D | same (`?brand=Zeta`) | 0 | ✓ |
| brand name / count | font / color / x | 400 15 #F4F4F5 78 / 400 13 #8B909A tabular 321.1 | same | 0 | ✓ |
| price group | gap / h | 20 / 144 | same | 0 | ✓ |
| price track | mx / h / w / y | 8 / 20 / 264 / 1273 (rail) | 8 / 20 / 264 / 1063 | y −210 | DEVIATIONS #25 (rail shorter) |
| price rail / fill / handle | h / bg / handle 16×16 r2 | 2 #35353B / 2 #F4F4F5 / #F4F4F5 | same (`range-input` thumbs) | 0 | ✓ |
| price fill (`?min=100&max=140`) | left / right | — | 16.67% / 16.67% of $90–$150 | — | ✓ computed (D42) |
| price values | font / tabular | 700 15/15 / yes | same (`$90` `$150`) | 0 | ✓ DEVIATIONS #25 |
| price bounds | font / color | 400 12/12 / #8B909A | same | 0 | ✓ |
| results column | gap / x,y / w | 80 / 376,204 / 1016 | same | 0 | ✓ |
| `Best matches` | element / font / lh / ls / y | h2 / Barlow Condensed 700 40 / 36.8 / −0.6 / 204 | h1, same type | 0 | ✓ D47(6) |
| best grid | columns / gap / y | 328 328 328 / 16 / 272.8 | same | 0 | ✓ |
| product card | w,h / bg / border | 328×548.3 / #16161A / #1F1F24 | same | 0 | ✓ |
| `Similar matches` | border-top / pad-top / gap / y | #35353B / 32 / 10 / 1465.3 | same | 0 | ✓ |
| similar h2 / grid | font / y ; gap / y | 700 40 / 1498.3 ; 16 / 1567.1 | same | 0 | ✓ |
| load-more row | pad-bottom / y,h | 120 / 2195.4,176 | same | 0 | ✓ |
| `Load more` | h / pad / font / ls / border / radius / x,w | 56 / 0 40 / 500 14 / 1.12 / #C9F23A / 2 / 801.7,164.6 | same (`Button size="load"`) | 0 | ✓ |
| footer | pad / border-top / y | 80 48 40 / #35353B / 2371.4 | same | 0 | ✓ |
| footer | height | 396.2 | 381.2 | −15 | DEVIATIONS #20 |

> **Five rows above no longer have a target (2026-09-22).** `group shell ×5 … (Category)`, `category list`, `` `Tires` row (selected) ``, `` `Wheels` row `` and `` `Tires` count `` measured the `Category` filter group, which the owner removed — `design/DEVIATIONS.md` **#60**. They are superseded by that row, not re-measured here. The rail now opens on the size group, whose own `border-top` lands where Category's did, so the **first hairline stays at y 264** and everything below it shifts up **211px** (the 179px group plus the 32px aside gap); rail height 946 → 735. `group label` still applies, to the size group. Every other row on this table is unaffected.


## 390 × 844 — `results-mobile`

| element | prop | design | app | Δ | ok |
|---|---|---|---|---|---|
| document | scrollWidth | 390 | 390 | 0 | ✓ |
| toolbar | pad / gap / y,h | 20 16 0 / 12 / 68,113 | same | 0 | ✓ |
| breadcrumb | font / ls / y | 500 11/11 / 1.1 / 88 | same | 0 | ✓ |
| row 2 | gap / y,h | 12 / 111,44 | same (`<summary>`) | 0 | ✓ |
| vehicle chip | h / w | 44 / 162.1 | same | 0 | ✓ |
| `Change vehicle` | font / ls / pad / underline | 500 12/12 / 0.72 / 12 0 / yes | same | 0 | ✓ |
| count | font / y | 400 14/14 tabular / 167 | same | 0 | ✓ |
| sticky bar | position / top / mt / pad / bg / borders / columns / gap / z / y,h | sticky / 68 / 16 / 12 16 / rgba(11,11,13,.92) / #1F1F24 top+bottom / 175 175 / 8 / 3 / 197,70 | same | 0 | ✓ |
| `Filters (n)` | h / border / font / ls / gap / x,w | 44 / #F4F4F5 / 500 12 / 0.72 / 10 / 16,175 | same (`Filters (1)`) | 0 | ✓ |
| sort control | h / font / ls / x,w | 44 / 500 12 / 0.72 / 199,175 | same (native `<select>`, pad 0 36 0 8) | 0 | ✓ |
| sort control | border-color | #35353B | #69696F | — | DEVIATIONS #14 / #28 / #30 |
| best section | pad / gap / y | 40 16 0 / 20 / 267 | same | 0 | ✓ |
| best h1 | font / lh / ls / y | 700 32 / 29.44 / −0.48 / 307 | same | 0 | ✓ |
| best grid | columns / gap / y | 358 / 12 / 356.4 | same | 0 | ✓ |
| product card | w,h | 358×542.1 | same | 0 | ✓ |
| similar section | pad / gap ; header border-top / pad-top / gap | 56 16 0 / 20 ; #35353B / 24 / 8 | same | 0 | ✓ |
| similar h2 / grid | font ; gap | 700 32 ; 12 | same | 0 | ✓ |
| `Load more` | h / mt / w / border / radius / font | 52 / 12 / 358 / #C9F23A / 2 / 500 14 ls 1.12 | same | 0 | ✓ |
| call panel | mt / bg / border / pad / gap / w,h | 56 / #16161A / #35353B / 24 / 14 / 358×208 | same | 0 | ✓ |
| panel heading | font / lh / ls | Barlow Condensed 700 36 / 36 / 0 | same | 0 | ✓ |
| panel body | font / lh / color | 400 14 / 21 / #A7A7AE | same | 0 | ✓ |
| panel CTA | h / border / radius / font / tabular / gap | 52 / #C9F23A / 2 / 700 16/16 / yes / 10 | same | 0 | ✓ |
| footer wrapper / footer | mt ; pad | 56 ; 56 16 120 | same | 0 | ✓ |
| footer | height | 821.4 | 757.4 | −64 | DEVIATIONS #20 |

> **Six rows in the two tables above were superseded on 2026-09-22 by D72** (owner: *"higlight the vehicle more, make change vehicle lower caps and put 9 matches somewhere else"*). At both widths: the `vehicle chip` row's `bg` / `border` are now `--accent-subtle` / `--accent` (`DEVIATIONS.md` #61) and every box metric in that row still measures 0; the `` `Change vehicle` `` row's `ls` is now 0 and its case sentence (#62); and the `count` row has no target in the toolbar at all, the element having moved under the `Best matches` `<h1>` (#63). Nothing else in either table is affected.

## 390 × 844 — `results-mobile-filters` (sheet open)

| element | prop | design | app | Δ | ok |
|---|---|---|---|---|---|
| scrim | bg / box | rgba(11,11,13,.68) / 0,0 390×844 | `::backdrop` same / dialog 0,0 390×844 | 0 | ✓ D47(3), DEVIATIONS #32 |
| panel | bg / border-top / y,h | #16161A / #35353B / 144,700 | same (`sheet-panel`) | 0 | ✓ |
| header | pad / border-bottom / y,h | 20 16 / #35353B / 145,85 | same | 0 | ✓ |
| title | font / lh / ls | Barlow Condensed 700 28 / 28 / 0 | same | 0 | ✓ |
| `Clear all` / close | x,y w ; box border | 245.5,181 68.5 ; 44×44 #35353B | same | 0 | ✓ |
| body | pad / y,h | 8 16 / 230,529 | same (scrolls) | 0 | ✓ DEVIATIONS #32 |
| Category group | pad / gap / border-bottom / y,h | 16 0 / 12 / #35353B / 238,105 | same | 0 | ✓ |
| `Tires` chip (selected) | h / bg / color / border / w | 44 / #F4F4F5 / #0B0B0D / #35353B / 64.8 | same | 0 | ✓ (as drawn, DEVIATIONS #5) |
| `Wheels` chip | color / border / x,w | #A7A7AE / #35353B / 88.8,78.9 | same (`next/link`) | 0 | ✓ |
| size grid | columns / gap / y | 82 82 82 88 / 8 / 387 | same (`size-grid-sheet`) | 0 | ✓ |
| size field | h / bg / pad-l / y | 44 / #1F1F24 / 10 / 403 | same | 0 | ✓ (#14 border) |
| `Apply` | h / w / font / radius | 44 / 88 / 500 12 / 0 | 44 / 88 / 500 13 / 2 | 1px / 2px | DEVIATIONS #29 |
| Season chip `Winter` | h / x,w / y | 44 / 122.7,75.1 / 504 | same | 0 | ✓ |
| Brand group | gap / columns / row h / row gap / y | 8 / 179 179 / 44 / 10 / 565 | same | 0 | ✓ |
| brand name / count | font / x | 400 15 #F4F4F5 44 / 400 12 #8B909A 83.3 | same | 0 | ✓ |
| Brand group | height | 229 | 141 | −88 | DEVIATIONS #25 (3 rows) |
| Price group | pad / gap / no border | 16 0 / 16 / yes | same | 0 | ✓ |
| price value | font / tabular | 700 15/15 / no | same | 0 | ✓ |
| footer | pad / bg / border-top / y,h | 12 16 20 / #16161A / #35353B / 759,85 | same (`pb-safe` = 20 on a flat viewport) | 0 | ✓ |
| `Show N matches` | h / bg / color / radius / font / ls / w | 52 / #C9F23A / #0B0B0D / 2 / 500 14 / 1.12 / 358 | same (`Show 9 matches`) | 0 | ✓ |

> **Three rows above no longer have a target (2026-09-22).** `Category group`, `` `Tires` chip (selected) `` and `` `Wheels` chip `` measured the `Category` group, removed by the owner — `design/DEVIATIONS.md` **#60**. The **panel itself does not move**: scrim, panel `144,700`, header `145,85` and body `230,529` are fixed, so only the scroll content shortens, by the group's measured **105px**, and the size group's top moves 343 → **238**. Every other row on this table is unaffected.

## Overflow-only checks

| width | scrollWidth | note |
|---|---|---|
| 375 | 375 | none |
| 768 | 768 | 2-up grid 344 344, sticky bar `top:88`, page padding 32 (D46) |
| 1280 | 1280 | rail + 3-up 274.7 ×3 |
| 1440 | 1440 | none |

## Tablet band (720–1099) — spec-derived, no artboard

Header 88px with the phone CTA and the drawer; toolbar padding 32; sticky bar at `top:88`; grid 2-up;
rail hidden until 1100 (D46, DEVIATIONS #33). Not parity rows.

## States and interactions verified

- URL is the state (D44): sort `<select>` change → `?sort=price-asc` and a re-ordered grid; brand
  checkbox toggle → `brand=` dropped from the URL, count re-rendered (`5 matches`), focus kept on the
  toggled control (`rail-brand-zeta`).
- `?season=winter&brand=Zeta&min=100&max=140`: `Filters (3)`, price fill 16.67% / 16.67%, values `$100`
  `$140`, checkbox checked recipe exact; `?season=winter` paints the chip's selected recipe exactly at
  both widths (rail 75.1×40, sheet 75.1×44).
- Sheet: opens from `Filters (n)`, `<dialog>` modal with focus inside, `::backdrop` `--scrim-mid`,
  body scroll locked, Esc closes, focus returns, body unlocked.
- `Change vehicle`: `<details>` opens the inline finder (3 native selects) under the toolbar; desktop
  keeps breadcrumb, count and sort on the drawn top line (sort label stays at y 136.5).
  *(Verified 2026-09-21. D72 later took the count out of this row and lower-cased the link; the
  breadcrumb / sort geometry is unaffected. Re-measure with the browser checks in `DEVIATIONS.md`
  #61–#63 before citing these coordinates again.)*
- Count copy (D42, D49): `matches` = the best list. `/results` → `9 matches`, summary `Add vehicle`, no
  chip, 6 cards + `Load more`; `?year=2021&make=Honda&model=Civic` → placeholder fitment `215/55R16`
  (D48) gives `4 matches · 5 similar`, size selects stay `Any`, `Filters` (no count); `…make=Ford&model=F-150`
  (fitment `275/65R18`, not stocked) → `0 matches · 9 similar`, the `Best matches` h1 stays over the
  line `No exact size match for your 2021 Ford F-150 yet. Similar sizes are below.`, 3 similar cards +
  `Load more`. Sheet button keeps the total (`Show 9 matches`).
- First three best-matches card images render `loading="eager" fetchpriority="high"` (the page's LCP
  element); the fourth is `lazy`.
- `/styleguide`: one `<h1>`, `ResultsEmpty`, the open disclosure and `Button size="load"` render, no
  console errors.
- `npm run check` clean; slop grep zero hits in code.

## Lighthouse — mobile, production build, 2026-09-21

Runner: `design/reports/README.md` "Lighthouse". URL `/results?year=2021&make=Honda&model=Civic`
(the placeholder fitment path, D48). Three runs after the LCP fixes (first three best-matches card images
`loading="eager" fetchpriority="high"` via `ProductCard priority`).

| gate (`docs/decisions.md` §9) | threshold | run 1 | run 2 | run 3 | ok |
|---|---|---|---|---|---|
| Performance | ≥ 90 | 93 | 97 | 97 | ✓ |
| Accessibility | ≥ 95 | 100 | 100 | 100 | ✓ |
| CLS | ≤ 0.05 | 0 | 0 | 0 | ✓ |
| LCP | ≤ 2500 ms | 3.2 s | 2.6 s | 2.6 s | ✗ by 0.1–0.7 s |
| TBT | — | 30 ms | 10 ms | 20 ms | — |

Before the fixes: performance 92, LCP 3.4 s, `lcp-discovery-insight` 0 (first card `loading="lazy"`,
not discoverable, resource load delay 523 ms). After: discovery 1, load delay 6–15 ms. What remains is
Lighthouse's simulated slow-4G + 4× CPU chain: document (34 KB) → render-blocking CSS chunk (11 KB,
"est. savings 60–120 ms") → first paint. Closing the last 0.1–0.7 s means inlining critical CSS or
trimming the document; not a design-to-code change and not done here. Unthrottled, the LCP element
renders in ~90 ms (breakdown insight).

## Not run

- Keyboard walk beyond the sheet (Tab order through the rail) was not stepped control by control.
