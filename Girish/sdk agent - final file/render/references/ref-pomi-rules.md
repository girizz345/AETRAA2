# POMI RULE TABLE — CLAUSE-INDEXED
## Version 1.2 — complete clause coverage, GP + A to R.
## Verified clause-by-clause against the source, 11 omissions closed.
## Derived working reference. Binding on every measurement seat.
## Source: Principles of Measurement (International) for Works of Construction,
##         RICS, First Edition JUNE 1979, reprinted 1988, 1991, 1994, 2001,
##         2002, 2004. ISBN 0 85406 108 8.

This is a DERIVED LOOKUP TABLE for this office's internal measurement work, with
every rule traced to its clause. It is not a substitute for the publication and
it is not a reproduction of it. Where this table and the publication differ, the
publication governs and the difference is a defect in this table, reported as one.

  THE PUBLICATION IS NOW IN THE SKILL: `references/pomi-verbatim.md`.

That file carries POMI word for word — 17 sections, 117 groups, 314 clauses,
each verified against the RICS PDF by `scripts/verify_library.py`. This table
restates every clause in its own compressed words and adds house commentary and
UAE notes. It is LONGER than POMI overall — 8,771 words against POMI's 7,600 —
and shorter clause by clause. Neither figure is the point: not one sentence in
it is POMI's own sentence. At least one first limb of a clause (GP2.2, "Bills of
quantities shall describe and represent the works to be carried out") is not in
it at all.

  Use THIS file to FIND the rule. Use `pomi-verbatim.md` for what it SAYS.

Quote the verbatim file, never this one, in a bill preamble, a technical query,
a variation or a dispute. Where the two differ, the verbatim file governs and
this table is what gets corrected.

  THE SEAT DOES NOT INTERPRET POMI. THE SEAT INDEXES IT.

Every measured item cites a clause id. An item with no clause id is not measured;
it is a HOUSE EXTENSION and must declare itself under §20.

--------------------------------------------------------------------------------
HOW A SEAT USES THIS FILE  [class D — lookup, not judgement]
--------------------------------------------------------------------------------

  1  Identify the element.
  2  Look up its section and clause below.
  3  Take the UNIT from the clause. Do not choose a unit.
  4  Take WHAT IS MEASURED from the clause, including the classification list —
     POMI classifications are the bill's sub-headings and they are not optional.
  5  Take DEEMED INCLUDED from the clause. Anything on that list is NOT measured
     separately, and measuring it is a double count.
  6  Take ENUMERATE SEPARATELY from the clause. Anything on that list is NOT in
     the rate, and omitting it is an under-measure.
  7  Take MUST STATE from the clause plus GP5. A description missing a mandatory
     statement is not priceable and fails the description gate.
  8  Where the clause offers an ALTERNATIVE ("alternatively, ..."), the choice is
     made ONCE per project by C3 Lead QS, recorded, and applied consistently.
     It is not chosen per item.

================================================================================
SECTION GP — GENERAL PRINCIPLES  (binding on every section)
================================================================================

| Clause | Rule | Consequence for the take-off |
|---|---|---|
| GP1.1 | These principles provide a uniform basis for measuring bills of quantities. **More detailed information than this document requires MAY be given** to define the precise nature of work or the circumstances of its execution | House build-ups that add detail are permitted by GP1.1; they do not need GP1.2 unless they CHANGE a rule |
| GP1.2 | Amendments to these principles for a locality or for work not envisaged shall be STATED; an appendix is provided | Every HOUSE rule at §20 is an appendix amendment and must be declared in the bill |
| GP1.3 | Applies equally to proposed and completed works | Same rules for take-off and for final account |
| GP2.1 | The objects of bills of quantities: 1. to assist accurate preparation of tenders by providing measurement on a uniform basis; 2. to provide a basis for the financial control of a project per the conditions of contract | |
| GP2.2 | Work which cannot be measured accurately shall be described as APPROXIMATE or given in bills of approximate quantities | A LOW-confidence quantity is described approximate, not silently firm |
| GP2.3 | Conditions of contract, drawings and specifications shall be provided WITH the bills | A bill issued without them is incomplete |
| GP2.4 | Section headings and classifications do not restrict bill format | Our house format is permitted |
| **GP3.1** | **Work shall be measured NET as fixed in position; each measurement taken to the nearest 10 MILLIMETRES.** Does not apply to dimensions stated in descriptions | Measure net. Round each dimension to 10 mm. No waste, no laps, no shrinkage in a measured quantity |
| **GP3.2** | **Unless otherwise stated, NO deduction from AREA items for voids LESS THAN 1.00 m²** | The deduction limit. Areas only |
| **GP3.3** | Minimum deductions refer ONLY to voids WITHIN the edges of measured areas. **Voids AT THE EDGE are ALWAYS deducted, irrespective of size** | An opening at a wall end is deducted even at 0.2 m² |
| GP3.4 | These principles may be used with OTHER UNITS of measurement, but **the particular amendments shall be stated** | Imperial or mixed units require a stated amendment |
| GP3.5 | A separate minor building or structure may be enumerated | |
| **GP4.1** | Unless otherwise stated all items are FULLY INCLUSIVE of: labour and associated costs; materials, goods and associated costs; provision of plant; temporary works; establishment charges, overheads and profit | Nothing on this list is ever a separate measured item |
| GP5.1 | Enumerated items, and items given as an item, shall be FULLY DESCRIBED | |
| **GP5.2** | Items measured by LENGTH or DEPTH shall state cross-sectional size and shape, girth or ranges of girths. **For pipework it shall be stated whether the diameter is INTERNAL or EXTERNAL** | Every pipe line states ID or OD. Not optional |
| GP5.3 | Items measured by AREA shall state the THICKNESS or other appropriate information | |
| GP5.4 | Items measured by WEIGHT shall state material thickness and unit weight if appropriate (e.g. ductwork) | |
| GP5.5 | Proprietary items may be measured per the manufacturer's tariff or customary practice | |
| GP5.6 | Descriptions may refer to other documents or drawings, and such reference fulfils the requirement | R34 hyperlinks satisfy GP5.6 |
| **GP6.1** | Work required to be executed by a specialist NOMINATED BY THE EMPLOYER — given as a **SUM**, the sum **EXCLUSIVE of contractor's profit**, with **an item given in each case for the addition of profit** | Unless the conditions of contract require otherwise |
| **GP6.2** | **An item given in each case for ASSISTANCE BY THE CONTRACTOR**, which shall include: 1 use of contractor's administrative arrangements; 2 use of constructional plant; 3 use of facilities; 4 use of temporary works; 5 space for the specialist's offices and stores; 6 clearing away rubbish; 7 **scaffolding required by the specialist, GIVING PARTICULARS**; 8 **unloading, distributing, hoisting and placing in position items of plant, machinery or the like, GIVING PARTICULARS** | The PS/attendance structure. Items 7 and 8 require particulars — an unparticularised attendance item is incomplete |
| **GP7.1** | Goods, materials or services required to be provided by a MERCHANT OR TRADESMAN NOMINATED BY THE EMPLOYER — given as a **SUM**, **EXCLUSIVE of contractor's profit**, with **an item given in each case for the addition of profit** | Unless the conditions of contract require otherwise |
| **GP7.2** | **FIXING** goods and materials given in accordance with the relevant clauses of these principles; **fixing is UNDERSTOOD TO INCLUDE unloading, storing, distributing and hoisting** | Fixing is measured; its handling is not measured again |
| **GP8.1** | Work which may only be carried out by a GOVERNMENT OR PUBLIC AUTHORITY — given as a **SUM**, **EXCLUSIVE of contractor's profit**, with **an item given in each case for the addition of profit** | DEWA, Etisalat, du connections. Unless the conditions of contract require otherwise |
| **GP8.2** | **An item given in each case for assistance by the contractor as described in GP6.2** | The same attendance list as a nominated specialist |
| GP9.1 | **Dayworks LABOUR** — a SUM; alternatively a schedule of the different categories of labour with a **provisional quantity of hours** for each | Dayworks Manpower tab |
| GP9.2 | The labour cost included shall be **wages, bonuses and all allowances paid to operatives directly engaged on dayworks (including those operating mechanical plant and transport)** per the appropriate employment agreement, or where none exists the actual payments made | |
| GP9.3 | **Dayworks MATERIALS** — a SUM; alternatively a schedule with a provisional quantity of the different materials | Dayworks Materials tab |
| GP9.4 | The materials cost included shall be the **NET INVOICED PRICE, INCLUDING DELIVERY TO SITE** | |
| GP9.5 | **Dayworks PLANT employed exclusively in dayworks** — a SUM; alternatively a schedule of categories with a provisional quantity of hours or other appropriate period | Dayworks Machineries tab |
| GP9.6 | The plant cost included shall be **fuel, consumable stores, repairs, maintenance and insurance of plant** | |
| **GP9.7** | **An ITEM shall be given for the addition of establishment charges, overheads and profit to EACH of the sums or schedules of labour, materials or plant** | Three separate OH&P items, one per Dayworks tab. Omitting them under-prices dayworks |
| **GP9.8** | Establishment charges, overheads and profit **SHALL INCLUDE**: 1. costs related to the employment of labour; 2. costs related to the storage of materials, including handling and waste in storage; 3. contractor's administrative arrangements; 4. **constructional plant, EXCEPT plant employed exclusively on dayworks**; 5. contractor's facilities; 6. temporary works; 7. sundry items | Nothing on this list is billed again in the dayworks schedules |
| **GP10.1** | Unless otherwise required by the conditions of contract, **contingencies shall be given as a SUM; NO item shall be given for the addition of profit** | Contingencies take no profit item — the opposite of GP6/GP7/GP8/GP9.7 |

================================================================================
SECTION A — GENERAL REQUIREMENTS
================================================================================

Every A clause below is **AN ITEM** unless stated. This is the Preliminaries bill
that our generated BOQ omitted entirely — POMI requires it.

| Clause | Item | POMI's inclusion list — deemed within the item |
|---|---|---|
| A1.1 | Schedule of conditions-of-contract clause headings | set out in the bill |
| A1.2 | Schedule of appendix insertions | set out in the bill |
| A2.1 | Reference to specification clauses for any General Requirement | |
| A3.1 | Particulars of RESTRICTIONS | access/possession/use of site; limitations of working space; limitations of working hours; maintenance of existing services on, under or over the site; execution in specific order, sections or phases; like items |
| A4.1 | **Contractor's administrative arrangements — ITEM** | site administration; supervision; security; safety, health and welfare of workpeople; transport of workpeople |
| A5.1 | **Constructional plant — ITEM** | small plant and tools; scaffolding; cranes and lifting plant; site transport; plant for specific trades |
| A6.1 | Employer's facilities — particulars | temporary accommodation incl. heating, cooling, lighting, furnishing, attendance; **telephones, including costs of calls — ALTERNATIVELY the cost of calls MAY BE GIVEN AS A SUM**; vehicles; attendance of staff; equipment; programmes/progress charts; other facilities |
| A7.1 | **Contractor's facilities — ITEM** | accommodation and buildings; temporary fencing incl. hoardings, screens, roofs, guardrails; temporary roads incl. hardstandings and crossings; water for the works; lighting and power for the works; temporary telephones |
| A7.2 | Particulars where nature/extent is NOT at contractor's discretion | |
| A8.2 | Particulars where the nature or extent of the temporary works is NOT at the contractor's discretion | |
| A8.1 | **Temporary works — ITEM** | traffic diversion; access roads; bridges; cofferdams; pumping; de-watering; compressed air for tunnelling |
| A9.2 | Particulars where the nature or extent of the sundry items is NOT at the contractor's discretion | |
| A9.1 | **Sundry items — ITEM** | testing of materials; testing of the works; protecting the works from inclement weather; removing rubbish, protective casings and coverings and cleaning at completion; traffic regulations; maintenance of public and private roads; drying the works; control of noise and pollution; all statutory obligations |

**A8.1 puts DE-WATERING in Preliminaries as an item.** A dewatering system billed
as a measured Enabling item is a house departure and must be declared.

================================================================================
SECTION B — SITE WORK
================================================================================

| Clause | Element | Unit | Rule, deemed-included, must-state |
|---|---|---|---|
| **B1.1** | **Keeping RECORDS of site observations, site tests and laboratory tests** | **ITEM** | |
| **B1.2** | **Samples, site observations, site tests, laboratory tests AND ANALYSES** | **ITEM** | The testing itself, as distinct from B1.1's record-keeping |
| **B1.3** | **Providing REPORTS** | **ITEM** | |
| B2.1 | Trial holes | DEPTH, along centre line | state number and maximum depth below commencing level |
| B2.2 | Earthwork support to trial holes, not at contractor's discretion | DEPTH | |
| B3.1 | Boreholes incl. pumping test wells | DEPTH, along centre line | state number and max depth below commencing level; raking so described |
| B3.2 | Lining, not at contractor's discretion | DEPTH | |
| B3.3 | Cappings | ENUMERATED | |
| B4.1 | Removing isolated trees | ENUMERATED | |
| B4.2 | Removing hedges | LENGTH | |
| **B4.3** | **Site clearance** | **AREA** | INCLUDES removing vegetation, undergrowth, bushes, hedges, trees or the like |
| B5.1 | Demolitions/alterations | | state LOCATION of each item; old materials become contractor's property and are cleared away unless described otherwise |
| B5.2 | Removing individual fittings, fixtures, engineering installations from existing structure | ITEM each | |
| B5.3 | Demolishing individual structures (or part) | ITEM each | alternatively all structures on a site as one item |
| B5.4 | Cutting openings in / alterations to existing structures | ITEM each | **making good all work damaged is INCLUDED** |
| B5.5 | Temporary screens and roofs | ITEM | |
| B6.1 | Shoring incidental to demolitions and alterations | **INCLUDED** | together with clearing away and making good |
| **B6.2** | **Shoring, other than incidental** | **ITEM** | state the LOCATION; clearing away and making good all work damaged INCLUDED |
| B6.3 | | | particulars where shoring design is NOT at contractor's discretion |
| B6.4 | Shoring required to be left in position | | so described |
| B7.1–B7.5 | Underpinning | heading, stating location | work per relevant sections; temporary support as ITEM; excavation by VOLUME to outside line of projecting or new foundations, whichever greater, classified: preliminary trenches to base of existing foundations / below base of existing foundations. Cutting away projecting foundations by LENGTH |
| B8.1 | Ground and strata information | | **Any information available concerning the nature of the ground and strata shall be PROVIDED WITH the bills of quantities** |
| B8.2 | **Excavation, dredging, tunnelling quantities** | | **understood to be the BULK BEFORE EXCAVATION. NO allowance for working space or subsequent variation in bulk. Existing voids deducted** |
| B8.3 | Multiple handling and transporting about the site | **INCLUDED** | unless required by the specification, then so described in the DISPOSAL item |
| **B8.4** | **Earthwork support** | **ITEM** | not measured by area |
| B8.5 | Excavation in rock | so described, or **extra over** excavation (rock volume measured, no deduction from the excavation in which it occurs) | |
| B8.6 | Rock definition | | material which, in the opinion of the employer's representative, can only be removed by wedges, special plant or explosives |
| **B9.1** | **Excavation** | **VOLUME of the void to be occupied by the permanent construction, or vertically above any part of it**, classified — ALL SEVEN: 1 Oversite excavation to remove top soil, **stating the average depth**; 2 Excavation to reduce levels; 3 Excavation in cuttings; 4 Basement excavation; 5 **Trench excavation to receive foundations — INCLUDES pile caps and ground beams**; 6 **Pit excavation to receive foundation bases, STATING THE NUMBER**; 7 **Excavation for diaphragm walls, STATING THE WIDTH of the permanent construction AND THE TYPE OF SUPPORT FLUID** | |
| **B9.2** | **Trenches for SERVICE PIPES, DRAIN PIPES, CABLES or the like** | **LENGTH, stating the AVERAGE DEPTH** | **DISPOSAL AND FILLING ARE INCLUDED.** These trenches are NOT measured by volume and their disposal is NOT measured again |
| B9.3 | Tunnel excavation | see B24 | |
| B10.1 | Dredging | VOLUME | state location and limits; measurement understood to be taken from soundings unless stated |
| **B11.1** | **Disposal** of material arising from excavation, dredging or tunnelling | **VOLUME, EQUAL TO the volume of excavation / dredging / tunnelling** | classified: 1 Backfilled into excavation; 2 Backfilled in making up levels; 3 Backfilled oversite to make up levels, giving details of special contouring, embankments; 4 **Removed — INCLUDES providing a suitable tip** |
| **B12.1** | **Filling** (material other than that arising from excavation, dredging, tunnelling) | **VOLUME, EQUAL TO the void to be filled** | classified: 1 Filled into excavation; 2 Filled in making up levels; 3 Filled oversite to make up levels, giving details of special contouring, embankments |
| B13.1 | Driven piling defined | | includes timber, precast concrete or metal piles |
| B13.2 | Other piling systems (e.g. preformed casing with concrete filling) | | measured per driven or bored piling as appropriate |
| B13.3 | Piling reinforcement | | per Section C unless otherwise stated |
| B14.1 | Supplying driven piles | LENGTH, **stating the number** | reinforcement given separately |
| B14.2 | Heads and shoes | ENUMERATED | |
| B14.3 | Driving piles | LENGTH, **from the pile point in contact with the ground when pitched to the pile point when driven**, stating the number | driving on rake so described |
| B14.4 | Cutting off tops; connections for lengthening | ENUMERATED | |
| B15.1 | Boring for piles | LENGTH, **from formation level of the ground to the bottom of the pile hole**, stating the number | **INCLUDES blind boring where the pile top is below formation level** |
| B15.2 | Boring through rock | **EXTRA OVER** boring — rock length measured, **no deduction** from total boring | |
| B15.3 | Linings for piles | LENGTH | |
| B15.4 | Disposal from boring | per B11 | |
| B15.5 | Concrete filling | VOLUME | |
| B15.6 | Cutting off tops; forming enlarged bases | ENUMERATED | |
| B16.1 | Sheet piling measurements | | **taken along the CENTRE LINE** |
| B16.2 | Supplying sheet piling | **AREA, as the area when in final position** | |
| B16.3 | Corner piles or the like | LENGTH | |
| **B16.4** | Driving sheet piling | **AREA**, from formation level to the bottom edge when driven | **STRUTTING, WALING and WITHDRAWING sheet piling are INCLUDED** |
| B16.5 | Cutting sheet piling | LENGTH | |
| B16.6 | Sheet piling left in position | | so described |
| **B17.1** | **Performance designed piles** | **ENUMERATED** | **reinforcement AND disposal of material arising from boring are INCLUDED** |
| B17.2 | | | give details where the pile top is below formation level |
| **B18.1** | **Testing piling** — includes trial piles and testing working piles | **ITEM** | |
| **B19.1** | **Drain pipes** | **LENGTH, along the CENTRE LINE OVER ALL FITTINGS** | drain pipes within inspection chambers so described and **INCLUDE fixings and supports** |
| **B19.2** | Drain **fittings** in the length (bends, junctions) | **ENUMERATED, GROUPED for each size of pipe, described as 'fittings'** | same pattern as Q2.2 |
| **B19.3** | Drain **accessories** (gullies, traps) | **ENUMERATED** | **CONCRETE SURROUNDS and ADDITIONAL EXCAVATION are INCLUDED** |
| **B19.4** | Concrete beds and coverings for drain pipes | **LENGTH, stating the DIAMETER of the pipe** | surrounds to vertical pipes so described and **INCLUDE formwork** |
| B19.5 | Inspection chambers or the like | ENUMERATED | alternatively measured per the relevant sections under an appropriate heading |
| B19.6 | Connections to existing drains | ENUMERATED, subject to GP8 | |
| B20.1 | Paving and surfacing | AREA | |
| B20.2 | Expansion joints and water stops | LENGTH | |
| B20.3 | Channels, curbs, edgings or the like | LENGTH | curved work so described |
| **B21.1** | **Fencing — INCLUDES posts and supports in the length** | **LENGTH** | **EXCAVATING PITS, DISPOSAL AND FILLING ARE INCLUDED** |
| B21.2 | Special posts (gate posts, straining posts) | ENUMERATED | excavating pits, disposal and filling INCLUDED |
| B21.3 | Gates, barriers or the like | ENUMERATED | |
| B21.4 | Finishes to fencing | per Section J | |
| B22.1 | Cultivating and fertilising ground | AREA | |
| B22.2 | Soiling, seeding and turfing | AREA | |
| B22.3 | Hedges | LENGTH | |
| B22.4 | Trees and shrubs | ENUMERATED | |
| B23.1 | Track, guard rails, conductor rails | LENGTH, centre line over all fittings | curved so described |
| B23.2 | Sleepers and chairs | ENUMERATED | |
| B23.3 | Switches and crossings | ENUMERATED | classified: switches and turnouts; diamond; single slip; double slip; other |
| B23.4 | Ballast | VOLUME, **without deduction for track** | classified: bottom ballast (before track laid); top ballast (after) |
| B23.5 | Concrete track foundations | LENGTH; overwidth foundations for switches and crossings by AREA | **reinforcement and shuttering INCLUDED** |
| B23.6 | Bitumen filler to rail assemblies | LENGTH | |
| B23.7 | Buffer stops, wheel stops | ENUMERATED | |
| B23.8 | Signalling installations | per Section L or R | |
| B24.1 | Tunnel excavation | **VOLUME as the void to be occupied, INCLUDING the volume of permanent linings** | grouped to identify different lengths; classified: straight tunnels; straight shafts; curved tunnels; curved shafts; tapered tunnels; tapered shafts; other cavities (incl. transitions, breakaways, intersections) |
| B24.3 | Tunnel disposal | per B11 | |
| B24.2 | Forward probing | LENGTH, stating the number of probes | |
| B25.1 | Poured concrete tunnel linings | AREA, **stating spray or cast** | classified: [primary] lining; secondary lining — **NOTE: the printed source shows item 1 as a bare "lining" with a gap; "primary" is inferred from item 2. Verify against a clean copy before relying on it** |
| B25.2 | Preformed segmental tunnel linings | ENUMERATED | |
| B26.1 | Timber tunnel supports | VOLUME | |
| B26.2 | Sprayed concrete supports and reinforcement | AREA | |
| B26.3 | Rock bolts | LENGTH | |
| B26.4 | Face packers | ENUMERATED | |
| B26.5 | Metal arch supports | WEIGHT | |
| B26.6 | Injection of grout materials | WEIGHT | |

================================================================================
SECTION C — CONCRETE WORK
================================================================================

| Clause | Rule |
|---|---|
| C1.1 | Reinforced poured concrete and plain poured concrete shall EACH BE SO DESCRIBED |
| C1.2 | Concrete required to be placed, compacted, cured or otherwise treated in a particular manner shall be so described |
| **C1.3** | **NO deduction for voids less than 1.00 m³**, nor for the volume of any reinforcement or structural metal enclosed in the concrete. **EXCEPT voids caused by boxed or tubular structural metalwork, which are ALWAYS deducted** |
| C1.4 | Unless described otherwise, horizontal surfaces of concrete are understood to be TAMPED |

**C2 POURED CONCRETE — VOLUME**, classified exactly as follows (C2.1). These
eleven are the bill's sub-headings:

1. Foundations — **includes** combined or isolated bases
2. Pile caps — **includes** ground beams
3. Blinding
4. Beds — **includes** roads and footpaths — **state the thickness**
5. Suspended slabs — **includes** floors, landings, roofs or the like — **state the thickness**
6. Walls — **includes** attached columns — **state the thickness**
7. Columns — **includes** casing to metal stanchions
8. Beams, measured BELOW THE SLAB — **includes** lintels and casing to metal beams
9. Staircases — **includes** steps and strings
10. Diaphragm walls
11. Other classifications as appropriate

| Clause | Rule |
|---|---|
| C2.2 | Suspended slabs of SPECIAL construction measured by AREA; coffered and troughed so described, giving details of solid margins |
| C2.3 | Where measured by volume with thickness stated, differing thicknesses may be grouped provided the RANGE is stated |

**C3 REINFORCEMENT**

| Clause | Rule |
|---|---|
| **C3.1** | **The weight of bar reinforcement is the NET weight, WITHOUT addition for rolling margin, supports, spacers or tying wire** |
| **C3.2** | Bar reinforcement by **WEIGHT, stating the diameter**; bars of differing diameters given SEPARATELY |
| C3.3 | Fabric reinforcement by **AREA, WITHOUT addition for laps** |
| C3.4 | Reinforcement given as an ITEM where detailed design is the contractor's responsibility |

C3.1 settles the house question directly: **no uplift for spacers, tying wire,
supports or rolling margin.** Those are in the rate under GP4.1.

**C4 SHUTTERING — AREA, taken as the NET AREA IN CONTACT with the finished face
of concrete** (C4.1), classified exactly as follows:

1. Soffits — special construction so described
2. Sloping soffits — **includes** soffits of staircases
3. Sloping upper surfaces — **includes** surfaces more than 15° from horizontal
4. Sides of foundations — **includes** bases, pile caps, ground beams
5. Sides of walls — **includes** attached columns
6. Returns to walls — **includes** ends, projections and reveals of openings or recesses
7. Sides and soffits of beams — **includes** lintels and breaks in soffits; isolated beams so described
8. Sides and soffits of sloping beams — as 7
9. Sides of columns
10. **Staircases — includes treads, risers and strings, but EXCLUDES soffits**
11. Other classifications as appropriate

| Clause | Rule |
|---|---|
| C4.2 | Shuttering to EDGES — **includes** face of curb or upstand or break in upper surface of floor — by **LENGTH**; differing heights may be grouped if the RANGE is stated |
| C4.3 | Grooves — **includes** throats, rebates, chamfers — **≥2500 mm² sectional area by LENGTH; LESS than 2500 mm² is INCLUDED** |
| C4.4 | Shuttering may be ENUMERATED where more appropriate (e.g. decorative features) |
| C4.5 | Shuttering required to be left in position so described |
| C4.6 | Curved, conical and spherical surfaces each so described |
| C4.7 | Shuttering to provide a special finish so described |
| **C4.8** | Unless stated otherwise, **if the volume of concrete has NOT been deducted, shuttering to the faces of a void is INCLUDED** |

**There is NO reuse factor anywhere in C4.** Reuse is a rate matter under GP4.1.
Multiplying or dividing contact area by a reuse count has no clause behind it.

C4.1 item 10 is the authority for the stair-riser rule: risers are **within the
staircase shuttering item**, not measured separately.

**C5 PRECAST CONCRETE**

| Clause | Rule |
|---|---|
| **C5.1** | **Moulds for precast units are INCLUDED** |
| C5.2 | Reinforcement per C3, under an appropriate heading; alternatively described in the item |
| C5.3 | Floor slabs, partition slabs or the like — **AREA** |
| C5.4 | Lintels, sills, duct covers or the like — **LENGTH**; alternatively duct covers by AREA |
| C5.5 | Structural units (beams, stanchions, tunnel rings) — **ENUMERATED** |
| C5.6 | Padstones, cappings or the like — **ENUMERATED** |

**C6 PRESTRESSED CONCRETE**

| Clause | Rule |
|---|---|
| C6.1 | Given under an appropriate heading |
| C6.2 | Measured by **VOLUME**, classified per C2 |
| C6.3 | Reinforcement per C3; **supporting steel wires or cables measured by WEIGHT** |
| C6.4 | Shuttering per C4, **stating whether to pre-tensioned or post-tensioned members** |

**C7 SUNDRIES**

| Clause | Rule |
|---|---|
| C7.1 | Surfaces finished to falls or cross-falls — **AREA** |
| **C7.2** | Surface finishes — **AREA**, except that **TAMPED finishes are INCLUDED** (cf. C1.4) |
| C7.3 | Expansion material or the like — **AREA** |
| C7.4 | Designed joints, water stops, cast-in channels or the like — **LENGTH** |
| C7.5 | Forming sinkings, channels or the like — **LENGTH**, and where appropriate the item **may include additional excavation, hardcore, shuttering and concrete**; alternatively ENUMERATED |
| C7.6 | Fixings, ties, inserts or the like — **ENUMERATED**; alternatively by AREA |
| **C7.7** | **Mortices, holes or the like are INCLUDED** |

================================================================================
SECTION D — MASONRY
================================================================================

| Clause | Element | Unit | Rule |
|---|---|---|---|
| D1.1 | Sloping, battering, curved work | | each so described |
| D1.2 | Reinforced masonry | | so described |
| **D2.1** | **Walls and piers** | **AREA** | classified: 1 Walls — integral piers measured as walls of COMBINED pier and wall thickness; 2 Walls built against other construction; 3 Cavity walls as a COMPOSITE item including skins and cavity (alternatively skins and cavity each by area) — **closing cavity walls at ends or around openings is INCLUDED**; 4 Isolated piers |
| D2.2 | Faced / fair faced work | | each so described; alternatively as **extra over** walls stating one or both sides — area of faced work measured, no deduction from the walling it occurs on |
| D3.1 | Sills, copings, oversailing or receding courses | LENGTH | |
| D3.2 | Arches | LENGTH | |
| D4.1 | Reinforcement | per C3 | alternatively fabric reinforcement by LENGTH |
| D5.1 | Concrete filling to cavities | AREA | |
| D5.2 | Expansion joints or the like | LENGTH | |
| D5.3 | Air bricks or the like | ENUMERATED | |

Masonry is measured by **AREA stating thickness** (GP5.3), not by volume, except
where the clause directs otherwise.

================================================================================
SECTION E — METALWORK
================================================================================

| Clause | Rule |
|---|---|
| **E1.1** | **The weight of metalwork is the NET weight, WITHOUT addition for rolling margin or welding material, and WITHOUT deduction for holes, splay cuts, notches or the like** |
| E1.2 | Welded, riveted or bolted work each so described |
| **E2.1** | **Structural metalwork by WEIGHT**, classified: 1 Grillages; 2 Beams; 3 Stanchions; 4 Portal frames **stating the number**; 5 Roof trusses **stating the number**; 6 Support steelwork — **includes** sheeting rails, braces, struts; 7 Other |
| **E2.2** | **Fittings (e.g. caps, brackets) — ITEM** |
| **E2.3** | **Fixings (e.g. bolts, distance pieces, rivets) — ITEM** |
| E2.4 | Wedging and grouting bases — ENUMERATED |
| E2.5 | Holding-down bolts — ENUMERATED; **temporary boxes and grouting INCLUDED** |
| **E2.6** | **Protective treatment — ITEM** |
| E3.1 | Floor plates, duct covers, sheet metal coverings and linings — **AREA** |
| E3.2 | Bearers, **balustrades, handrails** (except where included with a staircase), frames — **LENGTH** |
| E3.3 | Matwell frames, cat ladders, gates, **staircases** — **ENUMERATED** |

E2.2 and E2.3 are important: **fittings and fixings are items, not enumerated
and not weighed.** A take-off that weighs bolts has double-counted against E1.1.

================================================================================
SECTION F — WOODWORK
================================================================================

| Clause | Rule |
|---|---|
| F1.1 | Sawn (not milled) and finished (milled) timber each so described |
| F1.2 | Descriptions shall state whether sizes are BASIC (before machining) or FINISHED (milled, within permitted deviations) |
| F2.1 | Structural timbers by **LENGTH**, classified: floors and flat roofs; pitched roofs; walls; kerbs/bearers; cleats/sprockets |
| F2.2 | Strutting and bridging between joists by **LENGTH, taken overall the joists** |
| **F3.1** | Boarding and flooring by **AREA, WITHOUT addition for joints or laps**, classified: 1 Floors — **includes** landings; 2 Walls — **includes** returns, reveals of openings or recesses, attached and unattached columns; 3 Ceilings — **includes** attached and unattached beams and soffits of staircases; 4 Roofs — **includes** tops and cheeks of dormers, sides and bottoms of gutters — **state flat, sloping or vertical** — **firring pieces and bearers INCLUDED** |
| F3.2 | Eaves and verge boards — **includes** fascias, barge boards — LENGTH |
| F3.3 | Fillets and rolls — LENGTH |
| F4.1 | Open-spaced grounds and battens — **AREA taken overall** |
| F4.2 | Individual grounds and battens — LENGTH |
| F5.1 | Framework — AREA taken overall; alternatively LENGTH |
| F6.1 | Finishings by LENGTH: cover fillets — **includes** architraves, skirtings; beads — **includes** stops; edgings — **includes** window boards, nosings |
| F6.2 | Fittings by LENGTH: work tops — **includes** seats; handrails or balustrades |
| F6.3 | Shelving — AREA; alternatively LENGTH |
| F6.4 | Backboards — ENUMERATED |
| F6.5 | Built-up members so described |
| F6.6 | Plastic coverings described with the item they occur on, stating one or more faces; alternatively by AREA |
| F6.7 | Sheet linings by AREA: walls (**includes** returns, reveals, attached and unattached columns); ceilings (**includes** attached and unattached beams and soffits of staircases) |
| **F7.1** | **Composite items** — items which MIGHT be fabricated off-site, whether or not they are — **ENUMERATED; all metalwork INCLUDED** |
| F7.2 | Any associated work (e.g. decorations) to composite items — measured per the relevant sections of the document |
| F8.1 | Finished surfaces on sawn items — LENGTH |
| F9.1 | Metalwork associated with woodwork — ENUMERATED; alternatively waterbars by LENGTH |
| **F10.1** | **Units or sets of ironmongery — ENUMERATED** |

================================================================================
SECTION G — THERMAL AND MOISTURE PROTECTION
================================================================================

| Clause | Rule |
|---|---|
| **G1.1** | **Work measured FLAT, WITHOUT addition for laps or seams** |
| G1.2 | Curved, spherical and conical work each so described |
| **G2.1** | Roofing, tanking, waterproof coverings, linings by **AREA**, classified: 1 Flat coverings; 2 Sloping coverings; 3 Vertical coverings |
| G2.2 | Eaves, ridges, skirtings, fascias, flashings, aprons by **LENGTH**; alternatively skirtings/fascias to composite roofing by AREA |
| G2.3 | Roof lights, ventilators, soaker collars, special roofing sheets — ENUMERATED; alternatively special sheets as **extra over** roofing |
| G3.1 | Damp-proof courses by **LENGTH**; alternatively by AREA |
| **G4.1** | **Insulation by AREA**; alternatively described with items of composite roofing |

G4.1 is the clause the soffit-insulation triple count breached: one area item,
one building total.

================================================================================
SECTION H — DOORS AND WINDOWS
================================================================================

| Clause | Rule |
|---|---|
| **H1.1** | **Doors — ENUMERATED** |
| H1.2 | Jambs, heads, sills, mullions, transomes — **LENGTH**; alternatively frame and lining sets ENUMERATED |
| **H2.1** | **Windows, skylights, together with their frames — ENUMERATED**; sub-frames of a different material separately enumerated or by LENGTH |
| H3.1 | Screens, borrowed lights, curtain walling — **AREA**; alternatively ENUMERATED |
| H3.2 | Doors and frames within a screen — ENUMERATED |
| **H4.1** | **Units or sets of ironmongery — ENUMERATED** |
| **H5.1** | Glass by **AREA**; panes of irregular shape measured as **the smallest rectangle from which the shape can be cut** |
| H5.2 | Sealed factory-glazed units — ENUMERATED |
| H5.3 | Glass louvres — ENUMERATED; alternatively by LENGTH stating the number |
| H5.4 | Panes of special shape or with decorative treatment — ENUMERATED |
| H6.1 | Patent glazing by AREA, classified: roofs; skylights (**includes** lantern lights); vertical surfaces |
| H6.2 | Opening portions — ENUMERATED |

Ironmongery is a separate enumerated item (H4.1). A door rate that absorbs
ironmongery without a stated departure breaches H4.1.

================================================================================
SECTION J — FINISHES
================================================================================

| Clause | Rule |
|---|---|
| **J1.1** | **Work measured FLAT, WITHOUT addition for laps or seams**; finishes on corrugated or ornamental surfaces each so described |
| J1.2 | Curved, spherical, conical each so described |
| **J1.3** | **Internal and external work each so described** |
| J2.1 | Backgrounds by AREA; backgrounds for floor, wall or ceiling finishes each so described |
| J2.2 | Poured backgrounds (e.g. screeds) each given separately, **stating the surface finish** |
| J2.3 | Pre-formed backgrounds (e.g. plasterboard, EML) each given separately |
| **J3.1** | Finishings by **AREA**, classified: 1 Floors — **includes** landings; 2 Walls — **includes** returns, reveals of openings or recesses, attached and unattached columns; 3 Ceilings — **includes** attached and unattached beams and soffits of staircases; 4 **Staircases — includes treads, risers and edges of landings but EXCLUDES soffits** |
| J3.2 | Skirtings, bands, strings, coverings to kerbs, mouldings, coves, channels — **LENGTH** |
| J4.1 | Non-slip inserts, dividing strips, metal angle beads, lathing at junctions — LENGTH; alternatively described with the items they occur in |
| J5.1 | Suspended ceilings by **AREA**, classified: ceilings **stating the drop**; sides and soffits of beams or upstands |
| J6.1 | Decorations on different surfaces each given separately |
| J6.2 | Details of any special method of application (e.g. spraying) |
| **J6.3** | Decorations by **AREA**, classified into TWELVE: floors (incl. landings); walls (incl. returns, reveals, attached and unattached columns); ceilings (incl. attached and unattached beams, soffits of staircases); staircases (incl. treads, risers, strings, edges of landings, **excl. soffits**); cornices; general surfaces (incl. doors, close-type fencing; glazed general surfaces measured flat over glass, so described); isolated general surfaces (incl. door frames, linings, sub-frames of differing material, skirtings, rails, architraves, bars, posts, balusters); windows measured **flat over glass, frames, mullions, transomes and architraves** (incl. glazed partitions, excl. sub-frames of differing material; **edges of sashes INCLUDED**); radiators measured **over the area of heating surface**; gutters measured **inside and out**; **large pipes (ID exceeding 60 mm)** incl. trunking, unless measured as incidental work — hangers and supports INCLUDED except common supports to services; structural metalwork incl. roof trusses |
| **J6.4** | Decoration on **small pipes (ID 60 mm or less)** unless measured as incidental work — by **LENGTH**; hangers and supports INCLUDED except common supports to services |
| J6.5 | Decoration on gratings, rainwater heads — ENUMERATED separately, **irrespective of size** |
| J7.1 | Signwriting letters — ENUMERATED |

The **60 mm internal diameter** threshold appears in both J6 and Q2. It is the
single most load-bearing number in the MEP sections.

================================================================================
SECTION K — ACCESSORIES
================================================================================

| Clause | Rule |
|---|---|
| K1.1 | Accessories are defined as **specially manufactured or proprietary items not included in other sections** |
| **K1.2** | Unless otherwise stated, accessories — **ENUMERATED** |
| **K2.1** | **Partitions by LENGTH, taken OVER ALL doors and glazed units** |
| K2.2 | Doors and glazed units — ENUMERATED, **stating the partition in which they occur** |
| K2.3 | Cubicles — ENUMERATED |

K2.1 is counter-intuitive and frequently wrong in practice: partitions are
measured by **length over the openings**, and the openings are then enumerated.

================================================================================
SECTION L — EQUIPMENT
================================================================================

| Clause | Rule |
|---|---|
| L1.1 | Equipment is defined as **specialist equipment related solely to the function of a building or department** (e.g. food preparation or service equipment, laboratory equipment, stage equipment) |
| L1.2 | Each CATEGORY of equipment — **ITEM**; alternatively individual items ENUMERATED |

================================================================================
SECTION M — FURNISHINGS
================================================================================

**POMI's letters are L Equipment, M FURNISHINGS, N SPECIAL CONSTRUCTION.**
Any house schedule that puts Furnishings at N is mislabelled against the standard.

| Clause | Rule |
|---|---|
| M1.1 | Furnishings defined as **loose furniture, fittings or the like related to the occupation and use of a building or department** (e.g. rugs, curtains, artwork, ashtrays, furnishing accessories) |
| M1.2 | Each CATEGORY of furnishing — **ITEM**; alternatively individual items ENUMERATED or measured by LENGTH as appropriate |
| **M2.1** | **Curtain track — LENGTH; hooks, gliders, stops or the like are INCLUDED** |

================================================================================
SECTION N — SPECIAL CONSTRUCTION
================================================================================

| Clause | Rule |
|---|---|
| N1.1 | Special construction defined as either **enclosures of a specialist construction** (e.g. air-supported or geodetic structures, prefabricated buildings) **or installations of a specialist nature** (e.g. radiation protection) |
| **N2.1** | **Enclosures — ENUMERATED**; work WITHIN the enclosure, not being part of the enclosure construction, measured per the relevant sections |
| **N3.1** | **Installations — ITEM each**; alternatively measured per the relevant sections |

A swimming pool, a water feature or a themed structure is measured under the
relevant sections — B, C, J, Q — **not** under N, unless it is an enclosure or a
specialist installation within N1.1's definition.

================================================================================
SECTION P — CONVEYING SYSTEMS
================================================================================

| Clause | Rule |
|---|---|
| **P1.1** | **Lifts, hoists, conveyors, escalators — ENUMERATED** |
| **P2.1** | **An ITEM shall be given for EACH of the following** — and Q8.1 and R9.1 apply this same list to mechanical and electrical: 1 **Supports** — **includes** fixings, anchors, insulating blocks and anti-vibration devices; 2 **Identification** — **includes** plates, discs, labels, charts and colour coding; 3 **Testing and commissioning** — **includes** operating completed installations and providing fuel and power; 4 **Tools and spares** — **includes** loose keys and consumable stores; 5 **Documents** — **includes** drawings, operating instructions and maintenance manuals |
| **P3.1** | **An ITEM for incidental work**, which **includes**: 1 Co-ordination with other engineering installations; 2 **Cutting or forming holes, mortices, chases and making good finishings**; 3 **Building in or cutting and pinning brackets and making good finishings** |
| P3.2 | Protective painting and decorative painting each as an ITEM per system — **includes** removing protective coating or wrapping; cleaning and polishing exposed surfaces |
| P3.3 | Other incidental work per the relevant sections, grouped under an appropriate heading |

**P2.1 and P3.1 govern all three services sections.** They are the reason a great
deal of what a services take-off is tempted to enumerate is in fact an item.

================================================================================
SECTION Q — MECHANICAL ENGINEERING INSTALLATIONS
================================================================================

| Clause | Rule |
|---|---|
| Q1.1 | Installations classified **by function**, given separately under an appropriate heading |
| Q1.2 | Measured per the clauses of this section; **alternatively enumerated on a LOCATIONAL basis** (e.g. cold water installation to ground floor) |
| **Q2.1** | **Pipes and gutters by LENGTH, taken along the CENTRE LINE, OVER ALL FITTINGS** |
| **Q2.2** | **Fittings to SMALL pipes (internal diameter 60 mm or less) are INCLUDED.** Fittings (**except joints in the running length**) to **LARGE pipes (ID exceeding 60 mm)** and to gutters shall be **ENUMERATED, GROUPED TOGETHER FOR EACH SIZE, and described as 'FITTINGS'** |
| **Q2.3** | **Valves, traps, expansion compensators or the like — ENUMERATED. SLEEVES, COVER-PLATES OR THE LIKE ARE INCLUDED** |
| **Q3.1** | **RECTANGULAR ductwork by WEIGHT**, based on area = **centre-line length over all fittings × net girth of nominal dimensions**. **Blank ends ADDED to the area for weighting. NO deduction for intersections or openings. Extra weight for seams, stiffeners, supports, fixings INCLUDED** |
| **Q3.2** | **Circular, oval and flexible ductwork by LENGTH**, along the centre line over all fittings |
| **Q3.3** | **Fittings to RECTANGULAR ductwork INCLUDED.** Fittings to circular and oval ductwork (**excluding test holes and covers**) **ENUMERATED, grouped for each size, described as 'fittings'** |
| **Q3.4** | **Dampers, grilles, flexible connectors — ENUMERATED** |
| **Q4.1** | **Sanitary fittings, tanks, fans, pumps, hoods, air-handling units — ENUMERATED** |
| Q4.2 | Continuous convectors — LENGTH |
| Q4.3 | Heated or ventilated ceilings — AREA |
| Q5.1 | Sensing/activating devices (thermostats, humidistats, motorised valves), control panels, air compressors and receivers — ENUMERATED |
| **Q5.2** | **Wiring, pneumatic tubing, isolators, starters, relays associated with automatic controls — INCLUDED** |
| Q5.3 | Alternatively, automatic control systems as an ITEM per installation; equipment common to more than one system ENUMERATED |
| Q6.1 | Connections to supply mains — ENUMERATED, subject to GP8 |
| **Q7.1** | **Insulation to PIPEWORK by LENGTH**, along the centre line over all fittings |
| **Q7.2** | **Insulation to RECTANGULAR ductwork by AREA**, calculated per Q3; **additional insulation to flanges INCLUDED** |
| Q7.3 | Insulation to circular, oval, flexible ductwork by LENGTH over all fittings |
| **Q7.4** | **Insulation boxes around accessories — ENUMERATED** |
| Q7.5 | Insulation to equipment — ENUMERATED |
| Q8.1 | Sundries per **P2.1** — supports, identification, testing and commissioning, tools and spares, documents, each an ITEM |
| Q9.1 | Work incidental per **P3.1** — co-ordination, cutting/forming holes and making good, building in brackets and making good, each within the ITEM |

================================================================================
SECTION R — ELECTRICAL ENGINEERING INSTALLATIONS
================================================================================

| Clause | Rule |
|---|---|
| R1.1 | Installations and auxiliary installations classified **by function**, given separately |
| R1.2 | Measured per this section; **alternatively enumerated on a LOCATIONAL basis** |
| **R1.3** | **'CABLE' INCLUDES tape, BUS-BAR TRUNKING or the like** |
| **R1.4** | **'CONDUIT' INCLUDES trunking, CABLE TRAY, ducting or the like** |
| R2.1 | 'Main' = the **incoming supply to the main distribution board** within a building or complex |
| **R2.2** | **Main circuit cable by LENGTH** |
| **R2.3** | **Main circuit conduit by LENGTH** |
| R3.1 | 'Sub-main' = the **supply from the main distribution board to a sub-main distribution board** |
| **R3.2** | **Cable and conduit to individual SUB-MAIN circuits shall be ENUMERATED** and separately identified as appropriate; **alternatively** measured per R2 (by length) |
| **R4.1** | **Cable and conduit to termination points — ENUMERATED AS POINTS**, classified: 1 Lighting points; 2 Lighting switch points **stating one-way, two-way or intermediate**; 3 General purpose socket outlets — **multi-gang socket outlets count as ONE point**; 4 Equipment points **stating type of equipment or the electrical rating** — contactors, starters measured separately as equipment points; 5 Auxiliary installation points (e.g. bell push, telephone outlet) |
| R5.1 | Ceiling roses and pendants, lighting switches, socket outlets, bell pushes — ENUMERATED |
| R6.1 | Switchgear, distribution gear, contactors, starters, composite switchboards — ENUMERATED |
| R7.1 | Transformers, generators, standby power cubicles, luminaires, external lighting columns, clocks, loudspeakers, bells — ENUMERATED |
| R7.2 | Controls — **includes accessories and interconnecting cables** — measured per this section; alternatively included with the equipment items |
| R8.1 | Connections to supply mains — ENUMERATED, subject to GP8 |
| R9.1 | Sundries per **P2.1** |
| R10.1 | Work incidental per **P3.1** |

**R4.1 is the clause most often breached in practice.** Final sub-circuits are
**not measured by cable length**. They are enumerated as POINTS, and the cable
and conduit to the point are within the point. A take-off that measures final
circuit cable by the metre AND enumerates the accessory has double-counted the
cable, and it has done so invisibly.

================================================================================
SECTION 20 — HOUSE EXTENSIONS AND CORRECTIONS
================================================================================

Under GP1.2, every departure from POMI must be STATED. These are this office's
departures, and each must appear in the bill's preamble.

**CORRECTIONS TO PREVIOUSLY DRAFTED HOUSE RULES** — the following were written
before the standard was consulted and are WRONG against it:

| House rule as drafted | Clause | Correction |
|---|---|---|
| Riser fittings enumerated individually by type — tee, bend, isolation valve, drain point | Q2.2 | Fittings to pipes **>60 mm ID** are enumerated **grouped for each size and described simply as 'fittings'**. Fittings to pipes **≤60 mm ID are INCLUDED**. Valves ARE separately enumerated (Q2.3), fittings are not itemised by type |
| Sleeves and puddle flanges cross-referenced to the structure seat | **Q2.3** | **Sleeves and cover-plates are INCLUDED in the pipework item.** Only the structural opening and any cast-in structural component belong to structure |
| Riser clamps and supports enumerated per level | **P2.1 / Q8.1** | **Supports are an ITEM**, including fixings, anchors, insulating blocks and anti-vibration devices. Not enumerated per level |
| Fire stopping enumerated per penetration per level | **P3.1 / Q9.1** | **Cutting or forming holes and making good is within the incidental-work ITEM.** Fire stopping as a specified material may be measured under the relevant section, but the hole and the making good are not enumerated |
| Duct measured "by area or by length, state which" | **Q3.1 / Q3.2** | **Rectangular duct is measured by WEIGHT**, the area being **centre-line length over all fittings × net girth of nominal dimensions**, blank ends added for weighting, no deduction for intersections or openings. Circular, oval and flexible by LENGTH. There is no choice |
| Duct fire dampers and access panels each enumerated | Q3.3, Q3.4 | **Dampers ARE enumerated** [Q3.4]. **Q3.3 does address covers**: fittings to circular and oval duct are enumerated *"excluding test holes and covers"* — so test holes and covers are OUTSIDE the grouped 'fittings' enumeration and are given separately where the specification requires them. On RECTANGULAR duct all fittings are included [Q3.3] |
| Busbar treated as its own family with tap-offs enumerated | **R1.3, R2.1, R3.2** | **Bus-bar trunking IS 'cable'** [R1.3]. But WHICH rule applies depends on the circuit: **R2.2 length applies only to a MAIN — the incoming supply to the main distribution board** [R2.1]. A busbar rising main feeding sub-main boards is a **SUB-MAIN**, where **R3.2 makes ENUMERATION PER CIRCUIT the primary rule and length the ALTERNATIVE**, chosen once by C3. Tap-off units are enumerated under R6.1 or R7.1 |
| Cable risers measured as cable + containment + supports | R1.4, R2.2, R2.3, **P2.1** | Cable by length, **conduit — which INCLUDES trunking, tray and ducting — by length**. **Supports are an ITEM**, not enumerated |
| Final circuit cable measured by length | **R4.1** | **Final sub-circuits are ENUMERATED AS POINTS.** The cable and conduit to the point are within the point |
| Pipe measured net of fittings | **Q2.1** | Measured along the centre line **OVER ALL FITTINGS** |
| Pipe diameter stated without qualification | **GP5.2** | Must state whether the diameter is **INTERNAL or EXTERNAL** |
| Reinforcement uplifted for laps and tying wire | **C3.1, C3.3, GP1.1** | **NET weight, without addition for rolling margin, supports, spacers or tying wire** [C3.1]. **POMI is SILENT on bar laps** — it excludes them expressly for FABRIC only [C3.3]. Bar laps are measured as bar length **where the detail shows them**, on the GP3.1 net-as-fixed-in-position basis; this is a GP1.1 build-up, declared below. Where the detail does not place the lap, the quantity is NOT measured from an assumed stock length — GP2.2 applies |
| Formwork reuse memo attached to the item | C4 | No clause supports a reuse factor; the memo is a HOUSE addition and must be declared under GP1.2 |
| Dewatering measured as an Enabling item | **A8.1** | **De-watering is within the Temporary Works ITEM** in General Requirements |

**STANDING HOUSE EXTENSIONS** — permitted under GP1.2, declared in the preamble:

| Extension | Reason |
|---|---|
| ~~Section S — Communications and ELV~~ **WITHDRAWN v1.2** | The extension was unnecessary. POMI ends at R because communications and ELV ARE electrical engineering installations. They are billed in **R** as their own item groups — no extension is needed, and inventing a letter put a non-POMI section on a bill titled POMI. See determinism.md §4.11a. |
| Riser register, segmentation by size, level-schedule vertical lengths | POMI gives the unit and the deemed-included list; it does not prescribe a build-up method. The build-up is house method and does not alter the measured result required by Q2.1 |
| Billed quantity rounded up to the whole unit | GP3.1 requires measurement to the nearest 10 mm; rounding the BILLED figure is a house presentation rule |
| Confidence marking HIGH / MED / LOW | GP2.2 requires inaccurate work to be described as approximate; confidence is how we identify it |

================================================================================
SECTION 21 — SELF-CHECK
================================================================================

AQ.1   Every measured item cites a POMI clause id, or is declared at §20.
AQ.2   Every unit came from its clause; no unit was chosen.
AQ.3   Every POMI classification list was used as the bill's sub-headings, in
       the order the clause gives them.
AQ.4   Nothing on a DEEMED-INCLUDED list was measured separately.
AQ.5   Everything on an ENUMERATE-SEPARATELY list was enumerated.
AQ.6   Every description carries its mandatory statements, including GP5.2
       internal-or-external diameter for pipework.
AQ.7   Every dimension is measured net, as fixed in position, to the nearest
       10 mm (GP3.1).
AQ.8   Area deductions applied the 1.00 m² limit (GP3.2), and every void at an
       EDGE was deducted regardless of size (GP3.3).
AQ.9   Volume deductions applied the 1.00 m³ limit and did not deduct
       reinforcement or enclosed structural metal, except boxed or tubular
       metalwork (C1.3).
AQ.10  Shuttering is the NET CONTACT AREA and carries no reuse factor (C4.1).
AQ.11  Reinforcement is NET weight with no addition for spacers, tying wire,
       supports or rolling margin (C3.1).
AQ.12  Pipework is measured over all fittings (Q2.1); the 60 mm threshold was
       applied to decide whether fittings are included or grouped (Q2.2).
AQ.13  Rectangular ductwork is measured by WEIGHT (Q3.1); circular, oval and
       flexible by LENGTH (Q3.2).
AQ.14  Final sub-circuits are enumerated as POINTS (R4.1), not measured by
       cable length.
AQ.15  Supports, identification, testing and commissioning, tools and spares
       and documents are each an ITEM (P2.1) in every services section.
AQ.16  Cutting and forming holes and making good is within the incidental-work
       ITEM (P3.1), not enumerated.
AQ.17  Every alternative offered by a clause was chosen ONCE by C3, recorded,
       and applied consistently.
AQ.18  Every house departure is declared in the preamble under GP1.2.
