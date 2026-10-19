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
The owner showed examples the first pass missed (earlier-session upscales kept a white hole through the tire, a white border around tread close-ups and a grey ground shadow). Fix: `rembg` mask applied to the alpha channel only (pixels unchanged, so no softening), white connected to the frame edge removed for bordered close-ups, skipped when dark product content would be lost. Run over all 5,058 tire and wheel files (about 1,400 changed so far); the 300 serving most products were reviewed on `#0B0B0D`: 248 accepted (13,603 rows repointed in production, `rollback2.csv`), 52 rejected (silver or chrome wheels with chewed rims) and left alone. The remaining changed files are not yet reviewed or applied.

## Sourcing photos for products with none
Five agents searched brand sites, other vendors and retailers: 37 photos found (31 wheels, 5 tires, 1 cap), 390 not found. Direct Auto Import's own pages show its default no-image graphic for the 168 unbranded, 95 ART/DAI, 50 Ruffino and other accessories, and no brand site or retailer carries the exact parts. 36 sourced photos passed review; `catalog-photo-add.ts` inserts them (prepared; the write needs the owner's go-ahead for that script).
