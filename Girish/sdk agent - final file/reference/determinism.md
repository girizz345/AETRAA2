# DETERMINISM SPECIFICATION
## Binding on every seat. Version 1.0.
## Read before any other reference, on every run, by every seat.

This file exists because a prompt that is merely rigorous produces a different
answer every time it is run. Rigour says what is acceptable. Determinism says
what is produced.

  THE SAME INPUTS PRODUCE THE SAME OUTPUT, BYTE FOR BYTE,
  EXCEPT FOR run_id AND timestamps.

A run that cannot meet that is not a measurement process. It is an opinion
with a schema.

================================================================================
SECTION 1 — THE DETERMINISM CLASSES
================================================================================

Every field emitted by every seat carries one of three classes. The class is
declared in the seat's output schema, not decided at runtime.

  D  DETERMINISTIC — produced by a script from stated inputs by a stated
     algorithm. The model does not compute it, does not adjust it, and does
     not override it. Where a script exists for a value, using the model
     instead is a BLOCK condition.

  T  TRANSCRIBED — read verbatim off a document by the model and typed into
     a field without alteration. Not rounded, not normalised, not tidied, not
     unit-converted. The literal string, plus a separately recorded
     normalised form where one is needed.

  J  JUDGED — the model chose. Every J field is enumerated in
     `judgements[]` with the options considered, the rule applied, and the
     reason. A seat is measured by how few of these it emits.

RULES

  1.1  A value that a script can produce is class D. Producing it by model is
       a BLOCK.
  1.2  A value printed on a document is class T. Deriving it instead of
       reading it is a BLOCK.
  1.3  Class J is permitted only where §3 explicitly names it as a judgement
       point. A J field at any other location is a BLOCK.
  1.4  Every J field appears in `judgements[]`. An unlogged judgement is a
       BLOCK.
  1.5  Every seat reports its determinism ratio:
         D_count, T_count, J_count, and J as a percentage of the whole.

================================================================================
SECTION 2 — THE CONSTANTS TABLE
================================================================================

Every threshold, tolerance and limit used anywhere in this plugin. There are
no others. A seat that needs a constant not listed here raises a gap; it does
not choose one.

  ID     CONSTANT                              VALUE            USED BY
  ------------------------------------------------------------------------
  K01    Schedule row band height              0.15 x text_h    E1 §C2
  K02    Tag-to-value column proximity         300 drawing u.   E1 §C4
  K03    Two-source COUNT agreement            ±2% or ±1 unit,  E1 §F2
                                               whichever greater
  K04    Two-source DIMENSION agreement        ±1% or ±5 mm,    E1 §F2
                                               whichever greater
  K05    Two-source LENGTH agreement           ±2%              E1 §F2
  K06    Two-source AREA agreement             ±2%              E1 §F2
  K07    xref_bound test                       n_inserts > 200  E1 §A2
                                               AND native < 40
  K08    Variance law — accept                 ≤ 2%             C2 §F3
  K09    Variance law — correct                > 2% to 10%      C2 §F3
  K10    Variance law — re-measure type        > 10%            C2 §F3
  K11    Agree-loop round cap                  3                C2 §G5
  K12    Refusal restatements permitted        1                C2 §G4
  K13    Review batch size                     5 items          C2 §F1
  K14    Drawing batch size                    5 sheets         C2 §C1, §E1
  K15    QA/Rules automatic fix rounds         1                C2 §C3
  K16    Stop-the-line trigger                 2 batches, same  C2 §H2
                                               defect_type
  K17    Mass balance tolerance                ±5%              C3 §E2
  K18    Coincident count test                 exact equality   C3 §E4
  K19    Billed rounding                       ROUNDUP to 1     B1
                                               whole unit
  K20    Measured decimal places               2                B1
  K21    Region enlargement for reading        400% of native   E1 §E2
  K22    Text height tolerance for banding     ±20%             E1 §C2
  K23    Grid-cell sweep region size           1 grid bay       E1 §D1
  K24    Illegibility trigger                  2+ readings      E1 §E2
                                               plausible at 400%
  K25    Empty-issued sheet test               n_texts < 20 AND E1 §A2
                                               n_native < 5

  --- PDF EXTRACTION CONSTANTS (§11) ---------------------------------------
  K26    Raster render DPI                     600              §11.3
  K27    Render colour mode                    greyscale 8-bit  §11.3
  K28    Binarisation                          Otsu, global,    §11.3
                                               no local adapt
  K29    Deskew                                DISABLED         §11.3
  K30    OCR page segmentation — schedule      PSM 6            §11.4
  K31    OCR page segmentation — plan          PSM 11           §11.4
  K32    OCR engine mode                       OEM 1 (LSTM)     §11.4
  K33    OCR word confidence floor             80               §11.4
  K34    Numeric field char whitelist          0123456789.,-    §11.4
  K35    Dimension field char whitelist        0123456789.,-x×  §11.4
  K36    Tag field char whitelist              A-Z0-9-/         §11.4
  K37    Dual-engine unanimity — numerics      required         §11.5
  K38    Scale calibration dimensions          2 independent    §11.6
  K39    Scale calibration agreement           ±0.5%            §11.6
  K50    OCR tile edge                         2000 px          §11.4
  K51    OCR tile overlap                      200 px           §11.4
  K40    Vector path coordinate rounding       3 decimal places §11.2
  K49    Minimum assembled region area         100 sq units     §11.2

  --- MARKUP CONSTANTS (S1) ------------------------------------------------

  K41    Markup primitive selection            by unit, §4.9    S1 §B1
  K42    Area closure agreement                ±1%              S1 §E1, §E4
  K43    Linear closure agreement              ±1%              S1 §E2
  K44    Tag closure agreement                 exact equality   S1 §E3
                                               (= K18)
  K45    Minimum region vertices               AREA 3, LINEAR 2 S1 §C5
  K46    Colour assignment                     closed, §4.10    S1 §D1, §D2
  K47    Markup handoff point                  close of every   S1 §A1, §F
                                               K14 batch
  K48    Re-mark trigger                       qty | unit |     S1 §H1
                                               description |
                                               source sheet

A constant is changed by editing this table and nowhere else. A seat that
carries an inline number that duplicates a constant here is a BLOCK.

================================================================================
SECTION 3 — THE JUDGEMENT REGISTER
================================================================================

These, and only these, are judgement points. Everything else is D or T.

  J01  WITHDRAWN at v1.2 — the deployed set is FIXED: every seat is
       instantiated on every project, and a seat with no evidence returns
       ABSENT at zero. See §4.12. The id is retired, not reused.
  J02  Matrix gap assignment          C3    owner of an unassigned element
  J03  Variance bucket assignment     C3    which of six buckets a line sits in
  J04  Adopted quantity               C3    measured / baseline / re-measure
  J05  Comment materiality            K1-K4 whether a defect is worth raising
  J06  Refusal justification          M1    whether a comment is refused
  J07  WITHDRAWN at v1.1 — element presence is now the decision table at
       §11.7 and is class D. E1 emits no class-J field. The id is retired,
       not reused.
  J08  Measurement method selection   M1    which POMI rule governs an element
  J09  Sub-item split                 M1    whether an item splits by depth,
                                            type or zone
  J10  Query necessity                C3    whether a conflict warrants a query
  J11  Envelope exception             B2    applying a rate outside its class
                                            min/max on market evidence
  J12  Provisional allowance          B2    the amount carried against a
                                            declared gap, and its basis

Every occurrence is logged:

  { "judgement_id": "J03", "subject": "<string>", "options_considered": ["<string>"],
    "rule_applied": "<string>", "chosen": "<string>", "reason": "<string>" }

A seat emitting a J field outside this list is BLOCKED.

================================================================================
SECTION 4 — DECISION TABLES
================================================================================

Where a decision was prose, it is now a table. Tests run TOP TO BOTTOM and
the FIRST MATCH WINS. There is no "best fit" and no weighing.

--------------------------------------------------------------------------------
4.1  SHEET CLASSIFICATION  [class D]
--------------------------------------------------------------------------------

Test the title-block TITLE string, upper-cased, in this order:

   1  contains "SCHEDULE"                              -> SCHEDULE
   2  contains "LEGEND" or "SYMBOL"                    -> LEGEND
   3  contains "SCHEMATIC" or "RISER" or "SINGLE LINE" -> SCHEMATIC
   4  contains "SECTION" or "ELEVATION"                -> SECTION
   5  contains "DETAIL"                                -> DETAIL
   6  contains "NOTE" or "SPECIFICATION"               -> NOTES
   7  contains "AREA STATEMENT"                        -> AREA_STATEMENT
   8  contains "COVER" or "LIST OF DRAWINGS"           -> COVER
   9  contains "PLAN" or "LAYOUT"                      -> PLAN
  10  none of the above                                -> UNTYPED

Rule 5 sits BELOW rules 1–4 deliberately: "STAIRCASE DETAIL SCHEDULE" is a
schedule. Rule 9 sits last because "DETAIL PLAN" is a detail.

--------------------------------------------------------------------------------
4.2  PLATE SERVED FLOORS  [class D — script `_plate_serves`]
--------------------------------------------------------------------------------

   1  title matches range pattern with TO or hyphen  -> expand the range
   2  title matches pair pattern with & or AND       -> the two named floors
   3  title contains a FLOORWORDS keyword            -> that keyword's floors
   4  none of the above                              -> NULL + gap
                                                        NEVER 1

--------------------------------------------------------------------------------
4.3  READ TIER ASSIGNMENT  [class D]
--------------------------------------------------------------------------------

   1  value came from a schedule cell                 -> R1
   2  value came from a dimension string or callout   -> R2
   3  value came from a legend or notes table         -> R3
   4  value came from a specification clause          -> R4
   5  value produced by the counting protocol         -> R5
   6  value computed from 2+ values already R1–R5     -> R6
   7  none of the above                               -> NOT_FOUND

--------------------------------------------------------------------------------
4.4  VARIANCE ACTION  [class D]
--------------------------------------------------------------------------------

   1  |variance| ≤ K08                                -> ACCEPT
   2  |variance| ≤ K10                                -> CORRECT
   3  otherwise                                       -> REMEASURE_ELEMENT_TYPE

--------------------------------------------------------------------------------
4.5  VARIANCE BUCKET  [class J — J03, but tests are ordered]
--------------------------------------------------------------------------------

Run in order; first match wins; the matched test is the recorded rule.

   1  section exists in one document and not the other by structure
                                                      -> 1 FORMAT_AND_PRELIMS
   2  one side firm-priced, the other provisional     -> 2 PS_POLICY
   3  quantities agree within K08, amounts differ     -> 3 RATE_BASIS
   4  quantities differ and both describe same scope  -> 4 QUANTITY_METHOD
   5  line in baseline, no counterpart measured       -> 5 SCOPE_IN_BASELINE
   6  line measured, no counterpart in baseline       -> 6 SCOPE_MEASURED
   7  none of the above                               -> raise a query,
                                                        do not force a bucket

Test 3 before test 4: if the quantities agree, the difference cannot be
methodology, whatever else it looks like.

--------------------------------------------------------------------------------
4.6  LOWER-COST CLASSIFICATION  [class D]
--------------------------------------------------------------------------------

The seat has no rates and cannot compare cost. "Lower-cost" resolves by
lookup, not by reasoning:

  fire rating            unrated < 1-hour < 2-hour < 4-hour
  pipe material          uPVC < HDPE < GI < copper < stainless
  duct                   plain < insulated < fire-rated
  glazing                single < double < laminated < fire-rated
  concrete grade         lowest scheduled grade for that element type
  cable                  smallest scheduled size for that circuit
  finish                 the code with the lowest specification tier

Where the ambiguity is not in this table, raise a query. Do not infer.

--------------------------------------------------------------------------------
4.7  DISCIPLINE ORDER  [class D]
--------------------------------------------------------------------------------

Fixed. Not chosen per project:

  1 Enabling & Substructure    5 Public Health & Fire
  2 Concrete & Structure       6 Electrical & ELV
  3 Masonry, Finishes, Openings 7 External Works & Landscape
  4 Mechanical HVAC            8 Conveying & Preliminaries

Deployed disciplines run in this order with gaps closed up. A project with
only disciplines 1 and 6 runs 1 then 6.

--------------------------------------------------------------------------------
4.8  CROSS-CHECK SOURCE SELECTION  [class D]
--------------------------------------------------------------------------------

For an R5 count, the cross-check source is chosen by this order, first
available wins:

   1  a schedule carrying a quantity for the same tag
   2  a legend carrying a quantity
   3  a riser or schematic node count
   4  a second sweep on a different region basis
   5  none available -> record CROSS_CHECK_UNAVAILABLE + gap

The seat does not pick the most convenient. It takes the first that exists.

--------------------------------------------------------------------------------
4.9  MARKUP PRIMITIVE  [class D — K41]
--------------------------------------------------------------------------------

The UNIT decides. Nothing else does, and the seat does not choose.

   UNIT                    PRIMITIVE     NOTE
   ---------------------------------------------------------------------------
   m2                      AREA          shaded polygon
   m3                      AREA          shaded polygon + STATED THICKNESS;
                                         closure is area x thickness (S1 §E4)
   m                       LINEAR        traced polyline
   nr | set | item         TAG           point per instance, or the schedule
                                         row; closure is exact equality
   %  | sum | prov. sum    LEDGER_ONLY   no primitive. Prelims and PC sums are
                                         listed, not spotted.

DOWNGRADE, applied after the table and recorded with its reason:

   read tier T4 (raster only)      -> TAG
   source is a schematic           -> TAG
   source is a schedule            -> TAG

A shaded polygon over a raster is a polygon the seat invented. The downgrade is
not a failure — it carries the weakness of the source forward to where a reviewer
can see it.

--------------------------------------------------------------------------------
4.10  MARKUP COLOUR  [class D — K46]
--------------------------------------------------------------------------------

HUE from the POMI section letter. Closed, and constant across the whole project,
so that a reviewer learns the trade colour once and an unmarked element is
visible by its absence.

   A #7F7F7F   B #4A90D9   C #8C6BB1   D #C0703A   E #4F6FA8   F #7A5C3E
   G #B0913A   H #3F9E8C   J #2E7D5B   K #A0522D   L #D9772B   M #C05A7D
   N #6F8F3F   P #556B8D   Q #C0392B   R #D4A017

SHADE from the item's ordinal position within the SHEET, in bill order, cycling
through a closed ladder applied to the hue:

   1  base            2  base x 0.72 (darker)     3  base x 1.28 (lighter)
   4  base x 0.55     5  base x 1.50              6  base x 0.85

Six items per sheet is the ladder's limit. A seventh is a SPLIT SHEET, never a
reused colour — two items sharing a colour on one sheet is BS11, because the
sheet can then prove neither.

--------------------------------------------------------------------------------
4.11  TRADE TO BILL SECTION  [class D]
--------------------------------------------------------------------------------

AGREED SPLIT: the building is MEASURED BY TRADE and BILLED BY POMI SECTION.
The two are different cuts and this table is the only place they meet.

Measurement seats are the trades. The boundary matrix (seats-and-pipeline §5)
says which trade owns an element. This table says which bill section that
trade's items land in.

   SEAT                              BILL SECTIONS IT WRITES INTO
   ---------------------------------------------------------------------------
   M1  Enabling & Substructure       B Site Work
   M2  Concrete & Structure          C Concrete Work · E Metalwork (structural)
   M3  Masonry, Finishes & Openings  D Masonry · F Woodwork ·
                                     G Thermal and Moisture Protection ·
                                     H Doors and Windows · J Finishes ·
                                     K Accessories · M Furnishings
   M4  Mechanical HVAC               Q Mechanical Engineering Installations
   M5  Public Health & Fire          Q Mechanical Engineering Installations
   M6  Electrical & ELV              R Electrical Engineering Installations
   M7  External Works & Landscape    B Site Work (external to the building line)
   M8  Conveying & Preliminaries     P Conveying Systems · A General Requirements
   X1  Specialist Systems            L Equipment · N Special Construction
   X2  Temporary Works               A General Requirements

THE SHARED-SECTION RULE. Four sections receive work from more than one seat:

   A  from M8 and X2
   B  from M1 and M7
   Q  from M4 and M5
   R  from M6 alone, but ELV and power are separate item groups within it

Inside a shared section, the ITEM GROUP is owned by exactly ONE seat. Two seats
never write into the same item group, and C3 assembles the section from the
contributing take-offs in the order of this table — M1 before M7 in B, M4 before
M5 in Q, M8 before X2 in A. The order is fixed so that the same project measured
twice produces the same page breaks and the same item letters.

A seat that finds work belonging to a section it does not write into has found a
boundary breach, not a new section. CROSS_REF at zero, name the owner.

--------------------------------------------------------------------------------
4.13  RATE SOURCE  [class D]
--------------------------------------------------------------------------------

For each item the rate is taken from the FIRST available source in this order.
The seat does not pick the most favourable, the most conservative, or the most
convenient — the seat that picks its source picks its answer.

   1  A CONTRACT RATE that applies.
      Contractual, not commercial. Whether it is a good rate is irrelevant to
      whether it binds.

   2  A PROJECT-SPECIFIC QUOTATION, in date, for this scope.
      Its date is recorded with it.

   3  MARKET DATA for this jurisdiction, not older than 12 months.
      Tender returns and published indices. The jurisdiction is recorded — a
      Dubai rate is not an Abu Dhabi rate and neither is a Riyadh rate.

   4  THE HOUSE RATE LIBRARY.
      Last, always, and never used to avoid a blank.

   5  NONE AVAILABLE -> BLANK RATE + a technical query.

A blank rate is a legitimate output. It says "nobody has priced this, and here is
what we need in order to". A library rate says "this is what it costs". Where
nobody knows, only one of those is true, and the difference is what a client
relies on.

Rates from different tiers are NEVER averaged, and rates from different dates are
never averaged at all. Two readings taken on different bases are not two readings
of one number.

--------------------------------------------------------------------------------
4.11a  THE SECTION LETTERS  [class D — and the correction to house practice]
--------------------------------------------------------------------------------

AGREED: THE BILL FOLLOWS POMI'S OWN LETTERS. POMI runs A to R and skips I.

   A  General Requirements              J  Finishes
   B  Site Work                         K  Accessories
   C  Concrete Work                     L  Equipment
   D  Masonry                           M  Furnishings
   E  Metalwork                         N  Special Construction
   F  Woodwork                          P  Conveying Systems
   G  Thermal and Moisture Protection   Q  Mechanical Engineering Installations
   H  Doors and Windows                 R  Electrical Engineering Installations

THERE IS NO SECTION S. Communications, data, CCTV, fire alarm, BMS and access
control are ELECTRICAL ENGINEERING INSTALLATIONS and are billed in R, as separate
item groups within it.

CROSSWALK — house lettering used on bills issued before this correction. Every
revision comparison against an earlier issue must pass through this table, and
C1 records which set the earlier bill used.

   HOUSE (as issued)          POMI (governs from v1.2)
   ---------------------------------------------------------------------------
   K  Specialties          →  K  Accessories          same letter, correct title
   N  Furnishings          →  M  Furnishings          LETTER CHANGES
   —  (not used)           →  L  Equipment            newly available
   —  (not used)           →  N  Special Construction newly available
   S  Communications & ELV →  R  Electrical           SECTION DISSOLVED into R
   F  Wood & Plastic       →  F  Woodwork             same letter, correct title
   J1 ID Finishes          →  J  Finishes             not a letter. An ID package
                                                      is an item group inside J,
                                                      not a section of its own.

The two that bite: an item billed at N on an earlier issue is at M now, and an
S-section bill has no counterpart — its content is inside R. A gap analysis run
across the change without this crosswalk will report the whole of S as omitted
and the whole of M as new, and both readings are false.

--------------------------------------------------------------------------------
4.12  DEPLOYMENT  [class D — replaces judgement J01]
--------------------------------------------------------------------------------

AGREED: EVERY SEAT IS INSTANTIATED ON EVERY PROJECT.

A seat whose evidence contains nothing returns COMPLETE with every element at
status ABSENT, quantity zero, and its detection path recorded. It does not return
empty and it is not skipped.

This is deliberately the expensive option. The cheap one — deploy only the
disciplines the evidence appears to contain — makes C3's detection a single point
of failure for coverage: an entire trade can be missing from a bill because
nobody was asked to look for it, and nothing in the output says so. An ABSENT
return at zero is a POSITIVE STATEMENT that a seat looked and found nothing, and
it is visible to every checker downstream.

Consequence for J01: discipline deployment is no longer a judgement. J01 is
WITHDRAWN from the register. The deployed set is fixed, and what varies between
projects is how many seats return ABSENT.

================================================================================
SECTION 5 — CLOSED VOCABULARIES
================================================================================

Free text is banned in these fields. A value outside the list is a BLOCK.

  defect_type
    QUANTITY_ARITHMETIC · MISSING_ELEMENT · DUPLICATE_ELEMENT · WRONG_UNIT ·
    SOURCE_NOT_CITED · SOURCE_NOT_AUTHORITATIVE · WRONG_READ_TIER ·
    DIMENSION_MISREAD · COUNT_UNVERIFIED · MULTIPLIER_ERROR ·
    CLASSIFICATION_UNSUPPORTED · DESCRIPTION_NOT_PRICEABLE ·
    BOUNDARY_BREACH · MARKUP_MISSING · MARKUP_MISMATCH · DWG_REF_CONFLICT ·
    TEMPLATE_DEVIATION

  gap_class
    PLATE_UNRESOLVED · SCHEDULE_UNREBUILT · XREF_BOUND · EMPTY_ISSUED ·
    SIZE_UNRESOLVED · CROSS_CHECK_UNAVAILABLE · SPEC_ABSENT ·
    LEVEL_UNSOURCED · MATRIX_GAP · PARAMETER_ABSENT · GEOMETRY_ABSENT ·
    SCALE_UNCALIBRATED · NO_EVIDENCE_POSSIBLE

  markup_primitive       AREA · LINEAR · TAG · LEDGER_ONLY
  closure_result         CLOSED · MARKUP_MISMATCH · NO_EVIDENCE_POSSIBLE

  disposition            APPLIED · REFUSED · STANDING
  adopted_reason         MEASURED_GOVERNS · BASELINE_GOVERNS ·
                         REMEASURE_REQUIRED · QUERY_RAISED
  confidence             HIGH · MED · LOW
  status                 COMPLETE · BLOCKED · HALTED

CONFIDENCE IS NOT A FEELING. It is assigned by rule:

  HIGH  every input value is R1–R4, and every cross-check agreed within its
        constant
  MED   any input at R5 or R6, or an apportionment applied, or a cross-check
        agreed only at the tolerance boundary
  LOW   any input NOT_FOUND or ILLEGIBLE, or a classification adopted
        without a stated source, or a cross-check unavailable

================================================================================
SECTION 6 — CANONICAL ORDERING
================================================================================

Every output array is sorted before emission, so that two runs diff cleanly
and a reviewer sees changes rather than reshuffling.

  inventory[]              path ascending
  drawing_register[]       drawing_number_key, then revision descending
  sheet_map[]              doc_id ascending
  schedule_index[]         doc_id, then schedule_title
  schedules.rows[]         schedule_title, then tag
  counts[]                 subject, then block_name
  spaces.rooms[]           doc_id, then room name
  consolidated_register[]  pomi_section, then element_code, then line_id
  comments_register[]      station, round, comment_id
  gaps[] / not_found[]     class, then affected subject
  judgements[]             judgement_id, then subject
  every other array        its first field, ascending, string comparison

Ties break on the next field in the sort key, then on the record's own id.
Where a record has no id, it is assigned one from a stable hash of its
content — never from insertion order, never from a counter.

================================================================================
SECTION 7 — TIE-BREAK RULES
================================================================================

Where two options remain equally valid after every stated test:

  7.1  Two documents equally authoritative      -> lowest doc_id
  7.2  Two revisions, both apparently current   -> BLOCK, never pick
  7.3  Two schedule columns both matching a
       heading pattern                          -> leftmost
  7.4  Two tags equidistant from a value
       within K02                               -> leftmost
  7.5  Two sweep regions overlapping            -> the smaller region owns
                                                  the shared blocks
  7.6  Two seats both entitled by the matrix    -> BLOCK, matrix is defective
  7.7  Two variance buckets both matching       -> impossible: 4.5 is ordered
                                                  and first match wins

A tie-break is always logged. A silent tie-break is a BLOCK.

================================================================================
SECTION 8 — SCRIPT-FIRST RULE
================================================================================

Where a script exists for a computation, the model does not perform it, does
not check it by re-performing it, and does not adjust its result.

  MUST be script                       Script
  ------------------------------------------------------------------
  Sheet classification                 dxf_probe / classify
  Plate served floors                  dxf_probe._plate_serves
  cad_state verdict                    dxf_probe._assemble
  Schedule banding and pairing         dxf_probe._schedule_rows
  Block counts by name                 dxf_probe
  Layer lengths                        dxf_probe
  Area, volume, qty, total arithmetic  build_house_takeoff
  Billed rounding                      build_house_takeoff
  Collection and summary totals        build_house_takeoff
  Recalculation and read-back          build_house_takeoff.recalculate
  Hyperlink resolution                 build_house_takeoff.verify
  Markup region rendering              markup_pdf
  Gate checks G1–G6                    stage3_5_gate_check
  Revision comparison                  compare_revisions

The model's contribution is: reading text off a drawing, deciding a
§3-registered judgement, and writing prose. Nothing else.

A number in an output that a script should have produced is a BLOCK,
whether or not it is correct.

================================================================================
SECTION 9 — IDEMPOTENCY
================================================================================

  9.1  Re-running any seat on identical inputs produces byte-identical
       output, except run_id and timestamps.
  9.2  Every seat emits `input_digest`: a stable hash over its ordered
       inputs. Two runs with the same digest and different outputs is a
       defect in the seat, reported as such.
  9.3  No seat consults the current date, a random source, or any state
       outside its declared inputs.
  9.4  No seat's output depends on the order files happened to be listed in.
       Ordering comes from §6, never from the filesystem.
  9.5  Where a seat is re-run after an upstream change, it re-runs WHOLE.
       There is no partial re-run and no incremental patch, because a patch
       depends on what was there before and is therefore not idempotent.

================================================================================
SECTION 11 — 100% DETERMINISTIC EXTRACTION
================================================================================

Extraction is not interpretation. A drawing file is a data structure, and
reading a data structure requires no model.

  THE MODEL IS REMOVED FROM THE READ PATH ENTIRELY.
  EVERY EXTRACTED VALUE IS CLASS D.
  E1 EMITS ZERO CLASS-J FIELDS.

This applies to PDF exactly as it applies to DXF. A PDF is not one thing; it
is three separable things, and only one of them was ever difficult.

  TEXT      characters with coordinates
  GEOMETRY  vector paths with coordinates
  RASTER    pixels

--------------------------------------------------------------------------------
11.1  SOURCE TIERS  [class D — determined by probe, not by choice]
--------------------------------------------------------------------------------

Every document resolves to exactly one tier. The test is mechanical and runs
top to bottom, first match wins.

  T1  DXF / DWG                            entities carry text and geometry
  T2  PDF, text layer present              extractable words with coordinates
      (page.extract_words() returns ≥ K25 words)
  T3  PDF, text outlined, vector geometry  no words; get_drawings() returns
      present                              paths
  T4  PDF, raster only                     no words, no vector paths

Record `source_tier` on every document. It governs which read path applies
and what is and is not available from that sheet.

--------------------------------------------------------------------------------
11.2  GEOMETRY EXTRACTION  [T1, T2, T3 — class D]
--------------------------------------------------------------------------------

Vector geometry is exact, and it exists in a vector PDF exactly as it exists
in a DXF. It is never obtained by looking at a picture.

  T1  ezdxf: LINE, LWPOLYLINE, POLYLINE, ARC, CIRCLE, HATCH boundary,
      INSERT position and name. Lengths and areas computed by the script.
  T2, T3  pymupdf `page.get_drawings()`: every path item as
      ("l", p1, p2) line, ("c", …) bezier, ("re", rect), with stroke and
      fill colour, width and closure. Coordinates are exact PDF points.
      Lengths and areas computed by the script.
  T4  NO VECTOR GEOMETRY EXISTS. Any length or area from a T4 sheet is
      obtainable only by scale calibration at §11.6, and every such value
      carries `geometry_source: SCALED` and confidence MED at best.

Coordinates are rounded to K40 before comparison, so that two exports of the
same drawing produce identical keys.

REGION ASSEMBLY. A CAD-exported PDF does not contain rooms. It contains a
tessellation: a hatched area arrives as thousands of small filled triangles, and
a wall line arrives as hundreds of separate two-point segments. The region is IN
the source; it is simply shredded. Two mechanical operations put it back, and
neither invents anything:

  FILLED REGIONS  group filled paths by fill colour, union each group. The
                  boundary of the union is the boundary that was drawn. Regions
                  below K49 are glyph fills — outlined text — and are dropped.
  LINEAR RUNS     build a graph on K40-rounded endpoints and walk maximal chains
                  through degree-2 nodes. A chain is one drawn run.

Both are deterministic: same paths in, same regions out. Neither closes a gap,
smooths a corner or snaps at any tolerance other than K40. A boundary that is
open in the source stays open, and an open boundary is not an area.

--------------------------------------------------------------------------------
11.3  RASTERISATION  [T3, T4 only — class D]
--------------------------------------------------------------------------------

Where text must be recovered from pixels, the pixels are produced by a fixed
pipeline. Every parameter is a constant. No parameter is chosen per document.

  1  Render the page at K26 DPI, K27 colour mode, using the pinned renderer.
  2  Binarise by K28. Global Otsu, computed over the whole page. Local or
     adaptive thresholding is BANNED: its result depends on window placement,
     which depends on page size, which makes two crops of one page disagree.
  3  Deskew is K29 — DISABLED. Deskew resamples, resampling is
     implementation-dependent, and a UAE consultant's issued PDF is not
     skewed. A genuinely skewed scan is recorded as such and its sheet is
     flagged, not silently straightened.
  4  No sharpening, denoising, contrast stretch or morphological operation.
     Each is a free parameter and every free parameter is a source of drift.

The rendered bitmap is hashed. The hash is recorded against the document, so
a re-render that differs is detected rather than absorbed.

--------------------------------------------------------------------------------
11.4  OCR  [T3, T4 only — class D]
--------------------------------------------------------------------------------

OCR is deterministic when it is pinned. LSTM inference is not sampled; the
same bitmap and the same parameters give the same characters every time.
Non-determinism enters through unpinned versions, variable parameters and
adaptive preprocessing, and §11.3 has removed the last of those.

  0  TILING. The page is OCR'd in a FIXED GRID of K50 tiles overlapping by
     K51, and every word's coordinates are mapped back to page space.

     This is not an optimisation. Tesseract's layout analysis returns NOTHING
     on a large sparse drawing — two dimension strings on a 3000 x 2200 page
     yield zero words, and the same strings read perfectly from a crop. A
     construction drawing is exactly that shape: a very large page carrying
     scattered text. Without tiling, §11.4 reads nothing at all on the sheets
     it exists for.

     The grid is fixed, so it is deterministic. K51 is large enough that any
     word falls whole inside at least one tile. A word found in two tiles is
     ONE word: same text and centres within K51/2 are the same reading, and the
     duplicate with the lower confidence is dropped — ties broken by bounding
     box then text, so the survivor never depends on tile order.

  1  Engine mode K32. Page segmentation K30 for a sheet classified SCHEDULE,
     K31 for every other class.
  2  Output in TSV: word, bounding box, confidence. The coordinates are what
     make the schedule banding algorithm applicable to OCR output exactly as
     it is applied to a text layer — one algorithm, four tiers.
  3  CHARACTER WHITELIST BY FIELD CLASS. A quantity column is read with K34,
     a dimension with K35, a tag with K36. This is the single largest
     accuracy gain available and it is free: a whitelist cannot turn a 3
     into a B, because B is not in the alphabet.
  4  CONFIDENCE FLOOR K33. A word below it is ILLEGIBLE. It is never the
     best guess, never the likelier reading, never inferred from context.
  5  No language model, no dictionary correction, no autocorrect. A
     dictionary that turns "D2" into "D3" because D3 is commoner has
     destroyed the read.

--------------------------------------------------------------------------------
11.5  DUAL-ENGINE UNANIMITY  [numerics only — class D]
--------------------------------------------------------------------------------

Determinism is not accuracy. A pinned pipeline that misreads a character
misreads it identically forever. That is better than a moving error, because
it is findable — but it is still wrong.

For every NUMERIC field recovered by OCR, K37 requires two independent pinned
engines to agree character for character.

  agree     -> value accepted, class D, confidence MED
  disagree  -> ILLEGIBLE, both readings recorded, gap raised

Two deterministic engines combined are deterministic. The combination raises
accuracy without surrendering reproducibility, and it converts the residual
error class from "silently wrong" to "visibly unread".

--------------------------------------------------------------------------------
11.6  SCALE CALIBRATION  [T4 only — class D]
--------------------------------------------------------------------------------

A T4 sheet has no vector geometry, so any length must come from the raster.
That is permitted only under calibration, and never from a scale bar.

  1  Locate K38 printed dimension strings whose endpoints are identifiable
     in the raster — two, independently, on different axes where possible.
  2  For each, compute px-per-mm from the printed value and the measured
     pixel span.
  3  The two must agree within K39. Outside it, the sheet is
     SCALE_UNVERIFIED and no length is taken from it.
  4  Record both calibration dimensions, both ratios and the variance.

A scale bar is not a calibration. It rescales with the sheet, so it agrees
with a rescaled drawing perfectly and tells you nothing.

--------------------------------------------------------------------------------
11.7  ELEMENT PRESENCE  [replaces judgement J07 — class D]
--------------------------------------------------------------------------------

J07 is withdrawn from the §3 register. Presence is now a decision table.
Tests run top to bottom, first match wins.

   1  a schedule row exists for the element                    -> PRESENT
   2  a sheet in the register is named for it                  -> PRESENT
   3  a legend entry defines its tag, AND that tag occurs      -> PRESENT
      on a sheet
   4  a block insert whose name maps to it occurs              -> PRESENT
   5  the specification names it as required work              -> PRESENT
   6  none of the above                                        -> ABSENT

ABSENT is emitted with quantity zero and its detection path recorded. It is
never omitted, and it is never NOT_FOUND — absence of evidence is ABSENT,
absence of a readable value is NOT_FOUND, and they are different findings.

--------------------------------------------------------------------------------
11.8  TOOLCHAIN AND INPUT PINNING
--------------------------------------------------------------------------------

Determinism across a single run is worthless without determinism across
time. A library upgrade that changes a rounding behaviour silently changes
every quantity, and nothing in the output would show it.

  Every run records `toolchain[]`:
    { "tool": "<name>", "version": "<exact>", "hash": "<sha256 of binary
      or package>" }
  pinned, at minimum: ezdxf · pymupdf · pdfplumber · the OCR engines and
  their trained data · the renderer · openpyxl · the recalculation engine.

  Every document records `content_hash` (sha256 over its bytes).

  Every seat records `input_digest`: sha256 over its ordered inputs and the
  toolchain block.

  Same input_digest and different output is a defect in the seat, reported
  as one. Same input_digest across two dates and different output means the
  toolchain moved, and the toolchain block will show which tool.

--------------------------------------------------------------------------------
11.8a  WHAT §11 COSTS
--------------------------------------------------------------------------------

A T2 sheet — vector, with a text layer — extracts in seconds. Geometry is read
straight out of the file and no pixel is touched.

A T4 sheet does not. At K26 the page is rendered to roughly 14,000 x 10,000
pixels, tiled at K50, and every tile is read by two independent engines. That is
minutes per sheet, not seconds, and it does not parallelise past the cores
available.

This is not a defect to optimise away. It is the PRICE OF A RASTER ISSUE, and it
is worth stating to a client, because the alternative to paying it is guessing.
Two consequences follow, and both are commercial rather than technical:

  1  ASK FOR THE DXF. One request at intake removes the whole cost and raises
     every quantity from SCALED/MED to exact.
  2  BATCH IT. K14 sheets at a time, run while other work proceeds. A T4-heavy
     set is a programme item, not something absorbed silently.

--------------------------------------------------------------------------------
11.9  WHAT REMAINS, HONESTLY
--------------------------------------------------------------------------------

After §11, extraction is reproducible: same bytes in, same values out, on any
machine, on any date, provably.

It is NOT thereby correct. A whitelist-constrained, dual-engine, confidence-
floored OCR read of a poor scan can still be wrong. What has changed is that
it is wrong in a fixed, locatable, one-time-fixable way, and that every value
it could not read with confidence is ILLEGIBLE rather than plausible.

Accuracy is bought elsewhere — by the two-source rule, the cross-check gates
and the adversarial review. Determinism is what makes those gates mean
something, because a gate applied to a moving target proves nothing.

================================================================================
SECTION 12 — SELF-CHECK — BINDING ON EVERY SEAT
================================================================================

AD.1   Every emitted field carries a determinism class D, T or J.
AD.2   No field is class J outside the §3 register.
AD.3   Every J field appears in judgements[] with options, rule and reason.
AD.4   The determinism ratio is reported.
AD.5   Every threshold used appears in §2 by ID; no inline constant
       duplicates one.
AD.6   Every decision listed in §4 was made by its table, top to bottom,
       first match winning.
AD.7   Every closed-vocabulary field holds a listed value.
AD.8   Confidence was assigned by the §5 rule, not by impression.
AD.9   Every array is sorted per §6.
AD.10  Every tie-break is logged with the rule that broke it.
AD.11  No computation listed in §8 was performed by the model.
AD.12  input_digest is emitted.
AD.13  No date, random source or undeclared state was consulted.
AD.14  Re-running this seat on these inputs would produce this output.

  --- EXTRACTION, §11 ------------------------------------------------------
AD.15  Every document carries a source_tier T1–T4, set by probe.
AD.16  No extracted value was produced by the model. E1 emits zero class-J
       fields.
AD.17  Every length and area from T1–T3 came from vector geometry, never
       from a picture.
AD.18  Every T4 length carries geometry_source SCALED and a calibration.
AD.19  Rasterisation used K26–K29 exactly; no deskew, no denoise, no
       sharpening, no adaptive threshold.
AD.20  The rendered bitmap hash is recorded per rasterised page.
AD.21  OCR used the pinned engine at K30/K31/K32 with the field-class
       whitelist at K34–K36.
AD.22  No word below K33 confidence was emitted as a value.
AD.23  No dictionary, language model or autocorrect touched an OCR result.
AD.24  Every OCR numeric passed K37 dual-engine unanimity, or is ILLEGIBLE
       with both readings recorded.
AD.25  Every T4 sheet used for a length has two calibration dimensions
       agreeing within K39.
AD.26  No length was taken from a scale bar.
AD.27  Element presence was decided by the §11.7 table, not judged.
AD.28  toolchain[] is recorded with exact versions and hashes.
AD.29  content_hash is recorded per document and input_digest per seat.
