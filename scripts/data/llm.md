# scripts/data

## Purpose
Reference data that a script writes or reads and that is committed, so a change to it is a diff someone
can review. Delete this folder and the vehicle finder has no Year / Make / Model list to load.

## Owns
- [`vehicles.csv`](vehicles.csv) — every make and model the finder offers, with the model years it was
  built. Written by [`../vehicles-fetch.mjs`](../vehicles-fetch.mjs) from NHTSA vPIC; 47 makes, 843
  models, model years 2005–2027 as fetched 2026-09-30. Columns: `make`, `model`, `years` (ranges
  joined by `;`, e.g. `2005-2011;2019-2027`), `types` (vPIC's `car` / `mpv` / `truck`, joined by `;`).

## Rules
- **`vehicles.csv` is generated. Never edit it by hand.** A wrong, missing or misnamed model is fixed
  by a rule in `vehicles-fetch.mjs` (`EXCLUDED`, `RENAMED`, `SPLIT`, `ADDED`) and a re-run, or the next
  run puts the mistake back.
- **It carries no tire size and no bolt pattern.** vPIC has neither, and no open data set does
  (checked 2026-09-30: NRCan, EPA and Transport Canada carry none). Fitment is a separate, hand-kept
  sheet, keyed on this file's exact `make` and `model` spelling.

## Decisions
| ID | Date | Decision | Why | Authority |
|---|---|---|---|---|
| — | — | No folder-scoped rows. | **D110** governs this folder. | root `llm.md` §5b |

## Connects to
- Depends on: `scripts/vehicles-fetch.mjs` (the writer).
- Depended on by: nothing yet — see Open.

## Don't
- Don't add a heavy-duty pickup back under its half-ton's name. `Silverado 1500` and
  `Silverado 2500HD` are separate rows because they do not share a bolt pattern
  (`vehicles-fetch.mjs` `SPLIT`).
- Don't treat a model's presence here as "sold in Canada". vPIC is a US register; a few rows are
  US- or Mexico-market cars that `EXCLUDED` has not caught.

## Open
1. **The fitment sheet does not exist yet.** `vehicle-fitment.csv` (one row per model and year range:
   factory tire sizes, bolt pattern, hub bore) is being filled by the co-founder from manufacturer
   sources. Co-founder.
2. **Nothing loads this file into the database yet** — `scripts/llm.md` Open #4. Owner.
