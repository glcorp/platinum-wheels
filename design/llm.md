# design/

## Purpose
The frozen design export and every document derived from it. `design/assets/**` is the approved picture
and the parity baseline the build is measured against (`docs/decisions.md` §9); the sibling documents turn
that raw export into a work queue (`manifest.md`), a measured baseline (`inventory/`), an audit trail of
where code departs from the picture (`DEVIATIONS.md`), and a licence record for every image that did not
come from the client (`ASSET-CREDITS.md`). Everything here predates the initial commit (D55), so git can
only restore what was on disk on 2026-09-21: delete this folder and the design's own history — what the
site is supposed to look like, and why every difference between code and design was deliberate — is gone
with it.

## Owns
- [`assets/`](assets/llm.md) — seven artboard HTML files, `index.html`, and the source PNGs. Has its own `llm.md`.
- [`inventory/`](inventory/llm.md) — `home.md` / `results.md` / `product.md`, 2,184 lines of measured values. Has its own `llm.md`.
- [`reports/`](reports/llm.md) — the parity protocol and, later, one report per built page. Has its own `llm.md`.
- [`DESIGN.md`](DESIGN.md) — the written spec, theme "Track Night"; 361 lines, sections §0–§9 plus a canonical contact block (`design/DESIGN.md:1`, `:345`).
- [`DESIGN.superseded-cinematic-red.md`](DESIGN.superseded-cinematic-red.md) — the original "Cinematic Dark" / racing-red spec (323 lines), replaced mid-`init` and kept for audit (`docs/decisions.md` §1).
- [`DEVIATIONS.md`](DEVIATIONS.md) — 16 active rows where shipped code differs from the export, each with reason and authority; the "Open" table is empty.
- [`manifest.md`](manifest.md) — artboard → route → section build order; this is the work queue (`HANDOFF.md` §2).
- [`ASSET-CREDITS.md`](ASSET-CREDITS.md) — provenance, licence and rejected candidates for every non-client image, plus the rules for adding one.
- [`serve.json`](serve.json) — rewrite table for `npm run design` (extensionless artboard URLs → `assets/*.html`), D36. Not part of the export.
- `.DS_Store` — macOS artefact, no meaning.

## Rules
- **Nothing under `design/assets/` is ever modified.** "Sources in `design/` are untouched and remain the
  frozen export" (`HANDOFF.md` §4); `scripts/prepare-assets.mjs:16` repeats it as a contract.
- **A code-vs-design difference lives in `DEVIATIONS.md` or it is fixed. There is no third option**
  (`design/reports/README.md`, Thresholds section; `HANDOFF.md` §6).
- **Authority:** artboards win on any number; `DESIGN.md` governs where the artboards are silent; where the
  spec asks for an element the artboards do not contain, ask the owner (root `llm.md` §4; precedent D7).
- **`ASSET-CREDITS.md` is updated before the image lands in `public/`**, not after — its rule 1, "Record it
  here before the file lands in `public/`".
- **`DESIGN.md` is replaced, never silently edited over.** The superseded copy stays on disk because
  no commit holds the pre-2026-09-21 spec (`docs/decisions.md` §1, D3 as superseded by D55).
- Any change here updates this file in the same change (root `llm.md` §1.2).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D91b | 2026-09-29 | `DEVIATIONS.md` gains #79 (desktop hero scrim), #80 (consent row floor, recorded) and #82 (brand strip columns); #55 is struck (no loading state) and #66 corrected in place (the nav moved 14.6px). #81 is reserved for the motion pass's centred loader. | QA pass. | D91b |
No folder-scoped rows. The global decisions that govern this folder are **D1, D3, D4, D5, D6, D7, D9,
D10, D11, D19, D20, D22** — one line each in root `llm.md` §5a, canonical text in `HANDOFF.md` §11.

## Connects to
- **Depends on:** nothing. This folder is an input; it reads no other folder.
- **Depended on by:** `src/app/globals.css` (token block copied verbatim from the artboards' `:root`,
  see its header comment at `src/app/globals.css:1-10`) · `scripts/prepare-assets.mjs` (reads
  `design/assets` → writes `public/images`) · `public/images/` (its entire contents derive from here) ·
  `docs/decisions.md` §9 (names `design/reports/<page>.md` as the gate evidence) · every component under
  `src/components/` and `src/features/`, whose measured values trace to `design/inventory/`.

## Don't
- Don't edit `DESIGN.md` to resolve a conflict with an artboard. The artboards win on numbers; the
  difference is recorded in `DEVIATIONS.md` instead (root `llm.md` §4).
- Don't delete `DESIGN.superseded-cinematic-red.md` as dead weight — it is the audit trail for the
  mid-`init` spec swap (`docs/decisions.md` §1).
- Don't "fix" something in code that looks off-spec before checking `DEVIATIONS.md`. Sixteen of them are
  already deliberate, several counter-intuitive (`HANDOFF.md` §2).
- Don't hand-copy an image out of `design/assets/` into `public/`. `scripts/prepare-assets.mjs` owns that
  conversion (D19) and `ASSET-CREDITS.md` must record it first.
- Don't restate a deviation, threshold or measured value in another document. One line plus a pointer to
  the canonical row (root `llm.md` §1.4).

## Open
- `design/DESIGN.md` is now 361 lines; all three `design/inventory/*.md` cite it as "323 lines"
  (`design/inventory/home.md:6`, `results.md:9`, `product.md:7`) — the length of the superseded file.
  The inventories were extracted against the pre-swap spec, so their "Conflicts with DESIGN.md" sections
  are stale in part. Whoever re-runs extraction, or the owner, decides whether to re-point them.
- `DEVIATIONS.md` records deviations for pages that do not exist yet; D28, D32, D34 and D35 all say
  "logged when built". Nobody has confirmed who writes those rows at `page home` — owner's call.
