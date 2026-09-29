import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

/* ---------------------------------------------------------------------------
   `/qa-error` — a test fixture, not a page (D91b).

   No real route can throw in production, so the route error boundary
   (`error.tsx` → `src/components/site/route-error.tsx`, D62) had no way to be
   exercised end to end. This route throws **only** when the server was
   started with `QA_ERROR_ROUTE=1`, which `playwright.config.ts` sets for the
   suite; everywhere else it is an ordinary 404, indistinguishable from any
   unknown path.

   `connection()` makes it render per request, so the env var is read at
   runtime rather than frozen into a prerender at build time.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function QaErrorPage() {
  await connection();
  if (process.env.QA_ERROR_ROUTE !== "1") notFound();
  throw new Error("QA fixture: deliberate render error (D91b)");
}
