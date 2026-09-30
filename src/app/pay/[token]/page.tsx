import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { CONTACTS, SITE } from "@/lib/site";
import { PayButton } from "@/features/payments/components/pay-button";
import { displayCents } from "@/features/payments/money";
import { getPayPage } from "@/features/payments/service";
import type { PaymentAttempt } from "@/features/payments/types";

/* ---------------------------------------------------------------------------
   /pay/<token> — the page a customer opens from the shop's email (D100).

   NO ARTBOARD DRAWS THIS. Authored from existing tokens only, like the admin
   (D89): the logo box from `AdminTopBar`, the 420px measure from `/admin`.

   It shows what is owed and one button. The card is entered on Converge's
   hosted page, never here, which keeps the shop at PCI SAQ A (D99). Every
   state is read from the database at request time; nothing is cached, because
   a paid link must never render a Pay button again.

   No site header or footer: this page is served on `pay.platinumwheels.ca`,
   where storefront links would not resolve (D105).
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const DATE = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

function attemptNotice(attempt: PaymentAttempt | null): string | null {
  if (!attempt) return null;
  switch (attempt.status) {
    case "declined":
      return "Your last payment was declined and nothing was charged. You can try again, with the same card or another one.";
    case "failed":
      return "Your last attempt didn't reach the payment service, so nothing was charged. You can try again.";
    case "pending":
      return attempt.sessionExpiresAt.getTime() > Date.now()
        ? "A payment was started on this link in the last few minutes. If you finished it, wait a moment and refresh this page before paying again."
        : "A payment was started on this link earlier and we couldn't confirm it. If your card was charged, please don't pay again: call or email us and we'll sort it out.";
    default:
      return null;
  }
}

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{22,64}$/.test(token)) notFound();

  const view = await getPayPage(token);
  if (!view) notFound();
  const { link, state, latestAttempt } = view;
  const amount = displayCents(link.amountCents);
  const notice = state === "active" ? attemptNotice(latestAttempt) : null;
  const contact = CONTACTS[0];

  return (
    <main id="main" tabIndex={-1} className="w-full flex-1 px-4 pt-8 pb-20 sm:px-8 sm:pt-14">
      <div className="mx-auto flex w-full max-w-measure flex-col gap-8">
        <div className="flex items-center gap-2.5">
          <Image
            src="/images/logo/platinum-wheels-logo-transparent.webp"
            alt=""
            width={512}
            height={507}
            sizes="(min-width: 720px) 65px, 53px"
            className="h-13 w-auto sm:h-16"
            priority
          />
          <span className="label text-ink text-11 tracking-12 sm:text-12">{SITE.legalName}</span>
        </div>

        <section className="bg-surface border-border-strong flex flex-col gap-5 border p-5 sm:p-8">
          <h1 className="display text-ink text-display-28 sm:text-display-40">
            {state === "paid" ? "Paid. Thank you." : state === "active" ? "Payment request" : "This link is closed"}
          </h1>

          <dl className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="label text-ink-dim text-11 tracking-12 sm:text-12">Amount</dt>
              <dd className="numeral text-ink text-22 leading-flat">{`${amount} CAD`}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="label text-ink-dim text-11 tracking-12 sm:text-12">For</dt>
              <dd className="text-ink text-15 leading-body sm:text-16">{link.description}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="label text-ink-dim text-11 tracking-12 sm:text-12">Reference</dt>
              <dd className="numeral text-ink text-15">{link.reference}</dd>
            </div>
            {state === "active" ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="label text-ink-dim text-11 tracking-12 sm:text-12">Pay by</dt>
                <dd className="text-ink text-15">{DATE.format(link.expiresAt)}</dd>
              </div>
            ) : null}
            {state === "paid" && link.paidAt ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="label text-ink-dim text-11 tracking-12 sm:text-12">Paid on</dt>
                <dd className="text-ink text-15">{DATE.format(link.paidAt)}</dd>
              </div>
            ) : null}
          </dl>

          {state === "active" ? (
            <>
              {notice ? (
                <p role="status" className="border-accent bg-accent-subtle text-ink text-14 leading-body border p-3.5">
                  {notice}
                </p>
              ) : null}
              <PayButton publicToken={link.publicToken} amountLabel={amount} />
              <p className="text-ink-dim text-13 leading-body">
                You&apos;ll enter your card on our payment processor&apos;s secure page (Elavon Converge). We never see
                or store your card number.
              </p>
            </>
          ) : null}

          {state === "paid" ? (
            <p className="text-ink-muted text-15 leading-body">
              Your payment went through. Keep the reference {link.reference} for your records.
            </p>
          ) : null}

          {state === "expired" || state === "cancelled" ? (
            <p className="text-ink-muted text-15 leading-body">
              {state === "expired"
                ? "This payment link has expired."
                : "This payment link has been withdrawn."}{" "}
              Contact us and we&apos;ll send you a new one.
            </p>
          ) : null}
        </section>

        <p className="text-ink-dim text-13 leading-body">
          Questions? Call {contact.name} at{" "}
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
