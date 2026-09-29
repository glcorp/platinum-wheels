"use client";

/* ---------------------------------------------------------------------------
   ScrollReveal — the below-the-fold section reveal on `/` (D92, owner ruling:
   "below-fold home sections: fade + 12px rise, 300ms, once").

   A leaf island that renders nothing. It arms `[data-reveal]` sections and
   flips them in as they cross into view; the look — opacity plus a
   `--motion-rise` translate over `--duration-reveal` — lives in globals.css
   ("D92 motion: below-the-fold scroll reveal"), keyed on the attribute value.

   Three guarantees, each of which is the reason for a line below:
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
   --------------------------------------------------------------------------- */

import { useEffect } from "react";

export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;

    const armed = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    ).filter((el) => el.getBoundingClientRect().top >= window.innerHeight);

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

    return () => {
      observer.disconnect();
      for (const el of armed) {
        if (el.dataset.reveal === "pending") el.dataset.reveal = "in";
      }
    };
  }, []);

  return null;
}
