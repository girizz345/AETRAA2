#!/usr/bin/env python3
"""
markup_pdf.py — one PDF per measured sheet, plus a colour legend index.

Draws the markup spec S14 produced, through the ported
render/_house/markup_pdf.render_sheet (banner, identity block, legend panel,
coloured regions, footer — the frozen house sheet). Two things this file must
get right that are easy to get wrong:

The coordinate frame. The spec carries page-display-topleft-pt coordinates.
PyMuPDF draws in unrotated page space. On the 312 rotated sheets in the dev
corpus, drawing without inverting the rotation puts every shaded polygon in the
wrong corner — and the result still looks like a marked-up drawing, which is
the dangerous part. So every region is passed through invert_rotation before
the ported renderer sees it, whenever the source page carries /Rotate.

Legibility over the drawing. Shading at full opacity hides what it marks, and a
reviewer cannot confirm that the shaded region is the right one. The ported
renderer draws areas at its own frozen AREA_FILL_ALPHA and outlines at full
strength; OPACITY from takeoff.markup is the instruction-side constant and is
not applied over the house value.

The legend index is a separate PDF listing every trade colour used across the
package, so a printed sheet separated from the set is still readable.

  python3 -m render.markup_pdf --instructions M.json --drawings D --out O

Exit 0 = every sheet written. Exit 1 = an instruction had no target sheet.
"""
from __future__ import annotations

import argparse
import copy
import json
import shutil
from pathlib import Path

from takeoff.markup import OPACITY                              # noqa: F401

from render._house import markup_pdf as _house

LEGEND_FILENAME = "00-LEGEND-INDEX.pdf"
OUTLINE_WIDTH = 1.2
TAG_FONT_SIZE = 7
LEGEND_ROWS_PER_PAGE = 36
KIND_FOR_PRIMITIVE = {"polygon": "area", "polyline": "line", "tag": "tag"}


def invert_rotation(points, page_rotation: int, page_w: float, page_h: float):
    """Display-frame points back to unrotated page space for drawing. The
    inverse of what extract applied — kept explicit rather than folded into the
    draw call, because it is the step whose absence is invisible.

    page_w / page_h are the DISPLAYED page's width and height (fitz page.rect,
    which already reflects /Rotate). Equivalent to multiplying by PyMuPDF's
    page.derotation_matrix; restated here so it is testable on its own."""
    rot = int(page_rotation) % 360
    if rot == 0:
        return [(float(x), float(y)) for x, y in points]
    if rot == 90:
        return [(float(y), page_w - float(x)) for x, y in points]
    if rot == 180:
        return [(page_w - float(x), page_h - float(y)) for x, y in points]
    if rot == 270:
        return [(page_h - float(y), float(x)) for x, y in points]
    raise ValueError(f"page rotation {page_rotation} is not a multiple of 90")


def _fitz():
    try:
        import pymupdf as fitz
    except ImportError:                                          # older installs
        import fitz
    return fitz


def _resolve_source(sheet: dict, drawings_dir) -> Path:
    src = Path(sheet["source_pdf"])
    if not src.is_absolute() and drawings_dir is not None:
        candidate = Path(drawings_dir) / src
        if candidate.exists():
            return candidate
    return src


def _derotate_sheet(sheet: dict, source: Path) -> tuple[dict, int]:
    """A copy of the sheet whose regions are in unrotated page space, and the
    rotation that was inverted (0 when nothing was done)."""
    fitz = _fitz()
    doc = fitz.open(str(source))
    try:
        page = doc[sheet.get("source_page", 0)]
        rot = int(page.rotation) % 360
        w, h = page.rect.width, page.rect.height
    finally:
        doc.close()
    out = copy.deepcopy(sheet)
    out["source_pdf"] = str(source)
    if rot == 0:
        return out, 0
    for item in out.get("items", []):
        item["regions"] = [invert_rotation(region, rot, w, h)
                           for region in item.get("regions", [])]
    return out, rot


def spec_from_instructions(instructions: dict, drawings_dir) -> dict:
    """markup_instructions.json (S14's per-primitive form) folded into the
    per-section spec shape render_sheet consumes. Sheet names are the doc_id
    stems because instructions carry no drawing number; S14's markup_spec.json
    is the preferred input and carries the real names."""
    by_section: dict = {}
    for ins in instructions.get("instructions", []):
        L = ins.get("section") or "?"
        sec = by_section.setdefault(L, {"project": "", "building": "",
                                        "section_letter": L, "section_title": "",
                                        "group": "", "sheets": {}})
        doc_id = ins["doc_id"]
        sheet = sec["sheets"].setdefault(doc_id, {
            "name": Path(doc_id).stem, "source_pdf": doc_id,
            "source_page": ins.get("page", 0), "drawing_no": Path(doc_id).stem,
            "filename": doc_id, "items": {}})
        code = ins.get("item_code", "")
        item = sheet["items"].setdefault(code, {
            "label": code, "qty": float(ins.get("qty") or 0), "unit": ins.get("unit", ""),
            "colour": "#" + ins.get("hex", "000000"),
            "kind": KIND_FOR_PRIMITIVE.get(ins.get("primitive", "polygon"), "area"),
            "regions": []})
        item["regions"].append([list(p) for p in ins.get("points", [])])
    seq = 1
    for L in sorted(by_section):
        sec = by_section[L]
        sheets = []
        for doc_id in sorted(sec["sheets"]):
            sh = sec["sheets"][doc_id]
            sh["items"] = [sh["items"][k] for k in sorted(sh["items"])]
            sh["seq"] = seq
            seq += 1
            sheets.append(sh)
        sec["sheets"] = sheets
    return by_section


def _sections(spec: dict) -> list[dict]:
    if "sheets" in spec:                                  # a single section spec
        return [spec]
    if "instructions" in spec:
        raise ValueError("pass instructions through spec_from_instructions first")
    return [spec[k] for k in sorted(spec)]


def write_legend_index(sections: list[dict], out_dir) -> Path:
    """One PDF listing every trade colour used: section letter, title, swatch."""
    fitz = _fitz()
    rows = []
    for sec in sections:
        seen = []
        for sheet in sec.get("sheets", []):
            for item in sheet.get("items", []):
                col = item.get("colour", "#000000")
                if col not in seen:
                    seen.append(col)
        for col in seen:
            rows.append((sec.get("section_letter", ""), sec.get("section_title", ""), col))
    out = fitz.open()
    W, H = 595, 842
    for start in range(0, max(len(rows), 1), LEGEND_ROWS_PER_PAGE):
        page = out.new_page(width=W, height=H)
        page.insert_textbox(fitz.Rect(0, 30, W, 70), "LEGEND INDEX",
                            fontsize=_house.LEGEND_TITLE_FS, fontname="helv",
                            align=fitz.TEXT_ALIGN_CENTER)
        page.insert_text((40, 90), "Trade colours used across this package",
                         fontsize=_house.LEGEND_FS, fontname="helv")
        y = 120
        for letter, title, col in rows[start:start + LEGEND_ROWS_PER_PAGE]:
            sq = fitz.Rect(40, y, 40 + _house.SWATCH, y + _house.SWATCH)
            page.draw_rect(sq, color=(0, 0, 0), fill=_house._rgb(col), width=0.6)
            page.insert_text((40 + _house.SWATCH + 10, y + _house.SWATCH - 2),
                             f"SECTION {letter} - {title}",
                             fontsize=_house.LEGEND_FS, fontname="helv")
            y += _house.SWATCH + 7
        if not rows:
            page.insert_text((40, 120), "No measured items were marked.",
                             fontsize=_house.LEGEND_FS, fontname="helv")
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / LEGEND_FILENAME
    out.save(str(path))
    out.close()
    return path


def render(instructions_or_spec, drawings_dir, out_dir) -> dict:
    """Every sheet of every section through the ported render_sheet, then the
    legend index. A sheet whose source is missing is a problem in the result,
    not an exception — the other sheets still issue."""
    spec = instructions_or_spec
    if isinstance(spec, dict) and "instructions" in spec:
        spec = spec_from_instructions(spec, drawings_dir)
    sections = _sections(spec)
    out_dir = Path(out_dir)
    problems, derotated = [], []
    items = 0
    # A sheet measured in more than one section (a plan carrying doors AND
    # floor finishes) is drawn once per section. Each section's page is drawn
    # apart, then the pages are bound into the one file the DWG Ref links
    # name - drawn straight to that name, the last section overwrote the
    # others' markings.
    parts_dir = out_dir / "_parts"
    pages: dict[str, list[Path]] = {}
    for n, sec in enumerate(sections):
        for sheet in sec.get("sheets", []):
            source = _resolve_source(sheet, drawings_dir)
            name = f'{sheet.get("seq")}. {sheet.get("name")}.pdf'
            if not source.exists():
                problems.append(f"{name}: source drawing not found — {source}")
                continue
            try:
                prepared, rot = _derotate_sheet(sheet, source)
                path = _house.render_sheet(sec, prepared, parts_dir / str(n))
            except SystemExit as exc:
                problems.append(f"{name}: {exc}")
                continue
            if rot and not any(d.startswith(f"{name} ") for d in derotated):
                derotated.append(f"{name} (/Rotate {rot})")
            pages.setdefault(path.name, []).append(path)
            items += len(sheet.get("items", []))
    out_dir.mkdir(parents=True, exist_ok=True)
    fitz = _fitz()
    for name, parts in pages.items():
        if len(parts) == 1:
            shutil.move(str(parts[0]), str(out_dir / name))
            continue
        bound = fitz.open()
        for part in parts:
            with fitz.open(part) as one:
                bound.insert_pdf(one)
        bound.save(out_dir / name)
        bound.close()
    shutil.rmtree(parts_dir, ignore_errors=True)
    written = list(pages)
    legend = write_legend_index(sections, out_dir)
    return {"sheets": len(written), "items": items, "written": sorted(written),
            "legend": legend.name, "derotated": derotated, "problems": problems}


def main() -> int:
    ap = argparse.ArgumentParser(description="Render marked-up drawings.")
    ap.add_argument("--instructions", required=True,
                    help="markup_spec.json (preferred) or markup_instructions.json")
    ap.add_argument("--drawings", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    spec = json.loads(Path(args.instructions).read_text())
    result = render(spec, args.drawings, args.out)
    print(f"{result['sheets']} sheet(s), {result['items']} item(s), legend {result['legend']}")
    for p in result["problems"]:
        print(f"  GAP  {p}")
    return 1 if result["problems"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
