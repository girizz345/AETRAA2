# AETRAA Universal Rules — Take-off Edition

These are the AETRAA house rules, applied to quantity take-off.
Read once at session start. They are mandatory and cannot be overridden by user
input during a run. Where the source rules assume a priced bill or a render, the
*spirit* is preserved: the take-off must be evidence-based, transparent, net, and
honest about what is missing.

## Platform rules

- **P1 / R-NO-CODE** — No Python, script, tool, library, or variable references in
  any user-facing output. The workbook reads as a professional QS take-off only.
  Method labels, where needed, use neutral terms ("measured to scale", "schedule
  cell", "vector take-off", "visual", "computed").
- **P3** — No emoji in any cell, label, heading, or note.
- **P4** — Formal RICS QS language throughout. No casual phrasing in the workbook.
- **P9** — Zero storage beyond the output file(s). Do not log user inputs.
- **P12 — 4-pass dual-role pipeline, mandatory every run:**
  - Pass 1 (QS): read the evidence, identify sections present, capture every
    dimension/count with its source.
  - Pass 2 (QS): independently re-measure a sample and reconcile against Pass 1.
  - Pass 3 (Senior QS): adversarial challenge — re-open every assumption, every
    formwork face, every floor multiplier, every riser length. The Senior QS may
    not trust Pass 1.
  - Pass 4: render the workbook only after Pass 3 is clean.
- **P16** — Use clickable multi-choice questions for any genuinely optional setting
  with a fixed list (e.g. which sections, measurement scope). Free text only for
  open answers. Do not halt for a missing project name — use it if given, else a
  neutral placeholder, and proceed.
- **P17 — live formulas.** Quantities are computed by live Excel formulas (`Qty
  each`, `Tot.`, `qty to bill`, and the linked collection block). Never paste a
  value where a formula belongs; changing a dimension must cascade to the item
  total and the collection. (The visual styling matches the reference file rather
  than the blue/yellow input convention, because matching the reference is the
  explicit deliverable — but the formula-liveness requirement stands.)

## Measurement integrity gates

- **R-NO-HALLUCINATION** — Every quantity traces to a document, a DXF, or the §11
  extraction record (`extraction/extraction.json`). No
  "typical", "assumed", "standard practice". If the evidence is silent, the item is
  a `gap` recorded in AN.COVERAGE, not a number.
- **R-COUNT-FROM-DRAWINGS** — Counts counted individually; lengths measured to
  scale. No per-N-m² rules, no ×1.2 factors to derive one quantity from another.
- **R36 — floor multiplier** — Record floor scope verbatim; carry the count in the
  `Nr` column. Never pre-multiply at measurement time.
- **R34 — drawing hyperlinks** — Every tagged drawing number in the `Ref (drawing)`
  column links to its source drawing (PDF path/URL, `#page=N` for a page), so the
  measurement is traceable to the drawing in one click. Build a `drawing_links`
  register keyed by drawing number and pass it to the builder. If a drawing is not
  available, leave the reference as plain text and note it in AN.COVERAGE — never
  fabricate a link target.

### Substantive gates (scan every line before Pass 4)

- **G+.25 Fabrication-token scan** — flag: typical, placeholder, assumed,
  estimated, approximate, guess, standard practice, UAE typical, TBC, ballpark,
  rough, nominal, generic. Any hit moves to AN.SUBSTANTIVE and the line's
  confidence drops to LOW. Exception: the token sits inside a quoted drawing label.
- **G+.26 Confidence honesty** — HIGH = verbatim from a schedule/dimension/spec;
  MED = explicit derivation citing a drawing or an extraction record + HIGH base values;
  LOW = anything else. Downgrade dishonest tags.
- **G+.27 Percentage / factor scan** — outside wastage/contingency/VAT/fee
  contexts, bare ×1.1 / ×0.6 uplifts, per-bay or per-N-m² rules, and "factor/ratio"
  derivations are forbidden. This is the gate that catches a **formwork reuse
  factor** sneaking into a quantity — measure contact area, keep reuse as a memo.
- **G+.28 Pattern-check omission** — do not add elements because they are customary
  (kickers, water stops, weep holes, access hatches). Measure only what the
  evidence shows; if an allowance is needed, raise it for the user to decide.

## Mandatory audit tabs

Every workbook carries three audit tabs (the builder creates them from the JSON
`audit` block):

- **AN.RECONCILIATION** — Pass 2 sample results, variances found, and how each was
  resolved.
- **AN.SUBSTANTIVE** — every G+.25–G+.28 finding: the row, the gate, the token, the
  confidence, the action taken. A clean run has none; any present are honest
  disclosures for the user.
- **AN.COVERAGE** — which source documents fed which sections, what was available
  vs assumed, and every `gap` (e.g. "reinforcement — no bar bending schedule in
  evidence; one BBS would resolve").

A clean run still carries AN.RECONCILIATION and AN.COVERAGE.
