/**
 * Catalog domain types.
 *
 * The field list is not designed, it is measured: `design/inventory/results.md:363`
 * (§3.10 "Variation between card instances") is the exhaustive list of what
 * differs between the 14 card instances across the artboards — image + alt,
 * badge slot, brand stamp/label, model, size, 3PMSF presence, price, CTA
 * variant. Everything else is byte-identical, so nothing else belongs here.
 *
 * Deliberately absent, per `docs/decisions.md:107`: stock counts, shipping,
 * ratings and invented specs are never rendered, so a card never receives them.
 * There is no cart, so there is no quantity, SKU-availability count or
 * add-to-cart affordance either (`docs/decisions.md:105`).
 */

/**
 * Season / fitment badges.
 *
 * WINTER is the only one that takes colour (`design/DESIGN.md:197`); ALL-SEASON,
 * SUMMER, OEM and STUDDABLE all share the `1px --text-muted` outline treatment
 * (`design/DESIGN.md:198-199`). Only `winter` and `all-season` are drawn in the
 * artboards (`design/inventory/results.md:298`); the other three come from the
 * spec's badge table and render through the same outline variant.
 *
 * `Currently unavailable` is deliberately NOT a member: the artboards use it as
 * a *replacement* for the season badge on an out-of-stock card rather than as a
 * value the product carries (`design/inventory/results.md:355`), so it is
 * derived from `available` instead.
 */
export type ProductBadge =
  | "winter"
  | "all-season"
  | "summer"
  | "oem"
  | "studdable";

export interface Product {
  /**
   * URL segment and image basename. The optimised cut-out lives at
   * `/images/products/<slug>.webp` (1000×1000, transparent).
   */
  slug: string;
  /**
   * Cut-out basename under `/images/products/<image>.webp`, when it differs
   * from `slug`. Absent = the card uses `slug`.
   *
   * Measured variation, not design: `design/inventory/results.md:363` (§3.10)
   * lists "image src + alt" as one of the things that differs between card
   * instances, and §7.2 records that four cut-outs cover the nine artboard
   * SKUs — the same photo appears on two or three cards because the extra SKUs
   * are other sizes of the same tire (D43). A real per-SKU photo set removes
   * every `image` and leaves `slug` doing the work again.
   */
  image?: string;
  /**
   * `Zeta`. Rendered twice per card — the top-right stamp inside the image
   * (`design/assets/results-desktop.html:167`) and the body's brand line
   * (`:171`) — and again as the first half of the image `alt`
   * (`design/inventory/results.md:702`).
   */
  brand: string;
  /** `Antarctica Sport`. Display type, and the card's link to the product. */
  model: string;
  /**
   * `215/55R16 · 97T XL` — `<width>/<ratio>R<rim>` with no spaces, then ` · `
   * (U+00B7, spaced), then `<load index><speed rating> XL`
   * (`design/inventory/results.md:737`). Pre-joined, because the artboards
   * render the whole thing as one tabular string in one span
   * (`design/assets/results-desktop.html:175`).
   */
  size: string;
  /**
   * Whole currency units, e.g. `129`. A number, not a string: `Price` formats
   * it so a caller can never reintroduce cents, a shrunken `$` or superscript
   * (`src/components/ui/price.tsx`, `docs/decisions.md:112`).
   */
  price: number;
  /** ISO code rendered inside the numeral: `$129 CAD`. `CAD` throughout. */
  currency: string;
  /**
   * Season / fitment badges, in the order the shop wants them read. The card
   * hoists WINTER to the front and renders at most two
   * (`design/DESIGN.md:201`).
   */
  badges: readonly ProductBadge[];
  /**
   * Three-peak mountain snowflake mark beside the size. Present on every Winter
   * card, absent on every All-Season card and on the unavailable card
   * (`design/inventory/results.md:367`).
   */
  threePeakMountainSnowflake: boolean;
  /**
   * `false` switches the card to the unavailable variant: image at 35%
   * opacity, `Currently unavailable` badge, price in `--text-dim`, ghost CTA
   * reading `Inquire about restock`. The page still returns HTTP 200
   * (`docs/decisions.md:116`, `design/inventory/results.md:352`).
   */
  available: boolean;
  /**
   * Studdable winter tire. The PDP spec table draws `Season` as
   * `Winter (studdable)` (`design/inventory/product.md` §2.5), which no other
   * field can reproduce.
   *
   * Deliberately NOT a `ProductBadge`: `studdable` is a member of that union,
   * but pushing it into `badges` would give the card a second badge and move a
   * measured `/results` parity row. A spec-table fact belongs outside the slot
   * the cards compete for (D53(2)).
   */
  studdable?: boolean;
}
