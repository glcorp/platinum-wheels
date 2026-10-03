/* ---------------------------------------------------------------------------
   The home brand ticker's logos (D129). Data only.

   Each file in `public/images/brands/` is the brand's own artwork flattened to
   one colour and cropped to its painted bounds; sources and dates are in
   `design/ASSET-CREDITS.md`. The strip paints them through a CSS mask, so the
   colour is always a token and no brand colour reaches the page.

   `aspect` is the file's viewBox width / height. It sets the logo box width so
   the mask never letterboxes; re-measure it if a file is replaced.

   `scale` is optical sizing against the strip's base height: a wide wordmark
   at full height would outweigh a compact emblem several times over, so each
   starts at sqrt(5 / aspect), clamped to 0.62–1.2, and was then tuned by eye on
   rendered strips (heavy blocks such as Pirelli and TSW down, thin marks such
   as Continental, Yokohama and Nexen up).

   Order: Michelin leads; tire and wheel brands alternate so no two wheel brands
   meet, and the lightest marks (American Racing, Continental, Yokohama, Nexen)
   are spread out, including across the loop's seam (Nexen → Michelin).

   Every brand here is carried by the loaded catalogue. `BRANDS` in
   `src/lib/site.ts` is a different list (the /about page's wordmarks) and is
   not read here.
   --------------------------------------------------------------------------- */

export type BrandLogo = {
  /** Accessible name and the brand as customers say it. */
  name: string;
  /** File under `public/images/brands/`, without extension. */
  slug: string;
  aspect: number;
  scale: number;
};

export const BRAND_LOGOS: readonly BrandLogo[] = [
  { name: "Michelin", slug: "michelin", aspect: 10.114, scale: 0.7 },
  { name: "Fuel Off-Road", slug: "fuel", aspect: 5.888, scale: 0.92 },
  { name: "Bridgestone", slug: "bridgestone", aspect: 8.105, scale: 0.78 },
  { name: "KMC", slug: "kmc", aspect: 2.747, scale: 1 },
  { name: "Pirelli", slug: "pirelli", aspect: 4.7, scale: 0.9 },
  { name: "American Racing", slug: "american-racing", aspect: 3.102, scale: 1.2 },
  { name: "Goodyear", slug: "goodyear", aspect: 5.82, scale: 0.93 },
  { name: "Rotiform", slug: "rotiform", aspect: 3.556, scale: 1.05 },
  { name: "Continental", slug: "continental", aspect: 5.503, scale: 1 },
  { name: "Black Rhino", slug: "black-rhino", aspect: 9.243, scale: 0.8 },
  { name: "Toyo Tires", slug: "toyo-tires", aspect: 9.495, scale: 0.7 },
  { name: "Motegi Racing", slug: "motegi", aspect: 10.197, scale: 0.7 },
  { name: "Yokohama", slug: "yokohama", aspect: 7.02, scale: 0.9 },
  { name: "Moto Metal", slug: "moto-metal", aspect: 2.594, scale: 1.1 },
  { name: "Nitto", slug: "nitto", aspect: 11.625, scale: 0.66 },
  { name: "TSW", slug: "tsw", aspect: 4.647, scale: 0.92 },
  { name: "Falken", slug: "falken", aspect: 9.079, scale: 0.68 },
  { name: "General Tire", slug: "general-tire", aspect: 7.767, scale: 0.85 },
  { name: "Nexen", slug: "nexen", aspect: 2.515, scale: 1.2 },
];
