"use client";

/* ---------------------------------------------------------------------------
   LoadMoreLanding — after `Load more`, put the reader and keyboard focus on
   the first card it added. D133 (owner, 2026-10-03). Renders nothing.

   The defect. With a size or a vehicle the page has two lists, and `Load more`
   sits under the second one (`Similar matches`) while one press grows both:
   best by 24, similar from 3 to 12 (D108b, D109(2)). `scroll={false}` (D68)
   held the scroll position, so the 24 new best cards were inserted ABOVE the
   similar row, off-screen above the reader, and what the reader saw change was
   the similar row. Focus stayed on `Load more`, now far from anything new, or
   fell to `<body>` when the press used up the list and the link unmounted
   (`src/features/results/llm.md` Open 7, from D68).

   The fix, in two halves:

   1. No JavaScript needed for the scroll. The `Load more` href carries a
      fragment naming the first card the press adds (`?show=30#result-7`, or
      `#similar-4` when only the similar row grows), and every results card
      carries a positional id (`result-N`, `similar-N`, 1-based). Without JS
      the link is a plain GET and the browser lands on that card itself, under
      the sticky bar thanks to the D91b `scroll-padding-top`, plus the card's
      own `scroll-mt-*`.

   2. With JavaScript, `Load more` keeps `scroll={false}`, so Next does not
      scroll at all, and this island does it instead, together with the one
      thing no markup can do: moving focus to the new card's product link
      (the card's one announced route, D57/D66). Why not let Next scroll to
      the fragment: a search-param change keeps the pathname, so `HashScroll`
      (`src/components/site/hash-scroll.tsx`), which re-lands Next's
      cross-route fragment scroll on every PATHNAME change because that
      scroll can glide short under `scroll-behavior: smooth` (D91b), would
      never re-run here, and the same glide would go uncorrected. One owner
      for the scroll, with `behavior: "instant"`, removes the glide instead of
      correcting it, and works the same under reduced motion.

   Why a layout effect. Every `Load more` is a React transition and the cards
   carry keyed `<ViewTransition>`s (D92b). React runs layout effects before the
   new view-transition snapshot is taken, so the scroll lands first and the
   arrivals then rise in place in the viewport, staggered from the first new
   card (its index modulo 6 is 0 for `result-25`, `result-49` …). A passive
   effect would scroll underneath a running transition and cut to the new
   position after it ended. Next updates the URL in an insertion effect
   (`app-router.js` HistoryUpdater), which runs before this, so
   `location.hash` is already the new fragment here.

   Why a click listener. The landing must happen only after a `Load more`
   press: never on a cold load (the browser already jumped to the fragment),
   never on Back / Forward to a `#result-N` URL, never on a filter change
   (the islands' `resultsHref` carries no fragment). So the press records the
   fragment it asked for, and the next commit that changes `show` honours it
   only if the URL still carries it, then forgets it either way. Since D175
   `May also fit` has its own `Show more` (`?similar=`), so the trigger is the
   pair of windows, `show:similar`, and either press lands.
   --------------------------------------------------------------------------- */

import { useEffect, useLayoutEffect } from "react";

/** The marker `results-grid.tsx` puts on the `Load more` link. Not exported:
 *  a Server Component importing it would receive a client reference. */
const LOAD_MORE_ATTR = "data-load-more";

/** The fragment the last `Load more` press asked for, `result-7`, or `null`.
 *  Module scope, not a ref, so a remount between press and commit keeps it. */
let pendingId: string | null = null;

export interface LoadMoreLandingProps {
  /** `show:similar` (D175). Every `Load more` and `Show more` press changes it. */
  windows: string;
}

export function LoadMoreLanding({ windows }: LoadMoreLandingProps) {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest(`a[${LOAD_MORE_ATTR}]`);
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const hash = new URL(anchor.href, window.location.href).hash;
      /* The ids are plain ASCII (`result-7`), so the raw fragment is the id. */
      pendingId = hash.length > 1 ? hash.slice(1) : null;
    };
    /* Capture, so the press is recorded before `next/link` starts the
       navigation; a keyboard Enter on the link fires `click` too. */
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useLayoutEffect(() => {
    const id = pendingId;
    if (id === null) return;
    pendingId = null;
    if (window.location.hash !== `#${id}`) return;

    const card = document.getElementById(id);
    if (card === null) return;

    /* `instant`, not `auto`: `<html>` is `scroll-behavior: smooth` since D92b
       and `auto` defers to it, which is the glide this file exists to avoid.
       The offset is CSS: `scroll-padding-top` under the sticky bar below
       1100 (D91b) plus the card's `scroll-mt-*`. */
    card.scrollIntoView({ behavior: "instant", block: "start" });

    /* The card's product link (`data-card-link`, `product-card.tsx`), or the
       card itself as a last resort so focus can never fall to `<body>`.
       `preventScroll`, because the scroll above already placed it. */
    const link = card.querySelector<HTMLElement>("[data-card-link]");
    if (link !== null) {
      link.focus({ preventScroll: true });
    } else {
      card.tabIndex = -1;
      card.focus({ preventScroll: true });
    }
  }, [windows]);

  return null;
}
