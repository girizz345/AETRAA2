#!/usr/bin/env python3
"""
markup_pdf.py — marked-up drawing renderer for the POMI take-off skill.

Takes an issued drawing PDF plus a markup spec (JSON) and produces the house
marked-up sheet: banner, identity block, legend panel, coloured measured regions,
CostX footer. One output PDF per bill item group, named so the take-off sheet's
DWG Ref hyperlink resolves.

Format is frozen — see references/house-template.md §7. Do not restyle.

Usage:
  python3 markup_pdf.py <spec.json> [--outdir markups] [--check]

Spec shape:
{
  "project": "XXXX",
  "building": "XXXX",
  "section_letter": "B",
  "section_title": "ENABLING WORKS",
  "group": "Enabling Works",
  "sheets": [
    {
      "seq": 1,
      "name": "Site Clearance",
      "source_pdf": "drawings/S-02-001.pdf",
      "source_page": 0,
      "drawing_no": "S-02-001",
      "filename": "",
      "items": [
        {"label": "Site Clearance", "qty": 1152.03, "unit": "m2",
         "colour": "#3FBFD4", "kind": "area",
         "regions": [[[x1,y1],[x2,y2],...]]}
      ]
    }
  ]
}

kind: "area"   -> semi-transparent fill + solid outline over each region polygon
      "linear" -> ~2pt coloured line along each run polyline
      "tag"    -> a ringed dot at each point, for enumerated items and for any
                  item downgraded because its source is a raster, a schematic or
                  a schedule. Determinism §4.9 decides which; this renderer only
                  draws it. A "tag" region is a list of single points.
Coordinates are in PDF points on the source page, origin top-left.

Requires: pymupdf
"""
import sys, os, json, argparse
from pathlib import Path

try:
    import pymupdf as fitz
except ImportError:  # older installs
    import fitz

# ---------------------------------------------------------------- frozen layout
BANNER_FS      = 20
IDENT_FS       = 11
LEGEND_TITLE_FS = 16
LEGEND_FS      = 10.5
FOOTER_FS      = 11
FOOTER_TEXT    = "CostX"          # frozen — house template §7
TAG_R          = 3.0             # tag dot radius, pt
TAG_RING       = 2.6             # ring radius as a multiple of TAG_R

BANNER_H       = 46               # banner strip height
IDENT_H        = 44               # identity block height
LEGEND_W       = 300              # legend panel width
FOOTER_H       = 34
PAD            = 10

AREA_FILL_ALPHA = 0.45
LINE_WIDTH      = 2.0
SWATCH          = 13              # legend colour swatch, square


def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def _fmt_qty(v):
    """1152.03 -> '1,152.03'   (house template: 2dp, thousands separated)"""
    return f"{float(v):,.2f}"


def render_sheet(spec, sheet, outdir):
    src = Path(sheet["source_pdf"])
    if not src.exists():
        raise SystemExit(f"ABORT: source drawing not found: {src}")

    doc = fitz.open(src)
    page = doc[sheet.get("source_page", 0)]
    sw, sh = page.rect.width, page.rect.height

    # ---- 1. draw the measured regions onto the source page ------------------
    for item in sheet["items"]:
        col = _rgb(item["colour"])
        kind = item.get("kind", "area")
        if kind == "tag":
            # one ringed dot per instance. Determinism §4.9 routes enumerated
            # items and every downgraded source here; closure is a count, so the
            # mark is a position, not an extent.
            for region in item.get("regions", []):
                for pt in region:
                    c = fitz.Point(*pt)
                    shape = page.new_shape()
                    shape.draw_circle(c, TAG_R)
                    shape.finish(color=col, fill=col, fill_opacity=1.0, width=0)
                    shape.draw_circle(c, TAG_R * TAG_RING)
                    shape.finish(color=col, width=LINE_WIDTH)
                    shape.commit()
            continue
        # all of an item's regions in ONE shape, finished and committed once: a
        # measured item draws thousands of wall runs and room outlines, and a
        # commit per region made rendering a plan take minutes
        shape = page.new_shape()
        drawn = 0
        for region in item.get("regions", []):
            pts = [fitz.Point(*p) for p in region]
            if len(pts) < 2:
                continue
            shape.draw_polyline(pts + [pts[0]] if kind == "area" else pts)
            drawn += 1
        if drawn:
            if kind == "area":
                shape.finish(color=col, fill=col, fill_opacity=AREA_FILL_ALPHA,
                             width=1.2, closePath=False)
            else:
                shape.finish(color=col, width=LINE_WIDTH, closePath=False)
            shape.commit()

    # ---- 2. build the output page with banner / identity / legend / footer --
    out_w = sw + LEGEND_W
    out_h = sh + BANNER_H + IDENT_H + FOOTER_H
    out = fitz.open()
    op = out.new_page(width=out_w, height=out_h)

    drawing_rect = fitz.Rect(0, BANNER_H + IDENT_H, sw, BANNER_H + IDENT_H + sh)
    op.show_pdf_page(drawing_rect, doc, sheet.get("source_page", 0))

    black = (0, 0, 0)

    # banner — frozen string
    banner = f'SECTION {spec["section_letter"]} - {spec["section_title"]}'
    op.insert_textbox(fitz.Rect(0, 8, out_w, 8 + BANNER_H),
                      banner, fontsize=BANNER_FS, fontname="helv",
                      align=fitz.TEXT_ALIGN_CENTER, color=black)

    # identity block
    iy = BANNER_H
    op.draw_rect(fitz.Rect(0, iy, out_w, iy + IDENT_H), color=black, width=0.8)
    op.insert_text((PAD + 8, iy + 16), f'Project:  {spec.get("project","")}',
                   fontsize=IDENT_FS, fontname="helv")
    op.insert_text((PAD + 8, iy + 32), f'Building:  {spec.get("building","")}',
                   fontsize=IDENT_FS, fontname="helv")
    midx = out_w * 0.34
    op.insert_text((midx, iy + 16), f'Drawing:  {sheet.get("drawing_no","")}',
                   fontsize=IDENT_FS, fontname="helv")
    op.insert_text((midx, iy + 32), f'Filename:  {sheet.get("filename","")}',
                   fontsize=IDENT_FS, fontname="helv")

    # legend panel
    lx = sw
    ly = BANNER_H + IDENT_H
    op.draw_line(fitz.Point(lx, ly), fitz.Point(lx, ly + sh), color=black, width=0.8)
    rc = op.insert_textbox(fitz.Rect(lx, ly + 4, out_w - PAD, ly + 4 + LEGEND_TITLE_FS * 2),
                           "Legend", fontsize=LEGEND_TITLE_FS, fontname="helv",
                           align=fitz.TEXT_ALIGN_RIGHT, color=black)
    if rc < 0:
        raise SystemExit("ABORT: legend title did not fit — widen LEGEND_W")
    op.insert_text((lx + PAD, ly + 46), spec.get("group", ""),
                   fontsize=LEGEND_FS + 1, fontname="helv")

    ry = ly + 58
    for item in sheet["items"]:
        sq = fitz.Rect(lx + PAD, ry, lx + PAD + SWATCH, ry + SWATCH)
        op.draw_rect(sq, color=black, fill=_rgb(item["colour"]), width=0.6)
        text = f'{item["label"]}  {_fmt_qty(item["qty"])} {item["unit"]}'
        op.insert_text((lx + PAD + SWATCH + 7, ry + SWATCH - 2), text,
                       fontsize=LEGEND_FS, fontname="helv")
        ry += SWATCH + 8

    # footer — frozen string
    op.insert_textbox(fitz.Rect(0, out_h - FOOTER_H + 6, out_w, out_h),
                      FOOTER_TEXT, fontsize=FOOTER_FS, fontname="helv",
                      align=fitz.TEXT_ALIGN_CENTER, color=black)

    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    name = f'{sheet["seq"]}. {sheet["name"]}.pdf'      # matches DWG Ref hyperlink target
    path = outdir / name
    out.save(path)
    out.close()
    doc.close()
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("--outdir", default="markups")
    ap.add_argument("--check", action="store_true",
                    help="validate the spec and exit without rendering")
    a = ap.parse_args()

    spec = json.load(open(a.spec))

    # ---- gate: every item must carry a measurable region --------------------
    bad = []
    for sh in spec["sheets"]:
        for it in sh["items"]:
            if not it.get("regions"):
                bad.append(f'{sh["name"]} / {it["label"]}: no region drawn')
            if it.get("qty") in (None, 0):
                bad.append(f'{sh["name"]} / {it["label"]}: no quantity')
    if bad:
        print("MARKUP GATE FAILED:")
        for b in bad:
            print("  " + b)
        raise SystemExit(
            "ABORT: every measured item must have a drawn region and a quantity.\n"
            "       An unmarked quantity is untraceable and may not be issued."
        )
    if a.check:
        print(f"Spec OK — {sum(len(s['items']) for s in spec['sheets'])} items "
              f"across {len(spec['sheets'])} sheets")
        return

    written = [render_sheet(spec, sh, a.outdir) for sh in spec["sheets"]]
    for p in written:
        print(f"Wrote: {p}")
    print(f"{len(written)} marked-up sheet(s) — DWG Ref hyperlinks will resolve to "
          f"'{a.outdir}/'")


if __name__ == "__main__":
    main()
