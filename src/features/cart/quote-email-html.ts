/* ---------------------------------------------------------------------------
   The two quote emails as data (D104, D122; restyled to HTML by D162).

   Pure functions: no env reads, no network, no "use server". Each builder
   returns `{ subject, text, html }`, so `quote-email.ts` only sends them and a
   preview script can render them with no settings at all.

   **Escaping rule.** Every value that did not come from this file is passed
   through `esc()` before it reaches the markup: what the visitor typed (name,
   email, phone, message, vehicle) and what the catalogue holds (product names,
   slugs, URLs). That includes attribute values: `mailto:` and `tel:` hrefs are
   built from escaped values, and a URL is a link only when it starts with
   `http://` or `https://`, otherwise it prints as text. Nothing typed by a
   visitor can be rendered as markup in the owner's mail client.

   Style follows the shop's goodwill-site inquiry emails: one dark 600px
   table, nested tables, inline styles only, an explicit `bgcolor` beside
   every `background-color` (Gmail dark mode), no gradients and no
   background images (Gmail's app cannot invert them), no images at all.
   --------------------------------------------------------------------------- */

import type { QuoteInquiry, QuoteLine } from "@/features/cart/quote-email";
import { SITE, PRIMARY_CONTACT } from "@/lib/site";
import { SHOP_DATE_TIME } from "@/lib/time";

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

/* --- Palette and type ----------------------------------------------------- */

const C = {
  surface: "#14181d",
  band: "#10141a",
  inset: "#0e1216",
  rule: "#272d34",
  white: "#ffffff",
  body: "#c7ced5",
  muted: "#9aa4ae",
  label: "#7d8892",
  accent: "#d6dae0",
  steel: "#3d6180",
  ice: "#a9c6dc",
} as const;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/* --- Text helpers --------------------------------------------------------- */

export function esc(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Subjects are one line. Resend's JSON API cannot be header-injected, but a
 *  newline in a name would still mangle the subject in some clients. */
export function oneLine(value: string): string {
  return value.replace(LINE_BREAKS, " ").slice(0, 200);
}

/** Every character a mail client or a reader's eye takes for a line break. */
const LINE_BREAKS = /[\r\n\v\f\u0085\u2028\u2029]+/g;

/** A visitor's name, email or phone in the PLAIN-TEXT alert: one line, whatever
 *  was posted. A form field cannot hold a newline, but a crafted POST can, and
 *  `Name: Evil\nConsented: YES` would then read as a line of the CASL record
 *  (QA CART-5). The HTML part escapes it already. Not capped: the action
 *  limits these fields' lengths. */
function textLine(value: string): string {
  return value.replace(LINE_BREAKS, " ");
}

/** The primary number for plain text: no word joiner, ordinary spaces. */
function phoneText(): string {
  return PRIMARY_CONTACT.display.replace(/⁠/g, "").replace(/ /g, " ");
}

/** The primary number for HTML: no word joiner, the no-break spaces kept. */
function phoneHtml(): string {
  return esc(PRIMARY_CONTACT.display.replace(/⁠/g, "")).replace(/ /g, "&nbsp;");
}

/** `tel:` href from whatever the visitor typed: the leading run of phone
 *  characters (so `ext 3` is not dialled), reduced to digits and a leading
 *  `+`. Empty when nothing dialable is left. */
function telHref(raw: string): string {
  const trimmed = raw.trim().match(/^[+\d\s().-]*/)?.[0] ?? "";
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  // A bare ten-digit number is North American: dial it with the country code.
  return digits.length === 10 ? `+1${digits}` : digits;
}

function isWebUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/* --- Markup pieces -------------------------------------------------------- */

function link(href: string, textHtml: string): string {
  return `<a href="${href}" style="color:${C.accent};text-decoration:underline;text-decoration-color:${C.steel};">${textHtml}</a>`;
}

/** A URL as a link when it is a web address, as plain text otherwise. */
function urlLink(url: string, textHtml: string = esc(url)): string {
  return isWebUrl(url) ? link(esc(url), textHtml) : textHtml;
}

function label(text: string): string {
  return `<div style="font:600 11px/1.4 ${FONT};letter-spacing:2px;text-transform:uppercase;color:${C.label};padding-bottom:5px;">${esc(text)}</div>`;
}

/** One label + value row. `valueHtml` is already escaped. */
function field(name: string, valueHtml: string): string {
  return `<tr><td style="padding:0 0 18px 0;">${label(name)}<div style="font:400 15px/1.6 ${FONT};color:${C.white};word-break:break-word;">${valueHtml}</div></td></tr>`;
}

function notProvided(text = "Not provided"): string {
  return `<span style="color:${C.label};">${esc(text)}</span>`;
}

function hairline(): string {
  return `<tr><td bgcolor="${C.rule}" style="height:1px;line-height:1px;font-size:0;padding:0;background-color:${C.rule};">&nbsp;</td></tr>`;
}

/** The customer's own words, inset (owner alert only). */
function quote(textValue: string): string {
  return `<div style="background-color:${C.inset};padding:10px 14px;white-space:pre-wrap;word-break:break-word;font:400 15px/1.6 ${FONT};color:${C.body};">${esc(textValue)}</div>`;
}

/** A small `Label: value` line inside a product block. */
function detail(name: string, valueHtml: string): string {
  return `<div style="font:400 14px/1.6 ${FONT};color:${C.muted};">${esc(name)}: <span style="color:${C.body};">${valueHtml}</span></div>`;
}

function shell(inner: string, preheader: string): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${esc(SITE.name)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.surface};">
<div style="display:none;font-size:1px;color:${C.surface};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.surface}" style="background-color:${C.surface};width:100%;table-layout:fixed;">
<tr><td align="center" bgcolor="${C.surface}" style="padding:0;background-color:${C.surface};">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.surface}" style="width:600px;max-width:100%;background-color:${C.surface};">
<tr><td bgcolor="${C.steel}" style="height:3px;line-height:3px;font-size:0;background-color:${C.steel};">&nbsp;</td></tr>
${inner}
</table>
</td></tr>
</table>
</body></html>`;
}

/* --- Shared copy ---------------------------------------------------------- */

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

const UNAVAILABLE_NOTE = "Currently unavailable: check restock before quoting.";
const CONSENT_KEEP = "Keep this email: it is the consent record.";
const REPLY_HINT = "Reply to this email to answer the customer directly.";

/* --- 1. Owner alert ------------------------------------------------------- */

export function ownerAlertEmail(q: QuoteInquiry): BuiltEmail {
  const iso = q.submittedAt.toISOString();
  const local = SHOP_DATE_TIME.format(q.submittedAt);
  const count = q.lines.length;

  const subject = oneLine(`Quote request: ${subjectItems(q.lines)} (${q.name})`);

  const textItems = q.lines.flatMap((line, index) => [
    `${index + 1}. ${lineName(line)}`,
    `   Quantity: ${line.quantity}`,
    ...(line.available ? [] : [`   ${UNAVAILABLE_NOTE}`]),
    `   Vehicle searched: ${line.vehicle || "None"}`,
    `   ${line.pageUrl}`,
  ]);
  const text = [
    "New quote request from the website.",
    `Received: ${local} (Brampton time)`,
    "",
    `Products (${count}):`,
    ...textItems,
    "",
    `Name: ${textLine(q.name)}`,
    `Email: ${textLine(q.email)}`,
    `Phone: ${textLine(q.phone)}`,
    "",
    "Message:",
    q.message || "Not provided",
    "",
    "---",
    `Marketing consent (CASL). ${CONSENT_KEEP}`,
    `Consented: ${q.consent ? "YES" : "NO"}`,
    `Checkbox wording: "${q.consentWording}"`,
    `Submitted: ${iso} (${local} Brampton time)`,
    `Page URL: ${q.cartUrl}`,
    "",
    REPLY_HINT,
  ].join("\n");

  const tel = telHref(q.phone);
  const productBlocks = q.lines
    .map((line, index) => {
      const name = line.productName
        ? urlLink(line.pageUrl, esc(line.productName))
        : `${esc(lineName(line))}<div style="font:400 13px/1.6 ${FONT};color:${C.label};">${urlLink(line.pageUrl)}</div>`;
      const unavailable = line.available
        ? ""
        : `<div style="font:600 14px/1.6 ${FONT};color:${C.ice};padding-top:4px;">${esc(UNAVAILABLE_NOTE)}</div>`;
      const top = index === 0 ? "0" : "14px";
      const border = index === 0 ? "" : `border-top:1px solid ${C.rule};`;
      return `<tr><td style="padding:${top} 0 14px 0;${border}">
  <div style="font:600 15px/1.5 ${FONT};color:${C.white};padding-bottom:4px;word-break:break-word;">${index + 1}. ${name}</div>
  ${detail("Quantity", esc(line.quantity))}
  ${detail("Vehicle searched", line.vehicle ? esc(line.vehicle) : "None")}
  ${unavailable}
</td></tr>`;
    })
    .join("\n");

  const consentRows = [
    detail("Consented", `<strong style="color:${C.white};">${q.consent ? "YES" : "NO"}</strong>`),
    detail("Checkbox wording", `&ldquo;${esc(q.consentWording)}&rdquo;`),
    detail("Submitted", `${esc(iso)} (${esc(local)} Brampton time)`),
    detail("Page URL", urlLink(q.cartUrl)),
  ].join("\n  ");

  const inner = `
<tr><td style="padding:26px 30px 4px 30px;">
  ${label("New quote request")}
  <div style="font:700 27px/1.25 ${FONT};letter-spacing:-0.5px;color:${C.white};word-break:break-word;">${esc(q.name)}</div>
  <div style="font:400 13px/1.6 ${FONT};color:${C.label};padding-top:6px;">${esc(local)} (Brampton time)</div>
</td></tr>
<tr><td style="padding:24px 30px 0 30px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${field("Email", link(`mailto:${esc(q.email)}`, esc(q.email)))}
    ${field("Phone", tel ? link(`tel:${esc(tel)}`, esc(q.phone)) : esc(q.phone))}
    ${field("Message", q.message ? quote(q.message) : notProvided())}
  </table>
</td></tr>
<tr><td style="padding:6px 30px 10px 30px;">
  ${label(`Products (${count})`)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
${productBlocks}
  </table>
</td></tr>
${hairline()}
<tr><td bgcolor="${C.band}" style="background-color:${C.band};padding:18px 30px 18px 30px;">
  ${label("Marketing consent (CASL)")}
  ${consentRows}
  <div style="font:400 13px/1.6 ${FONT};color:${C.muted};padding-top:10px;">${esc(CONSENT_KEEP)}</div>
</td></tr>
${hairline()}
<tr><td style="padding:18px 30px 30px 30px;">
  <div style="font:400 13px/1.6 ${FONT};color:${C.muted};">${esc(REPLY_HINT)}</div>
</td></tr>`;

  const preheader = `${q.name} asked for a quote on ${count === 1 ? "1 product" : `${count} products`}.`;
  return { subject, text, html: shell(inner, oneLine(preheader)) };
}

/* --- 2. Auto-reply -------------------------------------------------------- */

const THANKS = "Thanks for your quote request.";
const PROMISE = "We'll confirm fitment and stock and get back to you.";
const CASL_WHY =
  "You are getting this email because a quote was requested on our website with this address.";
const CASL_OUT = 'If that was not you, or you do not want emails from us, reply with "unsubscribe".';

/** Fixed copy plus the catalogue's product names and the parsed quantities.
 *  Must never include anything the visitor typed: no name, email, phone,
 *  message or vehicle (D104). `shopAddress` is `LEAD_CAPTURE_EMAIL`, the
 *  address replies go to. */
export function autoReplyEmail(lines: QuoteLine[], shopAddress: string): BuiltEmail {
  const subject = `We got your quote request | ${SITE.name}`;
  const itemName = (line: QuoteLine) => line.productName ?? "A product from our catalogue";

  const text = [
    "Hi,",
    "",
    THANKS,
    PROMISE,
    "",
    "You asked about:",
    ...lines.map((line) => `- ${itemName(line)} (${line.quantity})`),
    "",
    "----------------------------",
    "",
    "Contact us",
    `Email: ${shopAddress}`,
    `Phone: ${phoneText()}`,
    `${SITE.hoursLabel}: ${SITE.hours}`,
    "",
    SITE.legalName,
    `${SITE.city}, ${SITE.province}`,
    "",
    CASL_WHY,
    CASL_OUT,
  ].join("\n");

  const itemRows = lines
    .map(
      (line) =>
        `<tr><td style="padding:0 0 10px 0;font:400 15px/1.5 ${FONT};color:${C.white};word-break:break-word;">${esc(itemName(line))}<div style="font:400 13px/1.6 ${FONT};color:${C.muted};">Quantity: <span style="color:${C.body};">${esc(line.quantity)}</span></div></td></tr>`,
    )
    .join("\n    ");

  const inner = `
<tr><td style="padding:26px 30px 0 30px;">
  <div style="font:600 19px/1.4 ${FONT};color:${C.white};padding-bottom:8px;">Hi,</div>
  <div style="font:400 15px/1.6 ${FONT};color:${C.body};">${esc(THANKS)}<br>${esc(PROMISE)}</div>
</td></tr>
<tr><td style="padding:22px 30px 12px 30px;">
  ${label("You asked about")}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
    ${itemRows}
  </table>
</td></tr>
${hairline()}
<tr><td bgcolor="${C.band}" style="background-color:${C.band};padding:18px 30px 0 30px;">
  ${label("Contact us")}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:0 0 4px 0;font:400 15px/1.5 ${FONT};color:${C.muted};">Email&nbsp; ${link(`mailto:${esc(shopAddress)}`, esc(shopAddress))}</td></tr>
    <tr><td style="padding:0 0 4px 0;font:400 15px/1.5 ${FONT};color:${C.muted};">Phone&nbsp; ${link(`tel:${esc(PRIMARY_CONTACT.tel)}`, phoneHtml())}</td></tr>
  </table>
  <div style="font:400 13px/1.6 ${FONT};color:${C.muted};padding-top:8px;">${esc(SITE.hoursLabel)}: <span style="color:${C.body};">${esc(SITE.hours)}</span></div>
</td></tr>
<tr><td bgcolor="${C.band}" style="background-color:${C.band};padding:16px 30px 22px 30px;">
  <div style="font:400 12px/1.6 ${FONT};color:${C.label};padding-bottom:10px;">${esc(SITE.legalName)}<br>${esc(`${SITE.city}, ${SITE.province}`)}</div>
  <div style="font:400 12px/1.6 ${FONT};color:${C.label};">${esc(CASL_WHY)}<br>${esc(CASL_OUT)}</div>
</td></tr>`;

  return { subject, text, html: shell(inner, PROMISE) };
}
