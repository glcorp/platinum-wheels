"use client";

/* ---------------------------------------------------------------------------
   ScrollReveal — the below-the-fold section reveal on `/` (D92b, owner ruling:
   "below-fold home sections: fade + 12px rise, 300ms, once").

   A leaf island that renders nothing. It arms `[data-reveal]` sections and
   flips them in as they cross into view; the look — opacity plus a
   `--motion-rise` translate over `--duration-reveal` — lives in globals.css
   ("D92b motion: below-the-fold scroll reveal"), keyed on the attribute value.

   Four guarantees, each of which is the reason for a line below:
     - **Never above the fold.** Only a section whose top is at or past the
       bottom of the viewport when this mounts is armed. Something the reader
       can already see is never hidden and brought back.
     - **No JS and reduced motion hide nothing.** The server renders
       `data-reveal` with no value, which globals.css treats as visible; only
       this effect ever writes `pending`, and it returns before writing when
       the visitor asked for reduced motion or the browser has no
       IntersectionObserver.
     - **Once.** A revealed section is unobserved and stays revealed; scrolling
       back up does not replay it. Cleanup flips anything still pending back to
       visible, so an unmount mid-scroll cannot strand content at opacity 0.
     - **A fragment link never lands on a translated box (D91b).** A pending
       section sits `--motion-rise` (12px) low. `/#contact` from the header or
       drawer computes its scroll target from that box, then the reveal drops
       the translate and the section ends 12px above its `scroll-margin-top`.
       So when a same-page link, `hashchange` or `popstate` targets a pending
       section (the id element, or anything inside one) it is revealed at once,
       with its transition suppressed and a reflow forced, before the browser
       or Next's router measures anything. Next scrolls a same-page hash
       itself after a `pushState`, so `hashchange` alone would never fire; the
       capture-phase click runs ahead of Next's own handler. A cold load of
       `/#contact` gets the same treatment at mount: this effect can run
       before HashScroll has scrolled, so the section holding the fragment is
       never armed and renders at rest from the start.
   --------------------------------------------------------------------------- */

import { useEffect } from "react";

export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;

    const hashTarget = () => {
      let id = location.hash.slice(1);
      if (!id) return null;
      try {
        id = decodeURIComponent(id);
      } catch {
        /* a malformed escape names nothing; use the raw text */
      }
      return document.getElementById(id);
    };

    /* The section holding a cold-load fragment is left at rest: HashScroll may
       not have scrolled yet, and arming it would translate the box it lands on. */
    const landing = hashTarget()?.closest<HTMLElement>("[data-reveal]");

    const armed = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    ).filter(
      (el) =>
        el !== landing && el.getBoundingClientRect().top >= window.innerHeight,
    );

    if (armed.length === 0) return;

    for (const el of armed) el.dataset.reveal = "pending";

    /* The bottom 10% of the viewport is excluded so a section starts its rise
       once it is properly in view, not while one pixel of it peeks in. */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.dataset.reveal = "in";
          observer.unobserve(el);
        }
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );

    for (const el of armed) observer.observe(el);

    /* Inline `transition: none` to snap, restored a frame later. Remembering
       the previous inline value (normally empty) keeps the stylesheet's own
       transition in charge once the snap is over. */
    const snapped = new Map<HTMLElement, { prev: string; frame: number }>();

    const restore = (el: HTMLElement) => {
      const entry = snapped.get(el);
      if (!entry) return;
      cancelAnimationFrame(entry.frame);
      el.style.transition = entry.prev;
      snapped.delete(el);
    };

    const revealNow = (target: Element | null) => {
      const el = target?.closest<HTMLElement>('[data-reveal="pending"]');
      if (!el) return;
      const prev = el.style.transition;
      el.style.transition = "none";
      el.dataset.reveal = "in";
      observer.unobserve(el);
      void el.offsetWidth; // commit the un-translated box before any scroll maths
      snapped.set(el, {
        prev,
        frame: requestAnimationFrame(() => restore(el)),
      });
    };

    const revealHash = () => revealNow(hashTarget());

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const anchor = (
        event.target as Element | null
      )?.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.hasAttribute("download")
      ) {
        return;
      }
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname)
        return;
      if (url.hash.length < 2) return;
      let id = url.hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        /* see hashTarget */
      }
      revealNow(document.getElementById(id));
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("hashchange", revealHash);
    window.addEventListener("popstate", revealHash);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("hashchange", revealHash);
      window.removeEventListener("popstate", revealHash);
      observer.disconnect();
      for (const el of Array.from(snapped.keys())) restore(el);
      for (const el of armed) {
        if (el.dataset.reveal === "pending") el.dataset.reveal = "in";
      }
    };
  }, []);

  return null;
}
