import type { Metadata } from "next";

import { redirectToCanonicalVehicle } from "@/features/finder/canonical";
import { ResultsPage } from "@/features/results/components/results-page";
import { JsonLd } from "@/features/seo/json-ld";
import { pageMetadata } from "@/features/seo/metadata";
import { categoryBreadcrumb } from "@/features/seo/schema";
import { ROUTES } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   `/accessories` — the ACCESSORIES results route (D58). Was a `PageStub` until
   2026-09-21.

   The one structural difference across the three categories lands here: an
   accessory has no size, so `CATEGORY_CONFIG.accessories.size` is `null` and
   the filter rail draws FOUR groups instead of five — Category, Type, Brand,
   Price per item. Owner's ruling, 2026-09-21: most accessories fit everything,
   so a `Fits` select would be a filter that filters nothing. The group shells
   already stack, so nothing else moves; logged in `design/DEVIATIONS.md`.
   --------------------------------------------------------------------------- */

/* The canonical is the bare path whatever the URL carries, so every search,
   filter and sort of this page points at one address (D112). */
export const metadata: Metadata = pageMetadata({
  title: "Wheel Accessories Across Canada",
  description:
    "Lug nuts, wheel locks, TPMS sensors, centre caps and more from an online store serving customers across Canada. Request a quote on any item.",
  path: ROUTES.accessories,
});

export default async function Accessories({
  searchParams,
}: PageProps<"/accessories">) {
  /* An old model name in the URL goes to the canonical one (D155). */
  const query = await searchParams;
  redirectToCanonicalVehicle(ROUTES.accessories, query);
  return (
    <>
      <ResultsPage category="accessories" searchParams={query} />
      <JsonLd data={categoryBreadcrumb("accessories")} />
    </>
  );
}
