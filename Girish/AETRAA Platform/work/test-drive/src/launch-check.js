// LAUNCH CHECK — what the live server has and has not been given, read from
// the running server itself (Girish/AETRAA-Launch-Open-Issues.pdf items 9–15).
//
// Every line is a fact about this instance: a setting present or missing, a
// library installed or not, the file store answering a write and a read, the
// database's own state. Secrets are never shown — only whether they are set.
// AETRAA only. Nothing here changes anything except one probe file in the
// store, which is deleted straight after it is read back.

import { aiConfig } from './ai.js';
import { putFile, getFile, deleteFile, driverName } from './storage.js';

const line = (key, label, ok, detail, todo) => ({ key, label, state: ok === true ? 'ok' : ok === false ? 'missing' : 'check', detail, todo: ok === true ? '' : todo });

export async function launchCheck(env, deps = {}) {
  const out = [];
  const e = env || {};
  // Sign-in codes and the scheduled reports go out by email.
  const mail = deps.emailDriver ? deps.emailDriver(e) : 'none';
  out.push(line('email', 'Email (sign-in codes, reports, alerts)', mail !== 'none', mail === 'none' ? 'no email key is set — nobody can receive a sign-in code' : 'sending through ' + mail,
    'Set ACS_CONNECTION_STRING (or RESEND_KEY) and REPORT_FROM, restart, then sign in once with an internal address.'));
  out.push(line('platform_emails', 'Who at AETRAA is told (held documents, storage, stopped drops)', !!String(e.PLATFORM_EMAILS || '').trim(),
    String(e.PLATFORM_EMAILS || '').trim() ? String(e.PLATFORM_EMAILS).split(/[,;\s]+/).filter(Boolean).length + ' address(es)' : 'PLATFORM_EMAILS is empty — those alerts reach nobody', 'Set PLATFORM_EMAILS.'));
  out.push(line('public_url', 'The address in emails', /^https:\/\//.test(String(e.PUBLIC_URL || '')), String(e.PUBLIC_URL || '') || 'PUBLIC_URL is not set — links in emails will be broken', 'Set PUBLIC_URL=https://app.aetraa.ae.'));
  // AI (approved, D8).
  const ai = aiConfig(e);
  out.push(line('ai', 'AI (letters, notices, RFIs, minutes, diary, obligations, Tender vs IFC, scans)', !!ai,
    ai ? ai.provider + ' · ' + ai.model + (e.AI_TASK_MODELS ? ' · per-task: ' + e.AI_TASK_MODELS : '') : 'no key set — every AI button says it is switched off',
    'Set ANTHROPIC_API_KEY (approved as D8) and restart.'));
  if (ai && ai.provider === 'subscription') out.push(line('ai_subscription', 'AI provider', false, 'AI_PROVIDER=subscription is for local testing on one person’s login only', 'Remove AI_PROVIDER=subscription on the live server.'));
  // Files.
  const drv = (() => { try { return driverName(e); } catch (x) { return 'unknown'; } })();
  let probe = null;
  try {
    const key = 'launch-check/probe-' + Date.now() + '.txt';
    const put = await putFile(e, key, new TextEncoder().encode('launch check ' + new Date().toISOString()), 'text/plain');
    const back = put && !put.error ? await getFile(e, key) : null;
    probe = !!(back && back.bytes && back.bytes.length);
    if (put && !put.error) await deleteFile(e, key).catch(() => {});
  } catch (x) { probe = false; }
  out.push(line('storage', 'File store', probe && drv === 'azure' ? true : probe ? null : false,
    (probe ? 'a test file was written, read back and deleted' : 'a test file could NOT be written and read back') + ' · driver: ' + drv,
    drv === 'azure' ? 'Check the Azure Blob settings (deploy/azure/STORAGE.md).' : 'Files are kept in the database for now. Move to Azure Blob when access is given (deploy/azure/STORAGE.md).'));
  // Libraries the scan reader, PDF previews and the Tender vs IFC overlay need.
  let canvas = false; try { const C = await import('@napi-rs/canvas'); canvas = !!(C && C.createCanvas); } catch (x) { canvas = false; }
  out.push(line('canvas', 'Image library (scan reading, PDF form preview, Tender vs IFC overlay)', canvas, canvas ? '@napi-rs/canvas loads' : '@napi-rs/canvas did not load', 'Run npm install on the server (it is a declared dependency).'));
  let pdfjs = false; try { await import('pdfjs-dist/legacy/build/pdf.mjs'); pdfjs = true; } catch (x) { pdfjs = false; }
  out.push(line('pdfjs', 'PDF reader (drawings, contracts, letters)', pdfjs, pdfjs ? 'pdf.js loads' : 'pdf.js did not load', 'Run npm install on the server.'));
  // Safety.
  out.push(line('login_test_code', 'Test sign-in code', !e.LOGIN_TEST_CODE, e.LOGIN_TEST_CODE ? 'LOGIN_TEST_CODE is SET — anyone who knows it can sign in as anyone' : 'not set', 'Remove LOGIN_TEST_CODE and restart.'));
  out.push(line('owner_code', 'Owner code strength', String(e.OWNER_CODE || '').length >= 16, String(e.OWNER_CODE || '').length >= 16 ? 'set, long enough' : 'too short or missing', 'Set a long random OWNER_CODE.'));
  let demo = 0; try { const r = await e.DB.prepare("SELECT COUNT(*) AS n FROM orgs WHERE LOWER(COALESCE(plan,'')) = 'demo'").first(); demo = Number(r && r.n) || 0; } catch (x) { demo = 0; }
  out.push(line('demo', 'Demo company', demo === 0 ? true : null, demo ? demo + ' company on the demo plan — its people are listed at /demo for one-click entry' : 'none', 'Confirm this demo company is wanted on the live site, or delete it.'));
  // The database itself.
  let pg = false; try { await e.DB.prepare('SELECT version() AS v').first(); pg = true; } catch (x) { pg = false; }
  out.push(line('database', 'Database', pg ? true : null, pg ? 'PostgreSQL' : 'SQLite (a local copy, not the live server)', 'The live server runs on PostgreSQL.'));
  const missing = out.filter((x) => x.state === 'missing').length, check = out.filter((x) => x.state === 'check').length;
  return { ok: !missing, missing, to_check: check, items: out, at: new Date().toISOString(),
    by_hand: ['DNS, TLS and https://app.aetraa.ae answering (node prelaunch/run.mjs --live-readonly)', 'One sign-in code received by email', 'One scheduled report received (18:00 daily)', 'Installing on a phone (PWA) over HTTPS', 'A real file of each kind run through first (contract, tender/IFC set, PDF form, .msg, Arabic letter, photos)'] };
}
