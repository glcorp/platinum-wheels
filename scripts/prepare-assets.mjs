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

/**
 * Client product photography supplied AFTER the design export (D63).
 * `design/assets/**` is the frozen design export and is never added to
 * (library rule, D55), so later client assets land here instead and are
 * processed into the same `public/images/products/` output.
 */
const CLIENT_SRC = "client-assets";

/** Product cut-outs: one square canvas, subject at a fixed fraction of it. */
const PRODUCT_CANVAS = 1000;
const PRODUCT_SUBJECT_RATIO = 0.88;

/**
 * Background keying for client photos shot on white (D63).
 *
 * The design export's cut-outs already have transparent backgrounds; the
 * accessory photos the client supplied do not — they are products on white,
 * which would render as a bright tile on the card's near-black ground.
 *
 * A luminance threshold alone is wrong here: chrome highlights are as bright
 * as the background, so a global key punches holes through the lug nuts. This
 * instead FLOOD-FILLS from the image border, so only background CONNECTED to
 * the edge is removed and every interior highlight survives. Verified by
 * looking at the output on the card's own background, not by trusting the
 * percentages.
 *
 * 215 is the measured ceiling: at 200 the fill leaks through the chrome and
 * eats the centre cap's face; at 236 more of each drop shadow survives. The
 * soft grey shadow these products were photographed with is BELOW any
 * threshold that keeps the chrome, so it stays — a known artefact, recorded
 * in ASSET-CREDITS.md. Real transparent cut-outs remain the proper fix.
 */
const KEY_NEAR_WHITE = 215;

function keyBackground(data, width, height, channels) {
  const background = new Uint8Array(width * height);
  const stack = [];
  const isBackground = (i) => {
    const p = i * channels;
    return (
      data[p] >= KEY_NEAR_WHITE &&
      data[p + 1] >= KEY_NEAR_WHITE &&
      data[p + 2] >= KEY_NEAR_WHITE
    );
  };

  for (let x = 0; x < width; x++) {
    stack.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, y * width + width - 1);
  }

  while (stack.length > 0) {
    const i = stack.pop();
    if (background[i] === 1 || !isBackground(i)) continue;
    background[i] = 1;
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - width);
    if (y < height - 1) stack.push(i + width);
  }

  return background;
}

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

/**
 * Client accessory photography (D63) — `client-assets/accessories/*` into the
 * same `public/images/products/` output as the design export's cut-outs, so a
 * card resolves every category through one convention.
 *
 * Same square-canvas normalisation as `products()`, with one extra step in
 * front: these are shot on white, so `keyBackground()` removes the connected
 * background before the trim. Everything after that is identical, including
 * the refusal to upscale.
 */
async function clientProducts() {
  const dir = join(CLIENT_SRC, "accessories");
  await mkdir(join(OUT, "products"), { recursive: true });

  let files;
  try {
    files = await readdir(dir);
  } catch {
    return; /* No client assets on this machine; nothing to do. */
  }

  for (const f of files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f))) {
    const src = join(dir, f);

    /* Key the white background out, then hand a transparent RGBA buffer to
       the same trim/scale/centre path the design cut-outs take. */
    const { data, info } = await sharp(src)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const background = keyBackground(data, info.width, info.height, info.channels);
    for (let i = 0; i < info.width * info.height; i++) {
      if (background[i] === 1) data[i * info.channels + 3] = 0;
    }
    const keyed = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    })
      .png()
      .toBuffer();

    const trimmed = await sharp(keyed).trim().toBuffer({ resolveWithObject: true });
    const { width, height } = trimmed.info;
    const target = Math.round(PRODUCT_CANVAS * PRODUCT_SUBJECT_RATIO);
    const scale = target / Math.max(width, height);
    const capped = Math.min(scale, 1);

    if (capped < scale) {
      report.push({
        label: "client",
        file: f,
        warn: `subject is only ${width}x${height} after keying and trim; rendered at ${Math.round(
          Math.max(width, height) * capped,
        )}px on a ${PRODUCT_CANVAS}px canvas instead of ${target}px. Needs a higher-resolution source.`,
      });
    }

    const w = Math.round(width * capped);
    const h = Math.round(height * capped);

    await emit(
      "client",
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

/**
 * Photographs that REPLACE a same-named design-export photo (D94b): licensed
 * Unsplash JPEGs in `client-assets/photos/`, recorded in `design/ASSET-CREDITS.md`.
 * They run after `scaled("photos")` so they win, and the frozen PNGs in
 * `design/assets/photos/` stay untouched. `CROPS` pre-crops a landscape source
 * to a portrait box around its subject (`cx` = subject centre as a fraction of
 * the width) so `object-cover` in a narrow tile does not cut the subject.
 */
const CROPS = {
  "wheels-tile": { aspect: 3 / 4, cx: 0.49 },
  // The car sits low and left in the frame; 4:3 anchored to the bottom keeps it
  // inside both the promo's near-square panel and the contact card's wide crop.
  "winter-tacoma": { aspect: 4 / 3, cx: 0.33, bottom: true },
};
const REPLACEMENT_MAX = 2400;

async function replacementPhotos() {
  let files = [];
  try {
    files = (await readdir(join(CLIENT_SRC, "photos"))).filter((f) => f.endsWith(".jpg"));
  } catch {
    return;
  }
  for (const f of files) {
    const name = parse(f).name;
    const src = join(CLIENT_SRC, "photos", f);
    let img = sharp(src);
    const crop = CROPS[name];
    if (crop) {
      const { width, height } = await sharp(src).metadata();
      const w = Math.min(width, Math.round(height * crop.aspect));
      const h = Math.round(w / crop.aspect);
      const left = Math.min(width - w, Math.max(0, Math.round(width * crop.cx - w / 2)));
      img = img.extract({ left, top: crop.bottom ? height - h : 0, width: w, height: h });
    }
    await emit(
      "photos",
      src,
      join(OUT, "photos", `${name}.webp`),
      img.resize(REPLACEMENT_MAX, REPLACEMENT_MAX, { fit: "inside", withoutEnlargement: true }),
    );
  }
}

await products();
await clientProducts();
await scaled("photos", PHOTO_MAX);
await replacementPhotos();
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
