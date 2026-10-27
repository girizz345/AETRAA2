// K13 (A12) · v5 A12: the site diary — prepared by Document Control or the
// person the PM assigns, typed or from a scanned site sheet; the AI prepares
// it on screen with AI on, it is written by hand with AI off, and the AI never
// saves or submits it; a problems field on the screen and both prints; the
// 6 pm reminder to the preparer and the next-morning one to the PM, each once.
//   node tools/test-k13-diary.mjs
import { db, env, mail, call, admin, as, check, done, onboard } from './_harness.mjs';
import { shapeDiary, applyDraft, runDiaryReminders, rosterName } from '../src/diary-ai.js';
import { DEFAULT_TRADES, DEFAULT_PLANT, DEFAULT_MATERIALS } from '../src/diary.js';
import { unzipSync, strFromU8 } from 'fflate';

const worker = (await import('../src/index.js')).default;
const { diaryReminderDeps } = await import('../src/index.js');
const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const day = (n) => new Date(Date.parse(today) + n * 86400000).toISOString().slice(0, 10);
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const yday = day(-1), D2 = day(-2);
const OFF = String((dow(today) + 3) % 7);          // the site's day off: not today or the three days before
const sent = [];
let ANSWER = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com/v1/messages')) {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(ANSWER) }], usage: { input_tokens: 700, output_tokens: 250 } }), { status: 200 });
  }
  return realFetch(url, init);
};
const row = (pid, d) => db.prepare('SELECT * FROM diary WHERE project_id = ? AND report_date = ?').get(pid, d);
const fire = async (cron) => { const ps = []; await worker.scheduled({ cron, scheduledTime: Date.now() }, env, { waitUntil(p) { ps.push(p); }, passThroughOnException() {} }); await Promise.all(ps); };
const diaryMail = (from) => mail.slice(from).filter((m) => /site diary/i.test(String(m.subject || '')));
const roster = { trades: DEFAULT_TRADES, plant: DEFAULT_PLANT.map((t) => ({ t })), materials: DEFAULT_MATERIALS, subcontractors: ['Al Noor Scaffolding'] };

console.log('— the AI’s lines put on the project’s roster, by rule —');
const sd = shapeDiary({ weather: ['sunny', 'windy'], manpower: [{ trade: 'masons', count: 12 }, { trade: 'Steel fixers', count: '6', hours: '10' }, { trade: 'Tile setter', count: 2 }, { trade: 'Helper', count: 'twelve' }],
  plant: [{ item: 'mobile crane', count: 1 }], subcontractors: [{ name: 'al noor scaffolding', trade: 'Scaffolders', count: 5 }],
  materials: [{ material: 'steel reinforcement', quantity: '4', unit: 'kg', supplier: 'Emirates Steel' }, { material: 'Gypsum board', quantity: '40', unit: 'sheet' }],
  visitors: 'Consultant RE 10:00', problems: 'Concrete pump broke down 2 hrs', tomorrow: [{ activity: 'L4 slab pour', quantity: '120' }] }, roster);
check('a trade written another way is the roster’s; one not on it is kept as written and listed', sd.staff.some((s) => s.t === 'Mason' && s.n === 12) && sd.staff.some((s) => s.t === 'Steel Fixer' && s.n === 6 && s.h === '10')
  && sd.staff.some((s) => s.t === 'Tile setter') && sd.notes.some((n) => /Tile setter.*not on the project/.test(n)));
check('a count that is not a number is left out and said so', !sd.staff.some((s) => s.t === 'Helper') && sd.notes.some((n) => /Helper.*not a number/.test(n)));
check('weather from the five; plant and the subcontractor on the roster', sd.weather === 'Sunny, Windy' && sd.plant[0].t === 'Mobile crane' && sd.subs[0].n === 'Al Noor Scaffolding' && sd.subs[0].c === '5');
check('a material in another unit than the project measures it in is flagged', sd.materials[0].m === 'Steel reinforcement' && sd.materials[0].u === 'ton' && sd.notes.some((n) => /given in kg/.test(n)) && sd.materials[1].m === 'Gypsum board');
check('two roster names that both fit are no match', rosterName('concrete', ['Ready-mix concrete C25', 'Ready-mix concrete C32']) === null);
const merged = applyDraft({ staff: [{ t: 'Mason', n: 3, h: '' }, { t: 'Helper', n: 4, h: '' }], plant: [], materials: [{ m: 'Cement', q: '50', u: 'bag', dn: 'DN-1', src: 'dn' }], remarks: 'Gate 2 shut' }, sd, roster);
check('laid over the day: given trades replace the count, a trade not given is 0, deliveries kept and added to', merged.staff.find((s) => s.t === 'Mason').n === 12 && merged.staff.find((s) => s.t === 'Helper').n === 0
  && merged.materials.length === 3 && merged.materials[0].dn === 'DN-1' && merged.problems === 'Concrete pump broke down 2 hrs' && merged.remarks === 'Gate 2 shut');

const { pid, oid } = await onboard('Tower K13D', 'TKD-0001', [['The DC', 'dc@tk13d.test', ['dc']], ['The PM', 'pm@tk13d.test', ['pm']], ['Sam Site', 'sam@tk13d.test', ['site']],
  ['The QAQC', 'qa@tk13d.test', ['qaqc']], ['The Finance', 'fin@tk13d.test', ['finance']], ['The Consultant', 'c@tk13d.test', ['consultant']]]);
const { pid: pid2 } = await onboard('Tower Q13D', 'TQD-0001', [['Other DC', 'dc@tq13d.test', ['dc']], ['Other PM', 'pm@tq13d.test', ['pm']]]);
const uid = (e) => db.prepare('SELECT id FROM users WHERE email = ?').get(e).id;
const tenAgo = new Date(Date.now() - 10 * 86400000).toISOString();
db.prepare('UPDATE projects SET created_at = ?, diary_off_days = ? WHERE id IN (?, ?)').run(tenAgo, OFF, pid, pid2);

console.log('\n— AI off: by hand, as before, with problems —');
await as('dc@tk13d.test');
let r = await call('/api/diary?date=' + D2);
check('Document Control prepares it while nobody is assigned; AI off', r.status === 200 && r.json.a12.assigned === false && r.json.a12.preparers.some((u) => u.name === 'The DC') && r.json.a12.ai_on === false && r.json.a12.may_assign === false);
r = await call('/api/diary/ai-draft', { date: D2, notes: '12 masons' });
check('with AI off, preparing is refused and nothing is written', r.status === 400 && r.json.disabled && !row(pid, D2));
r = await call('/api/diary', { report_date: D2, weather: 'Sunny', staff: [{ t: 'Mason', n: 3 }, { t: 'Helper', n: 4 }], materials: [{ m: 'Cement', q: '50', u: 'bag', dn: 'DN-1', src: 'dn' }],
  prepared_by: 'The DC', problems: 'Water tanker late — curing held 1 hr' });
check('written by hand with a problem', r.status === 200 && row(pid, D2).problems === 'Water tanker late — curing held 1 hr');
r = await call('/api/diary?date=' + D2);
check('the problem comes back on the screen', r.json.problems === 'Water tanker late — curing held 1 hr');
r = await call('/diary/doc?date=' + D2);
check('and on the printed sheet', r.status === 200 && r.text.includes('PROBLEMS') && r.text.includes('Water tanker late'));
r = await call('/diary/docx?date=' + D2);
const docx = r.bytes[0] === 0x50 && r.bytes[1] === 0x4b ? Object.values(unzipSync(r.bytes)).map((b) => strFromU8(b)).join(' ') : r.text;
check('and in the Word copy', r.status === 200 && docx.includes('PROBLEMS') && docx.includes('Water tanker late'));
await as('pm@tk13d.test');
r = await call('/api/diary', { report_date: D2, submit: true });
check('the PM submits it with no works described (v5: no work-done section for now)', r.status === 200 && row(pid, D2).status === 'submitted', r.text.slice(0, 200));

console.log('\n— the PM assigns who prepares it —');
await as('dc@tk13d.test');
r = await call('/api/diary/assignee', { user_id: uid('sam@tk13d.test') });
check('Document Control cannot assign', r.status === 403);
await as('pm@tk13d.test');
r = await call('/api/diary?date=' + today);
check('the PM may, from the people who can write the diary', r.json.a12.may_assign && r.json.a12.team.some((u) => u.name === 'Sam Site') && !r.json.a12.team.some((u) => u.name === 'The Consultant'));
r = await call('/api/diary/assignee', { user_id: uid('c@tk13d.test') });
check('not the consultant', r.status === 400);
r = await call('/api/diary/assignee', { user_id: uid('dc@tq13d.test') });
check('not somebody from another company', r.status === 400 && /not on this project/.test(r.json.error));
r = await call('/api/diary/assignee', { user_id: uid('sam@tk13d.test'), project_id: pid2 });
check('a project id in the body is only a claim', r.status === 403);
r = await call('/api/diary/assignee', { user_id: uid('sam@tk13d.test') });
check('Sam Site is assigned', r.status === 200 && r.json.assignee.name === 'Sam Site' && db.prepare('SELECT diary_assignee FROM projects WHERE id = ?').get(pid).diary_assignee === uid('sam@tk13d.test'));
check('and it is in the audit trail', db.prepare("SELECT COUNT(*) AS n FROM audit WHERE action = 'diary.assignee' AND project_id = ?").get(pid).n === 1);
db.prepare("UPDATE users SET record_types = '[\"rfi\"]' WHERE email IN ('sam@tk13d.test', 'qa@tk13d.test')").run();
await as('qa@tk13d.test');
r = await call('/api/diary', { report_date: D2, remarks: 'x' });
check('someone off the diary’s workflow still cannot write it', r.status === 403);
await as('sam@tk13d.test');
r = await call('/api/diary?date=' + today);
check('the assignee sees it is theirs', r.json.a12.assigned && r.json.a12.preparers[0].name === 'Sam Site' && !r.json.a12.may_assign);

console.log('\n— AI on: prepared on screen, saved by the person, submitted by the PM —');
env.ANTHROPIC_API_KEY = 'test-key';
ANSWER = { weather: ['Sunny'], manpower: [{ trade: 'Masons', count: 12 }, { trade: 'Steel Fixer', count: 6, hours: '10' }], plant: [{ item: 'Mobile crane', count: 1 }],
  materials: [{ material: 'Ready-mix concrete C32', quantity: '20', unit: 'm³', supplier: 'Unibeton' }], visitors: 'Consultant RE at 10:00',
  problems: 'Concrete pump broke down 10:00–12:00', tomorrow: [{ activity: 'L4 slab pour', quantity: '' }], submit: true, status: 'submitted' };
const D3 = day(-3);
await call('/api/diary', { report_date: D3, weather: 'Cloudy', staff: [{ t: 'Mason', n: 3 }, { t: 'Helper', n: 4 }], materials: [{ m: 'Cement', q: '50', u: 'bag', dn: 'DN-7', src: 'dn' }], prepared_by: 'Sam Site' });
const before = JSON.stringify(row(pid, D3));
await as('fin@tk13d.test');
r = await call('/api/diary/ai-draft', { date: D3, notes: 'x' });
check('Finance does not prepare the diary', r.status === 401 || r.status === 403);
await as('c@tk13d.test');
r = await call('/api/diary/ai-draft', { date: D3, notes: 'x' });
check('nor the consultant', r.status === 401 || r.status === 403);
await as('sam@tk13d.test');
const n0 = sent.length;
r = await call('/api/diary/ai-draft', { date: D3, notes: 'Sunny. 12 masons, 6 steel fixers 10 hrs. Mobile crane. 20 m3 C32 from Unibeton. Consultant RE 10:00. Pump broke down 10-12. Tomorrow L4 slab pour.' });
const M = r.json.diary;
check('the assignee — off the diary’s workflow — has it prepared from typed notes', r.status === 200 && r.json.from === 'the notes' && M.weather === 'Sunny', r.text.slice(0, 300));
check('the manpower is the notes’ (Helper 0), the delivery note’s line kept, the AI’s added', M.staff.find((s) => s.t === 'Mason').n === 12 && M.staff.find((s) => s.t === 'Helper').n === 0
  && M.materials.some((m) => m.dn === 'DN-7') && M.materials.some((m) => m.m === 'Ready-mix concrete C32' && m.s === 'Unibeton'));
check('visitors, problems and tomorrow’s plan filled; no works drafted', M.visitors === 'Consultant RE at 10:00' && /pump broke down/.test(M.problems) && M.tomorrow[0].a === 'L4 slab pour' && !(M.works || []).length);
check('the notes went as text, with the roster to match against', typeof sent[n0].messages[0].content === 'string' && /12 masons/.test(sent[n0].messages[0].content) && /Steel Fixer/.test(sent[n0].messages[0].content));
check('nothing was saved or submitted by the AI', JSON.stringify(row(pid, D3)) === before && row(pid, D3).status === 'draft');
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
r = await call('/api/diary/ai-draft', { date: D3, file: { filename: 'site sheet.png', data: Buffer.from(png).toString('base64') } });
const blocks = sent[sent.length - 1].messages[0].content;
check('a scanned site sheet goes to the model as the picture', r.status === 200 && r.json.from === 'the scanned sheet' && Array.isArray(blocks) && blocks.some((b) => b.type === 'image'));
r = await call('/api/diary', { report_date: D3, weather: M.weather, staff: M.staff, plant: M.plant, materials: M.materials, tomorrow: M.tomorrow, visitors: M.visitors, problems: M.problems, prepared_by: 'Sam Site' });
check('the assignee saves what the AI prepared', r.status === 200 && row(pid, D3).status === 'draft' && row(pid, D3).problems === M.problems && JSON.parse(row(pid, D3).staff).find((s) => s.t === 'Mason').n === 12);
r = await call('/api/diary', { report_date: D3, submit: true });
check('submitting is the PM’s', r.status === 401 && row(pid, D3).status === 'draft');
await as('pm@tk13d.test');
r = await call('/api/diary', { report_date: D3, submit: true });
check('the PM submits', r.status === 200 && row(pid, D3).status === 'submitted');
check('every AI call went through the one door and is in the audit trail', db.prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE task = 'a12-diary'").get().n === sent.length && sent.length === 2
  && db.prepare("SELECT COUNT(*) AS n FROM audit WHERE action = 'ai.diary.draft'").get().n === 2);

console.log('\n— 6 pm: today not saved, the preparer told, once —');
await as('dc@tq13d.test');
await call('/api/diary', { report_date: yday, weather: 'Sunny', staff: [{ t: 'Mason', n: 2 }], prepared_by: 'Other DC' });
let m0 = mail.length;
await fire('0 14 * * *');
let got = diaryMail(m0);
check('the assigned person is told today’s diary is not saved', got.some((m) => JSON.stringify(m.to).includes('sam@tk13d.test') && /not saved/.test(m.subject)) && !got.some((m) => JSON.stringify(m.to).includes('dc@tk13d.test')), JSON.stringify(got.map((m) => [m.to, m.subject])));
check('where nobody is assigned, Document Control is', got.some((m) => JSON.stringify(m.to).includes('dc@tq13d.test')));
m0 = mail.length;
await fire('0 14 * * *');
check('and only once', diaryMail(m0).length === 0);
await as('sam@tk13d.test');
await call('/api/diary', { report_date: today, weather: 'Sunny', staff: [{ t: 'Mason', n: 5 }], prepared_by: 'Sam Site' });
const deps = { ...diaryReminderDeps(env), mailer: async () => ({ ok: true }) };
let res = await runDiaryReminders(env, day(3), 'evening', deps);
check('no reminder on the site’s day off', !res.some((x) => x.project === pid));
db.prepare("DELETE FROM notify_log WHERE rule = 'diary-6pm'").run();
res = await runDiaryReminders(env, today, 'evening', deps);
check('a saved draft is saved: no reminder', !res.some((x) => x.project === pid));

console.log('\n— the next morning: still not saved, the PM told, once —');
m0 = mail.length;
await fire('0 2 * * *');
got = diaryMail(m0);
check('the PM is told yesterday’s diary was not saved, naming who prepares it', got.some((m) => JSON.stringify(m.to).includes('pm@tk13d.test') && /no site diary was saved/.test(m.subject) && /Sam Site/.test(m.html)), JSON.stringify(got.map((m) => [m.to, m.subject])));
check('not where yesterday’s diary was saved', !got.some((m) => JSON.stringify(m.to).includes('pm@tq13d.test')));
m0 = mail.length;
await fire('0 2 * * *');
check('and only once', diaryMail(m0).length === 0);

console.log('\n— the walls —');
await as('dc@tq13d.test');
r = await call('/api/diary?date=' + D3);
check('another company sees none of it', r.status === 200 && !r.json.exists);
await admin();
await call('/api/setup/modules', { project_id: pid, modules: ['core', 'planning', 'site', 'design', 'dc', 'registers', 'gate', 'meetings'] });
await as('sam@tk13d.test');
r = await call('/api/diary/ai-draft', { date: D3, notes: 'x' });
check('with the AI module off, preparing is refused', r.status === 403);
r = await call('/api/diary', { report_date: today, remarks: 'by hand' });
check('and the diary is still written by hand', r.status === 200);
done();
