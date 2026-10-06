# Gap fill brief (D155 Phase 5)

Input: a JSON list of {make, model, year, need[], have{}} - model-years the finder offers where Auto Country's
lookup (our primary source) left a fact blank. Names are the finder's canonical spelling (src/features/finder/vehicle-list.ts).
need is a subset of: bolts, bore, thread, fastener, tire_sizes, wheel_sizes.

Output: ONE CSV you own, header exactly:
make,model,year,bolt_patterns,centre_bore,thread,fastener,offset,tire_sizes,wheel_sizes,source,source_url,source_url_2,note
- one row per model-year you could fill (any subset of fields; blank = unknown). Fill the needed fields; you may also fill
  others you saw on the same page, but never contradict a `have` value - if your source disagrees, put both in `note`.
- bolt_patterns "5x114.3" (ASCII x, more than one joined with ";" when trims differ); centre_bore mm "64.1";
  thread "12x1.5" (metric, no M) or "1/2x20" (inch); fastener "nut" or "bolt"; offset integer mm;
  tire_sizes "225/55R18;235/45R19" (strip P/LT and suffixes; flotation as "33x12.50R15"); wheel_sizes "18x7;19x8".
- source: d = Direct Auto Import lookup, p = PRO WHEELS lookup, m = the car maker's own page/manual/press kit,
  s = our own committed sheets or design/reports/fitment-research/, w = any other website. Append 1 when only ONE source
  supports the row ("w1"). Owner, 2026-10-06: "A value with one source only: load it directly." Two agreeing sources = no 1.
- source_url (and source_url_2 when two): the exact pages.
- Same car across a range of years with the same facts: still one row per year.
- A model that does not exist in North America that year (finder oddity): row with all fact fields blank and note "no NA car".

Rules (owner, 2026-10-06, verbatim where quoted):
- Order of trust: Auto Country, then the other vendors' public lookups, then the car maker's own pages and manuals, then our
  existing committed sheets, then any other website.
- "we have permisiion to view and use data from them so go ahead" - wheel-size.com, tirerack.com, tiresize.com and similar
  sites, formerly banned, are allowed (record it as the owner's statement). Read a handful of pages per car; no bulk copying,
  no scripts that crawl them.
- "Loose beats blank": an approximate answer, marked in `note`, beats an empty cell. Do not stall on the last spec.
- Never log in, never send credentials or an authorization header, never get past a CAPTCHA or a bot block: a refused page means
  move to the next source.
- Do NOT call Auto Country, Direct Auto Import or PRO WHEELS (one other agent owns those calls). Do NOT spawn subagents.
- Do not edit anything in the repo. Write only your CSV and a short notes file in the scratchpad path you are given.
