/**
 * PDP contract — written by the coordinator before any component so the three
 * build agents code against one shape (D25, the pattern that worked at
 * `page results`: `src/features/results/types.ts`).
 *
 * Two halves, same as `/tires`:
 *   `view.ts`  — pure derivation from a `Product` + the raw query (no I/O).
 *
 * The quote form and its Server Action left this folder for the cart in D122
 * (`src/features/cart/`): the product page adds to the cart, the cart asks.
 *
 * The buy-panel quantity is a URL param (D50), so the page is fully server
 * rendered at every state and a reload keeps the selection. Everything the
 * spec table shows is derived from `Product` (D53), so the PDP adds no seed
 * data beyond the one `studdable` flag.
 */

import type { CategoryConfig } from "@/features/catalog/categories";
import type { Product } from "@/features/catalog/types";

/* --- Quantity (D50) ------------------------------------------------------ */

/** The four cells the buy panel draws, in artboard order
 *  (`design/inventory/product.md` §3.4: `1`, `2`, `4` selected, `Custom`). */
export type QuantityKey = "1" | "2" | "4" | "custom";

export const QUANTITY_OPTIONS: ReadonlyArray<{
  value: QuantityKey;
  /** Cell label, artboard-verbatim. Category-independent: the four cells are
   *  `1`, `2`, `4`, `Custom` on every product (D58). */
  label: string;
}> = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "4", label: "4" },
  { value: "custom", label: "Custom" },
];

/** The `How many?` cell selected when `?qty=` is absent or unknown: `1` for
 *  every category, the same one a card's `Add to cart` adds, so a card and its
 *  product page agree (D127). The artboards draw `4` selected
 *  (`product-desktop.html:114`, `DEVIATIONS.md` #98); a visitor who wants a
 *  set picks `4`, and that pick is what the panel adds. */
export const DEFAULT_QUANTITY: QuantityKey = "1";

/** Query-string params this route reads. `qty` is its own (D50); the vehicle
 *  trio arrives from `/tires` and is passed straight through to the
 *  breadcrumb's back-link, and is read by `Add to cart` at the moment of the
 *  add (`src/lib/cart.ts` `vehicleFromLocation`, D122). */
export const PRODUCT_PARAM = {
  qty: "qty",
  year: "year",
  make: "make",
  model: "model",
} as const;

/* --- Vehicle ------------------------------------------------------------- */

/**
 * Structurally identical to `src/features/results/types.ts` `Vehicle`, and
 * deliberately re-declared rather than imported: cross-feature imports go
 * through `catalog/` only (D37), and `Vehicle` is not part of the product
 * domain. `results/` already owns its own copy for the same reason. If a third
 * consumer appears, the shape moves to `src/lib/` — root `llm.md` §7.
 */
export interface Vehicle {
  year: string;
  make: string;
  model: string;
}

/** `2021 Honda Civic`, or `""`: what `Add to cart` saves on a cart line
 *  (D122). Only ever a vehicle `view.ts` has checked against the finder. */
export function vehicleLabel(view: Pick<ProductView, "vehicle">): string {
  const { vehicle } = view;
  return vehicle === null ? "" : `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}

/* --- Badges -------------------------------------------------------------- */

/**
 * The buy panel's badge row draws three (`design/inventory/product.md` §3.1):
 * `Winter` filled, `3PMSF` outline (with a 14px mark on desktop, plain on
 * mobile), `M+S` outline. Only the first two are facts `Product` carries; the
 * `M+S` marking comes from the vendor's own `Mud & snow` fact, not from the
 * season (D135). Never more than these three.
 */
export interface PdpBadge {
  label: string;
  variant: "winter" | "outline" | "unavailable";
  /** `3PMSF` only: the snowflake mark, desktop only. */
  mark?: "three-peak";
}

/* --- Specifications ------------------------------------------------------ */

/** One row of the six-row spec table. Both halves are plain strings; the value
 *  renders right-aligned and tabular (`product.md` §3.7). */
export interface ProductSpecRow {
  key: string;
  value: string;
}

/* --- View ---------------------------------------------------------------- */

/**
 * Everything `products/[slug]/page.tsx` hands its sections. Built once by
 * `productView()` in `view.ts` so no component re-parses a size string or
 * re-derives a spec row.
 */
export interface ProductView {
  product: Product;
  /**
   * The product's category table row (`@/features/catalog/categories`, D58).
   * Every section reads its copy from here rather than switching on the
   * category itself: the breadcrumb takes `crumb` and `route`, the buy panel's
   * `Price` takes `unit.pdp`, the quote form's Quantity select takes
   * `unit.one` / `unit.many`. A tire's row reproduces the built page exactly.
   */
  config: CategoryConfig;
  /** `215/55R16` — the half of `Product.size` before the ` · `. Spec row 3. */
  sizeCode: string;
  /** `97T XL` — the half after it. Spec row 5. */
  loadSpeed: string;
  /** `215/55R16 97T XL` — space-joined, the buy panel's numeral under the
   *  `<h1>` (`product.md` §3.2). The cards keep the ` · ` form. */
  sizeLine: string;
  /** `Zeta Antarctica Sport` — brand + model, the desktop breadcrumb leaf.
   *  Mobile's leaf is `product.model`. */
  fullName: string;
  specs: readonly ProductSpecRow[];
  /** The vendor's prose about the product, trimmed, or `null` when it has
   *  none (292 products). Shown under the specification table (D135). */
  description: string | null;
  badges: readonly PdpBadge[];
  quantity: QuantityKey;
  /** Present only when all three finder params are in the URL. Never
   *  invented (D47(5) precedent). */
  vehicle: Vehicle | null;
  /** The product's own category route — `/tires`, `/wheels` or
   *  `/accessories` (D58) — carrying every inbound param except `qty`, so the
   *  breadcrumb returns to the search the visitor came from
   *  (`design/manifest.md` §3). */
  backHref: string;
  /**
   * Up to four cards, never another size of this same model and never another
   * category (D52, D58 — a wheel PDP never recommends a tire). Closest first:
   * the catalogue decides what "close" is (`getSimilarProducts`, D107b).
   */
  similar: readonly Product[];
  /**
   * This brand and model in its other sizes, nearest this one first
   * (`getOtherSizes`, D107b). Empty for a product with no model, and for a
   * model sold in one size; the row is then not rendered.
   */
  otherSizes: readonly Product[];
}
