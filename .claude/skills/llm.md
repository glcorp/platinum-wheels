# .claude/skills/

## Purpose
Vendored copies of the skills this project builds with. Nine skill folders sit here; seven are pinned in
the repo-root `skills-lock.json` with their source repo and a `computedHash`, two are not. The folder
matters for two live reasons beyond authoring help: `impeccable/scripts/impeccable` is the launcher both
design-detector hooks call (`.claude/settings.json:10`, `:22`), and `design-to-code/SKILL.md` is the
project's primary workflow — the modes the whole build queue runs through (`HANDOFF.md` §2).

## Owns
**Pinned in `skills-lock.json`** (source repo · `sourceType: github` · `skillPath` · `computedHash`):
- `design-taste-frontend/` — `Leonxlnx/taste-skill` (`skills-lock.json:4-9`). *"Anti-slop frontend skill
  for landing pages, portfolios, and redesigns…"*
- `image-to-code/` — `Leonxlnx/taste-skill` (`:10-15`). *"Elite website image-to-code skill for Codex…"*
- `migrate-radix-to-base/` — `shadcn/ui` (`:16-21`). *"Migrates React projects and components from Radix
  UI to Base UI."*
- `next-dev-loop/` — `vercel/next.js` (`:22-27`). *"Verify Next.js runtime behavior after editing app
  code."*
- `shadcn/` — `shadcn/ui` (`:28-33`). *"Manages shadcn components and projects…"*
- `vercel-react-view-transitions/` — `vercel-labs/agent-skills`, `skillPath:
  skills/react-view-transitions/SKILL.md` (`skills-lock.json:34-39`). *"Guide for implementing smooth,
  native-feeling animations using React's View Transition API…"* Installed 2026-09-29 for the **D92b**
  motion pass with `npx skills add vercel-labs/agent-skills --skill vercel-react-view-transitions`, on the
  owner's approval. The installer wrote the skill to a new `.agents/skills/` folder and left a **symlink**
  here; it was replaced with the real directory so this folder stays symlink-free (D36 — Tailwind scans
  the tree, and every other vendored skill is a plain folder) and `.agents/` was removed.
- `web-design-guidelines/` — `vercel-labs/agent-skills` (`:40-45`). *"Review UI code for Web Interface
  Guidelines compliance."*

**On disk but NOT in `skills-lock.json`** (verified by comparing `find .claude/skills -maxdepth 2` against
the lock file's `skills` keys):
- `impeccable/` — frontmatter `version: 4.3.1`, `license: Apache 2.0`, `user-invocable: true`
  (`impeccable/SKILL.md:4-7`). Ships `scripts/` (the `impeccable` launcher, `VERSION`, `live-browser*.js`)
  and `reference/`. Its installer is `npx impeccable install`, a different one from the `npx skills add`
  used for the two taste skills (`design-to-code/SKILL.md:75-77`).
- `design-to-code/` — the project's own workflow skill: *"Port a Claude Design export (DESIGN.md +
  artboard HTML, or screenshots as fallback) into production Next.js 16 + Tailwind v4 code with measured
  parity…"* Written for this storefront by name (`SKILL.md:8`). Modes `init`, `page <name>`,
  `section <page> <section>`, `shot <image> <page> <section>`, `audit [page]` (`SKILL.md:10`). **Not in
  the lock file** — see Open.

## Rules
- **Do not edit a vendored skill. Re-install to update.** A local edit diverges from the pinned
  `computedHash` and puts
  the copy out of step with the `computedHash` its lock entry records (`skills-lock.json:8` and siblings).
- **`impeccable/scripts/bin/` is gitignored** (D55(2)): its 12 MB binary is `darwin-arm64` only, so a
  clone resolves its own from `$IMPECCABLE_BIN`, `~/.impeccable/bin`, the version cache or `PATH`.
  Everything else under this folder is committed, including the launcher.
- `impeccable/scripts/impeccable` is a live dependency of both hooks and is guarded by `[ ! -f … ] ||`
  (`.claude/settings.json:10`, `:22`) — deleting or renaming that folder disables the design gates
  **silently**.
- A skill never outranks the design: authority level 3, *"fill gaps, check, polish; never change a defined
  token"* (root `llm.md:87-98`; `.claude/rules/ui.md:25-26`; `design-to-code/SKILL.md:14-18`).
- Describe a skill here by its frontmatter `description` and its `skills-lock.json` source only. Do not
  summarise internals from memory (root `llm.md:22-24`).
- If a skill a workflow names isn't installed, say so and continue with the rest — don't reinvent it
  inline (`design-to-code/SKILL.md:71`).
- The skill's `pnpm check` maps to `npm run check` in this repo (`HANDOFF.md` §8.15, `docs/decisions.md` §2).
- Adding or removing a skill updates this file **and** `skills-lock.json` in the same change (root
  `llm.md:19-21`).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | — | — |

Referenced, not restated: **D3** (no git — vendored copies are the only record), **D23/D24** (the
library), **D25** (delegated implementation).

## Connects to
- **Depends on:** `skills-lock.json` (repo root) for the seven pinned entries and their hashes; the
  respective upstream repos for re-installs.
- **Depended on by:** `.claude/settings.json` hooks → `impeccable/scripts/impeccable`;
  `.claude/agents/*` → `impeccable/scripts` and `reference/` (`.claude/agents/impeccable-asset-producer.md:33`);
  `.claude/rules/ui.md:25-26`, which names impeccable, taste, frontend-design and web-design-guidelines as
  the level-3 tier; `.claude/rules/ui.md` itself, whose dials `design-to-code/SKILL.md:109-115` specified;
  `design/manifest.md`, the work queue the `page`/`section` modes consume (`HANDOFF.md` §2);
  `docs/decisions.md` §9, whose quality gates are the skill's §7 gates.

## Don't
- Don't run `shadcn init` or add shadcn components into `src/components/ui/`. Those ten primitives are
  hand-built and token-only (`HANDOFF.md` §4), and the default-palette utilities shadcn assumes
  physically do not compile here (`HANDOFF.md` §9).
- Don't let `image-to-code` or `design-taste-frontend` introduce their own palette, fonts or GSAP
  skeletons — explicitly guardrailed (`design-to-code/SKILL.md:63-64`).
- Don't use `shot` mode. Seven HTML artboards exist in `design/assets/` (root `llm.md:80-81`) and HTML is
  always the better source (`design-to-code/SKILL.md:138`).
- Don't add a skill without a `skills-lock.json` entry; two already lack one and cannot be reproduced from
  the lock file alone.
- Don't accept `npx skills add`'s layout as-is: it installs into `.agents/skills/` and symlinks the
  folder here. Move the real directory in and delete `.agents/` (see `vercel-react-view-transitions/`
  above).

## Open
- **Is `design-to-code` project-authored?** It is absent from `skills-lock.json` and its text names this
  storefront, `docs/decisions.md`, `design/manifest.md` and `.claude/rules/ui.md` directly
  (`SKILL.md:8`, `:16`, `:109`, `:121`). The only evidence of its origin is the owner invoking
  `/design-to-code init` in the original brief (`HANDOFF.md` §10). **Owner:** who authored it, and where is
  it maintained?
- Same question for `impeccable/`: `npx impeccable install` is listed as its installer
  (`design-to-code/SKILL.md:77`) but nothing records it being run here. **Owner.**
- Should the two unlocked skills be added to `skills-lock.json`, and how does the co-founder get them
  with no git (D3, root `llm.md:192-194`)? **Owner.**
