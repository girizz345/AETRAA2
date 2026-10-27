"""One drawing sheet: words and vector geometry in displayed (rotated) coordinates."""
from __future__ import annotations

import ctypes
import hashlib
import re
import sys
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path

import numpy as np
import pymupdf


UNDERLAY = re.compile(r"^[A-Z]{1,3}-\d{2}-\d{3}(?:\s|$)")


def _keep_none_alive() -> None:
    """PyMuPDF 1.28 releases more references to None than it takes: get_texttrace() some 900 on a large plan, and
    a few on most page properties. Python 3.11 counts None's references like any object's, so a process that has
    read enough drawings has lost more than None ever had, and fails ('deallocating None') as it shuts down - or in
    the middle of a run. From Python 3.12 None cannot be freed; here it is given a billion references to lose."""
    if sys.version_info < (3, 12):
        ctypes.c_ssize_t.from_address(id(None)).value += 1_000_000_000


_keep_none_alive()


def is_underlay(layer: str) -> bool:
    """Content xref'd from ANOTHER drawing sheet ('A-07-008 LOWER ROOF PLAN|M2-A-WALL').

    Shared xrefs (grid, plot - 'XR-GRID|...') are part of every sheet and are kept;
    a whole other sheet shown as an underlay is that sheet's content, not this one's.
    """
    return "|" in layer and bool(UNDERLAY.match(layer.split("|")[0].strip()))


def _path_points(page) -> tuple[list, list[tuple[str, str, int]]]:
    """Every point of the page's straight lines, rectangles, quads and curve chords (unrotated), and (kind, layer,
    index of its first point) for each; for Sheet.segments."""
    pts: list = []
    recs: list[tuple[str, str, int]] = []
    for path in page.get_cdrawings():
        layer = path.get("layer") or ""
        for it in path["items"]:
            kind = it[0]
            if kind == "l":
                recs.append(("l", layer, len(pts)))
                pts += (it[1], it[2])
            elif kind == "re":
                x0, y0, x1, y1 = it[1]
                x0, x1 = min(x0, x1), max(x0, x1)
                y0, y1 = min(y0, y1), max(y0, y1)
                recs.append(("re", layer, len(pts)))
                pts += ((x0, y0), (x0, y1), (x1, y1), (x1, y0))
            elif kind == "qu":
                ul, ur, ll, lr = it[1]
                recs.append(("qu", layer, len(pts)))
                pts += (ul, ur, lr, ll)
            elif kind == "c":
                # Bezier: keep the chord. Arcs here are door swings and
                # rounded corners; the chord closes the opening for flood fill.
                recs.append(("c", layer, len(pts)))
                pts += (it[1], it[4])
    return pts, recs


@dataclass(frozen=True)
class Word:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    layer: str = ""

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2


@dataclass(frozen=True)
class Seg:
    x0: float
    y0: float
    x1: float
    y1: float
    layer: str


@dataclass
class Sheet:
    path: Path
    _doc: pymupdf.Document | None = field(default=None, repr=False)

    @property
    def doc(self) -> pymupdf.Document:
        if self._doc is None:
            self._doc = pymupdf.open(self.path)
        return self._doc

    @property
    def page(self) -> pymupdf.Page:
        return self.doc[0]

    @cached_property
    def sha1(self) -> str:
        return hashlib.sha1(self.path.read_bytes()).hexdigest()

    @property
    def width(self) -> float:
        return self.page.rect.width

    @property
    def height(self) -> float:
        return self.page.rect.height

    @cached_property
    def words(self) -> list[Word]:
        m = self.page.rotation_matrix
        spans = [(pymupdf.Rect(sp["bbox"]), sp.get("layer") or "") for sp in self.page.get_texttrace()]
        out = []
        for w in self.page.get_text("words"):
            raw = pymupdf.Rect(w[:4])
            c = (raw.x0 + raw.x1) / 2, (raw.y0 + raw.y1) / 2
            layer = next((lay for r, lay in spans if r.x0 - 0.5 <= c[0] <= r.x1 + 0.5
                          and r.y0 - 0.5 <= c[1] <= r.y1 + 0.5), "")
            r = raw * m
            out.append(Word(r.x0, r.y0, r.x1, r.y1, w[4], layer))
        out.sort(key=lambda w: (round(w.y0), w.x0, w.text))
        return out

    @cached_property
    def segments(self) -> list[Seg]:
        """Every straight line and rectangle edge, tagged with its CAD layer.

        The same segments as segments_slow(), a large plan in about a fifth of the time: the paths come from
        get_cdrawings() as plain tuples, and every point is turned to displayed coordinates at once, with the
        arithmetic MuPDF's fz_transform_point does (single-precision floats, in the same order)."""
        m = self.page.rotation_matrix
        a, b, c, d, e, f = (np.float32(v) for v in (m.a, m.b, m.c, m.d, m.e, m.f))
        pts, recs = _path_points(self.page)
        if not pts:
            return []
        xy = np.asarray(pts, dtype=np.float64).astype(np.float32)
        x, y = xy[:, 0], xy[:, 1]
        tx = ((x * a + y * c) + e).tolist()
        ty = ((x * b + y * d) + f).tolist()
        out: list[Seg] = []
        for kind, layer, i in recs:
            if kind in ("l", "c"):
                out.append(Seg(tx[i], ty[i], tx[i + 1], ty[i + 1], layer))
            elif kind == "re":
                X, Y = tx[i:i + 4], ty[i:i + 4]
                r0, r1, s0, s1 = min(X), max(X), min(Y), max(Y)
                out += [Seg(r0, s0, r1, s0, layer), Seg(r1, s0, r1, s1, layer),
                        Seg(r1, s1, r0, s1, layer), Seg(r0, s1, r0, s0, layer)]
            else:
                q = [(tx[i + k], ty[i + k]) for k in (0, 1, 2, 3, 0)]
                out += [Seg(p[0], p[1], r[0], r[1], layer) for p, r in zip(q, q[1:])]
        return out

    def segments_slow(self) -> list[Seg]:
        """segments, the straightforward way (PyMuPDF objects, one point at a time); kept to check segments by."""
        m = self.page.rotation_matrix
        out: list[Seg] = []
        for d in self.page.get_drawings():
            layer = d.get("layer") or ""
            for it in d["items"]:
                kind = it[0]
                if kind == "l":
                    a, b = it[1] * m, it[2] * m
                    out.append(Seg(a.x, a.y, b.x, b.y, layer))
                elif kind == "re":
                    r = pymupdf.Rect(it[1]) * m
                    out += [Seg(r.x0, r.y0, r.x1, r.y0, layer), Seg(r.x1, r.y0, r.x1, r.y1, layer),
                            Seg(r.x1, r.y1, r.x0, r.y1, layer), Seg(r.x0, r.y1, r.x0, r.y0, layer)]
                elif kind == "qu":
                    q = it[1] * m
                    pts = [q.ul, q.ur, q.lr, q.ll, q.ul]
                    out += [Seg(a.x, a.y, b.x, b.y, layer) for a, b in zip(pts, pts[1:])]
                elif kind == "c":
                    # Bezier: keep the chord. Arcs here are door swings and
                    # rounded corners; the chord closes the opening for flood fill.
                    a, b = it[1] * m, it[4] * m
                    out.append(Seg(a.x, a.y, b.x, b.y, layer))
        return out

    @cached_property
    def own_words(self) -> list[Word]:
        return [w for w in self.words if not is_underlay(w.layer)]

    @cached_property
    def own_segments(self) -> list[Seg]:
        return [s for s in self.segments if not is_underlay(s.layer)]

    def layers(self) -> set[str]:
        return {s.layer for s in self.segments}

    def render_png(self, dpi: int, clip: pymupdf.Rect | None = None) -> bytes:
        """Render in displayed orientation; clip is in displayed coordinates."""
        page = self.page
        kw = {"dpi": dpi}
        if clip is not None:
            kw["clip"] = clip   # get_pixmap takes clip in displayed (rotated) coordinates
        return page.get_pixmap(**kw).tobytes("png")

    def close(self) -> None:
        if self._doc is not None:
            self._doc.close()
            self._doc = None
