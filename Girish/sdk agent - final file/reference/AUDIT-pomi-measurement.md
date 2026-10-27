# AUDIT — pomi-measurement.md AGAINST THE STANDARD
## Every claim in the existing reference, checked clause by clause.
## Source: POMI, RICS 1979, reprinted 2004.

**Verdict: 8 wrong rules, 1 wrong section letter, 2 wrong clause citations, and
40 material omissions (O1–O40).** The file should be withdrawn and replaced by a pointer
to `ref-pomi-rules.md`, not patched.

The errors are not evenly distributed. The concrete and formwork content is
largely sound. The services content, the site-work content and the unit table
are unreliable.

================================================================================
PART 1 — WRONG RULES
================================================================================

**W1 · Pipework fittings — "where in doubt, enumerate and note it"**
File: *"fittings on a measured run are generally deemed included unless POMI
requires them enumerated; where in doubt, enumerate and note it."*
**Q2.2 is precise and admits no doubt:** fittings to pipes of **60 mm internal
diameter or less are INCLUDED**; fittings to pipes **exceeding 60 mm ID are
ENUMERATED, grouped for each size, described as 'fittings'**; joints in the
running length are included at any size.
"Where in doubt, enumerate" is the opposite of a deterministic rule and would
over-measure every small-bore run in the building.

**W2 · Ductwork unit**
File: *"Q | Mechanical | nr / set (plant), m (pipe/duct runs, stating size)"*
**Q3.1: RECTANGULAR ductwork is measured BY WEIGHT** — area computed as
centre-line length over all fittings × net girth of nominal dimensions, blank
ends added for weighting, no deduction for intersections or openings, and seams,
stiffeners, supports and fixings included. Only **circular, oval and flexible**
duct is by length (Q3.2). The file offers no weight route at all.

**W3 · Electrical final circuits**
File: *"R | Electrical | nr (boards/fittings), m (cable/containment, stating
size)"*
**R4.1: cable and conduit to termination points are ENUMERATED AS POINTS** —
lighting points, switch points (stating one-way, two-way, intermediate),
socket outlets (multi-gang = one point), equipment points (stating type or
rating), auxiliary points. Measuring final-circuit cable by the metre while also
enumerating the accessory double-counts the cable invisibly.

**W4 · Masonry by volume**
File: *"D | Masonry | m² (walls by area, stating thickness), **m³ for mass**"*
**There is no volume measurement of masonry in POMI.** D2.1 gives walls and
piers by AREA in four classifications and nothing else. "m³ for mass" is invented.

**W5 · Section letters L / M / N**
File: *"N | Furnishings | nr, item"*
**POMI is L Equipment, M FURNISHINGS, N SPECIAL CONSTRUCTION.** The file has
Furnishings at N. This is the same mislabel that appears in the BOQ skill, where
Stage 3 calls N "Special Construction — pool, spa" while the output summary
prints "N - FURNISHINGS". Both are wrong against the standard, in opposite
directions.

**W6 · Stair risers — right answer, three conflated clauses**
File: *"POMI is explicit: a staircase item includes treads, risers and strings
(it excludes soffits)."*
Three different clauses say three different things:
- **C4.1 item 10** SHUTTERING — *includes treads, risers and strings, excludes soffits*
- **J3.1 item 4** FINISHES — *includes treads, risers and edges of landings, excludes soffits* — **not strings**
- **J6.3 item 4** DECORATIONS — *includes treads, risers, strings and edges of landings, excludes soffits*
- **C2.1 item 9** CONCRETE staircases — *includes steps and strings*
The conclusion is right for each, but the clause quoted covers only shuttering.

**W7 · MEP riser length**
File: *"length = floor-to-floor height × number of floors served."*
**Q2.1: measured by length along the CENTRE LINE, OVER ALL FITTINGS**, net as
fixed in position to the nearest 10 mm (GP3.1). Superseded in full by
`ref-mep-riser-measurement.md` v2.0.

**W8 · Riser supports and penetrations**
File enumerates valves, tap-offs, fire dampers and fittings "per floor" and
treats supports as counted.
**P2.1 (via Q8.1 / R9.1): supports are an ITEM**, including fixings, anchors,
insulating blocks and anti-vibration devices. **P3.1 (via Q9.1 / R10.1): cutting
or forming holes and making good is within the incidental-work ITEM.**

================================================================================
PART 2 — WRONG CLAUSE CITATIONS
================================================================================

**C1 · The void deduction limit**
File cites **GP3.3** for *"no deduction for voids under 1.00 m²"*.
That is **GP3.2**. **GP3.3 is a different and more dangerous rule**, and the file
omits it entirely: minimum deductions apply **only to voids WITHIN the edges of
measured areas — voids AT THE EDGE are ALWAYS deducted, irrespective of size.**
An 0.4 m² opening at the end of a wall is deducted; the file's rule would keep it.

**C2 · Volume deductions**
File: *"For volume, deduct voids over the stated limit."* The limit is never
stated and the clause is never cited. **C1.3: no deduction for voids less than
1.00 m³, nor for the volume of any reinforcement or structural metal enclosed in
the concrete, EXCEPT voids caused by boxed or tubular structural metalwork,
which are always deducted.**

================================================================================
PART 3 — MATERIAL OMISSIONS
================================================================================

--------------------------------------------------------------------------------
GENERAL PRINCIPLES — 6 omissions
--------------------------------------------------------------------------------
| | Missing rule |
|---|---|
| O1 | **GP3.1** — measure net as fixed in position, **each measurement to the nearest 10 mm** |
| O2 | **GP3.3** — voids at the edge always deducted, irrespective of size |
| O3 | **GP4.1** — items fully inclusive of labour, materials, plant, **temporary works**, establishment charges, overheads and profit |
| O4 | **GP5.2** — pipework must state whether the diameter is **INTERNAL or EXTERNAL** |
| O5 | **GP2.2** — work that cannot be measured accurately is described as **APPROXIMATE** or given in a bill of approximate quantities |
| O6 | **GP6 / GP7 / GP8** — nominated specialists, nominated merchants and public-authority work as sums exclusive of profit, with a profit item and an attendance item |

--------------------------------------------------------------------------------
SECTION A — the whole section
--------------------------------------------------------------------------------
| | Missing rule |
|---|---|
| O7 | **A4.1, A5.1, A7.1, A8.1, A9.1** — five ITEMS with POMI's own inclusion lists. The file has one line, "item, sum" |
| O8 | **A8.1 places DE-WATERING inside the Temporary Works item.** Your sample Enabling bill measures it separately |
| O9 | **A5.1 places SCAFFOLDING inside Constructional Plant** — not measured |

--------------------------------------------------------------------------------
SECTION B — 12 omissions, several with large quantity consequences
--------------------------------------------------------------------------------
| | Missing rule |
|---|---|
| O10 | **B8.2** — excavation quantities are the **bulk BEFORE excavation**; **no allowance for working space** or subsequent variation in bulk; existing voids deducted |
| O11 | **B8.3** — multiple handling and transporting about the site is INCLUDED |
| O12 | **B8.4** — **earthwork support is an ITEM**, not measured by area |
| O13 | **B8.5 / B8.6** — rock as extra over, with POMI's own definition of rock |
| O14 | **B9.1** — excavation measured as **the void to be occupied by the permanent construction, or vertically above it**, in seven classifications |
| O15 | **B9.2** — **trenches for service pipes, drains and cables are measured BY LENGTH stating average depth, and DISPOSAL AND FILLING ARE INCLUDED.** Measuring them by volume and then billing disposal again is a double count |
| O16 | **B11.1** — disposal is measured as **equal to the volume of excavation**, in four classifications; "removed" includes providing a suitable tip |
| O17 | **B12.1** — filling measured as **equal to the void to be filled**, three classifications |
| O18 | **B4.3** — site clearance by AREA, **including removing vegetation, undergrowth, bushes, hedges and trees** |
| O19 | **B6.2** — **shoring other than incidental is an ITEM stating the location**; clearing away and making good included. Your sample bill measures shoring by length |
| O20 | **B19.2 / B19.3 / B19.4** — drain fittings grouped per size as 'fittings'; drain accessories enumerated with **concrete surrounds and additional excavation INCLUDED**; concrete beds and coverings by length stating pipe diameter, vertical surrounds including formwork |
| O21 | **B16.4 / B17.1** — driving sheet piling includes strutting, waling and withdrawing; performance-designed piles are enumerated with **reinforcement and disposal INCLUDED** |

--------------------------------------------------------------------------------
SECTION C — 5 omissions
--------------------------------------------------------------------------------
| | Missing rule |
|---|---|
| O22 | **C2.1's eleven classifications** and what each includes — beams measured **below the slab**, walls including attached columns, foundations including combined and isolated bases |
| O23 | **C4.1's eleven shuttering classifications** — the file gives four informal cases |
| O24 | **C4.2 / C4.3** — shuttering to edges by LENGTH with height range stated; grooves **≥2500 mm² by length, under 2500 mm² INCLUDED** |
| O25 | **C4.8** — where the concrete volume has not been deducted, **shuttering to the faces of the void is INCLUDED** |
| O26 | **C7 sundries entirely** — C7.1 surfaces finished to falls or cross-falls by AREA; C7.2 surface finishes by area, **tamped finishes INCLUDED**; C7.3 expansion material by area; C7.4 designed joints, water stops and cast-in channels by length; C7.5 forming sinkings and channels by length, the item **may include additional excavation, hardcore, shuttering and concrete**, alternatively enumerated; C7.6 fixings, ties and inserts enumerated or by area; C7.7 **mortices and holes INCLUDED** |

--------------------------------------------------------------------------------
SECTIONS D TO N — 8 omissions
--------------------------------------------------------------------------------
| | Missing rule |
|---|---|
| O27 | **D2.1** — cavity walls as a composite item including skins and cavity, **closing cavities at ends and around openings INCLUDED**; integral piers measured as walls of combined thickness |
| O28 | **E1.1** — metalwork weight is NET, **without addition for rolling margin or welding material, without deduction for holes, splay cuts or notches**; **E2.2 fittings and E2.3 fixings are ITEMS**; E2.6 protective treatment an ITEM |
| O29 | **F7.1** — composite items enumerated, **all metalwork INCLUDED** |
| O30 | **G1.1** — thermal and moisture work measured **FLAT, without addition for laps or seams** |
| O31 | **H5.1** — panes of irregular shape measured as **the smallest rectangle from which the shape can be cut** |
| O32 | **J6.3's twelve decoration classifications**, including radiators measured **over the area of heating surface**, gutters measured **inside and out**, and the **60 mm pipe threshold** dividing J6.3 item 11 from J6.4 |
| O33 | **K2.1** — **partitions measured BY LENGTH, taken OVER ALL doors and glazed units**, with the openings then enumerated stating the partition they occur in |
| O34 | **M2.1** — curtain track by length, hooks, gliders and stops INCLUDED; **N2.1** enclosures enumerated; **N3.1** installations as items |

--------------------------------------------------------------------------------
SECTIONS P, Q, R — 6 omissions
--------------------------------------------------------------------------------
| | Missing rule |
|---|---|
| O35 | **P2.1 — five ITEMS binding on Q and R via Q8.1 and R9.1**: supports (incl. fixings, anchors, insulating blocks, anti-vibration devices); identification (plates, discs, labels, charts, colour coding); testing and commissioning (incl. operating installations and providing fuel and power); tools and spares; documents |
| O36 | **P3.1** — incidental work ITEM: co-ordination; **cutting or forming holes and making good**; building in brackets and making good. **P3.2** protective and decorative painting as an item per system |
| O37 | **Q1.2 / R1.2** — the alternative of enumerating an installation **on a locational basis** |
| O38 | **Q2.3** — valves, traps and expansion compensators enumerated; **sleeves and cover-plates INCLUDED** |
| O39 | **Q5.2** — wiring, pneumatic tubing, isolators, starters and relays associated with automatic controls **INCLUDED**. **Q7.2** additional insulation to flanges INCLUDED |
| O40 | **R1.3 / R1.4** — 'cable' includes **bus-bar trunking**; 'conduit' includes **trunking, cable tray and ducting**. **R3.2** sub-main circuits enumerated per circuit, or by length |

================================================================================
PART 4 — WHAT THE FILE GETS RIGHT
================================================================================

Keep, with clause citations added:

- Measure net, evidence only, count don't factor — consistent with GP3.1 and the house R-rules
- The three-family concrete separation: concrete m³, shuttering m², reinforcement by weight
- Shuttering as net contact area, **no reuse factor** — and now confirmed: there is no reuse provision anywhere in C4
- No formwork to faces cast against earth or blinding
- Reinforcement measured from sections and details where no BBS is issued, with the derivation shown
- The bar mass-per-metre table — physical constants
- Laps measured as bar length, never as a percentage uplift
- Stair risers not separately measured
- Structural shaft walls measured as concrete plus shuttering

================================================================================
PART 5 — ACTION
================================================================================

1. **Withdraw `pomi-measurement.md`.** Replace with a pointer to
   `ref-pomi-rules.md`, `ref-mep-riser-measurement.md` and
   `ref-reinforcement-measurement.md`. Do not patch it — W1 to W8 are
   distributed through it and a patched file will be trusted where it should not
   be.
2. **Re-check three things in the produced output** against O15, O19 and W3:
   service-trench excavation billed by volume with disposal billed again;
   shoring billed by length where B6.2 gives an item; and final-circuit cable
   billed by the metre alongside enumerated accessories.
3. **Correct the L / M / N letters** in the BOQ skill's section manifest and in
   the house template's section list.
4. Every retained house rule to carry its clause, or be declared under GP1.2.
