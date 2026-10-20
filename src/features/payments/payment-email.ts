/* ---------------------------------------------------------------------------
   Emails to the shop about a payment (D120).

   Plain text to `LEAD_CAPTURE_EMAIL` (`sales@`, which is also the sender, as
   for quote emails, D104). Kinds:
     - `approved`: the link is paid;
     - `duplicate`: money moved on a link that was already paid or cancelled,
       so staff must refund it in the Stripe Dashboard (`docs/payments.md` §4);
     - `refunded`, `dispute_opened`, `dispute_closed`: Stripe told us about a
       refund or a card dispute. **Notify only**: nothing here changes a link
       or moves money (plan v3 §8.2).

   **Not behind a flag** (owner, 2026-10-01): it only ever goes to the shop's
   own inbox, so it cannot mail a stranger. With a sandbox key the subject says
   TEST MODE. The customer's receipt is Stripe's, not ours.

   `approved` and `duplicate` carry who paid (name, email, phone, billing
   postal code) from the Stripe session, so staff can match a payment to a quote
   (plan v3 §8.3). That data lives in this email only: it is not stored and
   never logged. Card data goes no further than brand and last four.

   Sent by whichever path settled the attempt, after the response (the webhook,
   the pay page, or staff); the others see `unchanged` and send nothing, so it
   goes out once. A failed send is logged and never undoes or blocks the payment.
   --------------------------------------------------------------------------- */

import type { PaymentAttempt, PaymentLink } from "@/db/schema";

import { displayCents } from "./money";
import type { Payer } from "./types";

/** The admin's links list. Repeated, not imported: `admin/` may import
 *  `payments/`, never the reverse (D106). `ADMIN_HOST` in
 *  `src/features/admin/host-routing.ts` and `ADMIN_ROUTES.paymentLinks` in
 *  `src/features/admin/types.ts` (the admin root is its home page, D118). */
const ADMIN_URL = "https://admin.platinumwheels.ca/payment-links";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 10_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TIME_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  dateStyle: "medium",
  timeStyle: "short",
});

export type StripeNotice =
  | { kind: "refunded"; full: boolean; refundedCents: number }
  | { kind: "dispute_opened"; amountCents: number; reason: string; dueBy: Date | null }
  | { kind: "dispute_closed"; amountCents: number; status: string };

const DASHBOARD_PAYMENTS = "https://dashboard.stripe.com/payments";

function payerLines(payer: Payer | null): string[] {
  if (!payer) return [];
  const lines = [
    payer.name ? `Paid by: ${payer.name}` : null,
    payer.email ? `Email: ${payer.email}` : null,
    payer.phone ? `Phone: ${payer.phone}` : null,
    payer.postalCode ? `Billing postal code: ${payer.postalCode}` : null,
  ].filter((line): line is string => line !== null);
  return lines.length > 0 ? [...lines, ""] : [];
}

function testNote(attempt: PaymentAttempt): string | null {
  return attempt.environment === "demo" ? "\nTest mode: Stripe sandbox. No real money moved." : null;
}

export async function sendPaymentEmail(
  kind: "approved" | "duplicate",
  link: PaymentLink,
  attempt: PaymentAttempt,
  payer: Payer | null = null,
): Promise<void> {
  const amount = displayCents(attempt.amountCents);
  const test = attempt.environment === "demo" ? "[TEST MODE] " : "";
  const subject =
    kind === "approved"
      ? `${test}Payment received: ${link.reference}, ${amount}`
      : `${test}Refund needed: second payment on ${link.reference}, ${amount}`;

  const card = [attempt.cardBrand, attempt.cardLast4 ? `ending ${attempt.cardLast4}` : null]
    .filter(Boolean)
    .join(" ");

  const lines = [
    kind === "approved"
      ? `Payment link ${link.reference} has been paid.`
      : `Payment link ${link.reference} was paid again after it was already ${link.status}. ` +
        "The customer has been charged twice: refund this payment in the Stripe Dashboard.",
    "",
    ...payerLines(payer),
    `Amount: ${amount}`,
    `For: ${link.description}`,
    card ? `Card: ${card}` : null,
    `Reference: ${attempt.providerInvoiceNumber}`,
    attempt.providerTxnId ? `Stripe payment: ${attempt.providerTxnId}` : null,
    attempt.providerTxnId ? `Open in Stripe: ${DASHBOARD_PAYMENTS}/${attempt.providerTxnId}` : null,
    attempt.verifiedAt ? `Confirmed: ${TIME_FORMAT.format(attempt.verifiedAt)} (Toronto)` : null,
    "",
    `All payment links: ${ADMIN_URL}`,
    testNote(attempt),
  ].filter((line): line is string => line !== null);

  await send(subject, lines, link.reference);
}

/** A refund or dispute Stripe reported on a payment we took. */
export async function sendStripeNoticeEmail(
  notice: StripeNotice,
  link: PaymentLink,
  attempt: PaymentAttempt,
): Promise<void> {
  const test = attempt.environment === "demo" ? "[TEST MODE] " : "";
  const paid = displayCents(attempt.amountCents);
  let subject: string;
  let headline: string;
  const detail: string[] = [];

  if (notice.kind === "refunded") {
    const refunded = displayCents(notice.refundedCents);
    subject = `${test}${notice.full ? "Refunded" : "Partly refunded"}: ${link.reference}, ${refunded}`;
    headline = `${notice.full ? "A full" : "A partial"} refund of ${refunded} was issued on ${link.reference} (paid ${paid}).`;
    detail.push("The link stays marked Paid in the admin; it shows a Refunded flag.");
  } else if (notice.kind === "dispute_opened") {
    const due = notice.dueBy ? `${TIME_FORMAT.format(notice.dueBy)} (Toronto)` : "see the Stripe Dashboard";
    subject = `${test}Dispute opened on ${link.reference}, ${displayCents(notice.amountCents)}: respond by ${notice.dueBy ? TIME_FORMAT.format(notice.dueBy) : "the Dashboard deadline"}`;
    headline = `The cardholder's bank opened a dispute on ${link.reference} (paid ${paid}).`;
    detail.push(
      `Reason: ${notice.reason.replace(/_/g, " ")}`,
      `Respond by: ${due}`,
      "Respond in the Stripe Dashboard before the deadline: attach the quote, the payment link, the customer's messages and the pickup or installation record.",
    );
  } else {
    subject = `${test}Dispute closed on ${link.reference}: ${notice.status.replace(/_/g, " ")}`;
    headline = `The dispute on ${link.reference} (${displayCents(notice.amountCents)}) closed: ${notice.status.replace(/_/g, " ")}.`;
  }

  const lines = [
    headline,
    "",
    ...detail,
    ...(detail.length > 0 ? [""] : []),
    `For: ${link.description}`,
    `Reference: ${attempt.providerInvoiceNumber}`,
    attempt.providerTxnId ? `Open in Stripe: ${DASHBOARD_PAYMENTS}/${attempt.providerTxnId}` : null,
    "",
    `All payment links: ${ADMIN_URL}`,
    testNote(attempt),
  ].filter((line): line is string => line !== null);

  await send(subject, lines, link.reference);
}

async function send(subject: string, lines: string[], reference: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const address = process.env.LEAD_CAPTURE_EMAIL?.trim() ?? "";
  if (!apiKey || !EMAIL_PATTERN.test(address)) {
    log("warn", "payment.email.not_configured", reference);
    return;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Platinum Wheels payments <${address}>`,
        to: [address],
        subject: subject.replace(/[\r\n]+/g, " ").slice(0, 200),
        text: lines.join("\n"),
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
    if (response.ok) log("info", "payment.email.sent", reference);
    else log("error", "payment.email.failed", reference, `http ${response.status}`);
  } catch (error) {
    log("error", "payment.email.failed", reference, error instanceof Error ? error.name : "unknown");
  }
}

function log(level: "info" | "warn" | "error", event: string, reference: string, detail?: string): void {
  console[level](JSON.stringify({ event, reference, ...(detail ? { detail } : {}) }));
}
