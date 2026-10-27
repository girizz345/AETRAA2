#!/usr/bin/env python3
"""
requests.py — the readings the agent could not make itself, answered by hand
or by the user's own Claude Code session.

When something the agent needs is drawn as graphics - a door / window
schedule, a title block, a grid's dimension chain, the levels, the notes - and
the model is not reachable (--no-ai, no sign-in, a timeout), readers/transcribe.py
leaves a REQUEST folder: readings/<name>.<task>.request/ with request.json
(the prompt, the answer's schema, the sheet's SHA-1) and the tiles to read.
The bill stays PARTIAL until it is answered (S16, "unread_schedule").

This is the other half: list what is waiting, show one, and save an answer in
the saved-reading format - checked against the task's schema and stamped with
the request's SHA-1 - so the next run uses it like any other saved reading.
The same rules as a live reading hold: copy what is printed, never measure,
total, scale or infer (DECISIONS.md 11).

  python3 -m readers.requests list
  python3 -m readers.requests show  "<request folder>"
  python3 -m readers.requests save  "<request folder>" answer.json [--by "..."]

Exit 0 = done. Exit 1 = nothing waiting / not found. Exit 2 = the answer does
not fit the task's schema (the reason is printed; nothing is written).
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from readers import transcribe                                    # noqa: E402


def pending(folder: Path | None = None) -> list[dict]:
    """Every request waiting in the readings folder, sorted by name."""
    folder = Path(folder or transcribe.READINGS)
    out = []
    for d in sorted(folder.glob("*.request")) if folder.is_dir() else []:
        try:
            req = json.loads((d / "request.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        out.append({"folder": d, "sheet": req.get("sheet"), "task": req["_stamp"]["task"],
                    "answer_to": req.get("answer_to"),
                    "tiles": [d / t for t in req.get("tiles") or []], "request": req})
    return out


def find(name: str, folder: Path | None = None) -> dict | None:
    """A request by its folder path or name, or by the sheet it is for."""
    p = Path(name)
    where = p.parent if p.is_dir() else folder
    for r in pending(where):
        if (p.is_dir() and r["folder"].resolve() == p.resolve()) \
                or name.rstrip("/\\") in (r["folder"].name, r["sheet"]):
            return r
    return None


def why_invalid(task: str, answer) -> str | None:
    """What stops the answer being used, or None when it fits."""
    if isinstance(answer, list) and len(answer) == 1:
        answer = answer[0]
    if not isinstance(answer, dict):
        return "the answer must be one JSON object"
    missing = [k for k in transcribe.TASKS[task]["schema"]["required"] if k not in answer]
    if missing:
        return f"missing field(s): {', '.join(missing)}"
    if task == "schedule":
        bad = [i for i, r in enumerate(answer["rows"]) if not isinstance(r, dict) or not r.get("mark")]
        if bad:
            return f"row(s) {bad} carry no mark"
    return None if transcribe._valid(task, answer) is not None else "the answer does not fit the task"


def save(request: dict, answer, by: str) -> Path:
    """Write the answer where the next run finds it, then clear the request."""
    task = request["task"]
    reading = transcribe._valid(task, answer)
    stamp = dict(request["request"]["_stamp"])
    out = request["folder"].parent / request["answer_to"]
    doc = {"_stamp": stamp, "_by": by, "_sheet": request["sheet"], "reading": reading}
    tmp = out.with_suffix(".tmp")
    tmp.write_text(json.dumps(doc, indent=1, ensure_ascii=False), encoding="utf-8")
    tmp.replace(out)
    shutil.rmtree(request["folder"], ignore_errors=True)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Readings the agent left for someone to make.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    s = sub.add_parser("show")
    s.add_argument("request")
    v = sub.add_parser("save")
    v.add_argument("request")
    v.add_argument("answer", help="a JSON file holding the answer")
    v.add_argument("--by", default=f"Claude Code (visual reading, {date.today():%d-%m-%Y})")
    args = ap.parse_args()

    if args.cmd == "list":
        waiting = pending()
        if not waiting:
            print("nothing waiting - every drawn schedule and title block has a reading")
            return 1
        for r in waiting:
            print(f"{r['folder'].name}\n    sheet {r['sheet']}  task {r['task']}  "
                  f"{len(r['tiles'])} tile(s)  answer goes to {r['answer_to']}")
        return 0

    r = find(args.request)
    if r is None:
        print(f"no request {args.request!r} in {transcribe.READINGS}")
        return 1
    if args.cmd == "show":
        print(f"sheet   {r['sheet']}\ntask    {r['task']}\n")
        print(r["request"]["prompt"])
        print("\nAnswer with ONE JSON object that fits this schema:")
        print(json.dumps(r["request"]["schema"], indent=1))
        print("\nTiles to look at (overlapping parts of one sheet - an item in two tiles is ONE item):")
        for t in r["tiles"]:
            print(f"  {t}")
        return 0

    answer = json.loads(Path(args.answer).read_text(encoding="utf-8"))
    why = why_invalid(r["task"], answer)
    if why:
        print(f"not saved - {why}")
        return 2
    out = save(r, answer, args.by)
    print(f"saved {out.name} - the next run uses it")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
