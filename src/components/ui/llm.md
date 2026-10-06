# src/components/ui

## Purpose
The ten token-only primitives every page is assembled from. Each one is a measured reproduction of an
artboard element: the box, type, spacing and state table come from `design/inventory/*.md` and the
artboard HTML, and each file's own header comment carries the `file:line` sources — **read the header
before changing a number**. This folder is where parity is won or lost once, instead of being re-derived
per page. Delete it and `ProductCard`, `/styleguide` and every unbuilt page stop compiling.

## Owns
One line each; measurements and per-variant tables live in each file's header comment, not here.

- [`badge.tsx`](badge.tsx) — `Badge`, a non-interactive season/status pill. `BadgeProps` = `<span>` props
  + `variant?: "winter" | "all-season" | "all-weather" | "summer" | "accent" | "outline" | "unavailable"`.
  Since 2026-10-07 (D159, D160) every season has a 12px mark (`SEASON_MARK`): Winter is the aqua fill +
  darker 1px edge + `--on-season` ink (24px kept by the outline leading); All-Season, Summer and
  All-Weather are `--accent-subtle` + `--text` with the mark in lime (`SEASON_MARK_TINT`). `accent` is the
  drawn solid lime with no mark, unused by any season. DEVIATIONS #125, #126.
- [`button.tsx`](button.tsx) — `Button`; renders `next/link` when `href` is set, otherwise `<button>`.
  `ButtonProps` adds `variant?: "primary" | "secondary" | "tertiary" | "accent"` (`accent` = the header
  phone CTA, D40), `size?: "panel" | "card" | "compact" | "promo" | "load"` (`:36`; named by role, because
  every height is a responsive pair; `promo` = the home 52→56 CTAs), `fullWidth?: boolean`. Icon gap is
  per size, not in the base. `load` is the `/tires` `Load more`, `h-13 sm:h-14 text-14 tracking-8
  gap-2.5` (`:87`) with `sizePad.load = "md:px-10"` (`:95`): it is its own size because the mobile
  artboard stretches the link edge to edge with no horizontal padding (`design/inventory/results.md`
  §2.6), which `promo`'s `px-6 sm:px-7` cannot be overridden into (`:69-85`, `HANDOFF.md` §8.4).
- [`checkbox.tsx`](checkbox.tsx) — `Checkbox`, a real `<input type="checkbox">` inside its label row.
  `CheckboxProps`: `id` (required), `children`, `labelClassName`, `labelProbe?` (a parity-probe hook on
  the ROW box; every other prop lands on the input, `:48-52`) and `variant?: "consent" | "facet"`
  (`:41`, default `consent`). `consent` is byte-identical to the original CASL row — 20px box, its own
  13/14px muted copy, 44px min row — and never sets `checked`/`defaultChecked`, so CASL renders unticked
  (`docs/decisions.md:118`). `facet` is the `/tires` filter row: an 18px box
  (`results-desktop.html:141` / `results-mobile-filters.html:80`) with the copy passed through untouched
  (`:138-140`), because a facet row is two spans with two type recipes and the row height and gap differ
  between rail and sheet — they arrive on `labelClassName` (`:31-39`). Hover is
  `enabled:hover:border-ink` (**D66**): the box had rest, checked, focus and disabled recipes and none
  for hover, and it reuses the checked row's own token, so only an unchecked box changes.
- [`chip.tsx`](chip.tsx) — `Chip`, the filter chip and the one control in the system that is **not**
  uppercase. `ChipProps`: `children`, `selected?`, `count?: number`, `removable?`, `removeLabel?`
  (**D66**, default `"Remove"` — an `sr-only` span rendered *before* `children`, so a removable chip
  announces "Remove 215/55R16" and not a bare facet value; the `×` stays `aria-hidden`). The box and both
  state recipes are exported as `chipBox` (`:44`), `chipRestClass` (`:70`) and `chipSelectedClass`
  (`:73`) so a non-`<button>` can wear them. `ChipCheckbox` (`:161-184`) is that consumer: a `<label>`
  wrapping a native `sr-only` `<input type="checkbox">` (`:218-226`), with `size?: "touch" | "auto"`
  (`:178` — `auto` steps 44→40px at `sm:`, `touch` pins 44px for the sheet, which is in use to 1099, D46).
  It renders no count: the artboards draw the Season chips bare (`:149-151`).
- [`field-label.tsx`](field-label.tsx) — `FieldLabel` (`htmlFor` required, `optional?`, `required?`) and
  `FieldError` (`id` required), the label above a control and the helper line below it.
- [`input.tsx`](input.tsx) — `Input`, `Textarea`, and the exported `fieldBoxClasses()` + `FieldDensity`
  that `Select` reuses so "same box as Input" is one string. `InputProps`: `id` (required), `density?`,
  `invalid?`. `INPUT_TYPE_DEFAULTS` seeds `inputMode`, `autoComplete` and — since **D66** —
  `spellCheck` per `type`, all applied *before* the `{...rest}` spread so a caller still wins;
  `email`/`tel`/`url` set `spellCheck: false`, the attribute's first use anywhere in the build.
- [`price.tsx`](price.tsx) — `Price` and `formatPrice()`. `PriceProps`: `amount: number`,
  `context?: "card" | "pdp"`, `unit?: string`, `unavailable?`. Takes a number, never a string. **No
  `currency` prop since D77** (2026-09-22): the code is not rendered, so a presentation primitive has
  no use for it — `formatPrice(amount)` returns `$129`, not `$129 CAD`. The currency stays as data on
  `Product.currency` and is stated once site-wide by the footer's `SITE.priceNote`
  (`docs/decisions.md` §7, `design/DEVIATIONS.md` #64). `unit` (**D58**) is the suffix copy — `/ tire`, `/ wheel`, `/ each`, `per tire · before tax`
  — and **defaults to the drawn tire string for each context**, so every pre-D58 call site renders
  identically. It is a plain string, not a category lookup, precisely because `src/components/*` never
  imports a feature (D37): the caller in `catalog/` or `product/` reads
  `CategoryConfig.unit` and passes the result down.
- [`section-heading.tsx`](section-heading.tsx) — `SectionHeading`, the `01 — Shop by category` pattern.
  `SectionHeadingProps`: `eyebrow`, `index?`, `title`, `as?: "h1" | "h2" | "h3"`, `action?`.
- [`select.tsx`](select.tsx) — `Select`, a native `<select>` plus the 16px chevron. `SelectProps`:
  `id` (required), `density?`, `invalid?`, `wrapperClassName?`, `children?` (optional since D157: the
  finder's Model select may take its options as `dangerouslySetInnerHTML`).
- [`stripe-divider.tsx`](stripe-divider.tsx) — `StripeDivider`, the decorative 135° accent hairline.
  `StripeDividerProps`: `thickness?: 1 | 2`.

## Rules
- **A primitive never imports from `src/features/`.** Primitives only, no business logic
  (`docs/decisions.md:65`). The single intra-folder import is `select.tsx:2` → `input.tsx`.
- **Every measured value carries a `file:line` source comment.** `HANDOFF.md` §3 records this as what
  made the extraction round work: "demanding a `file:line` source comment for every measured value".
  A new variant without one does not ship; a missing token is reported, never invented
  (`.claude/rules/ui.md`, "A missing value means adding a token to `@theme` that is traced by comment to
  the artboard element it was measured from — never a guess").
- **Role utilities carry family, weight, leading and case.** `label`, `display`, `numeral` (plus
  `photo-inset-card`, `photo-vignette`, `transition-card`, `tap-extend`) are `@utility` rules in
  `globals.css` (`HANDOFF.md` §9). A file overrides only the property its measurement differs on.
- **`rounded-ctl` is for controls only.** `--radius-ctl: 2px; /* interactive elements; cards/images/
  badges stay 0 */` (`globals.css:72`). `Badge` and `Chip` therefore carry no `rounded-*` class at all.
- **`--border-control` (#69696F) on inputs, selects and textareas only** — D14. Card edges, dividers and
  panel hairlines keep `--border-strong`.
- **Hover is written as Tailwind `hover:`**, which v4 compiles to `@media (hover: hover) { &:hover }` —
  D17. Never hand-write a bare `:hover`; it sticks after a tap.
- **`ChipCheckbox` exists so a chip can submit in a no-JS GET form** — the `/tires` Season group is
  part of `<form method="get">` and must work without JavaScript (D44), which a `<button>` cannot do.
  `Chip` itself is unchanged and is still a `<button>` (`chip.tsx:82`). The two share one measured
  recipe; never re-measure the second.
- **`ChipCheckbox` uses `has-*`, never `peer-*`.** The input is a **child** of the label it styles, and
  `peer-checked:` compiles to a sibling combinator a parent can never match (`chip.tsx:154-160`). The
  selected and focus recipes are written out once in their `has-` spelling because Tailwind scans source
  text — a prefix composed at runtime emits no CSS (`chip.tsx:148-152`).
- **No per-component `transition-*` for colour.** Since **D92b** (DEVIATIONS #75) every control's hover
  fill eases over `--duration-feedback` from one `@layer base` rule in `globals.css`; a primitive adds
  nothing for that. What a primitive *does* own is its **press** state: filled and outlined `Button`
  variants and every `Chip` take `active:translate-y-px` (guarded by `disabled:translate-y-0`), the text
  variant `active:opacity-70`, and `Checkbox` darkens its box border to `--text` while its row is
  pressed (`group-active/check:`), never a translate.
- **Focus is `2px --accent` at offset 0** — D16 (`button.tsx:169`) — except on `primary`, where
  accent-on-accent is invisible and the ring is `--text` (`button.tsx:132`).
- Named exports; no barrel (`docs/decisions.md:69`). Nothing here is a client component.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D91b | 2026-09-29 | Checkbox consent variant: the comment on its 44px floor corrected; the floor itself is recorded as DEVIATIONS #80. | The comment claimed the floor never engaged; at 1440 it does (quote band +26px). | D91b |
| D151 | 2026-10-04 | (1) `Button` `primary` carries `border border-transparent` and pads 1px smaller (`sizePadPrimary`), so its border box is unchanged and forced colours draw its edge. (2) `Chip` carries `data-chip` + `data-selected`, `ChipCheckbox` `data-chip`: hooks for the forced-colours `Highlight` rule in globals.css. | Forced colours repaint every fill as `Canvas`: the filled button lost its edge and a selected chip read as unselected (launch audit, D145, A11Y-MANUAL). | Owner, 2026-10-04: "Apply all code items" |
| — | — | None folder-scoped. | Every ruling here is already global. | — |

Referenced: **D12** (chip radius 0), **D13** (button tracking .08/.04em), **D14**, **D15** (mobile
textarea 16px), **D16**, **D17**, **D21** (price suffix per context, extended per category by **D58**). Authored states — focus, active,
disabled — come from `design/DESIGN.md` §4 under DEVIATIONS #9, because the exports contain no such rule.

## Connects to
- **Depends on:** `src/app/globals.css` (all tokens and role utilities); `next/link` (`button.tsx:1`);
  `input.tsx` ← `select.tsx:2`. Nothing else.
- **Depended on by:** `src/app/(storefront)/styleguide/page.tsx` — all ten modules, every variant and
  state on one `noindex` page; `src/features/catalog/components/product-card.tsx:4-6` (`Badge`,
  `Button`, `Price`); `src/features/finder/` and `src/features/home/` (`Select`, `FieldLabel`,
  `Button`); `src/features/results/components/{filter-panel,filter-sheet,results-grid}.tsx`
  (`Checkbox variant="facet"`, `ChipCheckbox`, `Select`, `Button size="load"`); and
  `src/features/product/components/*` — `Badge`, `Price context="pdp"`, `Button size="panel"`,
  `Input`/`Textarea`/`Select`, `FieldLabel`/`FieldError`, `Checkbox variant="consent"`. The PDP needed
  **no new primitive and no new variant** — both its sizes were measured here first and landed exact
  (`design/reports/product.md`).

## Don't
- **Don't import a feature type here.** It inverts the dependency the HLD sets (`docs/decisions.md:65`).
- **Don't add `rounded-*` to `Badge` or `Chip`.** Radius is an exact-match parity property; 2px fails
  (D12, `badge.tsx:6-10`).
- **Don't add a colour transition to a primitive.** The base layer owns it (D92b); a local
  `transition-*` would fork the timing. See Rules.
- **Don't import `@/features/…` into a primitive** to resolve a per-category value. Take a prop with a
  drawn default instead — that is what `Price`'s `unit` is (D37, D58).
- **Don't let `Price` accept a pre-formatted string.** The number-in/format-here shape is what makes
  cents, a shrunken `$` and superscript unrepresentable (`price.tsx:1-10`, `docs/decisions.md:112`).
- **Don't replace `<select>` or `<input type="checkbox">` with a custom widget.** Hard rule
  (`docs/decisions.md:90`, `select.tsx:7-11`).
- **Don't drop any input below 16px**, however the artboard measures — iOS zooms on focus (D15).
- **Don't demote a second accent** to satisfy the one-accent rule (`docs/decisions.md` §1.1, D5).

## Open
1. ~~**Six copies of `cx()` in two signatures, plus three copies of `join()` — in this folder.**~~
   **Closed 2026-09-21 by D63 (audit finding S2):** all 13 helpers consolidated into `src/lib/cx.ts`,
   which keeps `cx` and `join` as separate functions because they are not interchangeable. The standing
   "nobody may refactor it in passing" prohibition in root `llm.md` §7.10 is lifted by that row. It was
   proven behaviour-preserving rather than assumed: every `class="…"` attribute on all six rendered
   pages was extracted before and after and diffed, empty on all six.
2. ~~**`chip.tsx` contradicts itself.**~~ **Deleted 2026-09-21 (D61, audit finding S4): re-read and the
   contradiction is genuinely gone.** The radius paragraph now argues one thing only — the exports
   declare no `border-radius` on any chip while the Sort select and the tire-size `Apply` button beside
   them carry `--radius-ctl`, so square chips next to 2px controls are deliberate. D12, DEVIATIONS #5.
3. **Stale line citations in header comments** — see the discrepancy list; they need re-pointing, and
   nothing enforces it but root `llm.md` §1.2.
