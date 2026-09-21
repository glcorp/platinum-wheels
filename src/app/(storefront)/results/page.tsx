import type { Metadata } from "next";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { CallCtaPanel } from "@/features/results/components/call-cta-panel";
import { FilterRail } from "@/features/results/components/filter-rail";
import { FilterSortBar } from "@/features/results/components/filter-sort-bar";
import { ResultsGrid } from "@/features/results/components/results-grid";
import { ResultsToolbar } from "@/features/results/components/results-toolbar";
import { searchResults } from "@/features/results/search";

/* ---------------------------------------------------------------------------
   `/results` — composition only (`docs/decisions.md` §3: routes are thin).
   Section order is `design/inventory/results.md` §1, artboard order.

   The page is URL-driven (D44): `searchParams` in, one `ResultsView` out, and
   every section renders from it. Nothing here is a client component; the three
   islands are leaves inside `SortSelect`, `FilterPanel` and `FilterSheet`.

   Chrome is composed per page, not hoisted into a group layout (D38): the
   header is `solid` here, over-hero on `/`.

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
   --------------------------------------------------------------------------- */

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage({
  searchParams,
}: PageProps<"/results">) {
  const view = searchResults(await searchParams);

  return (
    <>
      <SiteHeader variant="solid" active="tires" />
      <main id="main" tabIndex={-1} className="flex-1">
        <ResultsToolbar view={view} />
        {/* Mobile sticky filter/sort bar — owns its own `margin-top:16px` and
            sticky offset (`results.md` §2.3). */}
        <FilterSortBar view={view} />
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
    </>
  );
}
