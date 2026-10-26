# src/app/(storefront)/

## Purpose
The route group holding every public storefront route. The parentheses mean it contributes **no URL
segment** — `page.tsx` here is `/`, not `/storefront`. Its whole reason to exist is the rule in
`docs/decisions.md:62`: routes are **thin** — metadata, landmarks, composition only. All markup comes
from `src/features/*` and `src/components/*`. If a page here starts holding layout maths or business
logic, the parity baseline and the feature boundary both stop meaning anything.

## Owns
- [`page.tsx`](page.tsx) — route `/`. Composition only: `SiteHeader variant="over-hero"`, the eight home
  sections in manifest order, `SiteFooter`. Parity: `design/reports/home.md`.
- [`tires/page.tsx`](tires/page.tsx) — route `/tires`, **built** 2026-09-21 as `/results` and moved
  here by **D112** (2026-09-30); `/results` is a 404 with no redirect. Since **D58** it is
  three lines long: it names the category (`tires`) and the title, and hands `await searchParams` to
  `ResultsPage` (`src/features/results/components/results-page.tsx`), which holds the whole measured
  composition — `SiteHeader variant="solid"` (D38), `ResultsToolbar`, `FilterSortBar`, the
  `md:results-grid` shell holding `FilterRail` + `ResultsGrid` (D46), `CallCtaPanel` (a results section,
  D47(1)) and `SiteFooter`. Nothing observable about this route changed; the composition simply moved
  one level so three routes can share it. Parity: `design/reports/results.md`.
- [`wheels/page.tsx`](wheels/page.tsx) and [`accessories/page.tsx`](accessories/page.tsx) — routes
  `/wheels` and `/accessories`, **built** 2026-09-21 (**D58**), previously `PageStub`s. Identical in
  shape to `tires/page.tsx`, differing only in the `category` they pass and their title. They have
  **no artboards** and are not parity rows: they inherit `/tires`' parity by rendering the same
  component tree (`design/manifest.md` Routes).
- [`search/page.tsx`](search/page.tsx) — route `/search?q=` (**D173**; `?more=` gone since D178), dynamic. Header (no nav item
  current), the `Search` `<h1>`, `SearchForm` (a GET form, focused only while empty) and `SearchResults`,
  from `src/features/search/`. `robots: noindex, nofollow` in both flag states; not in any sitemap. Since
  **D185** it reads a searched car (`year`/`make`/`model`, kept only when `isFinderVehicle` accepts it) and
  passes it to the header, the form and the results' `See all` links.
- [`cart/page.tsx`](cart/page.tsx) — route `/cart` (**D122**), static. Header (no nav item current), the
  `Request a quote` eyebrow and `Your cart` `<h1>`, a `<noscript>` line with the phone (the cart needs the
  browser), and `CartView` from `src/features/cart/`, handed the quote copy resolved on the server.
  `robots: noindex, nofollow` in both flag states; not in any sitemap.
- [`products/[slug]/page.tsx`](products/[slug]/page.tsx) — route `/products/[slug]`, **built**
  2026-09-21. `async`, takes `PageProps<"/products/[slug]">`, resolves the slug from the catalogue database since D108b (a real 404 if
  unknown or hidden since D91b, but a *discontinued* product still returns 200) and turns `productView(product, query)` into
  one `ProductView`; composition only. The breadcrumb is rendered once and placed twice — mobile above
  the gallery, desktop inside the buy panel — with the visibility classes owned here, not by the
  component. The header's active nav item follows the product's category (D58), so a wheel PDP marks
  Wheels. No `generateStaticParams` — reading `searchParams` for `?qty=` makes the route dynamic (D50).
  Parity: `design/reports/product.md`. **Since D157** a direct visit to an unknown or hidden slug never
  reaches this page: `src/proxy.ts` rewrites it to the branded 404, because Next 16.4 canary answers a
  `notFound()` thrown here with a 404 whose body is an empty `__next_error__` shell that only JavaScript
  fills (measured; a segment `not-found.tsx` does not change it). The page's `notFound()` stays for client
  navigations and a product hidden between the check and the render. **Since D194** the route is a thin
  shell over `ProductPage` (`src/features/product/components/product-page.tsx`) and answers only URLs with
  a query string; a bare request (document, client navigation or prefetch) is rewritten by proxy to
  `product-cache/[slug]`.
- [`product-cache/[slug]/page.tsx`](product-cache/[slug]/page.tsx) — **D194.** The bare
  `/products/<slug>` page, kept: the same `ProductPage` with an empty query, no `searchParams`, and
  `generateStaticParams` returning nothing, so each slug renders on its first visit and is then served from
  the cache until a catalogue write expires `CATALOGUE_TAG`. Reached only through `src/proxy.ts`'s rewrite;
  asked for by name it is the storefront 404.
- ~~`loading.tsx`~~ — **removed 2026-09-29 (D91b, owner ruling).** Its group-level Suspense boundary
  streamed every page into `<div hidden id="S:0">` behind the skeleton, so with JavaScript off every
  route showed only the skeleton (every no-JS promise in D44/D45/D50/D83 was void while the served HTML
  looked right), an unknown product slug returned 200 and a render error returned 200. Measured on a
  build without it: 404 and 500. Nothing replaced it: the results and product routes wait on the
  database since D108b, with no Suspense boundary, which is what keeps the 404 real (D111).
- [`products/[slug]/og.jpg/route.ts`](products/[slug]/og.jpg/route.ts) — `/products/<slug>/og.jpg`, the
  product's link-preview card (D112): its photo on the dark ground, 1200x630. A 404 for an unknown or
  hidden slug; a redirect to the site card when the photo cannot be read.
- [`qa-error/page.tsx`](qa-error/page.tsx) — **a test fixture, not a page** (D91b). Throws only when the
  server was started with `QA_ERROR_ROUTE=1` (the Playwright config sets it); otherwise `notFound()`. It
  exists so `tests/e2e/error-boundary.spec.ts` can prove the boundary end to end (a real 500).
- [`error.tsx`](error.tsx) — the group's route error boundary (**D62**). The directive plus one
  re-export of `src/components/site/route-error.tsx`; **no component code lives here.** This is the
  build's only `"use client"` under `src/app/` and it is a framework requirement, not a choice — Next
  fails the build on a bare re-export. It does not wrap `src/app/layout.tsx`; that would need
  `global-error.tsx`, which does not exist and is not owed. Since D91b a render error here returns a real
  **500** (measured on `/qa-error`), not a 200 with the boundary streamed into it.
- [`about/page.tsx`](about/page.tsx), [`privacy/page.tsx`](privacy/page.tsx) and
  [`terms/page.tsx`](terms/page.tsx) — the three **written** pages. Undesigned (D26, D39): no artboard
  draws any of them, so they are not parity rows and there is nothing for them to deviate from. They
  left `PageStub` on 2026-09-22 for `ProsePage` / `ProseSection` (`src/components/site/prose-page.tsx`),
  on the owner's note that they were *"not centered in desktop view, looks bland too — go full in and
  add details and style"* — then, the same day, dropped the on-page section index and the per-section
  numbering that pass had added, on the owner's follow-up that the result *"looks too much now"*. Still
  thin: each file is metadata, a `ProsePage` call and its copy, with no layout maths of its own. The two
  legal pages hold one `SECTIONS` array, mapped straight into `ProseSection`s. `wheels/` and
  `accessories/` left this list on 2026-09-21 (D58); `PageStub`'s only caller now is
  `src/app/not-found.tsx`.
  **2026-10-11:** `/about`'s "Talk to us" shows the shop's one number with no names (D161) and "Who we
  are" says the shop serves customers across Canada (D190, `SITE.serviceArea`; was the GTA, D163); `/privacy`'s
  "Cookies and tracking" names the second browser entry, the sent-requests record (D162).
  **What "add style" did not license, either pass:** no new fact about the business, and on the legal
  pages no new obligation — structure and typesetting only. See `src/components/site/llm.md` Owns/Rules.
- [`styleguide/page.tsx`](styleguide/page.tsx) (471 ln) — route `/styleguide`, `noindex` via
  `metadata.robots: { index: false, follow: false }` (`:18-21`). Eleven blocks covering every primitive,
  variant and state, with computed contrast ratios shown on the page rather than buried in markdown
  (`:23-44`), and seed products transcribed from `design/inventory/results.md` §7 (`:46-48`). It now
  also carries `Button size="load"`, the `/tires` `Load more` size (`:229`). The final section,
  *"States the design never drew"*, holds the undrawn states — **complete since D62**: the 404, the
  `ResultsEmpty` empty-results state (`:445`) and the `Change vehicle` disclosure open, which the
  artboards draw only closed (`:449-461`, D45) and the PDP quote-form success panel, rendered from the
  real `QuoteSuccess` component so it cannot drift (D51), the quote-form error summary (D57), the skip
  link (D57), and the **route error** and **loading** states (D62). The route error renders from
  `RouteErrorPanel` with `as="h2"` and no `retry` — this page is a Server Component and RSC refuses to
  serialise a function across the client boundary, which the build catches outright. The product-card
  block also shows two unbranded accessories beside a branded one (D125): no stamp, no brand line,
  an empty no-photo tile, same row height.

## Rules
- **The four routes that read a vehicle from the URL redirect old model names first** (D155, *derived*): `tires`,
  `wheels`, `accessories` and `products/[slug]` call `redirectToCanonicalVehicle` before any other work
  (`src/features/finder/canonical.ts`; 308, same path, params kept in order).
- **Every indexable page builds its metadata with `pageMetadata()`** (`src/features/seo/metadata.ts`,
  D112): title, description, the clean canonical path, Open Graph and Twitter in one call. `/`, the three
  category pages and the product page also render `JsonLd`, outside `PageTransition`. `/styleguide` and
  `/qa-error` keep their own `robots: noindex` and are in no sitemap.
- Thin pages: metadata, landmarks, composition (`docs/decisions.md:62`). One `<h1>` per page;
  `header`/`nav`/`main`/`footer` landmarks present (`docs/decisions.md:79`).
- **No `"use client"` in this tree, with exactly one named exception** — `error.tsx` (**D62**), which
  Next requires to carry the directive itself and which holds no component code. Any other page-level
  client directive is a build failure by policy (`docs/decisions.md` §4). Islands (**D30** carousel,
  **D31** drawer, **D62** error boundary) live under `src/features/` and `src/components/site/`.
- `next/link` for every internal link; links may point at routes that do not exist yet, and stub routes
  may be created so nothing 404s (**D26**).
- Routes are **D18**, extended by **D58**: `/`, `/tires`, `/wheels`, `/accessories`,
  `/products/[slug]`, `/styleguide`. The file for each is named in
  the `design/manifest.md` Routes table (`:11-16`) — `tires/page.tsx` and
  `products/[slug]/page.tsx` are the planned paths, plus minimal stubs for the undesigned pages
  (About, Privacy, Terms, Wheels, Accessories) under **D26**.
- Per-section build loop for any new page (`HANDOFF.md` §6): read both artboards → build mobile-first
  at 390 → add desktop at 1440 → **measure** with `scripts/parity-probe.js` against the `:4000`
  baseline → write the table into `design/reports/<page>.md` → fix by measured deltas, max 3 loops,
  then stop and report.
- A page is done only when the `docs/decisions.md` §9 gates are green — `npm run check`, a measured
  parity table, zero slop-grep hits, Lighthouse, keyboard walk-through, reduced-motion.
- Any state authored that no artboard draws is added to the styleguide placeholder section
  (`HANDOFF.md` §6).
- **Every page shell wraps `<main>` and the footer in `PageTransition` (D92b)** — never the header, which
  is pinned by its own `site-header` name, and never a layout, which persists and so never enters or
  exits. (The `loading.tsx` skeleton that also rode it is gone, D91b.)
  `page.tsx` (`/`) renders `ScrollReveal`. `/styleguide` §12 shows the motion tokens and states.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | No folder-scoped rows. | Governed by **D18** (the four routes), **D26** (link/stub planned routes), **D6** (no sticky PDP buy bar), **D32** (computed year). | root `llm.md` §5 |

## Connects to
- Depends on: `src/app/layout.tsx` (root layout, fonts, `globals.css`), `src/components/ui/*`,
  `src/components/site/*`, `src/features/{catalog,home,finder,results,product}/*`,
  `src/lib/{site,routes}.ts`,
  `public/images/`.
- Depended on by: `design/manifest.md:11-16` (maps each artboard pair to a file here);
  `design/reports/<page>.md` (measures what these routes render); `next build`, which reports these
  routes (`HANDOFF.md` §5).

## Don't
- Don't put layout maths or data in `page.tsx`; it composes sections and nothing else (D38).
- Don't render Year/Make/Model as the `<div>`s the export draws — native `<select>` is a hard rule
  (`docs/decisions.md:90`), and the `Select` primitive is ready (`HANDOFF.md` §6).
- Don't ship the artboards' sample data: `Priya Sandhu` / `priya.s@…` / `(905) 000-0000` /
  `2021 Honda Civic`, the finder pre-fill (**D28**), or hard-coded `Winter 2026` / `© 2026` (**D32**)
  (`design/DEVIATIONS.md` "Sample data").
- Don't add a sticky mobile buy bar to the PDP (**D6**).
- Don't unpin the header: since D159 (2026-10-07) it stays on screen on every page (`DEVIATIONS.md` #121).
- Don't write "matches" or "looks right" in a parity report without the table
  (`design/reports/README.md:4`).

## Open
1. ~~Shared chrome placement~~ — settled: composed per page (D38).
2. **Stub route content.** **D26** authorises stubs for About, Privacy, Terms, Wheels and Accessories;
   what those pages say is unspecified and undesigned. **Owner**.
3. ~~`/styleguide` is specified as excluded from the sitemap, but no sitemap route exists.~~ **Closed
   2026-09-30 by D112.**
