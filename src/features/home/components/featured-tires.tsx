/* ---------------------------------------------------------------------------
   FeaturedTires — "03 — Featured tires". Server Component.

   Provides the `<section>` shell (spacing, side padding, container cap) and
   hands the featured products — a fixed list of slugs read from the
   catalogue (`../featured.ts`, D108b) — to `FeaturedCarousel`, the client
   island that owns the header controls, the track and the dot progress (D30)
   — see that file for why header + track live together. The cards are
   rendered here, on the server, and passed to the island as `children`, so
   `ProductCard` is not in the island's bundle.

   Renders nothing when no listed product resolves: a heading over an empty
   track is worse than no section.

   Desktop `padding:120px 48px 0;gap:40px` — `design/assets/home-desktop.html:186`.
   Mobile `padding:56px 0 0 16px;gap:20px;overflow:hidden` — NOTE the zero
   right padding, an intentional bleed so the scroll track runs off the edge —
   `design/inventory/home.md:64`, `design/assets/home-mobile.html:135`.

   `data-reveal` marks the section for the below-the-fold reveal (D92b): the
   reveal island arms it only if it starts below the viewport, and without
   JS or with reduced motion it is never hidden.
   --------------------------------------------------------------------------- */

import { ProductCard } from "@/features/catalog/components/product-card";

import { getFeaturedProducts } from "../featured";

import { FeaturedCarousel } from "./featured-carousel";

export async function FeaturedTires() {
  const products = await getFeaturedProducts();
  if (products.length === 0) return null;

  return (
    <section
      data-probe="featured"
      data-reveal=""
      className="overflow-hidden pt-14 pl-4 sm:overflow-visible sm:px-8 sm:pt-20 md:px-12 md:pt-30"
    >
      <div className="flex flex-col gap-5 sm:gap-10 lg:mx-auto lg:max-w-content">
        <FeaturedCarousel count={products.length}>
          {products.map((product) => (
            <div
              key={product.slug}
              /* TOKEN MISSING — `globals.css` is single-writer (D25), so
                 these two are reported, not invented, and the class names are
                 used here as the `fade-right` precedent in the carousel does.
                 THE ROW RENDERS AT 260px AT DESKTOP UNTIL THEY LAND:

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
              {/* `sizes` crosses where this track does (D91b, WDG-06):
                  the fixed 260px `w-65` card below 720, a third of the
                  content box 720–1099, and from 1100 a quarter of at most
                  the 1344px container, i.e. ≤324px (`home.md:248`). */}
              <ProductCard
                product={product}
                sizes="(min-width: 1100px) 324px, (min-width: 720px) 33vw, 260px"
              />
            </div>
          ))}
        </FeaturedCarousel>
      </div>
    </section>
  );
}
