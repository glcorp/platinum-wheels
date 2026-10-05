/**
 * Database product → card product.
 *
 * `CatalogProduct` (`catalog-types.ts`) is what the database hands back;
 * `Product` (`types.ts`) is what the cards, the grid and the product page have
 * always rendered, measured against the artboards. This file is the one place
 * the first becomes the second, so no component had to change shape when the
 * catalogue moved out of the seed and into Postgres.
 *
 * Pure: no database, no React. Server and client safe.
 */

import type {
  AccessoryKind,
  CatalogProduct,
  TireSeason,
} from "./catalog-types";
import { stripBrandPrefix } from "@/lib/product-name";

import type { AccessoryType, Product, ProductBadge } from "./types";

/* --- Enum spelling ---------------------------------------------------------
   The database spells enum values with underscores (`all_season`); the URL
   and the UI have always used hyphens (`all-season`), and every measured
   `/tires` URL carries that spelling. The two differ by that one character
   and nothing else, so the conversion is mechanical. */

export function seasonParam(season: TireSeason): ProductBadge {
  return season.replace("_", "-") as ProductBadge;
}

export function seasonFromParam(value: string): TireSeason {
  return value.replace("-", "_") as TireSeason;
}

/** Every underscore: since D125 a type key can hold three
 *  (`cap_logos_inserts_hardware`). */
export function accessoryParam(kind: AccessoryKind): AccessoryType {
  return kind.replaceAll("_", "-") as AccessoryType;
}

export function accessoryFromParam(value: string): AccessoryKind {
  return value.replaceAll("-", "_") as AccessoryKind;
}

/* --- Size line ---------------------------------------------------------- */

/** `5x114.3` → `5×114.3` (U+00D7): ASCII in the database and the URL, the
 *  multiplication sign on screen. Only an `x` between two digits is a times
 *  sign: `12x1.5 Hex` is `12×1.5 Hex`, never `12×1.5 He×`. */
export function timesSign(value: string): string {
  return value.replace(/(\d)x(?=\d)/gi, "$1×");
}

/** A number as the trade writes it: `18`, `8.5`, never `8.50`. */
function plain(value: number): string {
  return String(value);
}

/** `+35`, `-12`, `0`. An offset is always read with its sign. */
export function signedOffset(value: number): string {
  return value > 0 ? `+${plain(value)}` : plain(value);
}

/** `ET+25`, `ET-12`, `ET0`: a wheel's offset as the trade writes it on a
 *  size line. */
export function etOffset(value: number): string {
  return `ET${signedOffset(value)}`;
}

/**
 * The vendors' `W/` shorthand read as the word: `Gloss Silver W/ Machined
 * Face` is `Gloss Silver with Machined Face`, `Milled W/Red Inner` is
 * `Milled with Red Inner` (launch audit D145, COPY; D151). Display only:
 * the database keeps the vendor's text (D125), and nothing filters or matches
 * on a finish string. `W/O` ("without") is left alone; no row carries it
 * today.
 */
export function expandWith(text: string): string {
  return text.replace(/\bW\/(?!O\b)\s*/gi, "with ");
}

function tireSizeLine(product: CatalogProduct & { category: "tires" }): string {
  const specs = product.specs;
  if (specs === null) return "";
  const loadSpeed = `${specs.loadIndex ?? ""}${specs.speedRating ?? ""}`;
  const tail = [loadSpeed, specs.isXl ? "XL" : ""].filter(Boolean).join(" ");
  return tail === "" ? specs.size : `${specs.size} · ${tail}`;
}

function wheelSizeLine(
  product: CatalogProduct & { category: "wheels" },
): string {
  const specs = product.specs;
  if (specs === null) return "";
  const size = `${plain(specs.diameter)}×${plain(specs.width)}`;
  const bolts = specs.boltPatterns.map(timesSign).join(" / ");
  const finish = expandWith(specs.finish?.trim() ?? "");
  /* D135: `20×9.5 · 5×130 · ET+25 · Gloss Black`. Offset and finish tell two
     wheels of one model and size apart; each is left out when the vendor gave
     none. */
  return [
    size,
    bolts,
    specs.offsetMm === null ? "" : etOffset(specs.offsetMm),
    finish,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Shown on an accessory that states nothing about itself, and as the spec
 *  table's `Type`. The chip labels in `categories.ts` are the same words.
 *  The vendors' own labels, verbatim (D125); key order is the enum's. */
export const ACCESSORY_LABEL: Readonly<Record<AccessoryType, string>> = {
  "center-caps": "Center Caps",
  "lug-nuts": "Lug Nuts",
  "cap-logos-inserts-hardware": "Cap Logos, Inserts & Hardware",
  "hub-rings": "Hub Rings",
  "lug-bolts": "Lug Bolts",
  "wheel-weights": "Wheel Weights",
  "wheel-covers-trim": "Wheel Covers & Trim",
  "wheel-spacers": "Wheel Spacers",
  "wheel-locks": "Wheel Locks",
  "tpms-sensors-tools": "TPMS Sensors & Tools",
  "tools-gauges-organizers": "Tools, Gauges & Organizers",
  "tire-studs": "Tire Studs",
  "valves-caps": "Valves & Caps",
  antennas: "Antennas",
  "tire-bags-storage": "Tire Bags & Storage",
};

function accessorySizeLine(
  product: CatalogProduct & { category: "accessories" },
): string {
  const specs = product.specs;
  if (specs === null) return "";
  const parts: string[] = [];
  if (specs.packQuantity !== null && specs.packQuantity > 1) {
    parts.push(`Set of ${specs.packQuantity}`);
  }
  if (specs.threadSize !== null) {
    parts.push(timesSign(specs.threadSize));
  } else if (specs.outerDiameterMm !== null && specs.innerDiameterMm !== null) {
    parts.push(
      `${plain(specs.outerDiameterMm)} to ${plain(specs.innerDiameterMm)} mm`,
    );
  }
  return parts.length > 0
    ? parts.join(" · ")
    : ACCESSORY_LABEL[accessoryParam(specs.accessoryType)];
}

/* --- The adapter -------------------------------------------------------- */

/**
 * The size line without any telling facts: what the product's own columns
 * print. The title key (`siblings.ts`) is built from this, so a product's
 * key never changes with the facts that were computed from it.
 */
export function baseSizeLine(product: CatalogProduct): string {
  switch (product.category) {
    case "tires":
      return tireSizeLine(product);
    case "wheels":
      return wheelSizeLine(product);
    case "accessories":
      return accessorySizeLine(product);
  }
}

/** The card's size line: the product's own, then ` · ` and each telling fact
 *  (`20×9.5 · 5×130 · ET+25 · Gloss Black · Centre bore 57.1 mm`). */
function cardSizeLine(product: CatalogProduct): string {
  const base = baseSizeLine(product);
  const facts = product.tellingFacts ?? [];
  return facts.length === 0 ? base : [base, ...facts].filter(Boolean).join(" · ");
}

export function toProduct(product: CatalogProduct): Product {
  const base = {
    category: product.category,
    slug: product.slug,
    image: product.image?.url,
    brand: product.brand,
    // A product with no model (most accessories) leads with its name. The
    // brand is shown on its own line above it, so a model that begins with the
    // brand drops that copy (D135).
    model: stripBrandPrefix(product.brand, product.model ?? product.name),
    // Zero is never a real price; the validator stores it as `null`, and this
    // keeps a row written some other way from reading `from $0`.
    price: product.price !== null && product.price > 0 ? product.price : null,
    currency: "CAD",
    // `discontinued` is the only "can't get it" state (D105b).
    available: product.status === "published",
  };

  switch (product.category) {
    case "tires": {
      const specs = product.specs;
      return {
        ...base,
        size: cardSizeLine(product),
        badges: specs?.season ? [seasonParam(specs.season)] : [],
        threePeakMountainSnowflake: specs?.winterApproved ?? false,
        studdable: specs?.studdable ?? false,
      };
    }
    case "wheels": {
      const specs = product.specs;
      return {
        ...base,
        size: cardSizeLine(product),
        // A wheel carries no badge and no 3PMSF (D59(4)).
        badges: [],
        threePeakMountainSnowflake: false,
        wheel:
          specs === null
            ? undefined
            : {
                diameter: plain(specs.diameter),
                width: plain(specs.width),
                bolt: specs.boltPatterns.join(" / "),
                offset:
                  specs.offsetMm === null ? "" : signedOffset(specs.offsetMm),
                finish:
                  specs.finish === null ? null : expandWith(specs.finish),
              },
      };
    }
    case "accessories":
      return {
        ...base,
        size: cardSizeLine(product),
        badges: [],
        threePeakMountainSnowflake: false,
        accessoryType:
          product.specs === null
            ? undefined
            : accessoryParam(product.specs.accessoryType),
      };
  }
}
