"use client";

/* ---------------------------------------------------------------------------
   NavProgress — the loader in the centre of the screen while a page change or
   a filter update is in flight.

   Owner, 2026-09-29, asking for a loading indicator "when it takes time to
   fetch", then approving a thin lime bar along the top edge that shows only
   for waits over ~150ms, then — having not seen it — "i want a loader on
   center of screen", then "make it more stylish and premium", then "i dont
   want the box, tire is better, amke it more evident and get ride of the
   box, make the background little translucent while laoding". So it is a
   tyre: a ring of 24 tread ticks round a five-bolt hub, a lime head sweeping
   round it, `Loading` beneath — standing free in the middle of the viewport
   over a `--scrim-mid` wash, the same translucent layer the filter sheet puts
   behind itself (a flat colour, not a blur, so the no-depth rule holds).
   Clicks still pass through: the wash says "wait", it does not trap anyone.
   Centring it is a deliberate exception to the flush-left rule, made by the
   owner. The ~150ms is not in this file: `data-state="loading"` waits
   `--progress-delay` in CSS before it paints, so a change that settles inside
   that window flips to `done` while opacity is still 0 and nothing is seen.

   All of the look lives in globals.css (`@utility nav-progress`). This island
   only writes `data-state` — `idle` → `loading` → `done` → `idle` — directly
   on the element through a ref. There is no React state at all: the loader
   changes many times per navigation and nothing else renders from it, so a
   re-render per change would buy nothing, and writing from listeners keeps
   `react-hooks/set-state-in-effect` out of the picture entirely.

   `aria-hidden`: a screen reader already hears Next's route announcer on a
   page change, and the filter form and sort select carry `aria-busy` while
   their transition runs (D66). A decorative spinner would be a third,
   contentless announcement of the same event.

   Three signals START it:
     (a) A plain left click on a same-origin `<a href>` whose URL differs from
         the current one ignoring the hash. Modifier and middle clicks,
         `download`, and any `target` other than `_self` open elsewhere or
         save a file, so this page never loads anything. A hash-only link is
         a scroll (HashScroll, D80), not a load. `defaultPrevented` is
         deliberately NOT checked: `next/link` prevents the default on every
         client navigation, which is exactly the case this exists for. A
         link marked `data-no-progress` is handled in place by its island
         and never starts it (the PDP quantity cells).
     (b) A `submit` of a GET form that nobody prevented — the vehicle finder,
         and the filter form with scripting half-loaded. POST forms (the quote
         form's Server Action) are excluded; they own their pending state.
         A form marked `data-nav-progress` also counts when its default WAS
         prevented: `next/form` (the three search forms) prevents the default
         and navigates on the client, which is the same wait a link click
         is (QA SEARCH-3, D184). It starts only when the form would land on a
         different URL, so searching the text already in the URL never parks
         the loader until the 15s safety.
     (c) Any element gaining `aria-busy="true"`: the filter form and the sort
         select set it for the length of their `router.replace` transition
         (D66). That covers the in-page filter updates, which prevent the
         form's default and so never reach (b).

   It is DONE when both hold, checked once per animation frame and only
   while loading:
     (1) For a click or submit start, `location.href` has moved off the URL it
         started from — the navigation committed. An aria-busy start skips
         this: `router.replace` to the same list is still a real update.
     (2) No `[aria-busy="true"]` element exists: a transition is still running.

   Safety: 15s after the last start it goes to `done` regardless. A link that
   resolves to the current URL, a cancelled navigation, or a submit that never
   leaves must never leave a spinner parked in the middle of the page.

   `done` holds for 350ms — comfortably past the CSS's 150ms fade-out — then
   resets to `idle`. A start during that window restarts cleanly: `idle`, a
   forced reflow, then `loading`, so the 150ms delay runs again from zero
   rather than the loader resuming mid-fade.

   A full page load (a native GET submit, a hard navigation) simply unloads the
   page mid-spin; nothing needs handling. `pagehide` parks it at `idle` so
   a page restored from the back/forward cache does not come back frozen
   mid-load, and keeps the listeners, because a restored page does not re-run
   this effect.

   Reduced motion needs no branch here. The global kill collapses transition
   durations but not `transition-delay`, so the loader still waits the 150ms
   and appears; the kill also collapses the spin to a single 0.01ms turn, so
   the ring sits still — a static indicator with no movement, which is what
   reduced motion asks for.

   Where it lives: the root layout, because layouts persist across navigations
   and this has to survive the page it is reporting on being replaced. Motion
   system: D92b ("Expressive"); the loader is pinned out of the page's view
   transition by its own `view-transition-name` in globals.css.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, type CSSProperties } from "react";

/** Matches the CSS: `--duration-state` (200ms run to 100%) plus
 *  `--duration-exit` (150ms fade), after which `idle` is safe to write. */
const DONE_HOLD_MS = 350;

/* The tread ring: 24 radial ticks, like the tread blocks round a tyre or the
   marks round a tachometer. Computed once at module scope — the geometry
   never changes. Each tick is drawn twice: a `--border-strong` base, and a
   lime copy whose opacity the CSS sweeps round the ring in turn (`--i` sets
   each copy's place in the sweep), so a lit head chases clockwise with a
   fading tail. Opacity only, no colour animation. */
const TICK_COUNT = 24;
const TICKS = Array.from({ length: TICK_COUNT }, (_, i) => {
  const angle = (i / TICK_COUNT) * Math.PI * 2;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    x1: round(40 + 26 * Math.sin(angle)),
    y1: round(40 - 26 * Math.cos(angle)),
    x2: round(40 + 37 * Math.sin(angle)),
    y2: round(40 - 37 * Math.cos(angle)),
  };
});

/* Five wheel bolts round the hub. */
const BOLTS = Array.from({ length: 5 }, (_, i) => {
  const angle = (i / 5) * Math.PI * 2;
  return {
    cx: Math.round((40 + 9 * Math.sin(angle)) * 100) / 100,
    cy: Math.round((40 - 9 * Math.cos(angle)) * 100) / 100,
  };
});

/** The loader never stays up longer than this after its most recent start. */
const SAFETY_MS = 15000;

type BarState = "idle" | "loading" | "done";

/** `location.href` with the fragment removed, for "is this a real load". */
function withoutHash(href: string): string {
  const hash = href.indexOf("#");
  return hash === -1 ? href : href.slice(0, hash);
}

/** Would this GET form land on the page already showing? A GET form replaces
 *  its action's query with its own fields (as `next/form` does), so the
 *  target is the action's path plus those fields. Compared as parsed
 *  parameters, so `%20` and `+` do not make a difference. */
function landsOnCurrentUrl(form: HTMLFormElement): boolean {
  try {
    const target = new URL(form.action, window.location.href);
    const fields = new URLSearchParams();
    for (const [name, value] of new FormData(form)) {
      if (typeof value === "string") fields.append(name, value);
    }
    const current = new URL(window.location.href);
    return (
      target.origin === current.origin &&
      target.pathname === current.pathname &&
      fields.toString() === new URLSearchParams(current.search).toString()
    );
  } catch {
    return false;
  }
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
        /* Already running: keep the loader as it is. A click or submit on top
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
      /* A link a client island handles in place (the PDP quantity cells,
         2026-10-07): it changes the page without asking the server. */
      if (anchor.hasAttribute("data-no-progress")) return;

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

    /* (b) GET form submits nobody intercepted, and the opted-in `next/form`
       ones that did. */
    function onSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const optedIn = form.hasAttribute("data-nav-progress");
      if (event.defaultPrevented && !optedIn) return;

      const submitter = event.submitter;
      const method =
        (submitter instanceof HTMLButtonElement ||
        submitter instanceof HTMLInputElement) &&
        submitter.hasAttribute("formmethod")
          ? submitter.formMethod
          : form.method;
      if (method.toLowerCase() !== "get") return;

      if (optedIn && landsOnCurrentUrl(form)) return;
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
       mid-spin. Listeners stay — a restored page does not re-run this. */
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
    >
      {/* The overlay (`@utility nav-progress`) lays the translucent
          `--scrim-mid` over the page and fades in; the tyre itself is
          `LoaderMark`, shared with `/styleguide` so the reference page renders
          the real thing rather than a copy that drifts. */}
      <LoaderMark />
    </div>
  );
}

/* The tyre on its own: a ring of 24 tread ticks round a five-bolt hub, a lime
   head sweeping round it, `Loading` beneath in the label role (new copy, one
   word). Look and sweep are `@utility loader-mark`; the sweep only pauses when
   the mark sits inside an idle `nav-progress` overlay. Exported for
   `/styleguide` §12. Decorative: callers hide it from assistive tech. */
export function LoaderMark() {
  return (
    <span className="loader-mark">
      <svg viewBox="0 0 80 80" fill="none" strokeWidth={3.5}>
        <g className="stroke-ink-dim" data-base="">
          {TICKS.map((t, i) => (
            <line key={i} {...t} />
          ))}
        </g>
        <g className="stroke-accent" data-sweep="">
          {TICKS.map((t, i) => (
            <line
              key={i}
              {...t}
              style={{ "--i": i } as CSSProperties}
            />
          ))}
        </g>
        <circle cx="40" cy="40" r="15" strokeWidth={2} className="stroke-ink-dim" />
        {BOLTS.map((b, i) => (
          <circle key={i} {...b} r="2" className="fill-ink-muted" />
        ))}
      </svg>
      <span className="label text-ink-muted text-11 tracking-16">Loading</span>
    </span>
  );
}
