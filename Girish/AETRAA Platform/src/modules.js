// MODULES — what each project has switched on.
//
// AETRAA is sold as a base platform plus modules. When the AETRAA Admin sets a
// project up, they tick the modules this project gets from the catalogue below.
// Everything a module owns — its dashboard, its API, the records raised in it and
// its setup step — is then on or off for that project as one piece.
//
// The CORE is always on: the Principal and PM dashboards, the programme and
// progress, team & access, issues and reports. They are what every project is.
//
// Switching a module off HIDES it and REFUSES it; it never deletes anything. Turn
// it back on and every record is where it was.
//
// A project with no module list saved (every project set up before modules
// existed) has everything on, so nothing already live loses a screen.

export const CORE = [
  { id: 'core', label: 'Base platform', note: 'Principal & PM dashboards, programme and progress, team & access, issues, reports' },
];

// id is the dashboard it owns (the same names as ALLDASH in functions.js).
//   api     path prefixes this module owns
//   records record types that belong to it
//   setup   setup-console cards that are only needed when it is on
export const MODULES = [
  { id: 'planning',    label: 'Planning & look-ahead',        note: 'Planning dashboard, schedule analysis, delay impact',
    api: ['/api/schedule', '/api/impact'], records: [], setup: [] },
  { id: 'site',        label: 'Site progress & daily diary',  note: 'Site engineer dashboard, daily diary, manpower, material requests',
    api: ['/api/diary', '/api/manpower'], records: ['mr'], setup: [] },
  { id: 'design',      label: 'Design & submittals',          note: 'Submittals, method statements, material approvals, RFIs, authority NOCs, letters',
    api: [], records: ['submittal', 'ms', 'material', 'rfi', 'authority'], setup: ['authorities', 'templates'] },
  { id: 'dc',          label: 'Drawings & document control',  note: 'Drawing register, revisions, approvals, incoming correspondence',
    api: ['/api/drawing', '/api/drawings'], records: ['incoming'], setup: ['templates'] },
  { id: 'qaqc',        label: 'QA / QC',                      note: 'Inspections (WIR / MIR), NCRs',
    api: [], records: ['wir', 'mir', 'ncr'], setup: [] },
  { id: 'hse',         label: 'HSE',                          note: 'Safety log, permits to work, observations, incidents, certificates',
    api: ['/api/hse'], records: ['ptw', 'obs', 'incident', 'cert'], setup: [] },
  { id: 'commercial',  label: 'Contracts & commercial',       note: 'Priced BOQ, interim payments (IPC), variations, letters',
    api: ['/api/boq', '/api/ipc'], records: ['variation'], setup: ['boq'] },
  { id: 'procurement', label: 'Procurement',                  note: 'Bill of materials, orders, goods received (GRN)',
    api: ['/api/bom'], records: [], setup: ['bom'] },
  { id: 'finance',     label: 'Finance',                      note: 'Finance dashboard',
    api: [], records: [], setup: [] },
  { id: 'subcon',      label: 'Subcontractors',               note: 'Subcontractor dashboard',
    api: [], records: [], setup: [] },
  { id: 'consultant',  label: 'Consultant portal',            note: 'A dashboard for the Engineer / consultant',
    api: [], records: [], setup: [] },
];

export const MODULE_IDS = MODULES.map((m) => m.id);
const BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]));

// Letters can come from design or from commercial; they are on while either is.
const SHARED_RECORDS = { letter: ['design', 'commercial'] };

// A clean list: known ids only, no repeats, catalogue order.
export function cleanModules(list) {
  if (!Array.isArray(list)) return null;
  const want = new Set(list.map(String));
  return MODULE_IDS.filter((id) => want.has(id));
}

// The modules on for a project row. null/blank/unreadable = everything (legacy).
export function modulesOf(project) {
  const raw = project && project.modules;
  if (raw == null || raw === '') return MODULE_IDS.slice();
  try {
    const got = cleanModules(JSON.parse(raw));
    return got == null ? MODULE_IDS.slice() : got;
  } catch (e) {
    return MODULE_IDS.slice();
  }
}

export function moduleOn(mods, id) {
  return !BY_ID[id] || mods.includes(id);          // core and unknown ids are never gated
}

// Which module owns this API path, or null for the core.
export function moduleForPath(path) {
  for (const m of MODULES) {
    for (const pre of m.api) {
      if (path === pre || path.startsWith(pre + '/')) return m.id;
    }
  }
  return null;
}

// Is a record type available in a project with these modules on?
export function recordTypeOn(mods, type) {
  if (SHARED_RECORDS[type]) return SHARED_RECORDS[type].some((id) => mods.includes(id));
  const owner = MODULES.find((m) => m.records.includes(type));
  return owner ? mods.includes(owner.id) : true;
}

// Setup cards needed by this set of modules. A card listed under several modules
// is needed while any of them is on.
export function setupStepsOn(mods) {
  const steps = new Set();
  MODULES.forEach((m) => { if (mods.includes(m.id)) m.setup.forEach((s) => steps.add(s)); });
  return [...steps];
}

// The dashboards switched off, for the app shell to hide.
export function dashboardsOff(mods) {
  return MODULE_IDS.filter((id) => !mods.includes(id));
}

// The catalogue, as the setup console shows it.
export function catalogue() {
  return {
    core: CORE,
    modules: MODULES.map(({ id, label, note, setup }) => ({ id, label, note, setup })),
  };
}

// Projects created before modules existed have no column. Adding it is safe to
// try every time (SQLite and PostgreSQL both refuse a duplicate harmlessly), and
// it is only tried once per running instance.
let columnChecked = false;
export async function ensureModulesColumn(env) {
  if (columnChecked) return;
  try {
    await env.DB.prepare('SELECT modules FROM projects LIMIT 1').first();
  } catch (e) {
    try { await env.DB.prepare('ALTER TABLE projects ADD COLUMN modules TEXT').run(); } catch (e2) { /* already there */ }
  }
  columnChecked = true;
}

export async function getProjectModules(env, pid) {
  await ensureModulesColumn(env);
  const row = await env.DB.prepare('SELECT modules FROM projects WHERE id = ?').bind(pid).first();
  return row ? modulesOf(row) : null;
}

// Save the module list for a project. Only turns things on and off — never
// touches the data any module holds.
export async function setProjectModules(env, pid, list) {
  const mods = cleanModules(list);
  if (mods == null) return { error: 'send the modules as a list' };
  await ensureModulesColumn(env);
  const row = await env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(pid).first();
  if (!row) return { error: 'no such project' };
  await env.DB.prepare('UPDATE projects SET modules = ? WHERE id = ?').bind(JSON.stringify(mods), pid).run();
  return { ok: true, project_id: pid, modules: mods, setup_steps: setupStepsOn(mods) };
}
