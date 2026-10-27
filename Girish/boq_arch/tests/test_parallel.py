"""Parallel runs give the take-off a run on one core gives, and batch.py runs several drawing sets at once.

    python tests/test_parallel.py [workers]

Runs boq.py on the test set with one worker process and with several (default 4), then batch.py with the test
set twice, two runs at once sharing one readings folder. Every output the platform uses must be the same in all
four: run.json, counts, sheets, assemblies, shapes, evidence, every cell of every workbook and every marked-up
drawing (rendered). Works on a copy of readings/, so the repository is not touched. Takes a few minutes.
"""
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import openpyxl
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "Test Drawigs" / "Architecture"


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def differences(a: Path, b: Path) -> list[str]:
    """What differs between two runs' outputs (nothing, for the same drawings)."""
    out = []
    ra, rb = load(a / "run.json"), load(b / "run.json")
    out += [f"run.json {k}" for k in sorted(set(ra) | set(rb))
            if k not in ("seconds", "files") and ra.get(k) != rb.get(k)]
    out += [f for f in ("counts.json", "sheets.json", "assemblies.json", "markups.json", "shapes.json", "evidence.json")
            if load(a / f) != load(b / f)]
    books = sorted(p.name for p in a.glob("*.xlsx"))
    if books != sorted(p.name for p in b.glob("*.xlsx")):
        out.append("workbook names")
    for n in books:
        wa, wb = openpyxl.load_workbook(a / n), openpyxl.load_workbook(b / n)
        out += [f"{n} / {s}" for s in wa.sheetnames if s not in wb.sheetnames or
                [[c.value for c in r] for r in wa[s].iter_rows()] != [[c.value for c in r] for r in wb[s].iter_rows()]]
    pdfs = sorted(p.name for p in (a / "overlays").glob("*.pdf"))
    if pdfs != sorted(p.name for p in (b / "overlays").glob("*.pdf")):
        out.append("overlay names")
    for n in pdfs:
        pa, pb = pymupdf.open(a / "overlays" / n)[0], pymupdf.open(b / "overlays" / n)[0]
        if pa.get_pixmap(dpi=40).samples != pb.get_pixmap(dpi=40).samples or pa.get_text() != pb.get_text():
            out.append(f"overlay {n}")
    return out


def run(cmd: list[str]) -> float:
    t = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=str(ROOT))
    assert r.returncode == 0, f"{' '.join(cmd[:3])} failed:\n{r.stdout[-1500:]}\n{r.stderr[-1500:]}"
    return time.time() - t


if __name__ == "__main__":
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    tmp = Path(tempfile.mkdtemp(prefix="parallel-"))
    readings = tmp / "readings"
    shutil.copytree(ROOT / "readings", readings)
    common = ["--readings", str(readings), "--providers", ""]
    ok = True

    t1 = run([sys.executable, str(ROOT / "boq.py"), str(SRC), "--out", str(tmp / "one"), "--workers", "1", *common])
    tn = run([sys.executable, str(ROOT / "boq.py"), str(SRC), "--out", str(tmp / "many"), "--workers", str(workers),
              *common])
    d = differences(tmp / "one", tmp / "many")
    print(f"one worker {t1:.0f} s, {workers} workers {tn:.0f} s: " + ("same outputs" if not d else f"DIFFERENT: {d}"))
    ok &= not d

    tb = run([sys.executable, str(ROOT / "batch.py"), str(SRC), str(SRC), "--out", str(tmp / "batch"),
              "--parallel", "2", *common])
    rows = load(tmp / "batch" / "batch_summary.json")
    sets = [r["set"] for r in rows]
    good = sets == ["Architecture", "Architecture (2)"] and all(r["status"] == "done" and r["checks_passed"] for r in rows)
    print(f"batch of 2 at once {tb:.0f} s: {sets}, " + ("both done, checks passed" if good else f"NOT ALL DONE: {rows}"))
    ok &= good
    for name in sets:
        d = differences(tmp / "one", tmp / "batch" / name)
        print(f"   {name}: " + ("same outputs as the one-worker run" if not d else f"DIFFERENT: {d}"))
        ok &= not d
    shutil.rmtree(tmp, ignore_errors=True)
    print("PASSED" if ok else "FAILED", "- parallel and batch runs give the one-worker take-off")
    sys.exit(0 if ok else 1)
