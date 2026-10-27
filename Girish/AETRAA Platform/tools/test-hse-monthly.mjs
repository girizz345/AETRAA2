// STEP 9 — the monthly HSE figures, from live records.
//
//   node tools/test-hse-monthly.mjs
//
// Every figure below was worked out by hand first.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { buildReport, reportHTML } from '../src/report.js';
import { classOf } from '../src/hse-monthly.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + String(d).slice(0, 300) : '')); if (!c) fails++; };
const near = (a, b, e = 0.01) => a != null && Math.abs(a - b) < e;
const T = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const monthOf = (k) => { const d = new Date(Date.UTC(Number(T.slice(0, 4)), Number(T.slice(5, 7)) - 1 - k, 1)); return d.toISOString().slice(0, 7); };
const MK = monthOf(1), MK2 = monthOf(2);                  // last month, and the month before
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
// four working days (not Friday) early in last month
const days = []; for (let n = 3; days.length < 5; n++) { const d = MK + '-' + String(n).padStart(2, '0'); if (dow(d) !== 5) days.push(d); }
const [dA, dB, dC, dD, dE] = days;

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
function stmt(sql) {
  const st = db.prepare(sql); let args = [];
  const api = {
    bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args), success: true }; },
    async first(col) { const r = st.get(...args) ?? null; return col && r ? r[col] : r; },
    async run() { st.run(...args); return { success: true, meta: {} }; },
  };
  return api;
}
const env = {
  DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; }, async exec(s) { db.exec(s); } },
  OWNER_CODE: 'MASTERCODE-0123456789', LOGIN_TEST_CODE: '246810', AUTH_SECRET: 'x'.repeat(40),
};
const worker = (await import('../src/index.js')).default;
let cookie = '';
async function call(path, body) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request('http://localhost' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((x) => x.split(';')[0].trim()).join('; ');
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json };
}
const as = async (email) => { cookie = ''; return (await call('/api/signin/code', { email, code: '246810' })).json?.ok; };

check('classification reads the incident type', classOf('Lost-time injury') === 'lti' && classOf('Medical treatment') === 'mtc' && classOf('Near-miss') === 'nm' && classOf('x') === 'other');

await call('/api/login', { code: 'MASTERCODE-0123456789' });
let r = await call('/api/setup/onboard', { company: { name: 'NAF' }, project: { name: 'Tower A' }, principal: { name: 'M. Boss', email: 'boss@naf.ae' } });
const P = r.json.project_id;
db.prepare('UPDATE projects SET created_at = ? WHERE id = ?').run(MK2 + '-01T00:00:00Z', P);
r = await call('/api/setup/payment-terms', { project_id: P, terms: { hse_hours_per_day: 30 } });
check('hours in a day over 24 refused', r.status === 400);
r = await call('/api/setup/payment-terms', { project_id: P, terms: { hse_hours_per_day: 9 } });
check('a 9-hour standard day saved', r.json.ok, r.text);
for (const [n, e, f] of [['S. Farouk', 'hse@naf.ae', ['hse']], ['D. Okafor', 'des@naf.ae', ['design']], ['A. Haddad', 'pm@naf.ae', ['pm']]]) {
  await call('/api/person', { name: n, email: e, functions: f, projects: [P] });
}

// ---- man-hours, each day from the best record it has (H = 9)
await as('hse@naf.ae');
r = await call('/api/hse/log', { log_date: shiftDay(T, 1), men_on_site: 5 });
check('a log for tomorrow is refused', r.status === 400, r.text);
r = await call('/api/hse/log', { log_date: dA, men_on_site: 10, man_hours: 400 });
check('more man-hours than the men could work is refused', r.status === 400 && /more man-hours/.test(r.json.error));
await call('/api/hse/log', { log_date: dA, men_on_site: 120, man_hours: 1000, toolbox_talks: 2, toolbox_attended: 40, inductions: 3, ppe_checked: 50, ppe_compliant: 48 });   // 1000 (time sheets)
db.prepare(`INSERT INTO diary (project_id, report_date, staff, subs, status) VALUES (?,?,?,?,'submitted')`)
  .run(P, dB, JSON.stringify([{ t: 'Mason', n: 10, h: 8 }, { t: 'Helper', n: 5 }]), JSON.stringify([{ n: 'Sub', c: '4' }]));          // 80 + 45 + 36 = 161
await call('/api/hse/log', { log_date: dC, men_on_site: 20, toolbox_talks: 1, toolbox_attended: 20 });                            // 180 (head count)
const mp = db.prepare(`INSERT INTO manpower (project_id, report_date, trade, headcount, created_at) VALUES (?,?,?,?,'x')`);
mp.run(P, dC, 'Mason', 50);                                                                                                        // head count wins over this
mp.run(P, dD, 'Mason', 30);                                                                                                        // 270 (manpower return)
await call('/api/hse/log', { log_date: MK2 + '-10', man_hours: 5000 });                                                            // the month before

function shiftDay(d, n) { return new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }

// ---- incidents, dated when they happened
const inc = async (type, date, extra) => (await call('/api/records', { type: 'incident', title: type + ' ' + date, data: { Type: type, 'Date of incident': date, 'What happened': 'x', ...(extra || {}) } })).json.ref;
await inc('Lost-time injury', dC, { 'Days lost (lost-time injury)': '3' });            // the form's own label
await inc('Medical treatment', dD);
await inc('Near-miss', dB);
await inc('First aid', dB);
await inc('First aid', MK2 + '-12');
// observations: two raised in the month, one closed; one high risk still open
const obs = async (title, risk) => (await call('/api/records', { type: 'obs', title, data: { Finding: title, Risk: risk } })).json.ref;
const o1 = await obs('Missing edge protection', 'High'), o2 = await obs('Housekeeping', 'Low');
db.prepare(`UPDATE records SET submitted = ? WHERE ref IN (?, ?) AND project_id = ?`).run(dB, o1, o2, P);
const wf = JSON.parse(db.prepare('SELECT workflow FROM records WHERE ref = ?').get(o2).workflow);
wf.forEach((s, i) => { s.state = 'done'; s.when = i === wf.length - 1 ? dD + ' 10:00' : dB + ' 09:00'; });
db.prepare('UPDATE records SET workflow = ?, step = ?, status = ? WHERE ref = ?').run(JSON.stringify(wf), wf.length - 1, 'Closed', o2);
// permits in the month
for (const t of ['Hot work', 'Lifting']) {
  const ref = (await call('/api/records', { type: 'ptw', title: t, data: { 'Activity / type': t, Location: 'L2' } })).json.ref;
  db.prepare('UPDATE records SET submitted = ? WHERE ref = ?').run(dC, ref);
}

// ---- the report
const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(P);
const d = await buildReport(env, P, project, 'hse', MK);
const h = d.hse;
check('man-hours this month: 1,000 + 161 + 180 + 270 = 1,611', h.man_hours.period === 1611, h.man_hours.period);
check('…and to date with last-but-one month: 6,611', h.man_hours.to_date === 6611, h.man_hours.to_date);
check('basis counted day by day', JSON.stringify(h.man_hours.basis) === JSON.stringify({ hse: 1, diary: 1, headcount: 1, manpower: 1 }), JSON.stringify(h.man_hours.basis));
const monthEnd = new Date(Date.UTC(Number(MK.slice(0, 4)), Number(MK.slice(5)), 0)).toISOString().slice(0, 10);
let working = 0; for (let n = 1; ; n++) { const dd = MK + '-' + String(n).padStart(2, '0'); if (dd > monthEnd) break; if (dow(dd) !== 5) working++; }
check('working days with no record are listed as gaps', h.man_hours.gaps.length === working - 4 && !h.man_hours.gaps.includes(dA), h.man_hours.gaps.length + ' vs ' + (working - 4));
check('incidents by classification this month', h.incidents.period.lti === 1 && h.incidents.period.mtc === 1 && h.incidents.period.nm === 1 && h.incidents.period.fac === 1, JSON.stringify(h.incidents.period));
check('…and to date (the earlier first aid)', h.incidents.to_date.fac === 2);
check('days lost 3', h.incidents.days_lost_period === 3 && h.incidents.days_lost_to_date === 3);
check('LTIFR month = 1 × 1,000,000 / 1,611 = 620.73', near(h.rates.ltifr_period, 620.73), h.rates.ltifr_period);
check('LTIFR to date = 1,000,000 / 6,611 = 151.26', near(h.rates.ltifr_to_date, 151.26), h.rates.ltifr_to_date);
check('TRIR month = 2 × 200,000 / 1,611 = 248.29', near(h.rates.trir_period, 248.29), h.rates.trir_period);
check('TRIR to date = 400,000 / 6,611 = 60.51', near(h.rates.trir_to_date, 60.51), h.rates.trir_to_date);
check('severity to date = 3 × 200,000 / 6,611 = 90.76', near(h.rates.severity_to_date, 90.76), h.rates.severity_to_date);
check('last LTI and the days since it', h.last_lti === dC && h.days_since_lti === Math.round((Date.parse(monthEnd) - Date.parse(dC)) / 86400000));
check('safe man-hours since the LTI: only the day after it (270)', h.man_hours.safe_since_lti === 270, h.man_hours.safe_since_lti);
const L = h.leading;
check('toolbox talks 3 (60 attended), inductions 3', L.toolbox_talks === 3 && L.toolbox_attended === 60 && L.inductions === 3, JSON.stringify(L));
check('PPE 48 of 50 = 96%', L.ppe_pct === 96);
check('observations: 2 raised, 1 closed, 1 open and it is high risk', L.obs_raised === 2 && L.obs_closed === 1 && L.obs_open === 1 && L.obs_high_open === 1, JSON.stringify(L));
check('average days to close', L.obs_avg_close_days === Math.round((Date.parse(dD) - Date.parse(dB)) / 86400000 * 10) / 10);
check('permits by type', L.permits === 2 && L.permit_types['Hot work'] === 1 && L.permit_types.Lifting === 1);
check('twelve months of trend, ending with this month', h.trend.length === 12 && h.trend[11].month === MK && h.trend[11].man_hours === 1611 && h.trend[10].man_hours === 5000, JSON.stringify(h.trend.slice(-2)));
check('cumulative LTIFR in the trend matches to-date', near(h.trend[11].ltifr_cum, h.rates.ltifr_to_date));
const html = reportHTML(d);
check('report renders the rates, the incidents and the trend', /Lost-time injury frequency rate/.test(html) && /Last twelve months/.test(html) && html.includes('1,611'));
check('…and says where the man-hours came from', /1 day from HSE time sheets, 1 from the site diary, 1 from HSE's head count × 9 h, 1 from site's manpower return × 9 h/.test(html.replace(/&#39;/g, "'")), html.match(/Man-hours:[^<]*/));
check('…and warns about the days with no record', /no man-hours record/.test(html));

// ---- through the API
r = await call('/api/report?kind=hse&key=' + MK);
check('HSE opens the HSE report', r.status === 200 && /Monthly HSE report/.test(r.text));
r = await call('/api/report?kind=hse&key=' + MK + '&format=doc');
check('…and downloads it as Word', r.status === 200 && /LTIFR|frequency rate/.test(r.text));
await as('des@naf.ae');
check('Design does not', (await call('/api/report?kind=hse&key=' + MK)).status === 401);
await as('pm@naf.ae');
const mo = await buildReport(env, P, project, 'monthly', MK);
check('the monthly progress report carries an HSE section', mo.hse && mo.hse.man_hours.period === 1611 && /Health &amp; safety/.test(reportHTML(mo)));
const empty = await buildReport(env, P, project, 'hse', monthOf(6));
check('a month with nothing recorded shows dashes, not zeros', empty.hse.rates.ltifr_period === null && /No man-hours|no man-hours record/.test(reportHTML(empty)));

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
