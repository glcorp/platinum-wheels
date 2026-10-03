import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AdminTopBar } from "@/features/admin/components/admin-top-bar";
import { ProductForm } from "@/features/admin/components/product-form";
import { CATEGORY_LABEL, CATEGORY_PLURAL } from "@/features/admin/product-display";
import { adminListBrands, adminListVendors } from "@/features/admin/product-queries";
import { requireAdminSession } from "@/features/admin/session";
import { ADMIN_ROUTES } from "@/features/admin/types";
import { PRODUCT_CATEGORIES } from "@/features/catalog/catalog-types";

/* ---------------------------------------------------------------------------
   /products/new (admin host) — create a product (D116)

   NO ARTBOARD DRAWS THIS (D89). Category first, because it decides every
   field below and is fixed once the product exists (the database pins spec
   rows to it); then the form for that category. The choice rides in the URL
   (`?category=wheels`), so the step survives a reload and the back button.

   A new product starts hidden (D107b) and lands on its edit page, where the
   photos and the Publish button are.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "New product",
};

const CATEGORY_NOTE = {
  tires: "Size, season, load and speed.",
  wheels: "Diameter, width, bolt pattern and offset.",
  accessories: "Lug nuts, locks, rings, sensors and more.",
} as const;

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { csrfToken } = await requireAdminSession();
  const raw = (await searchParams).category;
  const category = PRODUCT_CATEGORIES.find((value) => value === (Array.isArray(raw) ? raw[0] : raw));
  const [brands, vendors] = category
    ? await Promise.all([adminListBrands(category), adminListVendors()])
    : [[], []];

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
        <h1 className="display text-ink mt-3 text-display-40 sm:text-display-56">
          {category ? `New ${CATEGORY_LABEL[category].toLowerCase()}` : "New product"}
        </h1>
        <p className="text-ink-muted mt-3 max-w-measure text-15 leading-body sm:text-16">
          {category
            ? "It starts hidden. Add photos and publish it from its page once it is ready."
            : "What are you adding? The category can't be changed later."}
        </p>

        {category ? (
          <div className="mt-10 max-w-measure sm:mt-12">
            <ProductForm
              mode="create"
              category={category}
              initialValues={{}}
              brands={brands}
              vendors={vendors}
              csrfToken={csrfToken}
            />
            <div className="mt-6">
              <Button href={ADMIN_ROUTES.newProduct} variant="tertiary" size="compact">
                Choose another category
              </Button>
            </div>
          </div>
        ) : (
          <ul className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-6">
            {PRODUCT_CATEGORIES.map((value) => (
              <li key={value}>
                <Link
                  href={`${ADMIN_ROUTES.newProduct}?category=${value}`}
                  className="bg-surface border-border-strong hover:border-ink-dim flex h-full flex-col gap-2 border p-5 sm:p-6"
                >
                  <span className="display text-ink text-display-28">{CATEGORY_PLURAL[value]}</span>
                  <span className="text-ink-muted text-15 leading-body">{CATEGORY_NOTE[value]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
