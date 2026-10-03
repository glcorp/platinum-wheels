import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  PROSE_LINK,
  ProsePage,
  ProseSection,
} from "@/components/site/prose-page";
import { pageMetadata } from "@/features/seo/metadata";
import { ROUTES } from "@/lib/routes";
import { SITE } from "@/lib/site";

/* ---------------------------------------------------------------------------
   `/terms` — undesigned (D26, D39), content authored 2026-09-21 (D63) at the
   owner's request, recomposed 2026-09-22 ("not centered in desktop view, looks
   bland too"), then simplified the same day ("looks too much now, dont add
   On this page etc — just simple plain"): the section index and the per-
   section numbering are gone.

   **NOT LEGAL ADVICE, AND NOT LAWYER-REVIEWED.** Same standing as `/privacy`:
   an honest description of how this site behaves, written so the owner has a
   real draft to hand a lawyer. Have it reviewed before launch.

   Both 2026-09-22 passes changed **structure and typesetting only** — same
   clauses, same order, same wording, no new obligation, warranty or liability
   language. See the matching note in `privacy/page.tsx`, including why there
   is no "Updated" line (D32 allows a computed date and forbids a typed one,
   and this page has no honest source for one).

   Each clause describes something the build actually does:
     - quote-first, no checkout: since D122 a browser-only cart gathers the
       products and sends one quote request, and takes no payment;
     - prices are per item, CAD, before tax and install (D21, `Price`), and
       since D122 a switch can hide every price, so the Pricing clause reads
       "Where a price is shown" (a qualifier, no new commitment);
     - fitment is confirmed by the shop, which is the whole premise of the
       finder and the quote request;
     - availability is a boolean on `Product` and is not a stock count
       (`docs/decisions.md` §7 forbids displaying counts).

   2026-10-03 (D130), the owner's copy pass: two sentences take contractions.
   No clause changed meaning, scope or order.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = pageMetadata({
  title: "Terms",
  description: `The terms that apply to quotes and pricing from ${SITE.legalName}.`,
  path: ROUTES.terms,
});

/* One list of sections, mapped straight into `ProseSection`s below. */
const SECTIONS: ReadonlyArray<{
  id: string;
  title: string;
  body: ReactNode;
}> = [
  {
    id: "quotes-not-orders",
    title: "Quotes, not orders",
    body: (
      <p>
        Everything on this site is a quote request. Sending one doesn&apos;t
        place an order or commit you to anything. Nothing is confirmed until we
        reply and you accept.
      </p>
    ),
  },
  {
    id: "pricing",
    title: "Pricing",
    body: (
      <>
        <p>
          Where a price is shown, it is per item, in Canadian dollars, before
          tax and before installation. Prices can change, and a quote we send
          you holds for the period stated in it.
        </p>
        <p>
          We do not take payment on this site. Payment is arranged with us
          directly once you have accepted a quote.
        </p>
      </>
    ),
  },
  {
    id: "fitment",
    title: "Fitment",
    body: (
      <p>
        Sizes shown against a vehicle are a starting point, not a guarantee. We
        confirm the fitment against your actual vehicle before anything is
        ordered. If what you selected doesn&apos;t fit, we&apos;ll tell you and
        suggest what does.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Availability",
    body: (
      <p>
        Stock changes. A product shown here may not be available when you ask
        for it, and a product marked unavailable may come back. We confirm
        availability as part of every quote.
      </p>
    ),
  },
  {
    id: "product-information",
    title: "Product information",
    body: (
      <p>
        We take care with the specifications and images on this site, but they
        come from our suppliers and can contain errors. Images are
        representative. Where a specification matters to your decision, ask us
        and we will confirm it.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        {SITE.legalName}, {SITE.city}, {SITE.province}.{" "}
        <a href={`mailto:${SITE.email}`} className={PROSE_LINK}>
          {SITE.email}
        </a>
        .
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Terms"
      lede="What a quote from us is, what it is not, and the terms that apply to the prices on this site."
    >
      {SECTIONS.map((section) => (
        <ProseSection key={section.id} title={section.title}>
          {section.body}
        </ProseSection>
      ))}
    </ProsePage>
  );
}
