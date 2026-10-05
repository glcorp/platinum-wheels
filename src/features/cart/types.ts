/**
 * The cart's quote request: the contract between the form island
 * (`components/quote-form.tsx`) and its Server Action (`actions.ts`), written
 * before either, as D25 asks. It is the D51 product-page form, moved here by
 * D122 when the request moved from the product page to the cart: the contact
 * fields, protection and states are unchanged, the quantity fields are gone
 * (the cart holds every quantity) and one hidden field carries the cart.
 */

import type { CartItem } from "@/lib/cart";

export type QuoteField = "name" | "email" | "phone" | "contact" | "message" | "consent";

/** Field `name` attributes. Also the keys of `errors` and `values`. */
export const QUOTE_FIELD = {
  name: "name",
  email: "email",
  phone: "phone",
  contact: "contact",
  message: "message",
  consent: "consent",
  /** Hidden: the cart's lines as JSON, `[{ slug, quantity, vehicle }]`. The
   *  action trusts none of it beyond its shape and re-reads every product. */
  lines: "lines",
  /** Hidden: how long the form has been open, in ms, measured by the browser
   *  from the dialog's FIRST opening. A submit sooner than `QUOTE_MIN_FILL_MS`
   *  is treated as a bot (D104). A duration, not a timestamp: a phone whose
   *  clock is off would otherwise read as a bot, and closing and reopening
   *  the dialog must not restart the count (D123(7)). */
  elapsed: "elapsed",
  /** Honeypot (D104). Off-screen and out of the tab order; a person never
   *  fills it, a form-filling bot usually does. */
  website: "website",
} as const;

/** The timer half of the form protection (owner ruling 2026-09-23, D104). */
export const QUOTE_MIN_FILL_MS = 3_000;

/** The segmented control, artboard-verbatim and in drawn order
 *  (`product-desktop.html:147`). `Phone` is drawn selected. */
export type ContactMethod = "phone" | "email" | "whatsapp";

export const CONTACT_METHODS: ReadonlyArray<{ value: ContactMethod; label: string }> = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

export const DEFAULT_CONTACT_METHOD: ContactMethod = "phone";

/**
 * What the Server Action returns. `idle` is the initial state; `invalid`
 * re-renders the form with per-field messages and the typed values; `failed`
 * (D104) means the request was valid but the owner alert could not be sent;
 * `success` hands back to the cart page, which empties the cart and shows the
 * confirmation.
 */
export interface QuoteFormState {
  status: "idle" | "invalid" | "failed" | "success";
  errors?: Partial<Record<QuoteField, string>>;
  /** Echoed back on `invalid` and `failed`. Never echoed on `success`. */
  values?: Partial<Record<QuoteField, string>>;
  /** A whole-form line with no field behind it: the send never reached the
   *  server (set by the form island, D93b ENV-1), the cart arrived empty, or
   *  the visitor's IP is over the request cap (LA-03, `actions.ts`). Always
   *  with `status: "invalid"`, empty `errors` and every value echoed. */
  notice?: string;
}

export const QUOTE_INITIAL_STATE: QuoteFormState = { status: "idle" };

/** One line as the form posts it. */
export interface PostedLine {
  slug: string;
  quantity: number;
  vehicle: string;
  /** Only a fallback for the consent wording when the catalogue cannot
   *  name the product (`actions.ts`). */
  category: CartItem["category"];
}

/**
 * The quote form's per-category copy (D59(7)), handed from the server page to
 * the client island so the category table stays out of the client bundle. A
 * cart of one category uses that category's words; a mixed cart uses `mixed`.
 */
export interface QuoteCopy {
  placeholder: string;
  consent: string;
}

export type QuoteCopyByCategory = Record<CartItem["category"] | "mixed", QuoteCopy>;

/** One category: its own words. None or several: the mixed words. Pure, so
 *  the client island and the Server Action pick the same way. */
export function pickQuoteCopy(
  copy: QuoteCopyByCategory,
  categories: Iterable<CartItem["category"]>,
): QuoteCopy {
  const distinct = new Set(categories);
  if (distinct.size !== 1) return copy.mixed;
  const [only] = distinct;
  return copy[only];
}
