# Fitment data: the build session

A prompt for a new session that fills the vehicle finder's fit data from Auto Country's vehicle lookup,
fills what is left from the other vendors and the web, tests it against our catalogue and opens a PR.
It runs without waiting for the owner: anything that needs the owner is parked in a file and the work goes on.
Written 2026-10-06 from the owner's answers that day. State it starts from:
[`fitment-handoff.md`](fitment-handoff.md) and the uncommitted working tree it describes.

Copy everything inside the block into a new session in this repo.

```text
You are building the Platinum Wheels vehicle finder's fitment data, start to finish, without waiting for me.
You are the orchestrator (Opus). Every scrape, research or build task goes to SONNET subagents on disjoint
files. You keep the plan, the single browser pane, the builds, the git work and every llm.md.

THE PROBLEM
The catalogue is loaded (about 40,000 products) but the finder cannot connect a car to the right products.
For "2021 Honda Civic" the site needs five facts about the car: factory tire sizes, bolt pattern, centre bore,
factory wheel size and offset, and lug thread (nut or bolt). Our products already carry those values. The car
side is what is missing: tire sizes and lug thread are placeholder or empty, wheel size covers about a third
of cars, centre bore under half, and about 9% of offered model-years have no bolt pattern.

THE APPROACH (decided, do not reopen)
Match by spec, never by product name. Our product names were changed from the vendors', so never search a
vendor by our product name; a car's spec joined to our columns works across all five vendors.
Auto Country is our primary supplier and the source of truth. Its public vehicle lookup returns every fact
above in one answer per car. Crawl it once, build the tables from it, fill what it lacks from the other
vendors' public lookups, then from the web.

MY RULINGS (2026-10-06, verbatim; quote them in the register, "AutoPrintly" is speech-to-text for Auto Country)
- Source: "Yes, we can use AutoPrintly because that is our primary supplier and source of truth."
- Other vendors: "in case for products we don't find, you can go ahead and look for the other four vendors as
  well, whatever is available publicly. And if not, and you need login, then you can let me know."
- Conflicts: "if there is any disagreement on whatever we have already built from or live fitment data, then
  you can always put auto country data first."
- Goal: "the goal is to cover maximum products."
- Precision: "we have only commit a loose fit to the client. So you don't have to be precise to the last spec
  if major of the filters work correctly then it's good ... our aim should be to fulfill the fitment data to
  100% but loose is also fine."
- Products no car reaches: "do option 1 [list them, keep going], post we are done, got rhough the parked list
  and try to resolve them on your own once through market data."
- What counts as a match: "priority is vendor then factory. use best and similar both techniques."
- Vehicle list: "union of both is best. dont lose data."
- Auto Country pace: "go for 8 a second."
- Two bolt patterns in one model-year: "Show wheels for both patterns."
- Sites the last session banned (wheel-size.com, tirerack.com, tiresize.com and the like): "we have permisiion
  to view and use data from them so go ahead." Record it as my statement; no document is on file.
- A value with one source only: "load it directly."
- Shipping: "Commit and open a PR (Recommended)." Never merge.
- Agents: "the orchestrator would be Opus, but for everything, scraping or doing sonnet would be used and
  number of parallel agents should not go more than 10 at once in cases where we are calling auto country and
  scraping it you can go till 15 but for other tasks keep it 10."
- Autonomy: "Only disagreements where I am needed, those can be parked separately but should not wait for my
  input. The work should go on."

HOW I READ TWO OF THOSE (your working rules; I may veto them)
- "vendor then factory" = the order of trust: Auto Country, then the other vendors' public lookups, then the
  car maker's own pages and manuals, then our existing committed sheets, then any other website.
- "best and similar" = Best matches are the car's exact factory values as Auto Country lists them. Similar
  matches are everything inside the range Auto Country allows for the same car at stock height.

HARD LIMITS
- Never log in anywhere, never send a credential or an authorization header, never get past a CAPTCHA or a
  bot block. A refused request means stop that source and move on. A source that needs a login is parked.
- Auto Country: ONE script makes every call, with one shared limit of 8 requests a second. Agents never call
  Auto Country themselves. It backs off on 429 and 5xx, stops on 401, 403 or a challenge page, is resumable,
  and saves every raw answer. Other vendor sites: 1 request a second per site. Other websites: a handful of
  page reads per car, no bulk copying.
- At most 10 subagents alive at once. An agent's own helpers count, so tell agents not to spawn any.
- Nothing writes to the production database. Fitment lives in generated code, not in Postgres.
- Raw vendor answers stay outside the repo, in
  ~/Platinum Wheels Vendor Data/Individual Vendors/<vendor>/_working/. Only derived CSVs go in scripts/data/.
- Library rules hold (root llm.md §1): read each folder's llm.md before editing it, update it in the same
  change, quote me verbatim, label your own calls "derived".
- Loose beats blank. When the choice is an approximate answer or no answer, load the approximate answer, mark
  it, and list it. Do not stall on the last spec.

READ FIRST, in order
1. design/reports/fitment-handoff.md: what the last session built (uncommitted) and found.
2. Root llm.md: §1, D48, D110, D149, D153, D154, and the D98 rule for decision IDs.
3. scripts/data/llm.md, scripts/llm.md, src/features/finder/llm.md, src/features/results/llm.md,
   src/features/catalog/llm.md.
4. design/reports/fitment-research/: the nero-probe folder (31 saved Auto Country answers) and the four
   research reports. Use the rest (gap fills, unknown ranges, partial wheel sizes) only for cars Auto Country
   lacks.

WHAT IS ALREADY KNOWN
- The lookup, anonymous GETs on https://autocountry.frb.io/frontend/v2/nero/ : years, makes/<year>,
  models/<year>/<make>, sub-model/<year>/<make>/<model>, options/<year>/<make>/<model>/<submodel>.
  An options answer has chassis { pcd, centreBoreR, rimOffset, nutOrBolt, threadType, hex, tpms on/off } and
  per body a fitments list of "17\" Option (215/50R17, 17x7)", plus lifts. Years run 1974 to 2026.
- POST /nero/vehicle-ranges returns the allowed range per car and lift (wheel diameter, width, offset, tire
  diameter and width, per axle). Its request body is not known. Work it out from the saved site scripts in
  ~/Platinum Wheels Vendor Data/Individual Vendors/Auto Country/_working/phase1/ (js_1f0vkb6uu2q8r.body,
  js_04si9o0ex1czz.body). It is a read-only lookup and is approved. Use lift 0 (stock) only.
- Checked on 9 cars against our catalogue: every car returned stocked sizes (2021 Civic 163 tires, 2022 RAV4
  274, 2019 F-150 359). Its tire sizes agreed with maker documents or retail listings on all 7 cars that had a
  second source. Bolt patterns agreed with our sheet on 8 of 9; the ninth is one we hold as unknown.
- Quirks: most trims of a model return the same list (2018 Rogue S differs from SL), so take the union per
  model-year. A size can carry a suffix ("225/65R17M+S"). Tesla "Model 3" returned no trims (name mismatch).
  2016 Equinox bore is 66.1 there and 66.9 in our sheet: Auto Country wins. The last session's two reports
  contradict each other on the 2015+ F-150 lug thread; Auto Country says M14x1.5 and wins.
- Catalogue for offline counting: ~/Platinum Wheels Vendor Data/combined/share/output/catalogue.csv
  (category is tires / wheels / accessories; bolt_patterns holds "5x114.3/5x120", split on "/").
- The working tree sits on branch pdp-gallery-phone-width, whose last commit is not on origin/main. The last
  session's thread and gap-fill-A agents left no result files. A throwaway Postgres from that session may
  still run (pkill -f db-server.mjs).

THE WORK

Phase 0, set up
- Fetch origin. Move the uncommitted fitment changes onto a new branch cut from origin/main (they touch only
  fitment files; confirm with git diff before moving). Check origin/main and open PRs for the next free
  decision ID (D98).
- Create design/reports/fitment-parked.md now. Every parked item gets: what, why it needs me, what you did
  meanwhile, and your recommendation. Seed it with: pre-2005 model-years from Auto Country's list, lift and
  levelling sizes, TPMS frequency, wheel spacers, the home page's "checked to fit" wording, and any login.

Phase 1, crawl Auto Country (start it first, run it in the background, do Phase 2 design meanwhile)
- Write the crawler as a script under scripts/ (.mjs, as the others). Crawl years 2005 to 2026, every make,
  model and submodel: the lists, then options for every submodel, then vehicle-ranges at stock once the body
  is known. Try vehicle-ranges on 5 cars before the full run; if it cannot be called anonymously, park it and
  use the fallback in Phase 3.
- Save raw answers to .../Auto Country/_working/nero/. Write a run log with counts, refusals and gaps.

Phase 2, build the tables
- Vehicle list: the union of Auto Country's list and scripts/data/vehicles.csv, 2005 to 2027. One car, one
  entry: where both lists have the same car under two names, Auto Country's name wins and ours becomes an
  alias so old URLs still resolve. Nothing offered today disappears. Keep how each entry was sourced.
- Per model-year, from Auto Country: bolt pattern(s), centre bore, lug thread, nut or bolt, the union of
  factory tire sizes, the union of factory wheel sizes, the offset, and the stock range. Derived CSVs in
  scripts/data/, generated into src/features/finder/vehicle-fitment-data.ts by scripts/vehicle-fitment.mjs.
- Auto Country overrides every existing row it disagrees with. Write each override to a diff file and count
  them in the report; do not ask me.
- A 2027 car, or a year Auto Country skips, takes the model's nearest year (the D149 rule), marked as such.
- The fit lookup stays server-only. Measure the gzipped size of / and /tires before and after (23 KB today).
  If the bigger list adds more than 10 KB, load models per make on demand, or park it with numbers.

Phase 3, matching rules (build on the uncommitted code; these are the defaults, mark them derived)
- Tires: Best = an exact factory size for that model-year. Similar = inside Auto Country's stock range. With
  no range data, Similar falls back to the last session's rule in src/features/finder/tire-fit.ts.
- Wheels: the bolt pattern must match, as today. Best = also inside the stock range for diameter, width and
  offset, with a bore at least the car's hub. Similar = right bolt pattern, outside the range or bore unknown.
  A wheel whose bore is smaller than the hub goes to Similar; whether to hide it is parked.
- Two bolt patterns in one model-year: show wheels for both, with one plain line telling the buyer to check
  their trim. New copy follows .claude/rules/ui.md "Copy"; park the wording for my veto and put the state on
  /styleguide.
- Lug nuts, lug bolts, wheel locks: by thread, and by nut or bolt. Hub rings: by hub bore (built). A product
  that states nothing stays a Best match (the D67 rule).
- A car with no data filters nothing, as today.

Phase 4, test against our catalogue (this is the proof)
- Offline first: for every model-year, count Best and Similar tires, wheels, lug hardware and hub rings from
  the catalogue CSV. Then the reverse: every product, and whether at least one car reaches it.
- Write design/reports/fitment-coverage.md: share of model-years with each fact and where it came from;
  cars returning zero tires, zero wheels or zero lug hardware; products no car reaches, grouped by reason
  (off-road size, rare bolt pattern, universal part); every override of live data.

Phase 5, fill the gaps (Sonnet agents, at most 10, disjoint car lists, each writes its own CSV)
- Cars Auto Country lacks, in this order: (1) the other vendors' public lookups: Direct Auto Import
  (ajax/GetYears, GetMakes, GetModels, GetSubModels, GetOptions, and ShowApplication.php?reference=<their
  SKU>), PRO WHEELS (wheelsapi.com get-wheels-by-vehicle and verify-fittment); Wheel Works needs a login, so
  park it; Vertex has nothing more. (2) The car maker's own pages and manuals. (3) Our existing sheets and the
  research folder. (4) Any other website, the formerly banned ones included.
- One source is enough. Every filled row names its source and is marked "single source" when it has one.
- Also spot-check about 50 of our wheels on Direct Auto Import or PRO WHEELS (by the vendor's own SKU from
  product_sources, never our name): does the vendor say it fits the cars our rules say it fits? Report the
  agreement rate. Disagreements are a list, not a blocker.
- Re-run Phase 4 after the fill.

Phase 6, site test and ship
- Real database: FIXTURE_DB_PORT=55701 node tests/fixture/db-server.mjs, scripts/db-migrate.mjs, then the
  importer on a catalogue built with npm run catalog:build-csv. npm run build and npx next start, never dev.
- In the browser at 390 and 1440: /tires, /wheels and /accessories for at least 15 cars across classes
  (Civic, RAV4, F-150, Ram 1500, Outback, a BMW with lug bolts, a two-pattern car, a 2027 car, a car with no
  data). Counts must equal the offline counts. Hit-test, no horizontal overflow, no console errors.
- npm run check, then npm run test:e2e:fixture. Fix what you broke; a test that asserted the old placeholder
  is updated, not deleted.
- Docs in the same change: every llm.md you touched, scripts/data/llm.md's sourcing rules (they change:
  Auto Country first, one source enough, the old ban lifted by my statement), root llm.md (one new §5b row,
  D110 and D149 marked amended in place), design/DEVIATIONS.md for any shipped difference, HANDOFF.md,
  todo.md for anything that is mine.
- Commit on the branch, push, open a PR with the coverage numbers and the parked list. Do not merge.

Phase 7, the parked list
- After the PR is open, go through fitment-parked.md and the "no car reaches it" list and resolve what market
  data can resolve (brand sites, retailer fit guides, lift and plus-size charts). Push the results to the same
  PR. Leave for me only what truly needs me, each with your recommendation.

DONE MEANS
- Every model-year in the finder has a bolt pattern, tire sizes and a lug thread, or is on a short list
  saying why not. Target 100%; a loose value counts.
- The coverage report, the parked list and the PR exist, and the final message gives me: coverage before and
  after, how many live rows Auto Country overrode, what is parked, and what you could not verify.
- Say plainly what was not tested. Never write that fitment is "checked" or "guaranteed" anywhere on the site.

KEEP GOING
Do not stop to ask me anything. If a source blocks you, a call fails or a rule here does not cover a case,
make the loose, reversible choice, write it in fitment-parked.md and carry on. Stop only when Phase 7 is done.
```
