/**
 * Product input: the field names a product form posts, and the one validator
 * that turns those strings into a `ProductInput` the store will write.
 *
 * Pure: no database, no Next. The admin actions feed it a `FormData`; anything
 * else that writes products (an import, a test) can feed it a plain object
 * through `readerFromRecord()`. One validator means a product is checked the
 * same way however it arrives.
 *
 * Everything is validated as TEXT first. A size is parsed into its columns
 * here (`size.ts`), so staff type `225/45R17` once and never fill in width,
 * profile and rim by hand.
 *
 * Error copy follows `.claude/rules/ui.md` "Copy": short, sentence case, no em
 * dashes, says what to do.
 */

import {
  ACCESSORY_KINDS,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  TIRE_SEASONS,
  type AccessorySpecsInput,
  type ProductCategory,
  type ProductInput,
  type ProductSource,
  type ProductStatus,
  type TireSpecsInput,
  type WheelSpecsInput,
} from "./catalog-types";
import {
  normalizeThreadSize,
  parseBoltPatterns,
  parseTireSizeSpec,
} from "./size";

export const PRODUCT_FIELD = {
  category: "category",
  brand: "brand",
  model: "model",
  name: "name",
  description: "description",
  price: "price",
  status: "status",
  gtin: "gtin",

  // Tires
  tireSize: "tire_size",
  serviceType: "service_type",
  loadIndex: "load_index",
  speedRating: "speed_rating",
  loadRange: "load_range",
  plyRating: "ply_rating",
  isXl: "is_xl",
  season: "season",
  winterApproved: "winter_approved",
  studdable: "studdable",
  runFlat: "run_flat",
  utqg: "utqg",

  // Wheels
  wheelDiameter: "wheel_diameter",
  wheelWidth: "wheel_width",
  boltPatterns: "bolt_patterns",
  offsetMm: "offset_mm",
  centerBoreMm: "center_bore_mm",
  backspacing: "backspacing",
  wheelFinish: "wheel_finish",
  material: "material",
  wheelSeatType: "wheel_seat_type",
  loadRatingLbs: "load_rating_lbs",
  tpmsCompatible: "tpms_compatible",
  winterCompatible: "winter_compatible",

  // Accessories
  accessoryType: "accessory_type",
  threadSize: "thread_size",
  accessorySeatType: "accessory_seat_type",
  accessoryFinish: "accessory_finish",
  packQuantity: "pack_quantity",
  outerDiameterMm: "outer_diameter_mm",
  innerDiameterMm: "inner_diameter_mm",

  // Vendor sources: each name may repeat, one set per source, read by index.
  sourceVendor: "source_vendor",
  sourceSku: "source_sku",
  sourceUrl: "source_url",
} as const;

export type ProductFieldKey = keyof typeof PRODUCT_FIELD;
export type ProductFieldErrors = Partial<Record<ProductFieldKey, string>>;

/** `brand` and `name` mirror CHECKs in `src/db/catalog-schema.ts`: the
 *  database makes them true, these make the error friendly. The rest are
 *  generous guards that exist only here. */
export const PRODUCT_LIMITS = {
  brand: 80,
  model: 120,
  name: 200,
  description: 5000,
  shortText: 60,
  url: 500,
  price: 99_999_999.99,
  sources: 10,
} as const;

export interface FieldReader {
  /** Trimmed value, or `""` when absent. */
  get(name: string): string;
  /** Every value posted under a repeated name, trimmed, in order. */
  getAll(name: string): string[];
}

/** Trims, and drops NUL: Postgres `text` refuses it, and nobody types one. */
function clean(value: string): string {
  return value.replace(/\u0000/g, "").trim();
}

export function readerFromFormData(formData: FormData): FieldReader {
  const text = (value: FormDataEntryValue | null) =>
    typeof value === "string" ? clean(value) : "";
  return {
    get: (name) => text(formData.get(name)),
    getAll: (name) => formData.getAll(name).map(text),
  };
}

export function readerFromRecord(
  record: Readonly<Record<string, string | readonly string[] | undefined>>,
): FieldReader {
  const all = (name: string): string[] => {
    const value = record[name];
    if (value === undefined) return [];
    return (typeof value === "string" ? [value] : [...value]).map(clean);
  };
  return { get: (name) => all(name)[0] ?? "", getAll: all };
}

export type ParseProductResult =
  | { ok: true; input: ProductInput }
  | { ok: false; errors: ProductFieldErrors };

/* --- Field parsers ------------------------------------------------------- */

/** An optional sign, because an offset is written `+35` as often as `35`. */
const DECIMAL = /^[+-]?\d{1,8}(\.\d+)?$/;
const INTEGER = /^\d{1,6}$/;
/** `1129.50` or `1,129.50`. A comma anywhere else is refused rather than
 *  stripped: `129,99` must not become 12999. */
const PRICE = /^(\d{1,8}|\d{1,3}(,\d{3}){1,2})(\.\d{1,2})?$/;
const TRUE_VALUES = new Set(["on", "true", "1", "yes"]);
const FALSE_VALUES = new Set(["off", "false", "0", "no"]);

function isOneOf<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return (values as readonly string[]).includes(value);
}

class Fields {
  readonly errors: ProductFieldErrors = {};

  constructor(private readonly reader: FieldReader) {}

  raw(key: ProductFieldKey): string {
    return this.reader.get(PRODUCT_FIELD[key]);
  }

  all(key: ProductFieldKey): string[] {
    return this.reader.getAll(PRODUCT_FIELD[key]);
  }

  fail(key: ProductFieldKey, message: string): void {
    // First error per field wins; later checks would only contradict it.
    this.errors[key] ??= message;
  }

  text(key: ProductFieldKey, label: string, max: number): string | null {
    const value = this.raw(key);
    if (value === "") return null;
    if (value.length > max) {
      this.fail(key, `Keep the ${label} under ${max} characters.`);
      return null;
    }
    return value;
  }

  required(key: ProductFieldKey, label: string, max: number): string {
    const value = this.text(key, label, max);
    if (value === null && this.errors[key] === undefined) {
      this.fail(key, `Enter the ${label}.`);
    }
    return value ?? "";
  }

  /** `scale` is the column's: more decimals than it holds would be rounded
   *  on the way in, so they are refused instead. */
  decimal(
    key: ProductFieldKey,
    label: string,
    range: { min: number; max: number; scale: number },
  ): number | null {
    const value = this.raw(key);
    if (value === "") return null;
    const decimals = value.split(".")[1]?.length ?? 0;
    if (DECIMAL.test(value) && decimals > range.scale) {
      this.fail(
        key,
        `Use at most ${range.scale} decimal ${range.scale === 1 ? "place" : "places"} for the ${label}.`,
      );
      return null;
    }
    const parsed = DECIMAL.test(value) ? Number(value) : Number.NaN;
    if (Number.isNaN(parsed) || parsed < range.min || parsed > range.max) {
      this.fail(
        key,
        `Enter the ${label} as a number from ${range.min} to ${range.max}.`,
      );
      return null;
    }
    return parsed;
  }

  integer(
    key: ProductFieldKey,
    label: string,
    range: { min: number; max: number },
  ): number | null {
    const value = this.raw(key);
    if (value === "") return null;
    const parsed = INTEGER.test(value) ? Number(value) : Number.NaN;
    if (Number.isNaN(parsed) || parsed < range.min || parsed > range.max) {
      this.fail(
        key,
        `Enter the ${label} as a whole number from ${range.min} to ${range.max}.`,
      );
      return null;
    }
    return parsed;
  }

  /** A checkbox: ticked or not. Reads the LAST value posted, so the common
   *  hidden-`off`-then-checkbox pair works as well as a lone checkbox. */
  flag(key: ProductFieldKey): boolean {
    return TRUE_VALUES.has((this.all(key).at(-1) ?? "").toLowerCase());
  }

  /** Yes, no, or not stated. */
  triState(key: ProductFieldKey, label: string): boolean | null {
    const value = this.raw(key).toLowerCase();
    if (value === "") return null;
    if (TRUE_VALUES.has(value)) return true;
    if (FALSE_VALUES.has(value)) return false;
    this.fail(key, `Choose yes or no for ${label}, or leave it blank.`);
    return null;
  }
}

/* --- Sections ------------------------------------------------------------ */

function parsePrice(fields: Fields): number | null {
  const raw = fields.raw("price");
  if (raw === "") return null;
  const cleaned = raw.replace(/[$\s]/g, "");
  if (!PRICE.test(cleaned)) {
    fields.fail("price", "Enter a price like 129.99, or leave it blank.");
    return null;
  }
  // A price of zero is a vendor's blank, not a price: stored as "no price",
  // so the storefront reads `Inquire for price` instead of `from $0`.
  const price = Number(cleaned.replace(/,/g, ""));
  return price === 0 ? null : price;
}

function parseSources(fields: Fields): ProductSource[] {
  const vendors = fields.all("sourceVendor");
  const skus = fields.all("sourceSku");
  const urls = fields.all("sourceUrl");
  const rows = Math.max(vendors.length, skus.length, urls.length);

  const sources: ProductSource[] = [];
  for (let index = 0; index < rows; index += 1) {
    const vendor = vendors[index] ?? "";
    const vendorSku = skus[index] ?? "";
    const url = urls[index] ?? "";
    // An untouched blank row in the form is not a source.
    if (vendor === "" && vendorSku === "" && url === "") continue;

    const short = PRODUCT_LIMITS.shortText;
    if (vendor === "") {
      fields.fail("sourceVendor", "Enter a vendor name for each source.");
    } else if (vendor.length > short) {
      fields.fail("sourceVendor", `Keep each vendor name under ${short} characters.`);
    }
    if (vendorSku === "") {
      fields.fail("sourceSku", "Enter the vendor's SKU for each source.");
    } else if (vendorSku.length > short) {
      fields.fail("sourceSku", `Keep each vendor SKU under ${short} characters.`);
    }
    if (
      url !== "" &&
      (!/^https?:\/\/\S+$/i.test(url) || url.length > PRODUCT_LIMITS.url)
    ) {
      fields.fail("sourceUrl", "Enter a full link starting with https://.");
    }
    if (
      sources.some(
        (source) => source.vendor === vendor && source.vendorSku === vendorSku,
      )
    ) {
      fields.fail("sourceSku", "The same vendor and SKU is listed twice.");
    }
    sources.push({ vendor, vendorSku, vendorUrl: url === "" ? null : url });
  }

  if (sources.length > PRODUCT_LIMITS.sources) {
    fields.fail(
      "sourceVendor",
      `List at most ${PRODUCT_LIMITS.sources} sources.`,
    );
  }
  return sources;
}

function parseTireSpecs(fields: Fields): TireSpecsInput | null {
  const short = PRODUCT_LIMITS.shortText;
  const rawSize = fields.raw("tireSize");
  const size = rawSize === "" ? null : parseTireSizeSpec(rawSize);
  if (rawSize === "") {
    fields.fail("tireSize", "Enter the tire size.");
  } else if (size === null) {
    fields.fail("tireSize", "Enter a size like 225/45R17 or 35x12.50R20.");
  }

  const rawSeason = fields.raw("season");
  const season =
    rawSeason !== "" && isOneOf(TIRE_SEASONS, rawSeason) ? rawSeason : null;
  if (rawSeason !== "" && season === null) {
    fields.fail("season", "Choose a season from the list.");
  }

  const serviceType = fields.text("serviceType", "service type", 4);
  const rest = {
    loadIndex: fields.text("loadIndex", "load index", short),
    speedRating: fields.text("speedRating", "speed rating", short),
    loadRange: fields.text("loadRange", "load range", short),
    plyRating: fields.integer("plyRating", "ply rating", { min: 2, max: 30 }),
    isXl: fields.flag("isXl"),
    season,
    winterApproved: fields.flag("winterApproved"),
    studdable: fields.flag("studdable"),
    runFlat: fields.flag("runFlat"),
    utqg: fields.text("utqg", "UTQG", short),
  };
  if (size === null) return null;

  return {
    sizeFormat: size.sizeFormat,
    size: size.size,
    width: size.width,
    aspectRatio: size.aspectRatio,
    rimDiameter: size.rimDiameter,
    overallDiameter: size.overallDiameter,
    sectionWidth: size.sectionWidth,
    // What staff typed wins; otherwise the size's own `LT` / `P` / `C`.
    serviceType: serviceType?.toUpperCase() ?? size.serviceType,
    ...rest,
  };
}

function parseWheelSpecs(fields: Fields): WheelSpecsInput | null {
  const short = PRODUCT_LIMITS.shortText;
  const diameter = fields.decimal("wheelDiameter", "diameter", {
    min: 10,
    max: 40,
    scale: 2,
  });
  if (fields.raw("wheelDiameter") === "") {
    fields.fail("wheelDiameter", "Enter the wheel diameter in inches.");
  }
  const width = fields.decimal("wheelWidth", "width", {
    min: 3,
    max: 20,
    scale: 2,
  });
  if (fields.raw("wheelWidth") === "") {
    fields.fail("wheelWidth", "Enter the wheel width in inches.");
  }

  const boltPatterns = parseBoltPatterns(fields.raw("boltPatterns"));
  if (boltPatterns === null) {
    fields.fail(
      "boltPatterns",
      "Enter bolt patterns like 5x114.3, separated by commas.",
    );
  }

  const rest = {
    // Dually wheels run far outside a car's range: -227 is a real offset.
    offsetMm: fields.decimal("offsetMm", "offset", {
      min: -300,
      max: 300,
      scale: 1,
    }),
    centerBoreMm: fields.decimal("centerBoreMm", "centre bore", {
      min: 1,
      max: 300,
      scale: 2,
    }),
    backspacing: fields.decimal("backspacing", "backspacing", {
      min: -20,
      max: 20,
      scale: 3,
    }),
    finish: fields.text("wheelFinish", "finish", 120),
    material: fields.text("material", "material", short),
    seatType: fields.text("wheelSeatType", "seat type", short),
    loadRatingLbs: fields.integer("loadRatingLbs", "load rating", {
      min: 1,
      max: 20_000,
    }),
    tpmsCompatible: fields.triState("tpmsCompatible", "TPMS"),
    winterCompatible: fields.triState("winterCompatible", "winter use"),
  };
  if (diameter === null || width === null || boltPatterns === null) return null;

  return { diameter, width, boltPatterns, ...rest };
}

function parseAccessorySpecs(fields: Fields): AccessorySpecsInput | null {
  const short = PRODUCT_LIMITS.shortText;
  const rawType = fields.raw("accessoryType");
  const accessoryType = isOneOf(ACCESSORY_KINDS, rawType) ? rawType : null;
  if (accessoryType === null) {
    fields.fail("accessoryType", "Choose the accessory type.");
  }

  const threadSize = fields.text("threadSize", "thread size", short);
  const rest = {
    threadSize: threadSize === null ? null : normalizeThreadSize(threadSize),
    seatType: fields.text("accessorySeatType", "seat type", short),
    finish: fields.text("accessoryFinish", "finish", 120),
    packQuantity: fields.integer("packQuantity", "pack quantity", {
      min: 1,
      max: 10_000,
    }),
    outerDiameterMm: fields.decimal("outerDiameterMm", "outer diameter", {
      min: 1,
      max: 1000,
      scale: 2,
    }),
    innerDiameterMm: fields.decimal("innerDiameterMm", "inner diameter", {
      min: 1,
      max: 1000,
      scale: 2,
    }),
  };
  if (accessoryType === null) return null;

  return { accessoryType, ...rest };
}

/* --- Entry point --------------------------------------------------------- */

export function parseProductInput(reader: FieldReader): ParseProductResult {
  const fields = new Fields(reader);

  const rawCategory = fields.raw("category");
  const category: ProductCategory | null = isOneOf(
    PRODUCT_CATEGORIES,
    rawCategory,
  )
    ? rawCategory
    : null;
  if (category === null) fields.fail("category", "Choose a category.");

  // Blank = not stated, and the store decides what that means: a create
  // starts `hidden`, an update leaves the status as it is.
  const rawStatus = fields.raw("status");
  const status: ProductStatus | null = isOneOf(PRODUCT_STATUSES, rawStatus)
    ? rawStatus
    : null;
  if (rawStatus !== "" && status === null) {
    fields.fail("status", "Choose a status from the list.");
  }

  const base = {
    brand: fields.required("brand", "brand", PRODUCT_LIMITS.brand),
    model: fields.text("model", "model", PRODUCT_LIMITS.model),
    name: fields.required("name", "product name", PRODUCT_LIMITS.name),
    description: fields.text(
      "description",
      "description",
      PRODUCT_LIMITS.description,
    ),
    price: parsePrice(fields),
    gtin: fields.text("gtin", "barcode", PRODUCT_LIMITS.shortText),
    sources: parseSources(fields),
  };

  const tire = category === "tires" ? parseTireSpecs(fields) : null;
  const wheel = category === "wheels" ? parseWheelSpecs(fields) : null;
  const accessory =
    category === "accessories" ? parseAccessorySpecs(fields) : null;

  if (Object.keys(fields.errors).length > 0) {
    return { ok: false, errors: fields.errors };
  }

  const shared = { ...base, status };
  if (category === "tires" && tire) {
    return { ok: true, input: { ...shared, category, specs: tire } };
  }
  if (category === "wheels" && wheel) {
    return { ok: true, input: { ...shared, category, specs: wheel } };
  }
  if (category === "accessories" && accessory) {
    return { ok: true, input: { ...shared, category, specs: accessory } };
  }
  // Unreachable: a missing category or spec block has already set an error.
  return { ok: false, errors: fields.errors };
}
