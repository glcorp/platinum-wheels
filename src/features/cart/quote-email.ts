/* ---------------------------------------------------------------------------
   Quote delivery by email (D104, unparking root `llm.md` §7.15)

   Two plain-text emails per accepted request, sent through Resend's REST API
   with `fetch` (no SDK dependency). Since D122 a request is a whole cart, so
   each email lists every line; still one alert and one reply per request,
   never one per product (owner ruling, "One email, all items"):
   1. **Owner alert** to `LEAD_CAPTURE_EMAIL`, which is also the sender. Carries everything the visitor typed,
      plus the CASL consent record: yes/no, the exact checkbox wording, the
      time and the page URL. Owner ruling 2026-09-23: the alert IS the consent
      record, there is no database row.
   2. **Auto-reply** to the visitor. A fixed body that never repeats what the
      visitor typed, so the form cannot be used to relay spam to a third
      party's inbox. The only variables are the product names, looked up from
      the catalogue by slug, and the quantities, which the action parsed as
      whole numbers.

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

   Never logs a name, email, phone or message. Log lines carry a line count and
   an outcome only, in the admin's one-JSON-line style (`admin/session.ts`).
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

/** One cart line as the emails print it. Built by `submitCartQuote`. */
export interface QuoteLine {
  slug: string;
  /** Catalogue name, `Zeta Antarctica Sport, 215/55R17 · 94H`. `null` when
   *  the catalogue no longer has the slug or could not be read. */
  productName: string | null;
  /** `4 tires`, `1 item`. */
  quantity: string;
  /** `false` = discontinued: the shop checks restock. */
  available: boolean;
  /** The searched vehicle saved on this line, unverified. Empty when none. */
  vehicle: string;
  pageUrl: string;
}

/** Everything the owner alert needs. Built by `submitCartQuote` after
 *  validation. */
export interface QuoteInquiry {
  lines: QuoteLine[];
  /** The page the request was sent from, for the consent record. */
  cartUrl: string;
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
    log("info", "quote.email.disabled", inquiry.lines.length);
    return { status: "disabled" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log("error", "quote.email.misconfigured", inquiry.lines.length, "RESEND_API_KEY is not set");
    return { status: "failed", reason: "missing-key" };
  }
  const shopAddress = leadCaptureEmail();
  if (!shopAddress) {
    log("error", "quote.email.misconfigured", inquiry.lines.length, "LEAD_CAPTURE_EMAIL is missing or invalid");
    return { status: "failed", reason: "missing-address" };
  }
  const from = `${SITE.name} <${shopAddress}>`;

  const alert = await send(apiKey, {
    from,
    to: [shopAddress],
    reply_to: inquiry.email,
    subject: oneLine(`Quote request: ${subjectItems(inquiry.lines)} (${inquiry.name})`),
    text: ownerAlertText(inquiry),
  });
  if (!alert.ok) {
    log("error", "quote.email.alert_failed", inquiry.lines.length, alert.reason);
    return { status: "failed", reason: alert.reason };
  }

  const reply = await send(apiKey, {
    from,
    to: [inquiry.email],
    reply_to: shopAddress,
    subject: `We got your quote request | ${SITE.name}`,
    text: autoReplyText(inquiry.lines, shopAddress),
  });
  if (!reply.ok) {
    log("warn", "quote.email.autoreply_failed", inquiry.lines.length, reply.reason);
  }

  log("info", "quote.email.sent", inquiry.lines.length);
  return { status: "sent" };
}

/* --- Bodies --------------------------------------------------------------- */

/** `Zeta Antarctica Sport` for one line, `3 products` for more. */
function subjectItems(lines: QuoteLine[]): string {
  if (lines.length === 1) {
    const [line] = lines;
    return line.productName ?? line.slug;
  }
  return `${lines.length} products`;
}

function lineName(line: QuoteLine): string {
  return line.productName ?? `Unknown product (slug "${line.slug}")`;
}

function ownerAlertText(q: QuoteInquiry): string {
  const items = q.lines.flatMap((line, index) => [
    `${index + 1}. ${lineName(line)}`,
    `   Quantity: ${line.quantity}`,
    ...(line.available ? [] : ["   Currently unavailable: check restock before quoting."]),
    `   Vehicle searched: ${line.vehicle || "none"}`,
    `   ${line.pageUrl}`,
  ]);
  const lines = [
    "New quote request from the website.",
    "",
    `Products (${q.lines.length}):`,
    ...items,
    "",
    `Name: ${q.name}`,
    `Email: ${q.email}`,
    `Phone: ${q.phone}`,
    "",
    "Message:",
    q.message || "(none)",
    "",
    "---",
    "Marketing consent (CASL). Keep this email: it is the consent record.",
    `Consented: ${q.consent ? "YES" : "NO"}`,
    `Checkbox wording: "${q.consentWording}"`,
    `Submitted: ${q.submittedAt.toISOString()}`,
    `Page URL: ${q.cartUrl}`,
    "",
    "Reply to this email to answer the customer directly.",
  ];
  return lines.join("\n");
}

/** Fixed copy plus the catalogue's product names and the parsed quantities.
 *  Must never include anything the visitor typed. */
function autoReplyText(lines: QuoteLine[], shopAddress: string): string {
  const items = lines.map(
    (line) => `- ${line.productName ?? "A product from our catalogue"} (${line.quantity})`,
  );
  return [
    "Hi,",
    "",
    "Thanks for your quote request. You asked about:",
    ...items,
    "",
    // Same promise as the on-page success panel (`quote-success.tsx`).
    "We'll check fitment and stock, then get back to you within 1-2 business days.",
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
  lineCount: number,
  detail?: string,
): void {
  const line = JSON.stringify({ event, lines: lineCount, ...(detail ? { detail } : {}) });
  console[level](line);
}
