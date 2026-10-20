/**
 * Canonical site constants.
 *
 * Source: design/DESIGN.md "Contact block (canonical)", narrowed by D161 to
 * one phone number and no personal names. Nothing here is hardcoded in a
 * component.
 */

/**
 * The one canonical origin: apex, https, no `www`, no trailing slash (owner,
 * 2026-09-30, D112). `metadataBase`, every canonical URL, the sitemap and the
 * structured data are built from it and from nothing else. It is a constant
 * and not an env var on purpose: a preview or the `*.vercel.app` alias must
 * still name the real site as canonical, never itself.
 */
export const SITE_URL = "https://platinumwheels.ca";

export const SITE = {
  name: "Platinum Wheels",
  legalName: "Platinum Wheels and Tire Solutions Inc.",
  tagline: "Wheels, tires & accessories across Canada",
  city: "Brampton",
  province: "ON",
  /** Who the shop sells to. D163 (2026-10-11) had "the GTA and surrounding
   *  areas"; the client then said "across Canada" (2026-10-21, D190), which
   *  replaces it. Read in running text after "serving". The address stays the
   *  city (`city`, `province`). */
  serviceArea: "customers across Canada",
  email: "sales@platinumwheels.ca",
  hours: "Every day, 9 am to 8 pm",
  hoursLabel: "Phone & inquiry hours",
  /**
   * Prices are per tire, before tax and install (DESIGN.md §3 Numerals).
   * **Load-bearing since D77 (2026-09-22):** prices render a bare `$` with no
   * currency code, so this is the only place the site states its currency.
   * Do not remove it, shorten it past `CAD`, or hide it at any width
   * (`docs/decisions.md` §7).
   */
  priceNote: "Across Canada · Prices in CAD, before tax",
  /** The footer line while prices are switched off (D122): with no price on
   *  the site there is no currency to declare. */
  placeNote: "Across Canada",
} as const;

/**
 * Whether the storefront shows prices at all (D122). Off for launch, by the
 * client's ruling: the vendor sheets mix retail, dealer and with-shipping
 * figures, so no single rule turns them into a customer price. Off hides every
 * price on the site: cards, the product page, the price filter, the price sorts
 * and the footer's currency line. The cart never shows a price either way.
 *
 * On only at exactly `true` (the D104 / D112 pattern). `NEXT_PUBLIC_` because
 * `ProductCard` also renders inside the home carousel's client island, and a
 * server-only variable reads `undefined` there, which would split the server
 * and client renders. The value is inlined at build time, so turning prices
 * on or off takes a redeploy.
 */
export const PRICES_VISIBLE = process.env.NEXT_PUBLIC_STOREFRONT_PRICES_ENABLED === "true";

/**
 * The two starting prices on the home hero (D134). Owner, 2026-10-03: "since
 * now we are not displaying the prices on the front page, we just want to show
 * this … Tires starting from $79.99 ea / Wheels starting from $249.99 ea".
 *
 * These are the owner's marketing lines, NOT catalogue prices: they ship
 * whatever `PRICES_VISIBLE` says (D122(6) and D124 govern catalogue prices
 * only), and they keep the owner's cents and `ea`, which the catalogue price
 * format (`docs/decisions.md` §7: `from`, no cents) does not apply to. The
 * words are split only so the hero can set them in different weights; read in
 * order, `${label} ${lead} ${amount} ${unit}` is the owner's line verbatim.
 * `category` is a `ROUTES` key: the hero builds the link from it, so this file
 * keeps no imports. Change a price here and nowhere else.
 */
export const STARTING_PRICES = [
  {
    category: "tires",
    label: "Tires",
    lead: "starting from",
    amount: "$79.99",
    unit: "ea",
  },
  {
    category: "wheels",
    label: "Wheels",
    lead: "starting from",
    amount: "$249.99",
    unit: "ea",
  },
] as const;

/**
 * `SITE.hours` as data, for structured data only (D112). These are the hours
 * the owners answer the phone, **not opening hours**: there is no shop to walk
 * into (owner, 2026-09-30), so nothing may publish them as `openingHours`.
 * `SITE.hours` stays the string people read; change both together.
 */
export const CONTACT_HOURS = {
  days: [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ],
  opens: "09:00",
  closes: "20:00",
} as const;

/**
 * The shop's one phone number. `tel` is E.164 for the href; `display` is the
 * human-readable string.
 *
 * One number and no names (D161). Client, 2026-10-11: "Remove names from
 * contact, just leave one number there- ending in 5000" and "No personal
 * contact or names throughout the website". Owner: keep the email and
 * +1 (437) 882-5000, with the +1, everywhere. Until then this file held two
 * named people (D76, D139); the second number is gone from the site.
 *
 * `display` is the owner's exact format (D76): country code and parentheses,
 * NOT renormalised to the artboards' dash convention (`design/DEVIATIONS.md`
 * #66). WDG-15 (owner ruling 2026-09-30): its spaces are U+00A0 and the hyphen
 * is followed by U+2060 WORD JOINER, so the number is one unbreakable unit in
 * running text and never wraps mid-number. Both code points draw nothing
 * extra; written as escapes so the source stays readable. Plain-text output
 * (the quote emails) strips them.
 *
 * Used by the header CTA, the mobile call button and every "Call us" on the
 * site. Keep the shape: other files read only `display` and `tel`.
 */
export const PRIMARY_CONTACT = {
  display: "+1\u00a0(437)\u00a0882-\u20605000",
  tel: "+14378825000",
} as const;

/**
 * The brands the /about page shows (D182; owner, 2026-10-11: "add more brnads
 * and their logo like on the main ticker"). 24, so the grid's rows are full
 * at 4, 6 and 8 across (D183). House brands first, then tires, then wheels; within
 * each, the order is the owner's pick. Chosen from the loaded catalogue by
 * product count (tires and wheels), with the house brands and the well-known
 * tire makers kept; Hankook (38 products) was dropped by the owner.
 *
 * Each name is matched to a logo by `brandLogo()` in
 * `src/features/home/brand-logos.ts`; a brand with no clean vector logo
 * shows as a text wordmark. Spelled as that file spells it where a logo
 * exists. The home ticker has its own list and does not read this one.
 */
export const BRANDS = [
  "Zeta",
  "ZMAX",
  "Mazzini",
  "Touren",
  "Spec-1",
  "Michelin",
  "Bridgestone",
  "Continental",
  "Pirelli",
  "Goodyear",
  "Toyo Tires",
  "Yokohama",
  "Nexen",
  "Nitto",
  "Sentali",
  "Fuel Off-Road",
  "Braelin",
  "Fast Wheels",
  "KMC",
  "GT Off-Road",
  "Black Rhino",
  "American Racing",
  "Rotiform",
  "Niche",
] as const;
