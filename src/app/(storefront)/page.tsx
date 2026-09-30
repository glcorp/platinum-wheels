import type { Metadata } from "next";

import { PageTransition } from "@/components/site/page-transition";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { VehicleFinder } from "@/features/finder/components/vehicle-finder";
import { BrandStrip } from "@/features/home/components/brand-strip";
import { CategoryTiles } from "@/features/home/components/category-tiles";
import { Contact } from "@/features/home/components/contact";
import { FeaturedTires } from "@/features/home/components/featured-tires";
import { Hero } from "@/features/home/components/hero";
import { HowItWorks } from "@/features/home/components/how-it-works";
import { WinterPromo } from "@/features/home/components/winter-promo";

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
   --------------------------------------------------------------------------- */

/* The featured row is read from the catalogue (D108b) through a cached read
   with a tag and no timer (`home/featured.ts`), so `/` stays prerendered and
   never waits on the database. No `revalidate` export here, on purpose: a
   timed one makes Next send `stale-while-revalidate` on `/`, which D93b
   reverted (WDG-09; owner, 2026-09-30, D111). */

export const metadata: Metadata = {
  /* The root template appends "· Platinum Wheels"; the home page carries the
     full name once, so opt out of the template. */
  title: { absolute: "Platinum Wheels and Tire Solutions — Brampton, Ontario" },
};

export default function HomePage() {
  return (
    <>
      <SiteHeader variant="over-hero" active="tires" />
      <PageTransition>
        <main id="main" tabIndex={-1} className="flex-1">
          <Hero />
          <VehicleFinder />
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
    </>
  );
}
