// G1: contract terms — spec §18 ranges, the clause beside each figure,
// Arabic-Indic digits, every proposal kept as evidence, and the Principal's
// approval before any application for payment (E9 step 3).
//   node tools/test-g1-terms.mjs
import { readFileSync } from 'node:fs';
import { db, call, admin, as, check, done, onboard } from './_harness.mjs';
import { proposeTerms, westernDigits, clauseBefore, termEvidence } from '../src/contract-terms.js';

console.log('— ranges (spec §18) —');
const T = (s) => Object.fromEntries(proposeTerms(s, [s]).filter((p) => p.state !== 'not_found').map((p) => [p.key, p]));
check('retention above 20% is not proposed', !T('Retention money shall be 25% of each payment.').retention_pct);
check('retention of 10% is', T('Retention money shall be 10% of each payment.').retention_pct?.value === 10);
check('a cap above 10% is not proposed', !T('The limit of retention shall not exceed 15% of the contract.').retention_cap_pct);
check('advance above 30% is not proposed', !T('An advance payment of 40% shall be paid.').advance_pct);
check('payment over 180 days is not proposed', !T('The Employer shall pay within 200 days of the certificate.').payment_days);
const capped = T('Retention money shall be 5% of each payment. The limit of retention shall not exceed 8% of the contract.');
check('a cap above the retention rate is flagged, not refused', capped.retention_cap_pct?.value === 8 && capped.retention_cap_pct.flag === 'above_rate', capped.retention_cap_pct);

console.log('\n— clause and digits —');
check('the clause a figure sits under is reported', T('Sub-Clause 14.3 Retention money shall be 10% of each payment.').retention_pct?.clause === 'Sub-Clause 14.3');
check('a clause named in the same sentence wins', clauseBefore('Clause 5.1 Something. Retention money shall be 7% under Clause 9.2.', 30) === 'Clause 9.2');
check('the next clause is not picked up', T('Sub-Clause 14.3 Retention money shall be 10% of each payment. Sub-Clause 14.4 Other.').retention_pct?.clause === 'Sub-Clause 14.3');
check('Arabic-Indic digits are read', westernDigits('١٠٪ ۵') === '10% 5');
check('a retention written in Arabic-Indic digits is found', T('Retention money shall be ١٠٪ of each payment.').retention_pct?.value === 10);

console.log('\n— evidence of every proposal (spec §14) —');
const ev = termEvidence([
  { key: 'retention_pct', state: 'proposed', value: 10, options: [{ value: 10, page: 3, clause: 'Sub-Clause 14.3' }], clause: 'Sub-Clause 14.3', page: 3, sentence: 's' },
  { key: 'payment_days', state: 'proposed', value: 56, options: [{ value: 56, page: 4 }], page: 4 },
  { key: 'advance_pct', state: 'proposed', value: 10, options: [{ value: 10, page: 5 }] },
  { key: 'notice_clause', state: 'not_found' },
], { retention_pct: 10, advance_pct: 5 });
const st = Object.fromEntries(ev.map((e) => [e.key, e.state]));
check('accepted, corrected, refused and not-found are all kept', st.retention_pct === 'accepted' && st.advance_pct === 'edited' && st.payment_days === 'refused' && st.notice_clause === 'not_found', st);

console.log('\n— through the platform —');
const { pid } = await onboard('Tower G', 'TWG-0001', [['The PM', 'pm@towerg.test', ['pm']]]);
await admin();
let r = await call('/api/intake/batch', { project_id: pid });
const batch = r.json.id;
const pdf = readFileSync(new URL('./fixtures/contract-test.pdf', import.meta.url));
await call('/api/intake/scan', { batch_id: batch, project_id: pid, filename: 'Contract.pdf', path: '/Contract/', data: pdf.toString('base64') });
r = await call('/api/intake/terms?batch=' + batch);
const terms = r.json.terms || [];
const ret = terms.find((t) => t.key === 'retention_pct');
check('the compressed contract’s retention carries its clause and page', ret && ret.value === 10 && ret.clause === 'Sub-Clause 14.3' && ret.page === 3, ret);
// The QS accepts retention and refuses the rest.
const sent = terms.map((t) => ({ ...t, accepted: t.key === 'retention_pct' }));
r = await call('/api/intake/terms', { batch_id: batch, project_id: pid, terms: sent });
check('retention is applied', r.status === 200 && (r.json.applied || []).includes('Retention'), r.text);
const rows = db.prepare('SELECT term, state, clause, page FROM term_evidence WHERE project_id = ?').all(pid);
check('every proposal shown is kept as evidence', rows.length === terms.length, rows.length + ' of ' + terms.length);
check('the accepted one with its clause and page', rows.some((x) => x.term === 'retention_pct' && x.state === 'accepted' && x.clause === 'Sub-Clause 14.3' && x.page === 3));
check('the refused ones as refused', rows.some((x) => x.term === 'notice_clause' && x.state === 'refused'));
check('the terms now wait for the Principal', db.prepare('SELECT terms_state FROM projects WHERE id = ?').get(pid).terms_state === 'pending');

console.log('\n— the Principal approves; nobody else can —');
r = await call('/api/terms/approve', {});
check('AETRAA cannot approve them', r.status === 403, r.status);
await as('pm@towerg.test');
r = await call('/api/terms/approve', {});
check('the PM cannot approve them', r.status === 403, r.status);
r = await call('/api/ipc', { reviewed: true });
check('no application for payment is raised on pending terms', r.status === 400 && /waiting for the Principal/.test(r.json && r.json.error || ''), r.text);
await as('principal@towerg.test');
r = await call('/api/attention');
check('the Principal sees it in Needs my attention', (r.json.items || []).some((i) => i.kind === 'terms' && i.page === '/terms'), r.text.slice(0, 300));
r = await call('/terms');
check('the payment terms page opens for the Principal', r.status === 200 && r.text.includes('Approve these payment terms'));
r = await call('/api/terms/status');
check('the status shows pending and that they may approve', r.json.state === 'pending' && r.json.may_approve === true, r.text);
r = await call('/api/terms/approve', {});
check('the Principal approves them', r.status === 200 && r.json.state === 'approved', r.text);
const pr = db.prepare('SELECT terms_state, terms_approved_by FROM projects WHERE id = ?').get(pid);
check('approval recorded with the name', pr.terms_state === 'approved' && /Principal/.test(pr.terms_approved_by || ''), pr);
r = await call('/api/ipc', { reviewed: true });
check('applications are no longer blocked by the terms', !/waiting for the Principal/.test(r.json && r.json.error || ''), r.text);
r = await call('/api/attention');
check('and it leaves Needs my attention', !(r.json.items || []).some((i) => i.kind === 'terms'));
done();
