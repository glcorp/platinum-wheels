import type { Metadata } from "next";

import { PageTransition } from "@/components/site/page-transition";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SearchForm } from "@/features/search/components/search-form";
import { SearchResults } from "@/features/search/components/search-results";
import { hasCriteria, parseSearch } from "@/features/search/parse";
import { searchCatalog } from "@/features/search/queries";

/* ---------------------------------------------------------------------------
   `/search?q=` — composition only (`docs/decisions.md` §3). D173.

   Free-text search: a tire or wheel size, a bolt pattern, a part number, or
   brand and model words (`src/features/search/llm.md`). A plain GET page, so
   it works with JS off. Never indexed and never in a sitemap (D112): a search
   result is a page of other pages; the `robots` here wins over the site-wide
   one in both flag states, as `/cart`'s does. No nav item is current.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Search",
  description: "Search tires, wheels and accessories by size, part number or brand.",
  robots: { index: false, follow: false },
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = await searchParams;
  const parsed = parseSearch(first(params.q));
  const outcome = hasCriteria(parsed) ? await searchCatalog(parsed) : null;

  return (
    <>
      <SiteHeader variant="solid" />
      <PageTransition>
        <main id="main" tabIndex={-1} className="flex-1">
          <div className="px-4 pt-8 pb-14 sm:px-8 sm:pt-12 md:px-12 md:pb-30">
            <div className="flex flex-col gap-8 sm:gap-10 lg:mx-auto lg:max-w-content">
              <div className="flex flex-col gap-6 sm:gap-8">
                <h1 className="display text-ink text-display-56 sm:text-display-88">Search</h1>
                <div className="w-full max-w-dialog">
                  {/* Focused only when there is nothing typed yet, so a
                      result page does not raise the phone keyboard over it. */}
                  <SearchForm query={parsed.text} autoFocus={parsed.text === ""} />
                </div>
              </div>
              <SearchResults query={parsed.text} parsed={parsed} outcome={outcome} />
            </div>
          </div>
        </main>
        <SiteFooter />
      </PageTransition>
    </>
  );
}
