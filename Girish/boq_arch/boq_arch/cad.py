"""Native CAD extension point (DXF / DWG).

When a CAD file is supplied for a sheet - same file name as the PDF, or starting with its drawing
number, beside it or in a `cad` folder - that sheet bypasses visual reading and scale calibration
entirely: real named geometry needs neither. The CAD sheet is presented to the rest of the pipeline
through the same interface as a PDF sheet (segments with layer names, words with positions), in
drawing units scaled so 1 point = 50 mm, so walls, rooms and tags are measured by the same code.

DXF is read with ezdxf. DWG is proprietary: it is recognised and reported, and needs converting to
DXF (e.g. ODA File Converter) before it can be read - it is never read as anything else.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path

from .calibrate import Calibration, Grid
from .sheet import Seg, Word

MM_PER_UNIT = {0: 1.0, 1: 25.4, 2: 304.8, 4: 1.0, 5: 10.0, 6: 1000.0}   # $INSUNITS -> mm
PT_MM = 20.0          # the CAD sheet is laid out at 1 point = 20 mm


def find_cad(pdf: Path, drawing_no: str = "") -> Path | None:
    """A CAD file supplied for this sheet, if any."""
    for folder in (pdf.parent, pdf.parent / "cad", pdf.parent.parent / "cad"):
        if not folder.is_dir():
            continue
        for ext in (".dxf", ".dwg"):
            exact = folder / (pdf.stem + ext)
            if exact.exists():
                return exact
            if drawing_no:
                for f in sorted(folder.glob(f"{drawing_no}*{ext}")):
                    return f
    return None


@dataclass
class CadSheet:
    """A DXF drawing, shaped like sheet.Sheet for the measuring code."""
    path: Path
    width: float = 0.0
    height: float = 0.0
    mm_per_unit: float = 1.0
    _segs: list = field(default_factory=list, repr=False)
    _words: list = field(default_factory=list, repr=False)

    @classmethod
    def load(cls, path: Path) -> "CadSheet":
        if path.suffix.lower() == ".dwg":
            raise ValueError(f"{path.name} is DWG - convert it to DXF (e.g. ODA File Converter) to use it")
        import ezdxf
        doc = ezdxf.readfile(str(path))
        msp = doc.modelspace()
        k = MM_PER_UNIT.get(doc.header.get("$INSUNITS", 4), 1.0)
        raw_segs, raw_words = [], []

        def add_line(a, b, layer):
            raw_segs.append((a[0] * k, a[1] * k, b[0] * k, b[1] * k, layer))

        for e in msp:
            t = e.dxftype()
            layer = e.dxf.get("layer", "0")
            if t == "LINE":
                add_line(e.dxf.start, e.dxf.end, layer)
            elif t in ("LWPOLYLINE", "POLYLINE"):
                pts = [tuple(p[:2]) for p in (e.get_points("xy") if t == "LWPOLYLINE" else
                                                  [v.dxf.location for v in e.vertices])]
                closed = e.closed if t == "LWPOLYLINE" else e.is_closed
                for a, b in zip(pts, pts[1:] + (pts[:1] if closed else [])):
                    add_line(a, b, layer)
            elif t in ("TEXT", "MTEXT"):
                txt = e.plain_text() if t == "MTEXT" else e.dxf.text
                p = e.dxf.insert
                for i, w in enumerate(txt.split()):
                    raw_words.append((p[0] * k + i * 400, p[1] * k, w, layer))
            elif t == "INSERT":
                p = e.dxf.insert
                for a in e.attribs:              # a door / window tag block carries its mark as an attribute
                    raw_words.append((p[0] * k, p[1] * k, a.dxf.text, layer))
        xs = [v for s in raw_segs for v in (s[0], s[2])] + [w[0] for w in raw_words] or [0]
        ys = [v for s in raw_segs for v in (s[1], s[3])] + [w[1] for w in raw_words] or [0]
        x0, y1 = min(xs), max(ys)
        me = cls(path, mm_per_unit=k)
        # to sheet points: x right, y down, 1 pt = 50 mm, 20 pt margin
        tx = lambda x: (x - x0) / PT_MM + 20
        ty = lambda y: (y1 - y) / PT_MM + 20
        me._segs = [Seg(tx(a), ty(b), tx(c), ty(d), lay) for a, b, c, d, lay in raw_segs]
        me._words = [Word(tx(x), ty(y) - 3, tx(x) + len(w) * 2.5, ty(y) + 3, w, lay) for x, y, w, lay in raw_words]
        me.width = (max(xs) - x0) / PT_MM + 40
        me.height = (y1 - min(ys)) / PT_MM + 40
        return me

    # the Sheet interface the measuring code uses
    @property
    def own_segments(self):
        return self._segs

    segments = own_segments

    @property
    def own_words(self):
        return self._words

    words = own_words

    @cached_property
    def sha1(self) -> str:
        import hashlib
        return hashlib.sha1(self.path.read_bytes()).hexdigest()

    def calibration(self) -> Calibration:
        return Calibration(PT_MM, "CAD", f"native CAD geometry ({self.path.name}, units x{self.mm_per_unit:g} mm) - "
                                         f"no calibration needed", Grid())


def length_mm(seg) -> float:
    return math.hypot(seg.x1 - seg.x0, seg.y1 - seg.y0) * PT_MM
