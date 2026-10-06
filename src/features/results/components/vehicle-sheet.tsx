"use client";

/* ---------------------------------------------------------------------------
   VehicleSheet — the Year / Make / Model sheet on the three results pages
   (D159). It replaces the toolbar's `Change vehicle` disclosure (D45).

   Owner, 2026-10-07: "the add vehicle option should be visible clearly … a
   clear button to add. the add vehicle needs to be a same button as filter on
   mobile. They both need to be sticky", then chose a bottom sheet "same as
   Filters". The buttons that open it are plain links to `#vehicle-sheet`
   (`VehicleButton`, `vehicle-panel.tsx`): one in the mobile sticky bar, one at
   the top of the desktop filter rail. This island is the one dialog they
   open, so the finder, whose field ids must be unique (D88), renders once.

   Same dialog as the filter sheet and the cart's quote dialog: `showModal()`
   for the focus trap and Esc, `sheet-dialog` / `sheet-panel` for the slide
   (D67, D92b), centred at `--container-dialog` from `md:` like the quote
   dialog. `data-fit` lets the panel take its content's height: three fields
   do not need the filter sheet's near-full-screen panel.

   Without JavaScript a link to `#vehicle-sheet` makes the dialog the URL's
   target, and a `<noscript>` style shows it in place (not modal), with the
   close control a link back to the page. A part-filled finder submit
   (LA-05 P2) opens the sheet on load, focused on the field to finish.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, type ReactNode } from "react";

import { VEHICLE_SHEET_ID } from "@/features/results/types";
const TITLE_ID = "vehicle-sheet-title";

export interface VehicleSheetProps {
  title: string;
  /** Open on load: the results page sent back a part-filled vehicle. */
  openOnLoad?: boolean;
  /** The `VehicleFinder`, rendered on the server. */
  children: ReactNode;
}

export function VehicleSheet({ title, openOnLoad = false, children }: VehicleSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(openOnLoad);

  /* Every `#vehicle-sheet` link on the page opens the sheet. Capture phase,
     before Next's own link handling, and the hash never changes. */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest(`a[href="#${VEHICLE_SHEET_ID}"]`);
      if (!link) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.matches(":modal")) {
      // Served open for the no-JS partial case: reopen it as a modal.
      if (dialog.open) dialog.close();
      dialog.showModal();
      document.body.style.overflow = "hidden";
      // A part-filled submit: focus the first field the prompt points at.
      if (openOnLoad) {
        dialog.querySelector<HTMLElement>("select[aria-describedby]")?.focus();
      }
    } else if (!open && dialog.open) {
      dialog.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, openOnLoad]);

  const close = () => setOpen(false);

  return (
    <>
      <noscript>
        <style>{`#${VEHICLE_SHEET_ID}:target{display:flex;z-index:40}`}</style>
      </noscript>
      <dialog
        id={VEHICLE_SHEET_ID}
        ref={dialogRef}
        open={openOnLoad || undefined}
        aria-labelledby={TITLE_ID}
        data-probe="vehicle-sheet"
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
        // A click on the scrim is a click on the dialog box itself.
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="sheet-dialog backdrop:bg-scrim-mid fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col justify-end border-0 bg-transparent p-0 open:flex"
      >
        <div
          data-fit=""
          className="sheet-panel bg-surface border-border-strong flex w-full flex-col border-t md:mx-auto md:max-w-dialog md:border-x"
        >
          <div className="border-border-strong flex items-center justify-between gap-4 border-b px-4 py-5 sm:px-8">
            <h2 id={TITLE_ID} className="font-display text-display-28 leading-flat font-bold uppercase text-ink">
              {title}
            </h2>
            {/* A link, so it closes the sheet with JS off too (back to the
                page, dropping the `#vehicle-sheet` target). */}
            <a
              href="#main"
              aria-label="Close"
              onClick={(event) => {
                event.preventDefault();
                close();
              }}
              className="border-border-strong text-ink inline-flex size-11 shrink-0 touch-manipulation items-center justify-center border bg-transparent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0"
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
            </a>
          </div>
          <div className="pb-safe flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-5 sm:px-8 sm:pt-6">
            {children}
          </div>
        </div>
      </dialog>
    </>
  );
}
