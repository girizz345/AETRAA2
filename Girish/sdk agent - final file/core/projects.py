"""
AETRAA Core - project folder handling.
Projects live in Documents/Projects (or anywhere the user points at).
The structure inside a project is free; each agent declares the folder
rule it looks for (e.g. Tender/ + IFC/ side by side, or a Drawings folder).
"""

from pathlib import Path

PROJECTS_DIR = Path.home() / 'Documents' / 'Projects'

SKIP_DIRS = {'deviation_markups', 'reports', '_agent_cache'}


def find_pair_areas(root: Path, names=('tender', 'ifc'),
                    skip_prefix=('spec',)):
    """Folders (any depth) containing all of `names` as subfolders."""
    areas = []
    candidates = [root] + [d for d in sorted(root.rglob('*')) if d.is_dir()]
    lows = {n.lower() for n in names}
    for d in candidates:
        rel_parts = [p.lower() for p in d.relative_to(root).parts]
        if any(p in SKIP_DIRS or p.startswith('.') for p in rel_parts):
            continue
        if d.name.lower() in lows or \
                any(d.name.lower().startswith(pfx) for pfx in skip_prefix):
            continue
        try:
            subs = {s.name.lower() for s in d.iterdir() if s.is_dir()}
        except PermissionError:
            continue
        if lows <= subs:
            areas.append(d)
    return areas


def find_named_dir(root: Path, prefix='spec'):
    """First folder (any depth) whose name starts with prefix."""
    for d in [root] + sorted(root.rglob('*')):
        if d.is_dir() and d.name.lower().startswith(prefix) and \
                not any(p.lower() in SKIP_DIRS
                        for p in d.relative_to(root).parts[:-1]):
            return d
    return None


def area_label(area: Path, project: Path) -> str:
    rel = area.relative_to(project)
    return str(rel) if str(rel) != '.' else project.name


def files_by_ext(folder: Path, exts=('.pdf',)):
    return sorted(f for f in folder.glob('*')
                  if f.suffix.lower() in exts)


def rebase_path(path_str, project_root):
    """Re-root a cached absolute path from another machine onto the
    current project folder by matching the path suffix (extraction
    caches keep absolute paths from the machine they were made on).
    Returns the existing Path, the relocated existing Path, or None.
    Shared by the modules' workbook and markup writers (one
    implementation, no divergence)."""
    if not path_str:
        return None
    p = Path(path_str)
    if p.exists():
        return p
    try:
        root = Path(project_root)
        parts = p.parts
        if root.name in parts:
            idx = len(parts) - 1 - list(reversed(parts)).index(root.name)
            cand = root.joinpath(*parts[idx + 1:])
            if cand.exists():
                return cand
    except Exception:
        pass
    return None
