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
- [`results/page.tsx`](results/page.tsx) — route `/results`, **built** 2026-09-21. Since **D58** it is
  three lines long: it names the category (`tires`) and the title, and hands `await searchParams` to
  `ResultsPage` (`src/features/results/components/results-page.tsx`), which holds the whole measured
  composition — `SiteHeader variant="solid"` (D38), `ResultsToolbar`, `FilterSortBar`, the
  `md:results-grid` shell holding `FilterRail` + `ResultsGrid` (D46), `CallCtaPanel` (a results section,
  D47(1)) and `SiteFooter`. Nothing observable about this route changed; the composition simply moved
  one level so three routes can share it. Parity: `design/reports/results.md`.
- [`wheels/page.tsx`](wheels/page.tsx) and [`accessories/page.tsx`](accessories/page.tsx) — routes
  `/wheels` and `/accessories`, **built** 2026-09-21 (**D58**), previously `PageStub`s. Identical in
  shape to `results/page.tsx`, differing only in the `category` they pass and their title. They have
  **no artboards** and are not parity rows: they inherit `/results`' parity by rendering the same
  component tree (`design/manifest.md` Routes).
- [`products/[slug]/page.tsx`](products/[slug]/page.tsx) — route `/products/[slug]`, **built**
  2026-09-21. `async`, takes `PageProps<"/products/[slug]">`, resolves the slug from the seed (404 if
  unknown, but an *unavailable* product still returns 200) and turns `productView(product, query)` into
  one `ProductView`; composition only. The breadcrumb is rendered once and placed twice — mobile above
  the gallery, desktop inside the buy panel — with the visibility classes owned here, not by the
  component. The header's active nav item follows the product's category (D58), so a wheel PDP marks
  Wheels. No `generateStaticParams` — reading `searchParams` for `?qty=` makes the route dynamic (D50).
  Parity: `design/reports/product.md`.
- [`loading.tsx`](loading.tsx) — the group's loading UI (**D62**), a Server Component: the real
  `SiteHeader` and `SiteFooter` around a motion-free skeleton (heading bar + six `--surface` blocks on
  the `results-grid` steps). It renders a **`<div>`, not `<main id="main">`** — Next emits this fallback
  into the same document as the page, and an earlier version produced two `<main id="main">` elements on
  `/styleguide`. A transient fallback does not own the page's landmark.
- [`error.tsx`](error.tsx) — the group's route error boundary (**D62**). The directive plus one
  re-export of `src/components/site/route-error.tsx`; **no component code lives here.** This is the
  build's only `"use client"` under `src/app/` and it is a framework requirement, not a choice — Next
  fails the build on a bare re-export. It does not wrap `src/app/layout.tsx`; that would need
  `global-error.tsx`, which does not exist and is not owed.
- `about/`, `privacy/`, `terms/` — the remaining `PageStub` pages for undesigned targets (D26, D39).
  `wheels/` and `accessories/` left this list on 2026-09-21 (D58).
- [`styleguide/page.tsx`](styleguide/page.tsx) (471 ln) — route `/styleguide`, `noindex` via
  `metadata.robots: { index: false, follow: false }` (`:18-21`). Eleven blocks covering every primitive,
  variant and state, with computed contrast ratios shown on the page rather than buried in markdown
  (`:23-44`), and seed products transcribed from `design/inventory/results.md` §7 (`:46-48`). It now
  also carries `Button size="load"`, the `/results` `Load more` size (`:229`). The final section,
  *"States the design never drew"*, holds the undrawn states — **complete since D62**: the 404, the
  `ResultsEmpty` empty-results state (`:445`) and the `Change vehicle` disclosure open, which the
  artboards draw only closed (`:449-461`, D45) and the PDP quote-form success panel, rendered from the
  real `QuoteSuccess` component so it cannot drift (D51), the quote-form error summary (D57), the skip
  link (D57), and the **route error** and **loading** states (D62). The route error renders from
  `RouteErrorPanel` with `as="h2"` and no `retry` — this page is a Server Component and RSC refuses to
  serialise a function across the client boundary, which the build catches outright.

## Rules
- Thin pages: metadata, landmarks, composition (`docs/decisions.md:62`). One `<h1>` per page;
  `header`/`nav`/`main`/`footer` landmarks present (`docs/decisions.md:79`).
- **No `"use client"` in this tree, with exactly one named exception** — `error.tsx` (**D62**), which
  Next requires to carry the directive itself and which holds no component code. Any other page-level
  client directive is a build failure by policy (`docs/decisions.md` §4). Islands (**D30** carousel,
  **D31** drawer, **D62** error boundary) live under `src/features/` and `src/components/site/`.
- `next/link` for every internal link; links may point at routes that do not exist yet, and stub routes
  may be created so nothing 404s (**D26**).
- Routes are **D18**, extended by **D58**: `/`, `/results`, `/wheels`, `/accessories`,
  `/products/[slug]`, `/styleguide`. The file for each is named in
  the `design/manifest.md` Routes table (`:11-16`) — `results/page.tsx` and
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
- Don't make the home nav sticky — on `/` it is absolutely positioned inside the hero; on other pages
  it is a solid `--bg` bar (`HANDOFF.md` §6).
- Don't write "matches" or "looks right" in a parity report without the table
  (`design/reports/README.md:4`).

## Open
1. ~~Shared chrome placement~~ — settled: composed per page (D38).
2. **Stub route content.** **D26** authorises stubs for About, Privacy, Terms, Wheels and Accessories;
   what those pages say is unspecified and undesigned. **Owner**.
3. `/styleguide` is specified as excluded from the sitemap (`design/manifest.md:16`), but no sitemap
   route exists. See `src/app/llm.md` Open #2.
