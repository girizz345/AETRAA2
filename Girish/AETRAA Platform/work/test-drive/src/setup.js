// The AETRAA Admin project-onboarding backend.
//
// One call stands a new client up: create the Company (tenant), create the
// Project under it with its contract commercial terms, and assign the Principal.
// Everything the AETRAA Admin does at onboarding flows through here. BOQ, BOM,
// authorities, logos and templates are loaded in later steps against the project
// this returns.

import { createOrg, saveUser } from './org.js';
import { setProjectModules } from './modules.js';
import { seedSelfParty, isParty } from './parties.js';

const nowISO = () => new Date().toISOString();
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const dateOnly = (v) => { const s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };

// Unique project id derived from the name (maj, maj2, …).
async function uniquePid(env, wanted) {
  let id = slug(wanted) || 'p';
  if (!(await env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(id).first())) return id;
  let n = 2;
  while (await env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(id + n).first()) n++;
  return id + n;
}

// Create the project row with its contract terms, under a company.
export async function createProjectForCompany(env, oid, p) {
  if (!p || !str(p.name)) return { error: 'a project needs a name' };
  const pid = await uniquePid(env, p.id || p.name);
  await env.DB.prepare(
    `INSERT INTO projects
       (id, org_id, name, ref, client_name, location, engineer_name, contractor_name,
        contract_completion, currency, retention_pct, retention_limit_pct, advance_pct,
        payment_days, notice_clause, reply_days, setup_state, sort_order, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
             (SELECT COALESCE(MAX(sort_order),0)+1 FROM projects),?)`
  ).bind(
    pid, oid, str(p.name), str(p.ref), str(p.client_name), str(p.location),
    str(p.engineer_name || p.consultant_name), str(p.contractor_name),
    dateOnly(p.contract_completion), str(p.currency || 'AED', 8),
    num(p.retention_pct), num(p.retention_limit_pct), num(p.advance_pct),
    num(p.payment_days), str(p.notice_clause, 80), num(p.reply_days),
    str(p.setup_state || 'live', 12), nowISO()
  ).run();
  // The modules ticked at onboarding. None sent = everything, as before.
  if (Array.isArray(p.modules)) {
    const m = await setProjectModules(env, pid, p.modules);
    if (m.error) return { error: m.error };
    return { ok: true, id: pid, modules: m.modules };
  }
  return { ok: true, id: pid };
}

// The whole onboarding in one call: company (new or existing) + project + principal.
export async function onboardProject(env, body, sha256) {
  body = body || {};

  // 1. Company (tenant) — reuse an existing one, or create it.
  let oid = body.company_id || (body.company && body.company.id) || null;
  let companyCreated = false;
  if (!oid) {
    if (!body.company || !str(body.company.name)) return { error: 'a company name is required' };
    const c = await createOrg(env, body.company);
    if (c.error) return c;
    oid = c.id; companyCreated = true;
  }

  // 2. Project with contract terms.
  const proj = await createProjectForCompany(env, oid, body.project || {});
  if (proj.error) return { error: proj.error, company_id: oid, company_created: companyCreated };
  const pid = proj.id;

  /* 2b. WHICH SIDE THIS COMPANY IS ON.
   *
   * The one question the form could not avoid asking, because nothing else
   * answers it: a contractor, a consultant and a developer see different roles,
   * different dashboards and different halves of every workflow route. Left
   * unsaid it defaults to contractor, which is what every project created
   * before this question existed is.
   *
   * The other parties are not recorded here. They are named in the contract,
   * and step 3 confirms them against it rather than asking anyone to type them
   * from memory. */
  const selfParty = isParty(body.self_party) ? String(body.self_party) : 'contractor';
  await seedSelfParty(env, pid, selfParty,
    (body.company && body.company.name) || body.company_name || '',
    Array.isArray(body.project && body.project.modules) ? body.project.modules : null
  ).catch(() => false);

  // 3. Principal (the client's top person) — assigned to this project.
  let principal = null;
  if (body.principal && str(body.principal.email)) {
    const r = await saveUser(env, oid, {
      name: str(body.principal.name) || 'Principal',
      email: str(body.principal.email, 160),
      functions: ['principal'],
      projects: [pid],
    }, sha256);
    if (r.error) {
      /* NOTHING HALF-BUILT IS LEFT BEHIND.
       *
       * The project was created a moment ago and the Principal has just been
       * refused. Returning the error with the project id meant the screen said
       * "could not create" while a nameless draft sat in the list with nobody
       * on it — and the operator, seeing no new project on screen, tried again
       * and made a second one. So it is undone. */
      await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(pid).run().catch(() => {});
      return { error: 'principal: ' + r.error, company_id: oid };
    }
    principal = { id: r.id, email: str(body.principal.email, 160) };
  }

  return { ok: true, company_id: oid, company_created: companyCreated, project_id: pid, principal,
           self_party: selfParty, modules: proj.modules || null };
}

/* ------------------------------------------------------------------ branding
 *
 * The marks printed on diary sheets, reports and consultant documents. Each is
 * a data: URL image, kept small enough to sit in a row. Only the fields sent are
 * touched; sending null clears one.
 */
export const LOGO_FIELDS = ['logo_client', 'logo_consultant', 'logo_consultant2', 'logo_contractor'];
const LOGO_MAX = 400000;   // characters of data: URL (~290 KB of image)

function checkLogo(v) {
  if (v === null || v === '') return { value: null };
  const s = String(v);
  if (!/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(s)) return { error: 'a logo must be an uploaded image (PNG, JPG, GIF, WebP or SVG)' };
  if (s.length > LOGO_MAX) return { error: 'that image is too large — keep logos under about 290 KB' };
  return { value: s };
}

export async function setBranding(env, pid, body) {
  pid = str(pid, 60);
  if (!pid) return { error: 'which project?' };
  const exists = await env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(pid).first();
  if (!exists) return { error: 'no such project' };
  body = body || {};
  const sets = [], args = [];
  for (const f of LOGO_FIELDS) {
    if (!(f in body)) continue;
    const c = checkLogo(body[f]);
    if (c.error) return { error: f.replace('logo_', '') + ' logo: ' + c.error };
    sets.push(f + ' = ?'); args.push(c.value);
  }
  if (!sets.length) return { error: 'no logo sent' };
  await env.DB.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).bind(...args, pid).run();
  return { ok: true, saved: sets.length };
}

export async function setCompanyLogo(env, oid, logo) {
  oid = str(oid, 60);
  if (!oid) return { error: 'which company?' };
  const exists = await env.DB.prepare('SELECT id FROM orgs WHERE id = ?').bind(oid).first();
  if (!exists) return { error: 'no such company' };
  const c = checkLogo(logo);
  if (c.error) return { error: c.error };
  await env.DB.prepare('UPDATE orgs SET logo = ? WHERE id = ?').bind(c.value, oid).run();
  return c.value === null ? { ok: true, cleared: true } : { ok: true };
}
