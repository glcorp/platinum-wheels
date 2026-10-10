import type { Metadata } from "next";

import { PageTransition } from "@/components/site/page-transition";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { HomeFinder } from "@/features/finder/components/home-finder";
import { BrandStrip } from "@/features/home/components/brand-strip";
import { CategoryTiles } from "@/features/home/components/category-tiles";
import { Contact } from "@/features/home/components/contact";
import { FeaturedTires } from "@/features/home/components/featured-tires";
import { Hero } from "@/features/home/components/hero";
import { HowItWorks } from "@/features/home/components/how-it-works";
import { WinterPromo } from "@/features/home/components/winter-promo";
import { JsonLd } from "@/features/seo/json-ld";
import { pageMetadata } from "@/features/seo/metadata";
import { organizationSchema, websiteSchema } from "@/features/seo/schema";
import { ROUTES } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   `/` — composition only (docs/decisions.md §3: routes are thin).
   Section order is design/manifest.md §1, artboard order. Each section owns
   its top spacing (56 → 80 → 120, DESIGN.md §8 "Section gap"), so the page
   adds none; the one exception is the footer's mobile wrapper
   `margin-top:56px` (home-mobile.html:335, inventory home.md:84), which on
   desktop is replaced by the contact section's own 120px bottom padding
   (home.md:77).

   The header is composed here, not inside the hero (D38): on `/` it is
   absolutely positioned over the photo (home.md:28, "not sticky"), so the
   `<header>` landmark stays before `<main>` in the DOM and the hero is just
   the first block.

   D92b motion: `<main>` and the footer ride one `PageTransition` (the header is
   pinned by its own `site-header` name and stays outside it), and
   `ScrollReveal` arms the below-the-fold sections that carry `data-reveal` —
   never the hero or the finder, and nothing at all without JS or with reduced
   motion.

   D128: on `/` only, the header's Tires / Wheels / Accessories switch the
   hero finder instead of leaving the page (`finderSwitch` on the header,
   `switchable` on the finder; both talk through `src/lib/finder-category.ts`).
   Every other page passes neither, so the same links navigate there as before.
   --------------------------------------------------------------------------- */

/* The featured row is read from the catalogue (D108b) through a cached read
   with a tag and no timer (`home/featured.ts`), so `/` stays prerendered and
   never waits on the database. No `revalidate` export here, on purpose: a
   timed one makes Next send `stale-while-revalidate` on `/`, which D93b
   reverted (WDG-09; owner, 2026-09-30, D111). */

export const metadata: Metadata = pageMetadata({
  /* The root template appends "· Platinum Wheels"; the home title already
     carries the name once, so it opts out of the template. */
  title: "Tires, Wheels and Accessories in Brampton · Platinum Wheels",
  absoluteTitle: true,
  description:
    "Brampton-based online store for tires, wheels and accessories. Search by your vehicle. We confirm the fitment and send you a quote.",
  path: ROUTES.home,
});

export default function HomePage() {
  return (
    <>
      <SiteHeader variant="over-hero" active="tires" finderSwitch />
      <PageTransition>
        <main id="main" tabIndex={-1} className="flex-1">
          <Hero />
          <HomeFinder />
          <CategoryTiles />
          <WinterPromo />
          <HowItWorks />
          <FeaturedTires />
          <BrandStrip />
          <Contact />
        </main>
        <div className="mt-14 sm:mt-20 md:mt-0">
          <SiteFooter />
        </div>
      </PageTransition>
      <ScrollReveal />
      {/* Who the business is, once, on the front door (D112). */}
      <JsonLd data={[organizationSchema(), websiteSchema()]} />
    </>
  );
}
