# scripts/

## Purpose
Two standalone Node programs that sit *beside* the app rather than inside it. `prepare-assets.mjs`
turns the frozen PNG export into the shipped webp set; `parity-probe.js` is the measurement half of the
`docs/decisions.md` §9 quality gate. Delete this folder and `public/images/` can never be regenerated
from `design/assets/`, and parity becomes eyeballing — which
`design/reports/README.md:4` forbids outright.

## Owns
- [`prepare-assets.mjs`](prepare-assets.mjs) (137 ln) — `design/assets/*.png` → `public/images/*.webp`,
  plus the product cut-out canvas normalisation. Invoked as `npm run assets` → `node
  scripts/prepare-assets.mjs` (`package.json:13`). Prints a per-file before/after table and a total.
- [`parity-probe.js`](parity-probe.js) (140 ln) — three browser functions: `probe(pairs)` (30 computed
  properties + bounding box per labelled selector, `:20-51`), `overflowers()` (the 375/768/1280 no-
  horizontal-scroll gate, `:89`), `accentCount(root, accent)` (the one-accent-per-frame audit, `:109`).

## Rules
- **`client-assets/` is where client material supplied AFTER the design export goes** (D63).
  `design/assets/**` is the frozen export and is never added to (D55), so later photography lands in
  `client-assets/<kind>/` and `prepare-assets.mjs` → `clientProducts()` normalises it into the same
  `public/images/products/` output. Sources there are committed, like the design export's.
- **Client photos shot on white are keyed by a border flood-fill, never a luminance threshold**
  (D63). Chrome highlights are as bright as the background, so a global threshold punches holes through
  the product; the flood-fill only removes background connected to the image edge. The 215 threshold is
  measured, not guessed — see the block comment above `keyBackground()`.
- **Plain Node, not application source.** `.mjs` and `.js` are outside tsc's scope — `tsconfig.json:25-32`
  includes `**/*.ts`, `**/*.tsx` and `**/*.mts` only, so `npm run typecheck` never sees these files.
  `eslint .` (`package.json:10`) *does* lint them: `scripts/` is not in the ignore list
  (`eslint.config.mjs:9-19`).
- Run from the repo root. `SRC`/`OUT` are relative paths (`prepare-assets.mjs:25-26`).
- **Sources in `design/` are never modified** — they stay the frozen design export
  (`prepare-assets.mjs:15`).
- **The pipeline refuses to upscale.** `Math.min(scale, 1)` caps it and a warning is pushed to the
  report instead (`prepare-assets.mjs:69-79`). **D19.** Vendor catalogue images are the one exception and are
  not processed here (**D90**).
- Probe usage pattern, because the two sides differ: the artboard exports carry **no data attributes**,
  so pass real CSS selectors or `nth-of-type` paths for the `:4000` baseline and `[data-probe="…"]`
  hooks for the app (`parity-probe.js:8-17`). Same viewport on both sides, then diff the two JSON blobs
  into `design/reports/<page>.md`.
- *"Never eyeball a match — every row in the report comes from this."* (`parity-probe.js:17`)

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | No folder-scoped rows. | **D19** defines the canvas and the no-upscale refusal. | root `llm.md` §5 |

## Connects to
- Depends on: `design/assets/{products,photos,logo}/*.png` (inputs), `sharp` (`package.json:27`),
  `npm run design` serving `design/assets` on :4000 for the probe baseline (`package.json:12`).
- Depended on by: `public/images/` (the output), `design/reports/*.md` (every row is probe output),
  `design/reports/README.md` §"Running a measurement", `docs/decisions.md` §9.

## Don't
- Don't rewrite these in TypeScript "for consistency". They are executed by `node` directly and are
  deliberately outside the compile graph (`tsconfig.json:25-32`).
- Don't remove or relax the upscale guard to make two blurry cut-outs fill the canvas. The warning *is*
  the client blocker (`HANDOFF.md` §7).
- Don't paste `probe()` output verbatim into a report — the report holds the diffed table and its
  tolerances (`design/reports/README.md:27-40`).
- Don't measure against a dev server you have not restarted after a `globals.css` change; a stale
  server fakes a pass (`design/reports/README.md:63-78`, `HANDOFF.md` §8).
- Don't `cd` inside a shell call before running these — it changes the session's working directory for
  every later call (`HANDOFF.md` §8.12).

## Open
1. `prepare-assets.mjs` takes no arguments: every run rewrites every output file, with no dry-run and
   no incremental mode. Nobody has asked for one — **owner** decides if it is worth it.
2. `parity-probe.js` is wired to nothing — no npm script imports or serves it; it is pasted into the
   browser by hand. Whether it should become a script (or a Playwright step) is **owner's call**, and
   `docs/decisions.md:147` currently puts automated visual regression out of scope.
3. **A 1px rounding slip in `products()` and `clientProducts()`.** Both pad the canvas by the *requested* resize
   size, but `fit: "inside"` can return 1px less, so a cut-out can land on a 999×1000 canvas. Found and measured on
   the vendor images (~4% affected) in `~/platinum-wheels-feasibility/tools/web_image.mjs`, which now pads by the
   size the resize actually produced (D90). Not checked against the current `public/images/products/` output and
   not fixed here — **owner** decides whether to port the fix.
