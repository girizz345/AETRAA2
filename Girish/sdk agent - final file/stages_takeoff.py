#!/usr/bin/env python3
"""
stages_takeoff.py — S13 (take-off) and S14 (markup), against TAIL-CONTRACT.md.

Both stages are deterministic: no model is asked anything, so --no-ai changes
nothing here. Each is `def _stage_x(ctx) -> list[str]`, writes its artefacts
into ctx["run"], records what it could not resolve as gaps, and hands the next
stage its data through ctx.

S13 renders the quantities S12 produced as dimension paper. It is not a new
computation: `squared` on every row IS the quantity, so the rollup reconciles
exactly and a disagreement is a dropped row, never a rounding artefact. Item
codes are lettered here, per section, in canonical order — sorted by
(clause_id, element_mark) — with bill.lettering, which skips I and O.

S14 draws every take-off row back onto the sheet it came from. Schedule-derived
evidence carries no region, so the region is derived by re-reading the schedule
sheet and taking the row band that holds the mark. A row that cannot be located
is UNPLACED — a gap, not an invented coordinate. Scale is not calibrated at
v3.1 (S4 deferred), so area and linear items close as NOT_CALIBRATED.

Not a CLI; agent.py wires these into its stage table.
"""
from __future__ import annotations

import json
import math
import re
from decimal import Decimal
from pathlib import Path

from bill import lettering
from ingest import crosswalk
from render import hygiene
from spine.gaps import Gap

HERE = Path(__file__).resolve().parent

STAGE_TAKEOFF = "S13"
STAGE_MARKUP = "S14"

MARKUP_DIR = "markup"                   # where S20 writes the marked sheets
KIND_BY_PRIMITIVE = {"polygon": "area", "polyline": "line", "tag": "tag"}
LETTERS_PER_RUN = len(lettering.SEQUENCE)


# ── shared helpers ─────────────────────────────────────────────────────────
def _json_default(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, (set, frozenset)):
        return sorted(value)
    raise TypeError(f"not serialisable: {type(value).__name__}")


def _write(run: Path, name: str, payload) -> str:
    (run / name).write_text(json.dumps(payload, indent=1, sort_keys=True,
                                       default=_json_default))
    return name


def _num(value: Decimal | None):
    """A dimension for a numeric cell. Dimensions are 2 dp by GP3.1, so the
    float is exact for the eye; the reconciling value stays a string."""
    return None if value is None else float(value)


def _sheets_by_doc(ctx) -> dict:
    return {s.doc_id: s for s in (ctx.get("sheets") or [])}


def _drawing_numbers(sheets: dict) -> dict:
    """doc_id -> the reference shown for it: the drawing number where the
    register has one AND it names exactly one sheet, else the doc_id. Two
    files claiming A-100 cannot both be "A-100" in a column that hyperlinks."""
    owners: dict[str, list] = {}
    for doc_id, sheet in sheets.items():
        if sheet.drawing_no:
            owners.setdefault(sheet.drawing_no, []).append(doc_id)
    out = {}
    for doc_id, sheet in sheets.items():
        if sheet.drawing_no and len(owners[sheet.drawing_no]) == 1:
            out[doc_id] = sheet.drawing_no
        else:
            out[doc_id] = doc_id
    return out


def _on_disk(ctx) -> dict:
    project = ctx.get("project")
    if not project:
        return {}
    from spine.files import project_files
    return project_files(Path(project))


def sheet_sequence(doc_ids, sheets: dict) -> dict:
    """doc_id -> (seq, name) for the sheets S14 marks. Sorted by (name,
    doc_id) so the sequence is the same on every run; seq starts at 1 because
    00 is the legend index."""
    def name_of(doc_id):
        sheet = sheets.get(doc_id)
        name = (sheet.drawing_no if sheet and sheet.drawing_no
                else Path(doc_id).stem)
        # the name becomes a file name: "A/101" or "S:05" is a drawing number
        # but not a file, on any system
        return re.sub(r'[\\/:*?"<>|]+', "-", name).strip(" .") or "sheet"
    ordered = sorted(set(doc_ids), key=lambda d: (name_of(d), d))
    return {d: (i + 1, name_of(d)) for i, d in enumerate(ordered)}


def markup_filename(seq: int, name: str) -> str:
    return f"{seq}. {name}.pdf"


def item_codes_for(section: str, count: int) -> list[str]:
    """"{L}-{letter}" over bill.lettering's run. The run holds twenty letters
    and refuses to invent AA; a section with more items continues in a second
    run carrying its ordinal — "H-A".."H-V", then "H-2A".."H-2V" — so every
    code in the section stays unique and the letter sequence stays the one
    measured from the reference bill."""
    codes = []
    for index in range(count):
        block, offset = divmod(index, LETTERS_PER_RUN)
        letter = lettering.letter_at(offset)
        codes.append(f"{section}-{letter}" if block == 0
                     else f"{section}-{block + 1}{letter}")
    return codes


def _locate_targets(ctx, targets):
    """Regions for (item_code, mark, doc_id) targets, cached in ctx so S14
    does not re-read what S13 already read."""
    from takeoff.markup import locate
    regions, problems = locate(targets, _on_disk(ctx))
    ctx["regions"] = regions
    ctx["region_problems"] = problems
    return regions, problems


# ── S13 ────────────────────────────────────────────────────────────────────
def _stage_takeoff(ctx) -> list[str]:
    """Stage 13 — the take-off: dimension rows, rollups, item codes, the
    house measurement blocks and the audit tabs."""
    from takeoff import audit as audit_tabs
    from takeoff.rollup import build as rollup_build, reconcile
    from takeoff.rows import rows_for

    gaps = ctx["gaps"]
    run = Path(ctx["run"])
    base = ctx["base"]
    table = ctx.get("clause_table")
    sheets = _sheets_by_doc(ctx)
    refs = _drawing_numbers(sheets)
    by_mark = {e.key: e for e in (ctx.get("elements") or [])}   # key: mark @ storey @ bay

    # canonical order per section: (clause_id, element_mark)
    by_section: dict[str, list] = {}
    for quantity in ctx.get("quantities") or []:
        by_section.setdefault(quantity.section, []).append(quantity)
    for letter in by_section:
        by_section[letter].sort(key=lambda q: (q.clause_id, q.element_mark))

    item_codes: dict = {}
    rows_by_code: dict = {}
    all_rows_by_code: dict = {}       # every row of an item (a measured item has several)
    meta_by_code: dict = {}
    sections_out = []
    house: dict = {}
    seen_keys: set = set()

    for letter in crosswalk.ordered():
        quantities = by_section.get(letter)
        if not quantities:
            continue
        codes = item_codes_for(letter, len(quantities))
        if len(quantities) > LETTERS_PER_RUN:
            gaps.add(Gap(stage=STAGE_TAKEOFF, doc_id=None, subject=letter,
                         reason=f"section {letter} carries {len(quantities)} "
                                f"items; the letter run holds "
                                f"{LETTERS_PER_RUN}, so codes continue in a "
                                f"second run with its ordinal",
                         detail="the break is a pagination decision — the "
                                "bill restarts letters per page"))
        items = []
        measurement: list = []
        last_type = None
        for code, quantity in zip(codes, quantities):
            key = (quantity.clause_id, quantity.element_mark)
            if key in seen_keys:
                gaps.add(Gap(stage=STAGE_TAKEOFF, doc_id=None,
                             subject=quantity.element_mark,
                             reason=f"two quantities under {quantity.clause_id} "
                                    f"for one mark; one quantity is one item",
                             detail="both are written; the later code stands "
                                    "against the key"))
            seen_keys.add(key)
            item_codes[key] = code

            element = by_mark.get(quantity.element_mark)
            if element is None:
                gaps.add(Gap(stage=STAGE_TAKEOFF, doc_id=None,
                             subject=quantity.element_mark,
                             reason="quantity has no element to write a "
                                    "dimension row from"))
                continue

            # description = the clause title; a violation is a gap, never a
            # silent rewrite
            description = quantity.clause_id
            if table is not None and quantity.clause_id in table:
                description = table.get(quantity.clause_id).title
            else:
                gaps.add(Gap(stage=STAGE_TAKEOFF, doc_id=None, subject=code,
                             reason=f"clause {quantity.clause_id} not in the "
                                    f"clause table; the clause id stands as "
                                    f"the description"))
            for problem in hygiene.violations(description):
                gaps.add(Gap(stage=STAGE_TAKEOFF, doc_id=None, subject=code,
                             reason=f"description fails hygiene: {problem}",
                             detail=description))

            rows = rows_for(quantity, element, base, item_code=code,
                            sheets=sheets)
            rollup = rollup_build(rows, quantity)
            mismatch = reconcile(rollup, quantity)
            if mismatch:
                gaps.add(Gap(stage=STAGE_TAKEOFF, doc_id=rows[0].drawing_ref
                             or None, subject=code,
                             reason=mismatch,
                             detail="written as computed; a take-off that "
                                    "disagrees with its bill is a defect, "
                                    "not a tolerance"))
            for row in rows:
                rows_by_code.setdefault(row.item_code, row)
            all_rows_by_code[code] = rows
            measured = bool(getattr(element, "lines", ()))
            meta_by_code[code] = {
                "clause_id": quantity.clause_id,
                # the mark as the schedule wrote it: this is what the markup
                # looks for on the sheet (the key carries the storey/bay)
                "element_mark": element.mark,
                "element_key": quantity.element_mark,
                "element_type": element.element_type,
                "section": letter,
                "doc_id": rows[0].drawing_ref,
                "count": int(element.count),
                "measured": measured,
                "unit": quantity.unit,
            }

            lines = []
            descs = ([ln.desc for ln in element.lines] if measured
                     else [f"{element.element_type} {element.mark}"] * len(rows))
            for row, desc in zip(rows, descs):
                lines.append({
                    "ref": refs.get(row.drawing_ref, row.drawing_ref),
                    "level": row.level,
                    "desc": desc,
                    "nr": row.times,
                    "L": _num(row.length), "W": _num(row.width),
                    "H": _num(row.height),
                    "qty_each": _num(row.qty_each),
                    "location": row.location,
                    "evidence_ids": list(row.evidence_ids),
                    "method": row.method,
                    "squared": str(row.squared),
                })
            items.append({
                "code": code, "clause_id": quantity.clause_id,
                "element_mark": quantity.element_mark,
                "description": description, "unit": quantity.unit,
                "quantity": str(quantity.value), "lines": lines,
            })

            # the house measurement block: one element heading per type,
            # then its items
            if element.element_type != last_type:
                measurement.append({"kind": "element",
                                    "text": element.element_type})
                last_type = element.element_type
            row = rows[0]
            measurement.append(_house_item(code, description, row, refs,
                                           total=quantity.value if len(rows) > 1 else None))

        sections_out.append({"letter": letter,
                             "name": crosswalk.title(letter).upper(),
                             "items": items})
        house[letter] = {"section_letter": letter,
                         "section_title": crosswalk.title(letter),
                         "pomi_section_title": crosswalk.title(letter),
                         "measurement": measurement}

    # which sheets S14 will mark: the ones a region can be located on
    # a measured item carries its own shapes; only a scheduled item's mark is
    # looked for on the sheet
    targets = [(code, m["element_mark"], m["doc_id"])
               for code, m in sorted(meta_by_code.items()) if not m.get("measured")]
    regions, _problems = _locate_targets(ctx, targets)
    shaped = {line.doc_id for e in (ctx.get("elements") or []) for line in getattr(e, "lines", ())
              if line.shapes}
    marked_docs = sorted({r[0].doc_id for r in regions.values() if r} | shaped)
    sequence = sheet_sequence(marked_docs, sheets)
    ctx["sheet_sequence"] = sequence

    drawing_links: dict = {}
    for code, m in meta_by_code.items():
        doc_id = m["doc_id"]
        ref = refs.get(doc_id, doc_id)
        if doc_id in sequence:
            seq, name = sequence[doc_id]
            drawing_links[ref] = f"{MARKUP_DIR}/{markup_filename(seq, name)}"
        else:
            drawing_links.setdefault(ref, "")
    for letter, block in house.items():
        for entry in block["measurement"]:
            if entry.get("kind") != "item":
                continue
            doc_id = meta_by_code[entry["item_key"]]["doc_id"]
            if doc_id in sequence:
                entry["markup"] = markup_filename(*sequence[doc_id])

    from readers.project_identity import heading_of
    project_name = heading_of(ctx)["project"] or None
    tabs = audit_tabs.build(run, item_codes=item_codes)
    takeoff = {
        "project": project_name, "descriptor": None,
        "drawing_links": dict(sorted(drawing_links.items())),
        "sections": sections_out,
        "audit": {"reconciliation": tabs["AN.RECONCILIATION"],
                  "substantive": tabs["AN.SUBSTANTIVE"],
                  "coverage": tabs["AN.COVERAGE"]},
    }

    ctx["takeoff"] = takeoff
    ctx["takeoff_rows"] = [rows_by_code[c] for c in sorted(rows_by_code)]
    ctx["takeoff_rows_by_code"] = rows_by_code
    ctx["takeoff_all_rows"] = all_rows_by_code
    ctx["takeoff_meta"] = meta_by_code
    ctx["item_codes"] = item_codes
    ctx["house_measurement"] = house
    ctx["audit"] = tabs

    written = [_write(run, "takeoff.json", takeoff),
               _write(run, "house_measurement.json", house),
               _write(run, "audit.json", tabs)]
    return written


CLOSURE_TOLERANCE = Decimal("0.02")   # a raster-measured area against its outline polygon


def _shoelace(pts) -> float:
    return abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))) / 2


def _path_length(pts) -> float:
    return sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))


def _measured_markups(ctx, meta, conventions):
    """(instructions, closure, variances) for the measured items: each line's
    shapes drawn in the section's colour - AREA for an area line, LINEAR for a
    wall run or a room outline (CR-01 R4) - and every line with shapes
    re-measured from them at the sheet's scale. A line whose shapes give its
    own figure within 2% CLOSES; otherwise the variance is reported."""
    from takeoff.markup import MarkupInstruction, hex_of

    grids = ctx.get("grids") or {}
    base = ctx.get("base")
    by_key = {e.key: e for e in (ctx.get("elements") or [])}
    instructions, closure, variance = [], {}, []
    for code, m in sorted(meta.items()):
        if not m.get("measured"):
            continue
        element = by_key.get(m["element_key"])
        if element is None:
            continue
        try:
            colour = conventions.colour(m["section"])
        except KeyError:
            continue
        worst = Decimal(0)
        for line in element.lines:
            if not line.shapes:
                continue
            g = grids.get(line.doc_id)
            k = float(g.mm_per_pt) / 1000 if g is not None and g.mm_per_pt else None
            area = length = 0.0
            for kind, pts in line.shapes:
                pts = [tuple(p) for p in pts]
                xs, ys = [p[0] for p in pts], [p[1] for p in pts]
                if kind == "void":
                    # a void deducted from an area is left unshaded: it counts in
                    # the closure below, and is not a second legend entry
                    area -= _shoelace(pts)
                    continue
                drawn_as = kind
                instructions.append(MarkupInstruction(
                    doc_id=line.doc_id, page=0, primitive=drawn_as, points=tuple(pts),
                    colour=tuple(colour.rgb), item_code=code,
                    label_at=((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2),
                    section=m["section"], hex=hex_of(colour.rgb), qty="0", unit=""))
                if kind == "polygon":
                    area += _shoelace(pts)
                else:
                    length += _path_length(pts)
            if k is None or base is None:
                continue
            role = "area" if "area" in line.dims else "length" if "length" in line.dims else None
            if role is None:
                continue
            billed = Decimal(base.get(line.dims[role]).value)
            drawn = Decimal(str(round(area * k * k if role == "area" else length * k, 4)))
            if billed:
                off = abs(drawn - billed) / billed
                worst = max(worst, off)
        if worst <= CLOSURE_TOLERANCE:
            closure[code] = "CLOSED"
        else:
            closure[code] = f"VARIANCE {worst * 100:.1f}%"
            variance.append((code, f"the marked shapes re-measure {worst * 100:.1f}% away from a "
                                   f"billed line (raster edges against the outline drawn)"))
    # the legend quantity per sheet: the item's lines on that sheet
    per_sheet: dict = {}
    for code, m in meta.items():
        if not m.get("measured"):
            continue
        for row in (ctx.get("takeoff_all_rows") or {}).get(code, []):
            per_sheet[(code, row.drawing_ref)] = per_sheet.get((code, row.drawing_ref), Decimal(0)) + row.squared
    fixed = []
    for i in instructions:
        q = per_sheet.get((i.item_code, i.doc_id), Decimal(0))
        unit = meta[i.item_code].get("unit") or ""
        fixed.append(MarkupInstruction(**{**i.__dict__, "qty": str(q), "unit": unit}))
    return fixed, closure, variance


def _house_item(code: str, description: str, row, refs: dict, total=None) -> dict:
    """One measurement[] item. units/length/width/height become live formulas
    in the workbook, so dimensions are written ONLY where nr x L x W x H
    reproduces the quantity exactly; otherwise the quantity is written as a
    literal in the column its unit belongs to. A door count with its leaf
    size written as dimensions would multiply 2 x 1.10 x 2.20 into 4.84 nr."""
    item = {"kind": "item", "item_key": code, "item_ref": "", "boq_page": "",
            "description": description, "unit": row.unit, "units": None,
            "length": None, "width": None, "height": None,
            "area": None, "volume": None, "qty": None,
            "dwg_ref": refs.get(row.drawing_ref, row.drawing_ref),
            "markup": None}
    if total is not None:
        # several dimension lines (a measured item): the house block carries the
        # item's total; its lines are on the take-off's own section tab
        literal = float(total)
        item["area" if row.unit == "m2" else "volume" if row.unit == "m3" else "qty"] = literal
        return item
    dims = [d for d in (row.length, row.width, row.height) if d is not None]
    product = Decimal(row.times)
    for d in dims:
        product *= d
    if row.unit != "nr" and dims and product == row.squared:
        item.update({"units": row.times, "length": _num(row.length),
                     "width": _num(row.width), "height": _num(row.height)})
        return item
    # a literal: the quantity itself, in the column its unit belongs to. A
    # count (nr) is always a literal — its Nr column would otherwise become a
    # multiplier over blank dimensions.
    literal = float(row.squared)
    if row.unit == "m2":
        item["area"] = literal
    elif row.unit == "m3":
        item["volume"] = literal
    else:
        item["qty"] = literal
    return item


# ── S14 ────────────────────────────────────────────────────────────────────
def _stage_markup(ctx) -> list[str]:
    """Stage 14 — markup instructions and the per-section markup spec."""
    from ingest.conventions import Conventions
    from takeoff.markup import instructions_for, unplaced_for

    gaps = ctx["gaps"]
    run = Path(ctx["run"])
    rows = list(ctx.get("takeoff_rows") or [])
    meta = ctx.get("takeoff_meta") or {}
    sheets = _sheets_by_doc(ctx)
    conventions = Conventions.load(HERE / "data" / "conventions.json")

    regions = ctx.get("regions")
    if regions is None:
        targets = [(code, m["element_mark"], m["doc_id"])
                   for code, m in sorted(meta.items())]
        regions, _ = _locate_targets(ctx, targets)
    problems = ctx.get("region_problems") or {}

    measured_codes = {code for code, m in meta.items() if m.get("measured")}
    plain = [r for r in rows if r.item_code not in measured_codes]
    instructions = instructions_for(plain, conventions, regions)
    unplaced = unplaced_for(plain, conventions, regions)
    measured_instructions, measured_closure, variance = _measured_markups(ctx, meta, conventions)
    instructions = sorted(instructions + measured_instructions,
                          key=lambda i: (i.doc_id, i.page, i.item_code))
    for code, why in variance:
        gaps.add(Gap(stage=STAGE_MARKUP, doc_id=meta.get(code, {}).get("doc_id"), subject=code,
                     reason=why,
                     detail="the marked shapes re-measured at the sheet's scale against the "
                            "billed lines (CR-01 R4); reported, not adjusted"))
    # items read from a DRAWN schedule (transcribed): its marks are graphics,
    # so there is no text to box and no tag count on that sheet to close
    # against. One gap per sheet says so, instead of two identical ones per item.
    drawn = {s["doc_id"] for s in (ctx.get("schedules") or [])
             if s.get("origin") == "transcribed"}
    from_drawn = {code for code, m in meta.items() if m.get("doc_id") in drawn}
    by_sheet: dict = {}
    for code in sorted(from_drawn):
        by_sheet.setdefault(meta[code]["doc_id"], []).append(code)
    for doc_id, codes in sorted(by_sheet.items()):
        gaps.add(Gap(stage=STAGE_MARKUP, doc_id=doc_id, subject=f"{codes[0]} to {codes[-1]}",
                     reason=f"{len(codes)} item(s) from this drawn schedule are listed in "
                            f"the sheet legend; its marks are drawn, not written, so "
                            f"none is boxed on the sheet",
                     detail="the schedule was transcribed; check the legend against "
                            "the cards"))
    for code, why in unplaced:
        if code in from_drawn:
            continue
        m = meta.get(code, {})
        gaps.add(Gap(stage=STAGE_MARKUP, doc_id=m.get("doc_id") or None,
                     subject=code,
                     reason=f"not marked: {problems.get(code, why)}",
                     detail="no coordinate is invented; the item is listed "
                            "in the sheet legend only"))

    # closure
    closure: dict = {}
    uncalibrated = False
    placed = {i.item_code: i for i in instructions}
    closure.update(measured_closure)
    for row in plain:
        instruction = placed.get(row.item_code)
        primitive = instruction.primitive if instruction else None
        if primitive in ("polygon", "polyline"):
            closure[row.item_code] = "NOT_CALIBRATED"
            uncalibrated = True
            continue
        if primitive is None and row.unit != "nr":
            closure[row.item_code] = "NOT_CALIBRATED"
            uncalibrated = True
            continue
        if row.item_code in from_drawn:
            closure[row.item_code] = "TRANSCRIBED"
            continue
        expected = meta.get(row.item_code, {}).get("count", row.times)
        points = len(instruction.points) if instruction else 0
        closure[row.item_code] = ("CLOSED" if points == expected
                                  else "MARKUP_MISMATCH")
        if points != expected:
            gaps.add(Gap(stage=STAGE_MARKUP,
                         doc_id=meta.get(row.item_code, {}).get("doc_id"),
                         subject=row.item_code,
                         reason=f"{points} tag(s) on the sheet against a "
                                f"schedule count of {expected}",
                         detail="the count is reported, not settled in "
                                "favour of either source"))
    if uncalibrated:
        gaps.add(Gap(stage=STAGE_MARKUP, doc_id=None, subject="scale",
                     reason="scale is not calibrated, so area and linear "
                            "markups cannot be closed against the drawing",
                     detail="calibration is deferred at v3.1"))

    instructions_json = {
        "instructions": [{
            "doc_id": i.doc_id, "page": i.page, "primitive": i.primitive,
            "points": [[x, y] for x, y in i.points],
            "colour": list(i.colour), "hex": i.hex, "item_code": i.item_code,
            "label_at": list(i.label_at), "section": i.section,
            "qty": i.qty, "unit": i.unit} for i in instructions],
        "unplaced": [code for code, _ in unplaced],
        "closure": dict(sorted(closure.items())),
    }

    # the spec: one per section, sheets grouped by doc_id
    # the sheet sequence S13 wrote into drawing_links, extended over any
    # sheet placed only now. In the normal flow the two sets are identical
    # (both come from the same located regions), so the numbering holds.
    known = set(ctx.get("sheet_sequence") or {})
    placed_docs = {i.doc_id for i in instructions}
    if not placed_docs <= known:
        ctx["sheet_sequence"] = sheet_sequence(known | placed_docs, sheets)
    sequence = ctx.get("sheet_sequence") or {}
    on_disk = _on_disk(ctx)
    from readers.project_identity import heading_of
    project_name = heading_of(ctx)["project"] or None

    spec: dict = {}
    for i in instructions:
        # a measured item's shapes on one sheet are ONE legend entry
        letter = i.section
        block = spec.setdefault(letter, {
            "project": project_name, "building": None,
            "section_letter": letter,
            "section_title": crosswalk.title(letter),
            "group": crosswalk.title(letter),
            "sheets": []})
        sheet = next((s for s in block["sheets"] if s["filename"] == i.doc_id),
                     None)
        if sheet is None:
            seq, name = sequence.get(i.doc_id, (0, Path(i.doc_id).stem))
            record = sheets.get(i.doc_id)
            source = on_disk.get(i.doc_id)
            sheet = {"seq": seq, "name": name,
                     "source_pdf": str(source.resolve()) if source else None,
                     "source_page": i.page,
                     "drawing_no": record.drawing_no if record else None,
                     "filename": i.doc_id, "items": []}
            block["sheets"].append(sheet)
        if i.primitive == "tag":
            regions_out = [[[x, y]] for x, y in i.points]
        else:
            regions_out = [[[x, y] for x, y in i.points]]
        same = next((it for it in sheet["items"] if it["label"] == i.item_code
                     and it["kind"] == KIND_BY_PRIMITIVE[i.primitive]), None)
        if same is not None and i.item_code in measured_codes:
            same["regions"].extend(regions_out)
            continue
        sheet["items"].append({
            "label": i.item_code, "qty": float(Decimal(i.qty)),
            "unit": i.unit, "colour": f"#{i.hex}",
            "kind": KIND_BY_PRIMITIVE[i.primitive], "regions": regions_out})
    for block in spec.values():
        block["sheets"].sort(key=lambda s: (s["seq"], s["filename"]))
        for sheet in block["sheets"]:
            sheet["items"].sort(key=lambda it: it["label"])

    ctx["markup_instructions"] = instructions_json
    ctx["markup_spec"] = spec
    return [_write(run, "markup_instructions.json", instructions_json),
            _write(run, "markup_spec.json", spec)]
