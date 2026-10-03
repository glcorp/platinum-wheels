# .claude/rules/

## Purpose
Holds path-scoped authoring rules that Claude Code auto-loads when a matching file is edited. Today that
is one file, `ui.md`, which loads on every `src/**/*.tsx` edit (`HANDOFF.md` §4) and carries the taste
dials plus the JSX non-negotiables. Without it every UI edit would start from model defaults instead of
this project's token-only, quote-first, flush-left rules — the rules are what make the slop grep
structural rather than advisory (`HANDOFF.md` §9).

## Owns
- [`ui.md`](ui.md) — frontmatter `paths: src/**/*.tsx` (`ui.md:1-3`). Sections: taste dials, authority
  order, non-negotiables while writing JSX, copy, and states the design doesn't show.

## Rules
- The taste dials, **verbatim** (`ui.md:10-12`):
  ```
  DESIGN_VARIANCE: 7   # asymmetric 60/40 splits that flip between sections, not centred-everything
  MOTION_INTENSITY: 6  # D92b "Expressive": eased hover + press, route slides/crossfades, card→PDP morph, grid stagger ≤150ms, below-fold reveal once; no parallax, no magnetic, no page-load choreography
  VISUAL_DENSITY: 5    # storefront pages; the results grid may go to 6
  ```
  They were pinned here by the skill's `init` step 5 (`.claude/skills/design-to-code/SKILL.md:109-115`).
  Changing a dial is a project decision, not a file edit. `MOTION_INTENSITY` went 3 → 6 on 2026-09-29 by
  owner ruling **D92b** (root `llm.md` §5b), which also supersedes DESIGN.md §4's "instant fill" hover.
- **This folder's authority is subordinate.** Verbatim: *"Taste rules are **subordinate** to
  `design/assets/*.html` and `design/DESIGN.md`. If a taste rule contradicts the design, the design
  wins."* (`ui.md:15-16`). The full order — `docs/decisions.md`, then the design, then supporting skills
  — is at `ui.md:19-26` and canonically at `docs/decisions.md` §1 / root `llm.md:87-98`.
- Everything else in `ui.md` (the non-negotiables list, copy rules, undrawn states) stays in `ui.md`.
  Read the file; it is not restated here (root `llm.md:25-27`).
- A new rule file follows `ui.md`'s shape: `paths:` frontmatter first (`ui.md:1-3`). Adding or widening a
  glob changes which edits it governs, so it updates this file in the same change (root `llm.md:19-21`).
- A shipped difference from the design is logged in `design/DEVIATIONS.md`, not absorbed here
  (`ui.md:16-17`).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | — | — |

Referenced, not restated: **D5** (one accent per frame is *not* enforced — `ui.md:33-35` points at
`docs/decisions.md` §1.1), **D28** (new placeholder copy is authored under `ui.md` "Copy" — root
`llm.md:142`), **D23/D24** (the library).

## Connects to
- **Depends on:** `docs/decisions.md` (authority 1, `ui.md:21`); `design/assets/*.html` and
  `design/DESIGN.md` (authority 2, `ui.md:22-24`); `design/DEVIATIONS.md` (`ui.md:16-17`);
  `.claude/skills/design-to-code/SKILL.md:109-115`, which specified this file's dials.
- **Depended on by:** every file matching `src/**/*.tsx` — `src/components/ui/`, `src/components/site/`,
  `src/features/*/components/`, and the route files under `src/app/(storefront)/`
  (`HANDOFF.md` §4). Nothing imports it; it loads by glob.

## Don't
- Don't resolve a design conflict by editing `ui.md` to fit. Stop and ask the owner (root `llm.md:17-18`).
- Don't reintroduce an em dash in visible copy, artboard copy included: since **D130** (owner,
  2026-10-03) the ban covers everything a visitor reads (`ui.md` "Copy"). Code comments are exempt.
- Don't park notes, checklists or history in here. The file is injected on every UI edit
  (`HANDOFF.md` §4), so length is paid repeatedly; it is also not a log (root `llm.md:33-34`).
- Don't demote a second accent to satisfy a taste rule — the artboards break the one-accent rule
  everywhere and ship as drawn (`ui.md:33-35`, D5).

## Open
- Precedence between two rule files whose `paths:` globs both match one file is not defined anywhere in
  this project's docs. **Settle with the owner before a second rule file is added.**
- `ui.md:12` says the results grid *"may go to 6"* without saying who decides or where that is recorded.
  **Owner**, when `/design-to-code page results` starts.
