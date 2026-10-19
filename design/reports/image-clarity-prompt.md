# Prompt: every product photo high quality, clean background, and correct (pre-handover pass)

Paste everything below the line into a new Claude Code session opened in `~/platinum-wheels`, with the model set to Sonnet (`/model claude-sonnet-5-5`).
Written 2026-10-15 and revised 2026-10-19. The owner answered every question up front, so the session
should not need to stop.

---

You are the **coordinator** (run this session on **Sonnet**, `claude-sonnet-5-5`) for a long autonomous session on Platinum Wheels. The site is about to be
handed to the client, and **the client specifically asked for this**.

**The goal.** By the end of the session, every product photo on the storefront must be:
1. **High quality:** sharp at product-page size, with no visible blur, jagged edges, compression blocks
   or AI artefacts.
2. **Clean background:** **no white box or white background** around the product, and **no background
   spill**: no white or grey halo, fringe or edge, no leftover patches, no shadows cut off at the edge of
   the frame. The product has to sit cleanly on the site's dark theme.
3. **Correct:** it shows the product it is listed under, meaning the right brand, model, finish or
   colour, and design.
4. **In a web format** (WebP, as today).

Photos that already meet all four points are **left alone**. Spend the effort only on the ones that fail.

## 0. Before anything

1. Read `CLAUDE.md`, `AGENTS.md`, root `llm.md` (sections 1 and 4, and decisions D19, D63, D90b, D117,
   D126b, D139b, D145, D150, D153), `HANDOFF.md`, `scripts/llm.md`, `src/features/catalog/llm.md`,
   `src/db/llm.md`, and the files `src/features/catalog/photo-files.ts`, `photo-sizes.ts`, `photo-store.ts`
   and `scripts/catalog-photos.ts`.
2. Read memory `coordinator-working-style` and follow it.
3. Branch `image-quality` from `main`. Take the next free decision ID (D190 unless someone has taken it).

## 1. The owner's rulings, already made, do not ask again

| Topic | Ruling |
|---|---|
| Scope | **Vendor product photos only**, meaning the catalogue photos in R2 that `product_images` points at. Leave site photos, logos, brand SVGs and favicons alone. Photos under `products/<uuid>/` were uploaded by staff: check them, but only **list** their problems. |
| Replacing | **You may replace any photo that fails**, whether it is blurry, sits on a white background, has a dirty cut-out or is wrong. Sources, best first: (1) our vendors, (2) the brand's official website, (3) **anywhere else on the web** that shows the exact same product clearly (retailers included), as long as there is no watermark. Record the source URL of every replacement. The owner says we may reuse vendor photos (D153). |
| Small originals | If no bigger real photo exists, enlarge with a local AI upscaler (Real-ESRGAN, the official `realesrgan-ncnn-vulkan` macOS release from github.com/xinntao/Real-ESRGAN) in place of today's Lanczos resize. You may download it. Put it in its own folder outside the repo and never commit it. |
| Backgrounds | Remove white and studio backgrounds with a proper local cut-out model (for example `rembg` with a BiRefNet or ISNet model, installed in its own virtualenv outside the repo). Do **not** use a brightness threshold: it punches holes in chrome and leaves halos (the lesson of D63). Clean up the edges after the cut so no light fringe is left. |
| Vendor access | The owner is **signed in to Auto Country and Vertex in their Chrome**. Use Claude in Chrome (`mcp__claude-in-chrome__*`, in a new tab) for those two portals. **Wheel Works is not signed in: skip its portal** and use only its files already on disk. DAI and PRO WHEELS (dealerwheels.ca, prowheels.ca) are public. Never type a password, never solve a CAPTCHA, never evade bot protection, keep a polite rate (about 1 request a second per site). DAI's robots.txt names AI crawlers, so make targeted fetches only, never a crawl. |
| Wrong photos | **Fix them and list them**: put in the right photo, or, if none can be found, delete that `product_images` row so the no-photo tile shows. Exception: GT Invasion Matte Black showing the Satin Black photo is the owner's choice (D150). Keep it. |
| No photo at all | **In scope.** The ~359 products that show the no-photo tile today (count them from production: published or discontinued products with no `product_images` row) get a photo if one can be found. Use the same sources, the same match rule and the same four-point bar as a replacement. A product whose exact item cannot be found, in its own model, finish or colour and design, keeps the tile: **never use a look-alike or a generic photo**. List each such product with what was tried. |
| Production | **Write it, with checks.** After a dry run, upload the new files to R2 and repoint the affected `product_images` rows in **one checked transaction**. Keep the old files in the bucket so the change can be rolled back. Then report. |
| Credentials | `~/Downloads/.platinum-photos.env` (the R2 settings) and `~/.pw-prod-db.env` (`IMPORT_DATABASE_URL`) are current. Read secrets **only from those files**, the way `catalog-photos.ts --env` does. Never print a secret, never put one on a command line, never write one into the repo. |
| Review | A **private before/after Artifact page** for every changed photo, plus **a PR** containing the script(s), the report and the `llm.md` updates. Do not merge it. |
| Parked questions | Anything that needs the owner goes into `design/reports/image-quality-parked.md` with your recommendation. **Do not wait**: take the recommended path, or skip that item, and carry on. |

## 2. What is true today (verify each fact; do not trust it blindly)

- **Production photos.** Each `product_images.url` names the 1000px file
  (`https://photos.platinumwheels.ca/catalog/<category>/<hash>-1000.webp`). The 480px card file sits beside it
  as `-480` (`photoSized()`). **One file is shared by many products**: about 5,600 files serve about 40,000
  rows, and one file can serve up to 545 products. So **audit and fix per file**. Then fix individual rows
  only where the file is right for some products and wrong for others.
- **Cache.** Files are `immutable` and cached for a year. **Never overwrite an existing key.** A new image
  gets a new content-hash key (`-1000` and `-480`), and then the rows are repointed.
- **Why photos are soft.** D90b enlarged every vendor photo smaller than 880px onto the 1000×1000 canvas
  with Lanczos. DAI originals are about 600px and most PRO WHEELS originals about 500px.
- **Originals on disk.** `~/Platinum Wheels Vendor Data/Individual Vendors/<vendor>/images/` has
  `original/`, `web/` (upscaled) and `web_native/` (never enlarged) for all five vendors. `_download.csv`
  and `downloads.csv` record the source URLs. The hand-off that was loaded is
  `combined/photos-for-cloudflare/` (`product-images.csv`: slug, vendor, vendor_sku, file
  `images/<cat>/<16 hex>.webp`). Work out how a hand-off hash traces back to its original and its source
  URL, and write that mapping down.
- **The house style.** Measure the canvas from current good files and the storefront CSS, and match it:
  the canvas size, how much of the canvas the product fills, where the product sits, and **whether
  transparency or a dark fill is expected**. Look at how the card and the product page draw the photo
  (`src/features/catalog/components/`, `src/features/product/components/pdp-gallery*.tsx`). Every
  output must follow one rule, so the grid looks even. Use WebP quality 82 (`photo-sizes.ts`), and make
  the card size with `makePhotoSize()`.
- **Placeholder.** `PLACEHOLDER_SHA256` in `catalog-photos.ts` already lists the vendor's "Image not
  available" graphic. Never bring it back.

## 3. Plan

**Phase A: audit every live file (no writes).** Read every distinct photo URL and its product count from
production (`SELECT url, count(*) … GROUP BY url`, read-only). For each file, score and flag:
- **Quality:** the original's pixel size, the product's bounding box, the enlargement factor, and a
  sharpness score (for example the variance of the Laplacian, compared within each vendor).
- **Background:** an opaque white or light background; partial transparency; a light fringe (sample the
  pixels just inside the alpha edge and compare their brightness with the product's interior); stray
  opaque islands away from the product; a product touching or cut off at the canvas edge. **Composite
  every file over the site's `--bg` (`#0B0B0D`)** and check it on that ground, because a fringe that is
  invisible on white is obvious on the dark theme.
- **Other defects:** watermark or text overlay, placeholder, heavy compression, a lifestyle photo instead
  of the product, several products in one shot.
- **Correctness (quick check):** compare the file with its products' brand, model, finish and type.
  Flag a file shared across different brands or models, a tire on a wheel listing (or the reverse), a
  finish word that disagrees with the visible colour, and a brand logo on the product that disagrees with
  the listing. Agents **look at** every flagged file and a random sample of the rest (at least 300 across
  vendors) to confirm.

Set the thresholds from the data, then have agents look at files on both sides of each line, and adjust
until the numbers agree with the eye. Write `photo-quality-audit.csv` (in the scratchpad) and put the
counts per defect in the report. Rank the work by products served, so the biggest wins land first.

Also list every product that has no photo (brand, model, size, finish, vendor, vendor SKU, part number) in
`no-photo.csv`. Phase B works on these too.

**Phase B: find better sources** for every file that fails, and a first photo for every product in
`no-photo.csv`. Try, in order: a larger copy at the vendor
URL (CDNs often take a size parameter, and product pages often link a zoom image); the Auto Country or
Vertex portal through Chrome; the brand's official site; then other websites. Accept a source only when it
shows **the same product** (model, finish or colour, spoke design; for a tire, the tread), is clearly
better, and has no watermark. Confirm the match by eye against the current photo and the listing.

**Phase C: process.** For each file: take the best source, cut out the background with the cut-out model,
clean the edges, upscale with Real-ESRGAN only if the source is still too small, then fit the result to
the house canvas. Then **look at every result composited on `#0B0B0D`, next to the old file**. Reject it
if you see a halo, a hole in chrome or glass, a missing valve stem or spoke tip, garbled sidewall
lettering or logos from the upscaler, or a product that is cropped or shifted. Run a final automatic check
on each output: correct size, a valid WebP, the fringe score and the sharpness score past their lines. If
nothing can pass, keep the best result you have and list it.

**Phase D: write production** (only you, the coordinator, do this).
1. Upload the new `-1000` and `-480` files to R2 under new content-hash keys, using the repo's R2 code
   (extend `catalog-photos.ts` with a replace mode, or write a TypeScript sibling script in `scripts/`,
   with settings from `--env` only). Never overwrite or delete an existing key. Fetch a sample of the
   public URLs to prove they serve.
2. Dry run, then run **one transaction**: `UPDATE product_images SET url = new WHERE url = old` per file,
   the per-row fixes for products that share a file, the deletions for wrong photos (then renumber
   the remaining photos to 0..n-1), and an `INSERT` of a `sort_order 0` row for each product that had no
   photo. Re-check inside the transaction that the product still has none, so a photo staff added since
   the audit is never pushed aside. Alt text is brand + name, as the loader writes it. Before COMMIT, check that the counts equal the dry run exactly; if they
   do not, roll back. Leave `products.updated_at` alone (D139b).
3. Save `rollback.csv` (row id, old url, new url, deleted rows) with the report.
4. Check the live site in the built-in browser: cards on `/tires`, `/wheels` and `/accessories`, and at
   least 15 product pages across the categories, at 390 and 1440 wide. Look for white boxes, halos, blur
   and wrong products, and confirm there is no layout change. A cached listing that still shows an old
   photo refreshes on the next deploy (D111): note it.

**Phase E: hand over.**
- `design/reports/image-quality.md`: the method, the thresholds and why, the counts per defect before and
  after, what was replaced (and from which source), cut out, upscaled, removed, or left, with the reason
  for each, the number of products affected, the no-photo products filled and those still without a photo (with
  what was tried), and the staff photos that have problems.
- A private before/after Artifact page (load `artifact-design` first). It shows each pair **on the dark
  site background**, grouped by category, and can be filtered by vendor and by defect.
- Update `scripts/llm.md`, `src/features/catalog/llm.md` and root `llm.md` §5b with the new decision
  row (owner rulings quoted from section 1, dated 2026-10-19). It amends D90b: photos are now cut out,
  re-sourced or AI-upscaled, not Lanczos only. Add `todo.md` items only for actions that only the owner
  can take.
- Run `npm run check` and `next build` (one build at a time). Open the PR to `main`, then bind it with
  the ccd_pr tools.

## 4. How to run the agents

- **Sonnet for everything** (owner, 2026-10-19): this session runs on Sonnet, and every subagent is started with `model: "sonnet"`. No Opus anywhere. At most **10 at once**, and at most 4
  of them heavy (browser, cut-out model or upscaler). Give workers disjoint sets of files (by vendor,
  category or hash range).
- **Claude in Chrome is one shared browser**, so only one agent may drive it at a time. The built-in
  browser is for checking pages.
- Workers never touch production: no DB writes, no R2 uploads, and no reading the env files.
- Never `pkill` or `kill` a process you did not start. The machine has 8 CPUs and 8 GB shared with other
  sessions, so run the models with limited parallelism and watch memory.
- Scratch work goes in the session scratchpad or in
  `~/Platinum Wheels Vendor Data/combined/quality-2026-10/`, never in the repo. Every download goes in its
  own folder, and nothing is executed from inside a download folder except the tools you fetched on
  purpose.
- Keep the task list current, and send the owner the Artifact link when it is published.

## 5. Done means

Every live product photo either passes all four points (high quality, clean background, correct, WebP)
or is listed in the report with the reason it could not. Every product that had no photo now has a
correct one, or is listed with what was tried. Production rows point at the new files in one
committed transaction, with a rollback file saved. Live pages are checked on the dark theme. The report,
the before/after page and the PR exist, and the parked file holds anything left for the owner.
