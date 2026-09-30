# QA pass — 2026-09-29 (D91b)

A full QA and accessibility pass over the production build, run the way a dedicated QA team would:
across three engines and six device profiles, as a **committed Playwright suite** so every future change
reruns it. Owner brief, 2026-09-29. Everything here is measured by a test in `tests/e2e/`; the test title
is the evidence handle. `npm run test:e2e` reruns all of it.

**Result in one line:** one defect class dominated — **`loading.tsx` hid every page from visitors without
JavaScript and turned 404s and 500s into 200s** — and it had passed every earlier check because the served
HTML contained the right markup, just inside a hidden streaming container. It is removed (owner ruling).
**32 further defects** were found; **28 are fixed**, each proven by its failing test turning green; the rest
are recorded below with an owner or a reason. The last five (FIN-1…5) came out of the final full runs on
2026-09-30, and one of them is the worst thing this pass found after `loading.tsx`: **product photos that
had already loaded could stay invisible**, because the D92b fade's bootstrap ran after they fired `load`.

---

## 1. Method and harness

| | |
|---|---|
| Runner | `@playwright/test` 1.63 + `@axe-core/playwright` 4.13 (WCAG 2.0/2.1 A+AA and 2.2 AA tags) |
| Build | **production only** — `next build && QA_ERROR_ROUTE=1 next start -p 3100` (D88: dev fakes both passes and failures) |
| Projects (15) | `chromium/firefox/webkit` × `1280/1440/1920`; `iphone-se` 375 (WebKit), `iphone-15-pro` 393 (WebKit), `pixel-7` 412 (Chromium), `ipad-mini` 768 (WebKit), `ipad-pro-landscape` 1366 (WebKit), `floor-320` (Chromium) |
| Specs | `smoke`, `finder`, `results`, `home`, `product`, `nojs`, `responsive`, `a11y-axe`, `a11y-interaction`, `visual`, `parity`, `perf`, `engines`, `error-boundary` |
| Error boundary | `/qa-error` throws only on a server started with `QA_ERROR_ROUTE=1`; elsewhere a plain 404 (owner: "Env-guarded test route") |
| Visual baselines | `visual.spec.ts`, `chromium-1440` only, 390 and 1440 per route. **`/styleguide` is shot under `prefers-reduced-motion: reduce`, not masked**: §12's `LoaderMark` sweeps forever (D92b addendum, #81), and the reduced-motion kill settles it to its static ring, so the mark stays in the diff in the form a reduced-motion visitor sees. |
| Agents | six Opus agents wrote specs on disjoint files, one did a static `web-design-guidelines` + harden review, three Opus agents fixed on disjoint files, each proving its fix on a private build. None drove the shared browser pane. |

**Method rules that mattered:** hit-test with `elementFromPoint`, never trust markup (D86); real keyboard,
never scripted focus (`HANDOFF.md` §8.18); contrast over photos by **pixel sampling** — text hidden, the
ground sampled, text re-composited — never CSS (the D67 lesson, and it found two more lines this time).

**Not covered, and why:**
- **Real Mobile Safari.** The iOS Simulator needs the full Xcode app; this machine has only the Command
  Line Tools. The five WebKit device projects are the proxy. WebKit emulation reports every safe-area inset
  as 0, so the `viewport-fit=cover` change is verified by its markup and by flat-screen parity only.
- **Real touch drags** on mobile WebKit: Playwright has no touch-move there. Price-range dragging is
  tested with the mouse on desktop engines and with the keyboard on devices.

---

## 2. Matrix

Rows are the brief's cells; columns are project groups. **P** pass · **F** fail (open finding) · **X**
fixed this pass (was F) · **—** not applicable at that width · **fixme** known and recorded (cited).

**Gate run, 2026-09-30:** `npm run test:e2e -- --workers=5` on the production build (`next start`, :3100),
all 15 projects — **2,785 passed, 0 failed, 0 flaky, 3,290 skipped**, 21.2 min. Skips are project gating
(a cell that only exists at one width or engine, e.g. contrast and parity run once in `chromium-1440`) plus
the nine fixmes below. Counts are tests per cell summed over the group's projects (desktop = 1280/1440/1920).
"X" is not a column: every cell that was F during the pass and is P now is listed under **Fixed this pass**.

| Cell | Chromium desk | Firefox desk | WebKit desk | iPhone SE | iPhone 15 Pro | Pixel 7 | iPad mini | iPad Pro L | 320 |
|---|---|---|---|---|---|---|---|---|---|
| Routes load clean, one h1, no overflow | P 42 | P 42 | P 42 | P 14 | P 14 | P 14 | P 14 | P 14 | P 14 |
| Real 404s | P 9 | P 9 | P 9 | P 3 | P 3 | P 3 | P 3 | P 3 | P 3 |
| Every loaded image paints | P 39 | P 39 | P 39 | P 13 | P 13 | P 13 | P 13 | P 13 | P 13 |
| Error boundary: 500, branded, axe | P 6 | P 6 | P 6 | P 2 | P 2 | P 2 | P 2 | P 2 | P 2 |
| Finder: models narrow, finder-only vehicles | P 14 | P 14 | P 14 | P 13 | P 13 | P 13 | P 13 | P 13 | P 13 |
| Results: filters, counts, URL state | P 15 | P 15 | P 15 | P 17 | P 17 | P 18 | P 17 | P 13 | P 17 |
| Results: price range | P 7 | P 7 | P 7 | P 1 | P 1 | P 3 | P 1 | P 1 | P 3 |
| Results: sort | P 1 | P 1 | P 1 | P 1 | P 1 | P 1 | P 1 | P 1 | P 1 |
| Results: load more | P 3 · fixme 3 | P 3 · fixme 3 | P 3 · fixme 3 | P 3 · fixme 1 | P 3 · fixme 1 | P 3 · fixme 1 | P 3 · fixme 1 | P 3 · fixme 1 | P 3 · fixme 1 |
| Home: hero, carousel, tiles, contact | P 28 | P 27 | P 27 | P 9 | P 8 | P 8 | P 8 | P 9 | P 8 |
| Nav drawer | — | P 3 | — | P 3 | P 3 | P 3 | P 3 | — | P 3 |
| Home anchors #contact / #how-it-works | P 18 | P 19 | P 18 | P 6 | P 6 | P 6 | P 6 | P 6 | P 6 |
| PDP: quantity, gallery, specs | P 34 · fixme 3 | P 34 · fixme 3 | P 34 · fixme 3 | P 35 · fixme 1 | P 35 · fixme 1 | P 35 · fixme 1 | P 34 · fixme 1 | P 34 · fixme 1 | P 35 · fixme 1 |
| PDP: quote form | P 11 | P 11 | P 11 | P 11 | P 11 | P 11 | P 11 | P 11 | P 11 |
| No-JS paths | P 42 · fixme 6 | P 42 · fixme 6 | P 42 · fixme 6 | P 11 · fixme 2 | P 11 · fixme 2 | P 11 · fixme 2 | P 11 · fixme 2 | P 14 · fixme 2 | P 11 · fixme 2 |
| Responsive: sweep, long content, landscape | P 61 | P 51 | P 59 | P 12 | P 12 | P 12 | P 12 | P 12 | P 12 |
| axe WCAG 2.2 AA, every route and state | P 53 · fixme 6 | P 38 · fixme 6 | P 52 · fixme 6 | P 63 · fixme 2 | fixme 2 | P 63 · fixme 2 | P 46 · fixme 2 | fixme 2 | P 63 · fixme 2 |
| Keyboard walk, focus, dialogs | P 28 | P 27 | P 27 | P 5 | P 4 | P 5 | P 4 | P 4 | P 4 |
| Text spacing 1.4.12, reflow 1.4.10, zoom | P 29 · fixme 3 | P 29 · fixme 3 | P 29 · fixme 3 | P 14 · fixme 1 | P 14 · fixme 1 | P 14 · fixme 1 | P 14 · fixme 1 | P 14 · fixme 1 | P 28 · fixme 1 |
| Contrast (CSS + pixel-sampled) | P 24 | — | — | — | — | — | — | — | — |
| Forced colours, reduced motion | P 5 | P 4 | P 4 | P 4 | — | P 4 | — | — | — |
| Parity vs artboards | P 6 | — | — | — | — | — | — | — | — |
| Visual baselines | P 27 | — | — | — | — | — | — | — | — |
| Perf: CLS, INP proxy, LCP reported | P 12 · fixme 3 | fixme 3 | fixme 3 | fixme 1 | fixme 1 | P 4 · fixme 1 | fixme 1 | fixme 1 | P 4 · fixme 1 |
| Engine quirks | P 27 · fixme 3 | P 27 · fixme 3 | P 27 · fixme 3 | P 9 · fixme 1 | P 9 · fixme 1 | fixme 1 | P 9 · fixme 1 | P 9 · fixme 1 | fixme 1 |

**Fixed this pass (was F):** routes load clean + one h1 — RES-1/NJR-1 (no-JS skeleton), VPE-10; real 404s /
error boundary — WDG-02 and the 500; every loaded image paints — FIN-1; finder — WDG-03; results filters —
FIN-2, NJR-9; results price range — KBD-3; home anchors — HPD-1, FIN-3; home/PDP card → `#quote` — FIN-4;
PDP quantity/quote form — WDG-04/05/11, HPD-2/3; responsive — NJR-2/3/6/7/8/9/10; axe/2.4.11 — AXE-1;
text spacing — KBD-2, KBD-6/7; contrast — KBD-1; forced colours / reduced motion — KBD-3/4/5; parity — VPE-1…5;
keyboard walk / disclosure — FIN-5.

**The nine fixmes, each cited in its title:** price-range thumbs 24×24 (D69); results count on Load more
and focus after Load more (D68, `src/features/results/llm.md` Open); mobile brand strip clips wordmarks
(artboard, `design/inventory/home.md:306-308`); WebKit radio ring (VPE-9, needs real Safari); price labels
and header Menu without JS (NJR-4, NJR-5 — senior pass); results filter-commit CLS under Slow 4G (VPE-8,
accepted by the owner); unavailable PDP state (parked, D54 §7.16).

---

## 3. Findings

Severity: **P0** broken core flow / data loss / crash · **P1** WCAG A/AA failure or a flow broken on one
engine or device class · **P2** degraded but workable · **P3** polish. Status: **Fixed** (test red → green),
**Owner** (needs a ruling, not applied), **Known** (already recorded elsewhere).

| ID | Sev | Finding | Evidence (measured) | Test | Status |
|---|---|---|---|---|---|
| RES-1 / NJR-1 / WDG-01 | **P1** | JS off → every storefront route shows only the loading skeleton | `h1` visible 0 on `/`, `/results`, `/about`, PDP in all three engines; `<main>` inside `<div hidden id="S:0">` | `nojs.spec.ts` (all), `results.spec.ts` › with scripting off…, `finder.spec.ts` › with scripting off… | **Fixed** — `loading.tsx` removed (owner). After: h1 1, main 1580–4827px tall, rail noscript Apply visible, all engines |
| WDG-02 | P2 | Unknown product slug returned **200** (soft 404) | `/products/not-a-slug` 200 with `noindex`; `/asdf` 404 | `smoke.spec.ts` › …: a real 404 | **Fixed** — same removal; now 404 |
| — | P2 | A render error returned **200** | `/qa-error` 200 with the boundary streamed in | `error-boundary.spec.ts` | **Fixed** — now 500 |
| HPD-1 | **P1** | Header/drawer/footer `Contact` and `How it works` from another page often did not reach the section | 8 of 15 projects; WebKit `/results` → Contact stayed at scrollY 0 in 3 of 4 runs, `#contact` at 4112 | `home.spec.ts` › header Contact from another page…, footer How it works… | **Fixed** by the removal — 180/180 navigations after, 10 projects × 3 repeats |
| AXE-1 | **P1** | Shift+Tab parks focus fully under the mobile sticky filter bar (WCAG 2.4.11) | `Load more` 68.3–120.3 under a 68–138 bar at 375; card links 95–121 under 88–158 at 768 | `a11y-axe.spec.ts` › focus never fully hidden under the sticky bar | **Fixed** — `scroll-padding-top` 138/158px below `md:` (`globals.css`) |
| KBD-1 | **P1** | Hero eyebrow and h1 below AA over the tread photo at 1440 | eyebrow min 2.03 / p10 2.33 (needs 4.5); h1 min 2.29 / p10 2.99 (needs 3) | `a11y-interaction.spec.ts` › contrast over photos (pixel-sampled): home @1440 | **Fixed** — upper scrim `--scrim-mid` (owner; DEVIATIONS #79) |
| KBD-2 | **P1** | Hero copy clipped under the WCAG 1.4.12 text-spacing override | eyebrow cut 216px, h1 130px at 1440, all engines; 296/215px at 768 | `a11y-interaction.spec.ts` › text spacing 1.4.12: home | **Fixed** — `min-h-*`, copy in flow; rest geometry byte-identical |
| NJR-9 / WDG-16 | **P1** at 320 | Real seed vehicles widen the page at 320 (WCAG 1.4.10) | `2024 Jeep Grand Cherokee` → scrollWidth 333; `Silverado` 321 | `responsive.spec.ts` › vehicle chip: the longest seeded vehicles fit the row | **Fixed** — row wraps, chip truncates; 390 row unchanged |
| NJR-10 | P3 | A 120-char URL model pushed the chip to 916px | chip right edge 916 at 375 | `responsive.spec.ts` › 120-char model | **Fixed** (same change; now also unprintable, WDG-03) |
| WDG-03 | P2 | URL vehicle printed verbatim — anyone could put text and a phone number on a link to the site | `?year=<b>FREE</b>&make=Call 416-000-0000…` rendered in the quote chip (escaped; no script) | `finder.spec.ts` › unknown vehicle text in the URL is never printed ×4 | **Fixed** — only finder vehicles accepted (owner; narrows D79) |
| WDG-04 | P2 | After one invalid submit the Quantity select stopped following `?qty=` (D84 regression) | real clicks 2 → Custom → 1: select stuck | `product.spec.ts` › after an invalid submit the select still follows the cells | **Fixed** |
| WDG-05 | P2 | Quantity cell tap threw the phone page to the top | iphone-se scrollY 515 → 0, pixel-7 19 → 0 | `product.spec.ts` › a numeric cell tap holds the scroll position | **Fixed** — `scroll={false}` on 1/2/4 |
| HPD-2 | P2 | `beforeunload` "Leave site?" when tapping Call with a dirty form | Chromium + Firefox, desktop and Android | `product.spec.ts` › tapping a tel: link with a dirty form raises no leave-page prompt | **Fixed** — non-http(s) clicks skip the guard |
| HPD-3 / WDG-11 | P3 | Custom quantity: Firefox submitted `abc` as blank; server accepted `1e1`, `0x10`, `+5` | success panel shown for `abc` | `product.spec.ts` › non-numeric custom quantity… | **Fixed** — text + `inputMode="numeric"`, `/^\d{1,2}$/`, existing D75 message |
| WDG-06 | P2 | Card `sizes` did not match the grids — phones fetched ~half the pixels | at 412 DPR 2.625 the browser chose 640w for a 992px need | `results.spec.ts` › card photos fetch a candidate at least as wide as they paint | **Fixed** — per-grid `sizes` |
| NJR-6 | P2 | `Currently unavailable` badge overlapped the brand stamp at 1100–1180 | up to 34.6px (`/accessories` @1100) | `responsive.spec.ts` › the unavailable badge never collides with the brand stamp | **Fixed** — stamp wraps; 390/1440 unmoved |
| NJR-7 | P2 | Home contact phone numbers wrapped to 2–4 lines in 720–1100; Firefox overflowed the page | scrollWidth 775 at 768 (Firefox) | `responsive.spec.ts` › phone numbers stay on one line | **Fixed** — `whitespace-nowrap`, cards stack to `md:` |
| NJR-8 / KBD-8 | P2 | Long real tire words overflow the PDP title | `Ganzjahresreifen` 386/343 at 375; desktop column 576 → 606 | `responsive.spec.ts` › PDP title… | **Fixed** — `wrap-anywhere`, `min-w-0` |
| NJR-3 | P2 | Filter sheet body 60–93px tall on landscape phones | 667×375 → 60px | `responsive.spec.ts` › landscape phones… | **Fixed** — full height below 500px tall |
| NJR-2 | P2 | `pb-safe` inert on real iPhones — no `viewport-fit=cover` | served viewport meta had none | `responsive.spec.ts` › env(safe-area-inset-*)… | **Fixed** — `cover` + side insets on `body` and modal dialogs (owner) |
| KBD-3 | P2 | Price slider invisible in forced colours | 0 px differ from `Canvas` | `a11y-interaction.spec.ts` › forced colours… | **Fixed** — system-colour thumbs and fill |
| KBD-4 | P2 | Current nav item and selected quantity cell indistinguishable in forced colours | pixel probes identical | same | **Fixed** |
| KBD-6 | P2 | Brand wordmarks collide in the undrawn bands, at rest and under text spacing | `Bridgestone` ∩ `Continental` 19.7px at 720, 6.7px at 1100; 36×24px under spacing at 768 | `a11y-interaction.spec.ts` › text spacing: home | **Fixed** — 6 columns from 720 to 1319 (owner; DEVIATIONS #82) |
| KBD-7 | P3 | Footer/contact link text escapes its box at 768 under text spacing | 13px / 23px | same | **Fixed** |
| KBD-5 | P3 | Sheet `::backdrop` still transitioned under reduced motion | 150ms | `a11y-interaction.spec.ts` › reduced motion… | **Fixed** — `*::backdrop` in the kill |
| VPE-1 | P2 | PDP spec table inset 48px each side | x 96 / w 1248 vs drawn 48 / 1344 | `parity.spec.ts` › product 1440 | **Fixed** (restores drawn) |
| VPE-2 | P2 | PDP h1 grey, drawn white | rgb(167,167,174) vs rgb(244,244,245) | `parity.spec.ts` › product 390/1440 | **Fixed** (restores drawn) |
| VPE-3 / 4 / 5 | P3 | Size numeral line-height, breadcrumb line boxes, stray mobile price padding | buy panel 12–23px low; mobile results toolbar 13px low | `parity.spec.ts` › product 390/1440, results 390 | **Fixed** (restores drawn) |
| VPE-10 / RES-3 | P3 | Unused Barlow Condensed 600 preloaded; Firefox warned | 5 woff2 preloaded, one unused | `perf.spec.ts`, console watch | **Fixed** — 700 only |
| VPE-6 | P3 | Quote band 26px taller than drawn: the consent row's 44px floor was undocumented | 833 vs 807 | `parity.spec.ts` › product 1440 | **Recorded** — DEVIATIONS #80 (the floor is §5 policy) |
| VPE-7 | P3 | Desktop nav 14.6px left of drawn since D76; #66 said "nothing reflows" | x 532.0 vs 546.6 | `parity.spec.ts` › home 1440 | **Recorded** — #66 corrected in place |
| VPE-8 | P2 | CLS 0.056–0.075 on desktop `/results` filter commit under Slow 4G + 4× CPU | one entry, commit lands > 500ms after input | `perf.spec.ts` › results | **Accepted** (owner: keep the D92b card-move motion). CLS 0 on normal networks |
| VPE-9 | P2 | WebKit drops the focus ring when arrowing between Preferred-contact radios | all 7 WebKit projects | `engines.spec.ts` | **Open** — needs real Safari to confirm it is not a Playwright-WebKit heuristic |
| NJR-4 | P3 | Without JS the price readout does not follow the thumb | label stays `$90` while value moves | `nojs.spec.ts` | **Open**, P3 |
| NJR-5 | P3 | Below 1100 without JS the header `Menu` button is inert | footer nav still reachable | `nojs.spec.ts` | **Open**, P3 |
| HPD-5 | P3 | Dirty quote form is lost silently on in-app navigation | Chromium, header logo → `/` | — | **Owner** (policy question) |
| AXE-3 / WDG-14 | P3 | Size variants of one product share a `<title>`; `/results` is titled "Results" | curl | — | **Open** → senior pass (§6 housekeeping) |
| **FIN-1** | **P1** | Loaded photos stuck invisible: the D92b image fade never released | `/results` @1440: the second card row painted blank (opacity 0) on a first load; `data-loaded` was never set on any image loaded before hydration. Next 16 serves `beforeInteractive` as a `self.__next_s` push run at hydration, so the bootstrap's `load` listener arrived after those events | `smoke.spec.ts` › every loaded image paints (no stuck fade) — red on 6 of 13 routes | **Fixed** — `MOTION_BOOT` also marks every already-`complete` image (`layout.tsx`) |
| **FIN-2** | P2 | A filter changed right after the previous commit was silently dropped | 22 of 36 rapid chip/brand sequences lost a click (webkit-1440, chromium-1440, ipad-mini, pixel-7); the form is keyed on `href` and its `change` listener was a passive effect, so a click between the re-mount and the effect had no listener | `results.spec.ts` › rapid filter changes (D91b) | **Fixed** — listener in `useLayoutEffect` (`filter-panel.tsx`); 36/36 after |
| **FIN-3** | P3 | Same-page `Contact` / `How it works` on `/` landed 12px above its `scroll-margin-top` | `top 68 vs 80` desktop, `44 vs 56` phones, four engines; cold `/#how-it-works` 10% (WebKit, iPhone SE). The target was still a `pending` reveal, translated `--motion-rise` | `home.spec.ts` › header / drawer Contact on `/`, cold load `/#…` | **Fixed** — `ScrollReveal` reveals a fragment target at once and never arms a cold-load target; 40/40 after |
| **FIN-4** | P2 | Card `Request a quote` → PDP `#quote` could stop short and stay there | final scrollY 1558 / 1638 / 1408 vs 1486 (pixel-7), 7–11 of 24 under load. Next's hash scroll runs `disableSmoothScrollDuringRouteTransition` with `dontForceLayout: true` and reads no layout first, so Chromium keeps gliding and the glide is cut short | `home.spec.ts` › Request a quote on a card goes to the PDP #quote band | **Fixed** — `HashScroll` re-lands `instant` on each route arrival with a fragment; 48/48 after |
| **FIN-5** | P3 | Enter on `Change vehicle`, then Tab, skipped the whole finder and landed on Sort | chromium-1440 and -1920, every run: the D92b `::details-content` transition listed `content-visibility` with `allow-discrete` on the open edge too, so the panel stayed `hidden` (unfocusable) for the transition | `finder.spec.ts` › Change vehicle opens from the keyboard… | **Fixed** — open edge transitions opacity only (`globals.css`); the close edge still holds the box |
| WDG-07/08/09/10/12/13/15/17/18 | P3 | min/max pinned into every filter URL; unknown size/brand values count as filters with no control; year baked into prerenders; consent tick cleared by a validation error (needs a §7 ruling); no length caps on name/email/phone; no hover on carousel arrows and quantity cells; phone and brand wrapping/translation; `Change vehicle` opens empty; latent `$Infinity` on an empty category | see WDG findings | — | **Open**, P3 → senior pass |

Also fixed in the harness itself (found by the agents, not product defects): `engineOf()` misread every
device project as Chromium; `settle()` returned before the streamed page was revealed; evidence was being
wiped by concurrent runs sharing `test-results/` (every run now passes `--output`).

**Harness fixes from the final run (2026-09-30), none a product defect:** `<html>` is `scroll-behavior:
smooth` (D92b), so Playwright's actionability scroll glides and a click, hover or focus probe issued
mid-glide sees a moving target — `scrollSettled()` (helpers) and a settle step in the 2.4.11 probe wait for
rest first; the idle `NavProgress` overlay (D92b addendum, full-viewport, opacity 0, `aria-hidden`) was
being counted as text by both contrast sweeps and as an obscuring box by the 2.4.11 probe; the forced-colours
nav probe sampled inside the link while the D92b `nav-indicator` paints at `bottom: -2px`; the parity rows
now carry the recorded #66 (nav x) and #80 (quote band h) values; the error-boundary `alert` is scoped to
`<main>` (Next's route announcer is also `role="alert"`); WebKit's "`_rsc` … access control checks" for an
aborted prefetch is not a page error; the 120-char URL vehicle test asserts no chip (WDG-03).

---

## 4. Checked and cleared — looked like defects, are not

- **WebKit Tab skips links, buttons, radios and ranges** (desktop and devices): Safari's default with Full
  Keyboard Access off. Option+Tab reaches every control; the specs use it. Not a site defect.
- **WebKit does not focus a button on mouse press**, so pointer-opened dialogs return focus to `<body>`.
  Keyboard-opened, focus returns to the trigger in every engine.
- **Gecko ends a modal's Tab cycle in browser chrome** instead of wrapping; nothing behind the modal is ever
  reached, so the trap holds.
- **Firefox makes the rail `<aside>` a Tab stop** (it scrolls since D68); it is named "Filters". Engine
  behaviour.
- **axe: zero violations** on 14 routes × every state (sheet, drawer, `Change vehicle`, quote error, quote
  success, empty results) in three engines and four devices, except the known D69 range thumbs. Heading
  outline, landmarks, names, ids (the rail+sheet `idPrefix` holds, D57), alt, `lang`: clean everywhere.
- **Live regions work:** the results count is the same DOM node after a filter change and after going to
  zero (reads exactly `0 matches`); the quote summary announces "3 fields need a fix…".
- **Contrast over CSS backgrounds:** ~100 text nodes per route, 6 routes × 390/1440, zero failures (lowest
  `--text-dim` on `--surface-2` 5.12:1). **Over photos:** the D67 lede fix holds (p10 17.5); tile titles,
  captions, nav over the hero, promo copy all pass; card badges sit on the flat canvas, never on a photo.
- **Keyboard walk, 14 routes × 3 engines:** skip link first, a visible indicator on every stop, no hidden
  focusable, no backwards jump, no trap outside dialogs.
- **Reflow at 320 and at the 400%-zoom equivalent (320×256):** no two-dimensional scroll on any route in
  any engine, after the fixes above.
- **Width sweep 320 → 2560 (17 widths × 14 routes):** zero horizontal overflow after NJR-7.
- **No XSS** through any parameter; repeated, NaN, negative and huge params fall back safely; every island
  cleans up its listeners; no hydration-unsafe `Date`/`random`/`window` in render.
- **`@starting-style`, `<dialog>`, `:has()`, `dvh`, `overscroll-behavior`, hidden scrollbars:** all render
  and behave in Chromium, Firefox and WebKit.
- **Visual baselines are deterministic** once the test waits for every image to load and decode.
- **Load CLS is 0** on every page type; the INP proxy peaked at 72ms under 4× CPU.
- **`/styleguide` at 320 under the 1.4.12 override** clips its display-type specimens (`Styleguide` h1
  5.6px past the viewport). The specimens are fixed-size on purpose and the page is internal and `noindex`;
  that one cell is skipped, with the reason in the test.
- **Filter commits "not reaching the URL" under 6-worker load** were two things: the real FIN-2 race, and
  hydration arriving after the test's first click. Re-measured alone: every commit lands in 321–1555ms.

---

## 5. Not defects — parked or artboard-mandated

**Parked (D54), listed only:** the mobile LCP gate (measured 2.0–4.2s under Slow 4G, reported, never
failed on); the unavailable-PDP state (`test.fixme`). **Quote delivery** was parked here but is
**unparked upstream** (`origin/main`, D104 — email via Resend); this checkout does not have it yet.

**Artboard-mandated or already ruled:**
- `sort` is JavaScript-only (D57); the filter sheet needs JavaScript (D83).
- The sticky filter bar pins at 68/88px under a header that scrolls away, leaving a strip above it —
  drawn (`results-mobile.html:98`).
- The mobile brand strip clips 9 of 12 wordmarks — drawn (`design/inventory/home.md:306-308`). Worth an
  owner look against WCAG 1.4.10, since the clipped names are not reachable.
- `Load more` drops focus to `<body>` and announces nothing — known, D68 / `src/features/results/llm.md`.
- Price-range thumbs are 16px against the 24px target size — known, D69.

## 6. Lighthouse — production build, 2026-09-30

Lighthouse 13.5, headless Chrome, `next start` on :3100, two runs per cell (`run 1 / run 2`; the simulated
LCP varies between runs on this machine, `design/reports/README.md`). Mobile is Lighthouse's default
emulation (Moto G Power, slow 4G, 4× CPU); desktop is `--preset=desktop`. **LCP is parked (D54): reported,
not gated.**

| Page | Form factor | Perf | A11y | Best pr. | SEO | LCP (parked, D54) | CLS | TBT | FCP |
|---|---|---|---|---|---|---|---|---|---|
| `/` | mobile | 92 / 91 | 100 / 100 | 100 / 100 | 100 / 100 | 3.3 s / 3.5 s | 0.000 / 0.000 | 6 ms / 0 ms | 0.9 s / 0.9 s |
| `/` | desktop | 99 / 100 | 100 / 100 | 100 / 100 | 100 / 100 | 0.9 s / 0.7 s | 0.000 / 0.000 | 0 ms / 0 ms | 0.2 s / 0.2 s |
| `/results?…Civic` | mobile | 92 / 92 | 100 / 100 | 100 / 100 | 100 / 100 | 3.3 s / 3.4 s | 0.000 / 0.000 | 2 ms / 2 ms | 0.9 s / 0.9 s |
| `/results?…Civic` | desktop | 100 / 100 | 96 / 96 | 100 / 100 | 100 / 100 | 0.6 s / 0.6 s | 0.000 / 0.000 | 0 ms / 0 ms | 0.2 s / 0.2 s |
| PDP (tire, Civic, qty 4) | mobile | 93 / 93 | 100 / 100 | 100 / 100 | 100 / 100 | 3.2 s / 3.2 s | 0.000 / 0.000 | 2 ms / 2 ms | 0.9 s / 0.9 s |
| PDP (tire, Civic, qty 4) | desktop | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 | 0.6 s / 0.6 s | 0.000 / 0.000 | 0 ms / 0 ms | 0.2 s / 0.2 s |
| `/about` | mobile | 98 / 98 | 100 / 100 | 100 / 100 | 100 / 100 | 2.5 s / 2.5 s | 0.000 / 0.000 | 1 ms / 0 ms | 0.8 s / 0.8 s |
| `/about` | desktop | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 | 0.5 s / 0.5 s | 0.000 / 0.000 | 0 ms / 0 ms | 0.2 s / 0.2 s |

The one sub-100 accessibility score is `target-size` on `/results` desktop: the two 16px price-range
thumbs (`#rail-price-min`, `#rail-price-max`) — the known D69 limit, carried by its `test.fixme` in
`a11y-axe.spec.ts`. Mobile scores 100 because the sheet is closed at load. Mobile LCP is the one red gate
row (3.2–3.5 s on three page types, 2.5 s on `/about`), the same build-wide cause as `HANDOFF.md` §7,
still parked. **Lighthouse a11y 100 is not evidence of accessibility** (D56): it passed every page while
this pass found FIN-2, FIN-3 and FIN-5 by real input.

## 7. Senior pass — "break the site" (D93b, 2026-09-30)

Second pass on top of the D91b suite, run against the production build on the same 15 projects. New specs:
`routes` (status table for 38 wrong URLs, 404s branded / `noindex` / axe, current-nav rule), `hostile-query`
(hostile query-string table on the three results routes and the tire PDP), `crawl` (every visible control on
every route and state: hit-test, name, link status, effect, target size) and `environment` (offline, blocked
storage, failed images and fonts, CPU races, rotation, 50 % / 400 % zoom, print, two tabs). Method, evidence
and the rule "red before, green after" are as §1.

**Owner rulings (verbatim, 2026-09-30):** ID "D93b"; 404 "Line + two actions"; root error "Add a branded
global-error"; tab titles "will fix once data is ingested" (deferred); Change vehicle "Keep filters, stay
empty"; no-JS Menu "Menu jumps to footer nav"; no-JS price labels "Leave as known"; starter SVGs "Yes,
delete"; WDG-15 "Fix both"; WDG-13 "Add, using existing tokens"; WDG-10 "Restore their own tick"; WDG-12
"maxLength + server caps"; ENV-1 "Fix: keep the form + a short error line"; ENV-2 "Author a minimal print
stylesheet"; the four copy rewrites below, all approved.

### 7.1 Fixed, each proven red → green

| ID | Defect | Fix | Proof |
|---|---|---|---|
| ROU | `/about`, `/privacy`, `/terms` and every 404 marked **Tires** as the current nav item (`active` defaulted to `"tires"`) | no default; current links carry `aria-current="true"` in header and drawer | `routes.spec` red 60 → green 210 |
| 404 | the 404 was a bare stub | `PageStub` requires a `lede`; owner's line + `Shop tires` and `Call` pair; branded, `noindex`, axe-clean | `routes.spec` |
| ROOT | a root-layout error showed Next's blank shell | `src/app/global-error.tsx` (dark, `lang=en`, titled, `RouteError`) — second allowed `"use client"` under `src/app/` | `error-boundary.spec` with `PW_ROOT_ERROR=1` |
| WDG-07 | a JS filter commit pinned `min`/`max` at the price bounds in the URL | only a moved handle is kept | `hostile-query.spec` |
| WDG-08 | unknown size values and brands counted as filters: **21 badge/control mismatches → 0** (`?width=abc` read `Filters (1)` over `Any`) | badge counts only what a visible control shows | `hostile-query.spec` |
| WDG-18 | an empty category rendered `$Infinity` price bounds | guarded | `hostile-query.spec` |
| WDG-17 | `Change vehicle` dropped the active filters | hidden `carry` inputs | `finder.spec` red 11 → green |
| WDG-10 | a failed submit silently unticked the visitor's CASL consent tick | their own tick is echoed back (`Checkbox restoreChecked`); a fresh form still renders unticked | `product.spec` |
| WDG-12 | unbounded fields; invisible characters passed `required` | `maxLength` name 100 / email 254 / phone 32 / message 1000 mirrored server-side, `\p{Cf}` stripped, existing error strings | `product.spec` |
| WDG-13 | carousel arrows and quantity cells had no hover; arrows were named `Previous`/`Next` | hover from existing tokens (DEVIATIONS #83, #84); named `Previous featured tire` / `Next featured tire`, `aria-controls` | `home.spec`, `responsive.spec` |
| WDG-15 | the phone number could wrap mid-number; brand names were machine-translatable | U+00A0 + U+2060 in `CONTACTS[0].display`; `translate="no"` on brands | `home.spec` |
| NJR-5 | with JS off, header `Menu` was a focusable inert button | a link to the footer nav (`#site-footer-nav`) until hydrated | `nojs.spec` (was `fixme`) |
| CRAWL-2.4.4 | card model links shared a name across size variants (`Antarctica Sport` ×2, `Snowleopard`, `Landgema`, `Spike Lug Nuts`, `TR76`, `TR79`) | `sr-only` size tail on the model link, pixels unchanged | `crawl.spec` |
| ENV-1 | offline, `Send inquiry` threw into the route error boundary and **deleted the visitor's typed name, email and message** | client `sendQuote` catch: form stays, every value kept, existing error summary shows *"We couldn't send that. Check your connection and try again."* (DEVIATIONS #86) | `environment.spec` red → green |
| ENV-2 | no print stylesheet: near-white text on white paper (h1 **1.1:1**, body **2.4:1**), sticky Filters/Sort bar printed | `@media print` block (DEVIATIONS #85) | `environment.spec` print ×4 red → green |
| HK | `public/{file,globe,next,vercel,window}.svg` starter files | deleted | — |

Copy rewrites (all four approved): email error → *"Enter an email like name@example.com."*; route error →
*"That page didn't load. Try again, or call us and we'll sort it out."*; message cap → *"Keep your message to
1,000 characters or fewer."*; summary → *"N fields need a fix before we can send your inquiry."*

### 7.2 Reported, not changed

- **Tab titles** (product pages in particular) wait on the catalogue; owner: "will fix once data is ingested".
- **No-JS price labels** (NJR-4) stay static; the `test.fixme` in `nojs.spec` cites it (owner: "Leave as known").
- **Offline navigation** (a full-page navigation with no network) ends on Chrome's own error page; there is no
  service worker and none is owed. Header/footer client navigations degrade cleanly and back online work.
- **Failed images / fonts:** 14 / 8 / 7 / 2 broken images on home / results / PDP / about leave `docH`
  unchanged and text readable; aborted Barlow renders in the fallback face with `docH` 1943 → 1994 on results.
- **Blocked storage** (`localStorage`/`sessionStorage` throw): every route renders clean and every island works.
- **CPU ×6, rotation with sheet or drawer open, 50 %/400 % zoom, two tabs:** all pass; the quote form's
  leave guard fires only in the tab with the dirty form.

- **WDG-09 (year rollover) tried and reverted.** A daily `revalidate` on `/`, `/about`, `/privacy`, `/terms` made
  Next send `stale-while-revalidate` for a year, which in Firefox left a background revalidation pending and
  hung 11 tests (measured: same test passes on the build without it). Owner: *"Revert it; redeploy each January
  (Recommended)"*. `Winter <year>` and `© <year>` therefore change when the site is redeployed (D32 unchanged).
- **ENV-3 (WebKit only, `test.fixme`):** with the network offline, a filter change leaves `aria-busy` set on
  WebKit (desktop and the iPhone/iPad projects); Chromium ends on the browser's own error page so it cannot show
  it. Not fixed: needs real Safari to confirm, and the fix needs a ruling.
- **ENV-4 (WebKit only, `test.fixme`):** at CSS `zoom: .5` the PDP `h1` reads hidden. CSS `zoom` is not browser
  zoom in WebKit, so this may be a harness artefact; unverified.
- The desktop arrow **press** (1px) is asserted on Blink and Gecko only; WebKit never applied `:active` to the
  synthetic held press (hover is asserted everywhere). Real Safari unverified.
- Harness fixes this pass: the styleguide has no header, so it has no `[drawer]` crawl state; the failed-image
  wait ignores lazy images in the phone carousel's horizontal scroller; parity locates a card by its model-name
  prefix now that the link carries a size tail; `/results?brand=zzz` is no longer empty (WDG-08), so the empty
  case is `?brand=Zeta&season=all-season`.

### 7.3 Housekeeping (checked, no change made)

No `og:*`, `twitter:*` or `canonical` tags anywhere; no `apple-touch-icon`; `/robots.txt` and `/sitemap.xml`
answer 404; `/favicon.ico` answers 200. These are launch items for the owner, not defects in the built UI.

### 7.4 Notes on the visual baselines

The committed `home-390` and `home-1440` baselines from D91b were **blank below "Book your winter set"** —
captured before the `[data-reveal="pending"]` sections were revealed. `visual.spec` now reveals every pending
section before capture. Regenerated on the final build: `home-390`, `home-1440`, `not-found-1440`,
`styleguide-390`, `styleguide-1440`; confirmed twice with zero diff and the images looked at (the home pages
show every section down to the footer). `about`, `privacy` and `terms` did not move enough to fail their
threshold once the stray Tires underline went, so their baselines are unchanged.

**Not verifiable here:** real Mobile Safari (the iOS Simulator needs full Xcode; the WebKit device projects
are the proxy). With JS off, a *root-layout* error still shows Next's empty shell — a framework limit.

### 7.5 Gate

`npm run check` clean, `next build` clean, `npm run test:e2e -- --workers=4` (private production build, all 15
projects): **6,246 passed, 0 failed, 0 flaky, 4,116 skipped** (per-project skips by design, plus the cited
`test.fixme`s: NJR-4, D69, ENV-3, ENV-4, and the parked unavailable PDP). At `--workers=5` a handful of
timing tests (INP proxy, filter-commit races in the crawl, forced-colours focus walk) fail under load and pass
alone; the gate run used 4 workers on this 8-core machine (`tests/llm.md` Open). A dangling promise in the
WebKit arrow test raised 3 "test ended" errors and was fixed and re-run green on the WebKit projects.
