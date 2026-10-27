# TAIL CONTRACT — stages S13..S21 (the output end)

Binding on stages_takeoff.py, stages_bill.py, stages_render.py. Every stage is
`def _stage_x(ctx) -> list[str]` returning the artefact filenames it wrote into
`ctx["run"]`, raising on failure (the runner records FAILED + a gap), and
handing the next stage its data through `ctx["<key>"]`.

## ctx at S13 (produced by S0..S12, all already wired)
- quantities: list[spine.records.Quantity] (element_mark, clause_id, value Decimal, unit, evidence_ids, origin, section)
- elements: list[Element] (mark, element_type, dims{role->evidence_id}, count, sheets, evidence_ids, multiplier)
- base: measure.evidence.EvidenceBase  (.get(id)->EvidenceRecord{id,value,unit,doc_id,region(None here),origin}, .weakest_origin(ids))
- clause_table: ingest.clause_table.ClauseTable (.get(id)->Clause{id,section,title,unit,shape,thresholds,deduction_rule,grouping,source}, .by_section(L))
- classifications, schedules (dicts: doc_id, drawing_no, rows[{mark,values,row_index}], roles), sheets (list[SheetRecord]: doc_id, drawing_no, title, subtitle, revision, scale, discipline, section, sheet_kind, tier), routing, tag_counts
- project (Path), run (Path), gaps (GapList; gaps.add(Gap(stage,doc_id,subject,reason,detail=None))), no_ai (bool), config (spine.config.Config), region (str|None)

## Invariants (README invariants 1-8, DECISIONS.md)
model never produces a number; sort everything; GP3.1 products never rounded
(quantities stay Decimal strings, full precision); gaps never assumptions; every
user-facing string passes render.hygiene.violations (violation -> gap, never
silently rewritten); no fabricated hyperlink; item letters A..V skip I and O
(bill.lettering); one description block + variants (Ditto) per group.

## Artefacts (JSON, sort_keys=True, indent=1, Decimals as strings)

### takeoff.json  (S13)  — the legacy dimension-paper contract (reference/takeoff-format.md)
{"project": str|null, "descriptor": null,
 "drawing_links": {"<dwg_no or doc_id>": "markup/<seq>. <name>.pdf" | ""},
 "sections": [{"letter": "C", "name": "CONCRETE WORK",
   "items": [{"code": "C-A", "clause_id": "C2.1", "element_mark": "S1",
              "description": "<clause title>", "unit": "m3", "quantity": "12.6352",
              "lines": [{"ref": "<dwg_no or doc_id>", "level": str|null, "desc": "<element_type> <mark>",
                         "nr": int, "L": num|null, "W": num|null, "H": num|null,
                         "qty_each": num|null, "location": null,
                         "evidence_ids": [...], "method": "schedule cell|counted from plan|stated level difference|measured to scale",
                         "squared": "12.6352"}]}]}],
 "audit": {"reconciliation": [[...]], "substantive": [[...]], "coverage": [[...]]}}
RULE: sum(Decimal(line.squared)) == quantity.value EXACTLY (takeoff.rollup.reconcile). One quantity = one item.
Item code = "{L}-{letter}" with bill.lettering.letters over the section's items in canonical order (sorted by clause_id, element_mark).

### house_measurement.json (S13) — the measurement[] blocks build_house_takeoff consumes
{"<L>": {"section_letter": L, "section_title": crosswalk.title(L), "pomi_section_title": crosswalk.title(L),
         "measurement": [{"kind": "element", "text": "<element type>"},
                         {"kind": "item", "item_key": "<code>", "item_ref": "", "boq_page": "",
                          "description": "<desc>", "unit": u, "units": nr|null,
                          "length": L|null, "width": W|null, "height": H|null,
                          "area": A|null, "volume": V|null, "qty": Q|null,
                          "dwg_ref": "<dwg_no or doc_id>", "markup": "<seq>. <name>.pdf"|null}]}}
(units/length/width/height -> live formulas; else area/volume/qty literal; Total Qty = ROUNDUP)

### markup_instructions.json (S14)
{"instructions": [{"doc_id", "page": 0, "primitive": "polygon|polyline|tag", "points": [[x,y],...],
                   "colour": [r,g,b], "hex": "RRGGBB", "item_code", "label_at": [x,y],
                   "section": L, "qty": "..", "unit": ".."}],
 "unplaced": ["<item_code>", ...], "closure": {"<item_code>": "CLOSED|MARKUP_MISMATCH|NOT_CALIBRATED"}}
Region of a schedule-derived element = the schedule ROW band: re-read the schedule sheet
(readers.extract.extract_words -> readers.schedule_grid.band_rows), find the band holding a
word == mark, Region = [min x0, band.top, max x1, band.bottom] (page-display-topleft-pt).
Primitive per unit (takeoff.markup.PRIMITIVES); colour from ingest.conventions.Conventions.colour(section).rgb.

### markup_spec.json (S14) — exactly what render/_house/markup_pdf.render_sheet consumes, per section
{"<L>": {"project", "building", "section_letter": L, "section_title", "group": "<title>",
         "sheets": [{"seq": n, "name": "<drawing_no>", "source_pdf": "<absolute path>", "source_page": 0,
                     "drawing_no", "filename": "<doc_id>",
                     "items": [{"label": "<code>", "qty": float, "unit", "colour": "#RRGGBB",
                                "kind": "area|line|tag", "regions": [[[x,y],...]]}]}]}}
Output file per sheet = f"{seq}. {name}.pdf" — this string is the drawing_links / house "markup" value.

### audit.json (S13/S14) — the three AN tabs
{"AN.RECONCILIATION": [[subject, source_a, value_a, source_b, value_b, resolution, justified_by]],
 "AN.SUBSTANTIVE":    [[item_code, judgement, basis, alternative]],
 "AN.COVERAGE":       [[section, evidence_kind, evidence_count, output_rows, status]]}

### descriptions.json (S15)
{"items": [{"item_code", "section", "clause_id", "element_mark", "family": "family_1|2|3|null",
            "description": "<lead full text: clause title + attributes + closing formula text>",
            "is_variant_of": "<lead item_code>|null", "variant_text": "Ditto, 150mm thick"|null,
            "attributes": {...}, "unevidenced": [...]}]}
NOTE conventions descriptions[].template is a FAMILY KEY ("family_1"); the text lives in
conventions.json closing_formulas[family].text. Family 3 (Q,R) is the "Supply and install all
{system} ... including but not limited to {components} ..." template. Tokens scanned by
ingest.gates.Gates.scan (G+.25) -> AN.SUBSTANTIVE.

### completeness.json (S16)
{"evidence_counts": {kind: n}, "rows_by_section": {L: n},
 "findings": [{"evidence_kind","evidence_count","section","output_rows","status","justification"}],
 "blocked": bool}
evidence_kind from element_type: door->door_schedule, window->window_schedule, finish->finish_schedule,
sanitary|fixture->sanitary_schedule, equipment->equipment_schedule, slab|column|beam->structural_schedule.
Justifications read from <run>/AN_RECONCILIATION.json or <project>/AN_RECONCILIATION.json
{"<evidence_kind>|<section>": "text"} if present. blocked=True when any FAIL -> S20 refuses bill.xlsx.

### nonmeasured.json (S17)
{"items": [{"bill": 1, "clause_ref", "text", "unit": "item", "value_is_commercial": bool, "priced_by": null}]}
(clause_table.by_section("A"); commercial when title matches provisional|contingenc|allowance|sum)

### priced.json (S18)
{"rows": [{"ref": "<item_code>", "section", "rate_class", "unit", "quantity": "..",
           "rate": ".."|null, "amount": ".."|null, "citation": str|null, "flags": [...], "failures": [...]}],
 "failures": [...], "flags": [...],
 "rates": {"<class>": {"value": "..", "unit", "citation", "flags": [...]}}, "searched": n, "no_ai": bool}
rate_class from the CLAUSE (never the description): a table class with section==clause.section and
unit==clause.unit whose label contains the clause title's key tokens; else "UNLISTED_CLASS:{section}.{clause_id}"
(flag UNLISTED_CLASS, a gap not a number). With no_ai every class is NO_RATE.

### bill.json (S19)
{"bill_no": 2, "project": str|null,
 "sections": [{"letter", "title", "pomi_section_title", "section_no": i,
               "lines": [{"ref", "item_letter", "page": "2/1/1", "description", "quantity", "unit",
                          "rate", "rate_source", "clause_id", "evidence_ids", "is_variant_of"}],
               "pages": [{"reference": "2/1/1", "item_count": n}], "last_page_ref", "total": ".."}],
 "nonmeasured": [...],
 "house_specs": {"<L>": {"section_letter","section_title","pomi_section_title","bill_no": 2,
                         "section_no": i, "summary_ref": "S1", "sheet_name": "Section <L>",
                         "project", "client", "package", "building", "trade",
                         "measurement": [...from house_measurement...],
                         "boq_pages": [{"entries": [{"kind":"heading","text"} |
                                                    {"kind":"item_group","description":[lines],"items":[{"variant","item_key","unit","rate"}]} |
                                                    {"kind":"item","item_key","unit","description","rate"} ]}]}},
 "summary": [{"section", "last_page_ref"}]}
PAGINATION IS A SPEC DECISION: build_house_takeoff ABORTS if a page overflows 46 body rows.
Count rows with render/_house/build_house_takeoff.wrap_lines: heading=2, item=len(lines)+1,
item_group=len(desc lines)+1+2*n-1+1; never end a page on a heading; an item_group is atomic.
Letters restart A.. per page skipping I,O (bill.lettering); page code = f"{bill}/{section_no}/{n}".

### S20 render writes: takeoff.xlsx, bill.xlsx, markup/<seq>. <name>.pdf + markup/00-LEGEND-INDEX.pdf,
provenance.xlsx, render.json (what was written, gates run, recalc status). S21 writes revision_changes.json
and appends a "REVISION CHANGES" sheet to bill.xlsx (first issue: every line ADDED).
