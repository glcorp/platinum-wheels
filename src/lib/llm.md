# src/lib

## Purpose
Site constants, data and helpers that are not UI (`docs/decisions.md:66`). Today it is one file, and its
job is a single rule: contact details exist in exactly one place. "Contact data lives in `src/lib/site.ts`
as named constants, never hardcoded in components" (`docs/decisions.md:129`). Delete it and the header
CTA, the footer, the contact section and every `tel:`/`mailto:` link lose their source of truth — and
the next session guesses which of the two phone numbers is real.

## Owns
- [`site.ts`](site.ts) — four named exports, sourced from `design/DESIGN.md` "Contact block (canonical)"
  (`site.ts:1-8`):
  - `SITE` — `name`, `legalName`, `tagline`, `city`, `province`, `email`, `hours`, `hoursLabel`, and
    `priceNote` (`Brampton, Ontario · Prices in CAD, before tax`, the footer line required by
    `docs/decisions.md:114`). `as const`.
  - `CONTACTS` — the two people, each `{ name, display, tel }`. `display` is the artboards' formatting
    and ships verbatim; `tel` is E.164 for the `href` (`site.ts:23-30`).
  - `PRIMARY_CONTACT` — `CONTACTS[0]`, Inderpal Singh. The number used by the header CTA and the mobile
    call button (`site.ts:32-33`).
  - `BRANDS` — twelve wordmarks in a deliberate order: house brands first (`Zeta`, `ZMAX`, `Mazzini`,
    `Touren`, `Spec-1`), then the majors (`Michelin`, `Bridgestone`, `Continental`, `Pirelli`,
    `Goodyear`, `Hankook`, `Toyo`) — the order in `design/DESIGN.md` "Contact block" and in the artboard
    brand strip (`design/inventory/home.md:728`).

- [`routes.ts`](routes.ts) — `ROUTES` (every internal href), `PRODUCT_PATH`, `productRoute()`, `quoteRoute()`. The
  one place a path literal lives (D39); components import from here, never write `/results` themselves.

## Rules
- **Nothing contact-related is hardcoded in a component.** Phone, email, hours, address, legal name and
  the price note all come from here (`docs/decisions.md:129`).
- **The two phone numbers are two named people**, not a placeholder and a typo — Inderpal Singh
  647-989-6178 and Harman Singh 365-998-0990. The canonical contact block settles it
  (`docs/decisions.md:130-131`, `site.ts:4-7`), closing what was `design/DEVIATIONS.md` open item B.
- **`BRANDS` renders as text wordmarks.** No logo files exist, and brand names stay text "unless the
  client supplies monochrome white logos **and** confirms they stock those brands"
  (`docs/decisions.md:127`, `HANDOFF.md` §7, `site.ts:35-39`).
- **`display` strings ship verbatim**; the `tel` field is the only reformatting, and it is for the href.
- Every export is `as const` — these are constants, not state.
- No JSX, no React import, no component here: this folder is "site constants, data, helpers"
  (`docs/decisions.md:66`).
- Named exports, no barrel (`docs/decisions.md:69`).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | None folder-scoped. | The one ruling this folder encodes is `docs/decisions.md` §8. | — |

Referenced: **D39** (route map lives here; undesigned targets get `PageStub` pages), **D2** (`@/*` → `./src/*`, which is how `@/lib/site` resolves), **D32** (the year is computed
at render, so no `year` constant belongs here), **D22** (one DOM at all widths — no per-viewport copy
constants).

## Connects to
- **Depends on:** nothing. No imports at all (`site.ts` has none) — deliberately, so it can be read from
  a Server Component, a client island or a script without pulling anything in.
- **Depended on by:** `src/app/(storefront)/page.tsx:1` (`PRIMARY_CONTACT`, `SITE`) — currently the
  throwaway token smoke test (`HANDOFF.md` §4), to be replaced wholesale at `page home`. Will be
  depended on by `src/components/site/site-header.tsx` and `site-footer.tsx`, and by the home `contact`
  section (`design/manifest.md:51`).

## Don't
- **Don't write a phone number, email or address into a component.** Import from here
  (`docs/decisions.md:129`).
- **Don't reorder or prune `BRANDS` to "tidy" it.** The house-then-majors order is the artboard's
  (`design/inventory/home.md:728`).
- **Don't add logo image paths to `BRANDS`** until the client supplies monochrome white logos and
  confirms stock (`docs/decisions.md:127`).
- **Don't add a hard-coded year, a `Winter 2026` string, or `© 2026`.** Computed at render (D32);
  the artboards' `2026` is listed as sample data that must be replaced (`design/DEVIATIONS.md`).
- **Don't put the finder or catalog seed data here.** It belongs to its feature —
  `src/features/finder/data.ts` (D27) and `src/features/catalog/data.ts` (D29).
- **Don't add invented social proof** — ratings, review counts, testimonials, customer counts
  (`docs/decisions.md:125-126`).
- **Don't add social URLs.** None exist (D34).

## Open
1. **`BRANDS` is not authorised.** It "mixes house/budget brands with major manufacturers — stock
   authorisation needs confirming per brand" (`design/inventory/home.md:728`, §5.4 "Sample / placeholder
   data"), and `HANDOFF.md` §7 lists it as an open client blocker. **The client must confirm which
   brands the shop actually stocks** before the brand strip ships. Owner to obtain.
2. **Address and map.** `SITE` carries `city` and `province` but no street address, while
   `docs/decisions.md:101` specifies a static map image plus a "Get directions" link. The address is not
   in the canonical contact block. Owner or client.
3. **Which number is "primary".** `PRIMARY_CONTACT` picks `CONTACTS[0]` because the header CTA in the
   artboards reads `Call 647-989-6178` (D7 / DEVIATIONS #11). Nobody has confirmed that Inderpal Singh
   should receive every header and mobile call tap. Owner.
