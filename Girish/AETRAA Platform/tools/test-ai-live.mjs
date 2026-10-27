// AI DRAFTING, THROUGH THE REAL WORKER, AGAINST A FAKE MODEL.
//
// Proves the first capability end to end: a PM asks for a report narrative, the
// worker gathers this project's real figures, sends them to the model, and hands
// back a draft — and that it is OFF, cleanly, when no model is configured.
// The model is faked so the test needs no key and no network; what is real is
// the worker, the routing, the permission check and the fact-gathering.
//
//   node tools/test-ai-live.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'esbuild';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };

// a fake model that echoes back the facts it was given, so the test can prove
// the RIGHT figures reached it
let modelSaw = null;
const model = createServer(async (req, res) => {
  const c = []; for await (const x of req) c.push(x);
  modelSaw = JSON.parse(Buffer.concat(c) || '{}');
  const userMsg = (modelSaw.messages || []).map((m) => m.content).join('\n');
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    model: modelSaw.model,
    content: [{ type: 'text', text: 'The works stand behind programme. ' +
      (/DEWA|substation|delay/i.test(userMsg) ? 'The DEWA substation remains the critical constraint. ' : '') +
      'This draft was written from the figures supplied.' }],
    usage: { input_tokens: 200, output_tokens: 60 },
  }));
});
await new Promise((ok) => model.listen(0, ok));
const modelUrl = 'http://127.0.0.1:' + model.address().port;

await build({
  entryPoints: [new URL('../src/index.js', import.meta.url).pathname],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: '/tmp/ai-live-worker.mjs', logLevel: 'silent',
});
const worker = (await import('/tmp/ai-live-worker.mjs')).default;
const ctx = { waitUntil() {}, passThroughOnException() {} };

function freshEnv(withModel) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql) => { const st = db.prepare(sql); let a = [];
    const api = { bind(...x) { a = x; return api; },
      async all() { return { results: st.all(...a), success: true }; },
      async first(c) { const r = st.get(...a) ?? null; return c && r ? r[c] : r; },
      async run() { st.run(...a); return { success: true, meta: {} }; },
      async raw() { return st.all(...a).map((r) => Object.values(r)); } };
    return api; };
  const env = { DB: { prepare: stmt, async batch(l) { const o = []; for (const s of l) o.push(await s.run()); return o; },
      async exec(s) { db.exec(s); return { count: 1 }; } },
    OWNER_CODE: 'MASTERCODE', LOGIN_TEST_CODE: '246810', SESSION_SECRET: 'ai-live' };
  if (withModel) { env.ANTHROPIC_API_KEY = 'k'; env.AI_BASE_URL = modelUrl; env.AI_PROVIDER = 'anthropic'; env.AI_MODEL = 'claude-sonnet-4-5'; }
  return env;
}

async function seed(env) {
  let cookie = '';
  const call = async (path, body, method) => {
    const res = await worker.fetch(new Request('http://x' + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env, ctx);
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { status: res.status, json, text, setCookie: () => { cookie = ''; } };
  };
  await call('/api/login', { code: 'MASTERCODE' });
  const on = await call('/api/setup/onboard', {
    company: { name: 'NAF Contracting LLC' },
    project: { name: 'NAF Tower', location: 'Dubai', currency: 'AED', retention_pct: 10, payment_days: 56 },
    principal: { name: 'M. Al Nuaimi', email: 'principal@naf.ae' } });
  const PID = on.json.project_id;
  await call('/api/person', { name: 'A. Haddad', email: 'pm@naf.ae', functions: ['pm'], groups: [], projects: [PID] });
  await call('/api/person', { name: 'R. Kumar', email: 'civil@naf.ae', functions: ['site'], groups: ['Civil'], projects: [PID] });
  await call('/api/person', { name: 'S. Farooq', email: 'mep@naf.ae', functions: ['site'], groups: ['MEP'], projects: [PID] });
  await call('/api/import', { replace: true, text:
    'ID,Activity,WBS,Planned Start,Planned Finish,Trade Group,Weight\n' +
    'A1000,Raft foundation,Substructure,2026-08-01,2026-08-20,Civil,100\n' +
    'A3070,DEWA substation,MEP,2026-08-03,2026-11-27,MEP,100' });
  return { call, PID };
}

const asPM = async (call) => { call.setCookie && call.setCookie(); };

// ---- OFF, cleanly, with no model configured -----------------------------
{
  const env = freshEnv(false);
  const { call } = await seed(env);
  let cookie = '';
  const pm = async (path, body) => {
    const res = await worker.fetch(new Request('http://x' + path, { method: body ? 'POST' : 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
      body: body ? JSON.stringify(body) : undefined }), env, ctx);
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  await pm('/api/signin/code', { email: 'pm@naf.ae', code: '246810' });
  let r = await pm('/api/ai/status');
  check('with no model, status says AI is off', r.json && r.json.enabled === false, JSON.stringify(r.json));
  r = await pm('/api/ai/report-narrative', { kind: 'weekly' });
  check('and a narrative request returns a clean message, not an error page',
    r.status === 200 && r.json && r.json.disabled === true, JSON.stringify(r.json));
  check('the message tells the person AI is not switched on', /not switched on/i.test(r.json.error), r.json.error);
}

// ---- ON, with the model configured --------------------------------------
{
  const env = freshEnv(true);
  await seed(env);
  let cookie = '';
  const pm = async (path, body) => {
    const res = await worker.fetch(new Request('http://x' + path, { method: body ? 'POST' : 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
      body: body ? JSON.stringify(body) : undefined }), env, ctx);
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  // report progress with a delay reason THIS WEEK, so the narrative has real
  // period content to be written from. The MEP engineer reports the DEWA delay —
  // an MEP activity, so it must be the MEP engineer, not the Civil one.
  await pm('/api/signin/code', { email: 'mep@naf.ae', code: '246810' });
  await pm('/api/update', { activity_id: 'A3070', pct: 62, status: 'at_risk',
    delay_reason: 'DEWA substation energisation delayed by authority' });
  cookie = '';
  await pm('/api/signin/code', { email: 'pm@naf.ae', code: '246810' });

  let r = await pm('/api/ai/status');
  check('with a model, status says AI is on', r.json && r.json.enabled === true, JSON.stringify(r.json));

  r = await pm('/api/ai/report-narrative', { kind: 'weekly' });
  check('the PM gets a narrative draft', r.status === 200 && r.json && r.json.ok && r.json.narrative,
    JSON.stringify(r.json).slice(0, 200));
  check('it is marked a draft to review', /draft/i.test(r.json.note || ''), r.json.note);
  check('the real project figures were sent to the model',
    modelSaw && /NAF Tower/.test(JSON.stringify(modelSaw)), 'model must see this project, not a template');
  check('and this project’s own activities reached it',
    /DEWA substation|Raft foundation/.test(JSON.stringify(modelSaw)),
    JSON.stringify(modelSaw).slice(0, 200));
  check('the facts the draft was written from are returned beside it',
    /NAF Tower/.test(r.json.facts || ''), (r.json.facts || '').slice(0, 120));

  // the site engineer must not be able to draft the client-facing report
  cookie = '';
  await pm('/api/signin/code', { email: 'civil@naf.ae', code: '246810' });
  r = await pm('/api/ai/report-narrative', { kind: 'weekly' });
  check('a site engineer cannot draft the report narrative', r.status === 401 || (r.json && r.json.error && !r.json.narrative),
    'status=' + r.status);

  // the admin sees the spend
  cookie = '';
  await pm('/api/login', { code: 'MASTERCODE' });
  r = await pm('/api/ai/status');
  check('the AETRAA Admin sees AI usage', r.json && Array.isArray(r.json.usage), JSON.stringify(r.json).slice(0, 160));
  check('and it recorded the narrative call', r.json.usage.some((u) => u.task === 'report-narrative'),
    JSON.stringify(r.json.usage));
}

model.close();
console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
