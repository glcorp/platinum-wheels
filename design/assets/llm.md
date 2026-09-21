# design/assets/

## Purpose
The frozen design export itself: seven artboard HTML files, their index page, and the source PNGs they
reference. These files are the approved picture — they win on any number against `design/DESIGN.md`
(root `llm.md` §4) and they are the baseline every parity measurement is taken against
(`docs/decisions.md` §9). They are also the origin of the token system: the `:root` block they share was
copied verbatim into `src/app/globals.css`. Modify anything here and every measured number in
`design/inventory/` and every future `design/reports/<page>.md` becomes unverifiable.

## Owns
Seven artboards → three routes; the mapping table is `design/manifest.md` "Routes" (do not restate it).

- `home-desktop.html` (437 ln, 45.9KB) · `home-mobile.html` (392 ln, 43.2KB) → `/`
- `results-desktop.html` (558 ln, 55.5KB) · `results-mobile.html` (359 ln, 30.2KB) ·
  `results-mobile-filters.html` (88 ln, 15.1KB) → `/results`
- `product-desktop.html` (373 ln, 38.9KB) · `product-mobile.html` (335 ln, 36.2KB) → `/products/[slug]`
- `index.html` (68 ln) — the export's own landing page, linking the seven artboards and `DESIGN.md`.
- `logo/` — 2 PNGs, 4.6MB. Transparent cut-out is the working file; the white-plate original is
  print/invoice only (`design/DESIGN.md:16`).
- `photos/` — 4 PNGs, 14.9MB: `accessories`, `tires-tile`, `wheels-tile`, `winter-tacoma`.
- `products/` — 7 PNGs, 10.8MB, product cut-outs. Two are too low-resolution to normalise; see
  `design/DEVIATIONS.md`, "Sample data" section.

## Rules
- **Read-only. Nothing in this folder is ever edited, added to or deleted** (`HANDOFF.md` §4,
  `scripts/prepare-assets.mjs:16`).
- **Zero `@media` rules in any file** (verified: `grep -c '@media' *.html` returns 0 for all eight). They
  are fixed snapshots at 1440 and 390, so breakpoint crossovers are not derivable here and come from
  `design/DESIGN.md` §8 only — D10.
- **Every in-page `href` is `"#"`** (26 in `home-desktop.html`, 30 in `results-desktop.html`, and so on).
  No route is drawn anywhere; routes are D18, and code links planned routes rather than `#` — D26.
- **The `:root` token block sits at lines 11–40 and is byte-identical across the files**
  (`design/inventory/results.md:14`). It is the source for `src/app/globals.css`; read a token here
  before inventing one.
- **Hover states are `.xN` classes in the `<style>` block**, not inline styles — e.g.
  `design/assets/home-desktop.html:49-60`, 37 `.xN:hover` rules in that file alone. Ported code scopes
  hover to `@media (hover: hover)` — D17.
- **Serve with `npm run design` on :4000.** The root served is `design/`, and `design/serve.json` rewrites
  each extensionless artboard URL to `assets/<name>.html`, so `http://localhost:4000/home-desktop` works and
  the artboards' relative `assets/…` image paths resolve (D36). Never add a symlink here: Tailwind scans
  the tree and a loop panics Turbopack (root `llm.md` D36).
- **PNGs never ship as-is.** `scripts/prepare-assets.mjs` converts them to webp in `public/images/`,
  normalises product cut-outs to one square canvas, and refuses to upscale — D19.
- **The hero photograph here does not ship.** Both home artboards hotlink
  `vossenwheels.com/.../Vossen-Forged-GEN-01-Aerolip-Ferrari-F40-LM-…jpg`; the shipped hero is
  `public/images/photos/hero-tread.webp` — D4, `design/DEVIATIONS.md` #1.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
No folder-scoped rows. Governing global IDs: **D4** (hero replacement), **D10** (breakpoints not from
here), **D17** (hover scoping), **D18** (routes, since every `href` is `#`), **D19** (PNG pipeline),
**D20** (three of the four Google fonts requested here are referenced by zero `font-family`
declarations). One line each in root `llm.md` §5a.

## Connects to
- **Depends on:** nothing. Self-contained export; the only external references are the Google Fonts
  `<link>` (not ported — `design/DEVIATIONS.md` #2) and the hotlinked hero (not ported — #1).
- **Depended on by:** `design/inventory/*.md` (every value is measured from these files) ·
  `design/manifest.md` (the Routes table) · `design/reports/README.md` (the `:4000` baseline) ·
  `scripts/prepare-assets.mjs` (`SRC = "design/assets"`) · `public/images/` · `src/app/globals.css`
  (token block) · `package.json` script `design`.

## Don't
- Don't reformat, prettify, or "fix" an artboard, including its relative asset paths. The frozen bytes are
  what parity is measured against; the path problem is solved outside the files (D36).
- Don't derive a breakpoint, a hover-on-touch behaviour, or a focus/active/disabled state from these
  files — the first is not present (D10), the second is wrong on touch (D17), the third does not exist in
  any export (`design/DEVIATIONS.md` #9).
- Don't treat the drawn content as real data. The finder pre-fill, the four featured SKUs, the PDP form's
  `Priya Sandhu`, and the facet counts are placeholders — listed once in `design/DEVIATIONS.md`,
  "Sample data that must be replaced before launch".
- Don't reference a PNG from `src/`. Components read `public/images/**` webp only.

## Open
- **Resolved 2026-09-20 (D36):** the artboards' `assets/…` paths implied an export root of `design/`, so
  images 404ed on the `:4000` baseline until `design/serve.json` was added. `index.html`'s `href="DESIGN.md"` now
  resolves too, since the served root is `design/`.
- Any parity table dated before 2026-09-20 measured type and geometry only, never photographs (D36).
