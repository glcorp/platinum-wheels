/* ---------------------------------------------------------------------------
   BrandStrip — a ticker of real brand logos on the drawn band. Server
   Component, no JS (D129).

   The band is as drawn: `margin-top:120px;background:var(--surface-2);
   border-top/bottom:1px solid var(--border);padding:40px 48px` desktop,
   `margin-top:56px;padding:20px 16px` mobile — `design/inventory/home.md:70,
   306-308,343-345` — with `sm:px-8 sm:mt-20` in the tablet band (D41).

   What sits inside it changed (D129, owner 2026-10-03: *"get the actual brand
   logo and add it there … it could be a moving strip … like a ticker"*). The
   drawn twelve text wordmarks in a grid — and with them D91b's six-column
   rule for the undrawn bands (DEVIATIONS #82) — are replaced by nineteen
   famous tire and wheel brands from the loaded catalogue
   (`../brand-logos.ts`), painted one muted ink that brightens on hover, and
   scrolling right to left forever. `BRANDS` in `src/lib/site.ts` is no longer
   read here; /about still uses it.

   Mechanics live in the `brand-marquee` utility (`globals.css`, "Brand
   marquee (D129)"): the track holds the list twice and slides exactly one
   list, so the loop has no seam; the second copy is `aria-hidden` and holds
   nothing focusable. WCAG 2.2.2: a visible pause control (native checkbox in
   a label, ≥24px target, no JS) plus pause on hover and on focus. Reduced
   motion gets one static, wrapping, flush-left row and no control.

   Logos are not links (not asked for). Each `<li>` carries the brand's name as
   `sr-only` text with `translate="no"` (WDG-15); the painted logo is
   decorative to AT.

   `data-reveal` on the band's root marks it for the below-the-fold reveal
   (D92b): armed only if it starts below the viewport, never hidden without JS
   or with reduced motion.
   --------------------------------------------------------------------------- */

import type { CSSProperties } from "react";

import { BRAND_LOGOS, type BrandLogo } from "../brand-logos";

/* Per-logo custom properties read by `[data-marquee="logo"]`. Data, not
   styling: the box size and mask come from the utility. */
function logoStyle(logo: BrandLogo): CSSProperties {
  return {
    "--logo-src": `url("/images/brands/${logo.slug}.svg")`,
    "--logo-aspect": logo.aspect,
    "--logo-scale": logo.scale,
  } as CSSProperties;
}

function LogoItems() {
  return BRAND_LOGOS.map((logo) => (
    <li key={logo.slug} className="text-ink-dim md:hover:text-ink">
      <span className="sr-only" translate="no">
        {logo.name}
      </span>
      <span aria-hidden="true" data-marquee="logo" style={logoStyle(logo)} />
    </li>
  ));
}

export function BrandStrip() {
  return (
    <div
      data-probe="brands"
      data-reveal=""
      className="brand-marquee border-border bg-surface-2 mt-14 border-y px-4 py-5 sm:mt-20 sm:px-8 sm:py-10 md:mt-30 md:px-12"
    >
      <div data-marquee="viewport">
        <div data-marquee="track">
          <ul aria-label="Brands" data-marquee="list">
            <LogoItems />
          </ul>
          <ul aria-hidden="true" data-marquee="list copy">
            <LogoItems />
          </ul>
        </div>
      </div>

      <label
        data-marquee="pause"
        className="border-border-strong text-ink-dim rounded-ctl has-focus-visible:outline-accent hover:text-ink grid size-8 flex-none cursor-pointer place-items-center border has-focus-visible:outline-2 has-focus-visible:outline-offset-0"
      >
        <input
          type="checkbox"
          data-marquee="toggle"
          aria-label="Pause brand logos"
          className="sr-only"
        />
        {/* Pause: two bars. Play: a triangle. Swapped by the utility. */}
        <svg aria-hidden="true" data-icon="pause" viewBox="0 0 12 12" className="size-3 fill-current">
          <rect x="2" y="1" width="3" height="10" />
          <rect x="7" y="1" width="3" height="10" />
        </svg>
        <svg aria-hidden="true" data-icon="play" viewBox="0 0 12 12" className="size-3 fill-current">
          <path d="M3 1 11 6 3 11Z" />
        </svg>
      </label>
    </div>
  );
}
