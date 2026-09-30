"use client";

/* ---------------------------------------------------------------------------
   FeaturedCarousel — the only client island in `src/features/home/` (D30).

   Renders the whole `featured-tires` body: header row (eyebrow + h2 + the
   prev/next controls) and the product track. It has to be one island because
   the controls and the track share state (scroll position → active dot,
   button clicks → scroll) — `docs/decisions.md` §3, D30.

   The track is a horizontal scroll-snap carousel at EVERY width (**D74**).
   It used to become a CSS grid from `sm:` and stop scrolling, which left the
   two square desktop prev/next buttons permanently inert: four SKUs in four
   columns meant `scrollWidth === clientWidth`, so `scrollBy` could never do
   anything. The owner chose to make them work rather than remove them, so
   the row grew to six SKUs (`FEATURED_SLUGS`, `../featured.ts`) and the scroller runs all the
   way up. Cards visible at rest are unchanged — 260px on mobile, 3-up on
   tablet, 4-up on desktop — because `featured-card-3` / `featured-card-4`
   reproduce exactly the width the drawn grid gave each column.

   Header row measured from `design/assets/home-desktop.html:187` (desktop)
   and `design/assets/home-mobile.html:135-141` (mobile). Track measured from
   `design/inventory/home.md:64,248,289`.

   `SectionHeading` and `ProductCard` are plain components with no
   server-only APIs, so importing them into this client file is fine — they
   simply render on the client here (see the build-spec ruling in the task
   brief; `.claude/rules/ui.md` "Server Components by default... `use client`
   only on leaf islands").
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";

import { SectionHeading } from "@/components/ui/section-heading";
import { ProductCard } from "@/features/catalog/components/product-card";
import type { Product } from "@/features/catalog/types";
import { cx } from "@/lib/cx";

/* 260px card + 12px gap — `design/inventory/home.md:64` (mobile track
   `grid-template-columns:repeat(4,260px);gap:12px`). Only a fallback now:
   the card is a fixed 260px below `sm:` but fluid above it, so the step is
   measured off the track's own children instead of assumed. A hard-coded 272
   would under-step a 340px desktop card (324 + 16) and leave the arrows
   depending on scroll-snap to tidy up after them. */
const MOBILE_CARD_WIDTH = 260;
const MOBILE_CARD_GAP = 12;
const MOBILE_STEP = MOBILE_CARD_WIDTH + MOBILE_CARD_GAP;

/* One step = one card, at whatever width the card currently is. Both children
   share an `offsetParent`, so the delta is layout, not scroll position. */
function stepSize(track: HTMLElement): number {
  const [first, second] = track.children;
  if (first instanceof HTMLElement && second instanceof HTMLElement) {
    const delta = second.offsetLeft - first.offsetLeft;
    if (delta > 0) return delta;
  }
  return MOBILE_STEP;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface FeaturedCarouselProps {
  products: readonly Product[];
}

export function FeaturedCarousel({ products }: FeaturedCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  /* Active dot derives from scroll position, `scrollLeft / SCROLL_STEP`
     rounded — `design/inventory/home.md:64` describes the dots but not the
     scroll mechanism itself (AMBIGUOUS per the inventory note); this is the
     built mechanism, D30. */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function handleScroll() {
      if (!track) return;
      const index = Math.round(track.scrollLeft / stepSize(track));
      setActiveIndex(Math.min(Math.max(index, 0), products.length - 1));
    }

    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => track.removeEventListener("scroll", handleScroll);
  }, [products.length]);

  function scrollByStep(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;

    const maxScroll = track.scrollWidth - track.clientWidth;
    /* Defensive only since D74 — the featured row is six SKUs against four
       visible at `md:` and three at `sm:`, so the track overflows at every
       width and both desktop buttons act. It still guards the case where the
       row is ever trimmed back to what fits. */
    if (maxScroll <= 0) return;

    const step = stepSize(track);

    /* Step by one card, clamped to the track's own end; wrap only from the
       end itself. The original form wrapped as soon as the *next* whole step
       would overshoot, so the final partial step was never taken and the last
       card was never fully revealed by the button — its dot never lit either.
       Reachable by swipe only, which contradicts D30 ("arrows and dot
       progress wired"). With six cards at 390 the track is 1620px against
       374px visible, so the last press travels the remaining 158px rather
       than jumping home. */
    const atEnd = track.scrollLeft >= maxScroll - 1;
    const atStart = track.scrollLeft <= 1;

    let target: number;
    if (direction === 1) {
      target = atEnd ? 0 : Math.min(track.scrollLeft + step, maxScroll);
    } else {
      target = atStart ? maxScroll : Math.max(track.scrollLeft - step, 0);
    }

    track.scrollTo({
      left: target,
      /* The global `prefers-reduced-motion` block sets
         `scroll-behavior: auto !important` (`globals.css:811-819`), but an
         explicit `behavior` in a `scrollTo()` options bag outranks the CSS
         property for that call, so the global rule does not cover this one —
         the JS check is load-bearing, not belt-and-braces. */
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  const controls = (
    <div className="flex shrink-0 items-center gap-2">
      {/* Mobile: one round "Next" affordance — `design/assets/home-mobile.html:141`.
          `rounded-full` is a whitelisted geometry exception: this is the one
          circular control the artboards draw; every other radius in the build
          is 0-4px (`design/DESIGN.md` §4/§6). */}
      <button
        type="button"
        aria-label="Next"
        onClick={() => scrollByStep(1)}
        className="border-border-strong text-ink inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border sm:hidden"
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>

      {/* Desktop: two 48×48 square buttons — `design/assets/home-desktop.html:187-188`.
          The artboard draws inert `<span>`s with no `aria-label`; real
          `<button type="button">`s with labels are the accessible choice for
          the same geometry (deviation candidate: element type only). */}
      <div className="hidden items-center gap-2 sm:flex">
        <button
          type="button"
          aria-label="Previous"
          onClick={() => scrollByStep(-1)}
          className="border-border-strong text-ink-dim inline-flex h-12 w-12 items-center justify-center border"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => scrollByStep(1)}
          className="border-ink text-ink inline-flex h-12 w-12 items-center justify-center border"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <SectionHeading
        index={3}
        eyebrow="Featured tires"
        title="Winter sets, in stock now."
        action={controls}
        className="pr-4 sm:pr-0"
      />

      {/* Track wrapper — `position:relative` so the fade can sit over it
          (`design/inventory/home.md:64`). */}
      <div className="relative">
        {/* The scroller, at every width (D74). Mobile is the drawn 260px
            track with a 12px gap (`design/inventory/home.md:64`); the
            arbitrary `grid-flow-col auto-cols-[260px]` the artboard's
            computed grid implies is banned (`.claude/rules/ui.md`), so the
            wrapper carries a fixed `w-65` and the row scroll-snaps.
            `hide-scrollbar` is the shared utility (S1, `design/reports/audit.md`
            §4) worn here and by the PDP similar-products track; it also means
            no scrollbar gutter is reserved, so `clientWidth` is the full
            container and the card calc below lands exactly.

            `sm:-mt-0.5 sm:pt-0.5` is 2px of headroom for the card's
            `hover:-translate-y-0.5` lift. `overflow-x: auto` forces
            `overflow-y` to compute to `auto`, and overflow past a scroll
            container's block-start edge is unreachable, so without this the
            hovered card's top border — the accent border that IS the hover
            state — is clipped. Margin and padding cancel, so no card, gap or
            section height moves; only the track element's own box starts 2px
            higher, and only from `sm:`, where the lift can happen at all
            (`hover:` compiles to `@media (hover: hover)`, D17). */}
        {/* `tabIndex`/`role`/`aria-label`: this is a horizontal scroll region
            at every width since D74 (below `sm:` it always was), and Chrome
            will not focus a plain scrolling `<div>`, so a keyboard user could
            not scroll it and AT announced the cards in an unnamed container.
            The arrows are the pointer alternative, not a way to reach the
            region itself. The only paint this adds is the global focus ring.
            D66, widened by D74. */}
        <div
          ref={trackRef}
          data-probe="featured-track"
          tabIndex={0}
          role="group"
          aria-label="Featured tires"
          className="hide-scrollbar flex gap-3 overflow-x-auto snap-x snap-mandatory sm:-mt-0.5 sm:gap-4 sm:pt-0.5"
        >
          {products.map((product) => (
            <div
              key={product.slug}
              /* TOKEN MISSING — `globals.css` is single-writer (D25), so
                 these two are reported, not invented, and the class names are
                 used here as the `fade-right` precedent in this same file
                 does. THE ROW RENDERS AT 260px AT DESKTOP UNTIL THEY LAND:

                 @utility featured-card-3 { flex-basis: calc((100% - 2 * 16px) / 3); }
                 @utility featured-card-4 { flex-basis: calc((100% - 3 * 16px) / 4); }

                 They reproduce, in a flex scroller, exactly the width the
                 drawn grid gave each column: `repeat(N, minmax(0,1fr))` with
                 a 16px gap is `(100% - (N-1) * 16px) / N`, and `flex-basis`
                 percentages resolve against the flex container's content box
                 — the same 100% the grid divided. Measured at 1440:
                 (1344 - 48) / 4 = 324px, the COMPUTED desktop card width at
                 `design/inventory/home.md:248`. Both bands stay fluid, which
                 a spacing-scale width such as `md:w-81` could not do.
                 `w-65` (260px) still governs below `sm:`, where no basis is
                 set — the drawn mobile card. */
              className="w-65 shrink-0 snap-start sm:featured-card-3 md:featured-card-4"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>

        {/* Mobile right fade — `design/inventory/home.md:64`:
            `linear-gradient(to right,transparent,var(--bg))`, 72px wide.
            TOKEN MISSING: @utility fade-right { background-image: linear-gradient(to right, transparent, var(--bg)); }
            Reported, not invented (`.claude/rules/ui.md`); class name used
            below as instructed. */}
        <div
          aria-hidden="true"
          className="fade-right pointer-events-none absolute inset-y-0 right-0 w-18 sm:hidden"
        />
      </div>

      {/* Dot progress, mobile only — `design/inventory/home.md:64,289`: 3px
          bars, active 28px lime, rest 12px `--border-strong`, 6px gap. **Six
          bars now, not the drawn four**, because the row is six SKUs (D74)
          and a progress readout that does not count the track is worse than
          one that does not match the artboard — `design/DEVIATIONS.md` #65.

          Still `sm:hidden`, deliberately: the desktop artboard draws no dots
          at all (`design/assets/home-desktop.html:187` is two arrows and
          nothing else, `design/inventory/home.md:248`). The arrows are the
          drawn desktop affordance and adding a second one there would be
          inventing an element no artboard contains (the D7 rule). The
          divisor is `stepSize()` rather than a constant so the readout stays
          correct if that ever changes. */}
      <div className="flex gap-1.5 pt-1 sm:hidden">
        {products.map((product, index) => (
          <span
            key={product.slug}
            aria-hidden="true"
            className={cx(
              "h-0.75",
              index === activeIndex ? "bg-accent w-7" : "bg-border-strong w-3",
            )}
          />
        ))}
      </div>
    </>
  );
}
