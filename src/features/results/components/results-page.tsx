import { PageTransition } from "@/components/site/page-transition";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { CATEGORY_CONFIG } from "@/features/catalog/categories";
import type { ProductCategory } from "@/features/catalog/types";
import { CallCtaPanel } from "@/features/results/components/call-cta-panel";
import { FilterRail } from "@/features/results/components/filter-rail";
import { FilterSortBar } from "@/features/results/components/filter-sort-bar";
import { ResultsGrid } from "@/features/results/components/results-grid";
import { ResultsToolbar } from "@/features/results/components/results-toolbar";
import { VehiclePanel } from "@/features/results/components/vehicle-panel";
import { searchResults } from "@/features/results/search";
import type { RawSearchParams } from "@/features/results/types";
import { FINDER_CATEGORIES } from "@/lib/finder-category";
import { categoryHref } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   ResultsPage — the whole results composition, once, for all three categories.

   D58. The owner's instruction was "keep them same as tires … only filters and
   skus change but everything else remains as it is", so there is exactly one
   arrangement and the three routes differ only in the `category` they pass:
   `/tires` (tires), `/wheels`, `/accessories`. Three copies of this JSX would
   be three things to keep in parity with one artboard; one component is one.

   `docs/decisions.md` §3 keeps routes thin, and they stay thin — each
   `page.tsx` is an export, a `metadata` object and a single call to this.

   Everything below is the measured `/tires` composition, moved verbatim from
   `src/app/(storefront)/tires/page.tsx` and unchanged. Section order is
   `design/inventory/results.md` §1, artboard order.

   The page is URL-driven (D44): `searchParams` in, one `ResultsView` out, and
   every section renders from it. Nothing here is a client component; the three
   islands are leaves inside `SortSelect`, `FilterPanel` and `FilterSheet`.

   Chrome is composed per page, not hoisted into a group layout (D38): the
   header is `solid` here, over-hero on `/`. `active` follows the category, so
   the nav marks Tires, Wheels or Accessories.

   Layout: mobile stacks the sections (each owns its own side padding and top
   spacing); from `md:` 1100 the rail and the results column become the drawn
   two-column grid — `padding:40px 48px 0; grid-template-columns:280px 1fr;
   gap:48px; align-items:start` (`results-desktop.html:119`, the `results-grid`
   utility in globals.css). The tablet band 720-1099 keeps the mobile
   arrangement (D46) with 32px page padding (DESIGN.md §8).

   Footer spacing: the mobile artboard wraps the footer in `margin-top:56px`
   (`results-mobile.html:302`); on desktop the load-more row's own
   `padding-bottom:120px` (`results-desktop.html:498`) does that job, so the
   wrapper adds nothing from `md:`.

   Route motion (D92b): `<main>` and the footer wrapper sit directly inside
   `PageTransition`, the page-level type-keyed `<ViewTransition>` that slides
   the page on a `nav-forward` / `nav-back` link. No wrapper element between
   them and it — a VT only animates DOM nodes it directly precedes. The header
   stays outside: chrome is not part of the slide. The wrapper lives here,
   not in a layout, because a layout persists across navigations and its
   enter/exit never fire.
   --------------------------------------------------------------------------- */

export interface ResultsPageProps {
  category: ProductCategory;
  /** The route's own `await searchParams`. */
  searchParams: RawSearchParams;
}

export async function ResultsPage({
  category,
  searchParams,
}: ResultsPageProps) {
  const view = await searchResults(category, searchParams);
  /* D158 (owner, 2026-10-06): switching category keeps the searched vehicle,
     in the header and in the mobile tabs below. */
  const vehicle = view.query.vehicle;
  const tabs = FINDER_CATEGORIES.map((id) => ({
    id,
    label: CATEGORY_CONFIG[id].crumb,
    href: categoryHref(CATEGORY_CONFIG[id].route, vehicle),
  }));

  return (
    <>
      <SiteHeader variant="solid" active={CATEGORY_CONFIG[category].nav} vehicle={vehicle} />
      <PageTransition>
        <main id="main" tabIndex={-1} className="flex-1">
          <ResultsToolbar view={view} />
          {/* Mobile sticky bar — owns its own `margin-top:16px` and sticky
              offset (`results.md` §2.3). Since D159 it also pins the category
              tabs (D158: below `md:` the header folds them into the menu) and
              the vehicle button beside `Filters`. Hidden from `md:`. */}
          <FilterSortBar view={view} tabs={tabs} active={category} />
          {/* The vehicle sheet (D159), once per page: the mobile bar's and the
              desktop rail's vehicle buttons both open it. */}
          <VehiclePanel query={view.query} />
          <div className="md:px-12 md:pt-10">
            <div className="md:results-grid lg:mx-auto lg:max-w-content">
              <FilterRail view={view} />
              <ResultsGrid view={view} />
            </div>
          </div>
          <CallCtaPanel />
        </main>
        <div className="mt-14 md:mt-0">
          <SiteFooter />
        </div>
      </PageTransition>
    </>
  );
}
