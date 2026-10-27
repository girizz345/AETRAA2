"""End-to-end revision test: revise one plan, re-run against the previous run, check the diff.

    python tests/test_revision.py

Makes a revised copy of the drawing set in which A-07-005 (2nd floor plan) has one D4 tag moved 2 m
and another deleted, runs the take-off on it with --previous pointing at the current output, and
checks the revision report finds exactly that: 1 moved, 1 removed on A-07-005, the sheet revised,
D-4 re-opened (plans now disagree with the schedule), nothing else changed.
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "Test Drawigs" / "Architecture"
PREV = ROOT / "output"
sys.path.insert(0, str(ROOT))
from boq_arch.sheet import Sheet  # noqa: E402

assert (PREV / "evidence.json").exists(), "run boq.py on the test set first"
tmp = Path(tempfile.mkdtemp(prefix="rev01-"))
drw = tmp / "Architecture"
for p in SRC.rglob("*.pdf"):
    d = drw / p.relative_to(SRC)
    d.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, d)

plan = next(drw.rglob("A-07-005*.pdf"))
s = Sheet(plan)
d4 = [w for w in s.own_words if w.text == "D4"]
move, delete = d4[0], d4[5]
s.close()
doc = pymupdf.open(plan)
page = doc[0]
inv = ~page.rotation_matrix
for w in (move, delete):
    r = pymupdf.Rect(w.x0, w.y0, w.x1, w.y1) * inv
    page.add_redact_annot(r)
page.apply_redactions(images=0, graphics=0)          # remove the text only
# put the moved tag back 2 m along (sheet at about 1:152 -> 2000 mm is ~13 pt), same wall
k = 152.4 * 25.4 / 72
new = pymupdf.Point(move.cx + 2000 / k, move.cy) * inv
page.insert_text(new, "D4", fontsize=5, rotate=page.rotation)
out_pdf = plan.with_suffix(".tmp.pdf")
doc.save(out_pdf)
doc.close()
out_pdf.replace(plan)

out = tmp / "output"
r = subprocess.run([sys.executable, str(ROOT / "boq.py"), str(drw), "--out", str(out), "--rev", "01",
                    "--providers", "", "--previous", str(PREV), "--readings", str(ROOT / "readings")],
                   capture_output=True, text=True, timeout=1200)
print(r.stdout[-1200:], r.stderr[-2000:])
ch = json.loads((out / "revision_changes.json").read_text(encoding="utf-8"))
print("summary", ch["summary"])
print("sheets", ch["sheets"])
print("tags", ch["tags"])
print("quantities", ch["quantities"][:6])
t = ch["tags"].get("A-07-005", {})
ok = (len(t.get("moved", [])) == 1 and t["moved"][0][0] == "D4" and len(t.get("removed", [])) == 1
      and not t.get("added") and [x["sheet"] for x in ch["sheets"]] == ["A-07-005"]
      and set(ch["tags"]) == {"A-07-005"})
counts = json.loads((out / "counts.json").read_text(encoding="utf-8"))
ok = ok and counts["D4"]["status"] == "OPEN"
print("PASSED" if ok else "FAILED", "- revision diff finds the moved and the removed tag, and D-4 reopens")
shutil.rmtree(tmp, ignore_errors=True)
sys.exit(0 if ok else 1)
