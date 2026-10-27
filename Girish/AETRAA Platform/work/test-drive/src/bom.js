// The Bill of Materials — budget quantities, what has been ordered against
// them, and what has actually been received (GRN).
//
// The rule the job runs on: a site engineer raises a material request without
// ever seeing the budget. It lands with the PM, who sees this BOM and is warned
// — loudly — when releasing the request would take the ordered quantity past the
// budgeted quantity. Nothing blocks the PM; it tells the truth and records it.
//
//   budget_qty    what the BOM allows
//   ordered_qty   released by the PM against it
//   received_qty  actually delivered, from the GRN
//
// The BOM arrives through src/bills.js (v5 E8): read, checked, each material
// matched to a BOQ line, then approved by the PM. Quantities are compared in
// thousandths and money is held to the fil (money.js), so "ordered 10.1 + 0.2"
// is 10.3 and never 10.299999.

import { fils, milli, lineAmount, toAED } from './money.js';
import { addColumns } from './db-cols.js';

const nowISO = () => new Date().toISOString();
// Unique enough for two operations inside the same millisecond.
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[, ]/g, '')); return Number.isFinite(n) ? n : 0; };
const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n);
const key = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export async function ensureBomTable(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS bom (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, ref TEXT, material TEXT,
         mkey TEXT, unit TEXT, budget_qty REAL DEFAULT 0, rate REAL DEFAULT 0,
         amount REAL DEFAULT 0, ordered_qty REAL DEFAULT 0, received_qty REAL DEFAULT 0,
         sort_order INTEGER, created_at TEXT)`
    ).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bom_p ON bom(project_id)`).run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS bom_moves (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, mkey TEXT, material TEXT,
         kind TEXT, qty REAL, ref TEXT, note TEXT, over_by REAL DEFAULT 0,
         by TEXT, at TEXT)`
    ).run();
    // The BOQ line a material is used in, and its discipline (E8 step 2, and the log by discipline).
    await addColumns(env, 'bom', [['boq_ref', 'TEXT'], ['discipline', 'TEXT']]);
    return true;
  } catch (e) { return false; }
}

// Quantities in thousandths, back to a number for storage and display.
const q3 = (m) => (m == null ? 0 : m / 1000);
const qm = (v) => milli(v == null ? 0 : v) || 0;

// Replace a project's whole BOM with the imported rows.
export async function importBOM(env, pid, rows) {
  if (!pid) return { error: 'which project?' };
  if (!Array.isArray(rows) || !rows.length) return { error: 'no rows to import' };
  await ensureBomTable(env);
  try {
    // Keep what has already been ordered/received against a material that
    // survives a re-import, so re-importing the BOM never loses site history.
    const { results: old } = await env.DB.prepare(
      `SELECT mkey, ordered_qty, received_qty FROM bom WHERE project_id = ?`
    ).bind(pid).all();
    const prev = {};
    for (const o of old || []) prev[o.mkey] = { ordered: o.ordered_qty || 0, received: o.received_qty || 0 };

    await env.DB.prepare(`DELETE FROM bom WHERE project_id = ?`).bind(pid).run();
    let i = 0, value = 0;
    for (const r of rows) {
      const material = str(r.material || r.description, 200);
      if (!material) continue;
      const mk = key(material);
      const qtyM = qm(r.budget_qty != null && r.budget_qty !== '' ? r.budget_qty : r.qty);
      const rateF = fils(r.rate) || 0;
      const amountF = r.amount != null && r.amount !== '' ? (fils(r.amount) || 0) : (lineAmount(qtyM, rateF) || 0);
      const carried = prev[mk] || { ordered: 0, received: 0 };
      value += amountF; i++;
      await env.DB.prepare(
        `INSERT INTO bom (id,project_id,ref,material,mkey,unit,budget_qty,rate,amount,ordered_qty,received_qty,sort_order,created_at,boq_ref,discipline)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(uid('bom_'), pid, str(r.ref, 40), material, mk,
             str(r.unit, 24), q3(qtyM), toAED(rateF), toAED(amountF), carried.ordered, carried.received, i, nowISO(),
             str(r.boq_ref, 120) || null, str(r.discipline, 60) || null).run();
    }
    if (!i) return { error: 'no material rows found' };
    return { ok: true, lines: i, value: toAED(value) };
  } catch (e) { return { error: 'import failed: ' + (e && e.message || e) }; }
}

function lineState(l) {
  const budget = qm(l.budget_qty), ordered = qm(l.ordered_qty), received = qm(l.received_qty);
  const pct = (a, b) => (b ? Math.round(a * 1000 / b) / 10 : (a ? 100 : 0));
  return {
    ...l, remaining: q3(budget - ordered),
    over: ordered > budget,
    over_by: ordered > budget ? q3(ordered - budget) : 0,
    ordered_pct: pct(ordered, budget),
    received_pct: pct(received, budget),
    awaiting_delivery: q3(ordered - received),
  };
}

export async function listBOM(env, pid) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM bom WHERE project_id = ? ORDER BY COALESCE(sort_order,999999)`
    ).bind(pid).all();
    const lines = (results || []).map(lineState);
    const totals = lines.reduce((t, l) => {
      t.value += fils(l.amount) || 0;
      if (l.over) { t.over_lines++; }
      return t;
    }, { value: 0, over_lines: 0, lines: lines.length });
    totals.value = toAED(totals.value);
    return { lines, totals };
  } catch (e) { return null; }
}

// THE WARNING. Asked before the PM releases a material request.
// Never blocks — it reports the truth so the PM decides with eyes open.
export async function checkOrder(env, pid, material, qty) {
  await ensureBomTable(env);
  const want = num(qty);
  const mk = key(material);
  let line = null;
  try {
    line = await env.DB.prepare(`SELECT * FROM bom WHERE project_id = ? AND mkey = ?`).bind(pid, mk).first();
  } catch (e) { /* not migrated */ }
  if (!line) {
    return { ok: true, in_bom: false, warning: true,
      message: 'This material is not in the BOM for this project. Releasing it is an addition to budget.',
      material: str(material), qty: want, budget: 0, ordered: 0, remaining: 0, over_by: want };
  }
  const s = lineState(line);
  const after = qm(line.ordered_qty) + qm(want), budget = qm(line.budget_qty);
  const overBy = after > budget ? q3(after - budget) : 0;
  return {
    ok: true, in_bom: true, warning: overBy > 0,
    message: overBy > 0
      ? 'This order exceeds the BOM by ' + overBy + ' ' + (line.unit || '') +
        '. Budget ' + (line.budget_qty || 0) + ', already ordered ' + (line.ordered_qty || 0) + '.'
      : 'Within budget — ' + s.remaining + ' ' + (line.unit || '') + ' remaining after this order.',
    material: line.material, unit: line.unit, qty: want,
    budget: line.budget_qty || 0, ordered: line.ordered_qty || 0,
    remaining: s.remaining, over_by: overBy,
  };
}

// The PM releases an order against the BOM (after seeing the warning).
export async function recordOrder(env, pid, body, who) {
  await ensureBomTable(env);
  const material = str(body.material, 200); const qty = num(body.qty);
  if (!material || qty <= 0) return { error: 'which material, and how much?' };
  const chk = await checkOrder(env, pid, material, qty);
  const mk = key(material);
  try {
    if (chk.in_bom) {
      const line = await env.DB.prepare(`SELECT ordered_qty FROM bom WHERE project_id = ? AND mkey = ?`).bind(pid, mk).first();
      await env.DB.prepare(`UPDATE bom SET ordered_qty = ? WHERE project_id = ? AND mkey = ?`)
        .bind(q3(qm(line && line.ordered_qty) + qm(qty)), pid, mk).run();
    } else {
      // Not budgeted: carry it on the BOM as a zero-budget line so it is visible.
      await env.DB.prepare(
        `INSERT INTO bom (id,project_id,ref,material,mkey,unit,budget_qty,rate,amount,ordered_qty,received_qty,sort_order,created_at)
         VALUES (?,?,?,?,?,?,0,0,0,?,0,999999,?)`
      ).bind(uid('bom_x_'), pid, str(body.ref, 40), material, mk,
             str(body.unit, 24), qty, nowISO()).run();
    }
    await env.DB.prepare(
      `INSERT INTO bom_moves (id,project_id,mkey,material,kind,qty,ref,note,over_by,by,at)
       VALUES (?,?,?,?,'order',?,?,?,?,?,?)`
    ).bind(uid('mv_'), pid, mk, material, qty, str(body.ref, 40),
           str(body.note, 300), chk.over_by || 0, str(who, 120), nowISO()).run();
  } catch (e) { return { error: 'could not record the order' }; }
  return { ok: true, warned: !!chk.warning, over_by: chk.over_by || 0, message: chk.message };
}

// Goods received — the GRN against what was ordered.
export async function recordGRN(env, pid, body, who) {
  await ensureBomTable(env);
  const material = str(body.material, 200); const qty = num(body.qty);
  if (!material || qty <= 0) return { error: 'which material, and how much?' };
  const mk = key(material);
  try {
    const line = await env.DB.prepare(`SELECT * FROM bom WHERE project_id = ? AND mkey = ?`).bind(pid, mk).first();
    if (!line) return { error: 'that material has not been ordered on this project' };
    await env.DB.prepare(`UPDATE bom SET received_qty = ? WHERE project_id = ? AND mkey = ?`)
      .bind(q3(qm(line.received_qty) + qm(qty)), pid, mk).run();
    await env.DB.prepare(
      `INSERT INTO bom_moves (id,project_id,mkey,material,kind,qty,ref,note,over_by,by,at)
       VALUES (?,?,?,?,'grn',?,?,?,0,?,?)`
    ).bind(uid('mv_'), pid, mk, material, qty, str(body.ref, 40),
           str(body.note, 300), str(who, 120), nowISO()).run();
    const after = await env.DB.prepare(`SELECT * FROM bom WHERE project_id = ? AND mkey = ?`).bind(pid, mk).first();
    const s = lineState(after);
    return { ok: true, received: after.received_qty, ordered: after.ordered_qty,
             awaiting_delivery: s.awaiting_delivery,
             over_delivery: after.received_qty > after.ordered_qty };
  } catch (e) { return { error: 'could not record the delivery' }; }
}

export async function listMoves(env, pid, limit = 100) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM bom_moves WHERE project_id = ? ORDER BY at DESC LIMIT ?`
    ).bind(pid, limit).all();
    return results || [];
  } catch (e) { return []; }
}
