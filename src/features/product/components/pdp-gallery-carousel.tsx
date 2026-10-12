"use client";

/* ---------------------------------------------------------------------------
   PdpGalleryCarousel — the product page's gallery when a product has more
   than one photo (D167). Owner, 2026-10-11: "if the product has multiple
   images, then on the product page, multiple images should be displayed".

   A leaf island in the `FeaturedCarousel` mould (D30, D74): the slides and
   the thumbnails are server markup handed in as nodes, and the island keeps
   only what needs state: which photo is showing, the arrows, the counter and
   the thumbnails' current mark.

   - The track is a native horizontal scroll-snap row, one photo a slide, so
     a touch swipe, a trackpad and (with the track focused) the arrow keys
     move it with no JavaScript at all.
   - With JavaScript: Prev / Next buttons on the photo, ArrowLeft / ArrowRight
     / Home / End on the focused track, a `2 / 5` counter, and from 1100 a row
     of thumbnails under the photo (owner, 2026-10-11: "Arrows + thumbnails").
     Prev on the first photo goes to the last and Next on the last to the
     first, as the home carousel's arrows do.
   - The arrows and the counter sit ON the photo, never under it, so the box
     keeps the height `pdp-gallery-band` gives it (D151, D153): `Add to cart`
     still ends on a phone's first screen.

   - The card-to-product morph (D92b, D144) ends on whichever slide is
     showing (D184, owner 2026-10-13: "Back morph from any photo"): every slide
     sits in a `<ViewTransition>` but only the current one carries the shared
     name, so the name is on one element at a time. A visit starts on photo 1,
     so a card still lands on the first slide; the crumb's `product-back` flies
     the photo that is on screen.

   The box classes come from the caller, so the frame, the band and the badge
   overlay stay written once, in `pdp-gallery.tsx`.
   --------------------------------------------------------------------------- */

import {
  ViewTransition,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cx } from "@/lib/cx";

/** One gallery per page, so a constant id is unique; the arrows and the
 *  thumbnails name it with `aria-controls`. */
const TRACK_ID = "pdp-gallery-track";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface PdpGalleryCarouselProps {
  /** The photo box's own classes (frame, band height, margins). */
  boxClassName: string;
  /** One node per photo, in order. The first holds the picture, the card-size
   *  underlay and the vignette (D144); each is wrapped here in the morph. */
  slides: readonly ReactNode[];
  /** The shared-element name the showing slide takes (`product-photo-<slug>`,
   *  the card's name). */
  morphName: string;
  /** One thumbnail image per photo, same order. Shown from 1100. */
  thumbs: readonly ReactNode[];
  /** Product name, for the region's and the controls' accessible names. */
  name: string;
  /** Overlaid on the box, after the controls (the mobile badge row). */
  overlay?: ReactNode;
}

export function PdpGalleryCarousel({
  boxClassName,
  slides,
  thumbs,
  name,
  morphName,
  overlay,
}: PdpGalleryCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  /* The photo a button or key asked for, while the smooth scroll travels
     there. Without it the scroll events of that journey reported the slides
     it passed, so a second press during the glide acted on one of those
     (measured: Next, Prev, Prev ended on photo 1, not 3). Cleared on
     arrival, or after a second if the reader took over mid-way. */
  const pendingRef = useRef<{ target: number; timer: number } | null>(null);
  const count = slides.length;

  /* The showing photo follows the scroll position, so a swipe, a trackpad
     and the buttons all agree. One slide is the track's full width. */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    function onScroll() {
      if (!track || track.clientWidth === 0) return;
      const pending = pendingRef.current;
      if (pending !== null) {
        if (Math.abs(track.scrollLeft - pending.target * track.clientWidth) > 1) return;
        window.clearTimeout(pending.timer);
        pendingRef.current = null;
      }
      const next = Math.round(track.scrollLeft / track.clientWidth);
      setIndex(Math.min(Math.max(next, 0), count - 1));
    }
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (pendingRef.current !== null) window.clearTimeout(pendingRef.current.timer);
    };
  }, [count]);

  function go(target: number) {
    const track = trackRef.current;
    if (!track) return;
    const wrapped = (target + count) % count;
    if (pendingRef.current !== null) window.clearTimeout(pendingRef.current.timer);
    pendingRef.current = {
      target: wrapped,
      timer: window.setTimeout(() => {
        pendingRef.current = null;
      }, 1000),
    };
    /* An explicit `behavior` outranks the global reduced-motion rule for
       this call, so the check is load-bearing (`featured-carousel.tsx`). */
    track.scrollTo({
      left: wrapped * track.clientWidth,
      behavior: prefersReducedMotion() ? "instant" : "smooth",
    });
    setIndex(wrapped);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: count - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    go(target);
  }

  /* 44px square controls on the photo: the arrows' `--scrim-strong` ground
     keeps the glyph readable over a white product shot; the vocabulary
     (border, hover to ink, press) is the home carousel's (WDG-13, D92b). */
  const arrow =
    "border-border-strong bg-scrim-strong text-ink hover:border-ink absolute top-1/2 z-20 -mt-5.5 inline-flex h-11 w-11 items-center justify-center border active:translate-y-px";

  return (
    <>
      <div className={boxClassName}>
        {/* `tabIndex`: Chrome does not focus a plain scrolling `<div>`, and
            the arrow keys act on the focused track (D66 precedent). */}
        <div
          ref={trackRef}
          id={TRACK_ID}
          data-probe="pdp-gallery-track"
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label={`${name} photos`}
          onKeyDown={onKeyDown}
          className="hide-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          {slides.map((slide, position) => (
            <div
              // Photos are a fixed, ordered list for the life of the page.
              key={position}
              role="group"
              aria-roledescription="slide"
              aria-label={`Photo ${position + 1} of ${count}`}
              className="relative h-full w-full shrink-0 snap-start snap-always"
            >
              <ViewTransition
                name={position === index ? morphName : undefined}
                share="morph"
                default="none"
              >
                <div className="relative h-full w-full">{slide}</div>
              </ViewTransition>
            </div>
          ))}
        </div>
        {/* The arrows, the counter and the thumbnails only work with
            JavaScript, so a visitor without it does not see them
            (`noscript:` is `@media (scripting: none)`): the track still
            swipes and scrolls. They are server-rendered for everyone else,
            so the thumbnail row is in the first paint and nothing below the
            gallery moves when the island hydrates. The wrapper is static and
            boxless; its children position against the photo box. */}
        <div className="noscript:hidden">
            <button
              type="button"
              aria-label="Previous photo"
              aria-controls={TRACK_ID}
              onClick={() => go(index - 1)}
              className={cx(arrow, "left-3")}
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next photo"
              aria-controls={TRACK_ID}
              onClick={() => go(index + 1)}
              className={cx(arrow, "right-3")}
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            {/* The position, `2 / 5`. Not a live region: the slide's own
                "Photo 2 of 5" name is what a screen reader meets. */}
            <p
              aria-hidden="true"
              data-probe="pdp-gallery-count"
              className="bg-scrim-strong text-ink text-12 leading-flat absolute right-3 bottom-3 z-20 px-2 py-1.5 font-medium tabular-nums"
            >
              {`${index + 1} / ${count}`}
            </p>
        </div>
        {overlay}
      </div>
      {/* From 1100: one thumbnail a photo, eight to a row (a product holds at
          most eight, `MAX_PHOTOS_PER_PRODUCT`), under the box in the column
          the desktop artboard leaves for it (`gap:12px`, D53(4)). */}
      {/* `hidden md:block` on the outer box, so below 1100 it is no flex item
          at all and adds no 12px gap under the photo (the phone's fold rule,
          D153); the inner grid carries the no-JS hide. */}
      <div className="hidden md:block">
        <div
          data-probe="pdp-gallery-thumbs"
          className="noscript:hidden grid grid-cols-8 gap-3"
        >
          {thumbs.map((thumb, position) => (
            <button
              // Same fixed list as the slides.
              key={position}
              type="button"
              aria-label={`Show photo ${position + 1} of ${count}`}
              aria-controls={TRACK_ID}
              aria-current={position === index ? "true" : undefined}
              onClick={() => go(position)}
              className={cx(
                "bg-bg relative aspect-square overflow-hidden border active:translate-y-px",
                /* Forced colours map `--accent` and `--border` to the same
                   `CanvasText`, so the current thumbnail also takes a thicker
                   `Highlight` frame there (QA GATE-2, D184; the quantity cell's
                   treatment, `globals.css` forced-colours block). */
                position === index
                  ? "border-accent forced-colors:border-[3px] forced-colors:border-[Highlight]"
                  : "border-border hover:border-ink-dim",
              )}
            >
              {thumb}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
