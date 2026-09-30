"use server";

/* ---------------------------------------------------------------------------
   createPaymentLink — the payment-link builder's Server Action.

   Signature matches `useActionState(createPaymentLink, PAYMENT_LINK_INITIAL_STATE)`
   (`src/features/admin/components/payment-link-form.tsx`): `(prevState,
   formData) => Promise<PaymentLinkState>`. `PaymentLinkState` / `PAYMENT_LINK_FIELD`
   / `AMOUNT_MAX` / `DESCRIPTION_MAX_LENGTH` are the contract
   (`src/features/admin/types.ts`), written before this file (D25) — nothing
   here invents a field name, a limit or an allowed value.

   NO ARTBOARD DRAWS ANY OF THIS. The `design/` export covers three storefront
   routes only, so the admin has no authority-level-2 source (D89). This action
   exists purely because the owner ruled out a computed-total system this
   session (D92): two fields, no line items, no fees, no tax, provider-agnostic.

   Money is the one thing this file has to get exactly right. The amount is
   validated as TEXT, never as a parsed float — floats lose or invent cents —
   and it is normalised to a canonical two-decimal string exactly once. That
   string is carried forward unparsed from that point on.

   TODO(psp): no payment service provider is chosen yet (project skill "Open
   items" #3). The `url` returned below is a FABRICATED placeholder — it
   resolves to nothing and no request has been made anywhere (D94). When a
   provider is chosen, this is where its create-payment-link API call goes,
   and the returned URL will come from that response instead of `randomBytes`.
   Until then this action must not add a dependency, must not write to disk,
   and must not reach the network. Mirrors the `TODO(delivery)` in
   `src/features/product/actions.ts` — same shape of "validated, nothing sent
   yet" gap, same reason: nobody has told us where this goes.

   Error copy is new copy, authored under `.claude/rules/ui.md` "Copy": short,
   specific, sentence case, no em dashes, tells the person what to do.
   --------------------------------------------------------------------------- */

import { randomBytes } from "node:crypto";

import { requireAdminAction } from "@/features/admin/session";
import {
  AMOUNT_MAX,
  DESCRIPTION_MAX_LENGTH,
  PAYMENT_LINK_FIELD,
  type PaymentLinkFieldKey,
  type PaymentLinkState,
} from "@/features/admin/types";

/**
 * Shape of a valid amount once `$`, spaces and thousands commas are stripped:
 * at most 7 integer digits, at most 2 decimal places. `AMOUNT_MAX` (50,000)
 * already caps anything that could reach 7 digits — the digit cap exists so
 * the regex names its own ceiling rather than relying on a second check to
 * catch a runaway string.
 */
const AMOUNT_SHAPE = /^\d{1,7}(\.\d{1,2})?$/;

/** Loose numeric shape, used only to tell "not a number at all" apart from
 *  "a number with the wrong number of decimal places" so the error message
 *  can be specific. */
const AMOUNT_LOOSE_NUMERIC = /^\d+(\.\d+)?$/;

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

/** Strips a leading `$`, thousands commas and any internal spaces so
 *  "$1,234.50", "1234.50" and "1 234.50" all validate the same way. Does not
 *  touch anything else — a stray letter still fails `AMOUNT_LOOSE_NUMERIC`. */
function cleanAmountInput(raw: string): string {
  return raw.replace(/\$/g, "").replace(/,/g, "").replace(/\s/g, "");
}

/**
 * Generates a placeholder payment-link id. `randomBytes` is Node's own
 * `node:crypto` — no dependency added. Shaped like a real gateway's link id
 * (short, lowercase alphanumeric) so it reads as realistic in a demo, per D94.
 */
function generatePlaceholderLinkId(): string {
  return randomBytes(6).toString("hex");
}

export async function createPaymentLink(
  _prevState: PaymentLinkState,
  formData: FormData,
): Promise<PaymentLinkState> {
  // Session, same-origin and CSRF token, before anything else (D95). A Server
  // Action is a public POST endpoint: the gated page does not protect it.
  await requireAdminAction(formData);

  const rawAmount = readString(formData, PAYMENT_LINK_FIELD.amount);
  const rawDescription = readString(formData, PAYMENT_LINK_FIELD.description);

  const errors: Partial<Record<PaymentLinkFieldKey, string>> = {};

  // Carries the canonical two-decimal string once validation passes. Set at
  // most once, never re-parsed afterwards.
  let normalizedAmount: string | undefined;

  if (rawAmount === "") {
    errors.amount = "Enter an amount.";
  } else {
    const cleaned = cleanAmountInput(rawAmount);

    if (!AMOUNT_LOOSE_NUMERIC.test(cleaned)) {
      // Not a number at all — stray letters, symbols, multiple dots.
      errors.amount = "Enter a valid amount, like 452.60.";
    } else {
      const decimalPart = cleaned.split(".")[1];
      if (decimalPart && decimalPart.length > 2) {
        errors.amount = "Use at most two decimal places.";
      } else if (!AMOUNT_SHAPE.test(cleaned)) {
        // Numeric, at most 2 decimals, but more integer digits than the
        // shape allows — already well past AMOUNT_MAX either way.
        errors.amount = `Enter an amount of $${AMOUNT_MAX.toLocaleString("en-CA")} or less.`;
      } else {
        // Single parse of an already-shape-validated string, then a single
        // toFixed(2) to pad "452" -> "452.00" / "452.6" -> "452.60". This is
        // the one and only numeric conversion — the result is never parsed
        // again.
        const numeric = Number(cleaned);
        if (numeric <= 0) {
          errors.amount = "Enter an amount greater than zero.";
        } else if (numeric > AMOUNT_MAX) {
          errors.amount = `Enter an amount of $${AMOUNT_MAX.toLocaleString("en-CA")} or less.`;
        } else {
          normalizedAmount = numeric.toFixed(2);
        }
      }
    }
  }

  if (rawDescription === "") {
    errors.description = "Enter what this payment is for.";
  } else if (rawDescription.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX_LENGTH} characters.`;
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "invalid",
      errors,
      // Echoes exactly what was typed, not the normalised form — a rejected
      // submit must not silently rewrite what the owner entered.
      values: { amount: rawAmount, description: rawDescription },
    };
  }

  // Both fields passed, so `normalizedAmount` is set — TypeScript can't see
  // that from the branching above, so this satisfies strict mode without a
  // non-null assertion.
  if (!normalizedAmount) {
    return {
      status: "invalid",
      errors: { amount: "Enter an amount." },
      values: { amount: rawAmount, description: rawDescription },
    };
  }

  // See the TODO(psp) block at the top of this file: no gateway is wired up,
  // this URL resolves to nothing, and this is the only place a real API call
  // will ever go once a provider is chosen.
  const url = `https://pay.platinumwheels.ca/l/${generatePlaceholderLinkId()}`;

  return {
    status: "success",
    url,
    amount: normalizedAmount,
    description: rawDescription,
  };
}
