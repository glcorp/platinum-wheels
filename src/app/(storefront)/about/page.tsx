import type { Metadata } from "next";
import type { CSSProperties } from "react";

import {
  CAPTION,
  PROSE_LINK,
  ProsePage,
  ProseSection,
} from "@/components/site/prose-page";
import { brandLogo } from "@/features/home/brand-logos";
import { pageMetadata } from "@/features/seo/metadata";
import { ROUTES } from "@/lib/routes";
import { BRANDS, PRIMARY_CONTACT, SITE } from "@/lib/site";

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
   given a place to sit — `BRANDS` (since D182 the About logo grid's own list)
   and `PRIMARY_CONTACT` (already rendered by the home contact section and
   the header CTA). Both are shown here in the same treatment their existing call sites
   use, so neither asserts anything new.

   2026-10-03 (D130), the owner's copy pass: plainer wording throughout. Two
   facts moved with it: "How we work" names the cart (D122), and "Who we are"
   no longer says the people you deal with "fit the parts", which nothing in
   `SITE` supports (D112: no shop to walk into); it now says you talk to us,
   which the contact section supports. 2026-10-11 (D161): the two named
   contacts became the shop's one number, with no personal names, and
   (D163) "Who we are" says the shop serves the GTA and surrounding areas.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = pageMetadata({
  title: "About",
  description: `${SITE.legalName} is an online store based in ${SITE.city}, ${SITE.province}, serving ${SITE.serviceArea}. We sell tires, wheels and accessories, and check the fitment before we quote.`,
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
              {/* Standalone, not inside running text, so WCAG 2.5.8's inline
                  exception does not cover its 18px line: `tap-extend` (D141). */}
              <a href={`mailto:${SITE.email}`} className={`tap-extend ${PROSE_LINK}`}>
                {SITE.email}
              </a>
            </dd>
          </div>
        </dl>
      }
    >
      <ProseSection title="Who we are">
        <p>
          {/* Client wording, 2026-10-11 (D163): "Platinum…. Deal in tires……
              serving the GTA and surrounding areas". */}
          {SITE.legalName} deals in tires, wheels and accessories, serving{" "}
          {SITE.serviceArea}. We&apos;re based in {SITE.city}, {SITE.province}.
          When you call or email, you talk to one of us.
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
          /* D182 (owner, 2026-10-11: "add more brnads and their logo like on
             the main ticker"): the 24 brands in `src/lib/site.ts` `BRANDS`,
             in its order, as a static grid of the ticker's own logo files
             (`brand-logos.ts`, D129: one colour through a mask, `--text-dim`
             at rest, `--text` on hover). The owner's statement is the logo
             permission (D129, D153). A brand with no clean vector logo shows
             its name as a text wordmark in the same cell, in the type the
             old list used: display face, 700, +0.02em. Mechanics in the
             `brand-grid` utility (`globals.css`). */
          <ul aria-label="Brands we carry" className="brand-grid">
            {BRANDS.map((brand) => {
              const logo = brandLogo(brand);
              return (
                <li key={brand} className="text-ink-dim hover:text-ink">
                  {logo === undefined ? (
                    <span
                      translate="no"
                      className="font-display leading-flat tracking-2 text-12 font-bold uppercase break-words sm:text-14 md:text-15"
                    >
                      {brand}
                    </span>
                  ) : (
                    <>
                      <span className="sr-only" translate="no">
                        {logo.name}
                      </span>
                      <span
                        aria-hidden="true"
                        data-brand="logo"
                        style={
                          {
                            "--logo-src": `url("/images/brands/${logo.slug}.svg")`,
                            "--logo-aspect": logo.aspect,
                            "--logo-scale": logo.scale,
                          } as CSSProperties
                        }
                      />
                    </>
                  )}
                </li>
              );
            })}
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
          /* The shop's one number (D161: no personal names, one number), in
             the bordered accent treatment the home contact card gives it
             (`src/features/home/components/contact.tsx`, home.md:77,331).
             The number comes from `PRIMARY_CONTACT` and is never written out
             here (`docs/decisions.md` §8). */
          <div className="flex flex-col items-start gap-2">
            <span className={CAPTION}>Phone</span>
            <a
              href={`tel:${PRIMARY_CONTACT.tel}`}
              className="numeral border-accent text-ink hover:bg-accent hover:text-on-accent rounded-ctl inline-flex h-13 w-full items-center justify-center gap-2.5 border px-5 text-16 leading-flat whitespace-nowrap no-underline sm:h-14 sm:w-auto sm:text-17"
            >
              {PRIMARY_CONTACT.display}
            </a>
          </div>
        }
      >
        <p>
          {SITE.hoursLabel}: {SITE.hours}. Call or text us, or email{" "}
          <a href={`mailto:${SITE.email}`} className={PROSE_LINK}>
            {SITE.email}
          </a>
          .
        </p>
      </ProseSection>
    </ProsePage>
  );
}
