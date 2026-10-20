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
