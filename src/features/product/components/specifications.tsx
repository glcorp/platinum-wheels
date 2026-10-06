import type { ProductSpecRow } from "@/features/product/types";
import { cx } from "@/lib/cx";

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
  /** The vendor's prose about the product, shown under the table (D135). */
  description?: string | null;
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
   the type step, not a `md:` layout change.
   2026-10-07 (owner, on a phone: "fix the blank space between call us and
   specs"): the drawn 112px below 720 is 48px, the gap the mobile page uses
   between its other sections. DEVIATIONS #123. Tablet and desktop keep 96. */
const SECTION = "flex flex-col gap-5 pt-12 sm:gap-8 sm:pt-24";

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
/* D135: `h-12 sm:h-14` is now the MINIMUM (`min-h-12 sm:min-h-14`), so a value
   that wraps grows its row instead of overflowing a fixed box. `py-3` keeps a
   wrapped value off the hairlines; for a one-line value the minimum height
   still decides and `items-center` centres it, so every drawn row measures
   what it did (48 / 56). `gap-x-4` keeps the key off a long value. */
const ROW_BASE =
  "odd:bg-surface border-border grid min-h-12 border-b px-3 sm:min-h-14 sm:px-6";
const ROW_INLINE = "grid-cols-2 items-center gap-x-4 py-3";

/* A value this long (a wheel's `Fitment` list is ~285 characters, an
   accessory's `Fits wheel` up to 1,292) cannot sit in half a row: it would
   stack into a tall, narrow column. Past this length the row becomes one
   column, key above, the value full width and flush left (D135). */
const LONG_VALUE = 60;
const ROW_STACKED = "grid-cols-1 items-start gap-y-2 py-4";
/* Two separate class sets, never layered: there is no class-merge helper
   here (`src/lib/cx.ts`), so a base and an override would fight on source
   order. */

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
const VALUE_CELL =
  "numeral text-ink text-14 wrap-anywhere sm:text-16";
const VALUE_INLINE = "text-right leading-flat";

/* A value that may take more than one line leaves the drawn `/1` line height,
   which would stack wrapped lines on top of each other. Only a value longer
   than the shortest one that can wrap in the half-width mobile cell (the
   longest drawn value, `Winter (studdable)`, is 18) changes, so short rows
   keep the measured box. */
const WRAPPING = 18;
const VALUE_WRAPPING = "text-right leading-snug";
const VALUE_STACKED = "text-left leading-snug";

/* Prose under the table: the prose-page paragraph (`prose-page.tsx`), flush
   left, line breaks the vendor wrote kept. */
const DESCRIPTION =
  "text-16 leading-body text-ink-muted max-w-hero-lede break-words whitespace-pre-line sm:text-17";

export function Specifications({ rows, description }: SpecificationsProps) {
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
          {rows.map((row, index) => {
            const stacked = row.value.length > LONG_VALUE;
            return (
              <tr
                key={`${index}-${row.key}`}
                className={cx(ROW_BASE, stacked ? ROW_STACKED : ROW_INLINE)}
              >
                <th scope="row" className={KEY_CELL}>
                  {row.key}
                </th>
                <td
                  className={cx(
                    VALUE_CELL,
                    stacked
                      ? VALUE_STACKED
                      : row.value.length > WRAPPING
                        ? VALUE_WRAPPING
                        : VALUE_INLINE,
                  )}
                >
                  {row.value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {description ? <p className={DESCRIPTION}>{description}</p> : null}
    </section>
  );
}
