# MEP RISER MEASUREMENT
## Version 2.2 — second independent verification; 13 findings closed,
##                including two self-check items that contradicted the body.
## SUPERSEDES v1.0 ENTIRELY.
## Source: POMI (RICS, 1979, reprinted 2004), Sections GP, P, Q, R.

Version 1.0 of this file was written before the standard was consulted and was
wrong in twelve places — it over-enumerated where POMI groups or gives an item,
and it measured ductwork by the wrong unit entirely. Every rule below now cites
its clause. Anything without a clause is a HOUSE EXTENSION declared at §9 and
notified in the bill preamble under GP1.2.

  POMI TELLS YOU WHAT THE ITEM IS, WHAT IS IN IT, AND WHAT IS NOT.
  THE HOUSE BUILD-UP TELLS YOU HOW TO ARRIVE AT THE LENGTH.
  THE BUILD-UP MAY NOT CHANGE THE ITEM.

NOTATION — two internal codes appear below and NEITHER is a POMI clause:
  **C3**       the Lead QS seat (seats-and-pipeline.md §1). NOT POMI clause C3
               Reinforcement.
  **class D**  the determinism class "produced by a script" (determinism.md §1).
               NOT POMI Section D Masonry.

--------------------------------------------------------------------------------
0  THE MEASURED ITEM — WHAT POMI ACTUALLY REQUIRES
--------------------------------------------------------------------------------

For a pipe riser, the bill line is:

  **LENGTH, taken along the CENTRE LINE, OVER ALL FITTINGS**            [Q2.1]
  stating the diameter, and **stating whether it is INTERNAL or EXTERNAL** [GP5.2]
  measured net as fixed in position, to the nearest 10 mm                [GP3.1]

That is the whole item. Not net of fittings. Not with fittings deducted. The tape
runs through every bend, tee and valve on the centre line and does not stop.

Everything else on the riser is one of exactly three things:

  ENUMERATED SEPARATELY  valves, traps, expansion compensators           [Q2.3]
                         fittings to pipes over 60 mm ID, GROUPED PER
                         SIZE and described as 'fittings'                [Q2.2]
                         dampers, grilles, flexible connectors           [Q3.4]
                         insulation boxes around accessories             [Q7.4]
                         connections to supply mains — **SUBJECT TO GP8**:
                         where the work may only be carried out by a government
                         or public authority it is a SUM exclusive of profit,
                         with a profit item [GP8.1] and an item for ASSISTANCE
                         BY THE CONTRACTOR [GP8.2], whose contents are those
                         listed at GP6.2 — NOT an enumerated measured item
                                                        [Q6.1/GP8.1/GP8.2]

  AN ITEM                supports — including fixings, anchors,
                         insulating blocks, anti-vibration devices  [P2.1 / Q8.1]
                         identification, testing and commissioning,
                         tools and spares, documents                [P2.1 / Q8.1]
                         incidental work — co-ordination, cutting or
                         forming holes and making good, building in
                         brackets and making good                   [P3.1 / Q9.1]

  INCLUDED IN THE RATE   fittings to pipes 60 mm ID or less              [Q2.2]
                         joints in the running length, any size          [Q2.2]
                         sleeves, cover-plates or the like — Q2.3 says
                         these are "understood to be included"; it does not say
                         in WHICH item. Either way they are not measured   [Q2.3]
                         fittings to rectangular ductwork                [Q3.3]
                         **the EXTRA WEIGHT FOR** seams, stiffeners,
                         supports and fixings to rectangular ductwork —
                         Q3.1 includes the added weight of that metal in the
                         weighted area. It does NOT abolish the P2.1 supports
                         ITEM, which is still given                      [Q3.1]
                         additional insulation to flanges                [Q7.2]
                         wiring, tubing, isolators, starters and relays
                         **associated with AUTOMATIC CONTROLS** — starters
                         and contactors forming part of the ELECTRICAL
                         installation are enumerated under R6.1, or as
                         equipment points under R4.1.4                   [Q5.2]
                         labour, materials, plant, temporary works,
                         overheads and profit                            [GP4.1]

**The 60 mm internal diameter threshold is the most load-bearing number in the
services sections.** It decides whether every fitting on a run is in the rate or
enumerated, and it appears again in J6.3/J6.4 for decoration.

================================================================================
1  THE RISER REGISTER  [HOUSE — GP1.2 extension, class D]
================================================================================

POMI requires the length; it does not tell you how to arrive at it. This is how.

One row per riser, from the riser diagram or schematic — never from a floor plan,
which shows where a riser passes, not what it is.

  riser_id       the identifier printed on the schematic. Not invented.
  service        the system it carries. Installations are classified BY
                 FUNCTION and given separately [Q1.1 / R1.1]
  start_point    a NAMED point: plant room, tank, incoming main, board, manhole
  end_point      a NAMED point: roof tank, highest fixture, terminal board, vent
  levels_served  the levels at which it makes a connection, listed individually
  shaft_ref      the shaft or duct it occupies, where identified

A riser with an unbounded end is NOT_MEASURABLE. Assuming it starts at the
lowest slab is how the plant-room run and the tank connection disappear.

**Alternative permitted by Q1.2 / R1.2:** an installation may instead be
ENUMERATED ON A LOCATIONAL BASIS (e.g. "cold water installation to ground
floor"). That choice is made ONCE per project by C3, recorded, and applied
consistently. It is not chosen per riser.

================================================================================
2  SEGMENTATION BY SIZE  [Q2.2, GP5.2 — class D]
================================================================================

Q2.2 groups fittings **for each size of pipe**, and GP5.2 requires the size
stated on every length item. A riser whose diameter changes is therefore more
than one item.

  A NEW SEGMENT BEGINS AT EVERY:
    change of diameter
    change of material
    change of insulation thickness or type    [GP5.2 — a length item states
                                               cross-sectional size; Q7.1 gives
                                               only the unit and the centre line]
    start or end of a horizontal offset

Sizes come from the SCHEMATIC or riser diagram and from layout size tags. Not
from the plan, which rarely tags a vertical.

Where the schematic shows a size change but not the level at which it occurs,
the boundary is NOT_FOUND: record both sizes, record the unknown transition,
raise a query. Do not place the change at the midpoint.

================================================================================
3  THE LENGTH  [Q2.1 measured; HOUSE build-up — class D]
================================================================================

  L_segment = (level_top − level_bottom) + Σ horizontal offsets in the segment

Measured along the CENTRE LINE, OVER ALL FITTINGS [Q2.1], net as fixed in
position, each measurement to the nearest 10 mm [GP3.1].

Levels come from the LEVEL SCHEDULE or the section — structural or finished
floor level, stated, and used consistently. **Never floor-to-floor height ×
floor count.** Ground storeys are taller; podium, transfer and plant levels
differ; a riser from a basement pump room starts below the lowest slab; one
terminating at a roof tank continues above the highest; and the top segment
stops at a connection, not at a level.

**Base and head allowances.** From start_point to the first vertical, and from
the last vertical to end_point. The plant-room horizontal run is frequently
longer than a storey and is the first thing lost, because the eye stops at the
top and bottom lines of the schematic.

**Offsets** are measured where dimensioned. **A schematic is not to scale** — an
offset visible but undimensioned is NOT_FOUND, raised, never scaled off.

Fittings at the offset are not added as length: the centre line already runs
through them [Q2.1]. Whether they are enumerated depends only on §4.

================================================================================
4  FITTINGS AND VALVES  [Q2.2, Q2.3]
================================================================================

  PIPE ID ≤ 60 mm       ALL FITTINGS INCLUDED — no fittings item at any
                        size below the threshold. Valves, traps and expansion
                        compensators are STILL enumerated at every size [Q2.3] |

  PIPE ID > 60 mm       Fittings ENUMERATED, **grouped together for each
                        size**, described as **'fittings'**.
                        NOT itemised as tees, bends, reducers, take-offs.
                        Joints in the running length INCLUDED at any size. [Q2.2]

  ANY SIZE              Valves, traps, expansion compensators or the like
                        ENUMERATED.                                       [Q2.3]
                        Sleeves, cover-plates or the like INCLUDED.       [Q2.3]

So a CHW riser at 150 mm produces: one length item per size; one 'fittings' item
per size, enumerated; and separate enumerated items for each valve type. A riser
at 50 mm produces the length item, the valves, and no fittings item — but it
still produces its insulation length line [Q7.1] and any insulation boxes
[Q7.4], and it still sits within the P2.1 supports item and the P3.1 incidental
item like every other run.

**"One per floor" remains banned** — a house rule, and it survives POMI because
Q2.3 requires valves enumerated and an enumeration is a count. Count them from
the schematic. A riser serving five levels may carry four branch valves because
the lowest comes off the header, or seven because two levels are twinned.

Where the schematic is single-line and shows no branch fittings, the count is
NOT_FOUND with a query. It is not the level count.

================================================================================
5  INSULATION  [Q7]
================================================================================

  Insulation to PIPEWORK        by LENGTH, along the centre line
                                OVER ALL FITTINGS                         [Q7.1]
  Insulation to RECTANGULAR
    ductwork                    by AREA, calculated per Q3                [Q7.2]
                                additional insulation to flanges INCLUDED [Q7.2]
  Insulation to circular, oval
    and flexible ductwork       by LENGTH over all fittings               [Q7.3]
  Insulation BOXES around
    accessories                 ENUMERATED                                [Q7.4]
  Insulation to EQUIPMENT       ENUMERATED                                [Q7.5]

Pipe insulation is measured on the SAME centre line as the pipe and therefore on
the same segmentation, because thickness follows diameter. **Q7.1 gives only the
unit and the centre-line rule; the requirement to state the size comes from
GP5.2**, and the thickness statement is a house requirement declared at §9. An insulated riser
produces at least two length lines per segment. A riser take-off with pipe
lengths and no insulation lines is incomplete on its face.

Vapour barrier, foil, cladding and mesh are stated in the description; they are
not separate items unless the specification bills them apart.

================================================================================
6  SUPPORTS, IDENTIFICATION, TESTING  [P2.1 via Q8.1 / R9.1]
================================================================================

**These are ITEMS. They are not enumerated and not measured.**

  1  Supports — INCLUDES fixings, anchors, insulating blocks and
     anti-vibration devices
  2  Identification — INCLUDES plates, discs, labels, charts, colour coding
  3  Testing and commissioning — INCLUDES operating completed installations
     and providing fuel and power
  4  Tools and spares — INCLUDES loose keys and consumable stores
  5  Documents — INCLUDES drawings, operating instructions, maintenance manuals

An item is given for each, per installation. Riser clamps, brackets, anchors and
guides all fall within item 1. Counting them per level, as v1.0 required, bills
work that is already in an item — a double count.

Where the specification requires a support regime that is not at the
contractor's discretion, give the particulars in the item description. The
particulars change what the item covers; they do not turn it into a measured
quantity.

================================================================================
7  HOLES, MAKING GOOD AND PENETRATIONS  [P3.1 via Q9.1 / R10.1]
================================================================================

An ITEM is given for incidental work, which INCLUDES:

  1  Co-ordination with other engineering installations
  2  Cutting or forming holes, mortices, chases or the like, **and making good
     finishings**
  3  Building in or cutting and pinning brackets or the like, **and making good
     finishings**

So the penetration, the hole, and the making good are inside this item. They are
not enumerated per floor.

**What is still separately measured**, and the distinction matters:

  the SLEEVE or cover-plate                    INCLUDED — not measured.
                                                Q2.3 does not name the item it
                                                sits in; do not assert one [Q2.3]
  the structural opening formed in concrete,
    and any cast-in structural component        CROSS_REF to the structure
                                                seat — it is concrete work,
                                                measured under Section C
  a specified FIRE-STOPPING MATERIAL or collar  measured under the section
                                                governing that material, or as
                                                an accessory [K1.2], where the
                                                specification bills it
  protective painting                           an ITEM per system
  decorative painting                           a FURTHER ITEM per system —
                                                P3.2 says "shall EACH be given
                                                as an item for each system";
                                                both incl. removing protective
                                                coating or wrapping, and
                                                cleaning and polishing exposed
                                                surfaces                  [P3.2]

A fire collar named and specified as a product is a proprietary accessory and is
enumerated under K1.2. The *hole it sits in* is P3.1. Version 1.0 conflated them.

================================================================================
8  BY SERVICE
================================================================================

--------------------------------------------------------------------------------
8.1  CHILLED WATER, HEATING, DOMESTIC WATER  [Q2, Q7]
--------------------------------------------------------------------------------
Length per size over all fittings; diameter stated internal or external.
Fittings grouped per size where over 60 mm ID. Valves enumerated by type and
size. Insulation by length on the same segmentation.

**Hot water carries a return.** Flow and return are two runs and two sets of
segments. Measured once, half the pipework is gone. [HOUSE — arises from Q1.1,
installations classified by function.]

Tanks, pumps, air-handling units, fans, hoods and sanitary fittings are
ENUMERATED [Q4.1] — they are not part of the riser.

--------------------------------------------------------------------------------
8.2  SOIL, WASTE AND VENT STACKS  [Q2]
--------------------------------------------------------------------------------
Measured downward: from the highest connection or the vent terminal above roof
to the drain connection. The below-slab drainage belongs to the drainage
measurement — cross-reference at the boundary, do not measure through it.

Stacks are almost always over 60 mm ID, so fittings are enumerated grouped per
size as 'fittings'. Traps are enumerated [Q2.3]. Access and rodding eyes are
fittings, not separate items, unless the specification names them as accessories.

The vent above the roof and the connection below the lowest slab are the two
ends that vanish. Both are within the measured centre line.

--------------------------------------------------------------------------------
8.3  FIRE — WET AND DRY RISERS, SPRINKLER  [Q2, Q4]
--------------------------------------------------------------------------------
Riser main by length per size. Landing valves, breeching inlets, air release and
drain assemblies are valves or the like and are ENUMERATED [Q2.3]. Hose reels
and cabinets are equipment or accessories — enumerated [Q4.1 / K1.2]. Sprinkler
heads are enumerated. Flow switches are sensing devices [Q5.1] and enumerated.

--------------------------------------------------------------------------------
8.4  DUCTWORK RISERS  [Q3]
--------------------------------------------------------------------------------

  **RECTANGULAR duct — BY WEIGHT.**                                       [Q3.1]
  Area = centre-line length OVER ALL FITTINGS × net girth of nominal
  dimensions. **Blank ends ADDED to the area for weighting. NO deduction for
  intersections or openings.** Extra weight for seams, stiffeners, supports,
  fixings INCLUDED. State material thickness and unit weight.       [GP5.4]

  **Weight = weighted area × unit weight for the stated material thickness.
  The AREA IS AN INTERMEDIATE; the BILLED QUANTITY IS WEIGHT.**       [GP5.4]

  **CIRCULAR, OVAL and FLEXIBLE duct — BY LENGTH**, centre line over all
  fittings.                                                                [Q3.2]

  Fittings to RECTANGULAR duct — INCLUDED.                                 [Q3.3]
  Fittings to CIRCULAR and OVAL duct — ENUMERATED, grouped per size,
  described as 'fittings', EXCLUDING test holes and covers.                [Q3.3]

  **Dampers, grilles, flexible connectors — ENUMERATED.**                  [Q3.4]

Fire dampers are dampers and are enumerated [Q3.4].

**Test holes and covers ARE addressed** — Q3.3 enumerates fittings to circular
and oval duct *"excluding test holes and covers"*, so they sit OUTSIDE the
grouped 'fittings' item and are given separately where the specification
requires them. On RECTANGULAR duct all fittings are included [Q3.3], so an
access panel there is not a separate measured item unless the specification
bills it.

--------------------------------------------------------------------------------
8.5  ELECTRICAL RISERS  [R1–R4]
--------------------------------------------------------------------------------

  **'Cable' INCLUDES tape, BUS-BAR TRUNKING or the like.**                 [R1.3]
  **'Conduit' INCLUDES trunking, CABLE TRAY, ducting or the like.**        [R1.4]

  MAIN circuit — the incoming supply to the main distribution board [R2.1]:
    cable by LENGTH                                                        [R2.2]
    conduit by LENGTH                                                      [R2.3]

  SUB-MAIN circuit — main board to a sub-main board [R3.1]:
    cable and conduit to individual sub-main circuits **ENUMERATED** and
    separately identified; **alternatively** measured by length per R2.    [R3.2]
    The choice is made once by C3 and applied consistently.

  FINAL SUB-CIRCUITS — **ENUMERATED AS POINTS**, cable and conduit to the
  termination point being WITHIN the point:                                [R4.1]
    lighting points
    lighting switch points, stating one-way, two-way or intermediate
    general purpose socket outlets — **multi-gang counts as ONE point**
    equipment points, stating type of equipment or electrical rating —
      contactors and starters measured separately as equipment points
    auxiliary installation points (bell push, telephone outlet)

  Accessories — ceiling roses, pendants, switches, socket outlets, bell
    pushes — ENUMERATED                                                    [R5.1]
  Control gear — switchgear, distribution gear, contactors, starters,
    composite switchboards — ENUMERATED                                    [R6.1]
  Equipment — transformers, generators, standby cubicles, luminaires,
    lighting columns, clocks, loudspeakers, bells — ENUMERATED             [R7.1]

**A busbar riser is 'cable' [R1.3] — but which rule applies depends on the
circuit it forms.** R2.2's length measurement applies to a MAIN, and R2.1 defines
a main as *"the incoming supply to the main distribution board within a building
or complex"*. A busbar rising main feeding sub-main boards up the building is a
**SUB-MAIN**, and R3.2 makes **enumeration per circuit the PRIMARY rule, with
length as the alternative** — chosen once by C3 and applied consistently.

Tap-off units are control gear or equipment and are enumerated under R6.1 or
R7.1. Version 1.0 built a separate busbar family with no clause behind it; do not
replace that error with the opposite one of forcing every busbar to R2.2.

**Measuring final-circuit cable by the metre AND enumerating the POINT
double-counts the cable, invisibly.** R4.1 puts the cable inside the point.
**R5.1 accessories are a SEPARATE and ADDITIONAL enumeration** — ceiling roses,
switches, socket outlets and bell pushes are enumerated as well as the point,
and suppressing them under-bills the fittings.

================================================================================
9  HOUSE EXTENSIONS — declared under GP1.2
================================================================================

| Extension | Why it does not conflict with POMI |
|---|---|
| Riser register with named start and end points | POMI requires the length; it is silent on how the run is bounded. Bounding it does not change the measured item |
| Segmentation at every size change | Required in substance by GP5.2 and Q2.2, which work per size |
| Vertical length from the level schedule | POMI is silent on the source of the dimension; GP3.1 requires net as fixed in position, which the level schedule gives and a nominal storey height does not |
| Base and head allowances | Part of the centre line under Q2.1; naming them prevents their omission |
| Ban on "one per floor" fitting counts | Q2.3 requires enumeration, and an enumeration is a count |
| Flow and return measured as two runs | Q1.1 classifies installations by function |
| Confidence marking on riser lines | GP2.2 requires work that cannot be measured accurately to be described as approximate |
| **AMENDMENT under GP1.2** — the Q1.2 / R1.2 locational alternative and the R3.2 enumeration/length alternative must EACH be elected ONCE per project by C3 and applied consistently | **This RESTRICTS an option POMI leaves open.** POMI attaches no project-wide-consistency condition to either election. A tenderer reading the preamble needs to know the election was made and which way — so this is a GP1.2 amendment, not a GP1.1 addition |
| Offsets never scaled from a schematic | GP3.1 requires net as fixed in position; a scaled dimension off a not-to-scale schematic does not satisfy it |
| Access and rodding eyes treated as 'fittings' rather than separately enumerated accessories | POMI is silent above ground. Q2.3's *"or the like"* and B19.3's treatment of gullies and traps as enumerated drain accessories are both available readings. **This decides money** — whether an eye sits inside a grouped fittings count or is enumerated separately. House election, declared |
| Test holes and covers given separately where the specification requires them | Q3.3 only EXCLUDES them from the grouped fittings item; it does not say they are measured. The separate item is house inference |
| Vapour barrier, foil, cladding and mesh stated in the description, not measured separately | Consistent with Q7's heading *"Insulation, including linings and protective coverings"*, but the no-separate-item rule is an inference |
| Segment breaks at change of MATERIAL, change of INSULATION, and at offset boundaries | GP1.1 permits more detailed information than the document requires. Q2.2 and GP5.2 require segmentation by size; the further breaks are house detail and do not change the measured length |
| Insulation THICKNESS stated on the description | GP5.2 requires size on a length item; thickness is house detail |
| Sprinkler heads enumerated | Not named in Q4.1's list. They are equipment or accessories and are enumerated under Q4.1 or K1.2; the choice is house practice, declared |
| Stack measured to the drain connection with a cross-reference at the boundary | POMI splits drainage between B19 (underground) and Q2 (pipework) without stating where the boundary falls; naming it is house practice |

================================================================================
10  BLOCK CONDITIONS
================================================================================

BR1   A riser length measured net of fittings rather than over them.      [Q2.1]
BR2   A length item without its diameter, or without stating internal or
      external.                                                          [GP5.2]
BR3   Fittings enumerated individually by type on a pipe over 60 mm ID
      instead of grouped per size as 'fittings'.                          [Q2.2]
BR4   Any item described as a 'FITTING' enumerated on a pipe of 60 mm ID or
      less. **Valves, traps, expansion compensators or the like are excluded
      from this block — they are enumerated at EVERY size.**        [Q2.2/Q2.3]
BR5   A sleeve or cover-plate measured or cross-referenced rather than
      included.                                                           [Q2.3]
BR6   Supports, anchors, guides or clamps enumerated rather than given as
      an item.                                             [P2.1/Q8.1/R9.1]
BR7   Holes, penetrations or making good enumerated rather than within the
      incidental-work item.                               [P3.1/Q9.1/R10.1]
BR8   Rectangular ductwork measured by length or by area rather than by
      weight.                                                             [Q3.1]
BR9   A deduction made from rectangular ductwork area for an intersection
      or opening, or blank ends omitted from the weighting area.          [Q3.1]
BR10  Fittings enumerated on rectangular ductwork.                        [Q3.3]
BR11  Bus-bar trunking treated as anything other than 'cable'.          [R1.3]
BR11a A busbar SUB-MAIN measured by length without the R3.2 alternative having
      been chosen once by C3 and recorded.                          [R3.2/R2.1]
BR12  Cable tray, trunking or ducting measured otherwise than as conduit.  [R1.4]
BR13  Final sub-circuit cable measured by length while the point is also
      enumerated.                                                         [R4.1]
BR14  A multi-gang socket outlet counted as more than one point.          [R4.1]
BR15  A vertical length derived as floor-to-floor × floor count.
BR16  A horizontal offset scaled from a schematic.
BR17  A riser with an unbounded start or end point.
BR18  A fitting or valve count derived as "one per floor".
BR19  An insulated riser with pipe lengths and no insulation lines.        [Q7.1]
BR20  A hot-water riser measured as a single run with no return.
BR21  A stack measured from the lowest slab rather than to the drain
      connection, with no cross-reference at the boundary.
BR22  Any rule applied here without a clause citation and without a §9
      declaration.
BR23  Insulation to RECTANGULAR ductwork measured by weight rather than by
      AREA calculated per Q3.                                            [Q7.2]
BR24  A connection to a supply main falling under GP8 enumerated as a measured
      item rather than given as a sum with profit and assistance items.
                                                            [Q6.1/GP8.1/GP8.2]

================================================================================
11  SELF-CHECK
================================================================================

AR.1   Every riser in the schematic is in the register with its printed id.
AR.2   Every riser has a named start and end point.
AR.3   Every length is measured along the centre line OVER ALL FITTINGS.
AR.4   Every length item states the diameter and whether it is internal or
       external.
AR.5   Every measurement is net as fixed in position, to the nearest 10 mm.
AR.6   Segmentation occurs at every size change, and every size came from the
       schematic or a layout tag.
AR.7   Vertical lengths came from the level schedule, and the datum is stated.
AR.8   Base and head allowances are measured from named points, or NOT_FOUND.
AR.9   Every offset is dimensioned at source. NO offset was scaled from a
       schematic. Undimensioned offsets are NOT_FOUND.
AR.10  The 60 mm threshold was applied to every run to decide fitting treatment.
AR.11  Fittings over 60 mm are grouped per size and described as 'fittings'.
AR.12  Valves, traps and expansion compensators are enumerated; sleeves and
       cover-plates are not.
AR.13  Rectangular ductwork is by weight with blank ends added and no deduction
       for intersections or openings; circular, oval and flexible by length.
AR.14  Dampers, grilles and flexible connectors are enumerated.
AR.15  Insulation to pipework is by length over all fittings, on the pipe's
       segmentation, stating thickness; boxes are enumerated [Q7.1/Q7.4].
       **Insulation to RECTANGULAR ductwork is by AREA per Q3 [Q7.2]**, and to
       circular, oval and FLEXIBLE ductwork by length [Q7.3].
AR.15a Any connection to a supply main was tested against GP8 before being
       enumerated.
AR.15b R7.2 controls — which INCLUDE accessories and interconnecting cables —
       were measured per Section R, or included with the equipment items, and
       the choice is recorded.
AR.16  Supports, identification, testing and commissioning, tools and spares and
       documents are each an ITEM, not enumerated.
AR.17  Cutting and forming holes and making good is within the incidental-work
       ITEM.
AR.18  Bus-bar is classified as CABLE [R1.3]; tray, trunking and ducting as
       CONDUIT [R1.4]. The measurement rule follows the CIRCUIT, not the
       product: MAIN — by length [R2.2/R2.3]; SUB-MAIN — enumerated per
       circuit [R3.2] unless the R2 alternative was elected and recorded;
       FINAL SUB-CIRCUIT — within the enumerated point [R4.1], never
       additionally by length.
AR.19  Final sub-circuits are enumerated as points, with cable and conduit
       within the point, and multi-gang outlets counted as one.
AR.20  The Q1.2 / R1.2 locational-enumeration alternative was either not used,
       or chosen once by C3 and applied consistently.
AR.21  Every rule cites a clause, or is declared at §9.
