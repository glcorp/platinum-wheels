"use server";

/* ---------------------------------------------------------------------------
   The cart's two Server Actions (D122)

   `refreshCart(slugs)` — the catalogue's current facts for the products in a
   visitor's cart, so the cart page replaces the snapshot it saved at the add.
   A read, not a write; it is a Server Action because nothing outside this app
   calls it (D106b: no REST layer).

   `submitCartQuote(prev, formData)` — the quote request. It is D51's
   `submitQuote`, moved from the product page to the cart and widened from one
   product to a cart of them. Same order (D104): the spam checks first (the
   honeypot, then the fill timer) answering a bot with a normal `success`; then
   field validation; then delivery by email (`quote-email.ts`), which sends only
   when `AUTO_EMAIL_LEAD_CAPTURE_ENABLED=true`. Nothing is written to a
   database: the owner alert is the record (D104).

   The cart arrives as one hidden JSON field. Nothing in it is trusted beyond
   its shape: every product is read again here, a slug the catalogue no longer
   has still reaches the shop by its slug (a lost product name never costs the
   lead), and the two ceilings below stop a tampered request, never a person
   (owner, "lets not put restrictions of cart"; `src/lib/cart.ts`).

   Error copy is new copy, authored under `.claude/rules/ui.md` "Copy": short,
   specific, sentence case, no em dashes, tells the person what to do.
   --------------------------------------------------------------------------- */

import { headers } from "next/headers";

import { toProduct } from "@/features/catalog/adapter";
import { cartItem } from "@/features/catalog/cart-item";
import { getProductsBySlugs } from "@/features/catalog/queries";
import type { Product } from "@/features/catalog/types";
import { quoteCopyByCategory } from "@/features/cart/copy";
import { deliverQuote, type QuoteLine } from "@/features/cart/quote-email";
import {
  CONTACT_METHODS,
  DEFAULT_CONTACT_METHOD,
  QUOTE_FIELD,
  QUOTE_MIN_FILL_MS,
  pickQuoteCopy,
  type ContactMethod,
  type PostedLine,
  type QuoteFormState,
} from "@/features/cart/types";
import type { CartItem } from "@/lib/cart";
import { productName } from "@/lib/product-name";
import { productRoute } from "@/lib/routes";

/* `src/lib/cart.ts` holds the same two numbers; a `"use server"` file can
   export only async functions, so they are written in both places. */
const MAX_LINES = 200;
const MAX_QUANTITY = 9999;

/** Plain, honest email shape check: one `@`, something on each side, a dot
 *  somewhere after the `@`. Rejects obvious typos without pretending to
 *  validate deliverability. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Length ceilings (D91b WDG-12, owner ruling 2026-09-30). They mirror the
 *  `maxLength` on the matching inputs in `components/quote-form.tsx`. Every
 *  cap counts UTF-16 code units (`String#length`), as the browser does. */
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const PHONE_MAX_LENGTH = 32;
const MESSAGE_MAX_LENGTH = 1000;
const VEHICLE_MAX_LENGTH = 80;

/** Invisible Unicode format characters (`\p{Cf}`). `String#trim` keeps them,
 *  so a name of three U+200B used to look "filled in". */
const INVISIBLE_FORMAT = /\p{Cf}/gu;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CONTACT_VALUES = new Set<string>(CONTACT_METHODS.map((method) => method.value));

/* --- refreshCart ---------------------------------------------------------- */

export type CartRefresh =
  | { ok: true; items: Record<string, CartItem | null> }
  | { ok: false };

/**
 * `items[slug]` is the product's current card facts, or `null` when the
 * catalogue no longer lists it (deleted, or hidden by staff), which the cart
 * page removes with a note. `{ ok: false }` when the catalogue cannot be read:
 * the cart then keeps what it saved rather than emptying itself.
 */
export async function refreshCart(slugs: unknown): Promise<CartRefresh> {
  if (!Array.isArray(slugs)) return { ok: false };
  const wanted = [
    ...new Set(
      slugs.filter(
        (slug): slug is string =>
          typeof slug === "string" && slug.length <= 200 && SLUG.test(slug),
      ),
    ),
  ].slice(0, MAX_LINES);
  if (wanted.length === 0) return { ok: true, items: {} };

  try {
    const found = await getProductsBySlugs(wanted, { includeDiscontinued: true });
    const bySlug = new Map(found.map((product) => [product.slug, product]));
    const items: Record<string, CartItem | null> = {};
    for (const slug of wanted) {
      const product = bySlug.get(slug);
      items[slug] = product ? cartItem(toProduct(product)) : null;
    }
    return { ok: true, items };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "cart.refresh_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return { ok: false };
  }
}

/* --- submitCartQuote ------------------------------------------------------- */

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.replace(INVISIBLE_FORMAT, "").trim() : "";
}

/** The message keeps its format characters (a ZWJ holds an emoji together)
 *  and is empty only when nothing visible is left. CRLF becomes LF first, so a
 *  line break counts once against the cap, as the browser counted it. */
function readMessage(formData: FormData, field: string): string {
  const value = formData.get(field);
  if (typeof value !== "string") return "";
  if (value.replace(INVISIBLE_FORMAT, "").trim() === "") return "";
  return value.replace(/\r\n?/g, "\n").trim();
}

/** 10 digits, or 11 with a leading `1`: every common Canadian format. */
function isPlausiblePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return true;
  if (digits.length === 11) return digits.startsWith("1");
  return false;
}

/** The posted cart, reduced to well-formed lines. A malformed line is
 *  dropped, a repeated slug is merged into its first line. */
function readLines(formData: FormData): PostedLine[] {
  const raw = formData.get(QUOTE_FIELD.lines);
  if (typeof raw !== "string" || raw.length > 100_000) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const bySlug = new Map<string, PostedLine>();
  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) continue;
    const { slug, quantity, vehicle, category } = entry as Record<string, unknown>;
    if (typeof slug !== "string" || slug.length > 200 || !SLUG.test(slug)) continue;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) continue;
    const cleanVehicle =
      typeof vehicle === "string"
        ? vehicle.replace(INVISIBLE_FORMAT, "").replace(/\s+/g, " ").trim().slice(0, VEHICLE_MAX_LENGTH)
        : "";
    const existing = bySlug.get(slug);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, MAX_QUANTITY);
      continue;
    }
    if (bySlug.size === MAX_LINES) continue;
    bySlug.set(slug, {
      slug,
      quantity: Math.min(quantity, MAX_QUANTITY),
      vehicle: cleanVehicle,
      category:
        category === "wheels" || category === "accessories" ? category : "tires",
    });
  }
  return [...bySlug.values()];
}

/** The products a request is about, by slug. Empty, never a throw, when the
 *  catalogue cannot be read: a database outage costs the email its product
 *  names, never the lead. */
async function quotedProducts(slugs: string[]): Promise<Map<string, Product>> {
  try {
    const found = await getProductsBySlugs(slugs, { includeDiscontinued: true });
    return new Map(found.map((product) => [product.slug, toProduct(product)]));
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "quote.product_lookup_failed",
        count: slugs.length,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return new Map();
  }
}

/** The site's own origin as the request reached it, so a preview deployment
 *  links its own product pages in the owner alert. */
async function siteOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "platinumwheels.ca";
  return `https://${host}`;
}

function logSpam(reason: "honeypot" | "too_fast"): void {
  console.warn(JSON.stringify({ event: `quote.spam.${reason}` }));
}

export async function submitCartQuote(
  _prevState: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const name = readString(formData, QUOTE_FIELD.name);
  const email = readString(formData, QUOTE_FIELD.email);
  const phone = readString(formData, QUOTE_FIELD.phone);
  const message = readMessage(formData, QUOTE_FIELD.message);
  const rawContact = readString(formData, QUOTE_FIELD.contact);
  // Ticked = the field is present (an unticked checkbox submits nothing).
  const consented = formData.get(QUOTE_FIELD.consent) !== null;

  // Form protection (D104). A person never fills the off-screen honeypot and
  // never sends within 3 s of opening the form. Either way: pretend it worked.
  if (readString(formData, QUOTE_FIELD.website) !== "") {
    logSpam("honeypot");
    return { status: "success" };
  }
  const elapsed = Number(readString(formData, QUOTE_FIELD.elapsed));
  if (!Number.isFinite(elapsed) || elapsed < QUOTE_MIN_FILL_MS) {
    logSpam("too_fast");
    return { status: "success" };
  }

  const contact: ContactMethod = CONTACT_VALUES.has(rawContact)
    ? (rawContact as ContactMethod)
    : DEFAULT_CONTACT_METHOD;

  const errors: Partial<Record<"name" | "email" | "phone" | "message", string>> = {};
  if (name === "" || name.length > NAME_MAX_LENGTH) {
    errors.name = "Enter your name.";
  }
  if (email === "") {
    errors.email = "Enter your email address.";
  } else if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    errors.email = "Enter an email like name@example.com.";
  }
  if (phone === "") {
    errors.phone = "Enter your phone number.";
  } else if (phone.length > PHONE_MAX_LENGTH || !isPlausiblePhone(phone)) {
    errors.phone = "Enter a 10-digit Canadian phone number.";
  }
  if (message.length > MESSAGE_MAX_LENGTH) {
    errors.message = "Keep your message to 1,000 characters or fewer.";
  }

  // The visitor's own tick is echoed on `invalid` and `failed` only, so an
  // unrelated error never silently unticks it (WDG-10).
  const echo = {
    name,
    email,
    phone,
    message,
    contact,
    ...(consented ? { [QUOTE_FIELD.consent]: "on" } : {}),
  };

  const lines = readLines(formData);
  if (lines.length === 0) {
    return {
      status: "invalid",
      errors,
      values: echo,
      notice: "Your cart is empty. Add a product, then send your request.",
    };
  }

  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors, values: echo };
  }

  const products = await quotedProducts(lines.map((line) => line.slug));
  // The consent record names the wording the visitor saw, picked the way the
  // form picked it: from each product's own category as the catalogue holds
  // it. Only a line the catalogue cannot name (deleted, or the database is
  // down) falls back to the category the browser saved for it, so a tire-only
  // cart is never recorded with the mixed wording by accident.
  const consentWording = pickQuoteCopy(
    quoteCopyByCategory(),
    lines.map((line) => {
      const product = products.get(line.slug);
      return product ? cartItem(product).category : line.category;
    }),
  ).consent;
  const origin = await siteOrigin();
  const quoteLines: QuoteLine[] = lines.map((line) => {
    const product = products.get(line.slug);
    const unit = product ? cartItem(product).unit : { one: "1", many: "" };
    return {
      slug: line.slug,
      productName: product
        ? `${productName(product.brand, product.model)}, ${product.size}`
        : null,
      quantity:
        line.quantity === 1 ? unit.one : `${line.quantity} ${unit.many}`.trim(),
      available: product ? product.available : true,
      vehicle: line.vehicle,
      pageUrl: `${origin}${productRoute(line.slug)}`,
    };
  });

  const outcome = await deliverQuote({
    lines: quoteLines,
    cartUrl: `${origin}/cart`,
    contact: CONTACT_METHODS.find((method) => method.value === contact)?.label ?? contact,
    name,
    email,
    phone,
    message,
    consent: consented,
    consentWording,
    submittedAt: new Date(),
  });

  if (outcome.status === "failed") {
    return { status: "failed", values: echo };
  }
  return { status: "success" };
}
