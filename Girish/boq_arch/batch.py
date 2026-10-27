"""Many drawing sets in one go: each set is a full run of boq.py, several at a time.

    python batch.py SET [SET ...]        each SET is a drawing-set folder or a .zip of one
    python batch.py --each FOLDER        every sub-folder and .zip in FOLDER is one drawing set

    options: [--out DIR] [--rev 00] [--parallel N] [--workers M] [--providers claude,openai,gemini] [--readings DIR]

Each set's outputs go to <out>/<set>/ (its log in run.log) and get the same checks as a run on the platform.
<out>/batch_summary.xlsx (and .json) lists every set: project, revision, time, items and quantities per section,
gaps, readings pending and checks. N runs go at once (default 2), each with M worker processes (default: the
machine's cores shared between them). Visual readings need an API key in the environment, as for boq.py; the
readings folder is shared, so a sheet read for one set is not read again for another.
"""
from __future__ import annotations

import argparse
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from boq_arch import batchrun  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sets", nargs="*", type=Path)
    ap.add_argument("--each", type=Path, default=None, help="a folder whose sub-folders and .zip files are drawing sets")
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--rev", default="00")
    ap.add_argument("--parallel", type=int, default=2, help="drawing sets run at once (default 2)")
    ap.add_argument("--workers", type=int, default=None, help="worker processes per run (default: shared out)")
    ap.add_argument("--providers", default="claude,openai,gemini")
    ap.add_argument("--readings", type=Path, default=None)
    a = ap.parse_args(argv)
    if not a.sets and a.each is None:
        ap.error("give drawing sets, or --each FOLDER")

    sets = batchrun.find_sets([a.each] if a.each else a.sets, each=a.each is not None)
    if not sets:
        print("no drawing sets found")
        return 1
    out = a.out or HERE / "batch-output" / time.strftime("%Y%m%d-%H%M%S")
    parallel = max(1, min(a.parallel, len(sets)))
    workers = a.workers or batchrun.split_workers(parallel)
    print(f"{len(sets)} drawing set(s), {parallel} at a time, {workers} worker process(es) each; outputs in {out}")

    lock = threading.Lock()
    done = [0]

    def one(k_name_path):
        k, (name, path) = k_name_path
        dest = out / name
        dest.mkdir(parents=True, exist_ok=True)
        t0 = time.time()
        with lock:
            print(f"[{k}/{len(sets)}] {name}: started")
        try:
            drawings = batchrun.unpack(path, out / "_sets" / name) if path.suffix.lower() == ".zip" else path
            if not batchrun.has_drawings(drawings):
                raise ValueError("no drawings in it (PDF, DWG, DXF, JPG, PNG or TIFF)")
            with open(dest / "run.log", "w", encoding="utf-8") as log:
                rc = batchrun.run_boq(batchrun.boq_command(drawings, dest, a.rev, a.providers, a.readings, workers),
                                      on_line=lambda line: (log.write(line), log.flush()))
            ok, msg = batchrun.verify(dest) if rc == 0 else (None, "")
            status = "done" if rc == 0 else "failed"
        except Exception as e:  # a bad zip or an empty folder: this set fails, the batch goes on
            ok, msg, status = None, "", "failed"
            (dest / "run.log").write_text(f"{type(e).__name__}: {e}\n", encoding="utf-8")
        row = batchrun.summary_row(name, dest, status, ok, msg, round(time.time() - t0))
        with lock:
            done[0] += 1
            if status == "done":
                items = sum(s["items"] for s in row["sections"].values())
                print(f"[{done[0]}/{len(sets)} finished] {name}: done in {row['seconds']} s - {items} items, "
                      f"{row['gaps']} gaps, checks {'passed' if ok else 'FAILED: ' + msg}")
            else:
                print(f"[{done[0]}/{len(sets)} finished] {name}: FAILED - see {dest / 'run.log'}")
        return row

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=parallel) as ex:
        rows = list(ex.map(one, enumerate(sets, 1)))
    batchrun.write_summary(rows, out / "batch_summary.xlsx")
    failed = [r["set"] for r in rows if r["status"] != "done" or r["checks_passed"] is False]
    print(f"batch done in {round(time.time() - t0)} s: {len(rows) - len(failed)} of {len(rows)} set(s) ready; "
          f"summary {out / 'batch_summary.xlsx'}" + (f"; needs attention: {', '.join(failed)}" if failed else ""))
    return 0 if not failed else 2


if __name__ == "__main__":
    sys.exit(main())
