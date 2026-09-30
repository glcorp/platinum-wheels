import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import { headers } from "next/headers";

import { AdminTopBar } from "@/features/admin/components/admin-top-bar";
import { PaymentLinkForm } from "@/features/admin/components/payment-link-form";
import { PaymentLinkList } from "@/features/admin/components/payment-link-list";
import { requireAdminSession } from "@/features/admin/session";
import { publicPayOrigin } from "@/features/payments/config";
import { listLinks, type LinkSummary } from "@/features/payments/service";

/* ---------------------------------------------------------------------------
   /admin — the payment-link builder, and the gate's landing page (D91, D92)

   NO ARTBOARD DRAWS THIS (D89). Authored from existing tokens only.

   **What this page is not.** It is not a quote builder, an invoice tool or a
   cart. Owner, this session: *"we dont built a sustem to compute final amount.
   its simply just a payment link generator … basically just a wrapper on top
   of payment gateway they choose"*. Two fields, no line items, no tax, no
   totals (D92), plus the expiry D103 added. Nothing may be added here without
   an owner ruling. Below the builder, the latest links and whether each was
   paid (D106).

   **Why the builder is the root of /admin.** With product CRUD deferred until
   the vendor catalogue settles the schema, the payment link is the only thing
   the admin does, so a dashboard would be an index of one. When CRUD lands,
   this becomes a real shell with navigation and the builder moves to its own
   route — `AdminTopBar` is deliberately the seed of that, not a finished shell.

   **The gate is enforced here, in the page.** `proxy.ts` is deferred (D90), so
   there is no single choke point: every protected page must call
   `requireAdminSession()` as its first statement, and one that forgets is
   simply unprotected. See the warning block in `session.ts` — this is a stub,
   not authentication.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Payment links",
};

/** The links list must never take the builder down with it: if the database
 *  is unreachable, the page still renders and says so. */
async function loadLinks(): Promise<LinkSummary[] | null> {
  try {
    return await listLinks();
  } catch (error) {
    console.error(JSON.stringify({ at: "admin.listLinks", detail: error instanceof Error ? error.message : "unknown" }));
    return null;
  }
}

export default async function AdminHomePage() {
  const { csrfToken } = await requireAdminSession();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = publicPayOrigin(`${proto}://${host}`);
  const links = await loadLinks();

  return (
    <>
      <AdminTopBar csrfToken={csrfToken} />
      {/* Horizontal padding and the content cap mirror `AdminTopBar`'s inner
          box exactly — `px-4 sm:px-8 md:px-12 lg:mx-auto lg:max-w-content`,
          which is also `site-header.tsx`'s and `page-stub.tsx`'s. They must
          match: the bar's logo and this column's `<h1>` share a left edge, and
          the two padding ramps in this repo diverge at `sm:` (32px here, 48px
          on `/styleguide`). Using the other ramp put the logo 16px inside the
          heading across the whole 720-1099 band — which is iPad portrait, the
          width the owner works at most ("mostly on phone and tab"). */}
      <main
        id="main"
        tabIndex={-1}
        className="w-full flex-1 px-4 pt-10 pb-20 sm:px-8 sm:pt-14 sm:pb-30 md:px-12 lg:mx-auto lg:max-w-content"
      >
        {/* The form column is held to the same 420px measure as the sign-in
            page. Two short fields stretched across an iPad or a laptop would
            put the label and its box absurdly far apart; a measured column
            keeps the form the same shape on every device he uses. */}
        <div className="w-full max-w-measure">
          <h1 className="display text-ink text-display-40 sm:text-display-56">
            New payment link
          </h1>

          {/* New copy (`.claude/rules/ui.md` "Copy"). It states the one thing
              that is easy to get wrong: the amount is whatever he types, and
              nothing here works out tax or totals for him. */}
          <p className="text-ink-muted mt-3 text-15 leading-body sm:text-16">
            Enter the total the customer pays, including tax. Send the link by
            email once it is generated.
          </p>

          <div className="mt-10 sm:mt-12">
            <PaymentLinkForm csrfToken={csrfToken} idempotencyKey={randomUUID()} />
          </div>
        </div>

        <section aria-labelledby="links-heading" className="mt-16 w-full max-w-measure sm:mt-20">
          <h2 id="links-heading" className="display text-ink text-display-28 sm:text-display-40">
            Recent links
          </h2>
          <div className="mt-6">
            {links ? (
              <PaymentLinkList links={links} origin={origin} csrfToken={csrfToken} />
            ) : (
              <p role="alert" className="text-ink text-15 leading-body">
                The links list could not be loaded. Refresh in a minute.
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
