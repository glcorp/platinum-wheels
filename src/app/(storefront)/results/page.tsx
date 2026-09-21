import type { Metadata } from "next";

import { ResultsPage } from "@/features/results/components/results-page";

/* ---------------------------------------------------------------------------
   `/results` — the TIRES results route (`docs/decisions.md` §3: routes are
   thin). The whole composition lives in `ResultsPage`, which serves all three
   categories from one arrangement (D58); this file's entire job is to name the
   category and the title.

   This route is unchanged by D58 in every observable way: same URL, same
   params, same sections, same measured geometry. `/wheels` and `/accessories`
   are its siblings, not its replacements.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = { title: "Results" };

export default async function Results({
  searchParams,
}: PageProps<"/results">) {
  return <ResultsPage category="tires" searchParams={await searchParams} />;
}
