/**
 * Catalogue import: which CSV column feeds which product field.
 *
 * THIS IS THE FILE TO EDIT when the catalogue file's layout changes. Nothing
 * else in the import knows a column name.
 *
 * The layout it describes is the one in `docs/catalogue-csv.md`: one row per
 * product, the header row spelled like the product form's own field names
 * (`PRODUCT_FIELD`), so a column called `tire_size` needs no entry here. A
 * file that calls it `Size` needs one line under `columns`.
 *
 * Pure: no database, no Next.
 */

import { PRODUCT_FIELD } from "./product-input";

export interface ImportMapping {
  /**
   * CSV header → product field (a `PRODUCT_FIELD` value). Headers are compared
   * trimmed and without regard to case. A header that is not listed, and is
   * not a source or photo column below, is ignored and named in the report.
   */
  columns: Readonly<Record<string, string>>;
  /**
   * Per product field: the file's spelling → ours. Exact match, without regard
   * to case. A value that is in no table goes to the validator as it is, which
   * rejects the row if it is not one of ours. Nothing is guessed.
   */
  values: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /**
   * Where a product can be ordered from. A row carries up to `max` sources in
   * numbered columns; `{n}` is 1, 2, 3 …
   */
  sources: { vendor: string; sku: string; url: string; max: number };
  /**
   * Photo columns. Counted in the report and never loaded: the files are not
   * on a server yet. Uploading them is its own job, matched by vendor + SKU.
   */
  photos: readonly string[];
}

/** Set by the run, not by the file; sources have their own columns. */
const NOT_A_COLUMN: readonly string[] = [
  PRODUCT_FIELD.status,
  PRODUCT_FIELD.sourceVendor,
  PRODUCT_FIELD.sourceSku,
  PRODUCT_FIELD.sourceUrl,
];

/** Every product field under its own name. */
const OWN_NAMES: Record<string, string> = Object.fromEntries(
  Object.values(PRODUCT_FIELD)
    .filter((field) => !NOT_A_COLUMN.includes(field))
    .map((field) => [field, field]),
);

export const IMPORT_MAPPING: ImportMapping = {
  columns: {
    ...OWN_NAMES,
    // A file that names a column differently gets a line here, for example:
    // "Manufacturer": PRODUCT_FIELD.brand,
  },

  values: {
    [PRODUCT_FIELD.category]: {
      tire: "tires",
      wheel: "wheels",
      accessory: "accessories",
    },
    [PRODUCT_FIELD.season]: {
      "all season": "all_season",
      "all-season": "all_season",
      "all weather": "all_weather",
      "all-weather": "all_weather",
    },
    [PRODUCT_FIELD.accessoryType]: {
      "lug nuts": "lug_nuts",
      "wheel locks": "wheel_locks",
      "hub rings": "hub_rings",
      "centre caps": "centre_caps",
      "center caps": "centre_caps",
      spacers: "spacers",
      "wheel spacers": "spacers",
      "wheel weights": "wheel_weights",
      "hub caps": "hub_caps",
    },
  },

  sources: {
    vendor: "source_vendor_{n}",
    sku: "source_sku_{n}",
    url: "source_url_{n}",
    max: 10,
  },

  photos: ["image_1", "image_2", "image_3", "image_4", "image_5", "image_6"],
};
