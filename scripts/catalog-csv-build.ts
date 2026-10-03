/* ---------------------------------------------------------------------------
   catalog-csv-build — turn the co-founder's merged vendor workbooks into the
   one catalogue CSV that `npm run catalog:import` loads (D125).

     npm run catalog:build-csv -- --share <dir> --final <dir> --out <dir>

   Inputs:
     --share <dir>   Tires.xlsx, Wheels.xlsx, Accessories.xlsx (one sheet each,
                     one row per vendor listing) and the `images/` folder their
                     image columns point into.
     --final <dir>   the per-vendor workbooks (one sheet per vendor, named as
                     the share's `source`), read only for `vendor_price`.
     --out <dir>     where the five files go (created).

   Output:
     catalogue.csv     one row per product, laid out as `docs/catalogue-csv.md`
     issues.csv        every input row left out, with the reason
     merge-report.csv  every cross-vendor merge and what disagreed, every group
                       that could not be merged, and every -B pair whose titles
                       differ
     needs-review.csv  the rows the vendor sheets flag `needs_review`, loaded
                       normally, with why they are flagged
     summary.txt       the counts, and every input column not written and why

   The rules are the owner's rulings of 2026-10-03 (D125), and the principle
   behind them is the owner's: align the data as the vendor does, so every
   value can be traced back to a vendor. Nothing is invented or guessed: a
   blank is "not known", and a case the rulings do not settle goes to
   issues.csv as "needs owner ruling: …" instead of being decided here.

   Before writing, every output row goes through the importer's own
   `planImport()`; a row it would refuse moves to issues.csv with its
   message. The run then checks the file (every input row accounted for once,
   no vendor + SKU twice, allowed values only, every photo on disk, no float
   noise) and exits 1 if any check fails.

   TypeScript, like `catalog-import.ts`, because it runs the app's validator.
   --------------------------------------------------------------------------- */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { Workbook, type CellValue } from "exceljs";

import { IMPORT_MAPPING } from "@/features/catalog/import-mapping";
import { planImport, type ImportRow } from "@/features/catalog/import-plan";
import { PRODUCT_FIELD as F } from "@/features/catalog/product-input";
import { parseTireSizeSpec } from "@/features/catalog/size";

const { values: flags } = parseArgs({
  options: {
    share: { type: "string" },
    final: { type: "string" },
    out: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(`catalog-csv-build: ${message}`);
  process.exit(1);
}

const shareDir = flags.share ? resolve(flags.share) : fail("give --share <dir>.");
const finalDir = flags.final ? resolve(flags.final) : fail("give --final <dir>.");
const outDir = flags.out ? resolve(flags.out) : fail("give --out <dir>.");

/* --- Constants ------------------------------------------------------------- */

type Category = "tires" | "wheels" | "accessories";
const CATEGORIES: readonly Category[] = ["tires", "wheels", "accessories"];
const WORKBOOK: Record<Category, string> = {
  tires: "Tires.xlsx",
  wheels: "Wheels.xlsx",
  accessories: "Accessories.xlsx",
};

/** Owner, 2026-10-03: the winning vendor of a cross-vendor merge, highest first. */
const VENDOR_PRIORITY = [
  "Auto Country",
  "Direct Auto Import",
  "Vertex Tires",
  "PRO WHEELS",
  "Wheel Works",
];

const MAX_SOURCES = IMPORT_MAPPING.sources.max;
const PHOTO_COLUMNS = IMPORT_MAPPING.photos;
const IMAGE_COLUMNS: Record<Category, readonly string[]> = {
  tires: ["image", "image_2"],
  wheels: ["image"],
  accessories: ["image", "image_2", "image_3", "image_4", "image_5"],
};

/** The vendors' fifteen accessory labels, copied exactly (D125). */
const ACCESSORY_LABELS = new Set(
  Object.keys(IMPORT_MAPPING.values[F.accessoryType] ?? {}),
);
const SERVICE_TYPES = new Set(["P", "LT", "ST", "HL", "C"]);
const SEASONS: Record<string, string> = {
  Summer: "summer",
  "All Season": "all_season",
  "All Weather": "all_weather",
  Winter: "winter",
};

/**
 * Rule 6 (owner, 2026-10-03), keyed on the RAW wheel `brand`. `keep`: the
 * vendor's own wording is the brand and the model is `model`. `fold`: the
 * prefix moves into the model under the parent brand.
 */
const WHEEL_BRANDS: Record<string, { brand: string; prefix: string }> = {
  "Asanti Black": { brand: "Asanti Black", prefix: "" },
  "Pro Comp Alloys": { brand: "Pro Comp Alloys", prefix: "" },
  "Ruffino Hard": { brand: "Ruffino Hard", prefix: "" },
  "Sentali Forged": { brand: "Sentali Forged", prefix: "" },
  "Sentali Street": { brand: "Sentali Street", prefix: "" },
  "Sentali Luxx": { brand: "Sentali Luxx", prefix: "" },
  "Sentali Barrel Forged Xtreme": { brand: "Sentali Barrel Forged Xtreme", prefix: "" },
  "Black Rhino Hard Alloys": { brand: "Black Rhino Hard Alloys", prefix: "" },
  "American Racing Vintage": { brand: "American Racing Vintage", prefix: "" },
  "KMC Powersports": { brand: "KMC Powersports", prefix: "" },
  "Fuel UTV": { brand: "Fuel UTV", prefix: "" },
  "Dolce Luxury": { brand: "Dolce Luxury", prefix: "" },
  "Dolce Performance": { brand: "Dolce Performance", prefix: "" },
  "Sentali Barrel": { brand: "Sentali Barrel Forged", prefix: "" },
  "Lock Xtreme": { brand: "Lock Off-Road", prefix: "Xtreme" },
  "Black Rhino Hard Alloys - UTV": { brand: "Black Rhino Hard Alloys", prefix: "UTV" },
  "Fuel Mono": { brand: "Fuel Off-Road", prefix: "Mono" },
  "Fuel Forged": { brand: "Fuel Off-Road", prefix: "Forged" },
  Trailer: { brand: "Trailer", prefix: "" },
};

/**
 * Owner, 2026-10-03: a code a vendor assigns is that vendor's own, so a
 * merged product never takes one from another vendor. They are recorded in
 * merge-report.csv instead.
 */
const VENDOR_OWN_CODES = new Set(["Part number", "Manufacturer code"]);

/**
 * D126 (owner, 2026-10-03): a tire's season follows its MAKER where our
 * vendors' label disagrees with it. Keyed on `brand|model_clean`, lower case,
 * and applied to every vendor's listing of that model, so all its sizes read
 * the same. Each entry names the page the maker's wording was read from.
 */
const SEASON_BY_MAKER: Record<string, { season: string; source: string }> = {
  "hankook|weatherflex gt": { season: "all_weather", source: "hankooktire.com, Weatherflex GT (H755) launch" },
  "sailun|atrezzo 4s": { season: "all_weather", source: "sailuntire.ca/en/plt/tires/4s/" },
  "kumho|ha32": { season: "all_weather", source: "Point S Canada, Walmart.ca (kumhotire.ca unreachable)" },
  "kumho|solus 4s ha32 suv": { season: "all_weather", source: "Point S Canada, Walmart.ca (kumhotire.ca unreachable)" },
  "toyo|celsius ii": { season: "all_weather", source: "toyotires.ca, all-weather-passenger-tire-celsius-ii" },
  "toyo|celsius cargo": { season: "all_weather", source: "toyotires.ca, all-weather-commercial-grade-light-truckvan-tire-celsius-cargo" },
  "toyo|open country a/t iii": { season: "all_weather", source: "toyotires.ca, all-terrain-all-weather-light-truck-tire-open-country-iii" },
  // Second round, the 85 mixed-season models (owner, 2026-10-03; D126 groups A, B, C, E):
  "venom power|terra hunter x/t": { season: "all_season", source: "venompowertires.com/Light_Truck/terra-hunter-xt.html" },
  "continental|extremecontact dws06 plus": { season: "all_season", source: "continentaltire.com/tires/extremecontact-dws06-plus" },
  "general tire|altimax rt45": { season: "all_season", source: "generaltire.ca/car/tyres/altimax-rt45/" },
  "venom power|terra hunter r/t": { season: "all_season", source: "venompowertires.com/Light_Truck/terra-hunter-rt.html" },
  "venom power|swampthing m/t": { season: "all_season", source: "venompowertires.com/Light_Truck/swampthing-mt.html" },
  "greentrac|journey-x": { season: "all_season", source: "greentractyre.com/863.html; premiertiresandwheels.ca" },
  "yokohama|geolandar a/t4 g018": { season: "all_weather", source: "yokohama.ca/en/tires/geolandar-at-4-g018" },
  "mileking|mk625": { season: "all_weather", source: "ditriptyre.com/tyres/mk625/; gba-tires.ca (owner: snowflake everyday tire)" },
  "venom power|covert grip cv": { season: "all_season", source: "venompowertires.com/Car/covert-grip-cv.html" },
  "michelin|crossclimate 2": { season: "all_weather", source: "michelin.ca/en/auto/tires/michelin-crossclimate-2 (owner: snowflake everyday tire)" },
  "rydanz|revimax-r23-260-shibata": { season: "summer", source: "rydanz.com/product/revimax-r23/" },
  "haida|hd829": { season: "all_season", source: "haidatires.ca/hd829" },
  "falken|wildpeak a/t trail": { season: "all_weather", source: "falkentire.com/wildpeak/attrail" },
  "rydanz|reac r05": { season: "all_season", source: "tiremart.com; carid.com (no maker page)" },
  "venom power|primo hauler": { season: "all_season", source: "venompowertires.com/Commercial/49.html" },
  "goodyear|wrangler duratrac rt": { season: "all_season", source: "goodyear.com/en-ca/tires/wrangler-duratrac-rt_24913" },
  "venom power|trail hunter atx": { season: "all_season", source: "venompowertires.com/Light_Truck/trail-hunter-atx.html" },
  "bridgestone|weatherpeak": { season: "all_weather", source: "bridgestonetire.ca/our-tires/tire-brand/weatherpeak/ (owner: snowflake everyday tire)" },
  "continental|vancontact a/s ultra": { season: "all_weather", source: "continentaltire.com/vancontact-as-ultra" },
  "rydanz|revimax-r23-280-shibata": { season: "summer", source: "rydanz.com/product/revimax-r23/" },
  "general tire|grabber apt": { season: "all_season", source: "generaltire.ca/car/tyres/grabber-apt/" },
  "falken|wildpeak r/t 01": { season: "all_season", source: "falkentire.com/wildpeak/rt" },
  "venom power|van-co all season": { season: "all_season", source: "venompowertires.com/Commercial/van.html" },
  "venom power|grand am wsw": { season: "all_season", source: "venompowertires.com/Car/grand-am.html" },
  "venom power|ragnarok gts": { season: "all_season", source: "venompowertires.com/Car/ragnarok-gts.html" },
  "venom power|swampthing a/t": { season: "all_season", source: "venompowertires.com/Light_Truck/swampthing-at.html" },
  "rydanz|roadster r02": { season: "all_season", source: "rydanz.com/product/roadster-r02/; tiremart.com" },
  "rydanz|raleigh r06": { season: "all_season", source: "rydanz.com/product/raleigh-r06/; simpletire.com" },
  "venom power|terra hunter m/t": { season: "all_season", source: "venompowertires.com/Light_Truck/terra-hunter-mt.html" },
  "nexen|roadian atx": { season: "all_season", source: "nexentirecanada.com (All Terrain (3PMS)), roadian-atx" },
  "venom power|trail hunter ats": { season: "all_season", source: "venompowertires.com/Light_Truck/trail-hunter-ats.html" },
  "venom power|terra hunter r/t+": { season: "all_season", source: "venompowertires.com/Light_Truck/terra-hunter-rt.html" },
  "lionhart|lh-five": { season: "all_season", source: "lionharttires.com/tire/lh-five/" },
  "greentrac|rough master rt": { season: "all_season", source: "greentractyre.com/876.html" },
  "rydanz|roadster r02s": { season: "all_season", source: "rydanz.com/product/roadster-r02s/; simpletire.com" },
  "bfgoodrich|all-terrain t/a ko3": { season: "all_weather", source: "bfgoodrich.ca/en/auto/tires/bfgoodrich-all-terrain-t-a-ko3" },
  "rydanz|raptor r09": { season: "all_season", source: "rydanz.com/product/raptor-r09/" },
  "goodyear|assurance weatherready 2": { season: "all_weather", source: "goodyear.com/en-ca/tires/assurance-weatherready-2_24987 (owner: snowflake everyday tire)" },
  "zmax|dreamland r/t": { season: "all_season", source: "zodotiregroup.com/zmax-rt-tire-dreamland-rt.html" },
  "lionhart|lh-ten": { season: "all_season", source: "lionharttires.com/tire/lh-ten/" },
  "rydanz|revimax-r23-300-shibata": { season: "summer", source: "rydanz.com/product/revimax-r23/" },
  "pirelli|scorpion all terrain plus": { season: "all_season", source: "pirelli.com/tires/en-ca/car/catalog/product/scorpion-all-terrain-plus" },
  "mileking|mk829": { season: "all_season", source: "bestpricetirewarehouse.ca; simpletire.com (no maker page)" },
  "venom power|grand am rwl": { season: "all_season", source: "venompowertires.com/Car/grand-am.html" },
  "bridgestone|dueler a/t ascent": { season: "all_season", source: "tires.bridgestone.com/en-ca/tires/automotive/dueler/at-ascent" },
  "rydanz|revimax-r31-200-shibatire": { season: "summer", source: "rydanz.com/product/revimax-r31/" },
  "goodyear|wrangler duratrac": { season: "all_season", source: "goodyear.com/en-ca/tires/wrangler-duratrac_354" },
  "suretrac|radial a/t": { season: "all_season", source: "suretractires.com/at/" },
  "rydanz|revimax-r03s-140": { season: "summer", source: "rydanz.com/product/revimax-r03s/" },
  "venom power|terra hunter x/t 2": { season: "all_season", source: "venompowertires.com/Light_Truck/terra-hunter-xt2.html" },
  "venom power|trail hunter r/t": { season: "all_season", source: "venompowertires.com/Light_Truck/trail-hunter-rt.html" },
  "zeta|alventi": { season: "summer", source: "asianalltires.com/index.php/product/alventi-2/ (Canadian distributor)" },
  "continental|procontact tx": { season: "all_season", source: "continentaltire.com/tires/procontact-tx" },
  "venom power|covert grip asp": { season: "all_season", source: "venompowertires.com/Car/covert-grip-asp.html" },
  "greentrac|season master": { season: "all_weather", source: "toofastautoparts.com (owner: snowflake everyday tire)" },
  "haida|hd878 r/t": { season: "all_season", source: "haidatires.com" },
  "nexen|roadian htx 2": { season: "all_weather", source: "nexentirecanada.com roadian-htx-2 (owner: snowflake everyday tire)" },
  "haida|hd868": { season: "all_season", source: "haidatires.com" },
  "rydanz|rammer r08": { season: "all_season", source: "prioritytire.com (no maker page)" },
  "venom power|covert grip h/t": { season: "all_season", source: "venompowertires.com/Car/covert-grip-ht.html" },
  "lionhart|lh-501": { season: "all_season", source: "lionharttires.com/tire/lh-501/" },
  "firestone|weathergrip": { season: "all_weather", source: "firestonetire.ca/our-tires/brands/weathergrip/" },
  "lionhart|lh-503": { season: "all_season", source: "lionharttires.com/tire/lh-503/" },
  "lionhart|lionclaw ht": { season: "all_season", source: "lionharttires.com/tire/lionclaw-ht/" },
  "nexen|roadian gtx": { season: "all_season", source: "nexentireusa.com/tires/roadian_gtx/" },
  "firestone|destination x/t": { season: "all_season", source: "firestonetire.com/our-tires/brands/destination/" },
  "lionhart|lionclaw atx2": { season: "all_season", source: "lionharttires.com/tire/lionclaw-atx2/" },
  "haida|hd837": { season: "all_season", source: "haidatires.com" },
  "venom power|at-co all season": { season: "all_season", source: "venompowertires.com/Commercial/at.html" },
  "rydanz|revimax-r31-280r-shibatire": { season: "summer", source: "rydanz.com/product/revimax-r31/" },
  "goodyear|wrangler all-terrain adventure": { season: "all_season", source: "goodyear.com/en-ca/tires/wrangler-all-terrain-adventure-with-kevlar_2732" },
  "goodyear|eagle enforcer a/w": { season: "all_weather", source: "tirerack.com (Eagle Enforcer All Weather)" },
  "rydanz|revimax-r23-140-shibata": { season: "summer", source: "rydanz.com/product/revimax-r23/" },
};

/**
 * D126: Vertex tires the owner reviewed against the maker on 2026-10-03 and
 * kept as Vertex labels them (all-terrain, mud-terrain or all-season by the
 * maker's own wording). With SEASON_BY_MAKER they clear the Vertex season flag.
 */
const SEASON_REVIEWED_AS_IS = new Set([
  "sailun|terramax at2",
  "sailun|terramax rt",
  "sailun|atrezzo sh408",
  "michelin|defender ltx m/s 2",
  "hankook|dynapro at2 xtreme",
  "toyo|m-55 black",
]);

const modelKey = (brand: string, model: string) => `${brand}|${model}`.toLowerCase();

/** Every listing whose season SEASON_BY_MAKER changed, for summary.txt. */
const seasonByMaker: { rowId: string; from: string; to: string }[] = [];

/**
 * Owner, 2026-10-03: loaded as these brands and not flagged for review.
 * "Trailer" at the build; the four brand splits of rule 6 after the review
 * (D126: "Ruffino Hard" is sold as its own brand by Canadian retailers).
 */
const REVIEW_CLEARED_WHEEL_BRANDS = new Set([
  "Trailer",
  "Asanti Black",
  "Pro Comp Alloys",
  "Ruffino Hard",
  "Lock Xtreme",
]);

const REVIEW_WHEEL_BRAND = "brand split checked against the market (D125)";
const REVIEW_VERTEX_SEASON =
  "Vertex says All Season; model is usually sold as all-weather/3PMSF";

/** Input columns this script does not write, and why (for summary.txt). */
const NOT_WRITTEN: Record<Category, Record<string, string>> = {
  tires: {
    source: "written as source_vendor_n",
    vendor_sku: "written as source_sku_n",
    product_url: "written as source_url_n",
    title: "written as name",
    size: "written as tire_size",
    tire_class: "written as service_type",
    load_index_dual: "joined into load_index as <index>/<dual>",
    xl: "written as is_xl",
    three_pmsf: "written as winter_approved",
    image: "written as image_1",
    image_2: "written as image_2",
    brand: "written as brand (as the vendor gives it)",
    model: "not written: model_clean is the model (rule 7)",
    model_clean: "written as model",
    season: "not written: season_clean is the season (rule 7)",
    season_clean: "written as season",
    size_type: "not written: the importer re-derives it from tire_size",
    width: "not written: the importer re-derives it from tire_size",
    aspect_ratio: "not written: the importer re-derives it from tire_size",
    rim_diameter: "not written: the importer re-derives it from tire_size",
    overall_diameter_in: "not written: the importer re-derives it from tire_size",
    section_width_in: "not written: the importer re-derives it from tire_size",
    zr: "written in extra_specs as ZR",
    mud_snow: "written in extra_specs as Mud & snow",
    sidewall: "written in extra_specs as Sidewall",
    part_number: "written in extra_specs as Part number",
    manufacturer_code: "written in extra_specs as Manufacturer code",
    needs_review: "not written: listed in needs-review.csv",
  },
  wheels: {
    source: "written as source_vendor_n",
    vendor_sku: "written as source_sku_n",
    product_url: "written as source_url_n",
    title: "written as name (Left/Right appended when side is filled)",
    brand: "not written as is: read by rule 6 to choose brand and model",
    brand_clean: "written as brand outside rule 6's table",
    line: "not written as is: prefixed to model when filled (rule 6)",
    model: "written as model (rule 6)",
    diameter: "written as wheel_diameter",
    width: "written as wheel_width",
    bolt_pattern: "written as bolt_patterns (a -B pair's joined by /)",
    lugs: "written as lug_count",
    backspacing_in: "written as backspacing",
    finish: "written as wheel_finish",
    finish_family: "written as wheel_finish_family",
    color: "written as wheel_color",
    seat_type: "written as wheel_seat_type",
    load_rating_kg: "written as load_rating_lbs (x 2.20462, whole pounds)",
    side: "written in extra_specs as Side, and appended to name",
    fitment: "written in extra_specs as Fitment",
    new: "written in extra_specs as New",
    part_number: "written in extra_specs as Part number",
    specs: "Material written as material; every other item in extra_specs",
    discontinued: "not written: every product loads published (rule 1)",
    needs_review: "not written: listed in needs-review.csv",
    image: "written as image_1",
  },
  accessories: {
    source: "written as source_vendor_n",
    vendor_sku: "written as source_sku_n",
    product_url: "written as source_url_n",
    title: "written as name",
    brand: "not written: brand_clean is the brand (rule 5)",
    brand_clean: "written as brand",
    vendor_title: "dropped (owner-approved)",
    accessory_type: "dropped (owner-approved): the vendor's own category; product_type is the type",
    category: "dropped (owner-approved)",
    product_type: "written as accessory_type",
    thread_size: "not written: thread_size_clean is the thread size",
    thread_size_clean: "written as thread_size",
    seat_type: "written as accessory_seat_type",
    finish: "written as accessory_finish",
    quantity: "not written as is: read into pack_quantity",
    kit_pieces: "not written as is: read into pack_quantity for '1 kit'",
    bolt_type: "written in extra_specs as Bolt type",
    spline_count: "written in extra_specs as Spline count",
    hex_mm: "written in extra_specs as Hex (mm)",
    spacer_style: "written in extra_specs as Spacer style",
    center_bore_mm: "written in extra_specs as Centre bore (mm)",
    thickness_mm: "written in extra_specs as Thickness (mm)",
    wheel_diameter_in: "written in extra_specs as Wheel diameter (in)",
    bolt_pattern: "written in extra_specs as Bolt pattern",
    fits_design: "written in extra_specs as Fits design",
    fits_wheel: "written in extra_specs as Fits wheel",
    specs: "Weight (lb) written as weight_lb; every other item in extra_specs",
    discontinued: "not written: every product loads published (rule 1)",
    needs_review: "not written: listed in needs-review.csv",
    image: "written as image_1",
    image_2: "written as image_2",
    image_3: "written as image_3",
    image_4: "written as image_4",
    image_5: "written as image_5",
  },
};

/* --- Reading the workbooks ------------------------------------------------- */

/**
 * A number as the shortest decimal that round-trips, with spreadsheet float
 * noise removed: `73.09999999999999` → `73.1`. A value with a genuine seventh
 * decimal would be rounded too; none of the columns here holds one, and the
 * per-column decimal check refuses anything past the column's own limit.
 */
function numberText(value: number): string {
  if (!Number.isFinite(value)) fail(`a cell holds ${value}.`);
  if (Number.isInteger(value)) {
    if (!Number.isSafeInteger(value)) fail(`a cell holds ${value}, too long to read exactly.`);
    return String(value);
  }
  const text = String(value);
  if (/e/i.test(text)) fail(`a cell holds ${text}.`);
  const decimals = text.split(".")[1]?.length ?? 0;
  if (decimals <= 6) return text;
  noiseCleaned += 1;
  return String(Number(value.toFixed(6)));
}
let noiseCleaned = 0;

function cellText(value: CellValue, where: string): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return numberText(value);
  if (typeof value === "object" && !(value instanceof Date) && "richText" in value) {
    return value.richText.map((part) => part.text).join("").trim();
  }
  fail(`${where} holds a value this script does not read (${JSON.stringify(value)}).`);
}

interface Sheet {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
}

async function readWorkbook(path: string): Promise<Sheet[]> {
  if (!existsSync(path)) fail(`${path} does not exist.`);
  const workbook = new Workbook();
  await workbook.xlsx.readFile(path);
  const sheets: Sheet[] = [];
  workbook.eachSheet((sheet) => {
    const headerRow = sheet.getRow(1);
    const width = headerRow.cellCount;
    const headers: string[] = [];
    for (let c = 1; c <= width; c += 1) {
      headers.push(cellText(headerRow.getCell(c).value, `${path} header`));
    }
    const rows: Record<string, string>[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, number) => {
      if (number === 1) return;
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = cellText(
          row.getCell(index + 1).value,
          `${path} sheet ${sheet.name} row ${number}`,
        );
      });
      if (Object.values(record).every((cell) => cell === "")) return;
      rows.push(record);
    });
    sheets.push({ name: sheet.name, headers, rows });
  });
  return sheets;
}

/* --- Small helpers ----------------------------------------------------------- */

const yes = (value: string) => value.toLowerCase() === "yes";

/** Text compared ignoring case, spaces and punctuation; numbers as numbers. */
function keyPart(value: string): string {
  if (/^[+-]?\d+(\.\d+)?$/.test(value)) return `#${Number(value)}`;
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function decimalsOf(text: string): number {
  return text.split(".")[1]?.length ?? 0;
}

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csvLine = (cells: readonly (string | number)[]) =>
  `${cells.map(csvCell).join(",")}\n`;

/* --- Listings ---------------------------------------------------------------- */

interface InputRow {
  category: Category;
  /** Position in its workbook, for a stable output order. */
  index: number;
  rowId: string;
  source: string;
  sku: string;
  cells: Record<string, string>;
  price: string;
}

/** One vendor listing: an input row, or a -B pair joined back into one. */
interface Listing {
  category: Category;
  rows: InputRow[];
  primary: InputRow;
  /** Output column → value (only the columns this category fills). */
  fields: Record<string, string>;
  extra: [string, string][];
  images: string[];
  problems: string[];
  /** Raw wheel brand, kept for the rule-6 review reason. */
  rawBrand: string;
}

/** A product in the catalogue: one listing, or several merged across vendors. */
interface Product {
  category: Category;
  /** Winner first, then the rest in vendor priority order. */
  listings: Listing[];
  /** A merged product's fields after the blanks were filled (`resolveMerge`). */
  fields?: Record<string, string>;
  extra?: [string, string][];
  fills?: string[];
  notFilled?: string[];
}

interface Issue {
  rowId: string;
  source: string;
  sku: string;
  category: Category;
  problem: string;
}

const issues: Issue[] = [];
function issue(listing: Listing, problem: string): void {
  for (const row of listing.rows) {
    issues.push({
      rowId: row.rowId,
      source: row.source,
      sku: row.sku,
      category: row.category,
      problem,
    });
  }
}

/** Adds a number column, refusing more decimals than the column holds. */
function setNumber(
  listing: Listing,
  field: string,
  value: string,
  maxDecimals: number,
): void {
  if (value === "") return;
  if (!/^[+-]?\d+(\.\d+)?$/.test(value)) {
    listing.problems.push(`needs owner ruling: ${field} "${value}" is not a number`);
    return;
  }
  if (decimalsOf(value) > maxDecimals) {
    listing.problems.push(
      `needs owner ruling: ${field} ${value} has more than ${maxDecimals} decimals`,
    );
    return;
  }
  listing.fields[field] = value;
}

/** A Yes column → `yes`; blank stays blank; anything else is a question. */
function setYes(listing: Listing, field: string, column: string): void {
  const value = listing.primary.cells[column] ?? "";
  if (value === "") return;
  if (yes(value)) listing.fields[field] = "yes";
  else listing.problems.push(`needs owner ruling: ${column} "${value}" (expected Yes or blank)`);
}

function addExtra(listing: Listing, label: string, value: string): void {
  if (value === "") return;
  const flat = value.replace(/\r?\n/g, " ").trim();
  if (/\s\|\s/.test(flat)) {
    listing.problems.push(
      `needs owner ruling: ${label} "${flat.slice(0, 60)}" contains " | ", which the importer would split`,
    );
    return;
  }
  listing.extra.push([label, flat]);
}

function yesExtra(listing: Listing, label: string, column: string): void {
  const value = listing.primary.cells[column] ?? "";
  if (value === "") return;
  if (yes(value)) addExtra(listing, label, "yes");
  else listing.problems.push(`needs owner ruling: ${column} "${value}" (expected Yes or blank)`);
}

/** `specs`: lines of `Label - Value`, in the vendor's order. */
function specItems(listing: Listing): [string, string][] {
  const raw = listing.primary.cells.specs ?? "";
  const items: [string, string][] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const split = line.indexOf(" - ");
    if (split <= 0) {
      listing.problems.push(`needs owner ruling: specs line "${line.slice(0, 60)}" is not "Label - Value"`);
      continue;
    }
    items.push([line.slice(0, split).trim(), line.slice(split + 3).trim()]);
  }
  return items;
}

function newListing(rows: InputRow[]): Listing {
  const primary = rows[0];
  if (!primary) fail("a listing with no rows.");
  const listing: Listing = {
    category: primary.category,
    rows,
    primary,
    fields: { [F.category]: primary.category },
    extra: [],
    images: [],
    problems: [],
    rawBrand: primary.cells.brand ?? "",
  };
  const cells = primary.cells;
  const name = cells.title ?? "";
  listing.fields[F.name] = name;
  if (cells.description) listing.fields[F.description] = cells.description;
  for (const column of IMAGE_COLUMNS[primary.category]) {
    const path = cells[column] ?? "";
    if (path === "") continue;
    if (!imageExists(path)) listing.problems.push(`image file missing: ${path}`);
    listing.images.push(path);
  }
  return listing;
}

const imageCache = new Map<string, boolean>();
function imageExists(path: string): boolean {
  let found = imageCache.get(path);
  if (found === undefined) {
    found = existsSync(join(shareDir, path));
    imageCache.set(path, found);
  }
  return found;
}

/* Rule 7. */
function tireListing(row: InputRow): Listing {
  const listing = newListing([row]);
  const c = row.cells;
  const f = listing.fields;
  if (c.brand === "") listing.problems.push("tire has no brand");
  else f[F.brand] = c.brand ?? "";
  if (c.model_clean) f[F.model] = c.model_clean;

  const size = c.size ?? "";
  if (size === "") listing.problems.push("tire size is blank");
  else if (parseTireSizeSpec(size) === null) listing.problems.push(`tire size "${size}" is not readable`);
  else f[F.tireSize] = size;

  const tireClass = c.tire_class ?? "";
  if (tireClass !== "") {
    if (SERVICE_TYPES.has(tireClass)) f[F.serviceType] = tireClass;
    else listing.problems.push(`needs owner ruling: tire_class "${tireClass}"`);
  }
  const loadIndex = c.load_index ?? "";
  const dual = c.load_index_dual ?? "";
  if (dual !== "" && loadIndex === "") {
    listing.problems.push(`needs owner ruling: load_index_dual ${dual} with no load_index`);
  } else if (loadIndex !== "") {
    f[F.loadIndex] = dual === "" ? loadIndex : `${loadIndex}/${dual}`;
  }
  if (c.speed_rating) f[F.speedRating] = c.speed_rating;
  if (c.load_range) f[F.loadRange] = c.load_range;
  const ply = c.ply_rating ?? "";
  if (ply !== "") {
    if (/^\d+$/.test(ply) && Number(ply) >= 2 && Number(ply) <= 30) f[F.plyRating] = ply;
    else listing.problems.push(`needs owner ruling: ply_rating "${ply}"`);
  }
  if (c.utqg) f[F.utqg] = c.utqg;
  const season = c.season_clean ?? "";
  if (season !== "") {
    const ours = SEASONS[season];
    if (ours) f[F.season] = ours;
    else listing.problems.push(`needs owner ruling: season_clean "${season}"`);
  }
  const maker = SEASON_BY_MAKER[modelKey(c.brand ?? "", c.model_clean ?? "")];
  if (maker && f[F.season] !== maker.season) {
    seasonByMaker.push({ rowId: row.rowId, from: f[F.season] ?? "", to: maker.season });
    f[F.season] = maker.season;
  }
  setYes(listing, F.isXl, "xl");
  setYes(listing, F.winterApproved, "three_pmsf");
  setYes(listing, F.studdable, "studdable");
  setYes(listing, F.runFlat, "run_flat");

  addExtra(listing, "Part number", c.part_number ?? "");
  yesExtra(listing, "ZR", "zr");
  yesExtra(listing, "Mud & snow", "mud_snow");
  addExtra(listing, "Sidewall", c.sidewall ?? "");
  addExtra(listing, "Manufacturer code", c.manufacturer_code ?? "");
  return listing;
}

/* Rules 3 and 6. `rows` is one input row, or a -B pair in B order. */
function wheelListing(rows: InputRow[]): Listing {
  const listing = newListing(rows);
  const primary = listing.primary;
  const c = primary.cells;
  const f = listing.fields;

  if (rows.length > 1) {
    // A -B pair differs only in bolt_pattern (and, for 99 DAI pairs, title).
    for (const other of rows.slice(1)) {
      for (const [column, value] of Object.entries(other.cells)) {
        if (["row_id", "bolt_pattern", "title"].includes(column)) continue;
        if (value !== (c[column] ?? "")) {
          listing.problems.push(`needs owner ruling: -B rows differ in ${column}`);
        }
      }
      if (other.price !== primary.price) {
        listing.problems.push("needs owner ruling: -B rows have different vendor prices");
      }
    }
    const patterns = rows.map((row) => row.cells.bolt_pattern ?? "");
    if (patterns.some((pattern) => pattern === "")) {
      listing.problems.push("needs owner ruling: a -B row has no bolt pattern");
    }
    f[F.boltPatterns] = patterns.join("/");
    const titles = rows.map((row) => row.cells.title ?? "");
    // Owner, 2026-10-03: a joined listing's name gives every bolt pattern,
    // joined by "/", as the vendors' own pages do. A title that names one
    // pattern exactly once has that token replaced with the joined patterns
    // (the 99 DAI pairs, whose two titles differ, and the Auto Country pairs
    // whose shared title names one). A shared title naming no pattern is left
    // as written; anything else is reported, not guessed.
    const token = (pattern: string) =>
      new RegExp(`(?<![\\w.])${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.])`, "gi");
    const count = (title: string, pattern: string) => title.match(token(pattern))?.length ?? 0;
    const namesAll = (title: string) => patterns.every((pattern) => count(title, pattern) > 0);
    const differ = new Set(titles).size > 1;
    const holdsAll = titles.filter(namesAll);
    let chosen = titles[0] ?? "";
    let outcome: BPairOutcome | null = null;
    if (differ && holdsAll.length === 1 && holdsAll[0]) {
      chosen = holdsAll[0];
      outcome = "b_pair_titles_differ";
    } else if (!namesAll(chosen)) {
      const named = patterns.filter((pattern) => count(chosen, pattern) > 0);
      const only = named[0];
      // A token already inside a "/" list (`6x135/139.7`, `8x180/8x165`) is
      // the vendor's own shorthand for several patterns: replacing it would
      // write `6x135/6x139.7/139.7`. Left as written and reported instead.
      const inList = (pattern: string) =>
        new RegExp(`/\\s*${token(pattern).source}|${token(pattern).source}\\s*/`, "i").test(chosen);
      if (named.length === 0 && !differ) {
        outcome = "b_pair_title_names_no_pattern";
      } else if (named.length === 1 && only && count(chosen, only) === 1 && !inList(only)) {
        chosen = chosen.replace(token(only), patterns.join("/"));
        outcome = "b_pair_title_rewritten";
      } else {
        outcome = "b_pair_title_not_rewritten";
      }
    } else if (differ) {
      outcome = "b_pair_titles_differ";
    }
    f[F.name] = chosen;
    if (outcome) bPairTitles.push({ rows, titles, chosen, outcome });
  } else if (c.bolt_pattern) {
    f[F.boltPatterns] = c.bolt_pattern;
  }

  // Rule 6.
  const raw = c.brand ?? "";
  const clean = c.brand_clean ?? "";
  const model = c.model ?? "";
  const ruled = WHEEL_BRANDS[raw];
  if (raw === "" && clean === "") {
    listing.problems.push("wheel has no brand");
  } else if (ruled) {
    f[F.brand] = ruled.brand;
    if (ruled.prefix !== "" && model !== "") f[F.model] = `${ruled.prefix} ${model}`;
    else if (ruled.prefix !== "") {
      listing.problems.push(`needs owner ruling: ${raw} wheel with no model to prefix`);
    } else if (model !== "") f[F.model] = model;
  } else if (raw !== clean) {
    listing.problems.push(
      `needs owner ruling: wheel brand "${raw}" (brand_clean "${clean}") is not in the approved table`,
    );
  } else {
    f[F.brand] = clean;
    const line = c.line ?? "";
    const joined = [line, model].filter((part) => part !== "").join(" ");
    if (model !== "") f[F.model] = joined;
    else if (line !== "") {
      listing.problems.push(`needs owner ruling: wheel has a line "${line}" and no model`);
    }
  }

  const side = c.side ?? "";
  if (side !== "") {
    if (side !== "Left" && side !== "Right") {
      listing.problems.push(`needs owner ruling: side "${side}"`);
    } else {
      const name = f[F.name] ?? "";
      const ending = /\b(left|right)$/i.exec(name)?.[1];
      if (ending === undefined) f[F.name] = `${name} ${side}`;
      else if (ending.toLowerCase() !== side.toLowerCase()) {
        listing.problems.push(`needs owner ruling: side ${side} but the title ends "${ending}"`);
      }
    }
  }

  setNumber(listing, F.wheelDiameter, c.diameter ?? "", 2);
  setNumber(listing, F.wheelWidth, c.width ?? "", 2);
  setNumber(listing, F.offsetMm, c.offset_mm ?? "", 1);
  setNumber(listing, F.centerBoreMm, c.center_bore_mm ?? "", 2);
  setNumber(listing, F.backspacing, c.backspacing_in ?? "", 3);
  if (c.finish) f[F.wheelFinish] = c.finish;
  if (c.finish_family) f[F.wheelFinishFamily] = c.finish_family;
  if (c.color) f[F.wheelColor] = c.color;
  if (c.lugs) f[F.lugCount] = c.lugs;
  if (c.seat_type) f[F.wheelSeatType] = c.seat_type;
  const kg = c.load_rating_kg ?? "";
  if (kg !== "") {
    if (/^\d+(\.\d+)?$/.test(kg)) f[F.loadRatingLbs] = String(Math.round(Number(kg) * 2.20462));
    else listing.problems.push(`needs owner ruling: load_rating_kg "${kg}"`);
  }
  for (const [field, column] of [
    [F.tpmsCompatible, "tpms_compatible"],
    [F.winterCompatible, "winter_compatible"],
  ] as const) {
    const value = c[column] ?? "";
    if (value === "") continue;
    if (yes(value)) f[field] = "yes";
    else if (value.toLowerCase() === "no") f[field] = "no";
    else listing.problems.push(`needs owner ruling: ${column} "${value}"`);
  }

  addExtra(listing, "Side", side);
  addExtra(listing, "Fitment", c.fitment ?? "");
  yesExtra(listing, "New", "new");
  addExtra(listing, "Part number", c.part_number ?? "");
  for (const [label, value] of specItems(listing)) {
    if (label === "Material") f[F.material] = value;
    else addExtra(listing, label, value);
  }
  return listing;
}

/** Rule 8: the vendor's own count. */
function packQuantity(listing: Listing): string | null {
  const c = listing.primary.cells;
  const raw = (c.quantity ?? "").trim();
  const text = raw.toLowerCase();
  if (text === "") return "";
  if (/^\d+$/.test(text)) return String(Number(text));
  if (text === "pair") return "2";
  if (text === "roll") return "1";
  if (text === "1 kit") return c.kit_pieces ?? "";
  const of = /^(set|kit|box|pack|roll) of (\d+)$/.exec(text);
  if (of?.[2]) return String(Number(of[2]));
  const strips = /^(\d+) strips$/.exec(text);
  if (strips?.[1]) return String(Number(strips[1]));
  listing.problems.push(`needs owner ruling: quantity "${raw}"`);
  return null;
}

/* Rules 5 and 8. */
function accessoryListing(row: InputRow): Listing {
  const listing = newListing([row]);
  const c = row.cells;
  const f = listing.fields;
  if (c.brand_clean) f[F.brand] = c.brand_clean;
  const type = c.product_type ?? "";
  if (ACCESSORY_LABELS.has(type)) f[F.accessoryType] = type;
  else listing.problems.push(`accessory product_type "${type}" is not one of the fifteen`);
  if (c.thread_size_clean) f[F.threadSize] = c.thread_size_clean;
  if (c.seat_type) f[F.accessorySeatType] = c.seat_type;
  if (c.finish) f[F.accessoryFinish] = c.finish;
  const pack = packQuantity(listing);
  if (pack) f[F.packQuantity] = pack;
  setNumber(listing, F.outerDiameterMm, c.outer_diameter_mm ?? "", 2);
  setNumber(listing, F.innerDiameterMm, c.inner_diameter_mm ?? "", 2);
  if (c.part_type) f[F.partType] = c.part_type;

  addExtra(listing, "Bolt type", c.bolt_type ?? "");
  addExtra(listing, "Spline count", c.spline_count ?? "");
  addExtra(listing, "Hex (mm)", c.hex_mm ?? "");
  addExtra(listing, "Spacer style", c.spacer_style ?? "");
  addExtra(listing, "Centre bore (mm)", c.center_bore_mm ?? "");
  addExtra(listing, "Thickness (mm)", c.thickness_mm ?? "");
  addExtra(listing, "Wheel diameter (in)", c.wheel_diameter_in ?? "");
  addExtra(listing, "Bolt pattern", c.bolt_pattern ?? "");
  addExtra(listing, "Fits design", c.fits_design ?? "");
  addExtra(listing, "Fits wheel", c.fits_wheel ?? "");
  for (const [label, value] of specItems(listing)) {
    if (label === "Weight (lb)") setNumber(listing, F.weightLb, value, 2);
    else addExtra(listing, label, value);
  }
  return listing;
}

type BPairOutcome =
  | "b_pair_title_rewritten"
  | "b_pair_titles_differ"
  | "b_pair_title_names_no_pattern"
  | "b_pair_title_not_rewritten";
const bPairTitles: { rows: InputRow[]; titles: string[]; chosen: string; outcome: BPairOutcome }[] = [];

/* --- Merging (rule 4) ------------------------------------------------------------ */

/**
 * Rule 4's key, or `null` when the listing must stay on its own. Owner,
 * 2026-10-03: a blank in ANY key field never matches, so a vendor that did
 * not state a value is never merged on it. Two fields are exempt because
 * their blank is a statement, not a gap: `load_index_dual` blank means the
 * tire has no dual index, and `side` blank means the wheel is not handed.
 */
function mergeKey(listing: Listing): string | null {
  const f = listing.fields;
  const c = listing.primary.cells;
  const required: [string, string][] =
    listing.category === "tires"
      ? [
          ["brand", f[F.brand] ?? ""],
          ["model", f[F.model] ?? ""],
          ["tire size", f[F.tireSize] ?? ""],
          ["load_index", c.load_index ?? ""],
          ["speed_rating", c.speed_rating ?? ""],
        ]
      : listing.category === "wheels"
        ? [
            ["brand", f[F.brand] ?? ""],
            ["model", f[F.model] ?? ""],
            ["diameter", c.diameter ?? ""],
            ["width", c.width ?? ""],
            ["bolt_pattern", f[F.boltPatterns] ?? ""],
            ["offset_mm", c.offset_mm ?? ""],
            ["finish", c.finish ?? ""],
            ["center_bore_mm", c.center_bore_mm ?? ""],
          ]
        : [];
  if (required.length === 0) return null;
  const blank = required.filter(([, value]) => value === "").map(([name]) => name);
  if (blank.length > 0) {
    const label = `${listing.category}: ${blank.join(", ")}`;
    heldApart.set(label, (heldApart.get(label) ?? 0) + 1);
    return null;
  }
  if (listing.category === "tires") {
    return [...required.map(([, value]) => value), c.load_index_dual ?? ""]
      .map(keyPart)
      .join("\u0000");
  }
  const patterns = (f[F.boltPatterns] ?? "")
    .split("/")
    .filter((p) => p !== "")
    .map(keyPart)
    .sort()
    .join(",");
  return [
    keyPart(f[F.brand] ?? ""),
    keyPart(f[F.model] ?? ""),
    keyPart(c.diameter ?? ""),
    keyPart(c.width ?? ""),
    patterns,
    keyPart(c.offset_mm ?? ""),
    keyPart(c.finish ?? ""),
    keyPart(c.center_bore_mm ?? ""),
    keyPart(c.side ?? ""),
  ].join("\u0000");
}
/** Listings kept out of merging by a blank key field, by category and field. */
const heldApart = new Map<string, number>();

/**
 * Owner, 2026-10-03: in a cross-vendor merge every field except the name,
 * the photos and the sources takes the winner's value when it has one, and
 * otherwise the first non-blank value of the other vendors in priority
 * order. An extra spec the winner does not list is added the same way.
 * Every fill is logged; a real disagreement still follows the winner.
 */
function resolveMerge(sorted: Listing[]): {
  fields: Record<string, string>;
  extra: [string, string][];
  fills: string[];
  notFilled: string[];
} {
  const winner = sorted[0]!;
  const notFilled: string[] = [];
  const fields: Record<string, string> = { ...winner.fields };
  const extra: [string, string][] = [...winner.extra];
  const labels = new Set(extra.map(([label]) => label.toLowerCase()));
  const fills: string[] = [];
  for (const other of sorted.slice(1)) {
    const from = `${other.primary.source} ${other.primary.sku}`;
    for (const [field, value] of Object.entries(other.fields)) {
      if (field === F.name || value === "" || (fields[field] ?? "") !== "") continue;
      fields[field] = value;
      fills.push(`${field}: ${value} (from ${from})`);
    }
    for (const [label, value] of other.extra) {
      if (labels.has(label.toLowerCase())) continue;
      if (VENDOR_OWN_CODES.has(label)) {
        notFilled.push(`extra_specs: ${label}: ${value} (from ${from}, not filled: a vendor's own code)`);
        continue;
      }
      labels.add(label.toLowerCase());
      extra.push([label, value]);
      fills.push(`extra_specs: ${label}: ${value} (from ${from})`);
    }
  }
  return { fields, extra, fills, notFilled };
}

const rank = (vendor: string) => {
  const at = VENDOR_PRIORITY.indexOf(vendor);
  if (at === -1) fail(`vendor "${vendor}" has no place in the merge priority.`);
  return at;
};

interface ReportLine {
  kind: string;
  kept: string;
  merged: string[];
  sources: string[];
  disagreed: string[];
  winner: string;
  values: string;
  filled: string[];
  notFilled?: string[];
}
const mergeReport: ReportLine[] = [];

/** Every comparable value of a listing: its columns, extra specs and photos. */
function comparable(listing: Listing): Map<string, string> {
  const values = new Map<string, string>();
  for (const [field, value] of Object.entries(listing.fields)) values.set(field, value);
  for (const [label, value] of listing.extra) values.set(`extra_specs: ${label}`, value);
  listing.images.forEach((path, index) => values.set(`image_${index + 1}`, path));
  return values;
}

function disagreements(listings: Listing[]): { fields: string[]; values: string } {
  const maps = listings.map(comparable);
  const names = new Set(maps.flatMap((map) => [...map.keys()]));
  const fields: string[] = [];
  const parts: string[] = [];
  for (const name of names) {
    const each = maps.map((map) => map.get(name) ?? "");
    // A blank beside a value is not a disagreement (it is a fill, logged
    // separately); two different values are.
    if (new Set(each.filter((value) => value !== "")).size < 2) continue;
    fields.push(name);
    parts.push(
      `${name}: ${listings.map((l, i) => `${l.primary.source}=${each[i] === "" ? "(blank)" : each[i]}`).join("; ")}`,
    );
  }
  return { fields, values: parts.join(" || ") };
}

const rowIds = (listings: Listing[]) => listings.flatMap((l) => l.rows.map((r) => r.rowId));

function mergeCategory(listings: Listing[]): Product[] {
  const groups = new Map<string, Listing[]>();
  const products: Product[] = [];
  for (const listing of listings) {
    const key = mergeKey(listing);
    if (key === null) {
      products.push({ category: listing.category, listings: [listing] });
      continue;
    }
    const group = groups.get(key);
    if (group) group.push(listing);
    else groups.set(key, [listing]);
  }
  for (const group of groups.values()) {
    if (group.length === 1) {
      products.push({ category: group[0]!.category, listings: group });
      continue;
    }
    const vendors = group.map((l) => l.primary.source);
    if (new Set(vendors).size < vendors.length) {
      // Rule 4: a vendor's own separate SKUs are never merged, and a group
      // that holds two from one vendor merges nothing at all.
      for (const listing of group) products.push({ category: listing.category, listings: [listing] });
      const ids = rowIds(group);
      mergeReport.push({
        kind: "ambiguous_not_merged",
        kept: "",
        merged: ids,
        sources: group.map((l) => `${l.primary.source} ${l.primary.sku}`),
        disagreed: disagreements(group).fields,
        winner: "",
        values: disagreements(group).values,
        filled: [],
      });
      continue;
    }
    const sorted = [...group].sort((a, b) => rank(a.primary.source) - rank(b.primary.source));
    const winner = sorted[0]!;
    const product: Product = { category: winner.category, listings: sorted, ...resolveMerge(sorted) };
    if (sorted.length > MAX_SOURCES) {
      for (const listing of sorted) {
        issue(listing, `merged product would have ${sorted.length} sources (more than ${MAX_SOURCES})`);
      }
      continue;
    }
    products.push(product);
    const { fields, values } = disagreements(sorted);
    mergeReport.push({
      kind: "cross_vendor_merge",
      kept: winner.primary.rowId,
      merged: rowIds(sorted),
      sources: sorted.map((l) => `${l.primary.source} ${l.primary.sku}`),
      disagreed: fields,
      winner: winner.primary.source,
      values,
      filled: product.fills ?? [],
      notFilled: product.notFilled ?? [],
    });
  }
  return products;
}

/* --- Output ------------------------------------------------------------------------ */

const SHARED_COLUMNS = [F.category, F.brand, F.model, F.name, F.description, F.gtin, F.extraSpecs];
const TIRE_COLUMNS = [
  F.tireSize, F.serviceType, F.loadIndex, F.speedRating, F.loadRange, F.plyRating, F.utqg,
  F.season, F.isXl, F.winterApproved, F.studdable, F.runFlat,
];
const WHEEL_COLUMNS = [
  F.wheelDiameter, F.wheelWidth, F.boltPatterns, F.offsetMm, F.centerBoreMm, F.backspacing,
  F.wheelFinish, F.wheelFinishFamily, F.wheelColor, F.lugCount, F.material, F.wheelSeatType,
  F.loadRatingLbs, F.tpmsCompatible, F.winterCompatible,
];
const ACCESSORY_COLUMNS = [
  F.accessoryType, F.threadSize, F.accessorySeatType, F.accessoryFinish, F.packQuantity,
  F.outerDiameterMm, F.innerDiameterMm, F.partType, F.weightLb,
];
const DECIMALS: Record<string, number> = {
  [F.wheelDiameter]: 2,
  [F.wheelWidth]: 2,
  [F.offsetMm]: 1,
  [F.centerBoreMm]: 2,
  [F.backspacing]: 3,
  [F.outerDiameterMm]: 2,
  [F.innerDiameterMm]: 2,
  [F.weightLb]: 2,
};
const sourceColumn = (part: "vendor" | "sku" | "url" | "price", n: number) =>
  IMPORT_MAPPING.sources[part].replace("{n}", String(n));

function headerFor(sourceCount: number): string[] {
  const sources: string[] = [];
  for (let n = 1; n <= sourceCount; n += 1) {
    sources.push(sourceColumn("vendor", n), sourceColumn("sku", n), sourceColumn("url", n), sourceColumn("price", n));
  }
  return [
    ...SHARED_COLUMNS,
    ...TIRE_COLUMNS,
    ...WHEEL_COLUMNS,
    ...ACCESSORY_COLUMNS,
    ...sources,
    ...PHOTO_COLUMNS,
    "row_id",
    "merged_row_ids",
  ];
}

function productRecord(product: Product): Record<string, string> {
  const winner = product.listings[0]!;
  const record: Record<string, string> = { ...(product.fields ?? winner.fields) };
  record[F.gtin] = "";
  record[F.extraSpecs] = (product.extra ?? winner.extra).map(([label, value]) => `${label}: ${value}`).join(" | ");
  product.listings.forEach((listing, index) => {
    const n = index + 1;
    const row = listing.primary;
    record[sourceColumn("vendor", n)] = row.source;
    record[sourceColumn("sku", n)] = row.sku;
    record[sourceColumn("url", n)] = row.cells.product_url ?? "";
    record[sourceColumn("price", n)] = row.price;
  });
  winner.images.forEach((path, index) => {
    const column = PHOTO_COLUMNS[index];
    if (column) record[column] = path;
  });
  record.row_id = winner.primary.rowId;
  record.merged_row_ids = rowIds(product.listings).join(";");
  return record;
}

/* --- Main ---------------------------------------------------------------------------- */

async function main(): Promise<void> {
  // Vendor prices: one per (category, vendor, SKU). A -B pair's two final
  // rows share a SKU, so they must share a price too.
  const prices = new Map<string, Set<string>>();
  for (const category of CATEGORIES) {
    for (const sheet of await readWorkbook(join(finalDir, WORKBOOK[category]))) {
      if (!sheet.headers.includes("vendor_sku") || !sheet.headers.includes("vendor_price")) {
        fail(`${WORKBOOK[category]} sheet ${sheet.name} has no vendor_sku or vendor_price column.`);
      }
      for (const row of sheet.rows) {
        const key = `${category}\u0000${sheet.name}\u0000${row.vendor_sku}`;
        const set = prices.get(key) ?? new Set<string>();
        set.add(row.vendor_price ?? "");
        prices.set(key, set);
      }
    }
  }

  const inputs: Record<Category, InputRow[]> = { tires: [], wheels: [], accessories: [] };
  const inputHeaders: Record<Category, string[]> = { tires: [], wheels: [], accessories: [] };
  const allRowIds = new Set<string>();
  for (const category of CATEGORIES) {
    const sheets = await readWorkbook(join(shareDir, WORKBOOK[category]));
    if (sheets.length !== 1 || !sheets[0]) fail(`${WORKBOOK[category]} should hold one sheet.`);
    const sheet = sheets[0];
    inputHeaders[category] = sheet.headers;
    sheet.rows.forEach((cells, index) => {
      const rowId = cells.row_id ?? "";
      if (rowId === "" || allRowIds.has(rowId)) fail(`${WORKBOOK[category]} row ${index + 2}: row_id "${rowId}" is blank or repeated.`);
      allRowIds.add(rowId);
      const source = cells.source ?? "";
      const sku = cells.vendor_sku ?? "";
      const found = prices.get(`${category}\u0000${source}\u0000${sku}`);
      const row: InputRow = { category, index, rowId, source, sku, cells, price: "" };
      inputs[category].push(row);
      if (!found || found.size !== 1) {
        issues.push({
          rowId, source, sku, category,
          problem: found
            ? "needs owner ruling: the final workbook gives this SKU more than one vendor price"
            : "no vendor price: SKU not found in the final workbook",
        });
        return;
      }
      const price = [...found][0] ?? "";
      if (price === "" || !/^\d+(\.\d{1,2})?$/.test(price) || Number(price) === 0) {
        issues.push({ rowId, source, sku, category, problem: `needs owner ruling: vendor price "${price}"` });
        return;
      }
      row.price = price;
    });
  }
  const issued = () => new Set(issues.map((i) => i.rowId));
  const priced = (rows: InputRow[]) => {
    const skip = issued();
    return rows.filter((row) => !skip.has(row.rowId));
  };

  // Listings.
  const listings: Record<Category, Listing[]> = {
    tires: priced(inputs.tires).map(tireListing),
    wheels: [],
    accessories: priced(inputs.accessories).map(accessoryListing),
  };
  const pairs = new Map<string, InputRow[]>();
  const wheelUnits: InputRow[][] = [];
  for (const row of priced(inputs.wheels)) {
    const b = /^(.*)-B(\d)$/.exec(row.rowId);
    if (!b) {
      wheelUnits.push([row]);
      continue;
    }
    const key = `${row.source}\u0000${row.sku}\u0000${b[1]}`;
    const pair = pairs.get(key);
    if (pair) pair.push(row);
    else {
      const fresh = [row];
      pairs.set(key, fresh);
      wheelUnits.push(fresh);
    }
  }
  for (const unit of wheelUnits) {
    unit.sort((a, b) => a.rowId.localeCompare(b.rowId));
    const listing = wheelListing(unit);
    if (unit.length === 1 && /-B\d$/.test(unit[0]!.rowId)) {
      listing.problems.push("needs owner ruling: a -B row with no partner");
    }
    listings.wheels.push(listing);
  }
  const listingCount = Object.fromEntries(CATEGORIES.map((c) => [c, listings[c].length])) as Record<Category, number>;

  // Problems found while mapping take the listing out before merging.
  const valid: Record<Category, Listing[]> = { tires: [], wheels: [], accessories: [] };
  for (const category of CATEGORIES) {
    for (const listing of listings[category]) {
      if (listing.problems.length > 0) issue(listing, [...new Set(listing.problems)].join("; "));
      else valid[category].push(listing);
    }
  }

  let products: Product[] = [
    ...mergeCategory(valid.tires),
    ...mergeCategory(valid.wheels),
    ...valid.accessories.map((listing) => ({ category: listing.category, listings: [listing] })),
  ];
  const order = (p: Product) =>
    CATEGORIES.indexOf(p.category) * 1e6 + p.listings[0]!.primary.index;
  products.sort((a, b) => order(a) - order(b));

  // Self-check with the importer's own planner; a refused row becomes an issue.
  let header: string[] = [];
  let records: Record<string, string>[] = [];
  for (let pass = 1; ; pass += 1) {
    const widest = Math.max(1, ...products.map((p) => p.listings.length));
    header = headerFor(widest);
    records = products.map(productRecord);
    const rows: ImportRow[] = records.map((record, index) => ({
      row: index + 2,
      cells: header.map((column) => record[column] ?? ""),
    }));
    const plan = planImport(header, rows, IMPORT_MAPPING, { status: "published" });
    if (plan.rejected.length === 0) {
      if (plan.products.length !== products.length) fail("the importer would create a different number of products.");
      break;
    }
    if (pass > 3) fail("the importer keeps refusing rows after three passes.");
    const refused = new Set(plan.rejected.map((r) => r.row));
    const messages = new Map(
      plan.rejected.map((r) => [r.row, r.reasons.map((x) => `${x.column}: ${x.message}`).join("; ")]),
    );
    products = products.filter((product, index) => {
      if (!refused.has(index + 2)) return true;
      for (const listing of product.listings) {
        issue(listing, `importer refuses it: ${messages.get(index + 2) ?? ""}`);
      }
      return false;
    });
  }
  // Drop report lines for merges that ended in issues.
  const loaded = new Set(records.flatMap((r) => (r.merged_row_ids ?? "").split(";")));

  /* --- Checks -------------------------------------------------------------- */
  const failures: string[] = [];
  const seen = new Map<string, number>();
  for (const id of [...loaded, ...issues.map((i) => i.rowId)]) seen.set(id, (seen.get(id) ?? 0) + 1);
  const twice = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  const missing = [...allRowIds].filter((id) => !seen.has(id));
  const stray = [...seen.keys()].filter((id) => !allRowIds.has(id));
  if (twice.length) failures.push(`${twice.length} row ids appear more than once (${twice.slice(0, 5).join(", ")})`);
  if (missing.length) failures.push(`${missing.length} input row ids are missing (${missing.slice(0, 5).join(", ")})`);
  if (stray.length) failures.push(`${stray.length} unknown row ids (${stray.slice(0, 5).join(", ")})`);
  for (const record of records) {
    if (!(record.merged_row_ids ?? "").split(";").includes(record.row_id ?? "")) {
      failures.push(`row ${record.row_id}: row_id is not in merged_row_ids`);
    }
  }
  const pairsSeen = new Set<string>();
  for (const record of records) {
    for (let n = 1; n <= MAX_SOURCES; n += 1) {
      const vendor = record[sourceColumn("vendor", n)] ?? "";
      const sku = record[sourceColumn("sku", n)] ?? "";
      if (vendor === "" && sku === "") continue;
      const id = `${vendor}\u0000${sku}`;
      if (pairsSeen.has(id)) failures.push(`${vendor} SKU ${sku} appears twice`);
      pairsSeen.add(id);
    }
  }
  const allowed: [string, Set<string>][] = [
    [F.season, new Set(Object.values(SEASONS))],
    [F.serviceType, SERVICE_TYPES],
    [F.accessoryType, ACCESSORY_LABELS],
    [F.category, new Set(CATEGORIES)],
  ];
  const required: Record<Category, string[]> = {
    tires: [F.brand, F.name, F.tireSize],
    wheels: [F.brand, F.name, F.wheelDiameter, F.wheelWidth],
    accessories: [F.name, F.accessoryType],
  };
  const numericColumns = new Set([
    F.plyRating, F.lugCount, F.loadRatingLbs, F.packQuantity, ...Object.keys(DECIMALS),
    ...Array.from({ length: MAX_SOURCES }, (_, i) => sourceColumn("price", i + 1)),
  ]);
  for (const record of records) {
    const category = record[F.category] as Category;
    for (const [column, values] of allowed) {
      const value = record[column] ?? "";
      if (value !== "" && !values.has(value)) failures.push(`row ${record.row_id}: ${column} "${value}" is not allowed`);
    }
    for (const column of required[category] ?? []) {
      if ((record[column] ?? "") === "") failures.push(`row ${record.row_id}: ${column} is blank`);
    }
    for (const column of PHOTO_COLUMNS) {
      const path = record[column] ?? "";
      if (path !== "" && !existsSync(join(shareDir, path))) failures.push(`row ${record.row_id}: ${path} does not exist`);
    }
    for (const [column, value] of Object.entries(record)) {
      if (/^(n\/a|-)$/i.test(value)) failures.push(`row ${record.row_id}: ${column} is "${value}"`);
      if (/\d\.\d{7,}/.test(value) && numericColumns.has(column)) failures.push(`row ${record.row_id}: ${column} ${value} looks like float noise`);
      if (numericColumns.has(column) && value !== "") {
        if (!/^[+-]?\d+(\.\d+)?$/.test(value)) failures.push(`row ${record.row_id}: ${column} "${value}" is not a plain number`);
        const max = DECIMALS[column] ?? (column.startsWith("source_price_") ? 2 : 0);
        if (decimalsOf(value) > max) failures.push(`row ${record.row_id}: ${column} ${value} has more than ${max} decimals`);
        if (Number(value) === 0 && column !== F.offsetMm) failures.push(`row ${record.row_id}: ${column} is 0`);
      }
    }
  }

  /* --- Write ---------------------------------------------------------------- */
  mkdirSync(outDir, { recursive: true });
  let catalogue = csvLine(header);
  for (const record of records) catalogue += csvLine(header.map((column) => record[column] ?? ""));
  writeFileSync(join(outDir, "catalogue.csv"), catalogue);

  const inputOrder = new Map<string, number>();
  CATEGORIES.forEach((category, c) => inputs[category].forEach((row) => inputOrder.set(row.rowId, c * 1e6 + row.index)));
  issues.sort((a, b) => (inputOrder.get(a.rowId) ?? 0) - (inputOrder.get(b.rowId) ?? 0));
  let issuesCsv = csvLine(["row_id", "source", "vendor_sku", "category", "problem"]);
  for (const i of issues) issuesCsv += csvLine([i.rowId, i.source, i.sku, i.category, i.problem]);
  writeFileSync(join(outDir, "issues.csv"), issuesCsv);

  const finalReport = mergeReport.filter((line) => line.merged.every((id) => loaded.has(id)) || line.kind === "ambiguous_not_merged");
  for (const pair of bPairTitles) {
    finalReport.push({
      kind: pair.outcome,
      kept: pair.rows[0]!.rowId,
      merged: pair.rows.map((r) => r.rowId),
      sources: [`${pair.rows[0]!.source} ${pair.rows[0]!.sku}`],
      disagreed: ["name"],
      winner: pair.rows[0]!.source,
      values: `name: ${pair.rows.map((r, i) => `${r.rowId}=${pair.titles[i]}`).join("; ")} (written: ${pair.chosen})`,
      filled: [],
    });
  }
  let report = csvLine(["kind", "kept_row_id", "merged_row_ids", "sources", "fields_that_disagreed", "winning_source", "values", "filled_from_other_vendors", "other_vendor_codes_not_filled"]);
  for (const line of finalReport) {
    report += csvLine([line.kind, line.kept, line.merged.join(";"), line.sources.join(";"), line.disagreed.join(";"), line.winner, line.values, line.filled.join(" || "), (line.notFilled ?? []).join(" || ")]);
  }
  writeFileSync(join(outDir, "merge-report.csv"), report);

  // needs_review rows that are loaded (rule 10).
  let review = csvLine(["row_id", "source", "vendor_sku", "category", "title", "reason"]);
  const unexplained: string[] = [];
  let reviewCount = 0;
  let reviewCleared = 0;
  for (const category of CATEGORIES) {
    for (const row of inputs[category]) {
      if (!yes(row.cells.needs_review ?? "") || !loaded.has(row.rowId)) continue;
      if (category === "wheels" && REVIEW_CLEARED_WHEEL_BRANDS.has(row.cells.brand ?? "")) {
        reviewCleared += 1;
        continue;
      }
      let reason = "";
      if (category === "wheels" && WHEEL_BRANDS[row.cells.brand ?? ""]) reason = REVIEW_WHEEL_BRAND;
      else if (category === "tires" && row.source === "Vertex Tires" && (row.cells.brand ?? "") !== "") {
        const key = modelKey(row.cells.brand ?? "", row.cells.model_clean ?? "");
        if (SEASON_BY_MAKER[key] || SEASON_REVIEWED_AS_IS.has(key)) {
          reviewCleared += 1;
          continue;
        }
        reason = REVIEW_VERTEX_SEASON;
      }
      else {
        reason = "needs owner ruling: no known reason";
        unexplained.push(row.rowId);
      }
      review += csvLine([row.rowId, row.source, row.sku, category, row.cells.title ?? "", reason]);
      reviewCount += 1;
    }
  }
  writeFileSync(join(outDir, "needs-review.csv"), review);

  /* --- Summary --------------------------------------------------------------- */
  const productsBy = (category: Category) => records.filter((r) => r[F.category] === category);
  const issuesBy = new Map<string, number>();
  for (const i of issues) {
    // Group by the problem with its quoted value removed.
    const label = i.problem.replace(/"[^"]*"/g, "…").replace(/images\/\S+/g, "…").replace(/\d+ sources/g, "N sources");
    issuesBy.set(label, (issuesBy.get(label) ?? 0) + 1);
  }
  const merges = finalReport.filter((l) => l.kind.startsWith("cross_vendor_merge"));
  const ambiguous = finalReport.filter((l) => l.kind === "ambiguous_not_merged");
  const mergedAway = merges.reduce((sum, l) => sum + l.sources.length - 1, 0);
  const bJoined = wheelUnits.filter((u) => u.length > 1).reduce((sum, u) => sum + u.length - 1, 0);
  const fills = merges.flatMap((l) => l.filled);
  const fillsBy = new Map<string, number>();
  for (const fill of fills) {
    const field = fill.startsWith("extra_specs: ")
      ? fill.slice(0, fill.indexOf(": ", 13))
      : fill.slice(0, fill.indexOf(": "));
    fillsBy.set(field, (fillsBy.get(field) ?? 0) + 1);
  }
  const extraCount = records.filter((r) => (r[F.extraSpecs] ?? "") !== "").length;
  const lines: string[] = [
    `Built: ${new Date().toISOString()}`,
    `Share:  ${shareDir}`,
    `Final:  ${finalDir}`,
    "",
    "Input rows",
    ...CATEGORIES.map((c) => `  ${c.padEnd(12)} ${inputs[c].length}`),
    `  ${"all".padEnd(12)} ${allRowIds.size}`,
    "",
    "Listings after the -B join",
    ...CATEGORIES.map((c) => `  ${c.padEnd(12)} ${listingCount[c]}`),
    `  -B pairs joined: ${bJoined}; their titles differ in ${bPairTitles.filter((p) => new Set(p.titles).size > 1).length}, of which ${bPairTitles.filter((p) => p.outcome === "b_pair_title_rewritten" && new Set(p.titles).size > 1).length} were rewritten to name both patterns`,
    `  titles rewritten to name both patterns: ${bPairTitles.filter((p) => p.outcome === "b_pair_title_rewritten").length}; shared titles naming no pattern, left as written: ${bPairTitles.filter((p) => p.outcome === "b_pair_title_names_no_pattern").length}`,
    `  titles NOT rewritten (needs owner ruling: the pattern is already part of a "/" list, or named more than once): ${bPairTitles.filter((p) => p.outcome === "b_pair_title_not_rewritten").length}`,
    "",
    "Products written to catalogue.csv",
    ...CATEGORIES.map((c) => `  ${c.padEnd(12)} ${productsBy(c).length}`),
    `  ${"all".padEnd(12)} ${records.length}`,
    `  with extra_specs: ${extraCount}`,
    `  source columns written: ${header.filter((h) => h.startsWith("source_vendor_")).length} groups`,
    "",
    `Rows merged away: ${allRowIds.size - records.length - issues.length}`,
    `  by the -B join:            ${bJoined}`,
    `  by cross-vendor merges:    ${mergedAway}`,
    `Cross-vendor merges: ${merges.length} products`,
    ...CATEGORIES.map((c) => `  ${c.padEnd(12)} ${productsBy(c).filter((r) => (r[sourceColumn("vendor", 2)] ?? "") !== "").length}`),
    `Blanks filled from a lower-priority vendor: ${fills.length} values in ${merges.filter((l) => l.filled.length > 0).length} merged products`,
    ...[...fillsBy].sort((a, b) => b[1] - a[1]).map(([field, n]) => `  ${String(n).padStart(6)}  ${field}`),
    "Merge keys (owner, 2026-10-03): a blank in a key field never matches, so a listing whose vendor",
    "left one blank is never merged on it and stays its own product.",
    "  Tires:  brand, model, tire size, load_index, speed_rating must all be filled; load_index_dual is",
    "          compared but may be blank.",
    "  Wheels: brand, model, diameter, width, bolt pattern(s), offset_mm, finish, center_bore_mm must all",
    "          be filled; side is compared but may be blank.",
    "  The two exemptions, and why: a blank load_index_dual is the vendor saying the tire has no dual",
    "  (rear-pair) index, which is true of most tires; a blank side is the vendor saying the wheel is not",
    "  made as a left/right pair, which is true of every wheel but Auto Country's handed ones. In both,",
    "  blank is a statement, not a gap. Both are still compared, so a dual-index tire never merges with a",
    "  single-index one, and a handed wheel never merges with an unhanded one.",
    "Listings kept out of merging by a blank key field",
    ...[...heldApart].sort((a, b) => b[1] - a[1]).map(([label, n]) => `  ${String(n).padStart(6)}  ${label}`),
    `Ambiguous groups (two or more listings from one vendor, nothing merged): ${ambiguous.length}`,
    `  of which another vendor was also in the group (a cross-vendor merge held back): ${ambiguous.filter((l) => new Set(l.sources.map((s) => s.slice(0, s.lastIndexOf(" ")))).size > 1).length}`,
    "",
    `Rows sent to issues.csv: ${issues.length}`,
    ...[...issuesBy].sort((a, b) => b[1] - a[1]).map(([label, n]) => `  ${String(n).padStart(6)}  ${label}`),
    "",
    `needs_review rows loaded (needs-review.csv): ${reviewCount}${unexplained.length ? ` (${unexplained.length} with no known reason)` : ""}; cleared by owner ruling and left out: ${reviewCleared} (D125 Trailer; D126 brand splits and reviewed Vertex seasons)`,
    `Tire seasons set by the maker (D126): ${seasonByMaker.length} listings`,
    ...[...seasonByMaker.reduce((m, s) => m.set(`${s.from || "blank"} -> ${s.to}`, (m.get(`${s.from || "blank"} -> ${s.to}`) ?? 0) + 1), new Map<string, number>())].map(([label, n]) => `  ${String(n).padStart(6)}  ${label}`),
    `Float-noise values cleaned: ${noiseCleaned}`,
    "",
    "Input columns not written as columns, and why",
    ...CATEGORIES.flatMap((c) => [
      `  ${c}:`,
      ...inputHeaders[c]
        .filter((h) => !["row_id", "description"].includes(h))
        .filter((h) => !header.includes(h) || NOT_WRITTEN[c][h])
        .map((h) => `    ${h.padEnd(22)} ${NOT_WRITTEN[c][h] ?? "!! not handled by this script"}`),
    ]),
    "",
    failures.length ? `CHECKS FAILED (${failures.length}):` : "All checks passed.",
    ...failures.slice(0, 50).map((f) => `  ${f}`),
  ];
  const summary = `${lines.join("\n")}\n`;
  writeFileSync(join(outDir, "summary.txt"), summary);
  console.log(summary);
  console.log(`Output folder: ${outDir}`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
