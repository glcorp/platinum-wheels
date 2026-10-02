import type { ProductSpecRow } from "@/features/product/types";

/* ---------------------------------------------------------------------------
   Specifications — the six-row spec table below the gallery/buy-panel split.
   Server Component. Rows arrive fully derived (D53, `view.ts` `productView()`)
   — this component only lays them out, it computes nothing.

   Measured: `design/inventory/product.md` §2.5 (structure), §3.7 (the exact
   geometry summary table) and §5.3 (spacing scale).
   Sources: `design/assets/product-desktop.html:126-131`,
            `design/assets/product-mobile.html:102-105`.
   --------------------------------------------------------------------------- */

export interface SpecificationsProps {
  rows: readonly ProductSpecRow[];
}

/* Section: `padding:96px 48px 0;gap:32px` D (product-desktop.html:126) vs
   `padding:112px 16px 0;gap:20px` M (product-mobile.html:102). Mobile's
   padding-top (112) is LARGER than desktop's (96) — confirmed in both
   artboards and `product.md` §1.4/§2.5; this is not a typo, do not "fix" the
   direction. Side padding (48px D / 16px M) is NOT set here: the caller
   (`src/app/(storefront)/products/[slug]/page.tsx`) already wraps this
   component in `px-4 sm:px-8 md:mx-auto md:max-w-content md:px-12`, so
   adding it again here would double it. Only padding-top and gap are this
   component's own. Type crosses at `sm:` 720 (h2 below); the 96px
   padding-top also lands at `sm:`, the same D41 tablet-band convention as
   the type step, not a `md:` layout change. */
const SECTION = "flex flex-col gap-5 pt-28 sm:gap-8 sm:pt-24";

/* `display` utility carries family/weight/leading/tracking/transform; size
   stays an explicit token (DESIGN.md §3). 32px M (product-mobile.html:103) →
   40px D (product-desktop.html:127). */
const HEADING = "display text-ink text-display-32 sm:text-display-40";

/* Row: `grid-template-columns:1fr 1fr`, `height:56px` D / `48px` M,
   `padding:0 24px` D / `0 12px` M, `align-items:center`,
   `border-bottom:1px solid var(--border)` on EVERY row incl. the last
   (`product.md` §3.7, `product-desktop.html:129`, `product-mobile.html:104`).
   `<tr>` is switched from its default `display:table-row` to `grid` so the
   measured 2-column geometry survives real `<table>` semantics — same move as
   DEVIATIONS #24 (the export's presentational markup becomes real elements,
   geometry unchanged). `<th>`/`<td>` blockify automatically once their parent
   is a grid container, so no further display reset is needed on them. */
const ROW =
  "odd:bg-surface border-border grid h-12 grid-cols-2 items-center border-b px-3 sm:h-14 sm:px-6";

/* Zebra: DOM order is Brand, Model, Size, Season, Load/speed, 3PMSF — rows
   1/3/5 are `--surface`, rows 2/4/6 `transparent` (`product.md` §3.7).
   Tailwind's `odd:` compiles to `:nth-child(odd)` on the element it is
   applied to, i.e. the 1st/3rd/5th `<tr>` in DOM order — exactly Brand, Size,
   Load/speed, matching the artboard. Even rows need no explicit class: they
   fall through to the page ground, which is what `background:transparent`
   resolves to in the export. */

/* Key cell: `font:400 16px/1 var(--font-body);color:var(--text-muted)` D →
   `400 14px/1` M, left-aligned. `font-sans` is explicit because table cells
   do not inherit the body font (same reason `src/components/ui/input.tsx:65`
   states it for form controls); `font-normal`/`text-left` override the
   browser's default bold/centred `<th>` styling. */
const KEY_CELL =
  "font-sans text-ink-muted text-left text-14 leading-flat font-normal sm:text-16";

/* Value cell: `font:700 16px/1 var(--font-body);font-variant-numeric:
   tabular-nums;text-align:right;color:var(--text)` D → `700 14px/1` M. The
   `numeral` utility already carries family/weight/tabular-nums; only size,
   leading, colour and alignment are explicit. */
const VALUE_CELL = "numeral text-ink text-right text-14 leading-flat sm:text-16";

export function Specifications({ rows }: SpecificationsProps) {
  return (
    <section data-probe="specifications" className={SECTION}>
      <h2 className={HEADING}>Specifications</h2>
      {/* Wrapper: `border-top:1px solid var(--border-strong)`
          (`product-desktop.html:128`, `product-mobile.html:104`). At 358px
          wide with two 179px cells (`product-mobile.html` computed), the
          longest value `Winter (studdable)` at 14px/700 Barlow fits the
          right cell without wrapping — verified by character-width estimate
          only; the coordinator's browser parity pass should confirm no clip. */}
      <table className="border-border-strong w-full border-t">
        <tbody>
          {/* Keyed by position as well as label: since D125 a vendor's extra
              fact may repeat a column's label (`Finish`), and two rows must
              never share a key. Rows are derived per render, never reordered. */}
          {rows.map((row, index) => (
            <tr key={`${index}-${row.key}`} className={ROW}>
              <th scope="row" className={KEY_CELL}>
                {row.key}
              </th>
              <td className={VALUE_CELL}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
