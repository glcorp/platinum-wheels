# Audit report — Product (`/products/[slug]`)

Static audit, 2026-09-21, per `.claude/skills/design-to-code/SKILL.md` §9 (`audit [page]` = §5 + §7 + §8,
output `design/reports/<page>-audit.md`, change nothing). Owner ruling: report first, fixes only after
approval. **No code, `llm.md`, `DEVIATIONS.md` or other report was touched.**

## 1. Scope and method

Read: root `llm.md` §1/§4/§5 (D1–D55, especially D50–D54), `HANDOFF.md` §2/§4/§5/§6/§7/§8/§9,
`.claude/rules/ui.md`, `.claude/skills/design-to-code/SKILL.md` §5/§7/§8/§9, `design/reports/product.md`
(the baseline being audited), `design/DEVIATIONS.md` (all 43 rows, #36–#43 the PDP rows),
`design/inventory/product.md`, `src/features/product/llm.md`.

Read in full: `src/app/(storefront)/products/[slug]/page.tsx`, `src/features/product/types.ts`,
`view.ts`, `actions.ts`, and all 9 components under `src/features/product/components/`. Spot-checked
shared dependencies only to verify a claim in `product.md` or a cross-file contract still holds:
`src/app/globals.css` (`pdp-split`, `quote-grid`, `qty-grid`/`-wide`, `similar-track`/`-grid`,
`photo-vignette-gallery`, breakpoint tokens, `--border`/`--border-strong`/`--border-control`,
`--text-display-*`, `--leading-*`), `src/components/ui/input.tsx` (`fieldBoxClasses`, DEVIATIONS #36),
`src/components/ui/{select,checkbox}.tsx` (`aria-invalid` wiring), `src/lib/routes.ts`, `src/lib/site.ts`,
`src/features/catalog/{types,data}.ts` (`available`, `studdable`). Those files are a different agent's
scope for fixes; they are cited here only to confirm PDP-side claims. `git status` confirms every file in
scope is newly added and untouched since `product.md` was written — no drift from a later edit.

**Not statically checkable — the coordinator verifies these in the browser per the constraints on this
task (no browser/preview tools, no build, no Lighthouse re-run):**
- Actual rendered geometry, colour and computed styles (the §5 numbers themselves — this audit only
  checks that the source backing each row still exists and matches the cited value).
- Real focus order and visible focus rings, the 27-focusable count, `Esc`/tab-trap behaviour.
- Runtime `aria-invalid` / error-announcement behaviour in a screen reader.
- Lighthouse, CLS, LCP — all recorded in `product.md` §Gates and not re-run per task constraints.
- Actual `:has()`/`:focus-visible` support behaviour in the target browser matrix for the segmented
  control (`quote-form.tsx:203-207`) and the chip precedent it follows.

## 2. §5 parity — integrity of the existing report

Every row checked below traces to current source. No selector, class or component has drifted since
`product.md` was written (consistent with `git status`: all PDP files are one uncommitted add, none
edited since).

| `product.md` row | Traces to |
|---|---|
| `pdp-split` 55fr/45fr, gap 64 | `src/app/globals.css:556-561` (`@utility pdp-split`), applied `page.tsx:89` (`md:pdp-split`) |
| `quote-grid` 5fr/7fr, gap 64 | `globals.css:566-571`, applied `quote-band.tsx:43` |
| `qty-grid` / `qty-grid-wide` | `globals.css:578-585`, applied `quantity-control.tsx:94` |
| `similar-track` / `similar-grid` | `globals.css:594-616`, applied `similar-products.tsx:50,70-76` |
| gallery vignette 55% stop | `globals.css:622-631` (`photo-vignette-gallery`), applied `pdp-gallery.tsx:79` |
| breadcrumb tap-extend | `pdp-breadcrumb.tsx:47,57` (`tap-extend` class present on both `Link`s) |
| badge row count 3, `M+S` derived | `view.ts:114-133` (`buildBadges`), matches `types.ts` `PdpBadge` doc |
| spec rows 6, `Winter (studdable)` | `view.ts:71-107` (`seasonLabel`, `buildSpecs`); `catalog/data.ts:45,101` `studdable: true` on the two winter SKUs |
| price context="pdp" | `buy-panel.tsx:138` |
| form field fill `#1F1F24` / `700 17px` | `src/components/ui/input.tsx:52,64` (`bg-surface-2`, `font-bold text-16 … sm:text-17`) — confirms DEVIATIONS #36 is still the live behaviour |
| segmented control double-edge NOT ported | `quote-form.tsx:206` (`index > 0 && "border-l"` — left border on segments 2/3 only) |
| `Send inquiry` rest state `--accent`, no translate | `quote-form.tsx:261-266` (`variant="primary"`, no translate class); button primitive is shared scope |
| quantity cell `aria-current` | `quantity-control.tsx:103,121` |
| breadcrumb back-link strips `qty` | `view.ts:169-183` (`buildBackHref`, explicit `qty` exclusion) |
| no vehicle → chip/paragraph genericise | `view.ts:147-160` (`parseVehicle`, returns `null` on any empty part), `view.ts:216-219` (`inquiryContext`), `quote-band.tsx:28` (`vehicleClause`) |
| similar = same season first, self excluded, cap 4 | `view.ts:190-202` (`buildSimilar`) |
| gallery `sizes="(min-width: 1100px) 704px, 100vw"` | `pdp-gallery.tsx:72` — crosses at `md:` 1100, matching the layout breakpoint per `HANDOFF.md` §8.7, not `sm:` 720 |
| unavailable SKU returns 200 | `page.tsx:67-71` — 404 only on `!product`; `available` is never checked in `page.tsx`, `view.ts`, or any PDP component (grep confirms), so an unavailable product renders the normal panel exactly as `product.md` Open #1 / D54 records |

No row was found pointing at a selector, prop or file that no longer exists. **§5 integrity: clean.**

## 3. §7 QA gates

| Gate | State | Basis |
|---|---|---|
| `npm run check` (tsc + eslint) | clean | Already verified by the coordinator (task brief); not re-run |
| Slop grep | zero | Already verified by the coordinator (task brief); not re-run. Spot check: no `dangerouslySetInnerHTML`, `eval(`, or `innerHTML` anywhere in `src/features/product/` (grep, empty) |
| a11y / forms / focus / touch | pass (by source) | `aria-invalid` wired end to end: `actions.ts` returns `errors`/`values` → `quote-form.tsx:96,113,132,236` pass `invalid={Boolean(errors?.x)}` → `input.tsx:139`/`select.tsx:68` emit `aria-invalid`. Per-field `<FieldError>` linked via `aria-describedby` (`quote-form.tsx:97,114,133,236`). Segmented control uses a real `<fieldset>`/`<legend className="sr-only">` (`quote-form.tsx:182-183`), not a div group. Success panel takes focus via `useRef` + `useEffect` (`quote-form.tsx:52-60`) and carries `role="status"` `tabIndex={-1}` only in the live form (`quote-form.tsx:66`), not on `/styleguide`'s inert render (`quote-success.tsx:26-32`) |
| Touch floor (44px) | pass (by source) | Quantity cells `h-12`/`h-13` = 48/52px (`quantity-control.tsx:104,124-125`); CTA pair uses `size="panel"` (56→60, shared scope); segmented-control labels `h-13`/`h-14` = 52/56px (`quote-form.tsx:195`); breadcrumb links carry `tap-extend` (DEVIATIONS #41) |
| Keyboard order | not statically checkable | Source order is breadcrumb → badges → title → price → quantity → CTAs → specs → quote form → similar track (`page.tsx`, component order); no `tabIndex` other than `0` (`similar-products.tsx:73`) or the success panel's programmatic `-1`. No positive `tabindex` anywhere in scope (grep) |
| `prefers-reduced-motion` | pass (by source) | Global rule at `globals.css:649-654`; no PDP component declares its own animation or transition outside `transition-card`/button hover (shared scope), so nothing bypasses the global rule |
| Server Action validation | pass | `actions.ts` validates `name`, `email` (format), `phone` (10/11-digit NANP), `message` (length ceiling); `quantity`/`contact` fall back silently to defaults rather than failing the submission (documented, `actions.ts:73-75`) — reasonable, since they are optional-group controls with closed value sets sourced from the same contract (`QUANTITY_VALUES`/`CONTACT_VALUES` built from `types.ts`, not user-suppliable open text) |
| User input rendered unescaped | pass | No `dangerouslySetInnerHTML` in scope; every echoed value goes through `defaultValue={values?.x}` (JSX, auto-escaped); the hidden `slug` field is server-known data (`product.slug`), not user input |

## 4. §8 anti-slop checklist

- [x] One accent per frame — not enforced project-wide (D5); PDP's accent uses (Winter badge, quote eyebrow, `Send inquiry`, selected badge) are all sourced/measured, not invented (`view.ts`, `quote-band.tsx:53`).
- [x] Asymmetric layouts kept — 55/45 split (`pdp-split`) and the *reversed* 5fr/7fr quote-grid both ship as measured, not "fixed" to symmetric (`globals.css:556-571`).
- [x] No gradients/glass/shadows/pills outside DESIGN.md's allowance — only gradient in scope is `photo-vignette-gallery`, the sanctioned hero/gallery vignette (`globals.css:622-631`); no `shadow-*`, `rounded-full`, `backdrop-blur` anywhere in `src/features/product/` (grep, empty).
- [x] One icon set/stroke — `ThreePeakIcon`, `PhoneIcon`, `ChevronIcon` (`buy-panel.tsx`, `quantity-control.tsx`) all use `stroke="currentColor"`/`var(--text-muted)`, no fill icons, no emoji.
- [x] Real photography — gallery reuses the catalog cut-out pipeline (D19); no stock people, no AI renders.
- [x] No invented social proof — no reviews, ratings or count claims anywhere in scope (grep for "customers", "rating", "★" — none).
- [x] **Sample personal data does not ship.** Grepped `src/features/product/` and the route file for `Priya`, `priya.s@`, and a literal `(905) 000-0000` as a *value*: zero matches. The phone string exists only as a `placeholder` attribute (`quote-form.tsx:130`) and in comments/`llm.md` documentation. The drawn vehicle `2021 Honda Civic` never ships as a default — `parseVehicle` returns `null` unless the URL supplies all three parts (`view.ts:147-160`).
- [x] Brand logos — n/a to this page (no brand-logo row on the PDP).
- [x] Empty/loading/error states as finished as the happy path — the form's invalid state and the success state are both fully styled from existing tokens (`quote-form.tsx`, `quote-success.tsx`); **loading state is a text swap only** ("Sending…", `quote-form.tsx:268`), no spinner or skeleton — reasonable for a single-submit form with no artboard for it, not a slop violation.
- [x] Type hierarchy matches artboard at both breakpoints — `text-display-56 sm:text-display-88` (h1), `text-display-32 sm:text-display-40` (Specifications h2), `text-display-48 sm:text-display-88` (quote h2), `text-display-40 sm:text-display-56` (Similar products h2) — all traced to `product.md` §5.2 sizes, no desktop size leaking to mobile.
- [x] No AI tells — no centred hero/3-icon grid pattern on this page; copy is short and specific ("Enter a 10-digit Canadian phone number.", not "Oops! Something went wrong").
- [x] Placeholder data named/config, not hardcoded — the one literal placeholder (`(905) 000-0000`) is an HTML `placeholder` attribute, not a stored constant, and is artboard-verbatim copy (acceptable — it is not a *value* that ships in a payload).

**All twelve boxes pass.**

## 5. Fix list ordered by visual impact

**No genuine defects found in `src/features/product/*` or the PDP route.** Every apparent oddity checked
against root `llm.md` §5, `DEVIATIONS.md`, or D54 resolved to a sourced, deliberate decision (see §2/§3/§4
above for citations). One structural nit is recorded below; it is not a visual or functional defect.

| # | Finding | file:line | Impact | Proposed fix | Risk | Label |
|---|---|---|---|---|---|---|
| 1 | The breadcrumb is instantiated once in `page.tsx:78` but placed at **two** JSX positions (`page.tsx:86` and inside the `breadcrumb` prop passed to `BuyPanel` at `page.tsx:107`), so React mounts two `<nav aria-label="Breadcrumb">` subtrees — one hidden by `md:hidden`, one by `hidden md:block`. The header comment at `page.tsx:38-41` says "The breadcrumb renders ONCE," which is true of the source line count but not of the resulting DOM. Functionally harmless: `display:none` removes the hidden copy from the accessibility tree and the tab order, so there is no double announcement, no duplicate tab stop, and no visible difference — `product.md`'s "27 focusables" count is consistent with only one copy ever being reachable. | `src/app/(storefront)/products/[slug]/page.tsx:38-41,86,107` | None visible or functional; doubles two anchor tags' worth of inert markup per page load | Correct the comment to describe what the code does (two mounts, CSS-toggled), or restructure so `PdpBreadcrumb` itself takes a `variant` and only one instance mounts — matches the `/results` toolbar pattern more literally. Either is a same-file, no-risk edit. | None | Taste / documentation accuracy, not a defect |

**Genuine defects: 0. Taste findings: 1** (comment-accuracy only, zero visible/functional impact).

## 6. Open questions for the owner

None raised by this audit. The three parked D54 items (quote-form delivery destination, PDP unavailable
state, LCP gate) are recorded below per the task brief and are not reopened as blockers.

**Parked (D54) — not findings:** the quote form's Server Action discards every valid submission
(`actions.ts:126-132`, TODO marked, no destination supplied yet); no PDP unavailable-state UI exists
(no artboard draws one); the 2.5s mobile LCP gate reads 3.0–3.2s (one build-wide cause, not a PDP defect).
