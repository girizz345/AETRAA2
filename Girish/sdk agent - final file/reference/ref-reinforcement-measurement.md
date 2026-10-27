# REINFORCEMENT MEASUREMENT
## Version 1.2 — verified against the source; lap argument rebuilt,
##                B17.1 double count removed, C6.3 restored.
## Binding on every measurement seat.
## Source: POMI (RICS, 1979, reprinted 2004), Sections GP, C3, C4, D4.

Reinforcement is measured by weight, and almost every dispute about it is a
dispute about what is inside that weight. POMI settles it in four clauses, and
the settlement is narrower than most house practice assumes.

  C3.1  THE WEIGHT OF BAR REINFORCEMENT SHALL BE THE NET WEIGHT
        WITHOUT ADDITION FOR ROLLING MARGIN, SUPPORTS, SPACERS
        OR TYING WIRE.

  C3.2  BAR REINFORCEMENT SHALL BE MEASURED BY WEIGHT, STATING THE
        DIAMETER; BARS OF DIFFERING DIAMETERS SHALL BE GIVEN SEPARATELY.

  C3.3  FABRIC REINFORCEMENT SHALL BE MEASURED BY AREA, WITHOUT
        ADDITION FOR LAPS.

  C3.4  REINFORCEMENT SHALL BE GIVEN AS AN ITEM WHERE THE DETAILED
        DESIGN WORK IS THE RESPONSIBILITY OF THE CONTRACTOR.

--------------------------------------------------------------------------------
1  THE LAP QUESTION — POMI IS SILENT, AND WHY THE ANSWER STILL FOLLOWS
--------------------------------------------------------------------------------

**State this accurately: POMI does not say bar laps are measured.** It excludes
laps expressly for FABRIC only [C3.3] and says nothing about bar. The house
treatment below is a GP1.1 build-up — more detailed information than the
document requires — and it is declared at §9.

The argument is NOT that C3.1's silence proves anything. C3.1 governs what is
added to the WEIGHT BASIS — rolling margin (a mass tolerance), supports, spacers
and tying wire (accessory steel that is not the designed bar). It is not a list
of geometric exclusions, so its silence on laps carries no weight either way.

The argument is the **measurement basis**, and it is decisive:

  FABRIC is measured by **AREA OF COVERAGE** [C3.3]. A lap overlaps the same
  square metre twice. Adding it would count one area twice — so C3.3 excludes it
  expressly, and must.

  BAR is measured by **LENGTH × mass per metre** [C3.2]. A lapped bar is
  genuinely, physically longer. GP3.1 requires work measured **net as fixed in
  position**, and a lap is steel fixed in position, part of the permanent works.

The two clauses differ because the two bases differ, not because a drafter
signalled an intention.

  THEREFORE:
    BAR LAPS ARE MEASURED, as bar length, **WHERE THE DETAIL SHOWS THEM.**
    FABRIC LAPS ARE NOT MEASURED, EVER.                                 [C3.3]

A lap is measured because it is a real length of a real bar on a real detail. It
is **not** a percentage uplift on a total. A lap allowance applied as "+7.5% for
laps" has no clause behind it, is not net as fixed in position, and fails GP3.1
and the fabrication gate alike.

  MEASURED LAP        bar runs 6.80 m, detail shows a 40Ø lap at midspan,
                      T16 → lap 0.64 m → bar length 7.44 m
  FABRICATED LAP      total tonnage × 1.075
                      no clause, no evidence, not measurable

**WHERE THE DETAIL DOES NOT PLACE THE LAP.**
Do NOT derive the number of laps from an assumed stock length. How many laps a
bar needs is then a function of the bar length the contractor chooses to buy —
a construction method decision, which GP4.1 puts in the rate ("materials, goods
and all associated costs"). On a 6.80 m bar a single assumed 40Ø lap adds 9.4
per cent to that bar's weight, on an assumption about somebody else's
procurement.

The correct treatment is **GP2.2**: measure the bar as detailed, and describe the
item as **APPROXIMATE**, or give it in a bill of approximate quantities. The
tenderer prices knowing it will be re-measured against the executed BBS.

--------------------------------------------------------------------------------
2  WHAT IS EXPRESSLY EXCLUDED FROM THE WEIGHT  [C3.1]
--------------------------------------------------------------------------------

None of these is added to the weight, and none is a separate measured item —
they fall into the rate under GP4.1.

  ROLLING MARGIN   the permitted mass tolerance on the bar as rolled. The
                   measured weight is the theoretical weight from the nominal
                   diameter, not the delivered weight.
  SUPPORTS         chairs, stools, continuous high chairs, trestles
  SPACERS          blocks, wheels, clips
  TYING WIRE       all of it

A take-off carrying a line for spacers or tying wire has billed work already in
the rate. A take-off uplifting tonnage for rolling margin has billed steel that
does not exist in the design.

--------------------------------------------------------------------------------
3  BY DIAMETER, SEPARATELY  [C3.2]
--------------------------------------------------------------------------------

**Bars of differing diameters shall be given separately.** T12 and T16 are two
items. They may not be grouped, summed, averaged, or presented as a single
tonnage with a mixed description.

The description states the diameter. Under GP5.4, an item measured by weight
states the material thickness and unit weight where appropriate — for bar, the
diameter carries both.

Grade is stated where the specification distinguishes grades. **This is a house
requirement, not a POMI one** — C1.1 requires *reinforced and plain CONCRETE*
each to be so described, which is a rule about the concrete item and says
nothing about reinforcement grade. Declared at §9.

--------------------------------------------------------------------------------
4  THE CONVERSION  [physical constants — class D]
--------------------------------------------------------------------------------

  weight (kg) = total bar length (m) × mass per metre (kg/m)

Theoretical mass per metre for round bar, from nominal diameter:

  | Bar  | T6    | T8    | T10   | T12   | T16   | T20   | T25   | T32   | T40   |
  |------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
  | kg/m | 0.222 | 0.395 | 0.617 | 0.888 | 1.579 | 2.466 | 3.854 | 6.313 | 9.864 |

These are derived constants (7850 kg/m³ × πd²/4) and are class D. They are not
a benchmark, a ratio or a rule of thumb — they are the geometry of a cylinder.

Bar counts come from the detail:

  bars = (element dimension ÷ spacing) + 1

taken each way and each face as the detail shows, with the element dimension and
the spacing both read from the drawing. Neither is assumed.

--------------------------------------------------------------------------------
5  WHEN THERE IS NO BAR BENDING SCHEDULE
--------------------------------------------------------------------------------

At tender a BBS is frequently not issued. That does not make reinforcement
unmeasurable, and it does not license a ratio. Work down this order:

  1  **BBS ISSUED.** Measure the weight from the schedule. R1 read, one row per
     bar mark. This is the only case that requires no derivation.

  2  **NO BBS, BUT REINFORCEMENT SHOWN ON SECTIONS AND DETAILS.**
     **This is the normal tender case, and it is ordinary POMI measurement —
     NOT a departure and NOT declared under GP1.2.**
     C3.2 prescribes the ITEM: weight, stating the diameter, differing
     diameters separately. It says nothing about which document the dimension
     is taken from. Reading a bar length off a section rather than off a
     schedule is no more a departure than reading a wall length off a plan
     rather than off a schedule. The bill item is identical either way.
     Measure it: count bars from the printed spacing over the printed element
     dimension, take each bar's length from the detail including laps and
     anchorage as shown, convert at §4, and show the derivation in the
     description.
     Where the derivation carries real uncertainty — laps undimensioned,
     anchorage not shown, bar marks incomplete, secondary steel around
     openings undetailed — **GP2.2 applies: describe the item as APPROXIMATE,
     or give it in a bill of approximate quantities.** That is the honest
     treatment, and it is far better than the two things offices do instead:
     a kg/m³ allowance (no clause, fails GP3.1) or a rate-only item (leaves
     the tender total understated).

  3  **DETAILED DESIGN IS THE CONTRACTOR'S RESPONSIBILITY.**
     **Give reinforcement AS AN ITEM.** [C3.4]

     **C3.4 turns on design RESPONSIBILITY, not on document AVAILABILITY.**
     A missing bar bending schedule does NOT engage it. The BBS is a
     construction-stage document; its absence at tender says nothing about who
     designed the steel. Where the structural sections and details carry the
     engineer's reinforcement design, the design is the engineer's and route 2
     governs.

     C3.4 applies where the CONTRACT puts the rebar design on the contractor
     AND the element is measured under Section C: contractor-designed precast,
     and elements the specification hands over as a performance requirement.

     **TWO CASES THAT ARE NOT C3.4, AND ONE IS A DOUBLE COUNT:**

     **PERFORMANCE-DESIGNED PILING — NO reinforcement item at all.** B17.1:
     *"Performance designed piles shall be enumerated; reinforcement and
     disposal of material arising from boring shall be understood to be
     INCLUDED."* The reinforcement is inside the enumerated pile. Giving a C3.4
     reinforcement item beside it bills the same steel twice.

     **SHORING — no reinforcement item arises either way.** Shoring other than
     incidental is an ITEM under B6.2, and its reinforcement is within that
     item. B6.3 is not a design-allocation clause at all — it requires
     particulars to be given *where the design of the shoring is NOT at the
     contractor's discretion*, which is the opposite reading.

     **Applying C3.4 because a BBS is missing is a commercial error, not only a
     measurement one.** It transfers a design responsibility the contract has
     not transferred, and it converts a measurable quantity into a lump the
     employer cannot re-measure.

  4  **NEITHER A SCHEDULE NOR A DETAIL, AND THE DESIGN IS NOT THE
     CONTRACTOR'S.** The item is NOT_MEASURABLE. Quantity null, reason
     recorded, gap raised, and GP2.2 applies — describe it as approximate or
     give it in a bill of approximate quantities.

**Never a kg/m³ ratio.** 120 kg/m³ is a CHECKING benchmark for a senior QS
looking at a finished take-off. It has never generated a quantity, it traces to
no drawing, and it fails GP3.1, R-COUNT-FROM-DRAWINGS and the fabrication scan
together. A tonnage derived from concrete volume is the single clearest example
of a number that looks like a measurement and is not one.

--------------------------------------------------------------------------------
6  FABRIC  [C3.3]
--------------------------------------------------------------------------------

  Measured by **AREA**, **without addition for laps**.

Not by weight. Not by sheet. The mesh reference is stated in the description.

The area is the area covered, measured net as fixed in position — so the laps,
which overlap, are not added, and neither are they deducted twice: measure the
covered area once.

**In masonry**, fabric may alternatively be measured by LENGTH [D4.1]. That
alternative is chosen once by C3 and applied consistently.

--------------------------------------------------------------------------------
7  WHAT REINFORCEMENT DOES NOT DEDUCT FROM  [C1.3]
--------------------------------------------------------------------------------

  **No deduction shall be made from the concrete volume for the volume of any
  reinforcement or structural metal enclosed in the concrete.**

Except: voids caused by **boxed or tubular structural metalwork** are ALWAYS
deducted.

So concrete is measured gross of its reinforcement. A take-off that nets rebar
volume out of the concrete has under-measured the concrete and has done so on
an assumption no clause supports.

--------------------------------------------------------------------------------
8  COMPANION ITEMS  [C1.1, C2.1, C4.1]
--------------------------------------------------------------------------------

A reinforced concrete element yields three companion items, and the description
of each identifies the element so a reader can tie them together:

  POURED CONCRETE   m³, classified per the eleven at C2.1, stating thickness
                    where the classification requires it, and described as
                    REINFORCED [C1.1]
  REINFORCEMENT     weight, by diameter, separately per diameter [C3.2]
  SHUTTERING        m² net contact area, classified per the eleven at C4.1

Where a concrete item is described as reinforced [C1.1] and no reinforcement
item appears against it, that is a coverage failure — raise it, do not infer a
tonnage to close it.

--------------------------------------------------------------------------------
9  ITEMS NOT NAMED BY POMI  [HOUSE — declare under GP1.2]
--------------------------------------------------------------------------------

POMI does not name these. Each is a house extension and each must be declared:

  couplers and threaded connectors    enumerated, stating size and type
  starter bars and dowels             measured as bar, by diameter, where the
                                      detail shows them; otherwise NOT_FOUND
  galvanised or epoxy-coated bar      stated in the description, not a
                                      separate item
  stainless reinforcement             given separately, stated in the
                                      description
  (post-tensioning strand and cables are NOT a house item — see §9.1)

--------------------------------------------------------------------------------
9.1  PRESTRESSING — NAMED BY POMI, NOT A HOUSE ITEM  [C6]
--------------------------------------------------------------------------------

  C6.2  Prestressed concrete measured by **VOLUME**, classified per C2
  C6.3  Reinforcement per C3; **SUPPORTING STEEL WIRES OR CABLES MEASURED BY
        WEIGHT**
  C6.4  Shuttering per C4, **stating whether to PRE-TENSIONED or POST-TENSIONED
        members**

Strand and cable are therefore a POMI weight item under C6.3, not an undeclared
house extension. Ducts, anchorages and grouting are not named; those are house
items and are declared.

--------------------------------------------------------------------------------
10  BLOCK CONDITIONS
--------------------------------------------------------------------------------

BB1   Any reinforcement weight derived from concrete volume by a kg/m³ ratio.
BB2   Any percentage uplift applied for laps, waste, cutting or bending.
BB3   Any addition to the weight for rolling margin, supports, spacers or
      tying wire.                                                        [C3.1]
BB4   A separate measured item for chairs, spacers or tying wire.         [C3.1]
BB5   Bars of differing diameters grouped into one item.                 [C3.2]
BB6   A weight item that does not state the diameter.               [C3.2/GP5.4]
BB7   Fabric measured by weight or by sheet rather than by area.          [C3.3]
BB8   Any addition for fabric laps.                                       [C3.3]
BB9   Reinforcement measured as a weight where the detailed design is the
      contractor's responsibility — it is an ITEM.                       [C3.4]
BB10  Concrete volume reduced for the volume of enclosed reinforcement.   [C1.3]
BB11  A concrete item described as reinforced with no companion
      reinforcement item and no raised gap.                              [C1.1]
BB12  A lap measured where neither the detail nor the specification gives its
      length.
BB13  A bar count derived other than from a printed spacing and a printed
      element dimension.
BB14  A house item at §9 used without declaration under GP1.2.
BB15  C3.4 applied because a bar bending schedule was unavailable, rather than
      because the contract places the design on the contractor.
BB16  Measurement from sections and details declared as a GP1.2 departure — it
      is not one.
BB17  A derivation carrying material uncertainty billed as firm rather than
      described as approximate.                                          [GP2.2]
BB18  A reinforcement item given against a performance-designed pile — the
      reinforcement is INSIDE the enumerated pile.                       [B17.1]
BB19  A reinforcement item given against shoring — it is within the shoring
      ITEM.                                                          [B6.1/B6.2]
BB20  A lap quantity derived from an assumed stock length where the detail does
      not place the lap.                                           [GP4.1/GP2.2]
BB21  Bar laps claimed as a POMI requirement rather than a declared GP1.1
      build-up.

--------------------------------------------------------------------------------
11  SELF-CHECK
--------------------------------------------------------------------------------

AB.1   Every reinforcement item is by weight, stating the diameter, with bars
       of differing diameters given separately.
AB.2   The weight is net — no rolling margin, supports, spacers or tying wire.
AB.3   Bar laps are measured as bar length from the detail or the specified lap
       length, never as a percentage.
AB.4   Fabric is by area with no lap addition.
AB.5   Every bar count came from a printed spacing over a printed element
       dimension.
AB.6   Every conversion used the theoretical mass per metre for the nominal
       diameter.
AB.7   No quantity was derived from concrete volume.
AB.8   Where the detailed design is the contractor's, reinforcement is an ITEM.
AB.9   Where neither schedule nor detail exists, the item is NOT_MEASURABLE
       with a reason and a gap, and is described as approximate per GP2.2.
AB.13  Measurement from sections and details rather than from a BBS was NOT
       declared as a departure — it is ordinary POMI measurement of the C3.2
       item.
AB.14  C3.4 was applied only where the CONTRACT places the rebar design on the
       contractor, never because a bar bending schedule was unavailable.
AB.15  Where the derivation carried material uncertainty, the item is described
       as approximate under GP2.2 rather than billed as firm.
AB.16  No reinforcement item was given against a performance-designed pile or
       against shoring.
AB.17  No lap was derived from an assumed stock length.
AB.18  The bar-lap treatment is presented as a declared GP1.1 build-up, not as
       a POMI requirement.
AB.19  Prestressing strand and cables are measured by weight under C6.3, not
       treated as a house extension.
AB.10  Concrete volume was not reduced for enclosed reinforcement.
AB.11  Every reinforced concrete element has its three companion items, or a
       raised gap.
AB.12  Every §9 house item is declared under GP1.2.
