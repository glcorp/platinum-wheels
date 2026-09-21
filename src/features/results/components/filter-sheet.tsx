"use client";

/* ---------------------------------------------------------------------------
   FilterSheet — the mobile `Filters (n)` trigger and its bottom sheet

   Trigger: the sticky bar's left cell (`results-mobile.html:99`).
   Sheet:   `results-mobile-filters.html:73-84`, measured in
            `design/inventory/results.md` §4.

   `<dialog showModal()>` is the same island pattern as
   `src/components/site/site-nav-drawer.tsx` (D31): a native focus trap, Esc,
   and focus returned to the trigger on close, none of it hand-rolled. Esc is
   additionally handled explicitly because the browser's close watcher depends
   on user activation (docs/decisions.md §9 "overlays … close on Esc").

   The scrim is `--scrim-mid` over the WHOLE viewport, header included, exactly
   as the artboard paints it; the export's extra `opacity:.35` on the page
   content behind it is an artefact and is not ported (D47(3)). Flat, no blur
   (results.md §6 #32).

   The panel holds `FilterPanel`; the footer's submit button lives outside that
   form and reaches it with `form="results-filter-sheet"`, which is what keeps
   the no-JS path alive — with scripting off the button is a plain GET submit.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CLEAR_ALL_CLASS, FilterPanel } from "@/features/results/components/filter-panel";
import { clearFilters, resultsHref } from "@/features/results/query";
import type { ResultsView } from "@/features/results/types";

const SHEET_FORM_ID = "results-filter-sheet";
const SHEET_ID = "results-filter-sheet-dialog";

/* The sheet belongs to the mobile arrangement, which runs to 1099px (D46); the
   rail takes over at `--breakpoint-md` (globals.css). A viewport that crosses
   that line while the sheet is open would leave a modal over a layout that no
   longer has a trigger, so the sheet closes itself. */
const RAIL_FROM = "(min-width: 1100px)";

export interface FilterSheetProps {
  view: ResultsView;
}

export function FilterSheet({ view }: FilterSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia(RAIL_FROM);
    const handle = () => {
      if (media.matches) setOpen(false);
    };
    handle();
    media.addEventListener("change", handle);
    return () => {
      media.removeEventListener("change", handle);
    };
  }, [open]);

  const { activeGroups } = view.facets;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={SHEET_ID}
        onClick={() => {
          setOpen(true);
        }}
        data-probe="filters-trigger"
        /* `height:44px; border:1px solid var(--text)` — no radius, no fill;
           `font:500 12px/1; letter-spacing:.06em; uppercase`, `gap:10px`,
           colour inherits `--text` (results-mobile.html:99). The artboard draws
           a `<span>`; this opens a dialog, so it is a button. */
        className="label inline-flex h-11 w-full touch-manipulation items-center justify-center gap-2.5 border border-ink bg-transparent text-12 tracking-6 text-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0"
      >
        {/* 16×16 sliders mark, stroke 1.6, round caps, `M4 6h16M7 12h10M10 18h4`. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="size-4 shrink-0"
        >
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {/* `Filters (3)` is the artboard's sample count. `(n)` is computed from
            the seed and the URL (D42) and the parenthetical is dropped at zero
            rather than reading `Filters (0)` (D47). */}
        {activeGroups > 0 ? `Filters (${activeGroups})` : "Filters"}
      </button>

      <dialog
        id={SHEET_ID}
        ref={dialogRef}
        aria-label="Filters"
        data-probe="sheet"
        onClose={close}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
        /* Click on the scrim = click on the dialog box itself; the panel is a
           child, so a click inside it never matches. */
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        /* `sheet-dialog` (globals.css) carries the discrete-property
           transitions the panel's slide and the backdrop's fade need on the
           exit edge — `dialog.close()` would otherwise remove the panel before
           it could travel. DESIGN.md names this motion by word: the sheet
           arrives "from the bottom". D67. */
        className="sheet-dialog backdrop:bg-scrim-mid fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col justify-end border-0 bg-transparent p-0 open:flex"
      >
        {/* Panel: bottom-anchored, full width, `background:var(--surface)`,
            `border-top:1px solid var(--border-strong)`, no radius, no side
            insets, no drag handle (results.md §4.2). `sheet-panel` is its
            measured height in dvh (globals.css). */}
        <div className="sheet-panel flex w-full flex-col border-t border-border-strong bg-surface">
          {/* Header `padding:20px 16px; border-bottom` (results.md §4.3). */}
          <div
            data-probe="sheet-header"
            className="flex items-center justify-between border-b border-border-strong px-4 py-5"
          >
            {/* Barlow Condensed 700 / 28px / line-height 1 / no tracking —
                identical to the rail title; see filter-panel.tsx for why the
                `display` utility is not used. */}
            {/* `<p>` for the same reason as the rail title — the `<dialog
                aria-label="Filters">` above already names this region. */}
            <p
              data-probe="filters-title"
              className="font-display text-display-28 leading-flat font-bold uppercase text-ink"
            >
              Filters
            </p>
            {/* Right cluster `display:flex;gap:16px;align-items:center`. */}
            <div className="flex items-center gap-4">
              <Link
                href={resultsHref(clearFilters(view.query))}
                onClick={close}
                data-probe="clear-all"
                className={CLEAR_ALL_CLASS}
              >
                Clear all
              </Link>
              {/* 44×44 box, `border:1px solid var(--border-strong)`, no radius,
                  18×18 mark stroke 1.6 round caps in `--text`. A `<span>` on the
                  artboard; it dismisses a dialog, so it is a button. */}
              <button
                type="button"
                aria-label="Close filters"
                onClick={close}
                className="inline-flex size-11 touch-manipulation items-center justify-center border border-border-strong bg-transparent text-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  className="size-4.5"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body `padding:8px 16px; flex:1` (results.md §4.4). The artboard
              declares `overflow:hidden` because it is a static 844px snapshot
              and the groups happen to fit; a real sheet scrolls. */}
          <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-2">
            <FilterPanel
              view={view}
              variant="sheet"
              idPrefix="sheet"
              formId={SHEET_FORM_ID}
              onNavigate={close}
            />
          </div>

          {/* Footer `padding:12px 16px 20px; border-top; background:--surface`
              (results.md §4.5). `pb-safe` is that 20px plus the home-indicator
              inset on notched phones (globals.css). */}
          <div
            data-probe="sheet-footer"
            className="pb-safe border-t border-border-strong bg-surface px-4 pt-3"
          >
            {/* `height:52px; background:var(--accent); color:var(--on-accent);
                border-radius:var(--radius-ctl); font:500 14px/1;
                letter-spacing:.08em; uppercase`, full width — which is exactly
                `Button` primary at `promo` (52px at mobile, 14px, +0.08em).
                The count is computed (D42); `Show 12 matches` is the artboard's
                sample number, not a shipped string. */}
            <Button
              type="submit"
              form={SHEET_FORM_ID}
              variant="primary"
              size="promo"
              fullWidth
            >
              {view.total === 1 ? "Show 1 match" : `Show ${view.total} matches`}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
