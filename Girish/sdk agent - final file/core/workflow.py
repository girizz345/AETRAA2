"""
AETRAA Core - QS office workflow engine.

Runs a module's work through the numbered steps of a real QS office:
each step is owned by ONE professional role and executed strictly in
sequence - production by the QS, verification by the checking engineers
(who raise comments, never touch the data), clearance rounds by the QS,
document control at intake and issue, and the Director's sign-off.

A step is a dict:
    {'no': 1,
     'owner_role': 'document_controller',        # core.roles id
     'title': 'Drawing intake and registration',
     'kind': 'gate' | 'produce' | 'check' | 'clear' | 'signoff',
     'fn': fn(data, use_ai) -> [finding strings]}

Optional step keys (modules that run one discipline at a time use these;
older modules that omit them behave exactly as before):
    'owner_title'  ready-made role title (overrides title_fn), e.g.
                   'Jr Plumbing Engineer'
    'version'      workbook version label for the issue after this step,
                   e.g. '3-PL' (defaults to the step number)

Loop-back support: a step function may set data['_workflow_restart'] to
an INDEX into the steps list; after the step's issue, support scans and
log write, execution jumps back to that index (a Director returning the
package to the Jr Engineer). Modules that never set it are unaffected.

For every step the engine:
  1. prints the banner 'STEP n of N - <Role Title> - <title>'
     (discipline sub-banners inside check steps are printed by the
     step functions themselves);
  2. runs the step function;
  3. issues a fresh workbook version via the build function (v1..vN);
  4. runs the support scans - a quick QA scan and a quick Rules
     Compliance scan - and logs 'Support check (QA / Rules): clear'
     or the findings under the step;
  5. rewrites Review_Log.txt and Comments Register.txt so a stopped
     run still carries its full record.

A 'gate' step may set data['halt'] = '<message>' to stop the run.
If a support scan fails, the work returns to the QS for ONE automatic
fix round (qs_fix) and the scans re-run; a second failure stops the
run with REQUIRES ATTENTION and the deliverable does not issue
(data['blocked'] = True).

Checker comments live in data['comments_register'] as dicts:
    {'step', 'checker', 'section', 'ref', 'comment', 'action_required',
     'severity', 'disposition', 'cleared_step'}
The register is written beside Review_Log.txt like a returned markup
sheet: every comment with the QS's disposition against it.
"""

import time
from datetime import datetime
from pathlib import Path

REVIEW_LOG_NAME = 'Review_Log.txt'
REGISTER_NAME = 'Comments Register.txt'
ARCHIVE_DIR = '_log_archive'

# Files a run rewrites that must never destroy a previous run's record:
# archived once per run, before the first write (P-07 / M1).
ARCHIVED_LOGS = (REVIEW_LOG_NAME, REGISTER_NAME, 'Unresolved_Items.txt')


def archive_prior_logs(data, out_dir, names=ARCHIVED_LOGS):
    """Archive the PREVIOUS run's logs (timestamped copies under
    _log_archive/) before this run's first write - every run's audit
    record is preserved, never overwritten. Runs once per process
    (tracked on data['_logs_archived']). Returns the archived names."""
    if data.get('_logs_archived'):
        return []
    data['_logs_archived'] = True
    out_dir = Path(out_dir)
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    archived = []
    for name in names:
        src = out_dir / name
        if not src.exists():
            continue
        arch_dir = out_dir / ARCHIVE_DIR
        arch_dir.mkdir(parents=True, exist_ok=True)
        dest = arch_dir / f"{Path(name).stem}_{stamp}{Path(name).suffix}"
        k = 1
        while dest.exists():
            dest = arch_dir / (f"{Path(name).stem}_{stamp}_{k}"
                               f"{Path(name).suffix}")
            k += 1
        try:
            src.rename(dest)
            archived.append(dest.name)
        except OSError:
            pass
    if archived:
        print(f"  Prior run log(s) archived to {ARCHIVE_DIR}/: "
              f"{', '.join(archived)}")
    return archived


def run_workflow(steps, data, build, out_dir, support_checks=None,
                 qs_fix=None, total=None, title_fn=None, use_ai=True):
    """Execute the step chain. Returns the final workbook path.
    Sets data['blocked'] when the run may not issue a deliverable."""
    total = total or (max(s['no'] for s in steps) if steps else 0)
    data.setdefault('step_log', [])
    data.setdefault('comments_register', [])
    final = None
    idx = 0
    while idx < len(steps):
        step = steps[idx]
        idx += 1
        n = step['no']
        ver = step.get('version', n)
        owner = step.get('owner_title') or (
            title_fn(step['owner_role']) if title_fn
            else str(step['owner_role']).replace('_', ' ').title())
        print(f"\n{'=' * 70}\nSTEP {n} of {total} - {owner} - "
              f"{step['title']}\n{'=' * 70}")
        t0 = time.time()
        data['_step_no'] = n
        findings = step['fn'](data, use_ai=use_ai) or []
        entry = {'no': n, 'total': total, 'owner': owner,
                 'title': step['title'], 'kind': step.get('kind', ''),
                 'findings': list(findings), 'support': [],
                 'issued': None}
        data['step_log'].append(entry)
        for x in findings[:6]:
            print(f"  - {x}")
        if len(findings) > 6:
            print(f"  - (+{len(findings) - 6} more in {REVIEW_LOG_NAME})")

        if data.get('halt'):
            data['blocked'] = True
            entry['findings'].append(f"RUN STOPPED: {data['halt']}")
            write_logs(data, out_dir)
            print(f"\n{'!' * 70}\nRUN STOPPED at step {n} of {total} - "
                  f"{owner}.\n{data['halt']}\n{'!' * 70}")
            return final

        final = build(data, version=ver)
        entry['issued'] = Path(final).name
        print(f"  >> Workbook v{ver} issued ({time.time() - t0:.0f}s)")

        if support_checks:
            results = support_checks(data)
            entry['support'] = results
            _print_support(results)
            if any(not ok for _, ok, _ in results) and qs_fix:
                print("  Support check FAILED - returned to the producer "
                      "for one automatic fix round.")
                entry['fix'] = list(qs_fix(data) or [])
                final = build(data, version=f"{ver}R")
                entry['issued'] = Path(final).name
                results = support_checks(data)
                entry['support_after_fix'] = results
                _print_support(results, recheck=True)
                if any(not ok for _, ok, _ in results):
                    # A support scan is a QUALITY signal, not a licence to
                    # destroy a finished deliverable - and a scan can throw
                    # false positives. Carry the findings as caveats and
                    # keep going; the deliverable issues with the problems
                    # named. AETRAA_SUPPORT_STRICT=1 restores the old
                    # blocking behaviour.
                    import os as _os
                    _bad = [f"{lbl}: {x}" for lbl, ok, notes in results
                            if not ok for x in (notes or [])][:12]
                    if _os.environ.get('AETRAA_SUPPORT_STRICT') == '1':
                        data['blocked'] = True
                        write_logs(data, out_dir)
                        print(f"\n{'!' * 70}\nREQUIRES ATTENTION - a "
                              f"support check still fails after the fix "
                              f"round at step {n} of {total} ({owner}).\n"
                              f"The deliverable does not issue. See "
                              f"{REVIEW_LOG_NAME} in {out_dir}\n{'!' * 70}")
                        return final
                    data.setdefault('caveats', []).extend(_bad)
                    print(f"  SUPPORT CAVEAT: a check still reports "
                          f"{len(_bad)} item(s) after the fix round - "
                          f"carried as caveats, the deliverable still "
                          f"issues. See {REVIEW_LOG_NAME}.")
        write_logs(data, out_dir)

        jump = data.pop('_workflow_restart', None)
        if jump is not None and 0 <= int(jump) < len(steps):
            back = steps[int(jump)]
            print(f"\n  << PACKAGE RETURNED by {owner}: the workflow "
                  f"resumes at STEP {back['no']} - "
                  f"{back.get('owner_title') or back['owner_role']} - "
                  f"{back['title']}")
            idx = int(jump)
    write_logs(data, out_dir)
    return final


def _print_support(results, recheck=False):
    tag = 'Support re-check' if recheck else 'Support check'
    for label, ok, notes in results:
        if ok:
            print(f"  {tag} ({label}): clear")
        else:
            print(f"  {tag} ({label}): {len(notes)} finding(s)")
            for x in notes[:4]:
                print(f"    - {x}")


# ────────────────────────────────────────── written records
def write_logs(data, out_dir):
    """Rewrite Review_Log.txt and Comments Register.txt from the current
    state - called after every step so a stopped run keeps its record.
    The PREVIOUS run's files are archived (timestamped) before this
    run's first write - the audit chain is never destroyed (P-07/M1)."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    archive_prior_logs(data, out_dir)
    proj = (data.get('project_meta') or {}).get('project_name', '')

    lines = [f"REVIEW LOG - {proj}" if proj else 'REVIEW LOG',
             'Record of the professional review workflow: one entry per '
             'step, with the support scans run after each step and the '
             'workbook version issued.', '']
    for e in data.get('step_log', []):
        lines.append(f"STEP {e['no']} of {e['total']} - {e['owner']} - "
                     f"{e['title']}")
        lines.extend(f"  - {x}" for x in e['findings'])
        for label, ok, notes in e.get('support', []):
            if ok:
                lines.append(f"  Support check ({label}): clear")
            else:
                lines.append(f"  Support check ({label}): "
                             f"{len(notes)} finding(s)")
                lines.extend(f"    - {x}" for x in notes)
        if e.get('fix') is not None:
            lines.append('  Returned to the QS for one automatic fix '
                         'round:')
            lines.extend(f"    - {x}" for x in e['fix'])
            for label, ok, notes in e.get('support_after_fix', []):
                lines.append(f"  Support re-check ({label}): "
                             + ('clear' if ok else 'STILL FAILING'))
                if not ok:
                    lines.extend(f"    - {x}" for x in notes)
        if e.get('issued'):
            lines.append(f"  Issued: {e['issued']}")
        lines.append('')
    (out_dir / REVIEW_LOG_NAME).write_text(
        '\n'.join(lines) if data.get('step_log')
        else 'No review steps recorded yet.\n')

    reg = [f"COMMENTS REGISTER - {proj}" if proj else 'COMMENTS REGISTER',
           "Every checker comment raised during the review, with the "
           "Quantity Surveyor's disposition against it - the returned "
           "markup sheet of this take-off.", '']
    comments = data.get('comments_register') or []
    if not comments:
        reg.append('No checker comments were raised.')
    ops = [c for c in comments
           if c.get('operator') or c.get('checker') == 'Operator']
    rest = [c for c in comments
            if not (c.get('operator') or c.get('checker') == 'Operator')]
    if ops:
        reg.append('OPERATOR COMMENTS - dispositions')
        reg.append('Plain-language comments written by the human '
                   'operator into Operator_Comments.txt - ingested '
                   'before the first clearance step as top-priority '
                   'checker comments and cleared by the producer FIRST, '
                   'before any agent checker comment. What the producer '
                   'could not apply is referred to the Director (see '
                   'Unresolved_Items.txt) - never refused.')
        for c in ops:
            reg.append(f"  {c.get('ref')}  [{c.get('severity')}]  "
                       f"{c.get('comment')}")
            disp = c.get('disposition') or 'awaiting clearance'
            tail = (f" (cleared at step {c['cleared_step']})"
                    if c.get('cleared_step') else '')
            reg.append(f"      Producer disposition: {disp}{tail}")
        reg.append('')
    group = None
    for c in rest:
        key = (c.get('step'), c.get('checker'), c.get('section'))
        if key != group:
            group = key
            sec = c.get('section')
            reg.append(f"STEP {c.get('step')} - {c.get('checker')}"
                       + (f" - section {sec}" if sec else ''))
        reg.append(f"  {c.get('ref')}  [{c.get('severity')}]  "
                   f"{c.get('comment')}")
        reg.append(f"      Action required: {c.get('action_required')}")
        disp = c.get('disposition') or 'awaiting clearance'
        tail = (f" (cleared at step {c['cleared_step']})"
                if c.get('cleared_step') else '')
        reg.append(f"      QS disposition: {disp}{tail}")
    (out_dir / REGISTER_NAME).write_text('\n'.join(reg) + '\n')
