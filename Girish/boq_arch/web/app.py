"""BOQ platform: upload architectural drawings, run the take-off, view the workbooks in the browser.

    python web/app.py            then open http://127.0.0.1:5000
"""
from __future__ import annotations

import io
import json
import os
import re
import shutil
import sys
import threading
import time
import traceback
import uuid
import zipfile
from pathlib import Path
from urllib.parse import urlencode

from flask import (Flask, abort, jsonify, redirect, render_template_string, request, send_file, session,
                   url_for)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))

import workspace  # noqa: E402
from boq_arch import batchrun  # noqa: E402
from boq_arch.convert import ACCEPTED  # noqa: E402
from boq_arch.parallel import default_workers  # noqa: E402
from xlsx_view import local_target, render, with_absolute_links, with_drawings, with_web_links  # noqa: E402

JOBS_DIR = ROOT / "jobs"
BATCHES_DIR = JOBS_DIR / "batches"
READINGS = ROOT / "readings"          # shared: a sheet read once is never read again
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024

# ------------------------------------------------------------------ sign-in
# The platform is shared over a public link, so every page and every file sits
# behind one sign-in. The account is set here or, to change it without editing
# code, with BOQ_USER / BOQ_PASSWORD. The session lasts until the browser closes.
LOGIN_USER = os.environ.get("BOQ_USER", "ajay123")
LOGIN_PASSWORD = os.environ.get("BOQ_PASSWORD", "aetraa123")
app.secret_key = os.environ.get("BOQ_SECRET") or os.urandom(32)
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")
OPEN_PATHS = ("/login", "/favicon.ico")


@app.before_request
def _require_sign_in():
    if session.get("signed_in") or request.path in OPEN_PATHS:
        return None
    if re.search(r"ms-office|microsoft office", request.headers.get("User-Agent", ""), re.I) \
            and re.fullmatch(r"/job/[^/]+/drawing/[^/]+", request.path):
        # Excel checks a link itself, without the browser's sign-in, before handing it to the browser: told
        # nothing but "it is there", it opens the link itself; a redirect would send the browser to sign in
        return "", 200
    return _sign_in_redirect()


def _sign_in_redirect():
    if request.path.startswith(("/status/", "/api/")) or "/api/" in request.path:
        return jsonify(error="sign in again"), 401
    return redirect(url_for("login", next=request.full_path if request.query_string else request.path))


LOGIN = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign in - BOQ Take-off</title>
<link rel="icon" href="data:,">
<style>
 *{box-sizing:border-box} body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
   font:15px/1.5 "Segoe UI",system-ui,Arial,sans-serif;color:#17212b;background:#f4f6f8;padding:16px}
 form{background:#fff;border:1px solid #d7dde4;border-radius:12px;padding:28px 26px;width:100%;max-width:360px;
   display:grid;gap:12px}
 h1{margin:0;font-size:20px;color:#1F4E78} p{margin:0;color:#5d6875;font-size:14px}
 label{font-weight:600;font-size:14px} input{width:100%;padding:10px 12px;border:1px solid #d7dde4;border-radius:7px;font:inherit}
 input:focus{outline:2px solid #2c6aa0;outline-offset:1px}
 button{background:#1F4E78;color:#fff;border:0;border-radius:7px;padding:11px;font:inherit;font-weight:600;cursor:pointer}
 button:hover{background:#2c6aa0} .err{background:#fdecea;color:#b3261e;border-radius:7px;padding:8px 10px;font-size:14px}
</style></head><body>
<form method="post" autocomplete="on">
 <h1>BOQ Take-off</h1><p>Sign in to continue.</p>
 {% if error %}<div class="err">{{ error }}</div>{% endif %}
 <div><label for="u">Username</label><input id="u" name="username" value="{{ username }}" autofocus required></div>
 <div><label for="pw">Password</label><input id="pw" type="password" name="password" required></div>
 <input type="hidden" name="next" value="{{ next }}">
 <button type="submit">Sign in</button>
</form></body></html>"""


def _safe_next(target: str | None) -> str:
    """Only a path on this site - never a link elsewhere - after signing in. A tab, a newline or a backslash after
    the first slash ("/\\t/evil.example") is refused: the browser read what was left as "//evil.example", another
    site, and a newline failed the request."""
    from urllib.parse import urlsplit
    t = (target or "").replace("\\", "/")
    if t.startswith("/") and not t.startswith("//") and not any(ord(c) < 32 or ord(c) == 127 for c in t) \
            and not urlsplit(t).netloc:
        return t
    return url_for("home")


@app.route("/login", methods=["GET", "POST"])
def login():
    import hmac
    if request.method == "POST":
        user = request.form.get("username", "").strip()
        ok = hmac.compare_digest(user, LOGIN_USER) & hmac.compare_digest(
            request.form.get("password", ""), LOGIN_PASSWORD)
        if ok:
            session.clear()
            session["signed_in"] = True
            return redirect(_safe_next(request.form.get("next")))
        time.sleep(1)                      # a wrong guess costs a second
        return render_template_string(LOGIN, error="That username and password do not match.",
                                      username=user, next=request.form.get("next", "")), 401
    if session.get("signed_in"):
        # already signed in: straight on (a drawing link clicked in Excel arrives here - see _require_sign_in)
        return redirect(_safe_next(request.args.get("next")))
    return render_template_string(LOGIN, error=None, username="", next=request.args.get("next", ""))


@app.get("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))
jobs: dict[str, dict] = {}
batches: dict[str, dict] = {}
# each run is its own process (boq.py), so runs can go side by side; this many at once, the rest wait their turn
PARALLEL_RUNS = max(1, int(os.environ.get("BOQ_PARALLEL_RUNS", "2")))
PROVIDERS_DEFAULT = "claude,openai,gemini,claude-login"


def _is_local() -> bool:
    """A request made on this computer, not one that came through a shared link. Cloudflare's tunnel forwards
    from 127.0.0.1 too, so the address alone cannot tell; it adds its own headers, and those decide."""
    if request.remote_addr not in ("127.0.0.1", "::1"):
        return False
    return not any(h in request.headers for h in ("Cf-Connecting-Ip", "Cf-Ray", "X-Forwarded-For", "Forwarded"))
run_slots = threading.BoundedSemaphore(PARALLEL_RUNS)

# the pipeline's stages as the log names them, in plain words
STAGES = [("S1", "Reading title blocks"), ("S2", "Reading schedules, levels and details"),
          ("S3", "Finding the true drawing scale"), ("S4", "Measuring walls, rooms and doors on each plan"),
          ("S5", "Applying the POMI measurement rules"), ("S6", "Writing the Excel workbooks"),
          ("S7", "Marking up the drawings"), ("CHK", "Checking the results")]
UNIT_WORDS = {"m2": "m2", "m": "m", "nr": "nr", "m3": "m3"}


def workers_for_run() -> int:
    """All the machine's workers for a run on its own; a share of them when other runs are going or waiting."""
    busy = sum(1 for j in jobs.values() if j["status"] in ("running", "queued"))
    return default_workers() if busy <= 1 else batchrun.split_workers(PARALLEL_RUNS)


def run_job(jid: str):
    job = jobs[jid]
    keys = {k: v for k, v in job.pop("keys", {}).items() if v}
    with run_slots:
        job["status"] = "running"
        job["started"] = time.time()
        try:
            prev = previous_for(job)
            if prev is not None:
                job["previous_id"] = prev["id"]
            env = dict(os.environ)
            env.update(keys)                      # this run's keys, in its own process only
            # the user's own Claude sign-in reads drawings only for a run started on this computer, never for
            # one that came in over a shared link (Anthropic's terms: a sign-in is for its owner's own work)
            env.pop("BOQ_CLAUDE_LOGIN", None)
            if job.get("local"):
                env["BOQ_CLAUDE_LOGIN"] = "1"
            cmd = batchrun.boq_command(job["drawings"], job["out"], job["rev"], job["providers"], READINGS,
                                       workers_for_run(), prev["out"] if prev is not None else None)

            def add(line):
                job["log"] += line
            rc = batchrun.run_boq(cmd, env, add)
            if rc == 0:
                job["log"] += "CHK checking the results\n"
                ok, msg = batchrun.verify(job["out"])
                job["verify"], job["verify_ok"] = [msg], ok
            job["status"] = "done" if rc == 0 else "failed"
        except Exception:
            job["log"] += "\n" + traceback.format_exc()
            job["status"] = "failed"
        finally:
            job["finished"] = time.time()


def _plot_of_folder(folder: Path) -> str:
    """The plot number from the first readable title block in a drawing set (to find its earlier runs)."""
    from boq_arch.register import plot_like, read_title_block
    from boq_arch.sheet import Sheet
    for p in sorted(Path(folder).rglob("*.pdf"))[:12]:
        s = Sheet(p)
        tb = read_title_block(s)
        s.close()
        if tb.get("plot") and plot_like(tb["plot"]):     # the register's rule: an address is not a plot number
            return tb["plot"]
    return ""


def previous_for(job) -> dict | None:
    """The run to compare against: the one chosen, or (auto) the latest earlier run of the same plot."""
    choice = job.get("compare", "auto")
    if choice == "none":
        return None
    cands = [j for j in jobs.values() if j["id"] != job["id"] and j["status"] == "done"
             and (Path(j["out"]) / "evidence.json").exists() and j["created"] < job["created"]]
    if choice not in ("auto", ""):
        return next((j for j in cands if j["id"] == choice), None)
    plot = _plot_of_folder(job["drawings"])
    stems, prints = _drawing_files(job["drawings"]) if not plot else (set(), set())
    same = []
    for j in cands:
        ev = json.loads((Path(j["out"]) / "evidence.json").read_text(encoding="utf-8"))
        theirs = ev.get("project", {}).get("plot", "")
        if plot:
            if theirs == plot:
                same.append(j)
        elif not theirs:
            # no plot number to go by ('' matched every other set without one, so unrelated projects were
            # compared): the same drawing set is the one made mostly from the same drawing files - by name (a
            # scan's converted sheet keeps its name) and, for PDFs, with at least one sheet byte for byte the same,
            # since two offices' sets can both be called "Plans 01.pdf ..."
            sheets = (ev.get("sheets") or {}).values()
            used = {_stem(s.get("file", "")) for s in sheets} - {""}
            their_prints = {s.get("sha1") for s in sheets} - {None, ""}
            if stems and used and len(stems & used) >= 0.5 * min(len(stems), len(used)) \
                    and (not prints or not their_prints or prints & their_prints):
                same.append(j)
    return max(same, key=lambda j: j["created"]) if same else None


def _stem(name: str) -> str:
    """A drawing file's name for matching: no folder, no extension, no ' p2' page suffix of a multi-page scan."""
    return re.sub(r" p\d+$", "", Path(name).stem.lower()) if name else ""


def _drawing_files(folder) -> tuple[set, set]:
    """(names, SHA-1s of the PDFs) of a drawing set's files, to find its earlier runs."""
    import hashlib
    stems, prints = set(), set()
    for q in Path(folder).rglob("*"):
        if q.is_file() and q.suffix.lower() in batchrun.DRAWING_TYPES:
            stems.add(_stem(q.name))
            if q.suffix.lower() == ".pdf":
                prints.add(hashlib.sha1(q.read_bytes()).hexdigest())
    return stems, prints


def stage_now(log: str) -> int:
    """Index of the stage the log has reached."""
    idx = 0
    for i, (code, _) in enumerate(STAGES):
        if re.search(rf"^{code}\b", log, re.M):
            idx = i
    return idx


def summary(job) -> dict | None:
    p = Path(job["out"]) / "run.json"
    if not p.exists():
        return None
    run = json.loads(p.read_text(encoding="utf-8"))
    secs = []
    for s, items in run.get("sections", {}).items():
        tot: dict[str, int] = {}
        for it in items:
            if not it.get("open"):              # an open item is not billed: it is no "0 nr"
                tot[it["unit"]] = tot.get(it["unit"], 0) + it["bill_quantity"]
        opened = sum(1 for it in items if it.get("open"))
        secs.append({"letter": s, "title": run.get("section_titles", {}).get(s, s), "count": len(items),
                     "totals": ", ".join([f"{v:,} {UNIT_WORDS.get(u, u)}" for u, v in tot.items()]
                                         + ([f"{opened} open - see the gaps"] if opened else []))})
    return {"project": run.get("identity", {}), "sections": secs, "gaps": run.get("gaps", 0),
            "gaps_by_section": run.get("gaps_by_section", {}),
            "pending": [re.sub(r"^(.+?)\.(\w+)\.request$", r"\1 (\2)", n) for n in run.get("pending_readings", [])],
            "seconds": run.get("seconds"), "drawings": run.get("drawings", {})}


def label(name: str) -> str:
    if " - BOQ " in name:
        return "Bill of Quantities (unpriced)"
    if " - Take-off - " in name:
        return "Take-off (the measurements behind the bill)"
    if " - GAPS - " in name:
        return "Gaps list (questions for the architect)"
    return name


def outputs(job) -> dict:
    out = Path(job["out"])
    files = sorted(out.glob("*.xlsx"))
    return {"boq": [f for f in files if " - BOQ " in f.name],
            "takeoff": [f for f in files if " - Take-off - " in f.name],
            "gaps": [f for f in files if " - GAPS - " in f.name],
            "overlays": sorted((out / "overlays").glob("*.pdf")) if (out / "overlays").exists() else []}


# ------------------------------------------------------------------ pages

BASE = """
<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>BOQ Take-off</title><link rel="icon" href="data:,">
<style>
 :root{--ink:#17212b;--mute:#5d6875;--line:#d7dde4;--blue:#1F4E78;--blue2:#2c6aa0;--soft:#eef3f8;--bg:#f4f6f8;
       --ok:#1b7f3b;--okbg:#e6f4ea;--warn:#8a5a00;--warnbg:#fff4dc;--bad:#b3261e;--badbg:#fdecea}
 *{box-sizing:border-box} body{margin:0;font:15px/1.5 "Segoe UI",system-ui,Arial,sans-serif;color:var(--ink);background:var(--bg)}
 header{background:var(--blue);color:#fff;padding:14px 28px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
 header a.brand{color:#fff;text-decoration:none;font-weight:700;font-size:19px;letter-spacing:.2px}
 header .tag{opacity:.85;font-size:14px} header nav{margin-left:auto} header nav a{color:#fff;opacity:.9;text-decoration:none;margin-left:18px;font-size:14px}
 main{padding:24px 28px 48px;max-width:1280px;margin:auto}
 h1{font-size:22px;margin:0 0 4px} h2{font-size:17px;margin:0 0 12px} h3{font-size:15px;margin:0 0 6px}
 p.lead{color:var(--mute);margin:0 0 20px}
 .card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:20px 22px;margin-bottom:18px}
 .cols{display:grid;grid-template-columns:1.6fr 1fr;gap:18px} @media(max-width:900px){.cols{grid-template-columns:1fr}}
 .step{display:flex;gap:14px;margin-bottom:18px} .step .n{flex:none;width:30px;height:30px;border-radius:50%;background:var(--blue);color:#fff;
   display:flex;align-items:center;justify-content:center;font-weight:700} .step .b{flex:1;min-width:0}
 .hint{color:var(--mute);font-size:13.5px;margin:4px 0 0}
 .drop{border:2px dashed #9fb3c8;border-radius:10px;padding:22px;text-align:center;background:#fafcfe;cursor:pointer;transition:.15s}
 .drop.over{background:var(--soft);border-color:var(--blue)} .drop b{color:var(--blue)}
 .drop input{display:none} #picked{margin-top:8px;font-size:13.5px;color:var(--ink)}
 .or{display:flex;align-items:center;gap:10px;color:var(--mute);font-size:13px;margin:12px 0} .or:before,.or:after{content:"";flex:1;border-top:1px solid var(--line)}
 label{display:block;font-weight:600;margin:0 0 5px}
 input[type=text],input[type=password]{width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:6px;font:inherit;background:#fff}
 input:focus{outline:2px solid var(--blue2);outline-offset:1px}
 details{border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin-top:6px} summary{cursor:pointer;font-weight:600}
 .btn{background:var(--blue);color:#fff;border:0;border-radius:7px;padding:10px 18px;font:inherit;font-weight:600;cursor:pointer;
   text-decoration:none;display:inline-flex;gap:8px;align-items:center}
 .btn:hover{background:var(--blue2)} .btn.big{font-size:16px;padding:12px 26px} .btn.light{background:var(--soft);color:var(--blue)}
 .btn.light:hover{background:#dde8f3} .btn.sm{padding:6px 12px;font-size:13.5px}
 .pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12.5px;font-weight:600}
 .pill.ok{background:var(--okbg);color:var(--ok)} .pill.bad{background:var(--badbg);color:var(--bad)}
 .pill.run{background:var(--soft);color:var(--blue)} .pill.warn{background:var(--warnbg);color:var(--warn)}
 ul.get{margin:0;padding-left:18px} ul.get li{margin-bottom:8px}
 table.list{border-collapse:collapse;width:100%} table.list td,table.list th{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
 table.list th{font-size:13px;color:var(--mute);font-weight:600}
 .stages{list-style:none;margin:0;padding:0} .stages li{display:flex;gap:10px;align-items:center;padding:6px 0;color:var(--mute)}
 .stages .dot{width:20px;height:20px;border-radius:50%;border:2px solid #b8c4d0;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px}
 .stages li.done{color:var(--ink)} .stages li.done .dot{background:var(--ok);border-color:var(--ok);color:#fff}
 .stages li.now{color:var(--blue);font-weight:600} .stages li.now .dot{border-color:var(--blue);border-top-color:transparent;animation:spin 1s linear infinite}
 @keyframes spin{to{transform:rotate(360deg)}}
 pre.log{background:#0f1720;color:#d6e2ee;padding:12px;border-radius:8px;max-height:320px;overflow:auto;font-size:12px;white-space:pre-wrap}
 .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:6px}
 .kpi{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:#fff}
 .kpi .v{font-size:22px;font-weight:700} .kpi .l{color:var(--mute);font-size:13px}
 .deliver{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}
 .dcard{border:1px solid var(--line);border-radius:10px;padding:16px;background:#fff;display:flex;flex-direction:column;gap:8px}
 .dcard.main{border:2px solid var(--blue)} .dcard .fn{font-size:12.5px;color:var(--mute);word-break:break-all}
 .dcard .acts{display:flex;gap:8px;margin-top:auto;flex-wrap:wrap}
 .ovl{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
 .ovl a{display:block;padding:9px 12px;border:1px solid var(--line);border-radius:8px;text-decoration:none;color:var(--ink);background:#fafbfc}
 .ovl a:hover{border-color:var(--blue)} .ovl small{color:var(--mute)}
 .note{background:var(--warnbg);border:1px solid #f0d9a6;border-radius:8px;padding:10px 14px;font-size:14px}
 .tabs{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0} .tabs a{padding:7px 14px;border-radius:7px;background:var(--soft);color:var(--blue);text-decoration:none;font-size:14px;font-weight:600}
 .tabs a.on{background:var(--blue);color:#fff}
 .toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
 .sheet{overflow:auto;max-height:74vh;border:1px solid var(--line);border-radius:8px;background:#fff}
 table.xl{border-collapse:collapse;font:12.5px Arial;table-layout:fixed}
 table.xl td{padding:1px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-right:1px solid #f1f1f1;border-bottom:1px solid #f1f1f1;height:19px}
 table.xl th{background:#eef1f4;color:#6b7580;font-weight:400;font-size:11px;position:sticky;top:0;z-index:1;border:1px solid #e1e5e9}
 table.xl tbody th{position:sticky;left:0;top:auto;width:40px} table.xl col.rn{width:42px}
 table.xl td[title]{cursor:help} .lnk{color:#0563C1;text-decoration:underline}
 body.compact table.xl tr.e{display:none}
 .mute{color:var(--mute)} a{color:var(--blue2)}
</style></head><body>
<header><a class="brand" href="{{ url_for('home') }}">BOQ Take-off</a>
<span class="tag">Architectural drawings &rarr; take-off &amp; unpriced Bill of Quantities</span>
<nav><a href="{{ url_for('home') }}">New run</a><a href="{{ url_for('batch_new') }}">Batch</a><a href="{{ url_for('home') }}#runs">Previous runs</a><a href="{{ url_for('help_page') }}">How it works</a><a href="{{ url_for('logout') }}">Sign out</a></nav></header>
<main>{% block body %}{% endblock %}</main></body></html>
"""

HOME = BASE.replace("{% block body %}{% endblock %}", """
<h1>Make a Bill of Quantities from architectural drawings</h1>
<p class="lead">Give it a complete architectural drawing set. In about a minute and a half you get the unpriced BOQ,
the take-off behind it, and a list of anything the drawings leave unclear.</p>
<div class="cols">
<form class="card" method="post" action="{{ url_for('start') }}" enctype="multipart/form-data" id="runform">
 <div class="step"><div class="n">1</div><div class="b">
  <h3>Add the drawings</h3>
  <label class="drop" id="drop"><input type="file" name="files" id="files" multiple accept="{{ accept }}">
   <div><b>Click to choose</b> or drag drawings / a .zip here</div>
   <div class="hint">PDF, DWG, DXF, JPG, PNG or TIFF. Images and CAD files are converted to sheets automatically.</div>
   <div class="hint">Upload the <b>whole architectural set</b>: floor plans, sections, schedules and detail sheets together.</div>
   <div id="picked"></div></label>
  <div class="or">or use a folder already on this computer</div>
  <input type="text" name="folder" placeholder="e.g. D:\\Drawings\\Project\\Architecture" value="{{ default_folder }}">
  <p class="hint">Used only when no files are chosen above.</p>
 </div></div>
 <div class="step"><div class="n">2</div><div class="b">
  <h3>Revision</h3>
  <input type="text" name="rev" value="00" style="max-width:120px">
  <p class="hint">Goes into the file names. <b>00</b> for the first issue; <b>01</b>, <b>02</b>&hellip; when the drawings are revised.</p>
  <label style="margin-top:12px">Compare with an earlier run</label>
  <select name="compare" style="width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:6px;font:inherit">
   <option value="auto">Automatic &ndash; the latest earlier run of the same project</option>
   <option value="none">Don't compare</option>
   {% for j in jobs if j.status == 'done' %}<option value="{{ j.id }}">{{ j.when }} &middot; {{ j.label }} &middot; rev {{ j.rev or '-' }}</option>{% endfor %}
  </select>
  <p class="hint">Revised drawings are compared with the earlier run: which sheets, marks, tags and quantities changed.</p>
  <details><summary>AI reading settings (only needed for new drawings)</summary>
   <p class="hint">Schedules and some dimensions are drawn as pictures, so an AI reads them. Sheets read before are
   re-used automatically &ndash; for the test set no key is needed. Keys are used for this run only and are not saved.</p>
   <p class="hint">No key? On this computer the platform reads with your own Claude sign-in (Claude Code), after any key
   given here (<b>claude-login</b> in the order below). People using a shared link must give a key.</p>
   <label style="margin-top:10px">Anthropic (Claude) API key &ndash; used first</label><input type="password" name="ANTHROPIC_API_KEY" autocomplete="off">
   <label style="margin-top:10px">OpenAI API key &ndash; backup</label><input type="password" name="OPENAI_API_KEY" autocomplete="off">
   <label style="margin-top:10px">Gemini API key &ndash; second backup</label><input type="password" name="GEMINI_API_KEY" autocomplete="off">
   <label style="margin-top:10px">Order to try them in</label><input type="text" name="providers" value="claude,openai,gemini,claude-login">
  </details>
 </div></div>
 <div class="step"><div class="n">3</div><div class="b">
  <button class="btn big" type="submit">Run take-off</button>
  <p class="hint">Takes about a minute for a full set. You can watch the progress.
  Several drawing sets? Run them together from <a href="{{ url_for('batch_new') }}">Batch</a>.</p>
 </div></div>
</form>
<div class="card">
 <h2>What you get</h2>
 <ul class="get">
  <li><b>Bill of Quantities (unpriced)</b> &ndash; one Excel workbook in the house format: Summary, Masonry, T&amp;P,
      D&nbsp;&amp;&nbsp;W, Finishes. Rates are left blank for contractors to price.</li>
  <li><b>Take-off</b> &ndash; the measurements behind every bill quantity, each line tied to its drawing.</li>
  <li><b>Gaps list</b> &ndash; everything the drawings leave unclear or missing. Read it before issuing.</li>
  <li><b>Takeoff view</b> &ndash; every drawing marked up in the trade colours beside the items taken off it,
      like a PlanSwift takeoff, plus <b>Counts</b> (each door and window counted two ways), <b>Assemblies</b>
      (the rule behind each bill line) and <b>Revisions</b> (what changed since the last run).</li>
 </ul>
 <p class="hint" style="margin-top:12px">Every run is checked automatically: bill and take-off quantities must agree
 and the bill must follow the house format.</p>
</div>
</div>
<div class="card" id="runs"><h2>Previous runs</h2>
{% if jobs %}<table class="list"><tr><th>Started</th><th>Drawings</th><th>Revision</th><th>Status</th><th></th></tr>
{% for j in jobs %}<tr><td>{{ j.when }}</td><td>{{ j.label }}{% if j.batch %} <a class="pill run" style="text-decoration:none" href="{{ url_for('batch_page', bid=j.batch) }}">batch</a>{% endif %}</td><td>{{ j.rev or '-' }}</td>
<td>{% if j.status == 'done' and j.verify_ok is not sameas false %}<span class="pill ok">Ready</span>
{% elif j.status == 'running' %}<span class="pill run">Running&hellip;</span>
{% elif j.status == 'queued' %}<span class="pill warn">Waiting</span>
{% else %}<span class="pill bad">{{ 'Check failed' if j.status == 'done' else 'Failed' }}</span>{% endif %}</td>
<td style="text-align:right"><a class="btn light sm" href="{{ url_for('job', jid=j.id) }}">Open results</a></td></tr>{% endfor %}</table>
{% else %}<p class="mute">No runs yet &ndash; start one above.</p>{% endif %}</div>
<script>
 const drop=document.getElementById('drop'), input=document.getElementById('files'), picked=document.getElementById('picked');
 function show(){const n=input.files.length; if(!n){picked.textContent='';return;}
   const by={}; for(const f of input.files){ const e=f.name.split('.').pop().toUpperCase(); by[e]=(by[e]||0)+1; }
   picked.innerHTML='<b>'+Object.entries(by).map(([e,n])=>n+' '+e).join(', ')+'</b> selected';}
 input.addEventListener('change',show);
 ['dragenter','dragover'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('over');}));
 ['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('over');}));
 drop.addEventListener('drop',ev=>{input.files=ev.dataTransfer.files;show();});
</script>
""")

JOB = BASE.replace("{% block body %}{% endblock %}", """
{% if j.status in ('queued','running') %}
<h1>{{ 'Waiting to start' if j.status == 'queued' else 'Working on it' }}&hellip;</h1><p class="lead">{{ j.label }} &middot; revision {{ j.rev }}.
{% if j.status == 'queued' %}{{ parallel_runs }} run(s) go at once and this one starts when one of them finishes. {% endif %}This page updates by itself.
{% if j.batch %}Part of a <a href="{{ url_for('batch_page', bid=j.batch) }}">batch</a>.{% endif %}</p>
<div class="cols"><div class="card"><h2>Progress</h2><ul class="stages" id="stages">
{% for code, name in stages %}<li class="{{ 'done' if loop.index0 < now else ('now' if loop.index0 == now else '') }}">
<span class="dot">{{ '&#10003;'|safe if loop.index0 < now else '' }}</span>{{ name }}</li>{% endfor %}</ul>
<p class="hint" id="elapsed"></p></div>
<div class="card"><h2>Details</h2><pre class="log" id="log">{{ j.log }}</pre></div></div>
<script>
 const t0={{ (j.started or j.created)|int }}*1000;
 setInterval(async()=>{const r=await fetch("{{ url_for('status', jid=j.id) }}");const d=await r.json();
  document.getElementById('log').textContent=d.log; const l=document.getElementById('log'); l.scrollTop=l.scrollHeight;
  document.querySelectorAll('#stages li').forEach((li,i)=>{li.className=i<d.now?'done':(i==d.now?'now':'');
    li.querySelector('.dot').innerHTML=i<d.now?'&#10003;':'';});
  document.getElementById('elapsed').textContent='Running for '+Math.round((Date.now()-t0)/1000)+' s';
  if(d.status!=='running'&&d.status!=='queued')location.reload();},1500);
</script>
{% else %}
{{ tabs|safe }}
<h1>{{ s.project.job_title if s else 'Results' }}</h1>
<p class="lead">{% if s %}{% for k, v in [('Plot ', s.project.plot), ('', s.project.community), ('owner ', s.project.owner)] if v %}{{ k }}{{ v }} &middot; {% endfor %}{% endif %}revision {{ j.rev or '-' }}
{% if s and s.seconds %} &middot; made in {{ s.seconds }} s{% endif %}</p>

{% if j.status == 'failed' %}<div class="card note"><b>The run stopped with an error.</b> The last lines of the log say why:
<pre class="log">{{ j.log[-2500:] }}</pre></div>{% endif %}

{% if s %}
<div class="kpis">
 <div class="kpi"><div class="v">{% if j.verify_ok is sameas false %}<span class="pill bad">Check failed</span>{% else %}<span class="pill ok">Checks passed</span>{% endif %}</div>
  <div class="l">bill = take-off, house format</div></div>
 {% for sec in s.sections %}<div class="kpi"><div class="v">{{ sec.count }} item{{ '' if sec.count == 1 else 's' }}</div><div class="l">Section {{ sec.letter }} &middot; {{ sec.title|capitalize }}<br>{{ sec.totals }}</div></div>{% endfor %}{% if not s.sections %}<div class="kpi"><div class="v">No items</div><div class="l">nothing on these drawings could be billed - the gaps list says why</div></div>{% endif %}
 <div class="kpi"><div class="v">{{ s.gaps }}</div><div class="l">gaps to review{% if s.pending %} &middot; {{ s.pending|length }} sheet(s) not yet read{% endif %}</div></div>
</div>
{% if j.verify_ok is sameas false %}<p class="note">{{ j.verify[0] }} &ndash; do not issue these files; open the run log below.</p>{% endif %}
{% if s.pending %}<p class="note">{{ s.pending|length }} sheet(s) could not be read: no AI key was given and no Claude sign-in
answered ({{ s.pending|join(', ') }}). Their content is missing from the bill and listed in the gaps. Run again with an API key,
or on this computer with Claude Code signed in, to include them.</p>{% endif %}
{% endif %}

{% if files %}
<div class="card" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:260px">
<h2 style="margin-bottom:4px">Check, correct and measure by hand</h2><span class="mute">See exactly what each bill line was
measured from, and correct the walls, rooms and tags the take-off got wrong. Click lengths, areas and counts on the raw drawings,
count look-alike symbols, add notes and clouds, then export the bill again with your corrections and measurements in it.</span></div>
<a class="btn" href="{{ url_for('ws.measure_page', jid=j.id) }}">Open Measure</a></div>
<div class="card"><h2>Your files</h2><div class="deliver">
{% for f in files.boq %}<div class="dcard main"><h3>{{ label(f.name) }}</h3><div>The bill for contractors to price, in the house format.</div>
 <div class="fn">{{ f.name }}</div><div class="acts"><a class="btn sm" href="{{ url_for('view', jid=j.id, name=f.name) }}">Open in browser</a>
 <a class="btn light sm" href="{{ url_for('download', jid=j.id, name=f.name) }}">Download .xlsx</a></div></div>{% endfor %}
{% for f in files.takeoff %}<div class="dcard"><h3>{{ label(f.name) }}</h3><div>Every measurement line with its drawing, floor and dimensions. Its drawing links open each drawing{% if passing_link %} here, through this shared link while it lasts - for a copy whose links keep working, download it with drawings{% endif %}.</div>
 <div class="fn">{{ f.name }}</div><div class="acts"><a class="btn sm" href="{{ url_for('view', jid=j.id, name=f.name) }}">Open in browser</a>
 <a class="btn light sm" href="{{ url_for('download', jid=j.id, name=f.name) }}">Download .xlsx</a>
 <a class="btn light sm" href="{{ url_for('bundle', jid=j.id, name=f.name) }}" title="The workbook and the drawings its links open, in one zip, for someone who cannot open this platform. Extract the zip first (right-click, Extract All): opened straight out of the zip, the links cannot find the drawings.">Download with drawings (.zip)</a></div></div>{% endfor %}
{% for f in files.gaps %}<div class="dcard"><h3>{{ label(f.name) }}</h3><div>Missing sheets, unclear details and cross-check differences.
 {% if s %}{{ s.gaps }} items.{% endif %}</div>
 <div class="fn">{{ f.name }}</div><div class="acts"><a class="btn sm" href="{{ url_for('view', jid=j.id, name=f.name) }}">Open in browser</a>
 <a class="btn light sm" href="{{ url_for('download', jid=j.id, name=f.name) }}">Download .xlsx</a></div></div>{% endfor %}
</div></div>
{% if files.overlays %}<div class="card"><h2>Marked-up drawings</h2>
<p class="hint" style="margin-top:-6px;margin-bottom:12px">Every drawing the take-off read from, marked up in the trade
colours: walls traced, rooms shaded, door and window tags ringed (red = count open), schedules with the regions read.
Open them side by side with their take-off items in the <a href="{{ url_for('takeoff', jid=j.id) }}">Takeoff view</a>.</p>
<div class="ovl">{% for f in files.overlays %}{% set dn = f.name.replace(' marked up.pdf','').replace(' measured.pdf','') %}
<a href="{{ url_for('takeoff', jid=j.id, sheet=dn) }}"><b>{{ s.drawings.get(dn, dn) if s else dn }}</b><br><small>{{ dn }} &middot; open in Takeoff view</small></a>{% endfor %}</div></div>{% endif %}
{% endif %}
<details class="card"><summary>Run log</summary><pre class="log">{{ j.log }}</pre></details>
{% endif %}
""")

VIEW = BASE.replace("{% block body %}{% endblock %}", """
<div class="toolbar"><a class="btn light sm" href="{{ url_for('job', jid=jid) }}">&larr; Back to results</a>
<h1 style="margin:0 8px 0 4px;font-size:19px">{{ title }}</h1>
<a class="btn sm" href="{{ url_for('download', jid=jid, name=name) }}">Download .xlsx</a>
{% if linked %}<a class="btn light sm" href="{{ url_for('bundle', jid=jid, name=name) }}" title="The workbook and the drawings its links open, in one zip, for someone who cannot open this platform. Extract the zip first (right-click, Extract All): opened straight out of the zip, the links cannot find the drawings.">Download with drawings (.zip)</a>{% endif %}
<label style="margin:0;font-weight:500;display:flex;gap:6px;align-items:center"><input type="checkbox" id="compact"> Hide blank rows</label></div>
<p class="hint">Sheets are shown as in Excel; numbers from formulas show their calculated value &ndash; hover over one to see its formula.</p>
<div class="tabs">{% for s, _ in sheets %}<a href="?s={{ loop.index0 }}" class="{{ 'on' if loop.index0 == cur else '' }}">{{ s }}</a>{% endfor %}</div>
<div class="sheet">{{ table|safe }}</div>
<script>
 const c=document.getElementById('compact'); let v=null; try{v=localStorage.getItem('compact');}catch(e){}
 if(v==='1'){c.checked=true;document.body.classList.add('compact');}
 c.addEventListener('change',()=>{document.body.classList.toggle('compact',c.checked);try{localStorage.setItem('compact',c.checked?'1':'0');}catch(e){}});
</script>
""")

HELP = BASE.replace("{% block body %}{% endblock %}", """
<h1>How it works</h1><p class="lead">What the platform does with your drawings, in the order it does it.</p>
<div class="card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:260px">
<h2 style="margin-bottom:4px">Measuring by hand</h2><span class="mute">Step by step: setting the scale, measuring lengths, areas
and counts, reading the figures, putting them in the bill and exporting - with a worked example.</span></div>
<a class="btn" href="{{ url_for('ws.measure_guide_page') }}">How to measure</a></div>
<div class="card"><ol style="margin:0;padding-left:20px;line-height:1.8">
<li><b>Reads the title blocks</b> of every sheet for the drawing number, title, owner, plot and scale. File names are not trusted.</li>
<li><b>Reads what is drawn as pictures</b> &ndash; door and window schedules, level values and detail notes &ndash; using AI. Each reading is saved and re-used.</li>
<li><b>Finds the true scale</b> of each plan from its grid dimensions (the scale printed on the sheet is often wrong once plotted).</li>
<li><b>Measures the plans</b>: wall lengths by thickness, room areas and perimeters, and counts every door and window tag.</li>
<li><b>Applies POMI</b> measurement rules: doors counted (nr), walls and finishes by area (m&sup2;), skirtings by length (m), openings of 1&nbsp;m&sup2; or more deducted.</li>
<li><b>Writes the bill and take-off</b> in the house formats, and a gaps list for anything unclear.</li>
<li><b>Checks itself</b>: every bill quantity must equal its take-off, and the bill must follow the house format.</li>
</ol></div>
<div class="card"><h2>The PlanSwift tools, done by the agent</h2><table class="list">
<tr><th>In PlanSwift you&hellip;</th><th>Here the agent&hellip;</th></tr>
<tr><td>click to measure lengths and areas</td><td><b>Measure</b> tab: length, area, rectangle and count tools on the raw
 drawing, snapping to line ends, at the sheet's calibrated scale (or one you set from two points). Also: the agent reads the drawing directly: text where the PDF has real text, and the rendered image
 (tight crops of tables, title blocks, dimension strings) where the text is outlined or scanned. Every value is tagged with how it was obtained.</td></tr>
<tr><td>count symbols</td><td><b>Count similar</b> in Measure: box one symbol or tag and every match on the sheet is ringed
 for you to check. The agent also counts every mark twice &ndash; off the schedule and on the plans &ndash; and closes it only when both agree (<b>Counts</b> tab).</td></tr>
<tr><td>select a takeoff item and see it on the plan; edit the takeoff</td><td>In <b>Measure</b> every wall, room and tag
 the agent measured is drawn over the plan in the trade colours. Click an item to light up what it was measured from; click a shape
 to see the bill lines it feeds, and correct it: give a wall its thickness or exclude it, rename or exclude a room, exclude a
 duplicate tag, add a missing tag, draw a room the agent could not measure. Every correction is measured again by the same rules
 and exported as <b>MEASURED (CORRECTED)</b> or <b>MEASURED (MANUAL)</b>.</td></tr>
<tr><td>measure elevations and slopes</td><td>Each elevation is scaled from its own storey dimensions (checked
 against the plans' grid) and its <b>coloured finishes are measured by area</b>; the callouts name each colour, and
 wall finishes are billed as external finishes. A colour with no callout can be named in Measure. Anything measured on
 plan over a slope - a room, or a length or area measured by hand - can be given its slope (15, 1:12, 8%) and is then
 measured on the slope.</td></tr>
<tr><td>build assemblies / custom formulas</td><td><b>Formulas</b> tab: your own assemblies - one measurement into several
 bill lines, each with a POMI clause and a formula (e.g. <code>2*L*H</code>). The agent also looks up each element's POMI clause: unit, formula, deduction rule and required wording (<b>Assemblies</b> tab).</td></tr>
<tr><td>import PDF or CAD</td><td>accepts PDF, DWG, DXF, JPG, PNG and TIFF (converted to sheets on upload); handles text, outlined, scanned and mixed PDFs; a DXF placed beside a sheet is measured from its native geometry.</td></tr>
<tr><td>colour the takeoff on the drawing / mark up</td><td>notes, clouds, arrows and highlights in Measure, exported
 as a marked-up PDF. The agent also marks up every drawing in the house trade colours (<b>Takeoff view</b>).</td></tr>
<tr><td>overlay a revised drawing</td><td><b>Overlay</b> in Measure shows a sheet over the same sheet from an earlier
 run (red removed, green added); manual measurements carry forward to the new run. The agent also compares with the previous run: sheets, schedule marks, tags moved / added / removed and quantities (<b>Revisions</b> tab).</td></tr>
</table></div>
<div class="card" style="display:none"><ol>
</ol></div>
<div class="card"><h2>Good to know</h2><ul class="get">
<li>Upload a <b>complete set</b>. A plan's scale, a storey height or a finish may come from another sheet.</li>
<li>The bill is <b>unpriced</b> on purpose &ndash; contractors add the rates. No rate is ever invented.</li>
<li>Nothing is guessed. Where the drawings are unclear, the item goes in the <b>gaps list</b> instead.</li>
<li>Runs are kept in <code>boq_arch\\jobs\\</code>. The platform runs only on this computer.</li>
<li>Each run spreads its sheets over several worker processes (about a minute for a full set) and runs as its own
process, so two runs go side by side and the rest wait their turn. <b>Batch</b> runs a list of drawing sets together,
with one summary.</li>
</ul></div>
""")


@app.get("/")
def home():
    js = sorted(jobs.values(), key=lambda j: j["created"], reverse=True)
    for j in js:
        j["when"] = time.strftime("%d %b %Y, %H:%M", time.localtime(j["created"]))
    dflt = ROOT.parent / "Test Drawigs" / "Architecture"
    return render_template_string(HOME, jobs=js, default_folder=str(dflt) if dflt.exists() else "",
                                  accept=",".join(sorted(ACCEPTED | {".zip"})))


@app.get("/help")
def help_page():
    return render_template_string(HELP)


@app.post("/start")
def start():
    jid = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:4]
    base = JOBS_DIR / jid
    drawings = base / "drawings"
    drawings.mkdir(parents=True)
    ups = [f for f in request.files.getlist("files") if f and f.filename]
    def ok(name):
        return Path(name).suffix.lower() in ACCEPTED

    def found(folder):
        return [q for q in folder.rglob("*") if q.is_file() and ok(q.name)]

    if ups:
        for f in ups:
            name = Path(f.filename).name
            if name.lower().endswith(".zip"):
                with zipfile.ZipFile(f.stream) as z:
                    for m in z.infolist():
                        if ok(m.filename) and not m.is_dir():
                            target = drawings / Path(m.filename).name
                            with z.open(m) as src, open(target, "wb") as dst:
                                shutil.copyfileobj(src, dst)
            elif ok(name):
                f.save(drawings / name)
        label_ = f"{len(found(drawings))} uploaded drawings"
    else:
        folder = Path(request.form.get("folder", "").strip().strip('"'))
        if not folder.is_dir():
            shutil.rmtree(base)
            abort(400, "Choose drawing files or a zip, or type a folder that exists.")
        drawings = folder
        label_ = f"{len(found(folder))} drawings from {folder.name}"
    if not found(drawings):
        abort(400, "No drawings found (PDF, DWG, DXF, JPG, PNG or TIFF).")
    jobs[jid] = {"id": jid, "label": label_, "drawings": drawings, "out": base / "output",
                 "rev": request.form.get("rev", "00").strip() or "00",
                 "providers": request.form.get("providers", PROVIDERS_DEFAULT),
                 "local": _is_local(),
                 "keys": {k: request.form.get(k, "").strip() for k in
                          ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY")},
                 "compare": request.form.get("compare", "auto"),
                 "status": "queued", "log": "", "created": time.time(), "started": None,
                 "verify": None, "verify_ok": None}
    threading.Thread(target=run_job, args=(jid,), daemon=True).start()
    return redirect(url_for("job", jid=jid))


def _job(jid):
    j = jobs.get(jid)
    if j is None:
        abort(404)
    return j


@app.get("/job/<jid>")
def job(jid):
    j = _job(jid)
    done = j["status"] in ("done", "failed")
    files = outputs(j) if done and Path(j["out"]).exists() else None
    # through a shared link with no lasting address, a downloaded take-off's drawing links last as long as the link
    passing = not _is_local() and not os.environ.get("BOQ_PUBLIC_URL")
    return render_template_string(JOB, j=j, files=files, s=summary(j) if done else None, stages=STAGES,
                                  tabs=ws_tabs(jid, "job") if done else "",
                                  now=stage_now(j["log"]), label=label, parallel_runs=PARALLEL_RUNS,
                                  passing_link=passing)


@app.get("/status/<jid>")
def status(jid):
    j = _job(jid)
    return jsonify(status=j["status"], log=j["log"][-20000:], now=stage_now(j["log"]))


def _file(j, name) -> Path:
    p = (Path(j["out"]) / name).resolve()
    if Path(j["out"]).resolve() not in p.parents or not p.exists():
        abort(404)
    return p


@app.get("/job/<jid>/file/<path:name>")
def download(jid, name):
    j = _job(jid)
    p = _file(j, name)
    if p.suffix.lower() == ".xlsx" and not request.args.get("inline"):
        public = os.environ.get("BOQ_PUBLIC_URL", "").rstrip("/")
        if _is_local() and not public:
            # on this computer: links to the drawing files themselves, made absolute - they open wherever the copy
            # is saved or opened on this computer (straight out of a zip too), with the platform stopped or not
            book = with_absolute_links(p)
        else:
            # through a shared link the drawings are not on the reader's computer: each link opens the
            # platform's page for its drawing, at the address set in BOQ_PUBLIC_URL (a lasting one), or else at
            # the address this copy was downloaded through - for as long as that address lasts
            known = _drawing_numbers(j)
            base = public or f"{request.headers.get('X-Forwarded-Proto', request.scheme)}://{request.host}"

            def address(target):
                f = local_target(p, target)
                dn = known.get(str(f).lower()) if f is not None else None
                return base + url_for("drawing", jid=jid, dn=dn) if dn else None
            book = with_web_links(p, address)
        return send_file(io.BytesIO(book), as_attachment=True, download_name=p.name,
                         mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    return send_file(p, as_attachment=not request.args.get("inline"))


def _drawing_numbers(j) -> dict:
    """The run's drawings: resolved file path (lower case) -> drawing number."""
    out = {}
    for s in _json(j, "sheets.json", []) or []:
        try:
            out[str(Path(s["path"]).resolve()).lower()] = s["drawing"]
        except (KeyError, OSError):
            pass
    return out


@app.get("/job/<jid>/drawing/<dn>")
def drawing(jid, dn):
    """One of the run's drawings, as it was read: what the take-off's drawing links open in the browser. Only the
    drawings the run registered are served."""
    j = _job(jid)
    s = next((s for s in _json(j, "sheets.json", []) or [] if s.get("drawing") == dn), None)
    p = Path(s["path"]) if s and s.get("path") else None
    if p is None or not p.is_file():
        abort(404)
    return send_file(p, mimetype="application/pdf", download_name=p.name)


@app.get("/job/<jid>/bundle/<path:name>")
def bundle(jid, name):
    """The workbook zipped with the drawings its links open, the links pointing into the zip: for sending to
    someone who does not have the drawings. Only the run's own drawings go in."""
    j = _job(jid)
    p = _file(j, name)
    if p.suffix.lower() != ".xlsx":
        abort(404)
    known = _drawing_numbers(j)
    data = with_drawings(p, allow=lambda f: str(f).lower() in known)
    return send_file(io.BytesIO(data), as_attachment=True, download_name=f"{p.stem} with drawings.zip",
                     mimetype="application/zip")


_cache: dict = {}


@app.get("/job/<jid>/view/<path:name>")
def view(jid, name):
    j = _job(jid)
    p = _file(j, name)
    key = (str(p), p.stat().st_mtime)
    if key not in _cache:
        known = _drawing_numbers(j)
        linked = set()

        def link_for(target):
            f = local_target(p, target)
            dn = known.get(str(f).lower()) if f is not None else None
            if dn:
                linked.add(dn)
            return url_for("drawing", jid=jid, dn=dn) if dn else None
        _cache[key] = (render(p, link_for), bool(linked))
    sheets, linked = _cache[key]
    cur = min(int(request.args.get("s", 0)), len(sheets) - 1)
    return render_template_string(VIEW, jid=jid, name=name, title=label(name), sheets=sheets, cur=cur,
                                  table=sheets[cur][1], linked=linked)


# ------------------------------------------------------------------ takeoff workspace (PlanSwift-style)

WS_CSS = """
<style>
 .wtabs{display:flex;gap:4px;border-bottom:2px solid var(--line);margin:-6px 0 18px;flex-wrap:wrap}
 .wtabs a{padding:9px 16px;text-decoration:none;color:var(--mute);font-weight:600;border-bottom:3px solid transparent;margin-bottom:-2px}
 .wtabs a.on{color:var(--blue);border-bottom-color:var(--blue)} .wtabs a:hover{color:var(--blue)}
 .tv{display:grid;grid-template-columns:250px minmax(0,1fr) 330px;gap:14px;align-items:start} @media(max-width:1100px){.tv{grid-template-columns:1fr}}
 .panel{background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px}
 .sheetlist a{display:block;padding:8px 10px;border-radius:7px;text-decoration:none;color:var(--ink);margin-bottom:3px;font-size:14px}
 .sheetlist a:hover{background:var(--soft)} .sheetlist a.on{background:var(--blue);color:#fff}
 .sheetlist small{display:block;opacity:.75;font-size:12px} .sheetlist h4{margin:10px 4px 6px;font-size:12px;color:var(--mute);text-transform:uppercase;letter-spacing:.5px}
 .canvas{background:#fff;border:1px solid var(--line);border-radius:10px;overflow:auto;height:76vh;position:relative}
 .canvas img{display:block;transform-origin:0 0}
 .zoom{display:flex;gap:6px;align-items:center;margin-bottom:8px}
 .leg{font-size:13px} .leg div,.leg a{display:flex;gap:8px;align-items:flex-start;padding:4px 0;border-bottom:1px solid #f0f2f4}
 .leg a{color:var(--ink);text-decoration:none} .leg a:hover{background:var(--soft)}
 .sw{width:14px;height:14px;border-radius:3px;flex:none;margin-top:2px}
 table.grid{border-collapse:collapse;width:100%;font-size:14px} table.grid th,table.grid td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
 table.grid th{background:#f6f8fa;font-size:12.5px;color:var(--mute);position:sticky;top:0}
 .badge{display:inline-block;padding:1px 8px;border-radius:6px;font-size:12px;font-weight:600;background:var(--soft);color:var(--blue)}
 .asm{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:12px}
 .asm .panel h3{margin:0 0 6px} .kv{display:grid;grid-template-columns:130px 1fr;gap:4px 10px;font-size:14px;margin-bottom:8px}
 .kv b{color:var(--mute);font-weight:600}
</style>"""


def ws_tabs(jid: str, on: str) -> str:
    j = jobs.get(jid, {})
    out = Path(j.get("out", ".")) if j else Path(".")
    rv = (out / "revision_changes.json").exists()
    items = [("job", "Overview"), ("ws.measure_page", "Measure"), ("takeoff", "Takeoff view"), ("counts", "Counts"),
             ("assemblies", "Assemblies"), ("ws.formulas_page", "Formulas"), ("sheets", "Sheets"),
             ("revisions", "Revisions" + (" &bull;" if rv else ""))]
    names = {"ws.measure_page": "measure", "ws.formulas_page": "formulas"}
    links = "".join(f'<a class="{"on" if names.get(k, k) == on else ""}" href="{url_for(k, jid=jid)}">{t}</a>'
                    for k, t in items)
    return WS_CSS + f'<nav class="wtabs">{links}</nav>'


def _json(j, name, default=None):
    p = Path(j["out"]) / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


WS = BASE.replace("{% block body %}{% endblock %}", "{{ tabs|safe }}{{ body|safe }}")


def _page(jid, on, body):
    return render_template_string(WS, tabs=ws_tabs(jid, on), body=body)


def esc(s) -> str:
    import html
    return html.escape(str(s if s is not None else ""))


@app.get("/job/<jid>/png/<path:name>")
def png(jid, name):
    """A marked-up drawing as an image, rendered once and cached."""
    import pymupdf
    j = _job(jid)
    pdf = _file(j, "overlays/" + name)
    cache = Path(j["out"]) / "_png" / (pdf.stem + ".png")
    if not cache.exists() or cache.stat().st_mtime < pdf.stat().st_mtime:
        cache.parent.mkdir(exist_ok=True)
        doc = pymupdf.open(pdf)
        doc[0].get_pixmap(dpi=110).save(cache)
        doc.close()
    return send_file(cache)


@app.get("/job/<jid>/takeoff")
def takeoff(jid):
    j = _job(jid)
    recs = _json(j, "markups.json", [])
    if not recs:
        return _page(jid, "takeoff", "<p class='note'>No marked-up drawings in this run.</p>")
    cur = request.args.get("sheet") or recs[0]["drawing"]
    r = next((x for x in recs if x["drawing"] == cur), recs[0])
    groups = {"plan": "Plans", "elevation": "Elevations", "schedule": "Schedules"}
    left = ""
    for kind, label_ in groups.items():
        rows = [x for x in recs if x["kind"] == kind]
        if not rows:
            continue
        left += f"<h4>{label_}</h4>"
        for x in rows:
            ch = sum(x.get("changes", {}).values())
            left += (f'<a class="{"on" if x is r else ""}" href="?sheet={esc(x["drawing"])}">{esc(x["title"])}'
                     f'<small>{esc(x["drawing"])} &middot; {esc(x.get("method", ""))}'
                     f'{" &middot; " + str(ch) + " change(s)" if ch else ""}</small></a>')
    measure = url_for("ws.measure_page", jid=jid)
    # an item links to the Measure workspace, which lights up what it was measured from and lets it be corrected
    legend = "".join((f'<a href="{measure}?{esc(urlencode({"sheet": r["drawing"], "item": x["key"]}))}" '
                      f'title="Show what this was measured from, and correct it">' if x.get("key") else "<div>")
                     + f'<span class="sw" style="background:{esc(x["colour"])}"></span><span>{esc(x["text"])}</span>'
                     + ("</a>" if x.get("key") else "</div>")
                     for x in r["legend"]) or "<p class='mute'>Nothing taken off this sheet.</p>"
    how = ("Read directly off the image - the schedule's text is drawn as graphics (dashed boxes: regions read)"
           if r["kind"] == "schedule" else
           "Each colour on the elevation is one finish, outlined and labelled F1, F2 ...; its area is measured at the "
           "scale of the sheet's own storey dimensions and its name read from the callouts. Glazing is billed from "
           "the schedules, not here." if r["kind"] == "elevation" else
           "Walls traced in the masonry colour, rooms shaded in the finishes colour, door / window tags ringed "
           "(red = count OPEN). Measured at the sheet's calibrated scale. Click an item to see exactly what it was "
           "measured from in Measure, where each wall, room and tag can be corrected.")
    chg = r.get("changes", {})
    chtxt = (f"<p><b>Since the previous revision:</b> {chg.get('added', 0)} added, {chg.get('moved', 0)} moved, "
             f"{chg.get('removed', 0)} removed (green +, orange arrow, red &times;).</p>") if sum(chg.values()) else ""
    body = f"""
<div class="tv">
 <div class="panel sheetlist">{left}</div>
 <div>
  <div class="zoom"><b style="margin-right:8px">{esc(r['drawing'])} &middot; {esc(r['title'])}</b>
   <button class="btn light sm" onclick="z(1.25)">+</button><button class="btn light sm" onclick="z(0.8)">&minus;</button>
   <button class="btn light sm" onclick="fit()">Fit</button>
   <a class="btn light sm" target="_blank" href="{url_for('download', jid=jid, name='overlays/' + r['file'], inline=1)}">Open PDF</a></div>
  <div class="canvas" id="cv"><img id="im" src="{url_for('png', jid=jid, name=r['file'])}" alt="marked-up drawing"></div>
 </div>
 <div class="panel"><h3>Taken off this sheet</h3><p class="hint">{how}</p>{chtxt}<div class="leg">{legend}</div></div>
</div>
<script>
 let s=1; const im=document.getElementById('im'), cv=document.getElementById('cv');
 function apply(){{ im.style.width=(im.naturalWidth*s)+'px'; }}
 function z(k){{ s=Math.min(6,Math.max(0.1,s*k)); apply(); }}
 function fit(){{ s=(cv.clientWidth-4)/im.naturalWidth; apply(); }}
 im.addEventListener('load',fit);
 cv.addEventListener('wheel',e=>{{ if(e.ctrlKey){{ e.preventDefault(); z(e.deltaY<0?1.1:0.9); }} }},{{passive:false}});
</script>"""
    return _page(jid, "takeoff", body)


@app.get("/job/<jid>/counts")
def counts(jid):
    j = _job(jid)
    c = _json(j, "counts.json", {})
    rows = ""
    for k, x in c.items():
        pl = ", ".join(f"{dn}: {n}" for dn, n in sorted(x["plan"].items())) or "no tag on any plan"
        if x.get("outside"):
            pl += "<br><small class='mute'>also on " + ", ".join(f"{dn}: {n}" for dn, n in x["outside"].items()) + \
                  " (a floor the schedule does not name - not counted)</small>"
        ok = x["status"] == "CLOSED"
        rows += (f'<tr class="{"closed" if ok else "open"}"><td><b>{esc(x["mark"])}</b></td>'
                 f'<td>{esc(x["schedule"])} <small class="mute">({esc(x["schedule_sheet"])})</small></td>'
                 f'<td>{pl}</td><td><b>{x["plan_total"]}</b></td>'
                 f'<td><span class="pill {"ok" if ok else "bad"}">{x["status"]}</span></td>'
                 f'<td><small>{esc(x["location"])}{("<br>" + esc(x["note"])) if x["note"] else ""}</small></td></tr>')
    n_open = sum(1 for x in c.values() if x["status"] != "CLOSED")
    body = f"""
<h1>Counts</h1>
<p class="lead">Every door and window mark counted two independent ways: off the schedule (read directly off the
drawing) and by finding its tag on the plans. Agreeing counts <b>close</b> the item. Disagreeing counts stay
<b>open</b> - both are kept, neither is billed, and the item is in the gaps list.</p>
<div class="kpis"><div class="kpi"><div class="v">{len(c) - n_open}</div><div class="l">closed</div></div>
<div class="kpi"><div class="v">{n_open}</div><div class="l">open - to resolve</div></div></div>
<label style="font-weight:500"><input type="checkbox" id="oo"> Show open only</label>
<div class="card" style="padding:0;margin-top:10px"><table class="grid" id="ct">
<tr><th>Mark</th><th>Schedule NO.</th><th>Counted on plans (x storeys)</th><th>Plans total</th><th>Status</th><th>Scheduled location</th></tr>
{rows}</table></div>
<script>document.getElementById('oo').addEventListener('change',e=>document.querySelectorAll('#ct tr.closed')
 .forEach(r=>r.style.display=e.target.checked?'none':''));</script>"""
    return _page(jid, "counts", body)


@app.get("/job/<jid>/assemblies")
def assemblies(jid):
    j = _job(jid)
    a = _json(j, "assemblies.json", [])
    cards = ""
    for x in a:
        items = "".join(f"<li>{esc(i)}</li>" for i in x["items"][:12])
        more = f"<li class='mute'>and {len(x['items']) - 12} more</li>" if len(x["items"]) > 12 else ""
        cards += (f'<div class="panel"><h3>POMI {esc(x["clause"])}</h3><div class="kv">'
                  f'<b>Unit</b><span>{esc(x["unit"])}</span><b>Formula</b><span>{esc(x["formula"])} '
                  f'<small class="mute">{esc(x["formula_text"])}</small></span>'
                  f'<b>Deduction</b><span>{("voids of " + str(x["deduct"]) + " m2 or more deducted (GP3.2)") if x["deduct"] else "none"}</span>'
                  f'<b>Must state</b><span>{esc(", ".join(x["describe"]) or "-")}</span></div>'
                  f'<small class="mute">Used by {len(x["items"])} item(s):</small><ul style="margin:4px 0 0 18px;font-size:13px">{items}{more}</ul></div>')
    body = f"""<h1>Assemblies</h1><p class="lead">How each measured element becomes a bill line. Once an element is
classified to a POMI clause, its unit, formula, deduction rule and the words its description must carry are looked
up from the clause table - never worked out item by item. Every item is checked against its clause on every run.</p>
<div class="asm">{cards}</div>"""
    return _page(jid, "assemblies", body)


@app.get("/job/<jid>/sheets")
def sheets(jid):
    j = _job(jid)
    s = _json(j, "sheets.json", [])
    how = {"TEXT": "text layer", "OUTLINED": "read directly off the image", "RASTER": "read directly off the image (scan)",
           "MIXED": "text layer + direct visual reading where text is outlined", "CAD": "native CAD geometry"}
    rows = "".join(f"<tr><td><b>{esc(x['drawing'])}</b></td><td>{esc(x['title'])}</td><td>{esc(x['kind'])}</td>"
                   f"<td><span class='badge'>{esc(x['class'])}</span></td><td>{esc(how.get(x['class'], ''))}</td>"
                   f"<td>{esc(x['title_block'])}</td><td><small class='mute'>{esc(x['file'])}</small></td></tr>" for x in s)
    body = f"""<h1>Sheets</h1><p class="lead">Every drawing in the set and how it could be read. Where the text layer
is empty or garbled - outlined CAD text, scans - the region is read directly off the image instead of being skipped.
A DXF placed beside a PDF (same name) is measured from its native geometry.</p>
<div class="card" style="padding:0"><table class="grid"><tr><th>Drawing</th><th>Title</th><th>Kind</th><th>Readability</th>
<th>How it was read</th><th>Title block</th><th>File</th></tr>{rows}</table></div>"""
    return _page(jid, "sheets", body)


@app.get("/job/<jid>/revisions")
def revisions(jid):
    j = _job(jid)
    ch = _json(j, "revision_changes.json")
    if not ch:
        body = ("<h1>Revisions</h1><div class='card'><p>This run was not compared with an earlier one - it is the first "
                "run of this project, or comparing was switched off.</p><p class='hint'>When revised drawings arrive, "
                "run them with the next revision number. The platform compares automatically with the latest earlier "
                "run of the same plot and reports which sheets, marks, tags and quantities changed.</p></div>")
        return _page(jid, "revisions", body)
    prev = jobs.get(j.get("previous_id", ""), {})
    sm = ch["summary"]

    def table(head, rows):
        if not rows:
            return "<p class='mute'>No changes.</p>"
        return ("<table class='grid'><tr>" + "".join(f"<th>{h}</th>" for h in head) + "</tr>" +
                "".join("<tr>" + "".join(f"<td>{esc(c)}</td>" for c in r) + "</tr>" for r in rows) + "</table>")

    tag_rows = [[dn, k, t[0], f"{t[1]}, {t[2]}" if k != "added" else "", f"{t[-2]}, {t[-1]}" if k != "removed" else ""]
                for dn, d in ch["tags"].items() for k, ts in d.items() for t in ts]
    body = f"""<h1>Revisions</h1><p class="lead">Rev {esc(ch['from_rev'])} &rarr; Rev {esc(ch['to_rev'])}
{('(compared with the run of ' + esc(prev.get('when', prev.get('id', ''))) + ')') if prev else ''}.
Changed tags are also marked on the drawings in the Takeoff view.</p>
<div class="kpis"><div class="kpi"><div class="v">{sm['sheets']}</div><div class="l">sheets changed</div></div>
<div class="kpi"><div class="v">{sm['schedule']}</div><div class="l">schedule changes</div></div>
<div class="kpi"><div class="v">{sm['tags']}</div><div class="l">tags added / moved / removed</div></div>
<div class="kpi"><div class="v">{sm['quantities']}</div><div class="l">bill quantities changed</div></div></div>
<div class="card"><h2>Sheets</h2>{table(['Drawing', 'Change', 'Title'], [[x['sheet'], x['change'], x['title']] for x in ch['sheets']])}</div>
<div class="card"><h2>Schedules</h2>{table(['Mark', 'Change', 'Was', 'Now'], [[x['mark'], x['change'], x.get('was', ''), x.get('now', '')] for x in ch['schedule']])}</div>
<div class="card"><h2>Tags on plans</h2><p class="hint">Positions in mm from grid 1/A.</p>{table(['Drawing', 'Change', 'Mark', 'Was at', 'Now at'], tag_rows)}</div>
<div class="card"><h2>Bill quantities</h2>{table(['Section', 'Item', 'Change', 'Was', 'Now', 'Unit'], [[x['section'], x['item'], x['change'], x.get('was', ''), x.get('now', '') if x.get('now') is not None else 'OPEN', x['unit']] for x in ch['quantities']])}</div>"""
    return _page(jid, "revisions", body)


# ------------------------------------------------------------------ batch: many drawing sets at once

BATCH_NEW = BASE.replace("{% block body %}{% endblock %}", """
<h1>Batch: several drawing sets at once</h1>
<p class="lead">Each drawing set gets its own full run, with its own results page. {{ parallel_runs }} run(s) go at once and the
rest wait their turn; one summary lists them all.</p>
<form class="card" method="post" action="{{ url_for('batch_start') }}" enctype="multipart/form-data">
 <div class="step"><div class="n">1</div><div class="b">
  <h3>The drawing sets</h3>
  <label class="drop" id="drop"><input type="file" name="files" id="files" multiple accept=".zip">
   <div><b>Click to choose</b> or drag several .zip files here</div>
   <div class="hint">One zip = one drawing set (a whole architectural set: plans, sections, schedules and details).</div>
   <div id="picked"></div></label>
  <div class="or">or folders already on this computer</div>
  <label>One drawing-set folder per line</label>
  <textarea name="folders" rows="4" style="width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:6px;font:inherit"
   placeholder="D:\\Drawings\\Project A\\Architecture&#10;D:\\Drawings\\Project B\\Architecture"></textarea>
  <label style="margin-top:12px">or a folder whose sub-folders (or zips) are the drawing sets</label>
  <input type="text" name="parent" placeholder="e.g. D:\\Drawings\\Tender pack">
 </div></div>
 <div class="step"><div class="n">2</div><div class="b">
  <h3>Revision</h3>
  <input type="text" name="rev" value="00" style="max-width:120px">
  <label style="margin-top:12px">Compare each with an earlier run</label>
  <select name="compare" style="width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:6px;font:inherit">
   <option value="auto">Automatic &ndash; the latest earlier run of the same project</option>
   <option value="none">Don't compare</option></select>
  <details><summary>AI reading settings (only needed for new drawings)</summary>
   <p class="hint">Used by every run in the batch, for this batch only; not saved.</p>
   <label style="margin-top:10px">Anthropic (Claude) API key &ndash; used first</label><input type="password" name="ANTHROPIC_API_KEY" autocomplete="off">
   <label style="margin-top:10px">OpenAI API key &ndash; backup</label><input type="password" name="OPENAI_API_KEY" autocomplete="off">
   <label style="margin-top:10px">Gemini API key &ndash; second backup</label><input type="password" name="GEMINI_API_KEY" autocomplete="off">
   <label style="margin-top:10px">Order to try them in</label><input type="text" name="providers" value="claude,openai,gemini,claude-login">
  </details>
 </div></div>
 <div class="step"><div class="n">3</div><div class="b"><button class="btn big" type="submit">Run the batch</button></div></div>
</form>
<div class="card"><h2>Earlier batches</h2>
{% if batches %}<table class="list"><tr><th>Started</th><th>Drawing sets</th><th></th></tr>
{% for b in batches %}<tr><td>{{ b.when }}</td><td>{{ b.jobs|length }}</td>
<td style="text-align:right"><a class="btn light sm" href="{{ url_for('batch_page', bid=b.id) }}">Open</a></td></tr>{% endfor %}</table>
{% else %}<p class="mute">No batches yet.</p>{% endif %}</div>
<script>
 const drop=document.getElementById('drop'), input=document.getElementById('files'), picked=document.getElementById('picked');
 function show(){picked.innerHTML=input.files.length?'<b>'+input.files.length+' zip file(s)</b> selected':'';}
 input.addEventListener('change',show);
 ['dragenter','dragover'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('over');}));
 ['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('over');}));
 drop.addEventListener('drop',ev=>{input.files=ev.dataTransfer.files;show();});
</script>
""")

BATCH = BASE.replace("{% block body %}{% endblock %}", """
<h1>Batch &middot; {{ b.jobs|length }} drawing set(s)</h1>
<p class="lead">Started {{ b.when }} &middot; revision {{ b.rev }} &middot; {{ parallel_runs }} run(s) at once. <span id="tally"></span></p>
{% if b.skipped %}<p class="note">Not run: {{ b.skipped|join('; ') }}</p>{% endif %}
<div class="card"><table class="list" id="sets"><tr><th>Drawing set</th><th>Status</th><th>Time</th><th>Items</th><th>Gaps</th><th>Checks</th><th></th></tr></table>
<div style="margin-top:14px"><a class="btn" id="dl" href="{{ url_for('batch_summary', bid=b.id) }}">Download summary (.xlsx)</a>
<span class="hint" id="dlhint"></span></div></div>
<script>
 const pill={queued:'<span class="pill warn">Waiting</span>',failed:'<span class="pill bad">Failed</span>'};
 async function tick(){
  const d=await (await fetch("{{ url_for('batch_status', bid=b.id) }}")).json();
  const t=document.getElementById('sets'); t.querySelectorAll('tr.r').forEach(r=>r.remove());
  for(const s of d.sets){
   const tr=document.createElement('tr'); tr.className='r';
   const st=s.status==='running'?'<span class="pill run">'+s.stage+'</span>':s.status==='done'?
     (s.checks_ok===false?'<span class="pill bad">Check failed</span>':'<span class="pill ok">Ready</span>'):pill[s.status];
   tr.innerHTML='<td><b>'+s.name+'</b></td><td>'+st+'</td><td>'+(s.seconds!=null?s.seconds+' s':'')+'</td><td>'+(s.items??'')+
     '</td><td>'+(s.gaps??'')+'</td><td class="mute">'+(s.checks||'')+'</td><td style="text-align:right"><a class="btn light sm" href="'+s.url+'">'+
     (s.status==='done'?'Open results':'Open')+'</a></td>';
   t.appendChild(tr);}
  document.getElementById('tally').textContent=d.ready+' of '+d.sets.length+' ready'+(d.running?' \\u00b7 '+d.running+' running':'')+
    (d.waiting?' \\u00b7 '+d.waiting+' waiting':'')+(d.failed?' \\u00b7 '+d.failed+' failed':'');
  document.getElementById('dlhint').textContent=d.finished?'':' (the runs still going are listed as they are now)';
  if(!d.finished)setTimeout(tick,2000);}
 tick();
</script>
""")


def _batch_record(b: dict) -> dict:
    b = dict(b)
    b["when"] = time.strftime("%d %b %Y, %H:%M", time.localtime(b["created"]))
    return b


def _save_batch(b: dict) -> None:
    BATCHES_DIR.mkdir(parents=True, exist_ok=True)
    (BATCHES_DIR / f"{b['id']}.json").write_text(json.dumps(b, indent=1), encoding="utf-8")


def _new_job(jid: str, label_: str, drawings: Path, form, keys: dict, batch: str | None = None) -> dict:
    jobs[jid] = {"id": jid, "label": label_, "drawings": drawings, "out": JOBS_DIR / jid / "output",
                 "rev": form.get("rev", "00").strip() or "00",
                 "providers": form.get("providers", PROVIDERS_DEFAULT), "keys": dict(keys),
                 "local": _is_local(),
                 "compare": form.get("compare", "auto"), "batch": batch,
                 "status": "queued", "log": "", "created": time.time(), "started": None,
                 "verify": None, "verify_ok": None}
    return jobs[jid]


@app.get("/batch")
def batch_new():
    bs = sorted((_batch_record(b) for b in batches.values()), key=lambda b: b["created"], reverse=True)
    return render_template_string(BATCH_NEW, batches=bs, parallel_runs=PARALLEL_RUNS)


@app.post("/batch/start")
def batch_start():
    bid = "B" + time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:4]
    keys = {k: request.form.get(k, "").strip() for k in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY")}
    wanted: list[tuple[str, object]] = []          # (name, uploaded zip | folder | zip on disk)
    for f in request.files.getlist("files"):
        if f and f.filename and f.filename.lower().endswith(".zip"):
            wanted.append((Path(f.filename).stem, f))
    lines = [ln.strip().strip('"') for ln in request.form.get("folders", "").splitlines() if ln.strip()]
    parent = request.form.get("parent", "").strip().strip('"')
    skipped = []
    if lines:
        wanted += [(n, p) for n, p in batchrun.find_sets([Path(x) for x in lines])]
    if parent:
        if Path(parent).is_dir():
            wanted += batchrun.find_sets([Path(parent)], each=True)
        else:
            skipped.append(f"{parent} (not a folder)")
    made, used = [], set()
    for name, src in wanted:
        base, k = name, 2
        while name.lower() in used:
            name, k = f"{base} ({k})", k + 1
        used.add(name.lower())
        jid = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:4]
        folder = JOBS_DIR / jid
        folder.mkdir(parents=True)
        if isinstance(src, Path) and src.is_dir():
            drawings = src
        else:
            z = folder / "upload.zip"
            if isinstance(src, Path):
                shutil.copyfile(src, z)
            else:
                src.save(z)
            try:
                drawings = batchrun.unpack(z, folder / "drawings")
            except zipfile.BadZipFile:
                drawings = None
            z.unlink(missing_ok=True)
        if drawings is None or not batchrun.has_drawings(drawings):
            skipped.append(f"{name} (no drawings found)")
            shutil.rmtree(folder, ignore_errors=True)
            continue
        _new_job(jid, name, drawings, request.form, keys, bid)
        made.append(jid)
    if not made:
        abort(400, "No drawing sets found. Choose zip files, or give folders that contain drawings. "
                   + ("Not run: " + "; ".join(skipped) if skipped else ""))
    batches[bid] = {"id": bid, "created": time.time(), "jobs": made, "rev": request.form.get("rev", "00").strip() or "00",
                    "names": {jid: jobs[jid]["label"] for jid in made}, "skipped": skipped}
    _save_batch(batches[bid])
    for jid in made:                                 # they queue for a slot in this order
        threading.Thread(target=run_job, args=(jid,), daemon=True).start()
    return redirect(url_for("batch_page", bid=bid))


def _batch(bid: str) -> dict:
    b = batches.get(bid)
    if b is None:
        abort(404)
    return b


@app.get("/batch/<bid>")
def batch_page(bid):
    return render_template_string(BATCH, b=_batch_record(_batch(bid)), parallel_runs=PARALLEL_RUNS)


@app.get("/batch/<bid>/status")
def batch_status(bid):
    b = _batch(bid)
    rows = []
    for jid in b["jobs"]:
        j = jobs.get(jid)
        if j is None:
            continue
        row = {"id": jid, "name": j["label"], "status": j["status"], "url": url_for("job", jid=jid),
               "stage": STAGES[stage_now(j["log"])][1] if j["status"] == "running" else "",
               "seconds": round(time.time() - j["started"]) if j["status"] == "running" and j["started"] else None,
               "items": None, "gaps": None, "checks": "", "checks_ok": j.get("verify_ok")}
        if j["status"] == "done":
            s = batchrun.summary_row(j["label"], j["out"], "done", j.get("verify_ok"), (j.get("verify") or [""])[0])
            row.update(seconds=s["seconds"], items=sum(x["items"] for x in s["sections"].values()), gaps=s["gaps"],
                       checks="passed" if j.get("verify_ok") else (j.get("verify") or [""])[0])
        rows.append(row)
    n = {k: sum(1 for r in rows if r["status"] == k) for k in ("done", "running", "queued", "failed")}
    return jsonify(sets=rows, ready=sum(1 for r in rows if r["status"] == "done" and r["checks_ok"] is not False),
                   running=n["running"], waiting=n["queued"], failed=n["failed"] + sum(
                       1 for r in rows if r["status"] == "done" and r["checks_ok"] is False),
                   finished=n["running"] == 0 and n["queued"] == 0)


@app.get("/batch/<bid>/summary.xlsx")
def batch_summary(bid):
    b = _batch(bid)
    rows = []
    for jid in b["jobs"]:
        j = jobs.get(jid)
        if j is not None:
            rows.append(batchrun.summary_row(j["label"], j["out"], j["status"], j.get("verify_ok"),
                                             (j.get("verify") or [""])[0]))
    path = BATCHES_DIR / "summaries" / f"{bid}.xlsx"
    batchrun.write_summary(rows, path)
    return send_file(path, as_attachment=True, download_name=f"Batch summary {b['id']}.xlsx")


def _started(d: Path) -> float:
    """A run's start time from its id (20260925-001243-e8ee); the folder's own time changes whenever a file in it does."""
    try:
        return time.mktime(time.strptime(d.name[:15], "%Y%m%d-%H%M%S"))
    except ValueError:
        return d.stat().st_mtime


def _load_existing():
    """Runs and batches from earlier sessions stay listed."""
    if not JOBS_DIR.exists():
        return
    in_batch, names = {}, {}
    for f in sorted(BATCHES_DIR.glob("*.json")) if BATCHES_DIR.exists() else []:
        b = json.loads(f.read_text(encoding="utf-8"))
        if not isinstance(b, dict) or "jobs" not in b:
            continue
        batches[b["id"]] = b
        in_batch.update({jid: b["id"] for jid in b["jobs"]})
        names.update(b.get("names", {}))
    for d in sorted(JOBS_DIR.iterdir()):
        if (d / "output" / "run.json").exists():
            run = json.loads((d / "output" / "run.json").read_text(encoding="utf-8"))
            folder = Path(run.get("drawings_folder") or d / "drawings")
            jobs[d.name] = {"id": d.name, "label": names.get(d.name, f"earlier run ({folder.name})"), "drawings": folder,
                            "out": d / "output", "rev": run.get("rev", ""), "providers": "", "status": "done",
                            "log": "(earlier session)", "created": _started(d), "started": None, "verify": None,
                            "verify_ok": None, "batch": in_batch.get(d.name)}
    for b in batches.values():                       # a set that never finished stays listed, as failed
        for jid in b["jobs"]:
            if jid not in jobs:
                jobs[jid] = {"id": jid, "label": names.get(jid, jid), "drawings": JOBS_DIR / jid, "out": JOBS_DIR / jid / "output",
                             "rev": b.get("rev", ""), "providers": "", "status": "failed",
                             "log": "(did not finish in an earlier session)", "created": _started(JOBS_DIR / jid),
                             "started": None, "verify": None, "verify_ok": None, "batch": b["id"]}


workspace.init(jobs=jobs, job=_job, page=_page, previous_for=previous_for, root=ROOT,
               plain_page=lambda body: render_template_string(WS, tabs="", body=body))
app.register_blueprint(workspace.bp)

if __name__ == "__main__":
    _load_existing()
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5000)), debug=False, threaded=True)
