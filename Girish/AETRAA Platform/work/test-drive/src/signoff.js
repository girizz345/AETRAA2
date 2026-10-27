// SEEING IT THE WAY THEY WILL SEE IT, BEFORE HANDING IT OVER.
//
// Go-live used to be gated on a list of gaps: is there a BOQ, is there a
// programme, are the logos set. Every one of those is a count, and a count
// tells you a thing exists — not that it is right, and not that the screen the
// client actually opens is worth opening.
//
// The operator put it plainly: the admin should see the real dashboard of each
// function assigned, and verify it, before going live. Nothing on the platform
// could do that. The application boots from whoever signed in, and there was no
// way to look at it as anybody else — not for AETRAA, not for the Principal. So
// the first person ever to see the QA/QC dashboard of a real project was the
// QA/QC engineer, on day one, after handover.
//
// WHAT IS CHECKED, AND WHAT IS NOT. Only the dashboards somebody on this
// project actually reaches. Signing off Finance on a job with no Finance role
// held is a tick with nothing behind it, and a checklist with filler in it
// stops being read. The list therefore comes from the people who are really on
// the project and the roles they really hold.
//
// A SIGN-OFF IS A PERSON AND A TIME, and it is undone by any change that could
// have altered what that dashboard shows. Documents loaded after a sign-off
// mean the screen that was checked is not the screen being handed over, so the
// sign-off lapses and is taken again. A tick that survives the thing it was
// ticking is worse than no tick, because it is believed.

import { ALLDASH, DASH_LABEL } from './functions.js';
import { listRoles } from './roles-store.js';

const nowISO = () => new Date().toISOString();
const str = (v, n = 300) => String(v == null ? '' : v).trim().slice(0, n);

let ready = false;
export async function ensureSignoffTable(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS project_signoff (
         project_id TEXT NOT NULL, dash TEXT NOT NULL,
         signed_by TEXT, signed_at TEXT, note TEXT, as_role TEXT,
         PRIMARY KEY (project_id, dash))`
    ).run();
    ready = true;
    return true;
  } catch (e) { return false; }
}

/* ------------------------------------------------- which screens to check */

// Every dashboard somebody on this project OWNS, with the role to look as.
//
// Two rules keep this list to the screens that matter, and both were learnt the
// hard way by building it without them:
//
//   ONLY THE SCREENS A ROLE CAN ACT IN. A role that can merely read a dashboard
//   sees a subset of what its owner sees, so checking the owner's view covers
//   it. Counting read access would have put all fourteen on the list for a
//   project with one Document Controller, who can read everything.
//
//   AN OVERSIGHT ROLE CONTRIBUTES ONLY ITS OWN SCREEN. The Principal, the
//   Project Director and the PM hold every dashboard at full. Left alone, the
//   moment a project has a Principal — which is always — the checklist became
//   all fourteen screens, every one of them "as Principal", including Finance
//   on a job with nobody in Finance. That is the filler that stops a checklist
//   being read, and it is exactly what this screen was built to replace.
//
// So a screen is on the list because somebody whose job it is will open it.
const BROAD = 4;            // more full dashboards than this and the role is oversight

function ownDash(role) {
  const full = (role.dash || []).filter((e) => e[1] === 'full').map((e) => e[0]);
  if (full.length <= BROAD) return full.filter((d) => ALLDASH.includes(d));
  // An oversight role's own screen: the one named after it, or failing that the
  // first it holds.
  if (ALLDASH.includes(role.id)) return [role.id];
  return full.filter((d) => ALLDASH.includes(d)).slice(0, 1);
}

export async function verifyList(env, pid, people) {
  const roles = await listRoles(env, pid, { all: true });
  const byId = {};
  for (const r of roles) byId[r.id] = r;

  const held = {};                       // roleId -> [names]
  for (const u of people || []) {
    for (const f of (u.functions || [])) (held[f] = held[f] || []).push(u.name || u.email);
  }

  const want = {};                       // dash -> { as, who }
  for (const roleId of Object.keys(held)) {
    const r = byId[roleId];
    if (!r) continue;
    const broad = (r.dash || []).filter((e) => e[1] === 'full').length > BROAD;
    for (const d of ownDash(r)) {
      const cur = want[d];
      // A narrow role beats a broad one as the role to look as: the QA/QC
      // screen is checked as QA/QC, not as the Principal who also holds it.
      if (!cur) {
        want[d] = { dash: d, level: 'full', as: roleId, as_label: r.label, broad, who: held[roleId].slice() };
      } else {
        if (cur.broad && !broad) { cur.as = roleId; cur.as_label = r.label; cur.broad = false; }
        for (const n of held[roleId]) if (!cur.who.includes(n)) cur.who.push(n);
      }
    }
  }

  return ALLDASH.filter((d) => want[d]).map((d) => ({
    dash: want[d].dash, level: want[d].level, as: want[d].as, as_label: want[d].as_label,
    who: want[d].who, label: DASH_LABEL[d] || d,
  }));
}

/* ------------------------------------------------------- the sign-offs */

export async function listSignoffs(env, pid) {
  if (!(await ensureSignoffTable(env))) return {};
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM project_signoff WHERE project_id = ?').bind(pid).all();
    const out = {};
    for (const r of results || []) {
      out[r.dash] = { by: r.signed_by || '', at: r.signed_at || '', note: r.note || '', as: r.as_role || '' };
    }
    return out;
  } catch (e) { return {}; }
}

export async function sign(env, pid, dash, asRole, who, note) {
  if (!(await ensureSignoffTable(env))) return { error: 'sign-off is not available on this database' };
  if (!ALLDASH.includes(String(dash))) return { error: 'no such dashboard' };
  await env.DB.prepare(
    `INSERT INTO project_signoff (project_id, dash, signed_by, signed_at, note, as_role)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(project_id, dash) DO UPDATE SET signed_by = excluded.signed_by,
       signed_at = excluded.signed_at, note = excluded.note, as_role = excluded.as_role`
  ).bind(pid, String(dash), (who && who.name) || 'AETRAA', nowISO(),
         str(note) || null, str(asRole, 40) || null).run();
  return { ok: true, dash: String(dash) };
}

export async function unsign(env, pid, dash) {
  if (!(await ensureSignoffTable(env))) return { error: 'sign-off is not available on this database' };
  await env.DB.prepare('DELETE FROM project_signoff WHERE project_id = ? AND dash = ?')
    .bind(pid, String(dash)).run();
  return { ok: true, dash: String(dash) };
}

// EVERYTHING LAPSES when what the screens show has changed underneath them.
// Called after documents are loaded, cleared or moved. Cheap, and the cost of
// not doing it is a tick that is believed and wrong.
export async function lapseAll(env, pid, why) {
  if (!(await ensureSignoffTable(env))) return { ok: true, lapsed: 0 };
  try {
    const before = Object.keys(await listSignoffs(env, pid)).length;
    if (!before) return { ok: true, lapsed: 0 };
    await env.DB.prepare('DELETE FROM project_signoff WHERE project_id = ?').bind(pid).run();
    return { ok: true, lapsed: before, why: why || '' };
  } catch (e) { return { ok: true, lapsed: 0 }; }
}

/* --------------------------------------------------------- the whole answer */

// What the verify screen and the go-live gate both read.
export async function verifyState(env, pid, people) {
  const list = await verifyList(env, pid, people);
  const signed = await listSignoffs(env, pid);
  const rows = list.map((d) => ({ ...d, signed: signed[d.dash] || null }));
  const done = rows.filter((r) => r.signed).length;
  return {
    rows,
    total: rows.length,
    done,
    ready: rows.length > 0 && done === rows.length,
    // A project with nobody on it has nothing to check, and that is not the
    // same as everything being checked. Said separately so the gate cannot
    // read an empty list as a pass.
    nobody: rows.length === 0,
  };
}
