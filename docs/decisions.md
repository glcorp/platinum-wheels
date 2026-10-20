# Platinum Wheels — Tech feasibility HLD

Authority level 1. When this document and the design disagree on **how** something is built, this wins.
When they disagree on **how it looks**, the design wins. Anything this forces the design to change is logged
in `design/DEVIATIONS.md`.

Status: written at `/design-to-code init`, 2026-09-20. Amend by editing here, not by exception in code.

---

## 1. Source-of-truth ruling

**Updated 2026-09-20, after the owner replaced `design/DESIGN.md` mid-`init`.**

The original spec described "Cinematic Dark" (`#000000` + racing red `#e10600`) while every artboard
exports "Track Night" (`#0B0B0D` + acid lime `#C9F23A`). That conflict was resolved by owner ruling in
favour of the artboards, and then dissolved outright: the replacement spec documents Track Night
directly. **Spec and artboards now agree on colour.** The superseded file is kept at
`design/DESIGN.superseded-cinematic-red.md` for audit. It was kept because this project had no git
history when the swap happened (D3); it stays kept under D55, because the initial commit of 2026-09-21
contains the post-swap tree only and no commit holds the original spec.

The residual rule, which still decides a dozen smaller cases:

**Where the spec and the artboards give different numbers for the same thing, the artboards win** —
they are the approved picture and the parity baseline. Where the artboards are silent, the spec governs.
Where the spec asks for an element the artboards do not contain, neither settles it: ask.

| Concern | Authority |
|---|---|
| Colour tokens, accent, badges | Spec §2 and the artboards — identical |
| Type roles, scale, tracking, case | DESIGN.md §3, cross-checked against artboard computed styles |
| The display scale ramp (`--scale-hero/h2/h3`) | DESIGN.md §3; ramp membership measured from the exports' `calc()` bindings |
| Layout, grid, splits, section rhythm, component measurements | Artboards, measured; DESIGN.md §5 where the artboards are silent |
| Breakpoint crossovers | **DESIGN.md §8 only** — the exports contain zero `@media` rules (see §5) |
| Motion | Both agree: instant hover fill, card `border-color`+`transform` 150ms `cubic-bezier(.2,0,0,1)`. **Amended 2026-09-29 by owner ruling D92b:** hover fills ease over 120ms, and route, reveal and result-change motion is added under the "Expressive" thesis; the card hover is unchanged. Tokens in `globals.css`, inventory in `design/reports/motion.md`, deviations #75–#78 |
| Copy | Artboards, verbatim |
| Focus / active / disabled | DESIGN.md §4 — the exports contain no such rule |
| Composition (flush-left, no shadows, no gradients but scrims, radius ≤4px, prices never accent) | DESIGN.md §2/§6/§7 |

### 1.1 The one-accent rule

The replacement spec softened it to: the accent appears once per frame, but "a card carrying a WINTER
badge gets a ghost button **when it sits beside another accent**; in an otherwise quiet grid the badge
and CTA are far enough apart to coexist — judge by the frame, not the component."

Under that wording the artboards' badge+CTA cards are **compliant**, so nothing is demoted and the
artboards ship as drawn. Judge by the frame. Do not mechanically demote a second accent.

## 2. Stack

- Next.js 16.4 App Router (currently `16.4.0-canary.37`), React 19.3, TypeScript strict, no `any`.
- Tailwind v4 via `@tailwindcss/turbopack`, configured entirely in `@theme` inside `src/app/globals.css`.
  No `tailwind.config.*` file.
- Package manager: **npm** (the repo has `package-lock.json`). The skill's `pnpm check` maps to
  `npm run check` here.
- Request-level middleware, if ever needed, goes in `proxy.ts` — not `middleware.ts`.
- This Next version diverges from training data; consult `node_modules/next/dist/docs/` before using an
  API rather than recalling it (see `AGENTS.md`).

## 3. Source layout

```
src/app/(storefront)/…   routes, thin — metadata, landmarks, composition only
src/features/<f>/components/   feature UI (finder, results, product, services)
src/components/site/     header, footer, mobile call bar
src/components/ui/       primitives only — no business logic
src/lib/                 site constants, data, helpers
```

Alias `@/*` → `./src/*`. Named exports only; no barrel `index.ts`.

## 4. Rendering

- Server Components by default. `"use client"` only on leaf islands (filter sheet, quantity stepper,
  gallery controls, mobile nav drawer, motion wrappers). **Never at page level** — a `'use client'` inside
  `src/app/` is a build failure by policy.
  **One exception, `src/app/(storefront)/error.tsx` (D62).** Next 16 requires an error boundary to carry
  the directive in the file itself and rejects a re-export from a module that carries it — verified by
  building both. The exception is scoped as narrowly as the framework allows: the file is the directive
  plus a one-line re-export and contains **no component code**, which lives at
  `src/components/site/route-error.tsx` with the other islands. `src/app/global-error.tsx`, added
  2026-09-30 on the owner's ruling (D93b), falls under the same exception: the directive, the `<html>`/`<body>`
  the framework requires it to own, and `RouteError` — no component code of its own. Nothing else under `src/app/` may carry the directive, and the
  slop grep should treat any other occurrence as the failure it was always meant to catch.
- All SEO-relevant content is server-rendered.
- **One canonical origin**, `SITE_URL` in `src/lib/site.ts`: `https://platinumwheels.ca`, no `www`. Every
  canonical URL is the clean path; a search, filter or quantity URL never makes a second address (D112).
- **Search engines are blocked until launch** behind `SEARCH_INDEXING_ENABLED`, on only at exactly `true`
  (D112). The rules, and what structured data may never carry, are in `src/features/seo/llm.md`.
- `next/image` only, always with `sizes` and a reserved aspect box; the hero carries `priority`.
- `next/link` for every internal link.
- One `<h1>` per page; `header`/`nav`/`main`/`footer` landmarks present.

## 5. Mobile-first

- Build at 390px (the mobile artboard width), verify at 375px, then scale up.
- **Breakpoints come from DESIGN.md §8 — 400 / 720 / 1100 / 1320 — and nowhere else.** The seven exports
  contain zero `@media` rules; they are fixed snapshots at 1440 and 390, so the crossover widths are not
  derivable from them. All three extraction agents independently flagged this rather than inventing
  numbers. Mapped to Tailwind: `xs:` 400, `sm:` 720, `md:` 1100, `lg:` 1320.
- Inputs ≥16px font. `inputmode` and `autocomplete` set. Tap targets ≥44px.
  `touch-action: manipulation`. `dvh`/`svh`, never `100vh`.
- Year / Make / Model use **native `<select>`** styled to match the design, never a custom combobox.
- Tap-to-call uses `tel:` and, where a bar is fixed to the viewport bottom, respects
  `env(safe-area-inset-bottom)`. Note the PDP does **not** get a sticky buy bar — see DEVIATIONS #8's
  resolution: the replacement spec dropped it and the artboard never had one.
- Hover is enhancement only; nothing depends on it. `prefers-reduced-motion` honoured. No parallax on mobile.

## 6. Third-party

- No third-party scripts except Vercel Analytics.
- Fonts are self-hosted through `next/font` (`display: 'swap'`, `adjustFontFallback`). The artboards'
  `fonts.googleapis.com` `<link>` is an export artefact and is **not** ported.
- A map is a static image plus a "Get directions" link. Never an embed script.

## 7. Business rules baked into the UI

- **Quote-first.** No checkout and no "Buy now", ever: nothing is paid on the storefront. **Amended
  2026-10-01 by D122:** a product's CTA is "Add to cart", which puts it in a browser-only cart, and the
  cart's "Request a quote" sends one request for every product in it; "Call us" stays beside both. The
  cart shows no price and takes no payment. (Spec §9 and the artboards said "there is NO cart"; the owner
  and the client changed that after launch planning, `design/DEVIATIONS.md` #96.) Never show stock
  counts, shipping, ratings or invented specs.
- **Prices can be switched off** (D122): `NEXT_PUBLIC_STOREFRONT_PRICES_ENABLED`, on only at exactly
  `true`. Off, no price renders anywhere and nothing filters or sorts by one. The rules below apply
  whenever prices show.
- Price format: every price is prefixed `from`, the amount is Barlow 700 tabular in `--text`, never
  accent-coloured, with a full-size `$` and no cents, and **no currency code**. The **suffix is per
  context**, verbatim from the artboards: cards read `from $129 / tire`, the PDP buy panel reads
  `from $129` above `per tire · before tax` (U+00B7, spaced). Both carry the same meaning; the PDP adds
  the tax qualifier the footer repeats. `Price` takes a number and formats it itself, so a
  pre-formatted string can never reintroduce superscript cents or a shrunken `$`.
  Footer states "Across Canada · Prices in CAD, before tax" (D190; was "Brampton, Ontario · Prices in CAD, before tax") — since the amounts no longer name a
  currency, **that line is the only place the site states one, and is load-bearing**: it may not be
  removed, shortened past the currency, or hidden at any width without a new ruling.
  *(Amended 2026-09-22, D77. Until then this line specified the drawn strings `from $129 CAD / tire` and
  `from $129 CAD`, and `Price` "takes a number plus a currency code". The owner ruled: "change cad to
  just $ everywhere — we anyways have mentioned in the footer that it is cad". Both artboards draw the
  ` CAD` suffix, so this is a level-1 rule and a level-2 drawn value changing together, deliberately and
  in the same edit rather than letting code and rule disagree — the D67 precedent. The rest of the
  format is untouched: full-size `$`, no cents, Barlow 700, tabular, `--text`, never accent-coloured,
  always prefixed `from`, and the per-context suffixes stay exactly as D21 pinned them. The currency
  survives as **data** on `Product.currency`, which nothing renders; `design/DEVIATIONS.md` #64 carries
  the drawn-vs-shipped row.)*
- Fitment trust line on **product pages**. *(Amended 2026-09-22, D67. This line read "on results and
  product pages" until then, and **D47(2) had already removed it from `/results`** on the grounds that no
  results artboard draws one — which let authority level 2 overrule level 1 on a business rule. The owner
  settled it by ratifying D47(2) and correcting this line to match what ships, rather than by restoring
  the trust line. **What that does not settle:** the PDP quote band still promises "We check the fitment
  against your vehicle" while the quote form collects no vehicle at all, so the promise outruns the form.
  That stays open — root `llm.md` §7.23(a).)*
- Unavailable product = dimmed card, "Currently unavailable" badge, "Inquire about restock" CTA.
  The page still returns HTTP 200.
- A CASL consent checkbox renders **unticked**. *Amended 2026-09-30 (D93b, owner: "Restore their own tick"):* a fresh form always renders it unticked;
  after a **failed** submit it re-renders the visitor's **own** choice, the same as every other field. Restoring
  a tick the visitor made is not pre-ticking, and silently clearing it after a typo lost a consent they gave.

## 8. Content and legal

- The artboard hero hotlinks a Ferrari F40 photo from `vossenwheels.com`. It does not ship. Replaced with
  licensed stock (Unsplash/Pexels) matching DESIGN.md's art direction, no legible tyre-brand logos,
  exported webp, hero ≤150KB at 375px.
- No invented social proof: no ratings, review counts, testimonials or customer-count claims unless the
  client confirms them.
- The home brand strip shows real brand logos in one muted colour, as a moving ticker, for brands the
  loaded catalogue carries (amended 2026-10-03 by D129: owner, *"we have permission to add brand logos"*).
  Elsewhere (`/about`) brand names stay text wordmarks.
- Contact data lives in `src/lib/site.ts` as named constants, never hardcoded in components. **Amended
  2026-10-11 (D161):** the site shows one phone number, `+1 (437) 882-5000`, and the email
  `sales@platinumwheels.ca`, and **no person's name or personal number anywhere** (client: *"No personal
  contact or names throughout the website"*). The spec's canonical contact block named two people with two
  numbers; that block is superseded here and `design/DESIGN.md` is left frozen.
- Sample personal data in the exports (`Priya Sandhu`, `priya.s@…`, `(905) 000-0000`) is form placeholder
  content and must not ship. See the bottom of `design/DEVIATIONS.md`.

## 9. Quality gates (per page, before it is called done)

- `npm run check` (tsc + eslint incl. jsx-a11y) clean.
- Parity measured, not eyeballed: `design/reports/<page>.md` holds the computed-style table at 390 and 1440.
  Thresholds in the skill §5.
- `web-design-guidelines` zero open findings; slop grep zero hits.
- Lighthouse mobile: LCP ≤2500ms, CLS ≤0.05, Performance ≥90, Accessibility ≥95.
- Keyboard walk-through: visible focus ring, logical order, overlays trap focus and close on Esc.
- Reduced-motion on: no animation.

## 10. Explicitly out of scope

- ~~Visual-regression screenshot tests and axe in CI. The parity report is the evidence.~~ *(Brought into
  scope 2026-09-29, D91b. The owner's QA brief asked for "toHaveScreenshot baselines of rest states at 390
  and 1440" and "axe on every route × state", so both now run in the committed Playwright suite
  (`tests/`, `npm run test:e2e`). The parity reports stay the evidence for measured values; the
  screenshots catch drift between measurements. There is still no CI: the suite runs locally.)*
- Per-section commits. The repository was initialised on 2026-09-21 (D55) with the whole tree as one
  commit, so `/`, `/results` and `/products/[slug]` have no per-section history and nothing before that
  date is recoverable. Rollback safety for the built pages still comes from the parity reports and the
  untouched `design/` sources; from here on, commits carry it forward.
