# design/reports/

## Purpose
The evidence folder for the parity gate in `docs/decisions.md` §9. Parity on this project is *measured,
not eyeballed*: each built page gets a `<page>.md` holding a computed-style table at 390 and 1440,
diffed against the artboard baseline served on :4000. All three built pages landed before the initial
commit (D55, `60fa3e8`), so for them these reports plus `design/DEVIATIONS.md` remain the rollback safety
and the audit trail (`docs/decisions.md` §10) — no commit can show what a page looked like mid-build.
Without this folder a page can be called "done" on an opinion, which is exactly what the protocol forbids.

## Owns
- [`deviations-sweep.md`](deviations-sweep.md) — the 2026-09-21 trace of all 43 legacy `DEVIATIONS.md`
  rows against the shipping code and the frozen artboards (**D64**). **0 wrong, 3 stale (corrected in
  place), 1 measured.** Read it before assuming a deviation row is authoritative — it records which
  rows were checked, how, and the one measurement trap that would have failed a correct row. Rows
  #44–#57 are out of scope there: they were written and verified the same week.
- [`README.md`](README.md) — 89 ln. The protocol: how to serve the baseline and the app, how to run the
  probes, the tolerance table, the pipeline-verification run of 2026-09-20, the stale-dev-server gotcha,
  and the control-boundary contrast measurements.
- [`home.md`](home.md) — `/` at 1440 and 390, overflow checks at 375/768/1280, the tablet-band note, the
  interactions verified, and what was not run (Lighthouse). First page report, 2026-09-20.
- [`results.md`](results.md) — `/results` at 1440, 390 and the filter sheet, the tablet-band note
  (D46), and the first Lighthouse readings in the build. 2026-09-21.
- [`product.md`](product.md) — `/products/[slug]` at 1440 and 390, the tablet-band note (D53/#39), and a
  **Behaviour verified** section — the `?qty=` round-trip, form validation and success, the no-vehicle
  genericisation, the unavailable SKU. The PDP is the first route whose correctness is not fully visible
  in a computed-style table, so behaviour is recorded beside the measurements. 2026-09-21.
- `<page>.md` — one per built page. All three designed routes now have one.
- [`audit.md`](audit.md) — the consolidated `/design-to-code audit` pass (SKILL.md §9), 2026-09-21. The
  index over the four `*-audit.md` files, the coordinator's browser-measured gate table, a
  **checked and cleared** list of non-defects, the merged fix list, and the pass's coverage limits.
  **Report-only: the pass changed no file under `src/`.**
- [`home-audit.md`](home-audit.md), [`results-audit.md`](results-audit.md),
  [`product-audit.md`](product-audit.md), [`shared-audit.md`](shared-audit.md) — the four per-scope audit
  reports behind `audit.md`, one per delegated agent (D25), on strictly disjoint files. `shared-audit.md`
  is the cross-cutting one: chrome, the ten primitives, catalog, `globals.css` integrity and the
  cross-page consistency pass.
- [`motion.md`](motion.md) — the **D92b** motion inventory: tokens, every animated element with its
  trigger, before/after, token, reduced-motion behaviour and frame-sampled values from the production
  build, the gate table, and the recorded limits. Its "How this was measured" section is the protocol
  for motion: sample `getAnimations()` per frame for view transitions, seek paused transitions for CSS.

## Rules
- **Never write "matches" or "looks right" here. Every row is a measured number** (`README.md` header
  line, and `HANDOFF.md` §6).
- **A delta outside tolerance is either fixed or linked to a row in `design/DEVIATIONS.md`. There is no
  third option** (`README.md`, Thresholds section).
- **The tolerances are in `README.md` "Thresholds"** — colour/font-family/font-weight/text-transform and
  `border-radius` are exact; sizes and spacing have named allowances. Do not restate them elsewhere and do
  not soften them per page; they are pinned to `docs/decisions.md` §9.
- **Baseline URLs are extensionless.** `npm run design` runs `serve`, which strips `.html`:
  `http://localhost:4000/home-desktop` (`README.md`, "Running a measurement").
- **A stale dev server fakes a passing measurement.** A token added to `:root` did not hot-reload under
  Turbopack; the class was present, the rule existed, the page returned 200, and the token resolved to
  empty. After any `globals.css` change: clear `.next`, restart `next dev`, and read
  `getComputedStyle(document.documentElement).getPropertyValue('--x')` in the browser — not the class
  list, not the source file, not a curled CSS chunk (`README.md`, "Gotcha"; `HANDOFF.md` §8).
- **The probes are `scripts/parity-probe.js`** — `probe()`, `overflowers()`, `accentCount()`
  (`HANDOFF.md` §4).
- **A `<page>.md` and a `<page>-audit.md` are different documents.** The first is the measured parity
  baseline written when the page is built; the second is a §9 audit pass over existing code. An audit
  never edits a `<page>.md` — it reports whether that report's rows still trace to source.
- Note for future tables: `design/DEVIATIONS.md` #15 predicts a row that reads `translate` where the
  artboard reads `transform`. That row is expected, not a failure.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D91b | 2026-09-29 | `qa.md` is the QA-pass report: the test matrix with pass/fail, every finding with evidence and status, checked-and-cleared, and what is parked or artboard-mandated. Its evidence is the committed suite in `tests/`, rerunnable with `npm run test:e2e`. | Owner QA brief, 2026-09-29. | D91b |
No folder-scoped rows. Governing: `docs/decisions.md` §9 (the gate) and §10 (visual-regression tests and
axe-in-CI are explicitly out of scope — "the parity report is the evidence"). Global IDs that will appear
as report rows rather than failures: **D11, D12, D13, D15, D16**.

## Connects to
- **Depends on:** `design/assets/*.html` (the :4000 baseline) · `design/inventory/*.md` (every number in a
  report traces there — `design/manifest.md:6`) · `scripts/parity-probe.js` · `docs/decisions.md` §9
  (thresholds and gate) · `package.json` scripts `design` and `dev`.
- **Depended on by:** `docs/decisions.md` §9, which names `design/reports/<page>.md` as the evidence a
  page is done · `design/DEVIATIONS.md`, whose rows absorb every out-of-tolerance delta ·
  `HANDOFF.md` §6, whose per-section loop ends by writing the table here.

## Don't
- Don't open a `<page>.md` with prose. The table comes first; prose only explains a linked deviation.
- Don't measure the app against a reading of the artboard source. Measure against the rendered baseline on
  :4000 — the pipeline-verification run exists specifically to prove that path works (`README.md`).
- Don't silently widen a tolerance to make a row pass, and don't add a new deviation row to avoid a fix
  without the reason and authority columns filled in (`design/DEVIATIONS.md` table shape).
- Don't loop more than three times on measured deltas; stop and report (`HANDOFF.md` §6, per-section loop).
- Don't curl `.next/static/chunks/*.css` to prove a utility exists — in dev the sheet is split and partly
  HMR-injected, so a grep will call a live rule absent. The browser is authoritative (`HANDOFF.md` §8).

## Open
- `README.md` documents the desktop/mobile viewport pair (1440×900, 390×844) but the threshold table also
  names horizontal-scroll checks at 375 / 768 / 1280. Whether a `<page>.md` records four widths or two is
  unstated — first page author or the owner decides, and the answer belongs in `README.md`.
- `README.md` still carries the `preview_start`/`launch.json` caveat from `HANDOFF.md` §8.16. It cleared once a
  session started in the right directory (`.claude/llm.md` Rules, D36). `README.md` should drop the note;
  not yet edited.
- Baseline images only resolve since 2026-09-20 (D36, via `design/serve.json`). Photo comparison was impossible before that.
- ~~Lighthouse has not been run on `/` (no CLI Chrome).~~ Closed 2026-09-21: Chrome is at
  `/Applications`, not on `PATH`; the recipe is in `README.md` and all three pages have readings. The one
  red row everywhere is the mobile LCP gate, **parked by D54**.
- The audit pass (`audit.md` §6) sampled 18 of the 43 `DEVIATIONS.md` rows, not all of them. The
  remaining ~25 are untested, not certified clean. Whoever next touches `DEVIATIONS.md` should finish it.
