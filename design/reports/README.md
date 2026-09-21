# Parity reports

Evidence for `docs/decisions.md` §9. One file per page, holding the computed-style table at 390 and 1440.
Never write "matches" or "looks right" here — every row is a measured number.

## Running a measurement

**1. Serve the baseline.**

```bash
npm run design
```

`serve` runs from `design/` with `design/serve.json` rewriting each artboard URL to `assets/<name>.html`,
so the artboards' relative image paths resolve (D36). The URLs are extensionless:
`http://localhost:4000/home-desktop`, `/home-mobile`, `/results-desktop`, `/results-mobile`,
`/results-mobile-filters`, `/product-desktop`, `/product-mobile`.

**2. Serve the app** in a second terminal: `npm run dev` (port 3000).

**3. Point the browser pane at each in turn**, set the viewport to the artboard size (1440×900 or
390×844), and run the probes from `scripts/parity-probe.js` in the page. Diff the two JSON blobs into
the table below.

`preview_start` with the `app` / `design-baseline` entries in `.claude/launch.json` works when the session
starts in this directory. If the port is already taken, `navigate` to the running server instead.

## Thresholds (`docs/decisions.md` §9)

| Property | Tolerance |
|---|---|
| Colour, font-family, font-weight, text-transform | exact |
| font-size, line-height | ±0px |
| letter-spacing | ±0.01em |
| padding, gap, margin | ±2px |
| width, height | ±4px or ±1%, whichever is larger |
| border-radius | exact |
| Horizontal scroll at 375 / 768 / 1280 / 1440 | none |

A delta outside tolerance is either fixed or linked to a row in `design/DEVIATIONS.md`. There is no third
option.

## Pipeline verification — 2026-09-20

Run against `home-desktop` at 1440×900 before any page existed, to prove the measurement path works and
to check the token layer against the real baseline rather than against a reading of the source.

| Element | Property | Baseline | Token | Resolves to | ✓ |
|---|---|---|---|---|---|
| `h1` | font-size | `120px` | `text-display-120` | `calc(120px * var(--scale-hero))`, ramp = 1 | ✓ |
| `h1` | line-height | `110.4px` | `leading-display` | 0.92 × 120 = 110.4 | ✓ |
| `h1` | letter-spacing | `-1.8px` | `tracking-display` | −0.015em × 120 = −1.8 | ✓ |
| `h1` | color | `rgb(244,244,245)` | `--on-photo` | `#F4F4F5` | ✓ |
| `h1` | x | `48` | 48px desktop side padding | — | ✓ |
| eyebrow | font-size | `12px` | `text-12` | `12px` | ✓ |
| eyebrow | letter-spacing | `1.92px` | `tracking-16` | 0.16em × 12 = 1.92 | ✓ |
| eyebrow | color | `rgb(201,242,58)` | `--accent` | `#C9F23A` | ✓ |
| document | scrollWidth | `1440` | — | no horizontal overflow | ✓ |
| document | `fonts.status` | `loaded` | — | Barlow + Barlow Condensed resolved | ✓ |

Also measured and worth carrying into the build: the hero copy block is capped at `max-width: 1100px`
and sits at `x: 48`, `y: 240.8` (eyebrow) / `280.8` (h1).

## Gotcha: a stale dev server will fake a passing measurement

Adding a token to `:root` in `globals.css` did **not** hot-reload under `next dev` with Turbopack. The
utility class was on the element and the utility rule existed, but `--border-control` resolved to empty in
the browser, so `border-color` silently fell back to `currentColor` — which on a field is `--text`, a
plausible-looking light border. Nothing errored, and the page still returned 200.

Two habits follow:

1. After changing `globals.css`, **restart `next dev` and clear `.next`** before measuring. Do not trust
   HMR for theme changes.
2. When verifying a token, read `getComputedStyle(document.documentElement).getPropertyValue('--x')` in
   the browser, not just the class list and not just the source file. A class can be present and the
   token still be undefined. Curling the `/_next/static/**.css` chunks is not reliable either — in dev
   the sheet is split and partly HMR-injected, and a grep over one chunk will report a rule "absent"
   that is in fact live.

## Control-boundary contrast — verified in the browser, 2026-09-20

| Element | Border | vs field fill | vs `--surface` panel | vs `--bg` page |
|---|---|---|---|---|
| Input | `rgb(105,105,111)` #69696F | **3.01:1** | **3.31:1** | **3.61:1** |
| Select | `rgb(105,105,111)` | 3.01:1 | 3.31:1 | 3.61:1 |
| Textarea | `rgb(105,105,111)` | 3.01:1 | 3.31:1 | 3.61:1 |
| Card edge (unchanged) | `rgb(31,31,36)` #1F1F24 | — | — | as drawn |

All three control types clear WCAG 1.4.11; decorative edges are untouched.

## Lighthouse — how to run it here (2026-09-21)

Chrome lives at `/Applications/Google Chrome.app`; no `google-chrome` binary is on `PATH`, which is why
earlier sessions reported "no CLI Chrome". The gate (`docs/decisions.md` §9) is measured on the
**production build**, mobile emulation, never on `next dev`:

```bash
npx next build && PORT=3001 npx next start &
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npx --yes lighthouse "http://localhost:3001/results?year=2021&make=Honda&model=Civic" \
  --only-categories=performance,accessibility --form-factor=mobile --screenEmulation.mobile \
  --chrome-flags="--headless=new" --output=json --output-path=/tmp/results.json --quiet
```

Read `categories.performance.score`, `categories.accessibility.score`,
`audits["largest-contentful-paint"].displayValue` and `audits["cumulative-layout-shift"].displayValue`
from the JSON. Run each page twice: the simulated LCP varies by up to a second between runs on this
machine, so a single reading is not a pass or a fail. Per-page results live in the page report.
