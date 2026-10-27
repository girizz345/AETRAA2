# MEASUREMENT FORMULAE — HOW EVERY QUANTITY IS CALCULATED

**Binding on every measuring seat.** POMI tells you *what* to measure, in what unit, and what
the rate is deemed to include. It does **not** give you the arithmetic. This file does — one
formula per measurable item, every symbol defined, every deduction rule stated, and a worked
example with real numbers.

## How to read this file

| | |
|---|---|
| `[C4.1]` | the POMI clause the rule comes from. Open it in `pomi-verbatim.md` before relying on it |
| **HOUSE** | POMI is silent; this is a house convention. It is a GP1.1 build-up — "more detailed information than is required by this document" — and it is declared, not smuggled |
| ⚠ | the place this item is most often measured wrong, and what the error costs |

**Every formula below produces a NET quantity as fixed in position** `[GP3.1]`. None of them
adds waste, laps, rolling margin, working space or bulking. Those live in the rate, and a
take-off that adds them has billed the same thing twice.

---

# PART 0 — THE RULES THAT GOVERN EVERY SECTION

## 0.1 Rounding — the 10 mm rule `[GP3.1]`

> *Work shall be measured net as fixed in position and each measurement shall be taken to the
> nearest 10 millimetres; this principle shall not apply to dimensions stated in descriptions.*

```
d_measured = round(d_drawn / 0.01) × 0.01          d in metres, so 2 decimal places
```

Round **each dimension as it is taken**, not the product. `4.237 × 2.981` is taken as
`4.24 × 2.98`, not as `12.630…` rounded afterwards.

⚠ **The exemption matters.** A dimension *stated in a description* is not rounded — a
"150 mm thick" slab stays 150 mm in the words even though its measured length is rounded. Round
the description and you have changed the specification.

## 0.2 Deductions — the 1.00 m² rule, and its exception `[GP3.2] [GP3.3]`

> *Unless otherwise stated, no deduction shall be made from items required to be measured by
> area for voids of less than 1.00 m².*
>
> *Minimum deductions of voids shall refer only to voids WITHIN the edges of measured areas;
> voids which are AT THE EDGES of measured areas shall always be deducted, irrespective of
> size.*

```
A_net = A_gross − Σ A_void(i)   for every void where  A_void(i) ≥ 1.00 m²  OR  void touches an edge
```

The test is two-part and both parts must be applied:

| Void | Area | Touches an edge? | Deduct? |
|---|---|---|---|
| door opening in the middle of a wall | 1.89 m² | no | **yes** — ≥ 1.00 |
| small vent in the middle of a wall | 0.36 m² | no | **no** — < 1.00 and interior |
| same 0.36 m² vent, but at the wall's end | 0.36 m² | **yes** | **yes** — edge voids always go |
| stair void in a slab, running to the wall | 4.20 m² | yes | **yes** |

⚠ **The edge rule is the one that gets missed.** A 0.6 m² opening in the middle of a wall is
not deducted; the *same opening* at the wall's end is. The reason is physical: an interior
void leaves the surrounding work continuous and the labour is barely changed, but an edge void
removes an edge and changes the work at it.

**Volume has its own threshold** `[C1.3]` — 1.00 **m³** for concrete, not 1.00 m². They are
different numbers for different units and they are not interchangeable.

## 0.3 Timesing and squaring — the dimension-paper convention **HOUSE**

Every quantity on the measurement sheet is `N × L × W × H`, recorded in separate columns so
that each factor is auditable on its own:

```
Qty  =  N  ×  L  ×  W  ×  H
        │     │     │     └── Height / thickness / depth   (m)
        │     │     └──────── Width                        (m)
        │     └────────────── Length                       (m)
        └──────────────────── Number of times (timesing)   (dimensionless, an integer)
```

- **Area items** leave `H` empty: `A = N × L × W`
- **Linear items** leave `W` and `H` empty: `Len = N × L`
- **Enumerated items** carry only `N`
- **Weight items** carry the geometry AND the unit mass — see §0.4

⚠ **Timesing is a COUNT, never a factor.** `N = 4` means "four identical bays". It never means
"×1.05 for waste" or "×2 because it is two-sided". A two-sided item is measured twice, in two
rows, each citing its own face — because a reviewer must be able to see which face each row is.

## 0.4 Weight `[GP5.4]`

```
W_kg  =  V_m3  ×  ρ           where ρ is the material density, kg/m³
W_kg  =  L_m   ×  m_per_m     where m_per_m is the mass per metre, kg/m
W_kg  =  A_m2  ×  m_per_m2    where m_per_m2 is the mass per square metre, kg/m²
```

The description **must state the material thickness and unit weight** where relevant `[GP5.4]`.
Take `ρ` and `m_per_m` from the project specification or the manufacturer's data — never from
memory — and record the source on the measurement row.

## 0.5 The three quantities that are NEVER added

| Never add | Because | Clause |
|---|---|---|
| working space and bulking on excavation | quantity is the bulk **before** excavation | `[B8.2]` |
| rolling margin, supports, spacers, tying wire on rebar | the weight is the **net** weight | `[C3.1]` |
| laps on fabric reinforcement, on roofing, on finishes | measured **flat**, without addition for laps or seams | `[C3.3] [G1.1] [J1.1]` |

Each of these is a real cost and each belongs in the **rate**, under GP4.1 — "all items shall
be fully inclusive of all that is necessary to fulfil the liabilities and obligations arising
out of the contract". A take-off that adds them has billed the same money twice: once in the
quantity and once in the rate.

---

# PART 1 — SECTION B · SITE WORK

## B1 Site exploration `[B1.1–B1.3]`

All three are **ITEM** — no arithmetic. Records, samples/tests/analyses, reports.

## B2 Trial holes `[B2.1]`

**Unit: DEPTH (m), along the centre line. State the number and the maximum depth below
commencing level.**

```
Depth_total = Σ  d(i)          over every trial hole i
N           = count of holes            ← stated, not multiplied
d_max       = max d(i)                  ← stated
```

⚠ Depth is measured **from the commencing level**, which is the level the excavator starts
from — not from finished floor level and not from datum. Getting the commencing level wrong
shifts every hole by the same amount and is invisible in the total.

## B3 Boreholes `[B3.1–B3.3]`

Same shape as B2. **Cappings enumerated** `[B3.3]`.

## B4 Site preparation `[B4.1–B4.2]`

```
Clearance (m²)      = L_site × W_site  −  Σ (areas not within the clearance scope)
Tree removal (nr)   = count, by girth band
```

## B5 Demolitions and alterations `[B5.1–B5.5]`

Demolition of a whole structure is **ITEM**. Cutting openings and alterations are each
**ITEM**, stating what they are.

## B6 Shoring `[B6.1–B6.2]`

**ITEM.** Incidental shoring to demolitions is one item; other shoring is a separate item
stating the type and the construction supported.

## B7 Underpinning `[B7.1–B7.5]`

```
Length (m) = Σ L(i)   over each length of underpinning                       [B7.1]
```
The work within it — concrete, masonry, formwork — is measured in accordance with the
appropriate sections `[B7.2]`. **Excavation is the exception: B7.4 gives it its own rule.**

### B7.4 — underpinning excavation `[B7.4]`

```
V = L × W × D          W taken to the OUTSIDE LINE of the PROJECTING FOUNDATION,
                       or to the outside line of the NEW foundation,
                       WHICHEVER IS THE GREATER
```

| # | Class | |
|---|---|---|
| 1 | Excavation in **preliminary trenches DOWN TO** the base of the existing foundations | |
| 2 | Excavation **BELOW** the base of the existing foundations | |

⚠ **The width is not the new foundation's width.** It is measured to whichever projects
further — the existing footing's toe or the new work. Taking the new foundation width alone
under-measures every bay where the existing footing projects, which is most of them.

⚠ **The two classes are priced very differently** — working above the existing footing is open
trench, working below it is hand excavation in short lengths under a load. One combined item
loses that distinction and will be disputed.

## B8–B9 EARTHWORKS AND EXCAVATION — the section with the most money in it

### The bulk-before-excavation rule `[B8.2]`

> *The quantities for excavation shall be understood to be the bulk BEFORE excavation, and no
> allowance shall be made for any working space or subsequent variation in bulk; existing
> voids shall be deducted.*

```
V_exc  =  V_void_to_be_occupied            ← the designed void, nothing more
       −  Σ V_existing_voids                ← cellars, old tanks, existing basements
```

**Three things this rule forbids, each of them a common over-measure:**

| Do NOT add | Typical wrong uplift | On a 1,000 m³ dig |
|---|---|---|
| working space beyond the permanent construction | 0.60 m all round | **+340 m³, +34%** |
| bulking of excavated material | ×1.25 | +250 m³, +25% |
| battering / side slopes not in the design | 1:1 to 3.00 m | +180 m³ |

All three are real contractor costs. All three go in the **rate**, not the quantity.

### B9.1 Excavation — by VOLUME `[B9.1]`

> *Excavation shall be measured by volume as the void which is to be occupied by the permanent
> construction, or vertically above any part of the permanent construction.*

```
V = N × L × W × D
```
where `L`, `W` are the **plan dimensions of the permanent construction** (not of the dig), and
`D` is measured from the **commencing level** to the underside of the construction.

The seven classifications `[B9.1]`, each given separately:

| # | Class | Formula | Note |
|---|---|---|---|
| 1 | Oversite, to remove topsoil | `A_site × d_avg` | **state the average depth** |
| 2 | To reduce levels | `A × (RL_existing − RL_reduced)` | |
| 3 | In cuttings | cross-section × length, or end-area method below | |
| 4 | Basement | `L × W × D` | |
| 5 | Trench to receive foundations | `L_trench × W_trench × D` | **includes pile caps and ground beams** — do not measure those separately |
| 6 | Pit to receive foundation bases | `N × L × W × D` | **state the number** |
| 7 | Diaphragm walls | `L × W_permanent × D` | **state the width of the permanent construction and the type of support fluid** |

**End-area method for cuttings and irregular ground** **HOUSE** — POMI gives the unit, not the
technique:

```
V = Σ  ( (A(i) + A(i+1)) / 2 ) × c            simple end-area, chainage interval c

V = (c/3) × [ A(0) + 4(A1+A3+…) + 2(A2+A4+…) + A(n) ]      Simpson, n even, more accurate
```
Record which method was used on the measurement row. The two differ by a few percent on curved
ground and a reviewer must know which is in front of him.

### B9.2 Service and drain trenches — by LENGTH `[B9.2]`

```
Len = Σ L(i)     along the centre line
d_avg = ( Σ (L(i) × d(i)) ) / Σ L(i)          ← state this
```

⚠ **Disposal and filling are DEEMED INCLUDED** `[B9.2]`. Measure the trench by length and stop.
Adding separate disposal and filling rows for a service trench double-counts them.

### B8.5 Rock — EXTRA OVER `[B8.5]`

> *the volume of rock shall be measured but no deduction shall be made from the volume of
> excavation in which the rock occurs*

```
V_excavation = full designed volume          ← unchanged, rock included
V_rock       = the rock volume               ← measured AS WELL, not INSTEAD
```

⚠ This is the classic extra-over error. The rock is billed **on top of** the excavation, so the
excavation quantity is **not** reduced. Deduct it and you have paid for the rock but lost the
dig it sits in.

### B11 Disposal — by VOLUME `[B11.1]`

> *Disposal … shall be measured by volume as EQUAL TO the volume of excavation.*

```
V_disposal_total = V_excavation                    ← identically equal, always
V_backfilled     = V_excavation − V_permanent      ← what goes back in
V_removed        = V_excavation − V_backfilled     ← what leaves site
```
Four classifications `[B11.1]`: backfilled into excavation · backfilled making up levels ·
backfilled oversite (giving details of contouring) · **removed, which shall include providing a
suitable tip**.

⚠ **`V_disposal_total` must reconcile to `V_excavation` exactly.** If it does not, either the
excavation or the disposal is wrong. This is a gate, not a guideline.

### B12 Filling — by VOLUME `[B12.1]`

> *Filling material (OTHER THAN that arising from excavation…) shall be measured by volume as
> equal to the VOID TO BE FILLED.*

```
V_fill = V_void_to_be_filled           ← the compacted void, not the loose delivered volume
```
Three classifications: filled into excavation · filled making up levels · filled oversite.

⚠ **Imported fill only.** Material arising from the site's own excavation is billed under B11
as *backfilled*, not here. Measure it in both and you have paid twice for the same soil.

## B13–B18 PILING

### B14 Driven piling `[B14.1–B14.4]`

```
Supply (m)      = Σ L_pile(i)                    state the number
Driving (m)     = Σ ( pile point when PITCHED  →  pile point when DRIVEN )    state the number
Heads and shoes = enumerated
Cutting off / lengthening connections = enumerated
```
⚠ **Supply length ≠ driving length.** Supply is the pile as delivered; driving is only the
travel from pitched to driven. They are different numbers and POMI asks for both.

### B15 Bored piling `[B15.1–B15.6]`

```
Boring (m)   = formation level  →  bottom of pile hole     state the number
               INCLUDES blind boring where the pile top is below formation level
Rock (m)     = length through rock, EXTRA OVER — no deduction from total boring   [B15.2]
Linings (m)  = Σ L_lining
Concrete (m³)= Σ (π/4) × Ø² × L_filled
Disposal     = per B11
Cutting off tops / enlarged bases = enumerated
```

### B16 Sheet piling `[B16.1–B16.6]`

```
All measurements along the CENTRE LINE            [B16.1]
Supply (m²)  = area in FINAL POSITION             [B16.2]
Driving (m²) = formation level → bottom edge when driven                [B16.4]
Corner piles (m) · Cutting (m)
```
⚠ **Strutting, waling and withdrawing are DEEMED INCLUDED in driving** `[B16.4]`. Three items
a take-off often adds and should not.

### B17 Performance designed piling `[B17.1]`

**ENUMERATED**, and **reinforcement and disposal are deemed included**. So a performance pile
is one number — do not also measure its rebar under Section C or its spoil under B11.

## B19 Underground drainage `[B19.1–B19.6]`

```
Pipes (m)   = Σ L, along the CENTRE LINE, OVER ALL FITTINGS      [B19.1]
Fittings    = enumerated, GROUPED per pipe size, described as 'fittings'   [B19.2]
Accessories = enumerated — concrete surrounds and additional excavation DEEMED INCLUDED  [B19.3]
Beds/coverings (m) = by length, stating the pipe diameter        [B19.4]
Chambers    = enumerated (or measured to the relevant sections)  [B19.5]
Connections to existing = enumerated, subject to GP8             [B19.6]
```
⚠ *Over all fittings* means the bends and junctions are **inside** the pipe length as well as
being enumerated. That is not double counting — the length pays for the run, the enumeration
pays for the fitting's extra cost.

## B20 Paving and surfacing `[B20.1–B20.3]`

```
Paving (m²)     = Σ (L × W)  −  voids per GP3.2 / GP3.3
Expansion joints and water stops (m)  = Σ L
Channels, curbs, edgings (m)          = Σ L        curved work SO DESCRIBED
```

## B21 Fencing `[B21.1–B21.4]`

```
Fencing (m) = Σ L        ← posts and supports in the length are INCLUDED
                           excavating pits, disposal and filling are DEEMED INCLUDED
Special posts (gate, straining) = enumerated, same deemed-inclusions
Gates, barriers = enumerated
Finishes = per Section J
```
⚠ Do not measure the fence posts separately, and do not measure their pit excavation under B9.
Both are in the linear rate.

## B22–B26 Landscaping, railway, tunnelling

```
Cultivating / seeding / turfing (m²) = Σ A
Plants, trees, shrubs (nr)           = count, by species and size
Switches and crossings (nr)          = count, FIVE classes: switches and turnouts,
                                       diamond, single slip, double slip, other   [B23.3]
Ballast (m³)                         = Σ V, NO DEDUCTION FOR THE TRACK, in TWO
                                       classes — BOTTOM ballast placed BEFORE the
                                       track is laid, TOP ballast placed AFTER    [B23.4]
Support and stabilisation            = per B26
```

### B24.1 — tunnel and shaft excavation `[B24.1]`

```
V = the void TO BE OCCUPIED, INCLUDING THE VOLUME OF THE PERMANENT LINING
    grouped as appropriate to identify different lengths
```

⚠ **The lining volume is INSIDE the excavation quantity, not deducted from it.** The excavation
is the whole bored void; the lining is then measured again as lining under `[B25.1]`. That is
not a double count — one is the dig, the other is the concrete — but netting the lining out of
the excavation is a real under-measure.

**Seven classes, and the last one is the one that is missed:**

| # | Class | | # | Class |
|---|---|---|---|---|
| 1 | Straight tunnels | | 5 | Tapered tunnels |
| 2 | Straight shafts | | 6 | Tapered shafts |
| 3 | Curved tunnels | | 7 | **Other cavities**, which **include transitions, breakaways and intersections between shafts and tunnels** |
| 4 | Curved shafts | | | |

⚠ **Class 7 carries the junctions.** A tunnel-to-shaft intersection is not part of either the
tunnel or the shaft — it is its own class, and it is the most expensive cubic metre on the job.
A take-off with six classes has billed the junctions at plain tunnel rates.

**Tunnel linings** `[B25.1]` are then measured **by area**, **stating whether spray or cast
concrete**, in **two** classes — the **primary** lining and the **secondary** lining. (The RICS
text prints class 1 as a bare "lining"; the qualifying word is lost in the source. Read against
class 2 it is the primary lining, and `pomi-verbatim.md` preserves the defect as printed.)

---

# PART 2 — SECTION C · CONCRETE WORK

## 2.1 The deduction rule for concrete `[C1.3]`

> *No deduction shall be made for voids less than 1.00 m³, nor for the volume of any
> reinforcement or structural metal enclosed in the concrete, EXCEPT that voids caused by
> boxed or tubular structural metalwork shall ALWAYS be deducted.*

```
V_net = V_gross
      − Σ V_void(i)          for voids ≥ 1.00 m³
      − Σ V_boxed_or_tubular_steel        ← ALWAYS, irrespective of size
      − 0                    for rebar and for solid enclosed steel sections
```

| Enclosed in the concrete | Deduct? |
|---|---|
| bar reinforcement, any quantity | **no** |
| a solid rolled steel section cast in | **no** |
| a **boxed** or **tubular** steel section cast in | **YES — always, any size** |
| a void, opening or duct < 1.00 m³ | no |
| a void ≥ 1.00 m³ | yes |

⚠ The boxed/tubular exception is absolute and has no size threshold. It is there because a
hollow section displaces concrete that would otherwise fill it, and it is easy to miss.

## 2.2 C2 Poured concrete — by VOLUME `[C2.1]`

```
V = N × L × W × T
```

The eleven classifications, each given separately, and each with what it **includes**:

| # | Class | Formula | Includes — do not measure separately |
|---|---|---|---|
| 1 | Foundations | `L × W × T` | combined and isolated bases |
| 2 | Pile caps | `N × L × W × T` | **ground beams** |
| 3 | Blinding | `A × t` | |
| 4 | Beds | `A × t`, **state thickness** | roads and footpaths |
| 5 | Suspended slabs | `A × t`, **state thickness** | floors, landings, roofs |
| 6 | Walls | `L × H × t`, **state thickness** | **attached columns** |
| 7 | Columns | `N × A_sect × H` | casing to metal stanchions [sic] |
| 8 | Beams, **measured below the slab** | `N × b × (D − t_slab) × L` | lintels, casing to metal beams |
| 9 | Staircases | by volume | steps and strings |
| 10 | Diaphragm walls | `L × W × D` | |
| 11 | Other classifications | as appropriate | |

⚠ **Class 8 is where concrete is most often over-measured.** A beam is measured **below the
slab** — its depth is the total depth *minus* the slab thickness, because the slab already
paid for that band. A 600 mm beam under a 200 mm slab is measured 400 mm deep.

```
V_beam = N × b × (D_total − t_slab) × L
```

⚠ **Class 6 includes attached columns.** A column cast integrally with a wall is part of the
wall, not a separate column item. Measuring it twice is a real double count that survives most
checks because both rows look correct on their own.

### C2.2 Special-construction suspended slabs — by AREA `[C2.2]`

> *Poured concrete suspended slabs of SPECIAL construction … shall be measured by AREA;
> coffered and troughed slabs shall be so described, giving details of solid margins.*

```
A = Σ (L × W)   −  voids per GP3.2/GP3.3          ← AREA, not volume
```
⚠ A coffered or troughed slab switches unit from m³ to **m²**. Measuring it by volume means
computing a void deduction for every coffer, which is exactly what this clause exists to avoid.

### C2.3 Grouping thicknesses `[C2.3]`

Items of differing thickness may be grouped **provided the range of thicknesses is stated**.

## 2.3 C3 Reinforcement `[C3.1–C3.4]`

### Bar — by WEIGHT `[C3.1] [C3.2]`

```
W_kg = Σ over each bar mark:  N_bars × L_bar × m_per_m(Ø)

m_per_m = (π/4) × Ø² × 7850 / 1e6        Ø in mm, gives kg/m for steel at 7850 kg/m³
```

Standard masses, for checking:

| Ø mm | 8 | 10 | 12 | 16 | 20 | 25 | 32 | 40 |
|---|---|---|---|---|---|---|---|---|
| kg/m | 0.395 | 0.617 | 0.888 | 1.579 | 2.466 | 3.854 | 6.313 | 9.864 |

**Bars of differing diameters are given SEPARATELY** `[C3.2]` — never a single blended tonnage.

**NET weight — nothing added** `[C3.1]`:

| Never add | Why |
|---|---|
| rolling margin | a mass tolerance, not steel you can point at |
| supports and chairs | accessory steel, not designed bar |
| spacers | ditto |
| tying wire | ditto |

⚠ **The lap question.** POMI excludes laps expressly for FABRIC only. For bar it is silent. The
house treatment is in `ref-reinforcement-measurement.md`: **a lap is measured as bar length
where the DETAIL SHOWS IT**, because a lapped bar is steel fixed in position. It is **never** a
percentage uplift on a total — "+7.5% for laps" has no clause behind it, is not net as fixed in
position, and fails GP3.1.

```
L_bar = L_designed + Σ lap(i)          where the detail places lap(i)
lap   = k × Ø                          k from the structural detail, typically 40
```

Read `[C3.1]`'s exclusion list **exactly**: *rolling margin, supports, spacers or tying wire.*
**Laps are not in it.** The contrast with `[C3.3]`, which excludes laps from fabric **in
terms**, is what proves the omission from `[C3.1]` is deliberate — a lap is steel fixed in
position and `[GP3.1]` measures what is fixed in position.

### HOUSE METHOD AT TENDER — no bar bending schedule issued

A BBS is rarely issued with a tender, so the bar arrangement is measured **from the section
drawings** and the laps derived from the **specified lap length** at the locations the sections
show them:

```
for each bar mark, read from the SECTION:
    N_bars   = (L_run / spacing) + 1                    ← count, not an assumption
    L_bar    = L_designed
             + n_laps × (k × Ø)                         ← k and the lap positions FROM THE
                                                          SPECIFIED DETAIL, not from habit
             + bends and hooks where the section details them
    W        = N_bars × L_bar × m_per_m(Ø)
```

Every row records the section drawing it came off, the spacing read, the lap length `k × Ø`
used, and how many laps that bar carries. That is **measurement** — it is citable line by
line, and a checker can re-derive it from the same section.

⚠ **What remains forbidden is a blanket percentage.** `+7.5% for laps` applied to a total has
no clause behind it, names no location, and cannot be re-derived. The difference is not the
steel — it is whether anyone can check it.

### THE SECTION DRAWINGS ARE THE SOURCE — not the bar bending schedule **HOUSE**

**Reinforcement is measured from the SECTION DRAWINGS.** That is the house rule, and it holds
whether or not a BBS exists — declared under `[GP1.1]` and recorded under `[GP1.2]`.

| | |
|---|---|
| **The source** | the **section drawings** — bar arrangement, spacing, cover, lap positions, bends and hooks, read off the section |
| **The BBS** | **a cross-check, never the source.** Where one is issued, reconcile the measured weight against it and record the variance; investigate a difference, do not silently adopt the schedule's figure |

Why the sections and not the schedule:

- At tender **no BBS is issued**, so a method that depends on one has no answer at tender and a
  different answer later. The take-off must produce the same figure at both.
- A BBS is the **fabricator's cutting list**. It carries the bars as they will be *ordered and
  bent*, which is not the same document as the designed arrangement, and it is revised on its
  own cycle.
- A section drawing is issued with the tender under `[GP2.3]` and is therefore **the document
  the contractor priced against**. Measuring from it means the quantity and the tender
  documents are the same evidence.

⚠ So a variance against a later BBS is **a finding to be recorded**, not a correction to be
applied. Where the two genuinely disagree the answer is a technical query, because the
disagreement is between the fabricator's list and the design — not an error in the take-off.

### Fabric — by AREA `[C3.3]`

```
A_fabric = A_covered            NO addition for laps, ever
```
⚠ Fabric is measured by **area of coverage**. A lap covers the same square metre twice; adding
it counts one area twice. This one is explicit in the clause and there is no argument.

### C3.4 Contractor-designed reinforcement

**ITEM**, where the detailed design is the contractor's responsibility.

## 2.4 C4 Shuttering (formwork) — by AREA `[C4.1]`

> *shuttering shall be measured by area, taken as the NET AREA IN CONTACT WITH THE FINISHED
> FACE of concrete*

```
A_shutter = Σ A_contact          only faces that touch concrete AND are shuttered
```

The eleven classifications `[C4.1]`:

| # | Class | Formula | Includes |
|---|---|---|---|
| 1 | Soffits | `L × W` | special construction SO DESCRIBED |
| 2 | Sloping soffits | `L × W` on the slope | **soffits of staircases** |
| 3 | Sloping upper surfaces | `L × W` | surfaces **more than 15° from horizontal** |
| 4 | Sides of foundations | `perimeter × depth` | bases, pile caps, ground beams |
| 5 | Sides of walls | `L × H` per face | **attached columns** |
| 6 | Returns to walls | `Σ h × w` | ends, projections, reveals of openings/recesses |
| 7 | Sides and soffits of beams | `L × (2h + b)` | lintels, breaks in soffits; isolated beams SO DESCRIBED |
| 8 | Sides and soffits of sloping beams | as 7 | as 7 |
| 9 | Sides of columns | `perimeter × H` | |
| 10 | Staircases | | treads, risers, strings — **but EXCLUDES soffits** (those are class 2) |
| 11 | Other | e.g. tunnel linings, bridges, abutments | |

**Worked — a rectangular beam, shuttered both sides and soffit:**
```
A = L × (2 × h_exposed  +  b)
  where h_exposed = D_total − t_slab        the soffit of the slab covers the rest
```

⚠ **The 15° threshold in class 3** is a real dividing line. A surface 14° from horizontal is
not shuttered on top; at 16° it is, and it becomes a measured area. Read the section, do not
eyeball the drawing.

⚠ **Class 10 excludes staircase soffits** and class 2 includes them. Bill a staircase soffit
twice and it will pass every arithmetic check.

### C4.2 Edges — by LENGTH `[C4.2]`

```
Len = Σ L         includes face of curb, upstand, break in upper surface of floor
```
Differing heights may be grouped **provided the range of heights is stated**.

### C4.3 Grooves — the 2500 mm² threshold `[C4.3]`

```
if  A_section ≥ 2500 mm²   →  measure by LENGTH
if  A_section <  2500 mm²  →  DEEMED INCLUDED, measure nothing
```
Covers throats, rebates, chamfers. A 50 × 50 chamfer is 2500 mm² exactly — **measured**, since
the clause says "2500 mm² sectional area or over".

### C4.8 Shuttering to a void `[C4.8]`

```
if  V_concrete for the void was NOT deducted  →  shuttering to the void's faces is DEEMED INCLUDED
```
⚠ This pairs with `[C1.3]`. A void under 1.00 m³ is not deducted from the concrete, so its
formwork is not measured either. Deduct neither or both — never one.

## 2.5 C5 Precast concrete `[C5.1–C5.6]`

```
Floor / partition slabs (m²)         = Σ A                        [C5.3]
Lintels, sills, duct covers (m)      = Σ L   (duct covers may be m²) [C5.4]
Structural units (nr)                = count — beams, stanchions, tunnel rings [C5.5]
Padstones, cappings (nr)             = count                       [C5.6]
```
**Moulds are DEEMED INCLUDED** `[C5.1]` — never a separate item.

## 2.6 C6 Prestressed concrete `[C6.1–C6.4]`

```
Concrete (m³)  = per C2 classifications                            [C6.2]
Reinforcement  = per C3;  supporting wires/cables BY WEIGHT        [C6.3]
Shuttering     = per C4, STATING pre-tensioned or post-tensioned   [C6.4]
```

## 2.7 C7 Sundries `[C7.1–C7.7]`

```
Surfaces to falls/cross-falls (m²)   = Σ A                         [C7.1]
Surface finishes (m²)                = Σ A  — tamped finishes DEEMED INCLUDED [C7.2]
Expansion material (m²)              = Σ A                         [C7.3]
Designed joints, water stops, cast-in channels (m) = Σ L           [C7.4]
Sinkings, channels (m)               = Σ L, may include additional excavation,
                                       hardcore, shuttering and concrete; or enumerated [C7.5]
Fixings, ties, inserts (nr)          = count, or by area           [C7.6]
Mortices, holes                      = DEEMED INCLUDED — measure nothing [C7.7]
```
⚠ `[C1.4]` — horizontal concrete surfaces are **understood to be tamped** unless otherwise
described. A tamped finish is therefore not a measurable item; anything better than tamped is.

---

# PART 3 — SECTION D · MASONRY

## 3.1 D2 Walls and piers — by AREA `[D2.1]`

```
A = Σ (L × H)  −  voids per GP3.2 / GP3.3
```

| # | Class | Formula | Note |
|---|---|---|---|
| 1 | Walls | `L × H` | **integral piers measured as walls of COMBINED pier and wall thickness** |
| 2 | Walls built against other construction | `L × H` | so described |
| 3 | Cavity walls | **either** one composite area **or** each skin and the cavity by area | POMI allows both — see below |
| 4 | Isolated piers | `L × H`, so described | not bonded into a wall |

✅ **Class 3 gives the measurer a CHOICE, and POMI says so in terms.** The clause reads
*"Cavity walls measured as a composite item, including skins and cavity; alternatively, the skins
and cavity may each be measured by area."* So both of these are correct:

```
METHOD A — composite     A = Σ (L × H)   at one description "100 + 50 cavity + 100"
METHOD B — separately    A_outer = Σ (L × H)   at 100 mm
                         A_cavity = Σ (L × H)  at 50 mm
                         A_inner  = Σ (L × H)  at 100 mm
```

⚠ What is wrong is **mixing them** — billing the composite item AND a skin, or measuring
Method B on one elevation and Method A on the next. Choose one for the whole bill and state
which in the preambles. A cross-check that assumes Method A will read a correct Method B
take-off as a ×2 over-measure, so the checker must be told which method is in force.

⚠ **Closing the cavity** at ends and around openings is **deemed included** — never a
separate item, under either method.

⚠ **Class 1's integral pier rule** — a pier bonded into a wall is measured as wall at the
combined thickness over the pier's own length, not as a separate pier item:

```
A_pier_zone = L_pier × H   at thickness (t_wall + t_pier)
```

### D2.2 Faced / fair-faced — EXTRA OVER `[D2.2]`

```
A_wall  = full area                    ← unchanged
A_faced = the faced area               ← measured AS WELL, stating one side or both
```
Same extra-over logic as rock `[B8.5]`: no deduction from the wall.

## 3.2 D3 Sills, copings, arches `[D3.1] [D3.2]`

```
Sills, copings, oversailing/receding courses (m) = Σ L
Arches (m)                                       = Σ L, on the mean girth
```

## 3.3 D4 Reinforcement `[D4.1]`

```
Bar     = per C3, by weight
Fabric  = per C3 by area, OR by LENGTH — the alternative D4.1 allows for bed-joint fabric
```

## 3.4 D5 Sundries `[D5.1–D5.3]`

```
Concrete filling to cavities (m²) = Σ A       ← AREA, not volume
Expansion joints (m)              = Σ L
Air bricks (nr)                   = count
```
⚠ Cavity fill is measured by **area** `[D5.1]`, with the thickness in the description per
`[GP5.3]` — not by volume. It is a common unit error.

---

# PART 4 — SECTION E · METALWORK

## 4.1 The weight rule `[E1.1]`

> *The weight of metalwork shall be the NET weight, WITHOUT addition for rolling margin or
> welding material and WITHOUT DEDUCTION for holes, splay cuts, notches or the like.*

```
W_kg = Σ over each member:  N × L × m_per_m
```

The rule cuts **both ways**, and both halves are routinely got wrong:

| | Adjust? |
|---|---|
| rolling margin | **no addition** |
| welding material, weld metal | **no addition** |
| bolt holes | **no deduction** |
| splay cuts, notches, copes | **no deduction** |

⚠ So a beam with forty bolt holes is measured at its **full gross section mass**. Deducting the
holes is as wrong as adding a rolling margin — it is the same clause forbidding both.

`m_per_m` comes from the section tables in the project specification. Record the section
designation on the measurement row so the mass is checkable.

## 4.2 E2 Structural metalwork — by WEIGHT `[E2.1]`

Seven classifications, each given separately:

| # | Class | Note |
|---|---|---|
| 1 | Grillages | |
| 2 | Beams | |
| 3 | Stanchions | |
| 4 | Portal frames | **stating the number** |
| 5 | Roof trusses | **stating the number** |
| 6 | Support steelwork | **includes** sheeting rails, braces, struts |
| 7 | Other classifications | |

```
W = Σ  N × L × m_per_m           per classification, never blended across classes
```

⚠ **Class 6 includes sheeting rails, braces and struts.** Measuring those as separate members
double counts them against the support-steelwork item.

## 4.3 E2.2–E2.6 — what is an ITEM and what is enumerated

| Clause | Work | Unit |
|---|---|---|
| E2.2 | Fittings (caps, brackets) | **ITEM** |
| E2.3 | Fixings (bolts, distance pieces, rivets) | **ITEM** |
| E2.4 | Wedging and grouting bases | enumerated |
| E2.5 | Holding-down bolts | enumerated — **temporary boxes and grouting DEEMED INCLUDED** |
| E2.6 | Protective treatment | **ITEM** |

⚠ Fittings and fixings are **items, not weight**. A take-off that weighs the bolts has
double-counted against E1.1's gross-section rule and against the E2.3 item.

## 4.4 E3 Non-structural metalwork `[E3.1–E3.3]`

```
Floor plates, duct covers, sheet coverings and linings (m²) = Σ A            [E3.1]
Bearers, balustrades, handrails, frames (m)                 = Σ L            [E3.2]
Matwell frames, cat ladders, gates, staircases (nr)         = count          [E3.3]
```
⚠ `[E3.2]` excludes handrails **where included with a staircase** — a staircase is enumerated
whole `[E3.3]` and its handrail goes with it.

---

# PART 5 — SECTION F · WOODWORK

## 5.1 Sawn / finished, basic / finished sizes `[F1.1] [F1.2]`

Not arithmetic but it governs every dimension you take:

- **sawn** (not milled) and **finished** (milled) are each so described `[F1.1]`
- the description must state whether sizes are **basic** (before machining) or **finished**
  (milled, within permitted deviations) `[F1.2]`

⚠ Measure to the size the description declares. Mixing a basic size into a finished-size item
understates or overstates every member in it by the machining allowance.

## 5.2 F2 Structural timbers — by LENGTH `[F2.1]`

```
Len = Σ  N × L        per classification, cross-sectional size in the description [GP5.2]
```
Five classes: floors and flat roofs · pitched roofs · walls · kerbs and bearers · cleats and
sprockets.

```
Strutting and bridging (m) = L taken OVERALL THE JOISTS        [F2.2]
```
⚠ Strutting is measured **overall the joists** — the full run across them, not the sum of the
individual pieces between each pair.

## 5.3 F3 Boarding and flooring — by AREA `[F3.1]`

> *without addition for joints or laps*

```
A = Σ (L × W)  −  voids per GP3.2 / GP3.3          no laps, ever
```

| # | Class | Includes |
|---|---|---|
| 1 | Floors | landings |
| 2 | Walls | returns, reveals of openings or recesses, **attached and unattached columns** |
| 3 | Ceilings | **attached and unattached beams**, soffits of staircases |
| 4 | Roofs | tops and cheeks of dormers, sides and bottoms of gutters — **state flat, sloping or vertical**; **firring pieces and bearers DEEMED INCLUDED** |

⚠ Classes 2 and 3 wrap **columns and beams into the wall and ceiling areas**. Measuring a
boarded column separately from the wall it stands in is a double count.

⚠ Class 4 deems **firrings and bearers included** — do not add them under F2 or F4.

```
Eaves and verge boards (m) = Σ L    includes fascias, barge boards       [F3.2]
Fillets and rolls (m)      = Σ L                                          [F3.3]
```

## 5.4 F4 Grounds and battens `[F4.1] [F4.2]`

```
Open-spaced grounds and battens (m²) = A taken OVERALL      ← area of the zone, not of the timber
Individual grounds and battens  (m)  = Σ L
```
⚠ **Open-spaced is measured overall.** A battened wall at 400 mm centres is `L × H` of the
wall, not the summed length of the battens. Getting this backwards changes the quantity by the
spacing ratio — roughly ×2.5 at 400 crs on 50 mm battens.

## 5.5 F5 Framework `[F5.1]`

```
A (m²) = taken OVERALL          alternatively by LENGTH
```
Same overall principle as F4.1.

## 5.6 F6 Finishings and fittings `[F6.1–F6.7]`

```
Finishings (m) = Σ L, classified:                                        [F6.1]
   1 Cover fillets  — includes architraves, skirtings
   2 Beads          — includes stops
   3 Edgings        — includes window boards, nosings

Fittings (m)   = Σ L, classified: work tops (incl. seats) · handrails/balustrades  [F6.2]
Shelving       = m² or m                                                  [F6.3]
Backboards     = enumerated                                               [F6.4]
Sheet linings (m²) = Σ A, classified walls · ceilings · other             [F6.7]
```
Built-up members are **so described** `[F6.5]`. Plastic coverings are described with the item,
stating one or more faces, or measured separately by area `[F6.6]`.

## 5.7 F7 Composite items `[F7.1]`

> *composite items (which shall mean items which MIGHT be fabricated off-site whether or not
> they are fabricated off-site) shall be enumerated; ALL METALWORK OR THE LIKE shall be
> understood to be included*

```
N = count
```
⚠ **All metalwork in a composite item is deemed included.** A fabricated counter is one
enumerated item; its brackets, its frame and its fixings are not measured under E or F9.

## 5.8 F8–F10

```
Finished surfaces on sawn items (m) = Σ L                                 [F8.1]
Metalwork items associated with woodwork (nr) = count; waterbars may be m [F9.1]
Units or sets of ironmongery (nr) = count                                 [F10.1]
```

---

# PART 6 — SECTION G · THERMAL AND MOISTURE PROTECTION

## 6.1 The flat-measurement rule `[G1.1]`

> *Work shall be measured FLAT without addition for laps or seams.*

```
A = Σ A_covered           no laps, no seams, no side or end laps
```
⚠ A membrane at 150 mm side laps and 100 mm end laps is measured at its **covered area**. The
lap material is a rate cost. Adding it is typically +8 to +12% of a roof.

Curved, spherical and conical work are each **so described** `[G1.2]` — described, not
uplifted. The extra labour is in the rate.

## 6.2 G2 Coverings and linings — by AREA `[G2.1]`

```
A = Σ (L × W)  −  voids per GP3.2 / GP3.3

Flat coverings      A = L × W
Sloping coverings   A = L × (W / cos θ)      ← ON THE SLOPE, θ from the horizontal
Vertical coverings  A = L × H
```

⚠ **Sloping coverings are measured on the slope, not on plan.** A roof of 200 m² on plan at a
30° pitch is `200 / cos 30° = 231 m²` on the slope — a **15.5% difference**. Measuring on plan
under-measures every pitched roof, and the error scales with the pitch:

| Pitch | Factor `1/cos θ` | Under-measure if taken on plan |
|---|---|---|
| 15° | 1.035 | −3.4% |
| 22.5° | 1.082 | −7.6% |
| 30° | 1.155 | −13.4% |
| 40° | 1.305 | −23.4% |
| 45° | 1.414 | −29.3% |

```
Eaves, ridges, skirtings, fascias, flashings, aprons (m) = Σ L     [G2.2]
   — skirtings/fascias to composite roofing may alternatively be m²

Roof lights, ventilators, soaker collars,
   special roofing sheets (nr)                = count               [G2.3]
ALTERNATIVELY, special roofing sheets only    = EXTRA OVER roofing  [G2.3]
   — the special sheets are MEASURED, and NO DEDUCTION is made
     from the roofing in which the special sheeting occurs
```

⚠ **The extra-over alternative is offered for the special SHEETS only**, not for the roof
lights, ventilators or soaker collars — those are enumerated either way. And under the
extra-over route the base roofing area stays whole: deducting the special sheet from the
roofing is the `[B8.5]` / `[D2.2]` error again, in a third place.

## 6.3 G3 Damp-proof courses `[G3.1]`

```
Len (m) = Σ L         alternatively by AREA
```
State the width in the description `[GP5.2]`.

## 6.4 G4 Insulation `[G4.1]`

```
A (m²) = Σ A         alternatively DESCRIBED WITH items of composite roofing
```
⚠ If the insulation is described within a composite roofing item, it is **not** measured
separately. Choose one route and record which.

---

# PART 7 — SECTION H · DOORS AND WINDOWS

```
Doors (nr)                              = count                            [H1.1]
Jambs, heads, sills, mullions,
  transomes [sic] (m)                   = Σ L, or frame/lining SETS enumerated [H1.2]
Windows, skylights + their frames (nr)  = count                            [H2.1]
   sub-frames of a DIFFERENT material   = separately enumerated, or by length
Screens, borrowed lights,
  curtain walling (m²)                  = Σ A, or enumerated               [H3.1]
Doors and frames WITHIN a screen (nr)   = count                            [H3.2]
Ironmongery units or sets (nr)          = count                            [H4.1]
```

## 7.1 H5 Glass — the smallest-rectangle rule `[H5.1]`

> *glass shall be measured by area; panes of IRREGULAR SHAPE shall be measured as the SMALLEST
> RECTANGLE from which such irregular shape can be cut*

```
A_regular   = L × W
A_irregular = L_bounding × W_bounding        ← the smallest enclosing rectangle
```

**Worked — a triangular gable pane, base 1.80 m, height 1.10 m:**
```
true triangle area  = ½ × 1.80 × 1.10 = 0.99 m²
MEASURED            = 1.80 × 1.10     = 1.98 m²      ← the smallest rectangle it cuts from
```
⚠ Exactly **double** here, and that is correct. The glazier buys and cuts the rectangle; the
offcut is waste he cannot use. Measuring the true triangle halves a real cost.

```
Sealed factory-glazed units (nr)  = count                                  [H5.2]
Glass louvres (nr)                = count, or by length stating the number [H5.3]
Panes of special shape / decorative treatment (nr) = count                 [H5.4]
```

## 7.2 H6 Patent glazing `[H6.1] [H6.2]`

```
A (m²) = Σ A, classified:  1 Roofs · 2 Skylights (incl. lantern lights) · 3 Vertical surfaces
Opening portions (nr) = count
```
Sloping patent glazing is measured **on the slope**, per the same geometry as G2.1.

---

# PART 8 — SECTION J · FINISHES

## 8.1 The rules that govern the whole section `[J1.1–J1.3]`

```
A = measured FLAT, no addition for laps or seams                           [J1.1]
```
- finishes on **corrugated or ornamental** surfaces are each so described `[J1.1]`
- **curved, spherical, conical** each so described `[J1.2]`
- **internal and external** each so described `[J1.3]`

⚠ All three are **descriptions**, not quantity adjustments. Do not uplift the area for a curved
wall; describe it as curved and let the rate carry it.

## 8.2 J2 Backgrounds — by AREA `[J2.1–J2.3]`

```
A = Σ A     backgrounds for FLOOR, WALL and CEILING finishes each SO DESCRIBED
```
Poured backgrounds (screeds) each given separately **stating the surface finish** `[J2.2]`.
Pre-formed backgrounds (plasterboard, EML) each given separately `[J2.3]`.

## 8.3 J3 Finishings — by AREA `[J3.1]`

```
A = Σ (L × H)  −  voids per GP3.2 / GP3.3
```

| # | Class | Includes — measured WITH the class, not separately |
|---|---|---|
| 1 | Floors | landings |
| 2 | Walls | returns, reveals of openings or recesses, **attached AND unattached columns** |
| 3 | Ceilings | **attached AND unattached beams**, **soffits of staircases** |
| 4 | **Staircases** | treads, risers and edges of landings — **but NOT soffits**, which are class 3 |

⚠ **"Unattached" is the word that catches people.** A free-standing column in a plastered room
is measured **within the wall finish class**, not as its own item. So is a downstand beam in a
ceiling. Two separate rows for a plastered column is a double count that reads perfectly.

**Worked — plaster to a room 6.00 × 4.00 × 2.70 high, one door 0.90 × 2.10, one window
1.50 × 1.20, one free-standing column 0.40 × 0.40:**
```
walls gross      = 2 × (6.00 + 4.00) × 2.70            = 54.00 m²
door void        = 0.90 × 2.10 = 1.89 m²  ≥ 1.00 → deduct
window void      = 1.50 × 1.20 = 1.80 m²  ≥ 1.00 → deduct
column, 4 faces  = 4 × 0.40 × 2.70        = 4.32 m²   → ADD, class 2 [J3.1]
reveals to door and window                 → included in class 2, measured with it

A = 54.00 − 1.89 − 1.80 + 4.32 + A_reveals = 54.63 + A_reveals  m²
```

```
Skirtings, bands, strings, coverings to kerbs,
  mouldings, coves, channels (m)  = Σ L                                    [J3.2]
Non-slip inserts, dividing strips, angle beads,
  lathing at junctions (m)        = Σ L, OR described with the item they occur in [J4.1]
```

## 8.4 J5 Suspended ceilings — by AREA `[J5.1]`

```
1. Ceilings              A = Σ A          **STATING THE DROP**
2. Sides and soffits of beams / upstands  A = Σ A     ← a SEPARATE class
```
⚠ The **drop must be stated** — it is a mandatory statement, and a ceiling item without it is
incomplete under GP5.

## 8.5 J6 Decorations `[J6.1–J6.5]`

```
A = Σ A, per class — TWELVE classes, NOT the four of J3.1                   [J6.3]
Decorations on DIFFERENT SURFACES each given separately                    [J6.1]
Special method of application (e.g. spraying) — details given              [J6.2]
```

⚠ **A decoration take-off is NOT a copy of the finishes take-off.** J3.1 gives four classes;
J6.3 gives **twelve**. Eight of them have no counterpart in J3.1 at all, and a bill built by
copying the finishes areas loses every one of them:

| # | Class | The measurement rule inside it |
|---|---|---|
| 1 | Floors | including landings |
| 2 | Walls | including returns, reveals, attached **and unattached** columns |
| 3 | Ceilings | including attached and unattached beams, **soffits of staircases** |
| 4 | Staircases | treads, risers, **strings** and edges of landings — soffits **excluded**, they are class 3 |
| 5 | **Cornices** | — |
| 6 | **General surfaces** | include **doors** and close-type fencing; **glazed** general surfaces **measured FLAT OVER GLASS** and so described |
| 7 | **Isolated general surfaces** | door frames, linings, sub-frames of a differing material to the window, skirtings, rails, architraves, bars, posts, balusters |
| 8 | **Windows** | **measured FLAT OVER GLASS, frames, mullions, transomes and architraves**; include glazed partitions; **exclude** sub-frames of a differing material; **edges of sashes deemed included** |
| 9 | **Radiators** | **measured over the area of HEATING SURFACE**, not the face area |
| 10 | **Gutters** | **measured INSIDE AND OUT** — so twice the developed girth |
| 11 | **Large pipes** (internal Ø > 60 mm) | including trunking, unless measured as incidental work; hangers and supports deemed included, **except common supports to services** |
| 12 | **Structural metalwork** | includes **roof trusses** |

```
class 8  windows   A = Σ (W_structural_opening × H_structural_opening)   ← FLAT OVER GLASS
class 9  radiators A = Σ A_heating_surface        ← from the manufacturer's data, NOT L × H
class 10 gutters   A = Σ L × girth × 2            ← inside AND out
```

⚠ **Classes 6, 8 and 10 each defeat the obvious arithmetic.** A glazed door is measured flat
over the glass, not as the timber only; a radiator is measured over its heating surface, which
for a column radiator is several times its elevation; a gutter is measured twice.

### The small-pipe rule `[J6.4]`

```
if  Ø_internal ≤ 60 mm   →  decoration measured by LENGTH
                            hangers and supports DEEMED INCLUDED
                            (except common supports to services)
if  Ø_internal >  60 mm   →  measured by area with the general classes
```

```
Decoration on gratings, rainwater heads (nr) = ENUMERATED SEPARATELY,
                                               IRRESPECTIVE OF SIZE       [J6.5]
Signwriting letters (nr) = count                                          [J7.1]
```

---

# PART 9 — SECTIONS K, L, M, N, P

## 9.1 K Accessories `[K1.1–K1.2]` `[K2.1–K2.3]`

```
Accessories (nr) = count            ← the DEFAULT unit for this section    [K1.2]
Partitions (m)   = Σ L, TAKEN OVER ALL DOORS AND GLAZED UNITS              [K2.1]
Doors and glazed units (nr) = count, STATING THE PARTITION they occur in   [K2.2]
Cubicles (nr)    = count                                                   [K2.3]
```
⚠ **K2.1 is an "over all" measurement.** The partition length runs straight through its doors
and glazed panels — no deduction — and those are then enumerated on top. Deduct the door and
you have under-measured the partition and paid for the door twice over.

`[K1.1]` defines the section's scope: **specially manufactured or proprietary items not
included in other sections**.

## 9.2 L Equipment `[L1.1]`

```
Equipment (nr) = count
```
Food preparation and service equipment, laboratory equipment, stage equipment.

## 9.3 M Furnishings `[M1.1] [M2.1]`

```
Furnishings (nr)   = count      rugs, curtains, artwork, ashtrays, furnishing accessories
Curtain track (m)  = Σ L        hooks, gliders, stops DEEMED INCLUDED
```

## 9.4 N Special construction `[N1.1–N3.1]`

```
Enclosures (nr)     = count     work WITHIN the enclosure, not part of the enclosure
                                construction, is measured to the relevant sections  [N2.1]
Installations       = ITEM each, or measured to the relevant sections   [N3.1]
```

## 9.5 P Conveying systems `[P1.1]` `[P2.1]` `[P3.1–P3.3]`

```
Lifts, hoists, conveyors, escalators (nr) = count                          [P1.1]
```

### P2.1 — the SUNDRIES item list, used by Q and R too

An **ITEM** shall be given for **each** of the following:

| # | Item | Includes |
|---|---|---|
| 1 | Supports | fixings, anchors, insulating blocks, anti-vibration devices |
| 2 | Identification | plates, discs, labels, charts, colour coding |
| 3 | Testing and commissioning | operating the completed installation, **and providing fuel and power** |
| 4 | **Tools and spares** | loose keys and consumable stores |
| 5 | **Documents** | drawings, operating instructions **and** maintenance manuals |

⚠ Item 4 is **tools and spares**, not training — POMI gives no training item. And item 3
carries **the fuel and power for commissioning**, which is real money on a chiller or a
generator and is often quoted for separately in error.

### P3.1 — the INCIDENTAL WORK item, used by Q and R too

An **ITEM** shall be given for incidental work, which shall include:

1. Co-ordination with other engineering installations
2. Cutting or forming holes, mortices, chases **and making good finishings**
3. Building in or cutting and pinning

```
Protective and decorative painting = ITEM per system, including removing
  protective coating/wrapping and cleaning and polishing exposed surfaces  [P3.2]
Other incidental work = to the relevant sections, GROUPED under an appropriate heading [P3.3]
```

⚠ **P2.1 and P3.1 are why an MEP bill is short.** Supports, identification, testing and
commissioning, tools and spares, documents, builder's work holes and making good are all
**items** — not measured quantities. A take-off that measures pipe supports by number has
billed against the P2.1 item.

---

# PART 10 — SECTION Q · MECHANICAL ENGINEERING INSTALLATIONS

## 10.1 How an installation is organised `[Q1.1] [Q1.2]`

```
Installations CLASSIFIED BY FUNCTION, each given separately under its own heading   [Q1.1]
Measured per the clauses below, OR enumerated on a LOCATIONAL basis
   (e.g. "cold water installation to ground floor")                                 [Q1.2]
```

## 10.2 Q2 Pipework — by LENGTH `[Q2.1]`

> *Pipes and gutters shall be measured by length, taken along the CENTRE LINE OVER ALL
> FITTINGS.*

```
Len = Σ L_centreline           bends, tees, reducers NOT deducted
```

⚠ **Over all fittings** means you run the tape straight through every bend and tee. Do not
deduct the fitting's own length. The length pays for the run; the fitting, where it is
enumerable, pays for its extra cost on top.

**State whether the diameter is internal or external** `[GP5.2]` — a mandatory statement for
pipework, and rates differ.

### The 60 mm rule — the most important threshold in the MEP bill `[Q2.2]`

```
if  Ø_internal ≤ 60 mm   →  FITTINGS ARE DEEMED INCLUDED.  Measure NOTHING for them.
if  Ø_internal >  60 mm   →  FITTINGS ARE ENUMERATED
                             (except joints in the running length, which are included),
                             GROUPED per size, described as 'fittings'

the same rule applies to FITTINGS TO GUTTERS, grouped per size of GUTTER
```

⚠ **The rule covers gutters, not only pipes.** `[Q2.2]` says "fittings … to large pipes … **and
to gutters**". Gutter fittings — stop ends, outlets, angles — are enumerated and grouped per
size of gutter, on the same wording and in the same item, and are routinely missed because the
clause is filed mentally under pipework.

⚠ This single threshold decides whether an MEP bill has a hundred fitting items or none.
Enumerating fittings on 20 mm PPR is billing work already inside the linear rate; failing to
enumerate them on 100 mm ductile iron leaves real money unbilled.

```
Valves, traps, expansion compensators (nr) = count
   — sleeves, cover-plates DEEMED INCLUDED                                    [Q2.3]
```

## 10.3 Q3 Ductwork — the compound formula

### Rectangular ductwork — by WEIGHT `[Q3.1]`

> *Rectangular ductwork shall be measured by WEIGHT, based upon the AREA calculated as the
> LENGTH, taken along the centre line over all fittings, TIMES THE NET GIRTH of nominal
> dimensions. Blank ends shall be added to the area for weighting but NO DEDUCTION shall be
> made for intersections or openings; extra weight for seams, stiffeners, supports, fixings or
> the like shall be understood to be included.*

```
girth  =  2 × (w + d)                        w, d the NOMINAL duct dimensions, m
A      =  L_centreline × girth               m², over all fittings
A      =  A + Σ A_blank_ends                 blank ends ADDED to the area
                                             NO DEDUCTION for intersections or openings
W_kg   =  A × m_per_m2(gauge)                the BARE gauge weight, applied FLAT —
                                             NO uplift for seams, stiffeners, supports
                                             or fixings; all deemed included
```

**Worked — 12.40 m of 600 × 400 duct, 1.0 mm galvanised steel at 8.0 kg/m², one blank end:**
```
girth      = 2 × (0.60 + 0.40)       = 2.00 m
A_run      = 12.40 × 2.00            = 24.80 m²
A_blank    = 0.60 × 0.40             =  0.24 m²
A_total    = 24.80 + 0.24            = 25.04 m²
W          = 25.04 × 8.0             = 200.32 kg
```

⚠ **Five ways this goes wrong.** Using *internal* rather than *nominal* dimensions; forgetting
that blank ends are **added to the area** and not enumerated; **deducting** the area of a branch
intersection or a grille opening, which POMI forbids; **uplifting the weight** by the usual
10–15% trade allowance for seams, stiffeners and hangers, which POMI deems included; and
stating the gauge but not the unit weight, which `[GP5.4]` requires for a weight item.

The last two pull in opposite directions and can hide each other in a total — a duct that has
been deducted for openings and then uplifted for stiffeners can foot to about the right figure
while every row in it is wrong.

⚠ **Fittings to rectangular ductwork are DEEMED INCLUDED** `[Q3.3]`. The centre-line length
runs over them and nothing more is measured.

### Circular, oval and flexible ductwork — by LENGTH `[Q3.2]`

```
Len = Σ L_centreline, over all fittings
Fittings (excluding test holes and covers) = ENUMERATED, grouped per duct size,
                                             described as 'fittings'          [Q3.3]
```
⚠ Note the asymmetry: **rectangular fittings are included, circular fittings are enumerated.**
Same section, opposite treatment, and it follows the unit — a weight-based item absorbs its
fittings, a length-based one does not.

```
Dampers, grilles, flexible connectors (nr) = count                            [Q3.4]
```

## 10.4 Q4 Equipment `[Q4.1–Q4.3]`

```
Sanitary fittings, tanks, fans, pumps, hoods, AHUs (nr) = count               [Q4.1]
Continuous convectors (m)                               = Σ L                 [Q4.2]
Heated or ventilated ceilings (m²)                      = Σ A                 [Q4.3]
```

## 10.5 Q5 Automatic controls `[Q5.1–Q5.3]`

```
Sensing/activating devices, control panels, air compressors, receivers (nr) = count  [Q5.1]
Wiring, pneumatic tubing, isolators, starters, relays  = DEEMED INCLUDED             [Q5.2]
Alternatively: an ITEM per installation, but equipment common to more than
   one system is ENUMERATED                                                          [Q5.3]
```
⚠ `[Q5.2]` is a large deemed-inclusion. The control wiring is **not** measured under Section R.

## 10.6 Q6 Connections `[Q6.1]`

```
Connections to supply mains (nr) = count, SUBJECT TO GP8
```
GP8 means: work only a government or public authority may carry out is given as a **SUM**,
exclusive of contractor's profit, with a separate item for profit. In the UAE this is the DEWA,
Etisalat and du route.

## 10.7 Q7 Insulation `[Q7.1–Q7.5]`

```
To pipework (m)          = Σ L_centreline, over all fittings                  [Q7.1]
To RECTANGULAR ductwork  = BY AREA, calculated as in Q3.1  — i.e. L × girth   [Q7.2]
                           additional insulation to flanges DEEMED INCLUDED
To circular/oval/flexible (m) = Σ L_centreline, over all fittings             [Q7.3]
Insulation boxes around accessories (nr) = count                              [Q7.4]
Insulation to equipment (nr)             = count                              [Q7.5]
```

⚠ **Q7.2 says AREA, while Q3.1 says WEIGHT** — for the same duct. The duct is billed by weight;
its insulation is billed by the area from the same girth calculation. Same geometry, two
different units, and using the wrong one is a whole-item error:

```
duct        W_kg = (L × girth) × m_per_m2
insulation  A_m2 =  L × girth
```

## 10.8 Q8 / Q9 Sundries and incidental work

```
Sundries              = per P2.1  — five ITEMS                                [Q8.1]
Incidental work       = per P3.1  — one ITEM, including builder's work
                                    holes and making good                     [Q9.1]
```

---

# PART 11 — SECTION R · ELECTRICAL ENGINEERING INSTALLATIONS

## 11.1 The two definitions that decide the unit `[R1.3] [R1.4]`

```
'cable'    INCLUDES tape, bus-bar trunking or the like                        [R1.3]
'conduit'  INCLUDES trunking, cable tray, ducting or the like                 [R1.4]
```
⚠ These are wide. **Cable tray and trunking are "conduit"** for measurement, so they follow the
conduit rules, not a rule of their own.

## 11.2 The circuit hierarchy — the whole logic of Section R

| Level | Definition | Unit |
|---|---|---|
| **Main** | *the incoming supply to the main distribution board within a building or complex* `[R2.1]` | cable **by LENGTH**, conduit **by LENGTH** `[R2.2] [R2.3]` |
| **Sub-main** | *the supply from the main distribution board to a SUB-MAIN distribution board* `[R3.1]` | **ENUMERATED** per circuit — or, alternatively, by length per R2 `[R3.2]` |
| **Final sub-circuit** | to the termination point | **ENUMERATED as POINTS** `[R4.1]` |

```
Main         Len (m) = Σ L_cable ;  Σ L_conduit
Sub-main     N (nr)  = count of circuits, separately identified
                       (alternatively measured by length per R2.2/R2.3)
Final        N (nr)  = count of POINTS, classified per R4.1
```

⚠ **This is the single biggest structural decision in an electrical bill.** A final sub-circuit
is billed as a **point** — one number that carries its cable, its conduit, its boxes and its
terminations. Measuring the cable length of a lighting circuit *as well as* enumerating the
point is a double count of the entire final distribution.

### R4.1 point classifications

| # | Point | Stating |
|---|---|---|
| 1 | Lighting points | |
| 2 | Lighting switch points | **one-way, two-way or intermediate** |
| 3 | General purpose socket outlets | **a multi-gang outlet counts as ONE point** |
| 4 | Equipment points | **type of equipment or the electrical rating**; contactors and starters are **measured separately as equipment points** |
| 5 | **Auxiliary installation points** | e.g. bell push, telephone outlet |

```
N_points = Σ counts per class          FIVE classes, not four
```

⚠ **Class 3 is a counting rule, not a description rule.** A twin 13 A socket, a 4-gang outlet
and a single socket are **one point each**. Counting gangs instead of outlets inflates the
socket count by 1.5 to 3 times across a typical floor, and every row still looks reasonable.

⚠ **Class 5 exists.** Bell pushes, telephone outlets and the like are points under R4.1 in
their own right — not accessories under `[R5.1]` and not equipment under `[R7.1]`. A take-off
with four point classes has dropped the whole auxiliary installation.

## 11.3 R5–R7 Accessories, control gear, equipment

```
Ceiling roses, pendants, switches, socket outlets, bell pushes (nr) = count   [R5.1]
Switchgear, distribution gear, contactors, starters, boards (nr)    = count   [R6.1]
Transformers, generators, standby cubicles, luminaires,
   external lighting columns, clocks, loudspeakers, bells (nr)      = count   [R7.1]
Controls — incl. accessories AND interconnecting cables — measured to
   the relevant clauses of this section, OR included with the equipment item  [R7.2]
```

## 11.4 R8–R10

```
Connections to supply mains (nr) = count, subject to GP8                      [R8.1]
Sundries                         = per P2.1 — five ITEMS                      [R9.1]
Incidental work                  = per P3.1 — one ITEM                        [R10.1]
```

---

# PART 12 — THE CROSS-CHECKS A MEASUREMENT MUST SURVIVE

These are arithmetic identities, not opinions. A take-off that fails one of them is wrong
somewhere, even when every individual row looks right.

## 12.1 Excavation ↔ disposal `[B11.1]`

```
V_disposal_total  ==  V_excavation_total  +  V_dredging  +  V_tunnelling      EXACTLY
V_backfill + V_removed  ==  V_disposal_total
```

## 12.2 Excavation ↔ substructure concrete

```
V_excavation  ≥  V_concrete_below_ground  +  V_blinding  +  V_hardcore
```
The dig must at least contain what is built in it. Where it does not, either the excavation is
short or a foundation has been measured that nothing was dug for.

## 12.3 Concrete ↔ formwork **HOUSE**

For a rectangular member, the ratio of shuttered area to concrete volume has a knowable range.
Outside it, one of the two is wrong:

```
r  =  A_shutter / V_concrete            m²/m³
```

| Member | Typical `r` | Read as |
|---|---|---|
| slab, 200 mm, soffit only | ≈ 5.0 | `1/t` |
| wall, 250 mm, both faces | ≈ 8.0 | `2/t` |
| column, 400 × 400 | ≈ 10.0 | `perimeter / A_sect` |
| beam, 300 × 600 under a 200 slab | ≈ 7–9 | |
| foundation, mass, sides only | ≈ 1–3 | |

⚠ `r` far **above** the range usually means formwork was measured to faces that are cast against
earth or against existing construction. Far **below** usually means a face was missed.

## 12.4 Concrete ↔ reinforcement **HOUSE**

```
ρ_rebar  =  W_rebar_kg / V_concrete_m3          kg/m³
```

| Element | Typical range |
|---|---|
| blinding | 0 |
| mass foundation | 30 – 60 |
| raft, ground beam | 90 – 160 |
| suspended slab | 80 – 130 |
| column | 150 – 300 |
| beam | 120 – 220 |
| core / shear wall | 100 – 200 |

These are **sense checks, not rules**. A figure outside the range is a question to answer, not
a quantity to change — and the answer goes in the run audit either way.

## 12.5 Wall finishes ↔ wall area **HOUSE**

```
A_finish  ≈  A_wall_structure  ×  (number of finished faces)
             −  Σ voids ≥ 1.00 m² and all edge voids
             +  Σ reveals, returns, columns          [J3.1 class 2]
```
The `+` term is the one that gets dropped, and it always makes the finish **larger** than the
structure.

## 12.6 Doors and windows ↔ their voids

```
count(door items, H1.1)     ==  count(door voids deducted from walls)
count(window items, H2.1)   ==  count(window voids deducted from walls)
```
⚠ A door counted in H but never deducted from D or J means the wall and its plaster were paid
for through the opening. A void deducted with no door item means the door was never billed.

## 12.7 Roof area ↔ pitch `[G2.1]`

```
A_slope  ==  A_plan / cos θ                  θ = roof pitch from horizontal
```
If `A_slope == A_plan` on a pitched roof, the roof was measured on plan and is under-measured
by the table in §6.2.

## 12.8 Drainage ↔ excavation `[B9.2]`

```
if drain trenches measured by LENGTH under B9.2
   then  NO separate disposal and NO separate filling rows for those trenches
```
Both are deemed included. Their presence is a double count.

## 12.9 MEP points ↔ cable **HOUSE**, from `[R4.1]`

```
if final sub-circuits enumerated as POINTS
   then  NO cable or conduit length measured for those same circuits
```

---

# PART 13 — THE NINETEEN ERRORS THAT COST THE MOST

Ranked by what they typically do to a bill, worst first. Every one of them produces a take-off
in which each individual row is defensible.

| # | Error | Clause broken | Typical effect |
|---|---|---|---|
| 1 | Excavation measured with working space / battering / bulking | `[B8.2]` | **+25 to +40%** on the dig |
| 2 | Pitched roof measured on plan, not on slope | `[G2.1]` | **−13 to −29%** on the covering |
| 3 | Rock or faced work DEDUCTED from the item it is extra over | `[B8.5] [D2.2]` | loses the whole base item |
| 4 | Cavity wall: the composite and the skin-by-skin methods **MIXED** in one bill | `[D2.1] cl.3` | **×2** on the masonry where they overlap. Measuring the skins and cavity separately is **not** an error — POMI expressly permits it — measuring them separately **as well as** the composite item is |
| 5 | Beam measured full depth through the slab | `[C2.1] cl.8` | +30 to +50% on beam concrete |
| 6 | Rebar uplifted by a BLANKET lap percentage | `[C3.1] [GP3.1]` | +5 to +10%, and uncitable. Laps themselves ARE measured — C3.1 excludes rolling margin, supports, spacers and tying wire, NOT laps. What fails is the percentage, which names no location and cannot be re-derived |
| 7 | Fabric reinforcement uplifted for laps | `[C3.3]` | +8 to +15% |
| 8 | MEP fittings enumerated on pipes ≤ 60 mm | `[Q2.2]` | bills work already in the rate |
| 9 | Final sub-circuit cable measured AND the point enumerated | `[R4.1]` | double-counts final distribution |
| 10 | Attached column measured separately from its wall | `[C2.1] cl.6` `[J3.1] cl.2` | double count, invisible |
| 11 | Edge void under 1.00 m² not deducted | `[GP3.3]` | small each, endemic |
| 12 | Duct insulation billed by weight instead of area | `[Q7.2]` | whole-item unit error |
| 13 | Irregular glass measured to its true shape | `[H5.1]` | up to **−50%** on that pane |
| 14 | Open-spaced battens measured as timber length, not overall area | `[F4.1]` | ×2 to ×3 |
| 15 | Partition length deducted for its doors | `[K2.1]` | under-measures and double-pays |
| 16 | Decoration take-off copied from the finishes take-off | `[J6.3]` vs `[J3.1]` | J6.3 has **twelve** classes, J3.1 has four. Copying loses cornices, general and isolated general surfaces, windows, radiators, gutters, large pipes and structural metalwork — **eight** whole classes |
| 17 | Multi-gang socket counted as several points | `[R4.1] cl.3` | ×1.5 to ×3 on the socket count |
| 18 | Ductwork weight uplifted for seams, stiffeners and supports | `[Q3.1]` | +10 to +15%, all deemed included |
| 19 | Tunnel-to-shaft intersections billed at plain tunnel rates | `[B24.1] cl.7` | loses the most expensive m³ on the job |

---

# PART 14 — WHAT THE SEAT MUST RECORD FOR EVERY QUANTITY

Every measurement row carries, without exception:

```
1  the POMI clause          the rule applied — an item with no clause is a HOUSE EXTENSION
                            and must declare itself
2  the classification       which numbered class within the clause
3  N × L × W × H            each factor in its own column, never a pre-multiplied total
4  the deduction basis      which voids were deducted and under which limb of GP3.2/GP3.3
5  the source               doc_id, sheet, and the read tier from the extraction record
6  the DWG Ref hyperlink    to the marked-up sheet that proves it
7  the mandatory statements the clause demands — thickness, number, range, drop, diameter
                            basis, unit weight, average depth
```

A row missing 1, 4 or 6 is not a measurement. It is an assertion.
