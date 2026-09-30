/* ---------------------------------------------------------------------------
   FeaturedTires — "03 — Featured tires". Server Component.

   Provides the `<section>` shell (spacing, side padding, container cap) and
   hands the featured products — a fixed list of slugs read from the
   catalogue (`../featured.ts`, D108) — to `FeaturedCarousel`, the client
   island that owns the header controls, the track and the dot progress (D30)
   — see that file for why header + track live together.

   Renders nothing when no listed product resolves: a heading over an empty
   track is worse than no section.

   Desktop `padding:120px 48px 0;gap:40px` — `design/assets/home-desktop.html:186`.
   Mobile `padding:56px 0 0 16px;gap:20px;overflow:hidden` — NOTE the zero
   right padding, an intentional bleed so the scroll track runs off the edge —
   `design/inventory/home.md:64`, `design/assets/home-mobile.html:135`.
   --------------------------------------------------------------------------- */

import { getFeaturedProducts } from "../featured";

import { FeaturedCarousel } from "./featured-carousel";

export async function FeaturedTires() {
  const products = await getFeaturedProducts();
  if (products.length === 0) return null;

  return (
    <section
      data-probe="featured"
      className="overflow-hidden pt-14 pl-4 sm:overflow-visible sm:px-8 sm:pt-20 md:px-12 md:pt-30"
    >
      <div className="flex flex-col gap-5 sm:gap-10 lg:mx-auto lg:max-w-content">
        <FeaturedCarousel products={products} />
      </div>
    </section>
  );
}
