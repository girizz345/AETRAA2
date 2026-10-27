"""Acceptance test - visual takeoff of Section H, Coventry Residence 3 (plot 5310319).

    python tests/acceptance_section_h.py

Pointed at A-13-001 (Schedule of Doors) and A-13-002 / A-13-003 (Schedule of Windows) - schedule
tables with no extractable text - the module must independently reproduce the pilot take-off:
  480 doors across 12 marks, 199 windows / louvres across 22 marks,
and flag the LW-03 location gap instead of guessing it. The plans are loaded too, because a location
can only be confirmed - or not - against the plans.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from boq_arch.decisions import load  # noqa: E402
from boq_arch.facts import gather  # noqa: E402
from boq_arch.measure import build  # noqa: E402
from boq_arch.readability import classify_page, table_rect, tight_tiles  # noqa: E402
from boq_arch.sheet import Sheet  # noqa: E402

DRAWINGS = ROOT.parent / "Test Drawigs" / "Architecture"
fails = []


def check(cond, msg):
    print(("  ok    " if cond else "  FAIL  ") + msg)
    if not cond:
        fails.append(msg)


print("1. the schedules cannot be read from the text layer")
for dn in ("A-13-001", "A-13-002", "A-13-003"):
    s = Sheet(next(DRAWINGS.rglob(f"{dn}*.pdf")))
    c = classify_page(s)
    tiles = tight_tiles(table_rect(s))
    check(c["page"] in ("OUTLINED", "MIXED") and c["cells"]["OUTLINED_dense"] >= 10,
          f"{dn}: page {c['page']}, {c['cells']['OUTLINED_dense']} dense outlined cells -> read visually "
          f"from {len(tiles)} tight crops of the table")
    s.close()

f = gather(DRAWINGS, ROOT / "readings", [], log=lambda *a: None)
items = build(f, load(None))
rows = {r["mark"]: (dn, r) for dn, r in f.schedule}
doors = {m: r for m, (dn, r) in rows.items() if dn == "A-13-001"}
wins = {m: r for m, (dn, r) in rows.items() if dn in ("A-13-002", "A-13-003")}

print("2. counts read off the schedules")
nd, nw = sum(r["count"] for r in doors.values()), sum(r["count"] for r in wins.values())
check(len(doors) == 12 and nd == 480, f"doors: {nd} across {len(doors)} marks (pilot: 480 across 12)")
check(len(wins) == 22 and nw == 199, f"windows / louvres: {nw} across {len(wins)} marks (pilot: 199 across 22)")
how = {dn: h for (dn, t), (_, h) in f.readings.items() if t == "schedule"}
check(len(how) == 3, "each schedule read once: " + "; ".join(sorted(set(how.values()))))
h_items = items["H"]
origins = {ln.origin for it in h_items for ln in it.lines if not ln.memo}
check(origins <= {"READ (VISUAL)"}, f"every billed H quantity is tagged READ (VISUAL): {sorted(origins)}")

print("3. reconciled against the plans (count two ways, never pick)")
opened = sorted(c.mark for c in f.counts.values() if c.status == "OPEN")
closed = sum(1 for c in f.counts.values() if c.status == "CLOSED")
print(f"        {closed} marks CLOSED (schedule = plans), OPEN: {', '.join(opened)}")
lw3 = f.counts.get("LW3")
check(lw3 is not None and lw3.status == "OPEN" and lw3.plan_total == 0,
      "LW 03 left OPEN - schedule 1, plans 0 - not guessed")
lw3_gap = [g for g in f.gaps if g.field.startswith("LW 03 location")]
check(bool(lw3_gap), "LW 03 location gap flagged: " + (lw3_gap[0].reason if lw3_gap else "missing"))
lw3_item = next(it for it in h_items if "LW 03" in it.description)
check(lw3_item.open and lw3_item.quantity() == 0, "LW 03 carries no billed quantity while open")

print("PASSED" if not fails else f"FAILED ({len(fails)})")
sys.exit(1 if fails else 0)
