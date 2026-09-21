# .claude/agents/

## Purpose
Holds the four subagent definitions that come with the impeccable skill. Each file's frontmatter declares
`name`, `description`, `tools`, `model: inherit`, `effort` and `maxTurns`; the body is that agent's brief.
They exist so impeccable's asset production, finish review, documentation and live-edit steps run in their
own context with a restricted tool set instead of inside the main thread. Delete the folder and the
impeccable premium pass (`.claude/skills/design-to-code/SKILL.md:174-181`) loses the workers those steps
hand off to.

## Owns
- [`impeccable-asset-producer.md`](impeccable-asset-producer.md) — *"Produces clean reusable raster assets
  from approved Impeccable mock references without redesigning the direction."* Tools
  `Read, Write, Edit, Bash, Glob, Grep`; `effort: medium`, `maxTurns: 24` (`:2-7`).
- [`impeccable-documenter.md`](impeccable-documenter.md) — *"Records DESIGN.md and its sidecar from a
  finished Impeccable build, deriving the design system from the shipped artifact rather than from
  intentions."* Tools `Read, Write, Bash, Glob, Grep`; `medium` / `30` (`:2-7`).
- [`impeccable-finish-reviewer.md`](impeccable-finish-reviewer.md) — *"Reviews a finished Impeccable build
  against its direction contract, the approved comp, and the chosen world's quality bar, returning an
  ordered list of material fixes."* Tools `Read, Bash, Glob, Grep` (read-only); `high` / `30` (`:2-7`).
- [`impeccable-manual-edit-applier.md`](impeccable-manual-edit-applier.md) — *"Applies leased Impeccable
  live manual copy-edit batches to source and returns canonical Apply results."* Tools
  `Read, Write, Edit, Bash, Glob, Grep`; `medium` / `12` (`:2-7`).

## Rules
- These are **part of the impeccable install, not project-authored**. Every file is named `impeccable-*`,
  every brief is written in impeccable's vocabulary, and the briefs invoke
  `.claude/skills/impeccable/scripts/impeccable` by path and read/write `.impeccable/*`
  (`impeccable-asset-producer.md:33-35`, `impeccable-finish-reviewer.md:19`). Treat them as vendored:
  hand-editing is not expected and a re-install would overwrite. **Confirm with the owner — see Open.**
- `impeccable-documenter` writes a `DESIGN.md` derived from shipped code (`:3`). This project's
  `design/DESIGN.md` is a frozen Claude Design export sitting at authority level 2 (root `llm.md:87-98`).
  Do not point the documenter at it without an owner ruling.
- `impeccable-finish-reviewer` edits nothing and has no browser (`:11`, `:13`). Its output is a fix list
  for the caller to apply, not a change.
- **Agent output is a claim, not a fact.** Three subagent findings in this project were wrong or had to be
  overridden (`HANDOFF.md` §3). Verify before acting.
- These four are unrelated to the orchestration pattern in **D25** — those implementation subagents are
  ad-hoc briefs written per task, not files in this folder.
- Adding or removing an agent here updates this file in the same change (root `llm.md:19-21`).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | — | — |

Referenced, not restated: **D25** (coordinator + delegated implementation; model per task is the owner's
call — root `llm.md:139`), **D23/D24** (the library), **D55** (git since 2026-09-21 — a hand edit here is now visible in `git diff`, but these are vendored
copies and re-installing, not reverting, is the fix).

## Connects to
- **Depends on:** `.claude/skills/impeccable/` — the `scripts/impeccable` launcher and the skill's
  `reference/` files the briefs name (`impeccable-asset-producer.md:33-35`,
  `impeccable-finish-reviewer.md:19`); the `.impeccable/` working directories (`build/`, `review/`,
  `mocks/`) the same briefs read and write.
- **Depended on by:** the impeccable premium pass in `.claude/skills/design-to-code/SKILL.md:174-181`,
  which runs *after* parity passes. Nothing in `src/` references these files.

## Don't
- Don't hand-edit an agent to change project behaviour. Project authoring rules belong in
  `.claude/rules/` with `paths:` frontmatter (`.claude/rules/ui.md:1-3`).
- Don't let an agent's finding override the authority chain — supporting skills and their agents *"never
  change a token, font, radius or layout the design already defines"* (`.claude/rules/ui.md:25-26`).
- Don't ask `impeccable-finish-reviewer` to render, screenshot or start a server; it refuses by design
  (`impeccable-finish-reviewer.md:13`). Parity measurement is `scripts/parity-probe.js` against the
  `:4000` baseline instead (`HANDOFF.md` §1, §5).
- Don't run the documenter over `design/DESIGN.md` — see Rules.

## Open
- **Confirm these four are impeccable-installed and may be regenerated.** `design-to-code/SKILL.md:77`
  lists `npx impeccable install` as the install step, but nothing in the repo records that it was run
  here, and the agents are absent from `skills-lock.json`. **Owner.**
- Whether `impeccable-documenter` should ever run on this project given the frozen design export.
  **Owner.**
- Whether the co-founder re-installs impeccable locally or receives these files as-is — unresolved with
  the sharing mechanism (D3, root `llm.md:192-194`). **Owner.**
