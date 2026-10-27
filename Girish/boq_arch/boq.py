"""Architectural drawings -> take-off + unpriced BOQ, per POMI section, in the house formats.

    python boq.py "<drawings folder>" [--out DIR] [--rev 00] [--providers claude,openai,gemini]
                                      [--readings DIR] [--decisions FILE] [--no-overlays] [--workers N]

The per-sheet stages (title blocks, readings, grids, plans, elevations, mark-ups) run in N worker processes
(default up to 8); the take-off is the same whatever N is. Many drawing sets at once: batch.py.

Visual readings: set ANTHROPIC_API_KEY (and optionally OPENAI_API_KEY, GEMINI_API_KEY)
and they are read automatically, Claude first, the others taking over if it is out of
quota. With no key, the sheets that need reading are left as requests under
<readings>/<drawing>.<task>.request/ (tiles + prompt); a reading saved with
save_reading.py is used on the next run.
"""
from __future__ import annotations

import argparse
import copy
import json
import pickle
import re
import sys
import time
from pathlib import Path

from boq_arch import decisions as dec
from boq_arch.facts import gather
from boq_arch.measure import build
from boq_arch import revision
from boq_arch.markups import write_markups
from boq_arch.records import POMI_ORDER, Gap
from boq_arch.render_boq import bill_qty, write_boq
from boq_arch.render_takeoff import ARIAL9, BLUE_FILL, HEAD, TITLE, assign_codes, write_takeoff


def safe(s: str) -> str:
    s = re.sub(r"\s*:\s*", " - ", s)                 # "IIT BOMBAY: VANVIHAR" -> "IIT BOMBAY - VANVIHAR"
    return re.sub(r"\s+", " ", re.sub(r'[<>"/\\|?*]+', "-", s)).strip(" -")


def write_revision_book(path: Path, ch: dict):
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "SUMMARY"
    ws["A1"] = f"REVISION CHANGES - {ch.get('from_rev')} to {ch.get('to_rev')}"
    ws["A1"].font = TITLE
    for r, (k, v) in enumerate(ch["summary"].items(), 3):
        ws.cell(r, 1, k).font, ws.cell(r, 2, v).font = ARIAL9, ARIAL9
    tabs = [("SHEETS", ["Sheet", "Change", "Title"], [[x["sheet"], x["change"], x["title"]] for x in ch["sheets"]]),
            ("SCHEDULE", ["Mark", "Change", "Was", "Now"],
             [[x["mark"], x["change"], json.dumps(x.get("was")), json.dumps(x.get("now"))] for x in ch["schedule"]]),
            ("TAGS", ["Drawing", "Change", "Mark", "Was (mm from grid 1/A)", "Now"],
             [[dn, k, t[0], f"{t[1]}, {t[2]}" if k != "added" else "", f"{t[-2]}, {t[-1]}" if k != "removed" else ""]
              for dn, d in ch["tags"].items() for k, ts in d.items() for t in ts]),
            ("QUANTITIES", ["Section", "Item", "Change", "Was", "Now", "Unit"],
             [[x["section"], x["item"], x["change"], x.get("was"), x.get("now"), x["unit"]] for x in ch["quantities"]])]
    for name, head, rows in tabs:
        t = wb.create_sheet(name)
        for c, h in enumerate(head, 1):
            t.cell(1, c, h).font, t.cell(1, c).fill = HEAD, BLUE_FILL
        for r, row in enumerate(rows, 2):
            for c, v in enumerate(row, 1):
                t.cell(r, c, v).font = ARIAL9
        for c in range(1, len(head) + 1):
            t.column_dimensions[chr(64 + c)].width = 60 if head[c - 1] in ("Item", "Title") else 22
    wb.save(path)


def write_books(out: Path, state: dict, log=print, suffix: str = "") -> list[Path]:
    """The take-off and the bill, in the house formats, from a run's items."""
    items, decisions = state["items"], state["decisions"]
    titles, sheet_names = decisions["section_titles"], decisions["sheet_names"]
    order = [s for s in POMI_ORDER if s in items and items[s]]
    for s in order:
        assign_codes(s, items[s])
        tot = {}
        for it in items[s]:
            tot[it.unit] = tot.get(it.unit, 0) + bill_qty(it.quantity())
        log(f"   Section {s}: {len(items[s])} items {tot}")
    used = {ln.ref for s in order for it in items[s] for ln in it.lines}
    reg = [i for i in state["register"] if i.drawing_no in used]
    project, rev = state["project"], state["rev"]
    out.mkdir(parents=True, exist_ok=True)
    tk = out / f"{project} - Take-off - Rev {rev}{suffix}.xlsx"
    write_takeoff(tk, [(s, titles.get(s, s), items[s]) for s in order], state["ident"], decisions, reg,
                  state["drawing_paths"], state["notes"])
    bill = decisions["bill_no"]
    bq = out / f"{project} - BOQ Unpriced - Bill No.{bill} - Rev {rev}{suffix}.xlsx"
    write_boq(bq, state["band"], [(s, titles.get(s, s), sheet_names.get(s, titles.get(s, s)), idx, items[s])
                                  for idx, s in enumerate(order, 1)], bill, decisions["summary_ref"])
    return [tk, bq]


def write_gaps(out: Path, gaps: list, project: str, rev: str) -> Path:
    """Every gap, one workbook."""
    from openpyxl import Workbook
    gaps = sorted({g.key(): g for g in gaps}.values(), key=lambda g: (g.section, g.sheet, g.field))
    wb = Workbook()
    ws = wb.active
    ws.title = "GAPS"
    ws["A1"] = f"{project} - GAPS, Rev {rev}: everything the run could not resolve. Nothing here was assumed."
    ws["A1"].font = TITLE
    for c, h in enumerate(("Section", "Sheet", "Field", "Reason"), 1):
        ws.cell(2, c, h).font, ws.cell(2, c).fill = HEAD, BLUE_FILL
    for r, g in enumerate(gaps, 3):
        for c, v in enumerate((g.section or "(all)", g.sheet, g.field, g.reason), 1):
            ws.cell(r, c, v).font = ARIAL9
    for col, w in (("A", 9), ("B", 24), ("C", 26), ("D", 120)):
        ws.column_dimensions[col].width = w
    gp = out / f"{project} - GAPS - Rev {rev}.xlsx"
    wb.save(gp)
    return gp


def export_with_manual(run_out: Path, dest: Path, measures: list, library: list, sheet_info: dict,
                       corrections: list = ()) -> tuple[list, list]:
    """Re-issue a run's take-off and bill with the manual measurements merged in (the run itself is untouched).
    Hand corrections to the automatic take-off are made first and it is measured again, so the gaps are
    re-issued too. Returns (files written, notes on what could not be exported)."""
    from boq_arch.manual import merge_into
    with open(run_out / "state.pkl", "rb") as fh:
        state = pickle.load(fh)
    gaps, problems = None, []
    if corrections and "facts" in state:
        from boq_arch.corrections import rebuild
        rb = rebuild(state, list(corrections))
        state, gaps = dict(state, items=rb["items"]), rb["facts"].gaps
    else:
        if corrections:
            problems.append("this run was made before corrections could be measured again - run the drawings again "
                            "to include them")
        state = dict(state, items=copy.deepcopy(state["items"]))
    problems += merge_into(state["items"], measures, library, sheet_info)
    for p in dest.glob("*.xlsx") if dest.exists() else []:
        p.unlink()
    files = write_books(dest, state, log=lambda *_: None)
    if gaps is not None:
        files.append(write_gaps(dest, gaps, state["project"], state["rev"]))
    return files, problems


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("drawings", type=Path)
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--rev", default="00")
    ap.add_argument("--providers", default="claude,openai,gemini,claude-login")
    ap.add_argument("--readings", type=Path, default=None)
    ap.add_argument("--decisions", type=Path, default=None)
    ap.add_argument("--project", default=None)
    ap.add_argument("--no-overlays", action="store_true")
    ap.add_argument("--previous", type=Path, default=None,
                    help="output folder (or evidence.json) of the previous revision's run, to report what changed")
    ap.add_argument("--workers", type=int, default=None,
                    help="worker processes for the per-sheet stages (default: up to 8; 1 runs everything here)")
    a = ap.parse_args(argv)
    from boq_arch.parallel import default_workers, pool
    with pool(a.workers or default_workers()):
        return run(a)


def _pending_for(readings: Path, folders: list, infos) -> list[str]:
    """The readings still waiting for THIS run's drawings. The readings folder is shared by every run and every
    project, so listing all of its requests blamed a set for another's sheets (a 61-sheet run said 68). A request
    is this run's when it is for one of its drawing files (the SHA-1 it is stamped with) or one of its drawing
    numbers (an elevation's finishes are read off a marked copy of the sheet)."""
    import hashlib
    mine = {hashlib.sha1(q.read_bytes()).hexdigest() for d in folders if Path(d).is_dir()
            for q in Path(d).rglob("*.pdf")}
    numbers = {i.drawing_no for i in infos}
    out = []
    for req in readings.glob("*.request"):
        try:
            stamp = json.loads((req / "request.json").read_text(encoding="utf-8"))["_stamp"]
        except (OSError, ValueError, KeyError):
            stamp = {}
        try:        # answered since: a request folder left behind beside its reading is not waiting for anyone
            saved = json.loads((readings / (req.name[:-len(".request")] + ".json")).read_text(encoding="utf-8"))
            if stamp and all(saved.get("_stamp", {}).get(k) == v for k, v in stamp.items()):
                continue
        except (OSError, ValueError):
            pass
        if stamp.get("sheet_sha1") in mine or req.name.split(".")[0] in numbers:
            out.append(req.name)
    return sorted(out)


def run(a) -> int:
    t0 = time.time()
    here = Path(__file__).resolve().parent
    out = a.out or (here / "output")
    readings = a.readings or (here / "readings")
    decisions = dec.load(a.decisions or (a.drawings / "decisions.json"))
    providers = [p for p in a.providers.split(",") if p]

    f = gather(a.drawings, readings, providers, converted_dir=out / "converted")
    pre_gaps = list(f.gaps)           # the gaps before the rules run: a re-measure with corrections starts here
    print("S5 measure - POMI rules")
    items = build(f, decisions)

    ident = f.identity
    project = a.project or safe(f"{ident.get('plot', '')} {ident.get('job_title', '')}".strip()) or "Project"
    band = {"client": ident.get("owner", ""), "project": ident.get("job_title", ""),
            "package": decisions["package"],
            "building": f"PLOT NO. {ident.get('plot', '')} - {ident.get('community', '')}".strip(" -")}
    titles = decisions["section_titles"]
    order = [s for s in POMI_ORDER if s in items and items[s]]
    drawing_paths = {i.drawing_no: i.path for i in f.infos}
    gaps_sorted = sorted({g.key(): g for g in f.gaps}.values(), key=lambda g: (g.section, g.sheet, g.field))

    print("S6 render - one take-off workbook and one bill workbook, as the house samples")
    heights = "; ".join(f"{k} {v['height']:.2f} m" for k, v in f.storeys.items() if v.get("height"))
    levels = f.readings.get((f.levels_sheet, "levels"), (None, ""))[0]
    why = ("no section sheet in the set" if not f.levels_sheet else
           f"drawing {f.levels_sheet} has not been read yet - see the gaps" if levels is None else
           f"drawing {f.levels_sheet} shows levels, but none marked as a floor or slab level (FFL, SSL)"
           if levels.get("levels") else f"drawing {f.levels_sheet} shows no storey levels")
    notes = [f"Storey heights from {f.levels_sheet}: {heights}" if heights else
             f"Storey heights: none read ({why}) - nothing is measured by height"]
    # the plans without their drawings, to measure again with hand corrections (see corrections.py)
    kept = copy.copy(f)
    kept.plans, kept.readings = [p.snapshot() for p in f.plans], {}
    state = {"items": {s: items[s] for s in order}, "ident": ident, "decisions": decisions, "band": band,
             "project": project, "rev": a.rev, "register": f.infos, "drawing_paths": drawing_paths, "notes": notes,
             "facts": kept, "pre_gaps": pre_gaps}
    out.mkdir(parents=True, exist_ok=True)
    with open(out / "state.pkl", "wb") as fh:          # the platform re-exports from this with manual measurements
        pickle.dump(state, fh)
    written = write_books(out, state, log=print)

    written.append(write_gaps(out, gaps_sorted, project, a.rev))
    # every shape measured and what each bill line came from, for the platform's Measure workspace
    from boq_arch.shapes import run_data
    (out / "shapes.json").write_text(json.dumps(run_data(state, {"items": state["items"], "facts": f}, [])),
                                     encoding="utf-8")

    # evidence for the next revision, and the diff against the previous one
    ev = revision.evidence(f, {s: items[s] for s in order}, ident, a.rev)
    (out / "evidence.json").write_text(json.dumps(ev, indent=1, default=str), encoding="utf-8")
    prev = revision.load(a.previous)
    changes = None
    if prev is not None:
        print(f"S6b revision - comparing with {prev.get('rev')} ({a.previous})")
        changes = revision.diff(prev, ev)
        (out / "revision_changes.json").write_text(json.dumps(changes, indent=1, default=str), encoding="utf-8")
        rc = out / f"{project} - Revision Changes - Rev {prev.get('rev')} to {a.rev}.xlsx"
        write_revision_book(rc, changes)
        written.append(rc)
        print(f"   {changes['summary']}")

    markup_records = []
    if not a.no_overlays:
        print("S7 markup - every drawing read from, in trade colours")
        for old in (out / "overlays").glob("*.pdf") if (out / "overlays").exists() else []:
            old.unlink()
        markup_records = write_markups(f, {s: items[s] for s in order}, out, changes)
        written += [out / "overlays" / r["file"] for r in markup_records]
    (out / "markups.json").write_text(json.dumps(markup_records, indent=1), encoding="utf-8")
    counts = {k: {"mark": c.mark, "schedule": c.schedule, "schedule_sheet": c.schedule_sheet, "location": c.location,
                  "plan": c.plan, "outside": c.outside, "plan_total": c.plan_total, "status": c.status, "note": c.note}
              for k, c in sorted(f.counts.items())}
    (out / "counts.json").write_text(json.dumps(counts, indent=1), encoding="utf-8")
    cals = {p.dn: p.cal for p in f.plans} | {e.dn: e.cal for e in f.elevations if e.cal.mm_per_pt}
    sheets = [{"drawing": i.drawing_no, "title": i.title, "title_basis": i.title_basis, "kind": i.kind,
               "class": i.page_class,
               "title_block": i.tb_method, "file": i.path.name, "path": str(i.path), "scale": i.scale,
               "floor": ", ".join(i.floors),
               # the calibrated scale (plans measured from the PDF; a CAD sheet's own units do not apply to its PDF)
               "mm_per_pt": cals[i.drawing_no].mm_per_pt if i.drawing_no in cals and i.page_class != "CAD" else None,
               "basis": cals[i.drawing_no].basis if i.drawing_no in cals and i.page_class != "CAD" else ""}
              for i in f.infos]
    (out / "sheets.json").write_text(json.dumps(sheets, indent=1), encoding="utf-8")
    from boq_arch.assemblies import assembly
    used = sorted({it.clause for s in order for it in items[s]})
    asm = [{"clause": c, "unit": (x := assembly(c, decisions["deduct_threshold_m2"])).unit, "formula": x.formula,
            "formula_text": x.formula_text, "deduct": x.deduct_threshold, "describe": [w for w, _ in x.describe],
            "items": [f"{it.code} {it.description}" for s in order for it in items[s] if it.clause == c]}
           for c in used]
    (out / "assemblies.json").write_text(json.dumps(asm, indent=1), encoding="utf-8")

    run = {"project": project, "identity": ident, "rev": a.rev, "seconds": round(time.time() - t0),
           "drawings_folder": str(a.drawings.resolve()),
           "sections": {s: [{"code": it.code, "description": it.description, "unit": it.unit,
                             "quantity": round(it.quantity(), 2), "bill_quantity": bill_qty(it.quantity()),
                             "origins": it.origins(), "clause": it.clause, "open": bool(getattr(it, "open", False))}
                            for it in items[s]] for s in order},
           "storeys": f.storeys, "gaps": len(gaps_sorted),
           "gaps_by_section": {k: sum(1 for g in gaps_sorted if (g.section or "(all)") == k)
                               for k in sorted({g.section or "(all)" for g in gaps_sorted})},
           "drawings": {i.drawing_no: i.title for i in f.infos},
           "section_titles": {s: titles.get(s, s) for s in order},
           "pending_readings": _pending_for(readings, [a.drawings, out / "converted"], f.infos),
           "readings_used": {f"{dn}.{t}": how for (dn, t), (_, how) in sorted(f.readings.items())},
           "files": [str(p) for p in written]}
    (out / "run.json").write_text(json.dumps(run, indent=1, default=str), encoding="utf-8")
    print(f"done in {run['seconds']} s: {len(written)} files in {out}; {len(gaps_sorted)} gaps; "
          f"{len(run['pending_readings'])} readings pending")
    return 0


if __name__ == "__main__":
    sys.exit(main())
