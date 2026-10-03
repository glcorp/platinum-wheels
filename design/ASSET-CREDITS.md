# Asset credits and provenance

Every image that did not come from the client, with its source and licence. Keep this current — it is the
record that the site has the right to use what it ships.

## In use

| File | Source | Photographer | Licence | Notes |
|---|---|---|---|---|
| `public/images/photos/hero-tread.webp` | [Unsplash `CTwQiFlpgrM`](https://unsplash.com/photos/close-up-of-a-rugged-tire-tread-CTwQiFlpgrM) | Rob Wingate | Unsplash Licence — free for commercial use, no attribution required | Tread macro, single hard light, dark ground. Replaces the artboard's hotlinked Vossen/Ferrari photo (DEVIATIONS #1). Source 3000×2000; shipped 2400×1600 webp, 479.6KB, which `next/image` serves as **13.0KB at 390px** and 34.1KB at 750px. |
| `public/images/photos/tires-tile.webp` | [Unsplash `VPf3IiYf73Q`](https://unsplash.com/photos/VPf3IiYf73Q) | Samuel Jerónimo (@samueljeronimo) | Unsplash Licence, free for commercial use, no attribution required | A stack of whole tyres in a dark room, one shaft of light; neutral, no legible marks. Source 4896×3264; shipped 2400px webp. Replaces the first pick (a tread macro, `tLEUi4OaQmQ`), which the owner found too zoomed in (D94b). |
| `public/images/photos/wheels-tile.webp` | [Unsplash `7IrHGsLzy4U`](https://unsplash.com/photos/7IrHGsLzy4U) | Baptiste Régnier (@baptiste_rgnr) | Unsplash Licence, free for commercial use, no attribution required | Mesh alloy wheel, warm-neutral light, no legible marks (centre cap magnified 2.2×: none). Source 5568×3712, cropped 3:4 around the wheel. Replaces the client tile photo (D94b). |
| `public/images/photos/accessories.webp` | [Unsplash `M0jAFamB1-4`](https://unsplash.com/photos/M0jAFamB1-4) | Brendan Hollis (@brendanhollis) | Unsplash Licence, free for commercial use, no attribution required | Hands fitting a valve-core tool on a tyre; neutral grey, no legible marks. Source 5760×3840; shipped 2400px webp. Replaces the first pick (a black wheel close-up, `h8ojNoTn4K4`), which the owner said did not read as accessories (D94b). |
| `public/images/photos/winter-tacoma.webp` | [Unsplash `2c_PrpIPjMk`](https://unsplash.com/photos/2c_PrpIPjMk) | Anne Nygård (@polarmermaid) | Unsplash Licence, free for commercial use, no attribution required | Car on a snowy forest road, no legible marks. Source 5184×3456. Replaces the client winter photo used by the promo and the contact card (D94b). The filename keeps its old slug (`tacoma`) because two components import it; it no longer shows a Tacoma. |

### Why this one

Checked against DESIGN.md §1/§7 and `docs/decisions.md` §8, and **verified by inspection, not by the
stock site's description**:

- **Art direction** — §7's "Do" list names "tread macros" literally: one object under a single hard light
  on a dark ground, photography as sculpture.
- **Colour** — measured mean RGB 56.2 / 58.0 / 58.4, i.e. blue-minus-red of **2.2**: neutral. A tinted
  photo would introduce a second hue on a near-black ground and compete with the lime accent (§7 "Don't").
  Note the stock page described this image as having "dramatic blue-tinted moody lighting" — it does not.
- **No legible brand marks** — there is embossed sidewall text at lower-left. Magnified and brightened
  2.2×, it remains illegible; at hero scale and normal exposure it is invisible.
- **Geometry** — 3000×2000 landscape, so it crops to the desktop hero (1440×900) without upscaling, and
  `object-fit: cover` handles the mobile 390×720 crop per DESIGN.md §8.

## Rejected — do not reuse

_D94b, 2026-09-30, looked at and refused under rule 3 (legible marks) or rule 4 (second hue): Unsplash `ErrKR5f9jEw` (Maserati trident on the hub, caliper script), `TXsIul1J00k` (BFGoodrich sidewall and Method wheel wordmark), `dkhJYd4yQ0M` (the centre cap reads `rotiform` at 2.2× brightness), `4_L_ARvv4kU` (FORD on the cap), `GfJjF3cM4aI` (BBS cap), `HxpfckKgZ0g` (red caliper), `V7a5lkzHurk` (purple cast), `Y_251QYX55Y` (Toyota crest and Bridgestone sidewall), `VLaOo1kvUyY` (glove brand printed on the cuffs), `UlMjKg7ua78` (sidewall lettering, orange forklift)._

| Candidate | Why rejected |
|---|---|
| [Unsplash `l9riyueOA2k`](https://unsplash.com/photos/close-up-of-a-red-cars-black-alloy-wheel-l9riyueOA2k) — "close-up of a red car's black alloy wheel" | **Three legible brand marks**: `PIRELLI` on the tyre sidewall, `PORSCHE` on the brake caliper, and the Porsche crest on the centre cap. Breaks DESIGN.md §7 and `docs/decisions.md` §8, and putting Porsche marks on a third-party retailer's hero implies an association the shop does not have — a trademark problem, not a styling one. Separately, the red bodywork fills roughly the top third and right side, which fights the lime accent. The stock page described it as showing "only a minimal sliver of the red car body" and did not mention any logos; **that description was wrong**, which is why every candidate gets looked at before it is used. |
| Artboard hero — `vossenwheels.com/.../Vossen-Forged-GEN-01-Aerolip-Ferrari-F40-LM-…jpg` | Third-party copyrighted product photography, hotlinked from a competitor's CDN. Never shippable. This is the thing being replaced. |

## Client-supplied

| Files | Notes |
|---|---|
| `client-assets/accessories/*` → `public/images/products/{bosch-tpms,gorilla-lug-nuts-acorn,gorilla-lug-nuts-spike,gorilla-wheel-locks,sentali-centre-cap}.webp` | **Five accessory product shots, supplied by the owner 2026-09-21 (D63).** They are the first client assets to arrive *after* the design export, so they live in `client-assets/` rather than `design/assets/`, which is the frozen export and is never added to (D55). Processed by `scripts/prepare-assets.mjs` → `clientProducts()` into the same 1000px square canvas as every other cut-out. Three things to know, all verified by looking at the output on the card's own background: (1) they were shot on **white**, not transparent, so the background is removed by a border flood-fill rather than a luminance threshold — a global threshold punches holes through the chrome, because chrome highlights are as bright as the background; (2) the fill threshold is **215**, measured: at 200 it leaks through the chrome and eats the centre cap's face, at 236 more of each drop shadow survives; (3) **the soft grey drop shadows remain**, because they sit below any threshold that keeps the chrome. Real transparent cut-outs are still the proper fix. (4) The Bosch and Sentali marks are legible in two of the five. That is fine for genuine product photography of goods the shop sells, and is a different case from rule 3 below, which is about incidental brand marks in stock photography — but **nobody has confirmed the shop stocks either brand** (`HANDOFF.md` §7). |
| `public/images/logo/*` | From `design/assets/logo/`. The transparent cut-out is the working file; the white-plate original is print/invoice only (DESIGN.md §0). |
| `design/assets/photos/{accessories,tires-tile,wheels-tile,winter-tacoma}.png` | The original client photos. **No longer shipped** (D94b): the four `public/images/photos/` files of the same name are the Unsplash replacements listed under *In use*. The PNGs stay as frozen export. |
| `public/images/products/*.webp` | From `design/assets/products/`, trimmed and normalised to one 1000px square canvas. **Two are too low-resolution** — see `design/DEVIATIONS.md`, bottom section. |

## Brand logos (D129)

The home brand ticker shows nineteen tire and wheel brands carried by the loaded catalogue, as their
real logos. **Permission is the owner's statement**, 2026-10-03, verbatim: *"for the brands now we have
the data ingested so look for the major players who are famous so for them get the actual brand logo and
add it there we have permission to add brand logos so you can get those from the internet and add those
like it should look premium"*. The owner then chose "Famous tire + wheel brands", shown in one muted
colour, brightening on hover. This replaces D63's refusal of logos, which rested on there being no such
permission; the licence itself is not on file here, so whoever holds it should be able to produce it.

Every file is the brand's own vector artwork, fetched 2026-10-03, never redrawn. Each was processed the
same way (scratchpad script, not committed): editor metadata, comments, titles, unused ids and styles
stripped; every visible fill flattened to one colour (`#000`; the site paints it a token through a CSS
mask, so the file's colour never shows); viewBox cropped to the painted bounds, measured by rasterising.
No scripts, no embedded rasters, no external references. Each was rendered in one colour on `--surface-2`
and looked at before use.

| File (`public/images/brands/`) | Brand | Source | Notes |
|---|---|---|---|
| `michelin.svg` | Michelin | [Commons `Michelin_Wordmark.svg`](https://commons.wikimedia.org/wiki/File:Michelin_Wordmark.svg) | **Wordmark only.** Michelin's own full lockup (michelin.ca sprite) adds Bibendum and a yellow rule; Bibendum is a white figure drawn with dark outlines and becomes an unreadable blob in one colour. |
| `bridgestone.svg` | Bridgestone | [Commons `Bridgestone_logo.svg`](https://commons.wikimedia.org/wiki/File:Bridgestone_logo.svg) | The red B-mark and the wordmark merge into one ink, as Bridgestone's own one-colour use does. |
| `continental.svg` | Continental | [Commons `Continental_logo.svg`](https://commons.wikimedia.org/wiki/File:Continental_logo.svg) | Already one colour (`currentColor`), wordmark plus horse. |
| `goodyear.svg` | Goodyear | [en.wikipedia `Goodyear_Logo_2025.svg`](https://en.wikipedia.org/wiki/File:Goodyear_Logo_2025.svg) | One colour in the source (yellow). goodyear.ca serves its logo through an HTML wrapper, not a file. |
| `pirelli.svg` | Pirelli | [Commons `Pirelli_-_logo_black_(Italy,_1970).svg`](https://commons.wikimedia.org/wiki/File:Pirelli_-_logo_black_(Italy,_1970).svg) | **The one-colour (black) variant** of the long-P wordmark; its letterforms are identical to the current red-on-yellow version (`Pirelli - logo full (Italy, 1997).svg`), compared by rendering both. |
| `yokohama.svg` | Yokohama | [Commons `Yokohama_(Unternehmen)_logo.svg`](https://commons.wikimedia.org/wiki/File:Yokohama_(Unternehmen)_logo.svg) | Chevron mark plus wordmark. |
| `toyo-tires.svg` | Toyo Tires | [Commons `Toyo_Tire_logo.svg`](https://commons.wikimedia.org/wiki/File:Toyo_Tire_logo.svg) | |
| `nitto.svg` | Nitto | [nittotire.com header logo](https://www.nittotire.com/media/ij3l5cph/header-nitto-logo.svg) | Brand's own site. |
| `falken.svg` | Falken | [Commons `Falken_Tire_logo.svg`](https://commons.wikimedia.org/wiki/File:Falken_Tire_logo.svg) | Blue wordmark and red accent merge into one ink. |
| `general-tire.svg` | General Tire | [Commons `General_Tire_logo.svg`](https://commons.wikimedia.org/wiki/File:General_Tire_logo.svg) | **Knockout.** The shield's white `GT` sits on red; flattened naively it would vanish into a solid shield, so the white shapes are cut out of the ink (an SVG mask inside the file), which is how the mark reads in one colour. Looked at magnified: the `GT` reads. |
| `nexen.svg` | Nexen | [en.wikipedia `Nexen_Tire_logo.svg`](https://en.wikipedia.org/wiki/File:Nexen_Tire_logo.svg) | Stacked emblem + `NEXEN TIRE`; the emblem's lines are holes in the source, so it survives one colour. The brand's sites offered no SVG. |
| `fuel.svg` | Fuel Off-Road | [fueloffroad.com header logo](https://www.fueloffroad.com/static/version1790065637/frontend/WheelProsNew/fueloffroad/en_US/images/logo/logo.svg) | Brand's own site. The orange emblem's `F` is a hole in the source. |
| `kmc.svg` | KMC | [kmcwheels.com header logo](https://www.kmcwheels.com/static/version1790065637/frontend/WheelProsNew/kmc/en_US/images/logo/logo.svg) | |
| `american-racing.svg` | American Racing | [americanracing.com header logo](https://www.americanracing.com/static/version1790065637/frontend/WheelProsNew/americanracing/en_US/images/logo/logo.svg) | **Wordmark only.** The site's file is a lockup of a dated "70 / 1956–2026" anniversary badge, a divider and the wordmark; the badge and divider (the first 13 shapes) are removed, the wordmark is untouched. |
| `rotiform.svg` | Rotiform | [rotiform.com header logo](https://www.rotiform.com/static/version1790065637/frontend/WheelProsNew/rotiform/en_US/images/logo/logo.svg) | |
| `black-rhino.svg` | Black Rhino | [blackrhinowheels.com header logo](https://www.blackrhinowheels.com/static/version1790065637/frontend/WheelProsNew/blackrhino/en_US/images/logo/logo.svg) | |
| `motegi.svg` | Motegi Racing | [motegiwheels.com header logo](https://www.motegiwheels.com/static/version1790065637/frontend/WheelProsNew/motegi/en_US/images/logo/logo.svg) | (Commons' `Motegi logo.svg` is the Japanese race track, not this brand.) |
| `moto-metal.svg` | Moto Metal | [motometal.com header logo](https://www.motometal.com/static/version1790065637/frontend/WheelProsNew/motometal/en_US/images/logo/logo.svg) | |
| `tsw.svg` | TSW | [tsw.com header logo](https://www.tsw.com/static/version1790065637/frontend/WheelProsNew/tsw/en_US/images/logo/logo.svg) | (Commons' `TSW Emblem.svg` is unrelated.) |

The Wheel Pros sites' `images/logo.svg` (one level up) is the Wheel Pros group mark on every site and
`images/logo/logo-white.svg` is another brand's artwork (`SPRIG`); neither is used. The `version…`
segment in those URLs changes when the sites redeploy.

## Rules for adding an image

1. Licence must permit commercial use. Record it here before the file lands in `public/`.
2. **Look at it.** Do not trust a stock site's caption — two of the three candidates above were described
   inaccurately in ways that would have shipped a defect.
3. No legible tyre, wheel or vehicle brand marks. Magnify and brighten to check; embossed text that is
   illegible at 2× brightness is fine. (This governs photography. The brand logos above are the
   deliberate exception, under the owner's stated permission, D129.)
4. Neutral or warm-neutral cast. No second hue competing with `--accent`.
5. Run it through `npm run assets` or the same webp treatment; confirm the served size at 390px.
