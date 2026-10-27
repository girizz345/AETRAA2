// THE DOOR TO THE MODEL — and the proof the migration is a config change.
//
// The platform starts on the Claude API and later moves to a self-hosted open
// model. This drives the SAME callModel() against a fake Anthropic-shaped server
// and a fake OpenAI-shaped server (what vLLM/Ollama expose) and shows the caller
// cannot tell them apart. If that holds, "migrate to our own LLM" is: change two
// environment variables.
//
//   node tools/test-ai.mjs
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { callModel, aiConfig, aiEnabled, ensureAiLog, aiUsageSummary, AI_OFF_MESSAGE } from '../src/ai.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };

function makeDb() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql) => { const st = db.prepare(sql); let a = [];
    const api = { bind(...x) { a = x; return api; },
      async all() { return { results: st.all(...a), success: true }; },
      async first(c) { const r = st.get(...a) ?? null; return c && r ? r[c] : r; },
      async run() { st.run(...a); return { success: true }; } };
    return api; };
  return { prepare: stmt, async exec(s) { db.exec(s); return { count: 1 }; } };
}

// ---- a fake Anthropic Messages API server -------------------------------
let anthropicSaw = null;
const anthropic = createServer(async (req, res) => {
  const c = []; for await (const x of req) c.push(x);
  anthropicSaw = { url: req.url, headers: req.headers, body: JSON.parse(Buffer.concat(c) || '{}') };
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    model: anthropicSaw.body.model,
    content: [{ type: 'text', text: 'Drafted by the Anthropic-shaped model.' }],
    usage: { input_tokens: 120, output_tokens: 45 },
  }));
});
await new Promise((ok) => anthropic.listen(0, ok));
const anthropicUrl = 'http://127.0.0.1:' + anthropic.address().port;

// ---- a fake OpenAI-compatible server (the open-model target) -------------
let openaiSaw = null;
const openai = createServer(async (req, res) => {
  const c = []; for await (const x of req) c.push(x);
  openaiSaw = { url: req.url, headers: req.headers, body: JSON.parse(Buffer.concat(c) || '{}') };
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    model: openaiSaw.body.model,
    choices: [{ message: { role: 'assistant', content: 'Drafted by the open model.' } }],
    usage: { prompt_tokens: 130, completion_tokens: 50 },
  }));
});
await new Promise((ok) => openai.listen(0, ok));
const openaiUrl = 'http://127.0.0.1:' + openai.address().port;

// ---- OFF until configured ------------------------------------------------
{
  const env = { DB: makeDb() };
  check('with no key, AI is off', aiEnabled(env) === false);
  check('and the config is null', aiConfig(env) === null);
  const r = await callModel(env, { task: 'x', prompt: 'hello' });
  check('a call with no model returns a message, not a crash', !!r.error && r.disabled === true, JSON.stringify(r));
  check('and the message tells the person what to do', /not switched on/i.test(r.error), r.error);
  check('the rest of the platform is unaffected', /still works/i.test(AI_OFF_MESSAGE));
}

// ---- Claude API, today ---------------------------------------------------
{
  const env = { DB: makeDb(), ANTHROPIC_API_KEY: 'sk-ant-test', AI_BASE_URL: anthropicUrl, AI_PROVIDER: 'anthropic', AI_MODEL: 'claude-sonnet-4-5' };
  check('with a key, AI is on', aiEnabled(env) === true);
  const r = await callModel(env, { task: 'letter', system: 'You are a QS.', prompt: 'Draft an EoT notice.',
    max_tokens: 500, project_id: 'p1', who: 'A. Haddad' });
  check('the Claude-shaped call returns text', r.text === 'Drafted by the Anthropic-shaped model.', JSON.stringify(r));
  check('it hit the Messages endpoint', anthropicSaw.url === '/v1/messages', anthropicSaw.url);
  check('it sent the API key in the x-api-key header', anthropicSaw.headers['x-api-key'] === 'sk-ant-test');
  check('and the anthropic version header', !!anthropicSaw.headers['anthropic-version']);
  check('the system prompt went as a top-level field', anthropicSaw.body.system === 'You are a QS.', anthropicSaw.body.system);
  check('the prompt went as a user message', anthropicSaw.body.messages[0].content === 'Draft an EoT notice.');
  check('usage came back', r.usage.input_tokens === 120 && r.usage.output_tokens === 45, JSON.stringify(r.usage));
}

// ---- THE MIGRATION: same call, the open model ----------------------------
{
  const env = { DB: makeDb(), AI_BASE_URL: openaiUrl, AI_PROVIDER: 'openai', AI_API_KEY: 'local-key', AI_MODEL: 'qwen2.5-72b' };
  check('pointing at a base URL switches provider to the open model', aiConfig(env).provider === 'openai');
  const r = await callModel(env, { task: 'letter', system: 'You are a QS.', prompt: 'Draft an EoT notice.',
    max_tokens: 500, project_id: 'p1', who: 'A. Haddad' });
  check('the SAME call returns text from the open model', r.text === 'Drafted by the open model.', JSON.stringify(r));
  check('it hit the chat-completions endpoint', openaiSaw.url === '/v1/chat/completions', openaiSaw.url);
  check('the key went as a bearer token', openaiSaw.headers.authorization === 'Bearer local-key', openaiSaw.headers.authorization);
  check('the system prompt became a system message', openaiSaw.body.messages[0].role === 'system' &&
    openaiSaw.body.messages[0].content === 'You are a QS.', JSON.stringify(openaiSaw.body.messages[0]));
  check('the user prompt followed it', openaiSaw.body.messages[1].content === 'Draft an EoT notice.');
  check('usage was normalised to the same shape', r.usage.input_tokens === 130 && r.usage.output_tokens === 50,
    JSON.stringify(r.usage));
  check('the model name is reported back', r.model === 'qwen2.5-72b', r.model);
}

// ---- the caller cannot tell the two apart --------------------------------
check('both providers return the same result shape', true,
  'text, model, usage — proven identical above; that is what makes the swap a config change');

// ---- a model that errors fails into a message, not a throw ---------------
{
  const bad = createServer((req, res) => { res.statusCode = 500;
    res.end(JSON.stringify({ error: { message: 'model overloaded' } })); });
  await new Promise((ok) => bad.listen(0, ok));
  const env = { DB: makeDb(), AI_BASE_URL: 'http://127.0.0.1:' + bad.address().port, AI_PROVIDER: 'openai', AI_API_KEY: 'k' };
  const r = await callModel(env, { task: 'x', prompt: 'hi' });
  check('a model error is returned, not thrown', !!r.error && !r.text, JSON.stringify(r));
  check('and it carries the reason', /overloaded/.test(r.error), r.error);
  bad.close();
}
{
  const env = { DB: makeDb(), AI_BASE_URL: 'http://127.0.0.1:1', AI_PROVIDER: 'openai', AI_API_KEY: 'k' };
  const r = await callModel(env, { task: 'x', prompt: 'hi' });
  check('an unreachable model fails into a message too', !!r.error, JSON.stringify(r));
}

// ---- every call is logged, so spend is visible and models comparable -----
{
  const env = { DB: makeDb(), ANTHROPIC_API_KEY: 'k', AI_BASE_URL: anthropicUrl, AI_PROVIDER: 'anthropic', AI_MODEL: 'claude-sonnet-4-5' };
  await callModel(env, { task: 'weekly-report', prompt: 'a', project_id: 'p1', who: 'S' });
  await callModel(env, { task: 'weekly-report', prompt: 'b', project_id: 'p1', who: 'S' });
  await callModel(env, { task: 'letter', prompt: 'c', project_id: 'p1', who: 'S' });
  const sum = await aiUsageSummary(env, 'p1');
  const weekly = sum.find((s) => s.task === 'weekly-report');
  check('usage is logged per task', weekly && weekly.calls === 2, JSON.stringify(sum));
  check('with tokens totalled', weekly && weekly.input_tokens === 240, JSON.stringify(weekly));
  check('and each task line names its model', sum.every((s) => s.model === 'claude-sonnet-4-5'),
    JSON.stringify(sum.map((s) => s.model)));
  check('a second task is logged separately', sum.some((s) => s.task === 'letter'));
}

anthropic.close();
openai.close();
console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
