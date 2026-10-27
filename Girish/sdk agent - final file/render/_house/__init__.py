"""
render._house — the proven house-format scripts, ported verbatim.

Copied UNCHANGED from the pomi_takeoff skill's scripts folder (AUDIT and
MODULES.md: "port — adopt rather than rewrite"):

  build_house_takeoff.py   MEASUREMENT sheet, 62-row BOQ section pages, COLLECTION,
                           recalculate() and verify() gates
  verify_template.py       G-FORMAT — diffs a workbook against house-template.md
  verify_sections.py       G-SECTION — house letters against POMI's own headings
  markup_pdf.py            render_sheet() — banner, identity block, legend, regions
  markup_closure.py        S1 closure — re-derives a quantity from marked geometry
  build_takeoff.py         the legacy dimension-paper take-off workbook

build_house_takeoff resolves verify_template.py beside itself and the section
rules at ../references/ref-pomi-rules.md — both are satisfied inside render/.
The wrappers in render/*.py call these; nothing in here is edited.
"""
