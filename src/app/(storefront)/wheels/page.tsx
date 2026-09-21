import type { Metadata } from "next";

import { ResultsPage } from "@/features/results/components/results-page";

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

export const metadata: Metadata = { title: "Wheels" };

export default async function Wheels({ searchParams }: PageProps<"/wheels">) {
  return <ResultsPage category="wheels" searchParams={await searchParams} />;
}
