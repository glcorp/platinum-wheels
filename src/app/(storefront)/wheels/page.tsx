import type { Metadata } from "next";

import { redirectToCanonicalVehicle } from "@/features/finder/canonical";
import { ResultsPage } from "@/features/results/components/results-page";
import { JsonLd } from "@/features/seo/json-ld";
import { pageMetadata } from "@/features/seo/metadata";
import { categoryBreadcrumb } from "@/features/seo/schema";
import { ROUTES } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   `/wheels` — the WHEELS results route (D58). Was a `PageStub` until
   2026-09-21; the owner put wheels in scope with the instruction to keep them
   "same as tires … only filters and skus change", so it is now the same
   `ResultsPage` with a different category.

   What differs, and only this: the seed is `WHEELS`, the size group filters on
   Diameter / Width / Bolt pattern instead of Width / Profile / Rim, the chip
   row is Finish instead of Season, the price label reads `Price per wheel`,
   and a vehicle in the URL derives a bolt pattern rather than a tire size.
   All of it is read from `CATEGORY_CONFIG` — no layout, primitive, utility or
   measured value is duplicated or forked.
   --------------------------------------------------------------------------- */

/* The canonical is the bare path whatever the URL carries, so every search,
   filter and sort of this page points at one address (D112). */
export const metadata: Metadata = pageMetadata({
  title: "Wheels in Brampton, ON",
  description:
    "Wheels by diameter, width and bolt pattern from a Brampton-based online store. Search by vehicle, then request a quote.",
  path: ROUTES.wheels,
});

export default async function Wheels({ searchParams }: PageProps<"/wheels">) {
  /* An old model name in the URL goes to the canonical one (D155). */
  const query = await searchParams;
  redirectToCanonicalVehicle(ROUTES.wheels, query);
  return (
    <>
      <ResultsPage category="wheels" searchParams={query} />
      <JsonLd data={categoryBreadcrumb("wheels")} />
    </>
  );
}
