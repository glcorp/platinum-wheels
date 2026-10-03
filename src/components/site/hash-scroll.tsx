"use client";

/* ---------------------------------------------------------------------------
   HashScroll — makes `/#contact` and `/#how-it-works` work.

   The bug (D80): a fragment in the URL never scrolled anywhere. Measured in a
   production build at 1440x900, cold-loading `/#contact` left `scrollY` at 0
   for ten seconds and never moved, while the same page, once settled, scrolls
   correctly from `location.hash = "#contact"` (4032, identical to a direct
   `scrollIntoView`). So the anchors, their ids and their `scroll-mt-*` offsets
   (D66) were all fine.

   The cause was streaming, not the anchors. `(storefront)/loading.tsx` (D62)
   created a Suspense boundary, so the page below the shell arrived inside a
   `<div hidden>` and was swapped in by React afterwards. The browser resolved
   the fragment at load, found no such element in the live tree, and gave up
   long before the content landed. The same race hit a client navigation to
   `/#contact` from another route (D91b, HPD-1): Next's own fragment scroll
   ran against the skeleton.

   D91b removed `loading.tsx`, which removed that cause on both paths —
   measured on the production build, header `Contact` from `/tires` and
   footer `How it works` from `/about` land on all ten projects that failed
   (three engines, phones, tablets, 320), 180 of 180 navigations, with this
   file's code unchanged. It stays as a safety net: any
   future Suspense boundary above a section would reopen the cold-load race,
   and it costs one effect. In `next dev` a streamed hidden duplicate can
   still appear (D88), which is why it resolves the LAST matching id.

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

   D91b, second defect: a client navigation that ARRIVES on a new route with
   a fragment (`Request a quote` on a home card -> `/products/<slug>#quote`)
   sometimes stopped short of the section and stayed there (measured on the
   production build: scrollY 1558 / 1638 / 1408 / 1249 against 1486 or 1446;
   the test failed 5 of 6 on pixel-7 under five workers). Next's
   `InnerScrollHandler` (`layout-router.js`) does scroll to the fragment, inside
   `disableSmoothScrollDuringRouteTransition` (`disable-smooth-scroll.js`) —
   which sets `scroll-behavior: auto` inline so the jump is instant. But the
   handler passes `dontForceLayout: true` and the hash branch reads no layout
   before `scrollIntoView()`, so Chromium has not picked the style change up
   (the file cites vercel/next.js#40719) and the jump GLIDES; the glide is then
   cut short by layout work and the view transition (D92b) under load, and
   nothing corrects it. So `usePathname()` re-runs the settle on every
   committed route change, and the landing is `instant`: it is one bounded
   correction on that single arrival, never a follow-up, so a reader who has
   already started to scroll is not fought for the rest of the page's life.
   The same-page `hashchange` glide and the cold load are unchanged.

   D131 (owner, 2026-10-03: "if we click on the contact button once it …
   scrolls down to contact … but if we scroll up and then again click it so it
   doesn't do anything"). A click on a fragment link whose URL is EXACTLY the
   current one (`/#contact` while already on `/#contact`) scrolled nowhere.
   Next 16 treats it as a "same page navigation", not a hash change:
   `url.href === currentUrl.href` (`app-router-state.js` navigateToKnownRoute)
   makes it refetch the page segment, `onlyHashChange` is false because the
   hash did not change (`completeSoftNavigation`), the refreshed leaf only
   carries forward its old, already-consumed scroll ref (`render-tree.js`
   updateCacheNodeOnNavigation), so `InnerScrollHandler` (`layout-router.js`)
   returns on `!scrollRef.current`; and `next/link` has prevented the default,
   so the browser's own same-fragment scroll never runs and no `hashchange`
   fires either. The first click worked only because the hash changed then.
   So a capture-phase click listener on `window` (ahead of React's root on
   `document`, `scroll-reveal`'s capture listener and `next/link`) takes
   exactly that case: a plain left click on an `<a>` whose resolved URL equals
   `location.href`, hash included. It prevents the default, which makes
   `next/link` bail on `e.defaultPrevented` (`link.js` onClick) after it has
   still run the link's own `onClick` (the drawer closes), so no pointless
   refetch or transition starts, the URL and history stay exactly as Next
   would have left them (it `replaceState`s an unchanged URL), and the scroll
   runs through `settle(true)`: smooth, `instant` under reduced motion, a
   frame later so `scroll-reveal` has un-translated a pending section and the
   drawer has closed first. A focusable target (`<main tabIndex={-1}>` behind
   the skip link) also takes focus, as the browser's own fragment jump would
   give it. Every other click is untouched: a different hash on the same page
   is Next's `onlyHashChange` scroll (forced, glides under `scroll-behavior:
   smooth`), another path is a route navigation, modified clicks and
   `target`/`download` links are the browser's.
   --------------------------------------------------------------------------- */

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Long enough for a slow stream, short enough never to fight a real scroll. */
const WINDOW_MS = 4000;

export function HashScroll() {
  /* Fires once per committed route change. The layout keeps this island
     mounted across navigations, so the effect re-runs on arrival, not on a
     remount. */
  const pathname = usePathname();

  useEffect(() => {
    let frame = 0;
    let cancelled = false;

    /** `smooth` only for a same-page `hashchange` (D92b) or a same-URL click
     *  (D131); a cold load passes nothing and lands instantly. `focus` only
     *  for the click, which has prevented the browser's own fragment jump. */
    function settle(smooth = false, focus = false) {
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
          /* `preventScroll`, or the focus would cut the glide short. Only an
             element that is focusable at all: a plain section has no
             `tabindex` and stays unfocused, as it would natively. */
          if (focus && (target.tabIndex >= 0 || target.hasAttribute("tabindex"))) {
            target.focus({ preventScroll: true });
          }
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

    /* D131: a click on a link to the URL we are already on. Nobody else
       scrolls for it (see the header), so this does. */
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;
      const target = anchor.getAttribute("target");
      if (target !== null && target !== "" && target !== "_self") return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      /* Exactly the current URL, hash included. A different hash on this
         page is Next's own (working) `onlyHashChange` scroll. */
      if (url.hash.length <= 1 || url.href !== window.location.href) return;

      event.preventDefault();
      settle(true, true);
    };

    /* Cold load and client-navigation arrival alike: both land instantly. */
    settle();
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("click", onClick, true);
    return () => {
      cancelled = true;
      cancel();
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("click", onClick, true);
    };
  }, [pathname]);

  return null;
}
