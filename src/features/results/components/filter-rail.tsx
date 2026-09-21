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

   --- Why it is also a scroll container (D68) -------------------------------
   Sticky alone is not enough once the panel is taller than the space under the
   sticky offset. Measured at 1440×700: the rail is 735px against 604px
   (700 − 96), so it pins at `top:96` with its Brand and Price groups 131px
   below the fold and the page scrolling *underneath* them — they only come
   into view once the page has scrolled nearly to its end. That is the reported
   bug: "i cant individually scroll on the filters, need to get bottom of the
   page to scroll there". `md:filter-rail` (globals.css) caps the box at the
   space the sticky offset leaves and gives it its own scroller. At heights
   where the panel already fits — 1440×900, every route — a `max-height` a box
   is under is inert, and the form and all 22 controls measure identically with
   and without it, so nothing drawn moves.
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
      className="hidden md:sticky md:top-24 md:flex md:flex-col md:filter-rail"
    >
      <FilterPanel view={view} variant="rail" idPrefix="rail" />
    </aside>
  );
}
