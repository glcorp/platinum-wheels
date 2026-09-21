# Audit — `/results`

Static, report-only audit (`.claude/skills/design-to-code/SKILL.md` §9). No code changed. Scope: the
`/results` route only — `src/app/(storefront)/results/page.tsx`, `src/features/results/*`, and
`src/features/finder/*` in its `variant="inline"` role (D45). Shared chrome, the ten UI primitives and
`src/features/catalog/*` are a different agent's scope; findings that land there are referred, not fixed
here.

## 1. Scope and method

Read: root `llm.md` §1/§4/§5 (D1–D55, D42–D49 in full), `HANDOFF.md` §1–§9, `.claude/rules/ui.md`,
`.claude/skills/design-to-code/SKILL.md` §5/§7/§8/§9, `design/reports/results.md`, `design/reports/product.md`
(house style), `design/DEVIATIONS.md` (all 43 rows, #25–#35 read closely), `design/inventory/results.md`
(headers/structure), `src/features/results/llm.md`, `src/features/finder/llm.md`.

Source read in full: `src/features/results/{types,query,search}.ts`, all 8 components in
`src/features/results/components/`, `src/features/finder/components/vehicle-finder.tsx`,
`src/features/finder/data.ts` (FITMENT/seed headers), `src/app/(storefront)/results/page.tsx`, the
`globals.css` utilities this page uses (`results-grid`, `range-input`, `sheet-panel`, `size-grid-sheet`,
`pb-safe`, the global `prefers-reduced-motion` and `:focus-visible` blocks).

Commands run (read-only): `rg`/`grep` for the SKILL.md §7 slop grep patterns scoped to
`src/features/results` and `src/features/finder`, and for `order-`/reordering utilities, ARIA attributes,
and `'use client'` placement. All returned zero hits except where cited below.

**Not statically checkable — left to the coordinator's browser pass:**
- Actual focus-trap and focus-return behaviour of `<dialog>` in a real browser (source supports the claim; see §3).
- Whether `router.replace` announces the count/grid change to a screen reader in practice (no live region exists — see §4 finding F1 — but real AT behaviour needs a browser + AT).
- Lighthouse numbers, `npm run check`, and the slop grep across the *whole* `src/` tree — these are already recorded in `HANDOFF.md` §5 and `design/reports/results.md` and are cited, not re-run (task instruction #5).
- Real keyboard walk-through timing/order beyond static DOM-order inspection (`design/reports/results.md` "Not run" already says this wasn't stepped control-by-control).
- Cross-browser `<dialog>`/`showModal()` quirks (Safari native Esc/backdrop nuances).

## 2. §5 parity — integrity of the existing report

Not re-measuring. Spot-traced every selector family in `design/reports/results.md` against current
source; no drift found. Representative citations:

| report row | claimed selector/class | traced to |
|---|---|---|
| `toolbar` pad/y,h (1440 row 1) | `data-probe="toolbar"` | `src/features/results/components/results-toolbar.tsx:110` |
| `breadcrumb` font/ls/color | `data-probe="breadcrumb"`, `text-11 tracking-10 md:text-12` | `results-toolbar.tsx:130-133` |
| `vehicle chip` | `data-probe="vehicle-chip"` | `results-toolbar.tsx:166-168` |
| `Change vehicle` (`<summary>` text, D45) | `data-probe="change-vehicle"` | `results-toolbar.tsx:148-149` |
| `count` (D42 computed copy) | `data-probe="count"`, `tabular-nums` | `results-toolbar.tsx:189-192` |
| `sort box` pad-r 46 | `min-w-50 … pl-3.5 pr-11.5` (14px + 46px) | `sort-select.tsx:105-107` |
| `rail` | `data-probe="rail"` | `filter-rail.tsx:33` |
| `Filters` title / `Clear all` | `data-probe="filters-title"` / `data-probe="clear-all"` | `filter-panel.tsx:510-521` |
| `Tires` row (selected) h/bg/color | `h-10 … bg-ink text-on-accent`, `px-3` | `filter-panel.tsx:539-546` |
| size field h/bg/pad-l | `h-11 … bg-surface-2 … pl-2.5`, `border-border-control` (#14/#28) | `filter-panel.tsx:188-196` |
| price track/rail/fill | `mx-2 h-5`, `bg-border-strong`, `bg-ink` | `filter-panel.tsx:262-271` |
| scrim / `<dialog>` (D47(3), DEVIATIONS #32) | `backdrop:bg-scrim-mid`, no extra page-opacity | `filter-sheet.tsx:142` |
| `Show N matches` (D42 computed) | `view.total === 1 ? … : \`Show ${view.total} matches\`` | `filter-sheet.tsx:230` |
| `Best matches` = page `<h1>` (D47(6)) | `<h1 data-probe="best-heading">` | `results-grid.tsx:140-142` |
| `Similar matches` = `<h2>` | `<h2 data-probe="similar-heading">` | `results-grid.tsx:184` |
| `Load more` accent Button, `?show=all` href | `resultsHref(withShowAll(view.query))` | `results-grid.tsx:211` |
| call panel copy/CTA | `data-probe="call-panel"`, `tel:${PRIMARY_CONTACT.tel}` | `call-cta-panel.tsx:19-51` |

No row in `results.md` (1440, 390, or the sheet table) points at a selector, class, or component that has
moved or been renamed. **No parity-integrity defects found.**

## 3. §7 QA gates

| Gate | Result | Evidence |
|---|---|---|
| `tsc` + eslint (`npm run check`) | Cited clean, not re-run | `HANDOFF.md` §5: "`npm run check` clean; `npx next build` clean" |
| Slop grep, zero hits | **Pass (re-verified, scoped)** | `rg` for arbitrary values, default palette, `rounded-full`/`backdrop-blur`/gradients, `lorem`/placeholder copy, `Add to cart`/`Buy now`, and page-level `'use client'` — zero hits in `src/features/results/`, `src/features/finder/`, `src/app/(storefront)/results/` |
| Lighthouse mobile (Perf ≥90, a11y ≥95, CLS ≤0.05, LCP ≤2500ms) | Cited, not re-run; LCP is a **parked** miss (D54) | `design/reports/results.md` "Lighthouse" table: Perf 93–97, a11y 100, CLS 0, LCP 2.6–3.2s |
| Keyboard order | **Pass by source inspection** | DOM order in `page.tsx:44-62` matches visual order at every breakpoint (header → toolbar → sticky bar → rail/grid → call panel → footer); no `order-*` or `flex-row-reverse` utility anywhere in scope (grep, zero hits) |
| Focus trap / Esc / backdrop / scroll lock (`<dialog>`) | **Source supports the claim, one redundancy noted** | `filter-sheet.tsx:59-83` calls native `showModal()` (browser-native trap + focus return on `close()`); `onCancel` (`:127-130`) *and* `onKeyDown` Escape (`:131-136`) both call `close()` — the `keydown` handler's `preventDefault()` should suppress the native `cancel` event before it fires, so `onCancel` is very likely dead code, not a double-close bug. Not verified in a live browser. |
| `prefers-reduced-motion` | **Pass** | Global override, `src/app/globals.css:649-658`, `*, *::before, *::after` — covers every transition/animation in this feature, nothing in `src/features/results/` opts out |
| 44px touch floor | **Pass** | Sheet trigger `h-11` (`filter-sheet.tsx:101`), close button `size-11` (`:180`), season chips `size="touch"` in the sheet (`filter-panel.tsx:665`); rail's 40px category/chip rows are pointer-only from `md:` 1100 (D46) and are exempted by the same reasoning as `results.md` |
| No-JS path — filters | **Pass** | One real `<form method="get" action="/results">` (`filter-panel.tsx:459-465`); `Apply` (rail, `:634`) and the sheet's `Show N matches` (`filter-sheet.tsx:223-231`, `form={SHEET_FORM_ID}`) are `type="submit"`, so a plain GET works with JS off, per D44's own wording |
| No-JS path — sort | **Fail — see F2 below** | `SortSelect` (`sort-select.tsx`) is a bare `<select>` with no enclosing `<form>` and no submit control; changing it does nothing without JS |
| Duplicate `id` across rail/sheet (flagged in the brief as easy to miss) | **Pass — verified, not a defect** | Every id in `filter-panel.tsx` is built from the caller's `idPrefix` (`"rail"` from `filter-rail.tsx:36`, `"sheet"` from `filter-sheet.tsx:204`): group labels (`${idPrefix}-category-label` etc.), size selects (`${idPrefix}-width/-profile/-rim`), season chips (`${idPrefix}-season-${value}`), brand checkboxes (`${idPrefix}-brand-${slug}`), price thumbs (`${idPrefix}-price-min/-max`). The sheet's `<form>` alone carries an `id` (`SHEET_FORM_ID`, `filter-sheet.tsx:34,204`); the rail's `formId` prop is left `undefined` so its `<form>` renders no `id`. No collision. |

## 4. §8 anti-slop checklist

- [x] One accent per visual frame — `variant="accent"` appears once per screen region (`Load more`, `ResultsEmpty`'s call button); never two touching. `.claude/rules/ui.md:33-35`.
- [x] Asymmetric layouts preserved — 280/1fr rail split (`globals.css:461-466`), not centred; `results-grid.tsx` flush-left sections throughout.
- [x] No gradients/glass/shadows/pills outside what's allowed — grep for `rounded-full|backdrop-blur|shadow-(lg|xl|2xl)|bg-gradient-to` in scope: zero hits.
- [x] One icon set, consistent stroke/size — **one measured exception**: `CarIcon` uses `stroke-width="1.5"` (`results-toolbar.tsx:71`) against `1.6` everywhere else in this feature (`CollapseMark`, both chevrons, the sheet trigger/close icons). The comment at `results-toolbar.tsx:61-62` says this is copied verbatim from the artboard's own SVG attribute, not an authored choice — design wins over icon-set consistency per the authority chain (`.claude/rules/ui.md:15-17`). Not a fix candidate.
- [ ] N/A — real photography (catalog feature, out of scope).
- [x] No invented social proof — none present in this feature.
- [x] Placeholder data named/flagged — `FITMENT` and `FINDER_MAKES`/`FINDER_YEARS` carry an explicit "SAMPLE DATA (D27)" / "Sample data" header comment (`src/features/finder/data.ts:1-19,70-79`); no literal sample values (`555…`, `Priya Sandhu`, pre-filled vehicle) appear anywhere in `src/features/results/` or the finder's inline variant.
- [ ] N/A — brand logos (catalog feature, out of scope; results only renders brand *names* as facet text).
- [~] Empty/loading/error states as-designed — `ResultsEmpty` (`results-grid.tsx:88-113`) is fully built and on `/styleguide`. **Loading and error states for `/results` are not built.** This is not a new finding — it is the project's own open item (`llm.md` §3 "Remaining: … the last undrawn states (loading, error)"; `HANDOFF.md` §6 item 2) and is not `/results`-specific. Not counted as a defect below.
- [x] Type hierarchy matches artboard at both breakpoints — `text-display-32 md:text-display-40` etc. throughout, confirmed against `results.md`'s measured rows in §2.
- [x] No AI tells — no centred-hero/3-icon-grid/gradient-CTA pattern; flush-left composition throughout, confirmed by classNames (no unexplained `items-center justify-center text-center` on content blocks).
- [x] Facet counts computed, never typed (D42) — verified directly in `src/features/results/search.ts:206-224` (`buildFacets`) and `:241-279` (`searchResults`): `tireCount`, `sizes`, `seasons[].count`, `brands[].count`, `price.min/max`, and `activeGroups` are all derived from `PRODUCTS` and the current `query`; no artboard number (`18`, `42`, `9`, `12 matches · 6 similar`, `$140–$275`) appears as a literal anywhere in the file.

## 5. Fix list, ordered by visual/functional impact

Genuine defects first, then taste-only items (labelled). Nothing below duplicates a `DEVIATIONS.md` row or
a settled `D<n>` — each was checked against §5b and the 43 active rows before being listed.

| # | Finding | file:line | Impact | Proposed fix | Risk | Type |
|---|---|---|---|---|---|---|
| F1 | No `aria-live` region on the result count or the grid. Every filter/sort change is a client-side `router.replace` to the same route (same document title), so the built-in Next.js route announcer has nothing new to announce — a screen-reader user gets no confirmation that "9 matches" became "4 matches · 5 similar" after they check a box. | `src/features/results/components/results-toolbar.tsx:188-193` (count span); `results-grid.tsx:115-219` (grid) | Moderate — screen-reader users lose feedback on every filter interaction; sighted users get the visual update and kept focus (`filter-panel.tsx:409-419`) so this is AT-only | Add `aria-live="polite"` (and probably `aria-atomic="true"`) to the count span, or wrap the grid section in one | Low — no visual/layout change, pure ARIA attribute | Genuine defect (a11y) |
| F2 | The `SortSelect` control (`sort-select.tsx`) has no `<form>` ancestor and no submit control. With JavaScript disabled, changing "Sort" does nothing — there is no way to re-sort `/results` at all without JS. D44's own text scopes the plain-GET guarantee to "the same form" (rail/sheet) and separately calls sort "a client island," so this may be intentional, but the audit brief's framing ("every filter/sort/show must work as a plain GET with JS off") is not met for sort specifically. | `src/features/results/components/sort-select.tsx:69-130`; called from `results-toolbar.tsx:206` and `filter-sort-bar.tsx:38` | Low-moderate — progressive enhancement gap on one control; every other stateful control (filters, size, `Load more`, `Change vehicle`) degrades correctly | Wrap the sort `<select>` in a tiny `<form method="get" action="/results">` that also carries the current query as hidden fields, or accept the JS-only status explicitly as a ruling | Low if fixed; zero if left as a documented ruling | Ambiguous — reads as a defect against the stated no-JS goal, but arguably inside D44's actual (narrower) wording. Flagging for an owner call, not prescribing a fix. |
| F3 | `FilterSheet`'s `onCancel` handler (`filter-sheet.tsx:127-130`) is very likely unreachable: the `onKeyDown` Escape handler (`:131-136`) calls `preventDefault()`, which should suppress the native `cancel` event before the browser fires it. Harmless today, but it is dead code that could silently diverge from the keydown handler in a future edit. | `src/features/results/components/filter-sheet.tsx:127-136` | Cosmetic / maintainability only — no observed or provable behavioural bug | Either remove the `onKeyDown` handler and rely on the native `cancel` event (simpler, one code path), or remove `onCancel` and comment that keydown owns Escape | None | Taste / code-hygiene, not a rendering or a11y defect |

**Total: 2 genuine defects (F1, F2) + 1 taste/hygiene note (F3).** F2 is flagged as ambiguous against D44's
literal wording rather than asserted as a clear violation — see §6.

## 6. Open questions for the owner

1. **F2 — is the Sort control meant to require JavaScript?** D44 says the rail/sheet form's `Apply` /
   `Show N matches` submit as a plain GET "without JS," and separately calls the sort select "a client
   island" — it never explicitly promises a no-JS path for sort the way it does for the filter groups. If
   that omission was deliberate, this is not a bug and should be recorded as a ruling (e.g. an addendum to
   D44) rather than fixed. If it was an oversight, F2's proposed fix is small (a second, hidden-field form).
2. **F1 — is a live region wanted for the filtered result count?** No `D<n>` or `DEVIATIONS.md` row
   addresses screen-reader feedback on client-side result updates. Low cost either way; flagging so the
   decision is recorded rather than assumed.

No other findings. This page's forms, URL-state machine, id-namespacing, count semantics (D49), and
best/similar split (D47(8)/D48) all check out against source exactly as documented.
