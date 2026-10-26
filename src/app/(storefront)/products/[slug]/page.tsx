import type { Metadata } from "next";

import { redirectToCanonicalVehicle } from "@/features/finder/canonical";
import {
  ProductPage,
  productMetadata,
} from "@/features/product/components/product-page";
import { productRoute } from "@/lib/routes";

/* ---------------------------------------------------------------------------
   `/products/[slug]` — composition only (`docs/decisions.md` §3: routes are
   thin). The page itself is `src/features/product/components/product-page.tsx`.

   This route answers a product URL WITH a query string (`?qty=`, D50; a
   carried vehicle, D158), rendered per request. A bare `/products/<slug>`
   never reaches it, as a document, a client navigation or a prefetch:
   `src/proxy.ts` rewrites it to `/product-cache/[slug]`, the same page kept
   until the next catalogue write (D194).

   No `generateStaticParams` here, deliberately. Reading `searchParams` for
   `?qty=` (D50) makes this route dynamic — `next build` reports it as `ƒ`, not
   `○`. An unknown slug is a real 404 (measured) since D91b removed the
   group's `loading.tsx`: until then `notFound()` ran after a 200 shell had
   already streamed — a soft 404.
   --------------------------------------------------------------------------- */

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return productMetadata(slug);
}

export default async function ProductRoute({
  params,
  searchParams,
}: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  /* An old model name in the URL goes to the canonical one, before any
     database read (D155). */
  const query = await searchParams;
  redirectToCanonicalVehicle(productRoute(slug), query);
  return <ProductPage slug={slug} query={query} />;
}
