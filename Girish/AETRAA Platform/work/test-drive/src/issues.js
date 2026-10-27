import { addColumns } from './db-cols.js';

// The issues register — the part of this app that turns a site remark into a record
// you can rely on months later.
//
// When site flags an activity, the app already knows four things a claim needs and a
// remarks field throws away: what happened, which activity it affects, the date the
// person on site became aware of it, and who that person was. An issue captures those,
// numbers them, and starts a clock. The documents it produces are drafts for you to
// check and issue — the app fills in the facts it holds, not the contract position.

const TYPES = {
  // Information awaited on site. Numbered INF, not RFI: the RFI itself is a
  // record (A10, /rfi), raised from here, so one project has one RFI series.
  // Issues raised before this change keep their RFI-000x references.
  rfi:         { prefix: 'INF', label: 'Information required',      doc: 'rfi',    days: 7 },
  drawing:     { prefix: 'DWG', label: 'Drawing discrepancy',       doc: 'rfi',    days: 7 },
  access:      { prefix: 'ACC', label: 'Access not available',      doc: 'notice', days: 7 },
  material:    { prefix: 'MAT', label: 'Material or approval',      doc: 'notice', days: 7 },
  instruction: { prefix: 'INS', label: 'Instruction required',      doc: 'notice', days: 7 },
  inspection:  { prefix: 'IR',  label: 'Inspection request',        doc: 'none',   days: 2 },
  other:       { prefix: 'GEN', label: 'Other',                     doc: 'notice', days: 7 },
};
export const ISSUE_TYPES = TYPES;
export const TYPE_KEYS = Object.keys(TYPES);

// The delay reasons the site page already offers, mapped to the issue each one
// usually becomes — so site does not have to classify anything.
export const REASON_TYPE = {
  'Information awaited (RFI)': 'rfi',
  'Design change / variation': 'instruction',
  'Client instruction / hold': 'instruction',
  'Access not available': 'access',
  'Preceding trade incomplete': 'access',
  'Material delivery late': 'material',
  'Submittal / approval pending': 'material',
  'Authority approval / NOC': 'material',
  'Rework': 'other',
  'Weather': 'other',
  'Labour shortage': 'other',
  'Plant breakdown': 'other',
  'Payment delay': 'other',
  'Other': 'other',
};

export const STATUSES = ['draft', 'issued', 'answered', 'closed', 'withdrawn'];
const OPEN = ['draft', 'issued'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dnum = (d) => (d && DATE_RE.test(d) ? Date.parse(d + 'T00:00:00Z') / 86400000 : null);
const dstr = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
export const addDays = (d, n) => (dnum(d) === null ? null : dstr(dnum(d) + n));
export const daysBetween = (a, b) => (dnum(a) === null || dnum(b) === null ? null : dnum(b) - dnum(a));

/* ------------------------------------------------------------- numbering */

// Per project, per type: RFI-0001, ACC-0001. The primary key is the reference, so
// if two arrive at the same instant the second insert fails and we simply try the
// next number rather than handing out a duplicate.
async function insertWithRef(env, pid, type, bind) {
  const t = TYPES[type] || TYPES.other;
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await env.DB.prepare(
      'SELECT MAX(no) AS n FROM issues WHERE project_id = ? AND type = ?'
    ).bind(pid, type).first();
    const no = ((row && row.n) || 0) + 1 + attempt;
    const ref = `${t.prefix}-${String(no).padStart(4, '0')}`;
    try {
      await bind(no, ref);
      return { no, ref };
    } catch (err) {
      if (!/UNIQUE|constraint/i.test(String((err && err.message) || err))) throw err;
    }
  }
  throw new Error('could not allocate an issue number');
}

/* ---------------------------------------------------------------- writes */

export async function createIssue(env, pid, body, role, who) {
  // Site never picks a type — the delay reason it already chose decides it.
  const type = TYPES[body.type] ? body.type
    : (REASON_TYPE[String(body.reason || '').trim()] || 'other');
  const title = String(body.title || '').trim().slice(0, 300);
  if (!title) return { error: 'the issue needs a one-line title' };

  const raised = DATE_RE.test(body.raised_date || '') ? body.raised_date
    : new Date().toISOString().slice(0, 10);

  // Site raises it as a draft; the office decides what goes out and when.
  const status = role === 'site' ? 'draft' : (STATUSES.includes(body.status) ? body.status : 'draft');
  const stamp = new Date().toISOString();

  const made = await insertWithRef(env, pid, type, (no, ref) =>
    env.DB.prepare(
      `INSERT INTO issues (project_id, no, ref, type, activity_id, title, detail, trade, floor,
                           raised_by, raised_date, status, impact_days, photo_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      pid, no, ref, type,
      String(body.activity_id || '').slice(0, 60) || null,
      title,
      String(body.detail || '').slice(0, 4000) || null,
      String(body.trade || '').slice(0, 120) || null,
      String(body.floor || '').slice(0, 120) || null,
      String(body.raised_by || who || '').slice(0, 120) || null,
      raised, status,
      Number.isFinite(Number(body.impact_days)) ? Number(body.impact_days) : null,
      String(body.photo_id || '').slice(0, 60) || null,
      stamp, stamp
    ).run()
  );
  return { ok: true, ...made };
}

// One place decides what each transition sets, so a status can never disagree with
// its dates — an issued item always has an issue date and a reply date.
export async function updateIssue(env, pid, body) {
  const ref = String(body.ref || '').slice(0, 24);
  const current = await env.DB.prepare(
    'SELECT * FROM issues WHERE project_id = ? AND ref = ?'
  ).bind(pid, ref).first();
  if (!current) return { error: 'unknown issue' };

  const today = new Date().toISOString().slice(0, 10);
  const set = {};
  const take = (k, max) => {
    if (body[k] === undefined) return;
    set[k] = body[k] === null || body[k] === '' ? null : String(body[k]).slice(0, max);
  };
  take('title', 300); take('detail', 4000); take('answer', 4000);
  take('trade', 120); take('floor', 120); take('notice_ref', 60);
  if (body.type !== undefined && TYPES[body.type]) set.type = body.type;
  if (body.raised_date !== undefined && DATE_RE.test(body.raised_date)) set.raised_date = body.raised_date;
  if (body.impact_days !== undefined) {
    set.impact_days = Number.isFinite(Number(body.impact_days)) ? Number(body.impact_days) : null;
  }

  const action = String(body.action || '');
  if (action === 'issue') {
    const t = TYPES[set.type || current.type] || TYPES.other;
    set.status = 'issued';
    set.issued_date = DATE_RE.test(body.issued_date || '') ? body.issued_date : today;
    const days = Number.isFinite(Number(body.reply_days)) ? Number(body.reply_days) : t.days;
    set.reply_due = addDays(set.issued_date, days);
  } else if (action === 'answer') {
    set.status = 'answered';
    set.answered_date = DATE_RE.test(body.answered_date || '') ? body.answered_date : today;
  } else if (action === 'close') {
    set.status = 'closed';
    set.closed_date = DATE_RE.test(body.closed_date || '') ? body.closed_date : today;
  } else if (action === 'withdraw') {
    set.status = 'withdrawn';
    set.closed_date = today;
  } else if (action === 'reopen') {
    set.status = current.issued_date ? 'issued' : 'draft';
    set.closed_date = null; set.answered_date = null;
  }

  const keys = Object.keys(set);
  if (!keys.length) return { ok: true, ref, unchanged: true };
  set.updated_at = new Date().toISOString();
  const cols = Object.keys(set);
  await env.DB.prepare(
    `UPDATE issues SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE project_id = ? AND ref = ?`
  ).bind(...cols.map((c) => set[c]), pid, ref).run();
  return { ok: true, ref };
}

/* ----------------------------------------------------------------- reads */

// Ageing is worked out here rather than in the browser, so the register, the daily
// report and the monthly all count the same days.
export function decorate(row, asAt) {
  const today = asAt || new Date().toISOString().slice(0, 10);
  const t = TYPES[row.type] || TYPES.other;
  const open = OPEN.includes(row.status);
  const overdue = open && row.reply_due ? dnum(row.reply_due) < dnum(today) : false;
  return {
    ...row,
    type_label: t.label,
    doc: t.doc,
    open,
    overdue,
    age: daysBetween(row.raised_date, today),
    days_unanswered: row.issued_date ? daysBetween(row.issued_date, row.answered_date || today) : null,
    days_overdue: overdue ? daysBetween(row.reply_due, today) : 0,
    unissued_days: row.status === 'draft' ? daysBetween(row.raised_date, today) : null,
  };
}

export async function listIssues(env, pid, opts = {}) {
  const where = ['project_id = ?'];
  const args = [pid];
  if (opts.status && STATUSES.includes(opts.status)) { where.push('status = ?'); args.push(opts.status); }
  if (opts.open) where.push(`status IN ('draft','issued')`);
  if (opts.type && TYPES[opts.type]) { where.push('type = ?'); args.push(opts.type); }
  if (opts.activity_id) { where.push('activity_id = ?'); args.push(opts.activity_id); }
  if (opts.from) { where.push('raised_date >= ?'); args.push(opts.from); }
  if (opts.to) { where.push('raised_date <= ?'); args.push(opts.to); }
  const { results } = await env.DB.prepare(
    `SELECT * FROM issues WHERE ${where.join(' AND ')}
      ORDER BY raised_date DESC, no DESC LIMIT ${Math.min(1000, opts.limit || 500)}`
  ).bind(...args).all();
  return (results || []).map((r) => decorate(r, opts.asAt));
}

export async function getIssue(env, pid, ref) {
  const row = await env.DB.prepare('SELECT * FROM issues WHERE project_id = ? AND ref = ?')
    .bind(pid, ref).first();
  return row ? decorate(row) : null;
}

/* ------------------------------------------------------------- documents */

const NAVY = '#212d51';
const INK = '#1b2437';
const MUTED = '#6a7590';
const RULE = '#cbd5e4';

const esc = (v) =>
  String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
function longDate(d) {
  if (!d || !DATE_RE.test(d)) return '';
  const [y, m, day] = d.split('-');
  return `${Number(day)} ${MONTHS[Number(m) - 1]} ${y}`;
}

const pageCSS = `font-family:Arial,Helvetica,sans-serif;color:${INK};font-size:13px;line-height:1.55;` +
                `max-width:820px;margin:0 auto;`;
const lbl = `font:600 10.5px/1.3 Arial,Helvetica,sans-serif;letter-spacing:.06em;` +
            `text-transform:uppercase;color:${MUTED};`;

function fieldTable(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="border-collapse:collapse;border:1px solid ${RULE};margin:14px 0;">
    ${rows.map(([k, v]) => `<tr>
      <td style="width:30%;padding:8px 10px;border:1px solid ${RULE};background:#f5f8fc;${lbl}">${esc(k)}</td>
      <td style="padding:8px 10px;border:1px solid ${RULE};">${v}</td></tr>`).join('')}
  </table>`;
}

function letterhead(project, heading, ref) {
  return `<div style="border-bottom:2px solid ${NAVY};padding-bottom:12px;margin-bottom:18px;">
    <table role="presentation" width="100%"><tr>
      <td style="vertical-align:bottom;">
        <div style="font:700 19px/1.25 Arial,Helvetica,sans-serif;color:${NAVY};">${esc(heading)}</div>
        <div style="${lbl}margin-top:6px;">${esc(project.name || '')}</div>
      </td>
      <td style="text-align:right;vertical-align:bottom;">
        <div style="font:700 17px/1.2 Arial,Helvetica,sans-serif;color:${NAVY};">${esc(ref)}</div>
      </td>
    </tr></table>
  </div>`;
}

function signOff(project) {
  return `<table role="presentation" width="100%" style="margin-top:34px;"><tr>
    <td style="width:55%;">
      <div style="${lbl}">For and on behalf of</div>
      <div style="font-weight:700;margin-top:4px;">${esc(project.contractor_name || 'the Contractor')}</div>
      <div style="border-bottom:1px solid ${RULE};height:44px;"></div>
      <div style="${lbl}margin-top:5px;">Name, position and date</div>
    </td>
    <td></td>
  </tr></table>`;
}

// An RFI: a question, the work it is holding up, and a reply block.
function rfiDoc(project, issue, activity) {
  const pd = activity && (activity.planned_start || activity.planned_finish)
    ? `${activity.planned_start || '—'} to ${activity.planned_finish || '—'}` : '—';
  return `<div style="${pageCSS}">
    ${letterhead(project, 'Request for Information', issue.ref)}
    ${fieldTable([
      ['Project', esc(project.name || '') + (project.ref ? ` &middot; ${esc(project.ref)}` : '')],
      ['To', esc(project.engineer_name || 'The Engineer / Consultant')],
      ['From', esc(project.contractor_name || 'The Contractor')],
      ['Date raised on site', longDate(issue.raised_date) + (issue.raised_by ? ` &middot; ${esc(issue.raised_by)}` : '')],
      ['Date issued', issue.issued_date ? longDate(issue.issued_date) : '<i style="color:#6a7590">not yet issued</i>'],
      ['Reply required by', issue.reply_due ? longDate(issue.reply_due) : '—'],
      ['Subject', `<b>${esc(issue.title)}</b>`],
      ['Activity affected', activity
        ? `${esc(activity.name)}<div style="${lbl}margin-top:4px;">${esc(issue.activity_id)} &middot; programme ${esc(pd)}</div>`
        : esc(issue.activity_id || '—')],
      ['Location', esc([issue.floor, issue.trade].filter(Boolean).join(' · ')) || '—'],
    ])}

    <div style="${lbl}margin-top:20px;">Information requested</div>
    <div style="border:1px solid ${RULE};padding:12px 14px;margin-top:6px;min-height:120px;white-space:pre-wrap;">${esc(issue.detail || issue.title)}</div>

    <div style="${lbl}margin-top:18px;">Effect on the works</div>
    <div style="border:1px solid ${RULE};padding:12px 14px;margin-top:6px;">
      The above activity cannot proceed until this information is received.
      ${issue.impact_days ? `A delay of ${esc(issue.impact_days)} working day(s) is presently anticipated.` : ''}
      This request is raised for information and does not itself constitute a notice under the Contract.
    </div>

    <div style="${lbl}margin-top:22px;">Reply</div>
    <div style="border:1px solid ${RULE};padding:12px 14px;margin-top:6px;min-height:150px;white-space:pre-wrap;">${esc(issue.answer || '')}</div>
    <table role="presentation" width="100%" style="margin-top:10px;"><tr>
      <td style="${lbl}">Replied by</td><td style="${lbl}">Date</td>
    </tr><tr>
      <td style="border-bottom:1px solid ${RULE};height:34px;width:60%;"></td>
      <td style="border-bottom:1px solid ${RULE};height:34px;"></td>
    </tr></table>
    ${signOff(project)}
  </div>`;
}

// A notice: the event, when we knew, what it affects. Deliberately factual — the
// contract position and the clause are yours to set and to check.
function noticeDoc(project, issue, activity) {
  const t = TYPES[issue.type] || TYPES.other;
  const clause = project.notice_clause
    ? `Pursuant to ${esc(project.notice_clause)} of the Contract, notice is hereby given of the following event.`
    : `<span style="background:#fff3cd;">[Insert the notice provision of your contract — set it once on the Admin page and it will appear here on every notice.]</span>`;
  return `<div style="${pageCSS}">
    ${letterhead(project, 'Notice of Delaying Event', issue.ref)}
    ${fieldTable([
      ['Project', esc(project.name || '') + (project.ref ? ` &middot; ${esc(project.ref)}` : '')],
      ['To', esc(project.engineer_name || 'The Engineer / Consultant')],
      ['From', esc(project.contractor_name || 'The Contractor')],
      ['Date of this notice', issue.issued_date ? longDate(issue.issued_date) : longDate(new Date().toISOString().slice(0, 10))],
      ['Date the Contractor became aware', `<b>${longDate(issue.raised_date)}</b>` +
        (issue.raised_by ? `<div style="${lbl}margin-top:4px;">Recorded on site by ${esc(issue.raised_by)}</div>` : '')],
      ['Nature of the event', esc(t.label)],
      ['Subject', `<b>${esc(issue.title)}</b>`],
    ])}

    <p style="margin:16px 0 0;">Dear Sirs,</p>
    <p style="margin:10px 0 0;">${clause}</p>

    <div style="${lbl}margin-top:18px;">The event</div>
    <div style="border:1px solid ${RULE};padding:12px 14px;margin-top:6px;white-space:pre-wrap;min-height:110px;">${esc(issue.detail || issue.title)}</div>

    <div style="${lbl}margin-top:18px;">Works affected</div>
    ${fieldTable([
      ['Activity', activity ? esc(activity.name) : esc(issue.activity_id || '—')],
      ['Activity reference', esc(issue.activity_id || '—')],
      ['Programme dates', activity ? esc(`${activity.planned_start || '—'} to ${activity.planned_finish || '—'}`) : '—'],
      ['Location / trade', esc([issue.floor, issue.trade].filter(Boolean).join(' · ')) || '—'],
      ['Delay presently anticipated', issue.impact_days ? `${esc(issue.impact_days)} working day(s)` : 'To be confirmed'],
    ])}

    <p style="margin:14px 0 0;">
      The above activity is affected from the date stated. We are taking such steps as are reasonably
      available to us to mitigate the effect, and we will keep you informed as the position develops.
      Particulars will follow as soon as the effect can be established.
    </p>
    <p style="margin:10px 0 0;">
      This notice is given without prejudice to, and with full reservation of, our rights and entitlements
      under the Contract and at law.
    </p>
    <p style="margin:14px 0 0;">Yours faithfully,</p>
    ${signOff(project)}
    <div style="margin-top:26px;padding-top:10px;border-top:1px solid ${RULE};font-size:11px;color:${MUTED};">
      Drafted from the site record raised on ${longDate(issue.raised_date)}. Check the wording and the
      contract reference before issuing.
    </div>
  </div>`;
}

export function issueDocument(project, issue, activity) {
  const t = TYPES[issue.type] || TYPES.other;
  if (t.doc === 'rfi') return rfiDoc(project, issue, activity);
  if (t.doc === 'notice') return noticeDoc(project, issue, activity);
  return `<div style="${pageCSS}">
    ${letterhead(project, 'Inspection Request', issue.ref)}
    ${fieldTable([
      ['Project', esc(project.name || '')],
      ['Activity', activity ? esc(activity.name) : esc(issue.activity_id || '—')],
      ['Location / trade', esc([issue.floor, issue.trade].filter(Boolean).join(' · ')) || '—'],
      ['Raised', longDate(issue.raised_date) + (issue.raised_by ? ` &middot; ${esc(issue.raised_by)}` : '')],
      ['Ready for inspection', `<b>${esc(issue.title)}</b>`],
    ])}
    <div style="${lbl}margin-top:18px;">Detail</div>
    <div style="border:1px solid ${RULE};padding:12px 14px;margin-top:6px;white-space:pre-wrap;min-height:90px;">${esc(issue.detail || '')}</div>
    <div style="${lbl}margin-top:18px;">Consultant's result</div>
    <div style="border:1px solid ${RULE};padding:12px 14px;margin-top:6px;min-height:110px;white-space:pre-wrap;">${esc(issue.answer || '')}</div>
    ${signOff(project)}
  </div>`;
}

export const issueDocumentTitle = (issue) => {
  const t = TYPES[issue.type] || TYPES.other;
  return t.doc === 'rfi' ? `${issue.ref} — Request for Information`
    : t.doc === 'notice' ? `${issue.ref} — Notice of Delaying Event`
    : `${issue.ref} — Inspection Request`;
};

/* ------------------------------------------------- the RFI raised from it */

// An issue that needs information is answered by an RFI in the records
// register (A10). The issue keeps the RFI's reference, once.
export async function ensureIssueRfiColumn(env) {
  await addColumns(env, 'issues', [['rfi_ref', 'TEXT']]);
}
export async function linkIssueRfi(env, pid, issueRef, rfiRef) {
  await ensureIssueRfiColumn(env);
  const r = await env.DB.prepare('UPDATE issues SET rfi_ref = ? WHERE project_id = ? AND ref = ? AND rfi_ref IS NULL')
    .bind(rfiRef, pid, issueRef).run();
  return !!(r && r.meta ? r.meta.changes : r && r.changes);
}
