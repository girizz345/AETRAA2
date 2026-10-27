# Corpus verification — pass 2

Source: AETRAA POMI Take-off, The Complete Prompt Set. 419 pp, 23,393 lines,
plugin v4.6.4. Parsed 10 Sep 2026. Nothing below is estimated.

## 1 · The parse reconciles

The document states its own structure in 17 section headers. Parsing
independently and summing those headers agree exactly, so the extraction is
proved rather than asserted.

| Section | | Parsed | Stated | Formulas | Stated |
|---|---|---:|---:|---:|---:|
| GP | General Principles | 34 | 34 | 12 | 12 |
| A | General Requirements | 13 | 13 | 0 | 0 |
| B | Site Work | 95 | 95 | 65 | 65 |
| C | Concrete Work | 36 | 36 | 25 | 25 |
| D | Masonry | 10 | 10 | 8 | 8 |
| E | Metalwork | 11 | 11 | 8 | 8 |
| F | Woodwork | 22 | 22 | 17 | 17 |
| G | Thermal and Moisture Protection | 7 | 7 | 6 | 6 |
| H | Doors and Windows | 12 | 12 | 12 | 12 |
| J | Finishes | 16 | 16 | 11 | 11 |
| K | Accessories | 5 | 5 | 4 | 4 |
| L | Equipment | 2 | 2 | 1 | 1 |
| M | Furnishings | 3 | 3 | 2 | 2 |
| N | Special Construction | 3 | 3 | 2 | 2 |
| P | Conveying Systems | 5 | 5 | 4 | 4 |
| Q | Mechanical Engineering Installations | 23 | 23 | 21 | 21 |
| R | Electrical Engineering Installations | 17 | 17 | 12 | 12 |
| **Total** | **17 sections, 117 groups** | **314** | **314** | **210** | **210** |

Units resolved for all 314.

## 2 · Four disagreements with the v3.1 build spec

### 2.1 Rounding — per dimension, not once at the end  [DECISION NEEDED]

- **Spec, invariant 6:** "Sort everything, round once. Rounding happens exactly
  once, at the end, at POMI precision."
- **Corpus, GP3.1 / Part 0 §0.2:** round each dimension AS IT IS TAKEN, never
  the product.

      d_measured = round(d_drawn / 0.01) x 0.01

  Worked example, given in the corpus:

      4.237 x 2.981  ->  4.24 x 2.98  = 12.6352 m2     CORRECT
      4.237 x 2.981  = 12.630...      -> 12.63 m2      WRONG

  Dimensions stated inside a description are exempt: a 150 mm thick slab stays
  150 mm in the words.

**Consequence.** Touches every area and volume in the bill. Aaron's `compute`
and this package's `measure/compute.round_once` both implement round-at-the-end
and both are wrong against GP3.1.

### 2.2 Bar reinforcement is measured INCLUDING laps  [CORRECTED, CONFIRM]

- **Spec:** net weight with no addition for laps; the bar schedule includes
  laps, so the lap must be identified and removed.
- **Corpus, C3.1:**

      W = Sum (N_bars x L_bar_INCLUDING_LAPS x m_per_m(diameter))

  The clause excludes rolling margin, supports, spacers and tying wire. Laps
  are not on that list.

- **Part 0 §0.1** lists what never enters a quantity and names laps only for
  fabric, roofing and finishes: C3.3, G1.1, J1.1.
- **Ranked error #6** is "rebar uplifted by a BLANKET lap percentage", and says
  in terms: "Laps themselves ARE measured. What fails is the percentage, which
  names no location and cannot be re-derived."

**Consequence.** Stripping laps out under-measures every lapped bar.
`measure/evaluators/reinforcement.py` has been rewritten to C3.1: a cut-length
schedule is used as it stands; a separately stated lap is added only where the
schedule's layout excludes it; an ambiguous layout is refused, not guessed.

### 2.3 Evaluator count understated  [RE-SCOPE]

Spec says "42 with arithmetic beyond Sigma, 168 are L = Sum L / N = count /
A = Sum A". Classifying all 210 extracted formulas gives:

| Family | Clauses | Note |
|---|---:|---|
| Plain accumulation | 78 | one evaluator |
| Count | 60 | one evaluator |
| Multiplicative | 23 | 22 distinct expressions |
| Single-purpose | 26 | 25 distinct |
| Cross-reference | 19 | resolution, not arithmetic |
| Net-of deduction | 4 | 4 distinct |
| **Beyond a plain sum or count** | **72** | against 42 in the spec |

### 2.4 Two mechanisms neither design has  [DESIGN GAP]

- **Cross-reference clauses.** 19 carry no arithmetic of their own and point at
  another clause: "per B11", "per C3", "per C4", "per P2.1", "per P3.1",
  "measured to the relevant clauses of this section". The clause table needs a
  resolution step, with cycle detection.
- **Compound units.** 7 clauses measure in more than one unit depending on the
  classification chosen: NR / M, NR / M2, M / NR, KG / M2 / M, NR / —. Four more
  carry a multiplier: ITEM x5, ITEM x3. Both this package's `Clause` type and
  the spec's assume exactly one unit per clause.

## 3 · Three open questions the corpus settles

- **210 vs 207.** It is **210**. The per-section headers sum to exactly 210
  carrying arithmetic, 314 clauses and 117 groups — three independent totals
  that all reconcile.
- **Section letters.** 17 sections: GP A B C D E F G H J K L M N P Q R. **No S.**
  **M is Furnishings.** Matches the client v1.2 correction and the reference
  BOQ; the SKYON take-off is on the superseded scheme.
- **Void deduction.** A two-part test, not one threshold. Deduct if the void is
  >= 1.00 m2 **OR** it touches an edge (GP3.2 with GP3.3). A 0.36 m2 vent
  mid-wall is not deducted; the same vent at the wall's end is. Volume has a
  separate threshold of 1.00 m3 (C1.3), with boxed or tubular structural
  metalwork always deducted irrespective of size. The two numbers are for
  different units and are not interchangeable.

## 4 · Rules located for the clause table

Part 0 governs all sixteen measured sections.

**Never added to a quantity** (GP4.1, GP9.8 cl.2): working space, battering and
bulking on excavation (B8.2); rolling margin, welding material, spacers, tying
wire (E1.1, C3.1); laps and seams on fabric, roofing and finishes (C3.3, G1.1,
J1.1); waste of any kind. Adding any of them bills the same money twice — once
in the number, once in the rate. A description may list them as included; that
does not license adding them to the figure.

**Mandatory statements by unit** (GP5):

| Measured by | Description must state | Clause |
|---|---|---|
| length or depth | cross-sectional size and shape, girth or girth range | GP5.2 |
| length or depth, pipework | whether the diameter is internal or external | GP5.2 |
| area | the thickness | GP5.3 |
| weight | material thickness and unit weight | GP5.4 |
| enumerated, or an item | everything — the words carry all of it | GP5.1 |

A description may satisfy these by reference to another document (GP5.6),
provided that document is issued with the bill (GP2.3).

**Classification lists are the bill's sub-headings and are not optional.**
Poured concrete C2.1 has 11 classes; shuttering C4.1 has 11. These are the
grouping keys. The 15-degree boundary in shuttering class 3 is a real dividing
line — a surface 14 degrees from horizontal is a different item from one at 16.

**Grouping is a clause-level permission with a condition.** C2.3: differing
thicknesses may be grouped provided the RANGE is stated. C4.2: differing heights
of edge shuttering likewise.

## 5 · The nineteen ranked errors — a ready-made test suite

Every one produces a take-off in which each individual row is defensible, which
is exactly what a gate must catch and a reviewer cannot.

| # | Error | Clause | Typical effect |
|---:|---|---|---|
| 1 | Excavation measured with working space / battering / bulking | B8.2 | +25 to +40% on the dig |
| 2 | Pitched roof measured on plan, not on slope | G2.1 | -13 to -29% on the covering |
| 3 | Rock or faced work deducted from the item it is extra over | B8.5, D2.2 | loses the whole base item |
| 4 | Cavity wall: composite and skin-by-skin methods mixed | D2.1 cl.3 | x2 where they overlap |
| 5 | Beam measured full depth through the slab | C2.1 cl.8 | +30 to +50% on beam concrete |
| 6 | Rebar uplifted by a blanket lap percentage | C3.1, GP3.1 | +5 to +10%, uncitable |
| 7 | Fabric reinforcement uplifted for laps | C3.3 | +8 to +15% |
| 8 | MEP fittings enumerated on pipes <= 60 mm | Q2.2 | bills work already in the rate |
| 9 | Final sub-circuit cable measured AND the point enumerated | R4.1 | double-counts distribution |
| 10 | Attached column measured separately from its wall | C2.1 cl.6, J3.1 cl.2 | double count, invisible |
| 11 | Edge void under 1.00 m2 not deducted | GP3.3 | small each, endemic |
| 12 | Duct insulation billed by weight instead of area | Q7.2 | whole-item unit error |
| 13 | Irregular glass measured to its true shape | H5.1 | up to -50% on that pane |
| 14 | Open-spaced battens measured as timber length, not overall area | F4.1 | x2 to x3 |
| 15 | Partition length deducted for its doors | K2.1 | under-measures and double-pays |
| 16 | Decoration take-off copied from the finishes take-off | J6.3 vs J3.1 | loses 8 whole classes |
| 17 | Multi-gang socket counted as several points | R4.1 cl.3 | x1.5 to x3 on the count |
| 18 | Ductwork weight uplifted for seams, stiffeners, supports | Q3.1 | +10 to +15% |
| 19 | Tunnel-to-shaft intersections billed at plain tunnel rates | B24.1 cl.7 | loses the most expensive m3 |

## 6 · Decisions required before the table is merged

1. Rounding — confirm GP3.1 governs (round each dimension, never the product).
2. Reinforcement — confirm bar laps are measured, fabric laps are not.
3. Cavity walls — composite or skin-by-skin, chosen once per project (POMI
   permits either; error #4 is mixing them).
4. Grouping — the house wording for a stated thickness range under C2.3.
5. Cross-reference clauses — resolve automatically, or carry as a gap.
6. Compound units — which unit governs when a clause offers two.
7. GP alternatives — who records the once-per-project choice, and where.

## 7 · Status

- Clause id, section, group, verbatim text, unit and formula: extracted for all
  314, in `data/clauses.json`.
- Deduction thresholds, rounding, never-in-quantity, mandatory statements,
  classification lists and grouping permissions: located and read, NOT yet
  merged into the table.
- The merge is held pending section 6. Two of those decisions change the
  arithmetic itself, and a table built on the wrong reading is worse than none.
- Nothing is being assembled. The reader chain remains blocked on the drawings
  and the drawing register.
