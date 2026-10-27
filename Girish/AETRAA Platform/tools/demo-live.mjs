// THE DEMO, ON A LIVE SERVER.
//
//   node tools/demo-live.mjs https://app.example.com OWNERCODE
//
// Builds the same demo project as tools/demo.mjs — a Dubai tower with its
// programme, BOQ, registers, safety log and a certified payment certificate —
// but against a running platform, over HTTPS, through the real API. Nothing is
// written behind the platform's back and no database is touched directly.
//
// The demo company is created on the 'demo' plan, which is the one case where
// office people carry a personal code as well: a demo is shown across a table,
// and stopping to fetch a six-digit code out of an inbox eleven times kills it.
// Every real customer still signs its office people in by email.
//
// It prints a card at the end: one line per person, with the code that signs
// them in. Keep it with your sales material; it opens nothing but the demo.
import { seedDemo, TEAM, DEMO } from './demo-seed.mjs';

const BASE = (process.argv[2] || '').replace(/\/+$/, '');
const OWNER = process.argv[3] || process.env.OWNER_CODE || '';
if (!BASE || !OWNER) {
  console.error('usage: node tools/demo-live.mjs https://your-server OWNERCODE');
  process.exit(1);
}

// One cookie jar, because the seeder signs in as each person in turn.
let cookie = '';
const api = {
  reset() { cookie = ''; },
  cookie() { return cookie; },
  async req(method, path, body) {
    const r = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    for (const c of set) {
      const first = String(c).split(';')[0];
      if (!first) continue;
      const name = first.split('=')[0];
      const rest = cookie.split('; ').filter((x) => x && x.split('=')[0] !== name);
      cookie = rest.concat(first).join('; ');
    }
    const text = await r.text();
    let out;
    try { out = JSON.parse(text); } catch (e) { out = { _text: text.slice(0, 200) }; }
    if (out && typeof out === 'object') out._status = r.status;
    return out;
  },
  get(path) { return api.req('GET', path); },
  post(path, body) { return api.req('POST', path, body || {}); },
};

const say = (s) => console.log('  ' + s);
console.log('Seeding the demo on ' + BASE);

const health = await fetch(BASE + '/healthz').then((r) => r.text()).catch(() => '');
if (health.trim() !== 'ok') { console.error('that server did not answer /healthz with ok'); process.exit(1); }

const out = await seedDemo(api, say, OWNER);

// The principal is created during onboarding, so give them a code too.
api.reset();
await api.post('/api/login', { code: OWNER });
const people = (await api.get('/api/people?org=' + out.OID)).people || [];
const codes = { ...(out.CODES || {}) };
for (const p of people) {
  if (!p.email || codes[p.email]) continue;
  // saveUser validates the whole person, so the name and email go back with it.
  const r = await api.post('/api/person', {
    org: out.OID, id: p.id, name: p.name, email: p.email,
    functions: p.functions || [], projects: p.projects || [], new_code: true,
  });
  if (r && r.code) codes[p.email] = r.code;
}

const byEmail = Object.fromEntries(TEAM.map(([name, email, fns]) => [email, { name, fns }]));
console.log('\n================ DEMO SIGN-IN CARD ================');
console.log(DEMO.company + ' — ' + DEMO.project);
console.log(BASE + '\n');
for (const [email, code] of Object.entries(codes)) {
  const who = byEmail[email] || { name: email, fns: [] };
  console.log(
    (who.name + '                    ').slice(0, 18) +
    (who.fns.join(', ') + '                        ').slice(0, 26) + code
  );
}
console.log('===================================================');
console.log('Project ' + out.PID + ' — sign in with a code above, or with the owner code for the setup console.');
