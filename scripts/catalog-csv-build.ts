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
     merge-report.csv  every merge and what disagreed, every group that could
                       not be merged, every -B pair whose titles differ, and the
                       data-QA edits each merged listing carried before merging
     changes-review.csv one row per data edit or merge decision of the data-QA
                       rulings M1 to M9 (owner, 2026-10-03), with its evidence
     needs-review.csv  the rows the vendor sheets flag `needs_review`, loaded
                       normally, with why they are flagged
     summary.txt       the counts, and every input column not written and why

   The data-QA rulings M1 to M9 of 2026-10-03 (merge over blank key fields,
   accessories on one SKU, identical same-vendor listings, model spellings,
   accessory names, blank models, pack sizes, small data fixes, descriptions)
   sit in the section "Data-QA rulings" below, each as a named table or function.

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

import { createHash } from "node:crypto";
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
  // Third round, the models left open after the second (owner, 2026-10-03, D126):
  "haida|hd869": { season: "all_season", source: "haidatires.ca/hd869-m%2Ft (Mud Terrain; group-B rule)" },
  "transeagle|trail blazer mt": { season: "all_season", source: "quattrotires.com (mud-terrain; group-B rule)" },
  "greentrac|quest-x": { season: "all_season", source: "Auto Country and North American retailers (Greentrac names no season)" },
  "greentrac|quest-x suv": { season: "all_season", source: "Auto Country and North American retailers (Greentrac names no season)" },
  "mazzini|eco602": { season: "all_season", source: "Direct Auto Import, Mazzini's Canadian distributor (owner's choice over mazzinitires.ca)" },
  "mazzini|eco603": { season: "all_season", source: "Direct Auto Import, Mazzini's Canadian distributor (owner's choice over mazzinitires.ca)" },
  "mazzini|falconer f1": { season: "all_season", source: "Direct Auto Import, Mazzini's Canadian distributor (owner's choice over mazzinitires.ca)" },
  "yokohama|geolandar a/t g015": { season: "all_weather", source: "yokohama.ca/en/tires/geolandar-at-g015 (tagged All-Weather, as G018)" },
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

/**
 * D126 (owner, 2026-10-03): an accessory brand that is another spelling of a
 * brand already in the catalogue takes that brand. The product name keeps the
 * vendor's wording.
 */
const ACCESSORY_BRANDS: Record<string, string> = {
  DAICAPS: "DAI Wheels",
};

/**
 * LA-06 (launch audit, D145; owner 2026-10-04: "fix whatever you can based on
 * market data and vendor data"). Direct Auto Import gives these accessories no
 * brand; `brand_clean` was derived from the fit list. The vendor's own photo
 * for the code and DAI's code prefix (ART / ADAI / ARUFF) say otherwise.
 * Production was corrected in place the same day (slugs unchanged, D107b(1));
 * this keeps a rebuild in agreement. Keyed on the vendor SKU.
 */
const ACCESSORY_BRAND_FIXES: Record<string, { to: string; reason: string }> = {
  ARTBC007BK: { to: "ART Replica", reason: "DAI's own photo shows the ART mark; code prefix ART" },
  "210K62AB1": { to: "DAI Wheels", reason: "DAI's own photo shows DAI ALLOYS; 7 of 16 fitted designs are DW" },
  "210K62BB1": { to: "DAI Wheels", reason: "DAI's own photo shows DAI ALLOYS" },
  "210K62ACH": { to: "DAI Wheels", reason: "DAI's own photo shows DAI ALLOYS; 5 of 8 fitted designs are DW" },
  "241K64BB1": { to: "DAI Wheels", reason: "DAI's own photo shows DAI ALLOYS" },
  ARUFF645BWA6177: { to: "Ruffino", reason: "DAI's own photo shows RUFFINO; code prefix ARUFF (owner confirmed)" },
};

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
    mud_snow: "written as mud_snow (D142)",
    sidewall: "written in extra_specs as Sidewall",
    part_number: "not written: a tire carries no part number (D142)",
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
    part_number: "written as part_number (D142)",
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
  /** Data-QA edits applied to this listing, for merge-report.csv. */
  edits: { rule: string; field: string; before: string; after: string }[];
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
    edits: [],
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
  if (c.brand_clean) f[F.brand] = ACCESSORY_BRANDS[c.brand_clean] ?? c.brand_clean;
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

/* --- Data-QA rulings M1 to M9 (owner, 2026-10-03, "data QA") ------------------ */

/**
 * Every data edit or merge decision made by the data-QA rules is one row of
 * changes-review.csv, so the owner can read, veto and trace each of them.
 */
interface Change {
  rule: string;
  rowIds: string[];
  field: string;
  before: string;
  after: string;
  reason: string;
}
const changes: Change[] = [];
function logChange(
  rule: string,
  rowIds: readonly string[],
  field: string,
  before: string,
  after: string,
  reason: string,
): void {
  changes.push({ rule, rowIds: [...rowIds], field, before, after, reason });
}
const idsOf = (listing: Listing) => listing.rows.map((row) => row.rowId);

/** Sets (or, with "", clears) a listing field and records the edit. */
function editField(rule: string, listing: Listing, field: string, after: string, reason: string): void {
  const before = listing.fields[field] ?? "";
  if (before === after) return;
  if (after === "") delete listing.fields[field];
  else listing.fields[field] = after;
  listing.edits.push({ rule, field, before, after });
  logChange(rule, idsOf(listing), field, before, after, reason);
}

/** Lower case, spaces and dashes ignored (M1 SKU borrow, M2). */
const skuKey = (sku: string) => sku.toLowerCase().replace(/[\s-]+/g, "");
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * M4 (owner 2026-10-03, data QA): model spellings that are one tire or wheel
 * line, folded to ONE spelling. One entry per fold, so any can be vetoed.
 * `to` is the spelling carried by more products in the 2026-10-03 catalogue
 * (counts in `why`); on a tie the priority vendor's spelling would win (no
 * tie occurred). Key: category|brand|from, lower case. Anything not sure to
 * be the same line is NOT here; it is listed in changes-review.csv as
 * "not folded" (`MODEL_NOT_FOLDED`).
 */
const MODEL_ALIASES: { category: Category; brand: string; from: string; to: string; why: string }[] = [
  // Same vendor SKU listed by two vendors under both spellings (47 pairs).
  { category: "tires", brand: "Zmax", from: "Winternova I", to: "Winternova Stud I", why: "Stud I 32 products vs I 10; 10 pairs share a vendor SKU across two vendors" },
  { category: "tires", brand: "Zmax", from: "Winternova II", to: "Winternova Stud II", why: "Stud II 84 vs II 23; 21 pairs share a vendor SKU" },
  { category: "tires", brand: "Zmax", from: "Winternova III", to: "Winternova Stud III", why: "Stud III 64 vs III 18; 19 pairs share a vendor SKU" },
  // Haida: retailers and the maker's dealers sell one tire under each pair.
  { category: "tires", brand: "Haida", from: "HD 878", to: "HD878 R/T", why: "HD878 R/T 44 vs HD 878 4; the HD878 is the R/T (rugged terrain), e.g. simpletire.com/brands/haida-tires/hd878-r-t" },
  { category: "tires", brand: "Haida", from: "HD878 Rugged Terrain", to: "HD878 R/T", why: "HD878 R/T 44 vs 1; R/T means rugged terrain" },
  { category: "tires", brand: "Haida", from: "A/T HD828", to: "HD828", why: "HD828 4 vs A/T HD828 2; one all-terrain tire, retailers write it 'Haida A/T HD828' (e.g. tiremart.com haida-hd828)" },
  { category: "tires", brand: "Haida", from: "HD828 A/T", to: "HD828", why: "HD828 4 vs 1; same tire, A/T is its type" },
  { category: "tires", brand: "Haida", from: "HD828 All-Terrain", to: "HD828", why: "HD828 4 vs 1; same tire, All-Terrain is its type" },
  { category: "tires", brand: "Haida", from: "A/T HD829", to: "HD829", why: "HD829 25 vs 1; A/T is the type prefix" },
  { category: "tires", brand: "Haida", from: "HD869 M/T", to: "HD869", why: "HD869 86 vs 1; the HD869 is the M/T (D126 cites haidatires.ca/hd869-m/t)" },
  { category: "tires", brand: "Haida", from: "HD837 A/S", to: "HD837", why: "HD837 6 vs 2; retailers list one tire 'Haida HD837 H/T AS' (all-season)" },
  { category: "tires", brand: "Haida", from: "HD837 Highway", to: "HD837", why: "HD837 6 vs 4; Highway is H/T, the same HD837" },
  // Habilead.
  { category: "tires", brand: "Habilead", from: "RS26 Practical Max", to: "RS 26 Practical Max H/P", why: "RS 26 Practical Max H/P 7 vs 1; the RS26 is the PracticalMax H/P (tyreleader.co.uk practicalmax-h-p-rs26)" },
  { category: "tires", brand: "Habilead", from: "HF330 Headking H/P", to: "HF330 Head King", why: "HF330 Head King 8 vs 2; both are the Headking HF330 (tiremart.com headking-hf330-tires)" },
  { category: "tires", brand: "Habilead", from: "H202 Comfort Max", to: "H202", why: "H202 3 vs 1; the H202 Comfort Max A/S, one tire" },
  { category: "tires", brand: "Habilead", from: "H202 Comfort Max A/S", to: "H202", why: "H202 3 vs 2; the H202 Comfort Max A/S, one tire" },
  // Others.
  { category: "tires", brand: "Michelin", from: "Cross Climate 2 A/W", to: "CrossClimate 2", why: "CrossClimate 2 30 vs 1; Michelin writes CrossClimate 2 (michelin.ca crossclimate-2)" },
  { category: "tires", brand: "Falken", from: "WildPeak M/T 01", to: "Wildpeak M/T MT01", why: "Wildpeak M/T MT01 3 vs 2; Falken's M/T01, one tire" },
  { category: "tires", brand: "Mileking", from: "MK878", to: "MK878 R/T", why: "MK878 R/T 14 vs 1; same tire" },
  // D152 (owner 2026-10-05, launch audit LA-DATA-TIRES): every pair below has
  // same-size listings under both spellings, or is a typo / word order / doubled
  // word of the other; the spelling carried by more products wins (a tie goes to
  // the priority vendor's), as for the folds above.
  { category: "tires", brand: "Haida", from: "HD687 UHP", to: "HD 687", why: "HD 687 12 vs HD687 UHP 6; 3 sizes are listed under both (175/65R15 88T, 235/50R19 103V, 245/45R19 102H)" },
  { category: "tires", brand: "Haida", from: "HD697", to: "HD697 Performance", why: "HD697 Performance 11 vs HD697 7; 2 sizes are listed under both (245/45R20 103V, 255/45R20 105V)" },
  { category: "tires", brand: "Fronway", from: "Icemaster I", to: "Ice Master 1", why: "Ice Master 1 31 vs Icemaster I 16; 2 sizes are listed under both (225/40R19 93V, 235/55R20 105H)" },
  { category: "tires", brand: "Fronway", from: "Icemaster 11", to: "Icemaster II", why: "Icemaster II 21 vs 11 2; 11 is a typo for the Roman II (the brand's two models are I and II)" },
  { category: "tires", brand: "Fronway", from: "Roadpower 79 H/T", to: "Roadpower H/T 79", why: "Roadpower H/T 79 11 vs 1; the same words in another order" },
  { category: "tires", brand: "Rockblade", from: "Icecruiser 11", to: "Icecruiser II", why: "Icecruiser II 1 vs 11 1, both Wheel Works (a tie); 11 is a typo for the Roman II" },
  { category: "tires", brand: "Roadboss", from: "W301 Nixvia", to: "Nixvia W301", why: "1 vs 1, both Wheel Works (a tie); the brand's other models are written name then code (Concrossor S701)" },
  { category: "tires", brand: "Doublestar", from: "Winterking DW16+", to: "DW16 Winterking", why: "1 vs 1, so the priority vendor (Vertex) decides; 175/70R14 84S is listed under both" },
  { category: "tires", brand: "Toyo", from: "M-55 Black", to: "M55", why: "M55 2 vs M-55 Black 1" },
  { category: "tires", brand: "Continental", from: "Conticrosscontact LX", to: "CrossContact LX", why: "CrossContact LX 4 vs 1; 225/65R17 102 is listed under both" },
  { category: "tires", brand: "AMP", from: "Terrain Pro A/T Pro A/T", to: "Terrain Pro A/T", why: "Terrain Pro A/T 16 vs 4; the vendor doubled the words" },
  { category: "tires", brand: "AMP", from: "Terrain Attack M/T M/T A", to: "Terrain Attack M/T", why: "Terrain Attack M/T 12 vs 10; 5 sizes are listed under both (LT285/55R20 122/119, LT285/65R18 125/122, LT305/55R20 121/118, 33x12.50R20LT 114, 35x12.50R20LT 121)" },
  // Haida HD927 (summer, ultra high performance) and HD927SP (all-season) are two tires (simpletire.com/brands/haida-tires/hd927 and /hd927sp; carid.com hd927). The descriptor words after HD927 are the same tire.
  { category: "tires", brand: "Haida", from: "HD927 UHP Performance", to: "HD927", why: "HD927 8 vs 1; UHP Performance only describes the HD927, the maker's ultra high performance summer tire (simpletire.com/brands/haida-tires/hd927)" },
  { category: "tires", brand: "Haida", from: "HD927 High-Performance", to: "HD927", why: "HD927 8 vs 1; High-Performance only describes the HD927 (amazon.com B072PS83FJ 'Haida HD927 High Performance')" },
  { category: "wheels", brand: "Fuel Off-Road", from: "D500 DUALIE INNER", to: "D500 DUALLY INNER", why: "D500 DUALLY INNER 16 vs 1; DUALIE is a typo for DUALLY" },
  { category: "wheels", brand: "Spec-1 Racing", from: "STP-33", to: "SPT-33", why: "SPT-33 47 vs 1; the 47 are the real model, STP-33 a transposition" },
];
const MODEL_ALIAS_INDEX = new Map(
  MODEL_ALIASES.map((alias) => [`${alias.category}|${alias.brand}|${alias.from}`.toLowerCase(), alias]),
);
/** Pairs that look alike but are NOT folded (unsure they are one line). */
const MODEL_NOT_FOLDED: { category: Category; brand: string; models: string; why: string }[] = [
  { category: "tires", brand: "Nitto", models: "NT420V | NT-420S", why: "NT420V and NT420S are different Nitto tires (CUV vs SUV)" },
  { category: "tires", brand: "Toyo", models: "Observe G3-Ice | Observe G3-Ice Studded", why: "studded is a separate product" },
  { category: "tires", brand: "Goodyear", models: "Wrangler Duratrac RT | Wrangler Duratrac", why: "different tires" },
  { category: "tires", brand: "Goodyear", models: "EAGLE F1 SuperCar 3R | EAGLE F1 SuperCar 3", why: "3R is its own tire" },
  { category: "tires", brand: "Firestone", models: "Winterforce 2 UV | Winterforce 2", why: "UV is a separate tire" },
  { category: "tires", brand: "Haida", models: "HD317 | HD317 EV", why: "EV is a separate tire" },
  { category: "tires", brand: "Hankook", models: "Ion Evo AS SUV | Ion Evo AS SUV (EV)", why: "EV marking is a separate tire line" },
  { category: "tires", brand: "Nexen", models: "CP671H | CP671", why: "unsure whether the H is a speed rating or part of the name" },
  { category: "tires", brand: "Suretrac", models: "Comfortride GP | Comfortride", why: "unsure; no maker page" },
  { category: "tires", brand: "Michelin", models: "CrossClimate 2 | CrossClimate 2 CUV", why: "CUV is a separate tire" },
  { category: "tires", brand: "Mazzini", models: "ECO307 | ECO307+", why: "the plus is a different tire" },
  { category: "tires", brand: "Haida", models: "HD927 | HD927 SP", why: "D152: the maker sells them as two tires (HD927 summer, HD927SP all-season; simpletire.com), so they stay apart" },
  { category: "tires", brand: "Haida", models: "HD927SP UHP Performance | HD927 SP", why: "D152: the same all-season HD927SP (simpletire.com/brands/haida-tires/hd927sp), listed under both at 275/40R20 106W, but Vertex labels its one Summer and the priority rule would give the merged product that label; left apart until the owner rules on the Haida seasons" },
  { category: "tires", brand: "Fronway", models: "Roadpower H/T | Roadpower H/T 79", why: "D152: one listing with no 79 in the model; no size is listed under both" },
  { category: "tires", brand: "Doublestar", models: "DW16 | DW16 Winterking", why: "D152: the bare DW16 is a different size and vendor; not shown to be the same line" },
  { category: "tires", brand: "Fronway", models: "Ice Master 1 | Icemaster II", why: "D152: Icemaster I and II are the brand's two different models" },
  { category: "tires", brand: "Falken", models: "Azenis RT660 | Azenis RT660+", why: "D152: the plus is a different tire (ECO307 | ECO307+ precedent)" },
  { category: "tires", brand: "Venom Power", models: "Terra Hunter R/T | Terra Hunter R/T+", why: "D152: the plus is a different tire" },
  { category: "tires", brand: "Zeta", models: "Antarctica 5 | Antarctica 5+", why: "D152: the plus is a different tire" },
  { category: "tires", brand: "Continental", models: "VanContact A/S | Vancontact A/S Reinf", why: "D152: Reinf is the reinforced (XL) variant, a separate tire" },
  { category: "wheels", brand: "Fast Wheels", models: "EV01 | EV01(+)", why: "unsure whether (+) is a different wheel" },
  { category: "wheels", brand: "Fast Wheels", models: "FC04X | FC04V", why: "different wheels" },
  { category: "wheels", brand: "XF Off-Road", models: "XF-239 | XF-239C", why: "unsure; C may be a finish code" },
];

/**
 * M8 (a) (owner 2026-10-03, data QA): TIS dually wheels the vendor rounds to
 * 8.2 / 8.3. The maker's width is 8.25 (tiswheels.com/544 and every
 * retailer: bbwheelsonline.com/tis-544bm-dually-..., duallywheels.com 544BM
 * and D20B/D22B sets). Direct Auto Import's own page says 20x8.2.
 */
const TIS_WIDTH_FIX = {
  brand: "TIS Wheels",
  from: ["8.2", "8.3"],
  to: "8.25",
  reason:
    "vendor rounded 8.25 to 1 decimal; maker and retailers list this dually as 8.25 (tiswheels.com/544; bbwheelsonline.com tis-544bm-dually-wheel-20x8-25; duallywheels.com 20x8-25-tis-544bm / 22x8-25-tis-544b)",
};

/** M8 (b): Spec-1 SP-51 18x8 lists 5x114; the maker's table has 5x114.3 and no 5x114. */
const BOLT_FIXES: { rowId: string; from: string; to: string; reason: string }[] = [
  {
    rowId: "AC-W-SP-5118801638GB-C",
    from: "5x114",
    to: "5x114.3",
    reason: "spec1wheels.com/product/sp-51/ lists 5x114.3 as the single-drilling pattern for the 18x8 and no 5x114",
  },
];

/** M8 (c): brand respelling. Suretrac and Sierra are one maker (Staridge); the tire is sold under both names. */
const TIRE_BRAND_FIXES: Record<string, { to: string; reason: string }> = {
  "Suretrac / Sierra": {
    to: "Suretrac",
    reason:
      "one maker (Staridge) sells the Wide Climber / RT line as Suretrac/Sierra; simpletire.com/brands/suretrac-tires/wide-climber-m-t2 and Wheel Works list the same tires as Suretrac",
  },
};

/** M8 (f): the one tire with no season. */
const SEASON_FIXES: { rowId: string; season: string; reason: string }[] = [
  {
    rowId: "VX-T-47663201583293",
    season: "all_season",
    reason:
      "Goodyear lists the Wrangler Workhorse AT 2 as all-season / all-terrain with the three-peak snowflake (goodyear.com/en-ca/tires/wrangler-workhorse-at-2_25329; retailers); D126 rule B reads an all-terrain tire with the snowflake as all-season",
  },
];

/** M8 (g) and (h): wheel finish text, exact-meaning respellings only. */
const FINISH_TEXT_FIXES: Record<string, { to: string; reason: string }> = {
  "Nanoï Gold": { to: "Nano Gold", reason: "the only non-ASCII finish; Auto Country and the maker write Nano Gold (azarawheels.com AZA-525)" },
};

/** Backspacing check (M8 e): inches = width / 2 + offset / 25.4. */
const BACKSPACING_CHECK_FROM = 0.75;
const BACKSPACING_REPLACE_FROM = 1.5;

const SPEED_SYMBOLS = new Set("JKLMNPQRSTUHVWYZ".split(""));

/** M8 (d), (e), (i), (j) and the table fixes above, applied to one listing. */
function applyDataFixes(listing: Listing): void {
  const f = listing.fields;
  const id = listing.primary.rowId;

  if (listing.category === "tires") {
    // (c)
    const brandFix = TIRE_BRAND_FIXES[f[F.brand] ?? ""];
    if (brandFix) editField("M8c", listing, F.brand, brandFix.to, brandFix.reason);
    // (f)
    for (const fix of SEASON_FIXES) {
      if (id === fix.rowId && (f[F.season] ?? "") === "") editField("M8f", listing, F.season, fix.season, fix.reason);
    }
    // (i) dual load index written low/high becomes high/low.
    const load = f[F.loadIndex] ?? "";
    const dual = /^(\d+)\/(\d+)$/.exec(load);
    if (dual && Number(dual[1]) < Number(dual[2])) {
      const swapped = `${dual[2]}/${dual[1]}`;
      editField("M8i", listing, F.loadIndex, swapped, "dual load index is written higher/lower (single/dual) everywhere else; the vendor wrote it low/high");
      const name = f[F.name] ?? "";
      if (name.includes(load)) editField("M8i", listing, F.name, name.replace(load, swapped), "the name carries the same reversed pair");
    }
    // (j) load / speed missing from the columns but stated once in the name.
    if ((f[F.loadIndex] ?? "") === "" && (f[F.speedRating] ?? "") === "") {
      const name = (f[F.name] ?? "").replace(f[F.tireSize] ?? "\u0000", " ");
      const loose = name.match(/(?<![\w/.])\d{2,3}(?:\/\d{2,3})?[A-Z]+(?![\w/.])/g) ?? [];
      const token = loose.length === 1 ? /^(\d{2,3})(?:\/(\d{2,3}))?([A-Z])$/.exec(loose[0] ?? "") : null;
      if (token && SPEED_SYMBOLS.has(token[3] ?? "")) {
        const load2 = token[2] ? `${token[1]}/${token[2]}` : (token[1] ?? "");
        editField("M8j", listing, F.loadIndex, load2, `the vendor's own name states ${loose[0]}: "${f[F.name]}"`);
        editField("M8j", listing, F.speedRating, token[3] ?? "", `the vendor's own name states ${loose[0]}: "${f[F.name]}"`);
      }
    }
  }

  if (listing.category === "wheels") {
    // (a)
    const width = f[F.wheelWidth] ?? "";
    if (f[F.brand] === TIS_WIDTH_FIX.brand && TIS_WIDTH_FIX.from.includes(width)) {
      editField("M8a", listing, F.wheelWidth, TIS_WIDTH_FIX.to, TIS_WIDTH_FIX.reason);
      const name = f[F.name] ?? "";
      const fixed = name.replace(new RegExp(`(?<=\\dx)${escapeRegExp(width)}(?![\\d.])`), TIS_WIDTH_FIX.to);
      if (fixed !== name) editField("M8a", listing, F.name, fixed, "the name carries the same rounded width");
    }
    // (b)
    for (const fix of BOLT_FIXES) {
      if (id === fix.rowId && f[F.boltPatterns] === fix.from) {
        editField("M8b", listing, F.boltPatterns, fix.to, fix.reason);
        const name = f[F.name] ?? "";
        const fixed = name.replace(new RegExp(`(?<![\\w.])${escapeRegExp(fix.from)}(?![\\w.])`), fix.to);
        if (fixed !== name) editField("M8b", listing, F.name, fixed, "the name carries the same bolt pattern");
      }
    }
    // (d) lug count follows the bolt pattern when they disagree.
    const patterns = (f[F.boltPatterns] ?? "").split("/").filter((p) => /^\d+x/.test(p));
    const lugs = new Set(patterns.map((p) => /^(\d+)x/.exec(p)?.[1]));
    const lug = f[F.lugCount] ?? "";
    if (lug !== "" && lugs.size === 1 && !lugs.has(lug)) {
      editField("M8d", listing, F.lugCount, [...lugs][0] ?? lug, `bolt pattern ${f[F.boltPatterns]} has ${[...lugs][0]} lugs, the vendor's lug count says ${lug}`);
    }
    // (g) finish text.
    for (const field of [F.wheelFinish, F.wheelColor, F.name]) {
      const value = f[field] ?? "";
      for (const [bad, fix] of Object.entries(FINISH_TEXT_FIXES)) {
        if (value.includes(bad)) editField("M8g", listing, field, value.replace(bad, fix.to), fix.reason);
      }
    }
    // (e) backspacing that does not fit width and offset.
    const w = Number(f[F.wheelWidth]);
    const o = Number(f[F.offsetMm]);
    const b = Number(f[F.backspacing]);
    if (f[F.wheelWidth] && f[F.offsetMm] !== undefined && f[F.backspacing]) {
      const expected = w / 2 + o / 25.4;
      const delta = b - expected;
      if (Math.abs(delta) >= BACKSPACING_CHECK_FROM) {
        const signFlip = Math.abs(b - (w / 2 - o / 25.4)) <= 0.1;
        const clear = Math.abs(delta) >= BACKSPACING_REPLACE_FROM && !signFlip;
        const detail = `recorded ${b} in; width ${w} / 2 + offset ${o} mm / 25.4 = ${expected.toFixed(2)} (difference ${delta.toFixed(2)})`;
        if (clear) {
          editField("M8e", listing, F.backspacing, String(Math.round(expected * 100) / 100), `${detail}; too far off to be rounding, so recomputed`);
        } else {
          logChange(
            "M8e (not changed)",
            idsOf(listing),
            F.backspacing,
            String(b),
            String(b),
            `${detail}; ${signFlip ? "matches the sign-flipped offset, so the vendor's offset or backspacing is wrong and we cannot tell which" : "difference under 1.5 in, not clearly a vendor error"}`,
          );
        }
      }
    }
  }
}

/** M8 (h): finish spellings within one brand that mean the same thing. */
function finishKey(finish: string): string {
  // Case is left alone (owner: mixed letter case stays, the site uppercases
  // headings): only "Gun Metal"/"Gunmetal" and the typo "Sliver" are folded.
  return finish.replace(/Gun Metal/g, "Gunmetal").replace(/\bSliver\b/g, "Silver");
}
function foldFinishSpellings(listings: Listing[]): void {
  const counts = new Map<string, Map<string, number>>(); // brand|key → spelling → n
  for (const l of listings) {
    const finish = l.fields[F.wheelFinish];
    if (!finish) continue;
    const group = `${l.fields[F.brand]}|${finishKey(finish)}`;
    const spellings = counts.get(group) ?? new Map<string, number>();
    spellings.set(finish, (spellings.get(finish) ?? 0) + 1);
    counts.set(group, spellings);
  }
  const winner = new Map<string, string>();
  for (const [group, spellings] of counts) {
    if (spellings.size < 2) {
      // A lone typo spelling ("Sliver") is corrected even with no other spelling.
      const only = [...spellings.keys()][0] ?? "";
      if (/\bSliver\b/.test(only)) winner.set(group, only.replace(/\bSliver\b/g, "Silver"));
      continue;
    }
    const best = [...spellings].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
    if (best) winner.set(group, best[0].replace(/\bSliver\b/g, "Silver"));
  }
  for (const l of listings) {
    const finish = l.fields[F.wheelFinish];
    if (!finish) continue;
    const to = winner.get(`${l.fields[F.brand]}|${finishKey(finish)}`);
    if (to && to !== finish) {
      const spellings = counts.get(`${l.fields[F.brand]}|${finishKey(finish)}`);
      const detail = [...(spellings ?? [])].map(([s, n]) => `${s} (${n})`).join(" vs ");
      editField("M8h", l, F.wheelFinish, to, `same meaning, more common spelling within ${l.fields[F.brand]}: ${detail}`);
      const color = l.fields[F.wheelColor];
      if (color === finish) editField("M8h", l, F.wheelColor, to, "the colour column repeats the finish text");
    }
  }
}

/* --- M1 SKU borrow (wheels with no model) and M6 --------------------------- */

/**
 * M1 (owner 2026-10-03, data QA): a wheel with NO model that shares a vendor
 * SKU (case, spaces and dashes ignored) with another vendor's listing of the
 * same brand, diameter and width takes that listing's model, so the two can
 * merge. Only when every candidate agrees on the model.
 */
function borrowModels(wheels: Listing[]): number {
  const bySku = new Map<string, Listing[]>();
  for (const l of wheels) {
    const key = skuKey(l.primary.sku);
    const group = bySku.get(key) ?? [];
    group.push(l);
    bySku.set(key, group);
  }
  let borrowed = 0;
  for (const l of wheels) {
    if ((l.fields[F.model] ?? "") !== "" || (l.fields[F.brand] ?? "") === "") continue;
    const candidates = (bySku.get(skuKey(l.primary.sku)) ?? []).filter(
      (other) =>
        other.primary.source !== l.primary.source &&
        (other.fields[F.model] ?? "") !== "" &&
        keyPart(other.fields[F.brand] ?? "") === keyPart(l.fields[F.brand] ?? "") &&
        (other.fields[F.wheelDiameter] ?? "") === (l.fields[F.wheelDiameter] ?? "") &&
        (other.fields[F.wheelWidth] ?? "") === (l.fields[F.wheelWidth] ?? ""),
    );
    const models = new Set(candidates.map((other) => keyPart(other.fields[F.model] ?? "")));
    if (candidates.length === 0 || models.size !== 1) continue;
    candidates.sort((a, b) => rank(a.primary.source) - rank(b.primary.source));
    const from = candidates[0]!;
    editField(
      "M1 model from SKU",
      l,
      F.model,
      from.fields[F.model] ?? "",
      `blank model; ${from.primary.source} lists the same SKU ${from.primary.sku} as "${from.fields[F.model]}"`,
    );
    borrowed += 1;
  }
  return borrowed;
}

const toTitleCase = (text: string) =>
  text === text.toUpperCase() ? text.toLowerCase().replace(/(^|[\s/-])([a-z])/g, (_m, a: string, b: string) => `${a}${b.toUpperCase()}`) : text;

/**
 * M6 (owner 2026-10-03, data QA): a product with a blank model gets the
 * design or line name left in the vendor's name once the brand, size, load,
 * speed, bolt pattern, offset, finish words and the word "blank" are taken
 * out. When nothing is left the model stays blank and the product is listed.
 * Accessories keep a blank model.
 */
const blankModelLeft: { rowIds: string[]; category: Category; name: string }[] = [];
function modelFromName(listing: Listing): void {
  const f = listing.fields;
  if ((f[F.model] ?? "") !== "" || listing.category === "accessories") return;
  let text = ` ${f[F.name] ?? ""} `;
  const strip = (pattern: RegExp) => {
    text = text.replace(pattern, " ");
  };
  const brands = [f[F.brand], listing.rawBrand, listing.primary.cells.brand_clean].filter((b): b is string => !!b);
  for (const brand of new Set(brands)) strip(new RegExp(`(?<![\\w])${escapeRegExp(brand)}(?![\\w])`, "gi"));
  if (listing.category === "tires") {
    if (f[F.tireSize]) strip(new RegExp(escapeRegExp(f[F.tireSize]), "gi"));
    strip(/(?<![\w/.])\d{2,3}(?:\/\d{2,3})?[A-Z]{1,2}(?![\w/.])/g);
    strip(/(?<![\w])XL(?![\w])/gi);
    strip(/(?<![\w])\d+\s?(?:PR|PLY)(?![\w])/gi);
  } else {
    strip(/(?<![\w.])\d+(?:\.\d+)?x\d+(?:\.\d+)?(?![\w.])/gi);
    strip(/(?<![\w.])(?:ET|\+)?-?\d+(?:\.\d+)?\s?mm(?![\w])/gi);
    const offset = f[F.offsetMm];
    if (offset !== undefined) strip(new RegExp(`(?<![\\w.])(?:ET)?[+-]?${escapeRegExp(offset)}(?![\\w.])`, "gi"));
    strip(/(?<![\w])blank(?![\w])/gi);
    for (const word of (f[F.wheelFinish] ?? "").split(/[^A-Za-z0-9]+/).filter((w) => w.length > 0)) {
      strip(new RegExp(`(?<![\\w])${escapeRegExp(word)}(?![\\w])`, "gi"));
    }
    for (const word of (f[F.wheelColor] ?? "").split(/[^A-Za-z0-9]+/).filter((w) => w.length > 0)) {
      strip(new RegExp(`(?<![\\w])${escapeRegExp(word)}(?![\\w])`, "gi"));
    }
  }
  const left = text.replace(/[-/&,()]+/g, " ").replace(/\s+/g, " ").trim();
  if (left === "" || !/[A-Za-z0-9]/.test(left)) {
    blankModelLeft.push({ rowIds: idsOf(listing), category: listing.category, name: f[F.name] ?? "" });
    return;
  }
  editField("M6", listing, F.model, toTitleCase(left), `model was blank; left after removing brand, size, load/speed, bolt pattern, offset and finish words from the vendor name "${f[F.name]}"`);
}

/* --- M4 -------------------------------------------------------------------- */

function foldModel(listing: Listing): void {
  const model = listing.fields[F.model] ?? "";
  if (model === "") return;
  const alias = MODEL_ALIAS_INDEX.get(`${listing.category}|${listing.fields[F.brand]}|${model}`.toLowerCase());
  if (alias) editField("M4", listing, F.model, alias.to, `model spellings folded to the one carried by more products: ${alias.why}`);
}

/* --- M5, M7 (accessories) ---------------------------------------------------- */

/** Prefixes dropped from accessory names (M5), with the number of names each hit. */
const strippedPrefixes = new Map<string, number>();

function cleanAccessoryName(listing: Listing): void {
  const f = listing.fields;
  const sku = listing.primary.sku;
  const before = f[F.name] ?? "";
  let name = before;
  // Vendor shorthand for the maker, when the brand already says it.
  if ((f[F.brand] ?? "") === "DAI Wheels") {
    for (const shorthand of ["DAI ACC", "DAI/ZETA"]) {
      const pattern = new RegExp(`(^|\\s)${escapeRegExp(shorthand)}(?=\\s|$)`, "i");
      if (pattern.test(name)) {
        name = name.replace(pattern, " ").replace(/\s+/g, " ").trim();
        strippedPrefixes.set(shorthand, (strippedPrefixes.get(shorthand) ?? 0) + 1);
      }
    }
  }
  // The vendor SKU at the end of the name moves to a Part number spec.
  const tail = new RegExp(`(?:^|\\s)${escapeRegExp(sku)}$`, "i");
  let stripped = false;
  if (tail.test(name)) {
    name = name.replace(tail, "").trim();
    stripped = true;
  } else {
    const last = name.split(/\s+/).pop() ?? "";
    if (last !== "" && skuKey(last) === skuKey(sku)) {
      name = name.slice(0, name.length - last.length).trim();
      stripped = true;
    }
  }
  if (name === "") {
    logChange("M5", idsOf(listing), F.name, before, before, "name would be empty after removing the SKU and shorthand; left as the vendor wrote it");
    return;
  }
  if (name !== before) {
    editField("M5", listing, F.name, name, `${stripped ? `vendor SKU ${sku} moved out of the name into a Part number spec` : "vendor shorthand removed"}${before !== name && !stripped ? "" : ""}`);
  }
  if (stripped && !listing.extra.some(([label]) => label.toLowerCase() === "part number")) {
    listing.extra.unshift(["Part number", sku]);
    listing.edits.push({ rule: "M5", field: "extra_specs: Part number", before: "", after: sku });
    logChange("M5", idsOf(listing), "extra_specs: Part number", "", sku, "added from the SKU removed from the name");
  }
}

/** M7: validated on the vendor's own rows, 40 of 40: an Auto Country SKU ending CH/BK + 20, 24 or 32 sells that many pieces. */
const PACK_SUFFIX = /(?:CH|BK)(20|24|32)$/;

function fixPackSizes(listing: Listing): void {
  const f = listing.fields;
  const pack = f[F.packQuantity] ?? "";
  const labels = ["Quantity per box", "Pieces per pack"];
  const get = (label: string) => listing.extra.find(([l]) => l === label)?.[1];
  // A missing pack the vendor's own data settles.
  if (pack === "") {
    const qpb = get("Quantity per box");
    const pieces = get("Pieces per pack");
    const suffix = PACK_SUFFIX.exec(listing.primary.sku)?.[1];
    if (pieces && /^\d+$/.test(pieces) && pieces !== "1") {
      editField("M7", listing, F.packQuantity, pieces, `no pack count; the vendor's own "Pieces per pack: ${pieces}"`);
    } else if (qpb && /^\d+$/.test(qpb) && qpb !== "1" && (suffix === undefined || suffix === qpb)) {
      editField("M7", listing, F.packQuantity, qpb, `no pack count; the vendor's own "Quantity per box: ${qpb}"${suffix ? ` and SKU ending ${suffix}` : ""}`);
    } else if (suffix && listing.primary.cells.quantity?.toLowerCase() === "1 kit") {
      editField("M7", listing, F.packQuantity, suffix, `vendor quantity is "1 kit" with no piece count; SKU ${listing.primary.sku} ends ${suffix}, and 40 of 40 Auto Country SKUs ending CH/BK 20, 24 or 32 sell exactly that many pieces`);
    }
  }
  const packNow = f[F.packQuantity] ?? "";
  if (packNow === "") return;
  for (const label of labels) {
    const value = get(label);
    if (value === undefined) continue;
    const at = listing.extra.findIndex(([l]) => l === label);
    if (value === packNow) {
      listing.extra.splice(at, 1);
      listing.edits.push({ rule: "M7", field: `extra_specs: ${label}`, before: value, after: "" });
      logChange("M7", idsOf(listing), `extra_specs: ${label}`, value, "", `duplicates pack_quantity ${packNow}`);
    } else if (/^\d+$/.test(value)) {
      const quantity = listing.primary.cells.quantity ?? "";
      listing.extra.splice(at, 1);
      listing.edits.push({ rule: "M7", field: `extra_specs: ${label}`, before: value, after: "" });
      logChange(
        "M7",
        idsOf(listing),
        `extra_specs: ${label}`,
        value,
        "",
        `contradicts pack_quantity ${packNow}; the vendor's own quantity column says "${quantity}"${label === "Quantity per box" ? `, so "${value}" counts boxes or kits, not pieces` : ""}${PACK_SUFFIX.exec(listing.primary.sku)?.[1] === packNow ? `; the SKU ends ${packNow}` : ""}. Auto Country's site is login-only and was not opened`,
      );
    }
  }
}

/* --- M9 ----------------------------------------------------------------------- */

/**
 * M9 (coordinator, from the owner's "show descriptions if available"): a
 * description is for shoppers. Sentences that name a vendor or talk about
 * wholesale, dealers or pricing are removed; a trailing "at ... pricing"
 * clause that is the sentence's only problem is trimmed and the sentence
 * keeps its full stop. Words are only ever removed.
 */
const VENDOR_NAMES = /(?<![\w])(?:vertex(?: tires)?|auto country|direct auto import|wheel works|pro ?wheels|dealer ?wheels)(?![\w])/i;
// "affordable", "cost-effective", "economical", "budget-conscious" and "retail"
// are price or trade talk too (the coordinator's count of about 41 descriptions
// needs them); "operating costs" (fuel) and "fleet" alone are left.
const COMMERCIAL =
  /(?<![\w])(?:wholesale|dealers?|dealerships?|distribut\w+|pricing|prices?|price point|afford\w*|cost[- ]effective\w*|economical|budget[\w-]*|retail\w*)(?![\w])/i;
const PRICE_CLAUSE = /,?\s+(?:at|without)\s+[^,.]*?(?<![\w])(?:pricing|price(?: point)?)(?![\w])[^,.]*$/i;
const problem = (text: string) => VENDOR_NAMES.test(text) || COMMERCIAL.test(text);
let descriptionsEdited = 0;
function cleanDescription(listing: Listing): void {
  const before = listing.fields[F.description] ?? "";
  if (before === "" || !problem(before)) return;
  const sentences = before.split(/(?<=[.!?])\s+/);
  const kept: string[] = [];
  for (const sentence of sentences) {
    if (!problem(sentence)) {
      kept.push(sentence);
      continue;
    }
    const end = /[.!?]$/.test(sentence) ? sentence.slice(-1) : "";
    const body = end ? sentence.slice(0, -1) : sentence;
    const trimmed = body.replace(PRICE_CLAUSE, "");
    if (trimmed !== body && !problem(trimmed) && trimmed.trim() !== "") kept.push(`${trimmed.trimEnd()}${end}`);
  }
  const after = kept.join(" ").trim();
  descriptionsEdited += 1;
  if (after === "") editField("M9", listing, F.description, "", "description names a vendor or talks about wholesale, dealers or pricing and nothing meaningful is left");
  else editField("M9", listing, F.description, after, "sentences naming a vendor or talking about wholesale, dealers or pricing removed; trailing pricing clauses trimmed");
}

/* --- M10, M11, M12 (D152: launch audit, Batch 3, owner 2026-10-05) -------- */

/**
 * M10 (owner 2026-10-05, "Fix + trim marketing"): vendor descriptions for
 * shoppers. A trimmed text uses only the vendor's own words plus a short list
 * of joining words (JOINING_WORDS), so no new noun, number or claim can
 * appear; sales words and clauses are deleted and a sentence the deletion
 * would leave broken is recast with the vendor's own words (checked below,
 * the run fails otherwise).
 *   1. A description that states a size or load index that is not the
 *      product's own describes another tire and is blanked.
 *   2. A listing found in DESCRIPTION_TRIMS (below; same vendor + SKU and the
 *      same vendor text, by hash) takes that curated text: the sales words and
 *      clauses are deleted inside a sentence and the sentence's facts stay.
 *   3. Any other listing (a new vendor row) takes the automatic path with the
 *      same aims: it deletes sales words and clauses, strips the pasted size
 *      title and "Key Features:" headings (keeping each feature sentence),
 *      drops a sentence only when sales talk is all that is left, deletes the
 *      season phrase that contradicts the label (all-season on an all-weather
 *      tire and the reverse), and fixes dashes.
 * Every edited description is one row of changes-review.csv naming its path.
 */
const DELETE_WORDS = new RegExp(
  String.raw`(?<![\w])(?:premium|superior|superb|ultimate|perfect(?:ly)?|ideal(?:ly)?|excellent|exceptional|outstanding|unmatched|unparalleled|finest|world-class|top-notch|incredible|amazing|stunning|striking|sleek|sophisticated|refined|timeless|elegant|reliable|dependable|dependability|confident(?:ly)?|rugged|serious|exacting|Canadian|classic|timeless|trusted|expertly|expert-level|expert|maximum|demanding(?=\s+(?:terrain|conditions|applications|environments|loads|work|driving|surfaces|use|tasks)\b))(?![\w])\s*`,
  "gi",
);
const DELETE_PHRASES: RegExp[] = [
  /\s+(?:for|under|in|through|across)\s+demanding\s+(?=(?:terrain|conditions|applications|environments|loads|work|surfaces|use|tasks)\b)\w+/gi,
  /\bconfidence\s+(?:with|in)\s+/gi,
  /\s*,?\s*(?:for|on|in|across|throughout)\s+(?:the\s+)?Canadian\s+\w+/gi,
  /\s*,?\s*(?:for|to)\s+Canadian\s+(?:drivers?|owners?)\b/gi,
  /\s+for\s+(?:a\s+)?(?:classic|modern|professional|sleek)\s+[\w\s-]*?(?:aesthetics?|appearance|styling|look)\b/gi,
  /\s*,?\s*(?:make|makes)\s+(?:them|it|this)\s+an?\s+(?:ideal|excellent|perfect|great)\s+\w+[^.!?]*/gi,
  /,?\s*(?:providing|offering|delivering|giving)\s+(?:excellent|great|exceptional)\s+value\b[^.!?]*/gi,
  /\s*,?\s*(?:with|without)\s+(?:\w+\s+)?(?:confidence|compromise)(?![\w])/gi,
  /\s*,?\s*without\s+compromis\w*[^.!?,]*/gi,
  /\s*,?\s*(?:for|to)\s+(?:drivers?|owners?|those|anyone)\s+(?:who|seeking|looking|prioriti[sz]ing|needing)\b[^.!?]*?(?=,\s+(?:this|it|the|these)\b|[.!?]|$)/gi,
  /\s*,?\s*(?:for|with)\s+(?:the\s+)?(?:best|great)\s+value\b[^.!?,]*/gi,
];
const DELETE_TAILS: RegExp[] = [
  /,\s+(?:offering|delivering|providing|making)\s+[^.!?]*(?:aggressive|stance|fitment|versatile|refined|timeless|appeal|aesthetic)[^.!?]*$/i,
  /,\s+(?:making|offering|delivering|providing|ensuring|allowing|giving)\s+(?:it|them|this|these|you|drivers?)\b[^.!?]*(?:choice|option|solution|package|value|ride|comfort|confidence|ideal|perfect|practical|versatile|appeal)[^.!?]*$/i,
  /,?\s*(?:complements?|adds?|adding|completes?)\s+(?:a\s+|an\s+)?(?:[\w-]+\s+){0,3}?(?:aesthetics?|appearance|styling|style|look|looks|stance)\b[^.!?]*$/i,
  /\s+(?:that\s+)?complements?\b[^.!?]*$/i,
  /\s*[—–]\s*(?:ideal|perfect|built|designed|engineered)[^.!?]*$/i,
  /,\s*(?:ideal|perfect)\s+for\b[^.!?]*$/i,
];
/** A sentence with any of these left is sales talk with nothing factual in it. */
const SALES_LEFT =
  /(?<![\w])(?:reputation|choose|confidence|reliability|keeps you|demand\w*|choice|trust|heritage|proven|value|investment|enthusiasts?|contractors?|fleet operators?|adventures?|adventure-ready|seeking|seekers?|prioritizing|whether you|built for|work hard|go far|lifespan|ideal|perfect|best|great|aesthetics?|appearance|styling|style|looks?|complements?)(?![\w])|!/i;
const SALES_FRAGMENT = /^The (?:raised white lettering|blackwall sidewall construction|blackwall design|BSW \(Black Sidewall\) finish)(?: \([A-Z]+\))?\.$/i;
const SALES_OPENER = /^(?:ideal|perfect|trust|designed for drivers|built for|engineered for drivers)\b/i;
const ALL_SEASON = /all[- ]season/i;
const ALL_WEATHER = /all[- ]weather/i;
const sizeKey = (size: string) => size.toUpperCase().replace(/^(?:LT|P)(?=\d)/, "").replace(/(?:LT|C)$/, "").replace(/Z(?=R)/, "");
const TEXT_SIZE = /(?<![\w])(?:LT|P)?\d{2,3}[xX/]\d{1,2}(?:\.\d+)?Z?R\d{2}(?:\.\d+)?(?:LT|C)?(?![\w])/g;
const TEXT_LOAD = /(?<![\w/.+])(\d{2,3})(?:\/\d{2,3})?\s?([A-Z])(?![\w/.+])/g;
const PASTED_SIZE_TITLE = /^\S*\d{2,3}\/\d{2}[A-Z]*R\d{2}[^.]*?\b(?:Tires?(?:\s*\([^)]*\))?)\s+(?=The |This )/;
const PASTED_DESCRIPTION_TITLE = /^[^.]*?\bDescription:\s+/;
const FEATURE_VERB = /^(?:Enhances|Improves|Provides|Delivers|Offers|Reduces|Helps|Maintains|Ensures|Promotes|Minimizes|Resists|Absorbs|Channels|Engineered|Designed|Built)$/;
const capFirst = (text: string) => text.replace(/^([^A-Za-z0-9]*)([a-z])/, (_m, a: string, b: string) => `${a}${b.toUpperCase()}`);

/** Words of a text for the word check: lower case, letters and digits only; a dash between digits reads "to". */
const descriptionWords = (text: string) =>
  text.toLowerCase().replace(/(\d)\s*[–—]\s*(\d)/g, "$1 to $2").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
/** Joining words a trimmed text may use even when the vendor text lacks them. */
const JOINING_WORDS = new Set("a an the and or for with on in of to at by it its this these is are as from across use".split(" "));
/** True when every word of `after` is in `before` or is a joining word: no new noun, number or claim. */
function usesOnlyOriginalWords(before: string, after: string): boolean {
  const original = new Set(descriptionWords(before));
  return descriptionWords(after).every((word) => original.has(word) || JOINING_WORDS.has(word));
}
const descriptionHash = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 10);

/** "Improved Wet Traction Wide circumferential grooves channel water." keeps the sentence, loses the pasted heading. */
function stripFeatureHeadings(block: string): string {
  const upper = (w: string) => /^[([]?[A-Z0-9]/.test(w);
  const lower = (w: string) => /^[a-z]/.test(w);
  return block
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      const w = sentence.split(/\s+/);
      for (let k = 0; k < w.length - 1; k += 1) {
        if (!upper(w[k] ?? "") || !lower(w[k + 1] ?? "")) continue;
        if ((w[k] ?? "").startsWith("(") && k >= 2) return w.slice(k - 2).join(" ");
        if (k > 0 && FEATURE_VERB.test(w[k] ?? "")) {
          const head = w.slice(0, k).join(" ");
          const subject = head.charAt(0) + head.slice(1).replace(/\b([A-Z])([a-z]+)/g, (_m, a: string, b: string) => `${a.toLowerCase()}${b}`);
          return `${subject} ${(w[k] ?? "").toLowerCase()} ${w.slice(k + 1).join(" ")}`;
        }
        return w.slice(k).join(" ");
      }
      return sentence;
    })
    .join(" ");
}

function trimSentence(sentence: string): { body: string; end: string } {
  const end = /[.!?]$/.test(sentence) ? sentence.slice(-1) : "";
  let body = end ? sentence.slice(0, -1) : sentence;
  for (const tail of DELETE_TAILS) {
    const m = tail.exec(body);
    if (m && m.index >= 20) body = body.slice(0, m.index);
  }
  for (const phrase of DELETE_PHRASES) body = body.replace(phrase, "");
  body = body
    .replace(DELETE_WORDS, "")
    .replace(/(\w+),\s+(\w+),\s+and\s+(driving experience|ride)\b/, "$1, $2 $3")
    .replace(/^Engineered,\s+(?=the )/i, "")
    .replace(/\bof and\b/g, "of")
    .replace(/(\w+)\s+and\s+more\s+(ride|driving)\b/i, "$1 $2")
    .replace(/(\w+),\s+more\s+(driving|ride)\b/i, "$1 $2")
    .replace(/,\s+this tire offers\s+year-round\s*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/^[\s,;:]+/, "")
    .trim();
  return { body: capFirst(body).replace(/\s+(?:engineered|designed|built)$/i, ""), end: end || "." };
}

interface AutoTrim {
  text: string;
  pasted: boolean;
  title: boolean;
  seasonSentences: number;
  droppedSentences: number;
}
/** The automatic path of M10 (no curated entry): it only deletes. */
function autoTrimDescription(original: string, season: string): AutoTrim {
  let text = original;
  const result: AutoTrim = { text: "", pasted: false, title: false, seasonSentences: 0, droppedSentences: 0 };
  const described = PASTED_DESCRIPTION_TITLE.exec(text);
  if (described) {
    text = text.slice(described[0].length);
    result.title = true;
  }
  const titled = PASTED_SIZE_TITLE.exec(text);
  if (titled) {
    text = text.slice(titled[0].length);
    result.title = true;
  }
  const block = text.indexOf("Key Features:");
  if (block >= 0) {
    text = `${text.slice(0, block).trim()} ${stripFeatureHeadings(text.slice(block + "Key Features:".length))}`.trim();
    result.pasted = true;
  }
  const kept: string[] = [];
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    const drop = () => {
      result.droppedSentences += 1;
    };
    if (SALES_OPENER.test(s)) {
      drop();
      continue;
    }
    const trimmed = trimSentence(s);
    let body = trimmed.body;
    const end = trimmed.end;
    if (SALES_FRAGMENT.test(body + end)) {
      drop();
      continue;
    }
    if (season === "all_weather" && ALL_SEASON.test(body)) {
      body = capFirst(body.replace(/all[- ]season\s*/gi, "").replace(/\s+/g, " ").trim());
      result.seasonSentences += 1;
    }
    if (season === "all_season" && ALL_WEATHER.test(body)) {
      body = capFirst(body.replace(/all[- ]weather\s*/gi, "").replace(/\s+/g, " ").trim());
      result.seasonSentences += 1;
    }
    body = body.replace(/\s+(?:engineered|designed|built|crafted)$/i, "");
    const unchanged = body === (/[.!?]$/.test(s) ? s.slice(0, -1) : s) && !/[–—]/.test(s);
    let sentence = body + end;
    if (unchanged && !SALES_LEFT.test(s)) {
      kept.push(s);
      continue;
    }
    if (/\b(?:is|are|was|be|an?|the|of|for|with|and|that|which|this)$/i.test(body)) {
      drop();
      continue;
    }
    if (/(?<![\w])a\s+[aeiou]/i.test(sentence)) {
      sentence = sentence.replace(/(?<![\w])a\s+(?=[aeiou])\S+\s+/i, "a ").replace(/\s+(?:engineered|designed|built)\./i, ".");
      if (sentence.split(/\s+/).length < 7) {
        drop();
        continue;
      }
    }
    if (sentence.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length < 4 || SALES_LEFT.test(sentence)) {
      drop();
      continue;
    }
    kept.push(unchanged ? s : sentence);
  }
  // A first sentence that opens on a clause about "it" has lost its subject.
  while (kept[0] && /^(?:Featuring|With|Built|Designed|Engineered)\b[^.]*?,\s+(?:it|they)\s/.test(kept[0])) kept.shift();
  if (kept[0]) kept[0] = capFirst(kept[0].replace(/^(?:Their|Its|It|They)\s+/, "").replace(/^These\s+tires\s+/i, ""));
  result.text = kept
    .join(" ")
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1 to $2")
    .replace(/\s*[–—]\s*(?=[a-z])/g, ", ")
    .replace(/\s*[–—]\s*/g, ". ");
  return result;
}

const m10Stats = {
  differentTire: [] as string[],
  edited: 0,
  curated: 0,
  automatic: 0,
  blank: [] as string[],
  pasted: 0,
  seasonSentences: { changedByMaker: 0, other: 0 },
  droppedSentences: 0,
  dashes: 0,
  violations: [] as string[],
};
const reseasoned = new Set<string>(); // filled from seasonByMaker in main()

/** The size or load index in the text that is not the product's own, if any. */
function otherTireIn(f: Record<string, string>, text: string): string | null {
  const size = f[F.tireSize] ?? "";
  if (size !== "") {
    for (const m of text.matchAll(TEXT_SIZE)) {
      if (sizeKey(m[0]) !== sizeKey(size)) return `size ${m[0]} (the product is ${size})`;
    }
  }
  const load = (f[F.loadIndex] ?? "").split("/")[0] ?? "";
  if (load !== "") {
    for (const m of text.matchAll(TEXT_LOAD)) {
      const n = Number(m[1]);
      if (SPEED_SYMBOLS.has(m[2] ?? "") && n >= 60 && n <= 150 && m[1] !== load) {
        return `load index ${m[0].replace(/\s/g, "")} (the product is ${f[F.loadIndex]}${f[F.speedRating] ?? ""})`;
      }
    }
  }
  return null;
}

function cleanDescriptionM10(listing: Listing): void {
  const f = listing.fields;
  const before = f[F.description] ?? "";
  if (before === "") return;
  if (listing.category === "tires") {
    const other = otherTireIn(f, before);
    if (other) {
      m10Stats.differentTire.push(listing.primary.rowId);
      editField("M10 different tire", listing, F.description, "", `the description names ${other}, so it was written for another tire`);
      return;
    }
  }
  const season = f[F.season] ?? "";
  const key = `${listing.primary.source}|${listing.primary.sku}`;
  const entry = DESCRIPTION_TRIMS[key];
  const curated = entry !== undefined && entry[0] === descriptionHash(before);
  let after: string;
  let how: string;
  if (curated) {
    after = entry[1];
    how = "path: curated table (every sales word and clause deleted inside its sentence, the facts kept)";
    m10Stats.curated += 1;
  } else {
    const auto = autoTrimDescription(before, season);
    after = auto.text;
    const parts = [
      auto.title ? "pasted size title removed" : "",
      auto.pasted ? 'pasted "Key Features:" headings removed, feature sentences kept' : "",
      auto.seasonSentences ? `${auto.seasonSentences} sentence(s) lose the season phrase that contradicts the label (${season === "all_weather" ? "all-season on an all-weather tire" : "all-weather on an all-season tire"})` : "",
      auto.droppedSentences ? `${auto.droppedSentences} sentence(s) dropped, sales talk only` : "",
      /[–—]/.test(before) ? "dashes replaced" : "",
    ].filter(Boolean);
    how = `path: automatic fallback (no curated entry for this vendor text); ${parts.join("; ") || "words deleted"}`;
    m10Stats.pasted += auto.pasted ? 1 : 0;
    m10Stats.droppedSentences += auto.droppedSentences;
    if (auto.seasonSentences) m10Stats.seasonSentences[reseasoned.has(listing.primary.rowId) ? "changedByMaker" : "other"] += auto.seasonSentences;
  }
  if (/[–—]/.test(before) && !/[–—]/.test(after)) m10Stats.dashes += 1;
  if (!usesOnlyOriginalWords(before, after)) m10Stats.violations.push(`${key}: the text uses a word that is neither in the vendor text nor a joining word`);
  if ((season === "all_weather" && ALL_SEASON.test(after)) || (season === "all_season" && ALL_WEATHER.test(after))) {
    m10Stats.violations.push(`${key}: still names a season other than the label`);
  }
  if (/[–—]/.test(after)) m10Stats.violations.push(`${key}: still has a dash`);
  if (after === before) return;
  if (!curated) m10Stats.automatic += 1;
  m10Stats.edited += 1;
  if (after === "") m10Stats.blank.push(`${key} (${f[F.name] ?? ""})`);
  editField("M10", listing, F.description, after, `${how}${after === "" ? "; nothing factual is left, so the description is blank" : ""}`);
}

/**
 * The curated text of every vendor description M10 touches (D152, owner
 * 2026-10-05). Key: vendor + vendor SKU of the listing. Value: [hash of the
 * vendor text it was written from, the trimmed text]. The text is the vendor's
 * own, DELETION ONLY (checked at build time): sales words and clauses are
 * deleted inside their sentence and its facts kept, pasted headings lose their
 * heading words, a dangling opener loses its pronoun phrase, a dash becomes
 * "to", a comma or a full stop. A sentence is dropped only when nothing
 * factual is left. If the vendor's text changes the hash no longer matches and
 * the automatic path of M10 takes over.
 */
const DESCRIPTION_TRIMS: Record<string, readonly [string, string]> = {
  "Vertex Tires|45574375538877": ["27f1b09cbc", "The Haida 205/55R16 HD617 Winter Tires are engineered for winter performance. Featuring a winter-formulated compound that retains elasticity in extreme cold, these tires maintain traction down to -40°C. Their wide tread with 3D sawtooth sipes enhances grip and handling on ice and snow, while fine siping and optimized tread blocks ensure strong bite on slippery surfaces for improved safety. Directional V-shaped tread channels efficiently disperse water and slush, delivering traction and better braking control in harsh winter conditions."],
  "Vertex Tires|45745829118141": ["c41e61ef02", "The 175/70R14 Haida HD617 Winter 84T tire is for challenging winter driving. Its directional V-shaped tread pattern enhances grip and stability on ice and snow, while advanced materials ensure durability and consistent braking in freezing conditions. This tire is engineered to provide precise handling and traction."],
  "Vertex Tires|45745829413053": ["bdad97814c", "The 185/65R14 Haida HD617 Winter 90T tire is for cold weather conditions. Designed with a tread pattern optimized for winter traction, it offers enhanced grip on snow and ice, ensuring safer driving throughout the season. The tire's 90T load and speed rating provide a robust balance of durability and control."],
  "Vertex Tires|45745834950845": ["4af75a7e92", "The 205/65R15 Haida HD617 Winter 94T tire is engineered to deliver winter traction and handling. Its aggressive tread pattern enhances grip on snow and icy surfaces, while the robust rubber compound remains flexible in low temperatures for improved safety. With a 94 load index and T speed rating, this tire supports medium-sized vehicles, providing stability and control during harsh winter driving conditions."],
  "Vertex Tires|45745836753085": ["5da38fb2b7", "The 205/60R16 Haida HD617 Winter 96T tire is designed for winter conditions. Its advanced tread pattern maximizes traction on snow and ice, while the flexible rubber compound ensures grip in cold temperatures. With a 96 load index and T speed rating, this tire supports mid-sized vehicles, offering enhanced stability and control during challenging winter driving."],
  "Vertex Tires|45745839374525": ["e4bd2a4123", "The 215/65R16 Haida HD617 Winter 98T tire delivers winter traction for SUVs and larger vehicles. Its optimized tread design enhances grip on snow and ice, while the flexible rubber compound maintains performance in low temperatures. With a 98 load index and T speed rating, this tire ensures stability, safety, and control for winter driving."],
  "Vertex Tires|45745840750781": ["a52633a433", "Designed for winter conditions, the 215/50R17 Haida HD617 Winter 95H tire offers traction and enhanced control on snow and ice. Its specialized tread pattern improves grip and stability, ensuring safe driving in cold weather. With a 95H rating, this tire balances performance and durability."],
  "Vertex Tires|45745842127037": ["2aa41073ee", "The 215/55R17 Haida HD617 Winter 94T tire is engineered for harsh winter conditions. Its advanced tread design enhances traction on snow and ice, while the 94T speed rating ensures balanced handling and safety. This tire offers grip and stability."],
  "Vertex Tires|45745843896509": ["56b9d4e3e6", "The 225/45ZR17 Haida HD617 Winter 94H tire delivers winter performance with enhanced traction on snow and ice. Its precise tread pattern improves grip and control in cold weather, while the 94H speed rating offers stability."],
  "Vertex Tires|45745844519101": ["5957c61ac2", "The 225/65R17 Haida HD617 Winter 102T tire is designed to deliver traction and control in winter conditions. Its advanced tread pattern enhances grip on snow and ice, while the 102T load and speed rating ensures durability and safe handling."],
  "Vertex Tires|45745845469373": ["f0d384a6f4", "The 235/60R18 Haida HD617 Winter 103T tire is engineered for winter driving, offering traction on snow and icy surfaces. Its specialized tread design enhances grip and stability, while the 103T load and speed rating provides strong performance and durability."],
  "Vertex Tires|45745848647869": ["e9496384b3", "The 265/70R16 Haida HD677 Winter 112T tire is designed to provide winter performance for larger vehicles. Its robust tread pattern enhances traction on snow and ice, ensuring grip and stability. With a 112T load and speed rating, this tire supports heavy loads while maintaining safe handling in challenging winter conditions."],
  "Vertex Tires|45745853661373": ["d947f5d94e", "The 225/55R19 Haida HD687 UHP Winter 99H tire delivers high-performance traction and control in winter conditions. Its ultra-high performance design combines advanced tread technology for grip on snow and ice with a 99H speed rating, ensuring responsive handling and safety."],
  "Vertex Tires|45745855529149": ["fba372e9b0", "Ultra-high performance tread design enhances grip on snow and ice, while the 102H load and speed rating ensures durability and safety."],
  "Vertex Tires|45745857200317": ["b1cbaa583e", "The 235/40R18 Haida HD697 Performance Winter 95V tire combines sporty performance with winter capability. Its advanced tread design optimizes grip on snow and ice, while the 95V speed rating ensures responsive handling and stability."],
  "Vertex Tires|45745857265853": ["0113ba7e4a", "The 245/50R20 Haida HD697 Performance Winter 102H tire offers winter performance with a focus on stability and control. Its advanced tread pattern enhances traction on snow and ice, while the 102H load and speed rating ensures durability."],
  "Vertex Tires|45745857331389": ["a61d6a3b26", "The 255/50R20 Haida HD697 Performance Winter 109H tire is engineered for winter driving performance. Its advanced tread design provides enhanced traction and stability on snow and ice, while the 109H load and speed rating supports heavy loads."],
  "Vertex Tires|45745857953981": ["3d582416c8", "Reinforced construction and tread design provide enhanced traction and durability on snow and ice, while the 106/104 load index and R speed rating ensure it can handle heavy loads safely."],
  "Vertex Tires|45745858805949": ["5631a17414", "The 235/55R20 Haida HD697 Performance Winter 105V tire delivers advanced winter traction with a focus on responsive handling. Its specialized tread pattern enhances grip on snow and ice, while the 105V load and speed rating ensures strong performance and safety."],
  "Vertex Tires|45745859854525": ["79eee3819a", "The 245/60R18 Haida HD697 Performance Winter 105H tire is engineered to deliver winter performance with enhanced traction on snow and ice. Its advanced tread design promotes stability and control, while the 105H load and speed rating ensures durability."],
  "Vertex Tires|45745863983293": ["3795e84adb", "Experience winter traction with the 255/45R20 Haida HD697 Performance Winter tire. Engineered for cold conditions, it offers enhanced grip on snow and ice thanks to its specialized tread design. With a 105V load and speed rating, this tire combines durability and stability, ensuring safety throughout winter driving."],
  "Vertex Tires|45759657705661": ["796888a044", "The 205/55R17 95H XL iLink Snowgripper I is a high-performance winter tire engineered for enhanced traction on snow and ice. Its extra load (XL) rating ensures durability under heavier loads, while the specialized tread design improves grip and stability in challenging winter conditions."],
  "Vertex Tires|45762148434109": ["d3b187cff7", "The aggressive tread pattern excels on gravel, mud, and rocky terrain while maintaining reasonable on-road stability."],
  "Vertex Tires|45762250408125": ["99a248f120", "The 275/40R20 106H XL ILINK WINTERS tire is engineered for winter performance with an Extra Load (XL) rating, providing enhanced strength and durability for heavier vehicles. Its winter-specific design ensures grip and stability on snow-covered and icy roads, improving safety and control in challenging winter conditions."],
  "Vertex Tires|45800800780477": ["8f6da6c384", "The HAIDA HD837 is a highway all-season tire engineered for smooth, comfortable driving in diverse weather conditions. With a 225/65R17 102H load rating, it delivers traction on wet and dry roads while maintaining fuel efficiency. The advanced tread design reduces road noise and enhances stability at highway speeds."],
  "Vertex Tires|45841364549821": ["1d4392792e", "The HAIDA HD687 delivers responsive handling, reduced braking distances, and enhanced traction in cold conditions. Load index 98 supports mid-size vehicles. XL sidewall construction provides durability and stability through harsh winter months."],
  "Vertex Tires|46240616841405": ["02110f6cdf", "The Kumho KU22 ECSTA 4X II is an all-season performance tire engineered for responsive handling and grip in wet, dry, and light winter conditions. Advanced tread compound and pattern optimize traction while reducing rolling resistance for improved fuel efficiency. Durable construction supports extended mileage and performance."],
  "Vertex Tires|46313656615101": ["645e2c0f67", "This is the HC1/GE Stance Flow Form wheel in Hyper Black finish. Specifications: Size: 18x8.0, Bolt Pattern: 5x114.3 (5-lug), Offset: +40mm, Bore: 64.1mm, Finish: Hyper Black, Seat Type: Radius, Part #: HC1-1880-5114640HB. Flow-form technology delivers the strength of a forged wheel."],
  "Vertex Tires|46318413611197": ["abeeec4c2b", "This is the LIGHTNING/OE Stance-Flow Form alloy wheel in Gloss Black finish. This 19x8.0 wheel features a 5x120 bolt pattern with +42mm offset and 74.1mm bore, specifically engineered for Vinfast fitment applications. Conical seat design ensures optimal lug nut contact and secure mounting. Part #LIGHTNING-1980-12074GB. Key Specifications: Size: 19x8.0 Bolt Pattern: 5x120 Finish: Gloss Black Offset: +42mm Bore: 74.1mm Seat Type: Conical Fitment: Vinfast"],
  "Vertex Tires|46318458568893": ["9297da97c7", "This is the THUNDER/OE Stance alloy wheel in Satin Black finish. This 19x9.5 wheel features a 5x120 bolt pattern with +35mm offset and 64.1mm bore. Conical seat design ensures proper lug nut fitment and secure mounting. Part #THUNDER-19951205B. Note: This model has been discontinued - limited availability. Key Specifications: Size: 19x9.5 Bolt Pattern: 5x120 Finish: Satin Black Offset: +35mm Bore: 64.1mm Seat Type: Conical Status: Discontinued"],
  "Vertex Tires|46318468038845": ["4c31ce9119", "This is the SPIKE/OE Stance alloy wheel in Satin Black finish. This 20x8.5 wheel features a 5x114.3 bolt pattern with +35mm offset and 64.1mm bore. Conical seat design ensures secure lug nut engagement and proper wheel mounting. Part #SPIKE-208511458. Key Specifications: Size: 20x8.5 Bolt Pattern: 5x114.3 Finish: Satin Black Offset: +35mm Bore: 64.1mm Seat Type: Conical"],
  "Vertex Tires|46318472396989": ["1b0f07621f", "This is the UG04/OE Stance alloy wheel in Gloss Black finish. This 17x7.5 wheel features a 5x114.3 bolt pattern with +35mm offset and 64.1mm bore, specifically designed with Honda Radius seat configuration for optimal fitment on Honda vehicles. Part #UG04-17x64GB. Key Specifications: Size: 17x7.5 Bolt Pattern: 5x114.3 Finish: Gloss Black Offset: +35mm Bore: 64.1mm Seat Type: Honda Radius"],
  "Vertex Tires|46318483341501": ["7a8a24a62b", "This is the UG04-1880/OE Stance alloy wheel in Gloss Black finish. This 18x8.0 wheel features a 5x120 bolt pattern with +35mm offset and 64.1mm bore. Radius seat design provides optimal lug nut contact and secure wheel mounting. Part #UG04-1880-512064GB. Key Specifications: Size: 18x8.0 Bolt Pattern: 5x120 Finish: Gloss Black Offset: +35mm Bore: 64.1mm Seat Type: Radius"],
  "Vertex Tires|46318486814909": ["eeb14671c0", "This is the BC5/OE Stance alloy wheel in Gloss Black finish. This 19x8.5 wheel features a 5x120 bolt pattern with +35mm offset and 72.6mm bore. Conical seat design provides secure lug nut engagement and proper wheel mounting. Part #BC5-1985120GB. Key Specifications: Size: 19x8.5 Bolt Pattern: 5x120 Finish: Gloss Black Offset: +35mm Bore: 72.6mm Seat Type: Conical"],
  "Vertex Tires|46318486945981": ["d3ed6e4157", "This is the UG04 alloy wheel featuring an 18x8.0 configuration with 5x120 bolt pattern and Matt Gunmetal finish. Equipped with a radius seat design for secure fitment. Part #UG04-1880-512064MG. Key Specifications: Size: 18x8.0 Bolt Pattern: 5x120 Finish: Matt Gunmetal Offset: +35mm Bore: 64.1mm Seat Type: Radius"],
  "Vertex Tires|46324274593981": ["cc502fb340", "This is the MC2/OE Stance alloy wheel in Black finish. This 18x8.0 wheel features a 5x112 bolt pattern with +35mm offset and 66.6mm bore. Radius seat design provides optimal lug nut contact and secure wheel mounting. Part #MC2-18808. Key Specifications: Size: 18x8.0 Bolt Pattern: 5x112 Finish: Black Offset: +35mm Bore: 66.6mm Seat Type: Radius"],
  "Vertex Tires|46324332462269": ["1f76709b4e", "This is the MC7/OE Stance-Flow Form alloy wheel in Gloss Black finish. This 20x8.5 wheel features a 5x112 bolt pattern with +35mm offset and 66.6mm bore. Radius seat design provides optimal lug nut contact and secure wheel mounting. Part #MC7-2085-5112GB. Note: This model has been discontinued - limited availability. Key Specifications: Size: 20x8.5 Bolt Pattern: 5x112 Finish: Gloss Black Offset: +35mm Bore: 66.6mm Seat Type: Radius Status: Discontinued"],
  "Vertex Tires|46324353433789": ["911da63f70", "This is the MC4/OE Stance alloy wheel in Gloss Black finish. This 19x9.0 wheel features a 5x112 bolt pattern with +38mm offset and 66.6mm bore. Radius seat design ensures optimal lug nut contact and secure wheel mounting. Part #MC4-1990GB. Note: This model has been discontinued - limited availability. Key Specifications: Size: 19x9.0 Bolt Pattern: 5x112 Finish: Gloss Black Offset: +38mm Bore: 66.6mm Seat Type: Radius Load Rating: 17 Status: Discontinued"],
  "Vertex Tires|46324372603069": ["b27addc5e6", "This is the MC2/OE Stance alloy wheel in Gloss Black finish. This 19x9.0 wheel features a 5x112 bolt pattern with +35mm offset and 66.6mm bore. Radius seat design provides optimal lug nut contact and secure wheel mounting. Part #MC2-1990GB. Key Specifications: Size: 19x9.0 Bolt Pattern: 5x112 Finish: Gloss Black Offset: +35mm Bore: 66.6mm Seat Type: Radius"],
  "Vertex Tires|46324388233405": ["2b50f68a0d", "This is the UG05/OE Stance alloy wheel in Gloss Black finish. This 17x7.5 wheel features a 5x112 bolt pattern with +38mm offset and 66.6mm bore. Conical seat design ensures secure lug nut engagement and proper wheel mounting. Part #UG05-1775-511266C-GB. Key Specifications: Size: 17x7.5 Bolt Pattern: 5x112 Finish: Gloss Black Offset: +38mm Bore: 66.6mm Seat Type: Conical"],
  "Vertex Tires|46324423983293": ["cda782abe9", "This is the AR09/OE Stance-Flow Form alloy wheel in Gloss Black finish. This 20x9.0 wheel features a 5x112 bolt pattern with +28mm offset and 66.6mm bore. Radius seat design provides optimal lug nut contact and secure wheel mounting. Part #AR09-2090-5112GB. Key Specifications: Size: 20x9.0 Bolt Pattern: 5x112 Finish: Gloss Black Offset: +28mm Bore: 66.6mm Seat Type: Radius"],
  "Vertex Tires|46324437975229": ["da1b652dea", "This is the AC4/OE Stance alloy wheel in Gloss Black finish. This 19x8.5 wheel features a 5x112 bolt pattern with +28mm offset and 66.6mm bore. Radius seat design provides optimal lug nut contact and secure wheel mounting. Part #AC4-1985-5112GB. Key Specifications: Size: 19x8.5 Bolt Pattern: 5x112 Finish: Gloss Black Offset: +28mm Bore: 66.6mm Seat Type: Radius"],
  "Vertex Tires|46324450689213": ["bb3d71ef16", "This is the AC5/OE Stance alloy wheel in Gloss Black finish. This 20x9.0 wheel features a 5x112 bolt pattern with +28mm offset and 66.6mm bore. Radius seat design provides optimal lug nut contact and secure wheel mounting. Part #AC5-2090GB. Key Specifications: Size: 20x9.0 Bolt Pattern: 5x112 Finish: Gloss Black Offset: +28mm Bore: 66.6mm Seat Type: Radius"],
  "Vertex Tires|46324459602109": ["dccd33103c", "This is the AC5-20/OE Stance alloy wheel in Hyper Black finish. This 20x9.0 wheel features a 5x112 bolt pattern with +28mm offset and 66.6mm bore. Radius seat design provides optimal lug nut contact and secure wheel mounting. Part #AC5-2090HB. Key Specifications: Size: 20x9.0 Bolt Pattern: 5x112 Finish: Hyper Black Offset: +28mm Bore: 66.6mm Seat Type: Radius"],
  "Vertex Tires|46327379427517": ["bfd84a2a20", "This is the MC8/OE Stance alloy wheel in Gloss Black finish. This 19x8.0 wheel features a 5x112 bolt pattern with +33mm offset and 66.6mm bore. Radius seat design provides optimal lug nut contact and secure wheel mounting. Part #MC8-1980-51123GB. Key Specifications: Size: 19x8.0 Bolt Pattern: 5x112 Finish: Gloss Black Offset: +33mm Bore: 66.6mm Seat Type: Radius"],
  "Vertex Tires|46327383130301": ["2651e24185", "This is the AC4/OE Stance alloy wheel in Gloss Black finish. This 20x9.0 wheel features a 5x112 bolt pattern with +28mm offset and 66.6mm bore. Radius seat design provides optimal lug nut contact and secure wheel mounting. Part #AC4-2090-5112GB. Key Specifications: Size: 20x9.0 Bolt Pattern: 5x112 Finish: Gloss Black Offset: +28mm Bore: 66.6mm Seat Type: Radius"],
  "Vertex Tires|46327384637629": ["c0b89a4ea1", "This is the BC10/OE Stance alloy wheel in Gloss Black finish. This 19x8.5 wheel features a 5x112 bolt pattern with +25mm offset and 66.6mm bore. Conical seat design ensures secure lug nut engagement and proper wheel mounting. Part #BC10-1985GB. Key Specifications: Size: 19x8.5 Bolt Pattern: 5x112 Finish: Gloss Black Offset: +25mm Bore: 66.6mm Seat Type: Conical"],
  "Vertex Tires|46327385981117": ["fd9738d7ea", "This is the BR01/OE Stance alloy wheel in Gloss Black finish. This 19x8.5 wheel features a 5x112 bolt pattern with +25mm offset and 66.6mm bore. Conical seat design ensures secure lug nut engagement and proper wheel mounting. Part #BR01-1985GB. Key Specifications: Size: 19x8.5 Bolt Pattern: 5x112 Finish: Gloss Black Offset: +25mm Bore: 66.6mm Seat Type: Conical"],
  "Vertex Tires|46329314476221": ["4bd0fa9b24", "The HAIDA HD828 is a light truck tire engineered for versatility across changing weather conditions. With a 10-ply rating and load index of 125/122Q, it delivers robust load-carrying capacity for trucks and SUVs tackling both highway and light off-road terrain. The LT275/70R18 sizing provides ground clearance and sidewall strength. The all-season tread pattern maintains traction in rain, light snow, and dry conditions."],
  "Vertex Tires|46690539012285": ["1320b7406a", "The Haida EX-Comfort is designed to deliver a smooth, quiet ride with performance throughout the year. Built with an advanced all-season compound and an asymmetric tread design, it offers traction, handling, and enhanced driving comfort for everyday use. It is engineered with a specialized rubber compound that remains flexible across varying temperatures, ensuring consistent grip in different weather conditions. Continuous tread ribs and an optimized groove pattern improve steering precision and overall road control. Asymmetric tread design enhances road contact and traction, providing better grip and cornering in both dry and wet conditions. Wide circumferential grooves efficiently channel water away, reducing the risk of hydroplaning. The comfort-oriented ride is designed to minimize road noise and vibration, offering a quieter and more comfortable driving experience."],
  "Vertex Tires|46690558345405": ["8cf5ddf8cb", "This tire is engineered to reduce road noise and vibration, ensuring a smoother and quieter driving experience. Specialized rubber compound adapts to changing temperatures, maintaining consistent grip throughout the year. Asymmetric tread design improves road contact for enhanced traction and cornering in both dry and wet conditions. Continuous tread ribs and optimized groove layout provide better steering control and driving stability. Wide circumferential grooves efficiently disperse water, helping to resist hydroplaning and maintain traction on wet roads."],
  "Vertex Tires|46690571780285": ["1ae53ea5df", "The Haida EX-Comfort is designed to provide a smooth, quiet driving experience all year round. With its advanced all-season compound and asymmetric tread pattern, it delivers traction, enhanced comfort, and handling for everyday driving. A specialized rubber compound maintains flexibility across a wide range of temperatures, ensuring consistent grip in various weather conditions. Wide circumferential grooves effectively channel water away, helping to reduce the risk of hydroplaning on wet roads. The comfort-oriented design is engineered to minimize road noise and vibrations, providing a quieter and more comfortable ride. Asymmetric tread pattern enhances road contact for better traction and improved cornering performance in both dry and wet conditions. Continuous tread ribs and an optimized groove layout improve steering precision and overall driving control."],
  "Vertex Tires|46690573779133": ["9331063f01", "The Haida EX-Comfort is designed to deliver a smooth, quiet ride with all-season performance. Featuring an advanced rubber compound and an asymmetric tread design, it provides traction, stable handling, and enhanced comfort for everyday driving. A specialized compound maintains flexibility across varying temperatures, ensuring consistent grip throughout the year. Wide circumferential grooves efficiently channel water away to reduce the risk of hydroplaning on wet roads. Asymmetric tread design improves road contact for better traction and cornering in both dry and wet conditions. Continuous tread ribs and an optimized groove layout enhance steering precision and overall stability. The comfort-focused ride is engineered to minimize road noise and vibrations, delivering a quieter and smoother driving experience."],
  "Vertex Tires|46690579841213": ["c56d9e9837", "The Haida EX-Comfort 97W is designed to deliver a smooth, quiet ride with enhanced durability and all-season performance. With its advanced compound and asymmetric tread design, this tire offers strong traction, responsive handling, and improved load capacity. Asymmetric tread design improves road contact for enhanced traction and cornering in both dry and wet conditions. Continuous tread ribs and an optimized groove layout provide better steering precision and overall stability. Wide circumferential grooves efficiently channel water away to reduce the risk of hydroplaning. The comfort-focused ride is designed to minimize road noise and vibration, ensuring a quieter and smoother driving experience. Specialized rubber compound remains flexible across varying temperatures for consistent year-round performance."],
  "Vertex Tires|46690580234429": ["72b4f53aaf", "The Haida EX-Comfort 95H is designed to deliver a smooth, quiet ride with all-season performance. Built with an advanced rubber compound and an asymmetric tread pattern, it provides traction, enhanced comfort, and stable handling for everyday driving. Asymmetric tread design enhances road contact for improved traction and cornering in both dry and wet conditions. The comfort-focused ride is engineered to reduce road noise and vibration, ensuring a quieter and smoother driving experience. Wide circumferential grooves effectively channel water away to help resist hydroplaning on wet roads. Specialized rubber compound maintains flexibility across varying temperatures for consistent year-round grip. Continuous tread ribs and an optimized groove layout improve steering precision and overall stability."],
  "Vertex Tires|46690581053629": ["20936e016c", "With its advanced all-season compound and asymmetric tread design, this tire delivers strong traction, responsive handling, and a smooth, quiet ride. Wide circumferential grooves efficiently channel water away to help reduce the risk of hydroplaning. Continuous tread ribs and an optimized groove layout improve steering precision and overall stability. Asymmetric tread design enhances road contact for improved traction and cornering in both dry and wet conditions. Specialized rubber compound maintains flexibility across varying temperatures for consistent performance throughout the year. The comfort-focused ride is designed to minimize road noise and vibration, ensuring a quieter and smoother driving experience."],
  "Vertex Tires|46690590228669": ["2fee9c845b", "The Haida EX-Comfort 95W is designed to deliver a balance of comfort, durability, and year-round performance. With its advanced all-season compound and asymmetric tread pattern, it provides traction, smooth handling, and a quiet ride for everyday driving. Continuous tread ribs and an optimized groove layout enhance steering precision and driving stability. The comfort-focused ride is engineered to reduce road noise and vibration, ensuring a smoother and quieter driving experience. Wide circumferential grooves effectively channel water away to help resist hydroplaning on wet roads. Specialized rubber compound maintains flexibility across varying temperatures for consistent performance throughout the year. Asymmetric tread design improves road contact for better traction and cornering in both dry and wet conditions."],
  "Vertex Tires|46690595274941": ["8af4d975ea", "The Haida EX-Comfort 98W is engineered to deliver a smooth, quiet ride with enhanced strength and all-season performance. Designed with an advanced compound and asymmetric tread pattern, it offers traction, stable handling, and increased load capacity. Asymmetric tread design enhances road contact for improved traction and cornering in both dry and wet conditions. Continuous tread ribs and an optimized groove layout improve steering precision and overall stability. The comfort-focused ride is engineered to reduce road noise and vibration, ensuring a quieter and smoother driving experience. Specialized rubber compound maintains flexibility across varying temperatures for consistent year-round performance. Wide circumferential grooves efficiently channel water away to help resist hydroplaning on wet roads."],
  "Vertex Tires|46690597044413": ["56efcfb6b1", "The Haida EX-Comfort 94W is designed to deliver a sporty yet comfortable driving experience with all-season performance. Featuring an advanced compound and asymmetric tread pattern, it provides strong grip, responsive handling, and a smooth, quiet ride for everyday and highway driving. The comfort-focused design is engineered to reduce road noise and vibration for a quieter and smoother ride. Specialized rubber compound maintains flexibility across varying temperatures for consistent year-round performance. Wide circumferential grooves efficiently channel water away to help reduce hydroplaning risk. Asymmetric tread pattern improves road contact for better traction and cornering in both dry and wet conditions. Continuous tread ribs and optimized groove layout enhance steering precision and driving stability."],
  "Vertex Tires|46690633220285": ["fc835d8f0f", "Asymmetric tread design enhances road contact for improved traction and cornering in both dry and wet conditions. All-season compound maintains flexibility across a wide range of temperatures for year-round performance. Continuous tread ribs and an optimized groove layout improve steering precision and driving stability. The comfort-focused ride is engineered to reduce road noise and vibration for a quieter and smoother driving experience. Wide circumferential grooves efficiently channel water away to help resist hydroplaning."],
  "Vertex Tires|46690634760381": ["c4508fb06e", "The Haida EX-Comfort 95W is designed to deliver a sporty yet comfortable driving experience with year-round performance. Featuring an advanced all-season compound and asymmetric tread design, it offers strong traction, precise handling, and a smooth, quiet ride for everyday and highway use. The comfort-focused design is engineered to reduce road noise and vibration for a quieter driving experience. Wide circumferential grooves efficiently channel water away to help reduce hydroplaning risk on wet roads. Asymmetric tread pattern improves road contact for better grip and cornering in both dry and wet conditions. Continuous tread ribs and optimized groove layout enhance steering precision and stability. Specialized rubber compound maintains flexibility across varying temperatures for consistent year-round performance."],
  "Vertex Tires|46690638758077": ["2ae6052b19", "Extra Load (XL) design provides increased strength and higher load-carrying capacity for performance vehicles. Asymmetric tread pattern enhances road contact for improved traction and precise cornering in both dry and wet conditions. The comfort-focused design is engineered to reduce road noise and vibration for a smoother ride. Wide circumferential grooves efficiently channel water away to help resist hydroplaning. Continuous tread ribs and optimized groove layout improve steering stability and driving control. Specialized rubber compound maintains flexibility across varying temperatures for consistent year-round performance."],
  "Vertex Tires|46690965586109": ["44afb97bc8", "The Haida HD625 All-Weather is a true year-round performance tire. With its 3PMSF (Three-Peak Mountain Snowflake) certification, it is approved for severe snow use while still delivering strong everyday road performance. It is engineered to perform consistently in dry, wet, and snowy conditions for true year-round usability. Wide longitudinal and cascading grooves quickly channel water and slush away from the tread to reduce hydroplaning. Reinforced shoulder blocks and asymmetric tread design improve steering response and road stability. High-density siping and optimized tread layout promote uniform wear for extended durability."],
  "Vertex Tires|46690968076477": ["e3b36f8d39", "The Haida HD625 All-Weather is a high-performance year-round tire designed to deliver traction in dry, wet, and winter conditions. With its 3PMSF (Three-Peak Mountain Snowflake) certification, it is approved for severe snow use while maintaining strong everyday driving performance. It is severe snow certified (3PMSF) with enhanced biting edges and dense sipes for improved grip on snow and ice. It provides traction in dry, wet, and snowy conditions for true year-round usability. Wide longitudinal and cascade grooves quickly channel water and slush away to reduce hydroplaning risk. Asymmetric tread design and reinforced shoulder blocks improve steering precision and road stability. High-density siping and optimized tread layout promote uniform wear for longer durability."],
  "Vertex Tires|46690968535229": ["d026f18a38", "The Haida HD625 All-Weather is a year-round tire designed to deliver performance in dry, wet, and winter conditions. With its 3PMSF (Three-Peak Mountain Snowflake) certification, it is approved for severe snow use while maintaining stable handling and comfort in everyday driving. It is designed to perform consistently in dry, wet, and snowy conditions for true year-round usability. Wide longitudinal and cascade grooves quickly channel water and slush away from the tread to reduce hydroplaning risk. Asymmetric tread pattern and reinforced shoulder blocks improve steering precision and driving stability. High-density siping and optimized tread layout promote uniform wear for extended durability."],
  "Vertex Tires|46690969747645": ["28636399b0", "The Haida HD625 All-Weather is a high-performance year-round tire engineered to deliver traction in dry, wet, and winter conditions. With its 3PMSF (Three-Peak Mountain Snowflake) certification, it is approved for severe snow use while maintaining comfort, stability, and control for everyday driving. It is severe snow certified (3PMSF) with enhanced biting edges and dense sipes for strong grip on snow and ice. It is built to perform in dry, wet, and snowy conditions for true year-round usability. Wide longitudinal and cascade grooves quickly channel water and slush away to help reduce hydroplaning risk. Asymmetric tread design and reinforced shoulder blocks improve steering precision and road stability. High-density siping and optimized tread layout promote uniform wear for extended durability."],
  "Vertex Tires|46690976694461": ["4064c138f3", "The Haida HD625 All-Weather is a year-round tire engineered to deliver performance in dry, wet, and winter conditions. With its 3PMSF (Three-Peak Mountain Snowflake) certification, it is approved for severe snow use while maintaining stable handling, comfort, and control for everyday driving. It is severe snow certified (3PMSF) with enhanced biting edges and high-density sipes for improved traction on snow and ice. It is built to deliver consistent grip and control in dry, wet, and snowy conditions throughout the year. Wide longitudinal and cascade grooves quickly channel water and slush away to reduce hydroplaning risk. Asymmetric tread pattern and reinforced shoulder blocks improve steering precision and road stability. High-density siping and optimized tread layout promote uniform wear for longer-lasting performance."],
  "Vertex Tires|46690980954301": ["48cd8775d3", "The Haida HD625 All-Weather is a high-performance year-round tire designed to deliver traction and control in dry, wet, and winter conditions. With its 3PMSF (Three-Peak Mountain Snowflake) certification, it is approved for severe snow use while maintaining sporty handling, comfort, and stability. It is severe snow certified (3PMSF) with enhanced biting edges and dense sipes for strong grip on snow and ice. It is designed for year-round use in dry, wet, and snowy conditions. Wide longitudinal and cascade grooves quickly channel water and slush away to reduce hydroplaning risk. Asymmetric tread design and reinforced shoulder blocks improve steering precision and road stability. High-density siping and optimized tread layout promote uniform wear for longer-lasting performance."],
  "Vertex Tires|46690982199485": ["31710052e5", "The Haida HD625 All-Weather is a year-round tire engineered to deliver performance in dry, wet, and winter conditions. With its 3PMSF (Three-Peak Mountain Snowflake) certification, it is approved for severe snow use while maintaining handling, comfort, and stability for everyday driving. It is severe snow certified (3PMSF) with enhanced biting edges and dense sipes for strong grip on snow and ice. It is built to deliver consistent traction and control in dry, wet, and snowy conditions year-round. Wide longitudinal and cascade grooves channel water and slush away from the contact patch to reduce hydroplaning risk. Asymmetric tread design and reinforced shoulder blocks improve steering precision and road stability. High-density siping and optimized tread layout promote uniform wear for extended durability."],
  "Vertex Tires|46690983837885": ["e6159f993d", "The Haida HD625 All-Weather is a high-performance year-round tire designed to deliver traction and control in dry, wet, and winter conditions. With its 3PMSF (Three-Peak Mountain Snowflake) certification, it is approved for severe snow use while maintaining comfort, stability, and handling. It is severe snow certified (3PMSF) with enhanced biting edges and high-density sipes for grip on snow and ice. It is built to perform consistently in dry, wet, and snowy conditions for true year-round usability. Asymmetric tread design and reinforced shoulder blocks improve steering precision and road stability. High-density siping and optimized tread layout promote uniform wear for longer-lasting durability. Wide longitudinal and cascade grooves channel water and slush away from the contact patch to help reduce hydroplaning risk."],
  "Vertex Tires|46690985050301": ["4ad3c4928a", "The Haida HD625 All-Weather is a high-performance year-round tire designed to deliver traction and control in dry, wet, and winter conditions. With its 3PMSF (Three-Peak Mountain Snowflake) certification, it is approved for severe snow use while maintaining sporty handling, comfort, and stability. Asymmetric tread design and reinforced shoulder blocks improve road contact, steering precision, and overall driving stability. High-density siping and an optimized tread layout promote uniform wear for longer-lasting durability. It is engineered to provide traction in dry, wet, and snowy conditions for true year-round usability. Wide longitudinal and cascade grooves channel water and slush away from the contact patch to reduce hydroplaning risk. It is severe snow certified (3PMSF) with enhanced biting edges and sipes to deliver grip on snow and ice."],
  "Vertex Tires|46690994094269": ["b8b58f3b8c", "This tire is designed for light trucks, SUVs, and 4x4 vehicles. 3D tread pattern provides traction in dry, wet, and mixed weather conditions year-round. Wide tread blocks and deep voids enhance traction on mud, dirt, gravel, and rough surfaces. Open grooves help eject mud, snow, and debris to maintain consistent traction off-road. Reinforced sidewalls and anti-collision design improve resistance to punctures and impacts on tough terrain. Optimized tread geometry and shoulder design enhance steering precision and directional stability."],
  "Vertex Tires|46690996879549": ["cc6d15d238", "Designed for sporty sedans and performance vehicles, this ultra-high-performance summer tire delivers strong grip, responsive handling, and braking in both dry and wet conditions. Asymmetric tread pattern with optimized block placement enhances grip, steering precision, and driving stability. Specialized rubber compound improves road adhesion and traction, especially at higher speeds. Strong outer shoulder blocks and a rigid tread layout deliver cornering stability and quick steering response. Wide longitudinal grooves and internal ribs channel water away to reduce hydroplaning risk. Sequential tread block design enhances braking control and traction on both dry and wet roads. Extra Load (XL) design provides increased strength and higher load-carrying capacity for performance vehicles."],
  "Vertex Tires|46691031056573": ["4189f9c0d2", "The Haida HD937 UHP is designed to deliver a balance of performance, comfort, and stability for everyday driving and highway use. Engineered for passenger cars, SUVs, and crossovers, it provides responsive handling, traction, and a smooth, quiet ride in warm weather conditions. Performance-oriented compound resists heat buildup, ensuring stable traction and control at higher speeds. Optimized tread layout reduces road noise and vibration for a smoother driving experience. Wide ribs and circumferential grooves channel water away to reduce hydroplaning risk and improve wet traction. Reinforced shoulder blocks and optimized tread geometry enhance steering precision and driving stability. Asymmetric tread pattern and strong block design provide grip, especially in dry conditions."],
  "Vertex Tires|46691031220413": ["c52b1306a6", "The Haida HD937 UHP is engineered to deliver a balanced combination of performance, comfort, and stability for modern passenger vehicles, SUVs, and crossovers. Designed for warm-weather driving, it offers responsive handling, traction, and a smooth, quiet ride for both city and highway use. Wide ribs and circumferential grooves channel water away from the contact patch to help reduce hydroplaning risk and improve wet traction. Reinforced shoulder blocks and optimized tread geometry enhance steering precision and high-speed stability. Carefully designed tread layout minimizes road noise and vibration for a smoother driving experience. Asymmetric tread pattern and robust block design improve road contact for grip in dry conditions. Performance-focused compound resists heat buildup, ensuring consistent traction and control during highway driving."],
  "Vertex Tires|46691032203453": ["0e6502733e", "Designed for SUVs and crossovers, this ultra-high-performance summer tire delivers strong grip, responsive handling, and a smooth, quiet ride in warm weather conditions. Extra Load (XL) design provides increased strength and higher load-carrying capacity for heavier vehicles like SUVs and crossovers. Wide ribs and circumferential grooves channel water away from the contact patch to help reduce hydroplaning risk and improve wet traction. Performance-oriented compound resists heat buildup, ensuring stable traction and control during highway and high-speed driving. Asymmetric tread pattern and robust block design enhance road contact for grip, especially in dry conditions. Optimized tread layout minimizes road noise and vibration for a smoother driving experience. Reinforced shoulder blocks and advanced tread geometry improve steering precision and overall stability."],
  "Vertex Tires|46716413214909": ["6b05f9480a", "The Haida EX-Comfort 88H is designed to provide a smooth, quiet ride with all-season performance. Featuring an advanced rubber compound and an asymmetric tread pattern, it delivers traction, stable handling, and enhanced comfort for everyday driving. Asymmetric tread design enhances road contact for improved traction and cornering in both dry and wet conditions. Continuous tread ribs and an optimized groove layout improve steering precision and overall driving stability. Specialized rubber compound maintains flexibility across varying temperatures for consistent year-round performance. The comfort-focused ride is engineered to reduce road noise and vibration, ensuring a quieter and smoother driving experience. Wide circumferential grooves effectively channel water away to help reduce the risk of hydroplaning."],
  "Vertex Tires|46716452339901": ["dedcf6ab6c", "The Haida EX-Comfort 88V is designed to deliver a smooth, quiet ride with all-season performance. Featuring an advanced rubber compound and an asymmetric tread pattern, it provides traction, stable handling, and enhanced comfort for everyday driving. The comfort-focused design is engineered to reduce road noise and vibration, ensuring a quieter and smoother driving experience. Asymmetric tread pattern enhances road contact for improved traction and cornering in both dry and wet conditions. Continuous tread ribs and an optimized groove layout improve steering precision and driving stability. Specialized rubber compound maintains flexibility across varying temperatures for consistent year-round performance. Wide circumferential grooves efficiently channel water away to help reduce the risk of hydroplaning."],
  "Vertex Tires|46716495724733": ["fef26b1ed6", "The Haida EX-Comfort 94H is designed to deliver a smooth, quiet ride with all-season performance. Featuring an advanced rubber compound and an asymmetric tread pattern, it offers traction, stable handling, and enhanced comfort for everyday driving. Specialized rubber compound maintains flexibility across varying temperatures for consistent year-round performance. Wide circumferential grooves efficiently channel water away to help reduce the risk of hydroplaning. Asymmetric tread pattern improves road contact for better traction and cornering in both dry and wet conditions. Continuous tread ribs and optimized groove layout enhance steering precision and driving stability. The comfort-focused ride is engineered to minimize road noise and vibration for a smoother, quieter driving experience."],
  "Vertex Tires|46716537569469": ["a1a79443eb", "The HAIDA EX-COMFORT delivers all-season performance for everyday driving. This 205/50ZR17 93W tire balances comfort and durability across wet, dry, and light winter conditions."],
  "Vertex Tires|46716575219901": ["c99255fbe0", "The HAIDA EX-COMFORT All Season tire is engineered for balanced handling, fuel efficiency, and a comfortable ride for everyday driving. The 225/55R17 97V size fits a wide range of sedans and crossovers, providing traction on wet and dry roads. Built with durable compound technology, it offers extended tread life and consistent performance throughout the seasons."],
  "Vertex Tires|46716634267837": ["6b5f589fdf", "The HAIDA HD317 EV is engineered specifically for electric vehicles. This all-season tire features advanced tread design that reduces rolling resistance, helping maximize your EV's range while maintaining grip in wet and dry conditions. The 255/55R19 111V XL size provides a comfortable ride with enhanced load capacity. Reinforced sidewalls ensure durability and stability, while the specialized compound offers traction year-round."],
  "Vertex Tires|46716694560957": ["2aabc20954", "The HAIDA HD625 delivers all-weather performance. This 235/55ZR17 tire features 3PMSF certification, meeting severe winter driving standards with enhanced snow and ice traction."],
  "Vertex Tires|46716731490493": ["82224b050b", "The HAIDA HD625 delivers all-weather performance. With 3PMSF certification, this tire meets severe winter weather standards, providing grip on snow, ice, and wet roads. The 235/50ZR18 101W sizing suits a wide range of sedans and crossovers, balancing comfort with responsive handling."],
  "Vertex Tires|46716752953533": ["f76117fbdf", "The HAIDA HD625 delivers all-weather performance. This 235/55ZR18 tire features 3PMSF certification, meeting severe winter weather standards for enhanced traction in snow and ice. Engineered for year-round versatility, the HD625 balances winter grip with summer stability, reducing the need for seasonal tire changes."],
  "Vertex Tires|46717046948029": ["29a505f802", "The HAIDA HD668 is a touring tire engineered for balanced performance across changing weather conditions. Featuring a durable tread compound and optimized grip pattern, it delivers grip on both wet and dry roads while maintaining fuel efficiency. The 225/60R16 98H load rating suits mid-size sedans and crossovers, offering a smooth, quiet ride for daily commuting and highway driving. Built to withstand road conditions, this tire provides traction and longevity."],
  "Vertex Tires|46717063069885": ["fb6c025034", "The HAIDA HD828 235/65R18 delivers all-terrain performance for trucks and SUVs. The HD828 provides consistent grip through changing weather while maintaining fuel efficiency."],
  "Vertex Tires|46719475941565": ["49824f9cb5", "The HAIDA HD927 is a summer tire engineered for sports cars and high-powered sedans. Featuring an aggressive tread pattern and reinforced sidewalls, it delivers grip and precise handling on both dry and wet roads. The XL load rating ensures durability under driving conditions. Advanced rubber compounds provide braking performance and reduced rolling resistance for improved fuel efficiency."],
  "Vertex Tires|46719500452029": ["1230da5a3b", "The HAIDA HD927SP delivers summer performance. Built with advanced grip technology, this ultra-high-performance tire excels in wet and dry conditions. The reinforced sidewall construction ensures precise steering feedback, while the optimized tread pattern reduces road noise for a smoother ride. It is engineered for sports cars and high-performance vehicles."],
  "Vertex Tires|46719525486781": ["9b6f9fffcf", "The HAIDA HD937 XL delivers all-season performance in a 215/40ZR17 87W size. The XL load rating provides extra capacity for heavier vehicles."],
  "Vertex Tires|46719558713533": ["bd9489d352", "The HAIDA HD937 delivers responsive handling, braking, and fuel-efficient performance on both wet and dry roads. It is built with advanced tread compound technology to resist wear and extend tire life. The 255/45ZR19 104Y sizing fits a wide range of sport sedans and coupes, offering a balanced blend of comfort and control."],
  "Vertex Tires|46719569035453": ["63e49abbb2", "The HAIDA HD937 delivers all-season performance in an XL load-rated tire. The reinforced sidewall construction supports heavier loads while maintaining ride comfort."],
  "Vertex Tires|46719576867005": ["d42bc2ae79", "The HAIDA HD937 XL delivers all-season performance. Engineered with advanced tread design, these 255/45ZR20 tires provide grip in wet and dry conditions while maintaining fuel efficiency. The XL load rating ensures robust support for heavier vehicles."],
  "Vertex Tires|46719582273725": ["8f06e15090", "The HAIDA HD937 XL All-Season tire is for changing weather conditions. Engineered for passenger vehicles and crossovers, this 275/45ZR20 110W tire combines responsive handling with enhanced traction on wet and dry roads. The XL load rating provides extra durability for heavier loads, while the advanced tread design promotes even wear and extended tread life."],
  "Vertex Tires|47641326518461": ["47ede34582", "The Continental ContiProContact is an all-season tire, size 155/60R15 with 74T load and speed rating. It is engineered for balanced performance across wet, dry, and light winter conditions. It features advanced grip technology and responsive handling for compact and subcompact vehicles."],
  "Vertex Tires|47642253492413": ["bb1191b37e", "This is a performance tire engineered for traction in wet, dry, and light winter conditions. The Hankook Weatherflex GT delivers responsive handling and fuel efficiency with a reinforced tread design that resists wear. Load index 91H supports mid-size sedans and crossovers."],
  "Vertex Tires|47672131059901": ["7d39d407ac", "Engineered for electric and hybrid vehicles, the Hankook ION EVO AS delivers responsive handling and extended range on all-season roads. The XL load rating (102W) supports heavier EV powertrains, while advanced tread compounds reduce rolling resistance for improved efficiency. Optimized grip in wet and dry conditions keeps your vehicle stable year-round."],
  "Vertex Tires|47672140038333": ["56f071e821", "The Hankook Ventus S1 Noble2 H452 delivers all-season performance. Engineered for sedans and coupes, this 255/45R19 tire combines responsive steering with consistent grip across wet and dry conditions. The advanced tread pattern reduces road noise while promoting even wear, extending tire life. Load-rated at 100H, it handles highway speeds."],
  "Vertex Tires|47672143216829": ["0715b0be8f", "Engineered with advanced tread compound technology, this tire provides grip in wet, dry, and light winter conditions. The XL load rating (109V) supports heavier vehicles while maintaining fuel efficiency."],
  "Vertex Tires|47672146428093": ["d58a509ad3", "The Hankook Dynapro AT2 Xtreme in LT275/60R20 delivers all-season performance for trucks and SUVs tackling both highway and off-road terrain. Built with reinforced sidewalls and an aggressive tread pattern, this tire provides enhanced traction in mud, snow, and gravel while maintaining stability on pavement. The LRD load rating (119/116S) ensures durability under heavy loads. The Dynapro AT2 Xtreme balances year-round grip with extended tread life."],
  "Vertex Tires|47672148721853": ["137dc3d77a", "Engineered for year-round performance, the Hankook Weatherflex GT is for wet, dry, and light winter conditions. The XL load rating supports heavier vehicles with enhanced stability, while the advanced tread compound maintains grip across temperature swings."],
  "Vertex Tires|47672151081149": ["eb39e42ee6", "The Hankook Weatherflex GT is for wet, dry, and light winter conditions with advanced grip technology and responsive steering. XL load rating (98V) supports heavier vehicles with enhanced stability. The sidewall is blackwall (BSW)."],
  "Vertex Tires|47672154095805": ["9ab45de18c", "The Hankook Kinergy PT delivers all-season performance for everyday driving. Engineered with advanced tread design, this tire provides balanced grip in wet, dry, and light winter conditions. The 215/55R17 94V sizing suits mid-size sedans and crossovers, offering a smooth ride and responsive handling."],
  "Vertex Tires|47672157536445": ["100a0f12f7", "This is an all-season tire engineered for electric and hybrid SUVs. The Hankook ION EVO AS delivers responsive handling, reduced rolling resistance for extended range, and wet/dry grip. XL load rating (104W) supports heavier EV powertrains."],
  "Vertex Tires|47672159600829": ["8efd6d8359", "This is an all-season performance tire engineered for sport sedans and coupes. The Hankook Ventus S1 AS H125 delivers responsive handling, braking, and traction across wet, dry, and light winter conditions. XL load rating ensures durability for heavier vehicles. DOT-approved for North American roads."],
  "Vertex Tires|47672163696829": ["06ea5fa8ce", "This is a heavy-duty all-season performance tire engineered for light trucks and SUVs. The Hankook Dynapro AT2 Xtreme delivers aggressive tread design for enhanced traction on both paved roads and off-road terrain. LRE sidewall construction provides load-carrying capacity rated at 125/122S, ensuring durability."],
  "Vertex Tires|47672180146365": ["e49219c314", "Engineered for balanced traction in wet, dry, and light winter conditions, this tire delivers responsive handling and consistent braking power. The reinforced sidewall construction ensures durability, while the optimized tread pattern reduces road noise for a quieter ride."],
  "Vertex Tires|47672365154493": ["70a8147b04", "The Hankook Kinergy GT H436 delivers all-season performance. Engineered with advanced tread technology, this tire provides grip in wet and dry conditions while maintaining fuel efficiency. The 235/60R18 sizing suits a wide range of sedans and crossovers."],
  "Vertex Tires|47672376852669": ["c61081be23", "Engineered with advanced tread technology, this tire provides grip in wet, dry, and light winter conditions. The XL load rating ensures robust support for heavier vehicles, while the reinforced sidewall construction enhances stability during cornering and highway driving."],
  "Vertex Tires|47672379179197": ["7150d28ca5", "This is an all-season tire engineered for electric vehicles. The Hankook Kinergy AS X EV delivers optimized grip, reduced rolling resistance, and enhanced fuel efficiency across wet and dry conditions. XL load rating ensures durability for heavier EV powertrains."],
  "Vertex Tires|47672380752061": ["ce3c50d64a", "The Hankook Dynapro AT2 Xtreme delivers all-season performance for trucks and SUVs tackling both highway and off-road terrain. Built with advanced tread compound and reinforced sidewalls, this tire offers enhanced durability, improved traction in wet and light snow conditions, and extended tread life. The aggressive tread pattern provides grip on gravel, mud, and rocky surfaces while maintaining stability on paved roads."],
  "Vertex Tires|47672382947517": ["0a2e32dfce", "The Hankook ION EVO AS is an all-season tire engineered for electric vehicles and modern sedans. The 235/45R18 XL load rating delivers enhanced durability and stability across wet, dry, and light winter conditions. Low rolling resistance reduces energy consumption. Reinforced sidewalls and advanced tread compound provide responsive handling and extended tread life. Load index 98W supports heavier vehicles. DOT-approved for North American roads."],
  "Vertex Tires|47672385732797": ["8c7a937938", "This is an all-season performance tire engineered for modern SUVs and crossovers. The Hankook ION EVO AS delivers responsive handling, braking, and traction across wet, dry, and light winter conditions. XL load rating (101V) supports heavier vehicles with enhanced stability. The sidewall is black (BSW)."],
  "Vertex Tires|47672387469501": ["95fcc33d63", "This is a performance tire engineered for responsive handling and traction across changing weather conditions. The Hankook Weatherflex GT delivers balanced grip on wet and dry roads while maintaining fuel efficiency. XL load rating ensures durability."],
  "Vertex Tires|47672394154173": ["ee49f9bff9", "The Hankook Weatherflex GT tire is for changing weather conditions. The 235/65R17 104H size fits a wide range of sedans and crossovers, offering balanced traction on wet, dry, and light winter roads. It is engineered for everyday driving comfort with responsive handling and predictable braking."],
  "Vertex Tires|47672395923645": ["f25d746f88", "The Hankook Ventus S1 AS H125 all-season tire delivers balanced performance across wet, dry, and light winter conditions. The XL load rating (103Y) supports heavier vehicles with enhanced stability and durability. Size 245/45R20 fits a wide range of sport-oriented vehicles."],
  "Vertex Tires|47672398905533": ["0b9b819297", "This LT-rated tire delivers aggressive tread design for enhanced traction on gravel, mud, and snow while maintaining stability on highways. The 124/121S load and speed rating supports heavy payloads. All-season compound ensures performance from summer heat to winter conditions."],
  "Vertex Tires|47672400740541": ["8c3f73eb88", "The Hankook Ventus S1 AS H125 delivers grip in wet, dry, and light winter conditions with advanced tread compound technology. XL load rating (106Y) supports heavier vehicles with enhanced stability. The sidewall is blackwall (BSW)."],
  "Vertex Tires|47672402444477": ["752ed49a01", "With a 225/60R18 sizing and 100H load and speed rating, this tire handles everyday driving across varying weather conditions. The Weatherflex GT features advanced tread design that maintains grip on wet and dry roads while resisting uneven wear. Its reinforced sidewalls provide stability during cornering, and the compound ensures consistent performance from spring through winter."],
  "Vertex Tires|47672406212797": ["5067cf1fde", "This is an all-season performance tire engineered for SUVs and crossovers. The Hankook Dynapro HPX RA43 delivers responsive handling, braking, and traction across wet, dry, and light winter conditions. Load index 102H supports heavier vehicles with sustained highway speeds."],
  "Vertex Tires|47672698765501": ["667f21bf5f", "The Michelin Defender 2 delivers all-season performance for everyday driving. Built with advanced tread design, this tire offers enhanced grip in wet and dry conditions while maximizing fuel efficiency. The reinforced sidewall construction provides durability and puncture resistance. Load index 102H is for mid-size SUVs and crossovers."],
  "Vertex Tires|47672760336573": ["6e5c0eb871", "The Michelin Agilis CrossClimate 2 is a light truck tire engineered for year-round performance in diverse weather conditions. Built with Michelin's advanced grip technology, it delivers traction on wet, dry, and winter roads while maintaining fuel efficiency. Designed for commercial and fleet applications, the LT225/75R16 load range E (LRE) configuration supports heavy loads with a 115/112R speed rating. The reinforced sidewall construction ensures durability. Key features include enhanced braking performance, reduced rolling resistance, and extended tread life. The all-season compound adapts to temperature changes, providing consistent handling from summer heat to winter cold."],
  "Vertex Tires|47672792187069": ["130dfb6e3f", "The Michelin Pilot Sport 4 delivers precise steering feedback, enhanced braking control, and reduced stopping distances on both wet and dry roads. Built with advanced rubber compounds and reinforced sidewalls, this XL-rated tire offers extended load capacity and durability for sport-oriented vehicles."],
  "Vertex Tires|47672825348285": ["501781bed1", "The Michelin Defender 2 in 245/60R18 XL 109H is engineered for extended tread life. This BlackSidewall (BSW) tire is for wet, dry, and light winter conditions while maintaining fuel efficiency. Built with Michelin's durability technology, the Defender 2 offers a quiet, comfortable ride and wear resistance. Load index 109H supports heavier vehicles."],
  "Vertex Tires|47672841404605": ["c443223e6d", "The Michelin Agilis CrossClimate LT245/75R17 is an all-season light truck tire engineered for year-round performance. Load Range E (121/118R) delivers robust load capacity for commercial and heavy-duty applications. CrossClimate technology balances wet, dry, and winter traction without seasonal swaps."],
  "Vertex Tires|47672861163709": ["2570bfd7df", "The Michelin CrossClimate 2 is engineered for year-round performance in diverse weather conditions. The 235/50R20 XL size delivers enhanced load capacity and durability for SUVs and crossovers. Advanced tread compound and siping technology provide grip on wet, dry, and light snow surfaces. Reinforced sidewalls ensure stability and longevity. V-rated for speeds up to 240 km/h. The sidewall is black (BSW)."],
  "Vertex Tires|47672904614077": ["c278ab4f5d", "This is an all-season tire engineered for light trucks and SUVs. The Michelin Defender LTX M/S 2 delivers traction in wet, dry, and light winter conditions with a reinforced sidewall construction for enhanced durability. Load index 116 supports heavy payloads."],
  "Vertex Tires|47672912969917": ["ef7da82a31", "This LT275/65R18 load range E tire delivers robust traction across wet, dry, and light winter conditions while resisting wear for extended tread life. The reinforced sidewall construction handles heavy loads and challenging road surfaces. Load Index 123/120S ensures safe performance."],
  "Vertex Tires|47672919752893": ["b4821b66a9", "This LT265/70R17 load range E tire delivers robust traction across wet, dry, and light snow conditions with reinforced sidewalls designed to resist punctures and cuts. The open shoulder tread pattern enhances off-road grip while maintaining highway stability."],
  "Vertex Tires|47672930533565": ["4a4384c5a6", "The Michelin Defender LTX M/S 2 is engineered for light trucks and SUVs. This 245/60R20 XL load-rated tire delivers traction in wet, dry, and light winter conditions while maximizing tread life through Michelin's advanced rubber compound. The M/S (mud and snow) rating ensures grip when conditions change. The 111H speed and load rating supports heavy payloads while maintaining safe highway performance."],
  "Vertex Tires|47672941838525": ["feb5fc2c3a", "The Michelin Defender 2 is an all-season tire engineered for durability and year-round performance. It is built with Michelin's ComfortControl technology to reduce road noise and vibration, extending tire life while maintaining fuel efficiency."],
  "Vertex Tires|47672951832765": ["e5463b69be", "The Michelin Defender 2 is an all-season tire engineered for everyday durability and performance across changing weather conditions. The 235/65R18 106H load rating delivers traction on wet and dry roads while maintaining fuel efficiency. It is built with Michelin's ComfortControl technology to reduce road noise and vibration, ensuring a smoother, quieter ride. Load Index 106 supports vehicles up to 951 kg per tire."],
  "Vertex Tires|47673001214141": ["6395ed8b5f", "The Michelin Pilot Sport 4 is an all-season tire engineered for responsive handling and grip in wet, dry, and light winter conditions. The XL load rating delivers enhanced load capacity for performance vehicles. Advanced tread compound and reinforced sidewalls provide precise steering feedback and reduced braking distances. Size 225/40R19, load index 93, speed rating Y."],
  "Vertex Tires|47673010585789": ["d8e1a0ef7c", "The Michelin Pilot Sport 4 delivers all-season performance. Built with advanced grip technology, this tire excels on both wet and dry roads while maintaining braking control. The reinforced sidewall construction ensures durability through driving conditions."],
  "Vertex Tires|47673019695293": ["c2678b4a78", "The Michelin CrossClimate 2 delivers year-round advanced grip on wet, dry, and winter roads. This tire combines a reinforced tread design with innovative rubber compounds to maintain performance across temperature extremes. The XL load rating (95V) supports heavier loads while the 205/55R17 fitment suits a wide range of sedans and crossovers."],
  "Vertex Tires|47673037422781": ["4531ad9958", "The Michelin CrossClimate 2 215/50R17 XL 95V is engineered for performance across changing weather. Advanced grip technology handles rain, snow, and dry roads. The XL load rating supports heavier vehicles, while the reinforced structure resists wear and extends tire life. Michelin's compound delivers consistent handling and safety in unpredictable conditions."],
  "Vertex Tires|47673042927805": ["958d971f03", "The Michelin CrossClimate 2 is engineered for year-round performance in diverse weather conditions. The 255/45R19 XL size delivers enhanced load capacity and stability for sedans and crossovers. Advanced grip technology ensures handling on wet, dry, and light snow surfaces. Reinforced sidewalls provide durability and puncture resistance. V-speed rating supports highway driving up to 240 km/h."],
  "Vertex Tires|47673050464445": ["d1362d87d8", "The Michelin CrossClimate 2 delivers year-round advanced grip in wet, dry, and winter conditions. This all-season tire combines a reinforced tread structure with innovative rubber compounds to reduce braking distances and enhance handling across temperatures. The XL load rating (102V) supports heavier vehicles with sustained performance."],
  "Vertex Tires|47673056919741": ["3e227b68ae", "The Michelin LTX A/T 2 is an all-season tire engineered for light trucks and SUVs. The 275/60R20 114S load rating delivers traction across wet, dry, and light snow conditions. Advanced tread design resists wear and enhances fuel efficiency."],
  "Vertex Tires|47673137103037": ["3802bdc10c", "The Yokohama Geolandar A/T4 G018 is a light truck tire engineered for on-road comfort and off-road capability. The LT275/70R18 load range E delivers 125/122S load index performance with open-shoulder tread design for enhanced traction on gravel, dirt, and mixed terrain. The sidewall branding is OWL."],
  "Vertex Tires|47673148014781": ["0d320a04b7", "The Yokohama Geolandar CV G058 delivers all-season performance for light trucks, SUVs, and vans. This 215/70R16 tire combines durability with balanced handling across wet, dry, and light winter conditions. The reinforced sidewalls provide load capacity at 100H rating, while the tread design minimizes road noise and extends tire life."],
  "Vertex Tires|47673164497085": ["fbe1443183", "The Uniroyal Tiger Paw Touring A/S delivers all-season performance for everyday driving. Engineered with advanced tread design, this tire provides grip in wet, dry, and light winter conditions. The 225/65R17 102H sizing fits a wide range of sedans and crossovers, offering a smooth, quiet ride with fuel efficiency."],
  "Vertex Tires|47673184026813": ["1f5d030540", "This is an all-season performance tire engineered for year-round traction and comfort. The Uniroyal Tiger Paw Touring A/S delivers responsive handling on wet and dry roads while maintaining fuel efficiency. XL load rating (97H) supports heavier vehicles."],
  "Vertex Tires|47673191039165": ["7e7aeb76fb", "The Uniroyal Tiger Paw Touring A/S delivers all-season performance for sedans and crossovers. This 235/55R20 tire combines responsive handling with traction across wet, dry, and light winter conditions. The 102H rating ensures durability and load capacity for everyday driving. Advanced tread design reduces road noise while promoting even wear and extended tire life."],
  "Vertex Tires|47673195561149": ["e54f704570", "The Uniroyal Tiger Paw Touring A/S delivers all-season performance for everyday driving. The 215/55R17 94V size fits a wide range of sedans and crossovers, offering balanced traction in wet, dry, and light winter conditions. Advanced tread design enhances braking response and reduces road noise for a quieter ride. It is built with durable rubber compounds to extend tire life and maintain consistent handling throughout the season."],
  "Vertex Tires|47673203065021": ["f51c53b012", "The Uniroyal Tiger Paw Touring A/S delivers all-season performance for everyday driving. This 195/65R15 91H tire combines responsive handling with braking in wet and dry conditions. Built with advanced tread technology, it resists hydroplaning and maintains traction across temperature changes."],
  "Vertex Tires|47684457889981": ["5ceefe5ad1", "The Pirelli P Zero AS Plus 3 delivers enhanced braking stability, reduced rolling resistance for fuel efficiency, and extended tread life. It is built with advanced compound technology for year-round versatility without seasonal tire changes."],
  "Vertex Tires|47684458217661": ["c7d9286df2", "The Pirelli P Zero AS Plus 3 delivers enhanced braking stability and reduced stopping distances through advanced tread design and compound technology. Expect improved fuel efficiency and a quieter ride compared to previous generations. Size 225/40R19 fits a wide range of performance-oriented vehicles."],
  "Vertex Tires|47684460150973": ["06d27f0ec2", "The Pirelli Scorpion AS Plus 3 delivers all-season performance for SUVs and crossovers. Advanced tread design provides grip in wet, dry, and light winter conditions while maintaining fuel efficiency. Enhanced durability and reduced rolling resistance extend tire life and lower operating costs. It is engineered for smooth, quiet rides on highways and city streets alike."],
  "Vertex Tires|47684460511421": ["0a6d5de89c", "This is an all-season performance tire engineered for sedans and crossovers. The Pirelli Scorpion AS Plus 3 delivers grip across wet, dry, and light winter conditions with advanced tread design and reinforced sidewalls. Enhanced fuel efficiency and reduced rolling resistance help lower operating costs. Load index 99 supports heavier vehicles with stability and durability."],
  "Vertex Tires|47684461396157": ["9d3b42e31f", "The Pirelli Scorpion AS Plus 3 delivers all-season performance. This XL-rated tire combines enhanced grip on wet and dry roads with improved fuel efficiency and reduced rolling resistance. The advanced tread design provides braking response and cornering stability across temperature ranges."],
  "Vertex Tires|47684461559997": ["790c0e236a", "The Pirelli Scorpion AS Plus 3 delivers all-season performance for SUVs and crossovers. Advanced tread design enhances grip on wet and dry roads while maintaining fuel efficiency. Load index 106H supports heavier vehicles."],
  "Vertex Tires|47684461658301": ["a4c7ddeb69", "This is an all-season performance tire engineered for SUVs and crossovers. The Pirelli Scorpion AS Plus 3 delivers grip across wet, dry, and light winter conditions with advanced tread design and reinforced sidewalls. Enhanced fuel efficiency and extended tread life reduce operating costs. Load index 105H is for heavier vehicles."],
  "Vertex Tires|47684463526077": ["1e7bd7ad04", "This is an all-season performance tire engineered for SUVs and crossovers. The Pirelli Scorpion AS Plus 3 delivers grip across wet, dry, and light winter conditions with advanced tread design and reinforced sidewalls. Load index 103H supports heavier vehicles while maintaining comfort on highway and city driving."],
  "Vertex Tires|47684463657149": ["964fb98a2d", "This is an all-season performance tire engineered for SUVs and crossovers. The Pirelli Scorpion AS Plus 3 delivers grip across wet, dry, and light winter conditions with advanced tread design and reinforced sidewalls. XL load rating (117H) ensures durability and stability."],
  "Vertex Tires|47684465033405": ["fbc29968d2", "This is an all-season performance tire engineered for responsive handling and grip in wet, dry, and light winter conditions. The Pirelli Cinturato P7 delivers balanced comfort with reduced road noise. Advanced tread design enhances braking performance and extends tire life."],
  "Vertex Tires|47684465295549": ["d53f3b0239", "This is an all-season performance tire engineered for luxury sedans and coupes. The Pirelli Cinturato P7 delivers responsive handling, braking, and year-round traction across wet, dry, and light winter conditions. XL load rating ensures durability for heavier vehicles."],
  "Vertex Tires|47684476108989": ["af5b813248", "The Pirelli P7 AS Plus 3 delivers all-season performance for sedans and crossovers. Advanced grip technology ensures traction in wet, dry, and light winter conditions. Optimized tread design reduces rolling resistance for improved fuel efficiency while maintaining responsive handling."],
  "Vertex Tires|47684478107837": ["ac952d2da5", "The 235/45R18 94V rating ensures grip in wet, dry, and light winter conditions while maintaining responsive handling and fuel efficiency. Built with Pirelli's advanced compound technology, this tire resists premature wear and provides consistent braking performance across temperature ranges. The optimized tread pattern reduces road noise for a quieter ride, while the reinforced sidewall construction enhances durability."],
  "Vertex Tires|47684480532669": ["4dd350d7be", "This tire features advanced grip technology for wet, dry, and light winter driving."],
  "Vertex Tires|47684488003773": ["0c8ba5e0b7", "The Sailun Terramax AT2 delivers all-season performance for trucks and SUVs. This 275/60R20 all-terrain tire combines aggressive tread design with reinforced sidewalls for enhanced durability on mixed surfaces, from highways to unpaved roads. Built with advanced rubber compounds, it resists wear while maintaining traction in wet, dry, and light winter conditions."],
  "Vertex Tires|47684494688445": ["0b4c02fd1f", "This is an all-season light truck tire engineered for on-road and light off-road performance. The Sailun Terramax AT2 delivers aggressive tread design for enhanced traction in wet, dry, and light snow conditions. Load Range E rating supports heavy-duty applications with 120/116S speed and load capacity."],
  "Vertex Tires|47684496556221": ["050bffa1b5", "The Sailun Terramax AT2 is a light truck tire engineered for on-road and off-road versatility. With a load rating of 123/120S, it delivers traction across gravel, mud, and pavement. The aggressive tread pattern resists wear while maintaining stability in wet and dry conditions. LT265/70R17 sizing fits most full-size trucks."],
  "Vertex Tires|47684498063549": ["58349e666a", "The 265/65R18 114T load rating delivers traction across highways, gravel, and light off-road conditions. Advanced tread compound resists wear while maintaining grip in wet and dry environments."],
  "Vertex Tires|47684498423997": ["97df7c63f4", "The Sailun Terramax AT2 is an all-season light truck tire engineered for highway performance. LT225/75R16 load range E delivers 115/112S load capacity with blackwall sidewall construction. Advanced tread compound provides year-round traction in wet, dry, and light snow conditions. Reinforced structure handles heavy loads and off-road use while maintaining fuel efficiency on paved surfaces."],
  "Vertex Tires|47684500652221": ["fad071763d", "The 265/70R17 115S load rating delivers grip on highways, gravel, and light off-road conditions. The sidewall is blackwall. The aggressive tread pattern resists wear and enhances grip in wet and dry environments."],
  "Vertex Tires|47684501438653": ["5a0d24aea3", "The Sailun Terramax AT2 is a light truck tire engineered for mixed terrain performance. With a load rating of 125/122R, it delivers traction on highways, gravel, and moderate off-road surfaces. The aggressive tread pattern resists wear while maintaining stability in wet and dry conditions."],
  "Vertex Tires|47684501962941": ["0551785712", "The Sailun Terramax AT2 delivers all-terrain performance for light trucks and SUVs. The aggressive tread pattern provides traction on gravel, mud, and rocky surfaces, while the load rating of 123/120S ensures carrying capacity."],
  "Vertex Tires|47684504486077": ["0eca248b94", "The Sailun Terramax AT2 delivers all-terrain performance. The 116T rating supports heavy loads while maintaining durability in varied weather conditions."],
  "Vertex Tires|47684505927869": ["77fb848a38", "This 245/70R17 all-season tire delivers grip on highways, gravel, and light off-road surfaces. The aggressive tread pattern resists wear while maintaining fuel efficiency. Load rating of 110T ensures durability."],
  "Vertex Tires|47684506419389": ["b0e3a339cf", "This LT275/65R20 all-terrain tire delivers aggressive tread design for mud, rock, and gravel while maintaining stability on highways. Load Range E (LRE) provides load capacity at 126/123R. The three-peak mountain snowflake rating ensures winter performance in severe snow conditions. Built with reinforced sidewalls to resist punctures and cuts, the Terramax AT2 balances durability with all-season versatility."],
  "Vertex Tires|47684506747069": ["6b6f2a2cd8", "LT35X12.50R20 121R load rating delivers robust load capacity with aggressive tread design for traction on gravel, mud, and rocky terrain. Three-peak mountain snowflake rated for winter conditions."],
  "Vertex Tires|47697523179709": ["b2480487ef", "This is an all-season light truck tire engineered for terrain and highway performance. The Sailun Terramax RT delivers aggressive tread design for enhanced traction on mud, snow, and rocky surfaces while maintaining stability on paved roads. Load Range F rating supports heavy-duty applications with a 125Q speed rating."],
  "Vertex Tires|47697525047485": ["68e45c5b79", "The Sailun Terramax RT delivers grip in wet, dry, and light winter conditions with a reinforced sidewall construction designed to withstand heavy loads and rough surfaces. XL load rating (116T) provides extra carrying capacity."],
  "Vertex Tires|47697526554813": ["f17cc20e91", "The Sailun Terramax RT is an all-season light truck tire engineered for heavy loads. LT275/65R20 size delivers 126/123Q load rating with blackside wall construction. Radial design provides balanced traction on highways, gravel, and mixed surfaces. Meets load index requirements for full-size trucks and commercial applications."],
  "Vertex Tires|47697535926461": ["39f2043571", "The Sailun Terramax RT is an all-season light truck tire engineered for heavy loads. LT275/60R20 size delivers 123/120Q load rating with black sidewall construction. It is designed for pickup trucks, SUVs, and commercial vehicles requiring year-round traction on highways, gravel, and mixed surfaces. Reinforced sidewalls resist punctures and cuts. Aggressive tread pattern maintains grip in wet, dry, and light snow conditions."],
  "Vertex Tires|47697544347837": ["4ff3d5d62b", "The Sailun Atrezzo 4S is for light trucks and SUVs. This LT235/65R16 tire features a reinforced sidewall construction (LRE) rated for 121/119R load capacity, ensuring durability on highways and rough terrain. The advanced tread design provides traction in wet, dry, and light winter conditions while maintaining fuel efficiency."],
  "Vertex Tires|47697546379453": ["4ef29df94e", "This 225/55R19 XL tire features a robust tread design engineered to handle wet, dry, and light winter conditions. The 103V rating ensures load capacity and speed capability for everyday driving and highway use."],
  "Vertex Tires|47697547854013": ["a75883adea", "The Sailun Atrezzo 4S tire delivers grip across wet, dry, and winter conditions. The XL load rating (107H) supports heavier vehicles with enhanced stability. Advanced tread design resists hydroplaning while maintaining fuel efficiency. Engineered for year-round performance, this 235/60R18 tire balances durability with responsive handling on highways and city roads."],
  "Vertex Tires|47697598906557": ["0edcb935ed", "With a Load Range E (LRE) rating and 120/117R load index, this tire handles heavy payloads and highway speeds. The aggressive tread pattern excels in mud, gravel, and rocky terrain while maintaining predictable on-road handling. Three-peak mountain snowflake certification ensures winter performance in severe conditions. At 275/55R20, this tire fits larger truck applications where durability and traction matter most."],
  "Vertex Tires|47697600544957": ["fd54a18370", "The LT33X12.50R20 114S load rating delivers traction across gravel, mud, and pavement. Aggressive tread pattern resists wear while maintaining stability on highways. Load index 114 supports heavy payloads."],
  "Vertex Tires|47697603035325": ["1e1b552fb5", "The Sailun Terramax AT2 is an all-season light truck tire engineered for highway performance. LT285/70R17 load range E delivers robust load capacity with 126/123S speed rating for dual and single wheel applications. Advanced tread compound balances off-road traction with on-road stability across mud, gravel, and pavement. Reinforced sidewalls resist punctures and cuts."],
  "Vertex Tires|47697608376509": ["23bc220314", "The Sailun Terramax AT2 is an all-season all-terrain tire engineered for trucks, SUVs, and light commercial vehicles. The 235/65R17 104S load rating is for highway, gravel, and mixed terrain conditions. Advanced tread compound resists wear while maintaining traction in wet, dry, and light snow environments. Reinforced sidewalls provide durability."],
  "Vertex Tires|47697609949373": ["733abaede6", "The 265/50R20 XL load rating (111T) delivers robust load capacity and speed rating for highway and off-road conditions. Blackwall sidewall (BSW) construction provides durability across varied terrain. Three-peak mountain snowflake rating ensures winter traction."],
  "Vertex Tires|47697613357245": ["c050b9e540", "The Sailun Terramax AT2 delivers all-terrain performance for light trucks and SUVs. Built with reinforced sidewalls and an aggressive tread pattern, this LT-rated tire excels on gravel, mud, and rocky terrain while maintaining highway stability."],
  "Vertex Tires|47697616076989": ["f5fe4be927", "The Sailun Terramax AT2 is an all-season light truck tire engineered for highway performance. LT315/70R17 load range E delivers 126/123S load and speed ratings for heavy-duty applications. Blackwall sidewall construction with aggressive tread pattern provides enhanced traction on gravel, mud, and pavement. Durable compound resists wear and extends tire life across seasonal conditions."],
  "Vertex Tires|47697618567357": ["d0a34c6d80", "The Sailun Terramax AT2 is an all-season light truck tire engineered for highway performance. LT235/80R17 load range E delivers 120/117R load capacity with blackside wall construction. Advanced tread compound provides year-round traction in wet, dry, and light snow conditions. Reinforced sidewalls handle rough surfaces and off-road challenges while maintaining stability on paved roads."],
  "Vertex Tires|47697622696125": ["565f63165e", "The SAILUN TERRAMAX AT2 delivers all-season performance for light trucks and SUVs. Built with a reinforced sidewall construction, this LT-rated tire handles terrain while maintaining highway stability. The aggressive tread pattern provides traction in mud, snow, and gravel. Load rating of 123/120R ensures carrying capacity for heavy-duty applications. Durable compound resists wear and extends tire life across varied driving conditions."],
  "Vertex Tires|47697625776317": ["fa21f37fa7", "The Sailun Terramax AT2 delivers all-season performance for trucks and SUVs tackling mixed terrain. This XL-rated tire combines aggressive tread design with reinforced sidewalls for enhanced load capacity and durability. The 235/75R15 size fits popular light-duty trucks and provides a balanced ride quality for both work and daily commuting."],
  "Vertex Tires|47697628070077": ["1ecc0d6cdf", "The 225/65R17 XL load rating (106T) delivers enhanced load capacity and speed stability. Advanced tread design balances on-road comfort with off-road grip, while reinforced sidewalls provide durability on rough surfaces. It is built to withstand winters and summer heat."],
  "Vertex Tires|47697779556541": ["6c6a5280d1", "LT35X12.50R18 load range delivers 123R load index with aggressive tread design for enhanced traction on gravel, mud, and rocky terrain. All-season capability ensures grip in wet, dry, and light snow conditions."],
  "Vertex Tires|47697781981373": ["9a40ae87c0", "The Sailun Terramax AT2 delivers all-season performance for trucks and SUVs. This 285/45R22 XL tire combines aggressive tread design with reinforced sidewalls for enhanced load capacity and durability on mixed terrain. The 114H rating is for highway speeds while maintaining traction in wet, dry, and light winter conditions."],
  "Vertex Tires|47697785520317": ["7965b364b7", "The Sailun Terramax AT2 is an all-season light truck tire engineered for highway performance. LT245/70R17 load range E delivers 119/116S load index with reinforced sidewalls (BSW) for durability. Advanced tread compound resists wear while maintaining traction across wet, dry, and light snow conditions."],
  "Vertex Tires|47697790501053": ["7a30490452", "With a load index of 109S, this LT31x10.50R15 delivers traction on highways, gravel, and light off-road conditions. The aggressive tread pattern provides grip in wet and dry environments, while the reinforced sidewall construction resists punctures and impacts."],
  "Vertex Tires|47697823891645": ["e69cfc5552", "With a load rating of 125R, this LT35X12.50R17 delivers robust sidewall strength and durability across gravel, mud, and rocky terrain. The aggressive tread pattern provides traction on mud, snow, and dry surfaces, while the all-season compound maintains flexibility in temperature swings. It is built to handle work environments while maintaining highway stability."],
  "Vertex Tires|47697880187069": ["e64fc102bb", "The Sailun Terramax RT is an all-season light truck tire engineered for heavy loads. LT265/70R17 size delivers 123/120Q load rating with reinforced sidewalls (BSW) for durability on highways and off-road conditions. LRE (Load Range E) construction supports payload capacity. All-season tread compound maintains traction across wet, dry, and light snow surfaces."],
  "Vertex Tires|47697884315837": ["e1b6639419", "The Sailun Terramax RT is an all-season light truck tire engineered for heavy loads. LT275/70R18 size delivers 125/122Q load rating with black sidewall construction. It is designed for pickup trucks, SUVs, and commercial vehicles requiring durability across highways, gravel, and mixed surfaces. Aggressive tread pattern provides traction in wet and dry conditions while maintaining fuel efficiency."],
  "Vertex Tires|47697888084157": ["5afbedfc23", "This is a heavy-duty light truck tire engineered for all-season performance. The Sailun Terramax RT delivers aggressive tread design for enhanced traction on gravel, mud, and rocky surfaces while maintaining stability on highways. Load rating of 124Q ensures performance under substantial weight. Radial construction provides durability and fuel efficiency. Available in LT37X12.50R17 sizing for full-size trucks and SUVs."],
  "Vertex Tires|47697891918013": ["b19f266881", "The 275/65R18 XL load rating (116T) delivers robust sidewall strength and enhanced load capacity for heavy-duty applications. Advanced tread compound balances year-round grip with extended tread life. Reinforced construction handles rough roads, gravel, and seasonal transitions. Suitable for on-road and light off-road use."],
  "Vertex Tires|47697901125821": ["f582086f2c", "This is a purpose-built light truck tire for off-road and highway work. The Sailun Terramax RT combines aggressive block patterns with reinforced construction to handle rocky terrain, mud, and pavement. Load Range E capacity supports heavy payloads and trailer towing. Three-peak mountain rated for winter performance."],
  "Vertex Tires|47697907482813": ["2ec541cb48", "The 265/60R18 XL load rating (114S) delivers enhanced load capacity and speed stability. Advanced tread compound resists wear while maintaining grip on wet, dry, and light snow conditions. Reinforced sidewalls provide durability."],
  "Vertex Tires|47697912922301": ["35033b2e45", "The Sailun Terramax RT delivers all-season performance for light trucks and SUVs. Built with a reinforced sidewall construction, this LT-rated tire handles heavy loads while maintaining traction across pavement, gravel, and light off-road terrain. The aggressive tread pattern resists wear and provides grip in wet and dry conditions."],
  "Vertex Tires|47697917870269": ["bb59bacc2b", "This is an all-season light truck tire engineered for heavy loads. The Sailun Terramax RT delivers aggressive tread design for traction on mud, snow, and rocky surfaces while maintaining highway stability."],
  "Vertex Tires|47697934680253": ["3f845fc821", "The Sailun Terramax RT delivers all-season performance for trucks and SUVs. This 265/70R18 tire combines a robust tread design with reinforced sidewalls to handle mixed terrain and conditions. The 116S load and speed rating supports heavy payloads while maintaining stability on highways and rough roads."],
  "Vertex Tires|47697936449725": ["2dfe1fd54b", "The Sailun Terramax RT is for wet, dry, and light winter conditions with a reinforced sidewall construction and aggressive tread pattern. XL load rating (114Q) supports heavy payloads and towing applications."],
  "Vertex Tires|47697939333309": ["fddcc49efd", "The Sailun Terramax RT is an all-season light truck tire engineered for year-round performance. LT37X12.50R18 load range E delivers 128Q speed rating with robust sidewall construction for off-road capability and highway stability. The sidewall is black (BSW)."],
  "Vertex Tires|47697975967933": ["f3c96c2754", "This is a performance tire engineered for year-round traction and durability. The Sailun Atrezzo 4S is for wet, dry, and light winter conditions with advanced tread compound and reinforced sidewalls. XL load rating supports heavier vehicles with enhanced stability."],
  "Vertex Tires|47697982718141": ["40d9517b6a", "The Sailun Atrezzo 4S delivers grip in wet, dry, and light winter conditions with advanced tread design and reinforced sidewalls. XL load rating (96V) supports heavier vehicles with enhanced stability."],
  "Vertex Tires|47697987338429": ["df5532c0dd", "This is a performance tire engineered for year-round traction and durability. The Sailun Atrezzo 4S is for wet, dry, and light winter conditions with advanced tread design and reinforced sidewalls. XL load rating (101V) supports heavier vehicles with enhanced stability. The sidewall is blackwall (BSW)."],
  "Vertex Tires|47698000609469": ["8d3c327a35", "The Sailun Atrezzo SH408 delivers all-season performance in a 235/45R18 size, rated for 94V speeds. This Black Sidewall (BSW) tire balances wet and dry traction with fuel efficiency. The reinforced tread pattern resists wear while maintaining responsive handling across seasons."],
  "Vertex Tires|47698002182333": ["dbbfccf8a3", "The Sailun Atrezzo SH408 is engineered for balanced performance across varying weather conditions. With a 215/60R16 size and 95V speed rating, it delivers responsive handling and stable braking on both wet and dry roads. Built with durable compound technology, this tire provides extended tread life and consistent grip throughout its service life."],
  "Vertex Tires|47698006704317": ["07d5f2fabe", "The Sailun Atrezzo SH408 delivers all-season performance for everyday driving. This 225/65R17 tire combines fuel efficiency with balanced handling across wet, dry, and light winter conditions. The reinforced sidewall construction enhances durability, while the optimized tread pattern reduces rolling resistance for better fuel economy. Load index 102H supports mid-size sedans and crossovers."],
  "Vertex Tires|47698014699709": ["4ad844163c", "This is an all-season performance tire engineered for modern sedans and crossovers. The Sailun Atrezzo TCON delivers balanced grip, responsive handling, and traction across wet, dry, and light winter conditions. Advanced tread design minimizes road noise while optimizing fuel efficiency."],
  "Vertex Tires|47698017550525": ["16df5dbd59", "The Sailun Atrezzo TCON delivers all-season performance for everyday driving. This 225/60R18 tire combines responsive handling with consistent traction across wet, dry, and light winter conditions. Built with advanced tread design and durable rubber compounds, it offers extended tread life and fuel efficiency. Load index 100H ensures stability under standard passenger vehicle loads."],
  "Vertex Tires|47698032230589": ["8ee0c73ac7", "The Sailun Inspire delivers all-season performance for everyday driving. This 225/60R17 tire (99T rating) balances traction, durability, and fuel efficiency across wet, dry, and light winter conditions. Built with a reinforced tread design, it resists wear and maintains grip through varied weather."],
  "Vertex Tires|47698038620349": ["b902769fba", "The Sailun Inspire delivers all-season performance. Engineered with advanced tread design, this tire provides grip in wet and dry conditions while maintaining fuel efficiency. The 225/50R17 94V load rating suits mid-size sedans and crossovers."],
  "Vertex Tires|47698043240637": ["7728872590", "The Sailun Inspire is an all-season tire engineered for balanced performance across wet, dry, and light winter conditions. The 195/50R16 84V load rating is for sedans and compact vehicles. Advanced tread compound resists wear while maintaining grip in variable weather. Load index 84 supports vehicles up to 500 kg per tire."],
  "Vertex Tires|47698046091453": ["c5a02e228b", "The Sailun Inspire delivers all-season performance for everyday driving. This 205/55R16 91V tire balances traction, durability, and fuel efficiency across wet, dry, and light winter conditions. Built with advanced tread design and reinforced sidewalls, it offers extended tread life."],
  "Vertex Tires|47698051006653": ["f5ef1714a4", "The Sailun Inspire delivers all-season performance for everyday driving. Engineered with a balanced tread design, this tire provides grip in wet, dry, and light winter conditions. The 225/65R17 102T sizing suits mid-size sedans and crossovers, offering a smooth ride and predictable handling. Load index 102 supports vehicles up to 850 kg per tire."],
  "Vertex Tires|47698070470845": ["c2fed230c4", "With a 275/60R20 sizing and 115T load and speed rating, this tire is for highways, gravel, and light off-road surfaces. The Open Country A/T III features an aggressive tread pattern designed to enhance grip on loose terrain while maintaining stability on paved roads. Built with Toyo's advanced rubber compound, this tire resists wear and provides consistent traction in wet, dry, and moderate winter conditions."],
  "Vertex Tires|47698089574589": ["a94c2e1c94", "The Toyo Open Country A/T III delivers all-terrain performance for trucks and SUVs tackling both highway and off-road conditions. Built with a reinforced sidewall and aggressive tread pattern, this tire excels in mud, gravel, and rocky terrain while maintaining stability on paved roads. Load rating of 117T ensures performance under heavy loads. The compound provides consistent grip across varying temperatures. It is designed for durability and traction."],
  "Vertex Tires|47698093670589": ["9b135ffea8", "The Toyo Open Country A/T III is for trucks and SUVs tackling both highway and off-road terrain. This 265/65R17 XL tire features a reinforced sidewall construction and aggressive tread pattern designed to handle gravel, mud, and rocky surfaces while maintaining stability on paved roads. Built with Toyo's advanced rubber compound, the A/T III resists wear and provides consistent grip across temperature ranges."],
  "Vertex Tires|47698095866045": ["d657beae65", "This tire delivers balanced traction in wet, dry, and light snow conditions while maintaining highway stability and fuel efficiency. The aggressive tread pattern resists stone drilling and enhances grip on unpaved surfaces, while the reinforced sidewalls provide durability. The 110T load index supports heavy vehicles."],
  "Vertex Tires|47698100519101": ["8ecf9fa66f", "The Toyo Open Country A/T III is for trucks and SUVs tackling both highway and off-road terrain. This XL-rated tire (117T) features an aggressive tread pattern designed for enhanced traction on gravel, mud, and snow while maintaining stability on paved roads. Built with Toyo's advanced rubber compound, the A/T III resists wear and extends tire life across varied driving conditions. The reinforced sidewalls provide durability, while the optimized tread design reduces road noise for a quieter ride. The 275/55R20 fitment suits full-size trucks and SUVs requiring all-terrain capability."],
  "Vertex Tires|47698103140541": ["10152604ed", "The reinforced sidewall construction resists punctures and cuts, while the optimized tread pattern reduces road noise for a quieter ride. Load rating 107T handles substantial weight."],
  "Vertex Tires|47698106220733": ["364c5c549c", "The 225/60R18 XL load rating (104T) delivers enhanced load capacity and durability across varied terrain. Open Country's aggressive tread pattern provides grip in wet, dry, and light snow conditions while maintaining fuel efficiency."],
  "Vertex Tires|47698115330237": ["7985fb8784", "The Toyo Open Country A/T III is for trucks and SUVs tackling both highway and off-road terrain. This 245/70R17 110T tire features a reinforced sidewall construction and aggressive tread pattern designed to handle gravel, mud, and rocky surfaces while maintaining stability on paved roads. Built with Toyo's advanced rubber compound, the A/T III resists wear and provides consistent grip across temperature ranges."],
  "Vertex Tires|47698120638653": ["ade221b297", "The Toyo Open Country A/T III delivers all-terrain performance for trucks and SUVs tackling mixed surfaces. This LT-rated tire combines aggressive tread design with reinforced sidewalls for enhanced load capacity and durability."],
  "Vertex Tires|47698121785533": ["c913cd4931", "The Toyo Open Country A/T III delivers all-terrain performance for trucks and SUVs tackling mixed road and off-road conditions. This 275/65R18 load index 116T tire features a reinforced sidewall construction and aggressive tread pattern designed to grip loose surfaces while maintaining highway stability. The compound performs across temperature ranges. Load rating 116T supports heavy payloads typical of full-size trucks."],
  "Vertex Tires|47698127290557": ["a4e27c04f2", "The Toyo Open Country A/T III is for trucks and SUVs tackling both highway and off-road terrain. This XL-rated tire (245/60R18, 109T) features an aggressive tread pattern designed for enhanced traction on gravel, dirt, and snow while maintaining stability on paved roads. Built with Toyo's advanced rubber compound, the Open Country A/T III resists wear and extends tire life across varied driving conditions. The reinforced sidewalls provide durability, while the optimized tread design reduces road noise for a quieter ride. Load index 109T supports heavy loads typical of full-size trucks and work vehicles."],
  "Vertex Tires|47698129879229": ["78038a5704", "The LT295/60R20 LRE load range delivers robust load capacity at 126/123S speed rating. Advanced tread design balances on-road comfort with off-road traction, while reinforced sidewalls provide durability against punctures and impacts. The compound maintains grip in wet and dry conditions, reducing the need for seasonal swaps."],
  "Vertex Tires|47698131550397": ["cf8470a747", "The TOYO OPEN COUNTRY A/T III delivers aggressive tread design for grip on mud, rock, and gravel while maintaining highway stability. LT35X12.50R20 sizing provides ground clearance and load capacity. Load Range E (LRE) rated for heavy-duty applications."],
  "Vertex Tires|47698133156029": ["2cc1cc3126", "The TOYO OPEN COUNTRY A/T III delivers aggressive tread design for enhanced grip on rocky, muddy, and uneven terrain while maintaining highway stability. LT33x12.50R20 sizing provides ground clearance and load capacity. Load Range F (LRF) rating supports heavy payloads and towing. 119Q speed rating balances performance with durability."],
  "Vertex Tires|47698134925501": ["05589f406a", "The Toyo Open Country A/T III is for trucks and SUVs tackling both highway and off-road terrain. The aggressive tread pattern provides enhanced grip on gravel, mud, and snow while maintaining stability on pavement. Size 265/75R16 with 116T rating supports heavy-duty applications and sustained highway speeds."],
  "Vertex Tires|47698155307197": ["b2301b064d", "This is an all-season performance tire engineered for balanced handling, comfort, and durability across changing weather conditions. The Toyo Extensa A/S II delivers responsive steering and traction on wet and dry roads. It is built with advanced compound technology for extended tread life and fuel efficiency. Load index 94 supports mid-size sedans and crossovers. Speed rating H ensures safe performance up to 210 km/h."],
  "Vertex Tires|47698156912829": ["78fd35cd7b", "The Toyo Extensa A/S II delivers all-season performance for everyday driving. Engineered with a balanced tread design, this tire provides grip in wet, dry, and light winter conditions. The 195/65R15 91H sizing suits compact sedans and crossovers, offering a smooth ride with predictable handling."],
  "Vertex Tires|47698159894717": ["3fe6afa39b", "The Toyo Celsius II BL is for diverse weather conditions. Engineered with advanced grip technology, this tire excels on wet, dry, and light snow surfaces while maintaining responsive handling and stability. The optimized tread pattern reduces rolling resistance for improved fuel efficiency, and reinforced sidewalls enhance durability. Size: 225/60R17, Load Index: 99V."],
  "Vertex Tires|47698161041597": ["99ca923fe3", "The Toyo Celsius Cargo BL LT235/65R16 LRE 121/119R is a light truck tire engineered for year-round performance. It is for commercial and fleet use, with blackwall construction and enhanced durability."],
  "Vertex Tires|47698162745533": ["758d93e5f9", "This is a heavy-duty light truck tire engineered for year-round performance. The TOYO M-55 delivers traction on highways, gravel, and mixed surfaces with its aggressive tread pattern and reinforced sidewalls. LRE load rating provides carrying capacity for commercial and recreational applications. All-season compound maintains grip in cold, wet, and dry conditions."],
  "Vertex Tires|47739016478909": ["438192c811", "This tire is engineered to reduce road noise and vibration, ensuring a smoother and quieter driving experience. Specialized rubber compound adapts to changing temperatures, maintaining consistent grip throughout the year. Asymmetric tread design improves road contact for enhanced traction and cornering in both dry and wet conditions. Continuous tread ribs and optimized groove layout provide better steering control and driving stability. Wide circumferential grooves efficiently disperse water, helping to resist hydroplaning and maintain traction on wet roads."],
  "Vertex Tires|47739021983933": ["3fc73c5cc5", "The Haida EX-Comfort is designed to provide a smooth, quiet driving experience all year round. With its advanced all-season compound and asymmetric tread pattern, it delivers traction, enhanced comfort, and handling for everyday driving. A specialized rubber compound maintains flexibility across a wide range of temperatures, ensuring consistent grip in various weather conditions. Wide circumferential grooves effectively channel water away, helping to reduce the risk of hydroplaning on wet roads. The comfort-oriented design is engineered to minimize road noise and vibrations, providing a quieter and more comfortable ride. Asymmetric tread pattern enhances road contact for better traction and improved cornering performance in both dry and wet conditions. Continuous tread ribs and an optimized groove layout improve steering precision and overall driving control."],
  "Vertex Tires|47739070906557": ["3b397e2a97", "The Haida HI-SPIRIT All Season tire is for changing weather conditions. The 215/70R16 100H size fits a wide range of sedans and crossovers, providing a smooth ride and extended tread life."],
  "Vertex Tires|47739110916285": ["449862f8d6", "The HAIDA HI-SPIRIT delivers all-season performance for everyday driving. Engineered to handle wet, dry, and light winter conditions, these tires offer balanced traction and responsive handling year-round."],
  "Vertex Tires|47739123957949": ["4e9fe80cf9", "The HAIDA HD317 is a versatile all-season tire engineered for balanced performance across varying weather conditions. With a 235/45ZR18 size and 98Y rating, it delivers traction on wet and dry roads while maintaining fuel efficiency. The advanced tread design provides responsive handling and consistent grip."],
  "Vertex Tires|47739127529661": ["8387daa9af", "With its 235/45ZR18 98W specification, this tire delivers traction on both wet and dry surfaces while maintaining fuel efficiency. The advanced tread pattern ensures responsive handling, reduced road noise, and extended tread life."],
  "Vertex Tires|47739222196413": ["25012e9891", "The HAIDA HD317 XL delivers all-season performance. This 235/50R19 99V tire combines responsive handling with enhanced traction across wet, dry, and light winter conditions. The reinforced sidewalls and optimized tread pattern reduce rolling resistance while improving fuel efficiency."],
  "Vertex Tires|47739222720701": ["ca5a5a97b5", "Designed in the 235/60R16 size with a 99V rating, this tire delivers traction across wet, dry, and light winter conditions. Built with advanced tread compound technology, the HD837 provides responsive handling and consistent grip for daily driving. The reinforced sidewalls offer enhanced durability, while the optimized tread pattern reduces road noise for a quieter ride."],
  "Vertex Tires|47739238482109": ["8d1ce901fe", "The Haida HD317 delivers all-season performance. It is built with a balanced tread design that handles dry, wet, and light winter conditions. Symmetrical tread pattern provides consistent grip and predictable handling across changing road conditions throughout the year. Advanced siping and circumferential grooves efficiently channel water away from the tire surface, reducing hydroplaning risk on wet pavement. Optimized rubber compound and reinforced construction absorb road vibrations for a smooth, whisper-quiet driving experience. Stable shoulder blocks and precise tread geometry enhance cornering control and steering response in everyday driving situations."],
  "Vertex Tires|47739241005245": ["99e0355647", "The HAIDA HI-SPIRIT delivers all-season performance. Engineered to handle wet, dry, and light winter conditions, these tires offer balanced traction and responsive handling year-round. The 235/60ZR18 107V sizing fits a wide range of sedans and crossovers, providing a smooth, comfortable ride with fuel efficiency. Built with durable compound technology, the HI-SPIRIT resists wear and extends tire life."],
  "Vertex Tires|47739244118205": ["325131371d", "The HAIDA EX-COMFORT delivers all-season performance for everyday driving. Engineered to handle wet, dry, and light winter conditions, these tires offer balanced traction and responsive handling year-round. The advanced tread design promotes even wear and extended tread life, while optimized sidewall construction enhances ride comfort on various road surfaces."],
  "Vertex Tires|47739255390397": ["a96054a1e1", "The HAIDA HI-SPIRIT delivers all-season performance for everyday driving. This 245/60R18 tire offers balanced traction in wet, dry, and light winter conditions. With a 105H load and speed rating, it handles moderate loads while maintaining stability at highway speeds."],
  "Vertex Tires|47739260993725": ["f1c0af790a", "The HAIDA HI-SPIRIT 235/70R16 delivers all-season performance for everyday driving. This tire offers balanced traction in wet, dry, and light winter conditions. With a 106H load and speed rating, it handles moderate to heavy loads while maintaining stability at highway speeds."],
  "Vertex Tires|47739271577789": ["b44c565bfc", "The HAIDA HI-SPIRIT delivers all-season performance. Engineered for year-round traction in wet, dry, and light winter conditions, these tires offer balanced handling and fuel efficiency. The 215/60R17 100H sizing fits a wide range of sedans and crossovers."],
  "Vertex Tires|47739276558525": ["c2861e1770", "The HAIDA HI-SPIRIT delivers all-season performance. Engineered for balanced traction in wet, dry, and light winter conditions, these tires offer responsive handling and a comfortable ride. The 225/60R17 99V sizing fits a wide range of sedans and crossovers."],
  "Vertex Tires|47739322466493": ["180e012982", "The HAIDA HI-SPIRIT All Season tire is engineered for balanced handling, traction, and fuel efficiency on wet, dry, and light winter roads. The durable tread design resists wear while maintaining responsive steering control."],
  "Vertex Tires|47739325776061": ["4497d29f9c", "The HAIDA HI-SPIRIT delivers all-season performance. Engineered to handle wet, dry, and light winter conditions, these tires offer balanced traction and responsive handling year-round. The 225/55R18 98V sizing fits a wide range of sedans and crossovers, providing a smooth, quiet ride with fuel efficiency. Built with durable compound technology, the HI-SPIRIT resists wear and extends tire life."],
  "Vertex Tires|47739331870909": ["56ab622e3c", "The HAIDA HD937 delivers all-season performance for everyday driving. This 235/50R19 tire offers balanced traction in wet and dry conditions, with a 103V speed rating suitable for most passenger vehicles."],
  "Vertex Tires|47739335409853": ["0051824ab2", "The HAIDA HI-SPIRIT All Season tire is engineered for balanced handling, traction, and durability on wet, dry, and light winter roads."],
  "Vertex Tires|47739336949949": ["95dbec950d", "The HAIDA HD317 delivers all-season performance. This 245/45R20 tire features a versatile tread design engineered to handle wet, dry, and light winter conditions. Built with quality construction, it offers consistent handling and a comfortable ride for everyday driving. The 103V rating ensures load capacity and speed capability for standard passenger vehicles."],
  "Vertex Tires|47739341537469": ["599bb0cf7e", "With a 255/55R20 size and 110V speed rating, this tire delivers balanced handling, responsive braking, and traction on wet and dry roads. Designed with advanced tread patterns and durable rubber compounds, the HD937 XL provides extended tread life and reduced rolling resistance for improved fuel efficiency. The XL load index ensures robust load-carrying capacity."],
  "Vertex Tires|47739345895613": ["926a94928c", "The HAIDA HD828 is a light truck tire engineered for versatility across diverse road conditions. With a 10-ply rating and load index of 120/117S, it delivers robust load-carrying capacity and durability. The LT265/60R18 sizing provides ground clearance and sidewall strength. The all-terrain tread pattern balances on-road comfort with off-road traction, while the reinforced construction resists punctures and impacts from rough surfaces."],
  "Vertex Tires|47831374987453": ["ce3c0d32c7", "The BF Goodrich All-Terrain T/A KO3 delivers aggressive tread design for off-road traction while maintaining on-road stability. Load Range E rating handles heavy payloads. Reinforced sidewalls resist punctures on rocky terrain."],
  "Vertex Tires|47832346820797": ["01892fc1ce", "The BF Goodrich All-Terrain T/A KO3 in LT275/60R20 is for trucks and SUVs tackling mixed terrain. Three-ply sidewalls and aggressive tread design provide durability and traction on gravel, mud, and rock while maintaining highway stability. Load Range D (LRD) rating handles heavy payloads."],
  "Vertex Tires|47832479826109": ["2bbdec0b91", "This LT275/70R18 load range E tire features aggressive tread geometry and reinforced sidewalls designed to handle rocky terrain, mud, and gravel while maintaining predictable highway performance. The KO3's three-peak mountain snowflake rating confirms winter traction. Radial wall construction and optimized rubber compounds resist punctures and extend tread life across mixed driving. Load capacity of 125/122S (dual/single) supports heavy payloads and towing."],
  "Vertex Tires|47832788893885": ["8a6075a3ce", "The BF Goodrich All-Terrain T/A KO3 is for trucks and SUVs tackling mixed terrain. The LT275/65R18 load range E rating handles heavy payloads, while reinforced sidewalls resist punctures on rocky trails. Three-peak mountain rated for winter capability. Aggressive tread pattern excels on gravel, mud, and snow."],
  "Vertex Tires|47832871108797": ["855d36c04f", "This LT265/70R17 load range E tire delivers aggressive tread design for rocky terrain, mud, and sand while maintaining predictable highway handling. It is built with CoreGard technology to resist sidewall damage. The compound balances winter traction with summer durability. Load index 123/120S supports heavy truck payloads."],
  "Vertex Tires|47834015367357": ["a9db15cba8", "The Kumho HA32 delivers balanced grip on wet and dry roads with enhanced winter traction. XL load rating provides extra durability for heavier vehicles."],
  "Vertex Tires|47834032439485": ["355df41278", "The Kumho HA32 delivers balanced handling, responsive braking, and traction across wet, dry, and light winter conditions. XL load rating ensures durability for heavier vehicles."],
  "Vertex Tires|47834082607293": ["d3ba709534", "The Kumho Solus 4S HA32 is for SUVs and crossovers. The XL load rating (103V) handles heavier vehicles with stability and control in wet, dry, and light winter conditions. Advanced tread design resists hydroplaning while maintaining responsive handling."],
  "Vertex Tires|48943095972029": ["180e012982", "The HAIDA HI-SPIRIT All Season tire is engineered for balanced handling, traction, and fuel efficiency on wet, dry, and light winter roads. The durable tread design resists wear while maintaining responsive steering control."],
};

/**
 * M11 (owner 2026-10-05, "Blank + check vendor"): a tire's load index must be
 * a real one. Blanked, with the reason, when:
 *   a) it is above 150: the vendor wrote the model code (615K, 421Q, 420S) in
 *      its place, so the speed rating, the code's last letter, goes with it;
 *   b) the vendor's own name states another load index (the name's speed
 *      letter too, when that differs);
 *   c) it is more than 15 away from the median load index of every tire of
 *      the same size (at least 5 tires with one). A load index confirmed on a
 *      vendor or maker page is listed in LOAD_INDEX_CONFIRMED and kept, or set.
 * The speed rating is blanked with the load index in every case (owner/coordinator
 * 2026-10-05): a card prints them together, so a lone speed letter would read as an error.
 */
const LOAD_INDEX_CONFIRMED: Record<string, { loadIndex: string; speedRating?: string; source: string }> = {
  // The vendor's own pages are not readable (Auto Country is login-only; prowheels.ca and directautoimport.com render in the browser), so the maker's pages are the source. Read 2026-10-05, one page at a time.
  "PW-T-F28533077": { loadIndex: "89", speedRating: "W", source: "falkentire.com/azenis/rt615k (Azenis RT615K+ 205/50R15, XL 89W; Falken part 28533077)" },
  "PW-T-F28537681": { loadIndex: "95", speedRating: "W", source: "falkentire.com/azenis/rt615k (Azenis RT615K+ 235/40R18, XL 95W; Falken part 28537681)" },
  "PW-T-F28538247": { loadIndex: "97", speedRating: "W", source: "falkentire.com/azenis/rt615k (Azenis RT615K+ 265/35R18, XL 97W; Falken part 28538247)" },
  "PW-T-N210-700": { loadIndex: "107", speedRating: "W", source: "nittotires.ca/tires/nt421q-premium-crossover-tire (235/60R18XL 107W, part 210700)" },
  "PW-T-N210-810": { loadIndex: "111", speedRating: "V", source: "nittotires.ca/tires/nt421q-premium-crossover-tire (255/55R19XL 111V, part 210810)" },
  "PW-T-N210-740": { loadIndex: "115", speedRating: "H", source: "nittotires.ca/tires/nt421q-premium-crossover-tire (255/65R18XL 115H, part 210740)" },
  "PW-T-N210-910": { loadIndex: "117", speedRating: "V", source: "nittotires.ca/tires/nt421q-premium-crossover-tire (275/55R20XL 117V, part 210910)" },
  "PW-T-N202-480": { loadIndex: "111", speedRating: "V", source: "nittotire.com/media/ax4fkluy/nitto-map-schedule-july-2024.pdf (NT420S 275/55R19 111V, stock 202480)" },
  // False positive of the size-median check (only 5 tires of this size, mixing standard and light-truck loads): the part is a real 102T.
  "PW-T-D356070": { loadIndex: "102", speedRating: "T", source: "Toyo part 356070, Open Country A/T III P225/75R15 102T (carid.com TOYO TIRES 356070; tires-easy.com tirecode 356070)" },
};
const LOAD_OUTLIER = 15;
const LOAD_MEDIAN_MIN_TIRES = 5;
const m11Stats = { code: 0, nameConflict: 0, outlier: 0, confirmedKept: 0, confirmedSet: 0 };
const m11Rows: { rowId: string; why: string; before: string; kind: string }[] = [];
/** Listings whose load index M11 blanked; a merged product left with a lone speed letter from another vendor loses it too. */
const m11Blanked = new Set<string>();
const m11SpeedLogged = new Set<string>();

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}
const firstLoad = (value: string): number | null => {
  const n = /^(\d{1,3})/.exec(value)?.[1];
  return n === undefined ? null : Number(n);
};

function checkLoadIndexes(tires: Listing[]): void {
  const bySize = new Map<string, number[]>();
  for (const listing of tires) {
    const load = firstLoad(listing.fields[F.loadIndex] ?? "");
    const size = listing.fields[F.tireSize] ?? "";
    if (load !== null && load <= 150 && size !== "") bySize.set(size, [...(bySize.get(size) ?? []), load]);
  }
  for (const listing of tires) {
    const f = listing.fields;
    const value = f[F.loadIndex] ?? "";
    const load = firstLoad(value);
    if (load === null) continue;
    const name = (f[F.name] ?? "").replace(f[F.tireSize] ?? "\u0000", " ");
    const named = [...name.matchAll(/(?<![\w/.+])(\d{2,3}(?:\/\d{2,3})?)([A-Z])(?![\w/.+])/g)].filter(
      (m) => SPEED_SYMBOLS.has(m[2] ?? "") && (firstLoad(m[1] ?? "") ?? 0) >= 60 && (firstLoad(m[1] ?? "") ?? 0) <= 150,
    );
    const sizeLoads = bySize.get(f[F.tireSize] ?? "") ?? [];
    let kind = "";
    let why = "";
    if (load > 150) {
      kind = "code";
      why = `load index ${value} cannot be real (the highest is 150); it is the model code in the vendor's name "${f[F.name]}", and its last letter ${f[F.speedRating] ?? ""} is not a speed rating either`;
    } else if (named.length === 1 && named[0] && named[0][1] !== value) {
      kind = "nameConflict";
      const nameSpeed = named[0][2];
      why = `the vendor's name "${f[F.name]}" states ${named[0][1]}${nameSpeed}; the columns say ${value}${f[F.speedRating] ?? ""}`;
    } else if (sizeLoads.length >= LOAD_MEDIAN_MIN_TIRES && Math.abs(load - median(sizeLoads)) > LOAD_OUTLIER) {
      kind = "outlier";
      why = `load index ${value} is ${Math.abs(load - median(sizeLoads))} away from the median ${median(sizeLoads)} of the ${sizeLoads.length} tires of size ${f[F.tireSize]} (limit ${LOAD_OUTLIER})`;
    }
    if (kind === "") continue;
    const confirmed = LOAD_INDEX_CONFIRMED[listing.primary.rowId];
    if (confirmed) {
      const same = confirmed.loadIndex === value && (confirmed.speedRating === undefined || confirmed.speedRating === (f[F.speedRating] ?? ""));
      if (same) {
        m11Stats.confirmedKept += 1;
        logChange("M11 confirmed", idsOf(listing), F.loadIndex, value, value, `${why}; but ${confirmed.source} confirms it, so it is kept`);
      } else {
        m11Stats.confirmedSet += 1;
        editField("M11 confirmed", listing, F.loadIndex, confirmed.loadIndex, `${why}; corrected from ${confirmed.source}`);
        if (confirmed.speedRating !== undefined) editField("M11 confirmed", listing, F.speedRating, confirmed.speedRating, `corrected from ${confirmed.source}`);
      }
      continue;
    }
    m11Stats[kind as "code" | "nameConflict" | "outlier"] += 1;
    m11Rows.push({ rowId: listing.primary.rowId, why, before: `${value}${f[F.speedRating] ?? ""}`, kind });
    m11Blanked.add(listing.primary.rowId);
    editField("M11", listing, F.loadIndex, "", `${why}; blanked (owner 2026-10-05: blank, then check the vendor or maker page)`);
    editField("M11", listing, F.speedRating, "", `${why}; the speed rating is blanked with it (a card would read the size plus a lone speed letter)`);
  }
}

/**
 * M12 (owner 2026-10-05, "Fix both"): a lug whose vendor Model is BOLT is a
 * lug bolt, never a lug nut. Retyped, and "Lug Nuts" in the name becomes
 * "Lug Bolts". Vendor titles that merely mention a bolt are NOT retyped; they
 * are listed in changes-review.csv as "M12 not retyped".
 */
const lugBoltLookAlikes: { rowIds: string[]; title: string; vendorTitle: string }[] = [];
let lugBoltsRetyped = 0;
function retypeLugBolts(listing: Listing): void {
  const f = listing.fields;
  if ((f[F.accessoryType] ?? "") !== "Lug Nuts") return;
  const model = listing.extra.find(([label]) => label === "Model")?.[1] ?? "";
  if (/^bolts?$/i.test(model.trim())) {
    lugBoltsRetyped += 1;
    editField("M12", listing, F.accessoryType, "Lug Bolts", `the vendor's Model is "${model}", so this is a lug bolt (vendor title: "${listing.primary.cells.vendor_title ?? ""}")`);
    const name = f[F.name] ?? "";
    const renamed = name.replace(/\bLug Nuts\b/i, "Lug Bolts");
    if (renamed !== name) editField("M12", listing, F.name, renamed, "the name said Lug Nuts for a lug bolt");
  } else if (/(?<![\w])bolts?(?![\w])/i.test(listing.primary.cells.vendor_title ?? "")) {
    lugBoltLookAlikes.push({ rowIds: idsOf(listing), title: f[F.name] ?? "", vendorTitle: listing.primary.cells.vendor_title ?? "" });
  }
}

/* --- Matching: M1, M2, M3 ------------------------------------------------------- */

/**
 * A listing's identity for M3: every field the shopper can see. Only the SKU,
 * URL, vendor price, images and row id may differ. A Part number or
 * Manufacturer code spec (the vendor's, or the SKU moved there by M5) is
 * visible to the shopper, so two listings that differ in it are different
 * parts and are NOT identical (coordinator correction, owner 2026-10-03, data
 * QA). Run after M5. M2 (one SKU across vendors) is the same part and is
 * unaffected. A TIRE's Part number is left out since D142: tires carry none
 * on the site, so two tires that differ only in it look identical.
 */
function identity(listing: Listing): string {
  const fields = Object.entries(listing.fields).sort(([a], [b]) => (a < b ? -1 : 1));
  const extra = listing.extra
    .filter(([label]) => listing.category !== "tires" || label !== "Part number")
    .map(([label, value]) => `${label}\u0001${value}`)
    .sort();
  return JSON.stringify([listing.primary.source, fields, extra]);
}

/** Identical same-vendor listings, merged into one unit with several sources. */
interface Unit {
  listings: Listing[];
  vendor: string;
}

function makeUnits(listings: Listing[]): Unit[] {
  const bySig = new Map<string, Unit>();
  const units: Unit[] = [];
  for (const listing of listings) {
    const sig = identity(listing);
    const unit = bySig.get(sig);
    if (unit) unit.listings.push(listing);
    else {
      const fresh: Unit = { listings: [listing], vendor: listing.primary.source };
      bySig.set(sig, fresh);
      units.push(fresh);
    }
  }
  return units;
}

/** Key of a unit for M1: a required bucket, and optional fields where null is "blank". */
interface UnitKey {
  bucket: string | null;
  opt: (string | null)[];
}
const norm = (value: string | undefined) => (value === undefined || value === "" ? null : keyPart(value));
const normLoad = (value: string | undefined) => (value === undefined || value === "" ? null : value.toLowerCase().replace(/\s+/g, ""));

function unitKey(unit: Unit): UnitKey {
  const listing = unit.listings[0]!;
  const f = listing.fields;
  if (listing.category === "tires") {
    const required = [f[F.brand], f[F.model], f[F.tireSize]];
    return {
      bucket: required.some((v) => !v) ? null : required.map((v) => keyPart(v ?? "")).join("\u0000"),
      opt: [normLoad(f[F.loadIndex]), norm(f[F.speedRating])],
    };
  }
  const required = [f[F.brand], f[F.model], f[F.wheelDiameter], f[F.wheelWidth]];
  const patterns = (f[F.boltPatterns] ?? "")
    .split("/")
    .filter((p) => p !== "")
    .map(keyPart)
    .sort()
    .join(",");
  return {
    // `side` blank is a statement ("not handed"), so it is part of the bucket.
    bucket: required.some((v) => !v)
      ? null
      : [...required.map((v) => keyPart(v ?? "")), keyPart(listing.primary.cells.side ?? "")].join("\u0000"),
    opt: [patterns === "" ? null : patterns, norm(f[F.offsetMm]), norm(f[F.wheelFinish]), norm(f[F.centerBoreMm])],
  };
}

const compatible = (a: (string | null)[], b: (string | null)[]) =>
  a.every((value, i) => value === null || b[i] === null || value === b[i]);

class UnionFind {
  private parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }
  find(i: number): number {
    let root = i;
    while (this.parent[root] !== root) root = this.parent[root]!;
    let node = i;
    while (this.parent[node] !== root) {
      const next = this.parent[node]!;
      this.parent[node] = root;
      node = next;
    }
    return root;
  }
  union(a: number, b: number): void {
    this.parent[this.find(a)] = this.find(b);
  }
}

/** What the matching could not do, for the summary and merge-report. */
const matchNotes = {
  blankAmbiguous: [] as { rowIds: string[]; candidates: string[] }[],
  inconsistent: 0,
  /** Components where one vendor has two different listings. */
  vendorConflicts: [] as Listing[][],
  /** Leftover units paired by a shared vendor SKU. */
  skuPaired: 0,
  brandConflict: [] as { skus: string; brands: string }[],
  sameVendorDifferent: 0,
};

/** A cluster of listings meant to become one product. */
interface Cluster {
  listings: Listing[];
  /** Merged over a blank key field (M1). */
  viaBlank: boolean;
}

/**
 * M3 over clusters: clusters whose listings are identical vendor by vendor
 * merge (identical same-vendor listings become sources of one product), and a
 * cluster made only of one vendor's identical listings joins the one other
 * cluster that already holds an identical listing from that vendor. When two
 * such clusters could take it, it stays apart.
 */
function regroupIdentical(clusters: Cluster[]): Cluster[] {
  const sigOf = (c: Cluster) =>
    c.listings.map((l) => `${l.primary.source}\u0002${identity(l)}`).sort().join("\u0003");
  const bySig = new Map<string, Cluster>();
  const merged: Cluster[] = [];
  for (const cluster of clusters) {
    const sig = sigOf(cluster);
    const into = bySig.get(sig);
    if (into) {
      into.listings.push(...cluster.listings);
      into.viaBlank = into.viaBlank || cluster.viaBlank;
    } else {
      const fresh: Cluster = { listings: [...cluster.listings], viaBlank: cluster.viaBlank };
      bySig.set(sig, fresh);
      merged.push(fresh);
    }
  }
  const vendorsOf = (c: Cluster) => new Set(c.listings.map((l) => l.primary.source));
  const multi = merged.filter((c) => vendorsOf(c).size > 1);
  const out: Cluster[] = [];
  for (const cluster of merged) {
    if (vendorsOf(cluster).size > 1) {
      out.push(cluster);
      continue;
    }
    const vendor = cluster.listings[0]!.primary.source;
    const sig = identity(cluster.listings[0]!);
    const homes = multi.filter((m) => m.listings.some((l) => l.primary.source === vendor && identity(l) === sig));
    if (homes.length === 1) homes[0]!.listings.push(...cluster.listings);
    else out.push(cluster);
  }
  return out;
}

/**
 * M1/M2: groups the listings of one category into clusters. Tires and wheels
 * share a bucket on the fields that must match (brand, model, size or
 * diameter and width) and merge when every optional field BOTH sides filled
 * agrees. A blank-key unit that fits two or more candidates that disagree with
 * each other merges with none of them (counted). Where a vendor has two
 * different listings in a group, only a shared vendor SKU can pair listings
 * across vendors. Accessories (M2) pair on the same normalised SKU across
 * vendors, brands agreeing or one blank. Identical same-vendor listings (M3)
 * are then merged with `regroupIdentical`.
 */
function components(units: Unit[]): Cluster[] {
  const out: Cluster[] = [];
  const category = units[0]?.listings[0]?.category;
  if (category === "accessories") {
    const listings = units.flatMap((u) => u.listings);
    const uf = new UnionFind(listings.length);
    const bySku = new Map<string, number[]>();
    listings.forEach((listing, index) => {
      const key = skuKey(listing.primary.sku);
      const group = bySku.get(key) ?? [];
      group.push(index);
      bySku.set(key, group);
    });
    for (const [sku, group] of bySku) {
      if (group.length < 2) continue;
      const vendors = new Set(group.map((i) => listings[i]!.primary.source));
      const brands = new Set(group.map((i) => keyPart(listings[i]!.fields[F.brand] ?? "")).filter((b) => b !== ""));
      if (brands.size > 1) {
        matchNotes.brandConflict.push({ skus: sku, brands: [...brands].join(" / ") });
        continue;
      }
      if (vendors.size < group.length) {
        // One vendor lists the same normalised SKU twice: which one the other
        // vendor means is unknown.
        continue;
      }
      for (const i of group.slice(1)) uf.union(group[0]!, i);
    }
    const byRoot = new Map<number, Listing[]>();
    listings.forEach((listing, index) => {
      const root = uf.find(index);
      const group = byRoot.get(root) ?? [];
      group.push(listing);
      byRoot.set(root, group);
    });
    return regroupIdentical([...byRoot.values()].map((group) => ({ listings: group, viaBlank: false })));
  }

  const keys = units.map(unitKey);
  const unitIndex = new Map<Unit, number>(units.map((unit, index) => [unit, index]));
  const buckets = new Map<string, number[]>();
  keys.forEach((key, index) => {
    if (key.bucket === null) {
      out.push({ listings: units[index]!.listings, viaBlank: false });
      return;
    }
    const group = buckets.get(key.bucket) ?? [];
    group.push(index);
    buckets.set(key.bucket, group);
  });
  const vendorsUnique = (group: Unit[]) => new Set(group.map((u) => u.vendor)).size === group.length;
  for (const members of buckets.values()) {
    // Nodes: distinct optional vectors.
    const nodes = new Map<string, { opt: (string | null)[]; indexes: number[] }>();
    for (const index of members) {
      const opt = keys[index]!.opt;
      const id = JSON.stringify(opt);
      const node = nodes.get(id) ?? { opt, indexes: [] };
      node.indexes.push(index);
      nodes.set(id, node);
    }
    const list = [...nodes.values()];
    const ambiguous = new Set<number>();
    const ambiguousNotes: { rowIds: string[]; candidates: string[]; indexes: number[] }[] = [];
    list.forEach((node, n) => {
      if (!node.opt.some((v) => v === null)) return;
      const fits = list.map((_o, m) => m).filter((m) => m !== n && compatible(node.opt, list[m]!.opt));
      for (let x = 0; x < fits.length && !ambiguous.has(n); x += 1) {
        for (let y = x + 1; y < fits.length; y += 1) {
          if (!compatible(list[fits[x]!]!.opt, list[fits[y]!]!.opt)) {
            ambiguous.add(n);
            ambiguousNotes.push({
              rowIds: node.indexes.flatMap((i) => units[i]!.listings.flatMap(idsOf)),
              candidates: fits.map((m) => list[m]!.indexes.flatMap((i) => units[i]!.listings.flatMap(idsOf)).join("+")),
              indexes: node.indexes,
            });
            break;
          }
        }
      }
    });
    const uf = new UnionFind(list.length);
    for (let n = 0; n < list.length; n += 1) {
      if (ambiguous.has(n)) continue;
      for (let m = n + 1; m < list.length; m += 1) {
        if (ambiguous.has(m)) continue;
        if (compatible(list[n]!.opt, list[m]!.opt)) uf.union(n, m);
      }
    }
    const byRoot = new Map<number, number[]>();
    list.forEach((_node, n) => {
      if (ambiguous.has(n)) return;
      const root = uf.find(n);
      const group = byRoot.get(root) ?? [];
      group.push(n);
      byRoot.set(root, group);
    });
    // Units left over: those of an ambiguous node and those of a component
    // where one vendor has two different listings. Only a shared vendor SKU
    // can still pair them.
    const leftoverUnits: Unit[] = [...ambiguous].flatMap((n) => list[n]!.indexes.map((i) => units[i]!));
    const bucketOut: Cluster[] = [];
    for (const group of byRoot.values()) {
      const width = list[0]!.opt.length;
      let consistent = true;
      for (let i = 0; i < width && consistent; i += 1) {
        const values = new Set(group.map((n) => list[n]!.opt[i]).filter((v) => v !== null));
        if (values.size > 1) consistent = false;
      }
      const groupUnits = group.flatMap((n) => list[n]!.indexes.map((index) => units[index]!));
      if (!consistent) {
        matchNotes.inconsistent += 1;
        for (const unit of groupUnits) bucketOut.push({ listings: unit.listings, viaBlank: false });
        continue;
      }
      if (!vendorsUnique(groupUnits)) {
        matchNotes.vendorConflicts.push(groupUnits.flatMap((u) => u.listings));
        leftoverUnits.push(...groupUnits);
        continue;
      }
      bucketOut.push({ listings: groupUnits.flatMap((u) => u.listings), viaBlank: group.length > 1 });
    }

    // The SKU pass. Items: every cluster formed so far, and every leftover
    // listing on its own. Two items pair when they hold listings of different
    // vendors with the same vendor SKU and their optional fields are
    // consistent. A group is kept only when each vendor has ONE kind of
    // listing in it (identical ones are fine) and the fields stay consistent.
    if (leftoverUnits.length > 0) {
      const optOf = new Map<Listing, (string | null)[]>();
      for (const unit of units) for (const listing of unit.listings) optOf.set(listing, keys[unitIndex.get(unit)!]!.opt);
      const items: Cluster[] = [
        ...bucketOut,
        ...leftoverUnits.flatMap((unit) => unit.listings.map((listing) => ({ listings: [listing], viaBlank: false }))),
      ];
      const pooledFrom = bucketOut.length;
      const optsOf = (item: Cluster) => item.listings.map((l) => optOf.get(l)!);
      const consistentOpts = (opts: (string | null)[][]) => {
        const width = opts[0]?.length ?? 0;
        for (let i = 0; i < width; i += 1) {
          if (new Set(opts.map((o) => o[i]).filter((v) => v !== null)).size > 1) return false;
        }
        return true;
      };
      const sku = new UnionFind(items.length);
      const bySku = new Map<string, { item: number; listing: Listing }[]>();
      items.forEach((item, i) => {
        for (const listing of item.listings) {
          const key = skuKey(listing.primary.sku);
          const group = bySku.get(key) ?? [];
          group.push({ item: i, listing });
          bySku.set(key, group);
        }
      });
      for (const group of bySku.values()) {
        for (let x = 0; x < group.length; x += 1) {
          for (let y = x + 1; y < group.length; y += 1) {
            const u = group[x]!;
            const v = group[y]!;
            if (u.item === v.item || u.listing.primary.source === v.listing.primary.source) continue;
            // At least one side must be a leftover listing: formed clusters
            // were already compared by M1 and are not re-joined here.
            if (u.item < pooledFrom && v.item < pooledFrom) continue;
            if (consistentOpts([...optsOf(items[u.item]!), ...optsOf(items[v.item]!)])) sku.union(u.item, v.item);
          }
        }
      }
      const skuGroups = new Map<number, number[]>();
      items.forEach((_item, i) => {
        const root = sku.find(i);
        const group = skuGroups.get(root) ?? [];
        group.push(i);
        skuGroups.set(root, group);
      });
      const finalClusters: Cluster[] = [];
      for (const members of skuGroups.values()) {
        const groupItems = members.map((i) => items[i]!);
        const listings = groupItems.flatMap((item) => item.listings);
        const oneKindPerVendor = [...new Set(listings.map((l) => l.primary.source))].every(
          (vendor) => new Set(listings.filter((l) => l.primary.source === vendor).map(identity)).size === 1,
        );
        if (members.length > 1 && oneKindPerVendor && consistentOpts(listings.map((l) => optOf.get(l)!))) {
          if (members.some((i) => i >= pooledFrom)) matchNotes.skuPaired += 1;
          finalClusters.push({
            listings,
            viaBlank: groupItems.some((item) => item.viaBlank) || new Set(listings.map((l) => JSON.stringify(optOf.get(l)))).size > 1,
          });
        } else {
          finalClusters.push(...groupItems);
        }
      }
      bucketOut.length = 0;
      bucketOut.push(...regroupIdentical(finalClusters));
      const merged = new Set(bucketOut.filter((c) => new Set(c.listings.map((l) => l.primary.source)).size > 1).flatMap((c) => c.listings));
      for (const note of ambiguousNotes) {
        const listingsOfNote = note.indexes.flatMap((i) => units[i]!.listings);
        if (!listingsOfNote.every((l) => merged.has(l))) {
          matchNotes.blankAmbiguous.push({ rowIds: note.rowIds, candidates: note.candidates });
        }
      }
    }
    out.push(...bucketOut);
  }
  return out;
}

/* --- Merging --------------------------------------------------------------------- */

/**
 * Owner, 2026-10-03: in a merge every field except the name, the photos and
 * the sources takes the winner's value when it has one, and otherwise the
 * first non-blank value of the other listings in priority order. An extra
 * spec the winner does not list is added the same way. Every fill is logged;
 * a real disagreement still follows the winner.
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
  edits?: string[];
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
      `${name}: ${listings.map((l, i) => `${l.primary.source} ${l.primary.sku}=${each[i] === "" ? "(blank)" : each[i]}`).join("; ")}`,
    );
  }
  return { fields, values: parts.join(" || ") };
}

const rowIds = (listings: Listing[]) => listings.flatMap((l) => l.rows.map((r) => r.rowId));

/** Counts for summary.txt. */
const mergeStats = {
  m1Products: { tires: 0, wheels: 0 } as Record<string, number>,
  m1SameSku: 0,
  m2Products: 0,
  m2TypeConflicts: 0,
  m3Products: { tires: 0, wheels: 0, accessories: 0 } as Record<string, number>,
  m3RowsMerged: { tires: 0, wheels: 0, accessories: 0 } as Record<string, number>,
  ambiguousVendor: 0,
  largestSources: 0,
};

function mergeCategory(listings: Listing[]): Product[] {
  const products: Product[] = [];
  if (listings.length === 0) return products;
  const units = makeUnits(listings);
  const clusters = components(units);
  // Groups where one vendor has two DIFFERENT listings: reported when the SKU
  // pass could not pair every listing of them with another vendor's.
  const crossVendor = new Set(
    clusters.filter((c) => new Set(c.listings.map((l) => l.primary.source)).size > 1).flatMap((c) => c.listings),
  );
  for (const group of matchNotes.vendorConflicts.splice(0)) {
    if (group.every((listing) => crossVendor.has(listing))) continue;
    const found = disagreements(group);
    mergeStats.ambiguousVendor += 1;
    mergeReport.push({
      kind: "ambiguous_not_merged",
      kept: "",
      merged: rowIds(group),
      sources: group.map((l) => `${l.primary.source} ${l.primary.sku}`),
      disagreed: found.fields,
      winner: "",
      values: found.values,
      filled: [],
    });
  }
  for (const cluster of clusters) products.push(productOf(cluster.listings, cluster.viaBlank, true));
  return products;
}

function productOf(listings: Listing[], viaBlank: boolean, mayMergeAcrossVendors: boolean): Product {
  const sorted = [...listings].sort((a, b) => rank(a.primary.source) - rank(b.primary.source) || a.primary.index - b.primary.index);
  const winner = sorted[0]!;
  if (sorted.length === 1) return { category: winner.category, listings: sorted };
  const vendors = new Set(sorted.map((l) => l.primary.source));
  const crossVendor = vendors.size > 1 && mayMergeAcrossVendors;
  const merged = resolveMerge(sorted);
  const product: Product = { category: winner.category, listings: sorted, ...merged };
  const { fields, values } = disagreements(sorted);
  const category = winner.category;
  const sameVendorRows = sorted.length - vendors.size;
  if (sameVendorRows > 0) {
    mergeStats.m3Products[category] = (mergeStats.m3Products[category] ?? 0) + 1;
    mergeStats.m3RowsMerged[category] = (mergeStats.m3RowsMerged[category] ?? 0) + sameVendorRows;
  }
  if (crossVendor) {
    if (category === "accessories") {
      mergeStats.m2Products += 1;
      const types = new Set(sorted.map((l) => l.fields[F.accessoryType]).filter((t) => t));
      if (types.size > 1) {
        mergeStats.m2TypeConflicts += 1;
        logChange(
          "M2 type conflict",
          rowIds(sorted),
          F.accessoryType,
          sorted.map((l) => `${l.primary.source}=${l.fields[F.accessoryType]}`).join("; "),
          winner.fields[F.accessoryType] ?? "",
          `same SKU ${winner.primary.sku} typed differently by two vendors; the priority winner (${winner.primary.source}) wins. Names: ${sorted.map((l) => `"${l.fields[F.name]}"`).join(" vs ")}`,
        );
      }
    } else {
      mergeStats.m1Products[category] = (mergeStats.m1Products[category] ?? 0) + (viaBlank ? 1 : 0);
      if (viaBlank && new Set(sorted.map((l) => skuKey(l.primary.sku))).size === 1) mergeStats.m1SameSku += 1;
    }
  }
  if (sorted.length > mergeStats.largestSources) mergeStats.largestSources = sorted.length;
  const pieces = sorted.flatMap((l) => l.edits.map((e) => `${l.primary.rowId}: ${e.rule} ${e.field} "${e.before}" -> "${e.after}"`));
  mergeReport.push({
    kind: crossVendor ? (viaBlank ? "cross_vendor_merge_blank_key" : "cross_vendor_merge") : "same_vendor_identical_merge",
    kept: winner.primary.rowId,
    merged: rowIds(sorted),
    sources: sorted.map((l) => `${l.primary.source} ${l.primary.sku}`),
    disagreed: fields,
    winner: winner.primary.source,
    values,
    filled: merged.fills,
    notFilled: merged.notFilled,
    edits: pieces,
  });
  return product;
}

/* --- Output ------------------------------------------------------------------------ */

const SHARED_COLUMNS = [
  F.category, F.brand, F.model, F.name, F.description, F.gtin, F.partNumber, F.extraSpecs,
];
const TIRE_COLUMNS = [
  F.tireSize, F.serviceType, F.loadIndex, F.speedRating, F.loadRange, F.plyRating, F.utqg,
  F.season, F.isXl, F.winterApproved, F.mudSnow, F.studdable, F.runFlat,
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
  // M11: a blanked load index never leaves its speed letter behind, even one a merge filled in from another vendor.
  if (product.category === "tires" && (record[F.loadIndex] ?? "") === "" && (record[F.speedRating] ?? "") !== "" && product.listings.some((l) => m11Blanked.has(l.primary.rowId))) {
    const ids = product.listings.flatMap((l) => idsOf(l));
    const left = record[F.speedRating] ?? "";
    record[F.speedRating] = "";
    if (!m11SpeedLogged.has(ids.join(";"))) {
      m11SpeedLogged.add(ids.join(";"));
      logChange("M11", ids, F.speedRating, left, "", "the product has no load index after M11 (blanked on one listing) and its speed letter came from another vendor; a card would read the size plus a lone speed letter, so it is blanked too");
    }
  }
  // D142: Part number and Mud & snow ride through the merge as extras, so
  // M3's identity and the vendor-own-code rule above see them as before, and
  // leave here for columns of their own. A tire's Part number is dropped
  // (owner, 2026-10-04: "yes drop the tire ones"); Mud & snow is always `yes`
  // when present (`yesExtra`).
  const extra: [string, string][] = [];
  for (const [label, value] of product.extra ?? winner.extra) {
    if (label === "Part number") {
      if (product.category !== "tires") record[F.partNumber] = value;
    } else if (label === "Mud & snow") {
      if (product.category === "tires") record[F.mudSnow] = value;
    } else {
      extra.push([label, value]);
    }
  }
  record[F.extraSpecs] = extra.map(([label, value]) => `${label}: ${value}`).join(" | ");
  product.listings.forEach((listing, index) => {
    const n = index + 1;
    const row = listing.primary;
    record[sourceColumn("vendor", n)] = row.source;
    record[sourceColumn("sku", n)] = row.sku;
    record[sourceColumn("url", n)] = row.cells.product_url ?? "";
    record[sourceColumn("price", n)] = row.price;
  });
  // The winner's photos; when it has none, the first other listing that has some.
  const photos = (winner.images.length > 0 ? winner : product.listings.find((l) => l.images.length > 0) ?? winner).images;
  photos.forEach((path, index) => {
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

  // Data-QA rules (owner, 2026-10-03), in this order: the table fixes (M8),
  // finish spellings (M8h), the model borrowed by SKU (M1), the model built
  // from the name (M6), model spelling folds (M4), accessory names and pack
  // sizes (M5, M7) and descriptions (M9). Then the matching (M1, M2, M3).
  const apparel = [...valid.tires, ...valid.wheels];
  for (const listing of apparel) applyDataFixes(listing);
  checkLoadIndexes(valid.tires);
  foldFinishSpellings(valid.wheels);
  const modelsBorrowed = borrowModels(valid.wheels);
  for (const listing of apparel) modelFromName(listing);
  for (const listing of apparel) foldModel(listing);
  for (const listing of valid.accessories) {
    const brandFix = ACCESSORY_BRAND_FIXES[listing.primary.sku];
    if (brandFix) editField("LA06", listing, F.brand, brandFix.to, brandFix.reason);
    cleanAccessoryName(listing);
    fixPackSizes(listing);
    retypeLugBolts(listing);
  }
  for (const s of seasonByMaker) reseasoned.add(s.rowId);
  for (const category of CATEGORIES) for (const listing of valid[category]) cleanDescription(listing);
  for (const category of CATEGORIES) for (const listing of valid[category]) cleanDescriptionM10(listing);

  let products: Product[] = [
    ...mergeCategory(valid.tires),
    ...mergeCategory(valid.wheels),
    ...mergeCategory(valid.accessories),
  ].filter((product) => {
    if (product.listings.length <= MAX_SOURCES) return true;
    for (const listing of product.listings) {
      issue(listing, `merged product would have ${product.listings.length} sources (more than ${MAX_SOURCES})`);
    }
    return false;
  });
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
  for (const v of m10Stats.violations) failures.push(`description trim: ${v}`);
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
    if (/[\u2013\u2014]/.test(record[F.description] ?? "")) failures.push(`row ${record.row_id}: the description has an em or en dash`);
    if (record[F.category] === "tires") {
      const load = firstLoad(record[F.loadIndex] ?? "");
      if (load !== null && load > 150) failures.push(`row ${record.row_id}: load index ${record[F.loadIndex]} is above 150`);
    }
    if (record[F.accessoryType] === "Lug Nuts" && /(?:^|\|)\s*Model:\s*BOLT\s*(?:\||$)/i.test(record[F.extraSpecs] ?? "")) {
      failures.push(`row ${record.row_id}: a lug whose Model is BOLT is typed Lug Nuts`);
    }
  }
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
  let report = csvLine(["kind", "kept_row_id", "merged_row_ids", "sources", "fields_that_disagreed", "winning_source", "values", "filled_from_other_vendors", "other_vendor_codes_not_filled", "listing_edits_before_merge"]);
  for (const line of finalReport) {
    report += csvLine([line.kind, line.kept, line.merged.join(";"), line.sources.join(";"), line.disagreed.join(";"), line.winner, line.values, line.filled.join(" || "), (line.notFilled ?? []).join(" || "), (line.edits ?? []).join(" || ")]);
  }
  writeFileSync(join(outDir, "merge-report.csv"), report);

  // changes-review.csv: one row per data edit or merge decision new in this run.
  const categoryOf = (id: string) => (id.includes("-T-") ? "tires" : id.includes("-W-") ? "wheels" : "accessories");
  const reviewRows: Change[] = changes.filter((c) => c.rowIds.some((id) => loaded.has(id)));
  for (const line of finalReport) {
    const category = categoryOf(line.kept || line.merged[0] || "");
    if (line.kind === "cross_vendor_merge_blank_key") {
      reviewRows.push({
        rule: "M1 merge",
        rowIds: line.merged,
        field: "(merge)",
        before: `${line.merged.length} products: ${line.sources.join("; ")}`,
        after: `one product, winner ${line.winner} ${line.kept}`,
        reason: `${category}: every key field both sides filled agrees; the differences are blanks. Filled: ${line.filled.join("; ") || "none"}${line.disagreed.length ? `. Still disagree (winner kept): ${line.disagreed.join(", ")}` : ""}`,
      });
    } else if (line.kind === "cross_vendor_merge" && category === "accessories") {
      reviewRows.push({
        rule: "M2 merge",
        rowIds: line.merged,
        field: "(merge)",
        before: `${line.merged.length} products: ${line.sources.join("; ")}`,
        after: `one product, winner ${line.winner} ${line.kept}`,
        reason: `same SKU (case, spaces, dashes ignored), brands agree or one blank${line.disagreed.length ? `. Disagree (winner kept): ${line.disagreed.join(", ")}` : ""}`,
      });
    }
    if (line.kind.startsWith("cross_vendor_merge")) {
      const vendors = line.sources.map((source) => source.slice(0, source.lastIndexOf(" ")));
      if (new Set(vendors).size < vendors.length) {
        reviewRows.push({
          rule: "M3 merge",
          rowIds: line.merged,
          field: "(merge)",
          before: `${line.merged.length} products: ${line.sources.join("; ")}`,
          after: `one product, ${line.sources.length} sources (also cross-vendor)`,
          reason: `${category}: a vendor's identical listings (every field the shopper sees equal) joined the cross-vendor product`,
        });
      }
    }
    if (line.kind === "same_vendor_identical_merge") {
      reviewRows.push({
        rule: "M3 merge",
        rowIds: line.merged,
        field: "(merge)",
        before: `${line.merged.length} products: ${line.sources.join("; ")}`,
        after: `one product, ${line.sources.length} sources`,
        reason: `${category}: every field the shopper sees is identical; only SKU, URL, price, images and row id differ`,
      });
    }
  }
  for (const note of matchNotes.blankAmbiguous) {
    reviewRows.push({
      rule: "M1 not merged",
      rowIds: note.rowIds,
      field: "(merge)",
      before: note.rowIds.join(";"),
      after: "kept as its own product",
      reason: `blank key field fits ${note.candidates.length} candidates that disagree with each other: ${note.candidates.join(" | ")}`,
    });
  }
  for (const note of matchNotes.brandConflict) {
    reviewRows.push({ rule: "M2 not merged", rowIds: [], field: "(merge)", before: note.skus, after: "kept apart", reason: `same SKU, brands disagree: ${note.brands}` });
  }
  for (const left of blankModelLeft) {
    reviewRows.push({ rule: "M6 model left blank", rowIds: left.rowIds, field: F.model, before: "", after: "", reason: `nothing meaningful is left of "${left.name}" once brand, size, bolt pattern, offset and finish are taken out` });
  }
  for (const look of lugBoltLookAlikes) {
    reviewRows.push({ rule: "M12 not retyped", rowIds: look.rowIds, field: F.accessoryType, before: "Lug Nuts", after: "(unchanged)", reason: `vendor title "${look.vendorTitle}" mentions a bolt but the vendor's Model is not BOLT; not retyped` });
  }
  for (const alias of MODEL_NOT_FOLDED) {
    reviewRows.push({ rule: "M4 not folded", rowIds: [], field: F.model, before: `${alias.brand}: ${alias.models}`, after: "(unchanged)", reason: alias.why });
  }
  let changesCsv = csvLine(["rule", "row_ids", "field", "before", "after", "reason_or_evidence"]);
  for (const c of reviewRows) changesCsv += csvLine([c.rule, c.rowIds.join(";"), c.field, c.before, c.after, c.reason]);
  writeFileSync(join(outDir, "changes-review.csv"), changesCsv);

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
  const merges = finalReport.filter((l) => l.kind.startsWith("cross_vendor_merge") || l.kind === "same_vendor_identical_merge");
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
  const changeCount = (rule: string, field?: string) =>
    changes.filter((c) => c.rule === rule && (field === undefined || c.field === field) && c.rowIds.some((id) => loaded.has(id))).length;
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
    `  by merges (M1, M2, M3):    ${mergedAway}`,
    `Merged products (cross-vendor and same-vendor): ${merges.length} products`,
    ...CATEGORIES.map((c) => `  ${c.padEnd(12)} ${productsBy(c).filter((r) => (r[sourceColumn("vendor", 2)] ?? "") !== "").length}`),
    `Blanks filled from a lower-priority vendor: ${fills.length} values in ${merges.filter((l) => l.filled.length > 0).length} merged products`,
    ...[...fillsBy].sort((a, b) => b[1] - a[1]).map(([field, n]) => `  ${String(n).padStart(6)}  ${field}`),
    "Merge keys (owner, 2026-10-03, data QA): listings merge when every key field BOTH sides filled agrees;",
    "a blank on one side is filled from the other, and only when the match is unique.",
    "  Tires:  brand, model and size must be filled and equal; load index (with its dual) and speed rating may be blank on one side.",
    "  Wheels: brand, model, diameter, width and side must be equal; bolt pattern(s), offset, finish and centre bore may be blank on one side.",
    "  Accessories: the same vendor SKU (case, spaces and dashes ignored); brands agree or one is blank.",
    "  A blank load_index_dual or side is a statement, not a gap, and is always compared.",
    "",
    "Data-QA rules (owner 2026-10-03)",
    `  M1 tires/wheels merged across vendors over a blank key field: ${(mergeStats.m1Products.tires ?? 0)} tire products, ${(mergeStats.m1Products.wheels ?? 0)} wheel products (${mergeStats.m1SameSku} of them share the exact vendor SKU)`,
    `     wheel models borrowed from another vendor's listing of the same SKU: ${modelsBorrowed}`,
    `     blank-key listings that fit two or more candidates that disagree, so NOT merged: ${matchNotes.blankAmbiguous.length} nodes covering ${matchNotes.blankAmbiguous.reduce((n, x) => n + x.rowIds.length, 0)} rows`,
    `     components whose optional fields still disagreed (nothing merged): ${matchNotes.inconsistent}`,
    `  M2 accessories merged across vendors on one SKU: ${mergeStats.m2Products} products; type conflicts (priority winner's type used): ${mergeStats.m2TypeConflicts}; same SKU but brands disagree, kept apart: ${matchNotes.brandConflict.length}`,
    `  M3 same-vendor identical listings merged into one product: tires ${mergeStats.m3Products.tires} products (${mergeStats.m3RowsMerged.tires} rows), wheels ${mergeStats.m3Products.wheels} (${mergeStats.m3RowsMerged.wheels}), accessories ${mergeStats.m3Products.accessories} (${mergeStats.m3RowsMerged.accessories})`,
    `     groups held apart because one vendor has two DIFFERENT listings in them (no cross-vendor merge): ${mergeStats.ambiguousVendor}`,
    `     largest number of sources on one product: ${mergeStats.largestSources} (limit ${MAX_SOURCES})`,
    `  M4 model spellings folded: ${changeCount("M4")} listings in ${MODEL_ALIASES.length} alias entries; pairs deliberately not folded: ${MODEL_NOT_FOLDED.length}`,
    `  M5 accessory names cleaned: ${changeCount("M5", F.name)} names; Part number specs added: ${changeCount("M5", "extra_specs: Part number")}`,
    `     prefixes stripped: ${[...strippedPrefixes].map(([p2, n]) => `"${p2}" ${n}`).join(", ") || "none"}`,
    `  M6 blank models filled from the name: ${changeCount("M6")}; left blank (nothing meaningful in the name): ${blankModelLeft.length} (${blankModelLeft.filter((x) => x.category === "wheels").length} wheels, ${blankModelLeft.filter((x) => x.category === "tires").length} tires)`,
    `  M7 pack sizes: pack_quantity set ${changeCount("M7", F.packQuantity)}; redundant or contradicting "Quantity per box" / "Pieces per pack" specs dropped ${changeCount("M7", "extra_specs: Quantity per box") + changeCount("M7", "extra_specs: Pieces per pack")}`,
    `  M8 a TIS widths ${changeCount("M8a", F.wheelWidth)}; b bolt ${changeCount("M8b", F.boltPatterns)}; c brand ${changeCount("M8c")}; d lug count ${changeCount("M8d")}; e backspacing recomputed ${changeCount("M8e")} (listed but not changed: ${changeCount("M8e (not changed)")}); f season ${changeCount("M8f")}; g Nanoi ${changeCount("M8g", F.wheelFinish)}; h finish spellings ${changeCount("M8h", F.wheelFinish)}; i dual load swapped ${changeCount("M8i", F.loadIndex)}; j load/speed from name ${changeCount("M8j", F.loadIndex)}`,
    `  M9 descriptions edited: ${descriptionsEdited} (${changeCount("M9") } written to changes-review.csv; blanked: ${changes.filter((c) => c.rule === "M9" && c.after === "").length})`,
    `  M10 descriptions (D152): ${m10Stats.edited} listings edited (${m10Stats.curated} by the curated table, ${m10Stats.automatic} by the automatic fallback), ${m10Stats.blank.length} left blank; ${m10Stats.differentTire.length} removed because they describe another tire (${m10Stats.differentTire.join(", ")}); fallback: pasted Key Features blocks ${m10Stats.pasted}, sentences dropped ${m10Stats.droppedSentences}; descriptions with dashes replaced ${m10Stats.dashes}; word check violations ${m10Stats.violations.length}`,
    ...m10Stats.blank.map((b) => `     blank: ${b}`),
    `  M11 load index blanked (D152): model code ${m11Stats.code}, name conflict ${m11Stats.nameConflict}, outlier ${m11Stats.outlier}; confirmed on a vendor or maker page and kept ${m11Stats.confirmedKept}, corrected ${m11Stats.confirmedSet}`,
    `  M12 lug bolts retyped from Lug Nuts: ${lugBoltsRetyped}; vendor titles mentioning a bolt but not retyped: ${lugBoltLookAlikes.length}`,
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
