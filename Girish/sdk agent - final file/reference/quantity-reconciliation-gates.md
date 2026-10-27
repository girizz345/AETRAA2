# Quantity Reconciliation Gates — Stage 3.5 (MANDATORY)

Run after Stage 3 (derivation), before Stage 4 (formatting). Log every gate
result in `AN.RECONCILIATION`. An unresolved FAIL blocks output.

---

## G+.29 — Completeness matrix

Build a matrix: evidence source → BOQ section → row count.

| Evidence present | Must produce | If zero rows |
|---|---|---|
| `schedules.doors` non-empty | ≥1 row in H | FAIL |
| `schedules.windows` non-empty | ≥1 row in H | FAIL |
| `schedules.finishes` non-empty | ≥1 row in J per finish class used by rooms | FAIL |
| `schedules.fixtures` (sanitary) | ≥1 row in Q | FAIL |
| `schedules.equipment` | ≥1 row in Q or R | FAIL |
| `schedules.slabs/columns/beams` | ≥1 row in C | FAIL |
| `spaces.circulation` has stairs | ≥1 row in E (balustrade/handrail) | FAIL |
| `spaces.circulation` has lifts | ≥1 row in P | FAIL |
| Wet rooms (`is_wet_area`) exist | waterproofing rows in G + wall tile in J + floor drains in Q | FAIL |
| `spaces.apartment_mix` non-empty | joinery rows in F + entry doors in H | FAIL |
| External/site rooms exist | ≥1 row in B | FAIL |

A FAIL may be converted to PASS only with a written justification in
`AN.RECONCILIATION` (e.g., "lifts in separate nominated package per spec §X").

## G+.30 — Mass balance checks

| # | Check | Tolerance | On breach |
|---|---|---|---|
| 1 | Σ(floor finish areas in J) vs Σ(room.area_m2 × floor_count) | ±10% | Re-measure; list rooms with no finish code |
| 2 | RC slab area in C vs Σ(geometry.floor_areas GFA) | ±5% | Use structural GFA; slab must be ≥ Σ net room areas |
| 3 | Blockwork m² vs (Σ wall lengths once × avg height − openings) | ±10% | Check shared-wall double count first |
| 4 | Σ door rows in H vs Σ schedules.doors counts (after R36 guard) | exact | Check double multiplication |
| 5 | Σ window rows in H vs Σ schedules.windows | exact | as above |
| 6 | Sanitary fixture count vs wet room count | each wet room ≥1 fixture | List orphan wet rooms |
| 7 | Plaster/paint m² ≤ 2 × blockwork m² + external wall inner faces | upper bound | Faces over-counted |
| 8 | Skirting lm vs Σ(room.perimeter − door widths) × F | ±10% | Re-derive |
| 9 | BUA cross-check: total BOQ slab area vs the measured built-up area | ±10% | Investigate multiplier errors |
| 10 | Any material/system appearing in more than one section (insulation, WP, paint) | must reconcile to ONE building total across sections | List rows per section; remove the duplicate billing |
| 11 | CAD blocks representing double-faced or paired devices (EXIT-DOUBLE, EM-DOUBLE) | count as ONE unit per pair | Re-count from block definitions, not block faces |
| 12 | A fixture count that exactly equals the count of another building element (e.g. 88 = bathroom count) | coincidence = mis-tag suspect | Run a mis-tag check (verify the CAD layer/tag actually represents the fixture) before billing |

Record each as: `check # | expected | actual | variance % | PASS/FAIL | action`.

## G+.31 — Unit dictionary

Every row's unit must match its item type. Any mismatch = FAIL.

| Item type | Allowed unit |
|---|---|
| Slab, screed, finish, plaster, paint, tile, waterproofing, blockwork, insulation, paving | m² |
| Concrete volume, excavation, backfill, sand/aggregate | m³ |
| Skirting, DPC, handrail, balustrade, pipe/cable runs, line marking, joints | lm |
| Doors, windows, lintels, fixtures, equipment, lifts, fittings, outlets, detectors | nr |
| Kitchen/wardrobe joinery, hardware sets | set |
| Lump-sum / provisional | item |
| Rebar, structural steel | kg or tonne |

Also reject: qty = 0 with a rate, qty null (skill failure per SKILL.md),
negative qty, and unit strings not in the table above.

## G+.32 — Rate sanity gate (mandatory before Stage 4)

Keyword/regex matching against the rate library assigns wrong rates silently
(observed: bulk excavation priced at the raft concrete rate = 5.0M
overstatement; MDB at small-DB rate; wall tile at render rate). Guard every
priced row with a class-based bound check.

Every priced row must fall inside the library's min/max envelope for its unit
type and item class:

| Item class | Unit | Envelope (AED) |
|---|---|---|
| Excavation | m³ | 20–80 |
| Structural concrete | m³ | 1,200–2,500 |
| Switchgear MDB | nr | 60,000–150,000 |
| Small distribution board | nr | 3,000–8,000 |
| Finishes | m² | 20–300 (unless stone/specialist) |

Extend the envelope table from `rate-library.md` for any class not listed —
the principle is the same: per unit type and item class, a min/max bound.

Any row outside its envelope is a **FAIL → manual rate assignment with a
written note**. Rate assignment must be recorded per row (library line
cited), never inferred silently from description text.

