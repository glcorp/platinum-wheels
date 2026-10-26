import type { Metadata } from "next";

import {
  ProductPage,
  productMetadata,
} from "@/features/product/components/product-page";

/* ---------------------------------------------------------------------------
   `/product-cache/[slug]` — the bare `/products/<slug>` page, kept (D194).

   Never addressed by name: `src/proxy.ts` rewrites a bare product document
   request (no query string, no `RSC` header) here after its existence check,
   and answers a request for `/product-cache/**` itself with the storefront
   404. The address bar, the canonical and every link keep `/products/<slug>`.

   It reads no `searchParams`, so it is incremental static regeneration: the
   first request for a slug renders it and every later one is served from the
   cache. `generateStaticParams` returns nothing, so the build renders none of
   the 40,000 and each is rendered on its first visit (Next's "all paths at
   runtime", `generate-static-params.md`). Its reads are tagged
   `CATALOGUE_TAG` (`features/product/load.ts`), so a staff save in the admin
   expires every kept page with the data (`updateTag`, D109) and the next
   visit renders it fresh. The page is the same component as
   `/products/[slug]` with an empty query: quantity 1, no vehicle.
   --------------------------------------------------------------------------- */

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

export async function generateMetadata({
  params,
}: PageProps<"/product-cache/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return productMetadata(slug);
}

export default async function CachedProductRoute({
  params,
}: PageProps<"/product-cache/[slug]">) {
  const { slug } = await params;
  return <ProductPage slug={slug} query={{}} />;
}
