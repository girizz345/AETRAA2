"""
AETRAA Core - independent QA gate.

Blocking check every module runs before its deliverable can issue.
Opens every file exactly as the client's reviewer would. Changes
nothing; reports PASS/FAIL with evidence. Deterministic - no AI.

Usage (library):
    from core.qagate import run_qa
    passed, findings = run_qa(project, out_dir, markup_dirs, workbook_path)

Usage (CLI):
    python3 -m core.qagate <project_dir> [--out <reports subdir>]
"""

import argparse
import random
import re
import sys
from pathlib import Path

# Language that must never appear in a client-facing workbook cell.
BANNED_WORDS = ['deep dive', 'token', ' ai ', 'Ø', 'todo', 'fixme',
                'lorem']

# FreeText annotation rect height must be at least this fraction of the
# page width to be readable at full-sheet scale (approx 7pt at A1).
LEGIBILITY_RATIO = 0.008

MAX_FORMULA_SAMPLE = 50
SUM_RE = re.compile(r'^=\s*SUM\(([A-Za-z]{1,3}\d+:[A-Za-z]{1,3}\d+)\)$',
                    re.IGNORECASE)
HYPERLINK_FORMULA_RE = re.compile(r'^=\s*HYPERLINK\(\s*"([^"]+)"',
                                  re.IGNORECASE)
VERSION_RE = re.compile(r'^(.*)_v(\d+)(\.\w+)$', re.IGNORECASE)

_RNG = random.Random(42)  # deterministic sampling


# ---------------------------------------------------------------- workbook

# ── PLACEHOLDER / TEMPLATE-GAP SCAN (shared by every AETRAA agent) ──
# BANNED_WORDS is a fixed word list, so it cannot catch a gap whose text
# changes every time - '[specified material]', '[insert zone: ...]',
# 'P/[end grid]', '[X] m to [Y] m' all passed the word scan and reached
# client deliverables. These are PATTERNS, so the shape is caught however
# the wording varies.
#
# Deliberately NOT included: bare 'TBC' (the LOCATION TBC register uses it
# correctly) and bare 'verify' (legitimate on internal registers). Add
# agent-specific patterns via the `extra` argument rather than widening
# these defaults - they run against every agent.
PLACEHOLDER_PATTERNS = [
    ('square-bracket gap', None),   # handled by _bracket_gap (below)
    ('angle-bracket gap',  re.compile(r'<[^>]{1,80}>')),
    # A bare XX/YY/NNN filler is a placeholder; the SAME letters inside a
    # hyphenated ISO 19650 drawing code (SIMR3-BW-UAI-ZZ-ZZ-XX-CA-ME-00001)
    # are legitimate "not-applicable" field values, NOT a gap. Require the
    # run to be flanked by non-code characters (not a hyphen or word char),
    # so codes never trip the scan while real fillers still do.
    ('X/Y/N filler',       re.compile(r'(?<![-\w])(?:XX+|YY+|NNN+|\?\?+)'
                                      r'(?![-\w])')),
    ('insert/specify',     re.compile(r'\b(?:insert|specify)\s+'
                                      r'(?:the\s+)?\w+', re.I)),
    ('either-or template', re.compile(r'\beither\s*\(a\)|\bor\s*\(b\)',
                                      re.I)),
    ('TBD',                re.compile(r'\bTBD\b', re.I)),
]

# Internal registers legitimately carry instruction language - a scan of
# them is noise, not a finding.
PLACEHOLDER_SKIP_SHEETS = ('unresolved', 'comment', 'note', 'tbc',
                           'log', 'audit', 'register of queries')


# Bracketed text is NOT automatically a gap. The agents use [DEV-ROUTE],
# [OMISSION], [ADDED SCOPE], [PL] as deliberate classification tags -
# flagging those blocked (or, after the fix-round change, caveated) a
# whole run. A bracket is a GAP when it holds prose (lowercase), a bare
# filler ([X]), or an unresolved marker ("TO BE CONFIRMED").
#
# This allow-list MUST stay in step with the tender_ifc agent's
# CLASSIFICATIONS set (agents/tender_ifc/agent.py): every classification
# tag it can emit is whitelisted here. The DEV-<WORD> family is matched
# generically so a new DEV-* code never needs a qagate edit. [A-Z]{2,4}
# covers the ISO/discipline short codes (PL, HV, FF, EL, EV, AR, ST ...).
_ALLOWED_TAG = re.compile(
    r'^(?:'
    r'[A-Z]{2,4}'                       # short codes: PL, HV, FCU, AHU ...
    r'|DEV-[A-Z]{2,6}'                  # DEV-ROUTE, DEV-SIZE, DEV-QTY ...
    r'|ADDED SCOPE|DESIGN DEVELOPMENT'  # multi-word tags
    r'|OMISSION|OMITTED|ADDED|REMOVED|CHANGED|RELOCATION|BETTERMENT'
    r'|DOWNGRADE|UPGRADE|CREDIT|VARIATION|ADMINISTRATIVE|CLARIFICATION'
    r'|PASS'
    r')$')
_UNRESOLVED_WORDS = re.compile(
    r'\b(?:TO BE CONFIRMED|TBD|INSERT|SPECIFY|CONFIRM|UNKNOWN)\b', re.I)


def _bracket_gap(text):
    """True when the string holds a bracketed PLACEHOLDER (not a tag)."""
    for inner in re.findall(r'\[([^\]]{1,80})\]', str(text or '')):
        t = inner.strip()
        if not t:
            return True
        # repeated-letter fillers first: [X] [XX] [YY] [NNN] are gaps even
        # though they look like a short tag such as [PL].
        if re.fullmatch(r'([XYNZ])\1*|\?+', t, re.I) or len(t) == 1:
            return True
        if _UNRESOLVED_WORDS.search(t):
            return True                      # [GRID TO BE CONFIRMED]
        if _ALLOWED_TAG.match(t):
            continue                         # [DEV-ROUTE] [PL] [ADDED SCOPE]
        if re.search(r'[a-z]', t):
            return True                      # [grid(s)] [specified material]
        return True                          # unknown ALL-CAPS phrase
    return False


def placeholder_hits(text, extra=None):
    """Template gaps in a client-facing string. Returns a list of pattern
    names. `extra` accepts additional (name, compiled_regex) pairs for an
    agent with its own conventions."""
    t = str(text or '')
    if not t or t.startswith('='):
        return []
    pats = list(PLACEHOLDER_PATTERNS) + list(extra or [])
    hits = [name for name, rx in pats if rx is not None and rx.search(t)]
    if _bracket_gap(t):
        hits.append('square-bracket gap')
    return hits


def _banned_hits(text):
    low = f' {str(text).lower()} '
    return [w for w in BANNED_WORDS if w.lower() in low]


def _sheet_for_link(location):
    """Sheet name out of a link location like 'Sheet Name'!A1."""
    loc = location.lstrip('#')
    sheet = loc.split('!')[0] if '!' in loc else loc
    return sheet.strip("'")


def _check_hyperlink_target(target, wb_dir, sheetnames):
    """Return an error string, or None if the target is fine."""
    if target.lower().startswith(('http://', 'https://', 'mailto:')):
        return None  # external URL - existence not checkable on disk
    if target.startswith('#'):
        sheet = _sheet_for_link(target)
        if sheet not in sheetnames:
            return f"internal link to missing sheet '{sheet}'"
        return None
    path_part = target.split('#')[0]
    if not path_part:
        return None
    try:
        resolved = (wb_dir / Path(path_part.replace('\\', '/'))).resolve()
    except (OSError, ValueError):
        return f"unresolvable link target '{target}'"
    if not resolved.exists():
        return f"missing link target '{target}'"
    return None


def _check_workbook(workbook_path, findings):
    import openpyxl

    wb_path = Path(workbook_path)
    if not wb_path.is_file():
        findings.append(f"FAIL: WORKBOOK not found: {wb_path}")
        return
    try:
        wbf = openpyxl.load_workbook(wb_path, data_only=False)
        wbv = openpyxl.load_workbook(wb_path, data_only=True)
    except Exception as e:
        findings.append(f"FAIL: WORKBOOK does not open with openpyxl: {e}")
        return
    findings.append(f"PASS: WORKBOOK opens: {wb_path.name} "
                    f"({len(wbf.sheetnames)} sheets)")

    # --- sheets present: non-empty content beyond a Cover sheet
    content_sheets = []
    for ws in wbf.worksheets:
        if ws.title.strip().lower() == 'cover':
            continue
        if ws.max_row >= 1 and any(
                c.value not in (None, '')
                for row in ws.iter_rows() for c in row):
            content_sheets.append(ws.title)
    if content_sheets:
        findings.append(f"PASS: WORKBOOK {len(content_sheets)} non-empty "
                        f"sheets beyond Cover: {', '.join(content_sheets)}")
    else:
        findings.append("FAIL: WORKBOOK has no non-empty sheets beyond "
                        "Cover")

    # --- banned language scan (every cell, every sheet)
    banned_found = []
    placeholder_found = []
    for ws in wbf.worksheets:
        for row in ws.iter_rows():
            for c in row:
                if isinstance(c.value, str) and not \
                        c.value.startswith('='):
                    for w in _banned_hits(c.value):
                        banned_found.append(
                            f"'{w.strip()}' at {ws.title}!{c.coordinate}")
                    if not any(k in ws.title.lower()
                               for k in PLACEHOLDER_SKIP_SHEETS):
                        for nm in placeholder_hits(c.value):
                            placeholder_found.append(
                                f"{nm} at {ws.title}!{c.coordinate}: "
                                f"{str(c.value)[:60]}")
    if banned_found:
        shown = '; '.join(banned_found[:10])
        more = f" (+{len(banned_found) - 10} more)" \
            if len(banned_found) > 10 else ''
        findings.append(f"FAIL: WORKBOOK banned language in "
                        f"{len(banned_found)} cell(s): {shown}{more}")
    else:
        findings.append("PASS: WORKBOOK language scan clean "
                        "(no banned words in any cell)")
    if placeholder_found:
        shown = '; '.join(placeholder_found[:8])
        more = (f" (+{len(placeholder_found) - 8} more)"
                if len(placeholder_found) > 8 else '')
        findings.append(f"FAIL: WORKBOOK unresolved placeholder/template "
                        f"gap in {len(placeholder_found)} cell(s) - not "
                        f"issuable to a client: {shown}{more}")
    else:
        findings.append("PASS: WORKBOOK placeholder scan clean "
                        "(no template gaps in any client cell)")

    # --- hyperlinks: file targets exist, internal links hit real sheets
    link_errors, links_checked = [], 0
    wb_dir = wb_path.parent
    names = wbf.sheetnames
    for ws in wbf.worksheets:
        for row in ws.iter_rows():
            for c in row:
                target, location = None, None
                if c.hyperlink is not None:
                    target = c.hyperlink.target
                    location = c.hyperlink.location
                elif isinstance(c.value, str):
                    m = HYPERLINK_FORMULA_RE.match(c.value)
                    if m:
                        target = m.group(1)
                if target:
                    links_checked += 1
                    err = _check_hyperlink_target(target, wb_dir, names)
                    if err:
                        link_errors.append(
                            f"{ws.title}!{c.coordinate}: {err}")
                elif location:
                    links_checked += 1
                    sheet = _sheet_for_link(location)
                    if sheet not in names:
                        link_errors.append(
                            f"{ws.title}!{c.coordinate}: internal link "
                            f"to missing sheet '{sheet}'")
    if link_errors:
        shown = '; '.join(link_errors[:10])
        more = f" (+{len(link_errors) - 10} more)" \
            if len(link_errors) > 10 else ''
        findings.append(f"FAIL: WORKBOOK {len(link_errors)} of "
                        f"{links_checked} hyperlink(s) broken: "
                        f"{shown}{more}")
    else:
        findings.append(f"PASS: WORKBOOK hyperlinks OK "
                        f"({links_checked} checked)")

    # --- arithmetic spot check on =SUM(range) formulas
    sum_cells = []
    for ws in wbf.worksheets:
        for row in ws.iter_rows():
            for c in row:
                if isinstance(c.value, str):
                    m = SUM_RE.match(c.value)
                    if m:
                        sum_cells.append((ws.title, c.coordinate,
                                          m.group(1)))
    if len(sum_cells) > MAX_FORMULA_SAMPLE:
        sum_cells = _RNG.sample(sum_cells, MAX_FORMULA_SAMPLE)
    checked, skipped, math_errors = 0, 0, []
    for sheet, coord, rng in sum_cells:
        wsf, wsv = wbf[sheet], wbv[sheet]
        cached = wsv[coord].value
        if not isinstance(cached, (int, float)):
            skipped += 1
            continue
        vals, pure = [], True
        for row in wsf[rng]:
            for cell in row:
                v = cell.value
                if isinstance(v, str) and v.startswith('='):
                    pure = False  # range contains formulas - skip
                    break
                if isinstance(v, (int, float)):
                    vals.append(v)
                elif v not in (None, ''):
                    pure = False  # non-numeric text in range
                    break
            if not pure:
                break
        if not pure:
            skipped += 1
            continue
        checked += 1
        expected = sum(vals)
        if abs(expected - cached) > 0.01:
            math_errors.append(f"{sheet}!{coord} =SUM({rng}) shows "
                               f"{cached}, recomputed {expected}")
    if math_errors:
        findings.append(f"FAIL: WORKBOOK arithmetic wrong in "
                        f"{len(math_errors)} formula(s): "
                        f"{'; '.join(math_errors[:10])}")
    else:
        findings.append(f"PASS: WORKBOOK arithmetic spot check OK "
                        f"({checked} SUM formulas verified, "
                        f"{skipped} skipped as not pure-number, "
                        f"{len(sum_cells)} sampled)")


# ------------------------------------------------------- marked drawings

def _check_markups(markup_dirs, out_dir, findings):
    import fitz

    pdfs = []
    for d in markup_dirs:
        d = Path(d)
        if d.is_dir():
            for pattern in ('*_MARKED.pdf', '*_MEASURED.pdf'):
                pdfs.extend(sorted(d.rglob(pattern)))
    if not pdfs:
        findings.append("FAIL: MARKUPS no *_MARKED.pdf or *_MEASURED.pdf "
                        f"found in {[str(d) for d in markup_dirs]}")
        return
    total_sq, total_ft = 0, 0
    empty_text, illegible, unreadable = [], [], []
    for pdf in pdfs:
        try:
            doc = fitz.open(pdf)
        except Exception as e:
            unreadable.append(f"{pdf.name}: {e}")
            continue
        try:
            for page in doc:
                min_h = page.rect.width * LEGIBILITY_RATIO
                for annot in page.annots() or []:
                    kind = annot.type[1]
                    if kind == 'Square':
                        total_sq += 1
                    elif kind == 'FreeText':
                        total_ft += 1
                        content = (annot.info.get('content') or '').strip()
                        if not content:
                            empty_text.append(
                                f"{pdf.name} p{page.number + 1}")
                        if annot.rect.height < min_h:
                            illegible.append(
                                f"{pdf.name} p{page.number + 1} "
                                f"(h={annot.rect.height:.0f}pt, "
                                f"needs {min_h:.0f}pt)")
        finally:
            doc.close()
    findings.append(f"PASS: MARKUPS {len(pdfs)} marked drawing(s) opened; "
                    f"{total_sq} Square + {total_ft} FreeText annotations")
    if total_sq == 0 and total_ft == 0:
        findings.append("FAIL: MARKUPS no annotations found in any "
                        "marked drawing")
    if unreadable:
        findings.append(f"FAIL: MARKUPS {len(unreadable)} PDF(s) "
                        f"unreadable: {'; '.join(unreadable[:5])}")
    if empty_text:
        findings.append(f"FAIL: MARKUPS {len(empty_text)} FreeText "
                        f"annotation(s) with empty content: "
                        f"{'; '.join(empty_text[:10])}")
    else:
        findings.append("PASS: MARKUPS no empty FreeText annotations")
    if illegible:
        shown = '; '.join(illegible[:10])
        more = f" (+{len(illegible) - 10} more)" \
            if len(illegible) > 10 else ''
        findings.append(f"FAIL: MARKUPS {len(illegible)} FreeText "
                        f"annotation(s) too small to read at full-sheet "
                        f"scale: {shown}{more}")
    else:
        findings.append(f"PASS: MARKUPS all {total_ft} FreeText "
                        f"annotations legible at full-sheet scale")

    # --- render one random full sheet as visual evidence
    try:
        proof_src = _RNG.choice(pdfs)
        doc = fitz.open(proof_src)
        pix = doc[0].get_pixmap(dpi=35)
        out = Path(out_dir) / '_qa_proof.png'
        out.parent.mkdir(parents=True, exist_ok=True)
        pix.save(out)
        doc.close()
        findings.append(f"PASS: MARKUPS full-sheet proof render saved: "
                        f"{out.name} (from {proof_src.name})")
    except Exception as e:
        findings.append(f"FAIL: MARKUPS could not render proof sheet: {e}")


# ------------------------------------------------------------- package

def _check_package(out_dir, findings):
    out_dir = Path(out_dir)
    if not out_dir.is_dir():
        findings.append(f"FAIL: PACKAGE output folder missing: {out_dir}")
        return
    review_log = out_dir / 'Review_Log.txt'
    if review_log.is_file():
        findings.append("PASS: PACKAGE Review_Log.txt present in output "
                        "folder (internal notes out of the workbook)")
    else:
        findings.append(f"FAIL: PACKAGE Review_Log.txt missing from "
                        f"{out_dir}")
    # version housekeeping - report, do not block
    groups = {}
    for f in sorted(out_dir.iterdir()):
        if f.is_file():
            m = VERSION_RE.match(f.name)
            if m:
                groups.setdefault(m.group(1) + m.group(3),
                                  []).append((int(m.group(2)), f.name))
    for key, items in groups.items():
        vers = sorted(v for v, _ in items)
        if len(vers) > 1 and 0 in vers:
            names = ', '.join(n for _, n in sorted(items))
            findings.append(f"PASS: PACKAGE note - v0 and later versions "
                            f"both present ({names}) - confirm the old "
                            f"version is retained intentionally")
    files = sorted(f.name for f in out_dir.iterdir() if f.is_file())
    findings.append(f"PASS: PACKAGE output folder file list: "
                    f"{', '.join(files) if files else '(empty)'}")


# ------------------------------------------------------------ entry point

def run_qa(project, out_dir, markup_dirs, workbook_path):
    """Run the full QA gate. Returns (passed, findings).

    passed is True only if no finding starts with FAIL.
    Never raises - any exception becomes a FAIL finding.
    """
    findings = []
    for label, fn, args in (
            ('WORKBOOK', _check_workbook, (workbook_path, findings)),
            ('MARKUPS', _check_markups, (markup_dirs, out_dir, findings)),
            ('PACKAGE', _check_package, (out_dir, findings))):
        try:
            fn(*args)
        except Exception as e:
            findings.append(f"FAIL: {label} check crashed: "
                            f"{type(e).__name__}: {e}")
    passed = not any(f.startswith('FAIL') for f in findings)
    _print_summary(Path(project).name, passed, findings)
    return passed, findings


def verify_deliverable(project, out_dir, markup_dirs, workbook_path):
    """Blocking deliverable verification - alias of run_qa() used by the
    ROLE-AGENT framework's QA role pass. Returns (passed, findings)."""
    return run_qa(project, out_dir, markup_dirs, workbook_path)


def _print_summary(project_name, passed, findings):
    fails = sum(1 for f in findings if f.startswith('FAIL'))
    passes = len(findings) - fails
    print(f"\n{'=' * 62}")
    print(f"QA GATE - {project_name}")
    print('=' * 62)
    for f in findings:
        print(f"  {f}")
    print('-' * 62)
    verdict = 'PASSED - deliverable may issue' if passed else \
        'FAILED - deliverable is BLOCKED, escalate to Project Manager'
    print(f"  {passes} pass / {fails} fail  ->  QA {verdict}")
    print('=' * 62)


# ------------------------------------------------------------------ CLI

def _newest_workbook(reports_dir):
    """Newest workbook under Reports/** - highest version wins, then
    modification time. Excel temp files and agent caches excluded."""
    candidates = []
    for f in reports_dir.rglob('*.xlsx'):
        if f.name.startswith(('~$', '.')) or \
                '_agent_cache' in f.parts:
            continue
        m = VERSION_RE.match(f.name)
        ver = int(m.group(2)) if m else -1
        candidates.append((ver, f.stat().st_mtime, f))
    if not candidates:
        return None
    return max(candidates)[2]


def _find_markup_dirs(project):
    dirs = []
    for d in sorted(project.rglob('*')):
        if d.is_dir() and 'markups' in d.name.lower() and \
                '_agent_cache' not in d.parts:
            if not any('markups' in p.lower() for p in
                       d.relative_to(project).parts[:-1]):
                dirs.append(d)  # top-level markup dirs only, not children
    return dirs


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog='python3 -m core.qagate',
        description='AETRAA independent QA gate - blocking pass/fail '
                    'check on a project deliverable.')
    ap.add_argument('project_dir', help='project folder')
    ap.add_argument('--out', default=None,
                    help='reports subdirectory holding the deliverable '
                         '(default: folder of the newest workbook)')
    args = ap.parse_args(argv)

    project = Path(args.project_dir)
    if not project.is_dir():
        print(f"FAIL: project folder not found: {project}")
        return 2
    reports = project / 'Reports'
    search_root = reports if reports.is_dir() else project

    if args.out:
        out_dir = reports / args.out
        wb = _newest_workbook(out_dir) if out_dir.is_dir() else None
        if wb is None:
            wb = _newest_workbook(search_root)
    else:
        wb = _newest_workbook(search_root)
        out_dir = wb.parent if wb else search_root

    markup_dirs = _find_markup_dirs(project)
    print(f"Project:   {project}")
    print(f"Workbook:  {wb if wb else '(none found)'}")
    print(f"Out dir:   {out_dir}")
    print(f"Markups:   {', '.join(str(d) for d in markup_dirs) or '(none)'}")

    passed, _ = run_qa(project, out_dir, markup_dirs,
                       wb if wb else project / '_missing_workbook.xlsx')
    return 0 if passed else 1


if __name__ == '__main__':
    sys.exit(main())
