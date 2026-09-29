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
  `SiteNavDrawer` trigger (`md:hidden`). **D92:** the `<header>` carries `viewTransitionName:
  "site-header"`, so route transitions pin it instead of sliding it; inactive nav items carry the
  `nav-rule` hover (DEVIATIONS #76); the active item paints its lime underline as a `nav-indicator` span
  inside `<ViewTransition name="nav-indicator">` so it travels on a category change; the three nav links
  are `prefetch={true}` because the indicator only travels if the destination does not suspend into
  `loading.tsx`; the logo is typed `nav-back`. Shared by `/`, `/results` and `/products/[slug]`
  (unbuilt routes may still import it per D26/D39). 88px bar from `sm:` / 68px below.
- [`site-footer.tsx`](site-footer.tsx) — Server Component, named export `SiteFooter`, no props.
  120px logo badge, Shop/Company/Legal link columns (`ROUTES`), a computed `Winter <year>` link
  and bottom-bar `© <year> {SITE.legalName} Inc.` (D32). Social row omitted per D34.
- [`site-nav-drawer.tsx`](site-nav-drawer.tsx) — `"use client"`, named export `SiteNavDrawer`. Props:
  `{ links: ReadonlyArray<{ label: string; href: string; active: boolean }>; phone: { display: string;
  tel: string } }`. 44×44 hamburger trigger + a native `<dialog showModal()>` full-screen drawer
  (Esc, focus trap and return-focus are native); the four links plus the phone CTA, nothing else
  (D31). One of three client islands in this folder (with `hash-scroll.tsx` and `scroll-reveal.tsx`;
  `route-error.tsx` is a client *boundary*). The `<dialog>` carries **`overscroll-contain`**
  (**D65**, 2026-09-22): `overscroll-behavior` was declared nowhere in the build, so scrolling past
  either end of the open drawer chained to the page behind it. The filter sheet took the same fix
  through the `sheet-panel` utility (`src/app/llm.md` Rules). The `<nav>` closes on **`pb-safe`, not
  `pb-4`** (**D66**, 2026-09-22): the drawer is `inset-0 h-dvh`, so the bottom `tel:` CTA sat 16px off
  the viewport edge and fell under the home indicator on a notched phone. Base padding moves 16px →
  20px and needs **no `design/DEVIATIONS.md` row** — the drawer is undrawn, so its layout is the
  coordinator's call (D31).

- [`page-stub.tsx`](page-stub.tsx) — `PageStub`, props `{ title; active?; children? }`. Solid header +
  one `h1` + one line + footer, behind every planned-but-undesigned route (D26, D39). Replace each stub
  with its designed page. **Its only caller since 2026-09-22 is `src/app/not-found.tsx`** — `/about`,
  `/privacy` and `/terms` moved to `prose-page.tsx` below, and the `body` prop plus the `StubSection`
  helper D63 had added for them were removed with them rather than left unused. Do not re-add a `body`
  prop: a page with real content belongs in `ProsePage`.
- [`prose-page.tsx`](prose-page.tsx) — Server Components, the shell behind the three **written** pages
  `/about`, `/privacy` and `/terms`. Built 2026-09-22 (owner: *"not centered in desktop view, looks bland
  too — go full in and add details and style"*), then simplified the same day on the owner's follow-up
  that the result *"looks too much now, dont add On this page etc — just simple plain"*. Exports
  `ProsePage` (`{ eyebrow; title; lede; active?; meta?; children }`), `ProseSection`
  (`{ title; children; wide? }`), and two shared class constants, `PROSE_LINK` and `CAPTION`.
  **`SectionIndex` ("On this page") and the per-section `01`/`02` numeral are gone** — the owner named
  the index explicitly, and the numbering was scaffolding for it. Since nothing links to a section
  anymore, `ProseSection` also dropped its `id` prop and `scroll-mt-*` offset; only `/about`'s fact band
  still uses `meta` (`/privacy` and `/terms` no longer pass it).
  **No artboard draws any of these pages**, so there is no parity to hold and no drawn value to deviate
  from; every class is an existing token, role utility or idiom lifted from a page that *was* measured.
  Composition: a 12-column page header (eyebrow + `h1` on the left six, lede on the right five,
  `items-end` as `SectionHeading`'s own header row aligns), an optional full-width `meta` band, then
  plain **side-head** sections — `h2` in the left four columns, prose in the right eight capped at
  `max-w-hero-lede` (560px, `DESIGN.md` §3's text-column cap), each opening on a full-width
  `--border-strong` hairline. That hairline is what still holds the right half of the frame now the
  numbering is gone; before either pass, a 420px measure sat against the left edge of a 1344px
  container.
- [`page-transition.tsx`](page-transition.tsx) — Server Component, `PageTransition({ children })`: the
  page-level `<ViewTransition>` (**D92**). Typed links (`nav-forward`, `nav-back`) slide; untyped
  navigation and the `loading.tsx` → content handover crossfade (`route-in` / `route-out`);
  `default="none"` so same-route changes never animate the whole page. Every page shell wraps `<main>`
  **and** the footer in it — never the header, which is pinned by its own name — and it lives in pages,
  not a layout, because a layout persists and never enters or exits.
- [`scroll-reveal.tsx`](scroll-reveal.tsx) — `"use client"` leaf island rendering `null` (**D92**). Arms
  only `[data-reveal]` elements that are below the fold at mount (`data-reveal="pending"`), reveals each
  once via IntersectionObserver. Never arms under reduced motion or without IntersectionObserver, and
  its cleanup un-hides anything still pending. Rendered by `/` only.
- [`hash-scroll.tsx`](hash-scroll.tsx) — `"use client"` leaf island (D80). **D92:** a cold landing on a
  fragment stays instant; a `hashchange` scrolls smoothly unless reduced motion is on.
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
  wordmark**, one accent-bordered `Call <PRIMARY_CONTACT.display>` link, and **four** nav items (`Tires` active,
  `Wheels`, `Accessories`, `Contact` — `design/inventory/home.md:139`). No fifth `Services` item: there
  is no designed Services page, so it would be a dead link.
- **The nav bottom hairline is `1px --border`, not `--border-strong`** — DEVIATIONS #7, "What the
  artboards draw". `design/DESIGN.md` §4 says `--border-strong` and loses.
- **Contact data comes only from `src/lib/site.ts`.** "Contact data lives in `src/lib/site.ts` as named
  constants, never hardcoded in components" (`docs/decisions.md:129`). The header CTA and any call
  button use `PRIMARY_CONTACT`; the footer uses `CONTACTS` and `SITE`. **The phone CTA's label is
  therefore variable-width** — no file in this folder may pin it. The artboards drew a 195.02px pill on
  a 17-character label; since **D76** (2026-09-22) the number is `+1 (437) 882-5000` and the same pill
  measures **223.48px** (`design/DEVIATIONS.md` #66). It hugs its content, is `whitespace-nowrap` from
  the `accent` variant, and sits in a `justify-between` row that still has 335.9px of slack at the
  `md:` 1100px breakpoint, so nothing reflows — but a longer number would collide with the link row at
  roughly 764px, below which the row is already collapsed to the drawer. Do not give it a width.
  The mobile 44×44 circular call link is icon-only, `aria-label="Call now"`, and carries no number,
  so the mobile header is unaffected by any number change.
- **The footer ships no social links** — D34, "No social links yet"; the drawn three social squares are
  omitted until URLs exist. Precedent D7: no dead links.
- **The year is computed at render**, never hard-coded — D32. `© <year>` here, `Winter <year>` in the
  home promo. The artboards' `2026` is sample data (`design/DEVIATIONS.md`, "Sample data").
- **Links point at planned routes** — D26. `/results`, `/products/<slug>` and the stub routes are
  linkable before they exist; every `href` in the exports is `"#"` (`design/inventory/home.md:731`).
- **Header and footer stay Server Components.** Only leaf islands take `"use client"` (the drawer, and
  since D80/D92 `hash-scroll` and `scroll-reveal`, which render nothing)
  (`docs/decisions.md:73`). The drawer is the four nav links plus the phone CTA, full-screen, Esc
  closes, focus trapped, sized in `dvh` (D31); nothing else about it is drawn or specified.
- **The written pages state no fact that is not already in the repo.** Everything on `/about`,
  `/privacy` and `/terms` traces to `src/lib/site.ts`, to `docs/decisions.md`, or to behaviour the code
  actually has. No founding year, staff count, years-in-business, certification, testimonial or customer
  number — `docs/decisions.md` §8 forbids inventing exactly those, and they are what an About page
  usually pads itself with. The two legal pages are **drafts, not lawyer-reviewed**; their file headers
  say so. Restructuring their existing clauses is fine, **authoring a new obligation, warranty or
  liability term is not.**
- **No `Updated <date>` line on the legal pages.** D32 requires a computed date and forbids a typed one,
  and neither page has an honest source for one: `new Date()` would claim the policy changed today on
  every request. Owner owes either an effective date or a build-time hook to the commit.
- Tokens only; `next/image` with `sizes` and a reserved box for the badge; `next/link` for internal
  links (`docs/decisions.md` §4). Named exports, no barrel (`docs/decisions.md:69`).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | Every ruling that shapes this folder is global. | — |

**D92** (motion) governs `page-transition.tsx`, `scroll-reveal.tsx`, the header's pinned name and
indicator, and the press states on every link here (`active:opacity-70` for text links,
`active:translate-y-px` for boxed controls).

Governing global rows: **D7** / DEVIATIONS #11 (composition), **D26** (link planned routes),
**D31** (drawer), **D32** (computed year), **D34** (no social row), **D22** / DEVIATIONS #8 (one DOM at
all widths, hide rather than remove).

## Connects to
- **Depends on:** `src/lib/site.ts` (`SITE`, `CONTACTS`, `PRIMARY_CONTACT`) and `src/lib/routes.ts`;
  `src/components/ui/button.tsx` for the header CTA; `src/app/globals.css` tokens; `next/image`,
  `next/link`; `public/images/` for the badge PNG.
- **Depended on by:** `src/app/(storefront)/page.tsx:3-4` and `results/page.tsx:3-4`
  (`SiteHeader` + `SiteFooter`); `products/[slug]/`, `wheels/`, `accessories/`;
  `about/`, `privacy/`, `terms/` (`ProsePage`) and `src/app/not-found.tsx:2` (`PageStub`). Nothing
  under `src/features/` imports it — the boundary runs one way (`docs/decisions.md:65`).

## Don't
- **Don't build a text wordmark, a `GET A QUOTE` ghost button, or a `Services` nav item.** The spec asks
  for all three; the owner ruled for the artboards (D7, DEVIATIONS #11).
- **Don't hardcode a phone number, email or address.** `src/lib/site.ts` or nothing
  (`docs/decisions.md:129`).
- **Don't centre-align anything in `prose-page.tsx` to "fix" the empty right half.** The container is
  already centred (`lg:mx-auto lg:max-w-content`, the idiom `hero`/`contact`/`how-it-works` use); what
  fills the frame is the side-head grid and the full-width hairlines. Centre-aligned type would break
  `.claude/rules/ui.md` "Flush-left" and `DESIGN.md` §5 outright.
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
