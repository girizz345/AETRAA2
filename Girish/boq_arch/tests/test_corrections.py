"""Hand corrections to the automatic take-off, measured again by the rules.

    python tests/test_corrections.py [output dir]

Needs a run's state.pkl (python boq.py on the test set first). Checks that measuring again with no correction
gives the automatic take-off exactly; that an excluded wall piece leaves its item, a wall of no block size given
its thickness is billed on a line of its own, a renamed room moves to its new finish class, an excluded room
leaves; that a tag added where the plans miss one closes D-1 (schedule 20, plans 19) and an excluded duplicate
closes DW 01 (schedule 1, plans 2); that rooms drawn round labels the fill could not measure are billed as
MEASURED (MANUAL) and resolve that gap; and that the corrected bill still passes the house checks.
"""
import pickle
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from boq import write_books  # noqa: E402
from boq_arch import corrections as corr  # noqa: E402
from boq_arch.measure import r2  # noqa: E402
from boq_arch.records import CORRECTED, MANUAL  # noqa: E402
from boq_arch.shapes import run_data, sheet_view  # noqa: E402
from boq_arch.tags import tag_id  # noqa: E402

out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "output"
assert (out / "state.pkl").exists(), f"no state.pkl in {out} - run boq.py on the test set first"
with open(out / "state.pkl", "rb") as fh:
    state = pickle.load(fh)
assert "facts" in state, "state.pkl is from before corrections - run boq.py again"
ok = 0


def eq(a, b, what):
    global ok
    assert a == b, f"{what}: {a!r} != {b!r}"
    ok += 1


def near(a, b, what, tol=1e-6):
    global ok
    assert abs(a - b) <= tol, f"{what}: {a!r} != {b!r}"
    ok += 1


def items(rb):
    return {it.key(): it for its in rb["items"].values() for it in its}


def make(c):
    c2, why = corr.check(state, c)
    assert c2, why
    return c2


plans = {p.dn: p for p in state["facts"].plans}
A = items(corr.rebuild(state, []))

# nothing corrected: the automatic take-off, line for line
for s, its in state["items"].items():
    for it in its:
        b = A[it.key()]
        eq([(l.desc, l.nr, l.L, l.H, l.qty_each, l.origin, l.shapes) for l in b.lines],
           [(l.desc, l.nr, l.L, l.H, l.qty_each, l.origin, l.shapes) for l in it.lines], f"unchanged {it.description}")

p = plans["A-07-004"]                 # first floor: one storey, no repeat
linked = {pid for pid, _ in p.nearest.values()}      # pieces a tag takes its wall from: left alone here
W200 = "D||Walls, 200mm thick"
auto_line = next(l for l in A[W200].lines if l.ref == p.dn and l.origin == "MEASURED")
H = auto_line.H
L200 = sum(w.length_m for w in p.pieces if w.thk_mm == 200 and f"{p.dn}/{w.id}" in auto_line.shapes)

# a wall piece that is not a wall: its length x storey height leaves the 200 mm walls
w = next(w for w in p.pieces if w.thk_mm == 200 and w.length_m > 1 and w.id not in linked
         and f"{p.dn}/{w.id}" in auto_line.shapes)
B = items(corr.rebuild(state, [make({"sheet": p.dn, "action": "exclude", "shape": w.id, "note": "drafting overlap"})]))
near(A[W200].quantity() - B[W200].quantity(), (r2(L200) - r2(L200 - w.length_m)) * H, "excluded wall leaves D", 1e-6)
eq(any(l.memo and l.origin == CORRECTED and "1 wall piece(s) excluded" in l.desc and "drafting overlap" in l.desc
       for l in B[W200].lines), True, "exclusion noted under the item")

# a wall piece of no block size given 200 mm: billed on a line of its own
u = next(w for w in p.pieces if w.thk_mm is None and w.length_m > 0.5 and w.id not in linked)
B = items(corr.rebuild(state, [make({"sheet": p.dn, "action": "thickness", "shape": u.id, "value": 200})]))
hand = [l for l in B[W200].lines if l.ref == p.dn and l.origin == CORRECTED and not l.memo]
eq((len(hand), hand[0].L, hand[0].shapes), (1, r2(u.length_m), (f"{p.dn}/{u.id}",)), "hand thickness line")
near(B[W200].quantity() - A[W200].quantity(), r2(u.length_m) * H, "hand thickness billed", 1e-6)

# an apartment room renamed BATH: its floor area moves from apartments to bathrooms (and into wet-area waterproofing)
r = next(r for r in p.rooms if r.name == "LIVING/DINING / PANTRY")
B = items(corr.rebuild(state, [make({"sheet": p.dn, "action": "rename", "shape": r.id, "value": "BATH"})]))
APT, BATH, WET = "J|Floors|To floors, apartments", "J|Floors|To floors, bathrooms and toilets", "G||Horizontal surfaces"
near(A[APT].quantity() - B[APT].quantity(), r.area_m2, "renamed room leaves apartments", 0.011)
near(B[BATH].quantity() - A[BATH].quantity(), r2(r.area_m2), "renamed room joins bathrooms", 1e-9)
near(B[WET].quantity() - A[WET].quantity(), r2(r.area_m2), "renamed room is waterproofed", 1e-9)
eq(any(l.origin == CORRECTED and "renamed by hand" in l.desc for l in B[BATH].lines), True, "renamed line")

# a room excluded: its floor area leaves
B = items(corr.rebuild(state, [make({"sheet": p.dn, "action": "exclude", "shape": r.id})]))
near(A[APT].quantity() - B[APT].quantity(), r.area_m2, "excluded room leaves", 0.011)

# D-1: schedule 20, plans 19 - the tag the first floor plan misses, added, closes the count
D1 = next(k for k, it in A.items() if it.section == "H" and "type D-1" in it.description)
eq((A[D1].open, state["facts"].counts["D1"].plan_total), (True, 19), "D-1 open before")
x, y = next((x, y) for k, x, y in p.tags if k == "D1")
rb = corr.rebuild(state, [make({"sheet": p.dn, "action": "add_tag", "value": "D-1", "points": [[x + 60, y]]})])
B = items(rb)
eq((B[D1].open, B[D1].quantity(), rb["facts"].counts["D1"].status), (False, 20.0, "CLOSED"), "D-1 closed by the tag")
eq(any(l.memo and "1 tag(s) added (D-1)" in l.desc for l in B[D1].lines), True, "added tag noted")

# DW 01: schedule 1, plans 2 - the first floor's tag excluded as a duplicate closes it
DW1 = next(k for k, it in A.items() if it.section == "H" and "type DW 01" in it.description)
x, y = next((x, y) for k, x, y in p.tags if k == "DW1")
rb = corr.rebuild(state, [make({"sheet": p.dn, "action": "exclude", "shape": tag_id(x, y)})])
eq((items(rb)[DW1].open, items(rb)[DW1].quantity()), (False, 1.0), "DW 01 closed")

# 2nd floor: a bath and a bedroom the fill ran together, drawn round by hand (2 m squares round each label)
q = plans["A-07-005"]
i = next(n for n, t in enumerate(q.room_problems) if t.startswith("BATH / BED ROOM"))
gap = ("A-07-005", "room", q.room_problems[i])
d = 1000 / q.cal.mm_per_pt
drawn = [make({"sheet": q.dn, "action": "add_room", "value": nm, "points": [[x - d, y - d], [x + d, y - d],
                                                                               [x + d, y + d], [x - d, y + d]]})
         for nm, x, y in q.problem_points[i]]
eq(sorted(c["value"] for c in drawn), ["BATH", "BED ROOM"], "one label of each")
rb = corr.rebuild(state, drawn)
B = items(rb)
near(B[BATH].quantity() - A[BATH].quantity(), 4.0, "drawn bath billed", 1e-6)
near(B[APT].quantity() - A[APT].quantity(), 4.0, "drawn bedroom billed", 1e-6)
eq(any(l.origin == MANUAL and "drawn by hand" in l.desc and l.ref == q.dn for l in B[BATH].lines), True, "manual line")
before = {(g.sheet, g.field, g.reason) for g in state["facts"].gaps}
after = {(g.sheet, g.field, g.reason) for g in rb["facts"].gaps}
eq((gap in before, gap in after), (True, False), "the gap is resolved by the rooms drawn")
eq(q.room_problems[i] in rb["facts"].plans[[x.dn for x in rb["facts"].plans].index(q.dn)].room_problems, False,
   "problem gone from the plan")

# refused: a thickness that is not a block size, an unknown room or mark, a room smaller than a room
for bad in ({"sheet": p.dn, "action": "thickness", "shape": u.id, "value": 175},
            {"sheet": p.dn, "action": "rename", "shape": r.id, "value": "BALLROOM"},
            {"sheet": p.dn, "action": "add_tag", "value": "Q-9", "points": [[1, 1]]},
            {"sheet": p.dn, "action": "add_room", "value": "BATH", "points": [[0, 0], [1, 0], [1, 1]]},
            {"sheet": "A-13-001", "action": "exclude", "shape": "w1"}):
    eq(corr.check(state, bad)[0], None, f"refused {bad['action']}")

# one correction per shape: a later one replaces the earlier
c1 = make({"sheet": p.dn, "action": "thickness", "shape": u.id, "value": 200})
c2 = make({"sheet": p.dn, "action": "exclude", "shape": u.id})
eq([c["action"] for c in corr.put(corr.put([], c1), c2)], ["exclude"], "later correction replaces")

# carried to a run of the same drawings: the same shapes
cs = [c1, drawn[0]]
got, lost = corr.carry([dict(c, sha="x") for c in cs], state, lambda dn: "x")
eq(([c["shape"] for c in got if c["action"] == "thickness"], lost), ([u.id], []), "carried unchanged")

# the platform's view: the corrected shape and its line, and what changed against the automatic take-off
all_cs = [c1, drawn[0], drawn[1]]
rb = corr.rebuild(state, all_cs)
v = sheet_view(run_data(state, rb, all_cs), p.dn)
eq(next(x for x in v["sheet"]["walls"] if x[0] == u.id)[5], 200, "view: wall at its new thickness")
eq(any(ch["key"] == W200 for ch in v["changes"]), True, "view: change listed")

# a sloping terrace: its waterproofing moves to the sloping class, measured on the slope (G2.1 class 2)
import math  # noqa: E402
t = next(r for r in p.rooms if r.name == "TERRACE")
FLAT, SLOPED = "G|Waterproofing|To horizontal surfaces, roofs and terraces", "G|Waterproofing|To sloping surfaces, roofs and terraces"
B = items(corr.rebuild(state, [make({"sheet": p.dn, "action": "slope", "shape": t.id, "value": "30"})]))
near(A[FLAT].quantity() - B[FLAT].quantity(), t.area_m2, "sloping terrace leaves the flat item", 0.011)
near(B[SLOPED].quantity(), t.area_m2 / math.cos(math.radians(30)), "measured on the slope", 0.011)
eq(any(l.origin == CORRECTED and "sloping 30" in l.desc for l in B[SLOPED].lines), True, "sloping line says so")
# a sloping room keeps its walls, skirting and ceiling as on plan; its floor finish is billed sloping
B = items(corr.rebuild(state, [make({"sheet": p.dn, "action": "slope", "shape": r.id, "value": "1:12"})]))
near(B["J|Floors|To floors, apartments, sloping"].quantity(), r.area_m2 * math.hypot(1, 12) / 12, "sloping floor", 0.011)
# (within a rounding unit: the sloping room is its own line now, and each line rounds to 0.01)
near(B["J|Ceilings|To ceilings, apartments"].quantity(), A["J|Ceilings|To ceilings, apartments"].quantity(),
     "ceiling as on plan", 0.011)
# a room can be renamed and slope at once: the two corrections are held side by side
c_ren = make({"sheet": p.dn, "action": "rename", "shape": r.id, "value": "BATH"})
c_sl = make({"sheet": p.dn, "action": "slope", "shape": r.id, "value": "1:12"})
eq(sorted(c["action"] for c in corr.put(corr.put([], c_ren), c_sl)), ["rename", "slope"], "rename and slope kept")
eq(corr.check(state, {"sheet": p.dn, "action": "slope", "shape": r.id, "value": "steep"})[0], None, "bad slope refused")

# external finishes measured on the elevations
elev = {e.dn: e for e in state["facts"].elevations}
if elev and all(e.cal.mm_per_pt for e in elev.values()):
    EXT = next((k for k in A if k.startswith("J|Walls|To external walls")), None)
    named = [(e.dn, c) for e in elev.values() for c in e.classes if c.kind == "wall finish"]
    if EXT:
        near(A[EXT].quantity(), sum(round(c.area_m2 + 1e-9, 2) for _, c in named), "external finish = its coloured areas", 1e-6)
        eq({l.ref for l in A[EXT].lines}, {dn for dn, _ in named}, "one line per elevation")
        eq(all(len(l.shapes) == len(c.blobs) for l, (_, c) in zip(A[EXT].lines, named)), True, "each line names its areas")
    unknown = [(e, c) for e in elev.values() for c in e.classes if c.kind == "unknown"]
    if unknown:
        e, c = unknown[0]
        cf = make({"sheet": e.dn, "action": "finish", "shape": c.id,
                   "value": {"finish": "Brick cladding as per specialist's details & specs.", "kind": "wall finish"}})
        B = items(corr.rebuild(state, [cf]))
        key = "J|Walls|To external walls, brick cladding"
        near(B[key].quantity() - (A[key].quantity() if key in A else 0), round(c.area_m2 + 1e-9, 2), "colour named by hand", 1e-6)
        eq(any(l.origin == CORRECTED and l.ref == e.dn for l in B[key].lines), True, "named-by-hand line")
    e = next((e for e in elev.values() if any(c.kind == "wall finish" for c in e.classes)), None) or next(iter(elev.values()))
    c = next((c for c in e.classes if c.kind == "wall finish"), None) or e.classes[0]
    z = min(c.blobs, key=lambda b: b.area_m2)
    if EXT:
        B = items(corr.rebuild(state, [make({"sheet": e.dn, "action": "exclude", "shape": z.id})]))
        near(A[EXT].quantity() - B[EXT].quantity(), round(c.area_m2 + 1e-9, 2) - round(c.area_m2 - z.area_m2 + 1e-9, 2),
             "an excluded area leaves the finish", 1e-6)
    for bad in ({"sheet": e.dn, "action": "finish", "shape": c.id, "value": {"finish": "", "kind": "wall finish"}},
                {"sheet": e.dn, "action": "finish", "shape": "c9", "value": {"finish": "x", "kind": "other"}},
                {"sheet": e.dn, "action": "thickness", "shape": z.id, "value": 200}):
        eq(corr.check(state, bad)[0], None, f"refused on an elevation: {bad['action']}")
    got, lost = corr.carry([dict(make({"sheet": e.dn, "action": "exclude", "shape": z.id}), sha="x")], state, lambda dn: "y")
    eq(([c["shape"] for c in got], lost), ([z.id], []), "elevation correction carried to a revised sheet by its point")

# the corrected bill still follows the house format and agrees with its take-off
with tempfile.TemporaryDirectory() as d:
    write_books(Path(d), dict(state, items=rb["items"]), log=lambda *_: None)
    r_ = subprocess.run([sys.executable, str(ROOT / "tests" / "verify_outputs.py"), d], capture_output=True, text=True)
    eq(r_.returncode, 0, "corrected bill passes the house checks: " + (r_.stdout + r_.stderr)[-300:])
print(f"PASSED {ok} checks")
