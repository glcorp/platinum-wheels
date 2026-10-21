# Product photo quality pass: handoff (2026-10-20)

Read `design/reports/image-quality.md` (what was done and why) and root `llm.md` D190 first. This file is
for the next session: where everything is, how to resume, and what is left. Owner words are quoted.

## 1. What the owner wants
Every vendor photo on the storefront sharp, on a clean background (no white box, grey shadow, pale patch,
white holes or dotted/ragged edge on the dark `#0B0B0D` theme), correct, WebP. The owner sends screenshots of
live cards that still fail and expects them fixed; reviewers (Sonnet reading contact sheets at thumbnail
size) repeatedly missed edge dots and small shadows, so **do not trust a review alone**: use the automatic
guards in §5 as well, and judge by eye at card size.
Latest instruction: *"fix all unfixed"*, then *"handoff this session"*.

## 2. Where things are (all outside the repo, never commit them)
`~/Platinum Wheels Vendor Data/combined/quality-2026-10/` ("Q" below):
- `live/` original live files (5,586), `current/` the state at the start of pass 2, `latest/` (tires) and
  `latest2/` (wheels, accessories) symlinks to the state before the redo batches, **`latest3/` the current
  best image per key (wheels and accessories; built 2026-10-20)**.
- `out3/` PNGs from the first all-wheel/tire cut; `out3/*.txt` list files: `accepted.txt`, `accepted2.txt`,
  `accepted3.txt` (batches 2, 4, 5), `accepted4.txt` (`key|latest` or `key|latest2`, batch 6),
  `accepted5.txt` (`key|fix12` or `fix13`, batch 7), `accepted6.txt` (all-tire batch 8), `held6.txt`
  (201 tires held back), `allwheels.txt`, `allacc.txt`, `alltires.txt`, `acc4.txt`, `rej54.txt`.
- Outputs of each processing run: `fix8i` (55 flagged tires), `fix10` (329 flagged wheels/accessories),
  `fix11` (all 859 tires), `fix12` (all 528 accessories), `fix13` (54 rejected redone gently),
  **`fix14` (all 4,199 wheels, running)**. Converted WebPs for upload: `out3-webp`, `out4-webp`, `out5-webp`,
  `out6-webp`, `out7-webp`, `out8-webp`. Plans: `plan.csv` … `plan8.csv`. Rollbacks: `rollback*.csv`
  (also in repo `photo-report/quality*-write/rollback.csv`, git-ignored).
- Tools (own virtualenv, `tools/rembg-venv`, python 3.14, rembg + scipy): `process10.py`
  (`<list> <srcdir> <outdir> <part> <nparts>`, isnet cut + defringe for dark products),
  `process11.py` (gentler: removes only pale background pixels connected to the outside, depth-limited, for
  products the strong cut damages), `defringe.py`, `process3.py`/`process4.py` (earlier runs).
  Real-ESRGAN is at `~/realesrgan-ncnn` (used only for small sourced photos).
- Repo: `scripts/catalog-photo-replace.ts` (`npm run catalog:photo-replace`, replace/remove, one checked
  transaction), `scripts/catalog-photo-add.ts` (`npm run catalog:photo-add`, first photos). Settings only
  from `--env ~/Downloads/.platinum-photos.env --env ~/.pw-prod-db.env`; never print them. The owner added
  permission rules for both scripts' upload and write.

## 3. Applied to production so far (each one checked transaction, rollback saved)
Pass 1 (2026-10-19): 485 photos replaced + 90 rows removed (plan.csv). Pass 2 (2026-10-20): 248 photos
(13,603 rows), 495 (3,723), 1,393 (2,327), 327 (2,232), 171 (571), tires all-pass 646 (5,459); 36 first
photos added for products with none (`plan3.csv`). New files go under new content-hash keys; old files stay.

## 4. In flight when this session ended
`process10.py allwheels.txt latest3 fix14 <0..2> 3` running (3 processes; about 5 s a file; idempotent,
skips files already in `fix14`; restart the same command if the machine reboots). Check
`ls fix14 | wc -l` against 4,199.

## 5. What is left ("fix all unfixed")
1. **Wheels (4,199):** when `fix14` is complete, run the guard below, review a sample plus every file the
   guard flags near its limit, then apply the passing ones with a plan built the same way as `plan8.csv`.
2. **Other accessories:** `fix12` exists for all 528; the four types lug nuts, lug bolts, wheel locks, TPMS
   sensors (195 files) were reviewed and applied (batch 7, 171 photos; 12 keys were not in `latest2` and
   were skipped). Apply the rest through the guard and a sample review.
3. **Held tires (201, `held6.txt`) and the 50 rejected redone photos:** the strong isnet cut punches holes in
   tread close-ups and chews silver or chrome. Use `process11.py` (edit its input list), guard, review. If a
   photo cannot be made clean, the choice is a better source photo or removing it (neutral tile): ask the
   owner. Minnell SW08 (`tires_5d3d34864231fc95-1000`) is in this set and the owner has screenshotted it.
4. **Eight tire URLs** had no rows under the computed current URL in plan8 (`02977887ad2c3968`,
   `5e8f3af0b2eec0e0`, `e9632a251b271542`, `fe03f38f31b97bb3`, `0dc5645f94048056`, `ca503ffbb38987b3`,
   `5931f6f3cf89cb55`, `c6435395d94c56c6`) and 12 four-type accessories were not in `latest2`: check why.
5. **~390 products still have no photo** (Direct Auto Import accessories with no public photo anywhere;
   see `image-quality.md`). Direct Auto Import's robots.txt names AI crawlers: single targeted fetches only.
6. **Check the live storefront** (not done: the apex serves the old site; find the Vercel URL) at 390 and
   1440 for cards of every category. Cached listings refresh on the next deploy (D111).
7. **Before/after pages** (private artifacts) cover batches through plan5; republish for later batches.
   Pages: tires `claude.ai/artifact/DEitRw3MHrBxBGqH9kUAmf`, wheels/accessories
   `claude.ai/artifact/GsZx7HyLdMm1dSZiSRCBBa`, pass 1 `claude.ai/artifact/Mnid2MCjSbs4bMtuV2YpSx`.
   The 15.5 MB wheels page is near the 16 MB limit: split it further.

## 6. The automatic guard (use before every apply)
For each key compare the current image with the new one (alpha only):
- identical alpha (mean difference < 0.15) → skip;
- **interior holes**: removed pixels not connected to the outside of the original product, as a share of the
  product area, must be ≤ 0.3% (catches tread eaten, chewed chrome/silver, missing spokes);
- **logos**: removed saturated pixels (saturation > 0.5, L > 50) ≤ 0.1% (the sister-brand ZETA/PACE/ZMAX
  marks beside tires were deliberately kept, parked item 1 in `design/reports/image-clarity-parked.md`);
- remaining area ≥ 70%.
Never apply a tread close-up or a silver/chrome wheel on the strong cut alone. Look at a random 12 before
every write, at 300 px on `#0B0B0D`.

## 7. How a batch is applied (the recipe)
1. Pick keys; the **current URL** of a key is the `-1000.webp` URL whose name is the first 16 hex of the
   SHA-256 of the WebP last uploaded for it (look it up in the `out*-webp` folders in batch order; last
   batch wins), else the pass-1 new URL from `photo-report/quality-write/dry-run.csv`, else the old URL.
2. Convert the PNG to WebP quality 82 into a new `outN-webp`, write `planN.csv`
   (`action,old_url,new_file,slug,reason`).
3. Dry run: `npm run catalog:photo-replace -- planN.csv --env … --env … --out photo-report/<dir>`.
   Remove any plan row whose URL "no row holds" and re-run until `Problems: 0`.
4. `--upload --yes`, then `--write --yes` (one transaction, rolls back unless counts equal the dry run).
   Copy `rollback.csv` aside.
5. Record the batch in `design/reports/image-quality.md` and the D190 row in root `llm.md`.

## 8. Lessons
- `mkdir`/`rm` with an unquoted `$Q` breaks on the spaces in "Platinum Wheels Vendor Data": always quote.
- Contact-sheet reviewers miss edge dots, small shadows and pale wedges and over-accept; the guard and the
  owner's screenshots found most of what was wrong. Two reviewers' verdicts disagreed on identical files.
- The strong cut (isnet) is excellent for mounted tires and mounted wheels, and destroys rectangular tread
  close-ups and chrome hardware; the conservative `process11.py` keeps the product whole but leaves some
  shadow. A white-box photo with a chrome wheel (Azara, chrome) needs the strong cut.
- Subagents hit the session usage limit mid-run twice; resume them with SendMessage, check for the CSV first.
- `rembg` models download on first use (isnet 179 MB; birefnet-lite is slow, about a minute a file).

## 9. Wheel pass result (2026-10-20, evening): do NOT apply `fix14`
`fix14` (strong isnet cut of all 4,199 wheels) finished. `tools/guard.py` (outside the repo, in the quality
folder) passes 2,255 and flags 1,944 (mostly interior holes). Looked at by eye at card size on `#0B0B0D`:
- the **guard-ok** set is mostly wheels that were already clean (old and new indistinguishable), so applying
  it gains almost nothing and thins some rims;
- the guard **misses real damage**: in the 9 guard-ok wheels with the most pale material removed
  (`tools/flaw.py`, `flaw-wheels.csv`), the cut deleted spokes, rims and whole white faces (white, chrome and
  machined wheels, and white-on-black two-tone). The "holes" test cannot see this because the removed area
  counts as connected to the outside.
Nothing from `fix14` was written to production. Next for wheels: find wheels whose **current** photo really has a
flaw (white box, shadow, pale patch) from the current image alone, then use the gentle `process11.py` on those
only. Tires (201 held, 53 rejected) and the rest of the accessories are still open (§5).

## 10. Remaining items attempted (2026-10-20, night): nothing applied, state and options
- **Wheels:** `fix14` not applied (§9). A current-image edge-halo detector (`tools/halo.py`) over-flags machined and
  chrome rims and cannot separate real halos; wheels in `latest3` are mostly clean. Known real leftovers are rare
  (e.g. a pale ground shadow under an RTX wheel).
- **Tires, 201 held + rejects:** gentle cut `fix15` (`tools/process12.py`, list `out3/gentle-tires.txt`; one worker
  crashed on a 3-field list line, 15 items unprocessed). Guard passes 155 of 245 but by eye the gentle cut leaves
  a smaller white box on tread/box photos and bites ragged edges into close-ups; not applied.
- **Accessories, remaining 371:** `fix12` guarded (181 ok); the high-change ones bite ragged edges out of
  full-frame centre-cap photos (worse than live); not applied.
- **Not done:** live storefront check (browser pane refused the Vercel URL), the 8 tire URLs and 12 accessory keys.
- **Best next step:** these are photos that no cut can fix (white-box photos, tread close-ups, full-frame caps).
  They need a better source photo, or removal to the neutral tile. 427 products have no photo today
  (353 accessories, 57 wheels, 17 tires; 168 are unbranded).

## 11. Full live review and batch 9 (2026-10-20, night)
- All 5,561 live files were downloaded (`cur/`, from a read-only query of `product_images`) and scored; every one of the
  501 accessory photos and the 11 most-served wheel/tire sheets were looked at. Wheels and tires are in good shape
  live; accessories hold the real defects.
- **Applied (batch 9, rollback9.csv): 13 photos, 55 product rows**: chewed wheel locks and shadowed hardware re-cut
  from the Direct Auto Import original with `tools/ff2.py` (flood-fill from the border keeps chrome whole, bounded by
  a closed and filled rembg region so the soft shadow goes; Real-ESRGAN first when the original is under 700 px).
  This is the method to use for any white-background vendor photo that has a raw original.
- **Automatic cleaning is exhausted** for the rest: a current-image shadow remover is either inert or damages dark
  wheel faces and lug nuts (`tools/shadow.py`, not applied); `fix14`, `fix15`, `fix12` not applied (see §9, §10).
- **Not prod-worthy, listed in the 2026-10-20 report to the owner**: 5 wheel-weight pictogram photos (38 products),
  26 close-up screw/rivet/centre-cap photos (35), 8 leftover-shadow or chewed photos without a raw original
  (GT/Sentali caps, GT lug nuts, TESLA/Schrader TPMS, weight tape; 19), plus tires/wheels not yet eyeballed
  (about 4,600 files), the ~390 products with no photo, and Minnell SW08, Opals F9, Azara AZA-536 edge dots.

## 12. Batch 10 (2026-10-20)
The five wheel-weight pictogram photos (LH, T, E, P, REGC) were removed from their 38 products, so the neutral
tile shows (`plan10.csv`, `rollback10.csv`). The hybrid cut of §11 does not suit wheels (it fills the gaps between
spokes), so Azara, RTX and the other wheel cases still need the rembg route or better source photos. Minnell SW08
and Opals F9 need sourced photos. The 26 screw, rivet and centre-cap close-ups were left as they are.

## 13. Batch 11 (2026-10-20): Azara, and what could not be found
Azara AZA-536 gloss black and nano gold replaced (9 rows, `rollback11.csv`) with sourced 1000px retailer photos cut by
`tools/ff3.py <src> <out> 12 5 big` (hybrid flood-fill plus rembg region, all large white patches removed, no hole
fill): whole wheel, sharp, dark spoke gaps, no shadow. Still low-res on live: AZA-536 gloss black machined
(`235d17d86f151730`) and nano chrome (`54a58de105672d70`); no source photo for those finishes yet (carid.com returns 403
to fetches). Minnell SW08 and Opals SilverSnow F9: no usable photo found (onliner.by blocks direct downloads and its
public image is 240x192; whattyre.com has no tire photo).

## 14. Batches 12 to 15 and the agent review (2026-10-20, late)
Applied (each one checked transaction, `rollback12..15.csv`): owner's Opals and Minnell photos, Azara 536/540 studio
renders, Sailun smoothing (`tools/smooth.py`), the FAST shadow and three whole tread close-ups, then 23 photos from six
review agents (tire re-cuts, wheel shadow trims). The agents read sheets 8-308 (`scan/review-A..F.csv`, 124 tiles
flagged, 695 products); sheets 258-279 were NOT read (request limit), and agents read very fast, so treat the review as
partial. Not applied from that list: wheel/accessory "chunks" re-cuts (flood-fill refills spoke gaps white), chrome
lock/bolt hardware, GT/Sentali caps, the white wheels and steel wheels (66, 71, 75, 79, 83, 95, 103, 108), 7 'wrong'
accessory photos and 2 'wrong' tires (`review-all.json`). Still no photo: 391 products.

## 15. Batch 16 and sheets 258-279 (2026-10-20, late)
Batch 16: two blurry screw close-ups taken off 8 accessory products (`plan16.csv`, `rollback16.csv`). The weight icons were
already off. The `amp-225-45r17` tire carries a `gl ~/glcorp $ ship` image: likely the owner's test product, left alone.
Sheets 258-279: only 258, 262, 266, 270, 275 were read (about 4 of 90 photos defective: s262 tile 0 white HD wheel in a
white box, s262 tile 15 FAST wheel with a ground shadow, s266 tile 9 hollow white rim with a white interior). The other
17 sheets are unread.

## 16. Sheets 258-279 finished, and amp-225-45r17 hidden (2026-10-20)
All 22 sheets are now read. About 12 of ~400 photos were defective, each serving one product: ground shadows
(s259 #14, s261 #1, s262 #15, s264 #1, s267 #13, s271 #6, s279 #11), white-box white wheels (s262 #0, s279 #9),
a hollow white rim (s266 #9). The shadow trim (`fix124.shadow`) removed 0 pixels on them (shadow lighter and softer
than its rules), so nothing was applied; they need a manual cut or are accepted. `amp-225-45r17` (discontinued, two
uploaded `gl ~/glcorp` test images) was set to `hidden` in one checked transaction (not a photo change).

## 17. Batch 18 and what the last four groups came to (2026-10-20, night)
Batch 18 (`plan18b.csv`, `rollback18.csv`): 36 wheel photos / 136 products re-cut from the vendor original with the strong
cut (`process10.py` on `fixw.txt`), after rejecting results that lose >15% of the product (32 of 71 skipped: already
replaced, or worse). Hardware re-cut (`hw/`, `ff6.py`) NOT applied: center caps are crops of wheel photos, the cut leaves
ragged rims. Still open: white wheels in white boxes (s262 #0, s279 #9), a hollow white rim (s266 #9), FAST silver wheel
with chunks in the source (`wheels_...` tile 14 of `w0.png`), swirl wheels 56 and 61, ~25 center-cap/hardware photos
that need a real product photo, and 391 products with no photo (352 accessories, 26 wheels, 13 tires): the photos
do not exist in any vendor file we hold; Direct Auto Import has to supply them. Live check: platinum-wheels-one.vercel.app
serves the new files (Sailun, Minnell, Opals, Azara 536/540 pages return the new hashes, 1000px, visible).
