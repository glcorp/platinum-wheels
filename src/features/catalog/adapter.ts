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

export function accessoryParam(kind: AccessoryKind): AccessoryType {
  return kind.replace("_", "-") as AccessoryType;
}

export function accessoryFromParam(value: string): AccessoryKind {
  return value.replace("-", "_") as AccessoryKind;
}

/* --- Size line ---------------------------------------------------------- */

/** `5x114.3` → `5×114.3` (U+00D7): ASCII in the database and the URL, the
 *  multiplication sign on screen. */
export function timesSign(value: string): string {
  return value.replace(/x/gi, "×");
}

/** A number as the trade writes it: `18`, `8.5`, never `8.50`. */
function plain(value: number): string {
  return String(value);
}

/** `+35`, `-12`, `0`. An offset is always read with its sign. */
export function signedOffset(value: number): string {
  return value > 0 ? `+${plain(value)}` : plain(value);
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
  return bolts === "" ? size : `${size} · ${bolts}`;
}

/** Shown on an accessory that states nothing about itself, and as the spec
 *  table's `Type`. The chip labels in `categories.ts` are the same words. */
export const ACCESSORY_LABEL: Readonly<Record<AccessoryType, string>> = {
  "lug-nuts": "Lug nuts",
  "wheel-locks": "Wheel locks",
  "hub-rings": "Hub rings",
  "centre-caps": "Centre caps",
  tpms: "TPMS sensors",
  spacers: "Wheel spacers",
  "wheel-weights": "Wheel weights",
  "hub-caps": "Hub caps",
  other: "Other",
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

export function toProduct(product: CatalogProduct): Product {
  const base = {
    category: product.category,
    slug: product.slug,
    image: product.image?.url,
    brand: product.brand,
    // A product with no model (most accessories) leads with its name.
    model: product.model ?? product.name,
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
        size: tireSizeLine(product),
        badges: specs?.season ? [seasonParam(specs.season)] : [],
        threePeakMountainSnowflake: specs?.winterApproved ?? false,
        studdable: specs?.studdable ?? false,
      };
    }
    case "wheels": {
      const specs = product.specs;
      return {
        ...base,
        size: wheelSizeLine(product),
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
                finish: specs.finish,
              },
      };
    }
    case "accessories":
      return {
        ...base,
        size: accessorySizeLine(product),
        badges: [],
        threePeakMountainSnowflake: false,
        accessoryType:
          product.specs === null
            ? undefined
            : accessoryParam(product.specs.accessoryType),
      };
  }
}
