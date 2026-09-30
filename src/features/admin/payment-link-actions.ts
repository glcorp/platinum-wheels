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
   session (D92): an amount, a description and, since D103, an expiry. No line
   items, no fees, no tax.

   Money is the one thing this file has to get exactly right. The amount is
   validated as TEXT, never as a parsed float — floats lose or invent cents —
   and it is normalised to a canonical two-decimal string exactly once. That
   string is carried forward unparsed from that point on.

   Since D99-D105 the link is real: a `payment_links` row, and a URL on our
   own payment page (`/pay/<token>`), created through
   `src/features/payments/service.ts`. Admin imports that feature's service,
   money and config modules and nothing else (D106); it never imports or names
   the gateway, and nothing here can move money out.

   Error copy is new copy, authored under `.claude/rules/ui.md` "Copy": short,
   specific, sentence case, no em dashes, tells the person what to do.
   --------------------------------------------------------------------------- */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { requireAdminAction } from "@/features/admin/session";
import {
  ADMIN_ROUTES,
  AMOUNT_MAX,
  DESCRIPTION_MAX_LENGTH,
  PAYMENT_LINK_EXPIRY,
  PAYMENT_LINK_FIELD,
  PAYMENT_LINK_ID_FIELD,
  type LinkActionState,
  type PaymentLinkFieldKey,
  type PaymentLinkState,
} from "@/features/admin/types";
import { payLinkUrl, publicPayOrigin } from "@/features/payments/config";
import { parseAmountToCents } from "@/features/payments/money";
import { cancelLink, createLink } from "@/features/payments/service";

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

/** The one shared credential (D91, D95): every row says who, as far as the
 *  gate can tell. Replaced when per-user accounts exist. */
const ACTOR = "admin";

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shop time zone for every date staff read. */
const EXPIRY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

/** Origin of the request the owner is using, e.g. a preview's own host, so a
 *  preview mints links that open on that preview. Production ignores it and
 *  uses the pay host (`publicPayOrigin`). */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
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
  const rawExpiry = readString(formData, PAYMENT_LINK_FIELD.expiry);
  const idempotencyKey = readString(formData, PAYMENT_LINK_FIELD.idempotencyKey);
  const values = { amount: rawAmount, description: rawDescription, expiry: rawExpiry };

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

  const expiry = PAYMENT_LINK_EXPIRY.find((option) => option.value === rawExpiry);
  if (!expiry) {
    errors.expiry = "Choose how long the link stays open.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "invalid",
      errors,
      // Echoes exactly what was typed, not the normalised form — a rejected
      // submit must not silently rewrite what the owner entered.
      values,
    };
  }

  // Every field passed, so `normalizedAmount` is set — TypeScript can't see
  // that from the branching above, so this satisfies strict mode without a
  // non-null assertion.
  const amountCents = normalizedAmount ? parseAmountToCents(normalizedAmount) : null;
  if (!normalizedAmount || amountCents === null || !expiry) {
    return { status: "invalid", errors: { amount: "Enter an amount." }, values };
  }

  // The page mints this per render; a missing or malformed one means the
  // form did not come from the page, and the gate above already rejects that.
  if (!UUID_SHAPE.test(idempotencyKey)) {
    return { status: "unavailable", values };
  }

  let link;
  try {
    link = await createLink({
      amountCents,
      description: rawDescription,
      expiresAt: new Date(Date.now() + expiry.hours * 60 * 60 * 1000),
      idempotencyKey,
      createdBy: ACTOR,
    });
  } catch (error) {
    console.error(
      JSON.stringify({ at: "admin.createPaymentLink", detail: error instanceof Error ? error.message : "unknown" }),
    );
    return { status: "unavailable", values };
  }

  revalidatePath(ADMIN_ROUTES.home);
  return {
    status: "success",
    url: payLinkUrl(publicPayOrigin(await requestOrigin()), link.publicToken),
    reference: link.reference,
    amount: normalizedAmount,
    description: link.description,
    expiresLabel: EXPIRY_FORMAT.format(link.expiresAt),
    testMode: process.env.CONVERGE_ENV !== "production",
  };
}

/* ===========================================================================
   Links list — Cancel
   =========================================================================== */

function readLinkId(formData: FormData): string | null {
  const id = readString(formData, PAYMENT_LINK_ID_FIELD);
  return UUID_SHAPE.test(id) ? id : null;
}

/** Withdraw an unpaid link. Money already taken is never touched here:
 *  refunds happen in the gateway's own portal (`docs/payments.md` §5.7). */
export async function cancelPaymentLink(_prev: LinkActionState, formData: FormData): Promise<LinkActionState> {
  await requireAdminAction(formData);
  const id = readLinkId(formData);
  if (!id) return { status: "error", message: "That link could not be found." };

  const result = await cancelLink(id, ACTOR);
  revalidatePath(ADMIN_ROUTES.home);
  if (result.ok) return { status: "done", message: "Link cancelled. The customer can no longer pay it." };
  return {
    status: "error",
    message: result.state === "paid" ? "This link is already paid, so it can't be cancelled." : "This link is already closed.",
  };
}
