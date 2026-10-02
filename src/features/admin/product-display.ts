/**
 * Pure helpers the product admin's screens share: a product's one-line spec
 * summary, the staff-facing labels for the enum values, and a saved product
 * turned back into the form's posted field values (D116).
 *
 * No database, no Next: a `"use client"` form imports this.
 */

import { ACCESSORY_LABEL, accessoryParam } from "@/features/catalog/adapter";
import type {
  AccessoryKind,
  AdminProduct,
  CatalogProduct,
  TireSeason,
} from "@/features/catalog/catalog-types";
import { PRODUCT_FIELD } from "@/features/catalog/product-input";

export const SEASON_LABEL: Readonly<Record<TireSeason, string>> = {
  summer: "Summer",
  all_season: "All-season",
  all_weather: "All-weather",
  winter: "Winter",
};

export function accessoryKindLabel(kind: AccessoryKind): string {
  return ACCESSORY_LABEL[accessoryParam(kind)];
}

export const CATEGORY_LABEL = {
  tires: "Tire",
  wheels: "Wheel",
  accessories: "Accessory",
} as const;

export const CATEGORY_PLURAL = {
  tires: "Tires",
  wheels: "Wheels",
  accessories: "Accessories",
} as const;

/** Numbers as staff typed them: `17`, `7.5`, never `17.00`. */
function plain(value: number): string {
  return String(Number(value));
}

/** `225/45R17 · Winter`, `18x8.5 · 5x114.3`, `Lug nuts · M12x1.5`. */
export function productSpecLine(product: CatalogProduct): string {
  const parts: string[] = [];
  switch (product.category) {
    case "tires": {
      const specs = product.specs;
      if (specs) {
        parts.push(specs.size);
        if (specs.season) parts.push(SEASON_LABEL[specs.season]);
      }
      break;
    }
    case "wheels": {
      const specs = product.specs;
      if (specs) {
        parts.push(`${plain(specs.diameter)}x${plain(specs.width)}`);
        if (specs.boltPatterns.length > 0) parts.push(specs.boltPatterns.join(", "));
      }
      break;
    }
    case "accessories": {
      const specs = product.specs;
      if (specs) {
        parts.push(accessoryKindLabel(specs.accessoryType));
        if (specs.threadSize) parts.push(specs.threadSize);
      }
      break;
    }
  }
  return parts.join(" · ");
}

/** `$129.99`, or `null` when the product has no price. */
export function displayPrice(price: number | null): string | null {
  if (price === null) return null;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    currencyDisplay: "narrowSymbol",
  }).format(price);
}

type Values = Record<string, string[]>;

function put(values: Values, field: string, value: string | number | null | undefined): void {
  if (value === null || value === undefined || value === "") return;
  values[field] = [typeof value === "number" ? plain(value) : value];
}

function flag(values: Values, field: string, on: boolean): void {
  if (on) values[field] = ["on"];
}

function triState(values: Values, field: string, value: boolean | null): void {
  if (value !== null) values[field] = [value ? "yes" : "no"];
}

/**
 * A saved product as the form's field values, keyed by posted field name:
 * the same shape `ProductFormState.values` echoes back after a rejected save,
 * so the form fills itself the same way from either.
 */
export function productFormValues(product: AdminProduct): Values {
  const f = PRODUCT_FIELD;
  const values: Values = {};
  put(values, f.category, product.category);
  put(values, f.brand, product.brand);
  put(values, f.model, product.model);
  put(values, f.name, product.name);
  put(values, f.description, product.description);
  if (product.price !== null) values[f.price] = [product.price.toFixed(2)];
  put(values, f.gtin, product.gtin);

  if (product.sources.length > 0) {
    values[f.sourceVendor] = product.sources.map((source) => source.vendor);
    values[f.sourceSku] = product.sources.map((source) => source.vendorSku);
    values[f.sourceUrl] = product.sources.map((source) => source.vendorUrl ?? "");
  }

  switch (product.category) {
    case "tires": {
      const specs = product.specs;
      if (!specs) break;
      put(values, f.tireSize, specs.size);
      put(values, f.serviceType, specs.serviceType);
      put(values, f.loadIndex, specs.loadIndex);
      put(values, f.speedRating, specs.speedRating);
      put(values, f.loadRange, specs.loadRange);
      put(values, f.plyRating, specs.plyRating);
      put(values, f.season, specs.season);
      put(values, f.utqg, specs.utqg);
      flag(values, f.isXl, specs.isXl);
      flag(values, f.winterApproved, specs.winterApproved);
      flag(values, f.studdable, specs.studdable);
      flag(values, f.runFlat, specs.runFlat);
      break;
    }
    case "wheels": {
      const specs = product.specs;
      if (!specs) break;
      put(values, f.wheelDiameter, specs.diameter);
      put(values, f.wheelWidth, specs.width);
      put(values, f.boltPatterns, specs.boltPatterns.join(", "));
      put(values, f.offsetMm, specs.offsetMm);
      put(values, f.centerBoreMm, specs.centerBoreMm);
      put(values, f.backspacing, specs.backspacing);
      put(values, f.wheelFinish, specs.finish);
      put(values, f.material, specs.material);
      put(values, f.wheelSeatType, specs.seatType);
      put(values, f.loadRatingLbs, specs.loadRatingLbs);
      triState(values, f.tpmsCompatible, specs.tpmsCompatible);
      triState(values, f.winterCompatible, specs.winterCompatible);
      break;
    }
    case "accessories": {
      const specs = product.specs;
      if (!specs) break;
      put(values, f.accessoryType, specs.accessoryType);
      put(values, f.threadSize, specs.threadSize);
      put(values, f.accessorySeatType, specs.seatType);
      put(values, f.accessoryFinish, specs.finish);
      put(values, f.packQuantity, specs.packQuantity);
      put(values, f.outerDiameterMm, specs.outerDiameterMm);
      put(values, f.innerDiameterMm, specs.innerDiameterMm);
      break;
    }
  }
  return values;
}
