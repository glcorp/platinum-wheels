"use server";

/* ---------------------------------------------------------------------------
   submitQuote — the quote band's Server Action (D51)

   Signature matches `useActionState(submitQuote, QUOTE_INITIAL_STATE)`
   (`src/features/product/components/quote-form.tsx`): `(prevState, formData)
   => Promise<QuoteFormState>`. `QuoteFormState` / `QUOTE_FIELD` /
   `CONTACT_METHODS` / `QUANTITY_OPTIONS` are the contract
   (`src/features/product/types.ts`), written before this file (D25) — nothing
   here invents a field name or an allowed value.

   Order (D104): the spam checks (honeypot, then the fill timer) come first
   and answer a bot with a normal `success` so it learns nothing; then field
   validation; then delivery by email (`quote-email.ts`), which sends only
   when `AUTO_EMAIL_LEAD_CAPTURE_ENABLED=true`. With the flag off the action
   validates, logs and returns `success`, which is how the live form is
   tested. Nothing is written to disk or a database.

   Error copy is new copy, authored under `.claude/rules/ui.md` "Copy": short,
   specific, sentence case, no em dashes, tells the person what to do.
   --------------------------------------------------------------------------- */

import { headers } from "next/headers";

import { categoryConfig } from "@/features/catalog/categories";
import { toProduct } from "@/features/catalog/adapter";
import { getProductBySlug } from "@/features/catalog/queries";
import { productCategory, type Product } from "@/features/catalog/types";
import { deliverQuote } from "@/features/product/quote-email";
import {
  CONTACT_METHODS,
  CUSTOM_QUANTITY_MAX,
  CUSTOM_QUANTITY_MIN,
  DEFAULT_CONTACT_METHOD,
  DEFAULT_QUANTITY_BY_CATEGORY,
  QUANTITY_OPTIONS,
  QUOTE_FIELD,
  QUOTE_MIN_FILL_MS,
  quantityQuoteLabel,
  type ContactMethod,
  type QuantityKey,
  type QuoteFormState,
} from "@/features/product/types";

/** Plain, honest email shape check — not a heroic regex. One `@`, something on
 *  each side, a dot somewhere after the `@`. Rejects obvious typos without
 *  pretending to validate deliverability. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Keeps a visitor from pasting a wall of text into a field the quote email
 *  will eventually be someone's inbox. No artboard draws a limit, so this is
 *  a generous ceiling, not a design value. */
const MESSAGE_MAX_LENGTH = 1000;

const QUANTITY_VALUES = new Set<string>(QUANTITY_OPTIONS.map((option) => option.value));
const CONTACT_VALUES = new Set<string>(CONTACT_METHODS.map((method) => method.value));

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The product an enquiry is about, for its category defaults and its name in
 * the emails. `null` for a stale or tampered slug, and ALSO when the catalogue
 * cannot be read: an enquiry is the one thing this site exists to capture, so
 * a database outage must cost the email a product name, never the lead. The
 * emails still carry the slug and the page URL.
 */
async function quotedProduct(slug: string): Promise<Product | null> {
  try {
    const found = await getProductBySlug(slug);
    return found ? toProduct(found) : null;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "quote.product_lookup_failed",
        slug,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  }
}

/** Strips everything but digits, then checks for a 10-digit NANP number or an
 *  11-digit one carrying the leading `1` country code — covers every common
 *  Canadian formatting style ("905 000 0000", "(905) 000-0000",
 *  "+1 905 000 0000", "1-905-000-0000") without a format-specific regex. */
function isPlausiblePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return true;
  if (digits.length === 11) return digits.startsWith("1");
  return false;
}

export async function submitQuote(
  _prevState: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const name = readString(formData, QUOTE_FIELD.name);
  const email = readString(formData, QUOTE_FIELD.email);
  const phone = readString(formData, QUOTE_FIELD.phone);
  const message = readString(formData, QUOTE_FIELD.message);
  const rawQuantity = readString(formData, QUOTE_FIELD.quantity);
  const customQuantity = readString(formData, QUOTE_FIELD.customQuantity);
  const rawContact = readString(formData, QUOTE_FIELD.contact);
  const slug = readString(formData, QUOTE_FIELD.slug);

  // Form protection, owner ruling 2026-09-23 (D104). A person never fills the
  // off-screen honeypot and never submits within 3 s of the page rendering.
  // A missing or unparsable timestamp means the field was stripped, which a
  // real browser never does. Either way: pretend it worked, send nothing.
  if (readString(formData, QUOTE_FIELD.website) !== "") {
    logSpam("honeypot", slug);
    return { status: "success" };
  }
  const renderedAt = Number(readString(formData, QUOTE_FIELD.renderedAt));
  if (!Number.isFinite(renderedAt) || renderedAt <= 0 || Date.now() - renderedAt < QUOTE_MIN_FILL_MS) {
    logSpam("too_fast", slug);
    return { status: "success" };
  }

  // The unknown-value fallback below is category-aware: which cell is
  // "the" default differs by category (D65 — accessories open on `1`, tires
  // and wheels on `4`), so falling back to the flat `4` for every category
  // silently re-broke that for a tampered accessory submission. `slug` is
  // already a hidden field on every inquiry; a missing/stale one reads as
  // `tires`, `productCategory()`'s own default (D58).
  const product = await quotedProduct(slug);
  const category = product ? productCategory(product) : "tires";

  // Quantity and Preferred contact are never wrong, only unset or tampered
  // with — an unknown value falls back to the product's own default rather
  // than failing the whole submission over an optional-group control.
  const quantity: QuantityKey = QUANTITY_VALUES.has(rawQuantity)
    ? (rawQuantity as QuantityKey)
    : DEFAULT_QUANTITY_BY_CATEGORY[category];
  const contact: ContactMethod = CONTACT_VALUES.has(rawContact)
    ? (rawContact as ContactMethod)
    : DEFAULT_CONTACT_METHOD;

  const errors: Partial<
    Record<"name" | "email" | "phone" | "customQuantity" | "message", string>
  > = {};

  if (name === "") {
    errors.name = "Enter your name.";
  }

  if (email === "") {
    errors.email = "Enter your email address.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (phone === "") {
    errors.phone = "Enter your phone number.";
  } else if (!isPlausiblePhone(phone)) {
    errors.phone = "Enter a 10-digit Canadian phone number.";
  }

  if (message.length > MESSAGE_MAX_LENGTH) {
    errors.message = `Keep your message under ${MESSAGE_MAX_LENGTH} characters.`;
  }

  // `Custom` quantity (D50 Open #6): optional group, so a blank value stays
  // legal regardless of which cell is selected — the drawn `Optional`
  // eyebrow governs. Only a non-blank value is held to the bound, and only
  // this server check enforces it: the form is `noValidate` (D65), so the
  // Input's `min`/`max` are affordance, not validation.
  if (customQuantity !== "") {
    const parsed = Number(customQuantity);
    const inBounds =
      Number.isInteger(parsed) &&
      parsed >= CUSTOM_QUANTITY_MIN &&
      parsed <= CUSTOM_QUANTITY_MAX;
    if (!inBounds) {
      errors.customQuantity = `Enter a number between ${CUSTOM_QUANTITY_MIN} and ${CUSTOM_QUANTITY_MAX}.`;
    }
  }

  // CASL consent is opt-in (docs/decisions.md:118): the box is read only to
  // write the consent record into the owner alert (D104), never to gate
  // success. An unticked box is never an error and its state is never echoed
  // back on `invalid` or `failed` — `Checkbox variant="consent"` must always render unticked
  // (`src/components/ui/checkbox.tsx`), so there is nothing to restore.

  if (Object.keys(errors).length > 0) {
    return {
      status: "invalid",
      errors,
      values: {
        name,
        email,
        phone,
        message,
        quantity,
        customQuantity,
        contact,
      },
    };
  }

  // Delivery (D104). The emails carry a product name, never a price: since
  // D77 `formatPrice()` returns a bare `$129`, which is wrong in an email with
  // no footer to state the currency. If a price is ever added, spell it
  // `$129 CAD` explicitly (`docs/decisions.md` §7).
  const config = categoryConfig(category);
  const quantityLabel =
    quantity === "custom"
      ? customQuantity !== ""
        ? `Custom: ${customQuantity} ${config.unit.many}`
        : "Custom (no number given)"
      : quantityQuoteLabel(quantity, config.unit);

  const outcome = await deliverQuote({
    slug,
    productName: product ? `${product.brand} ${product.model}, ${product.size}` : null,
    pageUrl: await pageUrl(slug),
    quantity: quantityLabel,
    contact: CONTACT_METHODS.find((method) => method.value === contact)?.label ?? contact,
    vehicle: readString(formData, QUOTE_FIELD.vehicle).slice(0, 80),
    name,
    email,
    phone,
    message,
    consent: formData.get(QUOTE_FIELD.consent) !== null,
    consentWording: config.copy.quoteConsent,
    submittedAt: new Date(),
  });

  if (outcome.status === "failed") {
    return {
      status: "failed",
      values: { name, email, phone, message, quantity, customQuantity, contact },
    };
  }

  return { status: "success" };
}

/** The page the inquiry came from, for the consent record. Built from the
 *  request host so a preview deployment reports its own URL. */
async function pageUrl(slug: string): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "platinumwheels.ca";
  return `https://${host}/products/${encodeURIComponent(slug)}`;
}

function logSpam(reason: "honeypot" | "too_fast", slug: string): void {
  console.warn(JSON.stringify({ event: `quote.spam.${reason}`, slug }));
}
