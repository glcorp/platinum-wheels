# The catalogue CSV

**Status:** the layout of the co-founder's merged vendor file, which the import reads as it stands
(D113, D125). A file laid out differently is handled by editing
`src/features/catalog/import-mapping.ts`, not by reworking the file. Written for whoever prepares the
catalogue data.

## The shape

- One CSV file, UTF-8, comma-separated, with a header row. Quote any cell that contains a comma.
- **One row per product, and one size is one product.** A tire model in twelve sizes is twelve rows.
- **A product that two vendors sell is ONE row** (the cross-vendor merge is done before the file gets
  here), with each vendor in its own numbered source columns. The import does not merge duplicates.
- A blank cell means "not stated". Do not write `0`, `N/A` or `-` for a value you do not have.
- Extra columns are allowed. The import ignores them and lists them in its report. `row_id` and
  `merged_row_ids`, the merged file's own row keys, are read by nothing and listed that way.
- There is **no `status` column**: the run sets it (`--status`, `published` by default). The D125 file
  has **no `price` column** either, so every product loads with no display price; prices stay off.

## Columns for every product

| Column | Needed | Example | Notes |
|---|---|---|---|
| `category` | yes | `tires` | `tires`, `wheels` or `accessories` |
| `brand` | tires, wheels | `Pirelli` | Spelled as the site should show it, the same way on every row. Up to 80 characters. **May be blank on an accessory** the vendor sells unbranded |
| `model` | | `P-Zero` | Groups the sizes of one model. Up to 120 characters |
| `name` | yes | `Pirelli P-Zero 235/45R18 98Y` | The full title. Up to 200 characters |
| `description` | | | Free text, up to 5,000 characters |
| `price` | | `129.99` | The display price, a plain number. Blank shows "Inquire for price". Not in the D125 file |
| `gtin` | | `8019227266603` | Barcode (UPC / EAN) |
| `extra_specs` | | `Sidewall: Black \| Fitment: Audi:2025:A4` | Vendor facts with no column of their own, shown after the specifications in this order. `Label: value` pairs separated by ` \| ` (space, bar, space). A pair splits on its **first** `: `, so a value may hold colons. Labels up to 60 characters, values up to 2,000, at most 40 pairs, no label twice. A pair with no `: ` refuses the row |
| `source_vendor_1` | | `Auto Country` | Where the shop orders it. A second vendor goes in `source_vendor_2`, up to `_20` |
| `source_sku_1` | with a vendor | `6959613703553` | That vendor's SKU. **A vendor + SKU pair may appear on one row only** |
| `source_url_1` | | `https://…` | The vendor's own page, a full link |
| `source_price_1` | | `189.37` | **What that vendor charges the shop**, cents kept. Staff only: shown in the admin, **never on the storefront**, and it is not the display price. Blank for none; a `0` refuses the row |
| `image_1` … `image_6` | | | Photo file names. Counted in the report, **not loaded yet** |

## Tires

| Column | Needed | Example | Notes |
|---|---|---|---|
| `tire_size` | yes | `225/45R17`, `LT275/70R18`, `35x12.50R20` | Width, profile and rim are read from this |
| `service_type` | | `LT` | `P`, `LT`, `ST`, `HL` or `C`. Blank takes it from the size |
| `load_index` | | `98` or `121/118` | |
| `speed_rating` | | `Y` | |
| `load_range` | | `E` or `XL` | |
| `ply_rating` | | `10` | A whole number |
| `season` | | `winter` | `summer`, `all_season`, `all_weather` or `winter` |
| `is_xl`, `winter_approved`, `studdable`, `run_flat` | | `yes` | `yes` or blank. `winter_approved` is the three-peak snowflake |
| `utqg` | | `420 A A` | |

## Wheels

| Column | Needed | Example | Notes |
|---|---|---|---|
| `wheel_diameter` | yes | `18` | Inches |
| `wheel_width` | yes | `8.5` | Inches |
| `bolt_patterns` | | `5x114.3` or `6x135/6x139.7` | Several are separated by `/`. `blank` for an undrilled wheel |
| `offset_mm` | | `35` or `-44` | Millimetres, at most one decimal |
| `center_bore_mm` | | `72.6` | Millimetres |
| `backspacing` | | `6.25` | Inches |
| `wheel_finish` | | `Gloss Black` | The vendor's own wording |
| `wheel_finish_family` | | `Matte Black` | The finish's family, as the vendor sheets group it. Up to 60 characters; no filter reads it yet |
| `wheel_color` | | `Black` | Up to 60 characters |
| `lug_count` | | `5` | A whole number from 3 to 12 |
| `material`, `wheel_seat_type` | | `alloy`, `Conical` | |
| `load_rating_lbs` | | `1600` | Pounds, a whole number |
| `tpms_compatible`, `winter_compatible` | | `yes` | `yes`, `no`, or blank for "not stated" |

## Accessories

| Column | Needed | Example | Notes |
|---|---|---|---|
| `accessory_type` | yes | `Lug Nuts` | One of the vendors' fifteen labels, below. Matched exactly, without regard to case; anything else (including `Other`) refuses the row |
| `thread_size` | | `14x1.5` | |
| `accessory_seat_type`, `accessory_finish` | | `Conical`, `Chrome` | |
| `pack_quantity` | | `20` | Pieces in the pack |
| `outer_diameter_mm`, `inner_diameter_mm` | | `73.1`, `60.1` | Hub rings |
| `part_type` | | `Center Cap` | The vendor's narrower kind within the type. Up to 60 characters |
| `weight_lb` | | `0.35` | Pounds, more than 0 and up to 9,999, at most two decimals |

The fifteen `accessory_type` labels (the key in brackets is what the database stores, and is accepted
too): Center Caps (`center_caps`), Lug Nuts (`lug_nuts`), Cap Logos, Inserts & Hardware
(`cap_logos_inserts_hardware`), Hub Rings (`hub_rings`), Lug Bolts (`lug_bolts`), Wheel Weights
(`wheel_weights`), Wheel Covers & Trim (`wheel_covers_trim`), Wheel Spacers (`wheel_spacers`), Wheel
Locks (`wheel_locks`), TPMS Sensors & Tools (`tpms_sensors_tools`), Tools, Gauges & Organizers
(`tools_gauges_organizers`), Tire Studs (`tire_studs`), Valves & Caps (`valves_caps`), Antennas
(`antennas`), Tire Bags & Storage (`tire_bags_storage`).

## What the import does with the file

- A row that breaks a rule above is **skipped and listed** in `rejected.csv` with the reason and its
  original cells. The rest of the file still loads. Nothing is corrected for you.
- Two rows carrying the same vendor + SKU are **both** skipped.
- Every product arrives `published`. The file does not set a status.
- The product's web address is built from brand, model and size. An accessory's is built from brand,
  name and its `Part number` spec (an unbranded one starts at its name). Two products that would share one get `-2`, `-3` in file
  order, so keep the row order stable between versions of the file.
- The report's `products.csv` lists each product's sources with their vendor prices, so they can be
  checked before a load.

How to run it: the header of `scripts/catalog-import.ts`.
