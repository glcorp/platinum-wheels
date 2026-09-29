# Motion — inventory and measurements (D92b)

**Owner instruction, 2026-09-29, verbatim:** *"it feels a bit choppy there are no hover animations or the
loading is very abrupt … UI is good but It doesn't feel like very clean and smooth."*

**Ruling:** the owner chose the **Expressive** thesis (one `AskUserQuestion`, three levels offered) over
"Quiet continuity" (recommended) and "Transitions only". Recorded as **D92b** — suffixed because `origin/main`
already publishes D89–D104 (root `llm.md` §5b note); D91b is the concurrent QA-suite pass. `MOTION_INTENSITY` 3 → 6 (`.claude/rules/ui.md`). Drawn values that
change: `design/DEVIATIONS.md` #75–#78.

**Thesis.** Motion explains, it does not decorate. Hover and press acknowledge; route changes say *where
you went* (forward slides left, back slides right, sideways crossfades); the product photo is one object
that travels from the card into the product page; result changes say *what changed* (leavers fade,
survivors travel, arrivals rise in a short stagger); below-the-fold home sections arrive once. Nothing
above the fold is ever held back, nothing loops, nothing blurs, nothing scales past a 2px lift.

## How this was measured

- **Production build only** (`next build && next start`), built from a scratch copy on `:3200` so the
  concurrent QA pass's `:3100` server and `.next` were never touched. Dev streaming gives false
  negatives (D80, D88).
- **View transitions** by reading `document.getAnimations()` every animation frame for the
  `::view-transition-*` pseudo-elements and their computed `opacity` / `translate` / group
  `transform` / `width` — values below are those samples, not declarations. Chromium 152.
- **CSS transitions** by creating the transition (the drawn hover value set inline), pausing it and
  seeking to 0 / 25 / 50 / 100 % of its own duration — `:hover` cannot be forced from script, and a
  real mouse in a 1440 viewport emulated inside a 410px pane misses its target.
- **Live real-time samples** (sheet, drawer, scroll) in headless Chromium, where frames always tick; the
  browser pane skips view transitions and zeroes rects whenever it is hidden (`HANDOFF.md` §8.23).
- **Reduced motion** in headless Chromium with `reducedMotion: 'reduce'`, the same flows.

## Tokens (`globals.css` `@theme`)

| Token | Value | Use |
|---|---|---|
| `--ease-card` | `cubic-bezier(.2,0,0,1)` | The artboards' card curve — feedback and state |
| `--ease-arrive` | `cubic-bezier(.16,1,.3,1)` | Arrivals, reveals, morphs, slides in |
| `--ease-leave` | `cubic-bezier(.4,0,1,1)` | Exits |
| `--duration-feedback` | 120ms | Hover fills, press |
| `--duration-state` | 200ms | Disclosure, small enters, image fade, crossfade in |
| `--duration-exit` | 150ms | Anything leaving |
| `--duration-handoff` | 100ms | Entering view waits for the leaving one |
| `--duration-overlay` | 280ms | Sheet, photo morph, card travel, nav indicator |
| `--duration-route` | 350ms | Directional slide (owner) |
| `--duration-reveal` | 300ms | Home scroll reveal (owner) |
| `--stagger-step` | 30ms × ≤5 = 150ms | New result cards (owner) |
| `--motion-slide` / `-rise` / `-nudge` | 60px / 12px / 6px | Slide distance (owner) / reveal and card rise (owner) / small enters |

All three timing bands of the brief hold: feedback 120 (100–150), state 150–200 (150–250), overlays and
routes 280–350 (250–400). Longest single animation measured: **350ms**; longest with stagger delay:
**430ms** (150 + 280).

## Inventory

| Element | Trigger | Before | After | Duration / easing | Reduced motion | Measured |
|---|---|---|---|---|---|---|
| Every `a`/`button`/`summary`/`label`/`select`/`input`/`textarea` | hover (gated `hover:hover`, D17) | instant colour swap | colour, fill, border, underline, opacity ease | `--duration-feedback` `--ease-card` (one `@layer base` rule) | 0.01ms | header CTA fill `transparent → rgba(221,255,107,.61) → .88 → rgb(221,255,107)`; primary `#C9F23A → rgb(213,250,88) → rgb(219,253,101) → #DDFF6B`; nav text `.68 α → .875 → .96 → rgb(161,161,170)`; footer link `rgb(167…) → rgb(214…) → rgb(235…) → rgb(244…)` at 0/25/50/100 % |
| Focus ring / focused field border | focus | instant | **instant** (kept, DESIGN.md §4) | 0s | — | `:focus`, `:focus-visible` carry `transition-duration:0s` |
| `Button` primary/secondary/accent, `Chip`, qty cells, carousel arrows, mobile `tel:` circle, drawer buttons | press (`:active`, not hover-gated) | only primary had one | `translate 0 1px` | 120ms `--ease-card` | 0.01ms | `translate` declared in the base rule; iOS `:active` enabled by the `touchstart` no-op in `layout.tsx` |
| Text links (nav, footer, crumbs, prose, card model link, photo link, `Change vehicle`) | press | none | `opacity .7` | 120ms | 0.01ms | as above |
| `Checkbox` | press on its row | none | box border → `--text` (`group-active/check:`) | 120ms | 0.01ms | — |
| Product card | hover | border + 2px lift, 150ms (drawn) | **unchanged** | 150ms `--ease-card` | 0.01ms | rest-state diff: zero change |
| Category tiles | hover | nothing | card hover: border `--accent-hover`, −2px | 150ms `--ease-card` | 0.01ms | lift `0 → −1.21 → −1.76 → −2px` (DEVIATIONS #77) |
| Nav, inactive item | hover | text colour only | + 2px `--border-strong` rule scales in from the left | `--duration-state` `--ease-arrive` | 0.01ms | compiled `@media (hover:hover){.nav-rule:hover::after{scale:1}}`; rest `scale:0 1`, 2px, `bottom:-2px` (DEVIATIONS #76) |
| Nav active underline | category change via header | jumped | **travels** (`nav-indicator` shared element) | `--duration-overlay` `--ease-arrive` | 0s | `/results → /wheels`: x `451 → 496.6 → 522.0 → 529.3 → 531.4 → 532`, width `40.7 → 50.6 → 56.0 → 57.6 → 58.2px` over 280ms |
| Header | any route change | re-rendered with the page | **pinned** (`site-header`, `animation:none`) | — | — | group width 1440, identity transform, `animation-name:none` throughout |
| Page, typed forward (card, tile, winter promo CTA, "Try it" on `/styleguide`) | `nav-forward` | hard cut | old slides −60px and fades; new slides from +60px and fades in | slide `--duration-route` `--ease-arrive`; out-fade 150 `--ease-leave`; in-fade 200 after 100 | 0s | `/results → PDP`: old `0 → −51.8 → −58.6 → −60px`, opacity `1 → .48 → 0`; new `60 → 8.15 → 1.40 → 0px`, opacity `0 → .95 → 1` |
| Page, typed back (logo, Home crumbs, Results crumb) | `nav-back` | hard cut | mirrored | same | 0s | `PDP → /results`: old `0 → 37.9 → 55.8 → 60px`; new `−60 → −22.1 → −4.2 → 0px` |
| Page, untyped (header nav between categories, footer, drawer) | navigation | hard cut | crossfade, arriving view rises 6px | out 150 `--ease-leave`; in 200 + 6px over 280, after 100 | 0s | `/results → /wheels`: old opacity `1 → 0` by 150ms; new `0 → .95` at 183ms, `translate 6 → 0.76px` |
| `loading.tsx` skeleton → content | Suspense reveal | hard swap | skeleton fades out, page fades up (`route-out`/`route-in`) | as untyped | 0s | same classes as the row above; see Limits for when the skeleton shows at all |
| Card photo → PDP gallery | open a product from a card | photo vanished, gallery appeared | **one photo morphs** (`product-photo-<slug>`, only on `product-open`/`product-back` types) | `--duration-overlay` `--ease-arrive` | 0s | 326px at (377,287) → 681.9 at (66.5,129.9) → 700.6 → **702px at (49,121)**; reverse 702 → 433 → 339 → **326 at (377,301)**. Exactly one photo group on each trip |
| Result cards | filter, sort, `Load more` (same-route) | cards popped | leavers fade; survivors travel; arrivals fade up 12px, 30ms apart, ≤150ms | out 150; travel 280 `--ease-arrive`; in 200 + rise 280 | 0s | `?season=winter`: leavers `1 → 0` at 150ms; survivor `(376,864) → (1062.9,300.9) → (1064,300)`; arrivals rise `12 → 1.05px`, finishing at 400 and 430ms (delays 120 and 150ms). `Load more`: arrivals run `vt-fade-in` + `vt-rise` |
| Lazy images | image `load` | popped in | fade in over their own ground | `--duration-state` `--ease-card` | 0.01ms | from the frame `data-loaded` lands: `0 → .10 → .61 → .82 → .92 → .98 → 1` over ~230ms. `loading="eager"` (LCP) images never held |
| Home sections below the fold | enter viewport, once | static | fade + 12px rise | `--duration-reveal` `--ease-arrive` | never armed | at load all six sit below the 900px fold (first at 933px) and arm; revealed `opacity 0 → .30 → .79 → .93 → .98 → 1`, `translate 12 → 8.36 → 2.53 → 0.79 → 0px` in ~300ms. Hero and finder never carry `data-reveal` |
| Filter sheet | open / close | 150 in / 120 out (D67) | 280 in / 150 out | in `--duration-overlay` `--ease-arrive`, out `--duration-exit` `--ease-leave` | 0.01ms | open: transition `translate 0 100% → 0`, 280ms; close, real time: panel top `144 → 200 → 331 → 509 → 723 → 844` by 166ms, `display` held to ~300ms. Seeked on all four close paths (✕, Esc, scrim, Apply): `0 → 61 → 88 → 98 → 100%` |
| Nav drawer | close | (D67 fade) | unchanged | 120ms out | 0.01ms | opacity `1 → .35 → .09 → .01 → 0` over ~130ms, `display` held |
| `Change vehicle` disclosure | open / close | faded in, closed instantly | fades both ways (`::details-content`, falls back to D67's open-only) | `--duration-state` `--ease-card` | 0.01ms | — |
| Quote error summary, success panel, `Custom quantity` field | appear | fade (D67) / pop | `enter-rise`: fade + 6px | `--duration-state` `--ease-arrive` | 0.01ms | — |
| Header `Contact` / `How it works` on `/` | same-page fragment | cut (0 → 4044 in one frame) | glides | browser-native smooth (~1s over 4000px) | instant | `0 → 41 → 388 → 1673 → 2737 → 3583 → 3992 → 4044` |
| Cold landing on `/#how-it-works` | first load | instant | **instant** (kept) | — | instant | lands at 2597 in one frame |
| Route change from deep scroll | navigation | top, instant | **unchanged** | — | — | first frame on `/about` already at `scrollY 0` (Next's `data-scroll-behavior="smooth"` override) |
| Featured carousel arrows | click | smooth (D30) | unchanged | native | auto | — |
| Loader (`NavProgress` + `LoaderMark`, D92b addendum) | internal link click, GET submit, or `aria-busy="true"`, lasting past 150ms | nothing (the owner: *"the loading is very abrupt"*) | a `--scrim-mid` wash over the page with a 120px tyre in the centre — 24 tread ticks round a five-bolt hub, a lime head sweeping round, `Loading` beneath — fading in after the delay and out when the page or result lands; clicks pass through | appears after `--progress-delay` 150ms, wash fades in over `--duration-state`, tyre settles from 94% over `--duration-overlay` `--ease-arrive`; one sweep per `--progress-spin` 1000ms; out over `--duration-exit` | the wash, grey ring, hub and label appear; nothing sweeps | 1.2s injected server delay (first, top-bar version): start 4ms, visible 170ms, gone 350ms after landing; a prefetched `/about → /privacy` **never visible**. Final version, 4s delay: `data-state` `loading`, overlay opacity 1, background `rgba(11,11,13,.68)`, tyre 120px centred at 390×844 (x 135–255) and 1440×900 (x 660–780); tile-free. Sweep sampled: one lit tick with a fading tail across the next 12 (opacities 1 → .88 → … → .05) |

## Reduced motion

Headless Chromium, `reducedMotion: 'reduce'`, production build:

- `/`: **0** sections left pending (the island never arms); primary button `transition-duration` **1e-05s**.
- `/results → PDP`: the transition still runs structurally, but all **42** view-transition animations
  report duration **0** and delay **0** — the content swaps, nothing moves. Without the separate
  `::view-transition-*` block they would have run at full length: the `*` kill does not reach
  pseudo-elements that hang off `:root`.
- Fragment links jump; cold landings jump.

## Gates

| Gate | Result |
|---|---|
| `npm run check` | clean (one warning, in the QA pass's `tests/e2e/home.spec.ts`, not this change) |
| `next build` | clean |
| Rest-state drift vs. the pre-motion build | Every element on 9 routes × 390 and 1440 (111–617 elements each), 26 computed properties + box: **zero geometry changes**. The only computed differences: the active nav link's `border-*-color` accent → transparent (now painted by the `nav-indicator` span, identical pixels, #76) and `position: static → relative` on the four nav links. `/styleguide` differs only by §12 |
| Artboard probe (`scripts/parity-probe.js`, `:4000`) | home `h1` 390/1440, active nav link 1440, results card 390/1440: every difference is pre-existing (font fallback stack, nav x offset, card y from D72) — none introduced here |
| Horizontal overflow | **none** on 10 routes × 375 / 768 / 1280 / 1440 (40 checks, pages scrolled through) |
| Lighthouse mobile, production, two runs | `/` perf .90/.92, a11y 100, **CLS 0**; `/results` .94/.93, 100, **CLS 0**; PDP .92/.91, 100, **CLS 0**. LCP 3.1–3.4s — inside the pre-existing, parked band (D54) |
| No JS | no `data-img-fade`, nothing pending, every `method="get"` form and the rail's `<noscript>` submit intact (D44/D83) |
| `"use client"` | **12** files (was 10): `scroll-reveal.tsx` and `nav-progress.tsx` added, both leaves; still exactly one under `src/app/` |

## Limits — recorded, not claimed

1. **Browser Back/Forward animate nothing.** Measured: zero view-transition frames on `history.back()`.
   Next restores a traversal without a React transition, so neither the typed slides nor the untyped
   crossfade nor the reverse morph fire there. The in-page crumbs and logo do animate.
2. **PDP → PDP through `Similar products` does not morph.** The similar row renders its cards with
   `morph={false}`: on a `product-open` navigation from `/results`, a results card and a similar-row card
   with the same slug would otherwise pair and fly. The page still slides.
3. **`Request a quote` on a card does not morph.** Its href ends in `#quote`; typed transitions plus a
   fragment jump, so it stays untyped and crossfades.
4. **The morph and the travelling indicator need a full prefetch.** Card links, the three nav links, the
   tiles and the results crumb are `prefetch={true}`; without it the destination suspends into
   `loading.tsx` first and no pair can form. Cost: every visible card fully prefetches its PDP in
   production (10 payloads measured on `/results` at 1440 before any click).
5. **The nav hover rule was verified by its compiled rule and rest state, not by a live hover** (see "How
   this was measured").
6. **D67's "the sheet's exit snaps" does not reproduce** in Chromium 152, seeked on all four close paths
   and sampled live. It may have been a hidden-tab reading (§8.23) or a Safari behaviour; Safari was not
   measured.
7. Safari and Firefox were not measured. React's integration needs Chromium 125+, Safari 18.2+ or
   Firefox 144+; below that everything navigates exactly as before, with hover fades and CSS transitions
   still working.
