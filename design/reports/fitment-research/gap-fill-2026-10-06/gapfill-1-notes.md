# gapfill-1 notes (D155)
72 rows written (one per input model-year). 4 are "no NA car" (VinFast VF 7 2023-2025 no, VF9 2022): all fact fields blank. 1 row (Porsche 918) is note-only.
Sources used: our committed Auto Country sheet rows of sibling names (source s/s1), wheel-size.com (search snippets, direct fetch worked for 3 pages then returned 405), tiresize.com, boltpatternhq, roadreadywheels, iseecars, Honda/Ford/Kia maker pages. Many shops (go-parts, 1010tires, autopadre, customwheeloffset, martiniworks) returned 403.
Facts filled / needed: fastener 48/55, thread 43/55, tire_sizes 42/45, bore 33/39, wheel_sizes 32/38, bolts 23/29.
Single-source rows (source ends in 1): 38 of 72 (all the "analogue" rows copied from our AC sheet, plus Celestiq, Prelude, VF7 2026-27, VF9 2023-27).
Contradictions with `have`: only Maserati MCPura (have 5x114.3 / 67.1 from tirewheelguide; autofiles and wheel-sizes.com say 5x110 / 65.1). Have left alone, both in note. Porsche 918 have (15x130, bore 0) looks like a parse error; real pattern 5x130 centre-lock.
Judgement calls: VinFast VF9 thread left blank (M14x1.5 vs M14x1.25 unknown); Prelude 5x120 is single-source and thread 14x1.5 inferred; Celestiq bolts 6x132 single-source with a suspect bore (66.9); BMW 340i 2023-24 and 850i 2019 are filled from M340i/M850i rows (not "no NA car", loose).
