import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { AdminProductCard } from "@/features/admin/components/admin-product-card";
import { AdminTopBar } from "@/features/admin/components/admin-top-bar";
import { BulkStatusBar } from "@/features/admin/components/bulk-status-bar";
import { ProductFilters } from "@/features/admin/components/product-filters";
import { adminListBrands, adminListProducts } from "@/features/admin/product-queries";
import {
  PRODUCT_LIST_PAGE_SIZE,
  PRODUCT_LIST_PARAM,
  type ProductListQuery,
} from "@/features/admin/product-types";
import { requireAdminSession } from "@/features/admin/session";
import { ADMIN_ROUTES } from "@/features/admin/types";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  type ProductList,
} from "@/features/catalog/catalog-types";

/* ---------------------------------------------------------------------------
   /products (admin host) — the product list (D116)

   NO ARTBOARD DRAWS THIS (D89). Every status, newest change first, 50 a
   page; search and filters in the URL; bulk status changes for ticked rows
   or everything the filter matches. Served from this folder by `src/proxy.ts`
   (D115).
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

/** The query string, read strictly: an unknown category or status is
 *  dropped rather than passed to the database. */
function readQuery(params: SearchParams): ProductListQuery {
  const category = PRODUCT_CATEGORIES.find((value) => value === one(params, PRODUCT_LIST_PARAM.category));
  const status = PRODUCT_STATUSES.find((value) => value === one(params, PRODUCT_LIST_PARAM.status));
  const page = Number(one(params, PRODUCT_LIST_PARAM.page) ?? "1");
  return {
    search: one(params, PRODUCT_LIST_PARAM.search)?.slice(0, 200),
    category,
    status,
    brand: one(params, PRODUCT_LIST_PARAM.brand),
    page: Number.isFinite(page) && page >= 1 ? Math.trunc(page) : 1,
  };
}

function pageHref(query: ProductListQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.search) params.set(PRODUCT_LIST_PARAM.search, query.search);
  if (query.category) params.set(PRODUCT_LIST_PARAM.category, query.category);
  if (query.status) params.set(PRODUCT_LIST_PARAM.status, query.status);
  if (query.brand) params.set(PRODUCT_LIST_PARAM.brand, query.brand);
  if (page > 1) params.set(PRODUCT_LIST_PARAM.page, String(page));
  const search = params.toString();
  return search ? `${ADMIN_ROUTES.products}?${search}` : ADMIN_ROUTES.products;
}

async function load(query: ProductListQuery): Promise<{ list: ProductList; brands: string[] } | null> {
  try {
    const [list, brands] = await Promise.all([adminListProducts(query), adminListBrands()]);
    return { list, brands };
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
          <ProductFilters query={filter} brands={data?.brands ?? []} />
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
            ) : total > 0 ? (
              <p className="text-ink-muted text-15 leading-body">This page is past the end of the list.</p>
            ) : null}

            {pages > 1 ? (
              <nav aria-label="Pages" className="flex flex-wrap items-center gap-3 pt-4">
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
              </nav>
            ) : null}
          </section>
        )}
      </main>
    </>
  );
}
