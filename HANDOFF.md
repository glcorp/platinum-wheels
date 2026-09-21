# Platinum Wheels — session handoff

**Last updated 2026-09-21 (session 5).** All three designed routes are built — `/`, `/results`,
`/products/[slug]` — each with a measured parity report. Scope is **UI only** (D54). The
`/design-to-code audit` pass is **done** (D56, `design/reports/audit.md`), and **six of its findings are
applied and verified** (D57): the five accessibility defects C1–C5 plus S1. Four items (S2–S5) and the
four taste items remain unauthorised. Next is the last undrawn states (loading, error).

**How to use this file.** It is the single current record of how to work in this repo. It replaced the old
frozen `Part A` / `Part B` split on 2026-09-21 (**D55**), because the split pinned Part A to exactly 135
lines so that line-number citations into Part B would not move — and those citations had drifted and broken
anyway. **Cite this file by section (`HANDOFF.md §7`), never by line number.** Sections are stable; line
numbers are not.

It is not a log (root `llm.md` §1.7). It records what is true now. The decision register lives in root
`llm.md` §5b (**D23–D56**); §11 below holds the frozen canonical text of **D1–D22** and is never edited.

**Git (D55, superseding D3).** The tree is a git repository: branch `main`, initial commit `60fa3e8`
(251 files), tracking `origin/main` at `github.com/glcorp/platinum-wheels` (private). Everything before
that commit has no history, so for the three built pages `design/reports/` and `design/DEVIATIONS.md`
remain the only record of how they got there. §11's D3 row keeps its original text and is never edited.

---

## §1. Start

```bash
cd /Users/raghavvirmani/platinum-wheels
npm run check          # tsc + eslint — must exit 0 before touching anything
npm run dev            # app on :3000 (preview_start name=app; it carries "autoPort",
                       # so a second session gets a free port instead of colliding)
npm run design         # artboard baseline on :4000 (design/serve.json rewrites, D36)
```

Pages worth opening: `/`, `/results?year=2021&make=Honda&model=Civic`,
`/products/zeta-antarctica-sport?year=2021&make=Honda&model=Civic&qty=4`, `/styleguide`.

Baseline artboard URLs are **extensionless** (`npx serve` strips `.html`):
`http://localhost:4000/product-desktop`, `/product-mobile`, `/home-desktop`, `/results-mobile-filters`.

Parity is measured with `scripts/parity-probe.js` against that `:4000` baseline — never by eye, never by
reading source. After any `globals.css` edit: `rm -rf .next`, `npx next typegen`, restart `next dev`.
Lighthouse runs on the production build; recipe in `design/reports/README.md` (Chrome is at
`/Applications`, not on `PATH`).

---

## §2. Read in this order

1. **`llm.md` (root)** — §1 library rules, §4 authority chain, §5b register **D23–D56**, §6 folder map,
   §7 open items.
2. The `llm.md` of every folder you will touch. Rule §1.1: read before write. Rule §1.2: update it in the
   same change.
3. **`design/manifest.md`** — artboards → routes → sections. This is the **build queue** that the
   `/design-to-code page` and `section` modes consume.
4. **`design/reports/{home,results,product}.md`** — the three parity baselines. `product.md` is the newest
   and shows the shape to copy, including a *Behaviour verified* section.
5. **`design/DEVIATIONS.md`** — **43 rows**. #1–#24 shared and home, #25–#35 `/results`, #36–#43 the PDP.
   Check it before "fixing" anything that looks off-spec: nearly all of it is deliberate and sourced.
6. `design/inventory/{home,results,product}.md` — the measured baseline, only if you are re-measuring.

---

## §3. How the owner runs sessions (D23–D25, D48, D54)

- The main session is the **coordinator**: it grounds, plans, writes the contract and the agent briefs,
  measures parity in the browser, and merges the docs. Implementation is delegated to sub-agents. **The
  model is the owner's call each session** — Opus for `page results`, Sonnet for `page product`. Ask if
  unstated.
- **Ask, don't assume — but batch.** One `AskUserQuestion` with ≤4 genuine blockers, recommended option
  first. The owner has taken the recommendation every time so far, and rules data gaps as "use placeholder
  data" (D48). Rulings made without asking are labelled *derived* and are vetoable.
- **The pattern that works:** the coordinator writes the register rows, the folder `llm.md` and a
  `types.ts` contract **before** any agent starts; agents then work on strictly disjoint files. The
  coordinator is the single writer for `globals.css`, every `page.tsx` and every `llm.md`.
- **Agent output is a claim, not a fact.** Verify in the browser. Across this project several agent
  findings were wrong or had to be overridden — and in session 4 three *coordinator* probe selectors also
  grabbed the wrong element and nearly produced "fixes" to correct code. Measure the element you named.
- Sub-agents can die on a session rate limit **after** writing their files. Check the disk before
  relaunching; both PDP agents had finished writing and only lost their verify step.
- Replies short. This library is the shared memory with the co-founder.

---

## §4. What exists

| Area | State |
|---|---|
| Library | 26 `llm.md` files. Root = register (D1–D55) + template + folder map. |
| `/` | `SiteHeader over-hero`, 8 home sections, `SiteFooter` (D38). Parity `design/reports/home.md`. |
| `/results` | URL-driven search over the seed (D44): `ResultsToolbar`, `FilterSortBar`, `md:results-grid` (rail + grid), `CallCtaPanel`. Parity `design/reports/results.md`. |
| `/products/[slug]` | `productView(product, searchParams)` → one `ProductView`; breadcrumb, `pdp-split` gallery + sticky buy panel, specs, quote band, similar row. Parity `design/reports/product.md`. |
| `src/features/product/` | `types.ts` (contract), `view.ts` (all derivation), `actions.ts` (`"use server"`), 9 components; one island `quote-form.tsx`. D50–D53. |
| `src/features/results/` | `types.ts`, `query.ts`, `search.ts`, 8 components; islands `sort-select`, `filter-panel`, `filter-sheet`. D42–D49. |
| Finder | `src/features/finder/` — native selects, GET to `/results` (D27/D28); `variant="inline"` for `Change vehicle` (D45); **placeholder `FITMENT` map** (D48). |
| Catalog | `FEATURED_PRODUCTS` (4) and `PRODUCTS` (9 SKUs, one unavailable, D43); optional `Product.image` and `studdable` (D53). `ProductCard` is the most reused component in the build. |
| Chrome | `site-header`, `site-nav-drawer`, `site-footer` (no social row, D34), `page-stub`. |
| Primitives | **Ten**, hand-built and token-only in `src/components/ui/` — button, badge, chip, checkbox, field-label, input, price, section-heading, select, stripe-divider. Every variant and state is on `/styleguide`. The PDP needed no new primitive and no new variant. |
| `globals.css` | 711 ln: tokens, role utilities, and the home / results / product layout utilities, plus the three D57 accessibility utilities (`tap-extend-lg`, `hide-scrollbar`, `skip-link`). **Single writer: the coordinator.** See §9. |
| `.claude/rules/ui.md` | Taste dials + JSX non-negotiables. **Auto-loads on every `src/**/*.tsx` edit** — so it governs `src/components/ui/`, `src/components/site/`, `src/features/*/components/` and the route files under `src/app/(storefront)/`. Nothing imports it; it loads by glob, and its length is paid on every UI edit. |
| Stubs left | `/wheels`, `/accessories`, `/about`, `/privacy`, `/terms`, 404. Undesigned (D26/D39). |

---

## §5. Verification state

- `npm run check` clean; `npx next build` clean; slop grep **zero**.
- **Six** `"use client"` files and **one** `"use server"`; none under `src/app/`. Re-counted after D57 —
  the accessibility fixes added no client boundary.
- Parity: every row on all three pages is exact at 1440 and 390, or linked to a `DEVIATIONS.md` row.
  No horizontal overflow 375–1440 on any page.
- `/results`: Esc, backdrop, focus return and scroll lock verified; sort and filter rewrite the URL with
  focus kept.
- `/products/[slug]`: `?qty=` round-trips into the quote form; invalid submit keeps typed values and sets
  `aria-invalid`; the success panel takes focus; the unavailable SKU returns 200.
- Lighthouse (mobile, production build): PDP perf 93/95, `/results` 93–97, `/` 91. **a11y 100 and CLS 0 on
  all three.** The 2.5 s LCP row is red everywhere (3.0–3.5 s) — one build-wide cause, parked (D54).

**Re-measured by the D56 audit, 2026-09-21** (`design/reports/audit.md` §2):

- No horizontal overflow at 375/768/1280/1440 on `/`, `/results`, `/products/[slug]` *or* `/styleguide` —
  13 measurements, `scrollWidth === clientWidth` every time.
- Both `<dialog>`s measured `:modal`, lock `body`, close on Esc and return focus to their trigger. The
  nav drawer's `aria-expanded` round-trips. Focus ring is `2px solid rgb(201,242,58)` at offset 0 (D16).
- `/results` renders the filter form twice: across 41 ids there are **zero** duplicate ids, zero orphan
  `label[for]` and zero orphan `aria-describedby`. The `idPrefix` namespacing works.
- D44's no-JS path is real: three `<form method="get" action="/results">` with `Apply` submits and the
  vehicle preserved in hidden inputs. **`sort` is the one exception** (Open §7, root `llm.md` §7.20).
- No parity drift: home `h1` at 1440 is identical to the `:4000` baseline on all seven properties.
- **`a11y 100` from Lighthouse did not catch any of the five accessibility defects C1–C5.** Its `bypass`
  audit is satisfied by a `<main>` landmark alone, so a missing skip link scores clean. **Do not treat
  that number as evidence of accessibility.**

---

## §6. Next steps, in order

**Scope is UI only (D54).** Owner, 2026-09-21: *"we are just building ui so park these"*. Three items are
**parked, not owed** — see §7. Do not reopen one as a blocker and do not quietly implement it. A page is
done when the `docs/decisions.md` §9 gates are green *except* a parked row.

1. ~~**`/design-to-code audit`** across the three built pages.~~ **Done 2026-09-21 (D56)** —
   `design/reports/audit.md` plus four per-scope `*-audit.md` files. Report-only: **no file under `src/`
   was modified**, and nothing on the fix list may be applied until the owner names it.
2. ~~**Work the audit fix list**, once approved.~~ **Six applied 2026-09-21 (D57)** — C1–C5 and S1, each
   verified in the browser, with `DEVIATIONS.md` #41 corrected and #44–#48 added. **Still unauthorised:**
   S2 (the 13 class-merge helpers — reserved to the owner, root `llm.md` §7.10), S3 (missing DEVIATIONS
   row for the solid-header background), S4 (three stale comments), S5 (the dead `--container-rail`
   token), and T1–T4. Do not apply any of them without the owner naming it.
3. Remaining undrawn states: **loading** and **route error** (no `loading.tsx` or `error.tsx` exists
   anywhere in `src/app/`). `/styleguide` §11 carries empty results, the open `Change vehicle`
   disclosure, the quote-form success panel, and — added by D57 — the quote-form **error** summary and
   the **skip link**. Anything authored for an undrawn state lands there in the same change
   (`.claude/rules/ui.md` "States the design doesn't show").
4. Replace the five stub routes when the client supplies copy — they are undesigned, so they need the
   owner before they need a session.

---

## §7. Open

**Parked by D54 — recorded, not owed, not blockers:**

1. **The quote form has no destination.** `src/features/product/actions.ts` validates and returns success,
   then discards the inquiry; delivery is a marked `TODO`. The UI half is complete and measured. Must be
   wired before the site is public, but that needs a backend. (root `llm.md` §7.15)
2. **No unavailable state on the PDP.** No artboard draws one, so none was authored. (§7.16)
3. **The LCP gate**, 3.0–3.5 s against 2.5 s on all three routes, one build-wide cause. (§7.12)

**Awaiting an owner decision, from the D56 audit (root `llm.md` §7.17–§7.20):** the 10-item fix list,
item by item · whether `sort` must work without JS · the home carousel's scrollbar · whether a live region
is wanted · the category-tile imagery · **two rows are both numbered `D55`**, which rule §1.5 forbids
fixing unilaterally.

**Live — full list in root `llm.md` §7:** any D24 default · social links · street address · brand stock
confirmation · which contact receives call taps · **13** class-merge helpers, not six (§7.10, corrected by
the audit) · `skills-lock.json` provenance · stale citations in the inventories.

**Owed by the client (D48):** real year-specific fitment data · per-SKU photography · higher-resolution
originals for `touren-tr79` (470×439) and `zmax-landgema` (546×757), which `scripts/prepare-assets.mjs`
refuses to upscale · `M+S` sidewall data · monochrome white brand logos, plus confirmation those brands
are stocked.

---

## §8. Gotchas (each cost real time)

1. Never symlink inside a Tailwind-scanned tree — Turbopack loops forever (D36).
2. A new `@utility` may not reach the browser over HMR: `rm -rf .next`, `npx next typegen`, restart.
3. Same-specificity class overrides resolve by **emission order, not JSX order** — add a size or variant
   rather than trying to override.
4. Opacity modifiers compute to `oklab`; give a literal colour a real token instead.
5. `peer-checked:` only matches a **sibling**. An input that is a *child* of the label needs
   `has-checked:` (`src/components/ui/chip.tsx`).
6. `next/image`: LCP candidates use `loading="eager"` + `fetchPriority="high"`, **not** `priority`.
7. An image's `sizes` must cross at the **layout's** breakpoint, not the type's. The PDP gallery is
   full-bleed below `md:` 1100, so `(min-width: 1100px) 704px, 100vw`.
8. `data-probe` selectors must be scoped — the results filter form renders twice (rail + sheet).
9. `find` here is BSD: `-newermt "-90 seconds"` fails; use `-mmin`.
10. `read_console_messages` returns **buffered history** — a fixed parse error keeps reappearing. Confirm
    in a fresh tab before believing it.
11. Editing by string index can match an earlier identical line (it ate a `useEffect` body once). Anchor
    on something unique, and re-run `npm run check` after every scripted edit.
12. `cd` inside a Bash call persists for later calls — always write
    `cd /Users/raghavvirmani/platinum-wheels && …`, and give sub-agents absolute paths.
13. `npx serve` strips `.html`; baseline URLs are extensionless (§1).
14. This is Next.js **16.4 canary** — breaking changes vs. training data. `AGENTS.md` requires reading
    `node_modules/next/dist/docs/` before using an API. `proxy.ts`, not `middleware.ts`.
15. Package manager is **npm**. The skill's `pnpm check` means `npm run check` here.
16. `launch.json` resolves correctly only when the session starts in this directory. An earlier failure
    came from a session started in `/Users/raghavvirmani/code/platinum-wheels`, an unrelated project.

---

## §9. Token system — the part to internalise

`src/app/globals.css` resets `--color-*`, `--text-*`, `--font-*`, `--radius-*`, `--shadow-*`, `--blur-*`,
`--tracking-*`, `--leading-*`, `--breakpoint-*` and `--container-*` to `initial`. **`bg-slate-900`,
`shadow-lg`, `rounded-xl` and `text-sm` physically do not compile.** That is deliberate: it makes the slop
grep structural rather than advisory, and it is why `shadcn init` must never be run here.

**Colour** — design name → utility: `--bg`→`bg-bg`, `--surface`→`bg-surface`, `--surface-2`→`bg-surface-2`,
`--border`→`border-border`, `--border-strong`→`border-border-strong`,
`--border-control`→`border-border-control`, `--text`→`text-ink`, `--text-muted`→`text-ink-muted`,
`--text-dim`→`text-ink-dim`, `--accent`→`*-accent`.

**Type** — 22 measured sizes as `text-10` … `text-64`. Display type uses the `display` utility plus a
`text-display-*` token compiling to `calc(<n>px * var(--scale-h2))`; the spec requires headline sizes never
be bare pixels. Ramp membership was *measured* from the exports' own `calc()` bindings: `--scale-hero` →
120; `--scale-h2` → 32/36/40/48/56/88; `--scale-h3` → 20/24/26/28.

**Role utilities** — `display`, `label`, `numeral`, `photo-inset-card` (6%), `photo-inset-gallery` (8%),
`photo-vignette` (50% stop), `photo-vignette-gallery` (55% stop), `transition-card`, `tap-extend`.

**Accessibility utilities (D57)** — `tap-extend-lg` (±16px, for lines too short for `tap-extend`'s ±12px
to clear the 44px floor: a 13px crumb hit-tests 37px with the small band, 45px with the large one),
`hide-scrollbar` (the one mechanism both scroll-snap carousels compose — `similar-track` no longer hides
its own), `skip-link` (off-screen until focused). All three change **no drawn property**, so no parity row
moves. `skip-link` reveals on **`:focus`, not `:focus-visible`** — it is unreachable except by Tab, and
`:focus-visible` does not match programmatically moved focus, which cost a verification round to find.

**Layout utilities** — home: `finder-grid`, `contact-grid`, `category-grid`. Results: `results-grid`,
`range-input`, `sheet-panel`, `size-grid-sheet`, `pb-safe`. Product: `pdp-split` (55fr 45fr),
`quote-grid` (5fr 7fr), `qty-grid` / `qty-grid-wide`, `similar-track` / `similar-grid`.

**Spacing** — no tokens needed. The artboards sit on a 2px grid whose every value is reachable from
Tailwind's default 4px step; `p-px`, `p-0.5`, `p-1.5`, `p-2.5`, `p-3.5` cover the odd ones. **No arbitrary
values anywhere in `src/`.**

---

## §10. Owner instructions, verbatim (archive)

Rule §1.6: owner rulings are quoted exactly. The register in root `llm.md` §5b carries the quote beside
each decision from D23 on; these are the originals from session 1.

The opening brief:

> I have added the design which needs to be made into UI code under this path
> `/Users/raghavvirmani/platinum-wheels` and using this skill start implementing the UI and you are an
> orchestrator so deploy sub agents who will do the task and we coordinate between them ask questions if
> needed
>
> `/design-to-code init`

Two standing instructions came out of that and still hold: **act as orchestrator and delegate to
sub-agents**, and **ask when something is genuinely ambiguous** rather than guessing (§3).

Mid-session the spec was replaced — `@…/Downloads/DESIGN.md updated design.md` — which is why
`design/DESIGN.superseded-cinematic-red.md` is kept.

A data export was supplied with permission to source the hero:

> also adding an export of data to proceed. you can fetch the hero image from net

Followed immediately by a scope correction. **This one is binding — see §12:**

> these are wheels not tires, use as reference. dont make changes pr decisons based on these

---

## §11. Decisions D1–D22 — canonical text, frozen

This section is **never edited**. Root `llm.md` §5a lists these by ID and points here for the full text.
New decisions continue from D23 in root `llm.md` §5b; IDs are global and are never renumbered.

### 11a. Owner rulings (verbatim answers)

| ID | Question | Answer | Consequence |
|---|---|---|---|
| **D1** | DESIGN.md described "Cinematic Dark" (`#000000` + racing red `#e10600`); every artboard exports "Track Night" (`#0B0B0D` + acid lime `#C9F23A`). Which is the source of truth? | **"Artboards — Track Night (lime)"** | Tokens taken from artboard computed styles. *Later dissolved entirely*: the replacement DESIGN.md documents Track Night directly, so spec and artboards now agree on colour. |
| **D2** | The skill mandates `src/app`; the repo was a fresh create-next-app with root `app/`. | **"Migrate to src/ (skill-compliant)"** | `app/` → `src/app/`, plus `src/features/`, `src/components/{ui,site}/`, `src/lib/`. `@/*` → `./src/*`. |
| **D3** | Not a git repo. The skill's workflow commits per section. | **"No git — just write files"** | No commits, no rollback points. This file + `design/reports/` + `design/DEVIATIONS.md` are the audit trail. The superseded spec is kept as a file for the same reason. |
| **D4** | The artboard hero hotlinks a Ferrari F40 photo from `vossenwheels.com`. | **"Licensed stock, sourced by me"**, later **"you can fetch the hero image from net"** | **Done.** `public/images/photos/hero-tread.webp` — Unsplash `CTwQiFlpgrM`, Rob Wingate, tread macro. The first candidate was rejected for carrying `PIRELLI`, `PORSCHE` and a Porsche crest. See `design/ASSET-CREDITS.md`. |
| **D5** | DESIGN.md called one-accent-per-frame inviolable; every artboard breaks it. | **"Artboards — drop the rule"** | *Also dissolved*: the replacement spec softened it to "judge by the frame, not the component… in an otherwise quiet grid the badge and CTA are far enough apart to coexist." The artboards are compliant under that wording. **Do not demote a second accent.** |
| **D6** | DESIGN.md §8 specifies a 64px sticky mobile PDP buy bar; the artboard has none but reserves 120px footer padding. | **"Don't build it — artboard wins"** | *Also dissolved*: the replacement §8 drops the sticky bar. Spec and artboard now agree. |
| **D7** | The spec asks for header elements the artboards don't contain: 40px badge + text wordmark, phone in tabular + ghost `GET A QUOTE`, and a fifth `Services` nav item. | **"Artboards as drawn"** | 64px badge image, no wordmark, one accent-bordered `Call 647-989-6178`, four nav items. No dead `Services` link. → DEVIATIONS #11. |
| **D8** | WCAG 1.4.11 control-boundary contrast failure. | **"do whats best"** | Delegated. Took the targeted fix — see D14. |
| **D9** | The wheel CSV — how should it be used? | **"use as reference. dont make changes pr decisons based on these"** | Parked. No code, type or design decision derives from it. See §9. |

### 11b. Derived rulings (made under the authority chain, not asked)

| ID | Decision | Reasoning |
|---|---|---|
| **D10** | **Breakpoints come from DESIGN.md §8 only: 400 / 720 / 1100 / 1320.** Tailwind `xs: sm: md: lg:`. | The seven exports contain **zero `@media` rules** — they're fixed snapshots at 1440 and 390, so crossovers are not derivable from them. All three extraction agents independently flagged this rather than inventing numbers. |
| **D11** | **Container capped at 1344px**, not the spec's 1320. | The exports declare no `max-width` at all; 1440 − 2×48px padding = exactly 1344. 1320 would make side padding 60px and miss every measured x-offset by 12px — outside the ±4px parity threshold. → DEVIATIONS #3. |
| **D12** | **Chips are radius 0**, not the spec's 2px. | Chips declare no `border-radius` while the Sort select and Apply button *in the same row* do declare `--radius-ctl`. Deliberate, and radius is exact-match for parity. → DEVIATIONS #5. |
| **D13** | **Button tracking `.08em` / `.04em`**, not the spec's `+0.06em`. | `.06em` occurs 14× across the exports and **never once on an element with a height** — every instance is a `500 13px/1` inline label such as the card `from`. The spec was describing a label. → DEVIATIONS #6. |
| **D14** | **New token `--border-control: #69696F` on form controls only.** | WCAG 1.4.11 wants 3:1 against every *adjacent* colour. `--border-strong` gives 1.35:1 against the field fill it encloses, and the fill is only 1.10:1 against the panel — nothing identified the control. `#69696F` is the lowest value clearing 3:1 on all three (3.01/3.31/3.61). Scoped to inputs/selects/textareas; card edges and dividers stay as drawn. → DEVIATIONS #14. |
| **D15** | **Mobile textarea forced to 16px** (artboard draws 15px). | Below 16px iOS zooms the viewport on focus. On a quote-first site the form *is* the funnel. The 1px is invisible; the zoom is not. → DEVIATIONS #12. |
| **D16** | **Focus ring offset 0** (the one focused field in the exports draws `-1px`). | DESIGN.md §4 says "no offset" twice and the global `:focus-visible` implements it. One element in one export is weaker evidence than a twice-stated rule. → DEVIATIONS #13. |
| **D17** | **Hover scoped to `@media (hover: hover)`** (Tailwind `hover:` does this natively in v4). | The mobile exports ship 22 `:hover` rules, but a CSS hover sticks after tap on touch. Device-capability fix, not a design change. → DEVIATIONS #10. |
| **D18** | **Routes: `/`, `/results`, `/products/[slug]`, `/styleguide`.** | Every `href` in all seven exports is `"#"` — no route is drawn anywhere. Breadcrumb reads `Home / Results / <name>`. `/products/` is plural by convention; the card derives both its links from one pair of constants at the top of `product-card.tsx`, so changing the shape is a one-line edit. |
| **D19** | **Product cut-outs normalised to one square canvas** (trim to content → scale to 88% of a 1000px canvas → centre). | DESIGN.md §4 requires it; the sources ranged from 470×439 to 1776×1704. The script **refuses to upscale** — two images can't reach the target and are logged as a client blocker rather than shipped blurry. |
| **D20** | **Self-host Barlow + Barlow Condensed; drop Michroma, Manrope, Barlow Condensed 600.** | All three are requested by the exports' Google Fonts `<link>` and referenced by **zero** `font-family` declarations — export artefacts. Self-hosting is an HLD requirement. → DEVIATIONS #2. |
| **D21** | **Price suffix is per-context**, verbatim: cards read `/ tire`, the PDP reads `per tire · before tax`. | Both artboard-verbatim. The HLD originally over-generalised to `/ tire` everywhere and was corrected to match. |
| **D22** | **Desktop copy used at all widths**; the contact photo panel is hidden below 720px, not removed. | Mobile drops the word "proper" from one sentence and omits the contact panel. Serving different body text per viewport needs duplicated DOM, which splits indexable content. → DEVIATIONS #8. |

---

## §12. Reference — the wheel CSV (D9)

`~/Downloads/PLATINUM WHEELS AND TIRE SOLUTIONS_wheel.csv` was supplied on 2026-09-20 as **reference
only**: *"these are wheels not tires, use as reference. dont make changes pr decisons based on these."*
**No code, type or design decision derives from it**, and none should without a new instruction. An ingest
pipeline was about to be proposed and was dropped.

Recorded so a future session knows what it is and does not re-profile it:

- 11,414 rows, 14 manufacturers, 0 duplicate SKUs, 466 distinct Manufacturer+Model.
- It is a **wheel** feed (diameter × width, bolt pattern, offset, finish) from the AutoCountry distributor
  and contains **no tires**, while the design sells tires. That gap is unresolved and is a question for the
  owner if real catalogue data is ever wired up (root `llm.md` §7.3).
- 2,495 of 11,414 in stock; MAP $147–$1,705 on the in-stock subset; 347 distinct images, all on the
  distributor's S3.
- **Two hazards if it is ever ingested.** `Cost` is confidential wholesale pricing on 10,959 rows and must
  be stripped **at the ingest boundary**, not merely left unrendered — anything reaching a client payload
  leaks. `AC-OAK`/`AC-EDM`/`AC-MTL` are stock counts, which `docs/decisions.md` §7 forbids displaying; they
  may only be reduced to a boolean.
- `Lug Type` is **corrupted** — values are `''`, `'0'`, `'2500'`, `'3200'`, `'Conical'`, i.e. numbers that
  look shifted in from `Max Load lbs`. Do not render it.
