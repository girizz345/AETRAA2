// THE PROJECT ORGANISATION — the roles on this job, and what each one carries.
//
// WHY THIS IS A TABLE AND NOT A CONSTANT.
//
// Until now the thirteen functions, their dashboards and their place in every
// approval ladder were written into the source. That is correct for a platform
// with one customer and wrong for a platform with ten: no two contractors have
// the same org chart. One has a Project Director over the PM and another does
// not; one calls him Construction Manager; one runs Supervisors who sign
// nothing and another lets a Supervisor close a permit.
//
// So the catalogue is seeded from what the platform ships with, and after that
// it belongs to the Principal. He can rename a role, add one, retire one, and
// change what any of them carries — at any time, on a live project.
//
// A ROLE CARRIES THREE THINGS, and all three are the Principal's to set:
//
//   DISCIPLINES   which disciplines a person in this role may be scoped to —
//                 several, not one. A Project Engineer is Structural AND Civil
//                 on a small job; a Design Engineer covers MEP and Façade.
//
//   DASHBOARDS    which of the fourteen screens the role opens, and whether it
//                 may act there ('full') or only read. This is what makes a new
//                 role real: a Supervisor given the Site dashboard sees exactly
//                 what a Project Engineer sees, which is usually what an office
//                 actually wants.
//
//   WORKFLOW      which steps of which records the role may sign. Held in
//                 workflow-store.js, because a step belongs to the ladder, but
//                 it is edited from the same screen — assigning a role is one
//                 act, not three in three places.
//
// THE ONE THING A PRINCIPAL MAY NOT DO is leave a record type with no one able
// to sign a step, or remove the last Principal. Both strand the project: a
// submittal at a step nobody owns can never close, and after go-live AETRAA has
// no reach into the project to repair it. Those two refusals live in
// workflow-store.js and in saveRole below, and they are the only limits.

import { FUNCTIONS, ACCESS, ALLDASH } from './functions.js';
import { PARTY_IDS } from './parties.js';
import { addColumns, columnsOf } from './db-cols.js';

const nowISO = () => new Date().toISOString();
const str = (v, n = 120) => String(v == null ? '' : v).trim().slice(0, n);

/* ------------------------------------------------------- what ships with it */

// The disciplines a role can be scoped to. Checkboxes, because a person holds
// several: the engineer who covers Structural and Civil is the normal case on a
// job this size, not an exception.
export const DISCIPLINES = [
  'Civil', 'Structural', 'Architectural', 'MEP', 'Finishes',
  'Facade', 'Infrastructure', 'Landscape',
];

// Which roles a discipline means anything for. A Finance role scoped to MEP is
// noise on the screen, so the checkbox only appears where it is real.
export const DISCIPLINE_ROLES = ['peng', 'site', 'supervisor', 'design', 'qaqc', 'cm', 'mep', 'survey', 'planning'];

// The catalogue a new project starts with. The first thirteen are what the
// platform already ran on; the rest are the ones a real contractor org chart
// has and this platform did not.
//
// `dash` is [dashboard, 'full'|'read']. A new role's dashboards are the whole
// point of it — a Supervisor with the Site dashboard sees what a Project
// Engineer sees, which is the example that prompted this.
const D = (own, read = []) => [[own, 'full']].concat(read.map((r) => [r, 'read']));
const ALL_FULL = ALLDASH.map((r) => [r, 'full']);

// A ROLE BELONGS TO A PARTY.
//
// Every role below used to be a contractor's role, because the platform had
// only ever been pointed at a contractor. That is why a consultant admin was
// offered Procurement and Subcontractors, and why a developer could not be put
// on a project at all — there was no Employer role to give them.
//
// So each role now names the party it belongs to, and a project is seeded only
// with the roles of the parties actually on it. A project with no parties
// recorded — every project that existed before this — is a contractor project,
// and gets exactly the twenty roles it had.
const CONTRACTOR_ROLES = [
  // ---- command
  { id: 'principal',  label: 'Principal',              grp: 'Command',    dash: ALL_FULL, protect: true },
  // THE CONTRACTOR'S SIGNATORY. FIDIC 4.3: the person the Contractor appoints
  // to act for it under the contract. Every letter and every submittal that
  // leaves the contractor carries this person's signature. Distinct from the
  // Principal — the Principal holds the project on the platform; the
  // Representative signs on the job. On a small contractor they are the same
  // person, and one person can hold both roles.
  { id: 'rep',        label: 'Contractor’s Representative', grp: 'Command', dash: ALL_FULL,
    note: 'Signs every letter and submittal that leaves the contractor.' },
  { id: 'director',   label: 'Project Director',       grp: 'Command',    dash: ALL_FULL },
  { id: 'pm',         label: 'Project Manager',        grp: 'Command',    dash: ALL_FULL },
  { id: 'cm',         label: 'Construction Manager',   grp: 'Command',
    dash: D('site', ['design', 'planning', 'qaqc', 'hse', 'subcon']) },

  // ---- engineering
  { id: 'peng',       label: 'Project Engineer',       grp: 'Engineering',
    dash: D('site', ['design', 'planning', 'qaqc']) },
  { id: 'site',       label: 'Site Engineer',          grp: 'Engineering', dash: D('site', ['design']) },
  { id: 'supervisor', label: 'Supervisor / Foreman',   grp: 'Engineering', dash: D('site', ['design']) },
  { id: 'mep',        label: 'MEP Coordinator',        grp: 'Engineering', dash: D('site', ['design', 'qaqc']) },
  { id: 'survey',     label: 'Surveyor',               grp: 'Engineering', dash: D('site', ['design']) },

  // ---- technical
  { id: 'design',     label: 'Design & Drawings',      grp: 'Technical',   dash: D('design') },
  { id: 'planning',   label: 'Planning Engineer',      grp: 'Technical',
    dash: D('planning', ['design', 'site']) },
  { id: 'dc',         label: 'Document Control',       grp: 'Technical',
    dash: ALLDASH.filter((r) => r !== 'team').map((r) => [r, r === 'dc' ? 'full' : 'read']) },

  // ---- assurance
  { id: 'qaqc',       label: 'QA / QC Engineer',       grp: 'Assurance',   dash: D('qaqc') },
  { id: 'hse',        label: 'HSE Officer',            grp: 'Assurance',   dash: D('hse') },

  // ---- commercial
  { id: 'commercial', label: 'Contracts & Commercial', grp: 'Commercial',
    dash: ALLDASH.filter((r) => r !== 'team').map((r) => [r, r === 'commercial' ? 'full' : 'read']) },
  { id: 'procurement',label: 'Procurement',            grp: 'Commercial',  dash: D('procurement', ['subcon']) },
  { id: 'store',      label: 'Store & Materials',      grp: 'Commercial',  dash: D('procurement', ['site']) },
  { id: 'finance',    label: 'Finance',                grp: 'Commercial',  dash: D('finance') },

  // ---- outside the contractor's own office
  { id: 'subcon',     label: 'Subcontractor',          grp: 'External',    dash: D('subcon') },
  { id: 'consultant', label: 'Consultant / Engineer',  grp: 'External',    dash: D('consultant'),
    note: 'Read-only on this project. Give this to the Engineer’s people when the Engineer is ' +
          'not on AETRAA. When they are, they hold their own roles instead.' },
];

// THE CONSULTANT'S OWN ROLES.
//
// Not the read-only window the contractor opens for a guest — the people who
// actually do the Engineer's work: the ones who code a submittal A/B/C/D,
// answer an RFI, raise an NCR against the contractor, and certify a payment.
// None of that could be held by anyone before, because the only consultant role
// on the platform could not act.
const CONSULTANT_ROLES = [
  { id: 'c_principal', label: 'Engineer’s Representative', grp: 'Command', dash: ALL_FULL,
    protect: true, note: 'The Engineer named in the contract, or their delegate. Holds the project ' +
                         'for the consultant and cannot be removed.' },
  { id: 'c_pd',        label: 'Project Director',        grp: 'Command',     dash: ALL_FULL },
  { id: 'c_re',        label: 'Resident Engineer',       grp: 'Command',
    dash: D('site', ['design', 'qaqc', 'dc', 'planning', 'commercial']) },
  { id: 'c_reviewer',  label: 'Design Reviewer',         grp: 'Engineering', dash: D('design', ['dc']) },
  { id: 'c_inspector', label: 'Site Inspector',          grp: 'Engineering', dash: D('qaqc', ['site']) },
  { id: 'c_dc',        label: 'Document Control',        grp: 'Technical',
    dash: ALLDASH.filter((r) => r !== 'team').map((r) => [r, r === 'dc' ? 'full' : 'read']) },
  { id: 'c_planning',  label: 'Planning Reviewer',       grp: 'Technical',   dash: D('planning', ['site']) },
  { id: 'c_qs',        label: 'Cost Consultant / QS',    grp: 'Commercial',  dash: D('commercial', ['procurement']) },
  { id: 'c_hse',       label: 'HSE Reviewer',            grp: 'Assurance',   dash: D('hse', ['site']) },
];

// THE DEVELOPER'S OWN ROLES.
//
// The Employer was the one party with no representation at all. These are the
// people who approve what changes the design or the cost, and who need to see
// where the money and the programme are — not the people who run the site.
const DEVELOPER_ROLES = [
  { id: 'd_principal', label: 'Employer’s Representative', grp: 'Command', dash: ALL_FULL,
    protect: true, note: 'The client’s accountable person. Holds the project for the developer ' +
                         'and cannot be removed.' },
  { id: 'd_dm',        label: 'Development Manager',     grp: 'Command',     dash: ALL_FULL },
  { id: 'd_tech',      label: 'Technical Lead',          grp: 'Engineering',
    dash: D('design', ['site', 'qaqc', 'dc', 'planning']) },
  { id: 'd_cost',      label: 'Cost & Contracts',        grp: 'Commercial',  dash: D('commercial', ['finance', 'procurement']) },
  { id: 'd_finance',   label: 'Finance',                 grp: 'Commercial',  dash: D('finance', ['commercial']) },
  { id: 'd_dc',        label: 'Document Control',        grp: 'Technical',
    dash: ALLDASH.filter((r) => r !== 'team').map((r) => [r, r === 'dc' ? 'full' : 'read']) },
];

const withParty = (list, party) => list.map((r) => Object.assign({ party }, r));

/* EACH PARTY SIGNS WITH ITS OWN REPRESENTATIVE.
 *
 * Under the contract, every party acts through one named person: the
 * Employer's Representative, the Engineer's Representative, the Contractor's
 * Representative. That person is the signatory on everything the party sends
 * — every letter, every submittal, every reply. A route that goes out without
 * them has gone out unsigned.
 *
 * So each party has exactly one signatory role, and the workflow screen can
 * put that role's signature in front of every step where something leaves. */
export const REPRESENTATIVE = {
  developer: 'd_principal',
  consultant: 'c_principal',
  contractor: 'rep',
};
export const SIGNATORY_IDS = Object.values(REPRESENTATIVE);
export const isSignatory = (id) => SIGNATORY_IDS.includes(String(id));
export const representativeFor = (party) => REPRESENTATIVE[party] || REPRESENTATIVE.contractor;

export const ROLE_CATALOGUE = [].concat(
  withParty(DEVELOPER_ROLES, 'developer'),
  withParty(CONSULTANT_ROLES, 'consultant'),
  withParty(CONTRACTOR_ROLES, 'contractor'),
);

// The roles a given set of parties brings. An unknown party brings nothing
// rather than everything — a typo must not hand somebody the whole catalogue.
export function catalogueFor(parties) {
  const want = (Array.isArray(parties) ? parties : [])
    .map(String).filter((p) => PARTY_IDS.includes(p));
  const on = want.length ? want : ['contractor'];
  return ROLE_CATALOGUE.filter((r) => on.includes(r.party));
}

export const GROUPS = ['Command', 'Engineering', 'Technical', 'Assurance', 'Commercial', 'External'];

/* ----------------------------------------------------------------- the table */

let ready = false;
export async function ensureRolesTable(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS project_roles (
         project_id TEXT NOT NULL, id TEXT NOT NULL, label TEXT, grp TEXT,
         dash TEXT, disciplines TEXT, note TEXT,
         builtin INTEGER DEFAULT 0, protect INTEGER DEFAULT 0, retired INTEGER DEFAULT 0,
         sort_order INTEGER, changed_by TEXT, changed_at TEXT,
         PRIMARY KEY (project_id, id))`
    ).run();
    // Projects seeded before roles belonged to a party have no column. Adding it
    // is safe to try once; every existing row is a contractor's role, which is
    // what those projects are.
    // Looked up first (db-cols.js), so no failed statement on PostgreSQL; the
    // existing roles are given their party only when the column is new.
    {
      const had = (await columnsOf(env, 'project_roles')).includes('party');
      if (!had && await addColumns(env, 'project_roles', [['party', 'TEXT']])) {
        await env.DB.prepare("UPDATE project_roles SET party = 'contractor' WHERE party IS NULL").run().catch(() => {});
      }
    }
    ready = true;
    return true;
  } catch (e) { return false; }
}

const safeJson = (s, f) => { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } };

function shape(r) {
  return {
    id: r.id,
    label: r.label || r.id,
    party: PARTY_IDS.includes(r.party) ? r.party : 'contractor',
    signatory: isSignatory(r.id),
    grp: r.grp || 'Command',
    dash: safeJson(r.dash, []),
    disciplines: safeJson(r.disciplines, []),
    note: r.note || '',
    builtin: !!r.builtin,
    protect: !!r.protect,
    retired: !!r.retired,
    sort_order: r.sort_order == null ? 999 : r.sort_order,
  };
}

/* --------------------------------------------------------------- the seeding

   A project gets the catalogue the first time anybody looks at it, not when it
   is created — so the thirty projects that exist already get it too, without a
   migration anyone has to remember to run. */

// IT TOPS UP RATHER THAN SEEDING ONCE.
//
// It used to bail the moment the project had a single role row, which was right
// while every project got the same twenty roles. It is wrong now: a project
// created as contractor-only and later joined by the Engineer must gain the
// consultant's roles without anybody running a migration. So it inserts the
// roles that are missing for the parties currently on the project, and leaves
// everything already there alone — including roles the Principal has edited.
//
// Returns true if it inserted anything.
export async function seedRoles(env, pid, opts = {}) {
  if (!(await ensureRolesTable(env))) return false;
  if (opts === true) opts = { force: true };
  try {
    let parties = Array.isArray(opts.parties) ? opts.parties : null;
    if (!parties) parties = await partyIdsFor(env, pid);
    const want = catalogueFor(parties);

    const { results } = await env.DB.prepare(
      'SELECT id FROM project_roles WHERE project_id = ?'
    ).bind(pid).all().catch(() => ({ results: [] }));
    const have = new Set((results || []).map((r) => r.id));

    let i = 0, added = 0;
    for (const r of want) {
      i++;
      if (have.has(r.id) && !opts.force) continue;
      if (have.has(r.id)) continue;               // force re-seeds missing, never overwrites edits
      await env.DB.prepare(
        `INSERT INTO project_roles (project_id, id, label, grp, party, dash, disciplines, note,
           builtin, protect, retired, sort_order, changed_by, changed_at)
         VALUES (?,?,?,?,?,?,?,?,1,?,0,?,?,?)`
      ).bind(pid, r.id, r.label, r.grp, r.party || 'contractor', JSON.stringify(r.dash),
             JSON.stringify([]),
             r.note || null, r.protect ? 1 : 0, i, 'AETRAA', nowISO()).run().catch(() => {});
      added++;
    }
    return added > 0;
  } catch (e) { return false; }
}

// The parties on a project, read straight from the table so roles-store does not
// have to import the rest of parties.js at call time. No rows means the project
// predates parties, and every one of those is a contractor project.
async function partyIdsFor(env, pid) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT party FROM project_parties WHERE project_id = ?'
    ).bind(pid).all();
    const ids = (results || []).map((r) => String(r.party)).filter((p) => PARTY_IDS.includes(p));
    return ids.length ? ids : ['contractor'];
  } catch (e) { return ['contractor']; }
}

export async function listRoles(env, pid, opts = {}) {
  if (!(await ensureRolesTable(env))) return [];
  await seedRoles(env, pid);
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM project_roles WHERE project_id = ?'
    ).bind(pid).all();
    const only = opts.party
      ? (Array.isArray(opts.party) ? opts.party.map(String) : [String(opts.party)])
      : null;
    const rows = (results || []).map(shape)
      .filter((r) => opts.all || !r.retired)
      .filter((r) => !only || only.includes(r.party))
      .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
    return rows;
  } catch (e) { return []; }
}

export async function getRole(env, pid, id) {
  const all = await listRoles(env, pid, { all: true });
  return all.find((r) => r.id === String(id)) || null;
}

/* ---------------------------------------------------------------- the edits */

// A new role's id, from its name. Kept to letters and digits because it is
// written into every person's function list and every workflow step, and an id
// with a quote in it breaks both quietly.
export function roleId(label, taken) {
  let base = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18);
  if (!base) base = 'role';
  if (!taken || !taken.includes(base)) return base;
  for (let i = 2; i < 80; i++) if (!taken.includes(base + i)) return base + i;
  return base + Date.now().toString(36).slice(-4);
}

// Clean a dashboard list from the screen. Anything that is not one of the
// fourteen real dashboards is dropped rather than stored — a role pointing at a
// dashboard that does not exist looks configured and shows nothing.
export function cleanDash(list) {
  const out = [], seen = {};
  for (const e of Array.isArray(list) ? list : []) {
    const d = Array.isArray(e) ? e[0] : (e && e.dash);
    const lv = (Array.isArray(e) ? e[1] : (e && e.level)) === 'read' ? 'read' : 'full';
    if (!ALLDASH.includes(d) || seen[d]) continue;
    seen[d] = 1;
    out.push([d, lv]);
  }
  return out;
}

export function cleanDisciplines(list) {
  const out = [], seen = {};
  for (const d of Array.isArray(list) ? list : []) {
    const v = DISCIPLINES.find((x) => x.toLowerCase() === String(d).toLowerCase());
    if (!v || seen[v]) continue;
    seen[v] = 1;
    out.push(v);
  }
  return out;
}

export async function saveRole(env, pid, body, who) {
  if (!(await ensureRolesTable(env))) return { error: 'roles are not available on this database' };
  await seedRoles(env, pid);

  const label = str(body.label, 80);
  if (!label) return { error: 'a role needs a name' };

  const existing = body.id ? await getRole(env, pid, body.id) : null;
  if (body.id && !existing) return { error: 'no such role' };

  const dash = cleanDash(body.dash);
  // A role that opens nothing is not a role. It would appear in the list, be
  // assignable, and give whoever holds it a blank application.
  if (!dash.length) {
    return { error: 'Tick at least one dashboard. A role that opens no dashboard gives ' +
                    'whoever holds it an empty screen.' };
  }
  const disciplines = cleanDisciplines(body.disciplines);
  const grp = GROUPS.includes(str(body.grp, 30)) ? str(body.grp, 30) : 'Engineering';
  const note = str(body.note, 300);

  if (existing) {
    await env.DB.prepare(
      `UPDATE project_roles SET label=?, grp=?, dash=?, disciplines=?, note=?, changed_by=?, changed_at=?
        WHERE project_id=? AND id=?`
    ).bind(label, grp, JSON.stringify(dash), JSON.stringify(disciplines), note || null,
           (who && who.name) || 'AETRAA', nowISO(), pid, existing.id).run();
    return { ok: true, id: existing.id, updated: true };
  }

  const taken = (await listRoles(env, pid, { all: true })).map((r) => r.id);
  const id = roleId(label, taken);
  const sort = 500 + taken.length;
  // A new role belongs to whichever party is adding it. Without this it would
  // default to the contractor and appear on the wrong side of the project.
  const party = PARTY_IDS.includes(str(body.party, 20))
    ? str(body.party, 20)
    : (await partyIdsFor(env, pid))[0];
  await env.DB.prepare(
    `INSERT INTO project_roles (project_id, id, label, grp, party, dash, disciplines, note,
       builtin, protect, retired, sort_order, changed_by, changed_at)
     VALUES (?,?,?,?,?,?,?,?,0,0,0,?,?,?)`
  ).bind(pid, id, label, grp, party, JSON.stringify(dash), JSON.stringify(disciplines), note || null,
         sort, (who && who.name) || 'AETRAA', nowISO()).run();
  return { ok: true, id, created: true };
}

// RETIRING, not deleting.
//
// A role's id is written into every person who holds it and every workflow step
// that names it. Deleting the row would leave those pointing at nothing, and
// nothing on screen would say why a step had stopped being signable. So a role
// is retired: it leaves the list, and it is refused while anybody still holds
// it or any ladder still names it — with the reason said out loud.
export async function retireRole(env, pid, id, who, deps) {
  const role = await getRole(env, pid, String(id));
  if (!role) return { error: 'no such role' };
  if (role.protect) {
    return { error: 'The Principal cannot be retired. Every project must have one, and after ' +
                    'go-live AETRAA has no way back in to restore it.' };
  }
  const holders = (deps && deps.holders) || [];
  if (holders.length) {
    return { error: role.label + ' is still held by ' + holders.slice(0, 4).join(', ') +
                    (holders.length > 4 ? ' and ' + (holders.length - 4) + ' more' : '') +
                    '. Move them to another role first.' };
  }
  const steps = (deps && deps.steps) || [];
  if (steps.length) {
    return { error: role.label + ' still signs ' + steps.slice(0, 3).join(', ') +
                    (steps.length > 3 ? ' and ' + (steps.length - 3) + ' more steps' : '') +
                    '. Reassign those steps first, or the records stop at them.' };
  }
  await env.DB.prepare(
    'UPDATE project_roles SET retired=1, changed_by=?, changed_at=? WHERE project_id=? AND id=?'
  ).bind((who && who.name) || 'AETRAA', nowISO(), pid, role.id).run();
  return { ok: true, id: role.id, retired: true };
}

export async function restoreRole(env, pid, id, who) {
  const role = await getRole(env, pid, String(id));
  if (!role) return { error: 'no such role' };
  await env.DB.prepare(
    'UPDATE project_roles SET retired=0, changed_by=?, changed_at=? WHERE project_id=? AND id=?'
  ).bind((who && who.name) || 'AETRAA', nowISO(), pid, role.id).run();
  return { ok: true, id: role.id };
}

/* ------------------------------------------------------------- what it means

   The access a person actually gets, resolved from THIS project's catalogue
   rather than the shipped constant. Several roles on one person merge, and
   'full' always beats 'read' — a QS who is also Procurement edits both. */

export async function accessFor(env, pid, roleIds) {
  const roles = await listRoles(env, pid, { all: true });
  const by = {};
  for (const r of roles) by[r.id] = r;

  const map = {};
  for (const id of Array.isArray(roleIds) ? roleIds : []) {
    const r = by[id];
    // A role this project has never heard of falls back to what the platform
    // ships with, so a person set up before the catalogue existed keeps working.
    const dash = r ? r.dash : (ACCESS[id] || (FUNCTIONS[id] ? [[id, 'full']] : []));
    for (const [d, lv] of dash) if (map[d] !== 'full') map[d] = lv;
  }
  const full = [], read = [];
  for (const d of ALLDASH) {
    if (map[d] === 'full') full.push([d, 'full']);
    else if (map[d] === 'read') read.push([d, 'read']);
  }
  return full.concat(read);
}

// The label to print for a role id, from this project's catalogue. Falls back
// to the shipped label, then to the id, so a screen never shows a blank.
export async function labelsFor(env, pid) {
  const roles = await listRoles(env, pid, { all: true });
  const out = {};
  for (const r of roles) out[r.id] = r.label;
  for (const k of Object.keys(FUNCTIONS)) if (!out[k]) out[k] = FUNCTIONS[k].label;
  return out;
}
