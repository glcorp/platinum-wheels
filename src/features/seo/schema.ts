/* ---------------------------------------------------------------------------
   Structured data: what the site tells a search engine about itself (D112)

   Plain objects, built here and rendered by `JsonLd`. Every value comes from
   `src/lib/site.ts`, `src/lib/routes.ts` or the caller. Nothing is typed twice.

   Owner rulings, 2026-09-30, and what each one removes:
   - **No physical shop.** The business is a Brampton-based online store, so
     the type is `OnlineStore`, never `LocalBusiness`, `Store` or
     `AutoPartsStore`. There is **no street address**, no postal code, no
     `geo`, no `hasMap`, and **no `openingHours` or
     `openingHoursSpecification` on the organisation**. The `address` it does
     carry is the city, province and country only (owner, 2026-09-30, choosing
     "City-only address"): where the business is based, not a place to visit.
   - **9 am to 8 pm is when the owners answer the phone.** It appears once, as
     `hoursAvailable` on each `ContactPoint`: contact hours, not opening hours.
   - **The GTA.** `areaServed` is the Greater Toronto Area (D163, client
     2026-10-11: "serving the GTA and surrounding areas"), replacing D112(3)'s
     Brampton only. The address stays the city.
   - **One phone number, no names** (D161): one `ContactPoint`, the shop's
     number. No person is named anywhere in the markup.
   - **No prices go to Google.** A `Product` carries name, brand, size, category
     and image. It has **no `offers`, no price, no currency and no
     availability**. Google's product rich result needs one of `offers`,
     `review` or `aggregateRating`, so this markup describes the product without
     qualifying for that result; that is the accepted cost of the ruling, and
     `todo.md` carries the follow-up. Ratings and reviews are never invented
     (`docs/decisions.md` §8).
   --------------------------------------------------------------------------- */

import { ACCESSORY_LABEL } from "@/features/catalog/adapter";
import {
  productCategory,
  productImageSrc,
  type Product,
  type ProductCategory,
} from "@/features/catalog/types";
import { productName } from "@/lib/product-name";
import { ROUTES, productRoute } from "@/lib/routes";
import { CONTACT_HOURS, PRIMARY_CONTACT, SITE, SITE_URL } from "@/lib/site";

export type JsonLdNode = Readonly<Record<string, unknown>>;

/** A path from the site root, or an absolute URL, as an absolute URL on the
 *  canonical origin. The home page is the bare origin, with no slash. */
export function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl === "/") return SITE_URL;
  return new URL(pathOrUrl, SITE_URL).toString();
}

const CONTEXT = "https://schema.org";

/** Stable node ids, so the website and a product can point at the
 *  organisation without repeating it. */
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

/** The white-plate logo: Google shows a logo on white, where the transparent
 *  cut-out the UI uses would lose its edge. */
const LOGO_PATH = "/images/logo/platinum-wheels-logo.webp";

/** What each category is called in a breadcrumb and a `Product.category`: the
 *  nav's own words (`site-header.tsx`), which the visible crumbs also use
 *  since D112. */
export const CATEGORY_NAME: Readonly<Record<ProductCategory, string>> = {
  tires: "Tires",
  wheels: "Wheels",
  accessories: "Accessories",
};

const CATEGORY_ROUTE: Readonly<Record<ProductCategory, string>> = {
  tires: ROUTES.tires,
  wheels: ROUTES.wheels,
  accessories: ROUTES.accessories,
};

export function organizationSchema(): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "OnlineStore",
    "@id": ORGANIZATION_ID,
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE_URL,
    logo: absoluteUrl(LOGO_PATH),
    email: SITE.email,
    telephone: PRIMARY_CONTACT.tel,
    address: {
      "@type": "PostalAddress",
      addressLocality: SITE.city,
      addressRegion: SITE.province,
      addressCountry: "CA",
    },
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Greater Toronto Area",
      sameAs: "https://en.wikipedia.org/wiki/Greater_Toronto_Area",
    },
    /* One number and no name (D161): a search engine needs the line, not a
       person. Still a list, as schema.org writes it. */
    contactPoint: [PRIMARY_CONTACT].map((contact) => ({
      "@type": "ContactPoint",
      contactType: "sales",
      telephone: contact.tel,
      email: SITE.email,
      availableLanguage: "en",
      hoursAvailable: {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: CONTACT_HOURS.days,
        opens: CONTACT_HOURS.opens,
        closes: CONTACT_HOURS.closes,
      },
    })),
  };
}

export function websiteSchema(): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: SITE.name,
    /* The longer name people also search for, so Google can offer either as
       the site name. */
    alternateName: SITE.legalName,
    inLanguage: "en-CA",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export interface Crumb {
  name: string;
  /** A path from the site root. */
  path: string;
}

/** `Home`, then whatever the page passes, in order. */
export function breadcrumbSchema(trail: readonly Crumb[]): JsonLdNode {
  const items: readonly Crumb[] = [{ name: "Home", path: ROUTES.home }, ...trail];
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/** `Home / Tires`. */
export function categoryBreadcrumb(category: ProductCategory): JsonLdNode {
  return breadcrumbSchema([
    { name: CATEGORY_NAME[category], path: CATEGORY_ROUTE[category] },
  ]);
}

export interface ProductSeo {
  slug: string;
  category: ProductCategory;
  /** `null` on an unbranded accessory (D125): the markup then carries no
   *  `brand` at all, never an empty or invented one. */
  brand: string | null;
  /** Brand and model, as the page's heading reads: the breadcrumb's leaf. An
   *  unbranded accessory's is its name alone. */
  name: string;
  /**
   * `name` plus what tells this product from its siblings: a tire's or a
   * wheel's size line, an accessory's pack and thread. The `<title>`, the
   * description's subject and the `Product` name, so two sizes of one model
   * are two distinct results.
   */
  title: string;
  /** A tire's size code or a wheel's diameter and width. `""` when the
   *  product has none: an accessory, or a wheel with no spec row. */
  size: string;
  /** One plain phrase for what it is, from its own facts: `Winter tire`,
   *  `Wheel`, `Lug nuts`. The description's second sentence. */
  kind: string;
  /** The photo: a path from the site root or an absolute URL. `null` = none. */
  image: string | null;
}

/** The season a tire's first badge names, as a description reads it. */
const TIRE_KIND: Readonly<Partial<Record<Product["badges"][number], string>>> = {
  winter: "Winter tire",
  "all-season": "All-season tire",
  "all-weather": "All-weather tire",
  summer: "Summer tire",
};

/**
 * The card-shaped product the page already holds, as the fields above.
 *
 * `sizeLine` is the page's own size string with everything it states
 * (`ProductView.sizeLine`): `215/55R16 97T XL` on a tire, `18×8.5 · 5×114.3 · ET+35 · Gloss Black`
 * on a wheel, `Set of 20 · 12×1.5` on an accessory, and after those, only
 * when other products share the name and size, what tells this one apart
 * (`Centre bore 72.6 mm`, `Part number GT14156LB`; `catalog/siblings.ts`,
 * launch audit D145). The title takes all of it, because no two products may
 * share a title. Its ` · ` separators become
 * commas, because the root title template already uses ` · ` before the site
 * name. An accessory that states nothing falls back to its type's label
 * (`Lug nuts`) on the page; that is a category, not a detail, so it is
 * dropped from the title and used as `kind` instead, and so is any part the
 * accessory's name already prints.
 *
 * `sizeCode` is the bare size (`ProductView.sizeCode`, `215/55R16`), which is
 * what the markup's `size` carries for a tire.
 */
export function toProductSeo(
  product: Product,
  { sizeCode, sizeLine }: { sizeCode: string; sizeLine: string },
): ProductSeo {
  const category = productCategory(product);
  const name = productName(product.brand, product.model);
  const typeLabel =
    product.accessoryType === undefined
      ? undefined
      : ACCESSORY_LABEL[product.accessoryType];
  /* One part per ` · `. An accessory drops its type label (a category, not a
     detail; it is `kind` below) and any part its own name already prints:
     `GT Hardware Lug Nuts 14x1.5` is not followed by `14×1.5` again (launch
     audit D145, DATA-ACC). `×` and `x` count as the same letter there. */
  const plainName = name.toLowerCase().replaceAll("×", "x");
  const detail = sizeLine
    .split(" · ")
    .filter(
      (part) =>
        part !== "" &&
        part !== typeLabel &&
        !(
          category === "accessories" &&
          plainName.includes(part.toLowerCase().replaceAll("×", "x"))
        ),
    )
    .join(", ");

  let title = name;
  if (detail !== "") {
    title = category === "accessories" ? `${name}, ${detail}` : `${name} ${detail}`;
  }

  let size = "";
  /* An accessory's type (`Lug nuts`), unless its own name already says it
     (`Acorn lug nuts`, `TPMS sensor`): then the plain category, so the
     description does not repeat itself. */
  const typeStem = typeLabel?.toLowerCase().replace(/s$/, "");
  let kind =
    typeLabel !== undefined &&
    typeStem !== undefined &&
    !name.toLowerCase().includes(typeStem)
      ? typeLabel
      : "Wheel accessory";
  if (category === "tires") {
    size = sizeCode;
    kind = product.badges.map((badge) => TIRE_KIND[badge]).find(Boolean) ?? "Tire";
  }
  if (category === "wheels") {
    if (product.wheel) size = `${product.wheel.diameter}×${product.wheel.width}`;
    /* The finish is in the title now (the size line ends `ET+25, Gloss
       Black`, D135), so the description's kind no longer repeats it. */
    kind = "Wheel";
  }

  return {
    slug: product.slug,
    category,
    brand: product.brand || null,
    name,
    title,
    size,
    kind,
    image: productImageSrc(product),
  };
}

/** `Home / Tires / Zeta Antarctica Sport`. */
export function productBreadcrumb(product: ProductSeo): JsonLdNode {
  return breadcrumbSchema([
    {
      name: CATEGORY_NAME[product.category],
      path: CATEGORY_ROUTE[product.category],
    },
    { name: product.name, path: productRoute(product.slug) },
  ]);
}

/** Name, brand, size, category and image. No offer, by ruling: see the header.
 *  No `brand` on an unbranded accessory (D125). */
export function productSchema(product: ProductSeo): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "Product",
    name: product.title,
    ...(product.brand === null
      ? {}
      : { brand: { "@type": "Brand", name: product.brand } }),
    ...(product.size === "" ? {} : { size: product.size }),
    category: CATEGORY_NAME[product.category],
    ...(product.image === null ? {} : { image: absoluteUrl(product.image) }),
    url: absoluteUrl(productRoute(product.slug)),
  };
}
