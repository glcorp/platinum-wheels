/* ---------------------------------------------------------------------------
   Whether a payment link exists, in a module of its own.

   `src/proxy.ts` runs on every request and imports this: it must not drag the
   Stripe SDK, the email sender or the settle logic of `service.ts` into the
   proxy's bundle.
   --------------------------------------------------------------------------- */

import { eq } from "drizzle-orm";

import { getDb, type Database } from "@/db/client";
import { paymentLinks } from "@/db/schema";

/**
 * Whether a payment link with this token exists, one indexed read and nothing
 * else. `src/proxy.ts` asks it before the page does, so an unknown token can
 * be answered with a 404 whose body renders without JavaScript (QA COPY-1,
 * D184; the product page's `productPageExists` is the precedent, D157). It says
 * nothing about the link's state: a paid or cancelled link exists. A token
 * that could never be one (the page's own shape test) is `false` unqueried.
 */
export async function payLinkExists(publicToken: string, db: Database = getDb()): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{22,64}$/.test(publicToken)) return false;
  const [row] = await db
    .select({ id: paymentLinks.id })
    .from(paymentLinks)
    .where(eq(paymentLinks.publicToken, publicToken))
    .limit(1);
  return row !== undefined;
}
