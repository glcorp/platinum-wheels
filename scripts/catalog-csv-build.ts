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
  { category: "tires", brand: "Haida", models: "HD927 | HD927 SP", why: "SP could be a separate variant; no maker page found" },
  { category: "tires", brand: "Haida", models: "HD927SP UHP Performance | HD927 UHP Performance", why: "one product each; unsure" },
  { category: "tires", brand: "Hankook", models: "Ion Evo AS SUV | Ion Evo AS SUV (EV)", why: "EV marking is a separate tire line" },
  { category: "tires", brand: "Nexen", models: "CP671H | CP671", why: "unsure whether the H is a speed rating or part of the name" },
  { category: "tires", brand: "Suretrac", models: "Comfortride GP | Comfortride", why: "unsure; no maker page" },
  { category: "tires", brand: "Michelin", models: "CrossClimate 2 | CrossClimate 2 CUV", why: "CUV is a separate tire" },
  { category: "tires", brand: "Mazzini", models: "ECO307 | ECO307+", why: "the plus is a different tire" },
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
  foldFinishSpellings(valid.wheels);
  const modelsBorrowed = borrowModels(valid.wheels);
  for (const listing of apparel) modelFromName(listing);
  for (const listing of apparel) foldModel(listing);
  for (const listing of valid.accessories) {
    cleanAccessoryName(listing);
    fixPackSizes(listing);
  }
  for (const category of CATEGORIES) for (const listing of valid[category]) cleanDescription(listing);

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
