/* ---------------------------------------------------------------------------
   Converge adapter — the only file that speaks Elavon's wire formats (D99).

   Two endpoints, both POST `application/x-www-form-urlencoded`:

     /hosted-payments/transaction_token   → a one-time, 15-minute session token
                                            for the Hosted Payment Page (HPP).
     /VirtualMerchant(Demo)/processxml.do → `txnquery`: what actually happened,
                                            asked server-side. The browser's
                                            return redirect is never trusted.

   Both go through the static-IP proxy when `FIXIE_URL` is set: Converge only
   issues tokens to IPs on the merchant's Online Security Allowed List, and
   Vercel functions have no fixed egress (D102, `docs/payments.md` §6). The
   proxy is an HTTPS CONNECT tunnel, so TLS stays end to end and the proxy
   never sees the PIN. TLS verification is never disabled (Elavon's sample
   code does; we don't — `docs/payments.md` §5.4).

   Facts and their sources are in `docs/payments.md` §10. Two behaviours are
   deliberate:
     - no currency field: `ssl_transaction_currency` is for multi-currency
       terminals only and errors (5087) on a CAD-only one, which defaults CAD;
     - approval is read from `ssl_result_message`, because Elavon's txnquery
       examples return it and not always `ssl_result`.

   The PIN is never logged, never returned, never written to an event: `raw`
   on a transaction is built from a whitelist (`REDACTED_FIELDS`), not by
   deleting known-bad keys.
   --------------------------------------------------------------------------- */

import { fetch, ProxyAgent, type Dispatcher } from "undici";

import { getConvergeConfig, type ConvergeConfig } from "./config";
import { formatCents, parseAmountToCents } from "./money";
import type { Gateway, GatewayTransaction, QueryResult, SessionRequest, SessionResult } from "./types";

const HOSTS = {
  demo: {
    token: "https://api.demo.convergepay.com/hosted-payments/transaction_token",
    hostedPage: "https://api.demo.convergepay.com/hosted-payments/",
    xml: "https://api.demo.convergepay.com/VirtualMerchantDemo/processxml.do",
  },
  production: {
    token: "https://api.convergepay.com/hosted-payments/transaction_token",
    hostedPage: "https://api.convergepay.com/hosted-payments/",
    xml: "https://api.convergepay.com/VirtualMerchant/processxml.do",
  },
} as const;

/** Elavon recommends 60–120 s. A timeout on the token call means no session
 *  was issued; on a query it means "unknown": the attempt stays `pending` (D108). */
const TIMEOUT_MS = 60_000;

/** Converge's limit: invoice number ≤ 25 chars. */
const INVOICE_MAX = 25;

/** The only gateway fields that may be stored (`payment_events.data`). Card
 *  number is deliberately absent: we derive last four and drop the rest. */
const REDACTED_FIELDS = [
  "ssl_txn_id",
  "ssl_trans_status",
  "ssl_transaction_type",
  "ssl_txn_time",
  "ssl_amount",
  "ssl_invoice_number",
  "ssl_result",
  "ssl_result_message",
  "ssl_approval_code",
  "ssl_card_short_description",
  "ssl_card_type",
  "ssl_settlement_batch_response",
  "errorCode",
  "errorName",
  "errorMessage",
] as const;

/** Statuses Converge gives a transaction its fraud or auth rules stopped. */
const FAILED_TRANS_STATUSES = new Set(["PST", "FPR", "PRE"]);

let cachedDispatcher: { url: string; agent: Dispatcher } | undefined;

function dispatcherFor(config: ConvergeConfig): Dispatcher | undefined {
  if (!config.proxyUrl) return undefined;
  if (cachedDispatcher?.url === config.proxyUrl) return cachedDispatcher.agent;

  const url = new URL(config.proxyUrl);
  const credentials =
    url.username || url.password
      ? `Basic ${Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString("base64")}`
      : undefined;
  url.username = "";
  url.password = "";
  const agent = new ProxyAgent({ uri: url.toString(), token: credentials });
  cachedDispatcher = { url: config.proxyUrl, agent };
  return agent;
}

type PostResult = { ok: true; status: number; body: string } | { ok: false; detail: string };

async function post(config: ConvergeConfig, url: string, form: URLSearchParams): Promise<PostResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      dispatcher: dispatcherFor(config),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { ok: true, status: response.status, body: await response.text() };
  } catch (error) {
    // A 407 from Fixie (free quota spent) surfaces here as a proxy error.
    // The message is ours to log; it never contains the request body.
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : "unknown error";
    return { ok: false, detail: /407/.test(detail) ? `proxy refused (quota?): ${detail}` : detail };
  }
}

function credentials(config: ConvergeConfig): Record<string, string> {
  return {
    // `ssl_merchant_id` is the name every working integration and Elavon's
    // own PHP sample send; the docs call it `ssl_account_id` now ("formerly
    // ssl_merchant_id"). Verified against the demo account (§10).
    ssl_merchant_id: config.accountId,
    ssl_user_id: config.userId,
    ssl_pin: config.pin,
  };
}

/* ===========================================================================
   Session token
   =========================================================================== */

async function createSession(config: ConvergeConfig, request: SessionRequest): Promise<SessionResult> {
  if (request.invoiceNumber.length > INVOICE_MAX) {
    return { ok: false, reason: "unavailable", detail: "invoice number too long" };
  }

  const form = new URLSearchParams({
    ...credentials(config),
    ssl_transaction_type: "ccsale",
    ssl_amount: formatCents(request.amountCents),
    ssl_invoice_number: request.invoiceNumber,
    // No `ssl_description`: the demo account's hosted page issued the token
    // with it and then failed every card with errorType SYSTEM "System error"
    // (2026-10-03), while the same $1.00 sale approved in the portal. The
    // description stays ours, on the pay page; the invoice number identifies
    // the payment in Converge.
  });

  const result = await post(config, HOSTS[config.environment].token, form);
  if (!result.ok) return { ok: false, reason: "unavailable", detail: result.detail };

  const token = result.body.trim();
  // 403 = this IP is not on the allowed list; 401 = bad credentials. An HTML
  // body (starts with "<") is an error page, never a token.
  if (result.status !== 200 || token === "" || token.startsWith("<") || /\s/.test(token)) {
    return {
      ok: false,
      reason: "unavailable",
      detail: `token request failed: HTTP ${result.status}${result.status === 403 ? " (IP not on the Converge allowed list?)" : ""}`,
    };
  }

  return { ok: true, hostedPageUrl: HOSTS[config.environment].hostedPage, token };
}

/* ===========================================================================
   Transaction query (XML API)
   =========================================================================== */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function toXml(fields: Record<string, string>): string {
  const body = Object.entries(fields)
    .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
    .join("");
  return `<txn>${body}</txn>`;
}

/** Converge's responses are flat: `<txn><a>1</a>…</txn>`, or several of those
 *  inside `<txnlist>`. Leaf elements only; nothing nested inside a `<txn>`. */
function parseTxnBlocks(xml: string): Record<string, string>[] {
  const blocks = [...xml.matchAll(/<txn>([\s\S]*?)<\/txn>/g)].map((m) => m[1]);
  return blocks.map((block) => {
    const fields: Record<string, string> = {};
    for (const [, key, value] of block.matchAll(/<([A-Za-z_][\w]*)>([^<]*)<\/\1>/g)) {
      fields[key] = unescapeXml(value).trim();
    }
    return fields;
  });
}

export function toGatewayTransaction(fields: Record<string, string>): GatewayTransaction {
  const message = fields.ssl_result_message ?? null;
  const upper = (message ?? "").toUpperCase();
  const failedByRules = FAILED_TRANS_STATUSES.has((fields.ssl_trans_status ?? "").toUpperCase());

  let outcome: GatewayTransaction["outcome"] = "other";
  if (!failedByRules && (upper.startsWith("APPROV") || (fields.ssl_result === "0" && upper === ""))) {
    outcome = "approved";
  } else if (failedByRules || upper.includes("DECLIN") || fields.ssl_result === "1") {
    outcome = "declined";
  }

  const digits = (fields.ssl_card_number ?? "").replace(/\D/g, "");
  const raw: Record<string, string> = {};
  for (const key of REDACTED_FIELDS) {
    if (fields[key] !== undefined) raw[key] = fields[key];
  }

  return {
    txnId: fields.ssl_txn_id ?? "",
    invoiceNumber: fields.ssl_invoice_number || null,
    amountCents: fields.ssl_amount ? parseAmountToCents(fields.ssl_amount) : null,
    outcome,
    resultMessage: message,
    approvalCode: fields.ssl_approval_code || null,
    cardBrand: fields.ssl_card_short_description || fields.ssl_card_type || null,
    cardLast4: digits.length >= 4 ? digits.slice(-4) : null,
    raw,
  };
}

async function query(config: ConvergeConfig, search: Record<string, string>): Promise<QueryResult> {
  const xml = toXml({ ...credentials(config), ssl_transaction_type: "txnquery", ...search });
  const result = await post(config, HOSTS[config.environment].xml, new URLSearchParams({ xmldata: xml }));
  if (!result.ok) return { ok: false, detail: result.detail };
  if (result.status !== 200) return { ok: false, detail: `txnquery failed: HTTP ${result.status}` };

  const blocks = parseTxnBlocks(result.body);
  const error = blocks.find((b) => b.errorCode);
  if (error) {
    return { ok: false, detail: `txnquery error ${error.errorCode}: ${error.errorName ?? ""} ${error.errorMessage ?? ""}`.trim() };
  }
  return {
    ok: true,
    transactions: blocks.filter((b) => b.ssl_txn_id).map(toGatewayTransaction),
  };
}

/* ===========================================================================
   Export script (D119) — Converge's server-to-server POST after a transaction
   ===========================================================================

   Form-encoded, ISO-8859-1, **not signed** (`docs/payments.md` §10). It is
   trusted only because it arrives from Elavon's published ranges *and*
   carries the username and password agreed with Elavon; `/pay/notify` checks
   both before calling `parseExportScript`. Elavon's sample payload carries no
   `ssl_invoice_number`; without one the POST cannot be matched and the
   return redirect's query settles the attempt as before. */

/** Elavon's export-script source ranges, read 2026-10-01 from
 *  developer.elavon.com/products/hosted-payment-page/v1/export-scripts. */
const EXPORT_SOURCE_RANGES: readonly (readonly [string, number])[] = [
  ["62.17.112.80", 28],
  ["62.134.193.208", 28],
  ["65.201.175.80", 28],
  ["204.137.47.32", 28],
  ["204.137.43.32", 28],
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
    value = value * 256 + Number(part);
  }
  return value;
}

/** True when `ip` (IPv4, or IPv4-mapped IPv6) is inside an Elavon range. */
export function isExportScriptSource(ip: string): boolean {
  const address = ipv4ToInt(ip.replace(/^::ffff:/i, "").trim());
  if (address === null) return false;
  return EXPORT_SOURCE_RANGES.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    const start = ipv4ToInt(base)!;
    return address >= start && address < start + size;
  });
}

/** The posted fields as a transaction, or null when it names none. The same
 *  reading as a `txnquery` result, so approval means the same thing on both. */
export function parseExportScript(fields: Record<string, string>): GatewayTransaction | null {
  return fields.ssl_txn_id ? toGatewayTransaction(fields) : null;
}

/* ===========================================================================
   The Gateway
   =========================================================================== */

export function convergeGateway(config: ConvergeConfig = getConvergeConfig()): Gateway {
  return {
    environment: config.environment,
    createSession: (request) => createSession(config, request),
    getTransaction: (txnId) => query(config, { ssl_txn_id: txnId }),
    findByInvoice: (invoiceNumber) => query(config, { ssl_invoice_number: invoiceNumber }),
  };
}
