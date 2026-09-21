---
name: design-to-code
description: Port a Claude Design export (DESIGN.md + artboard HTML, or screenshots as fallback) into production Next.js 16 + Tailwind v4 code with measured parity — same fonts, colours, spacing — plus impeccable + taste polish, no AI slop.
---

# design-to-code — Claude Design → production Next.js UI

Turns a Claude Design project into production code for the Platinum Wheels storefront. **The design is the spec. You translate it; you don't redesign it.** You are done only when parity is *measured* (numbers, not "looks close"), the stack rules from the tech-feasibility HLD hold, and the polish/QA gates pass.

Usage: `/design-to-code init` · `/design-to-code page <home|results|product|...>` · `/design-to-code section <page> <section>` · `/design-to-code shot <image> <page> <section>` · `/design-to-code audit [page]`

---

## 0. Order of authority (when things conflict)

1. **Tech-feasibility HLD** (`docs/decisions.md`, CLAUDE.md): stack, SEO, security, mobile-first, perf. It wins over the design on *how* something is built (e.g. native `<select>` on mobile, no third-party map script, server-rendered content).
2. **`design/DESIGN.md` + `design/*.html`**: the only source for *how it looks*: tokens, type, spacing, layout, states, copy.
3. **Supporting skills** (impeccable, taste, screenshot/image-to-code, frontend-design, web-design-guidelines): they only fill gaps, check and polish. They **never** change a token, font, colour, radius or layout the design already defines. Among themselves: impeccable detectors beat taste rules, and taste rules beat frontend-design.

If the HLD forces a visual change (e.g. the map embed turns into a static image), keep the design's look as close as possible and log it in `design/DEVIATIONS.md` (what, why, HLD section).

---

## 1. Hard rules (never break)

**Fidelity**
- Tokens only. No Tailwind default palette, no arbitrary values (`text-[#e10600]`, `p-[13px]`, `w-[347px]`) in `src/`. If a value is missing, add a token to `@theme` that is traced to DESIGN.md or measured from the design HTML. Never guess.
- Fonts = exactly the families, weights, tracking, case and sizes in DESIGN.md. Self-host with `next/font` (`display: 'swap'`, `adjustFontFallback`, fallback size-adjust for CLS). Never Inter, never a system-font fallback left as the visible face.
- Copy comes from the artboards, word for word, except where §8 says to replace it (placeholders, fake data).
- Measure spacing and type from the **exported HTML's computed styles**, not from screenshots.
- Port the desktop and mobile artboards **together** for each section. Breakpoints come from the two artboards, not from generic `sm/md/lg` guesses.

**Stack (HLD)**
- Next.js 16.3+ App Router, TS strict, no `any`. `proxy.ts` not `middleware.ts`. Tailwind v4 `@theme` in `src/app/globals.css`, no `tailwind.config`.
- Server Components by default. `"use client"` only on leaf islands (filter sheet, qty stepper, carousel controls, motion wrappers). Never at page level. SEO content is always server-rendered.
- Folders: routes in `src/app/(storefront)/…` stay thin. Feature UI goes in `src/features/<feature>/components/`. `src/components/ui/` = shadcn primitives only (restyled with tokens, no business logic). Site chrome (header, footer, mobile call bar) goes in `src/components/site/`. Named exports, no barrel `index.ts`.
- `next/image` only (with `sizes`, reserved aspect box, hero `priority`). `next/link` for every internal link.
- Semantic markup: one `h1` per page; `header/nav/main/footer` landmarks; buttons are `<button>`, links are `<a>`.

**Mobile-first (HLD §6)**
- Build at 390 px (the artboard), then check at 375, then scale up. Inputs ≥16 px font. `inputmode` and `autocomplete` on inputs. Tap targets ≥44 px. `touch-action: manipulation`. `dvh`, never `100vh`.
- Year/Make/Model: **native `<select>`** styled to match the design, not a custom combobox.
- Sticky tap-to-call bar uses `tel:` and `env(safe-area-inset-bottom)`.
- Hover is only an enhancement; nothing depends on hover. Honour `prefers-reduced-motion`. No parallax on mobile.
- No third-party scripts other than Vercel Analytics. A map is a static image plus a "Get directions" link, never an embed script.

**Business rules baked into the UI**
- Quote-first: CTAs say "Request a quote" / "Inquire". Never cart, checkout or "Buy now".
- Price format: `from $189 CAD / tyre`, pre-tax, tabular numerals.
- Fitment trust line on results and product pages. Unavailable = dimmed card, "Currently unavailable" badge and "Inquire about restock" CTA (the page stays HTTP 200).
- CASL checkbox renders **unticked**.

---

## 2. Supporting skills: who does what

| Skill / tool | Role here | Guardrail |
|---|---|---|
| `design.md` CLI (`npx @google/design.md`) | lint DESIGN.md, export tokens → `@theme` | output is reviewed, never hand-invented |
| `tailwind-v4-shadcn` | correct v4 `@theme` syntax + shadcn setup | — |
| `shadcn` | Sheet (mobile filters), Dialog, Accordion, Slider, Checkbox | restyle to tokens; radius from DESIGN.md |
| `frontend-design` | **only** for states the design doesn't show (empty results, error, loading skeleton, 404, form success) | must use existing tokens/components; can't change the visual language |
| `design-taste-frontend` (taste-skill v2) | **rules while writing JSX**: anti-slop typography, spacing, layout and motion rules applied as each section is built; second-opinion review in §6 | dials fixed in §3 step 5; **no GSAP skeletons** (motion = CSS / `motion` pkg only); its em-dash ban applies to new copy only, never to design copy |
| `image-to-code` (taste repo) / `screenshot-to-code` (OneWave-AI) | **`shot` mode only** (§4b): build a section when there's no usable HTML export, only a PNG/PDF/screenshot | framework is fixed (Next + Tailwind v4 + tokens), so skip its "which framework?" step; every colour snaps to an existing token; never its default palette/fonts |
| `impeccable` | `/impeccable audit` → `critique` → `polish` → `animate` after parity | DESIGN.md is its source; reject any change to tokens, fonts, layout or copy |
| `web-design-guidelines` | a11y/forms/focus/touch audit gate | fix everything it reports at file:line |
| `react-best-practices` | RSC boundaries, bundle, no client fetch waterfalls | — |
| `next-dev-loop` + `agent-browser` (or Playwright MCP) | render, screenshot, **measure** at each viewport | numbers go in the parity report |
| `typescript-lsp`, hooks | tsc/eslint on every edit | — |

If one isn't installed, say so and continue with the rest. Don't reinvent it inline.

Install (repo scope, `--copy` so the cofounder gets them via git):
```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend" -a claude-code --copy
npx skills add https://github.com/Leonxlnx/taste-skill --skill "image-to-code" -a claude-code --copy
npx impeccable install
# optional alt to image-to-code: OneWave-AI screenshot-to-code (Smithery; no public repo found — read its SKILL.md before installing)
```

---

## 3. Mode `init`: once per project (tokens, fonts, primitives)

**Step 1: Freeze the spec in git**
- `design/DESIGN.md`, `design/<page>-desktop.html`, `design/<page>-mobile.html` (one standalone HTML export per artboard), `design/assets/`.
- Add `design/manifest.md`: artboard → route → sections list (top to bottom) → the states shown (hover, pressed, focus, unavailable).
- If a "Send to local coding agent" bundle has extra files (tokens.json, annotations), commit them too.

**Step 2: Tokens**
```bash
npx @google/design.md lint design/DESIGN.md      # fix contrast/ref errors in DESIGN.md first
npx @google/design.md export --format css-tailwind design/DESIGN.md > design/theme.generated.css
```
- Merge into `src/app/globals.css` under `@theme`. Start with `--color-*: initial; --radius-*: initial; --shadow-*: initial;` so off-palette utilities don't exist.
- Cross-check each token against the computed styles in the HTML exports (bg tones, text, muted, dim, border, rule, accent, accent-hover, accent-deep, spacing scale, radius, type scale). Anything the export missed gets added and traced in a comment: `/* from home-desktop.html .hero h1 */`.
- Text contrast ≥4.5:1, UI ≥3:1. If the design fails this (e.g. dim text on black), raise the value just enough to pass and log it in DEVIATIONS.md.

**Step 3: Fonts**
- `src/app/fonts.ts`: `next/font/google` (or `local`) for the display and body families. For static families pass explicit `weight` arrays. Set `variable: '--font-display' | '--font-body'` on `<html>`.
- Map in `@theme inline { --font-display: var(--font-display); --font-sans: var(--font-body); }`.
- Utility classes for the named type roles in DESIGN.md (display-xl/lg/md, label, numeral) via `@utility`, covering size, line-height, tracking, weight, case and `font-variant-numeric: tabular-nums` for numerals.

**Step 4: Primitives sprint → `/styleguide`**
- Build from DESIGN.md + the home artboards: Button (primary/secondary/ghost/icon, all states incl. pressed/focus/disabled), Badge (season variants), Chip, Input, Select (native, styled), Checkbox, Card (product card incl. hover and unavailable), SectionHeading (eyebrow + title + optional numeral), Stripe divider, Price.
- Route `src/app/(storefront)/styleguide/page.tsx` shows every variant and state. Add `noindex` and exclude it from the sitemap.
- Verify with §5 against the design's instances of each primitive. Commit: `feat(ui): tokens, fonts, primitives`.

**Step 5: Pin the taste dials** (write them in `.claude/rules/ui.md` with `paths: src/**/*.tsx` so they load for every UI edit):
```
DESIGN_VARIANCE: 7   # DESIGN.md wants asymmetric 60/40 splits, not centred-everything
MOTION_INTENSITY: 3  # hover fills + 2px card lift, ≤150 ms; no scroll/magnetic effects
VISUAL_DENSITY: 5    # storefront pages; results grid may go to 6
Taste rules are subordinate to design/DESIGN.md and the artboards. If a taste rule contradicts the design, the design wins; log it in DEVIATIONS.md only if the code differs from the design.
```

---

## 4. Mode `page <name>` / `section <page> <section>`

For each section in `design/manifest.md` order:

1. **Read**: that section's markup in both the desktop and mobile HTML, plus the matching DESIGN.md rules. List its elements, the states it shows, the images it uses, and its copy.
2. **Plan** (plan mode for full pages): the target file (`features/<f>/components/<Section>.tsx` or `components/site/…`), server vs client split, which primitives it reuses, which tokens, and which HLD rules apply (for example: search card = native selects plus a Server Action link to `/search?...`).
3. **Build** mobile first from the 390 artboard, then add desktop from the 1440 artboard, using breakpoints derived from where the layout actually changes.
4. **Images**: use the client's own photos when available. Otherwise use licensed stock (Unsplash/Pexels) with no legible tyre-brand logos, exported as webp. Hero ≤150 KB at 375 px. Filenames are slugs, `alt` is descriptive, `sizes` is correct.
5. **Measure** with §5. Fix by the measured deltas. Repeat until it passes (max 3 loops; after that, stop and report what's still off).
6. **Commit** per section: `feat(<page>): <section> — parity ✓`.

Compose the route's `page.tsx` last, with metadata (`generateMetadata`), `h1`, landmarks and breadcrumbs. JSON-LD hooks are owned by the SEO feature: leave a `<JsonLd …/>` slot if it doesn't exist yet and note it.

**States the design doesn't show** (empty, loading, error, success, 404): ask `frontend-design` for them, restricted to existing tokens and primitives, then run them past the taste rules. Show them on `/styleguide`.

---

## 4b. Mode `shot <image> <page> <section>`: screenshot fallback

Use this only when the HTML export for a section is missing or broken, or when all you have is a PNG/PDF (a Claude Design PDF export, or a client's marked-up screenshot). HTML is always the better source, so ask for the export first.

1. Put the image in `design/shots/<page>-<section>-<bp>.png`. You need both desktop and mobile shots; if one is missing, ask for it rather than inventing that breakpoint.
2. Run `image-to-code` (or `screenshot-to-code`) in **analysis-only** mode first. Output an inventory in `design/shots/<page>-<section>.md`: layout grid, elements, copy (transcribed exactly), states shown, and estimated sizes.
3. **Snap every value to the system**: colour → nearest `@theme` token (a colour with no token within ΔE 3 means stop and ask); font → the DESIGN.md family and role; spacing → nearest step on the 8 px scale; radius → the DESIGN.md radius. Never introduce a new value from a screenshot.
4. Build with the same rules as §4 (tokens, primitives, HLD, taste rules).
5. Parity uses pixel comparison instead of computed styles, since there's no baseline DOM. Overlay the app's screenshot on the reference at the same viewport and scale. Tolerances: spacing ±4 px, sizes ±2%, colours must be tokens, fonts exact. Mark the section `parity: screenshot-grade` in the report, and redo it with §5 once an HTML export exists.

---

## 5. Parity protocol (the "done" definition)

**Viewports:** 390×844 and 1440×900 (the artboard widths). Overflow-only check at 375, 768 and 1280.

**Baseline:** serve `design/` statically (`npx serve design -l 4000`) and render `design/<page>-<bp>.html` at the same viewport, with the same fonts loaded.

**For each section, at both viewports:**
1. Clip screenshots of the design and the app for that section only. Avoid full-page shots over ~1568 px, which get downscaled.
2. Measure with `getComputedStyle` and `getBoundingClientRect` on matching elements (heading, body, eyebrow, button, card, input, image, container):
   `font-family, font-size, font-weight, line-height, letter-spacing, text-transform, color, background-color, border (width/color), border-radius, padding, gap, width, height, x offset`.
3. Write the table to `design/reports/<page>.md`:

| element | prop | design | app | Δ | ok |
|---|---|---|---|---|---|

**Pass thresholds:**
- Colours, font family, weight, case: **exact**.
- Font-size and line-height: ±0 px. Letter-spacing: ±0.01em.
- Spacing, gap, padding: ±2 px. Box width/height: ±4 px or ±1% (whichever is larger). Radius: exact.
- Horizontal scroll at 375/768/1280/1440: none.
- Hover, pressed and focus states match the design's shown states.

Never write "matches" or "looks right" without the table. If a delta is intentional (HLD or contrast), it links to DEVIATIONS.md.

---

## 6. Premium pass (only after parity passes)

1. `/impeccable audit` → fix real issues (alignment, rhythm, orphans, inconsistent radius, contrast, focus). Reject token or layout changes.
2. `/impeccable critique` → pick at most 3 improvements that **stay inside DESIGN.md**: tighter optical alignment, consistent vertical rhythm, better image crops, tabular numerals, typographic polish (widows via `text-wrap: balance/pretty`).
3. `/impeccable polish`, then re-run §5 on the touched sections. Parity must still pass.
4. **Taste review**: run `design-taste-frontend` as a reviewer over the finished section, with the §3 dials, to catch anything impeccable missed (type rhythm, spacing monotony, weak hierarchy, generic card patterns). Apply only findings that don't change DESIGN.md values. If impeccable and taste disagree, impeccable wins.
5. `/impeccable animate`, limited to DESIGN.md motion rules (e.g. hover = instant fill, card lift 2 px, ≤150 ms). Use the `motion` package with `useReducedMotion` or plain CSS transitions. No parallax on mobile, no scroll-jacking, no motion on LCP elements. HLD risk rule: cut animations before cutting SEO or deadline items.

---

## 7. QA gates (all must pass before a PR)

- `pnpm check` (tsc + eslint incl. jsx-a11y): clean.
- `web-design-guidelines` on changed files: zero open findings.
- Slop grep (below): zero hits.
- Lighthouse mobile on the page (local prod build or preview): LCP ≤2500 ms, CLS ≤0.05, Performance ≥90, Accessibility ≥95.
- Keyboard-only walk-through: visible focus ring (per DESIGN.md), logical order, Sheet/Dialog trap focus and close on Esc.
- agent-browser click-through at 375 px of the page's main flow (HLD §7 dev loop).
- Reduced-motion on: no animation.
- Parity report committed; DEVIATIONS.md updated.

HLD scope: visual-regression tests and axe are **out**. Don't add `toHaveScreenshot` specs or axe to CI. The parity report is the evidence.

**Slop grep** (run on `src/`):
```bash
rg -n "\[#[0-9a-fA-F]{3,8}\]|\b(p|m|gap|w|h|top|left|text|leading|tracking)-\[\d" src/     # arbitrary values
rg -n "\b(bg|text|border|from|to|ring)-(slate|gray|zinc|neutral|stone|red|blue|indigo|purple|violet)-\d{2,3}\b" src/   # default palette
rg -n "font-\['?Inter|Inter\(|rounded-(full|3xl|2xl)|backdrop-blur|shadow-(lg|xl|2xl)|bg-gradient-to" src/
rg -n "lorem|ipsum|Lorem|TODO copy|placeholder\.com|via\.placeholder" src/
rg -n "Add to cart|Buy now|Checkout" src/
rg -n "'use client'" src/app/                                                       # page-level client = fail
```
(`rounded-full` is allowed only if DESIGN.md specifies it, e.g. the mobile circular call button. Whitelist that one file.)

---

## 8. Anti-slop checklist (review every section)

- [ ] One accent per visual frame (DESIGN.md rule); never two accent elements touching.
- [ ] Asymmetric layouts where the design has them. Don't "fix" them to centred.
- [ ] No gradients, glows, glass, shadows or pills unless DESIGN.md allows them (hero bottom fade only).
- [ ] One icon set, consistent stroke and size, no emoji as icons.
- [ ] Real photography that fits the design's art direction. No generic stock people, no AI renders.
- [ ] **No invented social proof**: no fake reviews, ratings, "10,000+ happy customers", or testimonials. Stats or claims only if the client confirmed them.
- [ ] Placeholder data from the mockup (555 phone, sample address, demo products) is replaced with real client data or a clearly named config constant (`src/lib/site.ts`), never hardcoded in components.
- [ ] Brand logos row: only brands the client actually stocks and is allowed to show. Otherwise text wordmarks.
- [ ] Empty, loading and error states look as designed as the happy path.
- [ ] Type hierarchy matches the artboard at both breakpoints (no desktop sizes leaking to mobile).
- [ ] No "AI tells": centred hero + 3-icon grid + gradient CTA, identical card rhythm everywhere, filler copy ("Elevate your driving experience").

---

## 9. Mode `audit [page]`

Runs §5 + §7 + §8 on existing code without building anything. Output: `design/reports/<page>-audit.md` with the parity table, the gate results and a fix list ordered by visual impact. Change nothing unless the user says to.

---

## 10. Closing the loop

- After all primitives and sections are stable, offer `/design-sync` to push the real components back into the Claude Design system, so future artboards use them.
- New small features later: design in Claude Design, export, `/design-to-code section`.
- Final report to the user: pages/sections done, parity pass rate, deviations, gate results, anything blocked (e.g. client photos missing). Keep it short and concrete.

## Stop and ask when
- DESIGN.md and the artboard HTML disagree on a value (ask which wins; don't pick).
- The design requires something the HLD forbids and there's no obvious equivalent.
- Parity still fails after 3 fix loops on a section.
- Real client data or photos are needed and missing.
