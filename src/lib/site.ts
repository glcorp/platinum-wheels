/**
 * Canonical site constants.
 *
 * Source: design/DESIGN.md "Contact block (canonical)". Nothing here is
 * hardcoded in a component — DEVIATIONS.md open item B (which of the two phone
 * numbers was canonical) is closed by that block: they are two named people,
 * not a placeholder and a typo.
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
  tagline: "Wheels, tires & accessories in Brampton, ON",
  city: "Brampton",
  province: "ON",
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
  priceNote: "Brampton, Ontario · Prices in CAD, before tax",
  /** The footer line while prices are switched off (D122): with no price on
   *  the site there is no currency to declare. */
  placeNote: "Brampton, Ontario",
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
 * Two named contacts, both canonical. `tel` is E.164 for the href; `display` is
 * the human-readable string.
 *
 * Both rows use the owner's format, country code and parentheses: `CONTACTS[0]`
 * since D76, `CONTACTS[1]` since D139 (owner, 2026-10-04: "add +1 to harman's
 * number"), which retires the two-format inconsistency DEVIATIONS #66 recorded.
 */
export const CONTACTS = [
  /* Owner instruction 2026-09-22 (D76): "change number to +1 (437) 882-5000
     everywhere". The `display` string is the owner's exact format — country
     code and parentheses — and is NOT renormalised to the dash convention the
     artboards drew, or to the one `CONTACTS[1]` still uses. It is therefore no
     longer the artboard's formatting for this row (`design/DEVIATIONS.md` #66).
     `tel` stays E.164 and is the only reformatting. */
  /* WDG-15 (owner ruling 2026-09-30): the spaces in `display` are U+00A0 and
     the hyphen is followed by U+2060 WORD JOINER, so the number is one
     unbreakable unit wherever it is set in running text ("Call …", the quote
     success sentence) and never wraps mid-number. Every glyph is identical to
     the owner's verbatim D76 string; the two extra code points draw nothing
     (NBSP is a space, WJ is zero-width) and only the line-break class differs.
     Written as escapes so the source stays readable. `tel` is untouched. */
  {
    name: "Inderpal Singh",
    display: "+1\u00a0(437)\u00a0882-\u20605000",
    tel: "+14378825000",
  },
  /* D139: same format and the same WDG-15 no-break code points as above. */
  {
    name: "Harman Singh",
    display: "+1\u00a0(365)\u00a0998-\u20600990",
    tel: "+13659980990",
  },
] as const;

/** The number used by the header CTA and the mobile call button. */
export const PRIMARY_CONTACT = CONTACTS[0];

/**
 * Brands carried in the mockups (DESIGN.md contact block). House brands first,
 * then the majors. Rendered as text wordmarks — no logo files exist, and
 * DESIGN.md §5 allows logos only if supplied as monochrome white.
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
  "Hankook",
  "Toyo",
] as const;
