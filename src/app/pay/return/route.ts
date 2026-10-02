import { NextResponse, type NextRequest } from "next/server";

import { getNotifyCredentials, PaymentsNotConfiguredError } from "@/features/payments/config";
import { convergeGateway } from "@/features/payments/converge";
import { handleReturn } from "@/features/payments/service";

/* ---------------------------------------------------------------------------
   /pay/return — where Converge's hosted page sends the customer back.

   One URL for every link: Converge takes its Redirect URL, Decline button
   link and Cancel link from the account's web settings, not per request
   (`docs/payments.md` §10). So the link is found from the transaction, not
   from the path.

   Everything that arrives here is UNTRUSTED (`docs/payments.md` §5.2).
   `ssl_txn_id` is only used to ask Converge, server-side, what happened;
   `ssl_invoice_number` only to find the customer's page when that query
   cannot run. Converge may GET or POST (form body) this URL, so both work.

   While `/pay/notify` is enabled (D119), the export script may already have
   settled the transaction: then no query is made. The route waits up to
   `NOTIFY_GRACE_MS` for that POST before querying, which saves a Fixie request.

   Always answers with a 303 to a page, never with payment data, so a refresh
   of the landing page never re-submits anything.
   --------------------------------------------------------------------------- */

/** How long a returning customer waits for the export script before we ask
 *  Converge ourselves. Short: the redirect is a page load. */
const NOTIFY_GRACE_MS = 2_500;

async function respond(request: NextRequest, fields: URLSearchParams | FormData) {
  const read = (key: string) => {
    const value = fields.get(key);
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  };

  let publicToken: string | null = null;
  try {
    publicToken = await handleReturn(
      { txnId: read("ssl_txn_id"), invoiceNumber: read("ssl_invoice_number") },
      convergeGateway(),
      undefined,
      { notifyGraceMs: getNotifyCredentials() ? NOTIFY_GRACE_MS : 0 },
    );
  } catch (error) {
    // A misconfiguration or database error must still land the customer on a
    // page that tells them what to do, not on a stack trace.
    const detail = error instanceof PaymentsNotConfiguredError || error instanceof Error ? error.message : "unknown";
    console.error(JSON.stringify({ at: "pay.return", detail }));
  }

  const target = publicToken ? `/pay/${publicToken}` : "/pay/done";
  return NextResponse.redirect(new URL(target, request.url), 303);
}

export async function GET(request: NextRequest) {
  return respond(request, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    form = new FormData();
  }
  return respond(request, form);
}
