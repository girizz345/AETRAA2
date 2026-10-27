# pomi-measurement.md — WITHDRAWN
## This file is superseded. Do not measure from it.

Audited against POMI (RICS 1979, reprinted 2004) and found to contain 8 wrong
rules, 1 wrong section letter, 2 wrong clause citations and 40 material
omissions. See `AUDIT-pomi-measurement.md` for the itemised findings.

It is withdrawn rather than patched because the errors are distributed through
it, and a patched file would be trusted where it should not be.

## Measure from these instead

| Reference | Covers |
|---|---|
| `ref-pomi-rules.md` | The clause-indexed rule table, GP + A to R, complete. Unit, classifications, deemed-included, enumerate-separately and mandatory statements for every element, each traced to its clause |
| `ref-mep-riser-measurement.md` | MEP risers — pipe, duct, electrical. v2.0, rebuilt on clauses |
| `ref-reinforcement-measurement.md` | Bar and fabric reinforcement, laps, the no-BBS routes |
| `determinism.md` §11 | How a value is read before it is measured |

## The eight rules that were wrong, in one line each

1. Pipe fittings "where in doubt, enumerate" — Q2.2 sets a 60 mm ID threshold and admits no doubt
2. Ductwork by length — Q3.1 measures RECTANGULAR duct by WEIGHT
3. Electrical cable by the metre — R4.1 enumerates final sub-circuits as POINTS
4. Masonry "m³ for mass" — D2.1 has no volume measurement
5. Furnishings at Section N — POMI is L Equipment, M Furnishings, N Special Construction
6. Stair risers cited to one clause — C4.1, J3.1, J6.3 and C2.1 each say something different
7. Riser length as floor-to-floor × floors — Q2.1 measures the centre line over all fittings
8. Riser supports and penetrations enumerated — P2.1 and P3.1 make them ITEMS

## The two miscitations

- The 1.00 m² void limit is **GP3.2**, not GP3.3. **GP3.3 is the rule that voids
  AT THE EDGE of a measured area are ALWAYS deducted, irrespective of size** —
  and it was missing entirely.
- The volume deduction limit was never cited. It is **C1.3**: 1.00 m³, with no
  deduction for enclosed reinforcement or structural metal, except boxed or
  tubular metalwork which is always deducted.
