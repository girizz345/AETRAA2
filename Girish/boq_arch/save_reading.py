"""Save a reading made outside the provider chain (by a person or Claude Code).

    python save_reading.py <drawings folder> <drawing no> <task name> <answer.json> "<who read it>"

The reading is stamped with the sheet's SHA-1 and the task's current prompt
version, exactly as a provider's reading is, so a later change to either makes
it stale and it is read again.
"""
import json
import sys
from pathlib import Path

from boq_arch import tasks
from boq_arch.register import read_title_block
from boq_arch.sheet import Sheet

folder, dn, task_name, answer, by = Path(sys.argv[1]), sys.argv[2], sys.argv[3], Path(sys.argv[4]), sys.argv[5]
task = next(t for t in vars(tasks).values() if isinstance(t, tasks.Task) and t.name == task_name)
sheet = None
for p in sorted(folder.rglob("*.pdf")):
    s = Sheet(p)
    if read_title_block(s).get("drawing_no", "").split(" ")[0] == dn:
        sheet = s
        break
    s.close()       # every sheet opened is closed: open documents left to the interpreter's exit can crash it
if sheet is None:
    sys.exit(f"no sheet with drawing number {dn} in {folder}")
out_dir = Path(sys.argv[6]) if len(sys.argv) > 6 else Path("readings")
out_dir.mkdir(exist_ok=True)
version = task.version
request = out_dir / f"{dn}.{task.name}.request" / "request.json"
if request.exists():
    # a task set per sheet (the elevation finishes) carries its own version in the request it left
    stamp = json.loads(request.read_text(encoding="utf-8"))["_stamp"]
    if stamp["sheet_sha1"] == sheet.sha1 and stamp["version"].split("-")[0] == task.version:
        version = stamp["version"]
doc = {"_stamp": {"sheet_sha1": sheet.sha1, "task": task.name, "version": version},
       "_by": by, "reading": json.loads(answer.read_text(encoding="utf-8"))}
(out_dir / f"{dn}.{task.name}.json").write_text(json.dumps(doc, indent=1, ensure_ascii=False), encoding="utf-8")
print("saved", out_dir / f"{dn}.{task.name}.json", "from", sheet.path.name)
sheet.close()
