import type { Metadata } from "next";

import { CONTACTS, SITE } from "@/lib/site";

/* ---------------------------------------------------------------------------
   /pay/done — where `/pay/return` lands every return it will not send to a
   link page: no `pw_pay` cookie (expired after 30 minutes, another browser,
   or not a customer at all), or a cookie that names no link (LA-01/LA-02,
   D145 audit). The return's own fields never pick a link page, so this page
   knows nothing about the payment and claims nothing. Nothing looks the
   payment up later from here (D108), though `/pay/notify` may still settle it
   (D119): the copy sends the customer to the shop.
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
        <h1 className="display text-ink text-display-28 sm:text-display-40">We couldn&apos;t confirm your payment</h1>
        <p className="text-ink-muted text-15 leading-body">
          If you finished paying, please don&apos;t pay again. Call {contact.name} at{" "}
          <a className="text-ink underline" href={`tel:${contact.tel}`}>
            {contact.display}
          </a>{" "}
          or email{" "}
          <a className="text-ink underline" href={`mailto:${SITE.email}`}>
            {SITE.email}
          </a>{" "}
          and we&apos;ll check it for you. You can also open the payment link from your email to see where it stands.
        </p>
      </div>
    </main>
  );
}
