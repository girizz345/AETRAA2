// AETRAA Admin project onboarding — Company + Project (terms) + Principal.
//
//   node tools/test-setup.mjs
//
// Runs against the real schema in an in-memory SQLite, shimmed to D1's shape.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { onboardProject, createProjectForCompany, setBranding, setCompanyLogo } from '../src/setup.js';
import { getOrg, listUsers, findUserByEmail } from '../src/org.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const DB = {
  prepare(sql) {
    const st = db.prepare(sql); let args = [];
    const api = {
      bind(...a) { args = a; return api; },
      async all() { return { results: st.all(...args) }; },
      async first() { return st.get(...args) ?? null; },
      async run() { st.run(...args); return { success: true }; },
    };
    return api;
  },
};
const env = { DB };
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail && !cond ? '  — ' + detail : ''));
  if (!cond) fails++;
}

// ---- onboard a brand-new client ----------------------------------------
const res = await onboardProject(env, {
  company: { name: 'NAF Contracting LLC', country: 'AE' },
  project: {
    name: 'G+3P+4+R — Plot 6457759', ref: 'DIA-R-0270', client_name: 'Dubai Islands Dev',
    location: 'Dubai', consultant_name: 'DEC', contractor_name: 'NAF Contracting',
    contract_completion: '2026-11-08', currency: 'AED',
    retention_pct: 10, retention_limit_pct: 5, advance_pct: 10, payment_days: 56,
    notice_clause: 'Sub-Clause 20.2.1', reply_days: 7,
  },
  principal: { name: 'M. Al Nuaimi', email: 'principal@naf.ae' },
}, sha256);

check('onboard ok', res.ok === true, JSON.stringify(res));
check('company created', res.company_created === true);
check('company id returned', !!res.company_id);
check('project id returned', !!res.project_id);
check('principal created', !!(res.principal && res.principal.id));

// ---- the company exists -------------------------------------------------
const org = await getOrg(env, res.company_id);
check('company row present', org && org.name === 'NAF Contracting LLC');
check('company country AE', org && org.country === 'AE');

// ---- the project carries its contract terms ----------------------------
const proj = await DB.prepare('SELECT * FROM projects WHERE id = ?').bind(res.project_id).first();
check('project name', proj && proj.name === 'G+3P+4+R — Plot 6457759');
check('project under company', proj && proj.org_id === res.company_id);
check('retention 10%', proj && proj.retention_pct === 10);
check('retention cap 5%', proj && proj.retention_limit_pct === 5);
check('payment 56 days', proj && proj.payment_days === 56);
check('currency AED', proj && proj.currency === 'AED');
check('client stored', proj && proj.client_name === 'Dubai Islands Dev');
check('consultant stored', proj && proj.engineer_name === 'DEC');
check('goes live immediately', proj && proj.setup_state === 'live');

// ---- the principal is a real user with the principal function ----------
const princ = await findUserByEmail(env, 'principal@naf.ae');
check('principal by email', princ && princ.name === 'M. Al Nuaimi');
check('principal function set', princ && JSON.parse(princ.functions || '[]').includes('principal'));
check('principal role derived owner', princ && princ.role === 'owner');
check('principal on the project', princ && JSON.parse(princ.project_ids || '[]').includes(res.project_id));
check('principal in same company', princ && princ.org_id === res.company_id);

// ---- a second project under the SAME company (existing company_id) ------
const res2 = await onboardProject(env, {
  company_id: res.company_id,
  project: { name: 'Commercial Tower', currency: 'AED', retention_pct: 10, payment_days: 56 },
  principal: { name: 'M. Al Nuaimi', email: 'principal@naf.ae2' },
}, sha256);
check('second project ok', res2.ok === true, JSON.stringify(res2));
check('reused company (not created)', res2.company_created === false);
check('two projects for company', (await DB.prepare('SELECT COUNT(*) AS n FROM projects WHERE org_id = ?').bind(res.company_id).first()).n === 2);

// ---- guards -------------------------------------------------------------
const bad1 = await onboardProject(env, { project: { name: 'X' } }, sha256);
check('rejects missing company', !!bad1.error);
const bad2 = await onboardProject(env, { company: { name: 'Y Co' }, project: {} }, sha256);
check('rejects missing project name', !!bad2.error);

// ---- branding -----------------------------------------------------------
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
const b1 = await setBranding(env, res.project_id, { logo_client: PNG, logo_contractor: PNG });
check('branding saved', b1.ok === true, JSON.stringify(b1));
check('two logos saved', b1.saved === 2);
const withLogos = await DB.prepare('SELECT * FROM projects WHERE id = ?').bind(res.project_id).first();
check('client logo stored', withLogos.logo_client === PNG);
check('contractor logo stored', withLogos.logo_contractor === PNG);
check('untouched logo stays null', withLogos.logo_consultant === null);

// only the fields sent are touched
await setBranding(env, res.project_id, { logo_consultant: PNG });
const after2 = await DB.prepare('SELECT * FROM projects WHERE id = ?').bind(res.project_id).first();
check('consultant added', after2.logo_consultant === PNG);
check('client logo untouched by second save', after2.logo_client === PNG);

// clearing
await setBranding(env, res.project_id, { logo_contractor: null });
const after3 = await DB.prepare('SELECT * FROM projects WHERE id = ?').bind(res.project_id).first();
check('logo cleared', after3.logo_contractor === null);

// refusals
check('refuses a non-image', !!(await setBranding(env, res.project_id, { logo_client: 'https://x/y.png' })).error);
check('refuses an oversized image', !!(await setBranding(env, res.project_id, { logo_client: 'data:image/png;base64,' + 'A'.repeat(400001) })).error);
check('refuses unknown project', !!(await setBranding(env, '', { logo_client: PNG })).error);
check('refuses empty payload', !!(await setBranding(env, res.project_id, {})).error);

// company logo
check('company logo saved', (await setCompanyLogo(env, res.company_id, PNG)).ok === true);
check('company logo stored', (await getOrg(env, res.company_id)).logo === PNG);
check('company logo cleared', (await setCompanyLogo(env, res.company_id, null)).cleared === true);
check('company logo refuses non-image', !!(await setCompanyLogo(env, res.company_id, 'nope')).error);

console.log(fails ? ('\\n' + fails + ' FAILED') : '\\nall passed');
process.exit(fails ? 1 : 0);
