// K13 (A12) · v5 A12: THE SITE DIARY — prepared by Document Control or the
// person the PM assigns, typed or from a scanned site sheet (no voice).
//
//   1 The person preparing it types the day's notes, or adds the scanned site
//     sheet. The AI prepares the diary — weather, manpower by trade, plant,
//     materials received, visitors, problems, tomorrow's plan — into the day's
//     diary on screen. Nothing is saved until the person saves, and only the
//     PM submits (as before).
//   2 What the AI gives is put on the project's own roster by rule: a trade,
//     a machine or a material is matched to the roster's name or kept as
//     written and listed for the person to check. A figure that is not a
//     number is left out and said so.
//   3 At 6 pm, if the day's diary is not saved, the assigned person is told
//     (Document Control where nobody is assigned); the next morning, if it is
//     still not saved, the PM is told. Each once (K3's notify log).
//
// What the AI must never do (v5 A12): save, submit or send the diary.

import { callModel, aiEnabled, AI_OFF_MESSAGE } from './ai.js';
import { firstJson } from './ai-readers.js';
import { letterText } from './correspondence.js';
import { addColumns } from './db-cols.js';
import { WEATHER, totals, sumSubs } from './diary.js';
import { offDays } from './diary-checks.js';
import { once } from './alerts.js';

export const DIARY_PROMPT = 'a12-1';
const clean = (s, n = 300) => String(s == null ? '' : s).replace(/[ \t]+/g, ' ').trim().slice(0, n);
const low = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const shift = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The project's diary assignee (projects.diary_assignee, a person's id).
let A12_READY = false;
export async function ensureDiaryA12(env) {
  if (A12_READY) return true;
  const a = await addColumns(env, 'projects', [['diary_assignee', 'TEXT']]);
  A12_READY = !!a;
  return A12_READY;
}

/* ------------------------------------------------------------ the AI's draft */

const SYSTEM = 'You prepare the daily site diary of a construction project from the site engineer\'s typed notes or a scanned site sheet, '
  + 'for the person preparing the diary, who checks every line before it is saved. Use only what the notes or the sheet say: never invent '
  + 'a number, a trade, a machine, a delivery, a visitor or a problem, and leave out anything they do not state. Answer with JSON only.';
const SHAPE = '{"weather":[""],"manpower":[{"trade":"","count":0,"hours":""}],"subcontractors":[{"name":"","trade":"","count":0,"hours":""}],'
  + '"plant":[{"item":"","count":0,"hours":""}],"materials":[{"material":"","quantity":"","unit":"","supplier":""}],'
  + '"visitors":"","problems":"","tomorrow":[{"activity":"","quantity":""}],"remarks":""}';
export function diaryPrompt(roster) {
  const r = roster || {};
  return 'These are the notes of one day on site. Prepare the day\'s diary: the weather (one or more of ' + WEATHER.join(', ') + '), '
    + 'our own manpower by trade with the number of men (and their hours if given), subcontractor gangs, plant and equipment on site, '
    + 'materials received, visitors, problems (anything that held the work up or needs the office), and the work planned for tomorrow. '
    + 'Do not describe the work done today against activities and give no progress percentages. '
    + ((r.trades || []).length ? 'The trades on this project\'s roster: ' + r.trades.map((x) => x.t).join(', ') + '. ' : '')
    + ((r.plant || []).length ? 'The plant on the roster: ' + r.plant.map((x) => x.t).join(', ') + '. ' : '')
    + 'Use the roster\'s name where the notes mean the same thing; otherwise write the name as the notes do. '
    + 'Answer with JSON only, in this shape:\n' + SHAPE;
}

// One of the roster's names for what was written, or null. Exact (ignoring
// case and punctuation), then a plural, then the one roster name the words
// contain or are contained in. Two candidates is no match.
export function rosterName(raw, names) {
  const t = low(raw);
  if (!t) return null;
  const list = (names || []).filter(Boolean);
  const hit = list.find((n) => low(n) === t) || list.find((n) => low(n).replace(/s$/, '') === t.replace(/s$/, ''));
  if (hit) return hit;
  const near = list.filter((n) => { const l = low(n); return l.length > 2 && (t.includes(l) || l.includes(t)); });
  return near.length === 1 ? near[0] : null;
}

const count = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && /\d/.test(String(v)) && n >= 0 && n < 100000 ? Math.round(n) : null;
};
const hours = (v) => { const s = String(v == null ? '' : v).replace(/[^\d.]/g, ''); return s && Number.isFinite(Number(s)) && Number(s) <= 24 ? s : ''; };

// The model's diary, on the project's roster. `notes` lists what the person
// must look at: names not on the roster, figures that were not numbers.
export function shapeDiary(j, roster) {
  if (!j || typeof j !== 'object') return null;
  const r = roster || {};
  const notes = [];
  const arr = (v) => (Array.isArray(v) ? v : []);

  const wx = [];
  for (const w of arr(j.weather).concat(typeof j.weather === 'string' ? String(j.weather).split(/[,/]| and /) : [])) {
    const k = WEATHER.find((x) => low(x) === low(w));
    if (k && !wx.includes(k)) wx.push(k);
    else if (!k && clean(w)) notes.push('The weather “' + clean(w, 40) + '” is not one of ' + WEATHER.join(', ') + ' — pick it.');
  }

  const lines = (list, names, label) => {
    const out = [];
    for (const x of arr(list).slice(0, 80)) {
      const said = clean(x && (x.trade || x.item || x.name), 120);
      if (!said) continue;
      const n = count(x && x.count);
      if (n === null) { notes.push(label + ' “' + said + '”: the number “' + clean(x && x.count, 20) + '” is not a number — enter it.'); continue; }
      const name = rosterName(said, names);
      if (!name) notes.push(label + ' “' + said + '” is not on the project\'s roster — it is added as written; check it.');
      const t = name || said;
      const have = out.find((o) => o.t === t);
      if (have) have.n += n; else out.push({ t, n, h: hours(x && x.hours) });
    }
    return out;
  };
  const staff = lines(j.manpower, (r.trades || []).map((x) => x.t), 'Trade');
  const plant = lines(j.plant, (r.plant || []).map((x) => x.t), 'Plant');

  const subs = [];
  for (const s of arr(j.subcontractors).slice(0, 40)) {
    const name = clean(s && s.name, 160);
    if (!name) continue;
    const n = count(s && s.count);
    if (n === null) { notes.push('Subcontractor “' + name + '”: the number is not a number — enter it.'); continue; }
    subs.push({ n: rosterName(name, r.subcontractors || []) || name, t: clean(s && s.trade, 120), p: '', c: String(n), h: hours(s && s.hours) });
  }

  const mats = [];
  for (const m of arr(j.materials).slice(0, 60)) {
    const said = clean(m && m.material, 160);
    if (!said) continue;
    const known = (r.materials || []).find((x) => x.m === rosterName(said, (r.materials || []).map((y) => y.m)));
    const unit = clean(m && m.unit, 24);
    if (known && unit && low(unit) !== low(known.u)) notes.push('“' + said + '” was given in ' + unit + '; the project measures ' + known.m + ' in ' + known.u + ' — check the quantity.');
    mats.push({ m: known ? known.m : said, q: clean(m && m.quantity, 24), u: known ? known.u : unit, ...(clean(m && m.supplier) ? { s: clean(m.supplier, 120) } : {}), src: 'ai' });
  }

  const tomorrow = arr(j.tomorrow).slice(0, 40).map((t) => ({ a: clean(t && t.activity, 400), q: clean(t && t.quantity, 16) })).filter((t) => t.a);
  return {
    weather: wx.join(', '), staff, plant, subs, materials: mats, tomorrow,
    visitors: clean(j.visitors, 1000), problems: clean(j.problems, 3000), remarks: clean(j.remarks, 3000), notes,
  };
}

// The draft laid over the day's diary as it stands on screen. Given manpower
// replaces the day's figures (a trade the notes do not give is 0); given plant
// likewise; materials are added after those already there (delivery notes);
// text fields are filled, or added to on a new line. Nothing is stored.
export function applyDraft(d, draft, roster) {
  const out = JSON.parse(JSON.stringify(d || {}));
  const g = draft || {};
  const merge = (cur, given) => {
    if (!given.length) return cur || [];
    const byT = Object.fromEntries(given.map((x) => [x.t, x]));
    const rows = (cur || []).map((x) => (byT[x.t] ? { t: x.t, n: byT[x.t].n, h: byT[x.t].h || x.h || '' } : { t: x.t, n: 0, h: '' }));
    for (const x of given) if (!rows.some((y) => y.t === x.t)) rows.push({ t: x.t, n: x.n, h: x.h || '' });
    return rows;
  };
  if (g.weather) out.weather = g.weather;
  out.staff = merge(out.staff, g.staff || []);
  out.plant = merge(out.plant, g.plant || []);
  if ((g.subs || []).length) out.subs = g.subs;
  if ((g.materials || []).length) out.materials = (out.materials || []).concat(g.materials);
  if ((g.tomorrow || []).length) out.tomorrow = g.tomorrow;
  for (const k of ['visitors', 'problems', 'remarks']) {
    if (!g[k]) continue;
    const had = String(out[k] || '').trim();
    out[k] = had && !had.includes(g[k]) ? had + '\n' + g[k] : g[k];
  }
  const trades = (roster && roster.trades) || (out.roster && out.roster.trades) || [];
  out.totals = totals(out.staff, trades);
  out.subTotal = sumSubs(out.subs || []);
  out.ai_prepared = true;
  return out;
}

// Step 1: the AI's draft — returned to the screen, never saved.
export async function draftDiary(env, pid, input, ctx) {
  if (!aiEnabled(env)) return { error: AI_OFF_MESSAGE, disabled: true };
  const docs = [];
  let text = String(input.notes || '').trim().slice(0, 20000);
  if (input.file && input.file.bytes && input.file.bytes.length) {
    const t = await letterText(input.file.bytes, input.file.filename);
    if (!t.format || t.format === 'msg' || t.format === 'eml') return { error: 'Give the site sheet as a PDF, Word, text file or a photo (PNG, JPEG).' };
    if (t.scan) docs.push({ bytes: input.file.bytes, media_type: t.format === 'pdf' ? 'application/pdf' : t.format === 'png' ? 'image/png' : 'image/jpeg' });
    else text = (text ? text + '\n\n' : '') + t.text.slice(0, 30000);
  }
  if (!text && !docs.length) return { error: 'Type the day\'s notes, or add the scanned site sheet.' };
  const ans = await callModel(env, { task: 'a12-diary', system: SYSTEM,
    prompt: (text ? 'The notes:\n"""\n' + text + '\n"""\n\n' : '') + diaryPrompt(ctx.roster), documents: docs,
    max_tokens: 4000, temperature: 0, project_id: pid, who: ctx.who });
  if (ans.error) return { error: ans.error, disabled: !!ans.disabled };
  const draft = shapeDiary(firstJson(ans.text), ctx.roster);
  if (!draft) return { error: 'The model’s answer could not be read — nothing was changed; fill the diary by hand.' };
  return { ok: true, draft, model: ans.model, from: docs.length ? 'the scanned sheet' : 'the notes' };
}

/* ------------------------------------------------------------ the reminders */

// Is `day` a diary day on this project? A working day, on or after the day the
// project came onto the platform, on a live project with the Site module on.
function diaryDay(project, day, mods) {
  if (!project || Number(project.archived || 0)) return false;
  if ((project.setup_state || 'live') === 'draft') return false;
  if (mods && !mods.includes('site')) return false;
  const started = String(project.created_at || '').slice(0, 10);
  if (started && day < started) return false;
  return !offDays(project).includes(dow(day));
}
const longDay = (d) => DAYS[dow(d)] + ' ' + Number(d.slice(8)) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(d.slice(5, 7)) - 1] + ' ' + d.slice(0, 4);

// Who prepares the diary: the person the PM assigned, if still on the
// project; otherwise Document Control.
export function preparersOf(project, team) {
  const t = team || [];
  const a = project && project.diary_assignee ? t.find((u) => u.id === project.diary_assignee) : null;
  if (a) return { assigned: true, people: [a] };
  return { assigned: false, people: t.filter((u) => (u.functions || []).includes('dc')) };
}

// which = 'evening' (6 pm: today's diary not saved, to the preparer) or
// 'morning' (yesterday's still not saved, to the PM). `today` is the UAE day.
//   teamOf(project) → [{ id, name, email, functions }]
//   modsOf(project) → the project's modules, or null for all
//   mailer(to[], subject, html)
export async function runDiaryReminders(env, today, which, { teamOf, modsOf, mailer, publicUrl }) {
  await ensureDiaryA12(env);
  const day = which === 'morning' ? shift(today, -1) : today;
  let projects = [];
  try { projects = (await env.DB.prepare('SELECT * FROM projects WHERE COALESCE(archived, 0) = 0').all()).results || []; }
  catch (e) { return [{ ok: false, error: 'no projects' }]; }
  const out = [];
  for (const p of projects) {
    const mods = modsOf ? await modsOf(p).catch(() => null) : null;
    if (!diaryDay(p, day, mods)) continue;
    const row = await env.DB.prepare('SELECT status FROM diary WHERE project_id = ? AND report_date = ?').bind(p.id, day).first().catch(() => null);
    if (row) continue;                                   // saved (a draft counts)
    const team = (await teamOf(p).catch(() => [])) || [];
    const prep = preparersOf(p, team);
    const link = (publicUrl || '') + '/diary?date=' + day;
    let to, subject, html;
    if (which === 'evening') {
      to = prep.people.filter((u) => u.email).map((u) => u.email);
      subject = (p.name || 'Project') + ' — the site diary for today (' + longDay(day) + ') is not saved';
      html = '<p>The site diary for <b>' + esc(longDay(day)) + '</b> on ' + esc(p.name || 'the project') + ' has not been saved yet. '
        + (prep.assigned ? 'The Project Manager has named you to prepare it.' : 'Document Control prepares it on this project.') + '</p>'
        + '<p>Open it: <a href="' + esc(link) + '">' + esc(link) + '</a>. Save it as a draft; the Project Manager submits it.</p>';
    } else {
      to = team.filter((u) => u.email && (u.functions || []).includes('pm')).map((u) => u.email);
      const who = prep.people.map((u) => u.name).filter(Boolean).join(', ');
      subject = (p.name || 'Project') + ' — no site diary was saved for ' + longDay(day);
      html = '<p>No site diary was saved for <b>' + esc(longDay(day)) + '</b> on ' + esc(p.name || 'the project') + '.</p>'
        + '<p>' + (who ? (prep.assigned ? 'Assigned to prepare it: ' : 'Document Control: ') + esc(who) + '. ' : 'Nobody is named to prepare it — assign someone on the diary page. ')
        + 'Open it: <a href="' + esc(link) + '">' + esc(link) + '</a>.</p>';
    }
    if (!to.length) { out.push({ project: p.id, day, skipped: which === 'evening' ? 'nobody named to prepare the diary has an email' : 'no PM with an email on the project' }); continue; }
    const r = await once(env, which === 'evening' ? 'diary-6pm' : 'diary-next-morning', p.id, day, subject, () => mailer(to, subject, html));
    out.push({ project: p.id, day, to, ...r });
  }
  return out;
}
