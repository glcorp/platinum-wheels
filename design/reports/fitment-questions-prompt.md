# Fitment data: the owner-questions session

A prompt for a new session whose job is to settle the vehicle finder's fit data as far as free sources
and the owner's rulings allow. It asks the owner questions one at a time, then builds what the answers
allow. State it starts from: D149 (2026-10-05) and `scripts/data/llm.md` Open.

Copy everything inside the block into a new session in this repo.

```text
We are settling the Platinum Wheels vehicle finder's fit data as far as we can before and after launch.
You are the coordinator: you ask me the questions, decide nothing that is mine, and delegate any build
or research to SONNET subagents on disjoint files. You keep the single browser pane and all builds.

READ FIRST, in order:
1. Root llm.md: D27, D48, D110, D149 (the fitment row), and §1 (library rules).
2. scripts/data/llm.md (the three CSVs, sourcing rules, Open list) and scripts/llm.md (vehicle-fitment).
3. src/features/finder/llm.md and src/features/results/llm.md (how a vehicle filters each category).
4. design/reports/launch-fixes.md, the LA-05 lines, and design/reports/launch-audit.md (search
   "fitment", "Best matches", "checked to fit").

WHERE IT STANDS (2026-10-05, D149):
- Wheels: real bolt patterns for 6,859 of 7,528 offered model-years (ANKUSI exact year 1,224; generation
  rows 3,979; nearest real year 1,656). 167 sit in `unknown` ranges (Ram 1500 2019-2024, Bronco 2023+,
  pattern changes, single-source dissents) and filter nothing; 502 have no data. Most generation rows rest
  on autofiles + boltpatternhq, which likely share upstream data; ~70 rows have an independent shop or
  wheel-maker source. 2025-2027 is mostly nearest-year. Matching uses bolt pattern only (bore mostly
  blank, offset and diameter unchecked).
- Tires: no real factory sizes. The 60 D48(4) sample vehicles carry placeholder sizes (owner: "Keep
  placeholder for tires"); every other vehicle filters no tires.
- Accessories: lug thread and TPMS frequency are placeholder for the same 60 vehicles.
- Standing rules: free sources only; no Wheel-Size.com data or anything derived from it (tirewheelguide.com
  banned; boltpatternhq.com allowed by owner ruling); ANKUSI used with no credit on the site; two sources
  per row; no bulk scraping; never log in to a vendor site.

ASK ME, ONE QUESTION AT A TIME (AskUserQuestion), each with two lines of context (what and why) and your
recommendation first. Skip any question an earlier answer makes moot. Suggested order:
1. Tire sizes: the biggest gap. Options to put to me: (a) a hand-kept sheet from manufacturer pages for the
   best-selling models in Canada (say how many models, which years, rows per model, hours of work, and who
   fills it: an agent from public manufacturer spec pages, or the co-founder); (b) a licensed source (list
   the free/cheap ones you can verify today with price and licence, and say plainly that Wheel-Size was
   declined in D110); (c) keep the placeholder; (d) stop the vehicle filtering tires at all and use the
   finder only for wheels and accessories.
2. Depending on 1: scope (model list, year range, trims), and what a tire "best match" means when a model
   has several factory sizes (any of them, or ask the shopper's trim).
3. The 60 vehicles' placeholder tire sizes: keep until replaced, or remove now (the audit found they match
   no real trim).
4. Lug thread and TPMS frequency for accessories: a source, keep the placeholder, or stop narrowing
   accessories by vehicle.
5. Wheels, beyond bolt pattern: should centre bore (hub rings) and offset/diameter range count in "fits",
   or stay information only? Show me how many wheels each would drop for 3 popular vehicles first.
6. The two-trucks-under-one-name cases (Ram 1500 vs 1500 Classic 2019-2024, Bronco vs Bronco Raptor 2023+):
   split them into separate finder models, ask a trim question, or keep "unknown" (no filter).
7. 2025-2027 and the 502 no-data model-years: research again as sources publish, hide those models from
   the finder, or leave them showing every wheel.
8. Verification: a phone or in-store check of the top 20 models with a tire shop (give me the list and a
   one-page checklist), or accept the aggregator rows as they are.
9. Vendor route: ask Direct Auto Import whether its per-wheel vehicle list (ShowApplication) or a fitment
   feed can be shared with resellers; draft the email for me to send, never send it yourself.
10. The site's wording: the hero says "checked to fit"; given the answers above, keep it, or soften the
    copy near the vehicle chip.

THEN BUILD what the answers allow, through scripts/vehicle-fitment.mjs and its CSVs (the build validates
sources and fails on a banned domain), and verify on a production build (`npm run build && npx next start`,
never next dev, D88) against a local copy of the catalogue: real counts for a few vehicles per category,
hit-tested in the browser. Run `npm run test:e2e:fixture` before you finish.

RECORDS: same-change llm.md updates (rule §1.2); owner answers quoted verbatim with the date; one new
root llm.md §5b row (next free ID at commit time, check origin/main and open PRs, D98); update the Open
lists in scripts/data/llm.md and src/features/finder/llm.md. Commit only when I ask.

END STATE: every question answered or explicitly parked by me, whatever was buildable built and verified,
the Open lists current, and a short list of what still needs me or the client.
```
