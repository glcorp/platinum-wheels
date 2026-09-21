/**
 * Turns design/assets/*.png into shippable public/images/*.webp.
 *
 * Two jobs:
 *  1. Weight. The exports carry ~17.3MB of uncompressed PNG. The Lighthouse
 *     gate in docs/decisions.md §9 (LCP ≤2500ms on mobile) cannot be met with
 *     them, whatever next/image does at request time.
 *  2. Optical normalisation. DESIGN.md §4 Card: "All product cut-outs are
 *     normalised to one square canvas so every card renders the tire at the
 *     same optical size." They are not — the sources run from 470×439 to
 *     1776×1704. Each is trimmed to its content bounding box, scaled to a fixed
 *     fraction of a square canvas, and centred. That is what makes a grid of
 *     mixed-source cut-outs read as one set.
 *
 * Sources in design/ are never modified — they stay the frozen design export.
 *
 * Run: node scripts/prepare-assets.mjs
 * sharp is present as a Next.js dependency and declared in devDependencies.
 */

import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join, parse } from "node:path";
import sharp from "sharp";

const SRC = "design/assets";
const OUT = "public/images";

/** Product cut-outs: one square canvas, subject at a fixed fraction of it. */
const PRODUCT_CANVAS = 1000;
const PRODUCT_SUBJECT_RATIO = 0.88;

/** Photography: capped on the long edge; next/image handles the rest. */
const PHOTO_MAX = 1600;

/** Logo renders at 64px (nav) and 120px (footer); 512 covers 4x. */
const LOGO_MAX = 512;

const WEBP = { quality: 82, effort: 6 };

const report = [];

async function emit(label, src, dest, pipeline) {
  const before = (await stat(src)).size;
  const buf = await pipeline.webp(WEBP).toBuffer();
  await writeFile(dest, buf);
  const meta = await sharp(buf).metadata();
  report.push({
    label,
    file: parse(src).base,
    before,
    after: buf.length,
    out: `${meta.width}x${meta.height}`,
  });
}

async function products() {
  const dir = join(SRC, "products");
  await mkdir(join(OUT, "products"), { recursive: true });

  for (const f of (await readdir(dir)).filter((f) => f.endsWith(".png"))) {
    const src = join(dir, f);

    // Trim transparent margin so "optical size" means the tire, not the canvas.
    const trimmed = await sharp(src).trim().toBuffer({ resolveWithObject: true });
    const { width, height } = trimmed.info;
    const target = Math.round(PRODUCT_CANVAS * PRODUCT_SUBJECT_RATIO);
    const scale = target / Math.max(width, height);

    // Never upscale past the source's real detail — report it instead.
    const capped = Math.min(scale, 1);
    if (capped < scale) {
      report.push({
        label: "products",
        file: f,
        warn: `subject is only ${width}x${height} after trim; rendered at ${Math.round(
          Math.max(width, height) * capped,
        )}px on a ${PRODUCT_CANVAS}px canvas instead of ${target}px — it will read optically smaller than the rest of the set. Needs a higher-resolution source.`,
      });
    }

    const w = Math.round(width * capped);
    const h = Math.round(height * capped);

    await emit(
      "products",
      src,
      join(OUT, "products", `${parse(f).name}.webp`),
      sharp(trimmed.data)
        .resize(w, h, { fit: "inside" })
        .extend({
          top: Math.floor((PRODUCT_CANVAS - h) / 2),
          bottom: Math.ceil((PRODUCT_CANVAS - h) / 2),
          left: Math.floor((PRODUCT_CANVAS - w) / 2),
          right: Math.ceil((PRODUCT_CANVAS - w) / 2),
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        }),
    );
  }
}

async function scaled(folder, max) {
  const dir = join(SRC, folder);
  await mkdir(join(OUT, folder), { recursive: true });
  for (const f of (await readdir(dir)).filter((f) => f.endsWith(".png"))) {
    await emit(
      folder,
      join(dir, f),
      join(OUT, folder, `${parse(f).name}.webp`),
      sharp(join(dir, f)).resize(max, max, { fit: "inside", withoutEnlargement: true }),
    );
  }
}

await products();
await scaled("photos", PHOTO_MAX);
await scaled("logo", LOGO_MAX);

const mb = (n) => (n / 1048576).toFixed(2).padStart(6) + "MB";
let before = 0;
let after = 0;

for (const r of report) {
  if (r.warn) {
    console.log(`  !  ${r.file}\n     ${r.warn}`);
    continue;
  }
  before += r.before;
  after += r.after;
  const cut = (100 - (r.after / r.before) * 100).toFixed(1);
  console.log(
    `  ${r.label.padEnd(9)} ${r.file.padEnd(38)} ${mb(r.before)} -> ${mb(r.after)}  (-${cut}%)  ${r.out}`,
  );
}

console.log(
  `\n  total ${mb(before)} -> ${mb(after)}  (-${(100 - (after / before) * 100).toFixed(1)}%)`,
);
