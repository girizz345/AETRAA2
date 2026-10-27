// STEP 5 — the interim payment application (IPA) and the Engineer's
// certificate (IPC).
//
// The valuation is HYBRID by design: the platform proposes each BOQ line's
// percentage from programme progress, the QS reviews and sets every figure,
// and only then can an application be raised. The money follows the contract:
//
//   Work done (every BOQ line × its cumulative %)
//   + approved variations (each × its %)
//   + materials on site (cost × the contract's % for materials)
//   = GROSS VALUATION TO DATE
//   − retention (capped at the contract limit)
//   − advance payment recovered to date
//   = TOTAL DUE TO DATE
//   − total certified to date on the previous certificate
//   = NET THIS APPLICATION   (+ VAT)
//
// The consultant is not on the platform. So the application follows the same
// road as every other document: QS prepares → PM approves → Document Control
// issues it to the Engineer → the team records the Engineer's certificate →
// Finance records the payment. "Previous" is always what the Engineer actually
// certified last time, never what we applied for.
//
// Every figure is checked before anything is saved: the blockers stop it, the
// warnings are for the QS and the PM to read.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
// Blank is "not given", never zero — a certificate recorded without a figure must fail.
const num = (v) => { const t = String(v == null ? '' : v).replace(/[, ]/g, ''); if (!t) return NaN; const n = Number(t); return Number.isFinite(n) ? n : NaN; };
const num0 = (v) => { const n = num(v); return Number.isFinite(n) ? n : 0; };
const nowISO = () => new Date().toISOString();
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (iso, d) => {
  const t = Date.parse(String(iso || '').slice(0, 10) + 'T00:00:00Z');
  if (!isFinite(t)) return '';
  return new Date(t + d * 86400000).toISOString().slice(0, 10);
};
const key = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };
const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n);
const money = (v) => (Number(v) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// One BOQ line is known by its section and item — not by its database id, which
// changes when the BOQ is re-imported.
export const lineKey = (l) => key(l.section) + '|' + key(l.ref || l.description);

// The documents that make up a complete application. The pack builder
// (src/ipc-pack.js) produces each one, or says plainly that it is missing.
export const IPC_PACK = [
  { id: 'cover',      name: 'Covering letter and pack contents',      auto: true },
  { id: 'summary',    name: 'Payment application summary',            auto: true },
  { id: 'valuation',  name: 'Complete BOQ valuation (Excel)',         auto: true },
  { id: 'variations', name: 'Variation statement and back-up',        auto: true },
  { id: 'previous',   name: 'Statement of previous certificates',     auto: true },
  { id: 'retention',  name: 'Retention statement',                    auto: true },
  { id: 'advance',    name: 'Advance payment recovery statement',     auto: true },
  { id: 'materials',  name: 'Materials on site schedule',             auto: true },
  { id: 'progress',   name: 'Progress report for the period',         auto: true },
  { id: 'photos',     name: 'Progress photographs for the period',    auto: true },
  { id: 'wir',        name: 'Approved inspection requests (WIR/MIR)', auto: true },
  { id: 'support',    name: 'Measurement sheets, day-works and other supporting documents', auto: false },
];

/* ------------------------------------------------------------------ status */

export const STATUS = {
  prepared:  { status: 'Prepared — PM to approve',                    cls: 'warn' },
  approved:  { status: 'Approved — Document Control to issue',        cls: 'wp' },
  issued:    { status: 'Issued — awaiting the Engineer’s certificate', cls: 'wp' },
  certified: { status: 'Certified — client to pay',                   cls: 'wp' },
  part:      { status: 'Part paid',                                   cls: 'wp' },
  paid:      { status: 'Paid',                                        cls: 'ok' },
  ret_pm:    { status: 'Returned by the PM',                          cls: 'late' },
  ret_eng:   { status: 'Returned by the Engineer',                    cls: 'late' },
};
// Where an application stands, including rows written before Step 5.
export function stage(row) {
  const s = String((row && row.status) || '');
  if (/^Prepared/.test(s)) return 'prepared';
  if (/^Approved/.test(s)) return 'approved';
  if (/^Issued|^Submitted/.test(s)) return 'issued';
  if (/^Certified/.test(s)) return 'certified';
  if (/^Part paid/.test(s)) return 'part';
  if (/^Paid/.test(s)) return 'paid';
  if (/^Returned/.test(s)) return 'returned';
  return 'prepared';
}
const OPEN_STAGES = ['prepared', 'approved'];

// Who may do what. fns: the person's functions; role: the legacy role of a
// code login (owner / manager), which keeps its office rights.
const MAY = {
  raise:   ['commercial', 'pm', 'principal'],
  approve: ['pm', 'principal'],
  return:  ['pm', 'principal'],
  issue:   ['dc', 'principal'],
  certify: ['dc', 'commercial', 'pm', 'principal'],
  engineer_return: ['dc', 'commercial', 'pm', 'principal'],
  pay:     ['finance', 'pm', 'principal'],
};
export function mayIPC(action, fns, role) {
  if (role === 'owner') return true;
  if (role === 'manager' && action !== 'issue') return true;
  return (MAY[action] || []).some((f) => (fns || []).includes(f));
}
// The next action on an application at each stage, for the screens.
export const NEXT_ACTIONS = {
  prepared: ['approve', 'return'], approved: ['issue', 'return'],
  issued: ['certify', 'engineer_return'], certified: ['pay'], part: ['pay'], paid: [], returned: [],
};

/* ------------------------------------------------------------ the tables */

const IPC_COLS = {
  rev: 'INTEGER', detail: 'TEXT', total_due: 'REAL',
  approved_by: 'TEXT', approved_at: 'TEXT', issued_by: 'TEXT', issued_at: 'TEXT',
  certified_net: 'REAL', certified_to_date_eng: 'REAL', certified_at: 'TEXT', certified_by: 'TEXT', engineer_ref: 'TEXT',
  paid_amount: 'REAL', paid_at: 'TEXT', paid_by: 'TEXT', return_note: 'TEXT',
};
let ipcColsDone = false;
export async function ensureIpcTable(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ipc (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, no INTEGER, ref TEXT,
         period_from TEXT, period_to TEXT,
         work_done REAL DEFAULT 0, variations REAL DEFAULT 0, materials_on_site REAL DEFAULT 0,
         gross REAL DEFAULT 0, retention_pct REAL DEFAULT 0, retention REAL DEFAULT 0,
         advance_recovery REAL DEFAULT 0, certified_to_date REAL DEFAULT 0,
         previous REAL DEFAULT 0, net REAL DEFAULT 0, vat REAL DEFAULT 0,
         status TEXT, cls TEXT, submitted TEXT, certify_by TEXT, payment_by TEXT,
         lines TEXT, pack TEXT, reviewed_by TEXT, created_by TEXT, created_at TEXT,
         rev INTEGER, detail TEXT, total_due REAL, approved_by TEXT, approved_at TEXT,
         issued_by TEXT, issued_at TEXT, certified_net REAL, certified_to_date_eng REAL,
         certified_at TEXT, certified_by TEXT, engineer_ref TEXT, paid_amount REAL,
         paid_at TEXT, paid_by TEXT, return_note TEXT)`
    ).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ipc_p ON ipc(project_id)`).run();
    // Columns added by Step 5, on tables made before it.
    if (!ipcColsDone) {
      for (const [c, t] of Object.entries(IPC_COLS)) {
        try { await env.DB.prepare(`SELECT ${c} FROM ipc LIMIT 1`).first(); }
        catch (e) { try { await env.DB.prepare(`ALTER TABLE ipc ADD COLUMN ${c} ${t}`).run(); } catch (e2) { /* there */ } }
      }
      ipcColsDone = true;
    }
    return true;
  } catch (e) { return false; }
}

/* ------------------------------------------------------ the contract terms */

// Payment terms for a project. Retention, advance % and the payment period
// have always had their own columns; the rest live in projects.payment_terms.
export const TERM_DEFAULTS = {
  recovery_start_pct: 0,     // recovery starts once this % of the contract is valued
  recovery_full_pct: 80,     // and the advance is fully recovered by this %
  mos_pct: 80,               // materials on site are paid at this % of their cost
  vat_pct: 5,
  certify_days: 28,          // the Engineer's period to certify
};
export function paymentTerms(project, contract) {
  const p = project || {};
  const t = parse(p.payment_terms, {});
  const pick = (k) => (t[k] != null && t[k] !== '' && Number.isFinite(Number(t[k])) ? Number(t[k]) : TERM_DEFAULTS[k]);
  const advancePct = num0(p.advance_pct);
  const advanceAmount = num0(t.advance_amount) > 0 ? num0(t.advance_amount) : r2((contract || 0) * advancePct / 100);
  return {
    retention_pct: num0(p.retention_pct),
    retention_cap_pct: num0(p.retention_limit_pct),
    advance_pct: advancePct,
    advance_amount: advanceAmount,
    advance_received: !!t.advance_received,
    // Recovered in proportion to the work valued unless the contract says otherwise.
    recovery_pct: t.recovery_pct != null && t.recovery_pct !== '' ? num0(t.recovery_pct) : advancePct,
    recovery_start_pct: pick('recovery_start_pct'),
    recovery_full_pct: pick('recovery_full_pct'),
    mos_pct: pick('mos_pct'),
    vat_pct: pick('vat_pct'),
    certify_days: pick('certify_days'),
    payment_days: num0(p.payment_days) || 56,
  };
}

/* --------------------------------------------------------------- reading */

// Weighted progress per programme section, as at a date.
export async function sectionProgress(env, pid, asAt) {
  const out = {};
  const day = DATE_RE.test(asAt || '') ? asAt : '9999-12-31';
  try {
    const { results } = await env.DB.prepare(
      `SELECT a.wbs AS section,
              SUM(COALESCE(NULLIF(a.weight,0),1)) AS w,
              SUM(COALESCE(u.pct,0) * COALESCE(NULLIF(a.weight,0),1)) AS e
         FROM activities a
         LEFT JOIN updates u ON u.project_id = a.project_id AND u.id =
              (SELECT MAX(id) FROM updates WHERE project_id = a.project_id AND activity_id = a.id AND report_date <= ?)
        WHERE a.project_id = ? AND COALESCE(a.kind,'site') = 'site'
        GROUP BY a.wbs`
    ).bind(day, pid).all();
    for (const r of results || []) {
      if (!r.section) continue;
      out[key(r.section)] = r.w ? Math.round((r.e / r.w) * 10) / 10 : 0;
    }
  } catch (e) { /* no programme yet */ }
  return out;
}

const VO_APPROVED = /approved|code a|code b|instruct|agreed|accepted/i;
const VO_REFUSED = /reject|code c|code d|not approved|revise|withdrawn/i;

// Every variation with a value, and whether the client has approved it.
export async function approvedVariations(env, pid) {
  const out = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM records WHERE project_id = ? AND type = 'variation' ORDER BY no`
    ).bind(pid).all();
    for (const r of results || []) {
      const data = parse(r.data, {});
      const agreed = num(data['Approved amount (AED)'] ?? data['Agreed amount (AED)'] ?? data['Agreed amount'] ?? '');
      const est = num(data['Estimated cost (AED)'] ?? data['Amount'] ?? data['Value'] ?? '');
      const amount = Number.isFinite(agreed) && agreed ? agreed : (Number.isFinite(est) ? est : 0);
      if (!amount) continue;
      const wf = parse(r.workflow, []);
      const closed = (r.step || 0) >= wf.length - 1;
      const approved = closed && VO_APPROVED.test(r.status || '') && !VO_REFUSED.test(r.status || '');
      out.push({ ref: r.ref, title: r.title, amount: r2(amount), agreed: Number.isFinite(agreed) && !!agreed,
        approved, status: r.status || '' });
    }
  } catch (e) { /* no records yet */ }
  return out;
}

export async function listIPC(env, pid) {
  await ensureIpcTable(env);
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ipc WHERE project_id = ? ORDER BY no DESC, COALESCE(rev,0) DESC`
    ).bind(pid).all();
    return (results || []).map(shapeIPC);
  } catch (e) { return []; }
}
export async function getIPC(env, pid, ref) {
  await ensureIpcTable(env);
  const r = await env.DB.prepare(`SELECT * FROM ipc WHERE project_id = ? AND ref = ?`).bind(pid, str(ref, 40)).first();
  return r ? shapeIPC(r) : null;
}
function shapeIPC(r) {
  const st = stage(r);
  return { ...r, stage: st, next_actions: NEXT_ACTIONS[st] || [],
    pack: parse(r.pack, []), lines: parse(r.lines, []), detail: parse(r.detail, {}) };
}

// Everything the valuation needs, read once.
export async function ipcContext(env, pid, project, asAt) {
  await ensureIpcTable(env);
  let boq = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM boq WHERE project_id = ? ORDER BY COALESCE(sort_order,999999)`
    ).bind(pid).all();
    boq = results || [];
  } catch (e) { boq = []; }
  const history = (await listIPC(env, pid)).slice().reverse();           // oldest first
  const counted = history.filter((h) => h.stage !== 'returned');
  // "Previous" is the Engineer's own figure on the last certificate.
  const lastCert = [...counted].reverse().find((h) => h.certified_net != null && h.certified_net !== '' || ['certified', 'part', 'paid'].includes(h.stage)) || null;
  const prevPct = {};
  for (const l of boq) prevPct[lineKey(l)] = num0(l.billed_pct);
  if (lastCert) for (const l of lastCert.lines || []) if (l.key) prevPct[l.key] = num0(l.pct);
  const contract = r2(boq.reduce((s, l) => s + num0(l.amount), 0));
  return {
    boq, history, lastCert, prevPct, contract,
    lastApplied: [...counted].reverse()[0] || null,
    progress: await sectionProgress(env, pid, asAt),
    variations: await approvedVariations(env, pid),
    terms: paymentTerms(project, contract),
    today: todayUAE(),
  };
}

/* ------------------------------------------------------------- the maths */

function certifiedToDateOf(row) {
  if (!row) return 0;
  if (row.certified_to_date_eng != null && row.certified_to_date_eng !== '') return num0(row.certified_to_date_eng);
  return num0(row.certified_to_date);
}

// Values an application from the QS's input. Pure: reads only ctx.
//   input: { lines: [{key, pct, note}], variations: [{ref, pct}],
//            mos: [{material, unit, qty, rate, ref}], period_from, period_to,
//            previous, previous_reason }
export function valuate(ctx, input) {
  const b = input || {};
  const T = ctx.terms;
  const blockers = [], warnings = [];
  const given = {};
  for (const l of Array.isArray(b.lines) ? b.lines : []) {
    const k = l.key || (l.section != null ? lineKey(l) : null);
    if (k) given[k] = l;
  }

  if (!ctx.boq.length) blockers.push('No priced BOQ has been imported for this project, so there is nothing to value.');

  // ---- every BOQ line, in BOQ order: the complete bill
  let workDone = 0, prevWork = 0, overProgress = 0, unlinked = 0;
  const lines = ctx.boq.map((l) => {
    const k = lineKey(l);
    const amount = num0(l.amount);
    const prev = Math.max(0, Math.min(100, num0(ctx.prevPct[k])));
    const g = given[k];
    const raw = g && g.pct !== undefined && g.pct !== '' ? num(g.pct) : prev;
    const note = str(g && g.note, 200).trim();
    const label = (l.ref ? l.ref + ' ' : '') + (l.description || l.section || '');
    let pct = raw;
    if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
      blockers.push(`${label}: ${g && g.pct}% is not a percentage between 0 and 100.`);
      pct = prev;
    } else if (raw < prev - 1e-9 && !note) {
      blockers.push(`${label}: ${raw}% is below the ${prev}% already certified. Give the reason in the line's note, or put it back.`);
    }
    const hasProg = Object.prototype.hasOwnProperty.call(ctx.progress, key(l.section));
    const prog = hasProg ? ctx.progress[key(l.section)] : null;
    if (!hasProg) unlinked++;
    else if (pct > prog + 10 && pct > prev) overProgress++;
    workDone += amount * pct / 100;
    prevWork += amount * prev / 100;
    return {
      key: k, id: l.id, section: l.section || '', ref: l.ref || '', description: l.description || '',
      unit: l.unit || '', qty: num0(l.qty), rate: num0(l.rate), amount,
      prev_pct: prev, pct, programme_pct: prog, note,
    };
  });
  if (overProgress) warnings.push(`${overProgress} line${overProgress === 1 ? ' is' : 's are'} claimed more than 10 points ahead of the programme progress for ${overProgress === 1 ? 'its' : 'their'} section. The Engineer will ask.`);
  if (unlinked) warnings.push(`${unlinked} BOQ line${unlinked === 1 ? ' has' : 's have'} no programme section to compare against — ${unlinked === 1 ? 'its' : 'their'} % is the QS's own.`);

  // ---- variations: only those the client has approved
  const voAll = Object.fromEntries(ctx.variations.map((v) => [v.ref, v]));
  const vos = [];
  let voValue = 0, voApprovedTotal = 0;
  for (const v of Array.isArray(b.variations) ? b.variations : []) {
    const rec = voAll[v.ref];
    const pct = num(v.pct);
    if (!rec) { blockers.push(`${v.ref}: there is no variation with that reference and a value.`); continue; }
    if (!rec.approved) { blockers.push(`${v.ref} is not approved by the client (${rec.status || 'open'}), so it cannot be claimed.`); continue; }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) { blockers.push(`${v.ref}: enter a % complete between 0 and 100.`); continue; }
    const value = rec.amount * pct / 100;
    voValue += value; voApprovedTotal += rec.amount;
    vos.push({ ref: rec.ref, title: rec.title, amount: rec.amount, pct, value: r2(value), agreed: rec.agreed });
    if (!rec.agreed) warnings.push(`${rec.ref} is valued on its estimated cost — no agreed amount is recorded on the variation.`);
  }
  const pending = ctx.variations.filter((v) => !v.approved);
  if (pending.length) warnings.push(`${pending.length} variation${pending.length === 1 ? '' : 's'} worth ${money(pending.reduce((s, v) => s + v.amount, 0))} ${pending.length === 1 ? 'is' : 'are'} not approved yet and ${pending.length === 1 ? 'is' : 'are'} not in this application.`);

  // ---- materials on site: delivered, not yet built in
  const mos = [];
  let mosCost = 0;
  for (const m of Array.isArray(b.mos) ? b.mos : []) {
    const material = str(m.material, 160).trim();
    const qty = num(m.qty), rate = num(m.rate);
    if (!material && !m.qty && !m.rate) continue;
    if (!material || !(qty > 0) || !(rate > 0)) { blockers.push(`Materials on site: "${material || 'a line'}" needs a quantity and a rate.`); continue; }
    const cost = qty * rate;
    mosCost += cost;
    const ref = str(m.ref, 60).trim();
    if (!ref) warnings.push(`Materials on site: "${material}" has no delivery note or GRN reference.`);
    mos.push({ material, unit: str(m.unit, 20), qty, rate, cost: r2(cost), paid_pct: T.mos_pct, value: r2(cost * T.mos_pct / 100), ref });
  }
  const mosValue = mosCost * T.mos_pct / 100;

  // ---- the waterfall, to date
  const gross = workDone + voValue + mosValue;
  let retention = gross * T.retention_pct / 100;
  const retCap = T.retention_cap_pct ? (ctx.contract + voApprovedTotal) * T.retention_cap_pct / 100 : 0;
  let retCapped = false;
  if (retCap && retention > retCap) { retention = retCap; retCapped = true; }

  // Advance recovery, to date.
  const prevRow = ctx.lastCert;
  const prevAdvance = prevRow ? num0(prevRow.advance_recovery) : 0;
  let advance = 0;
  const valued = workDone + voValue;
  if (T.advance_amount > 0 && T.advance_received) {
    const C = ctx.contract || 1;
    advance = Math.max(0, valued - C * T.recovery_start_pct / 100) * T.recovery_pct / 100;
    if (valued >= C * T.recovery_full_pct / 100) advance = T.advance_amount;
    advance = Math.min(T.advance_amount, Math.max(advance, prevAdvance));
  } else if (T.advance_amount > 0) {
    warnings.push(`The contract terms show an advance of ${T.advance_pct}% but it is not marked as received, so nothing is recovered. The AETRAA Admin sets this under Payment terms.`);
  }
  if (T.advance_amount > 0 && T.advance_received && advance >= T.advance_amount - 0.005 && prevAdvance < T.advance_amount - 0.005) {
    warnings.push('The advance payment is fully recovered with this application.');
  }
  const dueToDate = gross - retention - advance;

  let previous = certifiedToDateOf(prevRow);
  let previousBasis = prevRow ? `${prevRow.ref} as certified` : 'nothing certified yet';
  if (b.previous !== undefined && b.previous !== null && b.previous !== '') {
    const pv = num(b.previous);
    if (!Number.isFinite(pv) || pv < 0) blockers.push('The previous certified figure must be a number.');
    else if (Math.abs(pv - previous) > 0.005) {
      if (!str(b.previous_reason, 300).trim()) blockers.push(`The previous certified figure is changed from ${money(previous)} to ${money(pv)} — say why.`);
      previous = pv; previousBasis = 'entered: ' + str(b.previous_reason, 300).trim();
    }
  }
  const net = dueToDate - previous;
  const vat = net > 0 ? net * T.vat_pct / 100 : 0;
  if (net <= 0) warnings.push(`This application comes to ${money(net)} — nothing is payable on it.`);
  if (retCapped) warnings.push(`Retention has reached the ${T.retention_cap_pct}% limit (${money(retCap)}); no more is held.`);

  // ---- the period
  const from = str(b.period_from, 10), to = str(b.period_to, 10);
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) blockers.push('Enter the period this application covers (from and to).');
  else {
    if (to < from) blockers.push('The period ends before it starts.');
    if (to > ctx.today) blockers.push('The period cannot end after today.');
    const last = ctx.lastApplied;
    if (last && last.period_to && from <= last.period_to) {
      blockers.push(`The period overlaps ${last.ref}, which ran to ${last.period_to}. Start on ${addDays(last.period_to, 1)} or later.`);
    }
  }
  const awaiting = ctx.history.filter((h) => h.stage === 'issued');
  if (awaiting.length) warnings.push(`${awaiting.map((h) => h.ref).join(', ')} ${awaiting.length === 1 ? 'is' : 'are'} still with the Engineer. "Previous" uses the last certificate actually received${prevRow ? ' (' + prevRow.ref + ')' : ''}.`);
  const open = ctx.history.filter((h) => OPEN_STAGES.includes(h.stage));
  if (open.length) blockers.push(`${open[0].ref} is still being approved or issued. Finish it, or have the PM return it, before raising another.`);

  const f = {
    contract: r2(ctx.contract),
    work_done: r2(workDone), work_prev: r2(prevWork), work_this: r2(workDone - prevWork),
    variations: r2(voValue), variations_approved_total: r2(voApprovedTotal),
    mos_cost: r2(mosCost), materials_on_site: r2(mosValue),
    gross: r2(gross), retention: r2(retention), retention_cap: r2(retCap), retention_capped: retCapped,
    advance_to_date: r2(advance), advance_prev: r2(prevAdvance), advance_this: r2(advance - prevAdvance),
    due_to_date: r2(dueToDate), previous: r2(previous), previous_basis: previousBasis,
    net: r2(net), vat: r2(vat), total_due: r2(net + vat),
    pct_complete: ctx.contract ? r2(workDone / ctx.contract * 100) : 0,
  };
  return { lines, variations: vos, mos, figures: f, terms: T, blockers, warnings, ok: !blockers.length };
}

/* ------------------------------------------------------------ proposal */

// What the QS starts from: every line at the programme's figure for its
// section, or carried forward where there is no programme link.
export async function proposeValuation(env, pid, project, asAt) {
  const ctx = await ipcContext(env, pid, project, asAt);
  if (!ctx.boq.length) return { error: 'no BOQ has been imported for this project' };
  const lines = ctx.boq.map((l) => {
    const k = lineKey(l);
    const prev = num0(ctx.prevPct[k]);
    const linked = Object.prototype.hasOwnProperty.call(ctx.progress, key(l.section));
    const prog = linked ? ctx.progress[key(l.section)] : null;
    // Never propose less than is already certified.
    const proposed = linked ? Math.max(prev, prog) : prev;
    return {
      key: k, id: l.id, ref: l.ref, section: l.section, description: l.description, unit: l.unit,
      qty: l.qty, rate: l.rate, amount: num0(l.amount),
      prev_pct: prev, current_pct: prev, proposed_pct: proposed, programme_pct: prog, linked,
      source: linked ? 'programme' : 'no programme link — carried forward, QS to set',
    };
  });
  const last = ctx.lastApplied;
  return {
    ok: true, lines,
    unlinked: lines.filter((l) => !l.linked).length,
    variations: ctx.variations,
    terms: ctx.terms,
    previous: { ref: ctx.lastCert ? ctx.lastCert.ref : null, certified_to_date: certifiedToDateOf(ctx.lastCert) },
    period: { from: last && last.period_to ? addDays(last.period_to, 1) : '', to: ctx.today },
    totals: {
      contract: ctx.contract,
      proposed_work_done: r2(lines.reduce((s, l) => s + l.amount * l.proposed_pct / 100, 0)),
      approved_variations: r2(ctx.variations.filter((v) => v.approved).reduce((s, v) => s + v.amount, 0)),
    },
  };
}

// The check the screen runs before raising: the same rules, nothing saved.
export async function checkIPC(env, pid, project, body) {
  const b = body || {};
  const ctx = await ipcContext(env, pid, project, b.period_to);
  return valuate(ctx, b);
}

/* --------------------------------------------------------------- raising */

export async function createIPC(env, pid, project, body, who) {
  await ensureIpcTable(env);
  const b = body || {};
  const ctx = await ipcContext(env, pid, project, b.period_to);
  const v = valuate(ctx, b);
  if (!b.reviewed) v.blockers.unshift('The QS must review the valuation before an application can be raised — tick that every line has been checked.');
  if (v.blockers.length) return { error: v.blockers[0], checks: { blockers: v.blockers, warnings: v.warnings }, figures: v.figures };

  // Numbering: the next number, or the same number again (Rev 1, 2…) after a return.
  const latest = ctx.history[ctx.history.length - 1];
  let no = 1, rev = 0;
  if (latest) {
    if (latest.stage === 'returned') { no = latest.no; rev = (Number(latest.rev) || 0) + 1; }
    else no = (Number(latest.no) || 0) + 1;
  }
  const ref = 'IPA-' + String(no).padStart(2, '0') + (rev ? ' Rev ' + rev : '');
  const f = v.figures;
  const row = {
    id: uid('ipc_'), project_id: pid, no, rev, ref,
    period_from: b.period_from, period_to: b.period_to,
    work_done: f.work_done, variations: f.variations, materials_on_site: f.materials_on_site,
    gross: f.gross, retention_pct: v.terms.retention_pct, retention: f.retention,
    advance_recovery: f.advance_to_date, certified_to_date: f.due_to_date,
    previous: f.previous, net: f.net, vat: f.vat, total_due: f.total_due,
    ...STATUS.prepared, submitted: null, certify_by: null, payment_by: null,
  };
  const detail = { variations: v.variations, mos: v.mos, figures: f, terms: v.terms, warnings: v.warnings,
    prepared_at: nowISO(), prepared_by: String(who || '') };
  try {
    await env.DB.prepare(
      `INSERT INTO ipc (id,project_id,no,rev,ref,period_from,period_to,work_done,variations,materials_on_site,
                        gross,retention_pct,retention,advance_recovery,certified_to_date,previous,net,vat,total_due,
                        status,cls,submitted,certify_by,payment_by,lines,pack,detail,reviewed_by,created_by,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(row.id, pid, row.no, row.rev, row.ref, row.period_from, row.period_to, row.work_done,
           row.variations, row.materials_on_site, row.gross, row.retention_pct, row.retention,
           row.advance_recovery, row.certified_to_date, row.previous, row.net, row.vat, row.total_due,
           row.status, row.cls, row.submitted, row.certify_by, row.payment_by,
           JSON.stringify(v.lines), JSON.stringify(IPC_PACK.map((d) => d.id)), JSON.stringify(detail),
           String(b.reviewed_by || who || ''), String(who || ''), nowISO()).run();
  } catch (e) { return { error: 'could not save the application: ' + ((e && e.message) || e) }; }
  return { ok: true, ...row, retention_capped: f.retention_capped, checks: { blockers: [], warnings: v.warnings }, figures: f };
}

/* ---------------------------------------------------- along its road */

// approve · return · issue · certify · engineer_return · pay
export async function advanceIPC(env, pid, project, body, who, fns, role) {
  await ensureIpcTable(env);
  const b = body || {};
  const action = String(b.action || '');
  const row = await getIPC(env, pid, b.ref);
  if (!row) return { error: 'no application with that reference', status: 404 };
  if (!(row.next_actions || []).includes(action)) {
    return { error: `${row.ref} is "${row.status}" — ${action ? '"' + action + '" is not the next step' : 'say what to do'}.`, status: 400 };
  }
  if (!mayIPC(action, fns, role)) {
    const need = (MAY[action] || []).join(', ');
    return { error: `Only ${need.replace(/,([^,]*)$/, ' or$1')} can ${action.replace('_', ' ')} an application.`, status: 403 };
  }
  const today = todayUAE();
  const date = DATE_RE.test(b.date || '') ? b.date : today;
  if (date > today) return { error: 'That date is in the future.', status: 400 };
  const T = paymentTerms(project, 0);
  const set = {};
  if (action === 'approve') Object.assign(set, STATUS.approved, { approved_by: who, approved_at: nowISO() });
  else if (action === 'return' || action === 'engineer_return') {
    const note = str(b.note, 300).trim();
    if (!note) return { error: 'Say why it is being returned.', status: 400 };
    Object.assign(set, action === 'return' ? STATUS.ret_pm : STATUS.ret_eng, { return_note: note });
  } else if (action === 'issue') {
    Object.assign(set, STATUS.issued, { issued_by: who, issued_at: nowISO(), submitted: date,
      certify_by: addDays(date, T.certify_days) });
  } else if (action === 'certify') {
    const amt = num(b.certified_amount);
    if (!Number.isFinite(amt)) return { error: 'Enter the net amount the Engineer certified (before VAT).', status: 400 };
    const toDate = r2(num0(row.previous) + amt);
    Object.assign(set, STATUS.certified, {
      certified_net: r2(amt), certified_to_date_eng: toDate, certified_at: date, certified_by: who,
      engineer_ref: str(b.engineer_ref, 60), payment_by: addDays(date, T.payment_days),
    });
  } else if (action === 'pay') {
    const amt = num(b.paid_amount);
    if (!(amt > 0)) return { error: 'Enter the amount received.', status: 400 };
    const paid = r2(num0(row.paid_amount) + amt);
    const due = r2(num0(row.certified_net) * (1 + T.vat_pct / 100));
    Object.assign(set, paid + 0.005 >= due ? STATUS.paid : STATUS.part, { paid_amount: paid, paid_at: date, paid_by: who });
  }
  const cols = Object.keys(set);
  await env.DB.prepare(`UPDATE ipc SET ${cols.map((c) => c + ' = ?').join(', ')} WHERE project_id = ? AND id = ?`)
    .bind(...cols.map((c) => set[c]), pid, row.id).run();

  // Once certified, the BOQ carries the certified percentages forward.
  if (action === 'certify') {
    try {
      const { results } = await env.DB.prepare(`SELECT id, section, ref, description FROM boq WHERE project_id = ?`).bind(pid).all();
      const pct = Object.fromEntries((row.lines || []).map((l) => [l.key, l.pct]));
      const upd = (results || []).filter((l) => pct[lineKey(l)] != null)
        .map((l) => env.DB.prepare(`UPDATE boq SET billed_pct = ? WHERE project_id = ? AND id = ?`).bind(pct[lineKey(l)], pid, l.id));
      for (let i = 0; i < upd.length; i += 100) await env.DB.batch(upd.slice(i, i + 100));
    } catch (e) { /* the register view only */ }
  }
  const out = await getIPC(env, pid, row.ref);
  const diff = action === 'certify' ? r2(num0(out.certified_net) - num0(row.net)) : 0;
  return { ok: true, ref: out.ref, status: out.status, stage: out.stage, application: out,
    note: diff ? `The Engineer certified ${money(Math.abs(diff))} ${diff < 0 ? 'less' : 'more'} than applied for. The next application's "previous" uses the certified figure.` : '' };
}
