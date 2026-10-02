/**
 * Every internal href in one place.
 *
 * No route is drawn anywhere — every `href` in all seven exports is `"#"`
 * (design/inventory/home.md:731). The shape below is this build's (D18), and
 * links point at planned routes before those routes exist (D26: "assume they
 * will exists, you can just link them"). Undesigned targets got minimal stub
 * pages so nothing 404s (D39). **`/wheels` and `/accessories` are no longer
 * stubs** — they are full results pages as of 2026-09-21 (D58), sharing the
 * `/tires` composition with a different category. **The tire category moved
 * from `/results` to `/tires` on 2026-09-30 (D112)**, before the storefront
 * was ever public on its own domain, so `/results` is a plain 404 and carries
 * no redirect. `/about`, `/privacy` and `/terms` are written pages. Anchors (`/#contact`, `/#how-it-works`) resolve to the
 * home sections of the same name (design/manifest.md §1 rows 6 and 9).
 *
 * Components import from here, never write a path literal. Changing a route
 * is a one-line edit.
 */

export const ROUTES = {
  home: "/",
  /** The designed results page. "Tires" in the nav and the finder submit here.
   *  It is the TIRES category of a three-category results engine (D58); the
   *  two siblings below are the same page with a different category. One key,
   *  not the old `results` + `tires` pair that both read `/results` (D112). */
  tires: "/tires",
  /** Results, category `wheels` (D58). */
  wheels: "/wheels",
  /** Results, category `accessories` (D58). */
  accessories: "/accessories",
  /** Footer "Winter <year>" and the promo's "Shop winter tires". */
  winter: "/tires?season=winter",
  contact: "/#contact",
  howItWorks: "/#how-it-works",
  about: "/about",
  privacy: "/privacy",
  terms: "/terms",
  styleguide: "/styleguide",
} as const;

/** `/products/<slug>`; the `#quote` anchor is the PDP's own quote band
 *  (design/inventory/product.md:121) — quote-first, no cart. */
export const PRODUCT_PATH = "/products";

export function productRoute(slug: string): string {
  return `${PRODUCT_PATH}/${slug}`;
}

export function quoteRoute(slug: string): string {
  return `${PRODUCT_PATH}/${slug}#quote`;
}
