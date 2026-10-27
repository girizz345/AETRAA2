"""The Measure workspace: click-to-measure on the raw drawing, symbol counting, custom assemblies,
annotations, revision overlay and export - PlanSwift's hands-on tools - and the automatic take-off drawn
over the same drawing: every wall, room and tag it measured, which bill line each one feeds, and hand
corrections to them (corrections.py), measured again by the rules.

Everything is in sheet points (the displayed page, 1/72 inch); the browser draws in the same units over
the raw rendering, so a click is a sheet coordinate and the scale turns it into metres.
"""
from __future__ import annotations

import hashlib
import json
import pickle
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from flask import Blueprint, abort, jsonify, request, send_file, url_for

from boq_arch import corrections as corr
from boq_arch import manual
from boq_arch.manual import Store, load_library, outputs_of, save_library, validate_assembly
from boq_arch.shapes import run_data, sheet_view

bp = Blueprint("ws", __name__)
CTX: dict = {}               # set by init(): jobs, job, page, previous_for, root
RAW_DPI = 150
_sheets: dict = {}           # path -> Sheet (a few kept open)
_snap: dict = {}
_size: dict = {}
_states: dict = {}           # job id -> (state.pkl mtime, state)
_auto: dict = {}             # job id -> (its corrections, the take-off measured with them)


def init(**kw):
    CTX.update(kw)


def _job(jid):
    return CTX["job"](jid)


def _mdir(j) -> Path:
    return Path(j["out"]).parent / "manual"


def _store(j) -> Store:
    return Store.open(_mdir(j))


def library_path() -> Path:
    return CTX["root"] / "assemblies_library.json"


def _sheet(path: str):
    from boq_arch.sheet import Sheet
    if path not in _sheets:
        if len(_sheets) > 6:
            _sheets.pop(next(iter(_sheets))).close()
        _sheets[path] = Sheet(Path(path))
    return _sheets[path]


def _sha(path: str) -> str:
    return hashlib.sha1(Path(path).read_bytes()).hexdigest()[:16]


def sheets_of(j) -> list[dict]:
    """Every document of a run: the registered sheets, then any other drawing file (a scan whose title block
    could not be read, a converted image or DXF) - all can be measured by hand."""
    import pymupdf
    out = Path(j["out"])
    p = out / "sheets.json"
    reg = json.loads(p.read_text(encoding="utf-8")) if p.exists() else []
    res, have = [], set()
    roots = [Path(j["drawings"]), out / "converted"]
    for x in reg:
        path = Path(x["path"]) if x.get("path") else next(
            (q for r in roots if r.exists() for q in r.rglob(x["file"])), None)
        if path is None or not path.exists():
            continue
        have.add(path.resolve())
        res.append({"key": x["drawing"], "drawing": x["drawing"], "title": x["title"], "kind": x["kind"],
                    "floor": x.get("floor", ""), "path": str(path), "registered": True,
                    "auto_mm_per_pt": x.get("mm_per_pt"), "auto_basis": x.get("basis", ""), "scale": x.get("scale", "")})
    for r in roots:
        for q in sorted(r.rglob("*.pdf")) if r.exists() else []:
            if q.resolve() in have:
                continue
            have.add(q.resolve())
            res.append({"key": "F-" + hashlib.sha1(str(q.resolve()).encode()).hexdigest()[:10], "drawing": q.stem,
                        "title": q.name, "kind": "document", "floor": "", "path": str(q), "registered": False,
                        "auto_mm_per_pt": None, "auto_basis": "", "scale": ""})
    scales = _store(j).scales
    for s in res:
        if s["path"] not in _size:
            d = pymupdf.open(s["path"])
            _size[s["path"]] = (d[0].rect.width, d[0].rect.height)
            d.close()
        s["w"], s["h"] = _size[s["path"]]
        man = scales.get(s["key"])
        s["mm_per_pt"] = man["mm_per_pt"] if man else s["auto_mm_per_pt"]
        s["basis"] = man["basis"] if man else (s["auto_basis"] and f"calibrated automatically: {s['auto_basis']}")
    return res


def _sheet_map(j) -> dict:
    return {s["key"]: s for s in sheets_of(j)}


def _state(j) -> dict | None:
    """The run's saved state, if it keeps its plans (runs made before corrections do not)."""
    p = Path(j["out"]) / "state.pkl"
    if not p.exists():
        return None
    hit = _states.get(j["id"])
    if not hit or hit[0] != p.stat().st_mtime:
        with open(p, "rb") as fh:
            hit = _states[j["id"]] = (p.stat().st_mtime, pickle.load(fh))
    return hit[1] if "facts" in hit[1] else None


def _auto_data(j) -> dict | None:
    """The automatic take-off with this run's corrections - measured again only when they change."""
    cs = corr.load(_mdir(j))
    sig = json.dumps(cs, sort_keys=True)
    hit = _auto.get(j["id"])
    if hit and hit[0] == sig:
        return hit[1]
    state = _state(j)
    if state is None:
        return None
    shapes = Path(j["out"]) / "shapes.json"
    data = json.loads(shapes.read_text(encoding="utf-8")) if not cs and shapes.exists() else \
        run_data(state, corr.rebuild(state, cs), cs)
    _auto[j["id"]] = (sig, data)
    return data


def _auto_view(j, key: str, **extra):
    data = _auto_data(j)
    if data is None:
        return jsonify(available=False, reason="This run was made before the automatic take-off could be shown "
                                               "here - run the drawings again to see and correct it.")
    return jsonify(dict(sheet_view(data, key), available=True, **extra))


def _lib() -> list[dict]:
    return load_library(library_path())


def _calc(m, sm, lib) -> dict:
    s = sm.get(m["sheet"], {})
    a = next((x for x in lib if x["id"] == m.get("assembly")), None)
    raw, outs, problem = outputs_of(m, a, s.get("mm_per_pt"))
    nr = max(1, int(m.get("nr") or 1))
    for o in outs:
        o["total"] = round(o["qty"] * nr, 3)
    return {"raw": raw, "outs": outs, "problem": problem}


def _with_calc(ms, sm, lib):
    return [dict(m, calc=_calc(m, sm, lib)) for m in ms]


def _sheet_info(sm) -> dict:
    return {k: {"drawing": s["drawing"], "mm_per_pt": s["mm_per_pt"], "basis": s["basis"] or ""} for k, s in sm.items()}


def _other_runs(j) -> list[dict]:
    res = []
    for o in CTX["jobs"].values():
        if o["id"] == j["id"] or o["status"] != "done":
            continue
        p = Path(o["out"]) / "sheets.json"
        if p.exists():
            res.append({"id": o["id"], "when": time.strftime("%d %b %Y %H:%M", time.localtime(o["created"])),
                        "rev": o.get("rev", ""), "drawings": [x["drawing"] for x in json.loads(p.read_text(encoding="utf-8"))],
                        "measures": len(_store(o).measures) if (_mdir(o) / "measures.json").exists() else 0,
                        "corrections": len(corr.load(_mdir(o))),
                        "created": o["created"]})
    return sorted(res, key=lambda r: -r["created"])


# ------------------------------------------------------------------ data

@bp.get("/job/<jid>/api/ws")
def api_ws(jid):
    j = _job(jid)
    sm = _sheet_map(j)
    lib = _lib()
    st = _store(j)
    runs = _other_runs(j)
    mine = {s["drawing"] for s in sm.values()}
    cands = [r for r in runs if (r["measures"] or r["corrections"]) and r["created"] < j["created"]
             and mine & set(r["drawings"])]
    carry = next((r for r in cands if r["id"] == j.get("previous_id")), cands[0] if cands else None)
    fixes = {}
    for c in corr.load(_mdir(j)):
        fixes[c["sheet"]] = fixes.get(c["sheet"], 0) + 1
    if st.measures or fixes:
        carry = None
    return jsonify(sheets=list(sm.values()), measures=_with_calc(st.measures, sm, lib), library=lib,
                   runs=[{k: r[k] for k in ("id", "when", "rev", "drawings")} for r in runs],
                   carry=carry, fixes=fixes)


@bp.get("/job/<jid>/api/auto/<key>")
def api_auto(jid, key):
    """One plan's automatic take-off: its shapes, each item's lines on it, and what corrections changed."""
    return _auto_view(_job(jid), key)


@bp.post("/job/<jid>/api/correct")
def api_correct(jid):
    """Make (or replace) a correction to the automatic take-off, and measure it again."""
    j = _job(jid)
    state = _state(j)
    if state is None:
        return jsonify(ok=False, problems=["this run keeps no plans to correct - run the drawings again"]), 400
    d = request.get_json(force=True)
    s = _sheet_map(j).get(d.get("sheet"))
    if s:
        d["sha"] = _sha(s["path"])
    c, why = corr.check(state, d)
    if c is None:
        return jsonify(ok=False, problems=[why]), 400
    corr.save(_mdir(j), corr.put(corr.load(_mdir(j)), c))
    return _auto_view(j, c["sheet"], ok=True, correction=c)


@bp.delete("/job/<jid>/api/correct/<cid>")
def api_uncorrect(jid, cid):
    j = _job(jid)
    cs = corr.load(_mdir(j))
    c = next((x for x in cs if x["id"] == cid), None) or abort(404)
    corr.save(_mdir(j), [x for x in cs if x["id"] != cid])
    return _auto_view(j, c["sheet"], ok=True, removed=c)


@bp.get("/job/<jid>/raw/<key>.png")
def raw_png(jid, key):
    j = _job(jid)
    s = _sheet_map(j).get(key) or abort(404)
    cache = _mdir(j) / "_png" / f"{key}.png"
    if not cache.exists() or cache.stat().st_mtime < Path(s["path"]).stat().st_mtime:
        cache.parent.mkdir(parents=True, exist_ok=True)
        _sheet(s["path"]).page.get_pixmap(dpi=RAW_DPI, alpha=False).save(cache)
    return send_file(cache, max_age=3600)


@bp.get("/job/<jid>/api/snap/<key>")
def api_snap(jid, key):
    """Line ends of the sheet's own drawing (underlays left out), to snap clicks to - as tenths of a point."""
    j = _job(jid)
    s = _sheet_map(j).get(key) or abort(404)
    if s["path"] not in _snap:
        segs = _sheet(s["path"]).own_segments
        pts = np.array([(g.x0, g.y0) for g in segs] + [(g.x1, g.y1) for g in segs], dtype=np.float64).reshape(-1, 2)
        pts = np.unique(np.round(pts * 10).astype(np.int32), axis=0) if len(pts) else np.zeros((0, 2), np.int32)
        _snap[s["path"]] = pts.ravel().tolist()
    return jsonify(pts=_snap[s["path"]])


@bp.post("/job/<jid>/api/measure")
def api_save(jid):
    j = _job(jid)
    m = request.get_json(force=True)
    sm = _sheet_map(j)
    if m.get("sheet") not in sm or not isinstance(m.get("points"), list):
        abort(400, "measurement needs a sheet and points")
    m["points"] = [[round(float(x), 2), round(float(y), 2)] for x, y in m["points"]]
    m["sha"] = m.get("sha") or _sha(sm[m["sheet"]]["path"])
    m.pop("calc", None)
    m = _store(j).add(m)
    return jsonify(dict(m, calc=_calc(m, sm, _lib())))


@bp.delete("/job/<jid>/api/measure/<mid>")
def api_delete(jid, mid):
    _store(_job(jid)).delete(mid)
    return jsonify(ok=True)


@bp.post("/job/<jid>/api/preview")
def api_preview(jid):
    j = _job(jid)
    m = request.get_json(force=True)
    return jsonify(_calc(m, _sheet_map(j), _lib()))


@bp.post("/job/<jid>/api/scale")
def api_scale(jid):
    """Set a sheet's scale: from two clicked points and their real distance, from a ratio (1:100), or clear it."""
    j = _job(jid)
    d = request.get_json(force=True)
    st = _store(j)
    key = d["key"]
    if "restore" in d:                      # undo: put back the scale that was there before (none = automatic)
        if d["restore"]:
            st.scales[key] = {"mm_per_pt": float(d["restore"]["mm_per_pt"]), "basis": str(d["restore"]["basis"])}
        else:
            st.scales.pop(key, None)
    elif d.get("clear"):
        st.scales.pop(key, None)
    elif d.get("ratio"):
        r = float(d["ratio"])
        st.scales[key] = {"mm_per_pt": r * 25.4 / 72, "basis": f"set by hand: 1:{r:g} (as printed)"}
    else:
        (x0, y0), (x1, y1) = d["p1"], d["p2"]
        pts = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
        mm = float(d["mm"])
        if pts < 2 or mm <= 0:
            abort(400, "pick two points further apart and give a real length")
        st.scales[key] = {"mm_per_pt": mm / pts, "basis": f"set by hand: {mm:g} mm between two picked points"}
    st.save()
    sm = _sheet_map(j)
    return jsonify(sheet=sm[key], measures=_with_calc(st.measures, sm, _lib()))


@bp.post("/job/<jid>/api/similar")
def api_similar(jid):
    from boq_arch.symbols import find_similar
    j = _job(jid)
    d = request.get_json(force=True)
    s = _sheet_map(j).get(d["key"]) or abort(404)
    r = find_similar(_sheet(s["path"]), tuple(d["box"]), float(d.get("threshold", 0.62)))
    return jsonify(r)


@bp.route("/job/<jid>/api/library", methods=["GET", "POST"])
def api_library(jid):
    if request.method == "GET":
        return jsonify(library=_lib())
    lib = request.get_json(force=True)
    ids = [a.get("id") for a in lib]
    problems = [f"two assemblies share the id '{i}'" for i in set(ids) if ids.count(i) > 1]
    for a in lib:
        if not a.get("id") or not a.get("name"):
            problems.append("every assembly needs an id and a name")
        problems += [f"{a.get('name')}: {p}" for p in validate_assembly(a)]
    if problems:
        return jsonify(ok=False, problems=problems), 400
    save_library(lib, library_path())
    return jsonify(ok=True, library=lib)


@bp.get("/api/clauses")
def api_clauses():
    from boq_arch.assemblies import _table, unit_of
    res = []
    for cid, c in _table().items():
        if cid.startswith("GP") or not c.get("unit_raw"):
            continue
        res.append({"id": cid, "unit": unit_of(cid), "text": (c.get("text") or "")[:160]})
    return jsonify(clauses=res)


@bp.post("/api/try")
def api_try():
    d = request.get_json(force=True)
    try:
        return jsonify(ok=True, value=round(manual.evaluate(d["formula"], {k: float(v) for k, v in d["names"].items()}), 4))
    except Exception as e:
        return jsonify(ok=False, error=str(e))


@bp.post("/job/<jid>/api/carry")
def api_carry(jid):
    """Bring an earlier run's manual measurements onto this run's sheets (same drawing number)."""
    j = _job(jid)
    src = CTX["jobs"].get(request.get_json(force=True).get("from")) or abort(404)
    sm = _sheet_map(j)
    by_dn = {s["drawing"]: s for s in sm.values()}
    old = _sheet_map(src)
    st = _store(j)
    n, changed, lost = 0, set(), set()
    for m in _store(src).measures:
        dn = old.get(m["sheet"], {}).get("drawing", m["sheet"])
        s = by_dn.get(dn)
        if s is None:
            lost.add(dn)
            continue
        sha = _sha(s["path"])
        new = dict(m, id=None, sheet=s["key"], carried_from=src["id"], sha=sha, sheet_changed=sha != m.get("sha"))
        new.pop("id")
        if new["sheet_changed"]:
            changed.add(dn)
        st.add(new)
        n += 1
    for k, v in _store(src).scales.items():
        dn = old.get(k, {}).get("drawing")
        if dn in by_dn and by_dn[dn]["key"] not in st.scales:
            st.scales[by_dn[dn]["key"]] = v
    st.save()
    # corrections to the automatic take-off: the same shapes on an unchanged sheet, found again on a revised one
    fixed, not_placed = [], []
    state = _state(j)
    theirs = corr.load(_mdir(src))
    if theirs and state is not None:
        fixed, not_placed = corr.carry(theirs, state, lambda dn: _sha(by_dn[dn]["path"]) if dn in by_dn else "")
        cs = corr.load(_mdir(j))
        for c in fixed:
            cs = corr.put(cs, c)
        corr.save(_mdir(j), cs)
        changed |= {c["sheet"] for c in fixed if c.get("sheet_changed")}
    elif theirs:
        not_placed = [f"{len(theirs)} correction(s): this run keeps no plans to correct - run the drawings again"]
    return jsonify(carried=n, corrected=len(fixed), not_placed=not_placed, changed=sorted(changed), lost=sorted(lost))


def diff_image(new: np.ndarray, old: np.ndarray) -> np.ndarray:
    """Two greyscale renderings -> BGR: ink in both grey, only in the old red (removed), only in the new green (added).
    A pixel of slack either way, so the same line rendered a hair apart is not a change."""
    import cv2
    if old.shape != new.shape:
        old = cv2.resize(old, (new.shape[1], new.shape[0]), interpolation=cv2.INTER_AREA)
    k = np.ones((3, 3), np.uint8)
    a, b = (new < 170).astype(np.uint8), (old < 170).astype(np.uint8)
    added = (a > 0) & (cv2.dilate(b, k) == 0)
    removed = (b > 0) & (cv2.dilate(a, k) == 0)
    img = np.full(new.shape + (3,), 255, np.uint8)
    img[(a > 0) | (b > 0)] = (185, 185, 185)
    img[removed] = (40, 40, 220)
    img[added] = (40, 160, 20)
    return img


@bp.get("/job/<jid>/compare/<key>.png")
def compare_png(jid, key):
    """The sheet over the same drawing in another run: unchanged grey, removed red, added green."""
    import cv2
    import pymupdf
    j = _job(jid)
    other = CTX["jobs"].get(request.args.get("with", "")) or abort(404)
    s = _sheet_map(j).get(key) or abort(404)
    o = next((x for x in sheets_of(other) if x["drawing"] == s["drawing"]), None) or abort(404)
    cache = _mdir(j) / "_png" / f"{key}.vs.{other['id']}.png"
    if not cache.exists():
        def grey(path):
            pix = _sheet(path).page.get_pixmap(dpi=RAW_DPI, colorspace=pymupdf.csGRAY, alpha=False)
            return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
        cache.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(cache), diff_image(grey(s["path"]), grey(o["path"])))
    return send_file(cache, max_age=3600)


@bp.post("/job/<jid>/api/export")
def api_export(jid):
    """Re-issue the take-off and bill with the manual measurements, plus a measurement list and marked-up PDFs."""
    import boq
    j = _job(jid)
    out = Path(j["out"])
    if not (out / "state.pkl").exists():
        return jsonify(ok=False, problems=["this run was made before manual export existed - run the drawings again"]), 400
    sm = _sheet_map(j)
    lib = _lib()
    st = _store(j)
    info = _sheet_info(sm)
    dest = out / "with manual"
    cs = corr.load(_mdir(j))
    files, problems = boq.export_with_manual(out, dest, st.measures, lib, info, cs)
    run = json.loads((out / "run.json").read_text(encoding="utf-8"))
    mb = dest / f"{run['project']} - Manual Measurements - Rev {run['rev']}.xlsx"
    manual.write_measure_book(mb, st.measures, lib, info, f"{run['project']} - manual take-off, corrections and "
                                                           f"annotations, Rev {run['rev']}", cs)
    files.append(mb)
    mk = dest / "marked up"
    for p in mk.glob("*.pdf") if mk.exists() else []:
        p.unlink()
    for key in sorted({m["sheet"] for m in st.measures} | {c["sheet"] for c in cs}):
        s = sm.get(key)
        if s is None:
            continue
        ms = []
        for m in st.measures:
            if m["sheet"] == key:
                c = _calc(m, sm, lib)
                ms.append(dict(m, summary=", ".join(f"{o['item']} {o['total']:g} {o['unit']}" for o in c["outs"])
                               or ", ".join(f"{k} {v:g}" for k, v in c["raw"].items())))
        ms += corr.as_markups([c for c in cs if c["sheet"] == s["drawing"]])
        f = mk / f"{s['drawing']} manual take-off.pdf"
        manual.burn_markup(_sheet(s["path"]), ms, f, f"{s['drawing']} - manual take-off, corrections and "
                                                     f"annotations, Rev {run['rev']} ({time.strftime('%d %b %Y')})")
        files.append(f)
    v = subprocess.run([sys.executable, str(CTX["root"] / "tests" / "verify_outputs.py"), str(dest)],
                       capture_output=True, text=True)
    rel = [str(p.relative_to(out)).replace("\\", "/") for p in files]
    return jsonify(ok=True, problems=problems, verify_ok=v.returncode == 0,
                   verify=(v.stdout + v.stderr).strip().splitlines()[-1:],
                   files=[{"name": Path(r).name, "rel": r,
                           "download": url_for("download", jid=jid, name=r),
                           "bundle": url_for("bundle", jid=jid, name=r) if " - Take-off - " in Path(r).name else None,
                           "view": url_for("view", jid=jid, name=r) if r.endswith(".xlsx") else
                           url_for("download", jid=jid, name=r, inline=1)} for r in rel])


# ------------------------------------------------------------------ pages

@bp.get("/job/<jid>/measure")
def measure_page(jid):
    _job(jid)
    cfg = {"api": url_for("ws.api_ws", jid=jid), "base": f"/job/{jid}", "sheet": request.args.get("sheet", ""),
           "item": request.args.get("item", ""),
           "formulas": url_for("ws.formulas_page", jid=jid)}
    return CTX["page"](jid, "measure", (Path(__file__).parent / "measure.html").read_text(encoding="utf-8")
                       .replace("__CFG__", json.dumps(cfg)))


@bp.get("/measure/guide")
def measure_guide():
    """The step-by-step measuring guide, as a fragment (the Measure page shows it in a window)."""
    return (Path(__file__).parent / "guide.html").read_text(encoding="utf-8")


@bp.get("/help/measure")
def measure_guide_page():
    return CTX["plain_page"]((Path(__file__).parent / "guide.html").read_text(encoding="utf-8"))


@bp.get("/job/<jid>/formulas")
def formulas_page(jid):
    _job(jid)
    cfg = {"lib": url_for("ws.api_library", jid=jid), "measure": url_for("ws.measure_page", jid=jid)}
    return CTX["page"](jid, "formulas", (Path(__file__).parent / "formulas.html").read_text(encoding="utf-8")
                       .replace("__CFG__", json.dumps(cfg)))
