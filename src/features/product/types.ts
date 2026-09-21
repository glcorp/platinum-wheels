/**
 * PDP contract — written by the coordinator before any component so the three
 * build agents code against one shape (D25, the pattern that worked at
 * `page results`: `src/features/results/types.ts`).
 *
 * Two halves, same as `/results`:
 *   `view.ts`  — pure derivation from a `Product` + the raw query (no I/O).
 *   `actions.ts` — the quote-form Server Action (D51).
 *
 * The buy-panel quantity is a URL param (D50), so the page is fully server
 * rendered at every state and a reload keeps the selection. Everything the
 * spec table shows is derived from `Product` (D53), so the PDP adds no seed
 * data beyond the one `studdable` flag.
 */

import type { CategoryConfig } from "@/features/catalog/categories";
import type { Product, ProductCategory } from "@/features/catalog/types";

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

/**
 * How the quote form's Quantity select spells one cell. The artboard shows
 * `4 tires` (`product-desktop.html:146`) — that string is reproduced exactly
 * for a tire; the singular, the other counts and the two new categories are
 * new copy under `.claude/rules/ui.md` "Copy".
 *
 * Takes the unit pair rather than the category so the copy lives once, in
 * `CategoryConfig.unit` (`@/features/catalog/categories`), beside the card and
 * PDP price suffixes it has to agree with.
 */
export function quantityQuoteLabel(
  value: QuantityKey,
  unit: { one: string; many: string },
): string {
  if (value === "custom") return "Another quantity";
  if (value === "1") return unit.one;
  return `${value} ${unit.many}`;
}

/** `4` is the cell the artboards draw selected (`product-desktop.html:114`).
 *  It is the default because the artboard chose it, not because a set of four
 *  is assumed — `Custom` is one click away and the quote form is free text. */
export const DEFAULT_QUANTITY: QuantityKey = "4";

/** Per-category default for the `How many?` cells.
 *
 *  Only the tire PDP is drawn, so `4` is artboard fidelity there and nowhere
 *  else — on `/wheels` it is also right (a set of four), but on an accessory it
 *  was an unexamined carry-over: the Acorn Lug Nuts PDP opens on `4` for a
 *  product whose own size line reads `Set of 20`, so the pre-filled quote asked
 *  for eighty lug nuts. Accessories are sold by the item or the set and have no
 *  natural multiple, so they open on `1`.
 *
 *  D63 ruled the *labels* stay as drawn on accessories; the selected default
 *  was not part of that ruling. Craft audit P1. */
export const DEFAULT_QUANTITY_BY_CATEGORY: Record<
  ProductCategory,
  QuantityKey
> = {
  tires: DEFAULT_QUANTITY,
  wheels: DEFAULT_QUANTITY,
  accessories: "1",
};

/** Bounds for the free-text field the quote form renders when the buy
 *  panel's `Custom` cell is selected (D50, product `llm.md` Open #6). The
 *  form is `noValidate` (D65) — `actions.ts` is the enforcement; the
 *  `Input`'s `min`/`max` are affordance only. */
export const CUSTOM_QUANTITY_MIN = 1;
export const CUSTOM_QUANTITY_MAX = 99;

/** Query-string params this route reads. `qty` is its own (D50); the vehicle
 *  trio arrives from `/results` and is passed straight through to the
 *  breadcrumb's back-link and the quote chip. */
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

/* --- Badges -------------------------------------------------------------- */

/**
 * The buy panel's badge row draws three (`design/inventory/product.md` §3.1):
 * `Winter` filled, `3PMSF` outline (with a 14px mark on desktop, plain on
 * mobile), `M+S` outline. Only the first two are facts `Product` carries; the
 * `M+S` marking is derived from the winter badge and is **sample** until real
 * catalogue data arrives (D48 precedent). Never more than these three.
 */
export interface PdpBadge {
  label: string;
  variant: "winter" | "outline";
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
  /** `Zeta Antarctica Sport` — brand + model, the desktop breadcrumb leaf and
   *  the first half of the quote chip. Mobile's leaf is `product.model`. */
  fullName: string;
  specs: readonly ProductSpecRow[];
  badges: readonly PdpBadge[];
  quantity: QuantityKey;
  /** Present only when all three finder params are in the URL; drives the
   *  quote chip's second half and the quote paragraph's vehicle clause. Absent
   *  → both genericise, they never invent a vehicle (D47(5) precedent). */
  vehicle: Vehicle | null;
  /** The product's own category route — `/results`, `/wheels` or
   *  `/accessories` (D58) — carrying every inbound param except `qty`, so the
   *  breadcrumb returns to the search the visitor came from
   *  (`design/manifest.md` §3). */
  backHref: string;
  /** `Zeta Antarctica Sport 215/55R16 · 2021 Honda Civic`, or just the first
   *  half when no vehicle is in the URL. The quote band's chip value. */
  inquiryContext: string;
  /**
   * Four cards: same category always, then same chip value (season / finish /
   * type) first, current slug excluded, capped at 4 (D52, extended by D58 —
   * a wheel PDP never recommends a tire).
   */
  similar: readonly Product[];
}

/* --- Quote form (D51) ---------------------------------------------------- */

export type QuoteField =
  | "name"
  | "email"
  | "phone"
  | "quantity"
  | "customQuantity"
  | "contact"
  | "message"
  | "consent";

/** Field `name` attributes. Also the keys of `errors` and `values`. */
export const QUOTE_FIELD = {
  name: "name",
  email: "email",
  phone: "phone",
  quantity: "quantity",
  /** Free-text count, rendered only while `quantity === "custom"`
   *  (D50 Open #6, `quote-form.tsx`). Optional — blank stays legal. */
  customQuantity: "customQuantity",
  contact: "contact",
  message: "message",
  consent: "consent",
  /** Hidden: which product this inquiry is about. */
  slug: "slug",
} as const;

/** The segmented control, artboard-verbatim and in drawn order
 *  (`product-desktop.html:147`). `Phone` is drawn selected; it is the default
 *  because the artboard chose it. */
export type ContactMethod = "phone" | "email" | "whatsapp";

export const CONTACT_METHODS: ReadonlyArray<{
  value: ContactMethod;
  label: string;
}> = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

export const DEFAULT_CONTACT_METHOD: ContactMethod = "phone";

/**
 * What the Server Action returns to `useActionState`. `idle` is the initial
 * state; `invalid` re-renders the form with per-field messages and the values
 * the visitor typed, so nothing is lost; `success` swaps the form for the
 * confirmation panel — a state no artboard draws, so it is authored under
 * `.claude/rules/ui.md` and goes on `/styleguide` (`HANDOFF.md` §6).
 */
export interface QuoteFormState {
  status: "idle" | "invalid" | "success";
  errors?: Partial<Record<QuoteField, string>>;
  /** Echoed back on `invalid` only. Never echoed on `success`. */
  values?: Partial<Record<QuoteField, string>>;
}

export const QUOTE_INITIAL_STATE: QuoteFormState = { status: "idle" };
