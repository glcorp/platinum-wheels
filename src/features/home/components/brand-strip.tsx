/* ---------------------------------------------------------------------------
   BrandStrip — twelve wordmarks on a banded row. Server Component.

   Desktop `margin-top:120px;background:var(--surface-2);border-top/bottom:1px
   solid var(--border);padding:40px 48px;display:grid;
   grid-template-columns:repeat(8,minmax(0,1fr));align-items:center` — NO
   `gap` declared — `design/inventory/home.md:70,343-345`.
   Mobile `margin-top:56px`, same band fills/borders,
   `padding:20px 16px;display:flex;gap:28px;overflow:hidden` —
   `design/inventory/home.md:70,306-308`. Tablet gets the desktop grid
   (`design/DESIGN.md` §8 "Horizontal rows: full grid"), with `sm:px-8`.

   Names come from `BRANDS` (`src/lib/site.ts`), in the artboard's house-then-
   majors order — do not reorder (`src/lib/llm.md` "Don't").

   Mobile marks skip the `display` role utility: the artboards' brand marks
   here carry `letter-spacing:.02em` (+2%), not `display`'s -0.015em, and
   `line-height:1` at every width — composed explicitly instead
   (`design/inventory/home.md:70` desktop/mobile deltas).

   `data-reveal` on the band's root marks it for the below-the-fold reveal
   (D92): armed only if it starts below the viewport, never hidden without JS
   or with reduced motion. No links here, so no press or transition type.
   --------------------------------------------------------------------------- */

import { BRANDS } from "@/lib/site";

export function BrandStrip() {
  return (
    <ul
      aria-label="Brands"
      data-probe="brands"
      data-reveal=""
      className="border-border bg-surface-2 mt-14 flex items-center gap-7 overflow-hidden border-y px-4 py-5 sm:mt-20 sm:grid sm:grid-cols-8 sm:items-center sm:gap-0 sm:overflow-visible sm:px-8 sm:py-10 md:mt-30 md:px-12"
    >
      {BRANDS.map((brand) => (
        <li
          key={brand}
          className="font-display text-ink-dim leading-flat tracking-2 text-display-20 flex-none font-bold whitespace-nowrap uppercase sm:whitespace-normal md:hover:text-ink md:text-display-26 md:text-center"
        >
          {brand}
        </li>
      ))}
    </ul>
  );
}
