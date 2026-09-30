# Asset credits and provenance

Every image that did not come from the client, with its source and licence. Keep this current — it is the
record that the site has the right to use what it ships.

## In use

| File | Source | Photographer | Licence | Notes |
|---|---|---|---|---|
| `public/images/photos/hero-tread.webp` | [Unsplash `CTwQiFlpgrM`](https://unsplash.com/photos/close-up-of-a-rugged-tire-tread-CTwQiFlpgrM) | Rob Wingate | Unsplash Licence — free for commercial use, no attribution required | Tread macro, single hard light, dark ground. Replaces the artboard's hotlinked Vossen/Ferrari photo (DEVIATIONS #1). Source 3000×2000; shipped 2400×1600 webp, 479.6KB, which `next/image` serves as **13.0KB at 390px** and 34.1KB at 750px. |
| `public/images/photos/tires-tile.webp` | [Unsplash `tLEUi4OaQmQ`](https://unsplash.com/photos/tLEUi4OaQmQ) | Yvette S (@photography_yeti) | Unsplash Licence, free for commercial use, no attribution required | All-season tread, monochrome, no text. Source 6000×4000; shipped ≤2400px webp. Replaces the client tile photo (D94b). |
| `public/images/photos/wheels-tile.webp` | [Unsplash `7IrHGsLzy4U`](https://unsplash.com/photos/7IrHGsLzy4U) | Baptiste Régnier (@baptiste_rgnr) | Unsplash Licence, free for commercial use, no attribution required | Mesh alloy wheel, warm-neutral light, no legible marks (centre cap magnified 2.2×: none). Source 5568×3712, cropped 3:4 around the wheel. Replaces the client tile photo (D94b). |
| `public/images/photos/accessories.webp` | [Unsplash `h8ojNoTn4K4`](https://unsplash.com/photos/h8ojNoTn4K4) | Caleb German (@marcgario) | Unsplash Licence, free for commercial use, no attribution required | Black wheel, lug nuts and centre cap, near-monochrome; the cap shows only a reflection, no legible mark. Source 3886×5820. Replaces the client tile photo (D94b). |
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

_D94b, 2026-09-30, looked at and refused under rule 3 (legible marks) or rule 4 (second hue): Unsplash `ErrKR5f9jEw` (Maserati trident on the hub, caliper script), `TXsIul1J00k` (BFGoodrich sidewall and Method wheel wordmark), `dkhJYd4yQ0M` (the centre cap reads `rotiform` at 2.2× brightness), `4_L_ARvv4kU` (FORD on the cap), `GfJjF3cM4aI` (BBS cap), `HxpfckKgZ0g` (red caliper), `V7a5lkzHurk` (purple cast)._

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

## Rules for adding an image

1. Licence must permit commercial use. Record it here before the file lands in `public/`.
2. **Look at it.** Do not trust a stock site's caption — two of the three candidates above were described
   inaccurately in ways that would have shipped a defect.
3. No legible tyre, wheel or vehicle brand marks. Magnify and brighten to check; embossed text that is
   illegible at 2× brightness is fine.
4. Neutral or warm-neutral cast. No second hue competing with `--accent`.
5. Run it through `npm run assets` or the same webp treatment; confirm the served size at 390px.
