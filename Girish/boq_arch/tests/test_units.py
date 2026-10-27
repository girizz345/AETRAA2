"""Unit checks: letters, size parsing, casing, provider fallback. python tests/test_units.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from boq_arch import vision
from boq_arch.letters import letter
from boq_arch.measure import Opening, finish_layers, sentence
from boq_arch.tags import norm_mark

ok = 0


def eq(a, b, what):
    global ok
    assert a == b, f"{what}: {a!r} != {b!r}"
    ok += 1


# letters: A..Z without I and O, then AA, BB
eq([letter(i) for i in range(10)], list("ABCDEFGHJK"), "letters")
eq(letter(23), "Z", "Z")
eq(letter(24), "AA", "AA")
eq(letter(25), "BB", "BB")
eq("I" in [letter(i) for i in range(24)] or "O" in [letter(i) for i in range(24)], False, "no I or O")

# marks
eq(norm_mark("D-1"), "D1", "D-1")
eq(norm_mark("DW 03"), "DW3", "DW 03")
eq(norm_mark("LW-01"), "LW1", "LW-01")

# sizes
o = Opening("X", {"mark": "D-1", "type": "HINGED DOOR", "size": "1200X2200", "shown_size": "", "location": "",
                  "count": 2, "description": ""})
eq((o.w, o.h), (1.2, 2.2), "size cell")
o = Opening("X", {"mark": "DW 04", "type": "PARTLY FIXED", "size": "AS SHOWN", "shown_size": "7300+2950 x 3200",
                  "location": "", "count": 1, "description": ""})
eq((o.legs, o.h), ([7.3, 2.95], 3.2), "L-shaped")
o = Opening("X", {"mark": "DW 15", "type": "", "size": "AS SHOWN", "shown_size": "11350 x (800+2400)",
                  "location": "", "count": 1, "description": ""})
eq((o.w, o.h), (11.35, 3.2), "height in parts")
o = Opening("X", {"mark": "LW 01", "type": "", "size": "AS SHOWN", "shown_size": "2900 x 2000 sill 750",
                  "location": "", "count": 1, "description": ""})
eq((o.w, o.h, o.sill), (2.9, 2.0, 0.75), "sill")

# casing
eq(sentence("POOL PUMP (GROUND FLR.)"), "Pool pump (ground flr.)", "no PUmp")
eq(sentence("FIRE RATED AS PER CIVIL DEFENSE REQUIREMENTS"), "Fire rated as per Civil Defense requirements", "CD")
eq(finish_layers("1 HOLLOW BLOCK WALL; 3 FINISHING FLOOR TILES; 5 B.R.C. A-142 (MESH); 6 15cm CONCRETE SLAB"),
   "finishing floor tiles; B.R.C. A-142 (mesh)", "finish layers")

# provider fallback: first out of quota, second answers; none -> request left behind
calls = []


def out_of_quota(images, prompt, schema):
    calls.append("a")
    raise vision.ProviderUnavailable("429")


def answers(images, prompt, schema):
    calls.append("b")
    return {"rows": []}


vision.PROVIDERS.update({"a": out_of_quota, "b": answers})


class FakeSheet:
    sha1 = "x"
    width = height = 100


vision.tiles = lambda sheet, task: [b"png"]
import tempfile
with tempfile.TemporaryDirectory() as d:
    r = vision.Reader(Path(d), ["a", "b"], log=lambda *_: None)
    t = vision.Task("t", "1", "p", {})
    reading, how = r.read(FakeSheet(), "A-1", t)
    eq((reading, how, calls), ({"rows": []}, "read by b", ["a", "b"]), "fallback to next provider")
    reading, how = r.read(FakeSheet(), "A-1", t)
    eq((reading, how.startswith("saved reading")), ({"rows": []}, True), "saved reading reused")
    r2 = vision.Reader(Path(d), ["a"], log=lambda *_: None)
    reading, how = r2.read(FakeSheet(), "A-2", t)
    eq((reading, (Path(d) / "A-2.t.request" / "request.json").exists()), (None, True), "request left")

# manual take-off: formulas are arithmetic only, geometry at the sheet's scale, merge into bill items
from boq_arch import manual
eq(manual.evaluate("2*L*H + max(P - D, 0)", {"L": 10, "H": 3, "P": 4, "D": 1}), 63.0, "formula evaluates")
for bad in ("__import__('os')", "L.real", "open('x')", "[1, 2]", "(lambda: 1)()"):
    try:
        manual.evaluate(bad, {"L": 1})
        eq(bad, "rejected", "unsafe formula rejected")
    except ValueError:
        ok += 1
eq(manual.raw_quantities("rect", [(0, 0), (100, 50)], 20.0), {"A": 2.0, "P": 6.0}, "rectangle area and perimeter")
eq(manual.raw_quantities("length", [(0, 0), (30, 40), (30, 90)], 10.0), {"L": 1.0}, "polyline length")
eq(manual.raw_quantities("count", [(1, 1), (2, 2), (3, 3)], 0), {"N": 3}, "count")
lib = manual.load_library()
eq([a["id"] for a in lib if manual.validate_assembly(a)], [], "default assemblies valid")
from boq_arch.records import Item, Line
items = {"D": [Item("D", "Walls", "x", "Block Walls", "Walls, 200mm thick", "m2", "D2.1", [Line("A-1", "GF", "auto", 1, qty_each=10.0)])]}
ms = [{"id": "w", "sheet": "K", "kind": "length", "points": [[0, 0], [100, 0]], "assembly": "block-wall",
       "params": {"T": 200, "H": 3.0}, "nr": 2, "name": "wall"},
      {"id": "v", "sheet": "K", "kind": "rect", "points": [[0, 0], [10, 10]], "assembly": "room-finishes", "deduct": True,
       "params": {"H": 3.0, "D": 0}},
      {"id": "n", "sheet": "K", "kind": "length", "points": [[0, 0], [1, 0]], "assembly": "block-wall", "name": "unscaled"}]
probs = manual.merge_into(items, ms, lib, {"K": {"drawing": "A-1", "mm_per_pt": 50.0}})
eq(abs(items["D"][0].quantity() - (10 + 2 * 5.0 * 3.0 + 0.05 * 3.55)) < 0.002, True, "manual wall adds to the matching item, x storeys")
eq(items["D"][0].lines[-1].origin, manual.MANUAL, "manual line tagged")
floor = next(i for i in items["J"] if i.uhead == "Floors")
eq(round(floor.quantity(), 3), -0.25, "deduction is negative")
eq(len(probs), 0, "all measurements exported")
probs = manual.merge_into({}, ms[2:], lib, {"K": {"drawing": "A-1", "mm_per_pt": None}})
eq(len(probs), 1, "no scale reported, not exported")

# hand corrections: a room drawn by hand, point in outline, tag ids, one correction per shape
from boq_arch import corrections
from boq_arch.rooms import hand_room, inside
from boq_arch.tags import tag_id
r = hand_room("BATH", [(0, 0), (40, 0), (40, 20), (0, 20)], 50.0, 7, "hx")
eq((round(r.area_m2, 6), round(r.perimeter_m, 6), r.category, r.seed, r.hand), (2.0, 6.0, "wet", (20.0, 10.0), "drawn"),
   "hand room: area and perimeter at the sheet's scale")
ell = [[(0, 0), (10, 0), (10, 4), (4, 4), (4, 10), (0, 10)]]
eq((inside(ell, 2, 8), inside(ell, 8, 8), inside(ell, 8, 2)), (True, False, True), "point in an L-shaped outline")
eq(tag_id(123.456, 78.9), "t1235_789", "tag id from its position")
c1 = {"id": "a", "sheet": "S", "action": "thickness", "shape": "w1", "value": 200}
c2 = {"id": "b", "sheet": "S", "action": "exclude", "shape": "w1"}
c3 = {"id": "c", "sheet": "S", "action": "add_tag", "value": "D1", "points": [[1, 1]]}
eq([c["id"] for c in corrections.put(corrections.put(corrections.put([], c1), c3), c2)], ["c", "b"],
   "a later correction on the same shape replaces the earlier")
eq(corrections._resolved([("BATH", 20, 10)], [r]), True, "a label inside a drawn room is resolved")
eq(corrections._resolved([("BATH", 20, 10), ("BED ROOM", 90, 10)], [r]), False, "every label must be drawn round")

# slopes: pitch, gradient, percentage; flat or nonsense is not a slope
import math
from boq_arch import slope
eq(round(slope.parse("30")[0], 6), round(1 / math.cos(math.radians(30)), 6), "30 degrees")
eq(round(slope.parse("1:12")[0], 6), round(math.hypot(1, 12) / 12, 6), "gradient 1:12")
eq(round(slope.parse("1 in 12")[0], 6), round(slope.parse("1:12")[0], 6), "1 in 12 is 1:12")
eq(round(slope.parse("8%")[0], 6), round(math.hypot(8, 100) / 100, 6), "8 percent")
eq([slope.parse(t) for t in ("", "0", "flat", "85")], [None] * 4, "not slopes")
# a sloping area measured on plan: A on the slope, Ap on plan; P as drawn; a bad slope is reported
ramp = {"id": "ramp", "measure": "area", "params": [], "outputs": [{"section": "J", "clause": "J3.1.1", "item": "x",
                                                                    "formula": "A"}]}
raw, outs, prob = manual.outputs_of({"kind": "rect", "points": [[0, 0], [100, 50]], "slope": "1:12"}, ramp, 20.0)
eq((raw["Ap"], raw["P"], outs[0]["qty"], prob), (2.0, 6.0, round(2.0 * math.hypot(1, 12) / 12, 3), ""), "sloping area")
eq(manual.outputs_of({"kind": "rect", "points": [[0, 0], [100, 50]], "slope": "steep"}, ramp, 20.0)[2] != "", True,
   "bad slope reported")
eq(manual.outputs_of({"kind": "rect", "points": [[0, 0], [100, 50]]}, dict(ramp, outputs=[dict(ramp["outputs"][0],
   formula="Ap*F")]), 20.0)[1][0]["qty"], 2.0, "flat: Ap and F still usable in formulas")
eq(manual.outputs_of({"kind": "length", "points": [[0, 0], [100, 0]], "slope": "30"}, None, 10.0)[0]["L"],
   round(1 / math.cos(math.radians(30)), 3), "sloping length")

# external finishes: the short name of a callout; hue runs wrap round (red sits at both ends of the hue circle)
from boq_arch.elevations import _hue_runs, short_name
import numpy as np
eq(short_name("BRICK CLADDING AS PER SPECIALIST'S DETAILS & SPECS."), "brick cladding", "finish short name")
eq(short_name("Epoxy paint finish, colour & texture as per cons. appl."), "epoxy paint finish", "short name at a comma")
hist = np.zeros(30); hist[[0, 1, 29]] = 500; hist[16] = 800; hist[8] = 10
eq(sorted(sorted(r) for r in _hue_runs(hist, 400)), [[0, 1, 29], [16]], "hue runs, wrapping red, dropping a trace")
# batch: every set gets its own name; readings are written whole; the fast segments are the slow ones
from boq_arch import batchrun
from boq_arch.vision import write_atomic
with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    for sub in ("Tower A", "Tower B", "empty"):
        (d / "pack" / sub).mkdir(parents=True)
    (d / "pack" / "Tower A" / "a.pdf").write_bytes(b"%PDF")
    (d / "pack" / "Tower B" / "b.pdf").write_bytes(b"%PDF")
    (d / "pack" / "Tower C.zip").write_bytes(b"PK")
    eq([n for n, _ in batchrun.find_sets([d / "pack"], each=True)], ["Tower A", "Tower B", "Tower C"],
       "--each: sub-folders with drawings and zips are sets")
    eq([n for n, _ in batchrun.find_sets([d / "pack" / "Tower A", d / "pack" / "Tower A"])], ["Tower A", "Tower A (2)"],
       "two sets of the same name")
    f = d / "r.json"
    write_atomic(f, b"one")
    write_atomic(f, b"two")
    eq((f.read_bytes(), sorted(p.name for p in d.iterdir() if p.is_file())), (b"two", ["r.json"]),
       "a reading replaced whole, no temporary file left")
from boq_arch.sheet import Sheet
small = next((Path(__file__).resolve().parents[2] / "Test Drawigs" / "Architecture").rglob("A-07-001*.pdf"), None)
if small is not None:
    s = Sheet(small)
    eq(s.segments == s.segments_slow(), True, "segments as the one-point-at-a-time way")
    s.close()
# workbook hyperlinks: relative to the workbook's folder; a downloaded copy gets them made absolute
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "web"))
from xlsx_view import local_target, with_absolute_links
import openpyxl
import zipfile as _zip
with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    (d / "drawings").mkdir()
    (d / "run").mkdir()
    pdf = d / "drawings" / "A-07-004 FIRST FLOOR PLAN.pdf"
    pdf.write_bytes(b"%PDF")
    wb = openpyxl.Workbook()
    wb.active["A1"] = "A-07-004"
    wb.active["A1"].hyperlink = "../drawings/A-07-004 FIRST FLOOR PLAN.pdf"
    wb.active["A2"] = "web"
    wb.active["A2"].hyperlink = "https://example.com/x"
    book = d / "run" / "takeoff.xlsx"
    wb.save(book)
    eq(local_target(book, "../drawings/A-07-004 FIRST FLOOR PLAN.pdf"), pdf.resolve(), "relative link, from the workbook's folder")
    eq(local_target(book, "../drawings/A-07-004%20FIRST%20FLOOR%20PLAN.pdf"), pdf.resolve(), "relative link, encoded")
    eq(local_target(book, pdf.resolve().as_uri()), pdf.resolve(), "file:// link")
    eq((local_target(book, "https://example.com/x"), local_target(book, "../drawings/missing.pdf")), (None, None),
       "web links and missing files are not local drawings")
    copy = d / "Downloads" / "takeoff.xlsx"
    copy.parent.mkdir()
    copy.write_bytes(with_absolute_links(book))
    links = {c.coordinate: c.hyperlink.target for c in openpyxl.load_workbook(copy).active["A"] if c.hyperlink}
    eq((local_target(copy, links["A1"]), links["A2"]), (pdf.resolve(), "https://example.com/x"),
       "a downloaded copy still opens the drawing; web links untouched")
    eq(_zip.ZipFile(copy).namelist(), _zip.ZipFile(book).namelist(), "the downloaded copy has every part")
    # with drawings: the workbook and the drawings it links to in one zip, the links pointing into it
    (d / "drawings" / "old").mkdir()
    twin = d / "drawings" / "old" / "A-07-004 FIRST FLOOR PLAN.pdf"
    twin.write_bytes(b"%PDF old")
    secret = d / "notes.pdf"
    secret.write_bytes(b"%PDF private")
    wb.active["A3"] = "A-07-004 old"
    wb.active["A3"].hyperlink = "../drawings/old/A-07-004 FIRST FLOOR PLAN.pdf"
    wb.active["A4"] = "notes"
    wb.active["A4"].hyperlink = "../notes.pdf"
    wb.active["A5"] = "again"
    wb.active["A5"].hyperlink = "../drawings/A-07-004 FIRST FLOOR PLAN.pdf"
    wb.save(book)
    from xlsx_view import with_drawings
    zp = d / "sent.zip"
    zp.write_bytes(with_drawings(book, allow=lambda f: f != secret.resolve()))
    eq(sorted(_zip.ZipFile(zp).namelist()), ["READ ME - extract this zip first.txt",
                                             "drawings/A-07-004 FIRST FLOOR PLAN (2).pdf",
                                             "drawings/A-07-004 FIRST FLOOR PLAN.pdf", "takeoff.xlsx"],
       "the zip holds the workbook, each linked drawing once and a note to extract it; same names kept apart; "
       "only allowed files")
    _zip.ZipFile(zp).extractall(d / "elsewhere")
    got = d / "elsewhere" / "takeoff.xlsx"
    links = {c.coordinate: c.hyperlink.target for c in openpyxl.load_workbook(got).active["A"] if c.hyperlink}
    eq({k: local_target(got, links[k]).read_bytes() for k in ("A1", "A3", "A5")},
       {"A1": b"%PDF", "A3": b"%PDF old", "A5": b"%PDF"}, "unzipped anywhere, each link opens its own drawing")
    eq((links["A2"], links["A4"]), ("https://example.com/x", "../notes.pdf"), "web and left-out links untouched")
    eq(all(local_target(got, links[k]).parent == (d / "elsewhere" / "drawings").resolve() for k in ("A1", "A3", "A5")),
       True, "the links open the zip's copies, not the originals")
    # the download: each drawing the run registered opens on the platform's page for it, wherever the copy is opened
    from xlsx_view import with_web_links
    page = {pdf.resolve(): "http://127.0.0.1:5000/job/j1/drawing/A-07-004"}
    web = d / "Temp" / "takeoff.xlsx"
    web.parent.mkdir()
    web.write_bytes(with_web_links(book, lambda t: page.get(local_target(book, t))))
    links = {c.coordinate: c.hyperlink.target for c in openpyxl.load_workbook(web).active["A"] if c.hyperlink}
    eq((links["A1"], links["A5"], links["A2"], local_target(web, links["A4"])),
       ("http://127.0.0.1:5000/job/j1/drawing/A-07-004", "http://127.0.0.1:5000/job/j1/drawing/A-07-004",
        "https://example.com/x", secret.resolve()),
       "a registered drawing opens on the platform; any other file is linked absolute; web links untouched")

# title blocks of other offices: found from their labels, the house strip unchanged
from types import SimpleNamespace  # noqa: E402
from boq_arch.readability import _tb_candidates, title_block_rect  # noqa: E402


def _sheet(W, H, labels):
    words = [SimpleNamespace(text=t, x0=x, x1=x + 30, y0=y, y1=y + 8) for t, x, y in labels]
    return SimpleNamespace(width=W, height=H, words=words)


house = _sheet(2384, 1684, [(t, 2100, 1300 + 30 * i) for i, t in enumerate(
    ("DRAWING", "TITLE", "SCALE", "DATE", "DRAWN", "CHECKED", "DRAWING", "REVISION"))])
eq(title_block_rect(house), _tb_candidates(2384, 1684)[0], "the house layout's strip, exactly as before")
band = _sheet(1684, 1191, [(t, 1000 + 55 * i, 1150) for i, t in enumerate(   # as on IIT Bombay's sheets
    ("DATE:21.02.2022", "SCALE:AS", "DRAWN", "CHECKED", "No.", "DATE", "ISSUE/", "REVISION"))])
r = title_block_rect(band)
eq((r.y0 < 1150 < r.y1, abs(r.x1 - 1684 * 0.995) < 0.01, abs(r.y1 - 1191 * 0.995) < 0.01), (True, True, True),
   "a band along the bottom: its labels, out to the sheet's edge where the drawing number sits")
eq(title_block_rect(_sheet(1000, 700, [])), _tb_candidates(1000, 700)[0], "no labels (a cover sheet): the house strip")

# a drawing number read off the number field, in other offices' shapes - but never a date or a word
from boq_arch.register import valid_number  # noqa: E402
eq([valid_number(d, "READ (VISUAL)") for d in ("A1.0", "A4a", "A101", "S-03_1", "2301-A-200", "3")], [True] * 6,
   "office drawing numbers read visually")
eq([valid_number(d, "READ (VISUAL)") for d in ("JUN-2025", "12.05.2024", "FLOOR PLAN", "")], [False] * 4,
   "dates, words and blanks are not drawing numbers")
eq((valid_number("A-07-004", "STATED"), valid_number("A1.0", "STATED")), (True, False),
   "the text layer keeps the house pattern")

# the user's own Claude sign-in reads only for a run on this computer
import os  # noqa: E402
from boq_arch import vision  # noqa: E402
_was = os.environ.pop("BOQ_CLAUDE_LOGIN", None)
try:
    vision.PROVIDERS["claude-login"]([], "", {})
    refused = False
except vision.ProviderUnavailable as e:
    refused = "only for runs on this computer" in str(e)
if _was is not None:
    os.environ["BOQ_CLAUDE_LOGIN"] = _was
eq(refused, True, "the Claude sign-in is not used unless the run is local")
eq(vision.Reader(Path(tempfile.mkdtemp())).order[-1], "claude-login", "the sign-in is tried after any API key")

# an office that names its drawings on the sheet, not in the block; a plot number, not an address
from boq_arch.register import FLOOR_NAME, plot_like, sheet_headings  # noqa: E402


def _words(*rows):
    """(text, x, y, height) -> words, each word 0.6 x its height wide per letter."""
    out = []
    for text, x, y, h in rows:
        for t in text.split():
            out.append(SimpleNamespace(text=t, x0=x, x1=x + 0.6 * h * len(t), y0=y, y1=y + h))
            x += 0.6 * h * (len(t) + 1)
    return out


sheet = SimpleNamespace(width=1684, height=1191, words=_words(
    ("ENTRANCE", 300, 200, 14), ("1300", 500, 300, 16), ("una", 100, 1100, 30),
    ("FURNITURE LAYOUT PLAN", 600, 900, 18), *[("CONFERENCE ROOM TOILET", 200 + 30 * i, 400 + 20 * i, 6)
                                                for i in range(12)]))
heads, big = sheet_headings(sheet)
eq(heads, ["FURNITURE LAYOUT PLAN"], "the sheet's heading names the drawing; a dimension or a logo does not")
eq(FLOOR_NAME.search("ARCHITECTURAL DETAIL DRAWINGS- FIRST FLOOR").group(0).upper(), "FIRST FLOOR",
   "a divider page's floor")
eq([plot_like(v) for v in ("5310319", "PLOT 12-A", "POWAI, MUMBAI - 400 076, INDIA", "BROUGHTON'S MEADOW", "")],
   [True, True, False, False, False], "a plot number, never an address or a name")

# a job title printed letter-spaced, or with the address after it, is the same project; a file name keeps words apart
from boq import safe  # noqa: E402
from boq_arch.register import same_title, unspaced  # noqa: E402
eq(unspaced("I I T BOMBAY: VANVIHAR GUEST HOUSE"), "IIT BOMBAY: VANVIHAR GUEST HOUSE", "letter-spaced words compared joined")
eq((same_title("I I T BOMBAY: VANVIHAR GUEST HOUSE, POWAI, MUMBAI", "IIT BOMBAY: VANVIHAR GUEST HOUSE"),
    same_title("TOWER A", "TOWER B")), (True, False), "the address after a job title is not another project")
eq(safe("IIT BOMBAY: VANVIHAR GUEST HOUSE"), "IIT BOMBAY - VANVIHAR GUEST HOUSE", "a colon in a file name")

# a window scheduled in metres, and filed as a window of its own material
from boq_arch.facts import Facts  # noqa: E402
from boq_arch.measure import Opening, h_family, not_measured  # noqa: E402
w1 = Opening("A12", {"mark": "W1", "type": "W1", "size": "(3.17 x 1.2)", "shown_size": "",
                     "description": "CASEMENT WINDOW IN UPVC SECTION WITH SLIDING WINDOW"})
eq((w1.size_text(), h_family(w1)), ("3170 x 1200mm", ("Windows", "uPVC Windows", "")), "a uPVC window in metres")
eq(h_family(Opening("A", {"mark": "D-6", "type": "SWING DOOR", "size": "1000X2200", "shown_size": "",
                          "description": "POWDER COATED ALUMINIUM FRAMED DOOR"})),
   ("Doors", "Aluminium Doors", "aluminium doors"), "an aluminium door stays an aluminium door")

# what is not measured is reported from this set's own readings - never the first test set's drawings
f_iit = Facts(Path("."), {}, [SimpleNamespace(drawing_no="A12", kind="schedule", title="WINDOW SCHEDULE"),
                              SimpleNamespace(drawing_no="A10", kind="detail", title="CONFERENCE ROOM DOOR DETAIL")],
              [], {}, {}, "", [], [("A12", w1.row)], {}, [])
said = [(g.sheet, g.field) for g in not_measured(f_iit, {"W1": w1})]
eq(said, [("(set)", "external wall finishes"), ("A10", "doors")], "no railings, ironmongery or thresholds invented")
d1 = Opening("A-13-001", {"mark": "D-1", "type": "HINGED DOOR", "size": "900X2200", "shown_size": "",
                          "description": "SOLID PANEL DOOR * DOOR SHALL HAVE PUSH PLATES AND DOOR KNOB"})
f_cov = Facts(Path("."), {}, [], [], {}, {}, "", [], [], {"A-09-003": [{"detail": "W1", "text": "GLASS RAILING; SLAB"}],
              "A-12-012": [{"detail": "TYP.THRESHOLD DETAIL", "text": "MARBLE THRESHOLD"}]}, [],
              sheet_notes=[("A-13-001", "PROVIDE EXTERNAL THRESHOLD FOR TERRACES")])
said = {g.field: (g.sheet, g.reason) for g in not_measured(f_cov, {"D-1": d1})}
eq((said["railings"][0], said["thresholds"][0], "A-12-012" in said["thresholds"][1],
    "D-1 (push plates, door knob)" in said["ironmongery"][1]), ("A-09-003", "A-13-001", True, True),
   "the first test set's railings, thresholds and ironmongery, from its own readings")

# tags in the schedule's own form (floor-prefixed D1-08), each printed twice on its spot, on a PDF with no layers
from boq_arch.tags import count_tags  # noqa: E402
tw = [SimpleNamespace(text=t, x0=x, x1=x + 20, y0=y, y1=y + 6, cx=x + 10, cy=y + 3, layer="")
      for t, x, y in [("D1-08", 100, 100), ("D1-08", 100, 100), ("D1-08", 300, 100), ("W1-16", 200, 200),
                      ("W1-16", 200, 200), ("NOTE", 50, 50)]]
plain = SimpleNamespace(words=tw, own_words=tw, own_segments=[], segments=[], layers=lambda: {""})
eq(dict(count_tags(plain, {"D1-08", "W1-16"})[0]), {"D1-08": 2, "W1-16": 1},
   "a floor-prefixed mark counted, a tag printed twice on one spot counted once")

# 'NO SCALE' under a photo is a caption, not the title block's SCALE label
from boq_arch.readability import _caption  # noqa: E402
cw = [SimpleNamespace(text=t, x0=x, x1=x + 8 * len(t), y0=500, y1=510) for t, x in [("NO", 100), ("SCALE", 125),
                                                                                    ("SCALE", 400)]]
eq([_caption(SimpleNamespace(words=cw), w) for w in cw], [False, True, False], "NO SCALE is a caption")

# the review's findings, each kept fixed
from boq_arch.cad import CadSheet  # noqa: E402
cad = CadSheet.load(Path(__file__).parent / "fixtures" / "cad_sample.dxf")
eq(isinstance(count_tags(cad, {"D1", "W1"})[0], dict), True, "tags count on a native CAD sheet (no crash)")
from boq_arch.measure import inch_size  # noqa: E402
eq([tuple(round(v * 1000) for v in inch_size(s)[:2]) for s in ('3\'-0" X 80"', '30-1/2" X 80"', '7\' X 8\'')]
   + [inch_size('36" X 80" (R/O 36-1/2"X82-1/2")')[2], inch_size('0" X 80"')],
   [(914, 2032), (775, 2032), (2134, 2438), "rough opening", None], "feet-inches, hyphen fractions, rough opening")
door101 = Opening("S", {"mark": "101", "type": "", "size": "", "shown_size": "", "description": "SOLID CORE WOOD DOOR"})
eq((door101.is_door, h_family(door101)[1]), (True, "Wooden Doors"), "a numbered door is a door")
eq(h_family(Opening("S", {"mark": "102", "type": "", "size": "", "shown_size": "",
                          "description": "WOOD DOOR WITH STEEL LEVER HANDLES"}))[1], "Wooden Doors",
   "the material named first is the item's")
from boq_arch.measure import IRONMONGERY  # noqa: E402
eq([m.group(0) for m in IRONMONGERY.finditer("HINGED-DOOR IN BLOCK WALL, LEVER HANDLE AND 3 HINGES")],
   ["LEVER", "HANDLE", "HINGES"], "ironmongery words whole, not inside Hinged or BLOCK")
from boq_arch.calibrate import nominal_mm_per_pt  # noqa: E402
eq((nominal_mm_per_pt("1 IN 100") == nominal_mm_per_pt("1:100"), nominal_mm_per_pt("AS NOTED")), (True, None),
   "'1 in 100' is a ratio scale")
from boq_arch.register import _natural, classify, is_copy  # noqa: E402
eq([p.name for p in sorted([Path("Plans 10.pdf"), Path("Plans 2.pdf"), Path("Plans 1.pdf")], key=_natural)],
   ["Plans 1.pdf", "Plans 2.pdf", "Plans 10.pdf"], "files in the order a person reads them")
room = {"sha1": "a", "size": (1191, 842), "said": frozenset(("BED", x, 1) for x in range(40)) | {("PLAN", 0, 0)}}
ceil = {"sha1": "b", "size": (1191, 842), "said": frozenset(("BED", x, 1) for x in range(40)) | {("CEILING", 0, 0),
                                                                                                   ("LIGHT", 3, 3)}}
eq((is_copy(room, dict(room, sha1="a")), is_copy(room, ceil)), (True, False),
   "a copy is the same file or the same words in the same places; a room's ceiling plan is not its plan's copy")
eq((same_title("PROPOSED VILLA 1", "PROPOSED VILLA 12"), same_title("TOWER A", "TOWER A EXTENSION"),
    same_title("1910 E GRANDVIEW DR. / GRANDVIEW", "GRANDVIEW")), (False, False, True),
   "job titles compared by whole words; an address is several")
eq((classify("TOILET BLOCK - FRONT ELEVATION")[0], classify("KITCHEN/BATH ELEVATIONS")[0],
    classify("FOURTH FLOOR PLAN")[1]), ("elevation", "detail", ["4F"]), "interior elevations; fourth floor")
from boq_arch.readability import _TB_LABEL, _in_notes  # noqa: E402
nw = _words(("1. DRAWINGS SHALL NOT BE SCALED.", 50, 900, 8), ("DATE: 21.02.2022 SCALE: AS NOTED DRAWN BY: HR", 900, 900, 8))
eq([w.text for w in nw if _TB_LABEL.match(w.text) and not _in_notes(SimpleNamespace(words=nw), w)],
   ["DATE:", "SCALE:", "DRAWN"], "label words in the notes do not count; the block's own row does")

# the second review's findings, each kept fixed
def _row(mark, desc, typ="", size=""):
    return Opening("S", {"mark": mark, "type": typ, "size": size, "shown_size": "", "description": desc,
                         "location": "", "count": 1})


eq([_row(m, d).is_door for m, d in [("V1", "ALUMINIUM LOUVRED VENTILATOR ABOVE DOOR"), ("W6", "FIXED GLAZING BESIDE ENTRANCE DOOR"),
                                    ("101", "ENTRY DOOR / SIDE LITE / WINDOWS"), ("102", "VINYL WINDOW BESIDE DOOR")]],
   [False, False, True, False], "a lettered mark keeps its word; a numbered one is a door when DOOR comes first")
eq([round(v * 1000) for v in inch_size("3.5' X 7'")[:2]] + [inch_size('30 1/0" X 80"')], [1067, 2134, None],
   "decimal feet; a misread fraction is no size, not a crash")
from boq_arch.measure import section_h  # noqa: E402
_c = SimpleNamespace(status="CLOSED", plan_total=1, where="")
eq(sorted({it.subgroup for it in section_h(SimpleNamespace(gaps=[], infos=[], plans=[]), {
    "D1": _row("D1", "SOLID CORE DOOR (NON - FIRE RATED)", "HINGED", "900X2100"),
    "D2": _row("D2", "STEEL DOOR, NOT TO BE FIRE RATED", "HINGED", "900X2100"),
    "D3": _row("D3", "SOLID CORE DOOR * FIRE RATED AS PER CIVIL DEFENCE", "HINGED", "900X2100")},
    {}, {"D1": _c, "D2": _c, "D3": _c})}),
   ["Fire rated doors", "Non fire rated doors", "Non fire rated steel doors"],
   "a bracketed or distant NON / NOT is not fire rated; a plain FIRE RATED is")
eq((classify("INTERIOR ELEVATIONS - BLOCK A")[0], classify("SEVENTH FLOOR PLAN")[1]), ("detail", ["7F"]),
   "INTERIOR outright; floors past the sixth")
from boq_arch.levels import storey_key  # noqa: E402
eq([storey_key(n) for n in ("7TH FLOOR LVL", "TENTH FLOOR")], ["7F", "10F"], "storey keys for any floor")
print(f"PASSED {ok} checks")
