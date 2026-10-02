# src/features

## Purpose
One folder per business capability, so a section's UI, its domain types and its seed data sit together
instead of being scattered across a generic `components/` tree. `docs/decisions.md:63` defines the
shape — `src/features/<f>/components/` holds "feature UI (finder, results, product, services)" — and
D33 extends the list with `home`. Routes under `src/app/(storefront)/` stay thin (metadata, landmarks,
composition only, `docs/decisions.md:62`); this is where the actual page content lives.

## Owns
- [`catalog/`](catalog/llm.md) — **built.** The shared product domain (D37): `Product`/`ProductBadge`,
  `ProductCard`, and the nine-SKU seed (D29 featured four, D43 all nine). Its own `llm.md`.
- [`finder/`](finder/llm.md) — **built** at `page home`, 2026-09-20 (`finder/llm.md:10`). The
  Year/Make/Model vehicle finder, its own feature rather than part of `home/` (D33); seed fitment in
  `finder/data.ts`, flagged sample (D27); ships unselected (D28). `variant="inline"` serves the
  `/tires` `Change vehicle` disclosure (D45). One client island since **D70**,
  `finder/components/finder-model-sync.tsx`, which renders nothing and narrows `Model` to the chosen
  `Make`; the form itself stays a Server Component and a plain GET.
- [`home/`](home/llm.md) — **built** at `page home`, 2026-09-20 (`design/reports/home.md`). Home-only
  sections in `home/components/` (D33), including the mobile featured carousel, a functional client
  island (D30).
- [`results/`](results/llm.md) — **built** 2026-09-21. URL-driven search over the catalog seed (D44):
  `query.ts` parses and re-serialises the params, `search.ts` is the only place results are computed,
  and the sections in `results/components/` render from one `ResultsView`. Three client islands —
  `sort-select.tsx`, `filter-panel.tsx`, `filter-sheet.tsx` (each `"use client":1`). Governing rows:
  **D42** (counts computed, never typed), **D43** (nine-SKU seed), **D44** (state is the URL),
  **D45** (`Change vehicle` is a `<details>`), **D46** (rail from `md:` 1100), **D47** (eight results
  rulings, including `call-cta-panel` as a results section).
- [`product/`](product/llm.md) — **built** 2026-09-21. One `productView()` derives everything the PDP
  renders from a `Product` plus the raw query (`view.ts`); the sections in `product/components/` render
  it. One client island, `quote-form.tsx`, and the build's only Server Action, `actions.ts`. Governing
  rows: **D50** (quantity is `?qty=`), **D51** (Server Action + authored success state), **D52** (similar
  = same season, self excluded), **D53** (seven derived PDP rulings).

- [`admin/`](admin/llm.md) — **built.** The staff tool at `/admin` (D89): shared sign-in (D95), payment-link
  builder, links list (D106).
- [`payments/`](payments/llm.md) — **built** 2026-09-24. Converge adapter, link and attempt service, the Pay
  island (D99–D107). The only code that names the gateway.
- [`seo/`](seo/llm.md) — **built** 2026-09-30 (D112). The indexing flag, `pageMetadata()`, the sitemap, the
  structured data and the two link-preview cards. No UI of its own beyond `JsonLd`; the routes that
  serve it are in `src/app/`.

## Rules
- **Feature shape:** `components/` always; `types.ts` and `data.ts` only when the feature has them
  (`docs/decisions.md:63`; `catalog/` is the built example of all three).
- **Dependency direction is one-way.** A feature imports from `src/components/ui/`, `src/components/site/`
  and `src/lib/`; none of those may import a feature (`docs/decisions.md:65`, "primitives only — no
  business logic"). **Cross-feature imports go through `catalog/` only** — it is the shared product
  domain and the others consume it (D37). **One further edge: `admin/` imports `payments/`** (`service`,
  `config`, `money`; D106). `payments/` imports no feature. `seo/` imports `catalog/` and nothing else
  (D112); the pages in `src/app/` hand it what it needs from `product/`.
- **Seed data is flagged as sample.** `finder/data.ts` (D27) is a stand-in until real data exists; the
  catalogue seed `catalog/data.ts` (D29) was deleted by D108b and every page reads the database. The
  wheel CSV supplies nothing (D9).
- **`"use client"` only on leaf islands** — the filter sheet, the featured carousel, the quote form
  (`docs/decisions.md:73`). Never at page level, never on a whole feature. The PDP quantity control is
  **not** an island: it is `?qty=` links, server rendered (D50).
- **Links may point at routes that do not exist yet** (D26); stub routes keep them from 404ing.
- Server Components by default; all SEO-relevant content server-rendered (`docs/decisions.md:76`).
- Named exports, no barrel (`docs/decisions.md:69`). Tokens only, no arbitrary values
  (`.claude/rules/ui.md`).
- Copy from an artboard ships verbatim; copy we author for undrawn states follows `.claude/rules/ui.md`
  "Copy" and gets added to `/styleguide`.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | The feature list and its shape are set in the HLD and D33. | — |

Referenced: **D33** (adds `home` to the HLD list; finder is its own feature), **D37** (`catalog/` is
the shared domain), **D27** / **D28** (finder data and default state), **D29** / **D30** (featured seed
data and carousel), **D42**–**D47** (results), **D26** (planned routes), **D9** (the wheel CSV drives
nothing).

## Connects to
- **Depends on:** `src/components/ui/`, `src/components/site/`, `src/lib/{site,routes}.ts`,
  `src/app/globals.css` tokens, `next/image`, `next/link`, `next/navigation` (the three client islands).
- **Depended on by:** `src/app/(storefront)/page.tsx` (home sections + finder),
  `src/app/(storefront)/tires/page.tsx:5-10` (five results sections + `searchResults`), and
  `src/app/(storefront)/styleguide/page.tsx` (`ProductCard`, `Product`, `ResultsEmpty`, `QuoteSuccess`),
  and `src/app/(storefront)/products/[slug]/page.tsx` (six PDP sections + `productView`).

## Don't
- **Don't create a feature folder without an `llm.md` first** (root `llm.md` §1.2).
- **Don't import `src/features/` from `src/components/`.** That is the one boundary this layout exists
  to hold (`docs/decisions.md:65`).
- **Don't put home sections in `src/components/site/`.** D33 sends them to `src/features/home/`;
  `site/` is header, footer and drawer only.
- **Don't derive a type, field or default from the wheel CSV.** "use as reference. dont make changes pr
  decisons based on these" (D9, `HANDOFF.md` §12).
- **Don't add cart, checkout, stock counts, ratings or shipping to any feature.** Quote-first
  (`docs/decisions.md:105-107`).

## Open
1. ~~**Cross-feature imports.**~~ Closed by **D37**: `catalog/` is the shared product domain and
   `home/`, `results/` and `product/` import `Product`, `ProductCard` and the seed from it; the graph
   stays one-way, `app → features → catalog → components/ui → globals.css`.
2. **`services/`.** Listed in `docs/decisions.md:63` but there is no designed Services page and D7
   removed the `Services` nav item. Whether the feature ever exists is the owner's call.
3. **Wheels vs tires.** Root `llm.md` §7 #3 — the only real data supplied is a wheel feed while the
   design sells tires. Unresolved until real catalogue data is wired.
