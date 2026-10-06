import type { Metadata } from "next";

import { redirectToCanonicalVehicle } from "@/features/finder/canonical";
import { ResultsPage } from "@/features/results/components/results-page";
import { JsonLd } from "@/features/seo/json-ld";
import { pageMetadata } from "@/features/seo/metadata";
import { categoryBreadcrumb } from "@/features/seo/schema";
import { ROUTES } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   `/tires` — the TIRES results route (`docs/decisions.md` §3: routes are
   thin). The whole composition lives in `ResultsPage`, which serves all three
   categories from one arrangement (D58); this file's entire job is to name the
   category and the title.

   D58 changed nothing observable here: same params, same sections, same
   measured geometry. `/wheels` and `/accessories` are its siblings, not its
   replacements. The URL was `/results` until D112 moved it to `/tires`; the
   feature folder, the artboards and the parity report keep the name `results`.
   --------------------------------------------------------------------------- */

/* The canonical is the bare path whatever the URL carries, so every search,
   filter and sort of this page points at one address (D112). */
export const metadata: Metadata = pageMetadata({
  title: "Tires in Brampton, ON",
  description:
    "Winter, all-season, all-weather and summer tires from a Brampton-based online store. Search by vehicle or size, then request a quote.",
  path: ROUTES.tires,
});

export default async function Tires({
  searchParams,
}: PageProps<"/tires">) {
  /* An old model name in the URL goes to the canonical one (D155). */
  const query = await searchParams;
  redirectToCanonicalVehicle(ROUTES.tires, query);
  return (
    <>
      <ResultsPage category="tires" searchParams={query} />
      <JsonLd data={categoryBreadcrumb("tires")} />
    </>
  );
}
