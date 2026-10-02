# src/components

## Purpose
Shared UI that belongs to no single feature. It has exactly two children and the split between them is
the point: `ui/` holds token-only primitives with no product knowledge, `site/` holds the page chrome
that wraps every route. Delete this folder and every page loses its buttons, fields, badges and header —
`src/features/catalog/components/product-card.tsx` alone imports three primitives from it
(`product-card.tsx:4-6`).

## Owns
- [`ui/`](ui/llm.md) — ten primitives, 1,219 lines (`HANDOFF.md` §4). Its own `llm.md`.
- [`site/`](site/llm.md) — header, footer, drawer. **Empty today**; its own `llm.md` describes the plan.
- No files sit at this level, and none should: this folder is a split, not a namespace.

## Rules
- **The split is a rule, not a convention.** `docs/decisions.md:65` — `src/components/ui/` is
  "primitives only — no business logic"; `docs/decisions.md:64` — `src/components/site/` is
  "header, footer, mobile call bar". A component that knows what a `Product` is does not belong in `ui/`.
- **Named exports only; no barrel `index.ts`** (`docs/decisions.md:69`). Every import is a deep path —
  verified across `src/`: all five cross-module imports name the file.
- Server Components by default; `"use client"` only on leaf islands and **never** inside `src/app/`
  (`docs/decisions.md:73`). Nothing in this folder is a client component today.
- Tokens only. No Tailwind default palette, no arbitrary values (`.claude/rules/ui.md`, "Non-negotiables
  while writing JSX"); the token namespaces are reset to `initial` so violations do not compile
  (`HANDOFF.md` §9).
- A new folder gets its `llm.md` before its first file (root `llm.md` §1.2).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | This folder only enforces the HLD's layout. | — |

Global rows bearing on it: **D2** (source lives in `src/`, `@/*` → `./src/*`), **D7** / DEVIATIONS #11
(header composition, which `site/` must build), **D31** (mobile nav drawer), **D33** (home-only sections
go to `src/features/home/`, not here), **D34** (no social links in the footer).

## Connects to
- **Depends on:** `src/app/globals.css` — every colour, size, radius and role utility
  (`label`, `display`, `numeral`, `tap-extend`, `transition-card`) resolves there. `next/link`
  (`ui/button.tsx:1`). `src/lib/site.ts` once `site/` exists (`docs/decisions.md:129`).
- **Depended on by:** `src/app/(storefront)/styleguide/page.tsx:4-15` (all ten `ui/` modules);
  `src/features/catalog/components/product-card.tsx:4-6` (`ui/badge`, `ui/button`, `ui/price`).
  `site/` will be depended on by all three storefront routes (`design/manifest.md:107-109`).

## Don't
- **Don't add a barrel `index.ts`.** Explicitly forbidden (`docs/decisions.md:69`).
- **Don't put a `Product`-aware component in `ui/`.** It goes to `src/features/<feature>/components/`
  (`docs/decisions.md:63`). `ProductCard` composes three primitives and lives in `catalog/` for exactly
  this reason.
- **Don't put a primitive in `site/`.** `site/` is chrome — three named files, nothing else
  (`design/manifest.md:107-109`).
- **Don't put home-page sections here.** They go to `src/features/home/components/` (D33).
- **Don't reach for `"use client"` at this level.** Only a leaf island takes it
  (`docs/decisions.md:73`).

## Open
1. **What is the "mobile call bar"?** `docs/decisions.md:64` assigns one to `site/`, but D6 killed the
   sticky mobile PDP buy bar and the only drawn mobile-only call element is `call-cta-panel` on
   `/tires` (`design/manifest.md` §2 row 9), which reads as a results-page section rather than site
   chrome. Whether it becomes `site/mobile-call-bar.tsx` or a `features/results/` section needs the
   owner's call before `page results`.
2. **Nested `CLAUDE.md` shims.** Root `llm.md` §7 #4 — unresolved for every folder, this one included.
