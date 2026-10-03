# public/images/

## Purpose
The shipped image set — the only images the site serves. Every file here is webp and (with one
documented exception) is **build output**: `npm run assets` reads `design/assets/` and writes this
folder (`scripts/prepare-assets.mjs:25-26`, `package.json:13`). The frozen PNG export weighs ~29MB and
cannot meet the Lighthouse LCP gate in `docs/decisions.md` §9; this folder is 1.7MB
(`HANDOFF.md` §4: client PNGs `28.94MB → 1.24MB (−95.7%)`). Delete it and every card, tile and hero
renders empty until the pipeline is re-run.

## Owns
- `products/*.webp` — 7 tire cut-outs, one per `design/assets/products/*.png`. Each is trimmed to its
  content box, scaled to 88% of a **1000px square canvas** and centred, so a grid of mixed-source
  cut-outs reads at one optical size (`scripts/prepare-assets.mjs:29-30,60-97`; **D19**).
- `photos/hero-tread.webp` — 2400×1600, 480KB; served by `next/image` at **13.0KB / 390px**. Licensed
  Unsplash `CTwQiFlpgrM`, Rob Wingate (**D4**, `design/ASSET-CREDITS.md:10`). It replaces the artboard's
  hotlinked Vossen/Ferrari photo (`design/DEVIATIONS.md` #1).
- `photos/{accessories,tires-tile,wheels-tile,winter-tacoma}.webp` — **licensed Unsplash photographs since
  D94b** (owner: replace the placeholder home photos with HD ones), built by `replacementPhotos()` in
  `scripts/prepare-assets.mjs` from `client-assets/photos/*.jpg`, long edge capped at 2400, wheels and
  winter pre-cropped (`CROPS`). Sources and licences: `design/ASSET-CREDITS.md`. The original client PNGs stay
  in `design/assets/photos/` (frozen) and are overwritten in the output by the replacements. The filename
  `winter-tacoma` is kept because two components import it; it no longer shows a Tacoma.
- `brands/*.svg` — **19 brand logos for the home ticker (D129)**, the one folder here that is **not** pipeline output and not
  webp: each is the brand's own vector logo, fetched 2026-10-03, metadata stripped, flattened to one colour (`#000`) and cropped
  to its painted bounds. The page never shows the file's colour: `brand-strip.tsx` paints a token through it as a CSS mask.
  Filenames are the slugs in `src/features/home/brand-logos.ts`. Sources, the per-file notes (wordmark-only, knockout,
  one-colour variant) and the owner's permission quote: `design/ASSET-CREDITS.md` "Brand logos".
- `logo/platinum-wheels-logo-transparent.webp` — **the working file**, used everywhere in the UI.
- `logo/platinum-wheels-logo.webp` — the white-plate original; **print/invoice only** in the UI, and
  since D112 the `logo` the organisation's structured data names, because a search result shows a logo on
  white
  (`design/ASSET-CREDITS.md:38`, DESIGN.md §0). 512px cap covers the 64px nav and 120px footer at 4×
  (`scripts/prepare-assets.mjs:35-36`).

## Rules
- **Nothing lands here without a row in `design/ASSET-CREDITS.md`** — licence recorded *before* the file
  exists (`design/ASSET-CREDITS.md:42-50`).
- webp only, quality 82 / effort 6 (`scripts/prepare-assets.mjs:38`) — except `brands/`, which is SVG (D129): vector
  logos at a fixed one-colour fill, small (1–10KB each), no scripts, no embedded rasters, no external references.
- The pipeline **refuses to upscale**: `Math.min(scale, 1)` caps it and it prints a per-file warning
  instead of shipping a blurry cut-out (`scripts/prepare-assets.mjs:69-79`; **D19**). Vendor catalogue images,
  when they arrive, are upscaled by the feasibility study instead (**D90b**).
- Product filenames are the product `slug` (`src/features/catalog/types.ts:40`). Renaming one renames
  a route under `/products/[slug]`.
- Any new photo is looked at and measured before use, not trusted from its caption
  (`design/ASSET-CREDITS.md:46-47`, `HANDOFF.md` §8).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | No folder-scoped rows. | Governed by **D4** (hero source), **D19** (square canvas, never upscale) and **D129** (`brands/`). | root `llm.md` §5 |

## Connects to
- Depends on: `scripts/prepare-assets.mjs` (the writer), `design/assets/{products,photos,logo}/*.png`
  (the inputs), `design/ASSET-CREDITS.md` (the gate).
- Depended on by: `src/features/catalog/components/product-card.tsx:166`; `src/features/home/components/brand-strip.tsx` (`brands/`, D129); every home/results/PDP section
  that renders a photo (`design/manifest.md` §1); `public/llm.md` (parent).

## Don't
- **Don't hand-edit or hand-replace a file here.** Put the new source in `design/assets/` and re-run
  `npm run assets`, or the next run silently overwrites the edit.
- Don't upscale the two low-res cut-outs to make them match. `touren-tr79` trims to 470×439 and
  `zmax-landgema` to 546×757 against an 880px subject target; they render optically smaller than the
  rest of the set and that is deliberate, visible evidence of a client blocker
  (`HANDOFF.md` §7, `design/DEVIATIONS.md` bottom).
- Don't use `logo/platinum-wheels-logo.webp` (white plate) in the UI — transparent is the working file.
- Don't delete `client-assets/photos/`: `npm run assets` rebuilds the four home photos from it (D94b).
- Don't replace a `brands/` file without re-measuring its `aspect` in `brand-logos.ts`, and never with a redrawn or traced
  approximation of a trademark: the brand's own vector, or drop the brand (D129).
- Don't assume `npm run assets` regenerates the hero: `hero-tread.webp` has **no source** in
  `design/assets/photos/` and is placed by hand under **D4**. The pipeline never touches it.

## Open
1. **Two product photos are too low-resolution** — client must supply higher-res originals
   (`HANDOFF.md` §7). Client, via the owner.
2. **Coverage.** `HANDOFF.md` §7 records "four product images cover nine SKUs"; seven files exist
   here and seven PNGs in `design/assets/products/`. Which number is current, and whether per-SKU
   photography is coming, needs the owner.
