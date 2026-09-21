# public/

## Purpose
Everything Next.js serves verbatim at the site root. Two things actually live here: the shipped image
set under `images/` (1.7MB, the output of `npm run assets` — `HANDOFF.md` §4) and five unreferenced
SVGs left behind by `create-next-app`. If this folder were deleted the site would render with no logo,
no hero, no product cut-outs and no category tiles: every image `src` in `src/` is a root-relative path
into `images/` (`src/features/catalog/components/product-card.tsx:166`).

## Owns
- [`images/`](images/llm.md) — the optimised webp set. Has its own `llm.md`; read it before adding a file.
- `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` — `create-next-app` scaffold icons,
  4KB each on disk. A recursive grep over `src/`, `design/` and `docs/` returns **zero** references to
  any of the five.

The favicon is **not** here. It is `src/app/favicon.ico`, the App Router file convention — see
`src/app/llm.md`.

## Rules
- Nothing lands in `public/` without a row in `design/ASSET-CREDITS.md` first. That file's rule 1:
  *"Licence must permit commercial use. Record it here before the file lands in `public/`."*
  (`design/ASSET-CREDITS.md:44`)
- Images are consumed through `next/image` only, always with `sizes` and a reserved aspect box; the hero
  carries `priority` (`docs/decisions.md:77`).
- Product paths are derived from the product `slug`: `/images/products/<slug>.webp`
  (`src/features/catalog/types.ts:40`, `product-card.tsx:166`). Renaming a file renames a slug.
- Files under `images/` are build output. Do not hand-edit them — see `public/images/llm.md`.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | No folder-scoped rows. | Global rows govern: **D4** (hero asset), **D19** (cut-out canvas). | root `llm.md` §5 |

## Connects to
- Depends on: `scripts/prepare-assets.mjs` (writes `public/images/`), `design/assets/{products,photos,logo}/`
  (the frozen PNG sources), `design/ASSET-CREDITS.md` (the provenance record).
- Depended on by: `src/features/catalog/components/product-card.tsx:166`; every future page under
  `src/app/(storefront)/` that renders the hero, logo, category tiles or winter promo
  (`design/manifest.md` §1).

## Don't
- Don't add a PNG or JPEG. The pipeline emits webp only (`scripts/prepare-assets.mjs:38`).
- Don't drop a `favicon.ico`, `robots.txt` or `sitemap.xml` here by reflex. In this Next version those
  are file conventions inside `src/app/`, and the version diverges from training data — read
  `node_modules/next/dist/docs/` first (`AGENTS.md:5`).
- Don't edit `design/assets/` to change a shipped image. Those sources are never modified by the
  pipeline and stay the frozen export (`scripts/prepare-assets.mjs:15`); re-run `npm run assets` instead.

## Open
1. **Delete the five `create-next-app` SVGs?** `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`,
   `window.svg` are referenced nowhere in `src/`, `design/` or `docs/`. Not deleted — **owner's call**.
