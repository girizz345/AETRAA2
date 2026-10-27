// TEST DRIVE — every role, for real, on a copy that is thrown away.
//
// The handover checks open each dashboard read-only. That proves a screen
// looks right; it does not prove the job works. Whether the PM can prepare a
// letter, Document Control can issue it, and the consultant's reply lands where
// it should is only known by doing it.
//
// Doing it on the real project would leave test letters, test RFIs and a test
// payment certificate in the client's registers, numbered, in the audit trail,
// on the day it goes live. So the test runs on a COPY:
//
//   START   copies every row of this project (programme, BOQ, BOM, drawings,
//           documents, registers, roles, workflow, templates, settings) into a
//           new project, "<id>--test", and puts one test person in each role
//           on it. Their addresses end in .invalid, which can never receive
//           mail, and the copy has every scheduled report switched off.
//   USE     the AETRAA Admin switches between those people from one window,
//           a tab per role. Everything they do is real — numbered, routed,
//           signed — and lands on the copy only.
//   END     deletes the copy and its people outright. Go-live does it too,
//           so a project never goes live with its test run still beside it.
//
// The real project is never written to by any of this. Files in object storage
// are SHARED between the project and its copy (copying a drawing set would
// double the bill for nothing), so while a copy exists those storage keys are
// held: deleting a document on the copy removes the copy's row and leaves the
// file, which still belongs to the real project.

const SUFFIX = '--test';
const DOMAIN = '.test-drive.invalid';
const nowISO = () => new Date().toISOString();
const q = (name) => '"' + String(name).replace(/"/g, '""') + '"';

export const testIdFor = (pid) => String(pid) + SUFFIX;
export const isTestProject = (pid) => String(pid || '').endsWith(SUFFIX);
export const realIdOf = (pid) => isTestProject(pid) ? String(pid).slice(0, -SUFFIX.length) : String(pid || '');
export const isPersona = (user) => !!(user && /\.test-drive\.invalid$/i.test(String(user.email || '')));

// Tables that belong to the copy's own life, not to the project being copied.
// access_codes would let the real project's shared codes into the copy;
// notifications and audit are the real project's history, not its data.
const NOT_COPIED = new Set(['audit', 'notifications', 'access_codes', 'sign_in_codes',
  'testdrive', 'testdrive_keys', 'projects', 'users', 'orgs', 'meta', 'files']);

// Roles offered when nobody is on the project yet.
const CORE = ['principal', 'pm', 'planning', 'site', 'design', 'dc', 'qaqc', 'hse',
  'commercial', 'procurement', 'finance', 'consultant'];

export async function ensureTestTables(env) {
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS testdrive (
      project_id TEXT PRIMARY KEY, test_id TEXT NOT NULL, started_at TEXT, started_by TEXT,
      personas TEXT, rows_copied INTEGER)`).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS testdrive_keys (
      key TEXT PRIMARY KEY, test_id TEXT NOT NULL)`).run();
    return true;
  } catch (e) { return false; }
}

/* ------------------------------------------------ what the database holds */

// Asked in the PostgreSQL spelling first: on PostgreSQL a failed statement is
// not free, and SQLite simply refuses a function it does not know.
let DIALECT = null;
async function dialect(env) {
  if (DIALECT) return DIALECT;
  try { await env.DB.prepare(`SELECT current_schema() AS s`).first(); DIALECT = 'pg'; }
  catch (e) { DIALECT = 'sqlite'; }
  return DIALECT;
}

async function tableNames(env) {
  if (await dialect(env) === 'sqlite') {
    const { results } = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all();
    return new Set((results || []).map((r) => r.name));
  }
  const { results } = await env.DB.prepare(
    `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema()`).all();
  return new Set((results || []).map((r) => r.name));
}

// Every table with a project_id column, with its columns and primary key.
async function projectTables(env) {
  const kind = await dialect(env);
  const out = [];
  if (kind === 'sqlite') {
    const { results } = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all();
    for (const { name } of results || []) {
      if (NOT_COPIED.has(name) || name.startsWith('sqlite_')) continue;
      const { results: cols } = await env.DB.prepare(`PRAGMA table_info(${q(name)})`).all();
      if (!(cols || []).some((c) => c.name === 'project_id')) continue;
      const pk = cols.filter((c) => Number(c.pk) > 0).sort((a, b) => a.pk - b.pk);
      out.push({ name, cols: cols.map((c) => c.name), pk: pk.map((c) => c.name),
        intPk: pk.length === 1 && /INT/i.test(pk[0].type || '') });
    }
    return out;
  }
  const { results: cols } = await env.DB.prepare(
    `SELECT table_name, column_name, data_type FROM information_schema.columns
      WHERE table_schema = current_schema() ORDER BY table_name, ordinal_position`).all();
  const { results: pks } = await env.DB.prepare(
    `SELECT kcu.table_name, kcu.column_name, kcu.ordinal_position
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = current_schema()`).all();
  const by = {};
  for (const c of cols || []) (by[c.table_name] = by[c.table_name] || []).push(c);
  for (const [name, list] of Object.entries(by)) {
    if (NOT_COPIED.has(name) || !list.some((c) => c.column_name === 'project_id')) continue;
    const pk = (pks || []).filter((k) => k.table_name === name)
      .sort((a, b) => Number(a.ordinal_position) - Number(b.ordinal_position)).map((k) => k.column_name);
    const pkType = pk.length === 1 ? (list.find((c) => c.column_name === pk[0]) || {}).data_type : '';
    out.push({ name, cols: list.map((c) => c.column_name), pk, intPk: /int/i.test(pkType || '') });
  }
  return out;
}

async function insertRow(env, table, row, returning) {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${q(table)} (${keys.map(q).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})` +
    (returning ? ` RETURNING ${q(returning)}` : '');
  const st = env.DB.prepare(sql).bind(...keys.map((k) => row[k]));
  return returning ? await st.first(returning) : await st.run();
}

/* ------------------------------------------------------------- the state */

export async function testState(env, pid) {
  await ensureTestTables(env);
  const row = await env.DB.prepare(`SELECT * FROM testdrive WHERE project_id = ?`).bind(realIdOf(pid)).first().catch(() => null);
  if (!row) return { running: false };
  let personas = [];
  try { personas = JSON.parse(row.personas || '[]'); } catch (e) { personas = []; }
  // What the test run has done so far, read off the copy's own audit trail.
  const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM audit WHERE project_id = ?`).bind(row.test_id).first().catch(() => null);
  return { running: true, test_id: row.test_id, started_at: row.started_at, started_by: row.started_by,
    rows_copied: Number(row.rows_copied || 0), personas, actions: Number((n && n.n) || 0) };
}

// Held while a copy exists: deleting the copy's document must not delete the
// real project's file.
export async function isHeldKey(env, key) {
  if (!key) return false;
  try {
    const r = await env.DB.prepare(`SELECT 1 AS x FROM testdrive_keys WHERE key = ?`).bind(String(key)).first();
    return !!r;
  } catch (e) { return false; }
}

/* ------------------------------------------------------------- start */

export async function startTest(env, pid, who, helpers) {
  const { getProject, listRoles, teamFunctions, legacyRole, uid } = helpers;
  if (isTestProject(pid)) return { error: 'that is already a test copy' };
  await ensureTestTables(env);
  const proj = await getProject(env, pid);
  if (!proj) return { error: 'no such project' };
  const existing = await testState(env, pid);
  if (existing.running) return { ok: true, already: true, ...existing };

  const tid = testIdFor(pid);
  // A half-made copy from a run that failed part-way is cleared first.
  await dropCopy(env, tid);

  // The project row: same settings, its own name, nothing scheduled, no codes.
  const prow = { ...proj };
  for (const k of Object.keys(prow)) if (prow[k] === undefined) delete prow[k];
  Object.assign(prow, {
    id: tid, name: 'TEST — ' + (proj.name || pid), report_emails: null,
    report_daily: 0, report_weekly: 0, report_monthly: 0, report_digest: 0,
    manager_code_hash: null, site_code_hash: null, view_code_hash: null,
    archived: 0, sort_order: 99999, created_at: nowISO(),
  });
  // Only the columns the projects table really has (getProject may add derived ones).
  const pcols = await columnsOf(env, 'projects');
  for (const k of Object.keys(prow)) if (!pcols.includes(k)) delete prow[k];
  await insertRow(env, 'projects', prow);

  const tables = await projectTables(env);
  const idMap = {};                       // table -> { oldId: newId }
  const keys = new Set();
  let copied = 0;
  const single = tables.filter((t) => t.pk.length === 1 && t.pk[0] !== 'project_id');
  const rest = tables.filter((t) => !single.includes(t));

  const remap = (t, row) => {
    const out = { ...row, project_id: tid };
    for (const [col, val] of Object.entries(row)) {
      if (val == null) continue;
      if (/(^|_)key$/i.test(col) && typeof val === 'string' && val) keys.add(val);
      const m = /^(.*)_id$/.exec(col);
      if (!m || col === 'project_id') continue;
      const target = idMap[m[1] + 's'] || idMap[m[1]];
      if (target && target[String(val)] !== undefined) out[col] = target[String(val)];
    }
    return out;
  };

  for (const t of single.concat(rest)) {
    const { results } = await env.DB.prepare(`SELECT * FROM ${q(t.name)} WHERE project_id = ?`).bind(pid).all().catch(() => ({ results: [] }));
    if (!results || !results.length) continue;
    const map = idMap[t.name] = {};
    for (const r of results) {
      const row = remap(t, r);
      if (single.includes(t)) {
        const k = t.pk[0];
        if (t.intPk) {
          const old = row[k]; delete row[k];
          const id = await insertRow(env, t.name, row, k);
          map[String(old)] = id;
        } else {
          const nid = String(r[k]) + '~t';
          map[String(r[k])] = nid;
          row[k] = nid;
          await insertRow(env, t.name, row);
        }
      } else {
        await insertRow(env, t.name, row);
      }
      copied++;
    }
  }
  for (const k of keys) {
    try { await env.DB.prepare(`INSERT INTO testdrive_keys (key, test_id) VALUES (?, ?)`).bind(k, tid).run(); } catch (e) { /* already held */ }
  }

  // One test person per role.
  const roles = await listRoles(env, tid, {});
  const held = new Set(await teamFunctions(env, proj.org_id, pid));
  for (const f of ['principal', 'pm']) held.add(f);
  let pick = roles.filter((r) => held.has(r.id));
  if (pick.length <= 2) pick = roles.filter((r) => CORE.includes(r.id));
  const personas = [];
  for (const r of pick) {
    const id = 'usr_td_' + uid();
    const email = r.id + '@' + pid.replace(/[^a-z0-9-]/gi, '-').toLowerCase() + DOMAIN;
    await insertRow(env, 'users', {
      id, org_id: proj.org_id, name: 'TEST · ' + r.label, email, phone: null,
      role: legacyRole([r.id]), functions: JSON.stringify([r.id]), status: 'active',
      scope_groups: '[]', scope_trades: '[]', project_ids: JSON.stringify([tid]),
      invite_hash: null, invited_by: 'test drive', created_at: nowISO(),
    });
    personas.push({ role: r.id, label: r.label, user_id: id });
  }

  await env.DB.prepare(`INSERT INTO testdrive (project_id, test_id, started_at, started_by, personas, rows_copied)
    VALUES (?, ?, ?, ?, ?, ?)`).bind(pid, tid, nowISO(), String((who && who.name) || 'AETRAA Admin'),
    JSON.stringify(personas), copied).run();
  return { ok: true, ...(await testState(env, pid)) };
}

async function columnsOf(env, table) {
  if (await dialect(env) === 'sqlite') {
    const { results } = await env.DB.prepare(`PRAGMA table_info(${q(table)})`).all();
    return (results || []).map((c) => c.name);
  }
  const { results } = await env.DB.prepare(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?`).bind(table).all();
  return (results || []).map((c) => c.column_name);
}

/* ------------------------------------------------------------- end */

// Everything the copy holds, and its people. The real project is not touched:
// every statement here names the copy's id, which ends in "--test".
async function dropCopy(env, tid) {
  if (!isTestProject(tid)) throw new Error('refusing to delete a project that is not a test copy: ' + tid);
  let removed = 0;
  for (const t of await projectTables(env)) {
    const r = await env.DB.prepare(`DELETE FROM ${q(t.name)} WHERE project_id = ?`).bind(tid).run();
    removed += Number((r && r.meta && r.meta.changes) || 0);
  }
  const have = await tableNames(env);
  for (const t of ['audit', 'notifications', 'access_codes']) {
    if (have.has(t)) await env.DB.prepare(`DELETE FROM ${q(t)} WHERE project_id = ?`).bind(tid).run();
  }
  const people = await env.DB.prepare(`SELECT id FROM users WHERE email LIKE ? AND project_ids LIKE ?`)
    .bind('%' + DOMAIN, '%' + tid + '%').all().catch(() => ({ results: [] }));
  for (const u of people.results || []) {
    for (const t of ['sign_in_codes', 'notifications']) {
      if (have.has(t)) await env.DB.prepare(`DELETE FROM ${q(t)} WHERE user_id = ?`).bind(u.id).run();
    }
    await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(u.id).run();
  }
  await env.DB.prepare(`DELETE FROM projects WHERE id = ?`).bind(tid).run();
  await env.DB.prepare(`DELETE FROM testdrive_keys WHERE test_id = ?`).bind(tid).run();
  return { removed, people: (people.results || []).length };
}

export async function endTest(env, pid) {
  await ensureTestTables(env);
  const real = realIdOf(pid);
  const st = await testState(env, real);
  const tid = st.test_id || testIdFor(real);
  const r = await dropCopy(env, tid);
  await env.DB.prepare(`DELETE FROM testdrive WHERE project_id = ?`).bind(real).run().catch(() => null);
  return { ok: true, was_running: st.running, actions: st.actions || 0, ...r };
}
