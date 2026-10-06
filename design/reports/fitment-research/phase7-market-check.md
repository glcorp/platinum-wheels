# Phase 7 market research (D155)

Method: web search plus wheel-size.com, wheel-sizes.com, retailer and parts pages. No vendor sites called. No repo edits.
Note: none of the 7 catalogue patterns appears anywhere in our fitment CSVs, so "what our data says" for A is "absent".

## A. Unreached bolt patterns

| Pattern | Real users (market) | Class |
|---|---|---|
| 5x135 | Ford F-150 1997-2003 (plus the 2004 F-150 Heritage), Expedition 1997-2002, Lincoln Navigator 1998-2002, Lincoln Blackwood 2002-2003, F-150 SVT Lightning 1999-2004. 2004 new-body F-150 and 2003+ Expedition/Navigator moved to 6x135. | 2 (all pre-2005; finder starts F-150/Expedition/Navigator at 2005) |
| 6x165.1 | Dodge Ram Van B350 1981-1994 and classic trucks. Modern Ram/Hummer are 8x165.1 (AC already has that). | 2 |
| 7x150 | **Ford F-150 Heavy Duty Payload Package, XL, 7-lug: 2004-2008 (P221) and 2009-2014 (P415)**; wheel-size lists 7x150 for F-150 XI 2004-2008 and XII 2009-2014, hub 87.1, M14x2.0, 17" 7-lug steel. Also F-250 1997-99, Lobo (Mexico). | **1** |
| 5x101.6 | Dodge Dart 1963-1976 only (wheel-size). Nothing 2005+. | 2 |
| 10x285.75 | Class 7/8 trucks, buses, trailers (International, Freightliner, Kenworth, Peterbilt, Volvo, Mack). Finder has none of these (Ram 4500 is 10x225 and AC already says so). | 2 |
| 10x170 | No OEM vehicle found. F-250/350 SRW are 8x170, F-350 DRW 8x200, F-450/550 8x225 (to 2010) / 10x225. Only aftermarket sellers (rimbroker, bbwheels, Summit) use "10x170" for Ford heavy duty. Looks like a vendor label (possibly a dually or adapter listing), not a factory pattern. | 3, treat as 2 (no car reaches it) |
| 4x110 | ATV/UTV only (Yamaha, Honda, Kawasaki IRS ATVs); cars only Daihatsu, Mazda RX-7 SA/FB and 626 CB (1979-85), Toyota Corolla E10/E20, Perodua. No NA 2005-2027 road car. | 2 |

### Class 1 data row (only one)
Ford F-150, years 2005-2014, field `bolt_patterns`.
- Current (`scripts/data/vehicle-fitment-autocountry.csv`, rows Ford,F-150,2005..2014): `6x135`, centre bore 87.1, thread 14x2.0.
- Proposed: `6x135;7x150`.
- Caveat: 7-lug is only the XL HD Payload Package (regular and SuperCab, 8 ft box), not every F-150. Only 2 catalogue wheels are 7x150. If added, those 2 wheels show as "Best" for every 2005-2014 F-150 owner. Judgment call; skipping is defensible because AC is the source of truth and lists patterns per model-year, not per package.
- Sources: https://www.wheel-size.com/pcd/7x150/ (F-150 XI 2004-2008, XII 2009-2014, Lobo); web search results quoting elementwheels.com "2004-2008 Ford F-150 XL Heavy Duty 7 lug" and f150online "2009-2014 HD Tow Package (7-lug)": "2014 was the last year for the 7 luggers", "all HDPP F-150s had 7-lug wheels".

### Side finding, not asked
Finder offers Ford F-450 Super Duty 2005-2025 but data has no bolt pattern (19.5" sizes only; rows in `vehicle-fitment-vendors.csv` have blank pattern). Market: 8x225 for 1999-2010, 10x225 for 2011+ (powerstroke.org, hulkoffsets, wheel-size 8x225 page "F-450 Super Duty 1999-2007"; sources disagree on 2008-2010). Not a catalogue pattern, so no action for these 7 patterns.

## B. Doubtful Auto Country values

1. **Buick Terraza 2006-2007, AC 6x115: market agrees with AC.** The 2006+ GM U-body minivans (Terraza, Uplander, Montana SV6, Relay) have 6-lug 6x115 wheels; the 2005 is 5x115. Evidence: Amazon/FKG hub 513236 "fit for 06-07 Buick Terraza ... 6 Lugs"; justanswer.com "2006 Buick Terraza 17 inch 6 hole wheels", 6x115, Montana SV6/Uplander wheels fit; bbwheelsonline URL "2006-to-2007-buick-terraza ... 6x115". The 5x115 sources (wheel-sizes.com, autofiles.com) say 5x115 for all years and look wrong for 2006-07. Our generations file already carries 5x115 for 2005-2007 (autofiles); AC's row wins over it. Also AC gives 6x115 for Uplander/Montana SV6/Relay 2006+ and Cadillac SRX 2005-2009 (wheel-sizes.com lists SRX 2004-2009, CTS-V, STS-V as real 6x115). No change.
2. **Acura MDX 2014-2016, AC 5x114.3: market agrees with AC.** wheel-size.com ("Acura MDX [2014-2016] with 5x114.3"), wheel-sizes.com 2015 MDX (5x114.3, "previous generation ended 2013 with 5x120"), factorywheelreplacement.com 2014-2016 MDX 19x8 5x114.3 ET55 bore 64.1, opple house/hulkoffsets/driveradviser summaries: 2007-13 5x120, 2014-16 5x114.3, 2017+ 5x120. The "5x120 from 2014" claim is not supported. No change (AC 2013 5x120 and 2017 5x120 also match).
3. **Toyota Tacoma 2005-2015 base 4x2 four-cylinder 5x114.3: AC already says it for 2005-2014; only 2015 is mixed.**
   - AC rows 2005-2014 carry `5x114.3;6x139.7` (order varies), so the finder already offers both for those years. The premise "AC gives only 6x139.7" is true only for 2015.
   - AC 2015 row (Base;Pre Runner;TRD Pro): `6x139.7`, centre bore 106.1.
   - Market: wheel-size.com lists Tacoma "Gen II (N200) 2004-2011 2.7 2WD and X-Runner" and "Gen II Facelift 2012-2015 2.7 2WD and X-Runner" under 5x4.5 (pcd/5x114.3/toyota/tacoma/1995-2015); sdwheel.com and thewheelshop.ca: base 2WD = 5x114.3, bore 60.1, 15x6 / P215/70R15; a 2015 2WD Access Cab with 15x6 is cited. wheel-sizes.com 2015 Tacoma says 6x139.7 for every trim (the contradicting source).
   - Verdict: mixed, leaning market contradicts AC for 2015 only (2 sources against 1). Proposed row: Toyota,Tacoma,2015 `bolt_patterns` `6x139.7` to `6x139.7;5x114.3` (5-lug bore 60.1; AC's single 106.1 bore applies to the 6-lug). Low-stakes: 5x114.3 wheels already show for 2005-2014.

## C. Small tire sizes
All checked via wheel-size.com tire pages. Short answer: **no NA 2005-2027 factory fitment found for any of the 11 listed sizes** (your list says 13; only 11 were given). Recommend no change.
- 155/80R13: Toyota/Daihatsu/Ford Escort/Orion, Chevrolet Aveo T250 (LatAm); NA only older Geo Metro/Suzuki Swift era and ST trailer tires.
- 155/65R14: Asian kei-class and European minis; NA Smart fortwo 2008-15 is 155/60R15 front / 175/55R15 rear, Mirage 165/65R14; nothing NA found.
- 155/70R13: Japanese kei/Suzuki/Honda Acty, Subaru Pleo; plus Chevrolet Spark M200/M250 (LatAm).
- 165/65R13: Ford Festiva/Courier/Fiesta, Honda City, Suzuki Every; plus Spark M200 2007-2008 (OE 155/65R13 and 165/65R13, LatAm/Russia/Middle East/SE Asia).
- 175/60R13: Hyundai Atos/Amica, Nissan Micra 1992-2003, Ford Festiva; Spark M200/M250 (tuning/optional).
- 155/65R13: Suzuki Alto, Daihatsu Charade, Mazda AZ-1; Spark M200 2007-2008 OE.
- 165/70R13: Chevrolet Celta/Chevy/Classic (Brazil), older Civic/Corolla; no NA 2005+.
- 165/60R12: Mini Cooper ADO20 1990-2000, Mitsubishi Minica; classic only.
- 205/60R13: Ford Capri, Pontiac 2000/Sunbird J-body 1982-85, Mercury Capri; classic only.
- 235/45R13: no OE application found (wheel-size page 404); aftermarket/drag/classic.
- 185/80R13: Pontiac 6000/Sunbird/Fiero, Chevrolet Celebrity/Corsica/Beretta, Dodge Dart; newest 1996; also ST trailer tire.
Only possible bridge: finder lists Chevrolet Spark 2008 and 2011-2012 (from NHTSA vPIC only, `vehicle-aliases.csv` says "no Auto Country listing this year") with no tire data. Market gives those years 155/65R13 and 165/65R13 (2008) and 155/80R13, 155/65R13, 155/70R13, 165/65R13, 175/60R13 (2011-12), but the data is from LatAm, Europe and Asia markets, not NA. Not recommended to add.

## Concrete data rows to change
1. Ford F-150 2005-2014: `bolt_patterns` 6x135 to 6x135;7x150 (optional, see caveat).
2. Toyota Tacoma 2015: `bolt_patterns` 6x139.7 to 6x139.7;5x114.3 (optional, mixed).
Nothing else. Buick Terraza and Acura MDX stay as AC has them.
