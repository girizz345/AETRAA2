// ONE DOOR TO A MODEL.
//
// The platform will start on the Claude API and later move to a self-hosted
// open model on the UAE infrastructure. That migration must be a change of
// configuration, not a rewrite — so every AI feature in the platform calls
// exactly one function here, callModel(), and this file is the only place that
// knows which model is behind the door.
//
// It speaks two request shapes from one call:
//   · Anthropic Messages API      (api.anthropic.com — Claude, today)
//   · OpenAI-compatible chat API   (vLLM / Ollama / TGI — your own model later)
// Both are what an open-model server exposes, so "migrate" is: set AI_BASE_URL
// to your server and AI_PROVIDER to 'openai'. No feature code changes.
//
// Three rules this file enforces, because they are what keep an AI platform
// trustworthy rather than a liability:
//   1. OFF until configured. No key, no calls — the feature degrades to a
//      plain message, it does not break.
//   2. Every call is LOGGED (task, model, tokens) so spend is visible and the
//      open model can later be compared to Claude on the same work.
//   3. This file never decides anything. It returns text for a person to sign.
//      Nothing here issues a letter, certifies a payment or sends a thing.

import { addColumns } from './db-cols.js';

const nowISO = () => new Date().toISOString();
const uid = () => 'ai_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
let COST_COL = false;
const toB64 = (u8) => {
  if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
  let b = ''; for (let i = 0; i < u8.length; i += 0x8000) b += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(b);
};

// Claude Opus 4.7 and later, Sonnet 5 and later and Fable refuse a temperature
// setting (a 400), so it is sent only to the models that still take one.
const TAKES_TEMPERATURE = (model) =>
  !/^claude-(opus-4-[78]|opus-5|sonnet-5|fable|mythos)/.test(String(model || ''));

// One call through the signed-in `claude` command (provider 'subscription').
// No tools, no settings, no MCP servers, no saved session: a plain question
// and answer, the same as an API call. Node only — loaded on first use.
async function callSubscription(cfg, system, messages, timeoutMs, documents) {
  const { spawn } = await import('node:child_process');
  // The CLI always runs in a private, empty temporary folder, so nothing in the
  // server's own folder (its code, a CLAUDE.md) is ever read as context. A
  // document (a drawing sheet) is written there, and the CLI may Read that
  // folder only — nothing else on the machine.
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const workDir = mkdtempSync(join(tmpdir(), 'aetraa-ai-'));
  let docDir = null, docNote = '';
  if (documents && documents.length) {
    docDir = workDir;
    const paths = documents.map((d, i) => {
      // K9: a picture (a title-block corner) is named as one, so the CLI reads it as an image.
      const ext = /^image\/png$/i.test(d.media_type || '') ? '.png' : /^image\/jpe?g$/i.test(d.media_type || '') ? '.jpg' : '.pdf';
      const f = join(docDir, 'document-' + (i + 1) + ext);
      writeFileSync(f, d.bytes);
      return f;
    });
    docNote = 'Read ' + (paths.length > 1 ? 'these files' : 'this file') + ' first: ' + paths.join(', ') + '\n\n';
  }
  const prompt = docNote + messages.map((m) => {
    const c = typeof m.content === 'string' ? m.content
      : (m.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return messages.length > 1 ? (m.role === 'assistant' ? 'Assistant: ' : 'User: ') + c : c;
  }).join('\n\n');
  const args = ['-p', '--output-format', 'json', '--model', cfg.model,
    ...(docDir ? ['--tools', 'Read', '--allowedTools', 'Read', '--add-dir', docDir] : ['--tools', '']),
    '--setting-sources', '', '--strict-mcp-config', '--no-session-persistence',
    '--system-prompt', system || 'You draft construction documents for a person to check and sign.'];
  const childEnv = { ...process.env };
  delete childEnv.ANTHROPIC_API_KEY;          // the subscription, not a key
  const bin = await claudeBin(cfg.bin);
  return new Promise((resolve, reject) => {
    const ch = spawn(bin, args, { cwd: workDir, env: childEnv, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', errOut = '';
    const t = setTimeout(() => { ch.kill('SIGTERM'); reject(new Error('the model took too long')); }, timeoutMs);
    ch.stdout.on('data', (d) => { out += d; });
    ch.stderr.on('data', (d) => { errOut += d; });
    ch.on('error', (e) => { clearTimeout(t); reject(new Error('the claude command could not be started: ' + e.message
      + (process.platform === 'win32' ? ' — on Windows set CLAUDE_BIN to the full path of claude.exe' : ''))); });
    ch.on('close', () => {
      clearTimeout(t);
      import('node:fs').then((fs) => fs.rmSync(workDir, { recursive: true, force: true })).catch(() => {});
      let j = null;
      try { j = JSON.parse(out); } catch (e) { /* below */ }
      if (!j) return reject(new Error((errOut || out || 'no answer').trim().slice(0, 300)));
      if (j.is_error) return reject(new Error(String(j.result || 'the model returned an error').slice(0, 300)));
      const u = j.usage || {};
      resolve({
        text: String(j.result || '').trim(),
        usage: {
          input_tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
          output_tokens: u.output_tokens || 0,
        },
        cost_usd: j.total_cost_usd == null ? null : Number(j.total_cost_usd),
      });
    });
    ch.stdin.end(prompt);
  });
}

// K9: on Windows `claude` is a .cmd shim that Node will not start without a
// shell (ENOENT, or EINVAL for claude.cmd), and a shell would re-parse the
// prompt. The real claude.exe is found in the two places it is installed;
// CLAUDE_BIN still wins when it is set.
async function claudeBin(bin) {
  if (process.platform !== 'win32' || (bin && bin !== 'claude')) return bin || 'claude';
  try {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const home = process.env.USERPROFILE || '', appData = process.env.APPDATA || '';
    const places = [home && join(home, '.local', 'bin', 'claude.exe'),
      appData && join(appData, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')];
    for (const p of places) if (p && existsSync(p)) return p;
  } catch (e) { /* fall through */ }
  return 'claude';
}

// Which model, from configuration alone.
export function aiConfig(env) {
  const e = env || {};
  // TESTING ONLY: the Claude Code signed in on this computer, on the owner's own
  // subscription. It runs the `claude` command, so it works only where that is
  // installed and signed in — the owner's Mac, never the live server, and never
  // for tenants (a subscription is for its holder's own use). Each call still
  // records what the same work would have cost on the API.
  if (e.AI_PROVIDER === 'subscription') {
    return {
      provider: 'subscription',
      baseUrl: '',
      key: '',
      model: e.AI_MODEL || 'claude-sonnet-5-5',
      bin: e.CLAUDE_BIN || 'claude',
    };
  }
  // An explicit base URL (a self-hosted open model) wins, because that is the
  // migration target and it should take over the moment it is set.
  if (e.AI_BASE_URL) {
    return {
      provider: e.AI_PROVIDER === 'anthropic' ? 'anthropic' : 'openai',
      baseUrl: String(e.AI_BASE_URL).replace(/\/+$/, ''),
      key: e.AI_API_KEY || e.ANTHROPIC_API_KEY || '',
      model: e.AI_MODEL || 'local-model',
    };
  }
  if (e.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      key: e.ANTHROPIC_API_KEY,
      model: e.AI_MODEL || 'claude-sonnet-5-5',
    };
  }
  return null;
}

export function aiEnabled(env) { return !!aiConfig(env); }

// A model per task, where one is set: AI_TASK_MODELS="a10-rfi=claude-opus-5-5,
// ask-the-project=claude-sonnet-5-5". A key matches the task exactly, or as the
// start of it ("schedule-" covers every schedule task). Any task not named
// uses AI_MODEL, so nothing changes until a task is named.
export function taskModels(env) {
  const out = [];
  for (const part of String((env && env.AI_TASK_MODELS) || '').split(/[,;\n]/)) {
    const m = part.match(/^\s*([A-Za-z0-9_.-]+)\s*=\s*([A-Za-z0-9_.:\/-]+)\s*$/);
    if (m) out.push([m[1].toLowerCase(), m[2]]);
  }
  return out;
}
// Ajay, 6 Oct 2026 (decision 6): RFIs on the bigger model. Applied only where
// the model behind the door is Claude (the API or the subscription); a
// self-hosted model keeps AI_MODEL. AI_TASK_MODELS overrides it either way.
export const CLAUDE_TASK_DEFAULTS = [['a10-rfi', 'claude-opus-5-5']];
export function modelForTask(env, task, fallback, provider) {
  const t = String(task || '').toLowerCase();
  if (!t) return fallback;
  const list = taskModels(env);
  if (provider === 'anthropic' || provider === 'subscription') {
    for (const [k, m] of CLAUDE_TASK_DEFAULTS) if (!list.some(([x]) => x === k)) list.push([k, m]);
  }
  const exact = list.find(([k]) => k === t);
  if (exact) return exact[1];
  const pre = list.filter(([k]) => t.startsWith(k)).sort((a, b) => b[0].length - a[0].length)[0];
  return pre ? pre[1] : fallback;
}

// A short, plain reason the UI can show when AI is off, so a button explains
// itself rather than failing.
export const AI_OFF_MESSAGE =
  'AI drafting is not switched on for this deployment. Set an API key to enable it — ' +
  'until then, every register and report still works; only the AI drafts are unavailable.';

export async function ensureAiLog(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_usage (
         id TEXT PRIMARY KEY, project_id TEXT, task TEXT, model TEXT, provider TEXT,
         input_tokens INTEGER, output_tokens INTEGER, ok INTEGER, error TEXT,
         who TEXT, created_at TEXT)`
    ).run();
    if (!COST_COL && await addColumns(env, 'ai_usage', [['cost_usd', 'REAL']])) COST_COL = true;
    return true;
  } catch (e) { return false; }
}

async function logUsage(env, row) {
  try {
    await ensureAiLog(env);
    await env.DB.prepare(
      `INSERT INTO ai_usage (id,project_id,task,model,provider,input_tokens,output_tokens,ok,error,who,created_at,cost_usd)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(uid(), row.project_id || null, row.task || '', row.model || '', row.provider || '',
           row.input_tokens || 0, row.output_tokens || 0, row.ok ? 1 : 0,
           row.error || null, row.who || '', nowISO(),
           row.cost_usd == null ? null : Number(row.cost_usd)).run();
  } catch (e) { /* logging must never break the feature */ }
}

// THE DOOR. Everything above the model calls this and nothing else.
//   callModel(env, { task, system, prompt|messages, max_tokens, temperature, project_id, who })
// Returns { text, model, usage } or { error, disabled? } — never throws for a
// configuration or model problem, because a feature must fail into a message a
// person can read, not a stack trace.
export async function callModel(env, opts) {
  const o = opts || {};
  const base = aiConfig(env);
  if (!base) return { error: AI_OFF_MESSAGE, disabled: true };
  const cfg = { ...base, model: modelForTask(env, o.task, base.model, base.provider) };

  // A document (a PDF sheet) travels with the prompt. On the API it is a
  // document block; on the subscription it is a file the CLI reads.
  // K9: a picture (image/png or image/jpeg, e.g. a title-block corner) goes as
  // an image block instead.
  const docs = Array.isArray(o.documents) ? o.documents.filter((d) => d && d.bytes && d.bytes.length) : [];
  const messages = o.messages || [{ role: 'user', content: String(o.prompt || '') }];
  const isImage = (d) => /^image\/(png|jpe?g|gif|webp)$/i.test(d.media_type || '');
  const apiMessages = docs.length && cfg.provider === 'anthropic' && !o.messages
    ? [{ role: 'user', content: docs.map((d) => ({ type: isImage(d) ? 'image' : 'document',
        source: { type: 'base64', media_type: d.media_type || 'application/pdf', data: toB64(d.bytes) } }))
        .concat([{ type: 'text', text: String(o.prompt || '') }]) }]
    : messages;
  if (docs.length && cfg.provider === 'openai') return { error: 'this model connection cannot read documents' };
  o.documents = docs;
  const max_tokens = Math.min(Math.max(Number(o.max_tokens) || 1500, 1), 8000);
  const temperature = o.temperature == null ? 0.2 : Number(o.temperature);

  let text = '', usage = { input_tokens: 0, output_tokens: 0 }, err = null, cost_usd = null;
  try {
    if (cfg.provider === 'subscription') {
      const r = await callSubscription(cfg, o.system, messages, Number(o.timeout_ms) || 240000, o.documents);
      text = r.text; usage = r.usage; cost_usd = r.cost_usd;
    } else if (cfg.provider === 'anthropic') {
      const r = await fetch(cfg.baseUrl + '/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: cfg.model, max_tokens,
          temperature: TAKES_TEMPERATURE(cfg.model) ? temperature : undefined,
          system: o.system || undefined, messages: apiMessages,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j.error && j.error.message) || ('model returned ' + r.status));
      text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      usage = { input_tokens: (j.usage || {}).input_tokens || 0, output_tokens: (j.usage || {}).output_tokens || 0 };
    } else {
      // OpenAI-compatible — the shape every open-model server speaks.
      const sys = o.system ? [{ role: 'system', content: o.system }] : [];
      const r = await fetch(cfg.baseUrl + '/v1/chat/completions', {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json' },
          cfg.key ? { authorization: 'Bearer ' + cfg.key } : {}),
        body: JSON.stringify({ model: cfg.model, max_tokens, temperature, messages: sys.concat(messages) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j.error && j.error.message) || ('model returned ' + r.status));
      text = (((j.choices || [])[0] || {}).message || {}).content || '';
      text = String(text).trim();
      usage = {
        input_tokens: (j.usage || {}).prompt_tokens || 0,
        output_tokens: (j.usage || {}).completion_tokens || 0,
      };
    }
  } catch (e) {
    err = (e && e.message) || 'the model could not be reached';
  }

  await logUsage(env, {
    project_id: o.project_id, task: o.task, model: cfg.model, provider: cfg.provider,
    input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
    ok: !err && !!text, error: err, who: o.who, cost_usd,
  });

  if (err) return { error: err };
  if (!text) return { error: 'the model returned nothing' };
  return { text, model: cfg.model, provider: cfg.provider, usage, cost_usd };
}

// What has been spent, for the AETRAA Admin. Tokens, not money, because the
// price per token depends on the model and changes — the Admin multiplies by
// the rate they are paying.
export async function aiUsageSummary(env, pid) {
  await ensureAiLog(env);
  try {
    const where = pid ? 'WHERE project_id = ?' : '';
    const args = pid ? [pid] : [];
    const { results } = await env.DB.prepare(
      `SELECT task, model, COUNT(*) AS calls,
              SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens,
              SUM(cost_usd) AS cost_usd,
              SUM(CASE WHEN ok = 1 THEN 0 ELSE 1 END) AS failures
         FROM ai_usage ${where} GROUP BY task, model ORDER BY calls DESC`
    ).bind(...args).all();
    return results || [];
  } catch (e) { return []; }
}
