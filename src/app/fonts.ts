import { Barlow, Barlow_Condensed } from "next/font/google";

/**
 * Families and weights are taken from the artboard exports' Google Fonts link:
 * Barlow+Condensed:wght@600;700 and Barlow:wght@400;500;700.
 * (The same link also requests Michroma and Manrope — neither is referenced by any
 * `font-family` declaration in the markup, so they are export artefacts and are not ported.)
 *
 * Barlow Condensed ships 700 only (D91b, VPE-10). The export requests 600 too, but every
 * display-face element is 700 — the `display` utility and `font-display font-bold` — and no
 * `font-semibold` or 600 exists anywhere in `src/` (DEVIATIONS #2). Loading it cost a preloaded
 * woff2 that Firefox flagged as "preloaded … not used".
 *
 * Neither family is a variable font on Google Fonts, so explicit weight arrays are required.
 * Self-hosted by next/font per docs/decisions.md §6 — no runtime request to Google.
 */

export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
  adjustFontFallback: true,
  fallback: ["Oswald", "Arial Narrow", "sans-serif"],
  variable: "--font-display-face",
});

export const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  adjustFontFallback: true,
  fallback: ["IBM Plex Sans", "Helvetica", "sans-serif"],
  variable: "--font-body-face",
});
