# Fitment: parked items (D155), all ruled (D156)

The fitment build session (D155) parked 13 items for the owner. The owner ruled every one on 2026-10-06; the
rulings are root `llm.md` **D156**, quoted verbatim there. Nothing is waiting on the owner. What each ruling
left in place, so a later session does not reopen it:

| # | Item | Ruling | What stands |
|---|---|---|---|
| 1 | Model years before 2005 | Keep 2005 as the floor | The finder starts at 2005; Auto Country was crawled from 2005 |
| 2 | Lift and levelling sizes | Not now | Stock (lift 0) ranges only; no lift selector |
| 3 | TPMS frequency | Out of scope; follow Auto Country's on/off | Auto Country's per-car TPMS on/off drives the TPMS sensors' Best/Similar split; no frequency |
| 4 | Wheel spacers | Not for launch | The 67 spacers state nothing the finder checks, so they stay Best for every car |
| 5 | Home "checked to fit" line | Fine for now | Unchanged (D140) |
| 6 | Wheel Works login | Only if a gap needs it | None does: the remaining blanks are cars no vendor lists (centre-lock exotics, commercial vans) |
| 7 | Direct Auto Import data | Only if needed | Not needed: its public lookup filled the gaps it covers (about 1,300 targeted requests) |
| 8 | Model names | Familiar names | `Mazda3`, `Model 3` and the like; maker capitals (`LYRIQ`, `TITAN`) stay; Auto Country's bare spellings are aliases |
| 9 | 2015 Tacoma base truck | Coordinator's call | 5x114.3 added beside Auto Country's 6x139.7, as Auto Country itself has for 2005-2014 |
| 10 | Years with no North American car | Drop them | Listed in `scripts/data/vehicle-exclusions.csv`; the finder no longer offers them |
| 11 | Wheel bore smaller than the hub | Keep as Similar | Unchanged |
| 12 | Two-bolt-pattern line | Keep | Unchanged; on `/styleguide` |
| 13 | Lift and UTV sizes no stock car reaches | Coordinator's call | Left as they are: findable through filters and search, not from the finder; revisit with #2 |

Add a new item here only for a new question the owner must answer, with what was done meanwhile and a
recommendation, and delete it once ruled.
