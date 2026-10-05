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
   runs through `settle()`: smooth, `instant` under reduced motion, a frame
   later so `scroll-reveal` has un-translated a pending section and the
   drawer has closed first. The target also takes focus (any target since
   D145, below; only an already focusable one before). Every other click
   keeps its own scroll: a different hash on the same page is Next's
   `onlyHashChange` scroll (forced, glides under `scroll-behavior: smooth`),
   another path is a route navigation, modified clicks and
   `target`/`download` links are the browser's.

   Launch audit (D145, A11Y-MANUAL, "Fragment nav links do not move the
   keyboard's place"): the scroll moved and focus did not, so after the
   header's `Contact` a keyboard user's next Tab started from the header
   again. Every fragment ARRIVAL now also moves focus to the target, with
   `preventScroll` so it never cuts a glide short; a target that is not
   focusable gets `tabindex="-1"` for as long as it holds focus (removed on
   `blur`, so no section stays a click-focus trap). Arrivals are: a route
   change that lands on a fragment (footer `How it works` from `/about`), a
   `hashchange` (a plain `<a href="#…">`, the skip link), the D131 same-URL
   click, and a same-page click to a DIFFERENT fragment through `next/link`.
   That last one fires neither `hashchange` nor a pathname change — Next
   scrolls it itself (`onlyHashChange`, `layout-router.js`, which "leaves
   focus untouched") — so the capture listener catches it, leaves the default
   alone so Next's scroll and URL update run as before, and only focuses.
   Focus waits while a modal `<dialog>` that does not contain the target is
   still open (the drawer closes from React state; an inert target cannot
   take focus). A cold load does NOT move focus: the browser's own fragment
   jump already sets the sequential focus starting point there, and moving
   focus on first paint would ring a whole section before anyone touched the
   page. The rest of this file's scrolling is unchanged.
   --------------------------------------------------------------------------- */

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Long enough for a slow stream, short enough never to fight a real scroll. */
const WINDOW_MS = 4000;

export function HashScroll() {
  /* Fires once per committed route change. The layout keeps this island
     mounted across navigations, so the effect re-runs on arrival, not on a
     remount. */
  const pathname = usePathname();
  /* The pathname the effect last ran for. `null` on the first run (a cold
     load); a run with a different pathname is a client-navigation arrival.
     Strict Mode's double first run sees the same pathname, so it never reads
     as an arrival. */
  const lastPathname = useRef<string | null>(null);

  useEffect(() => {
    let frame = 0;
    let cancelled = false;

    const arrival =
      lastPathname.current !== null && lastPathname.current !== pathname;
    lastPathname.current = pathname;

    /** `smooth` only for a same-page `hashchange` (D92b) or a same-URL click
     *  (D131); a cold load passes nothing and lands instantly. `scroll: false`
     *  when Next already scrolls (a same-page `next/link` hash change).
     *  `focus` on every arrival except the cold load (D145). `hash` defaults
     *  to the URL's; the click path passes the link's, because Next has not
     *  pushed the new URL yet when its click listener runs. */
    function settle({
      smooth = false,
      focus = false,
      scroll = true,
      hash = window.location.hash,
    }: {
      smooth?: boolean;
      focus?: boolean;
      scroll?: boolean;
      hash?: string;
    } = {}) {
      if (hash.length <= 1) return;

      const started = performance.now();
      let scrolled = !scroll;
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
          if (!scrolled) {
            const behavior: ScrollBehavior =
              smooth &&
              !window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "smooth"
                : /* `instant`, not `auto`: `<html>` is `scroll-behavior:smooth`
                     since D92b, and `auto` defers to that — the cold landing
                     would glide 4000px after all. */
                  "instant";
            target.scrollIntoView({ behavior });
            scrolled = true;
          }
          /* A modal that does not hold the target makes it inert, so focus
             would silently fail: wait for the drawer to finish closing. */
          const modal = focus ? openModalOutside(target) : false;
          if (!focus || !modal) {
            if (focus) focusTarget(target);
            return;
          }
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
    const onHashChange = () => settle({ smooth: true, focus: true });

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
      if (url.hash.length <= 1) return;

      /* Exactly the current URL, hash included (D131): nobody scrolls, so we
         scroll and focus. */
      if (url.href === window.location.href) {
        event.preventDefault();
        settle({ smooth: true, focus: true });
        return;
      }

      /* A different hash on this same page: Next's own (working)
         `onlyHashChange` scroll, which leaves focus where it was. Default
         untouched; focus only (D145). Another path or query is a route
         change, handled on arrival by the effect below. */
      const here = new URL(window.location.href);
      if (
        url.origin === here.origin &&
        url.pathname === here.pathname &&
        url.search === here.search
      ) {
        settle({ scroll: false, focus: true, hash: url.hash });
      }
    };

    /* Cold load and client-navigation arrival alike land instantly; only an
       arrival moves focus (see the header). */
    settle({ focus: arrival });
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

/** An open modal `<dialog>` that does not contain `target` (so `target` is
 *  inert behind it). */
function openModalOutside(target: HTMLElement): boolean {
  for (const dialog of document.querySelectorAll("dialog[open]")) {
    if (dialog.matches(":modal") && !dialog.contains(target)) return true;
  }
  return false;
}

/** Focus a fragment target without scrolling. A target that is not focusable
 *  takes `tabindex="-1"` until it loses focus again, which keeps it out of the
 *  Tab order and stops a later click inside the section from focusing it. */
function focusTarget(target: HTMLElement) {
  if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener(
      "blur",
      () => target.removeAttribute("tabindex"),
      { once: true },
    );
  }
  target.focus({ preventScroll: true });
}
