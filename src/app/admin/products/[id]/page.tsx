import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTopBar } from "@/features/admin/components/admin-top-bar";
import { ProductForm } from "@/features/admin/components/product-form";
import { ProductPhotos } from "@/features/admin/components/product-photos";
import { ProductStatusButtons } from "@/features/admin/components/product-status-buttons";
import {
  CATEGORY_LABEL,
  lowestVendorPrice,
  productFormValues,
  productSpecLine,
} from "@/features/admin/product-display";
import {
  adminGetProduct,
  adminListBrands,
  adminListPhotos,
  adminListVendors,
} from "@/features/admin/product-queries";
import { PRODUCT_STATUS_LABEL } from "@/features/admin/product-types";
import { requireAdminSession } from "@/features/admin/session";
import { storefrontProductUrl } from "@/features/admin/storefront-link";
import { ADMIN_ROUTES } from "@/features/admin/types";
import { SHOP_DATE_TIME } from "@/lib/time";

/* ---------------------------------------------------------------------------
   /products/<id> (admin host) — one product: status, photos, details (D116,
   D117)

   NO ARTBOARD DRAWS THIS (D89). Top to bottom in the order staff reach for
   things: where the product stands (status, and the storefront link once
   customers can see it), its photos, then every field. The form saves
   details only; status and photos act at once, each on its own.

   An unknown or malformed id renders the admin's 404 (`not-found.tsx`).
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Edit product",
};

const STATUS_NOTE = {
  hidden: "Hidden. Customers can't see it anywhere.",
  published: "Published. It shows in listings and search.",
  discontinued: "Discontinued. Its page stays up as currently unavailable; it is out of listings.",
} as const;

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { csrfToken } = await requireAdminSession();
  const { id } = await params;
  const product = await adminGetProduct(id);
  if (!product) notFound();

  const [brands, vendors, photos, query] = await Promise.all([
    adminListBrands(),
    adminListVendors(),
    adminListPhotos(product.id),
    searchParams,
  ]);
  const created = query.created === "1";
  const siteUrl = product.status === "hidden" ? null : storefrontProductUrl(product.slug);
  const spec = productSpecLine(product);

  return (
    <>
      <AdminTopBar csrfToken={csrfToken} current="products" />
      <main
        id="main"
        tabIndex={-1}
        className="w-full flex-1 px-4 pt-10 pb-20 sm:px-8 sm:pt-14 sm:pb-30 md:px-12 lg:mx-auto lg:max-w-content"
      >
        <Link
          href={ADMIN_ROUTES.products}
          className="label text-ink-muted inline-flex min-h-11 items-center text-11 tracking-12 underline underline-offset-4"
        >
          Products
        </Link>
        <p className="text-ink-muted mt-4 text-15 leading-body">{`${CATEGORY_LABEL[product.category]} · ${product.brand ?? "No brand"}`}</p>
        <h1 className="display text-ink mt-1 text-display-40 sm:text-display-56">{product.name}</h1>
        {spec ? <p className="text-ink-muted mt-2 text-15 leading-body sm:text-16">{spec}</p> : null}

        {created ? (
          <p role="status" className="border-accent bg-accent-subtle text-ink mt-6 max-w-measure border p-4 text-15 leading-body">
            Product created. It is hidden until you publish it.
          </p>
        ) : null}

        <section aria-labelledby="product-status" className="mt-10 max-w-measure sm:mt-12">
          <h2 id="product-status" className="display text-ink text-display-24 sm:text-display-28">
            {PRODUCT_STATUS_LABEL[product.status]}
          </h2>
          <p className="text-ink-muted mt-2 text-15 leading-body">{STATUS_NOTE[product.status]}</p>
          <div className="mt-4">
            <ProductStatusButtons csrfToken={csrfToken} productId={product.id} status={product.status} />
          </div>
          {siteUrl ? (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener"
              className="label text-ink mt-4 inline-flex min-h-11 items-center text-12 tracking-12 underline underline-offset-4"
            >
              View on site
            </a>
          ) : null}
          <dl className="text-ink-muted mt-4 flex flex-col gap-0.5 text-13 leading-body">
            <div className="flex flex-wrap gap-2">
              <dt className="text-ink-dim">Created</dt>
              <dd>{SHOP_DATE_TIME.format(product.createdAt)}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="text-ink-dim">Last changed</dt>
              <dd>{SHOP_DATE_TIME.format(product.updatedAt)}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="product-photos" className="border-border-strong mt-12 border-t pt-8 sm:mt-14 sm:pt-10">
          <h2 id="product-photos" className="display text-ink text-display-24 sm:text-display-28">
            Photos
          </h2>
          <p className="text-ink-muted mt-2 max-w-measure text-15 leading-body">
            The main photo is the one on the product card. Each is shown whole, never cropped.
          </p>
          <div className="mt-6">
            <ProductPhotos
              productId={product.id}
              csrfToken={csrfToken}
              photos={photos.map(({ id: photoId, url, alt }) => ({ id: photoId, url, alt }))}
            />
          </div>
        </section>

        <div className="mt-12 max-w-measure sm:mt-14">
          <ProductForm
            mode="edit"
            category={product.category}
            productId={product.id}
            initialValues={productFormValues(product)}
            lowestVendorPrice={lowestVendorPrice(product.sources)}
            brands={brands}
            vendors={vendors}
            csrfToken={csrfToken}
          />
        </div>
      </main>
    </>
  );
}
