# docs/

## Purpose
Holds `decisions.md`, the tech-feasibility HLD and **authority level 1** for this project: when the HLD
and the design disagree on *how* something is built, the HLD wins; when they disagree on *how it looks*,
the design wins (`docs/decisions.md:3-4`). Every other document in the repo defers to it — the root
`llm.md` authority chain puts it above the artboards and the spec, and `HANDOFF.md` §2 makes it the first
file a fresh session reads. Delete it and nothing settles a stack, rendering, mobile or business-rule
question; the design alone cannot, because it never speaks to implementation.

## Owns
- [`decisions.md`](decisions.md) — 149 ln. One line per section:
  - §1 source-of-truth ruling (artboards win on numbers; spec governs silence; spec-only elements are asked).
  - §1.1 the one-accent rule as softened by the replacement spec — judge by the frame, not the component.
  - §2 stack: Next.js 16.4 canary App Router, React 19.3, TS strict, Tailwind v4 in `globals.css`, npm, `proxy.ts`.
  - §3 source layout and the `@/*` alias; named exports only, no barrel `index.ts`.
  - §4 rendering: Server Components by default, `"use client"` on leaf islands only, `next/image` and `next/link` rules, one `<h1>`.
  - §5 mobile-first: build at 390, breakpoints 400/720/1100/1320, ≥16px inputs, ≥44px targets, native `<select>` for Year/Make/Model.
  - §6 third-party: no scripts but Vercel Analytics, self-hosted fonts, static map image.
  - §7 business rules: quote-first, no cart/checkout/stock counts, the per-context price suffix, unavailable-product behaviour, CASL unticked.
  - §8 content and legal: hero replacement, no invented social proof, text wordmarks, contact constants in `src/lib/site.ts`, sample data must not ship.
  - §9 quality gates per page: `npm run check`, a measured parity report, zero design-guideline findings, Lighthouse floors, keyboard walk-through, reduced motion.
  - §10 explicitly out of scope: visual-regression tests, axe in CI, and git history.
- [`catalogue-csv.md`](catalogue-csv.md) — the suggested layout of the catalogue file the import
  reads: one row per product, the columns per category, and what the import does with a bad row
  (D113). A suggestion for whoever prepares the data, not authority level 1.
- [`payments.md`](payments.md) — the payments design: Converge via Costco/Elavon, our own link + hosted
  payment page, data model and state machines, static-IP proxy limits, env vars, proposed decision rows.

## Rules
- **Amend by editing `decisions.md`, not by exception in code** — its own Status line
  (`docs/decisions.md:6`). A rule worked around in a component is a rule that is now false.
- **Anything this document forces the design to change is logged in `design/DEVIATIONS.md`**
  (`docs/decisions.md:4`). Deviations #10, #12 and #16 are exactly that: the HLD overruling a drawn value.
- **It loses to the artboards on appearance.** Numbers, layout and copy come from `design/assets/**`
  (root `llm.md` §4). §1 says so in its own voice.
- **`docs/decisions.md` is the HLD; root `llm.md` §5 is the decision *register*. They are different
  documents with different jobs.** The register records *what was decided, when, by whom, and on what
  authority* — D1–D35, owner quotes verbatim, superseded rows kept (root `llm.md` §1.6, §1.8). The HLD
  records *how the system is built* — a standing description of the stack and its rules, with no IDs and
  no history. A new ruling gets a `D<n>` row in the register; if it changes how the system is built, the
  HLD section is edited too. Neither one is a summary of the other.
- Decision IDs are global and never renumbered; new ones continue from the register, not from here
  (root `llm.md` §1.5).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
No folder-scoped rows. `decisions.md` is where the *rules* live and root `llm.md` §5 is where the *IDs*
live; the IDs that pin sections of the HLD are **D2** (§3), **D3** (§10), **D5** (§1.1), **D10** (§5),
**D18** (routes), **D21** (§7 price suffix) and **D25** (orchestration).

## Connects to
- **Depends on:** `design/DESIGN.md` and `design/assets/*.html` (§1 defines the authority split against
  them) · `design/DEVIATIONS.md` (§1 and §4 route consequences there) · `design/reports/` (§9 names
  `design/reports/<page>.md` as gate evidence) · `AGENTS.md` (§2 defers to `node_modules/next/dist/docs/`).
- **Depended on by:** root `llm.md` §4 (which places it at the top of the chain) ·
  `.claude/rules/ui.md` (authority order for `src/**/*.tsx`) · `src/app/globals.css`, `src/lib/site.ts`,
  `src/components/**`, `src/features/**` — §3–§8 govern all of them · `design/reports/README.md`
  (thresholds are pinned to §9).

## Don't
- Don't put a visual value here. Colours, sizes, spacing and copy belong to the artboards and are measured
  in `design/inventory/` (root `llm.md` §4).
- Don't add a `D<n>` row to this file. IDs live in root `llm.md` §5 (`HANDOFF.md` §11 for D1–D22).
- Don't treat it as a log of what happened. It describes the system as it is now; the session record is
  `HANDOFF.md`, frozen at 2026-09-20 (root `llm.md` §5b, D24).
- Don't relax a §9 gate for one page. The gates are per page and uniform; an exception becomes a
  `design/DEVIATIONS.md` row with an authority, or it does not happen.
- Don't add a second file here casually — a new doc needs a reason this one cannot hold it, and a pointer
  from this `llm.md` in the same change (root `llm.md` §1.2).

## Open
- §5 requires Year/Make/Model to be native `<select>`s, and D27 supplies a self-built seed list flagged as
  sample data. Nobody has said who replaces it with real fitment data, or when — owner, once a backend
  exists (root `llm.md` §7.3).
- §10's "out of scope" row on git was rewritten on 2026-09-21 for D55: the repo exists, but with the whole
  tree in one initial commit, so per-section history is still out of scope retroactively. What remains open
  is **co-founder access** (root `llm.md` §7.1): the private remote `github.com/glcorp/platinum-wheels`
  backs `docs/` up off-machine, but only the owner's account can read it. Owner's call.
- §7's facet and stock rules assume real catalogue data. The only data supplied is a wheel feed used as
  reference only (D9), and the design sells tires. Unresolved until the client supplies a tire catalogue.
