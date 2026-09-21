/* ---------------------------------------------------------------------------
   FilterRail — the desktop filter aside

   `results-desktop.html:121`:
     `<aside style="display:flex;flex-direction:column;gap:32px;
       position:sticky;top:96px">`
   Its 280px width is not declared here: it is the first track of the page's
   `results-grid` (globals.css, `280px minmax(0,1fr)`), exactly as the artboard
   sets it from the parent grid.

   The `gap:32px` rides on the panel's own `<form>` (see filter-panel.tsx) so
   this stays a positioning wrapper with nothing of its own to measure.

   Server Component: it renders a client island but is not one
   (`src/features/results/llm.md`, "`use client` only on sort-select,
   filter-panel, filter-sheet").

   From `md:` (1100px) only — D46 keeps the mobile arrangement, and with it the
   sticky bar and sheet, through the whole 720–1099 band.
   --------------------------------------------------------------------------- */

import { FilterPanel } from "@/features/results/components/filter-panel";
import type { ResultsView } from "@/features/results/types";

export interface FilterRailProps {
  view: ResultsView;
}

export function FilterRail({ view }: FilterRailProps) {
  return (
    <aside
      aria-label="Filters"
      data-probe="rail"
      className="hidden md:sticky md:top-24 md:flex md:flex-col"
    >
      <FilterPanel view={view} variant="rail" idPrefix="rail" />
    </aside>
  );
}
