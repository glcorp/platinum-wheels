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
   `/privacy` — undesigned (D26, D39), content authored 2026-09-21 (D63) at the
   owner's request, recomposed 2026-09-22 ("not centered in desktop view, looks
   bland too"), then simplified the same day ("looks too much now, dont add
   On this page etc — just simple plain"): the section index and the per-
   section numbering are gone.

   **NOT LEGAL ADVICE, AND NOT LAWYER-REVIEWED.** It is an honest description
   of what this build actually does, written so the owner has something real to
   hand a lawyer rather than a blank page. Have it reviewed before launch.

   Both 2026-09-22 passes changed **structure and typesetting only**. Not one
   clause was added, widened, softened or given a new commitment: the seven
   sections below carry the same sentences D63 authored, in the same order,
   with the same meaning. Restructuring a draft is safe; authoring an
   obligation is not, and is not something this build may do.

   Every claim below was verified against the code, not assumed:
     - the collected fields are exactly `QUOTE_FIELD` in
       `src/features/cart/types.ts` (since D122), plus the cart's products,
       quantities and searched vehicles;
     - the consent checkbox renders unticked always and never accepts a
       `defaultChecked` from its call site (`docs/decisions.md` §7);
     - **no analytics, no cookies, no sessionStorage**, and two `localStorage`
       entries: the cart (`src/lib/cart.ts`, D122), described in "Cookies and
       tracking" in the same commit that added it, and since D162 the record
       of sent quote requests (time, products, quantities; no name, email,
       phone, message or vehicle), added to that paragraph in its own commit. That paragraph is the one
       factual change since D63, made because the old sentence ("stores
       nothing in your browser") became false; it adds no commitment.
     - nothing is sent anywhere yet: `actions.ts` validates and discards, with
       delivery a marked TODO (D54, parked). The wording below describes the
       intended behaviour once it is wired, which is what a visitor needs to
       know; revisit it when delivery lands.

   2026-10-03 (D130), the owner's copy pass: the wording is plainer
   (contractions, "take care of it" for "action it"), with every clause's
   meaning, scope and order kept. "What we collect" now says "products and
   quantities" in the plural, because the cart sends several (D122).

   **There is deliberately no "Updated <date>" line.** D32 requires a computed
   date and forbids a typed one, and this page has no honest source for one:
   `new Date()` would claim the policy changed today on every request, and a
   literal would be exactly the hard-coded date D32 rules out. The owner needs
   to supply the date a reviewed version takes effect, or wire it to the
   commit that last touched this file.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description: `How ${SITE.legalName} handles the information you send with a quote request.`,
  path: ROUTES.privacy,
});

/* One list of sections, mapped straight into `ProseSection`s below. */
const SECTIONS: ReadonlyArray<{
  id: string;
  title: string;
  body: ReactNode;
}> = [
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <p>
          Only what you type into a quote request: your name, email address,
          phone number, your preferred way to be contacted, and an optional
          message. We also record the products and quantities in your request,
          and the vehicle you searched with if you used the vehicle finder.
        </p>
        <p>
          We don&apos;t ask for payment details anywhere on this site, because
          nothing is sold here.
        </p>
      </>
    ),
  },
  {
    id: "why-we-collect-it",
    title: "Why we collect it",
    body: (
      <p>
        To prepare your quote, check the fitment against your vehicle and reply
        to you. We don&apos;t use it for anything else.
      </p>
    ),
  },
  {
    id: "marketing",
    title: "Marketing",
    body: (
      <p>
        The offers checkbox on the quote form is optional and starts unticked.
        If you leave it unticked, we&apos;ll only contact you about the quote
        you asked for. If you tick it, you can unsubscribe at any time, and
        every message will tell you how.
      </p>
    ),
  },
  {
    id: "cookies-and-tracking",
    title: "Cookies and tracking",
    body: (
      <p>
        This site sets no cookies and runs no analytics. It keeps two things in
        this browser&apos;s local storage, so they&apos;re still there when you
        come back. One is your cart: the products and quantities you add. It
        stays until you send a quote request. The other is a list of the quote
        requests you&apos;ve sent from this browser: when you sent each one and
        the products and quantities in it. It never holds your name, email,
        phone number or message. You can empty the cart by removing the
        products, clear the list from your cart page, or remove both by
        clearing this site&apos;s data in your browser. There is no advertising
        or third-party tracking on any page.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "Sharing",
    body: (
      <p>
        We don&apos;t sell or rent your information. We share it only when we
        have to in order to fulfil your request, for example with a supplier
        confirming stock, and only the details that are needed.
      </p>
    ),
  },
  {
    id: "your-choices",
    title: "Your choices",
    body: (
      <p>
        You can ask us what we hold about you, ask us to correct it, or ask us
        to delete it. Email{" "}
        <a href={`mailto:${SITE.email}`} className={PROSE_LINK}>
          {SITE.email}
        </a>{" "}
        and we&apos;ll take care of it.
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

export default function PrivacyPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Privacy"
      lede="What we collect when you ask for a quote, why we keep it, and how to have it removed."
    >
      {SECTIONS.map((section) => (
        <ProseSection key={section.id} title={section.title}>
          {section.body}
        </ProseSection>
      ))}
    </ProsePage>
  );
}
