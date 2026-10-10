import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/site/site-footer";
import { PageTransition } from "@/components/site/page-transition";
import { SiteHeader } from "@/components/site/site-header";
import { redirectToCanonicalVehicle } from "@/features/finder/canonical";
import { BuyPanel } from "@/features/product/components/buy-panel";
import { PdpBreadcrumb } from "@/features/product/components/pdp-breadcrumb";
import { PdpGallery } from "@/features/product/components/pdp-gallery";
import { SimilarProducts } from "@/features/product/components/similar-products";
import { Specifications } from "@/features/product/components/specifications";
import {
  loadProduct,
  loadProductRows,
  loadTitleSiblings,
} from "@/features/product/load";
import { productView } from "@/features/product/view";
import { JsonLd } from "@/features/seo/json-ld";
import { pageMetadata } from "@/features/seo/metadata";
import {
  productBreadcrumb,
  productSchema,
  toProductSeo,
} from "@/features/seo/schema";
import { productRoute } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   `/products/[slug]` — composition only (`docs/decisions.md` §3: routes are
   thin). Section order is `design/inventory/product.md` §1, artboard order.

   One `ProductView` in, every section renders from it (the `/tires` pattern,
   D44). The quantity selection is a query param (D50), so every state of this
   page is server rendered and survives a reload. The client islands are the
   `Add to cart` buttons (D122); the quote band and its form, drawn between the
   specifications and the similar row, moved to the cart in D122
   (`design/DEVIATIONS.md` #96).

   Chrome is composed per page, not hoisted into a group layout (D38): `solid`
   header here, as the artboards draw it. The active nav item follows the
   product's own category (D58) — `tires` on every artboard-drawn product, and
   `wheels` / `accessories` on the two new lines, so a wheel PDP does not mark
   Tires active in the nav.

   Layout: mobile stacks — breadcrumb, full-bleed gallery, buy panel. From
   `md:` 1100 the two become the drawn split, `grid-template-columns:55fr 45fr;
   gap:64px; align-items:start` inside 1344px → gallery 704, panel 576
   (`product-desktop.html:101`, the `pdp-split` utility). 55/45, NOT the 60/40
   DESIGN.md §5 asks for — the artboard wins (`design/DEVIATIONS.md`).

   The split waits for 1100 rather than DESIGN.md §8's 720 for the same reason
   `/tires` moved its rail (D46): at 720 the 45% column measures 266px, which
   cannot hold an 88px display title. Type still crosses at `sm:` 720, which is
   where the ratified `Price context="pdp"` already crosses.

   The breadcrumb is INSTANTIATED once and PLACED twice. The artboards put it
   above the gallery on mobile and inside the buy panel on desktop
   (`product.md` §1.2); one `<PdpBreadcrumb>` element is built here and handed
   to both positions, so there is one source of truth for its markup — but two
   subtrees do mount, one `md:hidden` and one `hidden md:block`.
   Hit-tested during the D56 audit: the hidden copy is `display:none`, so it is
   not focusable and not in the accessibility tree, and exactly one breadcrumb
   is announced at any width. This comment previously claimed the breadcrumb
   "renders ONCE", which is true of the source and false of the DOM; corrected
   2026-09-21 (D61, audit taste item T1).
   --------------------------------------------------------------------------- */

/* No `generateStaticParams` here, deliberately. Reading `searchParams` for
   `?qty=` (D50) makes this route dynamic — `next build` reports it as `ƒ`, not
   `○` — so prerendering the nine seed slugs would be dead code. If the quantity
   ever stops living in the URL, add it back. An unknown slug is a real 404
   (measured) since D91b removed the group's `loading.tsx`: until then
   `notFound()` ran after a 200 shell had already streamed — a soft 404. */

/* Title and description name the size and the load and speed index as well as
   the model, so two sizes of one tire, or one size at two load indexes, are
   distinct results. The description's second sentence is the product's own
   kind (`Winter tire`, `Wheel`; a wheel's finish is in its title, D136), not a fixed phrase. The canonical is the bare product path:
   `?qty=` and a carried vehicle never make a second address (D112). The preview
   image is the product's own photo on the dark card, or the site card when it
   has no photo (owner, 2026-09-30). */
export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const detail = await loadProduct(slug);
  /* An unknown or hidden slug renders the 404 below. `robots: null` clears the
     layout's robots tag, as `src/app/not-found.tsx` does, so the page carries
     only Next's own 404 `noindex` (e2e fixture finding, 2026-10-05). */
  if (!detail) return { title: "Page not found", robots: null };

  /* The title siblings, so two products that share a name and size never
     share a title (launch audit D145; memoised, the page reads them too). */
  const view = productView(detail, {}, {
    similar: [],
    otherSizes: [],
    siblings: await loadTitleSiblings(detail),
  });
  const seo = toProductSeo(view.product, view);
  const path = productRoute(seo.slug);
  return pageMetadata({
    title: seo.title,
    description: `${seo.title}. ${seo.kind}. Request a quote from Platinum Wheels, a Brampton-based online store for tires, wheels and accessories.`,
    path,
    image:
      seo.image === null
        ? undefined
        : { url: `${path}/og.jpg`, alt: seo.title, type: "image/jpeg" },
  });
}

export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  /* An old model name in the URL goes to the canonical one, before any
     database read (D155). */
  const query = await searchParams;
  redirectToCanonicalVehicle(productRoute(slug), query);
  const detail = await loadProduct(slug);
  /* An unknown slug is a 404, and so is a HIDDEN product. A DISCONTINUED one
     is not: the page still returns 200 and shows it as unavailable, so an old
     link still lands somewhere that takes an enquiry
     (`docs/decisions.md:116`, D105b). */
  if (!detail) notFound();

  /* Read once: `productView` derives from it, and `BuyPanel` passes it down to
     `QuantityControl` so a `?qty=` link changes that param and preserves every
     other one (D50). */
  const view = productView(detail, query, await loadProductRows(detail));
  const { product } = view;
  const breadcrumb = <PdpBreadcrumb view={view} />;
  const seo = toProductSeo(product, view);

  return (
    <>
      {/* D158: the header's category links keep the searched vehicle. */}
      <SiteHeader variant="solid" active={view.config.nav} vehicle={view.vehicle} />
      {/* `<main>` + footer ride one `PageTransition` (D92b); the gallery image
          inside it is the other half of the card-photo morph. */}
      <PageTransition>
        <main id="main" tabIndex={-1} className="flex-1">
          {/* Mobile only: `padding:16px 16px 0` above the gallery
              (`product-mobile.html:90`). Desktop's copy lives in the buy panel. */}
          <div className="px-4 pt-4 sm:px-8 md:hidden">{breadcrumb}</div>

          <div className="md:px-12 md:pt-8">
            <div className="md:pdp-split lg:mx-auto lg:max-w-content">
              <PdpGallery
                brand={product.brand}
                model={product.model}
                slug={product.slug}
                image={product.image}
                images={product.images}
                accessoryType={product.accessoryType}
                /* Mobile draws the badge row over the image; from `sm:` it moves
                   into the buy panel, which is where the desktop artboard puts
                   it (`product.md` §3 "Element order" row 2). The gallery hides
                   its own copy at the same width, so exactly one renders. */
                badges={view.badges}
              />
              <BuyPanel
                view={view}
                /* `BuyPanel` renders whatever it is handed, so the visibility
                   classes come from here: this copy is the DESKTOP one and the
                   `md:hidden` block above is the mobile one. Exactly one is in
                   the layout — and in the a11y tree — at any width. */
                breadcrumb={<div className="hidden md:block">{breadcrumb}</div>}
                searchParams={query}
              />
            </div>
          </div>

          {/* Padding and the 1344px cap on separate elements, like the split
              above. On one element `max-w-content` is border-box, so the 48px
              padding came out of the 1344 and the table sat at x=96, w=1248
              against the drawn 48/1344 (D91b, VPE-1, measured). */}
          <div className="px-4 sm:px-8 md:px-12">
            <div className="lg:mx-auto lg:max-w-content">
              <Specifications rows={view.specs} description={view.description} />
            </div>
          </div>

          {/* Undrawn (D108b): the same row as `Similar products`, above it, for
              this model's other sizes. Each renders only when it has cards. */}
          <SimilarProducts
            heading="Other sizes"
            probe="other-sizes"
            products={view.otherSizes}
            leads={view.similar.length > 0}
            vehicle={view.vehicle}
          />
          <SimilarProducts products={view.similar} vehicle={view.vehicle} />
        </main>
        <SiteFooter />
      </PageTransition>
      {/* Name, brand, size, category and image; no price and no offer, by the
          owner's ruling (D112, `src/features/seo/schema.ts`). */}
      <JsonLd data={[productSchema(seo), productBreadcrumb(seo)]} />
    </>
  );
}
