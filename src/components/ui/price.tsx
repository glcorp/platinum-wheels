/**
 * Price — the single price presentation for the storefront.
 *
 * Business rule (docs/decisions.md §7, DESIGN.md §3 "Numerals"): every price is
 * prefixed `from`, the amount is Barlow 700 tabular in `--text`, and the quoted
 * figure is per tire, before tax and install. Prices are NEVER accent-coloured,
 * the `$` is full size and there are no cents — which is why this component takes
 * a number and formats it itself. A caller cannot hand it a pre-formatted
 * string, so it cannot smuggle in `¢`, a superscript span or a shrunken `$`:
 * the whole figure is one text node in one `numeral` span.
 *
 * The currency code is NOT rendered (D77, 2026-09-22). The artboards draw
 * `$129 CAD`; the owner ruled the bare `$` everywhere because the footer's
 * `Brampton, Ontario · Prices in CAD, before tax` already declares the currency
 * once, site-wide. That footer line is therefore load-bearing — see
 * `src/lib/site.ts` `priceNote`. `docs/decisions.md` §7 is amended to match;
 * `design/DEVIATIONS.md` #64 carries the drawn-vs-shipped row. The currency
 * itself is still data — `Product.currency` — just not presentation.
 *
 * Contexts are measured, not guessed — see the per-context table below.
 * The mobile→desktop crossover is `sm:` (720px), the "Mobile <720" boundary in
 * DESIGN.md §8; both artboards are fixed snapshots (390 and 1440) and carry no
 * `@media` rules (docs/decisions.md §5), so §8 is the only source for it.
 */

import { cx } from "@/lib/cx";

type PriceContext = "card" | "pdp";

export interface PriceProps {
  /**
   * The amount. Rendered in whole units, without cents, by design: a catalogue
   * price of `108.77` reads `$109`.
   *
   * `null` = the catalogue has no price for this product (D105b). The row then
   * reads `Inquire for price` in the `from` label's own type, at the height
   * the amount would have taken, so a card with no price lines up with its
   * neighbours. Undrawn, so new copy under `.claude/rules/ui.md` "Copy".
   */
  amount: number | null;
  /** Where the price sits. `card` is the product grid, `pdp` the buy panel. */
  context?: PriceContext;
  /** Currently-unavailable product: the amount drops to `--text-dim`. */
  unavailable?: boolean;
  /**
   * Unit copy for this product's category — `CategoryConfig.unit.card` or
   * `.unit.pdp` (`@/features/catalog/categories`, D58). Defaults to the tire
   * strings the artboards draw, so an un-passed caller is unchanged.
   *
   * A plain string, not a category lookup: `src/components/*` must never
   * import a feature (D37), so the caller resolves the copy and hands it down
   * instead of this component reaching into `catalog/categories` itself.
   */
  unit?: string;
  className?: string;
}

/* Whole dollars, grouped, never a fraction. `maximumFractionDigits: 0` is the
   mechanism behind DESIGN.md §7 "Don't … superscript cents": there are no cents
   to superscript. en-CA grouping: the amounts are Canadian dollars even though
   the code is no longer rendered beside them (D77). */
const WHOLE_UNITS = new Intl.NumberFormat("en-CA", {
  useGrouping: true,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * `$129` — the artboard string (home-desktop.html:216 card price;
 * product-desktop.html:110 buy-panel price) minus its ` CAD` suffix, per D77.
 * One text node: the `$` and the digits share one span and one size.
 */
export function formatPrice(amount: number): string {
  return `$${WHOLE_UNITS.format(amount)}`;
}

const PRESENTATION = {
  card: {
    /* 6px both axes: home-desktop.html:214 / home-mobile.html:170 card price row
       (`gap:6px`, `align-items:baseline`, `flex-wrap:wrap`). */
    row: "gap-1.5",
    /* 12px mobile → 13px desktop, +0.06em, uppercase, --text-muted:
       home-mobile.html:171 / home-desktop.html:215 card `from`. */
    prefix: "text-12 tracking-6 sm:text-13",
    /* 24px mobile → 28px desktop, no tracking declared:
       home-mobile.html:172 / home-desktop.html:216 card price. */
    amount: "text-24 sm:text-28",
    /* 12px mobile → 13px desktop, Barlow 400, line-height 1, --text-dim:
       home-mobile.html:173 / home-desktop.html:217 card `/ tire`. */
    suffix: "leading-flat text-12 sm:text-13",
    /* Card suffix stays on the price row at both widths (both artboards). */
    suffixBreak: "",
    /* Verbatim, both card artboards. */
    suffixCopy: "/ tire",
    /* The amount's own line box, 24px → 28px, so the row keeps its height. */
    noPrice: "h-6 sm:h-7",
  },
  pdp: {
    /* 10px column gap mobile (product-mobile.html:95 `gap:10px`) → 12px desktop
       (product-desktop.html:110 `gap:12px`). The 8px row gap reproduces the
       mobile artboard's second row, a sibling span carrying `margin-top:-8px`
       against the panel's 16px stack gap (product-mobile.html:96). */
    row: "gap-x-2.5 gap-y-2 sm:gap-x-3",
    /* 12px mobile → 13px desktop, +0.08em, uppercase, --text-muted:
       product-mobile.html:95 / product-desktop.html:110 buy-panel `from`. */
    prefix: "text-12 tracking-8 sm:text-13",
    /* 48px mobile → 64px desktop, tracking -0.02em:
       product-mobile.html:95 / product-desktop.html:110 buy-panel price.
       DESIGN.md §3 claims 56px for the PDP; the artboards measure 64/48 and the
       artboards win (docs/decisions.md §1, product.md §6). */
    amount: "tracking-price text-48 sm:text-64",
    /* 13px/1 mobile (product-mobile.html:96) → 14px/1.3 desktop
       (product-desktop.html:110), Barlow 400, --text-dim. */
    suffix: "leading-flat text-13 sm:leading-normal sm:text-14",
    /* Mobile splits the block onto two rows and desktop keeps one baseline row
       (product-mobile.html:95-96 vs product-desktop.html:110). */
    suffixBreak: "basis-full sm:basis-auto",
    /* Verbatim, both PDP artboards. Separator is U+00B7 with spaces. */
    suffixCopy: "per tire · before tax",
    /* The amount's own line box, 48px → 64px. */
    noPrice: "h-12 sm:h-16",
  },
} as const;

export function Price({
  amount,
  context = "card",
  unavailable = false,
  unit,
  className,
}: PriceProps) {
  const style = PRESENTATION[context];

  if (amount === null) {
    return (
      <div className={cx("flex items-center", style.noPrice, className)}>
        <span className={cx("label text-ink-muted", style.prefix)}>
          Inquire for price
        </span>
      </div>
    );
  }

  return (
    <div
      className={cx("flex flex-wrap items-baseline", style.row, className)}
    >
      <span className={cx("label text-ink-muted", style.prefix)}>from</span>
      <span
        className={cx(
          "numeral leading-flat",
          /* Never accent-coloured (DESIGN.md §3/§7). Unavailable dims the amount
             to --text-dim; docs/decisions.md §7 "Unavailable product = dimmed". */
          unavailable ? "text-ink-dim" : "text-ink",
          style.amount,
        )}
      >
        {formatPrice(amount)}
      </span>
      <span
        className={cx(
          "text-ink-dim font-sans font-normal",
          style.suffix,
          style.suffixBreak,
        )}
      >
        {unit ?? style.suffixCopy}
      </span>
    </div>
  );
}
