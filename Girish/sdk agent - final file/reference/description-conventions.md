# ITEM DESCRIPTION CONVENTIONS — measured from the issued bills

How this office composes the wording of a bill item. Measured across eleven issued tender
workbooks, 31 bill sheets and 3,605 priced items. Binding on B1 and on any seat that drafts
an item description.

**No project wording is recorded here.** Where the issued bills name a particular design
standard, that name is a **field the run fills**, never a constant.

---

## 1. THE STRUCTURE IS UNIVERSAL. THE SIZES ARE NOT.

A description block followed by a run of priced variants that inherit it appears in **every
one of the 31 bill sheets** — Site Work, Concrete, Masonry, Metalwork, Woodwork, Thermal &
Moisture, Doors & Windows, Finishes, Accessories, Equipment, Furnishings, Conveying,
Mechanical, Electrical, Signage, Landscaping, Roads, Dayworks and General Requirements alike.

What differs is **what the variants vary by**:

| Sections | The variants are | Example |
|---|---|---|
| C Concrete · D Masonry · G Thermal | thicknesses | `Grade slab, 150mm thick` · `Walls, 250mm thick, 2hr fire rated` |
| Q Mechanical · R Electrical | **sizes** | `20mm PPR Piping` · `25mm` · `32mm` · `40mm` · `65mm` · `80mm` |
| J Finishes · K Accessories | widths and types | `200mm wide, type I-NS 2` |
| L Equipment · M Furnishings · Signage | **named types and schedule refs, not sizes** | `FD-1` · `FCO` |

Counted: 15 of Concrete's 34 shared-description runs carry sized variants, 11 of Mechanical's
31, 4 of Masonry's 11 — but **0 of Equipment's 35 and 0 of Furnishings' 25**. So do not expect
a size. Expect the structure.

> An earlier version of this file said the sized pattern held "in every section". It does
> not. The **structure** does; the sizes are a civil-and-MEP habit. Equipment, Furnishings
> and Signage bill by named type, and a rule that demanded a size there would be wrong.

---

## 2. THREE CLOSING FORMULAS, BY SECTION FAMILY

The description block ends with a formula that binds the rate to the project documents, and
**the formula differs by discipline**. All three are frozen except for the bracketed field.

### Family 1 — structure and envelope · sections B, C, D, E, G

> `… complete in accordance with the Specifications and Drawings`

143 uses. C 66 · G 41 · E 12 · D 10 · B 7 · J 7. A variant adds the approving party:
`… in accordance with the Specifications, Drawings and the {approving party} approval`.

### Family 2 — finishes and fit-out · sections F, J, K

> `… in accordance with the {design standard document}, Specifications and Drawings`

334 uses, 326 of them in Finishes. The `{design standard document}` is the project's own
design book — on the sample project a theme design booklet. **Name it from the project's own
documents; never carry a name across from another job.** The order of the three varies in the
issued bills (`…Specifications and Drawings` / `…Drawings and Specifications`); the house form
is the one above.

### Family 3 — MEP · sections Q and R

The full sentence, and it is a template:

> `Supply and install all {system} as shown on the drawings and/or as specified including but
> not limited to {the components the rate covers} and any other items required for a complete
> installation as indicated.`

63 openers · 39 `as shown on the drawings and/or as specified` · 99 `including but not
limited to` · 72 closers. Q and R both, in roughly equal measure.

The middle list is what the rate is deemed to include and it is the commercially operative
part. Worked example from a piping description: *piping, fittings, angles, ells, tees,
reducers, valves, heads, supports*. From a drainage one: *fittings, angles, ells, clean outs,
reducers, trust blocks, vaults, trenching, backfilling, supports, acoustic insulation*.

**Write that list from the POMI deemed-included list for the clause being billed**
(`pomi-verbatim.md`), not from memory. A component omitted from the list is a component the
contractor can claim for; a component included that POMI already deems included is harmless
but redundant.

---

## 3. A DEFECT IN THE ISSUED BILLS, FOR AWARENESS

Section R closes **eight** descriptions with

> `… required for a complete installation a indicated.`

`a` for `as`. It is a typo repeated through the Electrical bills. Do not reproduce it — the
correct closer is Family 3 above. Recorded here so that a comparison against those bills does
not read the corrected wording as a deviation.

---

## 4. HOW A DESCRIPTION IS LAID OUT

Set out in `house-template.md` §4. In short: the description block occupies consecutive rows
of column `C` with no item reference, no quantity and no rate; one blank row; then each
variant on its own row with one blank row between. An optional one-line sub-heading may sit
between the description and the variants — `Hollow Block Walls`, `uPVC Pipe`. The whole group
is **atomic** and never splits across a page.

`verify_template.py` fails a run of sized variants carrying no description block above it.
