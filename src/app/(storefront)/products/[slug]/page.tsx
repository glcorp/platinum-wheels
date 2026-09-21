import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { findProduct } from "@/features/catalog/data";
import { BuyPanel } from "@/features/product/components/buy-panel";
import { PdpBreadcrumb } from "@/features/product/components/pdp-breadcrumb";
import { PdpGallery } from "@/features/product/components/pdp-gallery";
import { QuoteBand } from "@/features/product/components/quote-band";
import { SimilarProducts } from "@/features/product/components/similar-products";
import { Specifications } from "@/features/product/components/specifications";
import { productView } from "@/features/product/view";

/* ---------------------------------------------------------------------------
   `/products/[slug]` — composition only (`docs/decisions.md` §3: routes are
   thin). Section order is `design/inventory/product.md` §1, artboard order.

   One `ProductView` in, every section renders from it (the `/results` pattern,
   D44). The quantity selection is a query param (D50), so every state of this
   page is server rendered and survives a reload; the only client component on
   the route is the quote form island (D51).

   Chrome is composed per page, not hoisted into a group layout (D38): `solid`
   header here, `tires` active, as the artboards draw it.

   Layout: mobile stacks — breadcrumb, full-bleed gallery, buy panel. From
   `md:` 1100 the two become the drawn split, `grid-template-columns:55fr 45fr;
   gap:64px; align-items:start` inside 1344px → gallery 704, panel 576
   (`product-desktop.html:101`, the `pdp-split` utility). 55/45, NOT the 60/40
   DESIGN.md §5 asks for — the artboard wins (`design/DEVIATIONS.md`).

   The split waits for 1100 rather than DESIGN.md §8's 720 for the same reason
   `/results` moved its rail (D46): at 720 the 45% column measures 266px, which
   cannot hold an 88px display title. Type still crosses at `sm:` 720, which is
   where the ratified `Price context="pdp"` already crosses.

   The breadcrumb renders ONCE. The artboards place it above the gallery on
   mobile and inside the buy panel on desktop (`product.md` §1.2); rather than
   render it twice and hide one, the mobile instance is the real one and the
   desktop instance is passed into `BuyPanel`, which shows it only from `md:`.
   --------------------------------------------------------------------------- */

/* No `generateStaticParams` here, deliberately. Reading `searchParams` for
   `?qty=` (D50) makes this route dynamic — `next build` reports it as `ƒ`, not
   `○` — so prerendering the nine seed slugs would be dead code. If the quantity
   ever stops living in the URL, add it back. */

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = findProduct(slug);
  if (!product) return { title: "Product" };

  return {
    title: `${product.brand} ${product.model}`,
    description: `${product.brand} ${product.model} ${product.size}. Request a quote from Platinum Wheels in Brampton, Ontario.`,
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = findProduct(slug);
  /* An unknown slug is a 404. An UNAVAILABLE product is not: the page still
     returns 200 and the card variant carries the state
     (`docs/decisions.md:116`). */
  if (!product) notFound();

  /* Read once: `productView` derives from it, and `BuyPanel` passes it down to
     `QuantityControl` so a `?qty=` link changes that param and preserves every
     other one (D50). */
  const query = await searchParams;
  const view = productView(product, query);
  const breadcrumb = <PdpBreadcrumb view={view} />;

  return (
    <>
      <SiteHeader variant="solid" active="tires" />
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

        <div className="px-4 sm:px-8 md:mx-auto md:max-w-content md:px-12">
          <Specifications rows={view.specs} />
        </div>

        <QuoteBand view={view} />
        <SimilarProducts products={view.similar} />
      </main>
      <SiteFooter />
    </>
  );
}
