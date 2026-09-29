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

   A cold landing stays instant: the browser itself jumps to a fragment on
   arrival, and a 4000px smooth scroll before the reader can start reading
   would only delay them.

   D92b (owner ruling "Expressive", 2026-09-29) changes one path: a
   `hashchange` — a same-page click such as the header's `Contact` while
   already on `/` — scrolls smoothly, so the reader sees the page travel to
   the section rather than cut to it. Under `prefers-reduced-motion: reduce`
   it is `"instant"`. A same-page click through `next/link` never fires
   `hashchange` (the router uses `pushState` and scrolls to the fragment
   itself), so that path is carried by `scroll-behavior: smooth` on `<html>`
   plus `data-scroll-behavior="smooth"`, which tells Next 16 to keep route
   changes instant (`layout.tsx`, `globals.css`) — measured, 0 → 4044 in one
   frame before that pair existed.
   --------------------------------------------------------------------------- */

import { useEffect } from "react";

/** Long enough for a slow stream, short enough never to fight a real scroll. */
const WINDOW_MS = 4000;

export function HashScroll() {
  useEffect(() => {
    let frame = 0;
    let cancelled = false;

    /** `smooth` only for a same-page `hashchange` (D92b); a cold load passes
     *  nothing and lands instantly. */
    function settle(smooth = false) {
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
          const behavior: ScrollBehavior =
            smooth &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "smooth"
              : /* `instant`, not `auto`: `<html>` is `scroll-behavior:smooth`
                   since D92b, and `auto` defers to that — the cold landing
                   would glide 4000px after all. */
                "instant";
          target.scrollIntoView({ behavior });
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

    /* A named handler so the listener can pass the flag and still be
       removed; `settle` itself must not receive the `HashChangeEvent` as its
       argument. */
    const onHashChange = () => settle(true);

    settle();
    window.addEventListener("hashchange", onHashChange);
    return () => {
      cancelled = true;
      cancel();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  return null;
}
