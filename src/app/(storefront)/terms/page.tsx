import type { Metadata } from "next";

import { PageStub, StubSection } from "@/components/site/page-stub";
import { SITE } from "@/lib/site";

/* ---------------------------------------------------------------------------
   `/terms` — undesigned (D26, D39), content authored 2026-09-21 (D63) at the
   owner's request.

   **NOT LEGAL ADVICE, AND NOT LAWYER-REVIEWED.** Same standing as `/privacy`:
   an honest description of how this site behaves, written so the owner has a
   real draft to hand a lawyer. Have it reviewed before launch.

   Each clause describes something the build actually does:
     - quote-first, no cart, no checkout (`docs/decisions.md` §7);
     - prices are per item, CAD, before tax and install (D21, `Price`);
     - fitment is confirmed by the shop, which is the whole premise of the
       finder and the quote band;
     - availability is a boolean on `Product` and is not a stock count
       (`docs/decisions.md` §7 forbids displaying counts).
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Terms",
  description: `The terms that apply to quotes and pricing from ${SITE.legalName}.`,
};

export default function TermsPage() {
  return (
    <PageStub
      title="Terms"
      body={
        <>
          <StubSection title="Quotes, not orders">
            <p>
              Everything on this site is a quote request. Sending one does not
              place an order and does not commit you to anything. Nothing is
              confirmed until we reply and you accept.
            </p>
          </StubSection>

          <StubSection title="Pricing">
            <p>
              Prices are shown per item, in Canadian dollars, before tax and
              before installation. They can change, and a quote we send you
              holds for the period stated in it.
            </p>
            <p>
              We do not take payment on this site. Payment is arranged with us
              directly once you have accepted a quote.
            </p>
          </StubSection>

          <StubSection title="Fitment">
            <p>
              Sizes shown against a vehicle are a starting point, not a
              guarantee. We confirm the fitment against your actual vehicle
              before anything is ordered. If what you selected does not fit, we
              will tell you and suggest what does.
            </p>
          </StubSection>

          <StubSection title="Availability">
            <p>
              Stock changes. A product shown here may not be available when you
              ask for it, and a product marked unavailable may come back. We
              confirm availability as part of every quote.
            </p>
          </StubSection>

          <StubSection title="Product information">
            <p>
              We take care with the specifications and images on this site, but
              they come from our suppliers and can contain errors. Images are
              representative. Where a specification matters to your decision,
              ask us and we will confirm it.
            </p>
          </StubSection>

          <StubSection title="Contact">
            <p>
              {SITE.legalName}, {SITE.city}, {SITE.province}.{" "}
              <a
                href={`mailto:${SITE.email}`}
                className="text-ink underline underline-offset-4 hover:text-ink-muted"
              >
                {SITE.email}
              </a>
              .
            </p>
          </StubSection>
        </>
      }
    />
  );
}
