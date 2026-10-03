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
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import type { NavItemId } from "@/components/site/site-nav-links";
import {
  FINDER_FORM_ID,
  FINDER_SWITCH_HINT_ID,
  isFinderCategory,
  isPlainPrimaryClick,
  type FinderCategory,
} from "@/lib/finder-category";
import {
  setFinderCategory,
  useFinderCategory,
} from "@/lib/finder-category-store";

/* NJR-5 (D91b, owner ruling 2026-09-30 "Menu jumps to footer nav"). The drawer
   is a JS `<dialog>`, so with scripting off the trigger used to be a visible,
   focusable, inert button. Until the island hydrates the trigger is now a link
   to the footer's nav columns (`id="site-footer-nav"` in `site-footer.tsx`),
   the one place the primary nav is reachable without JS. `useSyncExternalStore`
   is the hydration signal: the server snapshot is `false`, the client's is
   `true`, so the first client render still matches the server markup and no
   effect has to set state (`react-hooks/set-state-in-effect`). Same classes,
   same icon, same name "Menu", so the two elements paint identically. */
const subscribeNever = () => () => {};
const isHydrated = () => true;
const notHydrated = () => false;

const TRIGGER_CLASS =
  "text-on-photo inline-flex size-11 touch-manipulation items-center justify-center bg-transparent active:translate-y-px";

const MENU_ICON = (
  /* 22x22 three-bar icon, stroke-width 1.6, round caps — home-mobile.html:88-90 */
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
);

export type SiteNavDrawerLink = {
  id: NavItemId;
  label: string;
  href: string;
  active: boolean;
};

export function SiteNavDrawer({
  links,
  phone,
  finderSwitch = false,
}: {
  links: ReadonlyArray<SiteNavDrawerLink>;
  phone: { display: string; tel: string };
  /** `/` only (D128): the three category links switch the hero finder. */
  finderSwitch?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const hydrated = useSyncExternalStore(subscribeNever, isHydrated, notHydrated);
  const finderCategory = useFinderCategory();
  /* D128: a category tapped in the drawer on `/`, held until the drawer has
     closed. The effect below closes the dialog (which hands focus back to the
     Menu button and lifts the scroll lock) and only then switches the
     finder, so the finder's scroll-into-view runs on an unlocked page that
     nothing will move again. Not the dialog's `close` event: Chrome holds
     that event back while the tab is hidden, so it is not a reliable cue. */
  const pendingSwitch = useRef<FinderCategory | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // Body scroll lock while the drawer is open.
      document.body.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
      const next = pendingSwitch.current;
      pendingSwitch.current = null;
      if (next) setFinderCategory(next);
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  /* D128, `/` only: one listener on the dialog for the three category links
     (`data-finder-switch`). A plain tap is stopped there, before it reaches
     `next/link`'s handler or the loader's document listener, and closes the
     drawer with the category held for the effect above. A modified click
     falls through and opens the category page, as everywhere else. Same rule
     as the desktop row (`site-nav-links.tsx`). */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!finderSwitch || !dialog) return;
    const onClick = (event: MouseEvent) => {
      if (!isPlainPrimaryClick(event) || !(event.target instanceof Element)) return;
      const category = event.target
        .closest("a[data-finder-switch]")
        ?.getAttribute("data-finder-switch");
      if (!isFinderCategory(category)) return;
      event.preventDefault();
      event.stopPropagation();
      pendingSwitch.current = category;
      setOpen(false);
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, [finderSwitch]);

  return (
    <>
      {hydrated ? (
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="site-nav-drawer"
          onClick={() => setOpen(true)}
          /* `active:translate-y-px` — the boxed-control press (D92b). */
          className={TRIGGER_CLASS}
        >
          {MENU_ICON}
        </button>
      ) : (
        <a href="#site-footer-nav" aria-label="Menu" className={TRIGGER_CLASS}>
          {MENU_ICON}
        </a>
      )}

      <dialog
        id="site-nav-drawer"
        aria-label="Menu"
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
        /* Opacity only, 150ms in / 120ms out on the house easing. The whole
           viewport used to hard-cut to a different opaque full-screen surface,
           so on a first open you could not tell whether you had navigated.
           Deliberately NOT a slide: the design names no drawer direction, and
           inventing a spatial story is the reflex to avoid. D67. */
        className="bg-bg text-ink fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col overscroll-contain border-0 p-0 opacity-100 transition-[opacity,display,overlay] duration-150 ease-[var(--ease-card)] transition-discrete open:flex starting:opacity-0 not-open:opacity-0 not-open:duration-[120ms]"
      >
        {/* 68px top bar echoing the header, with a 44x44 close button — D31 */}
        <div className="flex h-17 items-center justify-end px-4">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="text-ink inline-flex size-11 touch-manipulation items-center justify-center bg-transparent active:translate-y-px"
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

        {/* `pb-safe` (globals.css), not `pb-4`: the drawer is full-bleed
            `inset-0 h-dvh`, so the bottom `tel:` CTA sat 16px off the viewport
            edge and fell under the home indicator on a notched phone
            (docs/decisions.md §5 makes the inset a project rule; the filter
            sheet already used this utility). D66, 2026-09-22. This moves the
            base padding 16px → 20px, which needs no DEVIATIONS row: the drawer
            is undrawn and its layout is the coordinator's call (D31). No left,
            right or top inset — a landscape-notch utility does not exist and is
            reserved for the owner. */}
        <nav
          aria-label="Primary"
          className="flex flex-1 flex-col justify-between px-4 pb-safe"
        >
          {/* Links: display 40px, stacked left, 16px gap — DESIGN.md §4 Nav (~line 192).
              `active:opacity-70` is the text-link press (D92b). */}
          <ul className="flex flex-col gap-4">
            {links.map((link) => {
              /* On `/` the three categories switch the finder (D128): the
                 active one is the finder's, and a plain tap closes the drawer
                 and switches instead of navigating. Same semantics as the
                 desktop row (`site-nav-links.tsx`). Any other link, and any
                 modified click, navigates as before. */
              const switchTo =
                finderSwitch && isFinderCategory(link.id) ? link.id : null;
              const isActive = switchTo ? switchTo === finderCategory : link.active;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    data-finder-switch={switchTo ?? undefined}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? "true" : undefined}
                    aria-controls={switchTo ? FINDER_FORM_ID : undefined}
                    aria-describedby={switchTo ? FINDER_SWITCH_HINT_ID : undefined}
                    className={
                      isActive
                        ? "display text-display-40 text-ink border-accent inline-block border-b-2 active:opacity-70"
                        : "display text-display-40 text-ink inline-block border-b-2 border-transparent active:opacity-70"
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
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
