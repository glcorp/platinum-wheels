"use client";

/* ---------------------------------------------------------------------------
   FeaturedCarousel — the only client island in `src/features/home/` (D30).

   Renders the whole `featured-tires` body: header row (eyebrow + h2 + the
   prev/next controls) and the product track. It has to be one island because
   the controls and the track share state (scroll position → active dot,
   button clicks → scroll) — `docs/decisions.md` §3, D30.

   Mobile is the functional carousel: native horizontal scroll with
   scroll-snap, one round "Next" button and a 4-dot progress row, wired to
   real scroll position (D30, owner: "a) native scroll + snap, functional").
   From `sm:` (720px) the track becomes a CSS grid (3-up tablet, 4-up
   desktop) and stops scrolling; the two square prev/next buttons stay as
   drawn and are a no-op — `scrollBy` on a non-overflowing track does nothing.

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
   `grid-template-columns:repeat(4,260px);gap:12px`). One scroll step moves
   exactly one card. */
const CARD_WIDTH = 260;
const CARD_GAP = 12;
const SCROLL_STEP = CARD_WIDTH + CARD_GAP;

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
      const index = Math.round(track.scrollLeft / SCROLL_STEP);
      setActiveIndex(Math.min(Math.max(index, 0), products.length - 1));
    }

    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => track.removeEventListener("scroll", handleScroll);
  }, [products.length]);

  function scrollByStep(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;

    const maxScroll = track.scrollWidth - track.clientWidth;
    /* Nothing to scroll (sm:+ grid, or a track that already fits) — the
       square desktop buttons are drawn but inert, exactly as spec'd. */
    if (maxScroll <= 0) return;

    let target = track.scrollLeft + direction * SCROLL_STEP;
    if (direction === 1 && target > maxScroll - 1) {
      target = 0; // wraps to the start — spec: "wraps to 0 at the end"
    } else if (direction === -1 && target < 0) {
      target = maxScroll;
    }

    track.scrollTo({
      left: target,
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
        {/* Mobile: `flex gap-3 overflow-x-auto snap-x snap-mandatory` — the
            arbitrary `grid-flow-col auto-cols-[260px]` the artboard's computed
            grid implies is banned (`.claude/rules/ui.md`), so this is the
            token-only equivalent: each wrapper is a fixed `w-65` (260px) and
            the row scroll-snaps. `hide-scrollbar` is the shared utility (added
            for audit finding S1, `design/reports/audit.md` §4) used here and
            by the PDP similar-products track to hide the native scrollbar on
            both functional carousels.
            Tablet: `sm:grid sm:grid-cols-3 sm:gap-4` (DESIGN.md §8 "3-up");
            the 4th card wraps to a second row, which reads fine here.
            Desktop: `md:grid-cols-4 md:gap-4 md:overflow-visible`. */}
        {/* `tabIndex`/`role`/`aria-label`: below `sm:` this is a horizontal
            scroll region, and Chrome will not focus a plain scrolling `<div>`,
            so a keyboard user could not scroll it and AT announced four cards
            in an unnamed container. The `Next` button is the tap alternative
            the gesture rule wants, but not a way to reach the region itself.
            The only paint this adds is the global focus ring. D66. */}
        <div
          ref={trackRef}
          data-probe="featured-track"
          tabIndex={0}
          role="group"
          aria-label="Featured tires"
          className="hide-scrollbar flex gap-3 overflow-x-auto snap-x snap-mandatory sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible md:grid-cols-4"
        >
          {products.map((product) => (
            <div
              key={product.slug}
              /* `sm:w-auto` extends the spec's `md:w-auto` down to `sm:`: the
                 track already becomes a CSS grid at `sm:` (tablet 3-up), so a
                 wrapper still pinned to the mobile 260px width would fight the
                 grid track's own column width from 720px up, not just from
                 1100px. Implementation refinement, not a design change — the
                 260px card only exists on the horizontally-scrolling mobile
                 track. */
              className="w-65 shrink-0 snap-start sm:w-auto"
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

      {/* Dot progress, mobile only — `design/inventory/home.md:64,289`: four
          3px bars, active 28px lime, rest 12px `--border-strong`, 6px gap. */}
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
