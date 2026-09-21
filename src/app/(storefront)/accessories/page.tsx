import type { Metadata } from "next";

import { ResultsPage } from "@/features/results/components/results-page";

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

export const metadata: Metadata = { title: "Accessories" };

export default async function Accessories({
  searchParams,
}: PageProps<"/accessories">) {
  return <ResultsPage category="accessories" searchParams={await searchParams} />;
}
