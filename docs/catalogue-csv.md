# The catalogue CSV

**Status:** a suggested layout for the file the import reads (D113). It is not a contract: a file laid
out differently is handled by editing `src/features/catalog/import-mapping.ts`, not by reworking the
file. Written for whoever prepares the catalogue data.

## The shape

- One CSV file, UTF-8, comma-separated, with a header row. Quote any cell that contains a comma.
- **One row per product, and one size is one product.** A tire model in twelve sizes is twelve rows.
- **A product that two vendors sell is ONE row**, with both vendors in the source columns. The import
  does not merge duplicates.
- A blank cell means "not stated". Do not write `0`, `N/A` or `-` for a value you do not have.
- Extra columns are allowed. The import ignores them and lists them in its report.

## Columns for every product

| Column | Needed | Example | Notes |
|---|---|---|---|
| `category` | yes | `tires` | `tires`, `wheels` or `accessories` |
| `brand` | yes | `Pirelli` | Spelled as the site should show it, the same way on every row. Up to 80 characters |
| `model` | | `P-Zero` | Groups the sizes of one model. Up to 120 characters |
| `name` | yes | `Pirelli P-Zero 235/45R18 98Y` | The full title. Up to 200 characters |
| `description` | | | Free text, up to 5,000 characters |
| `price` | | `129.99` | A plain number. Blank shows "Inquire for price" |
| `gtin` | | `8019227266603` | Barcode (UPC / EAN) |
| `source_vendor_1` | | `Auto Country` | Where the shop orders it. A second vendor goes in `source_vendor_2`, up to `_10` |
| `source_sku_1` | with a vendor | `6959613703553` | That vendor's SKU. **A vendor + SKU pair may appear on one row only** |
| `source_url_1` | | `https://…` | The vendor's own page, a full link |
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
| `material`, `wheel_seat_type` | | `alloy`, `Conical` | |
| `load_rating_lbs` | | `1600` | Pounds, a whole number |
| `tpms_compatible`, `winter_compatible` | | `yes` | `yes`, `no`, or blank for "not stated" |

## Accessories

| Column | Needed | Example | Notes |
|---|---|---|---|
| `accessory_type` | yes | `lug_nuts` | `lug_nuts`, `wheel_locks`, `hub_rings`, `centre_caps`, `tpms`, `spacers`, `wheel_weights`, `hub_caps` or `other` |
| `thread_size` | | `14x1.5` | |
| `accessory_seat_type`, `accessory_finish` | | `Conical`, `Chrome` | |
| `pack_quantity` | | `20` | Pieces in the pack |
| `outer_diameter_mm`, `inner_diameter_mm` | | `73.1`, `60.1` | Hub rings |

## What the import does with the file

- A row that breaks a rule above is **skipped and listed** in `rejected.csv` with the reason and its
  original cells. The rest of the file still loads. Nothing is corrected for you.
- Two rows carrying the same vendor + SKU are **both** skipped.
- Every product arrives `published`. The file does not set a status.
- The product's web address is built from brand, model and size. Two products that would share one get
  `-2`, `-3` in file order, so keep the row order stable between versions of the file.

How to run it: the header of `scripts/catalog-import.ts`.
