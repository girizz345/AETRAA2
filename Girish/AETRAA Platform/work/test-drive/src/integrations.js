// INTEGRATIONS — AETRAA and the other programs a project runs on (Revit and
// the others Ajay connects), in both directions. docs/INTEGRATION.md is the
// guide for whoever writes the other side; docs/openapi.json describes it.
//
// IN: their code calls AETRAA.
//   Each company makes API keys (shown once; only a hash is kept). A request
//   carries one:  Authorization: Bearer aet_…  and reaches only that company's
//   projects. /api/v1/… lists the projects and takes items into a project's
//   INBOX: { source, kind, title, external_id, data } and, optionally, a file
//   (a model, a schedule, a drawing). The same external_id again updates the
//   item rather than adding another. The team sees the inbox on /integrations.
//   What an item then DOES on the platform is a handler per source and kind
//   (INBOX_HANDLERS below) — empty until the data from each program is known,
//   so nothing is guessed into a register.
//
// OUT: AETRAA calls their code.
//   A connector is configured on the server only:
//     INTEGRATIONS=revit,navisworks,…            the names
//     INTEGRATION_REVIT_URL=https://…            where it listens
//     INTEGRATION_REVIT_SECRET=…                 a shared secret
//     INTEGRATION_REVIT_LABEL=Autodesk Revit     (optional) what the screen calls it
//   A call is POST <url>/<action> with a JSON body, signed:
//     X-AETRAA-Timestamp: <unix seconds>
//     X-AETRAA-Signature: sha256=<hex HMAC-SHA256(secret, timestamp + "." + body)>
//   so their side can prove it came from AETRAA and refuse a replay. Every
//   call is written to integration_log, with how long it took and how it ended.

const nowISO = () => new Date().toISOString();
const enc = new TextEncoder();
const rid = (p) => p + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const API_SCOPES = ['read', 'write'];
export const INBOX_KINDS = ['model', 'quantities', 'progress', 'drawing', 'schedule', 'issue', 'document', 'other'];
export const integrationMaxBytes = (env) => Math.max(1, Number(env && env.INTEGRATION_MAX_MB) || 200) * 1048576;

/* ---------------------------------------------------------------- tables */

let READY = false;
export async function ensureIntegrationTables(env) {
  if (READY) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS api_keys (
       id           TEXT PRIMARY KEY,
       org_id       TEXT NOT NULL,
       name         TEXT NOT NULL,
       prefix       TEXT NOT NULL,
       key_hash     TEXT NOT NULL,
       scopes       TEXT,
       created_by   TEXT,
       created_at   TEXT,
       last_used_at TEXT,
       revoked_at   TEXT
     )`
  ).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys (key_hash)').run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS integration_inbox (
       id          TEXT PRIMARY KEY,
       org_id      TEXT NOT NULL,
       project_id  TEXT NOT NULL,
       source      TEXT NOT NULL,
       kind        TEXT NOT NULL,
       title       TEXT,
       external_id TEXT,
       data        TEXT,
       file_key    TEXT,
       file_name   TEXT,
       file_size   INTEGER,
       status      TEXT NOT NULL,
       note        TEXT,
       key_id      TEXT,
       created_at  TEXT,
       updated_at  TEXT
     )`
  ).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_inbox_project ON integration_inbox (project_id, created_at)').run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS integration_log (
       id          TEXT PRIMARY KEY,
       org_id      TEXT,
       project_id  TEXT,
       connector   TEXT,
       action      TEXT,
       ok          INTEGER,
       http_status INTEGER,
       ms          INTEGER,
       error       TEXT,
       who         TEXT,
       created_at  TEXT
     )`
  ).run();
  READY = true;
}

/* ---------------------------------------------------------------- API keys */

async function sha256hex(s) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(String(s)))); }

function randomToken(n) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const b = crypto.getRandomValues(new Uint8Array(n * 2));
  let s = '';
  for (let i = 0; s.length < n && i < b.length; i++) if (b[i] < 228) s += A[b[i] % A.length];   // no modulo bias
  return s;
}

// A new key: returned once, in full; only its hash is kept.
export async function createApiKey(env, orgId, name, scopes, who) {
  await ensureIntegrationTables(env);
  const nm = String(name || '').trim().slice(0, 80);
  if (!nm) return { error: 'Name the key after what will use it, e.g. “Revit add-in”.' };
  const sc = (Array.isArray(scopes) ? scopes : ['read', 'write']).filter((s) => API_SCOPES.includes(s));
  if (!sc.length) return { error: 'A key needs at least one of: read, write.' };
  const prefix = randomToken(8);
  const key = 'aet_' + prefix + '_' + randomToken(36);
  const id = rid('key');
  await env.DB.prepare(
    'INSERT INTO api_keys (id, org_id, name, prefix, key_hash, scopes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(id, orgId, nm, prefix, await sha256hex(key), JSON.stringify(sc), String(who || '').slice(0, 120), nowISO()).run();
  return { ok: true, id, name: nm, prefix, scopes: sc, key };
}

export async function listApiKeys(env, orgId) {
  await ensureIntegrationTables(env);
  const { results } = await env.DB.prepare(
    'SELECT id, name, prefix, scopes, created_by, created_at, last_used_at, revoked_at FROM api_keys WHERE org_id = ? ORDER BY created_at DESC'
  ).bind(orgId).all();
  return (results || []).map((k) => ({ ...k, scopes: safeJson(k.scopes, []) }));
}

export async function revokeApiKey(env, orgId, id) {
  await ensureIntegrationTables(env);
  const r = await env.DB.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND org_id = ? AND revoked_at IS NULL')
    .bind(nowISO(), String(id || ''), orgId).run();
  return (r.meta && r.meta.changes) ? { ok: true } : { error: 'No such key, or it is already revoked.' };
}

// The key a request carries, if it is a live one.
export async function keyFromRequest(env, req) {
  const auth = req.headers.get('authorization') || '';
  const given = (/^Bearer\s+(aet_[A-Za-z0-9_]+)$/.exec(auth.trim()) || [])[1] || (req.headers.get('x-api-key') || '').trim();
  if (!/^aet_[A-Za-z0-9]{8}_[A-Za-z0-9]{36}$/.test(given)) return null;
  await ensureIntegrationTables(env);
  const row = await env.DB.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL').bind(await sha256hex(given)).first();
  if (!row) return null;
  try { await env.DB.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').bind(nowISO(), row.id).run(); } catch (e) { /* cosmetic */ }
  return { ...row, scopes: safeJson(row.scopes, []) };
}

function safeJson(s, d) { try { const v = JSON.parse(s); return v == null ? d : v; } catch (e) { return d; } }

/* ------------------------------------------------------------------- inbox */

// What an item does once it has arrived, per "source:kind" (or "*:kind").
// Empty on purpose: each program's data is mapped into the registers once its
// shape is agreed with Ajay. A handler receives (env, item) and returns
// { applied: true, note } or { error }. Until one exists an item waits on
// /integrations for a person to look at it.
export const INBOX_HANDLERS = {
  // 'revit:quantities': async (env, item) => { … turn item.data into BOQ lines … },
};

function cleanItem(b) {
  const source = String(b.source || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  const kind = String(b.kind || '').trim().toLowerCase();
  if (!source) return { error: 'source is required — the program sending this, e.g. "revit".' };
  if (!INBOX_KINDS.includes(kind)) return { error: 'kind must be one of: ' + INBOX_KINDS.join(', ') + '.' };
  let data = b.data === undefined ? null : b.data;
  const dataText = data === null ? null : JSON.stringify(data);
  if (dataText && dataText.length > 2000000) return { error: 'data is larger than 2 MB — send it as a file instead.' };
  return {
    source, kind, data: dataText,
    title: String(b.title || '').trim().slice(0, 300) || null,
    external_id: b.external_id == null ? null : String(b.external_id).trim().slice(0, 200) || null,
  };
}

export async function receiveItem(env, key, projectId, body) {
  await ensureIntegrationTables(env);
  const c = cleanItem(body || {});
  if (c.error) return c;
  const at = nowISO();
  if (c.external_id) {
    const same = await env.DB.prepare('SELECT id FROM integration_inbox WHERE project_id = ? AND source = ? AND external_id = ?')
      .bind(projectId, c.source, c.external_id).first();
    if (same) {
      await env.DB.prepare("UPDATE integration_inbox SET kind = ?, title = ?, data = ?, status = 'received', updated_at = ?, key_id = ? WHERE id = ?")
        .bind(c.kind, c.title, c.data, at, key.id, same.id).run();
      const applied = await applyHandler(env, same.id);
      return { ok: true, id: same.id, updated: true, ...applied };
    }
  }
  const id = rid('inb');
  await env.DB.prepare(
    `INSERT INTO integration_inbox (id, org_id, project_id, source, kind, title, external_id, data, status, key_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, key.org_id, projectId, c.source, c.kind, c.title, c.external_id, c.data, 'received', key.id, at, at).run();
  const applied = await applyHandler(env, id);
  return { ok: true, id, updated: false, ...applied };
}

async function applyHandler(env, id) {
  const item = await env.DB.prepare('SELECT * FROM integration_inbox WHERE id = ?').bind(id).first();
  const h = item && (INBOX_HANDLERS[item.source + ':' + item.kind] || INBOX_HANDLERS['*:' + item.kind]);
  if (!h) return { status: 'received' };
  try {
    const r = await h(env, { ...item, data: safeJson(item.data, null) });
    const status = r && r.error ? 'failed' : 'applied';
    await env.DB.prepare('UPDATE integration_inbox SET status = ?, note = ?, updated_at = ? WHERE id = ?')
      .bind(status, String((r && (r.error || r.note)) || '').slice(0, 1000) || null, nowISO(), id).run();
    return { status, note: r && (r.error || r.note) };
  } catch (e) {
    await env.DB.prepare("UPDATE integration_inbox SET status = 'failed', note = ?, updated_at = ? WHERE id = ?")
      .bind(String(e && e.message || e).slice(0, 1000), nowISO(), id).run();
    return { status: 'failed' };
  }
}

export async function attachItemFile(env, putFile, key, itemId, name, bytes) {
  await ensureIntegrationTables(env);
  const item = await env.DB.prepare('SELECT * FROM integration_inbox WHERE id = ? AND org_id = ?').bind(String(itemId || ''), key.org_id).first();
  if (!item) return { error: 'No such item.', status: 404 };
  const nm = String(name || '').replace(/[\u0000-\u001f\\/:*?"<>|]/g, '_').trim().slice(0, 180);
  if (!nm) return { error: 'name is required (?name=model.rvt).' };
  if (/\.(exe|msi|bat|cmd|com|scr|js|mjs|vbs|ps1|sh|html?|svgz?|php|jar|dll)$/i.test(nm)) return { error: 'That kind of file (a program, script or web page) is not accepted.' };
  if (!bytes || !bytes.length) return { error: 'The file is empty.' };
  if (bytes.length > integrationMaxBytes(env)) return { error: 'The file is larger than ' + Math.round(integrationMaxBytes(env) / 1048576) + ' MB.', status: 413 };
  const fileKey = 'integrations/' + item.org_id + '/' + item.project_id + '/' + item.id + '-' + Date.now().toString(36);
  const put = await putFile(env, fileKey, bytes, 'application/octet-stream');
  if (!put || put.error) return { error: 'The file could not be stored.', status: 502 };
  await env.DB.prepare('UPDATE integration_inbox SET file_key = ?, file_name = ?, file_size = ?, updated_at = ? WHERE id = ?')
    .bind(put.key || fileKey, nm, bytes.length, nowISO(), item.id).run();
  return { ok: true, id: item.id, file_name: nm, file_size: bytes.length };
}

export async function listInbox(env, orgId, projectId, opts = {}) {
  await ensureIntegrationTables(env);
  const args = [orgId, projectId];
  let where = 'org_id = ? AND project_id = ?';
  if (opts.since) { where += ' AND updated_at > ?'; args.push(String(opts.since)); }
  if (opts.status) { where += ' AND status = ?'; args.push(String(opts.status)); }
  const { results } = await env.DB.prepare(
    `SELECT id, project_id, source, kind, title, external_id, file_name, file_size, status, note, created_at, updated_at
       FROM integration_inbox WHERE ${where} ORDER BY updated_at DESC LIMIT ${Math.min(500, Number(opts.limit) || 200)}`
  ).bind(...args).all();
  return results || [];
}

export async function getItem(env, orgId, id) {
  await ensureIntegrationTables(env);
  const row = await env.DB.prepare('SELECT * FROM integration_inbox WHERE id = ? AND org_id = ?').bind(String(id || ''), orgId).first();
  return row ? { ...row, data: safeJson(row.data, null) } : null;
}

export async function setItemStatus(env, orgId, id, status, note) {
  await ensureIntegrationTables(env);
  if (!['received', 'reviewed', 'applied', 'archived'].includes(status)) return { error: 'unknown status' };
  const r = await env.DB.prepare('UPDATE integration_inbox SET status = ?, note = COALESCE(?, note), updated_at = ? WHERE id = ? AND org_id = ?')
    .bind(status, note ? String(note).slice(0, 1000) : null, nowISO(), String(id || ''), orgId).run();
  return (r.meta && r.meta.changes) ? { ok: true } : { error: 'No such item.' };
}

/* -------------------------------------------------------------- connectors */

export function connectors(env) {
  const names = String((env && env.INTEGRATIONS) || '').split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z0-9_]{1,30}$/.test(s));
  return names.map((n) => {
    const up = n.toUpperCase();
    const url = String(env['INTEGRATION_' + up + '_URL'] || '').replace(/\/+$/, '');
    return {
      name: n, label: String(env['INTEGRATION_' + up + '_LABEL'] || n.charAt(0).toUpperCase() + n.slice(1)),
      url, secret: String(env['INTEGRATION_' + up + '_SECRET'] || ''),
      configured: /^https:\/\//.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url),
    };
  });
}

export async function sign(secret, timestamp, body) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return 'sha256=' + hex(await crypto.subtle.sign('HMAC', k, enc.encode(timestamp + '.' + body)));
}

export async function callConnector(env, name, action, payload, ctx = {}) {
  await ensureIntegrationTables(env);
  const c = connectors(env).find((x) => x.name === String(name || '').toLowerCase());
  if (!c) return { error: 'There is no connector called "' + name + '" on this server.' };
  if (!c.configured) return { error: c.label + ' is not set up on this server yet (INTEGRATION_' + c.name.toUpperCase() + '_URL).' };
  if (!c.secret) return { error: c.label + ' has no shared secret yet (INTEGRATION_' + c.name.toUpperCase() + '_SECRET).' };
  const act = String(action || '').trim().replace(/[^a-z0-9_-]/gi, '').slice(0, 60);
  if (!act) return { error: 'Which action? e.g. "ping".' };
  const body = JSON.stringify({ action: act, request_id: rid('req'), sent_at: nowISO(),
    org_id: ctx.org_id || null, project: ctx.project || null, payload: payload === undefined ? null : payload,
    reply_to: ctx.reply_to || null });
  const ts = String(Math.floor(Date.now() / 1000));
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1000, Number(env.INTEGRATION_TIMEOUT_MS) || 30000));
  let ok = false, status = 0, err = null, reply = null;
  try {
    const res = await fetch(c.url + '/' + act, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-AETRAA-Timestamp': ts, 'X-AETRAA-Signature': await sign(c.secret, ts, body),
        'User-Agent': 'AETRAA-Integrations/1' },
      body,
    });
    status = res.status;
    const text = await res.text();
    try { reply = JSON.parse(text); } catch (e) { reply = text.slice(0, 2000); }
    ok = res.ok;
    if (!ok) err = 'HTTP ' + status;
  } catch (e) {
    err = e && e.name === 'AbortError' ? 'it did not answer in time' : String(e && e.message || e).slice(0, 300);
  } finally { clearTimeout(timer); }
  const ms = Date.now() - started;
  try {
    await env.DB.prepare(
      'INSERT INTO integration_log (id, org_id, project_id, connector, action, ok, http_status, ms, error, who, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(rid('log'), ctx.org_id || null, (ctx.project && ctx.project.id) || null, c.name, act, ok ? 1 : 0, status || null, ms,
      err, String(ctx.who || '').slice(0, 120) || null, nowISO()).run();
  } catch (e) { /* the call stands without its log line */ }
  return ok ? { ok: true, status, ms, reply } : { error: c.label + ': ' + err, status, ms, reply };
}

export async function connectorStatus(env, orgId) {
  await ensureIntegrationTables(env);
  const list = connectors(env);
  const out = [];
  for (const c of list) {
    const last = await env.DB.prepare(
      'SELECT action, ok, http_status, ms, error, created_at FROM integration_log WHERE connector = ? AND (org_id = ? OR org_id IS NULL) ORDER BY created_at DESC LIMIT 1'
    ).bind(c.name, orgId || null).first();
    out.push({ name: c.name, label: c.label, configured: c.configured, has_secret: !!c.secret, last: last || null });
  }
  return out;
}

/* ----------------------------------------------------------- the /api/v1 door */

const v1json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

// Everything under /api/v1 is answered here, by API key only — a browser's
// session cookie is not looked at, so a web page cannot make these calls.
export async function handleApiV1(req, env, url, deps) {
  const p = url.pathname.replace(/\/+$/, '');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  const key = await keyFromRequest(env, req);
  if (!key) return v1json({ error: 'A valid API key is required: Authorization: Bearer aet_…' }, 401);
  if (await deps.overLimit(env, 'api:' + key.id, [1200, 15])) return v1json({ error: 'Too many requests. Slow down.', throttled: true }, 429);
  const can = (s) => key.scopes.includes(s);
  const org = await deps.getOrg(env, key.org_id);
  const blocked = deps.orgBlocked(org);
  if (blocked) return v1json({ error: blocked }, 403);

  if (p === '/api/v1/ping' && req.method === 'GET') {
    return v1json({ ok: true, company: org ? org.name : null, key: { name: key.name, prefix: key.prefix, scopes: key.scopes }, time: nowISO() });
  }
  if (p === '/api/v1/projects' && req.method === 'GET') {
    if (!can('read')) return v1json({ error: 'This key cannot read.' }, 403);
    const { results } = await env.DB.prepare(
      'SELECT id, name, ref, location, archived FROM projects WHERE org_id = ? ORDER BY sort_order, name'
    ).bind(key.org_id).all();
    return v1json({ projects: (results || []).map((x) => ({ id: x.id, name: x.name, ref: x.ref || null, location: x.location || null, archived: !!x.archived })) });
  }
  let m = /^\/api\/v1\/projects\/([^/]+)\/inbox$/.exec(p);
  if (m) {
    const pid = decodeURIComponent(m[1]);
    const proj = await env.DB.prepare('SELECT id, org_id FROM projects WHERE id = ?').bind(pid).first();
    if (!proj || proj.org_id !== key.org_id) return v1json({ error: 'No such project for this key.' }, 404);
    if (req.method === 'GET') {
      if (!can('read')) return v1json({ error: 'This key cannot read.' }, 403);
      return v1json({ items: await listInbox(env, key.org_id, pid, { since: url.searchParams.get('since'), status: url.searchParams.get('status'), limit: url.searchParams.get('limit') }) });
    }
    if (req.method === 'POST') {
      if (!can('write')) return v1json({ error: 'This key cannot write.' }, 403);
      const b = await req.json().catch(() => null);
      if (!b || typeof b !== 'object') return v1json({ error: 'Send JSON: { source, kind, title, external_id, data }.' }, 400);
      const r = await receiveItem(env, key, pid, b);
      if (!r.error) await deps.audit(env, { org_id: key.org_id, project_id: pid, who: 'API key ' + key.name, action: 'integration.in', detail: (b.source || '') + ' · ' + (b.kind || '') + ' · ' + (r.id || '') });
      return v1json(r, r.error ? 400 : (r.updated ? 200 : 201));
    }
  }
  m = /^\/api\/v1\/inbox\/([^/]+)(\/file)?$/.exec(p);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (m[2] && req.method === 'POST') {
      if (!can('write')) return v1json({ error: 'This key cannot write.' }, 403);
      const declared = Number(req.headers.get('content-length') || 0);
      if (declared > integrationMaxBytes(env)) return v1json({ error: 'The file is larger than ' + Math.round(integrationMaxBytes(env) / 1048576) + ' MB.' }, 413);
      const bytes = new Uint8Array(await req.arrayBuffer());
      const r = await attachItemFile(env, deps.putFile, key, id, url.searchParams.get('name'), bytes);
      return v1json(r, r.error ? (r.status || 400) : 200);
    }
    if (!m[2] && req.method === 'GET') {
      if (!can('read')) return v1json({ error: 'This key cannot read.' }, 403);
      const item = await getItem(env, key.org_id, id);
      if (!item) return v1json({ error: 'No such item.' }, 404);
      const { file_key, key_id, ...pub } = item;
      return v1json({ item: pub });
    }
  }
  return v1json({ error: 'No such endpoint. See docs/INTEGRATION.md.' }, 404);
}
