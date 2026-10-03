"use client";

/* ---------------------------------------------------------------------------
   SiteNavLinks — the header's desktop link row (visible from `md:`), split out
   of `site-header.tsx` as a leaf island for D128.

   Owner, 2026-10-03: on the home page the header's Tires / Wheels /
   Accessories "should stay on the home page and refresh that part only", and
   the chosen option: "Header nav switches it, home only". So with
   `finderSwitch` (passed by `/` alone) an unmodified left click on one of the
   three category links switches the hero finder (`src/lib/finder-category.ts`)
   instead of navigating; the active marker follows the finder. Everywhere else
   this renders exactly what the header rendered before, and the links
   navigate.

   The links stay real `<a href>`s, so nothing depends on this script: with JS
   off, or before hydration, a click goes to the category page as always, and a
   Ctrl/Cmd/Shift/Alt or middle click still opens it in a new tab or window.
   The switch is a native listener on the anchor that stops the click at its
   target, so neither `next/link`'s navigation nor the loader's document
   listener (`nav-progress.tsx`, which deliberately ignores `defaultPrevented`)
   ever sees it. Contact is never intercepted.

   Semantics on `/` (D128): the chosen category carries `aria-current="true"`,
   "the current item in a set", not `"page"`: the page is still home. Each of
   the three carries `aria-controls` → the finder form and an
   `aria-describedby` hint, rendered once by `site-header.tsx`, that says what
   activating it does here; the finder then announces "Searching wheels".
   `aria-pressed` is not used: it belongs to buttons, and these must stay links.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { useDeferredValue, ViewTransition } from "react";
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

export type NavItemId = "tires" | "wheels" | "accessories" | "contact";

export type SiteNavItem = { id: NavItemId; label: string; href: string };

/**
 * A callback ref that switches the finder on a plain left click and lets
 * every other click through. (The drawer does the same with one listener on
 * its dialog, because it must close before it switches.)
 */
function finderSwitchRef(onSwitch: () => void) {
  return (node: HTMLAnchorElement | null) => {
    if (!node) return;
    const onClick = (event: MouseEvent) => {
      if (!isPlainPrimaryClick(event)) return;
      event.preventDefault();
      event.stopPropagation();
      onSwitch();
    };
    node.addEventListener("click", onClick);
    return () => node.removeEventListener("click", onClick);
  };
}

export function SiteNavLinks({
  items,
  active,
  finderSwitch = false,
}: {
  items: ReadonlyArray<SiteNavItem>;
  /** The route's own current item (`SiteHeader`'s `active`). */
  active?: NavItemId;
  /** `/` only: the category links switch the hero finder (D128). */
  finderSwitch?: boolean;
}) {
  const finderCategory = useFinderCategory();
  /* The store updates synchronously (`useSyncExternalStore`), and a
     synchronous update never runs a view transition. Deferring the value
     re-renders the row in a transition, so the indicator's `<ViewTransition>`
     pair forms and the lime bar travels to the new item, as it does between
     routes (D92b). Off `/` the value is unused. */
  const shownCategory = useDeferredValue(finderCategory);
  const current: NavItemId | undefined = finderSwitch ? shownCategory : active;

  return items.map((item) => {
    const isActive = item.id === current;
    const switchTo: FinderCategory | null =
      finderSwitch && isFinderCategory(item.id) ? item.id : null;
    return (
      <Link
        key={item.id}
        href={item.href}
        ref={switchTo ? finderSwitchRef(() => setFinderCategory(switchTo)) : undefined}
        aria-controls={switchTo ? FINDER_FORM_ID : undefined}
        aria-describedby={switchTo ? FINDER_SWITCH_HINT_ID : undefined}
        /* label text-13 tracking-10 py-2 border-b-2 — home-desktop.html:102-108.
           Active: text-on-photo + border-accent. Inactive: the artboard's
           rgba(244,244,245,.68) is the `--color-on-photo-muted` token (home.md:393)
           is a Tailwind v4 opacity modifier on the token; flagged for
           emission verification in the build report. Hover is the global
           `a:hover` → --text-muted, implemented here as hover:text-ink-muted
           on inactive links only; the base layer eases it over
           `--duration-feedback` since D92b (DEVIATIONS #75).

           D92b (DEVIATIONS #76): inactive links add `nav-rule`, a 2px
           `--border-strong` rule that draws in from the left on hover
           in the slot the active underline occupies. The active link's
           drawn `border-accent border-b-2` becomes `border-b-2
           border-transparent` plus a `nav-indicator` span — the same
           2px `--accent` bar at the same `bottom:-2px`, so the box is
           byte-identical — because only an element of its own can be
           named and carried between items by a view transition.

           `prefetch={true}`: a shared `nav-indicator` morph only forms
           if the destination renders in the same transition. A route
           that is not ready at the click renders nothing new yet, and
           the incoming half of the pair never exists
           (vercel-react-view-transitions, references/nextjs.md "When
           Content Must Be Ready"). A full prefetch makes the three
           category pages ready before the click. (This comment used
           to name `loading.tsx`'s skeleton as the cause; that file was
           removed in D91b, and the prefetch still earns its place.) */
        prefetch={true}
        aria-current={isActive ? "true" : undefined}
        className={
          isActive
            ? "label text-13 tracking-10 text-on-photo relative border-b-2 border-transparent py-2"
            : "label text-13 tracking-10 text-on-photo-muted hover:text-ink-muted nav-rule border-b-2 border-transparent py-2 active:opacity-70"
        }
      >
        {item.label}
        {isActive ? (
          /* The span must be the boundary's direct child, and `share`
             must be explicit: `default="none"` would otherwise resolve
             the pair to none and the bar would never travel. */
          <ViewTransition name="nav-indicator" share="auto" default="none">
            <span aria-hidden="true" className="nav-indicator" />
          </ViewTransition>
        ) : null}
      </Link>
    );
  });
}
