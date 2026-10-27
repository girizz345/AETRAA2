// X1: every downloaded schedule, log and tracker starts with the same header.
//   node tools/test-x1-header.mjs
import { db, call, admin, check, done, onboard, xlsxText } from './_harness.mjs';
import { applyHeader, headerRows } from '../src/xlsx.js';

// A 1x1 PNG, as the company logo.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const { pid, oid } = await onboard('Tower X', 'TWX-0001');
db.prepare(`UPDATE projects SET client_name = 'Dubai Holding', engineer_name = 'Consult Co', contractor_name = 'Build Co',
  contract_ref = 'C-2026-77', data_date = '2026-09-30' WHERE id = ?`).run(pid);
try { db.exec('ALTER TABLE projects ADD COLUMN plot_numbers TEXT'); } catch (e) {}
db.prepare("UPDATE projects SET plot_numbers = '3456789' WHERE id = ?").run(pid);
db.prepare('UPDATE orgs SET logo = ? WHERE id = ?').run('data:image/png;base64,' + PNG, oid);

console.log('\n— the header itself —');
const h = { title: 'RFI register', project: 'Tower X', ref: 'TWX-0001', plot: '3456789', client: 'Dubai Holding',
  consultant: 'Consult Co', contractor: 'Build Co', contract_no: 'C-2026-77', as_at: '2026-10-06 12:00 (UAE)',
  dated: true, data_date: '2026-09-30', downloaded_by: 'Jane DC' };
const rows = headerRows(h).map((r) => (r[0] && r[0].v) || r[0] || '');
for (const want of ['RFI register', 'Project: Tower X', 'Project ref / plot: TWX-0001 · 3456789', 'Client: Dubai Holding',
  'Consultant: Consult Co', 'Contractor: Build Co', 'Contract no.: C-2026-77', 'As at: 2026-10-06 12:00 (UAE)',
  'Programme data date: 2026-09-30', 'Downloaded by: Jane DC']) check('has "' + want + '"', rows.includes(want), rows);
check('the data date is left out of an undated log', !headerRows({ ...h, dated: false }).some((r) => String(r[0] || '').startsWith('Programme data date')));
check('a blank field shows a dash, not nothing', headerRows({ title: 'X' }).some((r) => r[0] === 'Client: —'));
const sheet = { name: 'S', freeze: 6, rows: [[{ v: 'Old title', s: 'title' }], [{ v: 'old as at', s: 'muted' }], [], [], [{ v: 'Ref', s: 'head' }], ['RFI-0001']] };
const out = applyHeader(sheet, h);
check('the sheet’s own title lines are replaced', !out.rows.some((r) => r[0] && r[0].v === 'Old title'));
check('the column headings and rows are kept', out.rows.some((r) => r[0] && r[0].v === 'Ref') && out.rows.some((r) => r[0] === 'RFI-0001'));
check('the frozen rows still end at the headings', out.rows[out.freeze - 2][0].v === 'Ref', out.freeze);

console.log('\n— every download carries it —');
await admin();
const reg = await call('/api/register/xlsx?reg=rfi&project=' + pid);
const dwg = await call('/api/register/xlsx?reg=drawings&project=' + pid);
const sch = await call('/api/register/schedule.xlsx?reg=submittals&project=' + pid);
for (const [name, r, dated] of [['RFI register', reg, false], ['drawing register', dwg, false], ['submittal schedule', sch, true]]) {
  if (r.status !== 200) { check(name + ' downloads', false, r.status + ' ' + r.text.slice(0, 200)); continue; }
  const t = xlsxText(r.bytes);
  check(name + ': project, client, consultant, contractor', ['Project: Tower X', 'Client: Dubai Holding', 'Consultant: Consult Co', 'Contractor: Build Co'].every((x) => t.includes(x)));
  check(name + ': ref and plot', t.includes('TWX-0001 · 3456789'));
  check(name + ': contract no.', t.includes('Contract no.: C-2026-77'));
  check(name + ': as-at date and time', /As at: \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(UAE\)/.test(t));
  check(name + ': downloaded by', t.includes('Downloaded by: AETRAA Admin'));
  check(name + ': the company logo is embedded', t.includes('xl/media/logo1.png') && t.includes('<xdr:pic>'));
  check(name + (dated ? ': carries the programme data date' : ': no data date'), t.includes('Programme data date: 2026-09-30') === dated);
}
done();
