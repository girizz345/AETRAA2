"""A drawing package from an office this agent has never seen, built from
nothing, so that "does it work on any set of drawings" is a test and not a
hope. Everything in it differs from the two development packages:

  * a COMBINED SET - cover, plan and door schedule as three pages of one PDF
  * title blocks labelled SHEET NO. / SHEET TITLE (value beside the label) and
    DRAWING NUMBER (value beneath it), numbers shaped A101 and 2301-A-200
  * a window schedule in a sub-folder with a non-English name, saved as .PDF
  * schedule headers no development package used: DOOR NO | TYPE | SIZE | QTY,
    REF | W X H | NO OFF - sizes printed "900 x 2100"
  * an engineer's ELECTRICAL LOAD SUMMARY whose rows look like marks
  * a scanned sheet (image only), a corrupt PDF, a password-protected PDF and
    a Word document among the drawings

build(root) writes it and returns what a correct reading must find.
"""
from __future__ import annotations

from pathlib import Path

W, H = 1191, 842                        # A3 landscape, points

DOORS = [("D01", "SINGLE LEAF", "900 x 2100", 4), ("D02", "DOUBLE LEAF", "1800 x 2400", 6),
         ("D03", "SLIDING", "1500 x 2100", 2), ("D04", "SINGLE LEAF", "800 x 2100", 8),
         ("D05", "FIRE DOOR", "1000 x 2100", 1)]
WINDOWS = [("W01", "1200 x 1500", 3), ("W02", "600 x 900", 5), ("W03", "1800 x 1500", 2),
           ("W04", "900 x 1200", 7)]


def _fitz():
    import pymupdf
    return pymupdf


def _strip_block(page, number, title, rev="B"):
    """A full-width strip along the bottom: labels with the value beside them."""
    fitz = _fitz()
    y0 = H - 70
    page.draw_rect(fitz.Rect(20, y0, W - 20, H - 20), color=(0, 0, 0), width=1.2)
    for x in (420, 760, 960):
        page.draw_line((x, y0), (x, H - 20), color=(0, 0, 0))
    page.insert_text((30, y0 + 22), "PROJECT: RIVERSIDE CLINIC EXTENSION", fontsize=9)
    page.insert_text((30, y0 + 40), "CLIENT: HEALTH TRUST", fontsize=9)
    page.insert_text((430, y0 + 22), f"SHEET TITLE: {title}", fontsize=9)
    page.insert_text((430, y0 + 40), "SCALE: 1:100", fontsize=9)
    page.insert_text((770, y0 + 22), f"SHEET NO. {number}", fontsize=11)
    page.insert_text((970, y0 + 22), f"REV: {rev}", fontsize=9)
    page.insert_text((970, y0 + 40), "DATE: 14/03/2026", fontsize=9)


def _box_block(page, number, title):
    """A box in the lower-right corner: labels over the values beneath."""
    fitz = _fitz()
    x0, y0 = W - 300, H - 150
    page.draw_rect(fitz.Rect(x0, y0, W - 20, H - 20), color=(0, 0, 0), width=1.2)
    for y in (y0 + 45, y0 + 90):
        page.draw_line((x0, y), (W - 20, y), color=(0, 0, 0))
    page.insert_text((x0 + 8, y0 + 14), "DRAWING TITLE", fontsize=7)
    page.insert_text((x0 + 8, y0 + 32), title, fontsize=10)
    page.insert_text((x0 + 8, y0 + 59), "DRAWING NUMBER", fontsize=7)
    page.insert_text((x0 + 150, y0 + 59), "REVISION", fontsize=7)
    page.insert_text((x0 + 8, y0 + 77), number, fontsize=11)
    page.insert_text((x0 + 150, y0 + 77), "C", fontsize=11)
    page.insert_text((x0 + 8, y0 + 110), "SCALE  1:50", fontsize=8)


def _table(page, x0, y0, headers, rows, widths):
    """A ruled table, one text cell per box."""
    fitz = _fitz()
    rh = 24
    xs = [x0]
    for w in widths:
        xs.append(xs[-1] + w)
    n = len(rows) + 1
    for i in range(n + 1):
        page.draw_line((xs[0], y0 + i * rh), (xs[-1], y0 + i * rh), color=(0, 0, 0))
    for x in xs:
        page.draw_line((x, y0), (x, y0 + n * rh), color=(0, 0, 0))
    for r, cells in enumerate([headers] + [list(map(str, row)) for row in rows]):
        for c, text in enumerate(cells):
            page.insert_text((xs[c] + 5, y0 + r * rh + 16), text, fontsize=9)


def _combined_set(path: Path):
    fitz = _fitz()
    doc = fitz.open()
    # 1. cover
    page = doc.new_page(width=W, height=H)
    page.insert_text((300, 300), "RIVERSIDE CLINIC EXTENSION", fontsize=36)
    page.insert_text((300, 360), "ARCHITECTURAL DRAWINGS - TENDER ISSUE", fontsize=18)
    _strip_block(page, "A000", "COVER SHEET")
    # 2. a plan
    page = doc.new_page(width=W, height=H)
    page.insert_text((60, 60), "GROUND FLOOR PLAN", fontsize=22)
    for x in range(100, 1000, 150):
        page.draw_line((x, 120), (x, 680), color=(0, 0, 0), width=0.8)
    for y in range(120, 700, 140):
        page.draw_line((100, y), (1000, y), color=(0, 0, 0), width=0.8)
    for i, (mark, *_rest) in enumerate(DOORS):
        page.insert_text((140 + i * 150, 200), mark, fontsize=8)
    _strip_block(page, "A101", "GROUND FLOOR PLAN")
    # 3. the door schedule
    page = doc.new_page(width=W, height=H)
    page.insert_text((60, 60), "DOOR SCHEDULE", fontsize=22)
    _table(page, 80, 120, ["DOOR NO", "TYPE", "SIZE", "QTY", "REMARKS"],
           [(m, t, s, q, "IRONMONGERY SET 1") for m, t, s, q in DOORS],
           [90, 160, 140, 60, 200])
    _strip_block(page, "A501", "DOOR SCHEDULE")
    doc.save(str(path))
    doc.close()


def _window_schedule(path: Path):
    fitz = _fitz()
    doc = fitz.open()
    page = doc.new_page(width=W, height=H)
    page.insert_text((60, 60), "WINDOW SCHEDULE", fontsize=22)
    _table(page, 80, 120, ["REF", "W X H", "NO OFF", "FRAME"],
           [(m, s, q, "ALUMINIUM") for m, s, q in WINDOWS], [80, 150, 80, 160])
    _box_block(page, "2301-A-502", "WINDOW SCHEDULE")
    path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(path))
    doc.close()


def _load_summary(path: Path):
    fitz = _fitz()
    doc = fitz.open()
    page = doc.new_page(width=W, height=H)
    page.insert_text((60, 60), "ELECTRICAL LOAD SUMMARY", fontsize=22)
    _table(page, 80, 120, ["DB REF", "DESCRIPTION", "LOAD KW", "QTY"],
           [(f"DB-0{i}", "LIGHTING", 12 + i, 1) for i in range(1, 6)], [80, 180, 90, 60])
    _box_block(page, "2301-E-601", "ELECTRICAL LOAD SUMMARY")
    doc.save(str(path))
    doc.close()


def _scanned(path: Path):
    fitz = _fitz()
    src = fitz.open()
    src.new_page(width=300, height=200).insert_text((20, 100), "SECTION A-A", fontsize=20)
    png = src[0].get_pixmap(dpi=50).tobytes("png")
    src.close()
    doc = fitz.open()
    doc.new_page(width=W, height=H).insert_image(fitz.Rect(0, 0, W, H), stream=png)
    doc.save(str(path))
    doc.close()


def _encrypted(path: Path):
    fitz = _fitz()
    doc = fitz.open()
    doc.new_page(width=W, height=H).insert_text((60, 60), "SECTION B-B", fontsize=20)
    doc.save(str(path), encryption=fitz.PDF_ENCRYPT_AES_256, user_pw="secret", owner_pw="secret")
    doc.close()


def build(root: Path) -> dict:
    root = Path(root)
    arch = root / "01 Architecture"
    arch.mkdir(parents=True, exist_ok=True)
    _combined_set(arch / "Riverside Clinic - Architectural Set.pdf")
    _window_schedule(root / "01 Architecture" / "Fenster und Türen" / "2301-A-502 Window Schedule.PDF")
    (root / "04 Electrical").mkdir(parents=True, exist_ok=True)
    _load_summary(root / "04 Electrical" / "2301-E-601 Load Summary.pdf")
    _scanned(arch / "A301 Section A-A (scan).pdf")
    _encrypted(arch / "A302 Section B-B.pdf")
    (arch / "A999 damaged.pdf").write_bytes(b"%PDF-1.7\nthis file was cut short in transfer")
    (root / "Specification.docx").write_bytes(b"PK\x03\x04 not a drawing")
    return {
        "set_pages": 3,
        "doors": sum(q for *_x, q in DOORS),
        "windows": sum(q for *_x, q in WINDOWS),
        "door_marks": [m for m, *_x in DOORS],
        "window_marks": [m for m, *_x in WINDOWS],
        "numbers": {"A000", "A101", "A501", "2301-A-502", "2301-E-601"},
    }


if __name__ == "__main__":
    import sys
    print(build(Path(sys.argv[1])))
