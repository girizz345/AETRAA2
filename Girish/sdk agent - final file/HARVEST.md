# The harvest — what the 24 references contributed, and what they got wrong

Twenty-four reference documents, 18,548 lines, harvested into nine ingest tables.
Each was read as **evidence**, not as instruction: where a document contradicted
itself or another document, the contradiction is recorded here and settled in
`DECISIONS.md` rather than silently resolved in a table.

Nothing in `reference/` is loaded at run time. The tables in `data/` are what the
pipeline reads, and every one of them is covered by `tests/test_ingest_data.py`.

---

## What came out

| Table | From | Carries |
|---|---|---|
| `data/disciplines.json` | discipline-matrix.md + the dev package's folder names | 35 prefixes, 13 sections of title keywords, 34 scoped equipment tag patterns, 4 cross-discipline rules |
| `data/multipliers.json` | title-block-patterns.md + the corpus | 7 subtitle patterns with their precedence, the typical-alone rule, the default |
| `data/house_template.json` | house-template.md v2.0 | 8 columns with widths, the 62-row page, fonts, page codes, the closing pages |
| `data/units.json` | quantity-reconciliation-gates.md G+.31 | 8 units, 60 input spellings, 64 item types, 5 rejection rules |
| `data/gates.json` | G+.25–G+.30 + universal-rules.md | 15 completeness rows, 12 mass-balance checks, 13 fabrication tokens |
| `data/rate_classes.json` | rate-library.md, **prices stripped** | 92 item classes, 28 ordinal invariants, the corroboration / spread / staleness policies |
| `data/conventions.json` | description-conventions.md + POMI-COMPLETE-PROCESS.md + determinism.md | 3 closing formula families over 16 sections, the 16-colour trade palette, the shade ladder |
| `data/titleblocks.json` | observed from the dev package | 3 block specs, 16 field patterns |
| `data/clauses.json` | the POMI corpus (earlier pass) | 314 clauses, 210 carrying arithmetic |

New modules reading them: `ingest/multipliers.py`, `ingest/units.py`,
`ingest/gates.py`, `ingest/house_template.py`, plus a rewritten
`ingest/rates.py`, an extended `ingest/discipline_matrix.py`, a data-driven
`bill/completeness.py`, and a new `bill/market.py`.

---

## The five things the references got wrong

**1. The discipline matrix contradicts its own header.** It states that there is
no POMI section S — ELV and communications are electrical work billed inside R —
and then its prefix table routes FA, F, V/ELV, MD/MEP and LS/LSF to S anyway, and
its cross-discipline note says fire alarm devices are "measured in S (ELV) only".
Every S is now R, and `DisciplineMatrix.load()` **refuses** a table that still
routes to S. `DECISIONS.md` §9 of the earlier pass settles the section letters.

**2. The money column width.** An earlier reading of `house-template.md` took
H = 15.711. The file itself records the re-measurement: 14.711 on 23 bill pages,
15.711 on only 8. The house value is 14.711 and the gate accepts 14.5 to 18.0 on
H alone, failing any deviation on A to G. Carried as the plurality, with the
earlier reading recorded so a comparison does not read the correction as a defect.

**3. Two different trade palettes.** `POMI-COMPLETE-PROCESS.md` names a colour
per section in words; `determinism.md` 4.10 gives a hex and declares the table
closed. They disagree for nine of sixteen sections. determinism.md governs —
`DECISIONS.md` §8.

**4. The LS prefix means two different things.** Landscape in the development
package, Life Safety in the reference. Landscape holds the bare prefix, LSF and
LF reach life safety, and the collision is recorded in the table rather than
resolved out of sight — `DECISIONS.md` §10.

**5. `takeoff-format.md` is not the house format** and says so: it is the legacy
A4-landscape, Calibri, six-column, fully-ruled workbook. `house-template.md` v2.0
governs anything issued. Recorded in `house_template.json` as `supersedes`, so a
builder cannot pick the wrong one by reading the wrong file.

A sixth is smaller but worth the line: `description-conventions.md` names closing
formula families for nine sections only. `POMI-COMPLETE-PROCESS.md`'s per-section
"How this section is BILLED" tables cover all sixteen, and show that GP, A, L, M,
N and P have **no** closing formula — they bill items, sums or particulars, not
measured work. The richer source won.

---

## The rate library

`reference/rate-library.md` is harvested and **not loaded**. Its prices are
withdrawn by decision; its item taxonomy and its regional adjustment table
survive because neither was a price. What replaced its min/max envelope, and why
the replacement cannot go stale, is `DECISIONS.md` §9.

One line of it is worth repeating here, because it is the reason the replacement
had to be built rather than skipped: the envelope existed because *keyword
matching against the library assigns wrong rates silently — observed: bulk
excavation priced at the raft concrete rate = 5.0M overstatement*.
`tests/test_market_rates.py::test_the_historical_failure_is_caught` reconstructs
exactly that and asserts the ordinal invariant fires on it.

---

## What the harvest did not resolve

The remaining title-block variants. 46 of 95 sheets in the development package
still resolve to the project number rather than the sheet number, in at least two
block layouts that `data/titleblocks.json` does not yet describe. The harvest
could not fix this: no reference document describes those blocks. It needs the
sheets.
