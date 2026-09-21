import type { Metadata } from "next";

import { PageStub, StubSection } from "@/components/site/page-stub";
import { CONTACTS, SITE } from "@/lib/site";

/* ---------------------------------------------------------------------------
   `/about` — undesigned (D26, D39), content authored 2026-09-21 (D63) at the
   owner's request, to be reviewed and edited by them.

   **Every fact here comes from `src/lib/site.ts` or `docs/decisions.md`.**
   Nothing about the business is invented: no founding year, no staff count,
   no years-of-experience claim, no certifications, no review counts. Those
   are exactly the things `docs/decisions.md` §8 forbids inventing, and they
   are what an About page normally pads itself with. If the owner wants any
   of it, it has to come from the client.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "About",
  description: `${SITE.legalName} in ${SITE.city}, ${SITE.province}. Tires, wheels and accessories, quoted by people who confirm the fitment first.`,
};

export default function AboutPage() {
  return (
    <PageStub
      title="About"
      body={
        <>
          <StubSection title="Who we are">
            <p>
              {SITE.legalName} sells tires, wheels and accessories in{" "}
              {SITE.city}, {SITE.province}. You are dealing with the people who
              fit the parts, not a call centre.
            </p>
          </StubSection>

          <StubSection title="How we work">
            <p>
              This site quotes, it does not check out. You search by your
              vehicle or by size, we confirm the fitment against what you
              drive, and we come back with a firm price before anything is
              ordered.
            </p>
            <p>
              Every price shown is per item, in Canadian dollars, before tax
              and installation. A quote is not an order, so nothing is
              committed until you say so.
            </p>
          </StubSection>

          <StubSection title="Talk to us">
            <p>{SITE.hoursLabel}: {SITE.hours}.</p>
            <p>
              {CONTACTS.map((contact, index) => (
                <span key={contact.tel}>
                  {index > 0 ? " or " : ""}
                  {contact.name} at{" "}
                  <a
                    href={`tel:${contact.tel}`}
                    className="text-ink underline underline-offset-4 hover:text-ink-muted"
                  >
                    {contact.display}
                  </a>
                </span>
              ))}
              . You can also email{" "}
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
