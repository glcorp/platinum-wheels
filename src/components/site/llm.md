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
  `accent`/`compact`, D40, visible `sm:`), a 44×44 circular mobile call button, and the
  `SiteNavDrawer` trigger (`md:hidden`). Shared by `/`, `/results` and `/products/[slug]`
  (unbuilt routes may still import it per D26/D39). 88px bar from `sm:` / 68px below.
- [`site-footer.tsx`](site-footer.tsx) — Server Component, named export `SiteFooter`, no props.
  120px logo badge, Shop/Company/Legal link columns (`ROUTES`), a computed `Winter <year>` link
  and bottom-bar `© <year> {SITE.legalName} Inc.` (D32). Social row omitted per D34.
- [`site-nav-drawer.tsx`](site-nav-drawer.tsx) — `"use client"`, named export `SiteNavDrawer`. Props:
  `{ links: ReadonlyArray<{ label: string; href: string; active: boolean }>; phone: { display: string;
  tel: string } }`. 44×44 hamburger trigger + a native `<dialog showModal()>` full-screen drawer
  (Esc, focus trap and return-focus are native); the four links plus the phone CTA, nothing else
  (D31). The only client island in this folder.

- [`page-stub.tsx`](page-stub.tsx) — `PageStub`, props `{ title; active?; children? }`. Solid header + one `h1` + one line + footer, behind every planned-but-undesigned route (D26, D39). Replace each stub with its designed page.

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
2. **Solid-header background measures `--scrim-strong`, not `--bg`.** `results-desktop.html:86`
   (and `home-desktop.html:95` / `home-mobile.html:77` for `over-hero`) all declare
   `background:var(--scrim-strong)` — there is no second, `--bg`-background nav bar drawn anywhere
   in the export. This contradicts `design/DESIGN.md` §4 "Nav" ("on every other page it is `--bg`")
   and this folder's own former `Owns` note. `site-header.tsx` was built to the measured artboard
   value for both variants, per the authority chain (root `llm.md` §4, "artboards win on any
   number"). Needs a `design/DEVIATIONS.md` row from whoever owns that file — not added here
   (out of scope for this folder's agent).
3. **Two Tailwind v4 emission risks in `site-header.tsx`**, flagged for browser verification (this
   agent could not run `next dev`): the inactive nav link colour `text-on-photo/68` (an opacity
   modifier on a custom `--color-*` token, standing in for the artboard's untokenised
   `rgba(244,244,245,.68)` — `design/inventory/home.md:139`/`:393`), and the phone-CTA
   `className="sm:gap-2.5"` meant to override `ui/button.tsx`'s `compact` size `sm:gap-3` and hold
   the artboard's 10px icon gap.
