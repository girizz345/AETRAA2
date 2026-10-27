# UAE 2026 Rate Library (Building BOQ)

> **Section letters corrected at v1.2.** There is no POMI section S — communications
> and ELV are ELECTRICAL work, billed inside **R** as their own item groups. Furnishings
> moved from N to **M**; N is Special Construction; K is **Accessories**, not Specialties.
> Crosswalk: `pomi-take-off/references/determinism.md` §4.11a.


Default supply + install rates for use in BOQ when no project-specific rate library is provided. Rates are in AED per unit. PC = procurement cost. Install = labour + plant + small tools.

These are conservative defaults — use project rates where available. Apply 3-5% escalation per year if project is significantly in the future.

**Market-rate preference:** when `boq_baseline` or any priced market document
exists for the project, its rates GOVERN for matching items; this library is
fallback only. Flag any row where library and market rate differ >30%.

**Rate assignment integrity (G+.32):** never assign a rate by keyword/regex
match on description text alone. Every priced row must cite the library line
(or market document line) used, and must pass the class-based min/max
envelope check in `quantity-reconciliation-gates.md` G+.32 before Stage 4.

## Section B — Site Work

| Item | Unit | PC | Install | Total (AED) | Notes |
|------|------|----|---------|-------------|-------|
| Site clearance + grub | m² | — | 6 | 6 | Including disposal off-site |
| Bulk excavation 0-2m | m³ | — | 28 | 28 | Standard ground |
| Trench excavation 1-2.5m | m³ | — | 45 | 45 | Pile caps, tie beams |
| Backfill granular | m³ | 45 | 25 | 70 | Compacted in layers |
| Wellpoint dewatering | item | — | 35,000 | 35,000 | Per site, ~3-month period |
| Concrete kerb 150×300 | m | 38 | 22 | 60 | Pre-cast laid on bed |
| Interlocking paving 80mm | m² | 65 | 35 | 100 | On sand bed, including kerbs |
| Asphalt road wearing 50mm | m² | 38 | 12 | 50 | On 100mm DBM base |
| Landscaping (avg) | m² | 95 | 35 | 130 | Topsoil + sod + low planting |

## Section C — Concrete

All-inclusive m³ rates (concrete + rebar + formwork + curing).

| Item | Unit | Total (AED) | Notes |
|------|------|-------------|-------|
| Blinding C20/25 75mm | m² | 45 | Including formwork edge |
| Pile cap RC C40/50 | m³ | 1,950 | 130 kg/m³ rebar typical |
| Tie beam RC C40 | m³ | 1,650 | 150 kg/m³ rebar |
| Column RC C40 (G+12) | m³ | 1,820 | 180 kg/m³ rebar (high zone) |
| Shear wall RC C40 | m³ | 1,750 | 160 kg/m³ rebar |
| Suspended slab 250mm RC C40 | m² | 380 | All-inclusive |
| Suspended PT slab 250mm | m² | 480 | Including tendons + stressing |
| Beam RC C40 600 deep | m | 580 | All-inclusive |
| Stairs RC C40 | m³ | 2,200 | High formwork complexity |
| Bored pile 1000mm dia C50 | m | 850 | Including reinforcement |
| Bored pile 800mm dia C50 | m | 620 | Including reinforcement |
| Pile testing — dynamic | nr | 8,500 | Per pile |
| Pile testing — preliminary | nr | 95,000 | Test pile complete |
| Pile testing — integrity | nr | 1,200 | Per pile (sonic) |

## Section D — Masonry

| Item | Unit | Total (AED) | Notes |
|------|------|-------------|-------|
| Block wall 200mm solid | m² | 105 | Including mortar, ties |
| Block wall 200mm hollow | m² | 95 | |
| Block wall 150mm hollow | m² | 85 | |
| Block wall 100mm hollow | m² | 78 | |
| Toothing into existing | m | 45 | Per typical detail |

## Section E — Metalwork

| Item | Unit | Total (AED) | Notes |
|------|------|-------------|-------|
| Galvanised steel handrail 1100mm | m | 380 | Including posts |
| Stainless steel handrail | m | 850 | Grade 304 |
| MS access ladder + cage | nr | 4,500 | Per ladder |
| Aluminium balustrade glass infill | m | 1,250 | Including hardware |
| Steel cat ladder | m | 220 | |

## Section G — Thermal & Moisture

| Item | Unit | Total (AED) | Notes |
|------|------|-------------|-------|
| Bituminous WP membrane 4mm | m² | 95 | Including primer + protection |
| Liquid WP wet area 2mm | m² | 65 | 2 coats |
| XPS insulation 50mm | m² | 55 | Including protection board |
| Roof felt + chippings | m² | 75 | |
| Aluminium flashing per detail | m | 145 | |
| Sealant 25×15mm | m | 28 | Polyurethane |

## Section H — Doors & Windows

Tile + marble installation, PC + install split:

| Item | Unit | PC | Install | Total (AED) | Notes |
|------|------|----|---------|-------------|-------|
| Door D1 entry — fire-rated solid | nr | 1,800 | 350 | 2,150 | Including hardware |
| Door D2 apartment internal | nr | 850 | 200 | 1,050 | |
| Door D3 bathroom | nr | 650 | 180 | 830 | |
| Window W1 single — Aluminium DGU | nr | 1,200 | 250 | 1,450 | |
| Window W2 large — Aluminium DGU | nr | 2,400 | 350 | 2,750 | |
| Sliding door DW1 — large | nr | 4,500 | 500 | 5,000 | |
| Lift landing door | nr | 6,500 | 800 | 7,300 | Per opening |
| Aluminium fixed glazing | m² | 950 | 180 | 1,130 | |

## Section J — Finishes

Tile + marble use PC + install split:

| Item | Unit | PC | Install | Total (AED) | Notes |
|------|------|----|---------|-------------|-------|
| Tile floor 600×600 porcelain | m² | 100 | 100 | 200 | Plus 7% wastage |
| Tile floor 800×800 porcelain | m² | 150 | 100 | 250 | |
| Tile wall 300×600 wet area | m² | 95 | 100 | 195 | |
| Tile floor 300×300 wet area | m² | 70 | 100 | 170 | |
| Marble flooring | m² | 500 | 250 | 750 | Including underlayment |
| Granite flooring | m² | 450 | 250 | 700 | |
| Gypsum suspended ceiling flat | m² | 65 | 50 | 115 | Including grid |
| Gypsum suspended ceiling decorative | m² | 85 | 65 | 150 | |
| Emulsion paint 2 coats on putty | m² | 14 | 24 | 38 | |
| Enamel paint 2 coats on putty | m² | 18 | 26 | 44 | |
| Wooden parquet flooring | m² | 220 | 180 | 400 | Engineered |

## Section Q — Mechanical

| Item | Unit | Total (AED) | Notes |
|------|------|-------------|-------|
| FCU 4-pipe ceiling concealed 800 CFM | nr | 4,500 | Including filter, valves |
| FAHU outdoor air handling 6000 CFM | nr | 38,000 | Including ducting connections |
| VRF outdoor unit 50 HP | nr | 65,000 | Including refrigerant lines |
| Chilled water pipe 100mm insulated | m | 280 | |
| Chilled water pipe 50mm insulated | m | 145 | |
| Galvanised duct supply air | m² | 195 | Per surface area |
| Galvanised duct return air | m² | 165 | |
| Cooling tower 200 ton | nr | 145,000 | |
| Pump 5 kW centrifugal | nr | 8,500 | Including controls |

## Section R — Electrical

| Item | Unit | Total (AED) | Notes |
|------|------|-------------|-------|
| 11kV/415V transformer 1600 kVA | nr | 185,000 | Oil filled |
| LV main switchboard per SLD | item | 95,000 | Per typical building |
| Distribution board 24-way TPN | nr | 4,800 | |
| Cable 4×35mm² Cu/XLPE/SWA | m | 145 | |
| Cable 4×16mm² Cu/XLPE/SWA | m | 65 | |
| LED downlight 18W recessed | nr | 280 | |
| LED panel 600×600 36W | nr | 320 | |
| Diesel generator 500 kVA | nr | 285,000 | |
| Earthing rod copper 1.2m | nr | 195 | Including cable |

## Section R (cont'd) — ELV / Communications item groups

| Item | Unit | Total (AED) | Notes |
|------|------|-------------|-------|
| CCTV camera fixed dome | nr | 1,850 | |
| CCTV camera PTZ outdoor | nr | 6,500 | |
| NVR 32-channel | nr | 14,500 | |
| Fire alarm addressable panel | nr | 22,000 | |
| Smoke detector ionization | nr | 285 | |
| Heat detector | nr | 250 | |
| Manual call point | nr | 195 | |
| Sounder/strobe combined | nr | 650 | |
| Cat6A cable | m | 18 | Per metre |
| Fiber optic cable | m | 22 | Per metre |

## Adjustments

- **Dubai DM area rates +5%** vs typical (higher labour costs)
- **Abu Dhabi typical -3%** vs Dubai (more competitive market)
- **Sharjah / Ajman typical -10%** vs Dubai (cheaper labour pool)
- **Remote sites (Hatta, Liwa, Madinat Zayed) +15-20%** (transport + accommodation premium)
- **Government project +5-10%** (often higher specification requirement)
- **Free zone projects (DIFC, ADGM, JAFZA) +10%** (premium standards)

## Update cadence

Refresh quarterly. Significant material price events (steel +20% in 2026 Q1) trigger immediate review of affected items.
