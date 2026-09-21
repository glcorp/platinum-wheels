# Deviations sweep — 2026-09-21

Every row of `design/DEVIATIONS.md` traced against the code that is actually shipping, and against the
frozen artboards it cites.

**Why this exists.** The D56 audit traced 18 of the then-43 rows and said plainly that the rest were
*untested, not certified clean* (`audit.md` §6). Untested rows are not harmless: row **#41** specified
the wrong utility (`tap-extend` where the code uses `tap-extend-lg`) and miscited row #16's arithmetic as
precedent, and nothing caught it until the audit went looking. A row that has quietly stopped describing
the code is worse than no row, because it is read as authority.

**Scope.** Rows **#1–#43**, the legacy set. Rows **#44–#57** were written by D57, D58, D61, D62 and D63
and verified as they were written, so they are not re-traced here.

**Method.** Two agents did the static half on disjoint ranges — for each row: does the code still do what
"Code does" says; is the "Design says" half still accurate against the frozen artboard; do the row's
cross-references to other rows and to decision IDs resolve. Anything whose truth depends on rendered
geometry was handed back as UNVERIFIABLE with a named page, selector and property, and measured in the
browser by the coordinator against the `:4000` artboard baseline. **No agent was given the browser** —
there is one shared pane (`HANDOFF.md` §3).

**Verdicts.** CONFIRMED · STALE (broadly right, a detail has drifted) · WRONG (does not describe the
code) · MEASURED (needed a browser probe; result recorded).

---

## Result

**43 rows traced. 0 WRONG. 3 STALE, all corrected in place. 1 measured.**

The headline is that nothing in the file misdescribes the code. The three stale rows had drifted in
their *supporting evidence*, not their conclusions — which is the failure mode worth knowing about,
because a row with a true conclusion and a false reason still reads as authority and still gets cited.

### Rows #1–#24 — shared and home

21 CONFIRMED, 3 STALE. The three are corrected in `DEVIATIONS.md` rather than noted here, per library
rule §1.8 — a superseded row is updated in place and never struck through.

| # | Was | Now |
|---|---|---|
| **5** | Listed **four** differences: height, radius, size and `border` — the last claiming the spec says `1px --border` against the code's `1px --border-strong` | `DESIGN.md` §4 "Chip (filter)" actually reads **`1px solid --border-strong`**, the same token the code uses. **The border was never a deviation**; the row was stating a difference that does not exist. Dropped from the title and both columns; the row is now three differences, all real |
| **6** | Supported its conclusion with "`.06em` occurs **14 times** across the exports and **never once on an element with a height**" | Both halves false. It occurs **34** times, and **two 44px-tall controls carry it** — the `results-mobile` sticky bar's `Filters (3)` and `Sort` (`results-mobile.html:99-100`). Verified by grep, twice. The conclusion survives, because neither is built from the `Button` primitive, but it now rests on evidence that is true |
| **23** | Justified `object-center` on the Tires tile by saying the crop difference was harmless *because the tile drew a product cut-out on a transparent canvas, so the crop only moved empty margin* | **Superseded by #57 (D63) the same day this sweep ran.** The tile now draws a full-bleed photo at `object-cover`, where a focal point genuinely would crop the subject. The class still ships and still has no token alternative, so the row stands — but it now points at #57 for the reason. The matching stale comment in `category-tiles.tsx` was corrected too |

Row **#1**'s served-size figure (13.0KB at 390px) rests on a dated, sourced record in `ASSET-CREDITS.md`
rather than a fresh measurement. That is recorded here rather than silently accepted.

### Rows #25–#43 — `/results` and the PDP

**All 19 CONFIRMED. No WRONG rows, no STALE rows.**

This range was the one most disturbed today: **D58** rebuilt `/results` into a three-category engine
sharing one composition across `/results`, `/wheels` and `/accessories`, and **D63** consolidated 13
class-merge helpers into `src/lib/cx.ts`. Neither broke a claim in any of these rows. The rows that
describe a mechanism now shared across three categories — the facet counts (#25), the category rows,
the `Change vehicle` disclosure (#34), the breakpoints (#33) — were already worded to describe the
mechanism rather than the single page, so they stayed true when the mechanism generalised. That is worth
noticing: the rows survived because they were written about behaviour, not about line numbers.

Spot evidence, one per cluster:

| # | Verdict | Traced to |
|---|---|---|
| 25 | CONFIRMED | `search.ts` `priceFacet` floors/ceils the tire seed's 99–149 to `$90–$150`; brand counts Zeta 2 / ZMAX 5 / Mazzini 2 computed, never typed |
| 28 | CONFIRMED | `sort-select.tsx` and the size selects both carry `border-border-control` — D14's scoping still holds |
| 33 | CONFIRMED | `RAIL_FROM = "(min-width: 1100px)"`; the row's own arithmetic re-derived: at 768 a 2-up card is (768−64−16)/2 = **344px**, exactly as claimed |
| 38 | CONFIRMED | `quote-form.tsx` puts `border-l` on segments after the first only — the artboard's trailing `border-right` is still not ported (D53(7)) |
| 41 | CONFIRMED | all three crumb sites use `tap-extend-lg`; `globals.css` defines it at ±16px. The row D57 corrected is now accurate |
| 43 | CONFIRMED | four `next/link`s setting `?qty=`, selected one carrying `aria-current="true"` |

### #30 — measured, not asserted

The one row in the range whose claim could not be settled from source. It says the mobile sort control's
text "lands ~2px left of the drawn cluster".

Measuring the two **boxes** says zero: the artboard's `<span>` and the app's `<select>` are both
`x=199, w=175`. That comparison is wrong, and it would have marked a correct row incorrect. The artboard
centres text **and** chevron as one flex cluster; the app centres text alone inside a `pl-2 pr-9` content
box with the chevron absolutely positioned. The like-for-like comparison is the artboard's **text node**
against the app's **content-box centre**:

| | x | width | text centre |
|---|---|---|---|
| Artboard `results-mobile` text node | 217.3 | 114.4 | **274.5** |
| App `#results-sort-bar` content box | — | — | **272.5** |

**2.0px left. The row is exactly right.** Recorded in `HANDOFF.md` §8.24 as a measurement trap.

---

## What this pass did not cover

- Rows **#44–#57**, verified when written (D57, D58, D61, D62, D63).
- The **two artboard-side halves** of any row are checked for citation accuracy only. The artboards are
  frozen, so a "Design says" claim can be mis-cited but cannot have changed.
- Rendered-geometry claims not flagged by the static pass. A row that *reads* like a code claim but is
  really a pixel claim would pass this sweep; #30 was caught because its wording is explicitly numeric.
