"""A four-sheet project whose measured quantities are worked out by hand, for
the measured sections (CR-01 §9: "one blockwork wall with an opening, one room
with floor and wall finish, whose hand-calculated quantities the run must
reproduce").

  A-101 GROUND FLOOR PLAN   one BEDROOM, 4000 x 3000 mm inside, walls 200 mm
                            on a CAD layer, a 900 mm door D-1 in the bottom
                            wall, 1000 mm from the left; the grid dimensioned
                            along two edges at 1:100, so S4 calibrates it
  A-301 SECTION A-A         ground floor FFL +0.00, first floor FFL +3.15
                            (a saved reading, as a transcription would be)
  A-501 DOOR SCHEDULE       D-1 900 x 2100 (with D-2 to D-5, not on the plan)
  A-601 TYPICAL DETAILS     "150MM THK RC SLAB", "200MM THK BLOCK WALL"

By hand, clear height 3.15 - 0.15 = 3.00 m:
  D2.1  walls on the centreline, corners completed, door excluded:
          4.20 + 3.20 + 3.20 + 1.10 + 2.20 = 13.90 m x 3.00  = 41.70
        + D-1 walling added back   0.90 x 3.00             =  2.70
        - D-1 deducted (GP3.3)     0.90 x 2.10             = -1.89   => 42.51 m2
  J3.1  floor, ceiling  4.00 x 3.00                        = 12.00 m2 each
        walls  perimeter 14.00 x 3.00 = 42.00 - D-1 1.89   = 40.11 m2
  J3.2  skirting  14.00 - 0.90                             = 13.10 m
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

W, H = 2384.0, 1684.0                  # A1 landscape
K = 25.4 / 72 * 100                    # mm per pt at 1:100
LETTER_BAYS = [6000, 7500, 4500, 8000, 6000]
NUMBER_BAYS = [5000, 6000, 4000, 7000]

EXPECTED = {"D2.1": 42.51, "floors": 12.00, "ceilings": 12.00, "walls": 40.11, "skirting": 13.10}


def _fitz():
    import pymupdf
    return pymupdf


def _pt(mm: float) -> float:
    return mm / K


def _block(page, number, title):
    fitz = _fitz()
    x0, y0 = W - 320, H - 160
    page.draw_rect(fitz.Rect(x0, y0, W - 20, H - 20), color=(0, 0, 0), width=1.2)
    page.insert_text((x0 + 8, y0 + 14), "DRAWING TITLE", fontsize=7)
    page.insert_text((x0 + 8, y0 + 32), title, fontsize=10)
    page.insert_text((x0 + 8, y0 + 59), "DRAWING NUMBER", fontsize=7)
    page.insert_text((x0 + 8, y0 + 77), number, fontsize=11)
    page.insert_text((x0 + 8, y0 + 110), "SCALE  1:100", fontsize=8)


def _grid(page):
    """Bubbles and their dimension chains, as the S4 tests draw them: letters
    along the bottom band, numbers up the left band."""
    x = 400.0
    xs = [x]
    for mm in LETTER_BAYS:
        xs.append(xs[-1] + _pt(mm))
    for lab, cx in zip("ABCDEF", xs):
        page.insert_text((cx - 3, 1504), lab, fontsize=10)
    for i, mm in enumerate(LETTER_BAYS):
        page.insert_text(((xs[i] + xs[i + 1]) / 2 - 10, 1473), str(mm), fontsize=8)
    y = 300.0
    ys = [y]
    for mm in NUMBER_BAYS:
        ys.append(ys[-1] + _pt(mm))
    for lab, cy in zip("12345", ys):
        page.insert_text((146, cy + 4), lab, fontsize=10)
    for i, mm in enumerate(NUMBER_BAYS):
        page.insert_text((178, (ys[i] + ys[i + 1]) / 2 + 3), str(mm), fontsize=8)


def _plan(path: Path):
    fitz = _fitz()
    doc = fitz.open()
    page = doc.new_page(width=W, height=H)
    wall = doc.add_ocg("A-WALL", on=True)
    door = doc.add_ocg("A-DOOR", on=True)
    page.insert_text((60, 60), "GROUND FLOOR PLAN", fontsize=22)
    _grid(page)
    # the room: inside faces 4000 x 3000 from (x0, y0); walls 200 thick
    x0, y0 = 900.0, 600.0
    w, h, t = _pt(4000), _pt(3000), _pt(200)
    d0, d1 = x0 + _pt(1000), x0 + _pt(1900)              # the door opening, bottom wall

    def line(a, b, oc=wall):
        page.draw_line(a, b, color=(0, 0, 0), width=0.5, oc=oc)
    # inside faces
    line((x0, y0), (x0 + w, y0))
    line((x0, y0), (x0, y0 + h))
    line((x0 + w, y0), (x0 + w, y0 + h))
    line((x0, y0 + h), (d0, y0 + h))
    line((d1, y0 + h), (x0 + w, y0 + h))
    # outside faces
    line((x0 - t, y0 - t), (x0 + w + t, y0 - t))
    line((x0 - t, y0 - t), (x0 - t, y0 + h + t))
    line((x0 + w + t, y0 - t), (x0 + w + t, y0 + h + t))
    line((x0 - t, y0 + h + t), (d0, y0 + h + t))
    line((d1, y0 + h + t), (x0 + w + t, y0 + h + t))
    # the jambs, and the door's leaf and swing drawn open into the room
    line((d0, y0 + h), (d0, y0 + h + t))
    line((d1, y0 + h), (d1, y0 + h + t))
    line((d0, y0 + h), (d0, y0 + h - _pt(900)), oc=door)
    line((d0, y0 + h - _pt(900)), (d1, y0 + h), oc=door)
    page.insert_text((x0 + w / 2 - 25, y0 + h / 2), "BEDROOM", fontsize=9)
    page.insert_text((d0 + 8, y0 + h - 20), "D-1", fontsize=7)
    _block(page, "A-101", "GROUND FLOOR PLAN")
    doc.save(str(path))
    doc.close()


def _table(page, x0, y0, headers, rows, widths):
    rh = 24
    xs = [x0]
    for wd in widths:
        xs.append(xs[-1] + wd)
    n = len(rows) + 1
    for i in range(n + 1):
        page.draw_line((xs[0], y0 + i * rh), (xs[-1], y0 + i * rh), color=(0, 0, 0))
    for x in xs:
        page.draw_line((x, y0), (x, y0 + n * rh), color=(0, 0, 0))
    for r, cells in enumerate([headers] + [list(map(str, row)) for row in rows]):
        for c, text in enumerate(cells):
            page.insert_text((xs[c] + 5, y0 + r * rh + 16), text, fontsize=9)


def _schedule(path: Path):
    fitz = _fitz()
    doc = fitz.open()
    page = doc.new_page(width=W, height=H)
    page.insert_text((60, 60), "DOOR SCHEDULE", fontsize=22)
    _table(page, 80, 120, ["DOOR NO", "TYPE", "SIZE", "QTY"],
           [("D-1", "SINGLE LEAF", "900 x 2100", 1), ("D-2", "DOUBLE LEAF", "1800 x 2400", 1),
            ("D-3", "SLIDING", "1500 x 2100", 1), ("D-4", "SINGLE LEAF", "800 x 2100", 1),
            ("D-5", "FIRE DOOR", "1000 x 2100", 1)], [90, 160, 140, 60])
    _block(page, "A-501", "DOOR SCHEDULE")
    doc.save(str(path))
    doc.close()


def _section(path: Path):
    fitz = _fitz()
    doc = fitz.open()
    page = doc.new_page(width=W, height=H)
    page.insert_text((60, 60), "SECTION A-A", fontsize=22)
    page.draw_rect(fitz.Rect(400, 300, 1400, 1200), color=(0, 0, 0))
    _block(page, "A-301", "SECTION A-A")
    doc.save(str(path))
    doc.close()


def _details(path: Path):
    fitz = _fitz()
    doc = fitz.open()
    page = doc.new_page(width=W, height=H)
    page.insert_text((60, 60), "TYPICAL DETAILS", fontsize=22)
    page.insert_text((200, 300), "150MM THK RC SLAB", fontsize=10)
    page.insert_text((200, 340), "200MM THK BLOCK WALL", fontsize=10)
    page.draw_rect(fitz.Rect(600, 300, 900, 500), color=(0, 0, 0))
    _block(page, "A-601", "TYPICAL DETAILS")
    doc.save(str(path))
    doc.close()


def build(root: Path, readings: Path) -> dict:
    root = Path(root)
    arch = root / "Architecture"
    arch.mkdir(parents=True, exist_ok=True)
    _plan(arch / "A-101 GROUND FLOOR PLAN.pdf")
    _schedule(arch / "A-501 DOOR SCHEDULE.pdf")
    section = arch / "A-301 SECTION A-A.pdf"
    _section(section)
    _details(arch / "A-601 TYPICAL DETAILS.pdf")
    # the section's level markers, as a transcription of them is saved
    readings.mkdir(parents=True, exist_ok=True)
    sha1 = hashlib.sha1(section.read_bytes()).hexdigest()
    (readings / "A-301.levels.json").write_text(json.dumps({
        "_stamp": {"sheet_sha1": sha1, "task": "levels", "version": "1"},
        "_by": "test fixture",
        "reading": {"levels": [{"name": "GROUND FLOOR LVL", "value": "+0.00", "datum": "FFL"},
                               {"name": "1ST FLOOR LVL", "value": "+3.15", "datum": "FFL"}],
                    "chain": [{"from": "GROUND FLOOR LVL", "to": "1ST FLOOR LVL", "mm": 3150}],
                    "illegible": []}}), encoding="utf-8")
    return dict(EXPECTED)
