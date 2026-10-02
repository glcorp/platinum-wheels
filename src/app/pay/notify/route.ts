import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getNotifyCredentials } from "@/features/payments/config";
import { isExportScriptSource, parseExportScript } from "@/features/payments/converge";
import { handleNotify } from "@/features/payments/service";

/* ---------------------------------------------------------------------------
   /pay/notify — Converge's export script (D119, `docs/payments.md` §8.9).

   After each transaction Converge POSTs the result here, server to server,
   form-encoded. The POST is **not signed**, so three gates come first:

     1. Off unless `CONVERGE_NOTIFY_USER` and `CONVERGE_NOTIFY_PASSWORD` are
        set: 404, as if the route did not exist.
     2. The caller's IP must be in one of Elavon's published ranges: 403.
        On Vercel `x-real-ip` / `x-forwarded-for` are written by the platform,
        not the client (the pay host is DNS-only, no proxy in front, D105).
     3. HTTP Basic credentials agreed with Elavon: 401 with a challenge, since
        Elavon's sample shows an `authorization` header on authenticated posts.

   Then the posted transaction is applied exactly like a `txnquery` result:
   amount and invoice must match the attempt. Converge flags any non-200 as a
   failed export, so a post we cannot match still gets 200 (it is logged);
   only our own failure answers 500. Nothing posted is echoed back.

   The body is ISO-8859-1. Every field we read is ASCII, so decoding it as
   UTF-8 changes nothing we use; names and addresses are never stored.
   --------------------------------------------------------------------------- */

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time compare of `user:password` against the Basic header. */
function authorised(header: string | null, expected: { username: string; password: string }): boolean {
  if (!header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
  } catch {
    return false;
  }
  return timingSafeEqual(digest(decoded), digest(`${expected.username}:${expected.password}`));
}

function callerIp(request: NextRequest): string {
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

function log(level: "info" | "warn" | "error", event: string, detail?: Record<string, unknown>): void {
  console[level](JSON.stringify({ at: "pay.notify", event, ...detail }));
}

export async function POST(request: NextRequest) {
  const credentials = getNotifyCredentials();
  if (!credentials) return new NextResponse(null, { status: 404 });

  const ip = callerIp(request);
  if (!isExportScriptSource(ip)) {
    log("warn", "refused_ip", { ip });
    return new NextResponse(null, { status: 403 });
  }

  if (!authorised(request.headers.get("authorization"), credentials)) {
    log("warn", "refused_auth", { ip });
    return new NextResponse(null, {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="pay-notify", charset="UTF-8"' },
    });
  }

  const fields: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(await request.text())) fields[key] = value.trim();

  const txn = parseExportScript(fields);
  if (!txn) {
    log("info", "ignored", { reason: "no ssl_txn_id" });
    return new NextResponse("OK", { status: 200 });
  }

  try {
    const outcome = await handleNotify(txn);
    log(outcome === "mismatch" ? "error" : "info", outcome, {
      txnId: txn.txnId,
      invoice: txn.invoiceNumber,
    });
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    log("error", "failed", { txnId: txn.txnId, detail: error instanceof Error ? error.message : "unknown" });
    return new NextResponse(null, { status: 500 });
  }
}
