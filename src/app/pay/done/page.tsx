import type { Metadata } from "next";

import { CONTACTS, SITE } from "@/lib/site";

/* ---------------------------------------------------------------------------
   /pay/done — where `/pay/return` lands a customer it could not match to a
   link (Converge sent no usable transaction or invoice number). Nothing about
   the payment is known here, so it claims nothing: the daily reconcile will
   find the transaction by invoice number if there is one.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false },
};

export default function PayDonePage() {
  const contact = CONTACTS[0];
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1 px-4 pt-14 pb-20 sm:px-8">
      <div className="bg-surface border-border-strong mx-auto flex w-full max-w-measure flex-col gap-4 border p-5 sm:p-8">
        <h1 className="display text-ink text-display-28 sm:text-display-40">Thanks. We&apos;re checking.</h1>
        <p className="text-ink-muted text-15 leading-body">
          If you completed a payment, we&apos;ll confirm it shortly. Open the payment link from your email again to see
          its status, or call {contact.name} at{" "}
          <a className="text-ink underline" href={`tel:${contact.tel}`}>
            {contact.display}
          </a>{" "}
          or email{" "}
          <a className="text-ink underline" href={`mailto:${SITE.email}`}>
            {SITE.email}
          </a>
          .
        </p>
      </div>
    </main>
  );
}
