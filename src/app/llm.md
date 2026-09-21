# src/app/

## Purpose
The App Router root, and the single place the design system is defined. `globals.css` **is** the theme —
there is no `tailwind.config.*` (`docs/decisions.md:51`) — so every colour, size, tracking, leading,
breakpoint and container in the build resolves from this one file. `layout.tsx` is the only place it is
imported (`layout.tsx:3`) and the only place the font faces are attached. Break anything here and the
entire site loses its type or its palette at once.

## Owns
- [`globals.css`](globals.css) (574 ln) — the token system. See Rules.
- [`layout.tsx`](layout.tsx) (30 ln) — root layout. Metadata `title.default` + `template: "%s · Platinum
  Wheels"` and the site description (`:5-12`); `viewport` `themeColor: "#0B0B0D"`, `colorScheme: "dark"`
  (`:14-17`); font variables + `h-full antialiased` on `<html>` (`:21-24`); `<body>` carries
  `bg-bg text-ink-muted flex min-h-full flex-col font-sans` (`:25`).
- [`fonts.ts`](fonts.ts) (29 ln) — Barlow Condensed 600/700 and Barlow 400/500/700, self-hosted via
  `next/font/google`, `display: "swap"`, `adjustFontFallback` (**D20**; `docs/decisions.md:99`).
- `favicon.ico` — App Router file convention. It lives here, **not** in `public/`.
- [`not-found.tsx`](not-found.tsx) — global 404 on `PageStub`; one of the undrawn states (`design/manifest.md`).
- [`(storefront)/`](<(storefront)/llm.md>) — the storefront route group. Has its own `llm.md`.

## Rules
`globals.css`, in the ten lines worth internalising — point at the file, don't restate its comments:

- `@theme inline` resets `--color-*`, `--radius-*`, `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*`,
  `--text-shadow-*`, `--blur-*`, `--font-*`, `--text-*`, `--tracking-*`, `--leading-*`, `--breakpoint-*`
  and `--container-*` to `initial` (`:83-94`, `:225`). **`bg-slate-900`, `text-sm`, `shadow-lg` and
  `rounded-xl` physically do not compile.** That makes the slop grep structural, not advisory.
- `:root` (`:12-73`) keeps the artboards' **own** token names so a browser value traces straight back to
  `design/assets/*.html`. `@theme inline` (`:96-134`) maps them to utility names: `--text`→`text-ink`,
  `--text-muted`→`text-ink-muted`, `--text-dim`→`text-ink-dim`, `--bg`→`bg-bg`, `--surface`→`bg-surface`,
  `--surface-2`→`bg-surface-2`, `--canvas-bg`→`bg-canvas`, `--border`→`border-border`,
  `--border-strong`→`border-border-strong`, `--border-control`→`border-border-control`, `--accent`→`*-accent`.
- Type: 15 bare sizes `text-10`…`text-64` (`:153-167`), measured from the exports. Display sizes exist
  **only** as `text-display-<n>` → `calc(<n>px * var(--scale-*))` (`:178-188`), paired with the `display`
  utility — headline sizes are never bare pixels.
- Role utilities (`:272-544`). Each exists because no Tailwind utility expresses it without an
  arbitrary value; the reason is in the comment above each one. Type and photo roles: `display` (`:272`),
  `label` (`:280`), `numeral` (`:288`), `photo-inset-card` (`:296`), `photo-vignette` (`:306`),
  `tap-extend` (`:321`), `transition-card` (`:403`), `photo-inset-gallery` (`:407`).
  **Accessibility roles, added 2026-09-21 by D57** — each fixes a measured defect and changes no drawn
  property, so no parity row moves: `tap-extend-lg` (`:339`) the same transparent band at ±16px, for
  lines too short for `tap-extend` to lift over the 44px floor (13px crumbs hit-tested 37px → 45px;
  `DEVIATIONS.md` #41); `hide-scrollbar` (`:357`) the one mechanism both scroll-snap carousels compose,
  since `similar-track` no longer hides its own (#48); `skip-link` (`:372`) the off-screen-until-focused
  bypass link, revealed on **`:focus`** not `:focus-visible` — the link is unreachable except by Tab, and
  `:focus-visible` does not match programmatically moved focus (#44).
  Home layout and scrims: `hero-scrim[-desktop]` (`:421`, `:430`), `tile-scrim[-tall]` (`:442`, `:450`),
  `promo-wash[-desktop]` (`:461`, `:468`), `fade-right` (`:477`), `photo-caption-scrim` (`:482`),
  `finder-grid` (`:493`), `contact-grid` (`:501`), `category-grid` (`:508`). `/results` (D44):
  - `results-grid` (`:523`) — the drawn two-column page grid, `280px minmax(0,1fr)` with a 48px column
    gap and `align-items:start` (`results-desktop.html:119`).
  - `range-input` (`:536`) — a native `<input type="range">` wearing the artboard's price-slider handle;
    two overlap for the min/max pair, so only the 16px thumb takes pointer events.
  - `sheet-panel` (`:525`) — the filter sheet's height, `calc(100dvh - 144px)`, the 700px of the 844px
    artboard expressed in `dvh` (`docs/decisions.md` §5: `dvh`, never `vh`).
  - `size-grid-sheet` (`:533`) — the sheet's tire-size row, `1fr 1fr 1fr 88px` ending in the 88px
    `Apply` (`results-mobile-filters.html:78`).
  - `pb-safe` (`:542`) — the sheet footer's 20px bottom padding plus `env(safe-area-inset-bottom)`.
- Breakpoints `xs` 400 / `sm` 720 / `md` 1100 / `lg` 1320 (`:243-246`) — **D10**. Container
  `--container-content: 1344px` → `max-w-content` (`:227`) — **D11**. Spacing has no tokens: the
  artboards sit on a 2px grid reachable from Tailwind's 4px step (`:254-257`).
- `@layer base` (`:546`) sets the body ground/ink and the accent `:focus-visible` ring at offset 0
  (**D16**), plus a `prefers-reduced-motion` block (`:565`).
- **`fonts.ts` variables are `--font-display-face` / `--font-body-face` deliberately** — *not* the theme
  key names `--font-display` / `--font-sans`, which `globals.css:137-138` point at. Same names would be a
  circular `var()` (`fonts.ts:19,28`; `HANDOFF.md` §4).
- **Single writer.** `globals.css` is edited by one session/agent at a time; delegated work reports a
  missing token instead of adding one (**D25**, `HANDOFF.md` §3).
- **Gotcha that costs an hour:** a `:root` token change does **not** hot-reload under Turbopack. After
  any `globals.css` edit: `rm -rf .next`, restart `next dev`, and verify in the browser with
  `getComputedStyle(document.documentElement).getPropertyValue('--x')` (`HANDOFF.md` §8,
  `design/reports/README.md:63-78`).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | No folder-scoped rows. | Governed by **D10** (breakpoints), **D11** (1344 container), **D14** (`--border-control`), **D16** (focus offset 0), **D17** (hover scoped), **D20** (two self-hosted families). | root `llm.md` §5 |

## Connects to
- Depends on: `fonts.ts` → `next/font/google`; `design/assets/*.html` `:root` (the token source,
  `globals.css:5-6`); `design/DESIGN.md` §2/§3/§4; `next.config.ts:5-12` (the `@tailwindcss/turbopack`
  CSS rule that compiles this file).
- Depended on by: every `.tsx` under `src/` (utilities emit from here); `src/components/ui/*`;
  `src/app/(storefront)/`; `design/reports/README.md:47-58`, whose pipeline table measures these tokens
  against the artboard.

## Don't
- Don't create a `tailwind.config.*`. Config lives entirely in this file (`docs/decisions.md:51`).
- Don't rename the font variables to the theme key names — circular `var()` (`fonts.ts:19,28`).
- Don't add a transition to buttons. The exports declare none; the fill swap is instant by design
  (`globals.css:230-235`, DESIGN.md §4).
- Don't use an arbitrary value to reach a colour or size. Add the token, or report it missing.
- Don't treat a green `next build` as proof a utility emitted — Tailwind v4 drops unknown utilities
  silently, and in dev the sheet is split and partly HMR-injected. The browser is authoritative
  (`HANDOFF.md` §8).
- Don't put `"use client"` anywhere in this tree (`docs/decisions.md:73-75`).

## Open
1. `--winter` / `--all-season` are referenced by **zero** artboard elements and are kept only because
   DESIGN.md §2 gives them a role; `globals.css:47-51` says to delete them if no screen ever uses one.
   Today only the throwaway smoke test touches `text-winter` (`(storefront)/page.tsx:14`).
   **Owner/designer** decides at `page results` / `page product`.
2. No `robots.ts` or `sitemap.ts` exists, yet `/styleguide` is specified as "excluded from the sitemap
   when one exists" (`design/manifest.md:16`). Who owns the SEO route files — **owner**.
