// G14 / A14: ask the project — only what the person may see, links to the
// records used, read-only, daily limits, every question logged with its cost.
//   node tools/test-g14-ask.mjs
import { db, env, call, admin, as, check, done, onboard } from './_harness.mjs';

const { pid } = await onboard('Tower Q', 'TWQ-0001', [['Q PM', 'pm@towerq.test', ['pm']], ['Q QA', 'qa@towerq.test', ['qaqc']], ['Q HSE', 'hse@towerq.test', ['hse']]]);
await call('/api/records?project=' + pid);
const ir = db.prepare('INSERT INTO records (id, project_id, type, no, ref, title, status, data, workflow, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
ir.run('r1', pid, 'rfi', 1, 'RFI-0001', 'Substation energisation date', 'With consultant', '{"Question":"When will DEWA energise the substation?"}', '[]', '2026-09-01');
ir.run('r2', pid, 'letter', 1, 'LTR-001', 'Substation access delay notice', 'Issued', '{}', '[]', '2026-09-02');
ir.run('r3', pid, 'ncr', 1, 'NCR-001', 'Honeycombing at substation plinth', 'Open', '{}', '[]', '2026-09-03');
ir.run('r4', pid, 'ptw', 1, 'PTW-001', 'Hot work permit at substation', 'Approved', '{}', '[]', '2026-09-04');
await admin();
await call('/api/boq/import', { project_id: pid, rows: [{ section: 'Electrical', ref: 'E1', description: 'Substation transformer supply and install', unit: 'no', qty: 1, rate: 100000 }] });

const ask = async (q) => (await call('/api/ask', { question: q }));
const refs = (r) => (r.json.sources || []).map((s) => s.ref).sort();

console.log('— only what the person may see —');
await as('pm@towerq.test');
let r = await ask('What is happening with the substation?');
check('the PM sees records from every dashboard', JSON.stringify(refs(r)) === JSON.stringify(['E1', 'LTR-001', 'NCR-001', 'PTW-001', 'RFI-0001']), refs(r));
check('with AI off, the matching records are listed with links', r.json.answer === null && /AI is off/.test(r.json.note) && r.json.sources.every((s) => s.link), r.text.slice(0, 300));
await as('qa@towerq.test');
r = await ask('What is happening with the substation?');
check('QA/QC sees the NCR, not the letter, the permit, the RFI or the BOQ', JSON.stringify(refs(r)) === JSON.stringify(['NCR-001']), refs(r));
await as('hse@towerq.test');
r = await ask('substation');
check('HSE sees the permit only', JSON.stringify(refs(r)) === JSON.stringify(['PTW-001']), refs(r));
r = await ask('What is the rate for the transformer?');
check('nothing it may not see leaks through', (r.json.sources || []).length === 0 && /Nothing you have access to/.test(r.json.note), r.text);

console.log('\n— the answer, with AI —');
env.ANTHROPIC_API_KEY = 'test';
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com/')) {
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'RFI-0001 asks DEWA for the energisation date and is with the consultant [RFI-0001]. See also [XYZ-999].' }],
      usage: { input_tokens: 100, output_tokens: 30 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, init);
};
await as('pm@towerq.test');
r = await ask('When will the substation be energised?');
check('the answer comes back', /energisation date/.test(r.json.answer || ''), r.text.slice(0, 300));
check('it links only the records it cited, and drops an invented reference', JSON.stringify(refs(r)) === JSON.stringify(['RFI-0001']), refs(r));
check('the answer is not stored', db.prepare('SELECT COUNT(*) AS n FROM ask_log WHERE question LIKE ?').get('%energised%').n === 1 &&
  !JSON.stringify(db.prepare('SELECT * FROM ask_log').all()).includes('energisation date and is'));
const ai = db.prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE task = 'ask-the-project'").get().n;
check('the AI call is logged with its tokens (cost)', ai >= 1);
check('nothing was changed', db.prepare("SELECT status FROM records WHERE id = 'r1'").get().status === 'With consultant');

console.log('\n— daily limits —');
delete env.ANTHROPIC_API_KEY;
await as('hse@towerq.test');
let last;
for (let i = 0; i < 18; i++) last = await ask('permit question ' + i);   // HSE asked twice above
check('everyone else has 20 a day', last.status === 200 && last.json.used === 20 && last.json.limit === 20, last.text.slice(0, 200));
r = await ask('one more permit question');
check('the 21st is refused with the limit', r.status === 429 && /20 questions/.test(r.json.error), r.text);
await as('pm@towerq.test');
r = await ask('substation again');
check('the PM has 30', r.json.limit === 30);
check('every question is logged', db.prepare('SELECT COUNT(*) AS n FROM ask_log WHERE project_id = ?').get(pid).n === 24);
r = await call('/ask');
check('the page opens', r.status === 200 && r.text.includes('Ask the project'));
done();
