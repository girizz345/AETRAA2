"""Running boq.py as its own process, and many drawing sets at once (batch.py and the platform's Batch page).

Each run is a separate process: its log, its API keys and its worker pool are its own, so runs do not interfere
and several can go side by side. The readings folder is shared (a sheet read once is never read again); readings
are written whole or not at all (vision.write_atomic).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path

from .convert import ACCEPTED

ROOT = Path(__file__).resolve().parents[1]
DRAWING_TYPES = ACCEPTED - {".zip"}           # what a run accepts (PDF, CAD, images)


def has_drawings(folder: Path) -> bool:
    return any(p.suffix.lower() in DRAWING_TYPES for p in Path(folder).rglob("*") if p.is_file())


def find_sets(paths: list[Path], each: bool = False) -> list[tuple[str, Path]]:
    """(name, folder or zip) for every drawing set. each: every sub-folder and .zip inside the (one) folder given is
    a set; otherwise every path given is a set."""
    found: list[Path] = []
    if each:
        for parent in paths:
            found += sorted(p for p in Path(parent).resolve().iterdir()
                            if (p.is_dir() and has_drawings(p)) or p.suffix.lower() == ".zip")
    else:
        found = [Path(p).resolve() for p in paths]
    out, used = [], set()
    for p in found:
        name = re.sub(r"[^\w\-. ()]+", "_", p.stem if p.suffix.lower() == ".zip" else p.name).strip() or "set"
        base, k = name, 2
        while name.lower() in used:
            name, k = f"{base} ({k})", k + 1
        used.add(name.lower())
        out.append((name, p))
    return out


def unpack(zip_path: Path, dest: Path) -> Path:
    """A zipped drawing set, flattened into dest (only drawing files are taken)."""
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        for m in z.infolist():
            if not m.is_dir() and Path(m.filename).suffix.lower() in DRAWING_TYPES:
                with z.open(m) as src, open(dest / Path(m.filename).name, "wb") as dst:
                    dst.write(src.read())
    return dest


def split_workers(runs_at_once: int) -> int:
    """Worker processes each of several runs going at once should use, so together they fill the machine."""
    from .parallel import default_workers
    return max(1, default_workers() // max(1, runs_at_once))


def boq_command(drawings: Path, out: Path, rev: str = "00", providers: str = "claude,openai,gemini,claude-login",
                readings: Path | None = None, workers: int | None = None, previous: Path | None = None) -> list[str]:
    cmd = [sys.executable, "-u", str(ROOT / "boq.py"), str(drawings), "--out", str(out), "--rev", rev,
           "--readings", str(readings or ROOT / "readings"), "--providers", providers]
    if workers:
        cmd += ["--workers", str(workers)]
    if previous is not None:
        cmd += ["--previous", str(previous)]
    return cmd


def run_boq(cmd: list[str], env: dict | None = None, on_line=None) -> int:
    """Run boq.py to the end, handing each line it prints to on_line. Returns its exit code."""
    e = dict(os.environ if env is None else env)
    e["PYTHONIOENCODING"] = "utf-8"
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8",
                            errors="replace", env=e, cwd=str(ROOT))
    for line in proc.stdout:
        if on_line is not None:
            on_line(line)
    return proc.wait()


def verify(out: Path) -> tuple[bool, str]:
    """The house checks every run gets (tests/verify_outputs.py): (passed, its last line)."""
    v = subprocess.run([sys.executable, str(ROOT / "tests" / "verify_outputs.py"), str(out)], capture_output=True,
                       text=True, encoding="utf-8", errors="replace", cwd=str(ROOT))
    last = ((v.stdout + v.stderr).strip().splitlines() or [""])[-1]
    return v.returncode == 0, last


def summary_row(name: str, out: Path, status: str, verify_ok: bool | None = None, verify_msg: str = "",
                seconds: float | None = None) -> dict:
    """One set's line in a batch summary, from its run.json."""
    row = {"set": name, "status": status, "project": "", "plot": "", "revision": "", "seconds": seconds,
           "sections": {}, "gaps": None, "readings_pending": None, "checks": verify_msg,
           "checks_passed": verify_ok, "output": str(out)}
    p = Path(out) / "run.json"
    if p.exists():
        run = json.loads(p.read_text(encoding="utf-8"))
        ident = run.get("identity", {})
        row.update(project=ident.get("job_title", ""), plot=ident.get("plot", ""), revision=run.get("rev", ""),
                   seconds=run.get("seconds", seconds), gaps=run.get("gaps"),
                   readings_pending=len(run.get("pending_readings", [])))
        for s, items in run.get("sections", {}).items():
            tot: dict[str, float] = {}
            for it in items:
                if not it.get("open"):          # an open item is not billed: it is no "0 nr" (as on the job page)
                    tot[it["unit"]] = tot.get(it["unit"], 0) + (it.get("bill_quantity") or 0)
            row["sections"][s] = {"items": len(items), "totals": tot,
                                  "open": sum(1 for it in items if it.get("open"))}
    return row


def write_summary(rows: list[dict], xlsx: Path) -> None:
    """The batch summary: one line per drawing set (and the same as JSON beside it)."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    xlsx.parent.mkdir(parents=True, exist_ok=True)
    xlsx.with_suffix(".json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    secs = sorted({s for r in rows for s in r["sections"]})
    wb = Workbook()
    ws = wb.active
    ws.title = "Batch"
    head = (["Drawing set", "Status", "Project", "Plot", "Revision", "Time (s)"]
            + [f"{s} items" for s in secs] + [f"{s} quantities" for s in secs]
            + ["Gaps", "Readings pending", "Checks", "Output folder"])
    ws.append(head)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="1F4E78")
        c.alignment = Alignment(wrap_text=True, vertical="top")
    for r in rows:
        ws.append([r["set"], r["status"], r["project"], r["plot"], r["revision"], r["seconds"]]
                  + [r["sections"].get(s, {}).get("items") for s in secs]
                  + ["; ".join([f"{v:,.0f} {u}" for u, v in r["sections"].get(s, {}).get("totals", {}).items()]
                               + ([f"{r['sections'][s]['open']} open"] if r["sections"].get(s, {}).get("open") else []))
                     for s in secs]
                  + [r["gaps"], r["readings_pending"],
                     ("passed" if r["checks_passed"] else "FAILED - " + r["checks"]) if r["checks_passed"] is not None else "",
                     r["output"]])
    widths = [28, 10, 36, 10, 9, 9] + [9] * len(secs) + [26] * len(secs) + [7, 10, 30, 60]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[ws.cell(1, i).column_letter].width = w
    ws.freeze_panes = "B2"
    wb.save(xlsx)
