"use client";

/* ---------------------------------------------------------------------------
   HashScroll — makes `/#contact` and `/#how-it-works` work.

   The bug (D80): a fragment in the URL never scrolled anywhere. Measured in a
   production build at 1440x900, cold-loading `/#contact` left `scrollY` at 0
   for ten seconds and never moved, while the same page, once settled, scrolls
   correctly from `location.hash = "#contact"` (4032, identical to a direct
   `scrollIntoView`). So the anchors, their ids and their `scroll-mt-*` offsets
   (D66) were all fine.

   The cause is streaming, not the anchors. `(storefront)/loading.tsx` (D62)
   creates a Suspense boundary, so the page below the shell arrives inside a
   `<div hidden>` and is swapped in by React afterwards. The browser resolves
   the fragment at load, finds no such element in the live tree, and gives up
   long before the content lands. Nothing retries it.

   In `next dev` the same mechanism is visible as two copies of the section —
   the streamed one and the hydrated one — where `getElementById` returns the
   hidden, zero-height copy. That duplication is dev-only; production serves
   exactly one. Both are the same root cause.

   This waits for the target instead of assuming it exists: it retries across
   animation frames until the element is in the live tree and has a box, with
   a bounded window so a fragment that never resolves cannot spin. It also
   handles `hashchange`, which covers the header's own `/#contact` link.

   Deliberately no smooth scroll: `prefers-reduced-motion` aside, a fragment
   landing should be instant, and MOTION_INTENSITY is 3.
   --------------------------------------------------------------------------- */

import { useEffect } from "react";

/** Long enough for a slow stream, short enough never to fight a real scroll. */
const WINDOW_MS = 4000;

export function HashScroll() {
  useEffect(() => {
    let frame = 0;
    let cancelled = false;

    function settle() {
      const hash = window.location.hash;
      if (hash.length <= 1) return;

      const started = performance.now();
      cancel();

      const tick = () => {
        if (cancelled) return;

        /* `querySelectorAll(...).at(-1)` rather than `getElementById`: while a
           stream is mid-swap the hidden copy comes first in tree order, and
           the live one is always last. */
        const matches = document.querySelectorAll(
          `[id="${CSS.escape(hash.slice(1))}"]`,
        );
        const target = matches.item(matches.length - 1);

        if (target instanceof HTMLElement && target.offsetParent !== null) {
          target.scrollIntoView();
          return;
        }
        if (performance.now() - started < WINDOW_MS) {
          frame = requestAnimationFrame(tick);
        }
      };

      frame = requestAnimationFrame(tick);
    }

    function cancel() {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
    }

    settle();
    window.addEventListener("hashchange", settle);
    return () => {
      cancelled = true;
      cancel();
      window.removeEventListener("hashchange", settle);
    };
  }, []);

  return null;
}
