// K9 · the three AI readers on the Claude subscription (AI_PROVIDER=subscription):
// a real model, through the signed-in `claude` command, on made-up sheets.
// Not part of the automated tests (it needs the command signed in, and spends
// a few calls); the fake-model test is tools/test-k9-ai-readers.mjs.
//   node tools/k9-subscription.mjs        (CLAUDE_BIN=… if claude is not found)
import { db, env, call, admin, as, check, done, onboard } from './_harness.mjs';
import { buildXlsx } from '../src/xlsx.js';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';

env.AI_PROVIDER = 'subscription';
if (process.env.CLAUDE_BIN) env.CLAUDE_BIN = process.env.CLAUDE_BIN;
if (process.env.AI_MODEL) env.AI_MODEL = process.env.AI_MODEL;
const b64 = (u8) => Buffer.from(u8).toString('base64');
const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayWords = Number(today.slice(8)) + ' ' + MON[Number(today.slice(5, 7)) - 1] + ' ' + today.slice(0, 4);

// A picture of a page, as a scanner would make it: one image, no text.
async function scan(draw, w = 1192, h = 842, pw = 2384, ph = 1684) {
  const cv = createCanvas(w, h); const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#000'; g.strokeStyle = '#000';
  draw(g, w, h);
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const page = pdf.addPage([pw, ph]);
  page.drawImage(await pdf.embedPng(await cv.encode('png')), { x: 0, y: 0, width: pw, height: ph });
  return new Uint8Array(await pdf.save({ useObjectStreams: false }));
}

const { pid } = await onboard('Tower SUB', 'TSB-0001', [['The DC', 'dc@tsb.test', ['dc']], ['The PM', 'pm@tsb.test', ['pm']], ['The Designer', 'design@tsb.test', ['design']]]);

console.log('— A1: a scanned sheet —');
const sheet = await scan((g, w, h) => {
  g.lineWidth = 2; g.strokeRect(10, 10, w - 20, h - 20);
  g.font = '36px sans-serif'; g.fillText('TYPICAL FLOOR PLAN — DIMENSIONS IN MM', 80, 260);
  const x = Math.round(w * 0.80), y = Math.round(h * 0.68);
  g.strokeRect(x, y, w - x - 15, h - y - 15);
  g.font = '15px sans-serif';
  ['DRAWING TITLE:', 'TYPICAL FLOOR PLAN', 'LEVELS 3 TO 7', 'DRAWING NO:  A2-301', 'REV:  P3', 'DATE:  14 MAR 2026', 'DISCIPLINE: ARCHITECTURAL']
    .forEach((l, i) => g.fillText(l, x + 8, y + 22 + i * 22));
});
await as('dc@tsb.test');
let r = await call('/api/drawing', { number: 'A2-301', kind: 'ifc', filename: 'A2-301.pdf', data: 'data:application/pdf;base64,' + b64(sheet) });
const D = r.json.id;
let t0 = Date.now();
r = await call('/api/ai/sheet', { drawing_id: D });
console.log('  ' + Math.round((Date.now() - t0) / 1000) + ' s', JSON.stringify(r.json.fields ? Object.fromEntries(Object.entries(r.json.fields).map(([k, v]) => [k, [v.ai, v.sure, v.iso || '', v.may_take]])) : r.json));
check('A1 reads the corner on the subscription', r.status === 200 && r.json.fields.title.ai && /TYPICAL FLOOR PLAN/i.test(r.json.fields.title.ai) && r.json.fields.revision.ai === 'P3' && r.json.fields.date.iso === '2026-03-14', r.text.slice(0, 300));
check('and nothing is applied until DC confirms', !db.prepare('SELECT title FROM drawings WHERE id = ?').get(D).title);

console.log('\n— A3: a stamped reply —');
await as('design@tsb.test');
r = await call('/api/records', { type: 'submittal', title: 'Rebar shop drawings L3', data: { Subject: 'Rebar shop drawings L3' } });
const S = r.json.ref;
await as('pm@tsb.test'); await call('/api/record/advance', { ref: S, action: 'advance' });
await as('dc@tsb.test'); await call('/api/s0/issue', { ref: S, outside: true, note: 'Transmittal T-1' });
const reply = await scan((g) => {
  g.font = 'bold 26px sans-serif'; g.fillText('CONSULTANT REVIEW — RETURNED SUBMITTAL', 60, 70);
  g.font = '20px sans-serif';
  g.fillText('Reference: ' + S + '     Date: ' + todayWords, 60, 120);
  g.lineWidth = 4; g.strokeRect(60, 150, 520, 70);
  g.font = 'bold 24px sans-serif'; g.fillText('CODE B — APPROVED AS NOTED', 80, 195);
  g.font = '18px sans-serif';
  g.fillText('Comments:', 60, 270);
  g.fillText('1. Drawing S-201: show lap lengths at every splice. (Structural)', 60, 300);
  g.fillText('2. Clause 3.2: bar marks to BS 8666. (Structural)', 60, 330);
}, 842, 1191, 595, 842);
r = await call('/api/s0/read-reply', { ref: S, filename: 'Returned stamped.pdf', mime: 'application/pdf', data: b64(reply) });
t0 = Date.now();
r = await call('/api/s0/ai-read', { ref: S, attachment_id: r.json.attachment_id });
console.log('  ' + Math.round((Date.now() - t0) / 1000) + ' s', JSON.stringify({ code: r.json.code, replied_on: r.json.replied_on, comments: r.json.comments, flags: r.json.flags, ref: r.json.read && r.json.read.reference }));
check('A3 reads the code, the date and each comment on the subscription', r.status === 200 && r.json.code === 'B' && r.json.replied_on === today && r.json.comments.length === 2 && r.json.may_confirm, r.text.slice(0, 300));
check('and nothing is recorded until DC confirms', !db.prepare('SELECT code FROM records WHERE ref = ?').get(S).code);

console.log('\n— A6: fields on a form the extractor could not place —');
const odd = buildXlsx([{ name: 'Form', rows: [
  ['notice of inspection — please fill in every part of this form before the inspection takes place on site', '', '', 'Form WIR-01'],
  ['', ''], ['the works to be inspected are described in the space provided to the right of this text', ''],
  ['', ''], ['the location of the works on site (block, level, grid) is given in the box beside this', ''],
  ['', ''], ['', ''], ['signed for and on behalf of the contractor in the box to the right of this line of text', '']] }]);
await call('/api/templates/upload', { doc_type: 'wir', filename: 'Odd WIR.xlsx', file_b64: b64(odd) });
t0 = Date.now();
r = await call('/api/templates/ai-fields', { doc_type: 'wir' });
console.log('  ' + Math.round((Date.now() - t0) / 1000) + ' s', JSON.stringify({ fields: r.json.fields, signatures: r.json.signatures, dropped: r.json.dropped }));
check('A6 proposes fields on the subscription', r.status === 200 && (r.json.fields || []).length >= 2, r.text.slice(0, 300));
check('and the form is unchanged until DC saves', !(JSON.parse(db.prepare("SELECT fields FROM templates WHERE doc_type = 'wir'").get().fields || '[]') || []).length);
const used = db.prepare("SELECT task, model, provider, ok, cost_usd FROM ai_usage WHERE task IN ('a1-sheet','a3-reply','a6-fields')").all();
console.log('\n  logged: ' + JSON.stringify(used));
check('each call was logged, on the subscription', used.length === 3 && used.every((u) => u.provider === 'subscription' && u.ok === 1));
done();
