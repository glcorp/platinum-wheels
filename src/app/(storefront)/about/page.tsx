import type { Metadata } from "next";

import {
  CAPTION,
  PROSE_LINK,
  ProsePage,
  ProseSection,
} from "@/components/site/prose-page";
import { pageMetadata } from "@/features/seo/metadata";
import { ROUTES } from "@/lib/routes";
import { BRANDS, CONTACTS, SITE } from "@/lib/site";

/* ---------------------------------------------------------------------------
   `/about` — undesigned (D26, D39), content authored 2026-09-21 (D63) at the
   owner's request, recomposed 2026-09-22 on the owner's note that the page was
   "not centered in desktop view, looks bland too", then simplified the same
   day on the owner's follow-up that the result "looks too much now": the
   section numbering is gone, and the fact band and the two `wide` lists below
   stay because each is real content already shown elsewhere in the build, not
   decoration added for this page.

   **Every fact here comes from `src/lib/site.ts` or `docs/decisions.md`.**
   Nothing about the business is invented: no founding year, no staff count,
   no years-of-experience claim, no certifications, no review counts. Those
   are exactly the things `docs/decisions.md` §8 forbids inventing, and they
   are what an About page normally pads itself with. If the owner wants any
   of it, it has to come from the client.

   No new facts at any point. What changed is structure: a 12-column page
   header, a full-width fact band read out of `SITE`, four plain side-head
   sections instead of four stacked 420px blocks, and two existing data sets
   given a place to sit — `BRANDS` (already rendered on `/` by `BrandStrip`)
   and `CONTACTS` (already rendered by the home contact section and the header
   CTA). Both are shown here in the same treatment their existing call sites
   use, so neither asserts anything new.

   2026-10-03 (D130), the owner's copy pass: plainer wording throughout. Two
   facts moved with it: "How we work" names the cart (D122), and "Who we are"
   no longer says the people you deal with "fit the parts", which nothing in
   `SITE` supports (D112: no shop to walk into); it now says you talk to us,
   which the two named `CONTACTS` do support.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = pageMetadata({
  title: "About",
  description: `${SITE.legalName} is an online store based in ${SITE.city}, ${SITE.province}. We sell tires, wheels and accessories, and check the fitment before we quote.`,
  path: ROUTES.about,
});

export default function AboutPage() {
  return (
    <ProsePage
      eyebrow={SITE.legalName}
      title="About"
      lede={`Tires, wheels and accessories in ${SITE.city}, ${SITE.province}. You ask for a price, one of us checks it fits your vehicle, and we get back to you with a firm number.`}
      meta={
        /* Three facts, each read straight out of `SITE`. A `<dl>` because they
           are term/value pairs; the wrapping `<div>`s are what the spec allows
           for grouping a pair. */
        <dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <dt className={CAPTION}>Location</dt>
            <dd className="text-ink leading-relaxed text-15 sm:text-16">
              {SITE.city}, {SITE.province}
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className={CAPTION}>{SITE.hoursLabel}</dt>
            {/* Tabular, because it is a time range (DESIGN.md §3 Numerals). */}
            <dd className="numeral text-ink leading-relaxed text-15 sm:text-16">
              {SITE.hours}
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className={CAPTION}>Email</dt>
            <dd className="leading-relaxed text-15 sm:text-16">
              <a href={`mailto:${SITE.email}`} className={PROSE_LINK}>
                {SITE.email}
              </a>
            </dd>
          </div>
        </dl>
      }
    >
      <ProseSection title="Who we are">
        <p>
          {SITE.legalName} sells tires, wheels and accessories in {SITE.city},{" "}
          {SITE.province}. When you call or email, you talk to us, not a call
          centre.
        </p>
      </ProseSection>

      <ProseSection title="How we work">
        <p>
          There&apos;s no checkout on this site. You search by your vehicle or
          by size, add what you need to your cart and ask for a quote. We check
          it fits what you drive and get back to you with a firm price before
          anything is ordered.
        </p>
        <p>
          Any price shown is per item, in Canadian dollars, before tax and
          installation. A quote isn&apos;t an order, so nothing is final until
          you say so.
        </p>
      </ProseSection>

      <ProseSection
        title="What we sell"
        wide={
          /* The same twelve names, in the same order, that `BrandStrip`
             already renders on `/` (`src/lib/site.ts` `BRANDS`; house brands
             first, then the majors — do not reorder). Text wordmarks, not
             logos: the brands are separate trademarks and no licensed
             monochrome marks exist (D63, `docs/decisions.md` §8). The strip's
             own type treatment is reused: display face, 700, +0.02em, no
             `display` utility, because these marks carry positive tracking
             rather than the display role's -0.015em. */
          <ul
            aria-label="Brands we carry"
            className="flex flex-wrap gap-x-8 gap-y-3"
          >
            {BRANDS.map((brand) => (
              <li
                key={brand}
                className="font-display text-ink-dim leading-flat tracking-2 text-display-20 font-bold whitespace-nowrap uppercase sm:text-display-24"
              >
                {brand}
              </li>
            ))}
          </ul>
        }
      >
        <p>
          We sell tires, wheels and accessories. You search all three the same
          way, by your vehicle or by size, and every search ends with a quote
          from one of us.
        </p>
        <p>
          We quote wheels per wheel, tires per tire and accessories per item.
          These are the brands we carry.
        </p>
      </ProseSection>

      <ProseSection
        title="Talk to us"
        wide={
          /* Both named contacts, in the bordered accent treatment the home
             contact cards already give a phone number
             (`src/features/home/components/contact.tsx`, home.md:77,331).
             Numbers come from `CONTACTS` and are never written out here
             (`docs/decisions.md` §8). */
          <ul className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:gap-8">
            {CONTACTS.map((contact) => (
              <li key={contact.tel} className="flex flex-col items-start gap-2">
                <span className={CAPTION}>{contact.name}</span>
                <a
                  href={`tel:${contact.tel}`}
                  className="numeral border-accent text-ink hover:bg-accent hover:text-on-accent rounded-ctl inline-flex h-13 w-full items-center justify-center gap-2.5 border px-5 text-16 leading-flat no-underline sm:h-14 sm:w-auto sm:text-17"
                >
                  {contact.display}
                </a>
              </li>
            ))}
          </ul>
        }
      >
        <p>
          {SITE.hoursLabel}: {SITE.hours}. Call either of us, or email{" "}
          <a href={`mailto:${SITE.email}`} className={PROSE_LINK}>
            {SITE.email}
          </a>
          .
        </p>
      </ProseSection>
    </ProsePage>
  );
}
