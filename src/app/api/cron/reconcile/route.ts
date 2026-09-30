import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { convergeGateway } from "@/features/payments/converge";
import { reconcilePending } from "@/features/payments/service";

/* ---------------------------------------------------------------------------
   Daily reconcile (`vercel.json` crons; Hobby runs it once a day).

   Resolves every attempt still `pending` after its hosted-page session died:
   the customer paid and closed the tab, declined and left, or never paid.
   Each is looked up at Converge by its unique invoice number
   (`docs/payments.md` §2). Vercel calls this with
   `Authorization: Bearer $CRON_SECRET`; anything else is a 401, so nobody can
   use it to spend the proxy quota.
   --------------------------------------------------------------------------- */

export const maxDuration = 300;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return new NextResponse("Unauthorized", { status: 401 });

  const summary = await reconcilePending(convergeGateway());
  console.log(JSON.stringify({ at: "payments.cron.reconcile", ...summary }));
  return NextResponse.json(summary);
}
