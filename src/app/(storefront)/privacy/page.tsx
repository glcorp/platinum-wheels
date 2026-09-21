import type { Metadata } from "next";

import { PageStub, StubSection } from "@/components/site/page-stub";
import { SITE } from "@/lib/site";

/* ---------------------------------------------------------------------------
   `/privacy` — undesigned (D26, D39), content authored 2026-09-21 (D63) at the
   owner's request.

   **NOT LEGAL ADVICE, AND NOT LAWYER-REVIEWED.** It is an honest description
   of what this build actually does, written so the owner has something real to
   hand a lawyer rather than a blank page. Have it reviewed before launch.

   Every claim below was verified against the code, not assumed:
     - the collected fields are exactly `QUOTE_FIELD` in
       `src/features/product/types.ts`, plus the vehicle trio the finder puts
       in the URL;
     - the consent checkbox renders unticked always and never accepts a
       `defaultChecked` from its call site (`docs/decisions.md` §7);
     - **no analytics, no cookies, no localStorage, no sessionStorage** —
       grepped across `src/`, zero hits. If any of that is ever added, this
       page changes in the same commit.
     - nothing is sent anywhere yet: `actions.ts` validates and discards, with
       delivery a marked TODO (D54, parked). The wording below describes the
       intended behaviour once it is wired, which is what a visitor needs to
       know; revisit it when delivery lands.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Privacy",
  description: `How ${SITE.legalName} handles the information you send with a quote request.`,
};

export default function PrivacyPage() {
  return (
    <PageStub
      title="Privacy"
      body={
        <>
          <StubSection title="What we collect">
            <p>
              Only what you type into a quote request: your name, email
              address, phone number, your preferred way to be contacted, and
              an optional message. We also record which product you asked
              about, the quantity, and the vehicle you selected if you used
              the vehicle finder.
            </p>
            <p>
              We do not ask for payment details anywhere on this site, because
              nothing is sold here.
            </p>
          </StubSection>

          <StubSection title="Why we collect it">
            <p>
              To prepare your quote, confirm the fitment against your vehicle,
              and reply to you. That is the only reason.
            </p>
          </StubSection>

          <StubSection title="Marketing">
            <p>
              The offers checkbox on the quote form is optional and starts
              unticked. If you leave it unticked we will only contact you about
              the quote you asked for. If you tick it, you can unsubscribe at
              any time, and every message will tell you how.
            </p>
          </StubSection>

          <StubSection title="Cookies and tracking">
            <p>
              This site sets no cookies, runs no analytics, and stores nothing
              in your browser. There is no advertising or third-party tracking
              on any page.
            </p>
          </StubSection>

          <StubSection title="Sharing">
            <p>
              We do not sell or rent your information. We share it only where
              we have to in order to fulfil your request, such as with a
              supplier confirming stock, and only the detail that is needed.
            </p>
          </StubSection>

          <StubSection title="Your choices">
            <p>
              You can ask us what we hold about you, ask us to correct it, or
              ask us to delete it. Email{" "}
              <a
                href={`mailto:${SITE.email}`}
                className="text-ink underline underline-offset-4 hover:text-ink-muted"
              >
                {SITE.email}
              </a>{" "}
              and we will action it.
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
