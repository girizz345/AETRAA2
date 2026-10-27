"""
AETRAA Core - versioned output files and the final deliverable package.
"""

import re
import zipfile
from datetime import date
from pathlib import Path


def output_filename(project_name, module_tag, version, ext='xlsx'):
    safe = re.sub(r'[^\w\s-]', '', project_name).strip().replace(' ', '_')
    today = date.today().strftime('%d-%m-%Y')
    return f"{safe}_{module_tag}_{today}_v{version}.{ext}"


def make_deliverable_zip(project: Path, folders, label='AETRAA Deliverable'):
    """Package everything in the given output folders into one zip in the
    project root. Internal caches and hidden files are excluded."""
    name = f"{project.name} - {label} {date.today():%d-%m-%Y}.zip"
    zpath = Path(project) / name
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for folder in folders:
            folder = Path(folder)
            if not folder.exists():
                continue
            for f in sorted(folder.rglob('*')):
                if f.is_file() and '_agent_cache' not in f.parts \
                        and not f.name.startswith('.'):
                    z.write(f, f.relative_to(project))
    print(f"\nDELIVERABLE PACKAGE: {zpath.name}")
    return zpath
