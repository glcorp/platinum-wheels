import { loadProductPhoto, renderProductCard } from "@/features/seo/preview-cards";
import { SITE_CARD } from "@/features/seo/metadata";
import { loadProduct } from "@/features/product/load";

/* `/products/<slug>/og.jpg` — a product's link-preview card (D112): its own
   photo on the brand's dark ground, 1200x630, no text and no price (owner,
   2026-09-30). The product page names this URL in its Open Graph tags only
   when the product has a photo; a product without one names the site card.

   An unknown or hidden slug is a 404, the same rule as the page. A photo that
   cannot be fetched or read redirects to the site card, so a preview never
   comes back broken. The drawing is `src/features/seo/preview-cards.tsx`. */

export async function GET(
  request: Request,
  context: RouteContext<"/products/[slug]/og.jpg">,
): Promise<Response> {
  const { slug } = await context.params;
  const detail = await loadProduct(slug);
  if (!detail) return new Response("Not found\n", { status: 404 });

  const photo =
    detail.image === null ? null : await loadProductPhoto(detail.image.url);

  if (photo !== null) {
    try {
      const card = await renderProductCard(photo);
      return new Response(new Uint8Array(card), {
        headers: {
          "Content-Type": "image/jpeg",
          /* A week at the CDN (D194; was a day): each card is a photo
             download and a `sharp` render, asked for again by every
             crawler. A hidden product or a changed photo can show the old
             card in a link preview for up to that week. */
          "Cache-Control": "public, max-age=3600, s-maxage=604800",
        },
      });
    } catch {
      // Bytes `sharp` cannot read: fall through to the site card.
    }
  }

  return Response.redirect(new URL(SITE_CARD.url, request.url), 302);
}
