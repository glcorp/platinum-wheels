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
import { findProduct } from "@/features/catalog/data";
import { productCategory } from "@/features/catalog/types";
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

/** Length ceilings (D91b WDG-12, owner ruling 2026-09-30). Keep a visitor from
 *  pasting a wall of text into a field a quote email will eventually put in
 *  someone's inbox. No artboard draws a limit, so these are generous ceilings,
 *  not design values. They mirror the `maxLength` on the matching inputs in
 *  `quote-form.tsx` (a `"use server"` file can only export async functions, so
 *  the numbers cannot be shared; `tests/e2e/product.spec.ts` pins both sides).
 *  Email 254 is the RFC 5321 path maximum.
 *
 *  Every cap counts UTF-16 code units (`String#length`), which is exactly what
 *  the browser's `maxLength` counts, so the two agree on the same input. An
 *  over-cap value reuses that field's existing error message: no new copy. */
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const PHONE_MAX_LENGTH = 32;
const MESSAGE_MAX_LENGTH = 1000;

/** Invisible Unicode format characters (`\p{Cf}`): zero-width space/joiner,
 *  BOM, bidi controls, soft hyphen. `String#trim` does not remove them, so a
 *  name of three U+200B looked "filled in" and passed the required check. */
const INVISIBLE_FORMAT = /\p{Cf}/gu;

/** One or two decimal digits — `CUSTOM_QUANTITY_MAX` is 99 (D75). */
const CUSTOM_QUANTITY_PATTERN = /^\d{1,2}$/;

const QUANTITY_VALUES = new Set<string>(QUANTITY_OPTIONS.map((option) => option.value));
const CONTACT_VALUES = new Set<string>(CONTACT_METHODS.map((method) => method.value));

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.replace(INVISIBLE_FORMAT, "").trim() : "";
}

/** The message keeps its format characters (a ZWJ holds an emoji sequence
 *  together, a ZWNJ is part of some scripts' spelling) and is treated as empty
 *  only when nothing visible is left. Newlines are normalised to LF first: a
 *  submitted textarea can arrive as CRLF, which would count every line break
 *  twice against a cap the browser counted once. */
function readMessage(formData: FormData, field: string): string {
  const value = formData.get(field);
  if (typeof value !== "string") return "";
  if (value.replace(INVISIBLE_FORMAT, "").trim() === "") return "";
  return value.replace(/\r\n?/g, "\n").trim();
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
  const message = readMessage(formData, QUOTE_FIELD.message);
  const rawQuantity = readString(formData, QUOTE_FIELD.quantity);
  const customQuantity = readString(formData, QUOTE_FIELD.customQuantity);
  const rawContact = readString(formData, QUOTE_FIELD.contact);
  const slug = readString(formData, QUOTE_FIELD.slug);
  // Ticked = the field is present (a native checkbox submits nothing when
  // unticked). Only ever echoed back on `invalid`, below.
  const consented = formData.get(QUOTE_FIELD.consent) !== null;

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
  const product = findProduct(slug);
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

  // `Custom` quantity (D50 Open #6): optional group, so a blank value stays
  // legal regardless of which cell is selected — the drawn `Optional`
  // eyebrow governs. Only a non-blank value is held to the bound, and only
  // this server check enforces it: the form is `noValidate` (D65), so the
  // Input's `min`/`max` are affordance, not validation.
  //
  // Decimal digits only, then the bound (D91b, WDG-11/HPD-3). `Number()` alone
  // accepted `1e1`, `0x10`, `+5` and `5.0`, and the raw string is what a
  // future delivery payload would carry. The field is `type="text"` now, so a
  // non-numeric entry arrives here as typed and meets the same D75 message.
  if (customQuantity !== "") {
    const parsed = Number(customQuantity);
    const inBounds =
      CUSTOM_QUANTITY_PATTERN.test(customQuantity) &&
      parsed >= CUSTOM_QUANTITY_MIN &&
      parsed <= CUSTOM_QUANTITY_MAX;
    if (!inBounds) {
      errors.customQuantity = `Enter a number between ${CUSTOM_QUANTITY_MIN} and ${CUSTOM_QUANTITY_MAX}.`;
    }
  }

  // CASL consent is opt-in (docs/decisions.md:118): the box is read only to
  // write the consent record into the owner alert (D104), never to gate
  // success. An unticked box is never an error.
  //
  // WDG-10 (owner ruling 2026-09-30): React resets an uncontrolled form after
  // an action, so a visitor who ticked the box and then hit an unrelated error
  // found it silently unticked. On `invalid` ONLY, their own tick is echoed
  // back (below) and `quote-form.tsx` renders it through `Checkbox`'s
  // `restoreChecked`. It is echoed on `failed` too (the visitor retries without
  // retyping), never when unticked, never on `success`, and a fresh form still renders unticked.

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
        ...(consented ? { [QUOTE_FIELD.consent]: "on" } : {}),
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
      values: {
        name,
        email,
        phone,
        message,
        quantity,
        customQuantity,
        contact,
        ...(consented ? { [QUOTE_FIELD.consent]: "on" } : {}),
      },
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
