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
  /** Prices are per tire, before tax and install (DESIGN.md §3 Numerals). */
  priceNote: "Brampton, Ontario · Prices in CAD, before tax",
} as const;

/**
 * Two named contacts, both canonical. `tel` is E.164 for the href; `display` is
 * the artboards' formatting, which ships verbatim.
 */
export const CONTACTS = [
  { name: "Inderpal Singh", display: "647-989-6178", tel: "+16479896178" },
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
