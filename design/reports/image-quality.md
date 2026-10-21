# Product photo quality pass (2026-10-19)

Status: **written to production 2026-10-19** after the owner allowed the upload: 149 new files stored (336 were already in R2), then one transaction repointed 9,662 rows across 485 photos and removed 90 rows (39,874 to 39,784). Rollback: `rollback.csv` (copy in the scratch folder).

## Method
1. Read production (read-only): 5,586 distinct catalogue photo files (`catalog/<category>/<hash>-1000.webp`)
   serve 39,872 `product_images` rows; 374 published or discontinued products have no photo.
2. Scored every file (`photo-quality-audit.csv`, scratch folder `~/Platinum Wheels Vendor Data/combined/quality-2026-10/`):
   alpha coverage, bounding box, edge brightness against the interior (fringe), Laplacian sharpness, stray islands.
   Every file already has a transparent canvas with the product at 88%, so the defects are inside the frame, not at its corners.
3. Took the 2026-10-15 session's findings (380 files: 336 replacements already stored in R2, 87 removals, none applied).
4. Flagged 698 further files by metric; five Sonnet reviewers looked at every one composited on `#0B0B0D`:
   468 fine, 120 light box, 86 grey shadow or halo, 12 blurry, 8 wrong, 4 watermark-like.
5. Re-cut the 206 light-box and halo files with `rembg` (isnet-general-use, own virtualenv, nothing committed),
   refit to the 88% canvas, Real-ESRGAN x4plus only where enlargement exceeded 1.4x (2 files). Three reviewers
   compared old and new on the dark ground: 147 accepted, 59 rejected (chrome caps and tread close-ups: holes, chewed edges).
   Rejected files keep their current photo. Two of three lifestyle tire shots were cut cleanly and added; one was not and is removed.

## Plan (ready to run)
`plan.csv`: 485 replacements (336 earlier-session, 149 new) and 90 removals. Dry run: **9,662 rows repoint, 90 rows removed, 0 problems.**
Run with `npm run catalog:photo-replace -- plan.csv --env <r2 env> --env <db env> --upload` then `--write`
(`--write` is one transaction that rolls back unless the counts equal the dry run; `rollback.csv` is written).

## Not done
- **Live storefront check:** the apex serves the old site; storefront pages were not viewed. New files answer 200 image/webp. Cached listings refresh on the next deploy (D111).
- **374 products with no photo:** not sourced (337 are Direct Auto Import accessories; robots.txt names AI crawlers, so only targeted fetches are allowed, and many caps differ only by colour or logo).
- **59 rejected re-cuts, 12 blurry files:** need a better source photo; 24 files in all are listed in the scratch `review/` folder.
- Before/after page: https://claude.ai/artifact/Mnid2MCjSbs4bMtuV2YpSx (private).

## Second pass (2026-10-20): grey shadows, white holes and white borders on tires and wheels
The owner showed examples the first pass missed (earlier-session upscales kept a white hole through the tire, a white border around tread close-ups and a grey ground shadow). Fix: `rembg` mask applied to the alpha channel only (pixels unchanged, so no softening), white connected to the frame edge removed for bordered close-ups, skipped when dark product content would be lost. Run over all 5,058 tire and wheel files (about 1,400 changed so far); the 300 serving most products were reviewed on `#0B0B0D`: 248 accepted (13,603 rows repointed in production, `rollback2.csv`), 52 rejected (silver or chrome wheels with chewed rims) and left alone. Second batch (files serving fewer products, 600 reviewed): 495 accepted and applied (3,723 rows, `rollback4.csv`), 105 rejected. Total from this pass: 743 photos, 17,326 rows.

## Sourcing photos for products with none
Five agents searched brand sites, other vendors and retailers: 37 photos found (31 wheels, 5 tires, 1 cap), 390 not found. Direct Auto Import's own pages show its default no-image graphic for the 168 unbranded, 95 ART/DAI, 50 Ruffino and other accessories, and no brand site or retailer carries the exact parts. 36 sourced photos passed review and were inserted with `catalog-photo-add.ts` (36 rows, `rollback3.csv`).

Still open: about 1,100 more files changed by the clean-up run are unreviewed (each serves 15 or fewer products); the run itself was still going over the tire and wheel set. The Nitto Trail Grappler M/T photo found was rejected (cropped tread). 390 products stay on the no-photo tile.

## Second pass, as applied by 2026-10-20 (all in production, each batch one checked transaction with a rollback file)
| Batch | Photos | Product rows | Rollback |
|---|---|---|---|
| Top 300 by products served | 248 | 13,603 | rollback2 |
| Next 600 | 495 | 3,723 | rollback4 |
| The rest of the first run | 1,393 | 2,327 | rollback5 |
| Flagged wheels and accessories (redo with the faster cut-out model plus an edge cleanup for dark products) | 327 | 2,232 | rollback6 |
| Wheel locks, lug bolts, lug nuts, TPMS sensors, and the earlier rejects redone with a gentler method | 171 | 571 | rollback7 |
| First photos added for products with none | 36 products | 36 | rollback3 |
| Chewed wheel locks and shadowed hardware, re-cut from the vendor original (flood-fill bounded by an AI region) | 13 | 55 | rollback9 |
| Five wheel-weight pictogram photos taken off (neutral tile shows) | 5 photos | 38 removed | rollback10 |
| Azara AZA-536 gloss black and nano gold: sourced 1000px retailer photos, cut clean (`tools/ff3.py ... big`) | 2 | 9 | rollback11 |
| Opals F9, Minnell SW08 (owner photos), Azara 536 machined and chrome, AZA-540 machined and gloss black | 6 | 31 | rollback12 |
| Sailun Inspire ragged edge smoothed | 1 | 7 | rollback13 |
| FAST wheel ground shadow; three tread close-ups rebuilt whole | 4 | 269 | rollback14 |
| Six review agents' defect lists: tire re-cuts and wheel shadow trims | 23 | 92 | rollback15 |
| Two screw close-ups removed (neutral tile) | 2 | 8 | rollback16 |
| Wheels re-cut from the vendor original with the strong cut (ground shadows and chunks) | 36 | 136 | rollback18 |

Leftover defects the owner pointed out with screenshots (ComfortMax H202, Minnell SW08, Opals Silversnow F9, Rydanz R23, Azara AZA-536, GT lug nuts, Bosch TPMS tool, Schrader EZ-Sensor) were missed by the first review passes: reviewers read contact sheets at thumbnail size and accepted ragged edges and small shadows. Remaining fixes are made by re-running the cut on every tire (859) and accessory (528) and reviewing the changes; the tire results (`fix11`) are built and not yet applied.
The before/after pages cover the batches through the third row.

Handoff for the next session (state, paths, recipe, what is left): `design/reports/image-quality-handoff.md`.
