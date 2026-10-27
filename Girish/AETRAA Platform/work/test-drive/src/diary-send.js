// v5 A12 step 3: "the PM submits; DC sends if the contract requires."
//
// Whether the contract requires it is the A4 obligations register's answer:
// an approved obligation whose words are about daily records or a diary is
// shown as the basis. Who it goes to is set on the project (the Engineer's
// address, usually) by Document Control, the PM or the Principal. A submitted
// diary is then sent by Document Control — the Word copy attached — and every
// sending is kept on that day's diary. Nothing is sent automatically.

import { addColumns } from './db-cols.js';

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i;
const parse = (s, d) => { try { const v = JSON.parse(s || ''); return v == null ? d : v; } catch (e) { return d; } };

let ready = false;
export async function ensureDiarySend(env) {
  if (ready) return;
  const a = await addColumns(env, 'projects', [['diary_send_to', 'TEXT']]);
  const b = await addColumns(env, 'diary', [['sent_log', 'TEXT']]);
  ready = a && b;
}

export function cleanEmails(input) {
  const list = (Array.isArray(input) ? input : String(input || '').split(/[,;\s]+/)).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  const good = [...new Set(list.filter((x) => EMAIL_RE.test(x)))].slice(0, 10);
  return { good, bad: list.filter((x) => !EMAIL_RE.test(x)) };
}

// The approved obligation that asks for daily records, if there is one.
export async function diaryObligation(env, pid) {
  try {
    const rows = ((await env.DB.prepare("SELECT clause_key, page, quote, summary FROM contract_obligation WHERE project_id = ? AND state = 'approved'").bind(pid).all()).results) || [];
    return rows.find((o) => /\bdiar(y|ies)\b|daily (record|report|return)s?|records of .{0,40}(personnel|labour|equipment)/i.test(o.quote + ' ' + (o.summary || ''))) || null;
  } catch (e) { return null; }
}

export async function recipients(env, pid) {
  await ensureDiarySend(env);
  const r = await env.DB.prepare('SELECT diary_send_to FROM projects WHERE id = ?').bind(pid).first().catch(() => null);
  return cleanEmails((r && r.diary_send_to) || '').good;
}
export async function setRecipients(env, pid, input) {
  await ensureDiarySend(env);
  const { good, bad } = cleanEmails(input);
  if (bad.length) return { error: 'Not an email address: ' + bad.join(', ') };
  await env.DB.prepare('UPDATE projects SET diary_send_to = ? WHERE id = ?').bind(good.join(', ') || null, pid).run();
  return { ok: true, to: good };
}
export async function sentLog(env, pid, day) {
  await ensureDiarySend(env);
  const r = await env.DB.prepare('SELECT sent_log FROM diary WHERE project_id = ? AND report_date = ?').bind(pid, day).first().catch(() => null);
  return parse(r && r.sent_log, []);
}
export async function logSending(env, pid, day, entry) {
  const log = (await sentLog(env, pid, day)).concat([entry]).slice(-20);
  await env.DB.prepare('UPDATE diary SET sent_log = ? WHERE project_id = ? AND report_date = ?').bind(JSON.stringify(log), pid, day).run();
  return log;
}
