# gapfill-5 notes

71 input rows, 71 output rows. 8 are "no NA car" (GMC Canyon 2013/2014, Mitsubishi Diamante 2005, VinFast VF 6 2023-2027).
Most rows (siblings in scripts/data/vehicle-fitment-autocountry.csv: BMW, Audi, Yukon XL, G-Class, Ram 4500) came from the committed AC sheet, not the web.

Fills of needed facts (63 non-"no NA car" rows): bolts 6/10, bore 17/20, thread 37/41, fastener 37/41, tire_sizes 37/37, wheel_sizes 25/25.
Blank: BrightDrop Zevo 2022-2024 (bolts, bore, thread, fastener; nothing published, wheel width 7.5 unconfirmed) and Spyker C12 2008 (centre-lock, no PCD/thread).
Single-source rows (source code ends in 1): 39 of 71.

Judgement calls to review
- Aston Martin Valour: fastener "bolt" (wheel-size.com, DB11 handbook) over AC sheet's "nut" (its own Valour row and DB11/Vantage rows).
- Jeep Recon thread 14x1.5 nut is borrowed from Grand Cherokee/Wrangler rows; ankusi says 1/2x20. Low confidence. Tires 265/70R18 follow Jeep's Moab spec; ankusi says 20x8.5 factory.
- Bugatti Veyron tires are the non-PAX replacement sizes (285/30R20;355/25R21); originals (265/680R500;365/710R540) are in the note only.
- Yukon XL / G-Class bore is the 5x130 or 6x139.7 hub; the 8-lug hub bore is only in the note.
- 2027 Vistiq, 2027 Recon, 2027 Uncharted, 2026 Rivian EDV assumed carryover of the prior year.
- ankusi pages (also behind the committed ANKUSI sheet) disagreed with Jeep's own spec on Recon, so they are treated as weaker than maker pages.
- Sites that refused WebFetch (405/403/402): wheel-size.com year pages (some), tiresize, bigotires, 1010tires, automobile-catalog, gmenvolve PDF.
