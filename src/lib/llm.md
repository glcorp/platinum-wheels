# src/lib

## Purpose
Site constants, data and helpers that are not UI (`docs/decisions.md:66`). Today it is one file, and its
job is a single rule: contact details exist in exactly one place. "Contact data lives in `src/lib/site.ts`
as named constants, never hardcoded in components" (`docs/decisions.md:129`). Delete it and the header
CTA, the footer, the contact section and every `tel:`/`mailto:` link lose their source of truth — and
the next session guesses which of the two phone numbers is real.

## Owns
- [`cx.ts`](cx.ts) — `cx()` and `join()`, the build's two class-merge helpers (**D63**, audit finding
  S2). Consolidated from **13** local copies across `src/components/ui/` and four feature files. They
  stay two functions because they are not interchangeable: `cx` is variadic and filters falsy values,
  `join` is the two-argument base-then-override form. Neither deduplicates, sorts or normalises — every
  emitted class string must stay byte-identical, and the consolidation was verified by diffing the
  `class="…"` attributes of all six rendered pages before and after. Zero imports, which is what keeps
  `src/lib/` free of any feature dependency (D37).
- [`site.ts`](site.ts) — seven named exports. Four are sourced from `design/DESIGN.md` "Contact block
  (canonical)" (`site.ts:1-8`); two were added by D112, and one by D122:
  - `PRICES_VISIBLE` — `NEXT_PUBLIC_STOREFRONT_PRICES_ENABLED === "true"` (D122). Off for launch: no price
    anywhere, no price filter or sort, and the footer shows `SITE.placeNote` (`Brampton, Ontario`)
    instead of `priceNote`, since with no price there is no currency to declare. `NEXT_PUBLIC_` because
    `ProductCard` also renders in a client island; inlined at build, so a change needs a redeploy.
  - `SITE_URL` — `https://platinumwheels.ca`, the one canonical origin (apex, no `www`, no trailing
    slash). A constant, not an env var, so a preview still names the real site as canonical.
  - `CONTACT_HOURS` — `SITE.hours` as data (days, `09:00`, `20:00`) for structured data only. **Phone
    hours, not opening hours**: there is no shop (owner, 2026-09-30).
  - `SITE` — `name`, `legalName`, `tagline`, `city`, `province`, `email`, `hours`, `hoursLabel`, and
    `priceNote` (`Brampton, Ontario · Prices in CAD, before tax`, the footer line required by
    `docs/decisions.md` §7). **Load-bearing (D77):** prices render a bare `$` with no currency code,
    so this string is the only place the site states its currency — it may not be removed, shortened
    past `CAD`, or hidden at any width. `as const`.
  - `CONTACTS` — the two people, each `{ name, display, tel }`. `display` is the verbatim human-readable
    string and `tel` is E.164 for the `href`. **The two rows use two different display conventions**
    since **D76** (2026-09-22): `CONTACTS[0]` is the owner's `+1 (437) 882-5000` (country code,
    parentheses) and `CONTACTS[1]` is still the artboards' bare-dash `365-998-0990`. Recorded, not an
    oversight — `design/DEVIATIONS.md` #66.
  - `PRIMARY_CONTACT` — `CONTACTS[0]`, Inderpal Singh. The number used by the header CTA and the mobile
    call button (`site.ts:32-33`).
  - `BRANDS` — twelve wordmarks in a deliberate order: house brands first (`Zeta`, `ZMAX`, `Mazzini`,
    `Touren`, `Spec-1`), then the majors (`Michelin`, `Bridgestone`, `Continental`, `Pirelli`,
    `Goodyear`, `Hankook`, `Toyo`) — the order in `design/DESIGN.md` "Contact block" and in the artboard
    brand strip (`design/inventory/home.md:728`).

- [`time.ts`](time.ts) — `SHOP_TIME_ZONE` (`America/Toronto`), `SHOP_DATE_TIME`, `SHOP_WEEKDAY_DATE` and
  `shopHour()`. Every date and time the application shows or reasons about is Brampton time (D118); format
  through these, never with a zone typed at the call site. Zero imports.
- [`cart.ts`](cart.ts) — the browser cart (**D122**): one `localStorage` entry (`pw-cart`, versioned,
  every field re-checked on read), an in-memory fallback when storage is blocked, `useCartLines()` through
  `useSyncExternalStore` (`null` on the server), cross-tab sync via the `storage` event, `addToCart`
  (re-adding grows the quantity), `setCartQuantity`, `removeFromCart`, `clearCart`, `reconcileCart` (the
  catalogue's fresh facts; `null` removes a line), `onCartAdded` for the header prompt, and the invisible
  ceilings `CART_MAX_LINES` 200 / `CART_MAX_QUANTITY` 9,999 (D123). Imports no feature, which is why it
  lives here: the header reads it. `CartItem.brand` is `null` for an unbranded accessory (D125); a stored
  line with either a string or `null` there is accepted.
- [`product-name.ts`](product-name.ts) — `productName(brand, model)`: `Zeta Antarctica Sport`, or the bare
  name when an accessory has no brand (**D125**), never a leading space or a stand-in brand. The one join
  for card alt text, the PDP title, structured data, the cart, the owner alert and photo alt text. Zero
  imports, so `cart.ts` can use it.
- [`routes.ts`](routes.ts) — `ROUTES` (every internal href; `ROUTES.cart` since D122), `PRODUCT_PATH`, `productRoute()`. `quoteRoute()` and the PDP's `#quote` anchor went with D122. The
  one place a path literal lives (D39); components import from here, never write `/tires` themselves.
  **The tire category is `ROUTES.tires` = `/tires` since D112**; the old `ROUTES.results` key and the
  `/results` path are gone.

## Rules
- **Nothing contact-related is hardcoded in a component.** Phone, email, hours, address, legal name and
  the price note all come from here (`docs/decisions.md:129`).
- **The two phone numbers are two named people**, not a placeholder and a typo — Inderpal Singh and
  Harman Singh. The canonical contact block settles it (`docs/decisions.md:130-131`, `site.ts:4-7`),
  closing what was `design/DEVIATIONS.md` open item B. **D76** (2026-09-22) repointed Inderpal Singh's
  number to `+1 (437) 882-5000` on the owner's instruction *"change number to +1 (437) 882-5000
  everywhere"*; Harman Singh's `365-998-0990` was deliberately **not** changed, because the instruction
  gave one number and the two rows are two people. Whether the second row should also move, or be
  removed, is Open #3 below.
- **`BRANDS` renders as text wordmarks.** No logo files exist, and brand names stay text "unless the
  client supplies monochrome white logos **and** confirms they stock those brands"
  (`docs/decisions.md:127`, `HANDOFF.md` §7, `site.ts:35-39`).
- **`display` strings ship verbatim** — verbatim from whoever is authoritative for that row: the owner
  for `CONTACTS[0]` (D76), the artboards for `CONTACTS[1]`. Never renormalise one to match the other.
  The `tel` field is the only reformatting, it is E.164, and it is **never** built by concatenating or
  stripping the `display` string — every call site reads `contact.tel` directly.
- Every export is `as const` — these are constants, not state.
- No JSX, no React import, no component here: this folder is "site constants, data, helpers"
  (`docs/decisions.md:66`).
- Named exports, no barrel (`docs/decisions.md:69`).

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| D93b | 2026-09-30 | `CONTACTS[0].display` uses U+00A0 for its spaces and U+2060 after the hyphen so the number never wraps; `tel` stays E.164. Tests that match the displayed number strip U+2060. | The number broke across lines in narrow pills (WDG-15). | Owner ruling 2026-09-30; QA pass WDG-15; D93b |
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
  `src/features/finder/data.ts` (D27); the catalogue's was `src/features/catalog/data.ts` (D29), deleted
  by D108b.
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
3. **Which number is "primary", and what happens to the second.** `PRIMARY_CONTACT` picks `CONTACTS[0]`
   because the header CTA in the artboards reads `Call <primary>` (D7 / DEVIATIONS #11). Nobody has
   confirmed that Inderpal Singh should receive every header and mobile call tap (root `llm.md` §7.14).
   **Sharpened by D76:** the owner said "change number to +1 (437) 882-5000 **everywhere**", and only
   `CONTACTS[0]` was changed. `/` §04 Contact and `/about` therefore still list Harman Singh on
   `365-998-0990`. Three exits, none taken without the owner: (a) leave it — two people, two numbers,
   which is what the canonical contact block describes; (b) point both rows at the new number — then the
   two contact cards show one number twice, which reads as a bug; (c) drop `CONTACTS[1]` — then the
   contact grid goes from two cards to one and `design/reports/home.md` rows 58 and 102 change shape, not
   just width. Owner.
