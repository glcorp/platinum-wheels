/* ---------------------------------------------------------------------------
   Payment-received email to the shop (D120).

   One plain-text email to `LEAD_CAPTURE_EMAIL` (`sales@`, which is also the
   sender, as for quote emails, D104) when an attempt settles as:
     - `approved`: the link is paid;
     - `duplicate`: money moved on a link that was already paid or cancelled,
       so staff must refund it in the Converge portal (`docs/payments.md` §4).

   **Not behind a flag** (owner, 2026-10-01): it only ever goes to the shop's
   own inbox, so it cannot mail a stranger. While `CONVERGE_ENV=demo` the
   subject says TEST MODE. The customer's receipt is Converge's, not ours.

   Sent by whichever path settled the attempt (`/pay/return` or `/pay/notify`);
   the other path gets `unchanged` and sends nothing, so it goes out once.
   A failed send is logged and never undoes or blocks the payment.

   Carries no card data beyond brand and last four. Never logs an address.
   --------------------------------------------------------------------------- */

import type { PaymentAttempt, PaymentLink } from "@/db/schema";

import { displayCents } from "./money";

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

export async function sendPaymentEmail(
  kind: "approved" | "duplicate",
  link: PaymentLink,
  attempt: PaymentAttempt,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const address = process.env.LEAD_CAPTURE_EMAIL?.trim() ?? "";
  if (!apiKey || !EMAIL_PATTERN.test(address)) {
    log("warn", "payment.email.not_configured", link.reference);
    return;
  }

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
        "The customer has been charged twice: refund this payment in the Converge portal.",
    "",
    `Amount: ${amount}`,
    `For: ${link.description}`,
    card ? `Card: ${card}` : null,
    attempt.approvalCode ? `Approval code: ${attempt.approvalCode}` : null,
    `Converge invoice: ${attempt.providerInvoiceNumber}`,
    attempt.providerTxnId ? `Converge transaction: ${attempt.providerTxnId}` : null,
    attempt.verifiedAt ? `Confirmed: ${TIME_FORMAT.format(attempt.verifiedAt)} (Toronto)` : null,
    "",
    `All payment links: ${ADMIN_URL}`,
    attempt.environment === "demo" ? "\nTest mode: Converge demo account. No real money moved." : null,
  ].filter((line): line is string => line !== null);

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
    if (response.ok) log("info", "payment.email.sent", link.reference);
    else log("error", "payment.email.failed", link.reference, `http ${response.status}`);
  } catch (error) {
    log("error", "payment.email.failed", link.reference, error instanceof Error ? error.name : "unknown");
  }
}

function log(level: "info" | "warn" | "error", event: string, reference: string, detail?: string): void {
  console[level](JSON.stringify({ event, reference, ...(detail ? { detail } : {}) }));
}
