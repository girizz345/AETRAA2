// THE PARTIES ON A PROJECT — who is actually on this job, and on which side.
//
// Until now AETRAA had no idea that a construction project has more than one
// company on it. Every role in the catalogue was a contractor's role, all
// fourteen dashboards were contractor screens, and all thirteen workflow routes
// ended the same way: "Document Control issues to the Engineer / consultant /
// client." The system stopped at the contractor's front door. The consultant's
// review, the code A/B/C/D and the return trip happened by email, outside it.
//
// That is a one-sided platform. A consultant cannot use it, only receive from
// it, and a developer cannot use it at all — there was no Employer role to give
// them.
//
// So a project now says who is on it. Three parties to start with, because
// those are the three that sign a building contract:
//
//   DEVELOPER   the Employer. Owns it, funds it, approves what changes the
//               design or the cost.
//   CONSULTANT  the Engineer. Designs, reviews, codes submittals, answers RFIs,
//               certifies payment.
//   CONTRACTOR  builds it. Raises submittals, RFIs and payment applications,
//               runs the site.
//
// TWO QUESTIONS, NOT ONE. "Which parties are on this project" and "which one is
// my company" are different questions, and conflating them is how one admin
// ends up staffing three companies' internal teams. The consultant staffs their
// own side, with their own people and their own internal steps the contractor
// must never see. So exactly one party is marked `is_self` — the organisation
// that set the project up — and the others are shells until they are invited.
//
// A PARTY MAY BE "TO BE APPOINTED". In this region the Engineer is routinely
// appointed weeks after award. A project that refused to open until every party
// had a name would never open. So a party can be ticked with no company and no
// email: it exists, the routes know it will exist, and records that reach its
// step park at the boundary rather than being refused.
//
// OWNERSHIP: the organisation that creates the project keeps it. Inviting the
// Engineer does not hand them the project. That is a deliberate choice and a
// recorded one — `is_self` is the row that holds it — and it is the setting to
// revisit if AETRAA ever sells top-down to developers and PMCs.
//
// LEGACY PROJECTS. Every project that existed before this file has no rows in
// project_parties, and reading one returns a single contractor party marked
// self. That is exactly what those projects are, so nothing about them changes.

import { MODULE_IDS, DEFAULT_ON, OPT_IN, setProjectModules, getProjectModules } from './modules.js';

const nowISO = () => new Date().toISOString();
const str = (v, n = 160) => String(v == null ? '' : v).trim().slice(0, n);

/* ------------------------------------------------------------- the catalogue */

export const PARTIES = [
  {
    id: 'developer',
    label: 'Developer / Employer',
    short: 'Developer',
    note: 'The client. Owns the project, funds it, and approves anything that changes the design or the cost.',
  },
  {
    id: 'consultant',
    label: 'Consultant / Engineer',
    short: 'Consultant',
    note: 'Designs, reviews and certifies. Codes submittals, answers RFIs, certifies payment.',
  },
  {
    id: 'contractor',
    label: 'Main Contractor',
    short: 'Contractor',
    note: 'Builds it. Raises submittals, RFIs and payment applications, and runs the site.',
  },
];

export const PARTY_IDS = PARTIES.map((p) => p.id);
const PARTY_BY = Object.fromEntries(PARTIES.map((p) => [p.id, p]));

export const isParty = (v) => PARTY_IDS.includes(String(v));
export const partyLabel = (id) => (PARTY_BY[id] ? PARTY_BY[id].label : String(id || ''));

// WHAT EACH PARTY RUNS, before anybody touches it.
//
// Modules already existed, but they were chosen once for the whole project —
// which is the wrong granularity the moment there is more than one company on
// it. Procurement and Subcontractors mean nothing to a consultant; payment
// certification means nothing to a contractor; budget and approvals are the
// developer's alone. So the set belongs to the party, and the project's own
// module list is the union of them, which is what every existing gate reads.
export const PARTY_MODULES = {
  // The Employer watches the money, the programme and the approvals. They do
  // not run a site, and handing them the site screens is how a developer's
  // login ends up full of things they will never open.
  developer:  ['dc', 'planning', 'commercial', 'finance', 'meetings', 'registers', 'reports'],
  // The Engineer reviews, inspects and certifies. No procurement, no
  // subcontractors, no bill of materials — none of that is theirs.
  consultant: ['dc', 'design', 'site', 'qaqc', 'commercial', 'meetings', 'registers',
               'reports', 'gate'],
  // Everything, including the read-only consultant window. That window is how
  // the Engineer is served on a project they are not themselves on, which is
  // every contractor project today — so it stays on by default, and a project
  // that later adds the Engineer as a real party simply stops needing it.
  // (Not the opt-in ones, such as bulk drawing loading: AETRAA switches those on per project.)
  contractor: DEFAULT_ON.slice(),
};

export function defaultModulesFor(party) {
  const want = PARTY_MODULES[party] || [];
  return MODULE_IDS.filter((id) => want.includes(id));
}

// Known module ids only, in catalogue order, no repeats.
export function cleanPartyModules(list) {
  if (!Array.isArray(list)) return null;
  const want = new Set(list.map(String));
  return MODULE_IDS.filter((id) => want.has(id));
}

/* ----------------------------------------------------------------- the table */

let ready = false;
export async function ensurePartiesTable(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS project_parties (
         project_id TEXT NOT NULL, party TEXT NOT NULL,
         company_name TEXT, contact_name TEXT, contact_email TEXT,
         org_id TEXT, is_self INTEGER DEFAULT 0, status TEXT,
         modules TEXT, source TEXT,
         added_at TEXT, changed_at TEXT,
         PRIMARY KEY (project_id, party))`
    ).run();
    ready = true;
    return true;
  } catch (e) { return false; }
}

const safeJson = (s, f) => {
  try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; }
};

function shape(r) {
  const mods = cleanPartyModules(safeJson(r.modules, null));
  return {
    party: r.party,
    label: partyLabel(r.party),
    company_name: r.company_name || '',
    contact_name: r.contact_name || '',
    contact_email: r.contact_email || '',
    org_id: r.org_id || null,
    is_self: !!Number(r.is_self),
    // planned  — ticked, nobody contacted yet (includes "to be appointed")
    // invited  — a contact exists and has been asked in
    // active   — they are using the project
    status: r.status || 'planned',
    modules: mods == null ? defaultModulesFor(r.party) : mods,
    source: r.source || '',
    appointed: !!(r.company_name && String(r.company_name).trim()),
  };
}

// The single contractor party that every pre-parties project implicitly is.
function legacyParty(project) {
  return shape({
    party: 'contractor',
    company_name: (project && (project.contractor_name || project.company)) || '',
    is_self: 1,
    status: 'active',
    modules: null,
    source: 'legacy',
  });
}

/* ------------------------------------------------------------------ reading */

export async function listParties(env, pid, project) {
  if (!(await ensurePartiesTable(env))) return [legacyParty(project)];
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM project_parties WHERE project_id = ?'
    ).bind(pid).all();
    const rows = (results || []).filter((r) => isParty(r.party)).map(shape);
    if (!rows.length) return [legacyParty(project)];
    // Catalogue order, so the screen always reads developer, consultant,
    // contractor — the order the contract names them in.
    return PARTY_IDS.map((id) => rows.find((r) => r.party === id)).filter(Boolean);
  } catch (e) { return [legacyParty(project)]; }
}

export async function partyIdsOf(env, pid, project) {
  return (await listParties(env, pid, project)).map((r) => r.party);
}

export async function selfPartyOf(env, pid, project) {
  const rows = await listParties(env, pid, project);
  const me = rows.find((r) => r.is_self);
  return me ? me.party : (rows[0] ? rows[0].party : 'contractor');
}

/* ------------------------------------------------------------------ writing */

// One party, created or changed. `is_self` is exclusive: setting it here clears
// it everywhere else on the project, because a project has exactly one owner.
export async function saveParty(env, pid, body, who) {
  if (!(await ensurePartiesTable(env))) return { error: 'parties are not available on this database' };
  body = body || {};
  const party = str(body.party, 20);
  if (!isParty(party)) return { error: 'which party? developer, consultant or contractor' };

  const email = str(body.contact_email, 160).toLowerCase();
  // A typo here is a party that can never be invited, and nothing later says so.
  if (email && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
    return { error: 'that does not look like an email address' };
  }

  const mods = cleanPartyModules(body.modules);
  const existing = await env.DB.prepare(
    'SELECT * FROM project_parties WHERE project_id = ? AND party = ?'
  ).bind(pid, party).first().catch(() => null);

  const company = str(body.company_name, 160);
  const contact = str(body.contact_name, 120);
  const status = ['planned', 'invited', 'active'].includes(str(body.status, 12))
    ? str(body.status, 12)
    : (email ? 'invited' : 'planned');

  if (existing) {
    await env.DB.prepare(
      `UPDATE project_parties SET company_name=?, contact_name=?, contact_email=?,
         status=?, modules=?, changed_at=? WHERE project_id=? AND party=?`
    ).bind(company || null, contact || null, email || null, status,
           JSON.stringify(mods == null ? shape(existing).modules : mods),
           nowISO(), pid, party).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO project_parties (project_id, party, company_name, contact_name,
         contact_email, org_id, is_self, status, modules, source, added_at, changed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(pid, party, company || null, contact || null, email || null,
           str(body.org_id, 60) || null, body.is_self ? 1 : 0, status,
           JSON.stringify(mods == null ? defaultModulesFor(party) : mods),
           str(body.source, 30) || null, nowISO(), nowISO()).run();
  }

  if (body.is_self) {
    await env.DB.prepare(
      'UPDATE project_parties SET is_self = 0 WHERE project_id = ? AND party <> ?'
    ).bind(pid, party).run().catch(() => {});
    await env.DB.prepare(
      'UPDATE project_parties SET is_self = 1 WHERE project_id = ? AND party = ?'
    ).bind(pid, party).run().catch(() => {});
  }

  await syncProjectModules(env, pid);
  return { ok: true, party, saved: true };
}

// The whole set in one call, which is what the parties screen sends: the ticked
// parties replace whatever was there. A party that is un-ticked is removed.
export async function setParties(env, pid, list, who) {
  if (!(await ensurePartiesTable(env))) return { error: 'parties are not available on this database' };
  const rows = Array.isArray(list) ? list.filter((r) => r && isParty(r.party)) : null;
  if (!rows || !rows.length) {
    return { error: 'A project has at least one party on it — tick the one your company is.' };
  }

  // EXACTLY ONE SELF. Without this the project has no owner, or two, and the
  // next screen has to guess whose roles to offer.
  const selves = rows.filter((r) => r.is_self);
  if (selves.length !== 1) {
    return { error: 'Mark exactly one party as your own organisation. It decides which roles, ' +
                    'dashboards and workflow steps you are offered.' };
  }

  const keep = rows.map((r) => r.party);
  const before = await listParties(env, pid);
  const dropped = before.filter((b) => !keep.includes(b.party));

  // A party is not un-ticked once its people are on the project. Removing it
  // would leave their records at steps nobody owns, and nothing on screen would
  // say why. This is checked by the caller, which knows about users; here we
  // only refuse dropping the self party, which is always wrong.
  if (dropped.some((d) => d.is_self) && !selves.length) {
    return { error: 'You cannot remove your own organisation from the project.' };
  }

  for (const r of rows) {
    const res = await saveParty(env, pid, r, who);
    if (res.error) return res;
  }
  for (const d of dropped) {
    await env.DB.prepare('DELETE FROM project_parties WHERE project_id = ? AND party = ?')
      .bind(pid, d.party).run().catch(() => {});
  }
  // saveParty synced after each row; one more after the deletes so the union is
  // right when a party has just been dropped.
  await syncProjectModules(env, pid);
  return { ok: true, parties: await listParties(env, pid) };
}

export async function setPartyModules(env, pid, party, list) {
  if (!isParty(party)) return { error: 'which party?' };
  if (!(await ensurePartiesTable(env))) return { error: 'parties are not available on this database' };
  const mods = cleanPartyModules(list);
  if (mods == null) return { error: 'send the modules as a list' };
  const row = await env.DB.prepare(
    'SELECT party FROM project_parties WHERE project_id = ? AND party = ?'
  ).bind(pid, party).first().catch(() => null);
  if (!row) return { error: partyLabel(party) + ' is not on this project' };
  await env.DB.prepare(
    'UPDATE project_parties SET modules = ?, changed_at = ? WHERE project_id = ? AND party = ?'
  ).bind(JSON.stringify(mods), nowISO(), pid, party).run();
  await syncProjectModules(env, pid);
  return { ok: true, party, modules: mods };
}

/* ------------------------------------------------------- the union

   Every gate in the platform already asks "is this module on for this project".
   Rather than teach all of them about parties, the project's own module list
   becomes the union of what its parties run. A module is on for the project
   while any party on it uses that module, which is exactly right: the Documents
   module is on because somebody files documents, and who sees what inside it is
   a question for the visibility rules, not for the module switch. */

export async function syncProjectModules(env, pid) {
  if (!(await ensurePartiesTable(env))) return null;
  const rows = await listParties(env, pid);
  const on = new Set();
  for (const r of rows) for (const m of r.modules) on.add(m);
  // An opt-in module AETRAA switched on (bulk loading) is the project's, not a
  // party's: it stays on when the parties change.
  const cur = (await getProjectModules(env, pid).catch(() => null)) || [];
  for (const m of OPT_IN) if (cur.includes(m)) on.add(m);
  const union = MODULE_IDS.filter((id) => on.has(id));
  if (!union.length) return null;            // never switch a project off entirely
  await setProjectModules(env, pid, union).catch(() => {});
  return union;
}

/* --------------------------------------------------------- what step 1 writes

   Creating a project records one party: the creator's own. The others are added
   on step 3, after the contract has been read, because the contract is what
   names them. */

// `modules` is what the project was created with, when anything was ticked at
// onboarding. It has to win over the party default: a project explicitly stood
// up with three modules must not silently gain the other seven because the
// contractor's usual set says so. Nothing ticked means the party default.
export async function seedSelfParty(env, pid, party, companyName, modules) {
  if (!isParty(party)) party = 'contractor';
  if (!(await ensurePartiesTable(env))) return false;
  const r = await saveParty(env, pid, {
    party,
    company_name: companyName || '',
    is_self: true,
    status: 'active',
    source: 'created',
    modules: Array.isArray(modules) && modules.length ? modules : undefined,
  });
  return !r.error;
}
