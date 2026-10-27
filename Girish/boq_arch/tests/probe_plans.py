"""Diagnostic: calibration, walls by thickness and tag counts per plan sheet."""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from boq_arch.calibrate import calibrate_all
from boq_arch.register import build_register
from boq_arch.sheet import Sheet
from boq_arch.tags import count_tags, norm_mark
from boq_arch.vision import Reader
from boq_arch.walls import measure_walls

root = Path(__file__).resolve().parents[1]
drawings = root.parent / "Test Drawigs" / "Architecture"
gaps = []
infos = [i for i in build_register(drawings, gaps) if i.kind in ("plan", "roof")]
sh = {i.drawing_no: Sheet(i.path) for i in infos}
cal = calibrate_all([(i.drawing_no, sh[i.drawing_no], i.scale) for i in infos], gaps,
                    Reader(root / "readings", order=[]), {i.drawing_no: i.kind for i in infos})
sched = {}
for dn in ("A-13-001", "A-13-002", "A-13-003"):
    for r in json.load(open(root / f"readings/{dn}.schedule.json", encoding="utf-8"))["reading"]["rows"]:
        sched[norm_mark(r["mark"])] = r["count"]
tot = Counter()
for i in infos:
    p = measure_walls(sh[i.drawing_no], cal[i.drawing_no])
    by = defaultdict(float)
    for w in p:
        by[w.thk_mm] += w.length_m
    c, _ = count_tags(sh[i.drawing_no], set(sched))
    for k, v in c.items():
        tot[k] += v * i.repeat
    print(i.drawing_no, i.floors, cal[i.drawing_no].status,
          {k: round(v, 1) for k, v in sorted(by.items(), key=lambda kv: str(kv[0]))}, dict(c))
print("schedule vs plans (differences only):",
      {k: (sched[k], tot.get(k, 0)) for k in sched if sched[k] != tot.get(k, 0)})
