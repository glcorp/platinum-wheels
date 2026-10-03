/* ---------------------------------------------------------------------------
   Link-preview cards (D112). Server only: `sharp`, the file system, `next/og`.

   Owner, 2026-09-30: one branded dark card (logo and tagline) for the site, and
   the product's own photo on product pages. Then, on the format: the photo set
   on the brand's dark background at the standard 1200x630, with no text and no
   price, and a product with no photo falls back to the site card.

   **Why two renderers.**
   - The site card has text, so it goes through `ImageResponse` (`next/og`).
     That renderer draws PNG, JPEG and GIF and **silently draws nothing for a
     `.webp`** (measured 2026-09-30: a webp `<img>` leaves the background
     untouched, the same file as PNG draws). Every logo file is `.webp`, so the
     logo is converted to PNG with `sharp` first.
   - The product card has no text, so it is a plain `sharp` composite: the
     photo, whatever its format, fitted inside the card on the same ground. It
     is a JPEG because a photograph at this size is several times smaller that
     way and the card has no transparency to keep.

   Colours are the design tokens' hex values, written out because neither
   renderer reads CSS custom properties: `--bg`, `--text`, `--accent`
   (`src/app/globals.css` `:root`). Change them there and here together.

   **The font.** The tagline is set in the display role: Barlow Condensed 700,
   uppercase, the `display` utility's tracking. `next/og` reads `ttf`, `otf`
   and `woff` only, and `next/font` fetches `woff2` at build time, so the one
   weight the card needs is committed as a file, `fonts/BarlowCondensed-Bold.ttf`
   (SIL Open Font License 1.1, `fonts/OFL.txt`; from `google/fonts`,
   `ofl/barlowcondensed`; owner approved the download, 2026-09-30). It is read
   by this module only and never served to a browser.
   --------------------------------------------------------------------------- */

import { readFile } from "node:fs/promises";
import { join, sep } from "node:path";

import { ImageResponse } from "next/og";
import sharp from "sharp";

import { photosBaseUrl } from "@/features/catalog/photo-store";
import { PREVIEW_SIZE } from "@/features/seo/metadata";
import { SITE } from "@/lib/site";

const BG = "#0b0b0d"; // --bg
const INK = "#f4f4f5"; // --text
const ACCENT = "#c9f23a"; // --accent

const PUBLIC_DIR = join(process.cwd(), "public");

/** The transparent cut-out: the file the UI uses on the dark ground. */
const LOGO_FILE = join(
  PUBLIC_DIR,
  "images/logo/platinum-wheels-logo-transparent.webp",
);

const FONT_FILE = join(
  process.cwd(),
  "src/features/seo/fonts/BarlowCondensed-Bold.ttf",
);

/** 512x507 in the file; drawn at this height on the card. */
const LOGO_SIZE = { width: 222, height: 220 } as const;

/* Read and converted once per server instance: the logo does not depend on the
   request (`node_modules/next/dist/docs/01-app/03-api-reference/
   03-file-conventions/01-metadata/opengraph-image.md`, "Using Node.js runtime
   with local assets"). */
let logoDataUri: Promise<string> | undefined;

function loadLogo(): Promise<string> {
  logoDataUri ??= readFile(LOGO_FILE)
    .then((file) => sharp(file).png().toBuffer())
    .then((png) => `data:image/png;base64,${png.toString("base64")}`);
  return logoDataUri;
}

let displayFont: Promise<Buffer> | undefined;

function loadDisplayFont(): Promise<Buffer> {
  displayFont ??= readFile(FONT_FILE);
  return displayFont;
}

/**
 * The site card: the logo and the tagline on the brand's dark ground, flush
 * left like everything else in the design, with the one accent as a rule.
 */
export async function renderSiteCard(): Promise<ImageResponse> {
  const [logo, font] = await Promise.all([loadLogo(), loadDisplayFont()]);
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          padding: "0 96px",
          background: BG,
          color: INK,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- this JSX is
            drawn to a PNG by `next/og`; `next/image` does not exist there. */}
        <img src={logo} alt="" width={LOGO_SIZE.width} height={LOGO_SIZE.height} />
        <div
          style={{
            width: 96,
            height: 6,
            marginTop: 40,
            background: ACCENT,
          }}
        />
        <div
          style={{
            marginTop: 32,
            maxWidth: 1000,
            fontFamily: "Barlow Condensed",
            fontWeight: 700,
            fontSize: 84,
            lineHeight: 0.92,
            letterSpacing: "-0.015em",
            textTransform: "uppercase",
          }}
        >
          {SITE.tagline}
        </div>
      </div>
    ),
    {
      ...PREVIEW_SIZE,
      fonts: [
        { name: "Barlow Condensed", data: font, weight: 700, style: "normal" },
      ],
    },
  );
}

/** The photo's box inside the card: the full height less a margin, so a square
 *  cut-out sits centred with the dark ground on both sides. */
const PHOTO_BOX = { width: 1008, height: 534 } as const;


const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

/**
 * The bytes of a product photo, or `null` when it cannot be had.
 *
 * `src` is what the catalogue stores: a path from the site root
 * (`/images/products/x.webp`) or a full photo-bucket URL (its 1000px size).
 * Stored photos live in the R2 bucket served from `PHOTOS_BASE_URL` (D126b);
 * a URL under any other origin is never fetched. A root path is read from
 * `public/` on disk, which `next.config.ts` adds to this route's bundle
 * (`outputFileTracingIncludes`). Any other host, a path that climbs out of
 * `public/`, a slow or failed fetch and an oversized file all return `null`,
 * and the caller falls back to the site card.
 */
export async function loadProductPhoto(src: string): Promise<Buffer | null> {
  try {
    if (src.startsWith("/") && !src.startsWith("//")) {
      const file = join(PUBLIC_DIR, src);
      if (!file.startsWith(PUBLIC_DIR + sep)) return null;
      return await readFile(file);
    }

    const base = photosBaseUrl();
    if (!base || !src.startsWith(`${base}/`) || !src.startsWith("https://")) return null;
    const url = new URL(src);
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length > MAX_PHOTO_BYTES ? null : bytes;
  } catch {
    return null;
  }
}

/**
 * The product card: the photo, scaled to fit and never enlarged, centred on
 * the dark ground. No text and no price (owner, 2026-09-30). Throws on bytes
 * `sharp` cannot read; the caller treats that as no photo.
 */
export async function renderProductCard(photo: Buffer): Promise<Buffer> {
  const fitted = await sharp(photo)
    .rotate()
    .resize({
      ...PHOTO_BOX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer();

  return sharp({
    create: { ...PREVIEW_SIZE, channels: 3, background: BG },
  })
    .composite([{ input: fitted, gravity: "centre" }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}
