/**
 * What tells a product from its title siblings (launch audit D145, SEO and
 * DATA-ACC; D151).
 *
 * A product page's title is its name plus its size line (`seo/schema.ts`
 * `toProductSeo`). Measured on the D135 `catalogue.csv`, 9,638 of 39,961
 * products (24%) shared that title with at least one other: wheels that
 * differ only in centre bore (5,925) or Left/Right side (2,405), accessories
 * that differ only in part number (812), a few tires that differ in load
 * range, M+S or 3PMSF. `siblingFacts()` names, for one product, the facts
 * that set it apart from the products sharing its title, in a fixed order,
 * and nothing at all when no product shares it. On that file the greedy rule
 * below leaves 42 products (0.1%) sharing a title, all of them differing
 * only in the vendor's own name text, which no title shows.
 *
 * The card's size line carries the same facts (owner, 2026-10-05: "Yes, on
 * the card"; D153). A card prints a product's name and size line, so
 * "shares its title" and "looks identical" are the same test, and the one
 * rule (`siblingFacts`) serves both: `listingFacts()` runs it over a page of
 * cards, `queries.ts` attaches the result as `tellingFacts`.
 *
 * Pure, no I/O. The siblings come from `queries.ts` `getTitleSiblings` (one
 * product page) and `getListingSiblings` (one page of cards).
 */

import { productName } from "@/lib/product-name";

import { baseSizeLine, toProduct } from "./adapter";
import type { CatalogProduct } from "./catalog-types";

/** Name and size line, as the card and the title read them. Two products
 *  with the same key would get the same page title. The size line is the
 *  product's own, without any telling facts already attached to it. */
export function titleKey(product: CatalogProduct): string {
  const card = toProduct(product);
  return `${productName(card.brand, card.model)}\n${baseSizeLine(product)}`;
}

type Fact = (product: CatalogProduct) => string | null;

const COUNT = new Intl.NumberFormat("en-CA");

/** A vendor fact with no column (D125), by label, or `null`. */
function extra(product: CatalogProduct, label: string): string | null {
  const wanted = label.toLowerCase();
  const found = product.extraSpecs.find(
    (spec) => spec.label.trim().toLowerCase() === wanted,
  );
  const value = found?.value.trim() ?? "";
  return value === "" ? null : value;
}

/* Wheels: the side first (a left and a right wheel are a pair, and the
   difference matters more than a bore), then the centre bore, then the rarer
   ones. Labels match the specifications table's own rows. */
const WHEEL_FACTS: readonly Fact[] = [
  (product) => {
    const side = extra(product, "Side");
    if (side === null) return null;
    return /^(left|right)$/i.test(side)
      ? `${side.charAt(0).toUpperCase()}${side.slice(1).toLowerCase()} side`
      : side;
  },
  (product) =>
    product.category === "wheels" && product.specs?.centerBoreMm != null
      ? `Centre bore ${product.specs.centerBoreMm} mm`
      : null,
  (product) => {
    if (product.category !== "wheels") return null;
    const seat = product.specs?.seatType?.trim();
    if (!seat) return null;
    return /seat/i.test(seat) ? seat : `${seat} seat`;
  },
  (product) =>
    product.category === "wheels" && product.specs?.backspacing != null
      ? `Backspacing ${product.specs.backspacing.toFixed(2)} in`
      : null,
  (product) =>
    product.category === "wheels" && product.specs?.loadRatingLbs != null
      ? `Load rating ${COUNT.format(product.specs.loadRatingLbs)} lb`
      : null,
];

/* Accessories: the part number (a wheel's or accessory's own column since
   D142), unless the name already prints it, as some vendor names do. */
const ACCESSORY_FACTS: readonly Fact[] = [
  (product) => {
    const part = product.partNumber?.trim();
    if (!part) return null;
    const name = `${product.model ?? ""} ${product.name}`.toLowerCase();
    return name.includes(part.toLowerCase()) ? null : `Part number ${part}`;
  },
];

/* Tires: the load range, then the sidewall marks. A mark is a fact only when
   it is there: `mud_snow` and `winter_approved` are false both for "no" and
   for "not stated" (D136), so their absence is never printed. */
const TIRE_FACTS: readonly Fact[] = [
  (product) =>
    product.category === "tires" && product.specs?.loadRange
      ? `Load range ${product.specs.loadRange}`
      : null,
  (product) =>
    product.category === "tires" && product.specs?.mudSnow ? "M+S" : null,
  (product) =>
    product.category === "tires" && product.specs?.winterApproved
      ? "3PMSF"
      : null,
  (product) =>
    product.category === "tires" && product.specs?.studdable
      ? "Studdable"
      : null,
  (product) =>
    product.category === "tires" && product.specs?.plyRating != null
      ? `${product.specs.plyRating} ply`
      : null,
];

const FACTS: Readonly<Record<CatalogProduct["category"], readonly Fact[]>> = {
  tires: TIRE_FACTS,
  wheels: WHEEL_FACTS,
  accessories: ACCESSORY_FACTS,
};

/**
 * The facts to add after `product`'s size line, in order; `[]` when nothing
 * shares its title.
 *
 * Greedy and symmetric: walk the category's facts in order; a fact on which
 * every remaining sibling agrees with this product says nothing and is
 * skipped; otherwise this product's value is added (when it has one) and only
 * the siblings that share that value stay in play. Every sibling runs the
 * same walk, so two products part at the first fact they differ on, and at
 * that fact at least one of them prints its value.
 *
 * `siblings` may include the product itself or products with another title;
 * both are ignored.
 */
export function siblingFacts(
  product: CatalogProduct,
  siblings: readonly CatalogProduct[],
): string[] {
  const key = titleKey(product);
  let rest = siblings.filter(
    (sibling) => sibling.id !== product.id && titleKey(sibling) === key,
  );
  const facts: string[] = [];
  for (const fact of FACTS[product.category]) {
    if (rest.length === 0) break;
    const mine = fact(product);
    if (rest.every((sibling) => fact(sibling) === mine)) continue;
    if (mine !== null) facts.push(mine);
    rest = rest.filter((sibling) => fact(sibling) === mine);
  }
  return facts;
}

/**
 * `siblingFacts` for a whole listing at once: for each of `products`, the
 * facts to print after its card's size line, keyed by product id. A product
 * whose title key nobody else in `candidates` shares has no entry.
 *
 * `candidates` is every product that could share a title with any of
 * `products` (`queries.ts` `getListingSiblings`), including the products
 * themselves. Groups the candidates by title key once, so the work is one
 * pass over them plus `siblingFacts` on each product that has a sibling.
 */
export function listingFacts(
  products: readonly CatalogProduct[],
  candidates: readonly CatalogProduct[],
): Map<string, string[]> {
  const groups = new Map<string, CatalogProduct[]>();
  for (const candidate of candidates) {
    const key = titleKey(candidate);
    const group = groups.get(key);
    if (group) group.push(candidate);
    else groups.set(key, [candidate]);
  }
  const facts = new Map<string, string[]>();
  for (const product of products) {
    const group = groups.get(titleKey(product));
    if (group === undefined || group.length < 2) continue;
    const mine = siblingFacts(product, group);
    if (mine.length > 0) facts.set(product.id, mine);
  }
  return facts;
}
