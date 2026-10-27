// Commercial: the priced Bill of Quantities (BOQ) per project.
//
// A project's priced bill is read and checked in src/bills.js (v5 E7: every
// line with no rate or a wrong sum fixed or accepted by the QS, then approved
// by the PM) and only then stored here, line by line, rolled up by section.
// The BOQ feeds the commercial register and the IPC valuation (billed % per line
// → gross this period). One table, replaced wholesale on re-import.
//
// Money is held to the fil and every total is a sum of whole fils (money.js),
// so the bill's total here is the source file's total exactly.

import { fils, milli, lineAmount, pctOf, toAED, ratioPct } from './money.js';

const nowISO = () => new Date().toISOString();
const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[, ]/g, '')); return Number.isFinite(n) ? n : 0; };
const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n);

export async function ensureBoqTable(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS boq (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, section TEXT, ref TEXT,
         description TEXT, unit TEXT, qty REAL DEFAULT 0, rate REAL DEFAULT 0,
         amount REAL DEFAULT 0, billed_pct REAL DEFAULT 0, sort_order INTEGER, created_at TEXT)`
    ).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_boq_p ON boq(project_id)`).run();
    return true;
  } catch (e) { return false; }
}

// Replace a project's whole BOQ with the imported rows.
export async function importBOQ(env, pid, rows) {
  if (!pid) return { error: 'which project?' };
  if (!Array.isArray(rows) || !rows.length) return { error: 'no rows to import' };
  await ensureBoqTable(env);
  try {
    await env.DB.prepare(`DELETE FROM boq WHERE project_id = ?`).bind(pid).run();
    let i = 0, total = 0;
    for (const r of rows) {
      const qty = num(r.qty), rate = num(r.rate);
      // The amount as given, to the fil; qty × rate (in fils) only when none is given.
      const given = r.amount != null && r.amount !== '' ? fils(r.amount) : null;
      const amountF = given != null ? given : (lineAmount(milli(r.qty), fils(r.rate)) || 0);
      const amount = toAED(amountF);
      const billed = Math.max(0, Math.min(100, num(r.billed_pct)));
      total += amountF;
      i++;
      const id = 'boq_' + Date.now().toString(36) + '_' + i;
      await env.DB.prepare(
        `INSERT INTO boq (id,project_id,section,ref,description,unit,qty,rate,amount,billed_pct,sort_order,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(id, pid, str(r.section, 120), str(r.ref, 40), str(r.description, 300),
             str(r.unit, 24), qty, rate, amount, billed, i, nowISO()).run();
    }
    return { ok: true, lines: i, value: toAED(total), value_fils: total };
  } catch (e) { return { error: 'import failed: ' + (e && e.message || e) }; }
}

export async function listBOQ(env, pid) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM boq WHERE project_id = ? ORDER BY COALESCE(sort_order,999999)`
    ).bind(pid).all();
    const lines = results || [];
    // roll up by section for the register view — in whole fils, each line's
    // billed value rounded once, then added
    const secMap = {};
    let value = 0, billedVal = 0;
    for (const l of lines) {
      const a = fils(l.amount) || 0;
      const b = pctOf(a, l.billed_pct || 0);
      value += a; billedVal += b;
      const k = l.section || '(unsectioned)';
      const s = secMap[k] || (secMap[k] = { section: k, value: 0, billed_value: 0, lines: 0 });
      s.value += a; s.billed_value += b; s.lines++;
    }
    const sections = Object.values(secMap).map((s) => ({
      ...s, value: toAED(s.value), amount: toAED(s.value), billed_value: toAED(s.billed_value),
      billed_pct: s.value ? ratioPct(s.billed_value, s.value, 1) : 0,
    }));
    return {
      lines, sections,
      totals: { value: toAED(value), billed_value: toAED(billedVal), value_fils: value,
                billed_pct: value ? ratioPct(billedVal, value, 1) : 0 },
    };
  } catch (e) { return null; } // not migrated
}

// Update the billed % of a section (or a single line by ref).
export async function setBilled(env, pid, body) {
  await ensureBoqTable(env);
  const pct = Math.max(0, Math.min(100, num(body.billed_pct)));
  try {
    if (body.section) {
      await env.DB.prepare(`UPDATE boq SET billed_pct = ? WHERE project_id = ? AND section = ?`)
        .bind(pct, pid, str(body.section, 120)).run();
    } else if (body.ref) {
      await env.DB.prepare(`UPDATE boq SET billed_pct = ? WHERE project_id = ? AND ref = ?`)
        .bind(pct, pid, str(body.ref, 40)).run();
    } else return { error: 'which section or line?' };
    return { ok: true };
  } catch (e) { return { error: 'update failed' }; }
}
