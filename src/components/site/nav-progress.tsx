"use client";

/* ---------------------------------------------------------------------------
   NavProgress — the thin lime bar along the top edge while a page change or a
   filter update is in flight.

   Owner, 2026-09-29, asking for a loading indicator "when it takes time to
   fetch", then approving "a thin lime progress bar along the top edge during
   any page change or filter update that takes longer than ~150ms; quick ones
   show nothing". The ~150ms is not in this file: `data-state="loading"` waits
   `--progress-delay` in CSS before it paints, so a change that settles inside
   that window flips to `done` while opacity is still 0 and nothing is seen.

   All of the look lives in globals.css (`@utility nav-progress`). This island
   only writes `data-state` — `idle` → `loading` → `done` → `idle` — directly
   on the element through a ref. There is no React state at all: the bar
   changes many times per navigation and nothing else renders from it, so a
   re-render per change would buy nothing, and writing from listeners keeps
   `react-hooks/set-state-in-effect` out of the picture entirely.

   `aria-hidden`: a screen reader already hears Next's route announcer on a
   page change, and the filter form and sort select carry `aria-busy` while
   their transition runs (D66). A decorative 2px bar would be a third,
   contentless announcement of the same event.

   Three signals START it:
     (a) A plain left click on a same-origin `<a href>` whose URL differs from
         the current one ignoring the hash. Modifier and middle clicks,
         `download`, and any `target` other than `_self` open elsewhere or
         save a file, so this page never loads anything. A hash-only link is
         a scroll (HashScroll, D80), not a load. `defaultPrevented` is
         deliberately NOT checked: `next/link` prevents the default on every
         client navigation, which is exactly the case this exists for.
     (b) A `submit` of a GET form that nobody prevented — the vehicle finder,
         and the filter form with scripting half-loaded. POST forms (the quote
         form's Server Action) are excluded; they own their pending state.
     (c) Any element gaining `aria-busy="true"`: the filter form and the sort
         select set it for the length of their `router.replace` transition
         (D66). That covers the in-page filter updates, which prevent the
         form's default and so never reach (b).

   It is DONE when all three hold, checked once per animation frame and only
   while loading:
     (1) For a click or submit start, `location.href` has moved off the URL it
         started from — the navigation committed. An aria-busy start skips
         this: `router.replace` to the same list is still a real update.
     (2) No `[data-route-loading]` element exists. That marks the wrapper of
         `(storefront)/loading.tsx`'s skeleton (D62); on a slow dynamic route
         the URL commits while the skeleton is still up, and the page is not
         loaded until the real content replaces it. The attribute is added by
         the concurrent QA pass (D91b). If it is ever absent this still ends —
         on URL commit, while a skeleton is visible — so it degrades to early,
         never to stuck.
     (3) No `[aria-busy="true"]` element exists: a transition is still running.

   Safety: 15s after the last start it goes to `done` regardless. A link that
   resolves to the current URL, a cancelled navigation, or a submit that never
   leaves must never leave the bar parked across the top of the page.

   `done` holds for 350ms — the CSS's 200ms run to full plus its 150ms fade —
   then resets to `idle`, whose lack of a transition makes the reset invisible.
   A start during that window restarts cleanly: `idle`, a forced reflow, then
   `loading`, so the delay and the trickle both run again from zero rather than
   resuming mid-fade.

   A full page load (a native GET submit, a hard navigation) simply unloads the
   page mid-bar; nothing needs handling. `pagehide` parks the bar at `idle` so
   a page restored from the back/forward cache does not come back frozen
   mid-load, and keeps the listeners, because a restored page does not re-run
   this effect.

   Reduced motion needs no branch here. The global kill collapses transition
   durations but not `transition-delay`, so the bar still waits the 150ms,
   then appears at 85% and disappears on `done` — a static indicator with no
   movement, which is what reduced motion asks for.

   Where it lives: the root layout, because layouts persist across navigations
   and this has to survive the page it is reporting on being replaced. Motion
   system: D92b ("Expressive"); the bar is pinned out of the page's view
   transition by its own `view-transition-name` in globals.css.
   --------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";

/** Matches the CSS: `--duration-state` (200ms run to 100%) plus
 *  `--duration-exit` (150ms fade), after which `idle` is safe to write. */
const DONE_HOLD_MS = 350;

/** The bar never stays up longer than this after its most recent start. */
const SAFETY_MS = 15000;

type BarState = "idle" | "loading" | "done";

/** `location.href` with the fragment removed, for "is this a real load". */
function withoutHash(href: string): string {
  const hash = href.indexOf("#");
  return hash === -1 ? href : href.slice(0, hash);
}

export function NavProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = barRef.current;
    if (node === null) return;
    /* Re-bound as a non-null type: the helpers below are hoisted function
       declarations, which do not inherit the narrowing above. */
    const bar: HTMLDivElement = node;

    let state: BarState = "idle";
    /** Bumped on every start; a pending `done → idle` reset checks it so a
     *  newer start is never wiped by an older navigation's cleanup. */
    let token = 0;
    /** The URL a click or submit started from; `null` for an aria-busy start,
     *  which does not wait for the URL to move. */
    let startHref: string | null = null;
    let startedAt = 0;
    let frame = 0;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;

    function write(next: BarState) {
      state = next;
      bar.dataset.state = next;
    }

    function stopLoop() {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
    }

    function clearReset() {
      if (resetTimer !== undefined) clearTimeout(resetTimer);
      resetTimer = undefined;
    }

    function start(fromHref: string | null) {
      startedAt = performance.now();

      if (state === "loading") {
        /* Already running: keep the bar where it is. A click or submit on top
           of a busy transition adds the URL condition; a busy flag on top of
           a click leaves the click's URL condition in place. */
        if (fromHref !== null) startHref = fromHref;
        return;
      }

      token += 1;
      clearReset();
      startHref = fromHref;

      if (state === "done") {
        /* Mid-fade: drop to zero with no transition and flush that style, so
           `loading` starts from 0 and its delay and trickle run again. */
        write("idle");
        void bar.offsetWidth;
      }

      write("loading");
      stopLoop();
      frame = requestAnimationFrame(tick);
    }

    function isSettled(): boolean {
      if (startHref !== null && window.location.href === startHref) {
        return false;
      }
      if (document.querySelector("[data-route-loading]") !== null) return false;
      if (document.querySelector('[aria-busy="true"]') !== null) return false;
      return true;
    }

    function finish() {
      stopLoop();
      startHref = null;
      write("done");

      const mine = token;
      clearReset();
      resetTimer = setTimeout(() => {
        resetTimer = undefined;
        if (token === mine && state === "done") write("idle");
      }, DONE_HOLD_MS);
    }

    function tick() {
      frame = 0;
      if (state !== "loading") return;

      if (isSettled() || performance.now() - startedAt >= SAFETY_MS) {
        finish();
        return;
      }
      frame = requestAnimationFrame(tick);
    }

    /* (a) Link clicks. Bubble phase on `document`, after `next/link` has run
       and prevented the default for a client navigation. */
    function onClick(event: MouseEvent) {
      if (event.button !== 0) return;
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
      if (url.origin !== window.location.origin) return;
      if (withoutHash(url.href) === withoutHash(window.location.href)) return;

      start(window.location.href);
    }

    /* (b) GET form submits nobody intercepted. */
    function onSubmit(event: SubmitEvent) {
      if (event.defaultPrevented) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const submitter = event.submitter;
      const method =
        (submitter instanceof HTMLButtonElement ||
        submitter instanceof HTMLInputElement) &&
        submitter.hasAttribute("formmethod")
          ? submitter.formMethod
          : form.method;
      if (method.toLowerCase() !== "get") return;

      start(window.location.href);
    }

    /* (c) Transitions announcing themselves through `aria-busy` (D66). */
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (
          record.target instanceof Element &&
          record.target.getAttribute("aria-busy") === "true"
        ) {
          start(null);
          return;
        }
      }
    });

    /* Back/forward cache: park at rest so a restored page is not frozen
       mid-bar. Listeners stay — a restored page does not re-run this. */
    function onPageHide() {
      stopLoop();
      clearReset();
      startHref = null;
      write("idle");
    }

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("pagehide", onPageHide);
    observer.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-busy"],
    });

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("pagehide", onPageHide);
      observer.disconnect();
      stopLoop();
      clearReset();
    };
  }, []);

  return (
    <div
      ref={barRef}
      aria-hidden="true"
      className="nav-progress"
      data-state="idle"
    />
  );
}
