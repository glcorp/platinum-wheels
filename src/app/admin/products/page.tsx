import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AdminProductCard } from "@/features/admin/components/admin-product-card";
import { AdminTopBar } from "@/features/admin/components/admin-top-bar";
import { BulkStatusBar } from "@/features/admin/components/bulk-status-bar";
import { PageJump } from "@/features/admin/components/page-jump";
import { ProductFilters, type ProductFilterOptions } from "@/features/admin/components/product-filters";
import {
  adminListBrands,
  adminListProducts,
  adminListRimSizes,
  adminListVendors,
} from "@/features/admin/product-queries";
import {
  PRODUCT_LIST_PAGE_SIZE,
  PRODUCT_LIST_PARAM,
  type ProductListQuery,
} from "@/features/admin/product-types";
import { requireAdminSession } from "@/features/admin/session";
import { ADMIN_ROUTES } from "@/features/admin/types";
import {
  ACCESSORY_KINDS,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  type ProductList,
} from "@/features/catalog/catalog-types";

/* ---------------------------------------------------------------------------
   /products (admin host) — the product list (D116)

   NO ARTBOARD DRAWS THIS (D89). Every status, newest change first, 50 a
   page; search and filters in the URL; bulk status changes for ticked rows
   or everything the filter matches. Served from this folder by `src/proxy.ts`
   (D115). D127b adds the vendor, accessory type, rim size and no-photo
   filters and a Go to page box; a page past the end goes to the last one.
   --------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Products",
};

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  return text ? text : undefined;
}

/** The query string, read strictly: an unknown category, status or type is
 *  dropped rather than passed to the database. An accessory type counts only
 *  with the accessories category, the one place its control is shown, so the
 *  filter applied is always the filter on screen. */
function readQuery(params: SearchParams): ProductListQuery {
  const category = PRODUCT_CATEGORIES.find((value) => value === one(params, PRODUCT_LIST_PARAM.category));
  const status = PRODUCT_STATUSES.find((value) => value === one(params, PRODUCT_LIST_PARAM.status));
  const accessoryType =
    category === "accessories"
      ? ACCESSORY_KINDS.find((value) => value === one(params, PRODUCT_LIST_PARAM.accessoryType))
      : undefined;
  const rawRim = one(params, PRODUCT_LIST_PARAM.rim);
  const rim = rawRim === undefined ? Number.NaN : Number(rawRim);
  const page = Number(one(params, PRODUCT_LIST_PARAM.page) ?? "1");
  return {
    search: one(params, PRODUCT_LIST_PARAM.search)?.slice(0, 200),
    category,
    status,
    brand: one(params, PRODUCT_LIST_PARAM.brand),
    vendor: one(params, PRODUCT_LIST_PARAM.vendor),
    accessoryType,
    rim: Number.isFinite(rim) && rim > 0 ? rim : undefined,
    noPhoto: one(params, PRODUCT_LIST_PARAM.noPhoto) === "1" ? true : undefined,
    page: Number.isFinite(page) && page >= 1 ? Math.trunc(page) : 1,
  };
}

/** The filter as query-string pairs, in one order: the pagination links and
 *  the Go to page box both carry it. */
function filterParams(query: ProductListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) params.set(PRODUCT_LIST_PARAM.search, query.search);
  if (query.category) params.set(PRODUCT_LIST_PARAM.category, query.category);
  if (query.accessoryType) params.set(PRODUCT_LIST_PARAM.accessoryType, query.accessoryType);
  if (query.status) params.set(PRODUCT_LIST_PARAM.status, query.status);
  if (query.brand) params.set(PRODUCT_LIST_PARAM.brand, query.brand);
  if (query.vendor) params.set(PRODUCT_LIST_PARAM.vendor, query.vendor);
  if (query.rim !== undefined) params.set(PRODUCT_LIST_PARAM.rim, String(query.rim));
  if (query.noPhoto) params.set(PRODUCT_LIST_PARAM.noPhoto, "1");
  return params;
}

function pageHref(query: ProductListQuery, page: number): string {
  const params = filterParams(query);
  if (page > 1) params.set(PRODUCT_LIST_PARAM.page, String(page));
  const search = params.toString();
  return search ? `${ADMIN_ROUTES.products}?${search}` : ADMIN_ROUTES.products;
}

async function load(
  query: ProductListQuery,
): Promise<{ list: ProductList; options: ProductFilterOptions } | null> {
  try {
    const [list, brands, vendors, rims] = await Promise.all([
      adminListProducts(query),
      adminListBrands(),
      adminListVendors(),
      adminListRimSizes(),
    ]);
    return { list, options: { brands, vendors, rims } };
  } catch (error) {
    // `redirect()` from the gate must still propagate.
    if (error instanceof Error && "digest" in error) throw error;
    console.error(JSON.stringify({ at: "admin.products.list", detail: error instanceof Error ? error.message : "unknown" }));
    return null;
  }
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { csrfToken } = await requireAdminSession();
  const query = readQuery(await searchParams);
  const { page = 1, ...filter } = query;
  const filtered = Object.values(filter).some((value) => value !== undefined);
  const data = await load(query);

  const total = data?.list.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PRODUCT_LIST_PAGE_SIZE));
  const items = data?.list.items ?? [];
  // A page past the end (an old link, a number typed into Go to page) goes
  // to the last page rather than an empty one.
  // An empty list (`pages` is 1) sends any later page back to page 1.
  if (data !== null && page > pages) redirect(pageHref(query, pages));

  return (
    <>
      <AdminTopBar csrfToken={csrfToken} current="products" />
      <main
        id="main"
        tabIndex={-1}
        className="w-full flex-1 px-4 pt-10 pb-20 sm:px-8 sm:pt-14 sm:pb-30 md:px-12 lg:mx-auto lg:max-w-content"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="display text-ink text-display-40 sm:text-display-56">Products</h1>
          <Button href={ADMIN_ROUTES.newProduct} variant="primary" size="compact">
            New product
          </Button>
        </div>

        <div className="mt-8 sm:mt-10">
          <ProductFilters query={filter} options={data?.options ?? { brands: [], vendors: [], rims: [] }} />
        </div>

        {data === null ? (
          <p role="alert" className="text-ink mt-10 text-15 leading-body">
            The product list could not be loaded. Refresh in a minute.
          </p>
        ) : (
          <section aria-labelledby="product-results" className="mt-10 flex flex-col gap-4 sm:mt-12">
            <h2 id="product-results" className="text-ink-muted text-15 leading-body">
              {total === 0
                ? filtered
                  ? "No products match this search."
                  : "No products yet."
                : `${total.toLocaleString("en-CA")} ${total === 1 ? "product" : "products"}${filtered ? " match" : ""}${
                    pages > 1 ? ` · page ${Math.min(page, pages)} of ${pages.toLocaleString("en-CA")}` : ""
                  }`}
            </h2>

            {items.length > 0 ? (
              <>
                {/* Keyed on the list it serves, so a new page or filter starts with
                    nothing ticked and no message from the last one. */}
                <BulkStatusBar key={pageHref(query, page)} csrfToken={csrfToken} filter={filter} total={total} />
                <ul className="flex flex-col gap-3">
                  {items.map((product) => (
                    <AdminProductCard key={product.id} product={product} csrfToken={csrfToken} />
                  ))}
                </ul>
              </>
            ) : null}

            {pages > 1 ? (
              <nav aria-label="Pages" className="flex flex-wrap items-end gap-3 pt-4">
                {page > 1 ? (
                  <Button href={pageHref(query, Math.min(page - 1, pages))} variant="secondary" size="compact">
                    Previous
                  </Button>
                ) : null}
                {page < pages ? (
                  <Button href={pageHref(query, page + 1)} variant="secondary" size="compact">
                    Next
                  </Button>
                ) : null}
                <PageJump
                  params={[...filterParams(query).entries()]}
                  page={Math.min(page, pages)}
                />
              </nav>
            ) : null}
          </section>
        )}
      </main>
    </>
  );
}
