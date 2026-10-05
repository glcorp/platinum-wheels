import { NextResponse, type NextRequest } from "next/server";

import { getNotifyCredentials, PAY_RETURN_COOKIE } from "@/features/payments/config";
import { convergeGateway } from "@/features/payments/converge";
import { handleReturn } from "@/features/payments/service";

/* ---------------------------------------------------------------------------
   /pay/return — where Converge's hosted page sends the customer back.

   One URL for every link: Converge takes its Redirect URL, Decline button
   link and Cancel link from the account's web settings, not per request
   (`docs/payments.md` §10). So the link is found from the browser's `pw_pay`
   cookie, not from the path, and the attempt from the gateway's answer.

   Everything that arrives here is UNTRUSTED (`docs/payments.md` §5.2), and
   anyone can call this URL. So (LA-01/LA-02, D145 audit; `handleReturn`):
   Converge is asked only when the browser's own `pw_pay` cookie, set when it
   pressed Pay, names a link with an open attempt, at most a few times per
   attempt; and the 303 goes to `/pay/<token>` only for the link that cookie
   names. Every other return lands on `/pay/done`, whatever it carries: a
   sequential invoice number must never lead to someone else's link page.
   Converge may GET or POST (form body) this URL, so both work.

   While `/pay/notify` is enabled (D119), the export script may already have
   settled the transaction: then no query is made. The route waits up to
   `NOTIFY_GRACE_MS` for that POST before querying, which saves a Fixie request.

   Always answers with a 303 to a page, never with payment data, so a refresh
   of the landing page never re-submits anything.
   --------------------------------------------------------------------------- */

/** Fields whose values are safe to log (no card number, name, address or
 *  email): enough to see what Converge sent back and why it declined. Every
 *  other posted field is logged by name only. */
const LOGGED_VALUES = [
  "ssl_result",
  "ssl_result_message",
  "ssl_invoice_number",
  "ssl_txn_id",
  "ssl_trans_status",
  "ssl_transaction_type",
  "ssl_amount",
  "ssl_approval_code",
  "errorCode",
  "errorName",
  "errorMessage",
] as const;

/** How long a returning customer waits for the export script before we ask
 *  Converge ourselves. Short: the redirect is a page load. */
const NOTIFY_GRACE_MS = 2_500;

async function respond(request: NextRequest, fields: URLSearchParams, source: Record<string, unknown>) {
  const read = (key: string) => {
    const value = fields.get(key);
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  };

  // One line per return: which fields Converge sent, and the safe values.
  // The first real demo calls showed returns arriving with nothing we could
  // match, so this stays until the return shape is confirmed (`docs/payments.md` §10).
  const values: Record<string, string> = {};
  for (const key of LOGGED_VALUES) {
    const value = read(key);
    if (value !== null) values[key] = value.slice(0, 120);
  }
  // The cookie's value is a capability: logged as present or absent, never by value.
  const cookieToken = request.cookies.get(PAY_RETURN_COOKIE)?.value ?? null;
  console.info(
    JSON.stringify({ at: "pay.return", ...source, cookie: cookieToken !== null, fields: [...new Set(fields.keys())], values }),
  );

  // Only ever the token of the link the browser's own cookie names (LA-02).
  let publicToken: string | null = null;
  try {
    publicToken = await handleReturn(
      { txnId: read("ssl_txn_id"), invoiceNumber: read("ssl_invoice_number") },
      () => convergeGateway(),
      undefined,
      { notifyGraceMs: getNotifyCredentials() ? NOTIFY_GRACE_MS : 0, cookieToken },
    );
  } catch (error) {
    // A database error must still land the customer on a page that tells
    // them what to do, not on a stack trace.
    console.error(JSON.stringify({ at: "pay.return", detail: error instanceof Error ? error.message : "unknown" }));
  }

  if (!publicToken) console.warn(JSON.stringify({ at: "pay.return", unmatched: true }));
  const target = publicToken ? `/pay/${publicToken}` : "/pay/done";
  return NextResponse.redirect(new URL(target, request.url), 303);
}

export async function GET(request: NextRequest) {
  return respond(request, request.nextUrl.searchParams, { method: "GET" });
}

/** Read the body as text and parse it as a form whatever the content type
 *  says: `request.formData()` throws on a missing or unexpected content type,
 *  and that used to turn a real return into an empty one. Multipart is
 *  handled separately, since it is not URL-encoded. */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let fields = new URLSearchParams();
  let bodyLength = 0;
  try {
    if (contentType.toLowerCase().startsWith("multipart/form-data")) {
      const form = await request.formData();
      for (const [key, value] of form) if (typeof value === "string") fields.append(key, value);
    } else {
      const body = await request.text();
      bodyLength = body.length;
      fields = new URLSearchParams(body);
    }
  } catch {
    fields = new URLSearchParams();
  }
  // A POST may also carry fields in its query string.
  for (const [key, value] of request.nextUrl.searchParams) if (!fields.has(key)) fields.append(key, value);
  return respond(request, fields, { method: "POST", contentType: contentType.slice(0, 80), bodyLength });
}
