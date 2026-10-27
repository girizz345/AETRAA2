"""Render an .xlsx as HTML tables, evaluating the simple formulas the tool writes.

The workbooks carry live formulas (=F4*H4, =E4*I4, =SUM(J4:J9), ='Sheet'!H141) and
openpyxl does not calculate, so a small evaluator works them out for display.

The take-off's drawing references are hyperlinks to the drawings, written relative to the workbook's folder (so a
run folder and its drawings can move together). In the browser they become links to the platform's own copy of
each drawing (link_for); a downloaded copy gets links to the same pages (with_web_links), since a relative link
stops working as soon as the file is saved or opened anywhere else; and "with drawings" zips the workbook with
the drawings it links to, the links pointing into the zip, for sending to someone who cannot open the platform
(with_drawings) - with a note to extract it first.
"""
from __future__ import annotations

import html
import io
import re
import zipfile
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import url2pathname
from xml.etree import ElementTree as ET

import openpyxl
from openpyxl.utils import column_index_from_string, get_column_letter

REF = re.compile(r"(?:(?:'([^']+)'|([A-Za-z_][\w.]*))!)?\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?")


class Evaluator:
    def __init__(self, wb):
        self.wb = wb
        self.cache: dict = {}

    def value(self, sheet: str, col: int, row: int):
        key = (sheet, col, row)
        if key in self.cache:
            return self.cache[key]
        self.cache[key] = 0          # guards against circular references
        v = self.wb[sheet].cell(row, col).value
        if isinstance(v, str) and v.startswith("="):
            v = self._eval(sheet, v[1:])
        self.cache[key] = v
        return v

    def _eval(self, sheet: str, expr: str):
        def num(v):
            return v if isinstance(v, (int, float)) else 0

        def repl(m):
            sh = m.group(1) or m.group(2) or sheet
            if sh.upper() == "SUM":
                return m.group(0)
            c1, r1 = column_index_from_string(m.group(3)), int(m.group(4))
            if m.group(5):
                c2, r2 = column_index_from_string(m.group(5)), int(m.group(6))
                return f"_R({sh!r},{c1},{r1},{c2},{r2})"
            return f"_C({sh!r},{c1},{r1})"

        py = REF.sub(repl, expr)
        env = {
            "_C": lambda s, c, r: num(self.value(s, c, r)),
            "_R": lambda s, c1, r1, c2, r2: [num(self.value(s, c, r))
                                             for r in range(r1, r2 + 1) for c in range(c1, c2 + 1)],
            "SUM": lambda *a: sum(sum(x) if isinstance(x, list) else x for x in a),
        }
        try:
            return eval(py, {"__builtins__": {}}, env)  # expression built only from cell refs and SUM
        except Exception:
            return "#ERR"


def fmt(v, number_format: str) -> str:
    if v is None:
        return ""
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        if "0.00" in number_format:
            if v == 0 and '"-"' in number_format:
                return "-"
            return f"{v:,.2f}"
        if "#,##0" in number_format:
            return f"{v:,.0f}"
        return f"{v:,.2f}" if isinstance(v, float) and v != int(v) else f"{v:,}"
    return str(v)


def local_target(workbook: Path, target: str) -> Path | None:
    """The local file a hyperlink in the workbook points at (relative to the workbook's folder, or a file:// URL);
    None for a web link or a file that is not there."""
    if target.lower().startswith("file:"):
        cands = [Path(url2pathname(urlparse(target).path))]
    elif re.match(r"^[a-z][a-z0-9+.-]*:", target, re.I) and not re.match(r"^[a-z]:[\\/]", target, re.I):
        return None                                  # http:, mailto: ...
    else:
        base = Path(workbook).parent
        cands = [base / target, base / unquote(target)]
    for c in cands:
        try:
            if c.is_file():
                return c.resolve()
        except OSError:
            pass
    return None


REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


def _with_links(workbook: Path, new_target) -> bytes:
    """The workbook with each hyperlink's target replaced by new_target(target) (None: left alone). Everything
    else is copied byte for byte."""
    ET.register_namespace("", REL_NS)
    out = io.BytesIO()
    with zipfile.ZipFile(workbook) as zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename.startswith("xl/worksheets/_rels/") and item.filename.endswith(".rels"):
                root = ET.fromstring(data)
                changed = False
                for rel in root.iter(f"{{{REL_NS}}}Relationship"):
                    t = new_target(rel.get("Target", "")) if rel.get("TargetMode") == "External" else None
                    if t is not None:
                        rel.set("Target", t)
                        changed = True
                if changed:
                    data = ET.tostring(root, xml_declaration=True, encoding="UTF-8")
            zout.writestr(item, data)
    return out.getvalue()


def with_absolute_links(workbook: Path) -> bytes:
    """The workbook with every hyperlink to a local file made absolute (file:///...), so it still opens the drawing
    after the copy is saved somewhere else on this computer."""
    workbook = Path(workbook)

    def absolute(t):
        f = None if t.lower().startswith("file:") else local_target(workbook, t)
        return f.as_uri() if f is not None else None
    return _with_links(workbook, absolute)


def with_web_links(workbook: Path, address) -> bytes:
    """The workbook with each drawing link pointing at address(target): the platform's own page for that drawing,
    so the link opens in the browser wherever the workbook is saved or opened. A link to a file beside the
    workbook broke as soon as it was opened anywhere else - straight out of a zip, which Windows copies alone to a
    temporary folder ("Cannot open the specified file"), or on another computer. A link address() has no page for
    is made absolute instead, as before."""
    workbook = Path(workbook)

    def target(t):
        url = address(t)
        if url:
            return url
        f = None if t.lower().startswith("file:") else local_target(workbook, t)
        return f.as_uri() if f is not None else None
    return _with_links(workbook, target)


EXTRACT_FIRST = """Extract this zip before opening the take-off: right-click the zip and choose "Extract All", then open
the workbook from the folder it makes.

Its drawing links open the PDFs in the drawings folder beside it. Opened straight out of the zip, Windows copies
the workbook alone to a temporary folder, the drawings are not beside it, and Excel says "Cannot open the specified
file".
"""


def with_drawings(workbook: Path, allow=None) -> bytes:
    """A zip of the workbook and every drawing its hyperlinks open (drawings/<file>), the links rewritten to point
    into it, so they still open once it is unzipped anywhere, on any computer. allow(path) limits which files may
    go in (None: any the links point at)."""
    workbook = Path(workbook)
    names: dict[Path, str] = {}                       # drawing -> its file name in the zip

    def bundled(t):
        f = local_target(workbook, t)
        if f is None or (allow is not None and not allow(f)):
            return None
        if f not in names:
            taken = {n.lower() for n in names.values()}
            n, i = f.name, 2
            while n.lower() in taken:                 # two drawings of one name in different folders
                n, i = f"{f.stem} ({i}){f.suffix}", i + 1
            names[f] = n
        return f"drawings/{names[f]}"

    book = _with_links(workbook, bundled)
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("READ ME - extract this zip first.txt", EXTRACT_FIRST.replace("\n", "\r\n"))
        z.writestr(workbook.name, book)
        for f, n in names.items():
            z.write(f, f"drawings/{n}")
    return out.getvalue()


def render(path, link_for=None) -> list[tuple[str, str]]:
    """[(sheet name, html table)] for every sheet. link_for(hyperlink target) gives the address a hyperlink opens
    in the browser (None: shown looking like a link, going nowhere)."""
    wb = openpyxl.load_workbook(path)
    ev = Evaluator(wb)
    out = []
    for ws in wb.worksheets:
        max_c = min(ws.max_column, 26)
        widths = []
        for c in range(1, max_c + 1):
            w = ws.column_dimensions[get_column_letter(c)].width or 8.43
            widths.append(max(24, int(w * 7.5)))
        rows = ["<colgroup><col class='rn'>" + "".join(f"<col style='width:{w}px'>" for w in widths) + "</colgroup>",
                "<thead><tr><th></th>" + "".join(f"<th>{get_column_letter(c)}</th>" for c in range(1, max_c + 1))
                + "</tr></thead><tbody>"]
        for r in range(1, ws.max_row + 1):
            cells = []
            empty = True
            for c in range(1, max_c + 1):
                cell = ws.cell(r, c)
                raw = cell.value
                v = ev.value(ws.title, c, r) if raw is not None else None
                text = fmt(v, cell.number_format or "")
                if text:
                    empty = False
                style = []
                if cell.font is not None:
                    if cell.font.b:
                        style.append("font-weight:600")
                    if cell.font.i:
                        style.append("font-style:italic")
                    col = cell.font.color.rgb if cell.font.color is not None and isinstance(cell.font.color.rgb, str) else None
                    if col and col not in ("FF000000", "00000000"):
                        style.append(f"color:#{col[-6:]}")
                fill = cell.fill.fgColor.rgb if cell.fill is not None and cell.fill.fill_type == "solid" else None
                if isinstance(fill, str) and fill not in ("00000000",):
                    style.append(f"background:#{fill[-6:]}")
                h = cell.alignment.horizontal if cell.alignment is not None else None
                if isinstance(v, (int, float)) and not h:
                    h = "right"
                if h in ("right", "center"):
                    style.append(f"text-align:{h}")
                b = cell.border
                for side in ("left", "right", "top", "bottom"):
                    s = getattr(b, side, None) if b is not None else None
                    if s is not None and s.style:
                        style.append(f"border-{side}:1px solid #555")
                title = f" title='{html.escape(str(raw))}'" if isinstance(raw, str) and raw.startswith("=") else ""
                link = cell.hyperlink.target if cell.hyperlink is not None else None
                body = html.escape(text)
                if link:
                    href = link_for(link) if link_for is not None else None
                    body = (f"<a class='lnk' href='{html.escape(href)}' target='_blank' rel='noopener' "
                            f"title='{html.escape(link)}'>{body}</a>" if href else
                            f"<span class='lnk' title='{html.escape(link)}'>{body}</span>")
                cells.append(f"<td style='{';'.join(style)}'{title}>{body}</td>")
            cls = " class='e'" if empty else ""
            rows.append(f"<tr{cls}><th>{r}</th>{''.join(cells)}</tr>")
        rows.append("</tbody>")
        out.append((ws.title, "<table class='xl'>" + "".join(rows) + "</table>"))
    return out
