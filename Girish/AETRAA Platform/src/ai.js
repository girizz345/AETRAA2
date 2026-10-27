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

const nowISO = () => new Date().toISOString();
const uid = () => 'ai_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Which model, from configuration alone.
export function aiConfig(env) {
  const e = env || {};
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
      model: e.AI_MODEL || 'claude-sonnet-4-5',
    };
  }
  return null;
}

export function aiEnabled(env) { return !!aiConfig(env); }

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
    return true;
  } catch (e) { return false; }
}

async function logUsage(env, row) {
  try {
    await ensureAiLog(env);
    await env.DB.prepare(
      `INSERT INTO ai_usage (id,project_id,task,model,provider,input_tokens,output_tokens,ok,error,who,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(uid(), row.project_id || null, row.task || '', row.model || '', row.provider || '',
           row.input_tokens || 0, row.output_tokens || 0, row.ok ? 1 : 0,
           row.error || null, row.who || '', nowISO()).run();
  } catch (e) { /* logging must never break the feature */ }
}

// THE DOOR. Everything above the model calls this and nothing else.
//   callModel(env, { task, system, prompt|messages, max_tokens, temperature, project_id, who })
// Returns { text, model, usage } or { error, disabled? } — never throws for a
// configuration or model problem, because a feature must fail into a message a
// person can read, not a stack trace.
export async function callModel(env, opts) {
  const o = opts || {};
  const cfg = aiConfig(env);
  if (!cfg) return { error: AI_OFF_MESSAGE, disabled: true };

  const messages = o.messages || [{ role: 'user', content: String(o.prompt || '') }];
  const max_tokens = Math.min(Math.max(Number(o.max_tokens) || 1500, 1), 8000);
  const temperature = o.temperature == null ? 0.2 : Number(o.temperature);

  let text = '', usage = { input_tokens: 0, output_tokens: 0 }, err = null;
  try {
    if (cfg.provider === 'anthropic') {
      const r = await fetch(cfg.baseUrl + '/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: cfg.model, max_tokens, temperature,
          system: o.system || undefined, messages,
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
    ok: !err && !!text, error: err, who: o.who,
  });

  if (err) return { error: err };
  if (!text) return { error: 'the model returned nothing' };
  return { text, model: cfg.model, provider: cfg.provider, usage };
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
              SUM(CASE WHEN ok = 1 THEN 0 ELSE 1 END) AS failures
         FROM ai_usage ${where} GROUP BY task, model ORDER BY calls DESC`
    ).bind(...args).all();
    return results || [];
  } catch (e) { return []; }
}
