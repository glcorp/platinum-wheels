"use client";

/* ---------------------------------------------------------------------------
   SiteNavDrawer — the only client island in src/components/site/ (D31).

   Full-screen mobile nav: a 44×44 hamburger trigger + a `<dialog>` drawer.
   Contents are the four nav links plus the phone CTA, stacked, per D31
   ("your call" — nothing else is drawn or specified: design/inventory/home.md
   :148 "no drawer markup exists in the export"). `<dialog showModal()>` gives
   Esc-to-close and a native focus trap for free, and returns focus to the
   trigger on close automatically.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type SiteNavDrawerLink = {
  label: string;
  href: string;
  active: boolean;
};

export function SiteNavDrawer({
  links,
  phone,
}: {
  links: ReadonlyArray<SiteNavDrawerLink>;
  phone: { display: string; tel: string };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // Body scroll lock while the drawer is open.
      document.body.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="site-nav-drawer"
        onClick={() => setOpen(true)}
        className="text-on-photo inline-flex size-11 touch-manipulation items-center justify-center bg-transparent"
      >
        {/* 22x22 three-bar icon, stroke-width 1.6, round caps — home-mobile.html:88-90 */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M3 7h18M3 12h18M3 17h18" />
        </svg>
      </button>

      <dialog
        id="site-nav-drawer"
        ref={dialogRef}
        onClose={() => setOpen(false)}
        /* Esc: `<dialog>` closes natively through the browser's close watcher,
           but that path depends on user activation and is not guaranteed in
           every embed. Handling the key explicitly keeps Esc-to-close a hard
           guarantee (docs/decisions.md §9 "overlays … close on Esc"). */
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        className="bg-bg text-ink fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col border-0 p-0 open:flex"
      >
        {/* 68px top bar echoing the header, with a 44x44 close button — D31 */}
        <div className="flex h-17 items-center justify-end px-4">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="text-ink inline-flex size-11 touch-manipulation items-center justify-center bg-transparent"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>

        <nav
          aria-label="Primary"
          className="flex flex-1 flex-col justify-between px-4 pb-4"
        >
          {/* Links: display 40px, stacked left, 16px gap — DESIGN.md §4 Nav (~line 192) */}
          <ul className="flex flex-col gap-4">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={
                    link.active
                      ? "display text-display-40 text-ink border-accent inline-block border-b-2"
                      : "display text-display-40 text-ink inline-block border-b-2 border-transparent"
                  }
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <Button href={`tel:${phone.tel}`} variant="accent" size="compact" fullWidth>
            {/* 16x16 phone icon, stroke-width 1.6 — home-desktop.html:112 */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
            </svg>
            Call {phone.display}
          </Button>
        </nav>
      </dialog>
    </>
  );
}
