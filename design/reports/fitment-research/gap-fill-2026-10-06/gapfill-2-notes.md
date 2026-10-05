# gapfill-2 notes
Sources: wheel-size.com (tire/wheel sizes only; PCD, bore and thread are gated, then HTTP 405 after ~8 pages, so I stopped), wheel-sizes.com, wheel-size pcd pages, Volvo support page, Audi USA, BMW/Continental listings, aggregator summaries via WebSearch.
Not filled: Rivian EDV-900 (5 rows). Search summaries conflicted (R1 is 5x127; one summary said 6x139.7 for EDV-500/700, page blocked by a bot gate), and there is no EDV-900 in the sources. Left out rather than guess.
Centre-lock cars (LaFerrari, Aventador, 718 Spyder RS, Carrera GT): fastener=nut, thread blank on purpose (aggregators print M14x1.5 which is not a lug thread).
Low-confidence rows: BrightDrop 400 bolts (inferred from AC bore 116.7), Audi Q9 5x112/66.5/14x1.5 (inferred from Q7/Q8/A5), bZ Woodland and EX60 thread (inferred from bZ4X / EX90), LCF thread blank (M14x1.5 vs M20x1.5 conflict).
Finder oddities: BMW ActiveHybrid 5 2018 is really the G30 530e; 640xi 2018-19 treated as 640i xDrive Gran Turismo (5x112); 2023 Trax is the new generation (5x115, not 5x105); 2024-25 718 Spyder = Spyder RS.
Savana centre_bore holds two values ("78.1;116.7") in the same order as the bolt patterns in `have`.
