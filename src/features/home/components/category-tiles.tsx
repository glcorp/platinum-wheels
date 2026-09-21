import Image from "next/image";
import Link from "next/link";

import { ROUTES } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   CategoryTiles — "01 — Shop by category"

   Three photo tiles linking to Tires / Wheels / Accessories.
   Desktop: design/assets/home-desktop.html:148-155;
            design/inventory/home.md:39-43,168-187.
   Mobile:  design/assets/home-mobile.html:110-118;
            design/inventory/home.md:43,231.

   Section owns its own top spacing + side padding (not bottom), per the home
   section-spacing convention: `pt-14 sm:pt-20 md:pt-30` (56 → 80 tablet per
   DESIGN.md §8 → 120), `px-4 sm:px-8 md:px-12`, content capped at `lg:` (D11).
   Inner gap 20px → 40px, `gap-5 md:gap-10` (home.md:39,43).

   Grid, desktop (`md:`, 1100, home.md:39): 2fr/1fr over two 320px rows, tall
   Tires tile spanning both. Not expressible without an arbitrary value
   (`grid-template-rows:320px 320px` has no Tailwind numeric-scale
   equivalent), so this cites the missing token below — already supplied in
   `src/app/globals.css` as `@utility category-grid` by the globals.css
   owner, so it is used here as `md:category-grid` rather than re-reported.
   Tablet (720–1099) is silent in DESIGN.md §8 for this section; the mobile
   stack is kept through `sm:` and the desktop grid starts at `md:` (1100) —
   ruled here rather than squeezing the 2fr tall tile at 720px.

   Scrims: every tile is 35%/75% (home.md:401); the tall desktop tile alone
   swaps to 30%/70% (home.md:400). Also not expressible as a bare utility
   (four-stop gradient with token stops), and also already supplied in
   `globals.css` as `@utility tile-scrim` / `@utility tile-scrim-tall` — used
   here as `tile-scrim` (base, all tiles) and `md:tile-scrim-tall` (tall tile
   only, desktop).

   `object-position:70% 30%` on the Tires image (home.md:39, "Fit" column)
   has no token; `object-right-top` (100% 0%) is off by 30/30 on both axes,
   so `object-center` ships instead. Deviation candidate — see the final
   report.

   Server Component. No hover: D35(2) — the artboard's global `a:hover`
   colour shift to `--text-muted` is suppressed for category tiles; no tile
   carries an `xN` class on either artboard (home.md:187), so nothing is
   drawn here.
   --------------------------------------------------------------------------- */

export function CategoryTiles() {
  return (
    <section className="pt-14 px-4 sm:pt-20 sm:px-8 md:pt-30 md:px-12">
      <div className="flex flex-col gap-5 md:gap-10 lg:mx-auto lg:max-w-content">
        {/* Header as drawn, not SectionHeading: on desktop the eyebrow sits
            LEFT and the h2 RIGHT on one `align-items:flex-end;
            justify-content:space-between` row (home-desktop.html:149, inventory
            home.md:172-174); on mobile they are two siblings in the section's
            20px column (home.md:43). SectionHeading stacks them with a 16px gap,
            which would push every later section down by 28px at 1440. */}
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-4">
          <p className="label text-ink-dim text-11 tracking-14 sm:text-12">
            01 — Shop by category
          </p>
          <h2 className="display text-ink text-display-40 md:text-display-56">
            Everything between you and the road.
          </h2>
        </div>

        {/* Mobile: flex column, fixed 300/200/200 heights (home.md:43).
            Desktop (`md:`): `category-grid` — 2fr/1fr over two 320px rows
            (home.md:39); the tall tile spans both rows. */}
        <div
          data-probe="tiles"
          className="flex flex-col gap-3 md:category-grid md:gap-4"
        >
          {/* Tires — `grid-row:1/3` on desktop, COMPUTED 885.333×656
              (home.md:39,175). */}
          <Link
            href={ROUTES.tires}
            data-probe="tile-tires"
            className="relative block h-75 overflow-hidden border border-border text-on-photo md:h-auto md:row-span-2"
          >
            <Image
              src="/images/products/zeta-antarctica-sport.webp"
              alt=""
              fill
              sizes="(min-width: 1100px) 62vw, 100vw"
              className="photo-inset-card object-contain object-center"
            />
            <div
              aria-hidden="true"
              className="tile-scrim absolute inset-0 md:tile-scrim-tall"
            />
            <div className="absolute left-5 bottom-5 flex flex-col gap-2 md:left-8 md:bottom-8 md:gap-3">
              <span className="display text-display-56 md:text-display-88">
                Tires
              </span>
              <span className="label text-13 tracking-8 opacity-75 md:text-14">
                Browse →
              </span>
            </div>
          </Link>

          {/* Wheels — COMPUTED 442.666×320 (home.md:39,176). No
              `object-position` override — defaults to centre. */}
          <Link
            href={ROUTES.wheels}
            data-probe="tile-wheels"
            className="relative block h-50 overflow-hidden border border-border text-on-photo md:h-auto"
          >
            <Image
              src="/images/products/spec1-sp51.webp"
              alt=""
              fill
              sizes="(min-width: 1100px) 31vw, 100vw"
              className="photo-inset-card object-contain"
            />
            <div aria-hidden="true" className="tile-scrim absolute inset-0" />
            <div className="absolute left-5 bottom-5 flex flex-col gap-2 md:left-8 md:bottom-8 md:gap-3">
              <span className="display text-display-40 md:text-display-56">
                Wheels
              </span>
              <span className="label text-13 tracking-8 opacity-75 md:text-14">
                Browse →
              </span>
            </div>
          </Link>

          {/* Accessories — COMPUTED 442.666×320 (home.md:39,177), `cover`
              fit, no inset padding. */}
          <Link
            href={ROUTES.accessories}
            data-probe="tile-accessories"
            className="relative block h-50 overflow-hidden border border-border text-on-photo md:h-auto"
          >
            <Image
              src="/images/photos/accessories.webp"
              alt=""
              fill
              sizes="(min-width: 1100px) 31vw, 100vw"
              className="object-cover"
            />
            <div aria-hidden="true" className="tile-scrim absolute inset-0" />
            <div className="absolute left-5 bottom-5 flex flex-col gap-2 md:left-8 md:bottom-8 md:gap-3">
              <span className="display text-display-40 md:text-display-56">
                Accessories
              </span>
              <span className="label text-13 tracking-8 opacity-75 md:text-14">
                Browse →
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
