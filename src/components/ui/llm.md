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
  + `variant?: "winter" | "outline" | "unavailable"`.
- [`button.tsx`](button.tsx) — `Button`; renders `next/link` when `href` is set, otherwise `<button>`.
  `ButtonProps` adds `variant?: "primary" | "secondary" | "tertiary" | "accent"` (`accent` = the header
  phone CTA, D40), `size?: "panel" | "card" | "compact" | "promo" | "load"` (`:36`; named by role, because
  every height is a responsive pair; `promo` = the home 52→56 CTAs), `fullWidth?: boolean`. Icon gap is
  per size, not in the base. `load` is the `/results` `Load more`, `h-13 sm:h-14 text-14 tracking-8
  gap-2.5` (`:87`) with `sizePad.load = "md:px-10"` (`:95`): it is its own size because the mobile
  artboard stretches the link edge to edge with no horizontal padding (`design/inventory/results.md`
  §2.6), which `promo`'s `px-6 sm:px-7` cannot be overridden into (`:69-85`, `HANDOFF.md` §8.4).
- [`checkbox.tsx`](checkbox.tsx) — `Checkbox`, a real `<input type="checkbox">` inside its label row.
  `CheckboxProps`: `id` (required), `children`, `labelClassName`, `labelProbe?` (a parity-probe hook on
  the ROW box; every other prop lands on the input, `:48-52`) and `variant?: "consent" | "facet"`
  (`:41`, default `consent`). `consent` is byte-identical to the original CASL row — 20px box, its own
  13/14px muted copy, 44px min row — and never sets `checked`/`defaultChecked`, so CASL renders unticked
  (`docs/decisions.md:118`). `facet` is the `/results` filter row: an 18px box
  (`results-desktop.html:141` / `results-mobile-filters.html:80`) with the copy passed through untouched
  (`:138-140`), because a facet row is two spans with two type recipes and the row height and gap differ
  between rail and sheet — they arrive on `labelClassName` (`:31-39`).
- [`chip.tsx`](chip.tsx) — `Chip`, the filter chip and the one control in the system that is **not**
  uppercase. `ChipProps`: `children`, `selected?`, `count?: number`, `removable?`. The box and both
  state recipes are exported as `chipBox` (`:44`), `chipRestClass` (`:70`) and `chipSelectedClass`
  (`:73`) so a non-`<button>` can wear them. `ChipCheckbox` (`:161-184`) is that consumer: a `<label>`
  wrapping a native `sr-only` `<input type="checkbox">` (`:218-226`), with `size?: "touch" | "auto"`
  (`:178` — `auto` steps 44→40px at `sm:`, `touch` pins 44px for the sheet, which is in use to 1099, D46).
  It renders no count: the artboards draw the Season chips bare (`:149-151`).
- [`field-label.tsx`](field-label.tsx) — `FieldLabel` (`htmlFor` required, `optional?`, `required?`) and
  `FieldError` (`id` required), the label above a control and the helper line below it.
- [`input.tsx`](input.tsx) — `Input`, `Textarea`, and the exported `fieldBoxClasses()` + `FieldDensity`
  that `Select` reuses so "same box as Input" is one string. `InputProps`: `id` (required), `density?`,
  `invalid?`.
- [`price.tsx`](price.tsx) — `Price` and `formatPrice()`. `PriceProps`: `amount: number`,
  `currency: string`, `context?: "card" | "pdp"`, `unavailable?`. Takes a number, never a string.
- [`section-heading.tsx`](section-heading.tsx) — `SectionHeading`, the `01 — Shop by category` pattern.
  `SectionHeadingProps`: `eyebrow`, `index?`, `title`, `as?: "h1" | "h2" | "h3"`, `action?`.
- [`select.tsx`](select.tsx) — `Select`, a native `<select>` plus the 16px chevron. `SelectProps`:
  `id` (required), `density?`, `invalid?`, `wrapperClassName?`, `children`.
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
- **`ChipCheckbox` exists so a chip can submit in a no-JS GET form** — the `/results` Season group is
  part of `<form method="get">` and must work without JavaScript (D44), which a `<button>` cannot do.
  `Chip` itself is unchanged and is still a `<button>` (`chip.tsx:82`). The two share one measured
  recipe; never re-measure the second.
- **`ChipCheckbox` uses `has-*`, never `peer-*`.** The input is a **child** of the label it styles, and
  `peer-checked:` compiles to a sibling combinator a parent can never match (`chip.tsx:154-160`). The
  selected and focus recipes are written out once in their `has-` spelling because Tailwind scans source
  text — a prefix composed at runtime emits no CSS (`chip.tsx:148-152`).
- **No `transition` on a button.** `globals.css`: "Buttons declare no transition at all — an instant fill
  swap … Do not add one." Chips follow the same rule (`chip.tsx:63-64`).
- **Focus is `2px --accent` at offset 0** — D16 (`button.tsx:169`) — except on `primary`, where
  accent-on-accent is invisible and the ring is `--text` (`button.tsx:132`).
- Named exports; no barrel (`docs/decisions.md:69`). Nothing here is a client component.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | Every ruling here is already global. | — |

Referenced: **D12** (chip radius 0), **D13** (button tracking .08/.04em), **D14**, **D15** (mobile
textarea 16px), **D16**, **D17**, **D21** (price suffix per context). Authored states — focus, active,
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
  **no new primitive and no new variant**: `Price context="pdp"` and `Button size="panel"` were measured
  from these artboards when the primitives were built, and both landed exact at 1440 and 390
  (`design/reports/product.md`).

## Don't
- **Don't import a feature type here.** It inverts the dependency the HLD sets (`docs/decisions.md:65`).
- **Don't add `rounded-*` to `Badge` or `Chip`.** Radius is an exact-match parity property; 2px fails
  (D12, `badge.tsx:6-10`).
- **Don't add a transition to a button or chip.** See Rules.
- **Don't let `Price` accept a pre-formatted string.** The number-in/format-here shape is what makes
  cents, a shrunken `$` and superscript unrepresentable (`price.tsx:1-10`, `docs/decisions.md:112`).
- **Don't replace `<select>` or `<input type="checkbox">` with a custom widget.** Hard rule
  (`docs/decisions.md:90`, `select.tsx:7-11`).
- **Don't drop any input below 16px**, however the artboard measures — iOS zooms on focus (D15).
- **Don't demote a second accent** to satisfy the one-accent rule (`docs/decisions.md` §1.1, D5).

## Open
1. **Six copies of `cx()` in two signatures, plus a third `join()` helper.** Canonical row: root
   `llm.md` §7.10. Owner or the coordinating session (D25) rules whether one helper moves to
   `src/lib/`; nobody may refactor it in passing.
2. **`chip.tsx:30-43` contradicts itself.** The paragraph rules radius 0 because "Artboards win on a
   measured value", then a stranded fragment beginning mid-sentence ("and globals.css's rule that…")
   concludes the opposite, that this is "the spec filling a silence". D12 settles the outcome; the
   comment needs the dead half deleted. Whoever next edits the file.
3. **Stale line citations in header comments** — see the discrepancy list; they need re-pointing, and
   nothing enforces it but root `llm.md` §1.2.
