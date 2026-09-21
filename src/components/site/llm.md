# src/components/site

## Purpose
The page chrome shared by all three designed routes — header, footer, and the mobile nav drawer that
opens from the header. `design/manifest.md:107-109` lists `site-header` (3 pages) and `site-footer`
(3 pages) under "Shared components (build once, in `src/components/site/`)", and `HANDOFF.md` §6 makes
them the first thing to build before `page home`: every route composes them, so building them twice
would mean fixing parity twice.

**Built** at `page home`, 2026-09-20: `site-header.tsx`, `site-footer.tsx`, `site-nav-drawer.tsx` and
`page-stub.tsx` all exist. `SiteHeader` and `SiteFooter` are composed by `/` and `/results`
(`src/app/(storefront)/page.tsx:3-4`, `results/page.tsx:3-4`); `PageStub` stands behind every
undesigned route and the global 404 (`src/app/not-found.tsx:2`).

## Owns
- [`site-header.tsx`](site-header.tsx) — Server Component, named export `SiteHeader`. Props:
  `{ variant: "over-hero" | "solid"; active?: "tires" | "wheels" | "accessories" | "contact" }`
  (`active` defaults `"tires"`). Renders `<header><nav aria-label="Primary">`: logo (`next/image`,
  no wordmark, D7), the four nav links (desktop, `md:flex`), the phone CTA (`ui/button.tsx`
  `accent`/`compact`, D40, visible `sm:`), a 44×44 circular mobile call button (which carries
  `hover:bg-accent-hover` since **D66** — it was `bg-accent` in every state, the only accent CTA in the
  build with no hover fill, and `--accent-hover` is the token `Button` `primary` already uses), and the
  `SiteNavDrawer` trigger (`md:hidden`). Shared by `/`, `/results` and `/products/[slug]`
  (unbuilt routes may still import it per D26/D39). 88px bar from `sm:` / 68px below.
- [`site-footer.tsx`](site-footer.tsx) — Server Component, named export `SiteFooter`, no props.
  120px logo badge, Shop/Company/Legal link columns (`ROUTES`), a computed `Winter <year>` link
  and bottom-bar `© <year> {SITE.legalName} Inc.` (D32). Social row omitted per D34.
- [`site-nav-drawer.tsx`](site-nav-drawer.tsx) — `"use client"`, named export `SiteNavDrawer`. Props:
  `{ links: ReadonlyArray<{ label: string; href: string; active: boolean }>; phone: { display: string;
  tel: string } }`. 44×44 hamburger trigger + a native `<dialog showModal()>` full-screen drawer
  (Esc, focus trap and return-focus are native); the four links plus the phone CTA, nothing else
  (D31). The only client island in this folder. The `<dialog>` carries **`overscroll-contain`**
  (**D65**, 2026-09-22): `overscroll-behavior` was declared nowhere in the build, so scrolling past
  either end of the open drawer chained to the page behind it. The filter sheet took the same fix
  through the `sheet-panel` utility (`src/app/llm.md` Rules). The `<nav>` closes on **`pb-safe`, not
  `pb-4`** (**D66**, 2026-09-22): the drawer is `inset-0 h-dvh`, so the bottom `tel:` CTA sat 16px off
  the viewport edge and fell under the home indicator on a notched phone. Base padding moves 16px →
  20px and needs **no `design/DEVIATIONS.md` row** — the drawer is undrawn, so its layout is the
  coordinator's call (D31).

- [`page-stub.tsx`](page-stub.tsx) — `PageStub`, props `{ title; active?; children? }`. Solid header + one `h1` + one line + footer, behind every planned-but-undesigned route (D26, D39). Replace each stub with its designed page.
- [`route-error.tsx`](route-error.tsx) — `"use client"`. `RouteError({ error, retry })`, the storefront's
  route error boundary (**D62**), plus `RouteErrorPanel({ digest?, retry?, as? })`, its contents without
  the `<main>` wrapper so `/styleguide` §11 can render the real component instead of a copy that drifts
  (the `ResultsEmpty` / `QuoteErrorSummary` precedent). `src/app/(storefront)/error.tsx` is the directive
  plus a one-line re-export of `RouteError` and holds no component code — Next requires the directive in
  that file and rejects a bare re-export, which is why the `"use client"`-under-`src/app/` ban has one
  named exception. **Renders no `SiteHeader` or `SiteFooter`**, deliberately: importing them into a
  client module would pull both into every route's client bundle, and a boundary should not re-render
  what may have just failed. Read the file header before changing either point. Props are `error` and
  **`retry`** — renamed from `reset` in this canary.

## Rules
- **Header composition is the artboards as drawn** — D7 / DEVIATIONS #11: 64px badge image, **no text
  wordmark**, one accent-bordered `Call 647-989-6178` link, and **four** nav items (`Tires` active,
  `Wheels`, `Accessories`, `Contact` — `design/inventory/home.md:139`). No fifth `Services` item: there
  is no designed Services page, so it would be a dead link.
- **The nav bottom hairline is `1px --border`, not `--border-strong`** — DEVIATIONS #7, "What the
  artboards draw". `design/DESIGN.md` §4 says `--border-strong` and loses.
- **Contact data comes only from `src/lib/site.ts`.** "Contact data lives in `src/lib/site.ts` as named
  constants, never hardcoded in components" (`docs/decisions.md:129`). The header CTA and any call
  button use `PRIMARY_CONTACT`; the footer uses `CONTACTS` and `SITE`.
- **The footer ships no social links** — D34, "No social links yet"; the drawn three social squares are
  omitted until URLs exist. Precedent D7: no dead links.
- **The year is computed at render**, never hard-coded — D32. `© <year>` here, `Winter <year>` in the
  home promo. The artboards' `2026` is sample data (`design/DEVIATIONS.md`, "Sample data").
- **Links point at planned routes** — D26. `/results`, `/products/<slug>` and the stub routes are
  linkable before they exist; every `href` in the exports is `"#"` (`design/inventory/home.md:731`).
- **Header and footer stay Server Components.** Only the drawer takes `"use client"`, as a leaf island
  (`docs/decisions.md:73`). The drawer is the four nav links plus the phone CTA, full-screen, Esc
  closes, focus trapped, sized in `dvh` (D31); nothing else about it is drawn or specified.
- Tokens only; `next/image` with `sizes` and a reserved box for the badge; `next/link` for internal
  links (`docs/decisions.md` §4). Named exports, no barrel (`docs/decisions.md:69`).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | Every ruling that shapes this folder is global. | — |

Governing global rows: **D7** / DEVIATIONS #11 (composition), **D26** (link planned routes),
**D31** (drawer), **D32** (computed year), **D34** (no social row), **D22** / DEVIATIONS #8 (one DOM at
all widths, hide rather than remove).

## Connects to
- **Depends on:** `src/lib/site.ts` (`SITE`, `CONTACTS`, `PRIMARY_CONTACT`) and `src/lib/routes.ts`;
  `src/components/ui/button.tsx` for the header CTA; `src/app/globals.css` tokens; `next/image`,
  `next/link`; `public/images/` for the badge PNG.
- **Depended on by:** `src/app/(storefront)/page.tsx:3-4` and `results/page.tsx:3-4`
  (`SiteHeader` + `SiteFooter`); `products/[slug]/`, `wheels/`, `accessories/`, `about/`, `privacy/`,
  `terms/` and `src/app/not-found.tsx:2` (`PageStub`). Nothing under `src/features/` imports it —
  the boundary runs one way (`docs/decisions.md:65`).

## Don't
- **Don't build a text wordmark, a `GET A QUOTE` ghost button, or a `Services` nav item.** The spec asks
  for all three; the owner ruled for the artboards (D7, DEVIATIONS #11).
- **Don't hardcode a phone number, email or address.** `src/lib/site.ts` or nothing
  (`docs/decisions.md:129`).
- **Don't make the home header sticky.** It is absolutely positioned inside the hero
  (`design/manifest.md:44`, `HANDOFF.md` §6).
- **Don't add the social row back** because the artboard draws it (D34).
- **Don't put the home hero, finder or any home section here.** Those are `src/features/home/` (D33) and
  `src/features/finder/`.
- **Don't mark the header or footer `"use client"`** to get the drawer working — extract the island
  (`docs/decisions.md:73`).

## Open
1. ~~**Is there a `mobile-call-bar.tsx`?**~~ No. Closed 2026-09-21 by **D47(1)**: `call-cta-panel` is a
   results section and lives at `src/features/results/components/call-cta-panel.tsx`. No site-wide call
   bar exists or is drawn; the only call affordance here is the header's 44×44 circular button.
   `docs/decisions.md:64` keeps the superseded assignment (root `llm.md` §7.9, now closed).
2. ~~**Solid-header background measures `--scrim-strong`, not `--bg`.**~~ Closed 2026-09-21 by **D61**
   (audit finding S3): the divergence from `design/DESIGN.md` §4 is now recorded as
   `design/DEVIATIONS.md` **#54**, citing `home-desktop.html:95`, `home-mobile.html:77` and
   `results-desktop.html:86`. The code was always right per the authority chain; only the audit trail
   had a hole.
3. ~~**Two Tailwind v4 emission risks in `site-header.tsx`.**~~ Closed 2026-09-21 by **D61** (audit
   finding S4). Both were verified in the browser during the D56 audit. The `sm:gap-2.5` override no
   longer exists — the phone CTA ships the `compact` size's own gap — and the comment that still
   described it has been corrected. The inactive nav link keeps `text-on-photo/68`, which emits
   correctly.
