/* ---------------------------------------------------------------------------
   The cart (D122) — browser only, no account, nothing on the server.

   Owner, 2026-10-01: the cart "just stays in the Chrome session. Switching
   browsers will get rid of the cart is acceptable", and it is stored "in the
   cookies in local storage of the browser and not at our server level". So
   the whole cart is one `localStorage` entry. It never expires (owner ruling);
   it is emptied when a quote request is sent.

   Each line keeps a snapshot of what the cart page shows (brand, model, size,
   photo, availability, unit words) so the page draws at once, then the page
   asks the catalogue for the current facts and replaces the snapshot
   (`src/features/cart/actions.ts` `refreshCart`). The snapshot is display
   data only: the quote request re-reads every product on the server.

   Lives in `src/lib/` and imports no feature (D37): the header's cart link
   (`src/components/site/`) and three features read it. That is also why the
   category is spelled out here rather than imported from `catalog/`.

   React reads it through `useSyncExternalStore`. The server snapshot is
   `null`, so nothing cart-shaped renders until the browser has hydrated, and
   the server and first client render always agree. Another tab's change
   arrives through the `storage` event. When storage is blocked (a private
   window on some browsers, a cleared or refused site-data permission), the
   cart lives in memory for the life of the page instead of failing.
   --------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";

export type CartCategory = "tires" | "wheels" | "accessories";

/** What a line shows. Refreshed from the catalogue when the cart page opens. */
export interface CartItem {
  brand: string;
  /** Model, or the product name when it has no model (most accessories). */
  model: string;
  /** The card's size line, `215/55R16 · 97T XL`. */
  size: string;
  /** Photo URL, or `null` for the placeholder tile. */
  image: string | null;
  category: CartCategory;
  /** `false` = discontinued: kept in the cart, marked, and still sent. */
  available: boolean;
  /** `{ one: "1 tire", many: "tires" }`, from the category table. */
  unit: { one: string; many: string };
}

export interface CartLine {
  slug: string;
  quantity: number;
  /** `2021 Honda Civic`, the vehicle searched when this line was added, or
   *  `""`. Saved per line (owner ruling): a mixed cart still tells the shop
   *  what each part was for. */
  vehicle: string;
  item: CartItem;
}

/**
 * Not a limit anyone should meet. The owner ruled "lets not put restrictions
 * of cart"; this ceiling exists only so a tampered entry or a bot cannot send
 * a request with a million lines or a twenty-digit quantity. The server action
 * holds the same two numbers (`src/features/cart/actions.ts`).
 */
export const CART_MAX_LINES = 200;
export const CART_MAX_QUANTITY = 9999;

const STORAGE_KEY = "pw-cart";
const VERSION = 1;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CATEGORIES = new Set<string>(["tires", "wheels", "accessories"]);

/* --- Reading and writing ------------------------------------------------- */

/** The parsed cart, kept so `useSyncExternalStore` sees one array per change. */
let cache: CartLine[] | null = null;
/** Where the cart lives when `localStorage` throws. */
let memory: CartLine[] = [];
let storageWorks = true;
const listeners = new Set<() => void>();

function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

/** One stored line, checked field by field. Anything malformed is dropped:
 *  the entry is the visitor's own and may have been edited by hand. */
function parseLine(raw: unknown): CartLine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const line = raw as Record<string, unknown>;
  const item = line.item as Record<string, unknown> | undefined;
  const unit = item?.unit as Record<string, unknown> | undefined;
  if (
    !isText(line.slug, 200) ||
    !SLUG.test(line.slug) ||
    typeof line.quantity !== "number" ||
    !Number.isInteger(line.quantity) ||
    line.quantity < 1 ||
    !isText(line.vehicle, 80) ||
    !item ||
    !isText(item.brand, 200) ||
    !isText(item.model, 300) ||
    !isText(item.size, 300) ||
    !(item.image === null || isText(item.image, 2000)) ||
    !isText(item.category, 20) ||
    !CATEGORIES.has(item.category) ||
    typeof item.available !== "boolean" ||
    !unit ||
    !isText(unit.one, 40) ||
    !isText(unit.many, 40)
  ) {
    return null;
  }
  return {
    slug: line.slug,
    quantity: Math.min(line.quantity, CART_MAX_QUANTITY),
    vehicle: line.vehicle,
    item: {
      brand: item.brand,
      model: item.model,
      size: item.size,
      image: item.image,
      category: item.category as CartCategory,
      available: item.available,
      unit: { one: unit.one, many: unit.many },
    },
  };
}

function parse(text: string | null): CartLine[] {
  if (!text) return [];
  try {
    const data: unknown = JSON.parse(text);
    if (typeof data !== "object" || data === null) return [];
    const { v, lines } = data as { v?: unknown; lines?: unknown };
    if (v !== VERSION || !Array.isArray(lines)) return [];
    const seen = new Set<string>();
    const result: CartLine[] = [];
    for (const raw of lines) {
      const line = parseLine(raw);
      if (!line || seen.has(line.slug)) continue;
      seen.add(line.slug);
      result.push(line);
      if (result.length === CART_MAX_LINES) break;
    }
    return result;
  } catch {
    return [];
  }
}

function load(): CartLine[] {
  if (cache) return cache;
  if (storageWorks) {
    try {
      cache = parse(window.localStorage.getItem(STORAGE_KEY));
      return cache;
    } catch {
      storageWorks = false;
    }
  }
  cache = memory;
  return cache;
}

function save(lines: CartLine[]): void {
  cache = lines;
  memory = lines;
  if (storageWorks) {
    try {
      if (lines.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, lines }));
      }
    } catch {
      // Full or blocked: the cart carries on in memory for this page.
      storageWorks = false;
    }
  }
  for (const listener of listeners) listener();
}

/* --- Subscribing ---------------------------------------------------------- */

function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  cache = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

const serverSnapshot = (): null => null;

/** The cart's lines, or `null` before hydration (server render, first paint). */
export function useCartLines(): CartLine[] | null {
  return useSyncExternalStore<CartLine[] | null>(subscribe, load, serverSnapshot);
}

/** Total units in the cart (four tires count four), or `null` before
 *  hydration. What the header badge shows. */
export function cartUnits(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/* --- "Added" notices ------------------------------------------------------ */

export interface CartAddedNotice {
  /** `Zeta Antarctica Sport` */
  name: string;
  /** What this add put in, `4 tires`. */
  amount: string;
  /** `true` when the product was already in the cart and its quantity grew. */
  updated: boolean;
}

const addedListeners = new Set<(notice: CartAddedNotice) => void>();

/** The header's cart link listens here to show its "View cart" prompt. */
export function onCartAdded(listener: (notice: CartAddedNotice) => void): () => void {
  addedListeners.add(listener);
  return () => {
    addedListeners.delete(listener);
  };
}

/** `1 tire`, `4 tires`, `12 items`. */
export function amountLabel(quantity: number, unit: CartItem["unit"]): string {
  return quantity === 1 ? unit.one : `${quantity} ${unit.many}`;
}

/* --- Changing the cart ---------------------------------------------------- */

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(Math.max(Math.trunc(quantity), 1), CART_MAX_QUANTITY);
}

/**
 * Puts `quantity` of a product in the cart. Already there: the quantity grows
 * by that much (owner ruling, "Increase quantity"), the snapshot is replaced
 * and a newly searched vehicle replaces the old one. Returns whether it was an
 * update (`null` at the line ceiling, when nothing was added), and announces
 * the add to the header.
 */
export function addToCart(input: {
  slug: string;
  quantity: number;
  vehicle: string;
  item: CartItem;
}): { updated: boolean } | null {
  const lines = load();
  const quantity = clampQuantity(input.quantity);
  const existing = lines.find((line) => line.slug === input.slug);
  let next: CartLine[];
  if (existing) {
    next = lines.map((line) =>
      line.slug === input.slug
        ? {
            ...line,
            quantity: clampQuantity(line.quantity + quantity),
            vehicle: input.vehicle.slice(0, 80) || line.vehicle,
            item: input.item,
          }
        : line,
    );
  } else {
    // The invisible ceiling (D123(2)): nothing added, and the caller says
    // nothing either.
    if (lines.length >= CART_MAX_LINES) return null;
    next = [
      ...lines,
      { slug: input.slug, quantity, vehicle: input.vehicle.slice(0, 80), item: input.item },
    ];
  }
  save(next);
  const notice: CartAddedNotice = {
    name: `${input.item.brand} ${input.item.model}`,
    amount: amountLabel(quantity, input.item.unit),
    updated: Boolean(existing),
  };
  for (const listener of addedListeners) listener(notice);
  return { updated: Boolean(existing) };
}

export function setCartQuantity(slug: string, quantity: number): void {
  const lines = load();
  save(
    lines.map((line) =>
      line.slug === slug ? { ...line, quantity: clampQuantity(quantity) } : line,
    ),
  );
}

export function removeFromCart(slug: string): void {
  save(load().filter((line) => line.slug !== slug));
}

export function clearCart(): void {
  save([]);
}

/**
 * Applies the catalogue's current facts. `items[slug]` is the fresh snapshot,
 * or `null` when the product is gone (deleted or hidden), which removes the
 * line. A slug the catalogue was not asked about is left alone, so a line
 * added while the request was in flight survives. Returns how many lines were
 * removed, for the cart page's note.
 */
export function reconcileCart(items: Readonly<Record<string, CartItem | null>>): number {
  const lines = load();
  let removed = 0;
  const next: CartLine[] = [];
  for (const line of lines) {
    if (!(line.slug in items)) {
      next.push(line);
      continue;
    }
    const fresh = items[line.slug];
    if (fresh === null) {
      removed += 1;
      continue;
    }
    next.push({ ...line, item: fresh });
  }
  save(next);
  return removed;
}
