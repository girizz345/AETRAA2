// Functions, and the access matrix.
//
// The old world gave a person one coarse role (owner | manager | lead | site |
// view). The platform needs finer functions — Design, Planning, QA/QC, HSE,
// Commercial, Procurement, Finance, Document Control, Subcontractor, Consultant
// — and it needs one email to hold several of them at once (a QS who is also
// Procurement and Finance; an engineer who is also QA/QC).
//
// A person's functions live in the new users.functions column (a JSON array). If
// that column is empty — every user set up under the old model — we fall back to
// their legacy `role`, so nobody loses access the day this ships. The legacy
// `role` is still written alongside, so every existing scope and login check in
// access.js keeps working unchanged.
//
// The ACCESS matrix says, per function, which dashboards it may open and whether
// it may edit that folder ('full') or only view and export it ('read'). It is the
// single source of truth the API enforces and the UI reflects — the exact matrix
// signed off on the dashboard design.

export const FUNCTIONS = {
  principal:  { label: 'Principal',              legacy: 'owner'   },
  pm:         { label: 'Project Manager',        legacy: 'manager' },
  planning:   { label: 'Planning',               legacy: 'lead'    },
  site:       { label: 'Site Engineer',          legacy: 'site'    },
  dc:         { label: 'Document Control',       legacy: 'lead'    },
  design:     { label: 'Design & Documents',     legacy: 'lead'    },
  qaqc:       { label: 'QA / QC',                legacy: 'lead'    },
  hse:        { label: 'HSE',                    legacy: 'lead'    },
  commercial: { label: 'Contracts & Commercial', legacy: 'lead'   },
  procurement:{ label: 'Procurement',            legacy: 'lead'    },
  finance:    { label: 'Finance',                legacy: 'lead'    },
  subcon:     { label: 'Subcontractors',         legacy: 'lead'    },
  consultant: { label: 'Consultant',             legacy: 'view'    },
};

// Every dashboard a function might reach. 'team' (assign people) is Principal/PM
// only and is filtered out of everyone else below.
export const ALLDASH = ['principal','pm','planning','site','dc','design','qaqc','hse',
                        'commercial','procurement','finance','subcon','consultant','team'];

// What each dashboard is called, for the screen where a Principal ticks which
// ones a role opens. A checkbox labelled "dc" tells nobody anything.
export const DASH_LABEL = {
  principal: 'Principal — the whole job',
  pm: 'Project Manager — the whole job',
  planning: 'Programme & planning',
  site: 'Site — progress, diary, inspections',
  dc: 'Document Control — registers & issue',
  design: 'Design & drawings',
  qaqc: 'QA / QC — inspections & NCRs',
  hse: 'HSE — permits, observations, incidents',
  commercial: 'Contracts & commercial — BOQ, IPC, variations',
  procurement: 'Procurement — LPOs & materials',
  finance: 'Finance',
  subcon: 'Subcontractors',
  consultant: 'Consultant view — read only',
  team: 'Team — invite people and set access',
};

// The 'team' dashboard is not an ordinary tick: whoever holds it can change
// everybody else's access, including their own. Said out loud on the screen.
export const DASH_WARN = {
  team: 'Whoever holds this can change anyone\u2019s access, including their own.',
};

const allFull = () => ALLDASH.map((r) => [r, 'full']);
const noTeam = (e) => e[0] !== 'team';

export const ACCESS = {
  principal:  allFull(),                                                        // owner — everything, incl. assigning people
  pm:         allFull(),                                                        // PM — everything, incl. assigning people
  dc:         ALLDASH.map((r) => [r, r === 'dc' ? 'full' : 'read']).filter(noTeam),          // see all + generate reports
  commercial: ALLDASH.map((r) => [r, r === 'commercial' ? 'full' : 'read']).filter(noTeam),  // read all, own folder full
  design:     [['design', 'full']],                                            // own tab
  site:       [['site', 'full'], ['design', 'read']],                          // own tab + read design
  planning:   [['planning', 'full'], ['design', 'read'], ['site', 'read']],    // own + read design + read discipline
  qaqc:       [['qaqc', 'full']],
  hse:        [['hse', 'full']],
  procurement:[['procurement', 'full']],
  finance:    [['finance', 'full']],
  subcon:     [['subcon', 'full']],
  consultant: [['consultant', 'full']],
};

// A legacy role, for a user set up before functions existed, becomes one function
// so the fallback still resolves an access set.
const ROLE_TO_FN = { owner: 'principal', manager: 'pm', lead: 'planning', site: 'site', view: 'consultant' };

// The functions a user holds. Reads the JSON column; falls back to legacy role.
// A JSON column that may already have been parsed.
//
// THE BUG THIS EXISTS FOR: listUsers() parses `functions` before handing the row
// on, and this read it again with JSON.parse. Parsing an array throws, the catch
// swallowed it, and the person fell back to their LEGACY role — so a QA/QC
// engineer came back as Planning. Every screen built on listUsers was affected:
// the handover checklist, the go-live organisation gap, and the people list on
// the organisation page. It looked like a display quirk and was a permissions
// one.
function listFrom(v) {
  if (Array.isArray(v)) return v.map(String);
  try { const j = JSON.parse(v || '[]'); return Array.isArray(j) ? j.map(String) : []; }
  catch (e) { return []; }
}

export function userFunctions(user) {
  if (!user) return [];
  let fns = listFrom(user.functions).filter((f) => FUNCTIONS[f]);
  // A role this project invented is not in the shipped FUNCTIONS table but is
  // still the person's role, so it must survive the filter.
  if (!fns.length) fns = listFrom(user.functions).filter(Boolean);
  if (!fns.length) { const f = ROLE_TO_FN[user && user.role]; if (f) fns = [f]; }
  return fns;
}

// The legacy role to store for a set of functions, so access.js scope/login logic
// (which still keys off role) keeps behaving correctly. Highest privilege wins.
export function legacyRole(fns) {
  const f = Array.isArray(fns) ? fns : [];
  if (f.includes('principal')) return 'owner';
  if (f.includes('pm')) return 'manager';
  if (f.length === 1 && f[0] === 'site') return 'site';
  if (f.length === 1 && f[0] === 'consultant') return 'view';
  return 'lead';
}

// Validate/clean an incoming list of functions.
export function cleanFunctions(list) {
  if (!Array.isArray(list)) return [];
  const seen = {};
  return list.map(String).filter((f) => FUNCTIONS[f] && !seen[f] && (seen[f] = 1));
}

// The dashboards this user can open — full ones first (their own folders), then
// read-only. 'team' appears only for Principal/PM. This mirrors the design's
// switcher exactly, and the API uses it to allow or refuse each dashboard.
export function accessForUser(user) {
  const fns = userFunctions(user);
  const map = {};
  fns.forEach((fn) => (ACCESS[fn] || [[fn, 'full']]).forEach((e) => {
    if (map[e[0]] !== 'full') map[e[0]] = e[1];
  }));
  const full = [], read = [];
  ALLDASH.forEach((r) => {
    if (map[r] === 'full') full.push([r, 'full']);
    else if (map[r] === 'read') read.push([r, 'read']);
  });
  return full.concat(read);
}

// 'full' | 'read' | null — the level at which this user may open one dashboard.
export function levelFor(user, dash) {
  const v = accessForUser(user).find((x) => x[0] === dash);
  return v ? v[1] : null;
}

// Only the Principal and the PM may invite people or change access.
export function canAssignPeople(user) {
  const f = userFunctions(user);
  return f.includes('principal') || f.includes('pm');
}


/* ------------------------------------------------- what one PERSON handles

   A role says what a job can do. It does not say what the man doing it is
   actually on.

   Two QA/QC engineers hold the same role and one covers inspections while the
   other covers NCRs and material approvals. A commercial manager is on
   variations but the payment certificates are the other QS's. Until now the
   platform could not tell them apart: everybody holding a role got every
   workflow that role touched, and the register filled with things addressed to
   people who were not doing them.

   So a person carries a list of the workflows they are on. It NARROWS what
   their roles allow and can never widen it — a site engineer ticked for
   variations still cannot raise one, because his role does not. An empty list
   means "everything my roles allow", which is what everybody already on the
   platform has, so nothing changes for them until somebody ticks.

   IPC and PROGRESS are in the list although they are not records. They are
   workflows a person is on or not on in exactly the same way — the difference
   is only which table they end up in — and leaving them out would mean the
   screen could not answer "what is this man on?" honestly. */
export const STREAMS = {
  // to the Engineer
  submittal: { label: 'Submittals',                 group: 'To the Engineer' },
  ms:        { label: 'Method statements',          group: 'To the Engineer' },
  material:  { label: 'Material approvals',         group: 'To the Engineer' },
  rfi:       { label: 'RFIs',                       group: 'To the Engineer' },
  authority: { label: 'Authority approvals / NOCs', group: 'To the Engineer' },
  // correspondence
  letter:    { label: 'Outgoing letters',           group: 'Correspondence' },
  incoming:  { label: 'Incoming letters',           group: 'Correspondence' },
  // commercial
  ipc:       { label: 'Payment certificates (IPC) & cashflow', group: 'Commercial' },
  variation: { label: 'Variations',                 group: 'Commercial' },
  mr:        { label: 'Material requests',          group: 'Commercial' },
  // site
  progress:  { label: 'Progress & site diary',      group: 'Site' },
  wir:       { label: 'Work inspections (WIR)',     group: 'Site' },
  mir:       { label: 'Material inspections (MIR)', group: 'Site' },
  ncr:       { label: 'Non-conformance (NCR)',      group: 'Site' },
  // hse
  ptw:       { label: 'Permits to work',            group: 'HSE' },
  obs:       { label: 'HSE observations',           group: 'HSE' },
  incident:  { label: 'HSE incidents',              group: 'HSE' },
  cert:      { label: 'Certificates & licences',    group: 'HSE' },
};

export const STREAM_GROUPS = ['To the Engineer', 'Correspondence', 'Commercial', 'Site', 'HSE'];

// The streams a person is explicitly on, or null for "everything my roles
// allow". Null and [] are the same thing on purpose: a person saved before this
// existed, and a person whose ticks were all cleared, both mean "no narrowing"
// rather than "nothing at all" — the alternative is silently locking somebody
// out of work they were doing yesterday.
export function userStreams(user) {
  if (!user) return null;
  const list = listFrom(user.record_types).filter((t) => STREAMS[t]);
  return list.length ? list : null;
}

// Is this person on this workflow at all? Narrowing only — whether their ROLE
// permits it is a separate question, asked separately.
export function onStream(user, stream) {
  const list = userStreams(user);
  return !list || list.includes(String(stream));
}

export function cleanStreams(list) {
  if (!Array.isArray(list)) return [];
  const seen = {};
  return list.map(String).filter((t) => STREAMS[t] && !seen[t] && (seen[t] = 1));
}

// What a person is on, in words, for the screen and for an error message. "auth"
// tells nobody anything.
export function streamsInWords(user) {
  const list = userStreams(user);
  if (!list) return 'everything their role covers';
  return list.map((t) => STREAMS[t].label).join(', ');
}

/* ---------------------------------------------------------------- records
 *
 * Which function may RAISE each kind of record, and which may APPROVE it.
 *
 * Until now the API asked only for a coarse legacy role, and 'lead' covers
 * Design, Document Control, QA/QC, HSE, Commercial, Procurement, Finance and
 * Subcontractors all at once. So the Design office could raise a permit to
 * work, and HSE could raise a variation. The thirteen functions existed on
 * screen and meant nothing behind it.
 *
 * These two tables are taken from the design itself — from which dashboard
 * offers which "＋ New …" button — not invented here.
 */
export const RECORD_CREATORS = {
  submittal: ['design'],
  ms:        ['site', 'design', 'qaqc', 'hse'],   // method statement — whoever plans the work
  material:  ['design'],
  // An RFI is a question nobody on site can answer, and the person who hits it
  // is rarely in the design office: the site engineer standing at the clash,
  // QA/QC unable to inspect against a contradictory detail, planning blocked on
  // a sequence, the QS holding a BOQ item the drawings do not support. Routing
  // all of those through Design cost days and lost the original words. Any of
  // them may raise one; the PM still approves it before it leaves and Document
  // Control still issues it, so nothing reaches the consultant unchecked.
  rfi:       ['design', 'site', 'qaqc', 'planning', 'commercial'],
  authority: ['design'],
  // A verbal instruction is confirmed by whoever was standing there when it was
  // given, which is almost never the design office.
  cvi:       ['site', 'design', 'qaqc'],
  letter:    ['design', 'commercial'],
  incoming:  ['dc'],                    // Document Control logs what arrives
  variation: ['commercial'],
  wir:       ['site', 'qaqc'],          // site raises the inspection, QA/QC also may
  mir:       ['qaqc'],
  ncr:       ['qaqc'],
  ptw:       ['hse'],
  obs:       ['hse'],
  incident:  ['hse'],
  mr:        ['site'],                  // raised by site, with no sight of the budget
  cert:      ['hse'],                   // third-party certificates and licences
};

// Approving is the folder holder's act. This also fixes a real jam: until now
// only the Principal and the PM could move ANY record, so a QA/QC engineer
// could not close his own NCR and an HSE officer could not sign his own permit.
export const RECORD_APPROVERS = {
  // Who acts on SOME step after raising. Which step is whose is set per step in
  // records.js (RECORD_TYPES[type].wf[i].by) and enforced there; this table is
  // the coarse "may this person approve anything of this kind at all".
  ms:        ['qaqc', 'hse', 'dc'],
  submittal: ['design'],
  material:  ['design'],
  rfi:       ['design'],
  authority: ['design'],
  cvi:       ['dc'],                    // Document Control records the reply
  letter:    ['commercial'],
  incoming:  [],                        // the action owner is set per letter
  variation: ['commercial'],
  wir:       ['qaqc'],
  mir:       ['qaqc'],
  ncr:       ['qaqc'],
  ptw:       ['hse'],
  obs:       ['hse'],
  incident:  ['hse'],
  mr:        [],                        // released by the PM against the BOM
  cert:      ['hse'],
};

// The Principal and the PM hold every folder ('full' on all of ALLDASH), so
// they may raise and approve anything. Everyone else needs their own folder.
const ALWAYS = ['principal', 'pm'];

function mayRecord(table, user, type, isPlatformAdmin) {
  // An unknown record type is refused for EVERYONE, the Principal and the PM
  // included. A type nobody has placed in a folder has nobody accountable for
  // it, and holding every folder is not the same as holding one that does not
  // exist. Checked before anything else so no role can step over it.
  if (!Object.prototype.hasOwnProperty.call(table, type)) return false;
  // The AETRAA Admin signs in with the master code and has no user row at all.
  if (isPlatformAdmin) return true;
  const fns = userFunctions(user);
  if (!fns.length) return false;
  // NARROWING, BEFORE THE ROLE IS EVEN ASKED. A person not on this workflow is
  // not on it however senior they are — that is the whole point of ticking one
  // QA/QC engineer onto inspections and the other onto NCRs. It applies to the
  // Principal and the PM too, or the two of them would be exempt from the only
  // mechanism that divides the work.
  if (!onStream(user, type)) return false;
  if (ALWAYS.some((f) => fns.includes(f))) return true;
  return (table[type] || []).some((f) => fns.includes(f));
}

export function mayCreateRecord(user, type, isPlatformAdmin) {
  return mayRecord(RECORD_CREATORS, user, type, isPlatformAdmin);
}
export function mayApproveRecord(user, type, isPlatformAdmin) {
  return mayRecord(RECORD_APPROVERS, user, type, isPlatformAdmin);
}

// Said in words, for the screen. "auth" tells a person nothing.
export function whoMayRaise(type) {
  const l = (RECORD_CREATORS[type] || []).map((f) => (FUNCTIONS[f] || {}).label || f);
  return l.length ? l.join(' or ') : 'the Principal or the Project Manager';
}
export function whoMayApprove(type) {
  const l = (RECORD_APPROVERS[type] || []).map((f) => (FUNCTIONS[f] || {}).label || f);
  return l.length ? l.concat('the Project Manager').join(' or ')
                  : 'the Project Manager or the Principal';
}
