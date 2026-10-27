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

import { addColumns } from './db-cols.js';

export const CORE = [
  { id: 'core', label: 'Base platform', note: 'Principal & PM dashboards, programme and progress, team & access, issues, reports' },
];

// WHAT A MODULE IS
//
//   id       for the first eleven, the dashboard it owns (the names in ALLDASH
//            in functions.js). The later ones own no dashboard of their own —
//            they are capability that appears inside the screens already there.
//   group    the heading it sits under on the modules screen
//   api      path prefixes this module owns
//   records  record types that belong to it
//   setup    setup-console cards that are only needed when it is on
//   since    the catalogue version that introduced it. See modulesOf() below:
//            a project saved before a module existed gets it, rather than
//            silently losing a screen it has been using.
//
// THE CATALOGUE USED TO BE ELEVEN THINGS, and the platform did considerably
// more than eleven things. Meetings and minutes, the correspondence and
// transmittal registers, the reports, the rates and resource library, the
// intake gate and the AI assistance were all built, all reachable, and none of
// them could be switched on or off or even seen on the modules screen — so a
// customer could not be sold them and an admin could not tell they existed.
// Everything the platform can do is now in this list.
export const MODULES = [
  /* ---- the programme */
  { id: 'planning',    group: 'Programme',   label: 'Programme & planning',
    note: 'Baseline programme, critical path, look-ahead, delay impact, P6 import and export',
    api: ['/api/schedule', '/api/impact', '/api/programme'], records: [], setup: [], since: 1 },

  /* ---- the site */
  { id: 'site',        group: 'Site',        label: 'Site progress & daily diary',
    note: 'Daily diary, manpower and plant, progress against the programme, material requests',
    api: ['/api/diary', '/api/manpower'], records: ['mr'], setup: [], since: 1 },
  { id: 'subcon',      group: 'Site',        label: 'Subcontractors',
    note: 'Subcontractor dashboard and their work on the project',
    api: [], records: [], setup: [], since: 1 },

  /* ---- what goes to the Engineer */
  { id: 'design',      group: 'To the Engineer', label: 'Submittals, RFIs & approvals',
    note: 'Submittals, method statements, material approvals, RFIs and authority NOCs',
    api: [], records: ['submittal', 'ms', 'material', 'rfi', 'authority', 'cvi'],
    setup: ['authorities', 'templates'], since: 1 },
  { id: 'meetings',    group: 'To the Engineer', label: 'Meetings & minutes',
    note: 'Meeting register, agendas, minutes with actions carried to the next one',
    api: ['/api/meeting', '/api/meetings'], records: [], setup: [], since: 2 },

  /* ---- documents */
  { id: 'dc',          group: 'Documents',   label: 'Drawings & document control',
    note: 'Drawing register, revisions and approvals, incoming correspondence',
    api: ['/api/drawing', '/api/drawings'], records: ['incoming'],
    setup: ['templates', 'drawings'], since: 1 },
  { id: 'registers',   group: 'Documents',   label: 'Registers & exports',
    note: 'Every register as a formatted spreadsheet — drawings, submittals, RFIs, NCRs, IPCs',
    api: ['/api/register'], records: [], setup: [], since: 2 },
  { id: 'gate',        group: 'Documents',   label: 'Intake gate & quarantine',
    note: 'Rules that hold a document back on arrival until somebody checks it',
    api: ['/api/quarantine', '/api/review'], records: [], setup: [], since: 2 },
  // Spec D2 and §25: Document Control may bulk-load DRAWINGS into their own
  // project (enforced on the server: a non-AETRAA drop is drawings-only), and
  // the phase is switched on per project. Opt-in: off for every project until
  // AETRAA switches it on, unlike the modules that came before it.
  { id: 'bulkload',    group: 'Documents',   label: 'Bulk drawing loading (Document Control)',
    note: 'Document Control drops a folder of drawings: each sheet read, checked against the numbering and the gate, and filed. Drawings only. Switched on per project.',
    // Checked where a drop is opened (index.js), not on every /api/intake route:
    // the DC still sees their project's drops and reports with it off.
    api: [], records: [], setup: [], since: 3, optIn: true },

  /* ---- assurance */
  { id: 'qaqc',        group: 'Assurance',   label: 'QA / QC',
    note: 'Work and material inspection requests, non-conformance reports',
    api: [], records: ['wir', 'mir', 'ncr'], setup: [], since: 1 },
  { id: 'hse',         group: 'Assurance',   label: 'HSE',
    note: 'Safety log, permits to work, observations, incidents, certificates',
    api: ['/api/hse'], records: ['ptw', 'obs', 'incident', 'cert'], setup: [], since: 1 },

  /* ---- the money */
  { id: 'commercial',  group: 'Commercial',  label: 'Contracts & commercial',
    note: 'Priced BOQ, interim payment certificates, variations',
    api: ['/api/boq', '/api/ipc'], records: ['variation'], setup: ['boq'], since: 1 },
  { id: 'procurement', group: 'Commercial',  label: 'Procurement',
    note: 'Bill of materials, orders, goods received',
    api: ['/api/bom'], records: [], setup: ['bom'], since: 1 },
  { id: 'resources',   group: 'Commercial',  label: 'Resources & rates',
    note: 'Labour, plant and material rates, trades, and what the work is costing',
    api: ['/api/resources', '/api/rates', '/api/rate', '/api/trades'], records: [], setup: [], since: 2 },
  { id: 'finance',     group: 'Commercial',  label: 'Finance',
    note: 'Cashflow, certified against applied, what is outstanding',
    api: [], records: [], setup: [], since: 1 },

  /* ---- reporting */
  { id: 'reports',     group: 'Reporting',   label: 'Reports',
    note: 'Daily, weekly and monthly reports, issued on their own schedule',
    api: ['/api/report', '/api/report-email'], records: [], setup: [], since: 2 },
  { id: 'ai',          group: 'Reporting',   label: 'AI assistance',
    note: 'Drafting, summarising and the suggested next actions on a dashboard',
    api: ['/api/ai', '/api/actions'], records: [], setup: [], since: 2 },

  /* ---- access for people outside the contractor's office */
  { id: 'consultant',  group: 'Access',      label: 'Consultant window (read only)',
    note: 'A read-only dashboard for the Engineer when they are not on AETRAA themselves',
    api: [], records: [], setup: [], since: 1 },
];

// Bumped whenever a module is added, and written into every project's saved
// list. modulesOf() uses it to tell "switched off" from "did not exist yet".
export const CATALOGUE_VERSION = 3;

export const MODULE_IDS = MODULES.map((m) => m.id);
export const MODULE_GROUPS = [...new Set(MODULES.map((m) => m.group))];

// The modules that own a dashboard of their own — the same names as ALLDASH in
// functions.js. The rest are capability inside screens that already exist, and
// handing one of their ids to the app shell as a dashboard to hide would be
// asking it to hide something that was never there.
export const DASH_MODULES = ['planning', 'site', 'design', 'dc', 'qaqc', 'hse',
                             'commercial', 'procurement', 'finance', 'subcon', 'consultant'];
const BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]));

// Letters can come from design or from commercial; they are on while either is.
const SHARED_RECORDS = { letter: ['design', 'commercial'] };

// A clean list: known ids only, no repeats, catalogue order.
export function cleanModules(list) {
  if (!Array.isArray(list)) return null;
  const want = new Set(list.map(String));
  return MODULE_IDS.filter((id) => want.has(id));
}

/* THE MODULES ON FOR A PROJECT.
 *
 * null / blank / unreadable = everything, which is every project set up before
 * modules existed.
 *
 * A MODULE THAT DID NOT EXIST WHEN THE LIST WAS SAVED IS ON, NOT OFF.
 *
 * The list records what somebody switched on. Read naively, a project saved
 * last week has every module added since then switched off — so adding
 * Meetings to the catalogue would take Meetings away from every project
 * already running, silently, with nothing on any screen to say why. Nobody
 * chose that; the list simply could not express a module that did not exist.
 *
 * So the saved list carries the catalogue version it was written against, and
 * anything introduced after it is on. Once the admin saves the modules screen
 * the list is stamped with the current version and means exactly what it says.
 *
 * The old format — a bare array, no version — reads as version 1. */
// An opt-in module (bulk loading) is on only where it was switched on: never
// by default, and never added to a list saved before it existed.
export const DEFAULT_ON = MODULES.filter((m) => !m.optIn).map((m) => m.id);
export const OPT_IN = MODULES.filter((m) => m.optIn).map((m) => m.id);
export function modulesOf(project) {
  const raw = project && project.modules;
  if (raw == null || raw === '') return DEFAULT_ON.slice();
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return DEFAULT_ON.slice(); }

  const isObj = parsed && !Array.isArray(parsed) && typeof parsed === 'object';
  const savedAt = isObj ? Number(parsed.v) || 1 : 1;
  const got = cleanModules(isObj ? parsed.on : parsed);
  if (got == null) return DEFAULT_ON.slice();

  const on = new Set(got);
  for (const m of MODULES) if ((m.since || 1) > savedAt && !m.optIn) on.add(m.id);
  return MODULE_IDS.filter((id) => on.has(id));
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

// The dashboards switched off, for the app shell to hide. Only modules that own
// a dashboard can name one.
export function dashboardsOff(mods) {
  return DASH_MODULES.filter((id) => !mods.includes(id));
}

// The catalogue, as the setup console and the modules screen show it.
export function catalogue() {
  return {
    core: CORE,
    groups: MODULE_GROUPS,
    version: CATALOGUE_VERSION,
    modules: MODULES.map(({ id, group, label, note, setup }) => ({ id, group, label, note, setup })),
  };
}

// Projects created before modules existed have no column. Adding it is safe to
// try every time (SQLite and PostgreSQL both refuse a duplicate harmlessly), and
// it is only tried once per running instance.
let columnChecked = false;
export async function ensureModulesColumn(env) {
  if (columnChecked) return;
  // addColumns (db-cols.js): looked up first. A failed SELECT-then-ALTER can
  // leave the column missing on PostgreSQL behind a connection pool.
  columnChecked = await addColumns(env, 'projects', [['modules', 'TEXT']]);
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
  // Stamped with the catalogue it was chosen from, so a later reader can tell
  // "switched off" from "did not exist yet". See modulesOf().
  await env.DB.prepare('UPDATE projects SET modules = ? WHERE id = ?')
    .bind(JSON.stringify({ v: CATALOGUE_VERSION, on: mods }), pid).run();
  return { ok: true, project_id: pid, modules: mods, setup_steps: setupStepsOn(mods) };
}
