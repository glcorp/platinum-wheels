/**
 * Canonical site constants.
 *
 * Source: design/DESIGN.md "Contact block (canonical)". Nothing here is
 * hardcoded in a component — DEVIATIONS.md open item B (which of the two phone
 * numbers was canonical) is closed by that block: they are two named people,
 * not a placeholder and a typo.
 */

export const SITE = {
  name: "Platinum Wheels",
  legalName: "Platinum Wheels and Tire Solutions",
  tagline: "Wheels, tires & accessories in Brampton, ON",
  city: "Brampton",
  province: "ON",
  email: "sales@platinumwheels.ca",
  hours: "Every day: 9 am – 8 pm",
  hoursLabel: "Phone & inquiry hours",
  /**
   * Prices are per tire, before tax and install (DESIGN.md §3 Numerals).
   * **Load-bearing since D77 (2026-09-22):** prices render a bare `$` with no
   * currency code, so this is the only place the site states its currency.
   * Do not remove it, shorten it past `CAD`, or hide it at any width
   * (`docs/decisions.md` §7).
   */
  priceNote: "Brampton, Ontario · Prices in CAD, before tax",
} as const;

/**
 * Two named contacts, both canonical. `tel` is E.164 for the href; `display` is
 * the human-readable string.
 *
 * The two rows now use two different display conventions: `CONTACTS[0]` carries
 * the owner's `+1 (437) 882-5000` (D76, verbatim per the instruction) and
 * `CONTACTS[1]` still carries the artboards' bare-dash `365-998-0990`. That is
 * a recorded inconsistency, not an oversight — see `design/DEVIATIONS.md` #66.
 */
export const CONTACTS = [
  /* Owner instruction 2026-09-22 (D76): "change number to +1 (437) 882-5000
     everywhere". The `display` string is the owner's exact format — country
     code and parentheses — and is NOT renormalised to the dash convention the
     artboards drew, or to the one `CONTACTS[1]` still uses. It is therefore no
     longer the artboard's formatting for this row (`design/DEVIATIONS.md` #66).
     `tel` stays E.164 and is the only reformatting. */
  { name: "Inderpal Singh", display: "+1 (437) 882-5000", tel: "+14378825000" },
  { name: "Harman Singh", display: "365-998-0990", tel: "+13659980990" },
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
