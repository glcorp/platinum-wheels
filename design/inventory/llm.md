# design/inventory/

## Purpose
The measured parity baseline. Three files, 2,184 lines, one per designed page, holding every value read
out of the artboards: section manifests in artboard order, per-section detail with `file:line` sources,
value tables, the places the artboards disagree with `design/DESIGN.md`, and the data that must be
replaced before launch. `design/manifest.md` states the contract: "every number in a `design/reports/*.md`
table traces to one of them". Without this folder, parity measurement has nothing to diff against and
every future session re-reads 2,610 lines of export HTML to recover the same numbers.

## Owns
- [`home.md`](home.md) — 743 ln, from `home-desktop.html` + `home-mobile.html`. §1 section manifest,
  §2 per-section detail, §3 value inventory, §4 conflicts with DESIGN.md, §5 assets/data needing replacement.
- [`results.md`](results.md) — 745 ln, from the three results artboards. Same shape plus §3 "The product
  card — full spec" and §4 "Filter sheet"; conflicts are §6, replacements §7.
- [`product.md`](product.md) — 696 ln, from `product-desktop.html` + `product-mobile.html`. Same shape plus
  §3 "The buy panel" and §4 "Gallery spec"; conflicts §6, replacements §7.

## Rules
- **Never edit a measured value.** These are read-outs of frozen files (`HANDOFF.md` §4). If an artboard
  ever changed, the fix is re-extraction, not a hand edit — and the artboards are not allowed to change
  (`design/llm.md` Rules).
- **Written by read-only extraction agents**, one per page pair, in round 1 of the orchestration pattern
  (`HANDOFF.md` §3). Their output is reusable forever precisely because they wrote nothing else.
- **`COMPUTED` means arithmetic on declared values, not a value found in the file** — stated at
  `design/inventory/home.md:12`, used 24 times in that file.
- **`AMBIGUOUS` is a question, not an answer.** The breakpoint flag at `design/inventory/product.md:13`
  is the canonical example: the crossover width "is not present in the export and cannot be measured".
  Answering an `AMBIGUOUS` flag by inventing a number is the failure mode these files exist to prevent —
  it is why breakpoints come from `DESIGN.md` §8 alone (D10).
- **The "Conflicts with DESIGN.md" sections are unreconciled on purpose.** Each file says so in its
  authority note. Resolution lives in `design/DEVIATIONS.md`, never here.
- **This is a baseline, not a spec.** A value here describes what the artboard draws; whether code should
  match it is settled by the authority chain (root `llm.md` §4).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
No folder-scoped rows. Several global decisions were *derived from* flags raised in these files and are
recorded once in root `llm.md` §5: **D10** (zero `@media`, all three extractions flagged it), **D11**
(container 1344), **D12** (chip radius 0), **D13** (button tracking), **D35** (three home rulings, citing
`design/inventory/home.md:187` and `:394`).

## Connects to
- **Depends on:** `design/assets/*.html` — the only source of every value here; `design/DESIGN.md`, read
  only to list conflicts.
- **Depended on by:** `design/reports/*.md` (every report number traces here — `design/manifest.md:6`) ·
  `design/manifest.md` (its per-section notes are summaries of these files) · `src/app/globals.css`
  (the 22-size type ramp and `calc()` scale membership were measured here) ·
  `src/features/catalog/types.ts` (the `Product` field list came from measured variation across the 14
  card instances — `HANDOFF.md` §4) · every component built at `page home` / `results` / `product`.

## Don't
- Don't treat a row in a "Conflicts with DESIGN.md" section as a decision. It is a reported conflict; the
  ruling is in `design/DEVIATIONS.md` or root `llm.md` §5.
- Don't re-run extraction to "refresh" these files. The inputs are frozen; a second pass produces churn,
  not information.
- Don't copy a table out of here into a component comment or another doc. Cite `design/inventory/<page>.md`
  and the section instead (root `llm.md` §1.4).
- Don't read a `COMPUTED` value as something the designer typed. It is arithmetic, and the arithmetic is
  shown beside it.
- Don't build from these files alone — they deliberately contain no responsive behaviour. Pair them with
  `design/DESIGN.md` §8 and `docs/decisions.md` §5.

## Open
- All three files cite `design/DESIGN.md` as "323 lines" (`home.md:6`, `results.md:9`, `product.md:7`) and
  describe its theme as "Cinematic Dark" / racing red. That is the *superseded* spec; the current
  `design/DESIGN.md` is 361 lines and documents Track Night directly (`docs/decisions.md` §1). Measured
  values are unaffected — they come from the artboards — but the conflict sections are partly stale.
  Owner or the next extraction pass decides whether to re-point them.
- No inventory exists for `/styleguide`; it is not designed (`design/manifest.md` Routes table). If it
  ever needs parity evidence, someone must say against what.
