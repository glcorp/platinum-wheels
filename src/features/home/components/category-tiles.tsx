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
   so `object-center` ships instead — `design/DEVIATIONS.md` #23.
   **That row is superseded by #57 (D63):** the reason the crop difference was
   harmless used to be that the tile drew a product cut-out on a transparent
   canvas, so a focal point only moved empty margin. It draws a full-bleed
   photo now, where a focal point would genuinely crop the subject. The class
   is unchanged; only the justification moved. See the Tires tile below.

   Server Component. No hover is DRAWN: D35(2) — the artboard's global
   `a:hover` colour shift to `--text-muted` is suppressed for category tiles
   (tile text stays `--on-photo`); no tile carries an `xN` class on either
   artboard (home.md:187).

   D92 (owner, "Expressive", 2026-09-29) gives the tiles the product card's
   hover language — `transition-card ease-card duration-150
   hover:-translate-y-0.5 hover:border-accent-hover`, the one hover the
   artboards do draw, on the card (results-desktop.html:48) — so everything
   on the site that is a big photo link lifts the same way. New hover on a
   drawn element: DEVIATIONS #77. Resting border, size and colour unchanged.
   `hover:` compiles to `@media (hover: hover)` (D17), so a tap never leaves
   a tile lifted. `overflow-hidden` clips the photo inside the tile, not the
   tile's own translate. The tiles lead into a category route, down the
   hierarchy, so each is `nav-forward` and fully prefetched so the results
   page is ready in the same commit as the slide. The section carries
   `data-reveal` — it is below the hero, so the reveal island arms it.
   --------------------------------------------------------------------------- */

export function CategoryTiles() {
  return (
    <section
      data-reveal=""
      className="pt-14 px-4 sm:pt-20 sm:px-8 md:pt-30 md:px-12"
    >
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
            transitionTypes={["nav-forward"]}
            prefetch={true}
            className="relative block h-75 overflow-hidden border border-border text-on-photo md:h-auto md:row-span-2 transition-card ease-card duration-150 hover:-translate-y-0.5 hover:border-accent-hover"
          >
            {/* `tires-tile.webp`, NOT the `zeta-antarctica-sport` cut-out the
                artboards draw here — owner ruling, 2026-09-21 (D63,
                `design/DEVIATIONS.md` #57). The artboards put a product
                cut-out in this tile, which meant the Tires tile showed the
                same specific tire that appears as its own card three sections
                later; `design/inventory/home.md` flagged the choice as
                undecidable from the export. The tile photos exist on disk,
                are named for these tiles, and are referenced by nothing.
                A photo fills the tile, so this is `object-cover` and drops
                `photo-inset-card` (the cut-out's 6% inset) — the same
                treatment the Accessories tile already uses. */}
            <Image
              src="/images/photos/tires-tile.webp"
              alt=""
              fill
              sizes="(min-width: 1100px) 62vw, 100vw"
              className="object-cover object-center"
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
            transitionTypes={["nav-forward"]}
            prefetch={true}
            className="relative block h-50 overflow-hidden border border-border text-on-photo md:h-auto transition-card ease-card duration-150 hover:-translate-y-0.5 hover:border-accent-hover"
          >
            {/* `wheels-tile.webp`, not the `spec1-sp51` cut-out — same ruling
                as the Tires tile above (D63, DEVIATIONS #57). All three tiles
                now carry photography, which is what makes them read as one
                set. */}
            <Image
              src="/images/photos/wheels-tile.webp"
              alt=""
              fill
              sizes="(min-width: 1100px) 31vw, 100vw"
              className="object-cover"
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
            transitionTypes={["nav-forward"]}
            prefetch={true}
            className="relative block h-50 overflow-hidden border border-border text-on-photo md:h-auto transition-card ease-card duration-150 hover:-translate-y-0.5 hover:border-accent-hover"
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
