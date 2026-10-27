"""
AETRAA Core - the human operator's seat in the agent office.

Between runs the operator may write plain-language review comments into
<project>/Operator_Comments.txt - any format, one comment per line (an
indented line continues the comment above; bullets and numbering are
stripped). A comment may quote an item or event reference (D-049, Q-AB,
RFI-003, SPEC-012 ...) or not.

On the NEXT run of any module on that project:
  1. The file is detected and ingested BEFORE the first clearance step,
     as TOP-PRIORITY checker comments with owner 'Operator' - prepended
     to the comments register so the producer clears them FIRST.
  2. Comments carrying a recognisable reference attach to that item or
     event. Comments without one stay 'GENERAL': when the AI review
     connection is live the module maps each to the most likely item
     (one review call); when it is down they are recorded as GENERAL
     findings addressed to the Director - never lost, never guessed.
  3. Operator comments are never auto-refused: what the producer cannot
     apply is dispositioned 'referred to Director' and entered on the
     Director's / Unresolved Items register.
  4. After ingestion the file is renamed
     Operator_Comments_processed_<yyyymmdd-hhmm>.txt (content preserved)
     so it can never ingest twice. The console prints
     'OPERATOR COMMENTS: N ingested'.

This module holds the shared mechanics (find / parse / ref-map / rename
/ referral); each agent wires a thin producer-clearance pass around it.
"""

import re
from datetime import datetime
from pathlib import Path

COMMENTS_NAME = 'Operator_Comments.txt'
OWNER = 'Operator'
GENERAL = 'GENERAL'

# Recognisable references, most specific first: deviation events (D-049),
# register lines (RFI-003, SPEC-012), then bill item codes (Q-AB, R-A,
# J1-C ... one POMI section letter, optional digit, dash, letter code).
REF_PATTERNS = [
    re.compile(r'\b(D-\d{1,4})\b'),
    re.compile(r'\b(RFI-\d{1,4})\b'),
    re.compile(r'\b(SPEC-\d{1,4})\b'),
    re.compile(r'\b([A-S]\d?-[A-Z]{1,3})\b'),
]

_BULLET_RE = re.compile(r'^\s*(?:[-*•]+|\(?\d{1,3}[.)])\s+')

# Plain-language intents the producer can apply deterministically.
_INTENTS = [
    ('drop', ('drop', 'remove', 'delete', 'withdraw', 'strike out',
              'take out', 'should not be there', "shouldn't be there")),
    ('demote', ('demote', 'to measure', 'not a deviation',
                'no deviation', 'should pass', 'stand down',
                'not measurable')),
    ('reword', ('reword', 're-word', 'rewrite', 're-write', 'rephrase',
                'wording', 'description', 'describe', 'rename',
                'priceable language')),
    ('verify', ('verify', 'check', 'confirm', 'recount', 're-count',
                'count looks', 'looks wrong', 'seems wrong',
                'wrong count', 'quantity looks')),
]


def find_file(project):
    """The pending operator comments file, or None."""
    f = Path(project) / COMMENTS_NAME
    return f if f.is_file() else None


def parse_text(text):
    """Comment strings from the file: one comment per non-empty line;
    an indented line continues the previous comment; bullets and
    numbering prefixes are stripped."""
    comments = []
    for raw in (text or '').splitlines():
        line = _BULLET_RE.sub('', raw.strip())
        if not line or line.startswith('#'):
            continue
        if raw[:1] in (' ', '\t') and comments:
            comments[-1] = f"{comments[-1]} {line}"
        else:
            comments.append(line)
    return comments


def extract_ref(comment):
    """The first recognisable item/event reference in a comment, or
    None (deterministic - no guessing)."""
    for pat in REF_PATTERNS:
        m = pat.search(comment or '')
        if m:
            return m.group(1)
    return None


def intent_of(comment):
    """Deterministic plain-language intent: 'drop' | 'demote' |
    'reword' | 'verify' | None."""
    low = (comment or '').lower()
    for intent, keys in _INTENTS:
        if any(k in low for k in keys):
            return intent
    return None


def ingest(data, project, step_no=0, defer_rename=False):
    """Detect, parse and register <project>/Operator_Comments.txt as
    TOP-PRIORITY checker comments (owner 'Operator', prepended to the
    comments register), then rename the file so it never ingests twice.

    defer_rename=True (M2): the file is NOT renamed at ingest - the
    module calls settle() at the end of the run, which renames the
    original AND re-emits every comment that was not cleared-with-action
    into a fresh Operator_Comments.txt for the next run. A comment can
    no longer be consumed and lost by a draft/failed run.

    Returns the number of comments ingested (0 when there is no file)."""
    if data.get('_operator_ingested'):
        return 0
    f = find_file(project)
    if not f:
        return 0
    try:
        comments = parse_text(f.read_text(errors='replace'))
    except OSError as e:
        print(f"OPERATOR COMMENTS: file could not be read ({e}) - "
              f"left in place.")
        return 0
    entries = []
    for c in comments:
        ref = extract_ref(c)
        entries.append({
            'step': step_no, 'checker': OWNER, 'section': None,
            'ref': (ref or GENERAL)[:20], 'comment': c[:300],
            'action_required': intent_of(c) or 'none',
            'severity': 'high', 'suggestion': '', 'operator': True,
            'disposition': None, 'cleared_step': None})
    # Top priority: operator comments sit FIRST on the register.
    data.setdefault('comments_register', [])[0:0] = entries

    if defer_rename:
        data['_operator_file'] = str(f)
    else:
        _rename_processed(f)
    data['_operator_ingested'] = True
    print(f"OPERATOR COMMENTS: {len(entries)} ingested"
          + (" (file consumed only after clearance - see settle())"
             if defer_rename else ""))
    return len(entries)


def _rename_processed(f):
    stamp = datetime.now().strftime('%Y%m%d-%H%M')
    target = f.with_name(f'Operator_Comments_processed_{stamp}.txt')
    k = 1
    while target.exists():
        target = f.with_name(f'Operator_Comments_processed_{stamp}'
                             f'_{k}.txt')
        k += 1
    try:
        f.rename(target)
        return target
    except OSError as e:
        print(f"OPERATOR COMMENTS: could not rename the file ({e}) - "
              f"it may re-ingest next run.")
        return None


def settle(data, project):
    """End-of-run settlement for defer_rename ingests (M2): the original
    file is renamed *_processed_<stamp>.txt, and every operator comment
    NOT cleared-with-action (referred to Director, uncleared, or awaiting
    a full run) is re-emitted into a fresh Operator_Comments.txt so the
    NEXT run ingests it again - an operator comment is never lost."""
    src = data.get('_operator_file')
    if not src:
        return 0
    f = Path(src)
    if f.is_file():
        _rename_processed(f)
    data['_operator_file'] = None
    open_again = []
    for c in data.get('comments_register') or []:
        if not c.get('operator'):
            continue
        disp = str(c.get('disposition') or '')
        if not disp.startswith('cleared'):
            open_again.append(c)
    if open_again:
        lines = ['# Re-emitted by AETRAA: these operator comments were '
                 'NOT cleared with action in the last run',
                 '# (referred to the Director or awaiting a full run) - '
                 'they will ingest again on the next run.']
        lines += [c['comment'] for c in open_again]
        out = Path(project) / COMMENTS_NAME
        try:
            out.write_text('\n'.join(lines) + '\n')
            print(f"OPERATOR COMMENTS: {len(open_again)} uncleared "
                  f"comment(s) re-emitted into {COMMENTS_NAME} for the "
                  f"next run.")
        except OSError as e:
            print(f"OPERATOR COMMENTS: could not re-emit uncleared "
                  f"comments ({e}).")
    return len(open_again)


def open_comments(data):
    """Operator comments still awaiting the producer's clearance."""
    return [c for c in data.get('comments_register') or []
            if c.get('operator') and c.get('disposition') is None]


def ai_map_general(data, candidates, system=None, use_ai=True):
    """One review call mapping each un-referenced ('GENERAL') operator
    comment to the most likely item from `candidates`
    ([{'ref', 'description'}]). AI down or draft mode: nothing changes -
    the comments stay GENERAL for the Director (never guessed).
    Returns the number of comments mapped to an item."""
    pending = [c for c in open_comments(data) if c['ref'] == GENERAL]
    if not pending or not use_ai or not candidates:
        return 0
    from core.ai import review
    payload = {
        'operator_comments': [{'id': k, 'comment': c['comment']}
                              for k, c in enumerate(pending)],
        'candidate_items': candidates[:150],
    }
    out = review(
        "The human operator left review comments that quote no item "
        "reference. Map each comment to the MOST LIKELY candidate item "
        "by its wording. When no candidate is clearly the one meant, "
        "return \"GENERAL\" - never guess between close candidates. "
        "Respond with ONLY a JSON array, one object per comment: "
        "[{\"id\": <id>, \"ref\": \"<candidate ref or GENERAL>\"}].",
        payload, system=system, label='Operator comment mapping')
    valid = {str(c.get('ref')) for c in candidates}
    n = 0
    for obj in out or []:
        if not isinstance(obj, dict):
            continue
        try:
            c = pending[int(obj.get('id'))]
        except (TypeError, ValueError, IndexError):
            continue
        ref = str(obj.get('ref', '') or '').strip()
        if ref and ref != GENERAL and ref in valid:
            c['ref'] = ref[:20]
            n += 1
    return n


def refer_to_director(data, c, why):
    """An operator comment the producer cannot apply is never refused:
    disposition 'referred to Director' and an entry on the Director's /
    Unresolved Items register."""
    c['disposition'] = f"referred to Director - {why}"
    c['cleared_step'] = data.get('_step_no')
    data.setdefault('unresolved', []).append({
        'step': c.get('step'), 'checker': OWNER, 'ref': c.get('ref'),
        'comment': c.get('comment'), 'severity': c.get('severity')})


def write_unresolved(data, out_dir):
    """Director's / Unresolved Items register (modules that already
    keep their own writer keep using it - same file name and shape)."""
    reg = data.get('unresolved') or []
    lines = ['UNRESOLVED ITEMS REGISTER',
             'Items that could not be closed by the producer - '
             'escalated to the Director.', '']
    if not reg:
        lines.append('No unresolved items.')
    for u in reg:
        lines.append(f"STEP {u['step']} - {u['checker']} - {u['ref']} "
                     f"[{u['severity']}]")
        lines.append(f"  {u['comment']}")
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'Unresolved_Items.txt').write_text('\n'.join(lines) + '\n')
