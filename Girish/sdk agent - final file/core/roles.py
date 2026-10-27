"""
AETRAA Core - the role agents.
Every AETRAA module is reviewed by a standing team of professional role
agents (Jr Engineer ... Director), defined once in core/roles/ and reused by
every module. A module's manifest declares:

    "perspective": "contractor" | "consultant",
    "discipline":  "plumbing" | "hvac" | ... (or auto-detected at runtime),
    "team":        ["jr_engineer", "sr_engineer", "qs", ...]

The deep dive then runs ONE PASS PER ROLE, in team order, always starting
with the junior engineer. Each pass's system prompt = role charter
+ discipline expertise + the module's rulebook.
"""

from pathlib import Path

ROLES_DIR = Path(__file__).resolve().parent / 'roles'

# Engineer-type roles that take a discipline specialisation overlay
DISCIPLINE_ROLES = {'jr_engineer', 'sr_engineer',
                    'jr_design_engineer', 'design_engineer'}

# Technical roles that carry the standards mandate (local authority codes
# as minimum + the international codes they reference)
TECHNICAL_ROLES = {'jr_engineer', 'sr_engineer', 'jr_design_engineer',
                   'design_engineer', 'design_manager', 'design_director',
                   'jr_architect', 'sr_architect', 'technical_manager',
                   'development_architect', 'development_manager',
                   'compliance_officer'}

# Default team chains (module manifests may override)
DEFAULT_TEAMS = {
    'contractor': ['jr_engineer', 'sr_engineer', 'technical_manager',
                   'qs', 'sr_qs', 'planner', 'contracts_manager',
                   'document_controller', 'folder_manager',
                   'markup_specialist',
                   'project_manager', 'qa', 'compliance_officer', 'director'],
    'consultant': ['jr_design_engineer', 'design_engineer', 'design_manager',
                   'design_director', 'qs', 'sr_qs', 'planner',
                   'contracts_administrator', 'document_controller',
                   'folder_manager',
                   'markup_specialist', 'project_manager', 'qa',
                   'compliance_officer', 'director'],
    'developer':  ['development_architect', 'development_manager',
                   'qs', 'sr_qs', 'planner', 'document_controller',
                   'folder_manager',
                   'project_manager', 'qa', 'compliance_officer', 'director'],
}

# Blocking gates: deliverable does not issue if these report FAIL
BLOCKING_ROLES = {'qa', 'compliance_officer'}


def _read(path):
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ''


def load_role(role_id, perspective='contractor', discipline=None):
    """Return the assembled charter text for a role."""
    for folder in (perspective, 'shared', 'contractor', 'consultant',
                   'developer'):
        p = ROLES_DIR / folder / f'{role_id}.md'
        if p.exists():
            text = _read(p)
            break
    else:
        raise KeyError(f"Unknown role: {role_id} ({perspective})")

    if role_id in DISCIPLINE_ROLES and discipline:
        d = ROLES_DIR / 'disciplines' / f'{discipline.lower()}.md'
        if d.exists():
            text += '\n' + _read(d)

    if role_id in TECHNICAL_ROLES:
        m = ROLES_DIR / 'standards' / 'mandate.md'
        if m.exists():
            text += '\n' + _read(m)
    return text


_ACRONYMS = {'Qs': 'QS', 'Sr': 'Sr', 'Jr': 'Jr', 'Qa': 'QA',
             'Hvac': 'HVAC', 'Elv': 'ELV'}


def _title(words):
    return ' '.join(_ACRONYMS.get(w.title(), w.title())
                    for w in words.split())


def role_title(role_id, discipline=None):
    base = _title(role_id.replace('_', ' '))
    if role_id in DISCIPLINE_ROLES and discipline:
        disc = _ACRONYMS.get(discipline.title(), discipline.title())
        parts = base.split(' ')
        # 'Jr Engineer' -> 'Jr Plumbing Engineer';
        # 'Design Engineer' -> 'Plumbing Design Engineer'
        if parts[0] in ('Jr', 'Sr'):
            return ' '.join([parts[0], disc] + parts[1:])
        return ' '.join([disc] + parts)
    return base


def system_prompt(role_id, perspective, discipline, rulebook_text=''):
    """Full system prompt for one role's review pass."""
    charter = load_role(role_id, perspective, discipline)
    title = role_title(role_id, discipline)
    head = (f"You are the {title} on a professional "
            f"{'contracting' if perspective == 'contractor' else 'consulting'} "
            f"team reviewing construction project documents. Act strictly "
            f"within this charter:\n\n{charter}\n")
    if rulebook_text:
        head += (f"\nThe module rulebook you enforce:\n\n"
                 f"{rulebook_text[:12000]}\n")
    # AETRAA OPERATING DIRECTIVE (R-DIRECTIVE) - binds every role, every run.
    head += (
        "\nAETRAA OPERATING DIRECTIVE - applies to you on every run:\n"
        "1. SERVE THE AGENT. Do EXACTLY and ONLY what this run's task and its "
        "rulebook direct, and answer in the agent's format. Never add scope, "
        "checks or opinions the agent did not ask for.\n"
        "2. NO HALLUCINATION. Never invent findings, deviations, quantities, "
        "values, clause numbers, drawings or references that are NOT in the "
        "documents in front of you. If the evidence is not present, FLAG it - "
        "never guess. The documents are the boundary of your facts; the agent's "
        "direction is the boundary of your activity.\n"
        "3. STANDARDS. Rely first on the governing authority code and the "
        "stored/provided standards; cite the specific clause. If a required "
        "Code of Practice is not provided you may reason from established "
        "standards, but MARK it 'verify' - never fabricate a clause or edition.\n")
    head += ("\nRespond with ONLY the JSON requested - no markdown, "
             "no commentary.")
    return head


def team_for(manifest, detected_discipline=None):
    """Resolve (perspective, discipline, ordered team) from a manifest."""
    perspective = manifest.get('perspective', 'contractor')
    discipline = manifest.get('discipline') or detected_discipline
    team = manifest.get('team') or DEFAULT_TEAMS[perspective]
    # the chain always opens with the junior engineer
    juniors = [r for r in team if r.startswith('jr_')]
    rest = [r for r in team if not r.startswith('jr_')]
    return perspective, discipline, juniors + rest
