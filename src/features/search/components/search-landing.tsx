"use client";

import { useEffect } from "react";

/* ---------------------------------------------------------------------------
   SearchLanding — moves focus to the results after a search made from the
   header (QA SEARCH-8, WCAG 2.4.3). Leaf island, renders nothing.

   A header search is a client navigation: the box or panel unmounts and
   focus falls to `<body>`, so a keyboard or screen-reader user starts again
   from the top of the page. The header forms (`site-search.tsx`) leave a
   timestamp in sessionStorage under `LANDING_KEY` when they submit; this
   reads it once per query and focuses the page's count line
   (`#search-summary`, the live region, which reads out what was found). The
   key is spelled in both files because neither may import the other (D37).
   A flag older than `FRESH_MS` is stale and ignored, so a later plain visit
   to `/search` never steals focus. The page's own field is not involved: it
   keeps focus on its own submit. No JS, no storage: nothing happens and the
   browser's own focus handling applies.
   --------------------------------------------------------------------------- */

const LANDING_KEY = "pw-search-landing";
const FRESH_MS = 10_000;

export function SearchLanding({ query }: { query: string }) {
  useEffect(() => {
    let fresh = false;
    try {
      const stamp = Number(window.sessionStorage.getItem(LANDING_KEY));
      window.sessionStorage.removeItem(LANDING_KEY);
      fresh = stamp > 0 && Date.now() - stamp < FRESH_MS;
    } catch {
      return;
    }
    if (!fresh) return;
    const summary = document.getElementById("search-summary");
    if (summary !== null && summary.textContent !== "") summary.focus({ preventScroll: true });
  }, [query]);
  return null;
}
