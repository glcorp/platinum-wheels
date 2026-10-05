# src/

## Purpose
All application code, and the root of the `@/*` alias — `"@/*": ["./src/*"]` (`tsconfig.json:21-23`,
**D2**). Nothing outside `src/` is compiled as app source: `design/` and `.claude/` are explicitly
ignored by eslint (`eslint.config.mjs:15-18`) and `scripts/` is outside tsc's include. The folder's job
is to keep a strict separation between *routes* (thin), *features* (business UI), *primitives* (no
business logic) and *constants*, so that a change lands in exactly one place.

## Owns
- [`app/`](app/llm.md) — App Router root: `layout.tsx`, `fonts.ts`, `globals.css` (the token system),
  `favicon.ico` + `icon.png` + `apple-icon.png`, and the `(storefront)` route group.
- [`proxy.ts`](proxy.ts) — Next 16's request proxy (the renamed middleware). Host routing for the admin
  (D97, D115) and `/pay` (D105); the rules are `features/admin/host-routing.ts`. Routing, never
  authorisation. **Since the launch audit (D145; D151)** it also answers a path whose
  percent-encoding cannot be decoded (`/products/%FF`) with that host's 404 instead of Next's unbranded
  500, so its matcher also covers `/products/**`, `/sitemaps/**` and any path containing `%`. Ordinary
  storefront pages still never reach it (the LCP reason in its header comment).
- [`components/ui/`](components/ui/llm.md) — ten token-only primitives (`badge`, `button`, `checkbox`,
  `chip`, `field-label`, `input`, `price`, `section-heading`, `select`, `stripe-divider`).
- [`components/site/`](components/site/llm.md) — header, footer, mobile drawer. **Not created yet**;
  first thing to build at `page home` (`HANDOFF.md` §6).
- [`features/catalog/`](features/catalog/llm.md) — `types.ts` (`Product`, `ProductBadge`) and
  `components/product-card.tsx`, the most reused component in the build.
- [`lib/`](lib/llm.md) — `site.ts`: the canonical contact block, both named contacts, brands list.
- Planned, not yet created: `features/finder/` (**D27**), `features/home/components/` (**D33**),
  later `features/results/` and `features/product/` (`docs/decisions.md:62-67`).

## Rules
- **Import by alias, never by deep relative path across folders**: `@/components/ui/button`, not
  `../../..` (`tsconfig.json:22`; **D2**). Every current import already does this
  (`src/app/(storefront)/styleguide/page.tsx:4-15`).
- **Named exports only; no barrel `index.ts`** (`docs/decisions.md:69`).
- **TypeScript strict, no `any`** (`docs/decisions.md:50`, `tsconfig.json:7`).
- **Server Components by default.** `"use client"` only on leaf islands, **never at page level** — a
  `'use client'` inside `src/app/` is a build failure by policy (`docs/decisions.md:73-75`). The two
  islands the design needs (featured carousel **D30**, mobile nav drawer **D31**) therefore live under
  `src/features/` and `src/components/site/`, not `src/app/`.
- Layout is fixed by `docs/decisions.md` §3 (`:59-69`): routes thin (metadata, landmarks, composition);
  feature UI under `features/<f>/components/`; chrome under `components/site/`; **primitives carry no
  business logic**; constants in `lib/`.
- **No arbitrary Tailwind values anywhere in `src/`** (`HANDOFF.md` §9). Off-palette utilities do not
  compile at all — see `src/app/llm.md`.
- **The slop grep must stay at zero** (`HANDOFF.md` §5): no arbitrary values, no default palette, no
  cart language, no `use client` in `src/app/`, no `any`, no default exports in components. (Next's own
  route files keep their required `export default`; the rule is about components.)
- Contact data is never hardcoded in a component — it comes from `src/lib/site.ts`
  (`docs/decisions.md:129`), as the smoke test already does (`src/app/(storefront)/page.tsx:1`).
- `next/link` for every internal link, `next/image` always with `sizes` (`docs/decisions.md:77-78`).
  Links may point at planned routes before those routes exist (**D26**).
- `.claude/rules/ui.md` auto-loads on every `src/**/*.tsx` edit and is binding (`HANDOFF.md` §4).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | No folder-scoped rows. | Governed by **D2** (alias + `src/` layout), **D26** (planned links), **D27** (finder data), **D29** (catalog seed), **D30**/**D31** (the only client islands), **D33** (`features/home/`). | root `llm.md` §5 |

## Connects to
- Depends on: `docs/decisions.md` §3/§4 (layout and rendering law), `.claude/rules/ui.md`,
  `design/DESIGN.md` and `design/inventory/*.md` (measured values), `public/images/` (runtime asset
  paths), `tsconfig.json` (the alias).
- Depended on by: `next dev` / `next build` through `src/app/`; `design/reports/*.md`, which measures
  what this tree renders; `design/manifest.md` Routes table, which names the file for each artboard.

## Don't
- Don't add a barrel `index.ts` to tidy imports (`docs/decisions.md:69`).
- Don't create `middleware.ts` — request-level middleware goes in `proxy.ts` in this Next version
  (`docs/decisions.md:55`).
- Don't reach for a default Tailwind palette or size utility (`bg-slate-900`, `text-sm`, `rounded-xl`);
  they are reset to `initial` and physically do not compile (`src/app/globals.css:83-94`).
- Don't import anything from `design/` — it is the frozen export and is not linted as source
  (`eslint.config.mjs:18`).
- Don't recall a Next API from memory. This is `16.4.0-canary.37`; read
  `node_modules/next/dist/docs/` first (`AGENTS.md:5`, `docs/decisions.md:56-57`).

## Open
1. **`components/site/`, `features/finder/` and `features/home/` do not exist yet** but are named by
   `docs/decisions.md` §3 and **D27**/**D31**/**D33**. Each needs its `llm.md` *before* its first file
   (root `llm.md` §1.2). Whoever builds `page home` owns that.
