"""
AETRAA Core - the Folder Ledger (the Folder Manager's register).

The Folder Manager breaks a job into FOLDER WORK PACKAGES and drives one
folder to completion before the next starts. This module is his ledger:

    Folder_Ledger.json   machine record (survives across runs)
    Folder_Ledger.txt    human-readable copy, rewritten on every save

One entry per folder: the folder path, the files it covers, its status
(pending / in progress / complete), the started/completed timestamps and
the production stats (items or events produced). Because the ledger
survives across runs, a re-run touches only the pending folders - this
is the take-up reduction: completed folders are skipped entirely and
their cached results reload instead of reprocessing.

Safety rules (sequencing and completeness only - no engineering opinion):
  - a completed folder whose file list has CHANGED since completion is
    REOPENED to pending (a stray or removed file is never skipped over);
  - reconcile() checks the ledger against the Document Controller's
    register - any file not covered by a completed folder is returned
    as a named finding.
"""

import json
import time
from pathlib import Path

JSON_NAME = 'Folder_Ledger.json'
TEXT_NAME = 'Folder_Ledger.txt'

PENDING = 'pending'
IN_PROGRESS = 'in progress'
COMPLETE = 'complete'


def _now():
    return time.strftime('%Y-%m-%d %H:%M:%S')


class Ledger:
    """The Folder Manager's folder ledger for one project output dir."""

    def __init__(self, project_out_dir):
        self.dir = Path(project_out_dir)
        self.json_path = self.dir / JSON_NAME
        self.text_path = self.dir / TEXT_NAME
        self.entries = {}   # folder key -> entry dict
        self.order = []     # folder keys in package order
        self._load()

    # ────────────────────────────────────── persistence
    def _load(self):
        try:
            blob = json.loads(self.json_path.read_text())
            self.order = [str(k) for k in blob.get('order', [])]
            self.entries = {str(k): v for k, v
                            in (blob.get('folders') or {}).items()}
        except Exception:
            self.entries, self.order = {}, []

    def save(self):
        self.dir.mkdir(parents=True, exist_ok=True)
        self.json_path.write_text(json.dumps(
            {'order': self.order, 'folders': self.entries,
             'saved': _now()}, indent=1))
        self._write_text()

    def _write_text(self):
        p, i, c = self.status_counts()
        lines = ['FOLDER LEDGER - maintained by the Folder Manager',
                 'One folder work package is driven to completion before '
                 'the next starts. Completed folders are skipped on a '
                 're-run (their cached results reload); any registered '
                 'file not covered by a completed folder is a named '
                 'finding at Document Control reconciliation.',
                 f"Status: {c} complete / {i} in progress / {p} pending "
                 f"of {len(self.order)} folder(s).  Saved {_now()}.", '']
        for k, key in enumerate(self.order, 1):
            e = self.entries.get(key) or {}
            lines.append(f"FOLDER {k} OF {len(self.order)} - {key}  "
                         f"[{str(e.get('status', PENDING)).upper()}]")
            lines.append(f"  Files: {len(e.get('files') or [])}")
            if e.get('started'):
                lines.append(f"  Started:   {e['started']}")
            if e.get('completed'):
                lines.append(f"  Completed: {e['completed']}")
            stats = e.get('stats') or {}
            if stats:
                lines.append('  Produced:  ' + ', '.join(
                    f"{v} {str(kk).replace('_', ' ')}"
                    for kk, v in stats.items()))
            if e.get('note'):
                lines.append(f"  Note: {e['note']}")
            lines.append('')
        self.text_path.write_text('\n'.join(lines) + '\n')

    def clear(self):
        """--fresh: the ledger is wiped along with the caches."""
        self.entries, self.order = {}, []
        for p in (self.json_path, self.text_path):
            try:
                p.unlink()
            except OSError:
                pass

    # ────────────────────────────────────── the work packages
    def packages(self, all_sets):
        """Register the folder work packages for this run and return the
        ordered folder list. `all_sets` is [{'folder': <key>, 'files':
        [<file name>, ...]}, ...] in processing order.

        A folder already COMPLETE whose file list changed since it was
        completed is REOPENED to pending, with the change noted - a
        changed folder is never skipped on trust.

        Folders registered by an earlier packages() call (e.g. another
        discipline family) keep their place on the ledger."""
        new_keys = [str(s['folder']) for s in all_sets]
        self.order = [k for k in self.order if k not in new_keys]
        for s in all_sets:
            key = str(s['folder'])
            files = sorted(str(f) for f in (s.get('files') or []))
            self.order.append(key)
            e = self.entries.get(key)
            if e is None:
                self.entries[key] = {'folder': key, 'files': files,
                                     'status': PENDING, 'started': None,
                                     'completed': None, 'stats': {},
                                     'note': ''}
                continue
            if sorted(str(f) for f in (e.get('files') or [])) != files:
                added = [f for f in files
                         if f not in (e.get('files') or [])]
                removed = [f for f in (e.get('files') or [])
                           if f not in files]
                change = '; '.join(
                    x for x in [f"{len(added)} file(s) added: "
                                f"{', '.join(added[:5])}" if added else '',
                                f"{len(removed)} file(s) removed: "
                                f"{', '.join(removed[:5])}"
                                if removed else ''] if x)
                e.update({'files': files, 'status': PENDING,
                          'completed': None, 'stats': {},
                          'note': f"REOPENED - the file list changed "
                                  f"after completion ({change})."})
            elif e.get('status') == IN_PROGRESS:
                # A run stopped mid-folder: the folder is NOT complete.
                e['status'] = PENDING
                e['note'] = ('reset to pending - the previous run '
                             'stopped inside this folder.')
        self.save()
        return list(self.order)

    def entry(self, folder):
        return self.entries.get(str(folder)) or {}

    def is_done(self, folder):
        return self.entry(folder).get('status') == COMPLETE

    def start(self, folder):
        e = self.entries.setdefault(
            str(folder), {'folder': str(folder), 'files': [],
                          'status': PENDING, 'started': None,
                          'completed': None, 'stats': {}, 'note': ''})
        e['status'] = IN_PROGRESS
        e['started'] = _now()
        e['completed'] = None
        self.save()

    def complete(self, folder, stats=None):
        e = self.entries.setdefault(
            str(folder), {'folder': str(folder), 'files': [],
                          'status': PENDING, 'started': None,
                          'completed': None, 'stats': {}, 'note': ''})
        e['status'] = COMPLETE
        e['completed'] = _now()
        e['stats'] = dict(stats or {})
        e['note'] = ''
        self.save()

    def reopen(self, folder, note=''):
        """Force a folder back to pending (e.g. its result cache is
        missing) - it will be reprocessed, never skipped on trust."""
        e = self.entries.get(str(folder))
        if e:
            e.update({'status': PENDING, 'completed': None, 'stats': {},
                      'note': note or 'REOPENED for reprocessing.'})
            self.save()

    # ────────────────────────────────────── reconciliation
    def status_counts(self, keys=None):
        """(pending, in_progress, complete) over the current packages,
        or over `keys` when a caller scopes the count (e.g. one
        discipline family's folders)."""
        p = i = c = 0
        for key in (self.order if keys is None else keys):
            st = self.entry(key).get('status')
            if st == COMPLETE:
                c += 1
            elif st == IN_PROGRESS:
                i += 1
            else:
                p += 1
        return p, i, c

    def reconcile(self, register_files):
        """Check the Document Controller's register against the ledger:
        every registered file must be covered by a COMPLETED folder.
        Returns the list of uncovered file names (named findings)."""
        covered = set()
        for e in self.entries.values():
            if e.get('status') == COMPLETE:
                covered.update(str(f) for f in (e.get('files') or []))
        return [str(f) for f in register_files if str(f) not in covered]
