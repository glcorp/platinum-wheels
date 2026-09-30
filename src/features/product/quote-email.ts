/* ---------------------------------------------------------------------------
   Quote delivery by email (D104, unparking root `llm.md` §7.15)

   Two plain-text emails per accepted inquiry, sent through Resend's REST API
   with `fetch` (no SDK dependency):
   1. **Owner alert** to `LEAD_CAPTURE_EMAIL`, which is also the sender. Carries everything the visitor typed,
      plus the CASL consent record: yes/no, the exact checkbox wording, the
      time and the page URL. Owner ruling 2026-09-23: the alert IS the consent
      record, there is no database row.
   2. **Auto-reply** to the visitor. A fixed body that never repeats what the
      visitor typed, so the form cannot be used to relay spam to a third
      party's inbox. The only variable is the product name, looked up from the
      catalogue by slug.

   **Env:** `AUTO_EMAIL_LEAD_CAPTURE_ENABLED`, `RESEND_API_KEY`,
   `LEAD_CAPTURE_EMAIL`. With the flag on, a missing key or address is a
   `failed` send, never a silent success.

   **Behind a flag.** Only `AUTO_EMAIL_LEAD_CAPTURE_ENABLED=true` sends. Any
   other value, or none, validates the form, shows the success panel and sends
   nothing, so the live form can be tested without mailing the shop or a
   stranger. Owner instruction 2026-09-24: *"make sure they are behind a flag
   in env variable AUTO_EMAIL_LEAD_CAPTURE_ENABLED because we will be testing
   the request a quote on live website and dont want the emails to be sent
   when testing"*.

   Plain text only: no HTML body means nothing typed by a visitor can ever be
   rendered as markup in the owner's mail client.

   Never logs a name, email, phone or message. Log lines carry the slug and an
   outcome only, in the admin's one-JSON-line style (`admin/session.ts`).
   --------------------------------------------------------------------------- */

import { SITE, PRIMARY_CONTACT } from "@/lib/site";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Resend answers in well under a second; a hung request must not hold the
 *  visitor's submit spinner forever. */
const RESEND_TIMEOUT_MS = 10_000;

/** Plain shape check for the configured address, same as the form's. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function autoEmailEnabled(): boolean {
  return process.env.AUTO_EMAIL_LEAD_CAPTURE_ENABLED === "true";
}

/** One address, two roles (owner ruling 2026-09-23: `sales@` is both): the
 *  sender of both emails and the inbox the owner alert goes to. Read from
 *  `LEAD_CAPTURE_EMAIL`; owner 2026-09-24: *"sales@platinumwheels.ca move to
 *  env variable"*. It must be on a domain verified in Resend
 *  (`platinumwheels.ca` is), or Resend refuses to send from it. */
function leadCaptureEmail(): string | null {
  const address = process.env.LEAD_CAPTURE_EMAIL?.trim() ?? "";
  return EMAIL_PATTERN.test(address) ? address : null;
}

/** Everything the owner alert needs. Built by `submitQuote` after validation. */
export interface QuoteInquiry {
  slug: string;
  /** Catalogue name, e.g. `Zeta Antarctica Sport 215/55R17`. `null` when the
   *  slug matches no product (stale page or tampered field). */
  productName: string | null;
  pageUrl: string;
  /** `4 tires`, `Custom: 6 wheels`, `Custom (no number given)`. */
  quantity: string;
  contact: string;
  /** From the page URL, so unverified. Empty when none was searched. */
  vehicle: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  consent: boolean;
  /** The checkbox label exactly as the visitor saw it. */
  consentWording: string;
  submittedAt: Date;
}

export type QuoteEmailOutcome =
  | { status: "disabled" }
  | { status: "sent" }
  | { status: "failed"; reason: string };

/** Sends the owner alert, then the auto-reply. The alert is the one that
 *  matters: if it fails the lead is lost, so the caller shows the visitor an
 *  error and keeps what they typed. A failed auto-reply is logged and
 *  otherwise ignored, because the shop already has the lead. */
export async function deliverQuote(inquiry: QuoteInquiry): Promise<QuoteEmailOutcome> {
  if (!autoEmailEnabled()) {
    log("info", "quote.email.disabled", inquiry.slug);
    return { status: "disabled" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log("error", "quote.email.misconfigured", inquiry.slug, "RESEND_API_KEY is not set");
    return { status: "failed", reason: "missing-key" };
  }
  const shopAddress = leadCaptureEmail();
  if (!shopAddress) {
    log("error", "quote.email.misconfigured", inquiry.slug, "LEAD_CAPTURE_EMAIL is missing or invalid");
    return { status: "failed", reason: "missing-address" };
  }
  const from = `${SITE.name} <${shopAddress}>`;

  const alert = await send(apiKey, {
    from,
    to: [shopAddress],
    reply_to: inquiry.email,
    subject: oneLine(`Quote request: ${inquiry.productName ?? inquiry.slug} (${inquiry.name})`),
    text: ownerAlertText(inquiry),
  });
  if (!alert.ok) {
    log("error", "quote.email.alert_failed", inquiry.slug, alert.reason);
    return { status: "failed", reason: alert.reason };
  }

  const reply = await send(apiKey, {
    from,
    to: [inquiry.email],
    reply_to: shopAddress,
    subject: `We got your quote request | ${SITE.name}`,
    text: autoReplyText(inquiry.productName, shopAddress),
  });
  if (!reply.ok) {
    log("warn", "quote.email.autoreply_failed", inquiry.slug, reply.reason);
  }

  log("info", "quote.email.sent", inquiry.slug);
  return { status: "sent" };
}

/* --- Bodies --------------------------------------------------------------- */

function ownerAlertText(q: QuoteInquiry): string {
  const lines = [
    "New quote request from the website.",
    "",
    `Product: ${q.productName ?? `Unknown product (slug "${q.slug}")`}`,
    `Page: ${q.pageUrl}`,
    `Quantity: ${q.quantity}`,
    `Vehicle searched: ${q.vehicle || "none"}`,
    "",
    `Name: ${q.name}`,
    `Email: ${q.email}`,
    `Phone: ${q.phone}`,
    `Preferred contact: ${q.contact}`,
    "",
    "Message:",
    q.message || "(none)",
    "",
    "---",
    "Marketing consent (CASL). Keep this email: it is the consent record.",
    `Consented: ${q.consent ? "YES" : "NO"}`,
    `Checkbox wording: "${q.consentWording}"`,
    `Submitted: ${q.submittedAt.toISOString()}`,
    `Page URL: ${q.pageUrl}`,
    "",
    "Reply to this email to answer the customer directly.",
  ];
  return lines.join("\n");
}

/** Fixed copy. Must never include anything the visitor typed. */
function autoReplyText(productName: string | null, shopAddress: string): string {
  const about = productName ? ` for the ${productName}` : "";
  return [
    "Hi,",
    "",
    `Thanks for your quote request${about}.`,
    // Same promise as the on-page success panel (`quote-success.tsx`).
    "We check fitment and stock, then reply by your preferred contact method within one business day.",
    `Need it sooner? Call us at ${PRIMARY_CONTACT.display}.`,
    "",
    SITE.legalName,
    `${SITE.city}, ${SITE.province}`,
    shopAddress,
    "",
    "You are getting this email because a quote was requested on our website with this address.",
    'If that was not you, or you do not want emails from us, reply with "unsubscribe".',
  ].join("\n");
}

/* --- Transport ------------------------------------------------------------ */

interface ResendEmail {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
}

async function send(
  apiKey: string,
  email: ResendEmail,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(email),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
    if (response.ok) return { ok: true };
    // Log Resend's error `name` (`validation_error`, `invalid_api_key`) and
    // never its `message`, which can quote the recipient's address.
    const body: unknown = await response.json().catch(() => null);
    const name =
      body && typeof body === "object" && "name" in body && typeof body.name === "string"
        ? body.name
        : "unknown";
    return { ok: false, reason: `http ${response.status} ${name}` };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.name : "unknown" };
  }
}

/** Subjects are one line. Resend's JSON API cannot be header-injected, but a
 *  newline in a name would still mangle the subject in some clients. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").slice(0, 200);
}

function log(
  level: "info" | "warn" | "error",
  event: string,
  slug: string,
  detail?: string,
): void {
  const line = JSON.stringify({ event, slug, ...(detail ? { detail } : {}) });
  console[level](line);
}
