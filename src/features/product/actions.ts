"use server";

/* ---------------------------------------------------------------------------
   submitQuote — the quote band's Server Action (D51)

   Signature matches `useActionState(submitQuote, QUOTE_INITIAL_STATE)`
   (`src/features/product/components/quote-form.tsx`): `(prevState, formData)
   => Promise<QuoteFormState>`. `QuoteFormState` / `QUOTE_FIELD` /
   `CONTACT_METHODS` / `QUANTITY_OPTIONS` are the contract
   (`src/features/product/types.ts`), written before this file (D25) — nothing
   here invents a field name or an allowed value.

   Validation only. **This action sends nothing anywhere** — see the TODO
   below. No dependency is added, nothing is written to disk, nothing is
   called out to the network (root task brief; `src/features/product/llm.md`
   Open #1: "Owner, then client").

   Error copy is new copy, authored under `.claude/rules/ui.md` "Copy": short,
   specific, sentence case, no em dashes, tells the person what to do.
   --------------------------------------------------------------------------- */

import { findProduct } from "@/features/catalog/data";
import { productCategory } from "@/features/catalog/types";
import {
  CONTACT_METHODS,
  CUSTOM_QUANTITY_MAX,
  CUSTOM_QUANTITY_MIN,
  DEFAULT_CONTACT_METHOD,
  DEFAULT_QUANTITY_BY_CATEGORY,
  QUANTITY_OPTIONS,
  QUOTE_FIELD,
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

/** One or two decimal digits — `CUSTOM_QUANTITY_MAX` is 99 (D75). */
const CUSTOM_QUANTITY_PATTERN = /^\d{1,2}$/;

const QUANTITY_VALUES = new Set<string>(QUANTITY_OPTIONS.map((option) => option.value));
const CONTACT_VALUES = new Set<string>(CONTACT_METHODS.map((method) => method.value));

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
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
  // decide what ships in a future delivery payload, never to gate success. An
  // unticked box is never an error and its state is never echoed back on
  // `invalid` — `Checkbox variant="consent"` must always render unticked
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

  // TODO(delivery): this inquiry is validated and discarded. The client has
  // supplied no destination — no inbox, no CRM, no form endpoint — to send it
  // to (src/features/product/llm.md "Open" #1: "Owner, then client"). When one
  // exists, this is where the email/CRM call goes; until then this action
  // must not add a dependency, write to disk, or reach the network.
  //
  // When it is wired: this inquiry carries a `slug`, never a price string, and
  // it must stay that way unless the price is spelled with its currency. Since
  // D77 (2026-09-22) `formatPrice()` returns a bare `$129` — correct on the
  // site, where the footer states the currency once, and wrong in an email,
  // which has no footer. Compose any amount in a message as `$129 CAD`
  // explicitly; do not reuse the presentation helper (`docs/decisions.md` §7).

  return { status: "success" };
}
