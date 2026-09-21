# `/design-to-code audit` — consolidated, 2026-09-21 (session 5)

The `audit` pass of `.claude/skills/design-to-code/SKILL.md` §9 across the three built routes. Per §9 the
mode "change[s] nothing unless the user says to": **no file under `src/` was modified by this pass.**
Owner ruling, 2026-09-21: report first, fixes individually approved afterwards.

Four page reports carry the detail; this file is the index, the coordinator's browser-measured half, and
the merged fix list.

> **Status, 2026-09-21 (D57).** The owner then approved six items individually and they are **applied and
> verified in the browser**: **C1, C2, C3, C4, C5, S1**. `DEVIATIONS.md` #41 was corrected in place and
> #44–#48 added. Re-measured after the change: no parity drift, no overflow at any width, `npm run check`
> and `npx next build` clean, slop grep zero, still six `"use client"` files and one `"use server"`.
> **Still open and unauthorised: S2** (reserved to the owner, root `llm.md` §7.10), **S3, S4, S5** and the
> four taste items **T1–T4**. **R-F2 was ruled, not fixed:** sort stays JavaScript-only, as a D44
> addendum. The fix-list tables below are left as written so the original measurements stay legible.

| Report | Scope | Genuine | Taste |
|---|---|---|---|
| [`home-audit.md`](home-audit.md) | `/`, `src/features/{home,finder}/` | 0 | 0 |
| [`results-audit.md`](results-audit.md) | `/results`, `src/features/results/` | 2 | 1 |
| [`product-audit.md`](product-audit.md) | `/products/[slug]`, `src/features/product/` | 0 | 1 |
| [`shared-audit.md`](shared-audit.md) | chrome, primitives, catalog, `globals.css`, cross-page | 5 | 2 |
| this file | browser-measured gates, site-wide a11y | 5 | — |

---

## 1. Method

Static analysis was delegated to four Sonnet sub-agents on strictly disjoint output files (D25); each was
forbidden the browser, so the one shared pane stayed with the coordinator. Everything measured below was
measured by the coordinator against `next dev` on `:3000` and the artboard baseline on `:4000`
(`npm run design`, D36). **Agent output is a claim, not a fact** (`HANDOFF.md` §3): every agent finding
carried into §4 was independently re-verified, and the ones that did not survive are recorded in §3.

---

## 2. §7 QA gates — measured

| Gate | Result | Evidence |
|---|---|---|
| `npm run check` (tsc + eslint) | **pass** | exit 0, no output |
| Slop grep, all six patterns | **pass** | zero hits in shipping code; the only matches are prose in `llm.md`/`globals.css` comments and the two whitelisted `rounded-full` files (`site-header.tsx:144`, `featured-carousel.tsx:111`), both carrying their justification in place |
| Horizontal scroll 375 / 768 / 1280 / 1440 | **pass** | 13 measurements across `/`, `/results`, `/products/[slug]`, `/styleguide`: `scrollWidth === clientWidth` at every width |
| Fonts resolve | **pass** | `document.fonts.status === "loaded"` on app and baseline |
| Reduced motion | **pass** | one compiled `@media (prefers-reduced-motion: reduce)` rule found live in the CSSOM, zeroing `animation-duration`, `transition-duration`, `scroll-behavior` globally (`globals.css:649-658`); the carousel additionally gates its programmatic scroll on `matchMedia` (`featured-carousel.tsx:49`) |
| Focus ring visible, per DESIGN.md §4 | **pass** | measured `2px solid rgb(201, 242, 58)` at `outline-offset: 0px` — `--accent` `#C9F23A`, offset 0 per D16 |
| Dialog: trap, Esc, focus return, scroll lock | **pass** | both dialogs, measured — see §2.1 |
| Duplicate `id` / orphan `for` / orphan `aria-describedby` | **pass** | `/results` renders the filter form twice (rail + sheet); across 41 ids, **zero** duplicates, zero orphan `label[for]`, zero orphan `aria-describedby`. The `idPrefix` namespacing works. |
| D44 no-JS path | **pass** | three real `<form method="get" action="/results">` with named inputs, `Apply` submits, and `year`/`make`/`model` preserved as hidden inputs. One exception: `sort` — see F2 in `results-audit.md` |
| Parity, spot re-measure vs `:4000` | **pass, no drift** | home `h1` at 1440 identical on all seven properties: `120px` / `110.4px` / `-1.8px` / `700` / `Barlow Condensed` / `rgb(244,244,245)` / `x=48` / `w=1100` |
| Lighthouse | **not re-run** | recorded in the per-page reports; perf 91–95, a11y 100, CLS 0, LCP 3.0–3.5 s **parked (D54)** |
| Empty / loading / error states | **fail — already tracked** | no `loading.tsx` or `error.tsx` exists anywhere in `src/app/`. This is `HANDOFF.md` §6 item 2, the next scheduled work, not a new finding. `/styleguide` §11 does carry 404, empty results, the open `Change vehicle` disclosure and the quote-form success panel. |

### 2.1 Dialog behaviour, measured

Both `<dialog>`s were opened, exercised and closed with the keyboard.

| | filter sheet (`/results`) | nav drawer (site-wide) |
|---|---|---|
| `:modal` (native trap) | true | true |
| focus on open | `Clear all`, inside the dialog | `Close menu`, inside the dialog |
| `body` scroll lock | `overflow: hidden` | `overflow: hidden` |
| Esc closes | yes | yes |
| lock released | `overflow: visible` | `overflow: visible` |
| focus returned | `button Filters` (the trigger) | `button Menu` (the trigger) |
| `aria-expanded` on trigger | — | `false → true → false` |
| height | `812px` (`dvh`, D31) | `812px` |
| accessible name | `aria-label="Filters"` | **none — see C5** |

`HANDOFF.md` §5's claim that these were verified is confirmed independently.

---

## 3. Checked and cleared — things that look like defects and are not

Recorded so a later session does not re-raise them.

| Apparent issue | Why it is not a defect |
|---|---|
| Two `<nav aria-label="Breadcrumb">` in the PDP DOM | The second sits inside `div.hidden md:block` → `display: none`. Hit-tested: not focusable, not in the a11y tree, `tabindex` unreachable. A responsive pair, correctly hidden. (The PDP agent raised it only as comment-accuracy; agreed — see T1.) |
| Two `<nav aria-label="Primary">` landmarks | The second is inside the closed nav-drawer `<dialog>` (`display: none`). The drawer only opens below `md:`, where the header nav is hidden, so the two are never exposed at once. |
| Quote-form radios reported as having no label | False alarm from testing only `label[for=]`. Measured: `<fieldset>` + `<legend>Preferred contact</legend>`, each radio wrapped in its own `<label>` (`Phone` / `Email` / `WhatsApp`), 162×54 targets, one pre-checked. D53(7) satisfied exactly. |
| Card product-name link under 44px | Measured 22px box → **47px** hit area via `tap-extend`. Clears the floor; `DEVIATIONS.md` #16 documents it at 46.1px. |
| Footer links under 44px | 28px box + `tap-extend` ±12px = 52px. Clears the floor. |
| `Filters` button showing no `(n)` | No filters applied in the probed URL; D42's count is computed and correctly omitted at zero. |

---

## 4. Merged fix list

Ordered by impact. `C` = coordinator, measured in the browser. `S` = shared-audit. `R` = results-audit.
Nothing here duplicates a `DEVIATIONS.md` row, a `D<n>`, or a D54-parked item.

### Genuine defects

| # | Finding | Where | Impact | Fix | Risk |
|---|---|---|---|---|---|
| **C1** | **No skip-to-content link anywhere on the site.** Measured: `skipLinkCount: 0`; `<main>` carries no `id` and no `tabindex`; **6 tab stops** sit between the document start and `<main>` on every route. WCAG 2.4.1 Bypass Blocks is Level A. | `src/app/layout.tsx` | Every keyboard and switch user re-traverses the full header nav on every page. Note Lighthouse a11y still scores 100 — its `bypass` audit is satisfied by the presence of a `<main>` landmark alone, so this gap is invisible to that gate. | Add a visually-hidden-until-focused `<a href="#main">` as the first focusable element; give `<main>` `id="main"` and `tabindex="-1"`. | Low — new element, no measured property changes. Touches `globals.css` for the focus-reveal utility, so coordinator-only (D25). |
| **C2** | **No live region exists anywhere in the build.** Measured `[aria-live], [role=alert], [role=status], output` → **0 matches** on both `/results` and the PDP. Two consequences: filter/sort changes re-render the grid via `router.replace` on the same route with the same title, so Next's route announcer says nothing and `4 matches · 5 similar` changing is silent; and a rejected quote-form submit is equally silent. | `results-toolbar.tsx:188-193`, `results-grid.tsx`; `quote-form.tsx` | AT users get no confirmation that their filter, sort or submit did anything. Sighted users are unaffected — the visual update and focus retention both work. | `aria-live="polite" aria-atomic="true"` on the result-count element; a `role="alert"` summary for the form's error state. | Low — ARIA attributes only, no visual change. |
| **C3** | **A rejected quote submit moves focus nowhere.** Measured: after an invalid submit, `document.activeElement` is `BODY`. The field-level semantics are otherwise correct — `aria-invalid="true"` and `aria-describedby="quote-email-error"` / `quote-phone-error` are set, the error text renders, and all four typed values are retained. | `src/features/product/components/quote-form.tsx` | A keyboard user is dropped to the top of the document with no indication the submit failed. Compounds C2. | Focus the first invalid field (or an error summary) when the returned `QuoteFormState` carries errors. | Low — the success panel already takes focus (D51), so the pattern exists in the file. |
| **C4** | **Breadcrumb links are a 37px touch target against the project's 44px floor.** Measured by hit-testing on both `/results` and the PDP: 13px box + `tap-extend`'s ±12px band = **37px**. The comment at `pdp-breadcrumb.tsx:40-45` states the utility fixes the 44px floor and cites `DEVIATIONS.md` #16 — but #16 covers the *card* link, whose 22px box reaches 46.1px. The arithmetic does not carry over to an 11/12px line, and no `DEVIATIONS.md` row covers the breadcrumb. | `src/features/product/components/pdp-breadcrumb.tsx:47,57`; `src/features/results/components/results-toolbar.tsx:136` | Below `docs/decisions.md` §5's floor. It does clear WCAG 2.5.8's 24px AA minimum, so this is a house-standard miss, not a WCAG failure. | Widen the band for these links (a `tap-extend-lg` at ±16px reaches 45px), or record the 37px as a deliberate exception with a new `DEVIATIONS.md` row. Either way the comment must stop claiming 44px is met. | Low — `tap-extend` changes no measured property, so parity rows are unaffected. New utility = `globals.css` = coordinator-only (D25). |
| **C5** | **The nav-drawer `<dialog>` has no accessible name** — no `aria-label`, no `aria-labelledby`, no `role`. The filter sheet on the same site does carry `aria-label="Filters"`, so this is also a cross-page inconsistency in the same pattern. | `src/components/site/site-nav-drawer.tsx` (`#site-nav-drawer`) | A screen reader announces the opened drawer as an unnamed dialog. Everything else about it is correct (see §2.1). | `aria-label="Menu"`, matching the trigger's own label. | None — one attribute. |
| **S1** | Home's mobile carousel shows its scrollbar; the PDP's near-identical similar-products track hides its own via `scrollbar-width: none` (`globals.css:599,605`). The comment at `featured-carousel.tsx:191` asserts no scrollbar-hiding utility exists — **verified false**; `similar-track` added one the following day. | `featured-carousel.tsx:181-197` vs `globals.css:594-608` | Two instances of one pattern (D30, D53(5)) treated differently, plus a comment that would misdirect a future session. | Either extract a shared `hide-scrollbar` utility and use it in both, or correct the comment if the visible scrollbar is intended. **Owner's call** — see Q1. | Low — scrollbar visibility appears in no parity table. |
| **S2** | **13 hand-rolled class-merge helpers**, none shared: 10 × `cx()` in two signatures + 3 × `join()`. Independently verified. Root `llm.md` §7.10 records "six copies of `cx()` across `src/components/ui/`" — correct as far as it goes, but it misses 4 more `cx()` copies outside `ui/` (`product-card`, `featured-carousel`, `quote-form`, `filter-panel`) and the 3 `join()`s. | `src/components/ui/{badge,chip,button,price,section-heading,stripe-divider}.tsx` (`cx`), `{select,checkbox,field-label}.tsx` (`join`), + the four feature files above | Maintenance only — all 13 are behaviourally equivalent. | Consolidate to one `src/lib/cx.ts`. **Owner's call, explicitly reserved by root `llm.md` §7.10** — no session may do it in passing. | Medium — 10 files, several carrying parity-measured class output. Must not change any emitted class string. |
| **S3** | The solid-header background ships `--scrim-strong`, which all three desktop artboards confirm, but `DESIGN.md` §4 states `--bg` and **no `DEVIATIONS.md` row records the divergence.** The code is right per the authority chain; the audit trail has a hole. | `site-header.tsx:7-14,52-59` | Documentation only. Closes `src/components/site/llm.md` Open #2. | Add `DEVIATIONS.md` #44 citing the three artboards. | None. |
| **S4** | Three stale in-repo comments / Open items describing code that no longer exists: `site-header.tsx:115-118` (a `button.tsx` gap override and a `sm:gap-2.5` class, both gone); `src/components/site/llm.md` Open #3; `src/components/ui/llm.md` Open #2. | see `shared-audit.md` §2.1 | No runtime effect; each would cost a future session an investigation. | Correct or delete, marking the two Open items resolved. | None. |
| **S5** | **Dead token.** `--container-rail: 280px` (`max-w-rail`) is defined and referenced **zero** times in `src/` — verified. The 280px rail is hardcoded in the `results-grid` utility instead. | `globals.css:233` | Dead weight. | Delete the token, or wire `filter-rail.tsx` to it. `globals.css` = coordinator-only (D25). | None — zero references confirmed. |

### Ambiguous — needs a ruling, not a fix

| # | Finding | Where |
|---|---|---|
| **R-F2** | **Sort requires JavaScript.** Verified: `SortSelect` renders a bare `<select>` inside a `<span>` with no `<form>` ancestor and no submit control; its only path is `onChange → router.replace`. Every other stateful control on `/results` degrades to a plain GET (see §2). D44 promises the no-JS path for "the same form" (rail/sheet) and separately calls sort "a client island" — it never promises one for sort. So this is either a deliberate, unrecorded scope limit or an oversight. | `sort-select.tsx:69-130` |

### Taste / hygiene — not defects

| # | Finding | Where |
|---|---|---|
| **T1** | The PDP breadcrumb is instantiated once but placed at two JSX positions, so two subtrees mount (one `md:hidden`, one `hidden md:block`). Harmless — verified not focusable, not in the a11y tree — but the comment at `page.tsx:38-41` says it "renders ONCE", which is true of the source and false of the DOM. | `products/[slug]/page.tsx:38-41,86,107` |
| **T2** | `FilterSheet`'s `onCancel` handler is likely unreachable: the `onKeyDown` Escape handler calls `preventDefault()`, suppressing the native `cancel` event. No observed bug; two code paths for one behaviour. | `filter-sheet.tsx:127-136` |
| **T3** | Icon stroke-width varies 1.5 / 1.6 / 1.8 across three controls. Each is a distinct artboard-measured element, not one idea drawn three ways. No action. | `featured-carousel.tsx:146,164`, `select.tsx:90`, `site-header.tsx:152` |
| **T4** | `Textarea` re-declares its class array rather than calling the shared `fieldBoxClasses()`. Deliberate: it differs on height, padding and weight, and `HANDOFF.md` §8.3 makes call-site overrides unreliable. No action recommended. | `input.tsx:162-193` |

---

## 5. Open questions for the owner

1. **S1 — the home carousel's scrollbar:** hide it to match the PDP track, or keep it visible and fix the
   comment? One line either way; only the owner can say which is intended.
2. **R-F2 — is sort meant to require JavaScript?** If deliberate, it should be recorded as an addendum to
   D44 rather than fixed. If an oversight, the fix is a small second form carrying hidden fields.
3. **C2 — is a live region wanted?** No `D<n>` or `DEVIATIONS.md` row addresses screen-reader feedback on
   client-side result updates. Low cost either way; worth recording the decision rather than assuming it.
4. **Category tile imagery.** Both home artboards render the `Tires` and `Wheels` category tiles using
   *product cut-outs* (`zeta-antarctica-sport.png`, `spec1-sp51.png`) rather than the dedicated
   `tires-tile.png` / `wheels-tile.png` that exist on disk and are referenced by neither artboard. The
   shipped code correctly reproduces the artboard, so this is **not** a code fix — but the `Tires` tile
   therefore shows the same specific tire that appears as its own card three sections later. Already
   flagged unresolved at `design/inventory/home.md:698-700` and never escalated. Owner to confirm which
   is intended; the two unused files are otherwise dead assets.
5. **S2 — the `cx()` consolidation** remains reserved to the owner by root `llm.md` §7.10. This audit
   supplies the accurate scope (13 helpers, 10 files) so a future session knows what it would touch.

## 6. Coverage limits

- The 43 `DEVIATIONS.md` rows were **sampled, not exhaustively re-verified**: 18 rows (one per category)
  were traced to current source and all held. The remaining ~25 are untested, not certified clean.
- §5 parity was **audited for integrity, not re-measured in full** — every row in the three page reports
  was traced to current source, and one row (home `h1` at 1440) was re-measured against the live baseline
  as a drift check. A full re-measure was out of scope for a pass that changes nothing.
- Lighthouse was not re-run; the recorded per-page numbers stand.
