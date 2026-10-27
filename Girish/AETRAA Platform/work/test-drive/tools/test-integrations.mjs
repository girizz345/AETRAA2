// Integrations (src/integrations.js): API keys, the /api/v1 door for other
// programs (Revit and the others), the project inbox, and the signed calls
// AETRAA makes out to them.
//   node tools/test-integrations.mjs
import { db, env, call, callRaw, check, done, onboard, as } from './_harness.mjs';
import { INBOX_HANDLERS } from '../src/integrations.js';

// The /api/v1 door, with a key and no cookie.
const worker = (await import('../src/index.js')).default;
async function v1(path, key, body, raw) {
  const headers = {};
  if (key) headers.Authorization = 'Bearer ' + key;
  if (body && !raw) headers['Content-Type'] = 'application/json';
  if (raw) { headers['Content-Type'] = 'application/octet-stream'; headers['Content-Length'] = String(body.length); }
  const res = await worker.fetch(new Request('http://localhost' + path, { method: body ? 'POST' : 'GET', headers, body: body ? (raw ? body : JSON.stringify(body)) : undefined }), env, { waitUntil() {} });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json };
}

// A pretend Revit service, behind the outbound connector.
const seen = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('http://localhost:9911/')) {
    seen.push({ url: String(url), headers: init.headers, body: init.body });
    return new Response(JSON.stringify({ ok: true, echo: JSON.parse(init.body).action }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (String(url).startsWith('http://localhost:9912/')) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  return realFetch(url, init);
};

console.log('— keys —');
await call('/api/logout');
let r = await call('/api/signup', { name: 'Omar Faris', company: 'Faris Build', email: 'omar@faris.test', password: 'steel frame level two' });
const omar = db.prepare("SELECT * FROM users WHERE email = 'omar@faris.test'").get();
r = await call('/api/self/project', { name: 'Faris Mall', ref: 'FM-1' });
const pid = r.json.id;
r = await call('/api/integrations/keys', { name: 'Revit add-in', scopes: ['read', 'write'] });
check('the Principal makes a key, shown in full once', r.status === 200 && /^aet_[A-Za-z0-9]{8}_[A-Za-z0-9]{36}$/.test(r.json.key), r.text);
const KEY = r.json.key, KEYID = r.json.id;
const stored = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(KEYID);
check('only its hash is kept', stored.key_hash.length === 64 && !JSON.stringify(stored).includes(KEY.slice(14)));
r = await call('/api/integrations');
check('the list shows its start, never the whole key', r.json.keys.length === 1 && r.json.keys[0].prefix === KEY.slice(4, 12) && !r.text.includes(KEY), r.text);
r = await call('/api/integrations/keys', { name: 'Reader', scopes: ['read'] });
const READKEY = r.json.key;

console.log('\n— the /api/v1 door —');
r = await v1('/api/v1/ping', null);
check('no key, no answer', r.status === 401);
r = await v1('/api/v1/ping', 'aet_AAAAAAAA_' + 'B'.repeat(36));
check('a made-up key, no answer', r.status === 401);
r = await call('/api/v1/ping');
check('a browser session without a key is not enough', r.status === 401);
r = await v1('/api/v1/ping', KEY);
check('the key works', r.status === 200 && r.json.company === 'Faris Build' && r.json.key.scopes.includes('write'), r.text);
r = await v1('/api/v1/projects', KEY);
check('it lists the company’s projects', r.status === 200 && r.json.projects.length === 1 && r.json.projects[0].id === pid, r.text);

const { pid: other } = await onboard('Other Towers', 'OT-1', [['Other PM', 'pm@other.test', ['pm']]]);
r = await v1('/api/v1/projects/' + other + '/inbox', KEY, { source: 'revit', kind: 'model' });
check('another company’s project is out of reach', r.status === 404, r.text);

console.log('\n— the inbox —');
r = await v1('/api/v1/projects/' + pid + '/inbox', KEY, { source: 'revit', kind: 'nonsense' });
check('an unknown kind is refused, saying which are allowed', r.status === 400 && /quantities/.test(r.json.error));
r = await v1('/api/v1/projects/' + pid + '/inbox', KEY, { source: 'Revit', kind: 'quantities', title: 'Level 3 walls', external_id: 'L3-walls',
  data: { walls: [{ type: 'W1', area_m2: 412.5 }] } });
check('an item arrives (201)', r.status === 201 && r.json.id && r.json.status === 'received', r.text);
const ITEM = r.json.id;
r = await v1('/api/v1/projects/' + pid + '/inbox', KEY, { source: 'revit', kind: 'quantities', title: 'Level 3 walls (rev B)', external_id: 'L3-walls',
  data: { walls: [{ type: 'W1', area_m2: 418 }] } });
check('the same external_id updates it, rather than adding another', r.status === 200 && r.json.updated && r.json.id === ITEM, r.text);
check('one row, with the new data', db.prepare('SELECT COUNT(*) AS n FROM integration_inbox WHERE project_id = ?').get(pid).n === 1 &&
  JSON.parse(db.prepare('SELECT data FROM integration_inbox WHERE id = ?').get(ITEM).data).walls[0].area_m2 === 418);
r = await v1('/api/v1/inbox/' + ITEM + '/file?name=' + encodeURIComponent('L3 walls.ifc'), KEY, new TextEncoder().encode('ISO-10303-21; …'), true);
check('a file goes with it', r.status === 200 && r.json.file_size > 0, r.text);
r = await v1('/api/v1/inbox/' + ITEM + '/file?name=evil.html', KEY, new TextEncoder().encode('<script>'), true);
check('a web page is refused as a file', r.status === 400);
r = await v1('/api/v1/inbox/' + ITEM, KEY);
check('the item reads back, without its storage key', r.status === 200 && r.json.item.title === 'Level 3 walls (rev B)' && !('file_key' in r.json.item), r.text);
r = await v1('/api/v1/projects/' + pid + '/inbox', KEY);
check('and lists', r.json.items.length === 1);
r = await v1('/api/v1/projects/' + pid + '/inbox', READKEY, { source: 'revit', kind: 'model' });
check('a read-only key cannot write', r.status === 403);

console.log('\n— a handler (where Ajay’s mapping goes) —');
INBOX_HANDLERS['navisworks:issue'] = async (e, item) => ({ applied: true, note: 'clash ' + item.data.id + ' noted' });
r = await v1('/api/v1/projects/' + pid + '/inbox', KEY, { source: 'navisworks', kind: 'issue', title: 'Duct vs beam', data: { id: 'C-17' } });
check('an item with a handler is applied at once, with its note', r.json.status === 'applied' && db.prepare('SELECT note FROM integration_inbox WHERE id = ?').get(r.json.id).note === 'clash C-17 noted', r.text);
INBOX_HANDLERS['navisworks:issue'] = async () => { throw new Error('mapping not ready'); };
r = await v1('/api/v1/projects/' + pid + '/inbox', KEY, { source: 'navisworks', kind: 'issue', title: 'Pipe vs wall', data: { id: 'C-18' } });
check('a handler that fails marks the item failed, and the item is kept', r.json.status === 'failed' && db.prepare('SELECT status FROM integration_inbox WHERE id = ?').get(r.json.id).status === 'failed');
delete INBOX_HANDLERS['navisworks:issue'];

console.log('\n— the team’s side —');
await call('/api/logout');                        // onboard() above signed in as the AETRAA Admin
await call('/api/login/password', { email: 'omar@faris.test', password: 'steel frame level two' });
r = await call('/api/integrations?project=' + pid);
check('the Principal sees the inbox', r.status === 200 && r.json.inbox.length === 3, r.text);
r = await call('/api/integrations/item?id=' + ITEM);
check('and an item’s data', r.json.item.data.walls[0].area_m2 === 418);
r = await call('/api/integrations/item/file?id=' + ITEM);
check('and its file, as a download', r.status === 200 && /^attachment/.test(r.headers.get('content-disposition')) && r.headers.get('content-type') === 'application/octet-stream');
r = await call('/api/integrations/item/status', { id: ITEM, status: 'reviewed' });
check('marks it reviewed', r.status === 200 && db.prepare('SELECT status FROM integration_inbox WHERE id = ?').get(ITEM).status === 'reviewed');
await as('pm@other.test');
r = await call('/api/integrations/item?id=' + ITEM);
check('another company’s PM cannot read the item', r.status === 404);
r = await call('/api/integrations/keys', { name: 'mine', scopes: ['read'] });
check('a PM cannot make keys (that is the Principal’s)', r.status === 403);
const { pid: p2 } = await onboard('Site Co', 'SC-1', [['Site Eng', 'site@sc.test', ['site']]]);
await as('site@sc.test');
r = await call('/api/integrations');
check('a site engineer has no integrations', r.status === 403);

console.log('\n— revoking —');
await call('/api/logout');
await call('/api/login/password', { email: 'omar@faris.test', password: 'steel frame level two' });
r = await call('/api/integrations/keys/revoke', { id: KEYID });
check('the Principal revokes the key', r.status === 200);
r = await v1('/api/v1/ping', KEY);
check('and it stops working at once', r.status === 401);

console.log('\n— calling out —');
r = await call('/api/integrations/call', { connector: 'revit', action: 'ping' });
check('no connector configured: said plainly', r.status === 502 && /no connector/i.test(r.json.error), r.text);
env.INTEGRATIONS = 'revit,navis';
env.INTEGRATION_REVIT_URL = 'http://localhost:9911';
env.INTEGRATION_REVIT_SECRET = 'shared-secret-for-tests';
env.INTEGRATION_REVIT_LABEL = 'Autodesk Revit';
env.INTEGRATION_NAVIS_URL = 'http://localhost:9912';
env.INTEGRATION_NAVIS_SECRET = 'x';
r = await call('/api/integrations/call', { connector: 'revit', action: 'export-quantities', payload: { level: 3 }, project_id: pid });
check('a call to Revit goes out and its answer comes back', r.status === 200 && r.json.ok && r.json.reply.echo === 'export-quantities', r.text);
const sent = seen[seen.length - 1];
check('to <url>/<action>', sent.url === 'http://localhost:9911/export-quantities');
const body = JSON.parse(sent.body);
check('carrying the project and where to send results back', body.project.id === pid && body.reply_to.endsWith('/api/v1/projects/' + pid + '/inbox') && body.payload.level === 3, body);
// The other side checks the signature exactly as docs/INTEGRATION.md says.
const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('shared-secret-for-tests'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const mac = [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(sent.headers['X-AETRAA-Timestamp'] + '.' + sent.body)))].map((b) => b.toString(16).padStart(2, '0')).join('');
check('signed: HMAC-SHA256 of timestamp + "." + body', sent.headers['X-AETRAA-Signature'] === 'sha256=' + mac);
r = await call('/api/integrations/call', { connector: 'navis', action: 'ping' });
check('a service that does not answer in time fails cleanly', r.status === 502 && /in time/.test(r.json.error), r.text);
r = await call('/api/integrations');
const rev = r.json.connectors.find((c) => c.name === 'revit');
check('the screen shows each connector and its last call', rev.label === 'Autodesk Revit' && rev.configured && rev.last && rev.last.ok === 1, r.json.connectors);
check('every call is logged', db.prepare('SELECT COUNT(*) AS n FROM integration_log').get().n === 2);

console.log('\n— the page —');
r = await call('/integrations');
check('the Integrations page opens for the Principal', r.status === 200 && r.text.includes('API keys') && r.text.includes('Connectors'));

done();
