"""Manual takeoff: measurements clicked on the raw drawing, assemblies with custom formulas, and their
merge into the house take-off and bill.

A measurement is points in sheet points plus the sheet's scale. Its raw quantities:
  length   L = polyline length (m)
  area     A = polygon area (m2), P = its perimeter (m)          (rect is an area)
  count    N = number of points
A length or area measured on plan over a sloping surface can be given its slope ('15', '1:12', '8%'): then
L and A are measured on the slope (plan figure x F, F = 1 / cos(pitch)), and Lp / Ap keep the plan figure.
P stays as drawn.
An assembly turns one measurement into bill items: each output names a POMI clause (unit from the
clause table), the item wording, and a formula over L, A, P, N and the assembly's own parameters
(e.g. H = wall height). Formulas are evaluated by a small arithmetic evaluator - never eval().
"""
from __future__ import annotations

import ast
import json
import math
import operator
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from .assemblies import unit_of
from .records import MANUAL, Item, Line
from .slope import parse as slope_of

LIB_DEFAULT = Path(__file__).parent / "data" / "assemblies_library.json"

# ---------------------------------------------------------------- formulas

_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
        ast.Pow: operator.pow, ast.Mod: operator.mod, ast.USub: operator.neg, ast.UAdd: operator.pos}
_FUNCS = {"min": min, "max": max, "round": round, "ceil": math.ceil, "floor": math.floor, "abs": abs,
          "sqrt": math.sqrt}


def evaluate(formula: str, names: dict) -> float:
    """Arithmetic only: numbers, the given names, + - * / ** %, and min/max/round/ceil/floor/abs/sqrt."""
    def ev(n):
        if isinstance(n, ast.Expression):
            return ev(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return n.value
        if isinstance(n, ast.Name):
            if n.id not in names:
                raise ValueError(f"unknown name '{n.id}' - use {', '.join(sorted(names))}")
            return float(names[n.id])
        if isinstance(n, ast.BinOp) and type(n.op) in _OPS:
            return _OPS[type(n.op)](ev(n.left), ev(n.right))
        if isinstance(n, ast.UnaryOp) and type(n.op) in _OPS:
            return _OPS[type(n.op)](ev(n.operand))
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in _FUNCS and not n.keywords:
            return _FUNCS[n.func.id](*[ev(a) for a in n.args])
        raise ValueError("only arithmetic is allowed in a formula")
    return float(ev(ast.parse(formula.strip(), mode="eval")))


def check_formula(formula: str, variables: list[str]) -> str | None:
    try:
        evaluate(formula, {v: 1.0 for v in variables})
        return None
    except ZeroDivisionError:
        return None
    except Exception as e:
        return str(e)


# ---------------------------------------------------------------- geometry

def raw_quantities(kind: str, pts: list, mm_per_pt: float) -> dict:
    k = mm_per_pt / 1000.0
    if kind == "count":
        return {"N": len(pts)}
    if kind == "length":
        L = sum(math.dist(a, b) for a, b in zip(pts, pts[1:])) * k
        return {"L": round(L, 3)}
    if kind in ("area", "rect"):
        if kind == "rect" and len(pts) == 2:
            (x0, y0), (x1, y1) = pts
            pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        if len(pts) < 3:
            return {"A": 0.0, "P": 0.0}
        a = 0.0
        for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
            a += x0 * y1 - x1 * y0
        A = abs(a) / 2 * k * k
        P = sum(math.dist(a_, b_) for a_, b_ in zip(pts, pts[1:] + pts[:1])) * k
        return {"A": round(A, 3), "P": round(P, 3)}
    return {}


# ---------------------------------------------------------------- assemblies library

def load_library(path: Path | None = None) -> list[dict]:
    p = path if path and path.exists() else LIB_DEFAULT
    return json.loads(p.read_text(encoding="utf-8"))


def save_library(lib: list[dict], path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(lib, indent=1, ensure_ascii=False), encoding="utf-8")


def validate_assembly(a: dict) -> list[str]:
    problems = []
    variables = {"length": ["L", "Lp", "F"], "area": ["A", "P", "Ap", "F"], "rect": ["A", "P", "Ap", "F"],
                 "count": ["N"]}.get(a.get("measure"), [])
    params = [p["name"] for p in a.get("params", []) if p.get("type", "number") == "number"]
    for o in a.get("outputs", []):
        try:
            unit_of(o["clause"])
        except Exception:
            problems.append(f"{o.get('item', '?')}: clause {o.get('clause')} is not in the POMI clause table")
        err = check_formula(o.get("formula", ""), variables + params)
        if err:
            problems.append(f"{o.get('item', '?')}: formula '{o.get('formula')}' - {err}")
    return problems


def _fill(text: str, params: dict) -> str:
    try:
        return text.format(**{k: (int(v) if isinstance(v, float) and v.is_integer() else v) for k, v in params.items()})
    except (KeyError, IndexError, ValueError):
        return text


def outputs_of(measure: dict, assembly: dict | None, mm_per_pt: float | None) -> tuple[dict, list[dict], str]:
    """(raw quantities, bill outputs, problem). No scale -> raw quantities cannot be taken (except counts)."""
    kind = measure["kind"]
    if kind not in ("length", "area", "rect", "count"):
        return {}, [], ""
    if kind != "count" and not mm_per_pt:
        return {}, [], "this sheet has no scale yet - use Set scale first"
    raw = raw_quantities(kind, [tuple(p) for p in measure["points"]], mm_per_pt or 1.0)
    names = dict(raw)
    if kind != "count":
        plan = "Ap" if "A" in raw else "Lp"
        true = plan[0]
        names |= {plan: raw[true], "F": 1.0}
        sl = measure.get("slope") or ""
        if str(sl).strip():
            got = slope_of(sl)
            if got is None:
                return raw, [], f"slope '{sl}' - give a pitch in degrees (15), a gradient (1:12) or a percentage (8%)"
            f = got[0]
            raw = dict(raw, **{true: round(raw[true] * f, 3), plan: raw[true], "F": round(f, 5)})
            names = dict(raw)
    if assembly is None:
        return raw, [], ""
    params = {p["name"]: (measure.get("params", {}).get(p["name"], p.get("default"))) for p in assembly.get("params", [])}
    num = {k: float(v) for k, v in params.items() if isinstance(v, (int, float)) or _isnum(v)}
    sign = -1.0 if measure.get("deduct") else 1.0
    outs = []
    for o in assembly.get("outputs", []):
        try:
            q = evaluate(o["formula"], {**names, **num}) * sign
            outs.append({"section": o["section"], "clause": o["clause"], "unit": unit_of(o["clause"]),
                         "item": _fill(o["item"], params), "qty": round(q, 3), "formula": o["formula"],
                         "heads": o.get("heads", []), "uhead": o.get("uhead", ""), "desc": o.get("desc", ""),
                         "sub": _fill(o.get("sub", ""), params)})
        except Exception as e:
            return raw, [], f"{o.get('item')}: {e}"
    return raw, outs, ""


def _isnum(v) -> bool:
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


# ---------------------------------------------------------------- store

@dataclass
class Store:
    folder: Path
    measures: list = field(default_factory=list)
    scales: dict = field(default_factory=dict)     # sheet key -> {"mm_per_pt", "basis"}

    @classmethod
    def open(cls, folder: Path) -> "Store":
        folder.mkdir(parents=True, exist_ok=True)
        m = folder / "measures.json"
        s = folder / "scales.json"
        return cls(folder, json.loads(m.read_text(encoding="utf-8")) if m.exists() else [],
                   json.loads(s.read_text(encoding="utf-8")) if s.exists() else {})

    def save(self):
        (self.folder / "measures.json").write_text(json.dumps(self.measures, indent=1), encoding="utf-8")
        (self.folder / "scales.json").write_text(json.dumps(self.scales, indent=1), encoding="utf-8")

    def add(self, m: dict) -> dict:
        m = dict(m)
        m.setdefault("id", uuid.uuid4().hex[:10])
        m["created"] = m.get("created") or time.strftime("%Y-%m-%d %H:%M")
        m["modified"] = time.strftime("%Y-%m-%d %H:%M")
        self.measures = [x for x in self.measures if x["id"] != m["id"]] + [m]
        self.save()
        return m

    def delete(self, mid: str):
        self.measures = [x for x in self.measures if x["id"] != mid]
        self.save()


# ---------------------------------------------------------------- into the take-off and bill

def merge_into(items: dict, measures: list[dict], library: list[dict], sheet_info: dict) -> list[str]:
    """Add every manual measurement's outputs to the bill items, as MEASURED (MANUAL) lines.

    An output whose wording matches an item already in the section adds to that item; otherwise it is a
    new item under its own headings. sheet_info: sheet key -> {"drawing", "floor", "mm_per_pt", "basis"}."""
    lib = {a["id"]: a for a in library}
    notes = []
    for m in measures:
        a = lib.get(m.get("assembly") or "")
        si = sheet_info.get(m["sheet"], {})
        raw, outs, problem = outputs_of(m, a, si.get("mm_per_pt"))
        if problem:
            notes.append(f"{m.get('name') or m['id']}: {problem} - not exported")
            continue
        for o in outs:
            sec = items.setdefault(o["section"], [])
            it = next((x for x in sec if x.description == o["item"] and x.clause == o["clause"]), None)
            if it is None:
                heads = tuple(o["heads"]) or ("Manual Take-off",)
                it = Item(o["section"], heads[-1], o["desc"] or f"As measured on the Drawings, "
                                                               f"complete in accordance with the Specifications and Drawings",
                          o["sub"], o["item"], o["unit"], o["clause"], heads=heads, uhead=o["uhead"])
                sec.append(it)
            dims = ", ".join(f"{k} {v:g}" for k, v in raw.items())
            sl = slope_of(m.get("slope") or "")
            it.lines.append(Line(si.get("drawing") or m["sheet"], m.get("floor", ""),
                                 f"{m.get('name') or a['name']}: {o['formula']} ({dims})"
                                 + (f" - on the slope, {sl[1]}" if sl else "")
                                 + (" - deduction" if m.get("deduct") else ""),
                                 max(1, int(m.get("nr") or 1)), qty_each=abs(o["qty"]), origin=MANUAL, location=si.get("basis", ""),
                                 deduct=bool(m.get("deduct"))))
    return notes


def write_measure_book(path: Path, measures: list[dict], library: list[dict], sheet_info: dict, title: str,
                       corrections: list[dict] = ()):
    """Every manual measurement, correction to the automatic take-off and annotation as a flat list: what was
    clicked, on which sheet, and what it billed."""
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    head, body = Font(name="Arial", size=9, bold=True, color="FFFFFF"), Font(name="Arial", size=9)
    fill = PatternFill("solid", fgColor="1F4E78")
    lib = {a["id"]: a for a in library}
    wb = Workbook()
    ws = wb.active
    ws.title = "MEASUREMENTS"
    ws["A1"] = title
    ws["A1"].font = Font(name="Arial", size=11, bold=True)
    cols = ["Drawing", "Floor", "Name", "Tool", "Assembly", "Measured", "Nr", "Section", "Clause", "Bill item",
            "Formula", "Qty each", "Total", "Unit", "Origin"]
    for c, h in enumerate(cols, 1):
        ws.cell(2, c, h).font, ws.cell(2, c).fill = head, fill
    r = 3
    for m in measures:
        if m["kind"] not in ("length", "area", "rect", "count"):
            continue
        si = sheet_info.get(m["sheet"], {})
        a = lib.get(m.get("assembly") or "")
        raw, outs, problem = outputs_of(m, a, si.get("mm_per_pt"))
        nr = max(1, int(m.get("nr") or 1))
        base = [si.get("drawing") or m["sheet"], m.get("floor", ""), m.get("name", ""), m["kind"],
                a["name"] if a else "(none)", ", ".join(f"{k} {v:g}" for k, v in raw.items()) or problem, nr]
        for o in outs or [None]:
            row = base + ([o["section"], o["clause"], o["item"], o["formula"], o["qty"], round(o["qty"] * nr, 3),
                           o["unit"], MANUAL] if o else ["", "", problem or "not billed - no assembly chosen", "", "", "", "", MANUAL])
            for c, v in enumerate(row, 1):
                ws.cell(r, c, v).font = body
            r += 1
    for col, w in zip("ABCDEFGHIJKLMNO", (12, 12, 26, 8, 30, 22, 5, 8, 8, 40, 16, 10, 10, 6, 20)):
        ws.column_dimensions[col].width = w
    notes = wb.create_sheet("ANNOTATIONS")
    for c, h in enumerate(["Drawing", "Type", "Text", "By", "Date"], 1):
        notes.cell(1, c, h).font, notes.cell(1, c).fill = head, fill
    r = 2
    for m in measures:
        if m["kind"] in ("note", "cloud", "arrow", "highlight"):
            for c, v in enumerate([sheet_info.get(m["sheet"], {}).get("drawing") or m["sheet"], m["kind"],
                                   m.get("text", ""), m.get("author", ""), m.get("modified", "")], 1):
                notes.cell(r, c, v).font = body
            r += 1
    for col, w in zip("ABCDE", (12, 10, 80, 14, 16)):
        notes.column_dimensions[col].width = w
    fixes = wb.create_sheet("CORRECTIONS")
    for c, h in enumerate(["Drawing", "Correction", "Shape", "What", "Reason", "Date"], 1):
        fixes.cell(1, c, h).font, fixes.cell(1, c).fill = head, fill
    for r, x in enumerate(corrections, 2):
        for c, v in enumerate([x["sheet"], x["action"].replace("_", " "), x.get("shape", ""), x.get("detail", ""),
                               x.get("note", ""), x.get("created", "")], 1):
            fixes.cell(r, c, v).font = body
    for col, w in zip("ABCDEF", (12, 12, 12, 70, 30, 16)):
        fixes.column_dimensions[col].width = w
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)


def burn_markup(sheet, measures: list[dict], out: Path, title: str):
    """The raw sheet with the user's measurements and annotations, as real PDF annotations."""
    import pymupdf
    doc = pymupdf.open()
    doc.insert_pdf(sheet.doc, from_page=0, to_page=0)
    page = doc[0]
    inv = ~page.rotation_matrix
    P = lambda x, y: pymupdf.Point(x, y) * inv
    col = lambda h: tuple(int(h.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4))
    default = {"length": "#C0703A", "area": "#3F9E8C", "rect": "#3F9E8C", "count": "#2E7D5B", "highlight": "#f2c200"}
    for m in measures:
        c = col(m.get("color") or default.get(m["kind"], "#d62728"))
        pts = [P(*p) for p in m["points"]]
        kind = m["kind"]
        if kind == "length" and len(pts) > 1:
            an = page.add_polyline_annot(pts)
        elif kind in ("area", "rect", "highlight", "cloud"):
            if kind in ("rect", "highlight", "cloud") and len(m["points"]) == 2:
                (x0, y0), (x1, y1) = m["points"]
                pts = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]
            an = page.add_polygon_annot(pts)
            if kind == "cloud":
                an.set_border(width=1.5, clouds=2)
                an.set_colors(stroke=c)
            else:
                an.set_colors(stroke=c, fill=c)
                an.set_opacity(0.35)
                if m.get("deduct"):
                    an.set_border(width=1, dashes=[4, 3])
        elif kind == "count":
            for p in pts:
                a2 = page.add_circle_annot(pymupdf.Rect(p.x - 5, p.y - 5, p.x + 5, p.y + 5))
                a2.set_colors(stroke=c)
                a2.set_border(width=1.5)
                a2.update()
            continue
        elif kind == "arrow" and len(pts) == 2:
            an = page.add_line_annot(pts[0], pts[1])
            an.set_line_ends(pymupdf.PDF_ANNOT_LE_NONE, pymupdf.PDF_ANNOT_LE_CLOSED_ARROW)
        elif kind == "note" and pts:
            an = page.add_text_annot(pts[0], m.get("text", ""), icon="Comment")
        else:
            continue
        if kind not in ("area", "rect", "highlight", "cloud"):
            an.set_colors(stroke=c)
        an.set_info(title="BOQ Take-off", content=(m.get("text") or m.get("name") or "") + (
            f"  [{m.get('summary', '')}]" if m.get("summary") else ""))
        an.update()
    page.insert_text(P(40, 30), title, fontsize=10, color=(0.6, 0, 0), rotate=page.rotation)
    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out, garbage=3, deflate=True)
    doc.close()
