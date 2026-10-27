// AETRAA platform - request router
// Routes, auth and JSON API. The pages live in ./html/*.js
//
// Multi-project: every row of programme data carries a project_id. Who you are and
// which project you are in are decided together, at sign-in:
//   - the owner code is a Worker secret and opens every project (and the portfolio)
//   - every other code lives hashed in the projects table and opens exactly one

import { dashboardHTML } from './html/dashboard.js';
import { siteHTML } from './html/site.js';
import { loginHTML } from './html/login.js';
import { adminHTML } from './html/admin.js';
import { portfolioHTML } from './html/portfolio.js';
import { principalHTML } from './html/principal.js';
import { pmHTML } from './html/pm.js';
import { appHTML } from './html/app.js';
import { FUNCTIONS, userFunctions, mayCreateRecord, mayApproveRecord, whoMayRaise, whoMayApprove, RECORD_CREATORS, RECORD_APPROVERS } from './functions.js';
import { ensureRecordsTable, listRecords, getRecord, createRecord, advanceRecord, pendingStep, approverFunctions, RECORD_TYPES, RESPONSE_DEFAULTS, responseDays , closeIncomingByReply } from './records.js';
import { REGISTERS, typesFor, registerWorkbook, scheduleWorkbook, drawingsWorkbook, boqWorkbook } from './register-xlsx.js';
import { configured as gateConfigured, rulesOf, widenedRules, ensureGateColumns } from './gate.js';
import { listHeld, getHeld, decide, groupByReason, markFiled } from './quarantine.js';
import { cleanRules, DEFAULT_RULES } from './drawing-classify.js';
import { CLASSES, addDocument, listLibrary, documentFile, librarySummary } from './library.js';
import { onboardProject, createProjectForCompany, setBranding, setCompanyLogo } from './setup.js';
import { analyseUpdate, commitUpdate } from './programme-update.js';
import { extract as extractLogic, applyLogic } from './xer-logic.js';
import { p6ProgressWorkbook } from './p6-export.js';
import { programmeHTML } from './html/programme.js';
import { diaryChecks, diaryContext, diaryStatus, todaysProgress } from './diary-checks.js';
import { notifyTeam, myNotifications, markRead, projectTeam, mayNotify } from './notify.js';
import { MODULES, catalogue, getProjectModules, setProjectModules, moduleForPath, recordTypeOn, dashboardsOff, setupStepsOn, ensureModulesColumn } from './modules.js';
import { setupHTML } from './html/setup.js';
import { ensureBoqTable, importBOQ, listBOQ, setBilled } from './commercial.js';
import { ensureBomTable, importBOM, listBOM, checkOrder, recordOrder, recordGRN, listMoves } from './bom.js';
import { saveTemplate, listTemplates, getTemplateBytes, deleteTemplate, b64ToBytes, DOC_TYPES } from './templates-store.js';
import { fillTemplate, buildValues, STANDARD_TOKENS } from './template.js';
import { AUTHORITIES, emirateFor, seedAuthorities } from './authorities.js';
import { decodeXer, parseXER, buildProgramme, deriveDeliverables, saveProgramme, DEFAULT_LEADS } from './xer.js';
import { IPC_PACK, listIPC, getIPC, proposeValuation, checkIPC, createIPC, advanceIPC, mayIPC, paymentTerms, TERM_DEFAULTS, NEXT_ACTIONS } from './ipc.js';
import { buildIpcPack, ipcWorkbook, ipcDocumentWord } from './ipc-pack.js';
import { MEETING_TYPES, mayWriteMinutes, mayIssueMinutes, listMeetings, getMeeting, saveDraft, discardDraft, minutesChecks,
  issueMinutes, listActions, updateAction } from './meetings.js';
import { minutesWord, minutesHTML, actionsWorkbook } from './meetings-doc.js';
import { minutesPageHTML } from './html/minutes.js';
import { attentionFor, attentionEmail } from './attention.js';
import { reportsHTML } from './html/reports.js';
import { ensureHseTable, saveHseLog, listHseLog, hseReport } from './hse.js';
import { aiEnabled, aiUsageSummary } from './ai.js';
import { reportNarrative } from './ai-tasks.js';
import { putFile, getFile, deleteFile, driverName, DRIVER_LABEL, bytesToB64 } from './storage.js';
import {
  addAttachment, listAttachments, getAttachment, removeAttachment, attachmentCounts,
  MAX_ATTACHMENT, MAX_PER_RECORD,
} from './attachments.js';
import { issuesHTML, issueDocHTML } from './html/issues.js';
import { diaryHTML, diarySheetHTML } from './html/diary.js';
import { verifyHTML } from './html/verify.js';
import { peopleHTML } from './html/people.js';
import { resourcesHTML } from './html/resources.js';
import { drawingsHTML } from './html/drawings.js';
import { scheduleHTML } from './html/schedule.js';
import { run as runCPM, impact as cpmImpact } from './cpm.js';
import { isoMinute, toDays, between, unpack as unpackCal, parseDate as parseCalDate } from './calendar.js';
import {
  KINDS as DWG_KINDS, KIND_LABEL as DWG_KIND_LABEL, MAX_BYTES as DWG_MAX,
  listDrawings, getDrawing, saveDrawing, removeDrawing, pin as pinDrawing,
  approveDrawing, rejectDrawing,
  forActivity as drawingsForActivity, countsFor as drawingCounts, reachFor, fromFileName,
} from './drawings.js';
import {
  buildResources, withoutMoney, saveRate, loadRates, projectMaterials, DEFAULT_MATERIALS,
} from './resources.js';
import {
  listQueue, photosFor, setVerdict, verifyCounts, verdictsFor, photoCounts, missingProof,
} from './verify.js';
import { loadDiary, saveDiary, listDiaries, shiftDay } from './diary.js';
import {
  ROLES, readScope, isFullScope, describeScope, scopeSql, activitiesInScope,
  listCodes, getCode, findByHash, touchCode, saveCode, deleteCode, chunked,
  reviewDay, getReview, listReviews,
} from './access.js';
import { diaryHTML as diarySheet, photoPageHTML, diaryDocx, diaryFileName } from './diary-doc.js';
import {
  ISSUE_TYPES, createIssue, updateIssue, listIssues, getIssue, issueDocument, issueDocumentTitle,
} from './issues.js';
import {
  createOrg, getOrg, listOrgs, updateOrg, orgBlocked,
  saveUser, getUser, listUsers, findUserByInvite, findUserByInviteAny, suspendUser, touchUser,
  userScope, userProjects, userInProject,
  startEmailSignIn, completeEmailSignIn, purgeSignInCodes, signInEmail, issueSignInCode,
  audit, listAudit, adoptCodes, cleanEmail, setOrgEmailDomains, ensureOrgEmailColumns,
} from './org.js';
import { MANIFEST, SERVICE_WORKER, ICON_192, ICON_512, FAVICON, LOGO_PNG } from './html/pwa.js';
import { buildReport, reportHTML, reportDocument, reportSubject, reportWord, reportFileName } from './report.js';
import { acsConfig, sendViaAzure } from './email-azure.js';
import { openBatch, scanFile, getBatch, confirmItems, commitItems } from './intake.js';
import { probe as probeFile, mapRows } from './intake-probe.js';
import { intakeHTML } from './html/intake.js';
import { proposeTerms, acceptedTerms, TERMS } from './contract-terms.js';

const COOKIE = 'smsess';
const PROJ_COOKIE = 'smproj';
const DAY = 86400;

/* ------------------------------------------------------------------ auth */

const enc = new TextEncoder();
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

// Access codes are stored hashed, so the database never holds a usable code.
async function sha256(value) {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(String(value))));
}

// The token carries which access code signed in, not what it is allowed to do —
// so revoking a code or narrowing its scope takes effect on the next request
// rather than whenever the cookie happens to expire.
async function makeToken(role, pid, aid, secret, days = 90) {
  const body = `${role}.${pid || '-'}.${aid || '-'}.${Math.floor(Date.now() / 1000) + days * DAY}`;
  return `${body}.${await hmac(body, secret)}`;
}

// A named person's session. The cookie carries who they are, never what they may
// do — role, scope and whether their employer is still a customer are all read
// back on every request, so withdrawing somebody is immediate.
const USER_TOKEN = 'u2';

async function makeUserToken(uid, pid, secret, days = 60) {
  const body = `${USER_TOKEN}.${uid}.${pid || '-'}.${Math.floor(Date.now() / 1000) + days * DAY}`;
  return `${body}.${await hmac(body, secret)}`;
}

async function readToken(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts[0] === USER_TOKEN) {
    if (parts.length !== 5) return null;
    const [, uid, pid, exp, sig] = parts;
    if (await hmac(`${USER_TOKEN}.${uid}.${pid}.${exp}`, secret) !== sig) return null;
    if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
    return { uid, pid: pid === '-' ? null : pid, aid: null, role: null };
  }
  // Four parts is a cookie issued before per-discipline codes existed. It still
  // works, and simply carries no access-code id.
  if (parts.length === 4) {
    const [role, pid, exp, sig] = parts;
    if (await hmac(`${role}.${pid}.${exp}`, secret) !== sig) return null;
    if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
    return { role, pid: pid === '-' ? null : pid, aid: null };
  }
  if (parts.length !== 5) return null;
  const [role, pid, aid, exp, sig] = parts;
  if (await hmac(`${role}.${pid}.${aid}.${exp}`, secret) !== sig) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return { role, pid: pid === '-' ? null : pid, aid: aid === '-' ? null : aid };
}

function cookieValue(req, name) {
  const raw = req.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function sameCode(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 'lead' is a discipline engineer: updates his own trades and sees a dashboard
// of his own scope, nothing else.
const can = {
  view: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'view' || r === 'site',
  submit: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'site',
  admin: (r) => r === 'owner',
  dashboard: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'view',
  export: (r) => r === 'owner' || r === 'manager',
  portfolio: (r) => r === 'owner',
  report: (r) => r === 'owner' || r === 'manager' || r === 'view',
  // Signing off the day, and checking a claim, belong to the office.
  reviewDay: (r) => r === 'owner' || r === 'manager',
  verify: (r) => r === 'owner' || r === 'manager',
  // Site raises an issue but never issues one; the office decides what goes out.
  raise: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'site',
  issueOut: (r) => r === 'owner' || r === 'manager',
  // Site keeps the diary; the office checks it and marks it submitted.
  diary: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'site' || r === 'view',
  diaryEdit: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'site',
  // Adding and withdrawing people belongs to the Principal and the PM
  // (owner + manager) — the access matrix's "Team & Access" holders.
  people: (r) => r === 'owner' || r === 'manager',
  // What the job has consumed. Quantities for the office; the money in it is a
  // separate permission, checked where the figures are built.
  resources: (r) => r === 'owner' || r === 'manager' || r === 'view',
  money: (r) => r === 'owner',
  // A drawing is read by whoever is building to it — everybody, and everybody
  // sees the whole register, pending sheets included.
  drawings: (r) => r === 'owner' || r === 'manager' || r === 'lead' || r === 'view' || r === 'site',
  // The discipline engineer uploads and submits drawings for approval; the PM
  // approves them and thereafter is the only one who can change a live sheet.
  drawingsUpload: (r) => r === 'owner' || r === 'manager' || r === 'lead',
  drawingsApprove: (r) => r === 'owner' || r === 'manager',
  // What the programme says about the end of the job. The office reads it; site
  // has no use for it and is not shown a contract date.
  schedule: (r) => r === 'owner' || r === 'manager' || r === 'view',
  drawingsEdit: (r) => r === 'owner' || r === 'manager',
  // And the organisations themselves belong to whoever runs the platform — the
  // owner code, which is a Worker secret, not anybody's account.
  platform: (r, me) => r === 'owner' && !me,
};

/* --------------------------------------------------------------- helpers */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

// The people of any demo company, in the order a demo is walked through.
const DEMO_ORDER = ['principal', 'pm', 'planning', 'site', 'design', 'dc', 'qaqc', 'hse',
  'commercial', 'procurement', 'finance', 'consultant'];
async function demoPeople(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT u.id, u.name, u.role, u.functions, u.scope_groups, o.name AS company
         FROM users u JOIN orgs o ON o.id = u.org_id
        WHERE LOWER(COALESCE(o.plan,'')) = 'demo'
          AND COALESCE(u.status,'active') != 'suspended'`
    ).all();
    const list = (results || []).map((r) => {
      let fns = [];
      try { fns = JSON.parse(r.functions || '[]'); } catch (e) { fns = []; }
      const groups = (() => { try { return JSON.parse(r.scope_groups || '[]'); } catch (e) { return []; } })();
      const label = fns.length
        ? fns.map((f) => (FUNCTIONS[f] || {}).label || f).join(' · ')
        : (r.role || '');
      return { id: r.id, name: r.name, company: r.company, role: r.role,
        functions: fns, label: label + (groups.length ? ' (' + groups.join(', ') + ')' : '') };
    });
    list.sort((a, b) => {
      const rank = (x) => {
        const i = DEMO_ORDER.indexOf((x.functions || [])[0]);
        return i < 0 ? 99 : i;
      };
      return rank(a) - rank(b) || String(a.name).localeCompare(String(b.name));
    });
    return list;
  } catch (err) {
    return [];
  }
}

// One page, no code to type: every seat in the demo project, one click each.
function demoPageHTML(people) {
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const company = (people[0] && people[0].company) || 'Demo';
  const cards = people.map((p) => `<button class="seat" data-id="${esc(p.id)}">
      <span class="who">${esc(p.name)}</span>
      <span class="what">${esc(p.label)}</span>
    </button>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AETRAA — demo</title>
<link rel="icon" href="/favicon.ico">
<style>
:root { --navy:#0f1f3d; --gold:#c9a227; --ink:#1b2437; --muted:#6a7590; --line:#e3e9f2; }
* { box-sizing: border-box; }
body { margin:0; font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  color:var(--ink); background:#f6f7f9; display:grid; place-items:center; min-height:100dvh; padding:24px; }
.box { width:100%; max-width:760px; }
.mark { display:flex; justify-content:center; margin-bottom:18px; }
.mark img { height:78px; width:auto; }
h1 { font-size:22px; margin:0 0 4px; text-align:center; }
.sub { text-align:center; color:var(--muted); margin:0 0 22px; font-size:14px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:10px; }
.seat { text-align:left; background:#fff; border:1px solid var(--line); border-radius:10px;
  padding:14px 16px; cursor:pointer; font:inherit; display:flex; flex-direction:column; gap:3px; }
.seat:hover { border-color:var(--navy); box-shadow:0 2px 10px rgba(15,31,61,.08); }
.who { font-weight:600; color:var(--navy); }
.what { font-size:13px; color:var(--muted); }
.foot { margin-top:22px; text-align:center; color:var(--muted); font-size:13px; }
.foot a { color:var(--navy); }
.busy { opacity:.5; pointer-events:none; }
</style></head><body>
<div class="box">
  <div class="mark"><img src="/brand-logo" alt="AETRAA"></div>
  <h1>${esc(company)} — demonstration</h1>
  <p class="sub">Pick a seat. No codes, no passwords: you are taken straight into that person's screens.</p>
  <div class="grid">${cards || '<p class="sub">No demo company is set up on this server.</p>'}</div>
  <p class="foot">This is invented data on an invented project.
    <a href="/">Sign in to a real account instead</a></p>
</div>
<script>
document.querySelectorAll('.seat').forEach(function (b) {
  b.addEventListener('click', function () {
    b.classList.add('busy');
    fetch('/api/demo/enter', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id: b.dataset.id }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) location.href = '/'; else { b.classList.remove('busy');
        alert((j && j.error) || 'that did not work'); } })
      .catch(function () { b.classList.remove('busy'); });
  });
});
</script></body></html>`;
}

const html = (body) =>
  new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });

// Turning somebody out: clear the cookie in the same breath as refusing them, so
// the next request does not arrive carrying a session that no longer means
// anything.
function signedOut(message) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  return new Response(JSON.stringify({ error: message }), { status: 401, headers });
}

const today = () => new Date().toISOString().slice(0, 10);
// Today on site, in the UAE (UTC+4) — after 20:00 UTC it is already tomorrow there.
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();

const str = (v, max = 2000) => (v === undefined || v === null ? null : String(v).slice(0, max));

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v) => (v && DATE_RE.test(String(v).trim()) ? String(v).trim() : null);
const slug = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

const STATUSES = ['not_started', 'in_progress', 'complete', 'at_risk', 'delayed', 'on_hold'];

/* ------------------------------------------------------- CSV for import */

function parseDelimited(text) {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = clean.split('\n')[0] || '';
  const delim = firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ',';
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"') { if (clean[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function headerMap(headerRow, aliases) {
  const map = {};
  headerRow.forEach((h, i) => {
    const key = h.trim().toLowerCase().replace(/\s+/g, ' ');
    for (const [field, list] of Object.entries(aliases)) {
      if (list.includes(key) && map[field] === undefined) map[field] = i;
    }
  });
  return map;
}

const ACT_ALIASES = {
  id: ['id', 'activity id', 'activity_id', 'act id', 'task id', 'code', 'ref'],
  name: ['name', 'activity', 'activity name', 'description', 'task', 'task name'],
  wbs: ['wbs', 'section', 'wbs name', 'bill', 'element'],
  level: ['level', 'lvl', 'outline level', 'indent'],
  planned_start: ['planned start', 'planned_start', 'start', 'baseline start', 'early start', 'plan start'],
  planned_finish: ['planned finish', 'planned_finish', 'finish', 'baseline finish', 'early finish', 'end', 'plan finish'],
  weight: ['weight', 'weighting', 'value', 'amount', 'cost'],
  trade: ['trade', 'resource', 'tradewise'],
  trade_group: ['trade group', 'trade_group', 'tradegroup', 'group'],
  floor: ['floor', 'level name', 'zone', 'area'],
  discipline: ['discipline', 'decipline'],
  phase: ['phase', 'stage'],
  responsible: ['responsible', 'owner', 'subcontractor', 'contractor', 'party'],
};

function normaliseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (DATE_RE.test(s)) return s;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    return new Date(Date.UTC(1899, 11, 30) + Number(s) * 864e5).toISOString().slice(0, 10);
  }
  let m = s.match(/^(\d{1,2})[-/ ](\d{1,2})[-/ ](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    if (Number(mo) > 12 && Number(d) <= 12) [d, mo] = [mo, d];
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{2,4})$/);
  if (m) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mi = months.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) {
      const y = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${y}-${String(mi + 1).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    }
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------- projects */

async function listProjects(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, ref, contract_completion, target_name, target_deadline, archived, sort_order
       FROM projects ORDER BY archived, COALESCE(sort_order, 999), name`
  ).all();
  return results || [];
}

// SELECT * rather than a column list on purpose. getProject is called on almost
// every request, so naming a column the live database has not been migrated to
// yet would take the whole app down rather than just the feature that needs it.
async function getProject(env, pid) {
  return await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(pid).first();
}

// Which project is this request about? Non-owners are pinned to theirs by the token.
async function resolvePid(req, env, session) {
  if (!session) return null;
  if (session.role !== 'owner') return session.pid;
  const url = new URL(req.url);
  const asked = url.searchParams.get('p') || cookieValue(req, PROJ_COOKIE);
  if (asked && await getProject(env, asked)) return asked;
  const all = await listProjects(env);
  const live = all.filter((p) => !p.archived);
  return (live[0] || all[0] || {}).id || null;
}

// The owner code is the platform operator, not a member of any organisation, so
// it has to say which one it means. With only one on the system — which is every
// installation until the second customer signs up — saying so would be silly.
async function onlyOrg(env) {
  try {
    const { results } = await env.DB.prepare('SELECT id FROM orgs LIMIT 2').all();
    return (results || []).length === 1 ? results[0].id : null;
  } catch (err) {
    return null;
  }
}

// Every project this organisation owns. Projects created before organisations
// existed carry no org_id; they belong to whoever adopted them, which in practice
// is the first organisation on the system.
async function orgProjects(env, oid) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, ref, contract_completion, target_name, target_deadline, archived, sort_order
       FROM projects WHERE org_id = ? ORDER BY archived, COALESCE(sort_order, 999), name`
  ).bind(oid).all();
  return results || [];
}

// Which project a named person is looking at.
//
// Asking for one by name is treated differently from a cookie, on purpose. A
// cookie goes stale on its own — somebody is taken off a project, or it is
// archived — and being locked out over that would be absurd, so a cookie that
// no longer fits quietly falls back to a project they do have.
//
// ?p=something is a different act: somebody typed it. If it is not theirs they
// are refused, rather than quietly shown a different project's figures under the
// name they asked for. A report that says one project and shows another is worse
// than an error.
const DENIED = Symbol('denied');

async function resolveUserPid(req, env, me, session) {
  const url = new URL(req.url);
  let mine;
  try { mine = await orgProjects(env, me.org_id); }
  catch (e) { mine = await listProjects(env); }          // not migrated
  const allowed = mine.filter((p) => userInProject(me, p.id));
  const has = (v) => v && allowed.some((p) => p.id === v);

  const asked = url.searchParams.get('p');
  if (asked) return has(asked) ? asked : DENIED;

  const remembered = cookieValue(req, PROJ_COOKIE) || (session && session.pid);
  if (has(remembered)) return remembered;
  const live = allowed.filter((p) => !p.archived);
  return (live[0] || allowed[0] || {}).id || null;
}

/* ------------------------------------------------------------ API: read */

async function getData(env, pid, scope) {
  const db = env.DB;
  // One scope clause, applied to everything that hangs off an activity, so a
  // discipline engineer's dashboard cannot show him the other discipline.
  const s = scopeSql(scope, 'a');
  const full = isFullScope(scope);
  const inScope = full ? '' :
    ` AND activity_id IN (SELECT a.id FROM activities a WHERE a.project_id = ? AND ${s.sql})`;
  const scopeArgs = full ? [] : [pid, ...s.args];

  const [acts, latest, history, mp, photos, project, targets, recent] = await Promise.all([
    db.prepare(
      `SELECT a.id, a.wbs, a.name, a.level, a.planned_start, a.planned_finish, a.weight,
              a.trade, a.trade_group, a.floor, a.discipline, a.phase, a.responsible, a.sort_order
         FROM activities a WHERE a.project_id = ? AND ${s.sql}
        ORDER BY COALESCE(a.sort_order, 999999), a.id`
    ).bind(pid, ...s.args).all(),
    db.prepare(
      `SELECT u.* FROM updates u
        WHERE u.project_id = ?
          AND u.id = (SELECT MAX(id) FROM updates WHERE project_id = u.project_id AND activity_id = u.activity_id)
          ${inScope}`
    ).bind(pid, ...scopeArgs).all(),
    db.prepare(
      // The last update for each activity on each day. This used to be
      // "SELECT pct, MAX(id) … GROUP BY activity_id, report_date", which works
      // only because SQLite quietly hands back the pct belonging to the max
      // id. PostgreSQL refuses a bare column in a GROUP BY, and rightly — the
      // intent has to be said out loud.
      `SELECT u.activity_id, u.report_date, u.pct, u.id FROM updates u
        WHERE u.project_id = ?
          AND u.id = (SELECT MAX(id) FROM updates
                       WHERE project_id = u.project_id
                         AND activity_id = u.activity_id
                         AND report_date = u.report_date)
          ${inScope}
        ORDER BY u.report_date`
    ).bind(pid, ...scopeArgs).all(),
    db.prepare(
      `SELECT * FROM manpower WHERE project_id = ? ORDER BY report_date DESC, trade LIMIT 2000`
    ).bind(pid).all(),
    db.prepare(
      `SELECT id, activity_id, report_date, caption, submitted_by, created_at
         FROM photos WHERE project_id = ? ORDER BY created_at DESC LIMIT 500`
    ).bind(pid).all(),
    getProject(env, pid),
    db.prepare(
      `SELECT activity_id, target_group, work, level, days_left, target_start, target_finish, sort_order
         FROM targets WHERE project_id = ?
          ${full ? '' : ` AND activity_id IN (SELECT a.id FROM activities a WHERE a.project_id = ? AND ${s.sql})`}
        ORDER BY COALESCE(sort_order, 999999)`
    ).bind(pid, ...scopeArgs).all(),
    db.prepare(
      `SELECT * FROM updates WHERE project_id = ? AND source = 'site' ${inScope}
        ORDER BY id DESC LIMIT 40`
    ).bind(pid, ...scopeArgs).all(),
  ]);

  const current = {};
  for (const r of latest.results || []) current[r.activity_id] = r;

  const p = project || {};
  return {
    generated_at: nowISO(),
    project: { id: pid, name: p.name || 'Project', ref: p.ref || '' },
    scope: full ? null : { ...scope, text: describeScope(scope) },
    meta: {
      project_name: p.name || 'Project',
      project_ref: p.ref || '',
      contract_completion: p.contract_completion || '',
      target_name: p.target_name || '',
      target_deadline: p.target_deadline || '',
      report_emails: p.report_emails || '',
      report_daily: p.report_daily ? 1 : 0,
      report_weekly: p.report_weekly ? 1 : 0,
      report_monthly: p.report_monthly ? 1 : 0,
      report_digest: p.report_digest ? 1 : 0,
      engineer_name: p.engineer_name || '',
      contractor_name: p.contractor_name || '',
      notice_clause: p.notice_clause || '',
      reply_days: p.reply_days || '',
      logo_consultant: p.logo_consultant || '',
      logo_consultant2: p.logo_consultant2 || '',
      logo_contractor: p.logo_contractor || '',
      proof_at_100: p.proof_at_100 === 0 ? 0 : 1,
      materials: projectMaterials(p),
      materials_set: !!p.materials,
      currency: p.currency || 'AED',
    },
    activities: acts.results || [],
    current,
    history: history.results || [],
    manpower: mp.results || [],
    photos: photos.results || [],
    targets: targets.results || [],
    recent: recent.results || [],
  };
}

// Initials for the sidebar avatar.
function initials(name) {
  const p = String(name || '').trim().split(/\s+/);
  return (((p[0] || '')[0] || '') + ((p[1] || '')[0] || '')).toUpperCase() || 'U';
}

// Uploading drawings belongs to Design and Document Control (and the Principal
// and PM, who hold every folder). The legacy 'lead' role covers HSE, Finance,
// Procurement and the rest as well, so for a named person it is not enough.
function mayUploadDrawings(role, me) {
  if (!can.drawingsUpload(role)) return false;
  if (!me) return true;                                  // code logins keep the old rule
  const f = userFunctions(me);
  return ['principal', 'pm', 'design', 'dc'].some((x) => f.includes(x));
}

// Names for each kind of record, for screens and messages.
const RECORD_LABEL = { rfi: 'RFI', submittal: 'Submittal', ms: 'Method statement', material: 'Material approval',
  authority: 'Authority NOC', letter: 'Letter', incoming: 'Incoming letter', variation: 'Variation', wir: 'Inspection (WIR)', mir: 'Material inspection (MIR)',
  ncr: 'NCR', obs: 'HSE observation', incident: 'Incident', ptw: 'Permit to work', mr: 'Material request' };

// Columns added after a project database was first made. Safe to try every time;
// tried once per running instance.
const PROJECT_COLS = {};
async function ensureProjectColumn(env, col) {
  if (PROJECT_COLS[col]) return;
  try { await env.DB.prepare(`SELECT ${col} FROM projects LIMIT 1`).first(); }
  catch (e) { try { await env.DB.prepare(`ALTER TABLE projects ADD COLUMN ${col} TEXT`).run(); } catch (e2) { /* there */ } }
  PROJECT_COLS[col] = true;
}

// The programme is the planner's: Planning, the PM and the Principal may update
// it and take progress out for P6. (Code logins: the office roles.)
function mayPlan(role, me) {
  if (!me) return role === 'owner' || role === 'manager';
  const f = userFunctions(me);
  return ['planning', 'pm', 'principal'].some((x) => f.includes(x));
}

// May this person act on the step a record is waiting on?
//   advance / reject — the owner of the pending step (or Principal / PM)
//   close            — closing out early is the Principal's or the PM's alone
function stepPermission(me, rec, isPlatformAdmin, action) {
  if (isPlatformAdmin) return { ok: true };
  const fns = userFunctions(me);
  const boss = fns.includes('principal') || fns.includes('pm');
  const next = pendingStep(rec);
  if (!next) return { ok: false, error: 'This record is already closed.' };
  if (action === 'close') {
    return boss ? { ok: true } : { ok: false, error: 'Only the Project Manager or the Principal can close a record early.' };
  }
  if (boss) return { ok: true, step: next };
  const owners = next.by;
  if (!owners) {                       // an old record with no owners on its steps
    return mayApproveRecord(me, rec.type, false) ? { ok: true, step: next }
      : { ok: false, error: 'This is ' + whoMayApprove(rec.type) + "'s to approve, not yours." };
  }
  if (owners.some((f) => fns.includes(f))) return { ok: true, step: next };
  const names = owners.map((f) => (FUNCTIONS[f] || {}).label || f).join(' or ');
  return { ok: false, error: '“' + next.st + '” is for ' + names + ' — not part of your access.' };
}

// What the app shows on a record for the person looking at it.
function recordForViewer(me, rec, isPlatformAdmin) {
  const next = pendingStep(rec);
  // Where the Document Control "issue" step is in this record's ladder — once
  // it is signed and the record is still open, the ball is with the consultant.
  const wf = rec.workflow || [];
  let issueAt = wf.findIndex((s) => s && s.issue);
  if (issueAt < 0) {
    const t = RECORD_TYPES[rec.type];
    if (t && t.wf.length === wf.length) issueAt = t.wf.findIndex((s) => s.issue);
  }
  const withConsultant = !!(next && issueAt >= 0 && (rec.step || 0) >= issueAt);
  return Object.assign({}, rec, {
    next_step: next ? next.st : null,
    next_by_fns: next && next.by ? next.by : [],
    with_consultant: withConsultant,
    issued_on: withConsultant && wf[issueAt] ? String(wf[issueAt].when || '').slice(0, 10) : null,
    next_by: next && next.by ? next.by.map((f) => (FUNCTIONS[f] || {}).label || f) : [],
    next_is_issue: !!(next && next.issue),
    next_is_reply: !!(next && next.reply),
    can_act: !!(next && stepPermission(me, rec, isPlatformAdmin, 'advance').ok),
  });
}

// The identity + project context the live app shell boots with. Everything the
// design keyed on a demo account is supplied here from the real signed-in user.
async function buildMe(env, me, pid) {
  const fns = userFunctions(me);
  const primary = fns[0] || 'consultant';
  let sg = [];
  try { sg = JSON.parse(me.scope_groups || '[]'); } catch (e) { /* ignore */ }
  let projList = [];
  try {
    const all = await orgProjects(env, me.org_id);
    projList = all.filter((x) => userInProject(me, x.id)).map((x) => ({ id: x.id, name: x.name }));
  } catch (e) { /* ignore */ }
  const cur = projList.find((x) => x.id === pid) || projList[0] || {};
  const mods = (cur.id && await getProjectModules(env, cur.id).catch(() => null)) || MODULES.map((m) => m.id);
  return {
    email: me.email,
    name: me.name,
    av: initials(me.name),
    title: (FUNCTIONS[primary] && FUNCTIONS[primary].label) || '',
    roles: fns.length ? fns : [primary],
    siteDiscipline: sg[0] || '',
    projects: projList,
    projectId: cur.id || '',
    projectName: cur.name || '',
    projectSub: cur.name ? '' : '',
    canAssign: primary === 'principal' || fns.indexOf('pm') >= 0 || primary === 'pm',
    // What this person may raise and approve, computed from the one matrix in
    // functions.js. Sent rather than re-derived in the page, so the buttons on
    // screen can never drift away from what the API will accept.
    mayRaise: Object.keys(RECORD_CREATORS).filter((t) => mayCreateRecord(me, t, false) && recordTypeOn(mods, t)),
    mayApprove: Object.keys(RECORD_APPROVERS).filter((t) => recordTypeOn(mods, t) &&
      (fns.includes('principal') || fns.includes('pm') || approverFunctions(t).some((f) => fns.includes(f)))),
    // The modules switched on for this project, and the dashboards to hide.
    modules: mods,
    dashOff: dashboardsOff(mods),
    mayNotify: mayNotify(me),
  };
}

// One row per project, cheap enough to run on every portfolio load.
async function getPortfolio(env, oid) {
  const projects = oid ? await orgProjects(env, oid) : await listProjects(env);
  const { results: rows } = await env.DB.prepare(
    `SELECT a.project_id AS pid,
            COUNT(*) AS total,
            SUM(CASE WHEN COALESCE(u.pct,0) >= 100 THEN 1 ELSE 0 END) AS done,
            SUM(CASE WHEN u.status IN ('delayed','at_risk','on_hold') THEN 1 ELSE 0 END) AS flagged,
            MIN(a.planned_start) AS first_start,
            MAX(a.planned_finish) AS last_finish,
            SUM(COALESCE(u.pct,0) * COALESCE(NULLIF(a.weight,0), 1)) AS earned,
            SUM(COALESCE(NULLIF(a.weight,0), 1)) AS weight
       FROM activities a
       LEFT JOIN updates u ON u.project_id = a.project_id AND u.id =
            (SELECT MAX(id) FROM updates WHERE project_id = a.project_id AND activity_id = a.id)
      WHERE COALESCE(a.level,1) >= 1
      GROUP BY a.project_id`
  ).all();
  const { results: tgt } = await env.DB.prepare(
    `SELECT t.project_id AS pid,
            COUNT(*) AS total,
            SUM(CASE WHEN COALESCE(u.pct,0) >= 100 THEN 1 ELSE 0 END) AS cleared,
            SUM(CASE WHEN COALESCE(u.pct,0) < 100 AND t.target_finish < ? THEN 1 ELSE 0 END) AS missed
       FROM targets t
       LEFT JOIN updates u ON u.project_id = t.project_id AND u.id =
            (SELECT MAX(id) FROM updates WHERE project_id = t.project_id AND activity_id = t.activity_id)
      GROUP BY t.project_id`
  // Dates are stored as ISO text. SQLite will compare text to a date and
  // PostgreSQL will not, so today's date is bound as text and the comparison
  // means the same thing on both.
  ).bind(today()).all();
  const { results: last } = await env.DB.prepare(
    `SELECT project_id AS pid, MAX(created_at) AS at, COUNT(*) AS n
       FROM updates WHERE source = 'site' GROUP BY project_id`
  ).all();

  const by = (list) => Object.fromEntries((list || []).map((r) => [r.pid, r]));
  const A = by(rows), T = by(tgt), L = by(last);
  return json({
    generated_at: nowISO(),
    projects: projects.map((p) => ({
      ...p,
      stats: {
        activities: (A[p.id] || {}).total || 0,
        complete: (A[p.id] || {}).done || 0,
        flagged: (A[p.id] || {}).flagged || 0,
        pct: (A[p.id] || {}).weight ? (A[p.id].earned / A[p.id].weight) : 0,
        first_start: (A[p.id] || {}).first_start || null,
        last_finish: (A[p.id] || {}).last_finish || null,
        target_total: (T[p.id] || {}).total || 0,
        target_cleared: (T[p.id] || {}).cleared || 0,
        target_missed: (T[p.id] || {}).missed || 0,
        last_update: (L[p.id] || {}).at || null,
        site_updates: (L[p.id] || {}).n || 0,
      },
    })),
  });
}

async function getTrades(env, pid, scope) {
  const s = scopeSql(scope, 'a');
  const { results } = await env.DB.prepare(
    `SELECT COALESCE(NULLIF(a.trade,''), '~other') AS trade,
            COALESCE(NULLIF(a.trade_group,''), '') AS trade_group,
            a.discipline AS discipline,
            COUNT(*) AS total,
            SUM(CASE WHEN COALESCE(u.pct,0) >= 100 THEN 0 ELSE 1 END) AS pending,
            SUM(CASE WHEN u.status IN ('delayed','at_risk','on_hold') THEN 1 ELSE 0 END) AS flagged
       FROM activities a
       LEFT JOIN updates u ON u.project_id = a.project_id AND u.id =
            (SELECT MAX(id) FROM updates WHERE project_id = a.project_id AND activity_id = a.id)
      WHERE a.project_id = ? AND COALESCE(a.level,1) >= 1 AND ${s.sql}
        AND (COALESCE(a.trade,'') <> '' OR COALESCE(a.discipline,'') IN ('','Construction'))
      GROUP BY trade, trade_group, a.discipline
      ORDER BY pending DESC, trade`
  ).bind(pid, ...s.args).all();

  const merged = {};
  for (const r of results || []) {
    const k = r.trade + '|' + r.trade_group;
    if (!merged[k]) merged[k] = { trade: r.trade, trade_group: r.trade_group, total: 0, pending: 0, flagged: 0 };
    merged[k].total += r.total; merged[k].pending += r.pending; merged[k].flagged += r.flagged;
  }
  const p = (await getProject(env, pid)) || {};
  return json({
    meta: { project_name: p.name || 'Project', project_ref: p.ref || '' },
    scope: isFullScope(scope) ? null : { ...scope, text: describeScope(scope) },
    trades: Object.values(merged).sort((a, b) => b.pending - a.pending || a.trade.localeCompare(b.trade)),
  });
}

async function getSiteData(env, pid, trade, scope) {
  const other = trade === '~other';
  const s = scopeSql(scope, 'a');
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.name, a.wbs, a.floor, a.trade, a.planned_start, a.planned_finish, a.sort_order,
            u.pct, u.status, u.actual_start, u.actual_finish, u.delay_reason, u.remarks,
            u.report_date, u.submitted_by,
            t.target_finish AS target_finish, t.target_group AS target_group
       FROM activities a
       LEFT JOIN updates u ON u.project_id = a.project_id AND u.id =
            (SELECT MAX(id) FROM updates WHERE project_id = a.project_id AND activity_id = a.id)
       LEFT JOIN targets t ON t.project_id = a.project_id AND t.activity_id = a.id
      WHERE a.project_id = ? AND COALESCE(a.level,1) >= 1 AND ${s.sql}
        AND ${other
          ? `COALESCE(a.trade,'') = '' AND COALESCE(a.discipline,'') IN ('','Construction')`
          : `a.trade = ?`}
      ORDER BY COALESCE(a.floor,''), COALESCE(a.planned_start,'9999'), COALESCE(a.sort_order, 999999)
      LIMIT 1500`
  ).bind(pid, ...s.args, ...(other ? [] : [trade])).all();
  const rows = results || [];
  const ids = rows.map((r) => r.id);
  // The two things site needs on the card: whether it is evidenced, and whether
  // the office sent it back.
  const [pics, verdicts, dwgs] = await Promise.all([
    photoCounts(env, pid, ids).catch(() => ({})),
    verdictsFor(env, pid, ids),
    drawingCounts(env, pid, rows).catch(() => ({})),
  ]);
  for (const r of rows) {
    r.photos = pics[r.id] || 0;
    r.drawings = dwgs[r.id] || 0;
    const v = verdicts[r.id];
    if (v) { r.verdict = v.status; r.verdict_note = v.note; r.verdict_by = v.by; r.verdict_at = v.at; }
  }
  return json({ trade, activities: rows });
}

/* ----------------------------------------------------------- API: write */

async function postUpdate(req, env, role, pid, scope, proofAt100, whoName) {
  const b = await req.json();
  const ids = Array.isArray(b.activity_id) ? b.activity_id : [b.activity_id];

  // Scope is enforced here, not only in what the page offers. Someone holding
  // the MEP code cannot write to a civil activity by any route.
  if (!isFullScope(scope)) {
    const allowed = await activitiesInScope(env, pid, scope, ids.filter(Boolean).map(String));
    const refused = ids.filter((id) => id && !allowed.has(String(id)));
    if (refused.length) {
      return json({ error: `outside your trades: ${refused.slice(0, 3).join(', ')}` }, 403);
    }
  }

  // Claiming an activity complete needs a photograph of it. Enforced here, not
  // only in the page — a claim of 100% with no evidence is the one that matters.
  if (proofAt100 && role !== 'owner' && role !== 'manager') {
    const pctIn = num(b.pct);
    if (pctIn !== null && pctIn >= 100) {
      const bare = await missingProof(env, pid, ids.filter(Boolean).map(String));
      if (bare.length) {
        return json({
          error: 'A photograph is needed before an activity can be marked complete.',
          needs_photo: bare,
        }, 422);
      }
    }
  }

  const rd = date(b.report_date) || today();
  // A named person's name wins over whatever the page typed into the form. The
  // whole reason for accounts is that an update can be traced to one man.
  const by = whoName || str(b.submitted_by, 80) || (role === 'site' ? 'site' : 'office');
  const status = STATUSES.includes(b.status) ? b.status : null;
  const pct = num(b.pct);

  const rows = ids.filter(Boolean).map((id) =>
    env.DB.prepare(
      `INSERT INTO updates
         (project_id, activity_id, report_date, pct, actual_start, actual_finish, status,
          delay_reason, remarks, submitted_by, source, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,'site',?)`
    ).bind(
      pid, str(id, 60), rd,
      pct === null ? null : Math.max(0, Math.min(100, pct)),
      date(b.actual_start), date(b.actual_finish), status,
      str(b.delay_reason, 80), str(b.remarks, 2000), by, nowISO()
    )
  );
  if (!rows.length) return json({ error: 'no activity given' }, 400);
  await env.DB.batch(rows);
  return json({ ok: true, saved: rows.length });
}

async function postManpower(req, env, role, pid, whoName) {
  const b = await req.json();
  const rd = date(b.report_date) || today();
  const by = whoName || str(b.submitted_by, 80) || 'site';
  const lines = (Array.isArray(b.lines) ? b.lines : [])
    .filter((l) => l && str(l.trade) && num(l.headcount) !== null);
  if (!lines.length) return json({ error: 'no manpower lines' }, 400);

  const stmts = [
    ...lines.map((l) =>
      env.DB.prepare('DELETE FROM manpower WHERE project_id = ? AND report_date = ? AND trade = ?')
        .bind(pid, rd, str(l.trade, 80))),
    ...lines.map((l) =>
      env.DB.prepare(
        `INSERT INTO manpower (project_id, report_date, trade, headcount, plant, submitted_by, created_at)
         VALUES (?,?,?,?,?,?,?)`
      ).bind(pid, rd, str(l.trade, 80), Math.max(0, Math.round(num(l.headcount))),
             str(l.plant, 500), by, nowISO())),
  ];
  await env.DB.batch(stmts);
  return json({ ok: true, saved: lines.length });
}

async function postPhoto(req, env, role, pid, whoName) {
  const b = await req.json();
  const data = String(b.data || '');
  if (!data.startsWith('data:image/')) return json({ error: 'expected a data:image URL' }, 400);
  if (data.length > 1_400_000) return json({ error: 'image too large after resize' }, 413);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO photos (id, project_id, activity_id, report_date, caption, mime, data, submitted_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, pid, str(b.activity_id, 60), date(b.report_date) || today(), str(b.caption, 300),
    data.slice(5, data.indexOf(';')), data, whoName || str(b.submitted_by, 80) || 'site', nowISO()
  ).run();
  return json({ ok: true, id });
}

async function servePhoto(env, pid, id) {
  const row = await env.DB.prepare('SELECT mime, data FROM photos WHERE id = ? AND project_id = ?')
    .bind(id, pid).first();
  if (!row) return new Response('not found', { status: 404 });
  const bin = Uint8Array.from(atob(row.data.slice(row.data.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  return new Response(bin, {
    headers: { 'Content-Type': row.mime || 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
}

// A drawing comes back inline rather than as a download: a man on a slab wants
// to look at it, not save it. A superseded sheet is still served — it has to be,
// for the record — but it is not reachable from any activity, only from the
// register, where it is stamped.
async function serveDrawing(env, pid, id) {
  let row;
  try {
    row = await env.DB.prepare(
      'SELECT number, revision, mime, data, url, r2_key FROM drawings WHERE project_id = ? AND id = ?'
    ).bind(pid, String(id)).first();
  } catch (err) {
    return new Response('The drawing register is not set up on this database yet.', { status: 404 });
  }
  if (!row) return new Response('not found', { status: 404 });

  const mime = row.mime || 'application/pdf';
  const ext = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '');
  const name = `${row.number}${row.revision ? ' Rev ' + row.revision : ''}`.replace(/[^\w .-]+/g, '-');
  const headers = {
    'Content-Type': mime,
    'Content-Disposition': `inline; filename="${name}.${ext}"`,
    'Cache-Control': 'private, max-age=86400',
  };

  // The real set lives in the file store. The register row names the key; where
  // the bytes actually are — R2 here, Oracle's object storage after the move —
  // is the store's business and changes by configuration, not by code.
  if (row.r2_key) {
    const f = await getFile(env, row.r2_key);
    if (!f) return new Response('that drawing is not in the file store', { status: 404 });
    return new Response(f.bytes, { headers });
  }

  if (!row.data) {
    if (row.url) return Response.redirect(row.url, 302);
    return new Response('that drawing has no file against it', { status: 404 });
  }
  const bin = Uint8Array.from(atob(row.data.slice(row.data.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  return new Response(bin, { headers });
}

/* ------------------------------------------------ the programme, computed */

// Everything the engine needs, in three queries. The logic is a few thousand
// rows and D1 is single-threaded, so it is read in bulk and never per activity.
async function loadSchedule(env, pid) {
  let acts, links, cals, project;
  try {
    project = await getProject(env, pid);
    const a = await env.DB.prepare(
      `SELECT id, name, wbs, trade, trade_group, floor, calendar_id, act_type, status,
              orig_minutes, remain_minutes, phys_pct, actual_start, actual_finish,
              constraint_type, constraint_date, planned_start, planned_finish
         FROM activities WHERE project_id = ? AND COALESCE(level,1) >= 1`
    ).bind(pid).all();
    acts = a.results || [];
    const l = await env.DB.prepare(
      'SELECT from_id AS "from", to_id AS "to", type, lag_minutes FROM links WHERE project_id = ?'
    ).bind(pid).all();
    links = l.results || [];
    const c = await env.DB.prepare(
      'SELECT id, name, day_minutes, data FROM calendars WHERE project_id = ?'
    ).bind(pid).all();
    cals = c.results || [];
  } catch (err) {
    return { error: 'The programme logic is not set up on this database yet — ' +
                    'run upgrade-logic.sh.', migrated: false };
  }
  if (!links.length) {
    return { error: 'No logic has been imported for this project yet. Until it is, ' +
                    'the app can say an activity is late but not what that does to ' +
                    'the end of the job.', migrated: true, no_logic: true };
  }

  const calendars = {};
  for (const c of cals) calendars[c.id] = unpackCal(c.data, c.id);

  const byId = {};
  for (const a of acts) byId[a.id] = a;

  return {
    project, byId, acts,
    input: {
      // "2026-09-01 07:00" is not an ISO string, and Date.parse quietly returns
      // NaN for it, which turns every comparison in the forward pass false and
      // produces a date that looks plausible and is months wrong.
      data_date: parseCalDate(project && project.data_date),
      default_calendar: project && project.default_calendar,
      retained_logic: !project || project.retained_logic !== 0,
      float_against: parseCalDate(project && project.contract_finish),
      calendars,
      activities: acts.map((a) => ({
        id: a.id,
        calendar_id: a.calendar_id,
        act_type: a.act_type,
        status: a.status || 'not_started',
        orig_minutes: a.orig_minutes || 0,
        remain_minutes: a.remain_minutes === null ? a.orig_minutes : a.remain_minutes,
        actual_start: parseCalDate(a.actual_start),
        actual_finish: parseCalDate(a.actual_finish),
        constraint: a.constraint_type,
        constraint_date: parseCalDate(a.constraint_date),
      })),
      links,
    },
  };
}

const day10 = (t) => (t ? new Date(t).toISOString().slice(0, 10) : null);

// The three sentences somebody actually wants: when it now finishes, how that
// compares with the contract, and what is holding it.
function scheduleSummary(model) {
  const r = runCPM(model.input);
  const contract = model.input.float_against;
  const cal = Object.values(model.input.calendars)[0] || null;
  const over = contract ? between(cal || { empty: true }, contract, r.finish) : null;

  const name = (id) => (model.byId[id] ? model.byId[id].name : id);
  const driving = r.driving.map((id) => {
    const row = r.byActivity[id], a = model.byId[id] || {};
    return {
      id, name: a.name || id, trade: a.trade || '', floor: a.floor || '',
      status: row.status,
      start: day10(row.early_start), finish: day10(row.early_finish),
      float_days: row.float_days,
      driven_by: row.driven_by ? { id: row.driven_by.id, name: name(row.driven_by.id),
                                   type: row.driven_by.type } : null,
    };
  });

  const late = r.rows.filter((x) => x.status !== 'complete' && x.float_days !== null
    && x.float_days < 0).length;

  return {
    migrated: true,
    data_date: day10(r.data_date),
    contract_finish: day10(contract),
    forecast_finish: day10(r.finish),
    // Reported in working days, because that is what a recovery is bought in.
    over_contract_days: over === null ? null : Math.round(over / ((cal && cal.day_minutes) || 480)),
    finish_activity: r.finish_activity,
    finish_activity_name: name(r.finish_activity),
    driving,
    activities: r.rows.length,
    links: model.input.links.length,
    behind_activities: late,
    cycles: r.cycles.slice(0, 20),
    // A schedule with loops in its logic cannot be forecast, and the honest
    // answer is to say so rather than to publish a date anyway.
    trustworthy: r.cycles.length === 0,
  };
}

function dressImpact(out, model) {
  const name = (id) => (model.byId[id] ? model.byId[id].name : id);
  return {
    ...out,
    activity_name: name(out.activity),
    finish_before: day10(out.finish_before),
    finish_after: day10(out.finish_after),
    path: (out.path || []).slice(0, 40).map((p) => ({
      id: p.id, name: name(p.id), finish: day10(p.finish),
    })),
  };
}

async function postImport(req, env, pid) {
  const b = await req.json();
  const rows = parseDelimited(String(b.text || ''));
  if (rows.length < 2) return json({ error: 'need a header row and at least one activity' }, 400);

  const map = headerMap(rows[0], ACT_ALIASES);
  if (map.name === undefined) {
    return json({ error: 'could not find an activity-name column (try a header called "Activity" or "Name")' }, 400);
  }

  const seen = new Set();
  const stmts = [];
  if (b.replace) stmts.push(env.DB.prepare('DELETE FROM activities WHERE project_id = ?').bind(pid));

  let order = 0, skipped = 0;
  for (const r of rows.slice(1)) {
    const get = (f) => (map[f] === undefined ? '' : (r[map[f]] ?? '').trim());
    const name = get('name');
    if (!name) { skipped++; continue; }
    let id = get('id') || `A${String(++order).padStart(4, '0')}`;
    while (seen.has(id)) id = `${id}_`;
    seen.add(id);
    order++;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO activities
           (project_id, id, wbs, name, level, planned_start, planned_finish, weight,
            trade, trade_group, floor, discipline, phase, responsible, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(project_id, id) DO UPDATE SET
           wbs=excluded.wbs, name=excluded.name, level=excluded.level,
           planned_start=excluded.planned_start, planned_finish=excluded.planned_finish,
           weight=excluded.weight, trade=excluded.trade, trade_group=excluded.trade_group,
           floor=excluded.floor, discipline=excluded.discipline, phase=excluded.phase,
           responsible=excluded.responsible, sort_order=excluded.sort_order`
      ).bind(
        pid, id, get('wbs') || null, name,
        num(get('level')) === null ? 1 : Math.max(0, Math.round(num(get('level')))),
        normaliseDate(get('planned_start')), normaliseDate(get('planned_finish')),
        num(get('weight')), get('trade') || null, get('trade_group') || null,
        get('floor') || null, get('discipline') || null, get('phase') || null,
        get('responsible') || null, order
      )
    );
  }
  if (!stmts.length) return json({ error: 'no usable rows found' }, 400);
  for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
  return json({ ok: true, imported: stmts.length - (b.replace ? 1 : 0), skipped });
}

const PROGRESS_ALIASES = {
  id: ['id', 'activity id', 'activity_id', 'code', 'ref'],
  report_date: ['report date', 'report_date', 'date', 'data date'],
  pct: ['%', 'pct', 'percent', '% complete', 'complete', 'progress'],
  actual_start: ['actual start', 'actual_start', 'act start'],
  actual_finish: ['actual finish', 'actual_finish', 'act finish'],
  status: ['status'],
  remarks: ['remarks', 'comment', 'note'],
};

async function postImportProgress(req, env, pid) {
  const b = await req.json();
  const rows = parseDelimited(String(b.text || ''));
  if (rows.length < 2) return json({ error: 'need a header row and at least one row' }, 400);
  const map = headerMap(rows[0], PROGRESS_ALIASES);
  if (map.id === undefined) return json({ error: 'could not find an activity ID column' }, 400);

  const by = str(b.submitted_by, 80) || 'programme import';
  const stamp = nowISO();
  const stmts = [];
  if (b.replace) stmts.push(env.DB.prepare("DELETE FROM updates WHERE project_id = ? AND source = 'import'").bind(pid));

  let skipped = 0;
  for (const r of rows.slice(1)) {
    const get = (f) => (map[f] === undefined ? '' : (r[map[f]] ?? '').trim());
    const id = get('id');
    if (!id) { skipped++; continue; }
    const pct = num(get('pct'));
    stmts.push(
      env.DB.prepare(
        `INSERT INTO updates
           (project_id, activity_id, report_date, pct, actual_start, actual_finish, status,
            delay_reason, remarks, submitted_by, source, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,'import',?)`
      ).bind(
        pid, id, normaliseDate(get('report_date')) || today(),
        pct === null ? null : Math.max(0, Math.min(100, pct)),
        normaliseDate(get('actual_start')), normaliseDate(get('actual_finish')),
        STATUSES.includes(get('status')) ? get('status') : null,
        null, str(get('remarks'), 2000) || null, by, stamp
      )
    );
  }
  if (!stmts.length) return json({ error: 'no usable rows found' }, 400);
  for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
  return json({ ok: true, imported: stmts.length - (b.replace ? 1 : 0), skipped });
}

const TARGET_ALIASES = {
  id: ['id', 'activity id', 'activity_id', 'code', 'ref'],
  target_group: ['target group', 'group', 'trade', 'section', 'sheet'],
  work: ['work', 'work to be done', 'activity', 'description', 'name'],
  level: ['level', 'floor', 'area'],
  days_left: ['days left', 'days of work left', 'days', 'duration'],
  target_start: ['start', 'target start'],
  target_finish: ['finish by', 'finish', 'target finish', 'due', 'deadline'],
  sort_order: ['order', 'sort', 'seq'],
};

async function postImportTargets(req, env, pid) {
  const b = await req.json();
  const rows = parseDelimited(String(b.text || ''));
  if (rows.length < 2) return json({ error: 'need a header row and at least one row' }, 400);
  const map = headerMap(rows[0], TARGET_ALIASES);
  if (map.id === undefined) return json({ error: 'could not find an activity ID column' }, 400);

  const stmts = [env.DB.prepare('DELETE FROM targets WHERE project_id = ?').bind(pid)];
  let order = 0, skipped = 0;
  for (const r of rows.slice(1)) {
    const get = (f) => (map[f] === undefined ? '' : (r[map[f]] ?? '').trim());
    const id = get('id');
    if (!id) { skipped++; continue; }
    order++;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO targets (project_id, activity_id, target_group, work, level, days_left,
                              target_start, target_finish, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(project_id, activity_id) DO UPDATE SET
           target_group=excluded.target_group, work=excluded.work, level=excluded.level,
           days_left=excluded.days_left, target_start=excluded.target_start,
           target_finish=excluded.target_finish, sort_order=excluded.sort_order`
      ).bind(
        pid, str(id, 60), str(get('target_group'), 120) || null, str(get('work'), 500) || null,
        str(get('level'), 80) || null, num(get('days_left')),
        normaliseDate(get('target_start')), normaliseDate(get('target_finish')),
        num(get('sort_order')) === null ? order : Math.round(num(get('sort_order')))
      )
    );
  }
  if (stmts.length < 2) return json({ error: 'no usable rows found' }, 400);
  for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));

  const matched = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM targets t JOIN activities a
       ON a.project_id = t.project_id AND a.id = t.activity_id WHERE t.project_id = ?`
  ).bind(pid).first();

  if (b.target_name !== undefined || b.target_deadline !== undefined) {
    await env.DB.prepare('UPDATE projects SET target_name = ?, target_deadline = ? WHERE id = ?')
      .bind(str(b.target_name, 200) || null, normaliseDate(b.target_deadline), pid).run();
  }
  return json({ ok: true, imported: stmts.length - 1, matched: matched ? matched.n : 0, skipped });
}

async function exportCSV(env, pid) {
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.wbs, a.name, a.level, a.planned_start, a.planned_finish,
            a.trade, a.trade_group, a.floor, a.discipline, a.phase, a.responsible,
            t.target_finish, t.target_group,
            u.report_date, u.pct, u.actual_start, u.actual_finish, u.status, u.delay_reason,
            u.remarks, u.submitted_by
       FROM activities a
       LEFT JOIN updates u ON u.project_id = a.project_id AND u.id =
            (SELECT MAX(id) FROM updates WHERE project_id = a.project_id AND activity_id = a.id)
       LEFT JOIN targets t ON t.project_id = a.project_id AND t.activity_id = a.id
      WHERE a.project_id = ?
      ORDER BY COALESCE(a.sort_order, 999999)`
  ).bind(pid).all();
  const cols = ['id','wbs','name','level','planned_start','planned_finish','trade','trade_group',
                'floor','discipline','phase','responsible','target_finish','target_group',
                'report_date','pct','actual_start','actual_finish','status','delay_reason','remarks','submitted_by'];
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [cols.join(','), ...(results || []).map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${pid}-progress-${today()}.csv"`,
    },
  });
}

/* --------------------------------------------------------------- issues */

// The register, with the activities it points at, so the page can name them
// without a second round trip.
async function issuesPayload(env, pid, url) {
  const issues = await listIssues(env, pid, {
    status: url.searchParams.get('status') || null,
    type: url.searchParams.get('type') || null,
    open: url.searchParams.get('open') === '1',
    activity_id: url.searchParams.get('activity') || null,
  });
  const ids = [...new Set(issues.map((i) => i.activity_id).filter(Boolean))].slice(0, 400);
  const activities = {};
  for (const slice of chunked(ids)) {
    const { results } = await env.DB.prepare(
      `SELECT id, name, planned_start, planned_finish, trade, floor FROM activities
        WHERE project_id = ? AND id IN (${slice.map(() => '?').join(',')})`
    ).bind(pid, ...slice).all();
    for (const a of results || []) activities[a.id] = a;
  }

  // The summary counts the whole register, not the filtered view — otherwise the
  // tiles would change meaning every time you changed a filter.
  const all = await listIssues(env, pid, { limit: 1000 });
  const open = all.filter((i) => i.open);
  const summary = {
    total: all.length,
    draft: all.filter((i) => i.status === 'draft').length,
    issued: all.filter((i) => i.status === 'issued').length,
    answered: all.filter((i) => i.status === 'answered').length,
    closed: all.filter((i) => i.status === 'closed').length,
    overdue: all.filter((i) => i.overdue).length,
    oldest_open: open.length ? Math.max(...open.map((i) => i.age || 0)) : null,
    impact_days: Math.round(open.reduce((s, i) => s + (i.impact_days || 0), 0) * 10) / 10 || null,
  };
  return { types: ISSUE_TYPES, issues, activities, summary };
}

/* ---------------------------------------------------------------- email */

// Recipients are stored as free text so you can paste a list in; anything that
// isn't an address is quietly dropped rather than failing the whole send.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const parseRecipients = (raw) =>
  String(raw || '').split(/[\s,;]+/).map((s) => s.trim()).filter((s) => EMAIL_RE.test(s)).slice(0, 30);

// ONE DOOR, TWO DRIVERS — the same arrangement as storage.js.
//
//   azure     ACS_ENDPOINT + ACS_KEY (or ACS_CONNECTION_STRING)
//   resend    RESEND_KEY
//   none      neither is set: the app never emails, and everything else carries on
//
// Azure wins when both are set, because a platform already running in the
// customer's own Azure tenant should not be posting its sign-in codes through a
// second vendor nobody reviewed. Switching provider is a config line, not a
// rewrite, and nothing above sendEmail() knows which driver ran.
const FROM_DEFAULT = 'Site Progress <onboarding@resend.dev>';

export function emailDriver(env) {
  if (acsConfig(env)) return 'azure';
  if (env && env.RESEND_KEY) return 'resend';
  return 'none';
}

const EMAIL_DRIVER_LABEL = {
  azure: 'Azure Communication Services',
  resend: 'Resend',
  none: 'not configured',
};

// What the app can say about its own email without being signed in anywhere.
// The key itself never leaves the server; only whether there is one.
function emailStatus(env) {
  const driver = emailDriver(env);
  // Resend's shared sender is a sensible default only for Resend. On Azure
  // there is no shared sender at all, so falling back to it would guarantee a
  // refusal — better to report the sender as unset and say so.
  const from = env.REPORT_FROM || (driver === 'resend' ? FROM_DEFAULT : '');
  return {
    driver,
    driver_label: EMAIL_DRIVER_LABEL[driver],
    key: driver !== 'none',
    from,
    // Resend's shared sender only ever delivers to the address the Resend
    // account was opened with. Everything else is accepted by the form and
    // refused by Resend — which looks exactly like a code that never arrives.
    test_sender: driver === 'resend' && /onboarding@resend\.dev/.test(from),
    // Azure will not send until the sender's domain is provisioned on the Email
    // Communication Service AND linked to this resource.
    sender_set: !!from,
  };
}

async function sendEmail(env, to, subject, htmlBody) {
  const driver = emailDriver(env);
  if (driver === 'none') {
    return { ok: false, error: 'no email key set', reason: 'no-key' };
  }
  if (!to.length) return { ok: false, error: 'no recipients', reason: 'no-recipients' };

  if (driver === 'azure') {
    const from = env.REPORT_FROM || '';
    if (!from) {
      return { ok: false, reason: 'no-sender',
        error: 'Azure email is configured but no sender address is set' };
    }
    return sendViaAzure(env, to, subject, htmlBody, from);
  }

  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.REPORT_FROM || FROM_DEFAULT,
        to,
        subject,
        html: htmlBody,
      }),
    });
  } catch (err) {
    console.log('email: could not reach Resend —', String((err && err.message) || err));
    return { ok: false, error: 'could not reach the email service', reason: 'network' };
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    // Printed so the server log shows the real reason. Resend's refusals are
    // specific and useful — an unverified domain, a sender that may only write to
    // one address — and swallowing them is what turns this into a mystery.
    console.log(`email: Resend refused ${res.status} — ${body}`);
    return { ok: false, status: res.status, error: `${res.status} ${body}`, reason: 'resend' };
  }
  return { ok: true, driver: 'resend' };
}

// The provider's own words, turned into something a person can act on. Each
// driver gets its own advice, because "set the key again" is useless when the
// real problem is a domain that was never linked to the Azure resource.
function emailAdvice(sent, env) {
  const st = emailStatus(env);

  if (sent.reason === 'no-key') {
    return 'No email is set up on this server, so it cannot send anything. ' +
           'For Azure: sudo aetraa-config ACS_CONNECTION_STRING "endpoint=...;accesskey=..." ' +
           'and sudo aetraa-config REPORT_FROM "AETRAA <no-reply@your-domain>".';
  }
  if (sent.reason === 'network') return 'The email service could not be reached. Try again in a minute.';
  if (sent.reason === 'no-recipients') return 'There was nobody to send it to.';

  if (sent.reason === 'no-sender') {
    return 'Azure email is configured but no sender address is set. Azure has no shared sender, ' +
           'so one must be given: sudo aetraa-config REPORT_FROM "AETRAA <no-reply@your-domain>" ' +
           '— using an address on a domain provisioned in your Email Communication Service.';
  }
  if (sent.reason === 'azure-key') {
    return 'The Azure access key is not in the form Azure issues. Copy the connection string ' +
           'whole from the Communication Service → Keys blade and set it again: ' +
           'sudo aetraa-config ACS_CONNECTION_STRING "endpoint=...;accesskey=..."';
  }

  const body = String(sent.error || '');

  if (sent.reason === 'azure') {
    if (sent.status === 401) {
      return 'Azure refused the key. Copy the connection string again from the Communication ' +
             'Service → Keys blade: sudo aetraa-config ACS_CONNECTION_STRING "endpoint=...;accesskey=..."';
    }
    if (sent.status === 403) {
      return `Azure refused the sender "${st.from}". The domain must be provisioned in an Email ` +
             'Communication Service (its DNS records verified) AND that domain connected to this ' +
             'Communication Service under Email → Domains.';
    }
    if (sent.status === 400) {
      if (/senderAddress|DomainNotLinked|sender/i.test(body)) {
        return `Azure would not accept the sender "${st.from}". It must be an address on a domain ` +
               'connected to this Communication Service, written as  Name <address@domain>.';
      }
      return 'Azure rejected the message: ' + body;
    }
    if (sent.status === 429) {
      return 'Azure is rate-limiting. New email resources start on a low sending quota — raise it ' +
             'through a support request in the portal before onboarding a company.';
    }
    return body || 'The email did not go.';
  }

  if (sent.status === 401 || sent.status === 403) {
    if (/testing emails to your own/i.test(body) || (st.test_sender && /403/.test(body))) {
      return 'Resend refused it: the shared sender onboarding@resend.dev may only write to the ' +
             'address your Resend account was opened with. Verify your own domain at resend.com ' +
             'and set the sender: sudo aetraa-config REPORT_FROM "AETRAA <no-reply@aetraa.ae>"';
    }
    if (/domain is not verified|not verified/i.test(body)) {
      return `Resend refused it: the domain in "${st.from}" is not verified on your Resend account. ` +
             'Verify it at resend.com → Domains, or switch the sender back to onboarding@resend.dev.';
    }
    return 'Resend refused the key. Set it again: sudo aetraa-config RESEND_KEY <key>';
  }
  if (sent.status === 422) {
    return `Resend would not accept the sender "${st.from}". It must be a verified domain, ` +
           'written as  Name <address@domain>.';
  }
  if (sent.status === 429) return 'Resend is rate-limiting. Wait a minute and try again.';
  return body || 'The email did not go.';
}

async function emailReport(env, pid, kind, key) {
  const project = await getProject(env, pid);
  if (!project) return { ok: false, error: 'unknown project' };
  const to = parseRecipients(project.report_emails);
  if (!to.length) return { ok: false, error: 'no recipients set for this project' };
  const d = await buildReport(env, pid, project, kind, key);
  const sent = await sendEmail(env, to, reportSubject(d), reportDocument(d));
  return sent.ok ? { ok: true, sent: to.length } : sent;
}

// Runs on the cron trigger. One project at a time, and a failure on one never
// stops the rest — a bad address on project A must not silence project B.
async function runScheduledReports(env) {
  let results;
  try {
    ({ results } = await env.DB.prepare(
      `SELECT id FROM projects
        WHERE COALESCE(archived,0) = 0 AND COALESCE(report_daily,0) = 1
          AND COALESCE(report_emails,'') <> ''`
    ).all());
  } catch (err) {
    // The report columns are not there yet — nothing is set up to email.
    return [{ ok: false, error: 'report settings not migrated: ' + String((err && err.message) || err) }];
  }
  const day = today();
  const out = [];
  for (const row of results || []) {
    try {
      out.push({ project: row.id, ...(await emailReport(env, row.id, 'daily', day)) });
    } catch (err) {
      out.push({ project: row.id, ok: false, error: String((err && err.message) || err) });
    }
  }
  return out;
}

// The weekly send. Same shape as the daily, gated on report_weekly, and keyed on
// yesterday so a Monday-morning run covers the week that has just closed.
async function runScheduledWeekly(env) {
  let results;
  try {
    ({ results } = await env.DB.prepare(
      `SELECT id FROM projects
        WHERE COALESCE(archived,0) = 0 AND COALESCE(report_weekly,0) = 1
          AND COALESCE(report_emails,'') <> ''`
    ).all());
  } catch (err) {
    return [{ ok: false, error: 'weekly report settings not migrated: ' + String((err && err.message) || err) }];
  }
  // Any day inside the week just ended resolves to that Monday–Sunday window.
  const lastWeekDay = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const out = [];
  for (const row of results || []) {
    try {
      out.push({ project: row.id, ...(await emailReport(env, row.id, 'weekly', lastWeekDay)) });
    } catch (err) {
      out.push({ project: row.id, ok: false, error: String((err && err.message) || err) });
    }
  }
  return out;
}

// The monthly send, on the morning of the 1st: the month that has just closed.
let monthlyColOk = false;
async function ensureReportMonthly(env) {
  if (monthlyColOk) return;
  try { await env.DB.prepare('SELECT report_monthly FROM projects LIMIT 1').first(); }
  catch (e) { try { await env.DB.prepare('ALTER TABLE projects ADD COLUMN report_monthly INTEGER DEFAULT 0').run(); } catch (e2) { /* there */ } }
  monthlyColOk = true;
}
async function runScheduledMonthly(env) {
  await ensureReportMonthly(env);
  let results;
  try {
    ({ results } = await env.DB.prepare(
      `SELECT id FROM projects
        WHERE COALESCE(archived,0) = 0 AND COALESCE(report_monthly,0) = 1
          AND COALESCE(report_emails,'') <> ''`
    ).all());
  } catch (err) {
    return [{ ok: false, error: 'monthly report settings not migrated: ' + String((err && err.message) || err) }];
  }
  // Yesterday in the UAE is the last day of the month just closed.
  const lastMonth = new Date(Date.now() + 4 * 3600000 - 86400000).toISOString().slice(0, 7);
  const out = [];
  for (const row of results || []) {
    try {
      out.push({ project: row.id, ...(await emailReport(env, row.id, 'monthly', lastMonth)) });
    } catch (err) {
      out.push({ project: row.id, ok: false, error: String((err && err.message) || err) });
    }
  }
  return out;
}

// STEP 10: every morning, each person on a project that has it switched on gets
// their own "needs your attention" list — only if there is something on it.
let digestColOk = false;
async function ensureReportDigest(env) {
  if (digestColOk) return;
  try { await env.DB.prepare('SELECT report_digest FROM projects LIMIT 1').first(); }
  catch (e) { try { await env.DB.prepare('ALTER TABLE projects ADD COLUMN report_digest INTEGER DEFAULT 0').run(); } catch (e2) { /* there */ } }
  digestColOk = true;
}
async function runScheduledDigest(env) {
  await ensureReportDigest(env);
  let results;
  try {
    ({ results } = await env.DB.prepare(
      `SELECT id FROM projects WHERE COALESCE(archived,0) = 0 AND COALESCE(report_digest,0) = 1`).all());
  } catch (err) { return [{ ok: false, error: String((err && err.message) || err) }]; }
  const out = [];
  for (const row of results || []) {
    try {
      const project = await getProject(env, row.id);
      const team = await projectTeam(env, project.org_id, row.id);
      let sent = 0;
      for (const u of team) {
        if (!u.email) continue;
        const a = await attentionFor(env, row.id, project, { id: u.id, name: u.name }, u.functions, null);
        if (!a.total) continue;
        const r = await sendEmail(env, [u.email], (project.name || 'Project') + ' — ' + a.total + ' thing' + (a.total === 1 ? '' : 's') +
          ' need' + (a.total === 1 ? 's' : '') + ' you' + (a.overdue ? ' (' + a.overdue + ' overdue)' : ''), attentionEmail(a, project, env.PUBLIC_URL || ''));
        if (r.ok) sent++;
      }
      out.push({ project: row.id, ok: true, sent });
    } catch (err) { out.push({ project: row.id, ok: false, error: String((err && err.message) || err) }); }
  }
  return out;
}

// Who may read and send the progress reports: the office roles, and by function
// the Principal, PM, Planning, Document Control and Commercial.
function mayReport(role, me) {
  if (can.report(role)) return true;
  if (!me) return false;
  const f = userFunctions(me);
  return ['principal', 'pm', 'planning', 'dc', 'commercial', 'hse'].some((x) => f.includes(x));
}

// Create / rename / re-code / archive a project. Owner only.
async function postProject(req, env, isPlatformAdmin) {
  const b = await req.json();
  const action = String(b.action || 'save');

  if (action === 'create') {
    if (!isPlatformAdmin) {
      return json({ error: 'projects are set up by AETRAA, not from inside the app' }, 403);
    }
    const name = str(b.name, 200);
    if (!name) return json({ error: 'a project needs a name' }, 400);
    let id = slug(b.id || name) || 'p';
    const taken = await env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(id).first();
    if (taken) {
      let n = 2;
      while (await env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(id + n).first()) n++;
      id = id + n;
    }
    await env.DB.prepare(
      `INSERT INTO projects (id, name, ref, contract_completion, sort_order, created_at)
       VALUES (?,?,?,?,(SELECT COALESCE(MAX(sort_order),0)+1 FROM projects),?)`
    ).bind(id, name, str(b.ref, 200), date(b.contract_completion), nowISO()).run();
    return json({ ok: true, id });
  }

  const pid = str(b.id, 24);
  if (!pid || !(await getProject(env, pid))) return json({ error: 'unknown project' }, 404);

  if (action === 'archive') {
    await env.DB.prepare('UPDATE projects SET archived = ? WHERE id = ?')
      .bind(b.archived ? 1 : 0, pid).run();
    return json({ ok: true });
  }

  if (action === 'proof') {
    await env.DB.prepare('UPDATE projects SET proof_at_100 = ? WHERE id = ?')
      .bind(b.proof_at_100 ? 1 : 0, pid).run();
    return json({ ok: true });
  }

  if (action === 'logos') {
    const img = (v) => {
      const s = String(v || '');
      if (!s.startsWith('data:image/')) return null;
      if (s.length > 400_000) return null;       // already shrunk in the browser
      return s;
    };
    await env.DB.prepare(
      'UPDATE projects SET logo_consultant = ?, logo_consultant2 = ?, logo_contractor = ? WHERE id = ?'
    ).bind(
      b.clear ? null : img(b.logo_consultant),
      b.clear ? null : img(b.logo_consultant2),
      b.clear ? null : img(b.logo_contractor),
      pid
    ).run();
    return json({ ok: true });
  }

  if (action === 'letter') {
    const days = num(b.reply_days);
    await env.DB.prepare(
      `UPDATE projects SET engineer_name = ?, contractor_name = ?, notice_clause = ?, reply_days = ?
        WHERE id = ?`
    ).bind(
      str(b.engineer_name, 200), str(b.contractor_name, 200), str(b.notice_clause, 120),
      days === null ? null : Math.max(1, Math.min(60, Math.round(days))), pid
    ).run();
    return json({ ok: true });
  }

  // The project's material list. Fixing the unit with the material is the whole
  // point: a delivery booked in tonnes against a material measured in cubic
  // metres is worse than no figure at all.
  if (action === 'materials') {
    const list = (Array.isArray(b.materials) ? b.materials : [])
      .map((r) => ({ m: str(r.m, 160) || '', u: str(r.u, 24) || '' }))
      .filter((r) => r.m)
      .slice(0, 300);
    await env.DB.prepare('UPDATE projects SET materials = ?, currency = ? WHERE id = ?')
      .bind(list.length ? JSON.stringify(list) : null,
            str(b.currency, 8) || 'AED', pid).run();
    return json({ ok: true, materials: list.length });
  }

  if (action === 'report') {
    const list = parseRecipients(b.report_emails);
    // report_weekly is added by a later migration; write it only if the column
    // is there, so an un-migrated database still saves the recipients.
    await ensureReportMonthly(env);
    await ensureReportDigest(env);
    try {
      await env.DB.prepare('UPDATE projects SET report_emails = ?, report_daily = ?, report_weekly = ?, report_monthly = ?, report_digest = ? WHERE id = ?')
        .bind(list.join(', ') || null, b.report_daily ? 1 : 0, b.report_weekly ? 1 : 0, b.report_monthly ? 1 : 0, b.report_digest ? 1 : 0, pid).run();
    } catch (err) {
      await env.DB.prepare('UPDATE projects SET report_emails = ?, report_daily = ? WHERE id = ?')
        .bind(list.join(', ') || null, b.report_daily ? 1 : 0, pid).run();
    }
    return json({ ok: true, recipients: list });
  }

  if (action === 'codes') {
    const set = [], vals = [];
    for (const [field, col] of [['manager_code', 'manager_code_hash'],
                                ['site_code', 'site_code_hash'],
                                ['view_code', 'view_code_hash']]) {
      if (b[field] === undefined) continue;
      const code = String(b[field] || '').trim();
      if (code && code.length < 8) return json({ error: 'codes need to be at least 8 characters' }, 400);
      set.push(`${col} = ?`);
      vals.push(code ? await sha256(code) : null);
    }
    if (!set.length) return json({ error: 'no codes given' }, 400);
    await env.DB.prepare(`UPDATE projects SET ${set.join(', ')} WHERE id = ?`).bind(...vals, pid).run();
    return json({ ok: true });
  }

  await env.DB.prepare(
    'UPDATE projects SET name = ?, ref = ?, contract_completion = ?, target_name = ?, target_deadline = ? WHERE id = ?'
  ).bind(
    str(b.name, 200) || 'Project', str(b.ref, 200), date(b.contract_completion),
    str(b.target_name, 200), date(b.target_deadline), pid
  ).run();
  return json({ ok: true });
}

/* ---------------------------------------------------------------- router */

const APP = {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, '') || '/';
    const secret = env.AUTH_SECRET || 'dev-secret';
    const session = await readToken(cookieValue(req, COOKIE), secret);

    // A named person: who they are is in the cookie, what they may do is not.
    // Their role, their scope and whether their employer is still a paying
    // customer are all read here, on every request, so withdrawing somebody or
    // suspending an account takes effect on their next tap rather than whenever
    // the cookie happens to run out.
    let me = null, myOrg = null;
    if (session && session.uid) {
      me = await getUser(env, session.uid);
      if (!me || me.status === 'suspended') return signedOut('That account has been withdrawn.');
      myOrg = await getOrg(env, me.org_id);
      const blocked = orgBlocked(myOrg);
      if (blocked) return signedOut(blocked);
      // The platform owner code still exists and still outranks everything; a
      // person whose role is 'owner' owns their own organisation, not the app.
    }
    const role = me ? me.role : (session ? session.role : null);

    /* ---- things anyone may fetch: the home-screen app files */
    if (p === '/manifest.webmanifest') {
      return new Response(MANIFEST, {
        headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
      });
    }
    if (p === '/sw.js') {
      return new Response(SERVICE_WORKER, {
        headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' },
      });
    }
    if (p === '/icon-192.png' || p === '/icon-512.png' || p === '/favicon.ico') {
      const b64 = p === '/icon-512.png' ? ICON_512 : p === '/icon-192.png' ? ICON_192 : FAVICON;
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return new Response(bin, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800' },
      });
    }

    // The mark at the top of every page. A company that has uploaded its own
    // logo sees its own; everyone else sees AETRAA. It is per-person, so it is
    // never cached by anything in between.
    if (p === '/brand-logo') {
      const own = myOrg && typeof myOrg.logo === 'string' ? myOrg.logo.trim() : '';
      const m = /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/.exec(own);
      const [type, b64] = m ? [m[1], m[2].replace(/\s+/g, '')] : ['image/png', LOGO_PNG];
      let bin;
      try { bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); }
      catch (e) { bin = Uint8Array.from(atob(LOGO_PNG), (c) => c.charCodeAt(0)); }
      return new Response(bin, {
        headers: { 'Content-Type': m ? type : 'image/png', 'Cache-Control': 'private, max-age=300' },
      });
    }

    /* ---- the demo: no codes, because a demo is watched, not operated -----
     *
     * A company on the 'demo' plan is invented data put there to be shown. Its
     * people are therefore listed at /demo and entered with one click: in front
     * of a client, typing a code for the eighth time is the thing they remember.
     *
     * It reaches nothing else. Only a user whose organisation is on the demo
     * plan can be entered this way, so no real customer's account is openable
     * here however the request is dressed up.
     */
    if (p === '/demo' || p === '/api/demo/people') {
      const people = await demoPeople(env);
      if (p === '/api/demo/people') return json({ people });
      return html(demoPageHTML(people));
    }
    if (p === '/api/demo/enter' && req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const people = await demoPeople(env);
      const pick = people.find((x) => x.id === String(b.id || ''));
      if (!pick) return json({ error: 'that is not a demo account' }, 403);
      const person = await getUser(env, pick.id);
      if (!person || person.status === 'suspended') return json({ error: 'that is not a demo account' }, 403);
      const org = await getOrg(env, person.org_id);
      const blocked = orgBlocked(org);
      if (blocked) return json({ error: blocked }, 403);
      await touchUser(env, person.id);
      const list = userProjects(person);
      const first = list.length ? list[0] : null;
      const token = await makeUserToken(person.id, first, secret);
      const headers = new Headers({ 'Content-Type': 'application/json' });
      headers.append('Set-Cookie',
        `${COOKIE}=${token}; Path=/; Max-Age=${DAY}; HttpOnly; Secure; SameSite=Lax`);
      if (first) headers.append('Set-Cookie',
        `${PROJ_COOKIE}=${first}; Path=/; Max-Age=${DAY}; Secure; SameSite=Lax`);
      return new Response(JSON.stringify({ ok: true, role: person.role, project: first, name: person.name }), { headers });
    }

    /* ---- login / logout */
    if (p === '/api/login' && req.method === 'POST') {
      const { code } = await req.json().catch(() => ({}));
      const given = String(code || '').trim();
      let got = null, pid = null;

      let aid = null;
      if (sameCode(given, env.OWNER_CODE)) {
        got = 'owner';
      } else if (given) {
        const h = await sha256(given);

        // A personal code belongs to one named man. Tried first, because this is
        // what everybody on site will be carrying once their code is reissued.
        //
        // Looked up regardless of whether he is still with us: once a code belongs
        // to somebody, that person decides whether it works. The shared codes were
        // adopted from the projects table, so without this a withdrawn man would
        // fall through to the old project code his was taken from and walk back in.
        const holder = await findUserByInviteAny(env, h);
        if (holder && holder.status === 'suspended') {
          await new Promise((r) => setTimeout(r, 400));
          return json({ error: 'That access has been withdrawn.' }, 401);
        }
        const person = holder;
        if (person) {
          const org = await getOrg(env, person.org_id);
          const blocked = orgBlocked(org);
          if (blocked) return json({ error: blocked }, 403);
          await touchUser(env, person.id);
          const list = userProjects(person);
          const first = list.length ? list[0] : null;
          const token = await makeUserToken(person.id, first, secret);
          await audit(env, { org_id: person.org_id, user_id: person.id, who: person.name,
            action: 'signin', detail: 'personal code' });
          const headers = new Headers({ 'Content-Type': 'application/json' });
          headers.append('Set-Cookie',
            `${COOKIE}=${token}; Path=/; Max-Age=${60 * DAY}; HttpOnly; Secure; SameSite=Lax`);
          if (first) headers.append('Set-Cookie',
            `${PROJ_COOKIE}=${first}; Path=/; Max-Age=${60 * DAY}; Secure; SameSite=Lax`);
          return new Response(JSON.stringify({
            ok: true, role: person.role, project: first, name: person.name,
          }), { headers });
        }

        // Per-discipline codes first: they are the ones handed out now.
        const ac = await findByHash(env, h);
        if (ac) {
          got = ROLES[ac.role] ? ac.role : 'site';
          pid = ac.project_id;
          aid = ac.id;
          await touchCode(env, ac.id, nowISO());
        }
        const row = got ? null : await env.DB.prepare(
          `SELECT id, CASE WHEN manager_code_hash = ?1 THEN 'manager'
                           WHEN site_code_hash = ?1 THEN 'site'
                           WHEN view_code_hash = ?1 THEN 'view' END AS role
             FROM projects
            WHERE manager_code_hash = ?1 OR site_code_hash = ?1 OR view_code_hash = ?1
            LIMIT 1`
        ).bind(h).first();
        if (row && row.role) { got = row.role; pid = row.id; }
        else if (!got) {
          // Codes set as Worker secrets before projects existed still open the first project.
          const legacy = sameCode(given, env.MANAGER_CODE) ? 'manager'
            : sameCode(given, env.SITE_CODE) ? 'site'
            : sameCode(given, env.VIEW_CODE) ? 'view' : null;
          if (legacy) {
            const first = (await listProjects(env)).filter((x) => !x.archived)[0];
            if (first) { got = legacy; pid = first.id; }
          }
        }
      }

      if (!got) {
        await new Promise((r) => setTimeout(r, 400));
        return json({ error: 'Access code not recognised' }, 401);
      }
      // A shared code opens a seat, not a person — so the audit could not say who
      // walked in, only that somebody did. It says at least that now: a line
      // reading "manager · shared code" beside a named sign-in is how you tell
      // that the seat you are testing is a code seat and not an account.
      const proj = pid ? await getProject(env, pid) : null;
      await audit(env, {
        org_id: proj ? proj.org_id : null, project_id: pid, user_id: null,
        who: `(${got} code)`, action: 'signin', detail: 'shared code — nobody named',
      });
      const token = await makeToken(got, pid, aid, secret);
      const cookies = [`${COOKIE}=${token}; Path=/; Max-Age=${90 * DAY}; HttpOnly; Secure; SameSite=Lax`];
      if (pid) cookies.push(`${PROJ_COOKIE}=${pid}; Path=/; Max-Age=${90 * DAY}; Secure; SameSite=Lax`);
      const headers = new Headers({ 'Content-Type': 'application/json' });
      for (const c of cookies) headers.append('Set-Cookie', c);
      return new Response(JSON.stringify({ ok: true, role: got, project: pid }), { headers });
    }
    /* ---- signing in by email: no password is ever set, stored or reset */
    if (p === '/api/signin/start' && req.method === 'POST') {
      const { email } = await req.json().catch(() => ({}));
      // Testing phase: with LOGIN_TEST_CODE set, there is no email to send — the
      // person just types the fixed code. Answered the same for any address, so
      // the form still never reveals who is on the system.
      if (env.LOGIN_TEST_CODE) return json({ ok: true, sent: true });
      const start = await startEmailSignIn(env, email, sha256);
      if (start.error === 'blocked') return json({ error: start.message }, 403);
      // An unknown address is answered exactly like a known one. Otherwise this
      // form tells a stranger which of your people are on the system.
      if (start.error) {
        await new Promise((r) => setTimeout(r, 500));
        return json({ ok: true, sent: true });
      }
      const sent = await sendEmail(env, [start.user.email],
        `${start.code} — your sign-in code`, signInEmail(start.code, start.org, start.minutes));
      if (!sent.ok) {
        // A sending failure is a fault in this app, not a wrong answer by the
        // person at the form, so it is said plainly rather than hidden behind
        // "check your email". Nothing here reveals who is on the system.
        return json({
          error: sent.reason === 'no-key'
            ? 'Email sign-in is not switched on for this app yet — no email key is set on the ' +
              'server. Use the personal code you were given, and tell the office.'
            : 'The email service refused to send it. Nothing is wrong with your address — ' +
              'tell the office, and use your personal code meanwhile.',
          email_fault: true,
        }, 502);
      }
      return json({ ok: true, sent: true });
    }
    if (p === '/api/signin/code' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const out = await completeEmailSignIn(env, body.email, body.code, sha256);
      if (out.error) {
        await new Promise((r) => setTimeout(r, 300));
        return json({ error: out.error, left: out.left }, 401);
      }
      const list = userProjects(out.user);
      let first = list.length ? list[0] : null;
      if (!first) {
        const mine = await orgProjects(env, out.user.org_id).catch(() => []);
        const live = mine.filter((x) => !x.archived);
        first = (live[0] || mine[0] || {}).id || null;
      }
      const token = await makeUserToken(out.user.id, first, secret);
      await audit(env, { org_id: out.user.org_id, user_id: out.user.id, who: out.user.name,
        action: 'signin', detail: 'email' });
      const headers = new Headers({ 'Content-Type': 'application/json' });
      headers.append('Set-Cookie',
        `${COOKIE}=${token}; Path=/; Max-Age=${60 * DAY}; HttpOnly; Secure; SameSite=Lax`);
      if (first) headers.append('Set-Cookie',
        `${PROJ_COOKIE}=${first}; Path=/; Max-Age=${60 * DAY}; Secure; SameSite=Lax`);
      return new Response(JSON.stringify({
        ok: true, role: out.user.role, project: first, name: out.user.name,
      }), { headers });
    }

    if (p === '/api/logout') {
      const headers = new Headers({ Location: '/' });
      headers.append('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
      headers.append('Set-Cookie', `${PROJ_COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=Lax`);
      return new Response(null, { status: 302, headers });
    }

    // Owner switching project
    if (p === '/api/project' && req.method === 'GET') {
      if (!can.portfolio(role)) return json({ error: 'auth' }, 401);
      const want = url.searchParams.get('p');
      if (!want || !(await getProject(env, want))) return json({ error: 'unknown project' }, 404);
      return new Response(JSON.stringify({ ok: true, project: want }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `${PROJ_COOKIE}=${want}; Path=/; Max-Age=${90 * DAY}; Secure; SameSite=Lax`,
        },
      });
    }

    // The cookie says which code signed in; what that code may touch is read
    // here, so revoking or re-scoping it takes effect on the next request.
    let scope = null, codeRow = null;
    if (me) {
      scope = userScope(me);
    } else if (session && session.aid) {
      codeRow = await getCode(env, session.aid);
      if (!codeRow) return signedOut('That access code has been withdrawn.');
      scope = readScope(codeRow);
    }

    let pid = me
      ? await resolveUserPid(req, env, me, session)
      : session && session.aid && codeRow
        ? codeRow.project_id
        : await resolvePid(req, env, session);

    // The tenant wall. A person may only ever be in a project their organisation
    // owns, and only one they have been put on. Guessing an id gets nowhere.
    if (pid === DENIED) {
      return json({ error: 'That project is not yours to open.' }, 403);
    }
    if (me && pid) {
      const proj = await getProject(env, pid);
      if (!proj || (proj.org_id && proj.org_id !== me.org_id) || !userInProject(me, pid)) {
        return json({ error: 'That project is not yours to open.' }, 403);
      }
    }

    // The module wall. A module switched off for this project is refused here,
    // on the server — hiding its screens is not enough, because anyone can type
    // an address. The AETRAA Admin is not gated: they set projects up.
    let mods = null;
    if (pid && !can.platform(role, me)) {
      mods = await getProjectModules(env, pid).catch(() => null);
      const owner = moduleForPath(p);
      if (mods && owner && !mods.includes(owner)) {
        const m = MODULES.find((x) => x.id === owner);
        return json({ error: 'The ' + (m ? m.label : owner) + ' module is not switched on for this project.', module: owner }, 403);
      }
    }

    /* ---- pages */
    if (p === '/') {
      // A real signed-in person gets the live application shell: the signed-off
      // dashboard design, their sidebar, their windows, booted as themselves.
      if (me) {
        const meObj = await buildMe(env, me, pid);
        return html(appHTML(JSON.stringify(meObj)));
      }
      // The AETRAA Admin (master owner-code login, not a company user) lands on
      // the project setup console.
      if (can.platform(role, me)) return html(setupHTML());
      // The platform owner (global code login, not a user) keeps the classic flow.
      if (role === 'site') return Response.redirect(url.origin + '/site', 302);
      if (!can.dashboard(role)) return html(loginHTML('dashboard'));
      if (role === 'owner' && can.portfolio(role)) return html(principalHTML());
      if (!pid) return html(adminHTML(true));           // signed in, but no project exists yet
      return html(dashboardHTML(role));
    }
    if (p === '/portfolio') {
      return can.portfolio(role) ? html(portfolioHTML()) : html(loginHTML('portfolio'));
    }
    if (p === '/site') {
      if (!can.submit(role)) return html(loginHTML('site update'));
      return html(siteHTML(role));
    }
    if (p === '/setup') {
      // AETRAA Admin only (the master owner-code login, not a company Principal).
      return can.platform(role, me) ? html(setupHTML()) : html(loginHTML('AETRAA Admin setup'));
    }
    if (p === '/intake') {
      return can.platform(role, me) ? html(intakeHTML()) : html(loginHTML('project intake'));
    }
    if (p === '/admin') {
      return can.admin(role) ? html(adminHTML(false)) : html(loginHTML('admin'));
    }
    if (p === '/people') {
      return can.people(role) ? html(peopleHTML()) : html(loginHTML('the people on this account'));
    }
    if (p === '/resources') {
      if (!can.resources(role)) return html(loginHTML('resources and cost'));
      if (!pid) return html(adminHTML(true));
      return html(resourcesHTML(role, can.money(role)));
    }
    if (p === '/drawings' || p === '/design') {
      if (!can.drawings(role)) return html(loginHTML('the design register'));
      if (!pid) return html(adminHTML(true));
      return html(drawingsHTML(role, mayUploadDrawings(role, me), can.drawingsApprove(role),
        { can: !!(me && mayNotify(me)), dc: !!(me && userFunctions(me).includes('dc')) }));
    }
    if (p === '/minutes') {
      if (!can.view(role)) return html(loginHTML('meeting minutes'));
      if (!pid) return html(adminHTML(true));
      return html(minutesPageHTML());
    }
    if (p === '/programme') {
      if (!mayPlan(role, me)) return html(loginHTML('the programme update'));
      if (!pid) return html(adminHTML(true));
      return html(programmeHTML());
    }
    if (p === '/schedule') {
      if (!can.schedule(role)) return html(loginHTML('the programme forecast'));
      if (!pid) return html(adminHTML(true));
      return html(scheduleHTML(role));
    }
    if (p === '/reports') {
      if (!mayReport(role, me)) return html(loginHTML('reports'));
      if (!pid) return html(adminHTML(true));
      return html(reportsHTML(role));
    }
    if (p === '/issues') {
      if (!can.report(role)) return html(loginHTML('the issues register'));
      if (!pid) return html(adminHTML(true));
      return html(issuesHTML(role));
    }
    if (p === '/verify') {
      if (!can.verify(role)) return html(loginHTML('verification'));
      if (!pid) return html(adminHTML(true));
      return html(verifyHTML(role));
    }
    if (p === '/diary') {
      if (!can.diary(role)) return html(loginHTML('the daily diary'));
      if (!pid) return html(adminHTML(true));
      return html(diaryHTML(role));
    }
    if (p === '/diary/doc' || p === '/diary/docx') {
      if (!can.diary(role)) return html(loginHTML('the daily diary'));
      if (!pid) return json({ error: 'no project' }, 400);
      const day = date(url.searchParams.get('date')) || today();
      const project = await getProject(env, pid);
      const d = await loadDiary(env, pid, day, project);
      if (d.missing) return new Response('The diary is not set up yet — run upgrade-diary.sh', { status: 404 });

      if (p === '/diary/docx') {
        const bytes = diaryDocx(project, d);
        return new Response(bytes, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${diaryFileName(project, day, 'docx')}"`,
          },
        });
      }
      const { results: pics } = await env.DB.prepare(
        `SELECT id, caption, created_at FROM photos
          WHERE project_id = ? AND report_date = ? ORDER BY created_at LIMIT 24`
      ).bind(pid, day).all();
      const sheets = `<div class="sheet">${diarySheet(project, d)}</div>` +
        (pics && pics.length ? `<div class="sheet">${photoPageHTML(project, day, pics)}</div>` : '');
      return html(diarySheetHTML(diaryFileName(project, day, ''), sheets));
    }
    if (p === '/issues/doc') {
      if (!can.report(role)) return html(loginHTML('the issues register'));
      const issue = pid ? await getIssue(env, pid, url.searchParams.get('ref') || '') : null;
      if (!issue) return new Response('No such issue', { status: 404 });
      const project = await getProject(env, pid);
      const activity = issue.activity_id
        ? await env.DB.prepare(
            'SELECT id, name, planned_start, planned_finish FROM activities WHERE project_id = ? AND id = ?'
          ).bind(pid, issue.activity_id).first()
        : null;
      return html(issueDocHTML(issueDocumentTitle(issue), issueDocument(project, issue, activity)));
    }

    /* ---- api */
    try {
      if (p === '/api/projects') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        // A named person sees their own organisation's projects and no others,
        // and within those, only the ones they have been put on.
        const all = me ? (await orgProjects(env, me.org_id)).filter((x) => userInProject(me, x.id))
                       : await listProjects(env);
        return json({
          current: pid,
          role,
          org: myOrg ? { id: myOrg.id, name: myOrg.name, status: myOrg.status,
                         trial_ends: myOrg.trial_ends, plan: myOrg.plan } : null,
          me: me ? { id: me.id, name: me.name, email: me.email } : null,
          projects: (role === 'owner' || me) ? all : all.filter((x) => x.id === pid),
        });
      }
      if (p === '/api/portfolio') {
        if (!can.portfolio(role)) return json({ error: 'auth' }, 401);
        return await getPortfolio(env, me ? me.org_id : null);
      }
      if (p === '/api/project' && req.method === 'POST') {
        if (!can.admin(role)) return json({ error: 'auth' }, 401);
        // Creating a project is the AETRAA Admin's alone. A company Principal
        // carries the legacy 'owner' role, so can.admin() is not enough here —
        // without this they could add projects to their own company.
        return await postProject(req, env, can.platform(role, me));
      }

      /* ---- people. Managing them needs no project: a person can exist before
              they are put on one, which is the whole point of an invitation. */
      if (p === '/api/people') {
        if (!can.people(role)) return json({ error: 'auth' }, 401);
        // The platform owner is not in an organisation, so with more than one on
        // the system he has to say which. The page offers him a picker rather
        // than an error.
        const all = me ? null : await listOrgs(env);
        const oid = me ? me.org_id
          : (url.searchParams.get('org') || (all && all.length === 1 ? all[0].id : null));
        if (!oid) {
          return json({ people: [], migrated: all !== null, roles: ROLES, orgs: all || [] });
        }
        const people = await listUsers(env, oid);
        let projects = [];
        try { projects = await orgProjects(env, oid); } catch (e) { projects = []; }
        const { results } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(trade_group,''),'(no group)') AS grp, COUNT(*) AS n
             FROM activities WHERE COALESCE(level,1) >= 1
              AND project_id IN (SELECT id FROM projects WHERE COALESCE(org_id,?) = ?)
            GROUP BY grp ORDER BY grp`
        ).bind(oid, oid).all().catch(() => ({ results: [] }));
        return json({
          people: people || [], migrated: people !== null, roles: ROLES,
          projects, groups: (results || []).map((r) => r.grp),
          org: await getOrg(env, oid), orgs: (all && all.length > 1) ? all : undefined,
        });
      }
      if (p === '/api/person' && req.method === 'POST') {
        if (!can.people(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const oid = me ? me.org_id : (String(b.org || '') || await onlyOrg(env));
        if (!oid) return json({ error: 'which organisation?' }, 400);
        // Nobody may withdraw themselves and lock the organisation out of itself.
        if (b.suspend !== undefined && me && String(b.id) === me.id) {
          return json({ error: 'you cannot withdraw your own access' }, 400);
        }
        const suspending = b.suspend !== undefined;
        // Read the name before changing anything, so the audit line says who was
        // withdrawn rather than an id nobody can read.
        const subject = suspending ? await getUser(env, b.id) : null;
        const r = suspending
          ? await suspendUser(env, oid, b.id, !!b.suspend)
          : await saveUser(env, oid, { ...b, invited_by: me ? me.name : 'owner' }, sha256);
        if (!r.error) {
          await audit(env, { org_id: oid, user_id: me ? me.id : null, who: me ? me.name : 'owner',
            action: suspending ? (b.suspend ? 'person.withdrawn' : 'person.restored') : 'person.save',
            detail: String((subject && subject.name) || b.name || b.id || '') });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/audit') {
        if (!can.people(role)) return json({ error: 'auth' }, 401);
        const oid = me ? me.org_id : (url.searchParams.get('org') || await onlyOrg(env));
        const rows = oid ? await listAudit(env, oid, {
          project_id: url.searchParams.get('p') || null,
          action: url.searchParams.get('action') || null,
        }) : [];
        return json({ entries: rows || [], migrated: rows !== null });
      }

      /* ---- the platform: organisations. The owner code, not an org owner. */
      if (p === '/api/orgs') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const orgs = await listOrgs(env);
        return json({ orgs: orgs || [], migrated: orgs !== null });
      }
      if (p === '/api/org' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        if (b.id && me && b.id === me.org_id && can.people(role)) {
          // An org owner may rename their own organisation, nothing more.
          const r = await updateOrg(env, me.org_id, { name: b.name });
          return json(r, r.error ? 400 : 200);
        }
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        if (b.adopt) {
          const r = await adoptCodes(env, String(b.adopt));
          return json(r, r.error ? 400 : 200);
        }
        const r = b.id ? await updateOrg(env, b.id, b) : await createOrg(env, b);
        return json(r, r.error ? 400 : 200);
      }

      /* ---- AETRAA Admin: project onboarding (Company → Project → Principal) */
      // Modules — the catalogue, and what one project has switched on.
      if (p === '/api/setup/modules' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const want = url.searchParams.get('project') || '';
        const out = catalogue();
        if (want) {
          const m = await getProjectModules(env, want);
          if (!m) return json({ error: 'no such project' }, 404);
          out.project_id = want; out.enabled = m; out.setup_steps = setupStepsOn(m);
        }
        return json(out);
      }
      if (p === '/api/setup/modules' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const r = await setProjectModules(env, String(b.project_id || ''), b.modules);
        if (!r.error) {
          await audit(env, { org_id: null, project_id: r.project_id, who: 'AETRAA Admin', action: 'modules',
            detail: r.modules.join(', ') || '(base platform only)' }).catch(() => {});
        }
        return json(r, r.error ? 400 : 200);
      }
      // Response periods per document type, per project (calendar days).
      if (p === '/api/setup/response-days' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        await ensureProjectColumn(env, 'response_days');
        const proj = await getProject(env, url.searchParams.get('project') || '');
        if (!proj) return json({ error: 'no such project' }, 404);
        const out = {};
        for (const t of Object.keys(RESPONSE_DEFAULTS)) {
          const r = responseDays(proj, t);
          out[t] = { days: r.days, default: RESPONSE_DEFAULTS[t].days, from: r.from, what: r.what,
                     label: (RECORD_LABEL[t] || t) };
        }
        return json({ project_id: proj.id, periods: out });
      }
      if (p === '/api/setup/response-days' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        await ensureProjectColumn(env, 'response_days');
        const b = await req.json().catch(() => ({}));
        const proj = await getProject(env, String(b.project_id || ''));
        if (!proj) return json({ error: 'no such project' }, 400);
        const clean = {};
        for (const [t, v] of Object.entries(b.periods || {})) {
          if (!RESPONSE_DEFAULTS[t]) continue;
          const n = Math.round(Number(v));
          if (!(n >= 1 && n <= 365)) return json({ error: (RECORD_LABEL[t] || t) + ': enter 1 to 365 days' }, 400);
          if (n !== RESPONSE_DEFAULTS[t].days) clean[t] = n;
        }
        await env.DB.prepare('UPDATE projects SET response_days = ? WHERE id = ?').bind(JSON.stringify(clean), proj.id).run();
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: 'AETRAA Admin', action: 'response-days',
          detail: Object.entries(clean).map(([k, v]) => k + ' ' + v + 'd').join(', ') || 'defaults' });
        return json({ ok: true, periods: clean });
      }
      // Payment terms — what the IPC valuation follows. AETRAA Admin only.
      if (p === '/api/setup/payment-terms' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        await ensureProjectColumn(env, 'payment_terms');
        const proj = await getProject(env, url.searchParams.get('project') || '');
        if (!proj) return json({ error: 'no such project' }, 404);
        let contract = 0;
        try { contract = Number((await env.DB.prepare('SELECT SUM(amount) AS n FROM boq WHERE project_id = ?').bind(proj.id).first() || {}).n) || 0; } catch (e) {}
        let raw = {}; try { raw = JSON.parse(proj.payment_terms || '{}') || {}; } catch (e) {}
        return json({ project_id: proj.id, terms: paymentTerms(proj, contract), raw, contract, defaults: TERM_DEFAULTS });
      }
      if (p === '/api/setup/payment-terms' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        await ensureProjectColumn(env, 'payment_terms');
        const b = await req.json().catch(() => ({}));
        const proj = await getProject(env, String(b.project_id || ''));
        if (!proj) return json({ error: 'no such project' }, 400);
        const t = b.terms || {};
        const LABEL = { retention_pct: 'Retention %', retention_cap_pct: 'Retention cap %', advance_pct: 'Advance %',
          recovery_pct: 'Recovery %', recovery_start_pct: 'Recovery starts at %', recovery_full_pct: 'Fully recovered by %',
          mos_pct: 'Materials on site paid at %', vat_pct: 'VAT %', certify_days: 'Days for the Engineer to certify', payment_days: 'Days for the client to pay',
          advance_amount: 'Advance amount', hse_hours_per_day: 'Hours in a standard site day' };
        const v = {};
        for (const k of Object.keys(LABEL)) {
          if (t[k] === undefined || t[k] === '' || t[k] === null) continue;
          const n = Number(t[k]);
          const days = k.endsWith('_days');
          if (k === 'hse_hours_per_day' && (!Number.isFinite(n) || n < 1 || n > 24)) return json({ error: LABEL[k] + ': enter 1 to 24' }, 400);
          if (!Number.isFinite(n) || n < 0 || (k === 'advance_amount' || k === 'hse_hours_per_day' ? false : days ? (n < 1 || n > 365) : n > 100)) {
            return json({ error: LABEL[k] + ': ' + (days ? 'enter 1 to 365 days' : k === 'advance_amount' ? 'enter an amount' : 'enter 0 to 100') }, 400);
          }
          v[k] = n;
        }
        if (v.recovery_start_pct != null && v.recovery_full_pct != null && v.recovery_full_pct <= v.recovery_start_pct) {
          return json({ error: 'The advance must be fully recovered at a later point than recovery starts.' }, 400);
        }
        const json_ = {};
        for (const k of ['recovery_pct', 'recovery_start_pct', 'recovery_full_pct', 'mos_pct', 'vat_pct', 'certify_days', 'advance_amount', 'hse_hours_per_day']) if (v[k] != null) json_[k] = v[k];
        json_.advance_received = !!t.advance_received;
        await env.DB.prepare(`UPDATE projects SET retention_pct = ?, retention_limit_pct = ?, advance_pct = ?, payment_days = ?, payment_terms = ? WHERE id = ?`)
          .bind(v.retention_pct != null ? v.retention_pct : (proj.retention_pct || 0), v.retention_cap_pct != null ? v.retention_cap_pct : (proj.retention_limit_pct || 0),
            v.advance_pct != null ? v.advance_pct : (proj.advance_pct || 0), v.payment_days != null ? Math.round(v.payment_days) : (proj.payment_days || 56),
            JSON.stringify(json_), proj.id).run();
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: 'AETRAA Admin', action: 'payment-terms', detail: JSON.stringify(v).slice(0, 300) });
        return json({ ok: true, terms: paymentTerms(await getProject(env, proj.id), 0) });
      }
      // Company email domains — who may be added to a company.
      if (p === '/api/setup/company-email' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const r = await setOrgEmailDomains(env, String(b.company_id || ''), b.email_domains, b.email_allowed);
        if (!r.error) await audit(env, { org_id: String(b.company_id), who: 'AETRAA Admin', action: 'company.email',
          detail: (r.email_domains.join(', ') || '(not locked)') + (r.email_allowed.length ? ' + ' + r.email_allowed.join(', ') : '') });
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/setup/companies') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        await ensureModulesColumn(env);
        await ensureOrgEmailColumns(env);
        const orgs = (await listOrgs(env)) || [];
        const projs = await env.DB.prepare(
          `SELECT id, org_id, name, ref, setup_state, archived, modules FROM projects ORDER BY sort_order`
        ).all().catch(() => ({ results: [] }));
        return json({ companies: orgs, projects: projs.results || [] });
      }
      if (p === '/api/setup/onboard' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const r = await onboardProject(env, b, sha256);
        if (!r.error) {
          await audit(env, { org_id: r.company_id, project_id: r.project_id, who: 'AETRAA Admin',
            action: 'project.onboard', detail: (b.project && b.project.name) || '' });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/setup/project' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        if (!b.company_id) return json({ error: 'which company?' }, 400);
        const r = await createProjectForCompany(env, b.company_id, b.project || b);
        return json(r, r.error ? 400 : 200);
      }
      // The programme — a Primavera .xer becomes the project's spine.
      if ((p === '/api/setup/xer/preview' || p === '/api/setup/xer/commit') && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const wantPid = String(b.project_id || '');
        if (!wantPid) return json({ error: 'which project?' }, 400);
        let bytes;
        try { bytes = b64ToBytes(b.file_b64 || ''); }
        catch (e) { return json({ error: 'could not read that upload' }, 400); }
        if (!bytes || !bytes.length) return json({ error: 'no file received' }, 400);
        if (bytes.length > 20 * 1024 * 1024) return json({ error: 'that .xer is too large (20 MB limit)' }, 400);

        const tables = parseXER(decodeXer(bytes));
        const built = buildProgramme(tables, { disciplineByBranch: b.discipline_by_branch || {} });
        if (built.error) return json({ error: built.error }, 400);

        const leads = Object.assign({}, DEFAULT_LEADS, b.leads || {});
        const derived = deriveDeliverables(built.activities, leads);

        if (p === '/api/setup/xer/preview') {
          return json({
            ok: true, data_date: built.dataDate, total: built.activities.length,
            branches: built.branches, counts: built.counts, unassigned: built.unassigned,
            will_derive: derived.length,
            derive_breakdown: derived.reduce((m, d) => { m[d.kind] = (m[d.kind] || 0) + 1; return m; }, {}),
            sample: built.activities.slice(0, 8).map((a) => ({
              id: a.id, name: a.name, wbs: a.wbs, branch: a.branch,
              start: a.planned_start, kind: a.kind, discipline: a.discipline,
            })),
            leads,
          });
        }
        const saved = await saveProgramme(env, wantPid, built.activities.concat(derived),
          { replace: b.replace !== false });
        if (saved.error) return json({ error: saved.error }, 500);
        // The logic, calendars, durations, status and float too — so forecasts
        // work from the first import, not only after a separate logic load.
        try { await applyLogic(env, wantPid, extractLogic(tables)); }
        catch (e) { console.error('programme logic not loaded:', e && e.message); }
        await audit(env, { project_id: wantPid, who: 'AETRAA Admin', action: 'programme.import',
          detail: saved.saved + ' lines (' + derived.length + ' derived)' });
        return json({ ok: true, saved: saved.saved, from_programme: built.activities.length,
          derived: derived.length, counts: built.counts });
      }
      // Authorities — which NOCs this project has to clear.
      if (p === '/api/setup/authorities' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const wantPid = url.searchParams.get('project') || '';
        const proj = wantPid ? await getProject(env, wantPid) : null;
        await ensureRecordsTable(env);
        const already = wantPid ? await listRecords(env, wantPid, 'authority') : [];
        return json({
          library: AUTHORITIES,
          suggested: emirateFor(proj && (proj.location || proj.name)),
          existing: (already || []).map((r) => ({ ref: r.ref, name: r.title, status: r.status })),
        });
      }
      if (p === '/api/setup/authorities' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        await ensureRecordsTable(env);
        const r = await seedAuthorities(env, String(b.project_id || ''), b.authorities || [],
          createRecord, 'AETRAA Admin');
        return json(r, r.error ? 400 : 200);
      }
      // Consultant document templates — one Word form per document type.
      if (p === '/api/setup/templates' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const wantPid = url.searchParams.get('project') || '';
        return json({
          templates: wantPid ? await listTemplates(env, wantPid) : [],
          doc_types: DOC_TYPES, standard_tokens: STANDARD_TOKENS,
          storage: { driver: driverName(env), label: DRIVER_LABEL[driverName(env)] },
        });
      }
      // Where files are actually going, proven rather than reported. After the
      // move to Oracle this is the one call that says whether object storage is
      // really working — a misconfigured store does not fail loudly, it quietly
      // keeps everything in the database instead.
      if (p === '/api/storage') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const configured = driverName(env);
        const key = '_selftest/' + Date.now().toString(36) + '.bin';
        const probe = new Uint8Array([65, 69, 84, 82, 65, 65]);        // "AETRAA"
        const put = await putFile(env, key, probe, 'application/octet-stream');
        const got = put.ok ? await getFile(env, key) : null;
        const same = !!(got && got.bytes && got.bytes.length === probe.length &&
          got.bytes.every((v, i) => v === probe[i]));
        if (put.ok) { try { await deleteFile(env, key); } catch (e) {} }
        const gone = put.ok ? !(await getFile(env, key)) : false;
        // "Working" means the files are going where this deployment was
        // configured to put them. A file that round-trips to the wrong store is
        // not working — that is the failure this call exists to catch.
        const asConfigured = !!(put.ok && put.driver === configured);
        const working = !!(asConfigured && same && gone);
        return json({
          configured, label: DRIVER_LABEL[configured],
          wrote_to: put.driver || null,
          working,
          round_trip: { stored: !!put.ok, read_back: same, removed: gone, as_configured: asConfigured },
          note: put.ok && put.driver !== configured
            ? `Configured for ${DRIVER_LABEL[configured]}, but the file went to ${DRIVER_LABEL[put.driver]} — the object store refused it or could not be reached. Files are being kept, but not where you intended.`
            : null,
        }, working ? 200 : 500);
      }
      if (p === '/api/setup/template' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        if (b.remove) {
          const r = await deleteTemplate(env, String(b.project_id || ''), String(b.doc_type || ''));
          return json(r, r.error ? 400 : 200);
        }
        let bytes;
        try { bytes = b64ToBytes(b.file_b64 || ''); }
        catch (e) { return json({ error: 'could not read that upload' }, 400); }
        const r = await saveTemplate(env, String(b.project_id || ''), String(b.doc_type || ''),
          String(b.filename || 'template.docx'), bytes, 'AETRAA Admin');
        return json(r, r.error ? 400 : 200);
      }
      // Branding — the company mark and each project's logos.
      if (p === '/api/setup/branding' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        if (b.company_id) {
          const r = await setCompanyLogo(env, String(b.company_id), b.logo);
          return json(r, r.error ? 400 : 200);
        }
        const r = await setBranding(env, String(b.project_id || ''), b);
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/setup/branding' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const wantPid = url.searchParams.get('project') || '';
        const row = wantPid ? await env.DB.prepare(
          `SELECT logo_client, logo_consultant, logo_consultant2, logo_contractor FROM projects WHERE id = ?`
        ).bind(wantPid).first() : null;
        return json({ branding: row || {} });
      }
      // BOQ — the priced bill per project (imported by AETRAA Admin).
      if (p === '/api/boq/import' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        return json(await importBOQ(env, String(b.project_id || ''), b.rows || []));
      }
      if (p === '/api/boq' && req.method === 'GET') {
        // The AETRAA Admin (any project) or a signed-in user's own project.
        const wantPid = url.searchParams.get('project') || (me ? await resolveUserPid(req, env, me, session) : null);
        if (!can.platform(role, me) && !(me && wantPid)) return json({ error: 'auth' }, 401);
        await ensureBoqTable(env);
        const d = await listBOQ(env, wantPid);
        return json(d === null ? { migrated: false, lines: [], sections: [], totals: {} } : { migrated: true, ...d });
      }
      // BOM — budget quantities, orders and GRN. The BOM belongs to the PM and
      // the commercial team: a site engineer raises a request but never sees the
      // budget, so 'site' is excluded here by design.
      if (p === '/api/bom/import' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        return json(await importBOM(env, String(b.project_id || ''), b.rows || []));
      }
      if (p.startsWith('/api/bom') && p !== '/api/bom/import') {
        const fns = me ? userFunctions(me) : [];
        const bomOk = can.platform(role, me) || role === 'owner' || role === 'manager'
          || fns.includes('commercial') || fns.includes('procurement') || fns.includes('finance');
        if (!bomOk) return json({ error: 'the BOM is not part of your access' }, 403);
        const bomPid = url.searchParams.get('project')
          || (me ? await resolveUserPid(req, env, me, session) : null);
        if (!bomPid) return json({ error: 'no project' }, 400);
        await ensureBomTable(env);
        if (p === '/api/bom' && req.method === 'GET') {
          const d = await listBOM(env, bomPid);
          const moves = await listMoves(env, bomPid, 50);
          return json(d === null ? { migrated: false, lines: [], totals: {} } : { migrated: true, ...d, moves });
        }
        const bb = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        const whoName = (me && me.name) || role;
        if (p === '/api/bom/check' && req.method === 'POST') {
          return json(await checkOrder(env, bomPid, bb.material, bb.qty));
        }
        if (p === '/api/bom/order' && req.method === 'POST') {
          return json(await recordOrder(env, bomPid, bb, whoName));
        }
        if (p === '/api/bom/grn' && req.method === 'POST') {
          return json(await recordGRN(env, bomPid, bb, whoName));
        }
      }
      if (p === '/api/boq/bill' && req.method === 'POST') {
        if (!can.money(role) && !can.platform(role, me)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const wantPid = String(b.project_id || '') || (me ? await resolveUserPid(req, env, me, session) : '');
        return json(await setBilled(env, wantPid, b));
      }

      if (!pid && p.startsWith('/api/')) return json({ error: 'no project' }, 400);

      if (p === '/api/data') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        return json(await getData(env, pid, scope));
      }
      if (p === '/api/trades') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        return await getTrades(env, pid, scope);
      }
      if (p === '/api/site-data') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const trade = url.searchParams.get('trade');
        if (!trade) return json({ error: 'trade required' }, 400);
        return await getSiteData(env, pid, trade, scope);
      }
      if (p === '/api/update' && req.method === 'POST') {
        if (!can.submit(role)) return json({ error: 'auth' }, 401);
        return await postUpdate(req, env, role, pid, scope,
          (await getProject(env, pid) || {}).proof_at_100 !== 0, me ? me.name : null);
      }
      if (p === '/api/manpower' && req.method === 'POST') {
        if (!can.submit(role)) return json({ error: 'auth' }, 401);
        return await postManpower(req, env, role, pid, me ? me.name : null);
      }
      if (p === '/api/photo' && req.method === 'POST') {
        if (!can.submit(role)) return json({ error: 'auth' }, 401);
        return await postPhoto(req, env, role, pid, me ? me.name : null);
      }
      if (p.startsWith('/photo/')) {
        if (!can.view(role)) return new Response('auth', { status: 401 });
        return await servePhoto(env, pid, p.slice(7));
      }
      if (p === '/api/import' && req.method === 'POST') {
        if (!can.admin(role)) return json({ error: 'auth' }, 401);
        return await postImport(req, env, pid);
      }
      if (p === '/api/import-progress' && req.method === 'POST') {
        if (!can.admin(role)) return json({ error: 'auth' }, 401);
        return await postImportProgress(req, env, pid);
      }
      if (p === '/api/import-targets' && req.method === 'POST') {
        if (!can.admin(role)) return json({ error: 'auth' }, 401);
        return await postImportTargets(req, env, pid);
      }
      if (p === '/api/export') {
        if (!can.export(role)) return json({ error: 'auth' }, 401);
        return await exportCSV(env, pid);
      }
      if (p === '/api/report') {
        if (!mayReport(role, me)) return json({ error: 'auth' }, 401);
        const project = await getProject(env, pid);
        const d = await buildReport(env, pid, project, url.searchParams.get('kind'), url.searchParams.get('key'));
        // format=doc: the same report as a file Word opens and edits.
        if (url.searchParams.get('format') === 'doc') {
          return new Response(reportWord(d), {
            headers: { 'Content-Type': 'application/msword; charset=utf-8', 'Cache-Control': 'no-store',
              'Content-Disposition': 'attachment; filename="' + reportFileName(d) + '.doc"' },
          });
        }
        return new Response(reportHTML(d), {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
      /* ---- AI drafting. One door (src/ai.js), Claude today and a self-hosted
              open model later, chosen by configuration. Off until a key is set;
              every output is a draft a person signs. */
      if (p === '/api/ai/report-narrative' && req.method === 'POST') {
        if (!can.report(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const project = await getProject(env, pid);
        const r = await reportNarrative(env, pid, project,
          b.kind === 'monthly' ? 'monthly' : 'weekly', str(b.key, 20),
          (me && me.name) || role);
        if (!r.error) {
          await audit(env, { org_id: me ? me.org_id : null, project_id: pid,
            user_id: me ? me.id : null, who: (me && me.name) || role,
            action: 'ai.report-narrative', detail: r.period ? r.period.from + '..' + r.period.to : '' });
        }
        return json(r, r.error ? (r.disabled ? 200 : 400) : 200);
      }
      if (p === '/api/ai/status' && req.method === 'GET') {
        // So a screen can show or hide the AI buttons honestly, and the AETRAA
        // Admin can see what has been spent.
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        return json({
          enabled: aiEnabled(env),
          usage: can.platform(role, me) ? await aiUsageSummary(env, pid) : undefined,
        });
      }

      if (p === '/api/verify' && req.method === 'GET') {
        if (!can.verify(role)) return json({ error: 'auth' }, 401);
        const counts = await verifyCounts(env, pid, scopeSql(scope, 'a'));
        if (counts === null) return json({ migrated: false, claims: [], counts: {} });
        const claims = await listQueue(env, pid, {
          state: url.searchParams.get('state') || 'awaiting',
          complete: url.searchParams.get('complete') === '1',
          scopeSql: scopeSql(scope, 'a'),
        });
        const photos = await photosFor(env, pid, claims.map((c) => c.id));
        return json({ migrated: true, counts, claims, photos });
      }
      if (p === '/api/verify' && req.method === 'POST') {
        if (!can.verify(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        if (!isFullScope(scope)) {
          const ok = await activitiesInScope(env, pid, scope, [String(b.activity_id || '')]);
          if (!ok.has(String(b.activity_id || ''))) return json({ error: 'outside your trades' }, 403);
        }
        const r = await setVerdict(env, pid, b, (me && me.name) || str(b.by, 120) || role);
        return json(r, r.error ? 400 : 200);
      }

      if (p === '/api/resources') {
        if (!can.resources(role)) return json({ error: 'auth' }, 401);
        const project = await getProject(env, pid);
        const d = await buildResources(env, pid, project, {
          from: url.searchParams.get('from'), to: url.searchParams.get('to'),
        });
        // Stripped here rather than hidden in the page, so the figures never
        // travel to somebody not entitled to them.
        return json(can.money(role) ? d : withoutMoney(d));
      }
      if (p === '/api/rate' && req.method === 'POST') {
        if (!can.money(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const r = await saveRate(env, pid, b);
        if (!r.error) {
          await audit(env, { org_id: me ? me.org_id : null, project_id: pid,
            user_id: me ? me.id : null, who: (me && me.name) || 'owner',
            action: 'rate', detail: `${b.kind} ${b.name}` });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/rates') {
        if (!can.money(role)) return json({ error: 'auth' }, 401);
        const project = await getProject(env, pid);
        return json({
          rates: await loadRates(env, pid),
          materials: projectMaterials(project),
        });
      }

      /* ---- the programme, and what a delay costs */
      if (p === '/api/schedule') {
        if (!can.schedule(role)) return json({ error: 'auth' }, 401);
        const model = await loadSchedule(env, pid);
        if (model.error) return json(model, 400);
        return json(scheduleSummary(model));
      }
      if (p === '/api/impact') {
        if (!can.schedule(role)) return json({ error: 'auth' }, 401);
        const model = await loadSchedule(env, pid);
        if (model.error) return json(model, 400);
        const id = str(url.searchParams.get('activity'), 60);
        const days = Number(url.searchParams.get('days'));
        if (!id) return json({ error: 'which activity?' }, 400);
        if (!Number.isFinite(days) || days === 0) return json({ error: 'how many days?' }, 400);
        const out = cpmImpact(model.input, id, days);
        if (out.error) return json(out, 400);
        return json(dressImpact(out, model));
      }

      /* ---- the drawing register */
      if (p === '/api/drawings') {
        if (!can.drawings(role)) return json({ error: 'auth' }, 401);
        const drawings = await listDrawings(env, pid);
        if (drawings === null) return json({ migrated: false, drawings: [] });
        // The trades and floors to tag against come from the programme itself,
        // so a tag can only ever be something the programme actually says.
        const { results } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(trade,''),'') AS trade,
                  COALESCE(NULLIF(trade_group,''),'') AS trade_group,
                  COALESCE(NULLIF(floor,''),'') AS floor, COUNT(*) AS n
             FROM activities WHERE project_id = ? AND COALESCE(level,1) >= 1
            GROUP BY trade, trade_group, floor`
        ).bind(pid).all();
        const trades = {}, floors = new Set();
        for (const r of results || []) {
          if (r.trade) {
            (trades[r.trade] || (trades[r.trade] = { trade: r.trade, trade_group: r.trade_group, n: 0 })).n += r.n;
          }
          if (r.floor) floors.add(r.floor);
        }
        return json({
          migrated: true,
          drawings,
          reach: await reachFor(env, pid, drawings),
          kinds: DWG_KINDS.map((k) => [k, DWG_KIND_LABEL[k]]),
          trades: Object.values(trades).sort((a, b) => a.trade.localeCompare(b.trade)),
          floors: [...floors].sort(),
          max_bytes: DWG_MAX,
          can_edit: can.drawingsEdit(role),
          can_upload: mayUploadDrawings(role, me),
          can_approve: can.drawingsApprove(role),
          me: (me && me.name) || null,
        });
      }
      if (p === '/api/drawing' && req.method === 'POST') {
        if (!mayUploadDrawings(role, me)) return json({ error: 'Uploading drawings is for Design and Document Control.' }, 403);
        const b = await req.json().catch(() => ({}));
        const who = (me && me.name) || str(b.by, 120) || role;
        const canApprove = can.drawingsApprove(role);
        let r;
        if (b.remove) {
          // The lock applies to removal too: an engineer can pull back only their
          // own sheet, and only while it is still pending or rejected.
          if (!canApprove) {
            const cur = await getDrawing(env, pid, str(b.id, 60));
            if (!cur) r = { error: 'unknown drawing' };
            else if (cur.status === 'current' || cur.status === 'superseded') {
              r = { error: 'that drawing is approved — only the project manager can remove it' };
            } else if (cur.uploaded_by && who !== cur.uploaded_by) {
              r = { error: 'that drawing was uploaded by someone else' };
            }
          }
          if (!r) r = await removeDrawing(env, pid, str(b.id, 60));
        } else {
          // The project row carries the gate's rules, so it is passed in. A
          // caller that omits it gets no gate, which is why the API never does.
          await ensureGateColumns(env);
          const gproj = await getProject(env, pid);
          r = await saveDrawing(env, pid, b, who, { canApprove, project: gproj });
        }
        if (!r.error) {
          await audit(env, { org_id: me ? me.org_id : null, project_id: pid,
            user_id: me ? me.id : null, who,
            action: b.remove ? 'drawing-remove' : (r.held ? 'drawing-held' : r.pending ? 'drawing-submit' : 'drawing'),
            detail: `${str(b.number, 60) || str(b.id, 60)}${b.revision ? ' Rev ' + str(b.revision, 12) : ''}` });
        }
        return json(r, r.error ? 400 : 200);
      }
      // The PM approving, or sending back, a sheet an engineer submitted.
      if (p === '/api/drawing/approve' && req.method === 'POST') {
        if (!can.drawingsApprove(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const who = (me && me.name) || role;
        const did = str(b.id, 60);
        const before = await getDrawing(env, pid, did);
        const r = b.reject
          ? await rejectDrawing(env, pid, did, who, str(b.note, 600))
          : await approveDrawing(env, pid, did, who);
        if (!r.error) {
          await audit(env, { org_id: me ? me.org_id : null, project_id: pid,
            user_id: me ? me.id : null, who,
            action: b.reject ? 'drawing-reject' : 'drawing-approve',
            detail: before ? `${before.number}${before.revision ? ' Rev ' + before.revision : ''}` : did });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/drawing/pin' && req.method === 'POST') {
        if (!can.drawingsEdit(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const r = await pinDrawing(env, pid, str(b.drawing_id, 60), str(b.activity_id, 60),
                                   (me && me.name) || role, !!b.off);
        return json(r, r.error ? 400 : 200);
      }
      // What one activity is built from. Answered per activity rather than sent
      // with the whole site payload: a man opens one card at a time, and the
      // register is not worth carrying on his phone to look at one sheet.
      if (p === '/api/drawings/for') {
        if (!can.drawings(role)) return json({ error: 'auth' }, 401);
        const aid = str(url.searchParams.get('activity'), 60);
        if (!aid) return json({ error: 'which activity?' }, 400);
        const act = await env.DB.prepare(
          'SELECT id, name, trade, trade_group, floor FROM activities WHERE project_id = ? AND id = ?'
        ).bind(pid, aid).first();
        if (!act) return json({ error: 'unknown activity' }, 404);
        if (!isFullScope(scope)) {
          const ok = await activitiesInScope(env, pid, scope, [aid]);
          if (!ok.has(aid)) return json({ error: 'outside your trades' }, 403);
        }
        return json({
          activity: act,
          drawings: await drawingsForActivity(env, pid, act),
          can_edit: can.drawingsEdit(role),
        });
      }
      if (p.startsWith('/dwg/')) {
        if (!can.drawings(role)) return new Response('auth', { status: 401 });
        return await serveDrawing(env, pid, decodeURIComponent(p.slice(5)));
      }

      if (p === '/api/codes') {
        if (!can.admin(role)) return json({ error: 'auth' }, 401);
        const codes = await listCodes(env, pid);
        // The groups and trades to scope against come from the programme itself.
        const { results } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(trade_group,''),'(no group)') AS grp,
                  COALESCE(NULLIF(trade,''),'(no trade)') AS trade, COUNT(*) AS n
             FROM activities WHERE project_id = ? AND COALESCE(level,1) >= 1
            GROUP BY grp, trade ORDER BY grp, trade`
        ).bind(pid).all();
        const groups = {};
        for (const r of results || []) {
          (groups[r.grp] || (groups[r.grp] = { group: r.grp, activities: 0, trades: [] }));
          groups[r.grp].activities += r.n;
          groups[r.grp].trades.push({ trade: r.trade, n: r.n });
        }
        return json({ codes: codes || [], migrated: codes !== null, roles: ROLES,
                      groups: Object.values(groups) });
      }
      if (p === '/api/code' && req.method === 'POST') {
        if (!can.admin(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const r = b.remove ? await deleteCode(env, pid, b.id) : await saveCode(env, pid, b, sha256);
        return json(r, r.error ? 400 : 200);
      }

      if (p === '/api/review' && req.method === 'POST') {
        if (!can.reviewDay(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const day = date(b.date);
        if (!day) return json({ error: 'which day?' }, 400);
        return json(await reviewDay(env, pid, day, (me && me.name) || b.by || role, b.note, b.undo));
      }
      if (p === '/api/review') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const to = date(url.searchParams.get('to')) || today();
        const from = date(url.searchParams.get('from')) || shiftDay(to, -60);
        const rows = await listReviews(env, pid, from, to);
        return json({ from, to, reviews: rows || [], migrated: rows !== null });
      }

      /* ---- the records engine: submittals, RFIs, WIR/MIR, NCR, variations,
              letters, permits, observations, incidents, material requests,
              authority approvals. One table behind every register window. */
      /* ---- The programme loop with Primavera P6. */
      if ((p === '/api/programme/preview' || p === '/api/programme/commit') && req.method === 'POST') {
        if (!mayPlan(role, me)) return json({ error: 'Updating the programme is for Planning and the Project Manager.' }, 403);
        if (!pid) return json({ error: 'which project?' }, 400);
        const b = await req.json().catch(() => ({}));
        let bytes;
        try { bytes = b64ToBytes(b.file_b64 || ''); } catch (e) { return json({ error: 'could not read that upload' }, 400); }
        if (!bytes || !bytes.length) return json({ error: 'no file received' }, 400);
        if (bytes.length > 20 * 1024 * 1024) return json({ error: 'that .xer is too large (20 MB limit)' }, 400);
        const tables = parseXER(decodeXer(bytes));
        if (p === '/api/programme/preview') {
          const a = await analyseUpdate(env, pid, tables);
          return json(a.error ? a : { ok: true, summary: a.summary }, a.error ? 400 : 200);
        }
        const r = await commitUpdate(env, pid, tables);
        if (!r.error) {
          await audit(env, { org_id: me && me.org_id, project_id: pid, user_id: me && me.id, who: (me && me.name) || role,
            action: 'programme.update', detail: 'data date ' + (r.summary.data_date.to || '?') + ' · ' +
              r.summary.activities.total + ' activities · forecast finish ' + (r.summary.forecast_finish.to || '?') });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/programme/p6-progress' || p === '/api/programme/p6-review') {
        if (!mayPlan(role, me)) return json({ error: 'auth' }, 403);
        if (!pid) return json({ error: 'which project?' }, 400);
        const w = await p6ProgressWorkbook(env, pid);
        const proj = await getProject(env, pid);
        const tag = String((proj && (proj.ref || proj.id)) || pid).replace(/[^A-Za-z0-9_-]+/g, '-');
        const review = p === '/api/programme/p6-review';
        return new Response(review ? w.reviewBytes : w.bytes, { headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="' + tag + (review ? '-progress-review-' : '-progress-for-P6-') + today() + '.xlsx"',
          'Cache-Control': 'no-store', 'X-Rows': String(review ? w.review : w.count) } });
      }
      if (p === '/api/programme/status') {
        if (!mayPlan(role, me)) return json({ error: 'auth' }, 403);
        const proj = await getProject(env, pid);
        const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM activities WHERE project_id = ? AND COALESCE(source,'programme') <> 'derived'").bind(pid).first();
        const last = await env.DB.prepare("SELECT who, detail, at FROM audit WHERE project_id = ? AND action IN ('programme.update','programme.import') ORDER BY at DESC LIMIT 5").bind(pid).all().catch(() => ({ results: [] }));
        return json({ project: proj && proj.name, data_date: proj && proj.data_date, contract_finish: proj && proj.contract_finish,
          activities: Number((n && n.n) || 0), history: last.results || [] });
      }

      /* ---- Notifications. Document Control (and the PM / Principal) tell the
              team something has arrived; everybody reads theirs under the bell. */
      if (p === '/api/notifications' && req.method === 'GET') {
        if (!me) return json({ unread: 0, items: [] });
        return json(await myNotifications(env, me.id, url.searchParams.get('limit')));
      }
      if (p === '/api/notifications/read' && req.method === 'POST') {
        if (!me) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        return json(await markRead(env, me.id, b.all ? 'all' : b.ids));
      }
      if (p === '/api/notify/team' && req.method === 'GET') {
        if (!me || !mayNotify(me)) return json({ error: 'auth' }, 403);
        const team = (await projectTeam(env, me.org_id, pid)).filter((u) => u.id !== me.id)
          .map((u) => ({ id: u.id, name: u.name, functions: u.functions,
                         labels: u.functions.map((f) => (FUNCTIONS[f] || {}).label || f) }));
        return json({ team, email: emailDriver(env) !== 'none',
                      functions: Object.keys(FUNCTIONS).map((k) => ({ id: k, label: FUNCTIONS[k].label })) });
      }
      if (p === '/api/notify' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        const proj = pid ? await getProject(env, pid) : null;
        const r = await notifyTeam(env, {
          me, pid, projectName: proj && proj.name, to: { people: b.people, functions: b.functions, all: b.all === true },
          title: b.title, message: b.message, ref: b.ref, link: b.link, kind: b.kind, email: b.email === true,
        }, (to, subject, htmlBody) => sendEmail(env, to, subject, htmlBody));
        if (!r.error) {
          await audit(env, { org_id: me.org_id, project_id: pid, user_id: me.id, who: me.name, action: 'notify',
            detail: String(b.title || '').slice(0, 120) + ' → ' + r.to.join(', ') });
        }
        return json(r, r.error ? (r.error.startsWith('Notifying') ? 403 : 400) : 200);
      }
      if (p === '/api/records' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        await ensureRecordsTable(env);
        const type = url.searchParams.get('type') || null;
        const records = await listRecords(env, pid, type);
        if (records === null) return json({ migrated: false, records: [] });
        // Registers of a switched-off module are kept, but not handed out.
        const plat = can.platform(role, me);
        return json({ migrated: true, records: (mods ? records.filter((x) => recordTypeOn(mods, x.type)) : records)
          .map((x) => recordForViewer(me, x, plat)) });
      }
      /* ---- THE GATE: what it held, and what the AETRAA Admin decides.
       *
       * The Admin sees every project's held items; anyone else sees their own
       * project's, so a document controller can tell the difference between a
       * document that is lost and one that is with AETRAA. Only the Admin may
       * decide — a contractor approving their own way past the gate is the one
       * thing it exists to prevent. */
      if (p === '/api/quarantine' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const plat = can.platform(role, me);
        const wantAll = plat && url.searchParams.get('all') === '1';
        const items = await listHeld(env, wantAll ? {} : { project_id: pid });
        return json({
          items, groups: groupByReason(items),
          may_decide: plat,
          gate_configured: gateConfigured(await getProject(env, pid)),
        });
      }
      if (p === '/api/quarantine/decide' && req.method === 'POST') {
        // Deliberately the platform login and nothing else.
        if (!can.platform(role, me)) {
          return json({ error: 'Only AETRAA can release a held document.' }, 403);
        }
        const b = await req.json().catch(() => ({}));
        const ids = Array.isArray(b.ids) ? b.ids.slice(0, 500) : (b.id ? [String(b.id)] : []);
        if (!ids.length) return json({ error: 'nothing chosen' }, 400);
        const action = String(b.action || '');
        const out = { decided: [], filed: [], errors: [] };
        let widened = null;
        for (const qid of ids) {
          const item = await getHeld(env, qid);
          if (!item) { out.errors.push({ id: qid, error: 'no such held item' }); continue; }
          const proj = await getProject(env, item.project_id);
          // Widening once per call: the whole point is that a hundred sheets of
          // the same shape become one decision and never recur.
          if (action === 'approve_widen' && !widened && proj) {
            widened = widenedRules(proj, item.prefix, b.discipline, b.trade_group);
            if (widened) {
              await env.DB.prepare('UPDATE projects SET drawing_rules = ? WHERE id = ?')
                .bind(JSON.stringify(widened), item.project_id).run().catch(() => {});
            }
          }
          const d = await decide(env, qid, action, { name: 'AETRAA Admin' }, b.note, widened);
          if (d.error) { out.errors.push({ id: qid, error: d.error }); continue; }
          out.decided.push(qid);
          if (action !== 'reject' && item.kind === 'drawing' && item.payload) {
            // Replay exactly what the importer would have written, with the
            // gate switched off for this one item — it has just been judged.
            const fresh = await getProject(env, item.project_id);
            const r = await saveDrawing(env, item.project_id, item.payload,
              (me && me.name) || 'AETRAA Admin', { canApprove: true, project: fresh, gate: false });
            if (r && r.id) { await markFiled(env, qid, r.id); out.filed.push({ id: qid, drawing: r.id }); }
            else out.errors.push({ id: qid, error: (r && r.error) || 'could not file it' });
          }
          await audit(env, { org_id: item.org_id, project_id: item.project_id,
            who: 'AETRAA Admin', action: 'quarantine.' + action,
            detail: item.filename + (b.note ? ' — ' + String(b.note).slice(0, 120) : '') });
        }
        const failedAll = out.errors.length && !out.decided.length;
        return json(Object.assign({ ok: !out.errors.length, widened_rule: widened },
          // One item, one problem: put it where a caller looks for an error.
          failedAll && out.errors.length === 1 ? { error: out.errors[0].error } : {}, out),
          failedAll ? 400 : 200);
      }
      /* ---- The project's drawing numbering scheme: the gate's one strong
       * signal, and nothing without it. */
      /* ---------------------------------------------------------- intake
       *
       * Drop a folder, and the project sets itself up. Four steps, and only
       * the last writes anything — see src/intake.js for the guarantee and
       * why it is worth protecting.
       *
       * Permission is checked here, on the server, on every path. A DC's batch
       * is drawings-only and is refused at SCAN time with an explanation, not
       * by hiding a button: a hidden button is not a permission. */
      if (p === '/api/intake/batch' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const wantPid = String(b.project_id || pid || '');
        const proj = await getProject(env, wantPid);
        if (!proj) return json({ error: 'no such project' }, 404);
        // Anyone who is not AETRAA gets a drawings-only batch, whatever they ask for.
        const scope = can.platform(role, me) ? (b.scope === 'drawings' ? 'drawings' : 'full') : 'drawings';
        const r = await openBatch(env, wantPid, me || { name: role }, { org_id: proj.org_id, scope });
        if (r.error) return json(r, 400);
        await audit(env, { org_id: proj.org_id, project_id: wantPid, who: (me && me.name) || role,
          action: 'intake.batch', detail: 'scope ' + scope });
        return json(r);
      }

      if (p === '/api/intake/scan' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const wantPid = String(b.project_id || pid || '');
        const proj = await getProject(env, wantPid);
        if (!proj) return json({ error: 'no such project' }, 404);
        const bytes = typeof b.data === 'string' && b.data ? b64ToBytes(b.data) : null;
        // The server reads the file itself. The browser may send hints, but it
        // is never trusted to decide what a file is — a classification posted
        // from a page is a classification an attacker can choose.
        const read = bytes ? probeFile(b.filename, bytes) : {};
        const num = bytes ? (fromFileName(String(b.filename || '')) || {}).number : null;
        const r = await scanFile(env, String(b.batch_id || ''), proj,
          { filename: b.filename, path: b.path, mime: b.mime, bytes },
          { ...read, ...(num ? { drawingNumber: num } : {}) }, me || { name: role });
        return json(r, r.error ? 400 : 200);
      }

      if (p === '/api/intake/batch' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const batch = await getBatch(env, url.searchParams.get('id') || '');
        if (!batch) return json({ error: 'no such batch' }, 404);
        if (!can.platform(role, me) && batch.project_id !== pid) return json({ error: 'auth' }, 403);
        return json(batch);
      }

      if (p === '/api/intake/confirm' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const r = await confirmItems(env, String(b.batch_id || ''),
          Array.isArray(b.items) ? b.items : [], me || { name: role });
        return json(r, r.error ? 400 : 200);
      }

      if (p === '/api/intake/commit' && req.method === 'POST') {
        if (!can.platform(role, me) && !can.drawingsUpload(role)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const batch = await getBatch(env, String(b.batch_id || ''));
        if (!batch) return json({ error: 'no such batch' }, 404);
        const proj = await getProject(env, batch.project_id);
        if (!proj) return json({ error: 'no such project' }, 404);
        if (!can.platform(role, me) && batch.project_id !== pid) return json({ error: 'auth' }, 403);

        // The importers already exist and are already tested. Intake finds
        // files and proposes; it calls the same code the manual screens call,
        // so a fix to an importer fixes both paths at once.
        const who = me || { name: role };
        const routes = {
          getBytes: async (key) => (key ? await getFile(env, key).then((f) => f && f.bytes).catch(() => null) : null),
          programme: async (ppid, bytes) => {
            if (!bytes) return { error: 'the programme file could not be read back' };
            try {
              const built = buildProgramme(parseXER(decodeXer(bytes)), {});
              return await saveProgramme(env, ppid, built.activities || built, {});
            } catch (e) { return { error: 'that .xer could not be read: ' + String(e && e.message || e).slice(0, 120) }; }
          },
          // Reads the workbook that was stored at scan time and maps its header
          // row onto the columns the importers expect.
          rowsOf: async (filename, bytes, kind) => {
            if (!bytes) return [];
            const pr = probeFile(filename, bytes);
            if (!pr || !pr.header || !pr.rows) return [];
            return mapRows(pr.header, pr.rows, kind);
          },
          boq: async (ppid, rows) => importBOQ(env, ppid, rows),
          bom: async (ppid, rows) => importBOM(env, ppid, rows),
          template: async (ppid, docType, filename, bytes) =>
            bytes ? saveTemplate(env, ppid, docType, filename, bytes, who)
                  : { error: 'the template file could not be read back' },
          branding: async (ppid, party, bytes, filename) =>
            bytes ? setBranding(env, ppid, { [party + '_logo']: 'data:image/png;base64,' + bytesToB64(bytes) })
                  : { error: 'the logo could not be read back' },
          drawing: async (ppid, body, w) =>
            saveDrawing(env, ppid, body, (w && w.name) || role,
              { canApprove: can.drawingsApprove(role), project: proj }),
        };

        const r = await commitItems(env, String(b.batch_id || ''),
          Array.isArray(b.ids) ? b.ids : [], proj, who, routes);
        if (r.error) return json(r, 400);
        const filed = r.results.filter((x) => x.ok && x.state === 'filed').length;
        const held = r.results.filter((x) => x.held).length;
        await audit(env, { org_id: proj.org_id, project_id: proj.id, who: (me && me.name) || role,
          action: 'intake.commit', detail: filed + ' filed, ' + held + ' held' });
        return json(r);
      }

      /* The seven figures, read from whatever contract the batch found.
       *
       * GET proposes; POST applies only what was ticked. Nothing here is ever
       * applied without a person: every certificate for the life of the job is
       * computed from these numbers, and a wrong one is silent and expensive. */
      if (p === '/api/intake/terms' && req.method === 'GET') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 403);
        const batch = await getBatch(env, url.searchParams.get('batch') || '');
        if (!batch) return json({ error: 'no such batch' }, 404);
        const proj = await getProject(env, batch.project_id);
        if (!proj) return json({ error: 'no such project' }, 404);

        const contracts = batch.items.filter((i) => i.family === 'contract' && i.file_key !== null);
        let text = '', pages = [];
        for (const it of contracts.slice(0, 3)) {
          const row = await env.DB.prepare('SELECT file_key FROM intake_item WHERE id = ?')
            .bind(it.id).first().catch(() => null);
          if (!row || !row.file_key) continue;
          const f = await getFile(env, row.file_key).catch(() => null);
          if (!f || !f.bytes) continue;
          const pr = probeFile(it.filename, f.bytes);
          if (pr && pr.text) { text += (text ? '\n' : '') + pr.text; pages.push(pr.text); }
        }
        if (!text) return json({ terms: [], read: false });

        const current = {
          retention_pct: proj.retention_pct, retention_cap_pct: proj.retention_limit_pct,
          advance_pct: proj.advance_pct, payment_days: proj.payment_days,
          rfi_reply_days: proj.reply_days, notice_clause: proj.notice_clause,
          completion_date: proj.contract_finish,
        };
        return json({ read: true, terms: proposeTerms(text, pages, current) });
      }

      if (p === '/api/intake/terms' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const wantPid = String(b.project_id || '');
        const proj = await getProject(env, wantPid);
        if (!proj) return json({ error: 'no such project' }, 404);
        const vals = acceptedTerms(Array.isArray(b.terms) ? b.terms : []);
        const keys = Object.keys(vals);
        if (!keys.length) return json({ error: 'nothing was ticked, so nothing was changed' }, 400);

        // The platform's own column names, which are NOT the term keys. Getting
        // one wrong here fails silently — the UPDATE throws, the catch swallows
        // it, and the screen says the term was applied when nothing was written.
        // Every name below is the one in schema.sql, and test-intake-terms.mjs
        // reads them back out of the row to prove it.
        const COLUMN = {
          retention_pct: 'retention_pct', retention_cap_pct: 'retention_limit_pct',
          advance_pct: 'advance_pct', payment_days: 'payment_days',
          rfi_reply_days: 'reply_days', notice_clause: 'notice_clause',
          completion_date: 'contract_finish',
        };
        const applied = [], refused = [];
        for (const k of keys) {
          const col = COLUMN[k];
          if (!col) continue;
          try {
            await env.DB.prepare(`UPDATE projects SET ${col} = ? WHERE id = ?`)
              .bind(vals[k], wantPid).run();
            applied.push((TERMS[k] || {}).label || k);
          } catch (e) {
            // Never report a term as applied when the write failed: the whole
            // point of the panel is that the person knows what was changed.
            refused.push((TERMS[k] || {}).label || k);
          }
        }
        await audit(env, { org_id: proj.org_id, project_id: wantPid, who: (me && me.name) || role,
          action: 'intake.terms', detail: applied.join(', ') });
        return json({ ok: true, applied, refused,
          error: refused.length && !applied.length ? 'none of those could be saved' : undefined });
      }

      /* DRAFT → LIVE, and it is a deliberate act.
       *
       * A draft project is invisible to the customer: nobody signs in to it and
       * nothing can be raised on it. That is what lets the terms be READ from
       * the contract instead of typed before intake ever runs — create the
       * project fully and you have typed the seven figures by hand, which
       * defeats the point of intake.
       *
       * Going live is its own action rather than a side effect of committing a
       * batch, because the moment it happens the client's people can sign in. */
      if (p === '/api/setup/golive' && req.method === 'POST') {
        if (!can.platform(role, me)) return json({ error: 'auth' }, 403);
        const b = await req.json().catch(() => ({}));
        const wantPid = String(b.project_id || '');
        const proj = await getProject(env, wantPid);
        if (!proj) return json({ error: 'no such project' }, 404);
        if (proj.setup_state !== 'draft') return json({ ok: true, already: true, state: 'live' });

        // What is missing is reported rather than blocking: a project can go
        // live with no BOQ and pick it up the week the first application is
        // due. Only the things that make it unusable are refused.
        const missing = [];
        if (!proj.name) missing.push('a project name');
        const team = await projectTeam(env, proj.org_id, wantPid).catch(() => []);
        if (!team.length) missing.push('somebody to sign in — no people are on this project');
        if (missing.length) return json({ error: 'not ready: ' + missing.join('; ') }, 400);

        await env.DB.prepare("UPDATE projects SET setup_state = 'live' WHERE id = ?").bind(wantPid).run();
        await audit(env, { org_id: proj.org_id, project_id: wantPid, who: (me && me.name) || role,
          action: 'project.live', detail: proj.name || wantPid });
        const warn = [];
        if (!gateConfigured(proj)) warn.push('the drawing gate is not configured');
        return json({ ok: true, state: 'live', warnings: warn });
      }

      if (p === '/api/setup/rules') {
        if (!can.platform(role, me) && !can.drawings(role)) return json({ error: 'auth' }, 401);
        if (req.method !== 'GET' && !can.platform(role, me)) {
          return json({ error: 'Only AETRAA sets a project’s drawing numbering.' }, 403);
        }
        await ensureGateColumns(env);
        const wantPid = url.searchParams.get('project') || pid;
        if (req.method === 'GET') {
          const proj = await getProject(env, wantPid);
          if (!proj) return json({ error: 'no such project' }, 404);
          return json({ project_id: wantPid, configured: gateConfigured(proj),
            rules: rulesOf(proj) || [], defaults: DEFAULT_RULES });
        }
        const b = await req.json().catch(() => ({}));
        const rules = cleanRules(Array.isArray(b.rules) ? b.rules : []);
        if (!rules.length) return json({ error: 'give at least one numbering rule' }, 400);
        await env.DB.prepare('UPDATE projects SET drawing_rules = ? WHERE id = ?')
          .bind(JSON.stringify(rules), wantPid).run();
        await audit(env, { project_id: wantPid, who: 'AETRAA Admin', action: 'gate.rules',
          detail: rules.map((r) => r.match).join(', ') });
        return json({ ok: true, rules });
      }

      /* ---- THE PROJECT LIBRARY: contracts, bonds, insurance, O&M manuals —
       * everything that is neither a drawing nor a workflow record, and which
       * until now had nowhere on the platform to be. */
      if (p === '/api/library' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const rows = await listLibrary(env, pid, { class: url.searchParams.get('class') || '' });
        if (rows === null) return json({ migrated: false, documents: [] });
        return json({ migrated: true, documents: rows, classes: CLASSES,
          summary: await librarySummary(env, pid) });
      }
      if (p === '/api/library' && req.method === 'POST') {
        // A read-only login (the consultant's) files nothing.
        if (!can.submit(role)) return json({ error: 'Filing a document is not part of your access.' }, 403);
        const b = await req.json().catch(() => ({}));
        let bytes = null;
        if (typeof b.data === 'string' && /^data:[\w.+-]+\/[\w.+-]+;base64,/.test(b.data)) {
          try { bytes = b64ToBytes(b.data); } catch (e) { return json({ error: 'that file did not arrive in a form the app can store' }, 400); }
        }
        const libWho = (me && me.name) || role;
        const r = await addDocument(env, pid, {
          org_id: me ? me.org_id : null, class: b.class, title: b.title,
          reference: b.reference, doc_date: b.doc_date, filename: b.filename,
          mime: b.mime, bytes, links: b.links, note: b.note,
          language: b.language, unread_reason: b.unread_reason,
        }, { name: libWho });
        if (!r.error && !r.already) {
          await audit(env, { org_id: me ? me.org_id : null, project_id: pid,
            user_id: me ? me.id : null, who: libWho, action: 'library.add',
            detail: (b.class || 'other') + ': ' + String(b.title || '').slice(0, 120) });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/library/file' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const f = await documentFile(env, pid, url.searchParams.get('id') || '');
        if (!f) return json({ error: 'no such document' }, 404);
        return new Response(f.bytes, { headers: {
          'Content-Type': f.mime, 'Cache-Control': 'no-store',
          'Content-Disposition': 'inline; filename="' + f.filename.replace(/[^A-Za-z0-9 ._-]+/g, '-') + '"' } });
      }

      /* ---- Any register, as a real Excel workbook.
       *
       * The screen's "Export to Excel" wrote a comma-separated file with a
       * .csv name. This is the workbook itself: real dates that sort as dates,
       * a frozen header, and a second sheet carrying every field of every
       * record's own form. Read access is enough — exporting a register is
       * reading it, and the read-only folders say so on screen. */
      if ((p === '/api/register/xlsx' || p === '/api/register/schedule.xlsx') && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const bucket = String(url.searchParams.get('reg') || '');
        // The drawing register and the priced bill are not records — they have
        // their own tables — so they are built from their own sources.
        if (bucket === 'drawings' || bucket === 'boq') {
          const proj0 = await getProject(env, pid);
          let bytes0 = null, label = '';
          if (bucket === 'drawings') {
            const dr = await listDrawings(env, pid, {});
            if (dr === null) return json({ error: 'This project has no drawing register yet.' }, 404);
            bytes0 = drawingsWorkbook(dr, proj0); label = 'Drawing register';
          } else {
            const bq = await listBOQ(env, pid);
            if (bq === null) return json({ error: 'No bill of quantities has been loaded for this project.' }, 404);
            bytes0 = boqWorkbook(bq, proj0); label = 'Bill of Quantities';
          }
          const n0 = ((proj0 && proj0.name) || 'Project') + ' - ' + label + ' - ' + today() + '.xlsx';
          return new Response(bytes0, { headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control': 'no-store',
            'Content-Disposition': 'attachment; filename="' + n0.replace(/[^A-Za-z0-9 ._-]+/g, '-') + '"' } });
        }
        if (!REGISTERS[bucket]) return json({ error: 'There is no register by that name.' }, 404);
        await ensureRecordsTable(env);
        const all = await listRecords(env, pid, null);
        if (all === null) return json({ error: 'This project has no registers yet.' }, 404);
        const types = typesFor(bucket);
        const rows = all.filter((x) => types.includes(x.type) && (!mods || recordTypeOn(mods, x.type)));
        const proj = await getProject(env, pid);
        const sched = p.endsWith('schedule.xlsx');
        const bytes = sched ? scheduleWorkbook(bucket, rows, proj) : registerWorkbook(bucket, rows, proj);
        const name = ((proj && proj.name) || 'Project') + ' - ' + REGISTERS[bucket].title +
          (sched ? ' schedule' : '') + ' - ' + today() + '.xlsx';
        return new Response(bytes, { headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Cache-Control': 'no-store',
          'Content-Disposition': 'attachment; filename="' + name.replace(/[^A-Za-z0-9 ._-]+/g, '-') + '"' } });
      }
      /* ---- STEP 10: what needs this person, across the whole project. */
      if (p === '/api/attention' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const proj = await getProject(env, pid);
        return json(await attentionFor(env, pid, proj, me ? { id: me.id, name: me.name } : null, me ? userFunctions(me) : [], role));
      }
      /* ---- STEP 8: meeting minutes and the action tracker. */
      if (p.startsWith('/api/meeting') || p.startsWith('/api/action')) {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const mfns = me ? userFunctions(me) : [];
        const proj = await getProject(env, pid);
        const who = { id: me ? me.id : '', name: (me && me.name) || role };
        const team = me ? await projectTeam(env, me.org_id, pid) : [];
        const bin = (bytes, type, name) => new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store',
          'Content-Disposition': 'attachment; filename="' + name.replace(/[^A-Za-z0-9 ._-]+/g, '-') + '"' } });
        if (p === '/api/meetings' && req.method === 'GET') {
          return json({ meetings: await listMeetings(env, pid), types: MEETING_TYPES,
            may: { write: mayWriteMinutes(mfns, role), issue: mayIssueMinutes(mfns, role) },
            team: team.map((u) => ({ id: u.id, name: u.name, functions: u.functions,
              role: (u.functions || []).map((f) => (FUNCTIONS[f] || {}).label || f).join(' + ') })), me: who.id,
            project: { name: proj && proj.name } });
        }
        if (p === '/api/meeting' && req.method === 'GET') {
          const m = await getMeeting(env, pid, url.searchParams.get('ref') || '');
          if (!m) return json({ error: 'no meeting with that reference' }, 404);
          return json({ meeting: m, checks: m.status === 'draft' ? minutesChecks(m, m.arising_open) : null });
        }
        if (p === '/api/meeting/doc' && req.method === 'GET') {
          const m = await getMeeting(env, pid, url.searchParams.get('ref') || '');
          if (!m) return json({ error: 'no meeting with that reference' }, 404);
          if (url.searchParams.get('view')) {
            return new Response(minutesHTML(m, proj), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
          }
          return bin(new TextEncoder().encode(minutesWord(m, proj)), 'application/msword', m.ref + ' minutes' + (m.status === 'draft' ? ' (draft)' : '') + '.doc');
        }
        if (p === '/api/actions' && req.method === 'GET') {
          return json({ actions: await listActions(env, pid, { mine: url.searchParams.get('mine') ? who.id : '', status: url.searchParams.get('status') || '' }),
            may: { update_any: mayIssueMinutes(mfns, role) }, me: who.id });
        }
        if (p === '/api/actions/xlsx' && req.method === 'GET') {
          return bin(actionsWorkbook(await listActions(env, pid, {}), proj), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Action log - ' + ((proj && proj.name) || 'project') + '.xlsx');
        }
        if (req.method === 'POST') {
          const b = await req.json().catch(() => ({}));
          if (p === '/api/action') {
            const r = await updateAction(env, pid, b, me, mfns, role);
            if (!r.error) await audit(env, { project_id: pid, user_id: who.id || null, who: who.name, action: b.close ? 'action.close' : 'action.redate', detail: String(b.ref || '') });
            return json(r, r.error ? (r.status || 400) : 200);
          }
          if (!mayWriteMinutes(mfns, role)) return json({ error: 'Writing minutes is not part of your access.' }, 403);
          if (p === '/api/meeting') {
            const r = await saveDraft(env, pid, b, who, team);
            return json(r, r.error ? (r.status || 400) : 200);
          }
          if (p === '/api/meeting/discard') {
            const r = await discardDraft(env, pid, String(b.ref || ''));
            return json(r, r.error ? (r.status || 400) : 200);
          }
          if (p === '/api/meeting/issue') {
            if (!mayIssueMinutes(mfns, role)) return json({ error: 'Minutes are issued by the PM, the Principal or Document Control.' }, 403);
            const r = await issueMinutes(env, pid, String(b.ref || ''), who);
            if (!r.error) {
              await audit(env, { project_id: pid, user_id: who.id || null, who: who.name, action: 'minutes.issue', detail: r.ref + ' · ' + r.created.length + ' actions' });
              // Everyone on the platform with an action is told, with their own list.
              const byOwner = {};
              for (const a of r.created) if (a.owner_user_id) (byOwner[a.owner_user_id] = byOwner[a.owner_user_id] || []).push(a);
              r.notified = 0;
              for (const [uidOwner, list] of Object.entries(byOwner)) {
                if (!me || uidOwner === me.id) continue;
                try {
                  const n = await notifyTeam(env, { me, pid, projectName: proj && proj.name, to: { people: [uidOwner] },
                    title: r.ref + ' minutes issued — ' + list.length + ' action' + (list.length === 1 ? '' : 's') + ' for you',
                    message: list.map((a) => a.ref + ': ' + a.text + ' — by ' + a.due).join('\n'), ref: r.ref, kind: 'minutes', email: true,
                  }, (to, subject, htmlBody) => sendEmail(env, to, subject, htmlBody));
                  if (n && n.ok) r.notified += n.sent || 1;
                } catch (e) { /* the minutes are issued either way */ }
              }
            }
            return json(r, r.error ? (r.status || 400) : 200);
          }
        }
      }

      if (p === '/api/records' && req.method === 'POST') {
        if (!can.submit(role)) return json({ error: 'auth' }, 401);
        await ensureRecordsTable(env);
        const b = await req.json().catch(() => ({}));
        // The access matrix, enforced. Until now any 'lead' could raise
        // anything, and 'lead' is Design, DC, QA/QC, HSE, Commercial,
        // Procurement, Finance and Subcontractors at once.
        if (!mayCreateRecord(me, String(b.type || ''), can.platform(role, me))) {
          return json({ error: 'Raising this is ' + whoMayRaise(String(b.type || '')) + "'s, not yours." }, 403);
        }
        if (mods && !recordTypeOn(mods, String(b.type || ''))) {
          return json({ error: 'That register belongs to a module that is not switched on for this project.' }, 403);
        }
        // A failure must carry a failing status. This returned 200 with an
        // error in the body, so anything checking the status code read a
        // rejected record as a created one.
        const proj = await getProject(env, pid);
        const made = await createRecord(env, pid, b, (me && me.name) || role, { project: proj });
        // STEP 7: whoever an incoming letter is sent to is told, with the date.
        if (!made.error && b.type === 'incoming' && me) {
          const rec = made.record || {};
          const step = (rec.workflow || [])[1] || {};
          const fn = (step.by || [])[0];
          if (rec.step === 0 && fn) {                 // not when filed for information
            try {
              made.notified = await notifyTeam(env, {
                me, pid, projectName: proj && proj.name, to: { functions: [fn] },
                title: rec.ref + ' received from ' + String((rec.data || {}).From || '') + ' — reply by ' + (rec.due || ''),
                message: rec.ref + ': ' + (rec.title || '') + '. Sent to you for action. Reply by ' + (rec.due || '') + '.',
                ref: rec.ref, kind: 'record', email: true,
              }, (to, subject, htmlBody) => sendEmail(env, to, subject, htmlBody));
            } catch (e) { /* the letter is logged either way */ }
          }
        }
        return json(made, made.error ? 400 : 200);
      }
      if (p === '/api/record' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const ref = url.searchParams.get('ref') || '';
        const rec = await getRecord(env, pid, ref);
        if (rec && mods && !recordTypeOn(mods, rec.type)) return json({ error: 'That register is not switched on for this project.' }, 403);
        return json({ record: rec ? recordForViewer(me, rec, can.platform(role, me)) : rec, attachments: await listAttachments(env, pid, ref) });
      }
      /* ---- HSE. The design's safety report invented every figure in it and
              said it came from the registers. Permits, observations and
              incidents are ordinary records; men on site, toolbox talks,
              inductions and PPE checks are nobody's record until written
              down, which is what the log is for. */
      if (p === '/api/hse' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        await ensureRecordsTable(env);
        const all = (await listRecords(env, pid)) || [];
        const period = url.searchParams.get('period') === 'daily' ? 'daily' : 'weekly';
        const project = await getProject(env, pid);
        return json(await hseReport(env, pid, period, all, project, url.searchParams.get('to')));
      }
      if (p === '/api/hse/log' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        return json({ log: await listHseLog(env, pid,
          url.searchParams.get('from'), url.searchParams.get('to')) });
      }
      if (p === '/api/hse/log' && req.method === 'POST') {
        // The safety log is HSE's book. The PM and the Principal hold every
        // folder; nobody else writes in it.
        const hfns = me ? userFunctions(me) : [];
        const mayLog = can.platform(role, me) || hfns.includes('hse') ||
          hfns.includes('pm') || hfns.includes('principal');
        if (!mayLog) return json({ error: 'the safety log is HSE\u2019s to keep' }, 403);
        const b = await req.json().catch(() => ({}));
        const r = await saveHseLog(env, pid, b, (me && me.name) || role);
        if (!r.error) {
          await audit(env, { project_id: pid, user_id: me ? me.id : null, who: (me && me.name) || role,
            action: 'hse.log', detail: r.log_date });
        }
        return json(r, r.error ? 400 : 200);
      }

      /* ---- attachments. The files that hang off a record. A WIR goes to the
              consultant "with all attachments", so these are the attachments. */
      if (p === '/api/attachments' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        return json({
          attachments: await listAttachments(env, pid, url.searchParams.get('ref') || ''),
          counts: url.searchParams.get('counts') ? await attachmentCounts(env, pid) : undefined,
          limits: { max_bytes: MAX_ATTACHMENT, max_per_record: MAX_PER_RECORD },
        });
      }
      if (p === '/api/attachment' && req.method === 'POST') {
        if (!can.submit(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        if (b.remove) {
          const r = await removeAttachment(env, pid, String(b.remove));
          if (!r.error) {
            await audit(env, { project_id: pid, user_id: me ? me.id : null, who: (me && me.name) || role,
              action: 'attachment.remove', detail: String(r.ref || '') });
          }
          return json(r, r.error ? 400 : 200);
        }
        let bytes;
        try { bytes = b64ToBytes(b.file_b64 || ''); }
        catch (e) { return json({ error: 'could not read that upload' }, 400); }
        const r = await addAttachment(env, pid, String(b.ref || ''), String(b.filename || ''),
          String(b.mime || ''), bytes, (me && me.name) || role);
        if (!r.error) {
          await audit(env, { project_id: pid, user_id: me ? me.id : null, who: (me && me.name) || role,
            action: 'attachment.add', detail: r.ref + ' · ' + r.filename });
        }
        return json(r, r.error ? 400 : 200);
      }
      if (p.startsWith('/attachment/')) {
        if (!can.view(role)) return new Response('auth', { status: 401 });
        const a = await getAttachment(env, pid, p.slice('/attachment/'.length));
        if (!a) return new Response('not found', { status: 404 });
        // Never inline. A file somebody uploaded is served as a download, so the
        // browser does not run it in the platform's own origin.
        return new Response(a.bytes, {
          headers: {
            'Content-Type': a.mime || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${String(a.filename || 'file').replace(/["\\]/g, '')}"`,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'private, max-age=3600',
          },
        });
      }
      /* ---- interim payment. The commercial team and the PM; the valuation a
              QS has reviewed is the only thing that can become an application. */
      if (p.startsWith('/api/ipc')) {
        const ifns = me ? userFunctions(me) : [];
        const ipcOk = role === 'owner' || role === 'manager'
          || ['commercial', 'finance', 'dc', 'pm', 'principal'].some((f) => ifns.includes(f));
        if (!ipcOk) return json({ error: 'payment is not part of your access' }, 403);
        const whoName = (me && me.name) || role;
        const project = await getProject(env, pid);
        if (p === '/api/ipc' && req.method === 'GET') {
          const may = {};
          for (const a of ['raise', 'approve', 'return', 'issue', 'certify', 'engineer_return', 'pay']) may[a] = mayIPC(a, ifns, role);
          const certs = await listIPC(env, pid);
          return json({ certificates: certs.map((c) => ({ ...c, lines: undefined, detail: { warnings: (c.detail || {}).warnings || [], figures: (c.detail || {}).figures || {} } })),
            pack: IPC_PACK, may, terms: paymentTerms(project, 0) });
        }
        if (p === '/api/ipc/propose' && req.method === 'POST') {
          const b = await req.json().catch(() => ({}));
          const r = await proposeValuation(env, pid, project, b.period_to);
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/ipc/check' && req.method === 'POST') {
          const b = await req.json().catch(() => ({}));
          const r = await checkIPC(env, pid, project, b);
          return json({ ok: r.ok, blockers: r.blockers, warnings: r.warnings, figures: r.figures });
        }
        if (p === '/api/ipc' && req.method === 'POST') {
          if (!mayIPC('raise', ifns, role)) return json({ error: 'Only the QS (Contracts & Commercial), the PM or the Principal raise an application.' }, 403);
          const b = await req.json().catch(() => ({}));
          const r = await createIPC(env, pid, project, b, whoName);
          if (!r.error) {
            await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName,
              action: 'ipc.prepare', detail: r.ref + ' net ' + r.net });
          }
          return json(r, r.error ? 400 : 200);
        }
        if (p === '/api/ipc/advance' && req.method === 'POST') {
          const b = await req.json().catch(() => ({}));
          const r = await advanceIPC(env, pid, project, b, whoName, ifns, role);
          if (!r.error) {
            await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName,
              action: 'ipc.' + String(b.action || ''), detail: String(b.ref || '') + (b.certified_amount != null ? ' certified ' + b.certified_amount : '') + (b.paid_amount != null ? ' paid ' + b.paid_amount : '') });
          }
          return json(r, r.error ? (r.status || 400) : 200);
        }
        // The documents: the whole pack, or the Excel / the letter on their own.
        if ((p === '/api/ipc/pack' || p === '/api/ipc/xlsx' || p === '/api/ipc/doc') && req.method === 'GET') {
          const ipc = await getIPC(env, pid, url.searchParams.get('ref') || '');
          if (!ipc) return json({ error: 'no application with that reference' }, 404);
          const history = await listIPC(env, pid);
          const base = (ipc.ref + ' - ' + (project.name || 'Project')).replace(/[^A-Za-z0-9 ._-]+/g, '-');
          const dl = (bytes, type, name) => new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store',
            'Content-Disposition': 'attachment; filename="' + name + '"', 'X-Content-Type-Options': 'nosniff' } });
          if (p === '/api/ipc/xlsx') return dl(ipcWorkbook(ipc, project, history), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base + ' BOQ valuation.xlsx');
          if (p === '/api/ipc/doc') return dl(new TextEncoder().encode(ipcDocumentWord(ipc, project, history, {})), 'application/msword', base + ' application.doc');
          const pack = await buildIpcPack(env, pid, project, ipc, history);
          await audit(env, { project_id: pid, user_id: me ? me.id : null, who: whoName, action: 'ipc.pack', detail: ipc.ref + ' · ' + pack.files + ' files' });
          return dl(pack.bytes, 'application/zip', pack.filename.replace(/[^A-Za-z0-9 ._-]+/g, '-'));
        }
      }

      // Generate a record's document in this project's consultant format.
      if (p === '/api/record/doc' && req.method === 'GET') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        const ref = url.searchParams.get('ref') || '';
        const rec = await getRecord(env, pid, ref);
        if (!rec) return json({ error: 'unknown record' }, 404);
        if (mods && !recordTypeOn(mods, rec.type)) return json({ error: 'That register is not switched on for this project.' }, 403);
        const docType = url.searchParams.get('as') || rec.type;
        const tpl = await getTemplateBytes(env, pid, docType);
        if (!tpl) {
          return json({ error: 'No template has been set up for ' +
            (DOC_TYPES[docType] || docType) + ' on this project.' }, 404);
        }
        const project = await getProject(env, pid);
        const filled = fillTemplate(tpl.bytes, buildValues(rec, project));
        if (filled.error) return json({ error: filled.error }, 500);
        return new Response(filled.bytes, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${(rec.ref || 'document')}.docx"`,
            'Cache-Control': 'no-store',
          },
        });
      }
      // Moving a record along is the office's act, not the man who raised it:
      // a site engineer must never be able to approve his own inspection.
      if (p === '/api/record/advance' && req.method === 'POST') {
        await ensureRecordsTable(env);
        const b = await req.json().catch(() => ({}));
        // Approving belongs to the folder that owns the record. This both
        // closes the hole and clears a jam: until now only the Principal and
        // the PM could move anything, so QA/QC could not close its own NCR.
        const existing = await getRecord(env, pid, String(b.ref || ''));
        if (!existing) return json({ error: 'record not found' }, 404);
        if (mods && !recordTypeOn(mods, existing.type)) return json({ error: 'That register is not switched on for this project.' }, 403);
        // Each step is its owner's to sign. The Principal and PM may act on any
        // step; everybody else only on the step that is theirs.
        const act = stepPermission(me, existing, can.platform(role, me), String(b.action || 'advance'));
        if (!act.ok) return json({ error: act.error }, 403);
        const whoName = (me && me.name) || role;
        const r = await advanceRecord(env, pid, b, whoName, { project: await getProject(env, pid) });
        // STEP 7: a reply letter just issued closes the incoming letters it answers.
        if (!r.error && existing.type === 'letter') {
          const after = await getRecord(env, pid, existing.ref);
          const issueAt = (after.workflow || []).findIndex((x) => x && x.issue);
          if (after && issueAt >= 0 && (after.step || 0) >= issueAt) {
            r.replied_to = await closeIncomingByReply(env, pid, after, whoName);
          }
        }
        if (!r.error) {
          await audit(env, {
            project_id: pid, user_id: me ? me.id : null, who: whoName,
            action: 'record.' + String(b.action || 'advance'),
            detail: String(b.ref || '') + ' → ' + r.status,
          });
        }
        return json(r, r.error ? 400 : 200);
      }

      if (p === '/api/diary' && req.method === 'GET') {
        if (!can.diary(role)) return json({ error: 'auth' }, 401);
        const project = await getProject(env, pid);
        const day = date(url.searchParams.get('date')) || todayUAE();
        const d = await loadDiary(env, pid, day, project);
        if (d.missing) return json(d);
        // Step 3: what would stop it being submitted, and what to look at.
        const ctx = await diaryContext(env, pid, day);
        return json({ ...d, checks: diaryChecks(d, ctx), context: { prev_date: ctx.prev_date, prev_men: ctx.prev_men,
          photos: ctx.photos, progress: ctx.progress.length } });
      }
      if (p === '/api/diary' && req.method === 'POST') {
        if (!can.diaryEdit(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        // Only the office decides a diary has been issued.
        if (b.submit && !can.export(role)) return json({ error: 'auth' }, 401);
        if (b.submit) {
          // Save what was typed first (as a draft), then check the whole diary
          // as it now stands. A diary with blockers stays a draft.
          const draft = await saveDiary(env, pid, { ...b, submit: false }, str(b.prepared_by, 120));
          if (draft.error) return json(draft, 400);
          const project = await getProject(env, pid);
          const d = await loadDiary(env, pid, draft.report_date, project);
          const checks = diaryChecks(d, await diaryContext(env, pid, draft.report_date));
          if (!checks.ok) {
            return json({ error: 'Saved as a draft — it cannot be submitted yet: ' + checks.blockers.join(' '), checks, saved: true }, 400);
          }
        }
        const r = await saveDiary(env, pid, b, str(b.prepared_by, 120));
        return json(r, r.error ? 400 : 200);
      }
      if (p === '/api/diary/status') {
        if (!can.diary(role)) return json({ error: 'auth' }, 401);
        const project = await getProject(env, pid);
        const n = Math.max(7, Math.min(62, Number(url.searchParams.get('days')) || 14));
        return json(await diaryStatus(env, pid, project, todayUAE(), n));
      }
      if (p === '/api/diary/progress') {
        if (!can.diary(role)) return json({ error: 'auth' }, 401);
        return json({ progress: await todaysProgress(env, pid, date(url.searchParams.get('date')) || todayUAE()) });
      }
      if (p === '/api/diary/list') {
        if (!can.diary(role)) return json({ error: 'auth' }, 401);
        const to = date(url.searchParams.get('to')) || today();
        const from = date(url.searchParams.get('from')) || shiftDay(to, -120);
        const diaries = await listDiaries(env, pid, from, to);
        return json({ from, to, diaries: diaries || [] });
      }
      if (p === '/api/issues') {
        if (!can.view(role)) return json({ error: 'auth' }, 401);
        return json(await issuesPayload(env, pid, url));
      }
      if (p === '/api/issue' && req.method === 'POST') {
        if (!can.raise(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        // Site may raise one; only the office may issue, answer or close it.
        if (!b.create && !can.issueOut(role)) return json({ error: 'auth' }, 401);
        const r = b.create || !b.ref
          ? await createIssue(env, pid, b, role, str(b.raised_by, 120))
          : await updateIssue(env, pid, b);
        return json(r, r.error ? 400 : 200);
      }
      // Whether this app can send email at all, and — on a POST — proof either
      // way. A code that never arrives has four possible causes and no symptom;
      // this turns it into one sentence.
      // A sign-in code the owner can read out. The only route by which one person
      // obtains another's sign-in, so it is confined to the owner, confined to his
      // own organisation, and written to the audit under his name every time.
      if (p === '/api/signin/issue' && req.method === 'POST') {
        if (!can.people(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const who = await getUser(env, str(b.user_id, 60));
        if (!who) return json({ error: 'unknown person' }, 404);
        const oid = me ? me.org_id : (str(b.org, 60) || await onlyOrg(env));
        if (!oid || who.org_id !== oid) return json({ error: 'not on this account' }, 403);

        const r = await issueSignInCode(env, who.id, sha256);
        if (r.error) return json({ error: r.error }, 400);
        await audit(env, {
          org_id: who.org_id, project_id: pid, user_id: who.id,
          who: (me && me.name) || 'owner',
          action: 'sign-in code issued',
          detail: `read out to ${who.name} — email not used`,
        });
        return json(r);
      }
      if (p === '/api/email-check' && req.method === 'GET') {
        if (!can.people(role)) return json({ error: 'auth' }, 401);
        const st = emailStatus(env);
        let withEmail = null, total = null;
        // The platform owner belongs to no organisation, so he is counted across
        // the one he is looking at, or across all of them — not across nothing,
        // which would report "0 people" on an account full of people.
        const oid = me ? me.org_id : (url.searchParams.get('org') || await onlyOrg(env));
        try {
          const r = oid
            ? await env.DB.prepare(
                `SELECT COUNT(*) AS n, SUM(CASE WHEN COALESCE(email,'') <> '' THEN 1 ELSE 0 END) AS e
                   FROM users WHERE org_id = ? AND COALESCE(status,'') <> 'suspended'`
              ).bind(oid).first()
            : await env.DB.prepare(
                `SELECT COUNT(*) AS n, SUM(CASE WHEN COALESCE(email,'') <> '' THEN 1 ELSE 0 END) AS e
                   FROM users WHERE COALESCE(status,'') <> 'suspended'`
              ).first();
          total = (r && r.n) || 0; withEmail = (r && r.e) || 0;
        } catch (err) { /* org tables not there yet */ }
        return json({ ...st, people: total, people_with_email: withEmail });
      }
      if (p === '/api/email-check' && req.method === 'POST') {
        if (!can.people(role)) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const to = parseRecipients(b.to || (me && me.email) || '');
        if (!to.length) return json({ error: 'Put an address to test with.' }, 400);
        const sent = await sendEmail(env, to,
          'Test — AETRAA',
          '<p style="font-family:system-ui,sans-serif;font-size:15px">' +
          'This is the test message from your AETRAA platform. ' +
          'If it reached you, sign-in codes will reach your people too.</p>');
        return json(sent.ok
          ? { ok: true, to: to[0] }
          : { error: emailAdvice(sent, env), raw: sent.error || '', status: sent.status || 0 },
          sent.ok ? 200 : 400);
      }
      if (p === '/api/report-email' && req.method === 'POST') {
        // The office, or by function the Principal, PM or Planning. It goes only
        // to the project's own report list, never to an address typed here.
        const fns = me ? userFunctions(me) : [];
        if (!can.admin(role) && !['principal', 'pm', 'planning', 'hse'].some((x) => fns.includes(x))) return json({ error: 'auth' }, 401);
        const b = await req.json().catch(() => ({}));
        const kind = ['daily', 'weekly', 'monthly', 'hse'].includes(b.kind) ? b.kind : 'daily';
        const r = await emailReport(env, pid, kind, str(b.key, 10));
        return json(r, r.ok ? 200 : 400);
      }
    } catch (err) {
      // The detail goes to the server log, not to whoever sent the request —
      // an error message can carry table names, paths or data.
      console.error(req.method + ' ' + p + ' failed:', (err && err.stack) || err);
      return json({ error: 'the server could not complete that request' }, 500);
    }

    return new Response('Not found', { status: 404 });
  },

  // The evening send. Cloudflare calls this on the cron in wrangler.toml.
  async scheduled(event, env, ctx) {
    // Two crons share this handler; the Monday one carries the weekly send.
    if (event.cron === '0 2 * * *') {
      ctx.waitUntil(runScheduledDigest(env).then((r) => console.log('attention digest', JSON.stringify(r))));
      return;
    }
    if (event.cron === '0 4 1 * *') {
      ctx.waitUntil(runScheduledMonthly(env).then((r) => console.log('monthly reports', JSON.stringify(r))));
    } else if (event.cron === '0 3 * * 1') {
      ctx.waitUntil(runScheduledWeekly(env).then((r) => console.log('weekly reports', JSON.stringify(r))));
    } else {
      ctx.waitUntil(runScheduledReports(env).then((r) => console.log('daily reports', JSON.stringify(r))));
    }
    // Spent sign-in codes are worthless, but they are still rows.
    ctx.waitUntil(purgeSignInCodes(env));
  },
};

/* ------------------------------------------------------- security headers
 *
 * Added to every response, on Cloudflare and on Oracle alike:
 *   HSTS               browsers only ever use https:// for this site
 *   frame-ancestors    nobody can frame the app to trick a click (clickjacking)
 *   nosniff            a file is only ever treated as the type it says it is
 *   Referrer-Policy    links out do not carry our URLs with them
 *   Permissions-Policy the camera (site photos) is allowed; mic, location etc. are not
 *   CSP                pages load code only from here and the one CDN the BOQ
 *                      importer uses; they can talk only to this server.
 * The screens use inline scripts and styles, so those are allowed; what CSP
 * adds here is that nothing can be loaded or sent to any other host.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

export function withSecurityHeaders(res) {
  let out = res;
  try { out.headers.set('X-Content-Type-Options', 'nosniff'); }
  catch (e) { out = new Response(res.body, res); }        // immutable headers: copy once
  const h = out.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()');
  const type = h.get('Content-Type') || '';
  if (/text\/html/i.test(type) && !h.has('Content-Security-Policy')) h.set('Content-Security-Policy', CSP);
  return out;
}

export default {
  async fetch(req, env, ctx) {
    return withSecurityHeaders(await APP.fetch(req, env, ctx));
  },
  async scheduled(event, env, ctx) {
    return APP.scheduled(event, env, ctx);
  },
};
