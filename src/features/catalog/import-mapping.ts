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
  sources: {
    vendor: string;
    sku: string;
    url: string;
    /** The vendor's own price (D125): staff only, never the display price. */
    price: string;
    max: number;
  };
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
  PRODUCT_FIELD.sourcePrice,
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
    // `row_id` and `merged_row_ids` are the merged sheet's own bookkeeping
    // (D125): unlisted, so they are read by nothing and named as ignored.
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
    // The vendors' fifteen types, spelled as the merged sheet spells them
    // (D125). Exact match only: a sixteenth label is refused, not guessed.
    [PRODUCT_FIELD.accessoryType]: {
      "Center Caps": "center_caps",
      "Lug Nuts": "lug_nuts",
      "Cap Logos, Inserts & Hardware": "cap_logos_inserts_hardware",
      "Hub Rings": "hub_rings",
      "Lug Bolts": "lug_bolts",
      "Wheel Weights": "wheel_weights",
      "Wheel Covers & Trim": "wheel_covers_trim",
      "Wheel Spacers": "wheel_spacers",
      "Wheel Locks": "wheel_locks",
      "TPMS Sensors & Tools": "tpms_sensors_tools",
      "Tools, Gauges & Organizers": "tools_gauges_organizers",
      "Tire Studs": "tire_studs",
      "Valves & Caps": "valves_caps",
      Antennas: "antennas",
      "Tire Bags & Storage": "tire_bags_storage",
    },
  },

  sources: {
    vendor: "source_vendor_{n}",
    sku: "source_sku_{n}",
    url: "source_url_{n}",
    price: "source_price_{n}",
    max: 20,
  },

  photos: ["image_1", "image_2", "image_3", "image_4", "image_5", "image_6"],
};
