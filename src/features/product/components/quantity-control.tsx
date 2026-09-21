import Link from "next/link";

import {
  PRODUCT_PARAM,
  QUANTITY_OPTIONS,
  type QuantityKey,
} from "@/features/product/types";

/* ---------------------------------------------------------------------------
   QuantityControl — the four `?qty=` cells (D50)

   Server Component: the cells are `next/link`s that set `?qty=<value>` while
   preserving every other current param, so the panel never needs client
   state. `qty` never touches `backHref` (`view.ts` excludes it deliberately).

   Header — `How many?`, `font:500 12px/1;letter-spacing:.12em;
   text-transform:uppercase;color:var(--text)` (`product.md` §3.4,
   `product-desktop.html:111`).

   Grid — desktop `1fr 1fr 1fr 1.6fr` inside 576px, mobile `1fr 1fr 1fr 1.5fr`
   inside 358px, `gap:8px` both (`product.md` §3.4) — `qty-grid` /
   `md:qty-grid-wide` (globals.css), `gap-2`.

   Cells `1`/`2`: `height:52px` desktop / `48px` mobile, `border:1px solid
   var(--border-strong)`, transparent fill, `color:var(--text-muted)`,
   `font:700 17px/1` desktop / `700 16px/1` mobile, tabular
   (`product-desktop.html:112`, `product-mobile.html:97`).

   Selected cell (`4` here, but marked by `view.quantity`): `background:
   var(--text);color:var(--on-accent);border:1px solid var(--text)`.

   `Custom`: `background:var(--surface-2);border:1px solid
   var(--border-strong);justify-content:space-between;padding:0 14px`
   desktop / `0 12px` mobile, label `font:400 15px/1` desktop / `400 14px/1`
   mobile `color:var(--text-dim)`, chevron 16×16 desktop / 14×14 mobile
   `stroke:var(--text-muted);stroke-width:1.6`.

   No radius on any cell (radius is CTA-only, `product.md` §3.4 "no radius on
   the cells"). No transition — house rule: buttons/cells swap instantly
   (`globals.css`, `.claude/rules/ui.md`).
   --------------------------------------------------------------------------- */

export interface QuantityControlProps {
  /** The four cells' current selection. */
  quantity: QuantityKey;
  /** Every other current search param, so a cell link changes only `qty`. */
  searchParams: Record<string, string | string[] | undefined>;
}

function ChevronIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-muted)"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** `?qty=<value>` with every other current param preserved, verbatim order
 *  (`view.ts` uses the same `URLSearchParams` approach for `backHref`). */
function hrefFor(
  value: QuantityKey,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, current] of Object.entries(searchParams)) {
    if (key === PRODUCT_PARAM.qty || current === undefined) continue;
    if (Array.isArray(current)) {
      for (const entry of current) search.append(key, entry);
    } else {
      search.append(key, current);
    }
  }
  search.set(PRODUCT_PARAM.qty, value);
  return `?${search.toString()}`;
}

export function QuantityControl({
  quantity,
  searchParams,
}: QuantityControlProps) {
  return (
    <div className="flex flex-col gap-2.5 pt-2">
      <div className="flex items-baseline justify-between">
        {/* `id` so the cells below can borrow this as their group name. The
            four links read out as bare `1` / `2` / `4` / `Custom` otherwise,
            with nothing tying them to the question they answer — the same
            pattern `similar-products.tsx` already uses. D66. */}
        <span id="qty-label" className="label text-ink text-12 tracking-12">
          How many?
        </span>
      </div>
      <div
        role="group"
        aria-labelledby="qty-label"
        className="qty-grid md:qty-grid-wide gap-2"
      >
        {QUANTITY_OPTIONS.map((option) => {
          const selected = option.value === quantity;

          if (option.value === "custom") {
            return (
              <Link
                key={option.value}
                href={hrefFor(option.value, searchParams)}
                aria-current={selected ? "true" : undefined}
                className="bg-surface-2 border-border-strong text-ink-dim flex h-12 items-center justify-between border px-3 text-14 sm:h-13 sm:px-3.5 sm:text-15"
              >
                <span className="font-sans font-normal">{option.label}</span>
                <span className="sm:hidden">
                  <ChevronIcon size={14} />
                </span>
                <span className="hidden sm:inline">
                  <ChevronIcon size={16} />
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={option.value}
              href={hrefFor(option.value, searchParams)}
              aria-current={selected ? "true" : undefined}
              className={
                selected
                  ? "bg-ink text-on-accent border-ink numeral flex h-12 items-center justify-center border text-16 sm:h-13 sm:text-17"
                  : "text-ink-muted border-border-strong numeral flex h-12 items-center justify-center border bg-transparent text-16 sm:h-13 sm:text-17"
              }
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
