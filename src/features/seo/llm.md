# src/features/seo

## Purpose
Everything the site says to a search engine or a link-unfurler, in one place (D112): the launch switch
that keeps crawlers out, the canonical and preview tags every indexable page carries, the sitemap, the
structured data and the two link-preview cards. Delete it and the pages still render, but `/robots.txt`,
`/sitemap.xml`, every canonical, every JSON-LD block and both preview images go with it, and the root
layout stops building.

## Owns
- [`indexing.ts`](indexing.ts) — the launch switch. `isIndexingEnabled()` is on only when
  `SEARCH_INDEXING_ENABLED` is exactly `true`; `isCanonicalHost()` and `mayIndexHost()` add the hostname;
  `siteRobots()` is the site-wide `robots` meta. Pure apart from one `process.env` read.
- [`metadata.ts`](metadata.ts) — `pageMetadata()`, the one builder for a page's title, description,
  canonical, Open Graph and Twitter tags; `SITE_CARD`, `SITE_PREVIEW` and `PREVIEW_SIZE` (1200x630).
- [`schema.ts`](schema.ts) — structured data as plain objects: `organizationSchema()` (`OnlineStore`),
  `websiteSchema()`, `breadcrumbSchema()` with `categoryBreadcrumb()` and `productBreadcrumb()`,
  `productSchema()`, and `toProductSeo()`, which turns the card-shaped `Product` into what a product
  page's title, description and markup need. Also `absoluteUrl()` and `CATEGORY_NAME`.
- [`json-ld.tsx`](json-ld.tsx) — `JsonLd`, a Server Component that writes those objects as inline
  `<script type="application/ld+json">`, with `<` escaped.
- [`sitemap.ts`](sitemap.ts) — the sitemap's sections, entries and XML, and the two responses the
  handlers send. Server only: it calls `listProductUrls`.
- [`preview-cards.tsx`](preview-cards.tsx) — `renderSiteCard()` (logo and tagline, `next/og`),
  `loadProductPhoto()` and `renderProductCard()` (the photo on the dark ground, `sharp`). Server only.
- [`fonts/BarlowCondensed-Bold.ttf`](fonts/BarlowCondensed-Bold.ttf) and [`fonts/OFL.txt`](fonts/OFL.txt)
  — the display face's one weight, for the site card only, with its licence (SIL OFL 1.1; from
  `google/fonts`, `ofl/barlowcondensed`). Never served to a browser: the site's own type still comes
  from `next/font` (D20).

The routes that call these live in `src/app/`: `robots.ts`, `sitemap.xml/route.ts`,
`sitemaps/[section]/route.ts`, `opengraph-image.tsx`, `(storefront)/products/[slug]/og.jpg/route.ts`,
and the `metadata` of `layout.tsx` and of each indexable page.

## Rules
- **Indexing is off unless the flag is exactly `true`** (owner, 2026-09-30; the D104 pattern). Off:
  `/robots.txt` disallows everything, the sitemaps are 404 and every page is `noindex, nofollow`. The
  flag is `false` or unset in Vercel until launch (`todo.md`). **Page `robots` meta is fixed at build
  time**, so turning the flag on needs a redeploy.
- **Only `platinumwheels.ca` is ever offered to a crawler.** `/robots.txt` and the sitemaps check the
  `Host` header on every request, because `src/proxy.ts` lets any path with a dot through on `admin.`
  and `pay.`, and the `*.vercel.app` alias serves the same build. **The page-level `robots` meta does not
  check the host**, on purpose: reading a request in the root layout would make every static page
  dynamic, and the mobile LCP gate is already red (root `llm.md` §7.12).
- **One canonical origin, `SITE_URL` in `src/lib/site.ts`:** https, apex, no `www`. Nothing here builds
  a URL from the request's host.
- **An indexable page builds its metadata with `pageMetadata()` and nothing else.** Metadata merges
  shallowly, so a hand-written `openGraph` on a page drops the site name, locale and image.
- **The canonical is the clean path.** Search, filter, sort, `?show=`, `?qty=` and vehicle params never
  make a second address, and no URL with a query string enters a sitemap.
- **Open, `robots.txt` disallows any query string on `/tires`, `/wheels` and `/accessories`**, and
  nothing else (owner, 2026-09-30: *"you take the decision as what is industry standard"*; *derived*).
  The filter space is unbounded and every answer is a database read; Google's faceted-navigation
  guidance is to block such URLs in `robots.txt` rather than lean on the canonical. A product's `?qty=`
  stays crawlable and canonicalises.
- **Never indexed, never in a sitemap:** `/styleguide`, `/qa-error`, `/cart` (D122), every admin page
  (on its own host since D115), `/pay/**`. Each sets
  its own `robots`, which wins in both flag states. The sitemap lists are allow-lists.
- **No street address, no postal code, no `geo`, no map and no opening hours, anywhere.** There is no
  shop (owner, 2026-09-30). The business is an `OnlineStore` based in Brampton. Its `address` is **city,
  province and country only** (owner, 2026-09-30, choosing *"City-only address"*). 9 am to 8 pm appears
  only as `hoursAvailable` on the two contact points. **`areaServed` is Brampton only**, not the GTA.
- **No price, offer, currency or availability in structured data** (owner, 2026-09-30), and no rating or
  review ever (`docs/decisions.md` §8). A `Product` carries name, brand, size, category, image and URL.
  **An unbranded accessory (D125) carries no `brand` at all**, never an empty or stand-in one, and its
  name, title and breadcrumb leaf are its own name alone (`productName()`, `src/lib/product-name.ts`).
  A vendor's own price is staff only and never enters a schema (D125).
- **Link previews** (owner, 2026-09-30): one branded dark card for the site; on a product page the
  product's own photo on the same dark ground, 1200x630, no text and no price; a product with no photo
  names the site card.
- **All of it is server-rendered; no `"use client"` here** (`docs/decisions.md` §4). JSON-LD is inline,
  so it is not a third-party script (§6).
- **Cross-feature imports go through `catalog/` only** (D37): `schema.ts` and `sitemap.ts` import its
  types, `ACCESSORY_LABEL` and `listProductUrls`, and nothing from `product/` or `results/`. The pages
  in `src/app/` join the two sides.
- New copy (titles, descriptions, alt text) follows `.claude/rules/ui.md` "Copy": short, specific, no em
  dashes, no exclamation marks.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D112 | 2026-09-30 | Everything above. | The owner's six SEO rulings and the four follow-ups. | Owner; root `llm.md` §5b |
| — | 2026-09-30 | The sitemap is two Route Handlers with hand-built XML, not Next's `sitemap.ts`. | `generateSitemaps` serves `/sitemap/<id>.xml` with no index at `/sitemap.xml`, and a handler has to answer 404 by flag and host. | *derived*, D112 |
| — | 2026-09-30 | The product card is a plain route (`og.jpg`), not the `opengraph-image` file convention. | The page names it only when the product has a photo; the convention would emit it always. | *derived*, D112 |
| — | 2026-09-30 | `sharp` is a runtime dependency (it was a dev one). | The product card route converts and composites at request time. | *derived*, D112 |
| — | 2026-09-30 | The organisation's `logo` is the white-plate file; the card uses the transparent one. | Google shows a logo on white. | *derived*, D112 |
| — | 2026-09-30 | One font file is committed for the site card. | `next/og` cannot read the `woff2` that `next/font` fetches; the card drew its tagline in the bundled Geist until then. | Owner approved the download; D112 |
| — | 2026-09-30 | With the flag off, `robots.txt` disallows **and** pages say `noindex`, although a disallow keeps Google from reading the `noindex`. | Owner: *"i js want to keep the site hidden until its ready"*. No pre-launch host has inbound links; the risk that matters is a flag-off build reaching the apex, which `todo.md` S1 guards. | Owner; D112 |

## Connects to
- Depends on: `src/lib/site.ts` (`SITE_URL`, `SITE`, `CONTACTS`, `CONTACT_HOURS`), `src/lib/routes.ts`,
  `src/lib/product-name.ts`,
  `src/features/catalog/` (`queries.ts` `listProductUrls`, `types.ts`, `adapter.ts`), `next/og`, `sharp`,
  `public/images/logo/` and `public/images/products/`, `next.config.ts` (`outputFileTracingIncludes`
  puts the product images in the `og.jpg` route's bundle).
- Depended on by: `src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.xml/`, `src/app/sitemaps/`,
  `src/app/opengraph-image.tsx`, every indexable page under `src/app/(storefront)/`, and
  `tests/e2e/seo.spec.ts`.

## Don't
- Don't set `alternates.canonical` in the root layout. Every page would inherit `/`.
- Don't hand a `.webp` to `ImageResponse`. It draws nothing and raises no error (measured 2026-09-30);
  convert to PNG with `sharp` first, as `loadLogo()` does.
- Don't add `streetAddress`, `postalCode`, `openingHours`, `offers`, `aggregateRating` or `review` to a
  schema to satisfy a validator's warning. Each is an owner ruling; `tests/e2e/seo.spec.ts` fails on any
  of them.
- Don't widen the `robots.txt` disallow to `/*?`. It would also block `/_next/image?url=…`, the product
  photos.
- Don't disallow the `noindex` pages in `robots.txt`. A crawler must be able to fetch a page to read its
  `noindex`.
- Don't fetch a photo from any host but Vercel Blob in `loadProductPhoto()`. The URL comes from a
  database row.
- Don't put a `loading.tsx` or a `<Suspense>` above a category or product page. Next would then stream
  the title, canonical and robots meta into `<body>` for Googlebot and every AI crawler, which are not on
  its "HTML-limited" list; today they arrive in `<head>` because the page waits on the database first
  (measured 150 of 150 as Googlebot, 2026-09-30). `tests/e2e/seo.spec.ts` fails if that changes. The same
  boundary turns a 404 into a 200 (D91b, D111).
- Don't read `headers()` in the root layout or in `pageMetadata()` to make the meta host-aware.

## Open
1. **`Product` markup has no offer**, so it does not qualify for Google's product rich result, and Search
   Console may list product pages under "invalid items". Add `offers` once the owner settles the pricing
   rule and confirms prices are public (`todo.md` S6). `gtin` is held by the catalogue and is not
   published; the owner declined it for now. Owner.
2. **Most products are reachable only through the sitemap.** A category page links its first 24 to 150
   cards; there is no brand, model or size page. Both research passes name model and size hub pages, on
   clean paths and self-canonical, as the main thing a catalogue of this shape is missing, for search
   engines and for AI answers alike. New pages and new copy, so its own session. Owner.
3. **The product sitemaps read the catalogue on every request and are not cached.** One indexed query per
   file; revisit if a crawler makes it a load. The wheels file is near 34,000 URLs against the 50,000
   limit: split it when it passes that. Coordinator.
4. **`<html lang>` is `en`**, the previews say `en_CA`. Google ignores `lang`. Changing it touches
   `layout.tsx` and `global-error.tsx`. Owner.
5. **Legal name.** `SITE.legalName` has no `Inc.`; the live goodwill site's markup has. Client, via owner
   (`todo.md` S5).
6. **Content an assistant could cite** (size and bolt-pattern pages, how quoting works, an Ontario
   winter-tire guide, fitment basics) does not exist. `llms.txt` was considered and skipped: no search
   engine or AI company says its crawler reads it. Owner.
7. **Never measured:** Lighthouse after this change (the home page grew about 0.6 KB gzipped and gained no
   client code), Google's Rich Results Test and any real link-unfurler, all of which need a public URL.
   Coordinator, at launch.
8. **The product preview card is cached for a day.** `og.jpg` answers `public, max-age=3600,
   s-maxage=86400`, and since D116 and D117 staff can hide a product or change and remove its photos;
   `updateTag` does not purge that CDN entry, so a link preview can show the old photo, or a hidden
   product's card, for up to 24 hours. Found at the canonical merge (D124); minor while the site is
   `noindex`. A shorter `s-maxage` is the cheap fix.
