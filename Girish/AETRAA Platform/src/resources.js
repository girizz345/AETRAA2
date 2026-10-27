// What the project has consumed, against what it has built.
//
// The diary has been collecting this every day already — labour by trade, plant
// by category, materials delivered. Nobody was adding it up. A running total on
// its own is only a report; what turns it into control is setting it against the
// progress those resources bought.
//
// So the number this file exists to produce is not "man-days spent". It is
// man-days per point of progress, per trade, now versus over the life of the
// job. A trade getting slower shows up here weeks before it shows up in the
// programme, because the programme only moves when work finishes.
//
// Money is optional and separate. Rates live in their own table and are read
// only for whoever is allowed to see them; everything else in here is quantities,
// which anybody may see.

import { DEFAULT_TRADES, DEFAULT_MATERIALS } from './diary.js';
export { DEFAULT_MATERIALS };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const day0 = (d) => Date.parse(d + 'T00:00:00Z') / 86400000;
const dstr = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
export const shift = (d, n) => dstr(day0(d) + n);

export const RECENT_DAYS = 30;


export const RATE_KINDS = ['labour', 'plant', 'material'];

const parse = (v, fallback) => {
  if (!v) return fallback;
  try { const j = JSON.parse(v); return Array.isArray(j) ? j : fallback; } catch (e) { return fallback; }
};

const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  // Site types "12 m3" or "1,200" into a free-text box. Take the number out of it.
  const n = Number(String(v).replace(/,/g, '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Trade names come from two places that were never made to agree: the diary
// roster somebody typed, and the trade codes in the P6 programme. Matching is
// done on a flattened form so "Steel Fixer", "steel fixer" and "Steel-Fixer" are
// one trade — and anything that still does not match is reported rather than
// quietly dropped.
export const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export const projectMaterials = (project) => {
  const list = parse(project && project.materials, null);
  return list && list.length ? list : DEFAULT_MATERIALS;
};

/* ------------------------------------------------------------- the rates */

export async function loadRates(env, pid) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT kind, name, rate, unit FROM rates WHERE project_id = ?'
    ).bind(pid).all();
    const out = { labour: {}, plant: {}, material: {} };
    for (const r of results || []) {
      if (out[r.kind]) out[r.kind][key(r.name)] = { rate: Number(r.rate) || 0, unit: r.unit, name: r.name };
    }
    return out;
  } catch (err) {
    return null;                       // table not there yet
  }
}

export async function saveRate(env, pid, body) {
  const kind = RATE_KINDS.includes(body.kind) ? body.kind : null;
  const name = String(body.name || '').trim().slice(0, 160);
  if (!kind) return { error: 'labour, plant or material?' };
  if (!name) return { error: 'which one?' };
  const rate = Number(body.rate);
  if (!Number.isFinite(rate) || rate < 0) return { error: 'that rate is not a number' };
  if (rate === 0) {
    await env.DB.prepare('DELETE FROM rates WHERE project_id = ? AND kind = ? AND name = ?')
      .bind(pid, kind, name).run();
    return { ok: true, removed: true };
  }
  await env.DB.prepare(
    `INSERT INTO rates (project_id, kind, name, rate, unit, updated_at) VALUES (?,?,?,?,?,?)
     ON CONFLICT(project_id, kind, name) DO UPDATE SET
       rate = excluded.rate, unit = excluded.unit, updated_at = excluded.updated_at`
  ).bind(pid, kind, name, rate, String(body.unit || '').slice(0, 24) || null,
         new Date().toISOString()).run();
  return { ok: true, kind, name, rate };
}

const rateFor = (rates, kind, name) => {
  if (!rates || !rates[kind]) return 0;
  const hit = rates[kind][key(name)];
  return hit ? hit.rate : 0;
};

/* --------------------------------------------------------- what was spent */

// One row per day. The diary is the authority where one was kept; the manpower
// table covers days recorded before the diary existed, or entered on the
// manpower tab. Taking both without this rule would count those days twice.
async function readDays(env, pid, from, to) {
  let diary = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT report_date, staff, plant, materials, subs, status
         FROM diary WHERE project_id = ? AND report_date BETWEEN ? AND ?
        ORDER BY report_date`
    ).bind(pid, from, to).all();
    diary = results || [];
  } catch (err) {
    diary = [];                        // diary not migrated — manpower still works
  }
  const kept = new Set(diary.map((d) => d.report_date));

  const { results: mp } = await env.DB.prepare(
    `SELECT report_date, trade, SUM(headcount) AS n FROM manpower
      WHERE project_id = ? AND report_date BETWEEN ? AND ?
      GROUP BY report_date, trade ORDER BY report_date`
  ).bind(pid, from, to).all();

  const extra = {};
  for (const r of mp || []) {
    if (kept.has(r.report_date)) continue;
    (extra[r.report_date] || (extra[r.report_date] = [])).push({ t: r.trade, n: Number(r.n) || 0, h: '' });
  }
  return { diary, extra };
}

// Hours are free text on the sheet — "8", "8 hrs", "10". Anything unreadable
// falls back to a working day rather than to zero, because a man who was on site
// worked a day whatever somebody wrote in the box.
const HOURS_DEFAULT = 8;
const hours = (h) => {
  const n = num(h);
  return n > 0 && n <= 24 ? n : HOURS_DEFAULT;
};

export async function spend(env, pid, project, from, to) {
  const { diary, extra } = await readDays(env, pid, from, to);

  const labour = {};      // key -> { trade, days, hours }
  const plant = {};       // key -> { type, days, hours }
  const material = {};    // key -> { material, unit, qty, deliveries }
  const subs = {};        // name -> man-days
  const byMonth = {};     // month -> { man_days, plant_days }
  const daysKept = [];

  const add = (date, staffRows, plantRows, matRows, subRows) => {
    const month = date.slice(0, 7);
    const m = byMonth[month] || (byMonth[month] = { month, man_days: 0, plant_days: 0, days: 0 });
    m.days++;
    for (const r of staffRows || []) {
      const n = num(r.n);
      if (!n) continue;
      const k = key(r.t);
      const e = labour[k] || (labour[k] = { trade: r.t, days: 0, hours: 0, first: date, last: date });
      e.days += n; e.hours += n * hours(r.h); e.last = date;
      if (date < e.first) e.first = date;
      m.man_days += n;
    }
    for (const r of plantRows || []) {
      const n = num(r.n);
      if (!n) continue;
      const k = key(r.t);
      const e = plant[k] || (plant[k] = { type: r.t, days: 0, hours: 0, first: date, last: date });
      e.days += n; e.hours += n * hours(r.h); e.last = date;
      if (date < e.first) e.first = date;
      m.plant_days += n;
    }
    for (const r of matRows || []) {
      const q = num(r.q);
      if (!r.m) continue;
      const k = key(r.m);
      const e = material[k] || (material[k] = { material: r.m, unit: r.u || '', qty: 0, deliveries: 0, last: date });
      e.qty += q; e.deliveries++; e.last = date;
      if (!e.unit && r.u) e.unit = r.u;
    }
    for (const r of subRows || []) {
      if (!r.n) continue;
      const n = num(r.s) + num(r.l);
      if (!n) continue;
      subs[r.n] = (subs[r.n] || 0) + n;
      m.man_days += n;
    }
  };

  for (const d of diary) {
    daysKept.push(d.report_date);
    add(d.report_date, parse(d.staff, []), parse(d.plant, []), parse(d.materials, []), parse(d.subs, []));
  }
  for (const [date, rows] of Object.entries(extra)) {
    daysKept.push(date);
    add(date, rows, [], [], []);
  }
  daysKept.sort();

  return { labour, plant, material, subs, byMonth, daysKept };
}

/* ------------------------------------------------- what the money bought */

// Weighted percentage complete per trade, as at a date. Weighted, because a
// trade's progress is not the average of its activities — a slab is not a door
// handle. Falls back to counting activities equally where no weight is set.
export async function pctByTrade(env, pid, asOf) {
  const { results } = await env.DB.prepare(
    `SELECT COALESCE(NULLIF(a.trade,''),'(no trade)') AS trade,
            COALESCE(NULLIF(a.trade_group,''),'') AS grp,
            COUNT(*) AS activities,
            SUM(COALESCE(NULLIF(a.weight,0),1)) AS weight,
            SUM(COALESCE(u.pct,0) * COALESCE(NULLIF(a.weight,0),1)) AS earned,
            SUM(CASE WHEN COALESCE(u.pct,0) >= 100 THEN 1 ELSE 0 END) AS done
       FROM activities a
       LEFT JOIN updates u ON u.project_id = a.project_id AND u.id =
            (SELECT MAX(id) FROM updates
              WHERE project_id = a.project_id AND activity_id = a.id AND report_date <= ?)
      WHERE a.project_id = ? AND COALESCE(a.level,1) >= 1
      GROUP BY trade, grp`
  ).bind(asOf, pid).all();

  const out = {};
  for (const r of results || []) {
    out[key(r.trade)] = {
      trade: r.trade, group: r.grp,
      activities: r.activities, done: r.done,
      pct: r.weight ? (r.earned / r.weight) : 0,
    };
  }
  return out;
}

/* ------------------------------------------------------------ the answer */

export async function buildResources(env, pid, project, opts = {}) {
  const to = DATE_RE.test(opts.to || '') ? opts.to : new Date().toISOString().slice(0, 10);
  const from = DATE_RE.test(opts.from || '') ? opts.from : '2000-01-01';
  const recentFrom = shift(to, -RECENT_DAYS);

  const [all, recent, pctNow, pctThen, rates] = await Promise.all([
    spend(env, pid, project, from, to),
    spend(env, pid, project, recentFrom, to),
    pctByTrade(env, pid, to),
    pctByTrade(env, pid, recentFrom),
    loadRates(env, pid),
  ]);

  // Which trades are on site without putting work in place. Falls back to the
  // standard roster: a project that has never edited its roster still has a
  // site engineer and a watchman, and counting them as production would make
  // every per-point figure wrong.
  const roster = parse(project && project.diary_trades, null) || DEFAULT_TRADES;
  const indirect = new Set(roster.filter((x) => x.indirect).map((x) => key(x.t)));

  /* ---- labour */
  const byTrade = Object.entries(all.labour).map(([k, e]) => {
    const rate = rateFor(rates, 'labour', e.trade);
    const p = pctNow[k];
    const was = pctThen[k];
    const r = recent.labour[k];
    const gained = p && was ? p.pct - was.pct : null;

    return {
      trade: e.trade,
      group: p ? p.group : '',
      indirect: indirect.has(k),
      man_days: e.days,
      man_hours: Math.round(e.hours),
      first: e.first, last: e.last,
      cost: rate ? e.days * rate : null,
      rate: rate || null,

      // Only where the programme knows this trade. Unmatched trades are listed
      // separately rather than being given a percentage they do not have.
      in_programme: !!p,
      pct: p ? p.pct : null,
      activities: p ? p.activities : null,
      done: p ? p.done : null,

      // The figure this whole file exists for.
      per_point: p && p.pct > 0 ? e.days / p.pct : null,
      projected: p && p.pct > 0 ? e.days / (p.pct / 100) : null,
      recent_days: r ? r.days : 0,
      recent_per_point: gained && gained > 0.5 && r ? r.days / gained : null,
    };
  }).sort((a, b) => b.man_days - a.man_days);

  for (const t of byTrade) {
    // "Slower than it has been" — and only said where both figures are real.
    t.trend = (t.per_point && t.recent_per_point)
      ? (t.recent_per_point > t.per_point * 1.25 ? 'worse'
        : t.recent_per_point < t.per_point * 0.8 ? 'better' : 'steady')
      : null;
  }

  const sum = (list, f) => list.reduce((s, x) => s + (f(x) || 0), 0);
  const subMen = Object.entries(all.subs)
    .map(([name, days]) => ({ name, man_days: days }))
    .sort((a, b) => b.man_days - a.man_days);

  /* ---- plant */
  const byPlant = Object.entries(all.plant).map(([k, e]) => {
    const rate = rateFor(rates, 'plant', e.type);
    return {
      type: e.type, plant_days: e.days, plant_hours: Math.round(e.hours),
      first: e.first, last: e.last,
      rate: rate || null, cost: rate ? e.days * rate : null,
      recent_days: recent.plant[k] ? recent.plant[k].days : 0,
    };
  }).sort((a, b) => b.plant_days - a.plant_days);

  /* ---- materials */
  const listed = new Map(projectMaterials(project).map((m) => [key(m.m), m]));
  const byMaterial = Object.entries(all.material).map(([k, e]) => {
    const on = listed.get(k);
    const rate = rateFor(rates, 'material', e.material);
    return {
      material: on ? on.m : e.material,
      unit: e.unit || (on ? on.u : ''),
      qty: e.qty, deliveries: e.deliveries, last: e.last,
      listed: !!on,
      rate: rate || null, cost: rate ? e.qty * rate : null,
    };
  }).sort((a, b) => (b.cost || 0) - (a.cost || 0) || b.qty - a.qty);

  /* ---- what this cannot tell you */
  const warn = [];
  const kept = new Set(all.daysKept);
  const firstDay = all.daysKept[0];
  if (firstDay) {
    // Counting the missing days is not enough to act on. One long stretch is a
    // period nobody recorded — worth chasing. A day here and there is Fridays.
    let missing = 0, run = 0, worst = null, runFrom = null;
    for (let d = day0(firstDay); d <= day0(to); d++) {
      if (kept.has(dstr(d))) { run = 0; runFrom = null; continue; }
      missing++;
      if (!runFrom) runFrom = dstr(d);
      run++;
      if (!worst || run > worst.days) worst = { days: run, from: runFrom, to: dstr(d) };
    }
    if (missing) {
      warn.push(`${missing} day${missing === 1 ? '' : 's'} between ${firstDay} and ${to} have no record ` +
        `at all. Whatever was spent on those days is not in these figures.` +
        (worst && worst.days > 6
          ? ` The longest stretch is ${worst.days} days, ${worst.from} to ${worst.to}.`
          : ''));
    }
  } else {
    warn.push('No diary or manpower has been recorded yet, so there is nothing to total.');
  }

  const unmatched = byTrade.filter((t) => !t.in_programme && !t.indirect);
  if (unmatched.length) {
    const one = unmatched.length === 1;
    warn.push(`${unmatched.length} trade${one ? '' : 's'} on the diary ` +
      `(${unmatched.slice(0, 4).map((t) => t.trade).join(', ')}${unmatched.length > 4 ? '…' : ''}) ` +
      `${one ? 'does' : 'do'} not match any trade in the programme, so ${one ? 'its' : 'their'} ` +
      `labour is counted in the total but cannot be set against progress.`);
  }

  const idle = byTrade.filter((t) => t.in_programme && t.recent_days > 0 &&
    pctThen[key(t.trade)] && t.pct !== null && (t.pct - pctThen[key(t.trade)].pct) <= 0.01);
  if (idle.length) {
    warn.push(`${idle.map((t) => t.trade).join(', ')} logged labour in the last ${RECENT_DAYS} days ` +
      `with no progress reported against ${idle.length === 1 ? 'it' : 'them'}. Either the work is not ` +
      `being reported, or the men are not producing.`);
  }

  const unlisted = byMaterial.filter((m) => !m.listed);
  if (unlisted.length) {
    warn.push(`${unlisted.length} material${unlisted.length === 1 ? '' : 's'} delivered ` +
      `${unlisted.length === 1 ? 'is' : 'are'} not on the project's material list, so ` +
      `${unlisted.length === 1 ? 'its total' : 'their totals'} may be split across spellings. ` +
      `Add them in Admin.`);
  }

  const priced = rates !== null;
  if (!priced) {
    warn.push('Rates have not been set up on this database yet, so every figure here is a quantity.');
  } else {
    const noRate = byTrade.filter((t) => t.man_days > 0 && !t.rate).length;
    if (noRate) warn.push(`${noRate} trade${noRate === 1 ? ' has' : 's have'} no day-rate set, ` +
      `so ${noRate === 1 ? 'its' : 'their'} labour is not in the money column.`);
  }

  const manDays = sum(byTrade, (t) => t.man_days);
  const subDays = sum(subMen, (s) => s.man_days);

  return {
    generated_at: new Date().toISOString(),
    from: firstDay || from, to, recent_days: RECENT_DAYS,
    currency: (project && project.currency) || 'AED',
    priced,
    days_recorded: all.daysKept.length,

    labour: {
      man_days: manDays,
      man_hours: sum(byTrade, (t) => t.man_hours),
      direct_man_days: sum(byTrade.filter((t) => !t.indirect), (t) => t.man_days),
      indirect_man_days: sum(byTrade.filter((t) => t.indirect), (t) => t.man_days),
      sub_man_days: subDays,
      total_man_days: manDays + subDays,
      cost: sum(byTrade, (t) => t.cost),
      by_trade: byTrade,
      subcontractors: subMen,
    },
    plant: {
      plant_days: sum(byPlant, (p) => p.plant_days),
      plant_hours: sum(byPlant, (p) => p.plant_hours),
      cost: sum(byPlant, (p) => p.cost),
      by_type: byPlant,
    },
    materials: {
      deliveries: sum(byMaterial, (m) => m.deliveries),
      items: byMaterial.length,
      cost: sum(byMaterial, (m) => m.cost),
      by_item: byMaterial,
    },
    months: Object.values(all.byMonth).sort((a, b) => a.month.localeCompare(b.month)),
    warnings: warn,
  };
}

// Money is a separate permission from quantities. Stripping it here rather than
// in the page means a curious person reading the network traffic learns nothing.
export function withoutMoney(d) {
  if (!d) return d;
  const strip = (o) => { const c = { ...o }; delete c.cost; delete c.rate;
    delete c.projected_cost; return c; };
  return {
    ...d,
    priced: false,
    labour: { ...strip(d.labour), by_trade: d.labour.by_trade.map(strip),
              subcontractors: d.labour.subcontractors },
    plant: { ...strip(d.plant), by_type: d.plant.by_type.map(strip) },
    materials: { ...strip(d.materials), by_item: d.materials.by_item.map(strip) },
    warnings: d.warnings.filter((w) => !/rate/i.test(w)),
  };
}
