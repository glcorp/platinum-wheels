import { ProductCard } from "@/features/catalog/components/product-card";
import type { Product } from "@/features/catalog/types";

/* ---------------------------------------------------------------------------
   SimilarProducts — the four-card row that closes the page. Server Component.
   `products` arrives already filtered (same season, current slug excluded)
   and capped at four by `productView()` (D52) — this component renders the
   list, it does not filter, exclude, or sort anything itself.

   Measured: `design/inventory/product.md` §1.6 (manifest), §2.7 (full spec),
   §5.3 (spacing).
   Sources: `design/assets/product-desktop.html:159-315`,
            `design/assets/product-mobile.html:124-277`.

   `ProductCard` is rendered unchanged — the same shell as home and
   `/results` — and its own header comment records that all three contexts
   measure byte-identically, so there is no PDP delta to report.
   --------------------------------------------------------------------------- */

export interface SimilarProductsProps {
  products: readonly Product[];
}

/* Section: mobile `padding:56px 0 0 16px;gap:20px` — left-padded,
   right-bleeding by design, same idiom as the home featured row
   (`product-mobile.html:124`, `src/features/home/components/featured-tires.tsx`).
   `overflow-hidden` reproduces the export's own `overflow:hidden` on this
   wrapper (`product-mobile.html:124`) — it clips the page's horizontal
   scrollbar, not the track's own scroll axis, which the inner
   `similar-track` element owns independently.
   Desktop `md:` `padding:120px 48px;gap:40px` (`product-desktop.html:159`) —
   fluid grid, nothing to clip, so overflow resets to visible. */
const SECTION =
  "flex flex-col gap-5 overflow-hidden pt-14 pl-4 md:gap-10 md:overflow-visible md:px-12 md:py-30";

/* `display` utility carries family/weight/leading/tracking/transform; size
   stays an explicit token. 40px M (`product-mobile.html:126`) → 56px D
   (`product-desktop.html:161`). */
const HEADING = "display text-ink text-display-40 sm:text-display-56";

/* `similar-track` (mobile, fixed `repeat(4,260px)` scroller with snap) /
   `md:similar-grid` (fluid 4-up) — both declared in `src/app/globals.css`.
   Gutter `gap:12px` M (`product-mobile.html:126`) → `16px` D
   (`product-desktop.html:161`). Scrollbar hiding is the separate
   `hide-scrollbar` utility (audit finding S1, `design/reports/audit.md`):
   `similar-track` no longer carries its own `scrollbar-width`/
   `::-webkit-scrollbar` rule, now that the home featured row (D30) uses the
   same mechanism — one utility for both carousels instead of two copies.
   The export clips cards 2-4 with `overflow:hidden` on the mobile grid div
   — a static-snapshot artefact of the same kind as the home carousel; it
   ships scrollable here on the D30 precedent, cited for the PDP row as
   D53(5). No arrows, no dots: unlike the home row, neither PDP artboard
   draws any (`product.md` §2.7). */
const TRACK = "similar-track hide-scrollbar md:similar-grid gap-3 md:gap-4";

export function SimilarProducts({ products }: SimilarProductsProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section data-probe="similar-products" className={SECTION}>
      <h2 className={HEADING}>Similar products</h2>
      {/* Keyboard-scroll decision: the track itself is made focusable
          (`tabIndex={0}`, `role="group"`, `aria-label="Similar products"`)
          rather than relying solely on the focusable links inside each card.
          The cards' own CTA/name links are still real, individually
          focusable elements, so Tab still reaches every product — but a
          keyboard user who has NOT yet tabbed into a card has no way to
          scroll the mobile track at all without this: focusing the
          container directly lets arrow-key/native scroll act on it before
          any card link is reached. The group role plus label announces it
          as one unit distinct from the heading above it. */}
      <div
        data-probe="similar-track"
        className={TRACK}
        tabIndex={0}
        role="group"
        aria-label="Similar products"
      >
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </section>
  );
}
