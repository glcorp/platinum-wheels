# gapfill-3 notes (D155)

Rows written: 54 of 71 input model-years. 17 left out, nothing found: Chevrolet BrightDrop 600 2025-26 (2) and Spyker C8 2005-2019 (15).

## Filled vs still blank, by needed fact (of the input counts)
- bolts: 17 of 50 filled (14 "no NA car" rows are blank by design, and BrightDrop/Spyker 17 not found, centre-lock Saleen and Centenario have no bolt pattern)
- bore: 20 of 34
- thread: 37 of 71
- fastener: 40 of 71
- tire_sizes: 24 of 38
- wheel_sizes: 22 of 38
(The no-NA-car rows count as unfilled: BMW M2 2022, Suburban HD x4, Cirrus 2006, GT MKII x5, FCX Clarity 2005-07 x3 = 14.)

## Single-source share
8 w1 rows (SQ9, Mustang GTD x3, Ioniq 9 x2, Saleen S7 x2) and 4 m1 rows (Wagoneer S) = 12 of 54 (22%). Three of the w1 groups carry an INFERRED value, flagged in note: SQ9 bolts/bore/thread (from Q5/SQ7), GTD thread (from S650 Mustang), Ioniq 9 thread (ANKUSI plus Ioniq 5 sources).

## Contradictions with `have`
None. `have` values were bolts/bore only for M3Ci (5x120, I match), Mustang GTD (5x114.3/70.5), Ioniq 9, Wagoneer S, Clubman, Buzz; I did not change any.
Bad `have` data to know about: Lamborghini Centenario has bolts "12x112", bore "0" in the Auto Country file. That is a centre-lock car; I filled fastener nut and left bolts blank. Saleen S7 and Spyker C8 also carry bore "0".

## Conflicts between sources (also in the row notes)
- Wagoneer S thread: maker manual M14x1.50 (used) vs ANKUSI 1/2x20.
- Mustang GTD thread: ANKUSI M12x1.5 vs S650 platform 14x1.5 (used, inferred).
- Ioniq 9/5 thread: ANKUSI and bonoss M12x1.5 (used) vs Auto Country Ioniq 5 14x1.5.
- MINI Clubman 2008 thread: Auto Country 12x1.5 (used) vs minimania/autofiles 14x1.25.
- M235 tires: Mavis 2026 225/45R18 (used) vs Auto Country 2022-24 225/40R18.
- Rivian RCV-500: Road Ready prints "6-139.7"; used 5x139.7 (R1 platform, lugboltpattern).

## Not found
- BrightDrop 600: bolt pattern, thread and wheel width not on any page reachable (owner manual and fleet guide PDFs refused or silent). Auto Country bore 116.7 hints at GM 8x165.1 but nothing confirms it.
- Spyker C8: no fitment page found for any year.
- Rivian R2 19in wheel width.

## Method notes
- wheel-size.com refused fetches (HTTP 405), so its figures come only through search-result summaries (FCX Clarity, R2). Used with the owner's permission, a handful of pages.
- Wagoneer S thread is from the maker's owner manual PDF (downloaded once, text-searched locally, file deleted).
- Rows use the finder's names. "no NA car" rows: M2 2022, Suburban HD 2024-27, Cirrus 2006, GT MKII 2023-27, FCX Clarity 2005-07.
