# src/features/search/

## Purpose
Free-text storefront search (D173): the header's search field and `/search?q=`. A shopper types a tire
size in any common spelling, a wheel size, a bolt pattern, a part number, or brand and model words, and
gets the matching tires, wheels and accessories grouped on one page. Delete it and `/search` and the
header's search icon have nothing behind them.

## Owns
- [`parse.ts`](parse.ts) — pure: query text → `ParsedSearch` (tire, wheel, bolt and rim sizes, category,
  season and accessory-type words, leftover words). No I/O, no imports beyond types and `catalog/size.ts`.
- [`fit.ts`](fit.ts) — pure: which wheel widths suit a tire, and the reverse (D173(1)).
- [`queries.ts`](queries.ts) — server only: one read per group, the trigram text match, look-alike facts,
  the "See all" links' filters. Never imported by a client file.
- [`components/search-results.tsx`](components/search-results.tsx) — the page body: the field, the group
  jump links, the three groups and the no-results state. Server Component.
- [`components/search-form.tsx`](components/search-form.tsx) — the plain GET `<form>` the page renders
  (works with JS off). Server Component.

## Rules
- **Visibility mirrors the listings**: `published` and `discontinued`, never `hidden`, with no order
  between the two (Stream B, owner 2026-10-11: *"for a end user, there is no difference between an active
  or discontinued product"*). `queries.ts` uses B's `listedStatus()` from
  `src/features/catalog/listing-status.ts` (D164), the one rule every storefront list shares.
- **No vendor data**: never select or match `product_sources` (vendor, SKU, vendor price). Owner,
  2026-10-11, chose *"No, part numbers only (Recommended)"*: a vendor SKU finds nothing.
- **No price leaves the server while `PRICES_VISIBLE` is off** (D124): `queries.ts` nulls it as
  `catalog/queries.ts` does.
- The text match filters on `productSearchText()` from `src/db/catalog-schema.ts`, the exact expression
  `products_search_trgm_idx` indexes (migration `0006`). Write it any other way and the index is unused.
- `/search` is `noindex` and never in a sitemap (D112).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D173 | 2026-10-11 | The search exists; rulings (1)–(4) in root `llm.md` §5b. | Client and owner asked for it. | Owner |
| D174 | 2026-10-11 | Derived rulings (parsing, ordering, limits). | Built under D173. | *derived* |

## Connects to
- Depends on: `src/db/` (schema, client, the `productSearchText` expression), `src/features/catalog/`
  (`rows.ts`, `adapter.ts` `toProduct`, `siblings.ts` `listingFacts`, `size.ts`, `ProductCard`,
  `categories.ts`), `src/lib/` (`site.ts`, `routes.ts`), `src/components/ui/`.
- Depended on by: `src/app/(storefront)/search/page.tsx`. The header's search island
  (`src/components/site/site-search.tsx`) only links to `/search`; it imports nothing from here (D37).

## Don't
- Don't add the queries to `src/features/catalog/queries.ts`: that file belongs to the listings.
- Don't treat a 7-digit number as a part number first: `2453519` is a tire size (the client's own example).
- Don't search `product_sources`, even for staff convenience: this is the storefront.

## Open
