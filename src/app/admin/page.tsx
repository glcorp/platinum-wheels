import type { Metadata } from "next";

import { AdminTopBar } from "@/features/admin/components/admin-top-bar";
import { PaymentLinkForm } from "@/features/admin/components/payment-link-form";
import { requireAdminSession } from "@/features/admin/session";

/* ---------------------------------------------------------------------------
   /admin — the payment-link builder, and the gate's landing page (D91, D92)

   NO ARTBOARD DRAWS THIS (D89). Authored from existing tokens only.

   **What this page is not.** It is not a quote builder, an invoice tool or a
   cart. Owner, this session: *"we dont built a sustem to compute final amount.
   its simply just a payment link generator … basically just a wrapper on top
   of payment gateway they choose"*. Two fields, no line items, no tax, no
   totals (D92). Nothing may be added here without an owner ruling.

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

export default async function AdminHomePage() {
  await requireAdminSession();

  return (
    <>
      <AdminTopBar />
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
            <PaymentLinkForm />
          </div>
        </div>
      </main>
    </>
  );
}
