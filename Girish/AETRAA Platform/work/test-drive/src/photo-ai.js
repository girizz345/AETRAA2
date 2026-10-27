// Diary photographs: a caption, the activity and the location, proposed by
// AI for a person to confirm (v5 A12; Ajay, 6 Oct 2026, decision 2).
//
// Spec §6 links a photo to an activity only where the folder or file name says
// which. Ajay decided the AI may suggest it instead, provided a person
// confirms: so the reading is kept beside the photo (ai_caption,
// ai_activity_id, ai_location) and nothing reaches the photo's own caption,
// activity or location until Document Control or the assigned person confirms
// or corrects it. The activity can only be one on this project's programme
// that is live around the day; anything else the AI names is dropped.

import { callModel, aiEnabled, AI_OFF_MESSAGE } from './ai.js';
import { addColumns } from './db-cols.js';
import { photoBytes, ensurePhotoColumns } from './photos.js';
import { firstJson } from './ai-readers.js';

const clean = (s, n = 200) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const SURE = (v) => (['high', 'medium', 'low'].includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : 'low');
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

let COLS = false;
export async function ensurePhotoAiColumns(env) {
  await ensurePhotoColumns(env);
  if (!COLS) COLS = await addColumns(env, 'photos', [['location', 'TEXT'], ['ai_caption', 'TEXT'], ['ai_activity_id', 'TEXT'],
    ['ai_location', 'TEXT'], ['ai_sure', 'TEXT'], ['ai_model', 'TEXT'], ['ai_state', 'TEXT'], ['confirmed_by', 'TEXT'], ['confirmed_at', 'TEXT']]);
  return COLS;
}

// The activities a photo on `day` can be of: started and not finished, or
// planned to run within a week either side. At most 80, by programme order.
export async function liveActivities(env, pid, day) {
  const from = addDays(day, -7), to = addDays(day, 7);
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, name, floor, trade FROM activities WHERE project_id = ? AND COALESCE(level, 1) > 0
          AND ((actual_start IS NOT NULL AND actual_start <> '' AND (actual_finish IS NULL OR actual_finish = '' OR actual_finish >= ?))
            OR (planned_start <= ? AND planned_finish >= ?))
        ORDER BY sort_order, id LIMIT 80`).bind(pid, from, to, from).all();
    return results || [];
  } catch (e) { return []; }
}

const SYSTEM = 'You caption construction site photographs for a contractor\'s site diary. A person checks every caption, activity '
  + 'and location before it is used. Describe only what the photograph shows; never guess quantities, progress percentages or names. '
  + 'Answer with JSON only.';
export function photoPrompt(acts, hint) {
  return 'Give this site photograph:\n'
    + '- caption: one short line saying what work the photo shows (for example "Rebar fixing to level 3 slab, bay C-D")\n'
    + '- activity_id: the ID of the one activity below that the photo shows, or "" if none fits or you cannot tell\n'
    + '- location: where on site, only if the photo or its note shows it (level, zone, grid), else ""\n'
    + '- sure: "high", "medium" or "low" for the activity\n'
    + (hint ? 'The note sent with the photo: "' + clean(hint, 200) + '"\n' : '')
    + 'Activities on the programme around this day:\n'
    + (acts.length ? acts.map((a) => a.id + ' | ' + clean(a.name, 120) + (a.floor ? ' | ' + a.floor : '') + (a.trade ? ' | ' + a.trade : '')).join('\n') : '(none)')
    + '\nAnswer with JSON only: {"caption":"","activity_id":"","location":"","sure":"low"}';
}

// The model's answer, checked: an activity not in the list is dropped.
export function parsePhoto(text, acts) {
  const j = firstJson(text);
  if (!j || typeof j !== 'object') return null;
  const id = clean(j.activity_id, 60);
  const hit = (acts || []).find((a) => String(a.id) === id);
  return { caption: clean(j.caption, 200), activity_id: hit ? hit.id : '', activity_name: hit ? hit.name : '', location: clean(j.location, 120),
    sure: hit ? SURE(j.sure) : 'low', ...(id && !hit ? { dropped: id } : {}) };
}

// Propose for the day's photos that have no confirmed caption yet, a few at a time.
export async function suggestPhotos(env, pid, day, opts = {}) {
  if (!aiEnabled(env)) return { error: AI_OFF_MESSAGE, disabled: true };
  await ensurePhotoAiColumns(env);
  const { results } = await env.DB.prepare(
    `SELECT * FROM photos WHERE project_id = ? AND report_date = ? AND COALESCE(ai_state, '') NOT IN ('confirmed', 'proposed')
      ORDER BY created_at LIMIT ?`).bind(pid, day, Math.max(1, Math.min(Number(opts.limit) || 6, 12))).all();
  const acts = await liveActivities(env, pid, day);
  const out = [];
  for (const row of results || []) {
    const ph = await photoBytes(env, row);
    if (!ph || !ph.bytes || !ph.bytes.length) { out.push({ id: row.id, error: 'the photo could not be read back' }); continue; }
    const media = /png/.test(ph.mime || row.mime || '') ? 'image/png' : /webp/.test(ph.mime || row.mime || '') ? 'image/webp' : 'image/jpeg';
    const ans = await callModel(env, { task: 'a12-photo', system: SYSTEM, prompt: photoPrompt(acts, row.caption), documents: [{ bytes: ph.bytes, media_type: media }],
      max_tokens: 400, temperature: 0, project_id: pid, who: opts.who || '' });
    if (ans.error) { out.push({ id: row.id, error: ans.error }); if (ans.disabled) break; continue; }
    const s = parsePhoto(ans.text, acts);
    if (!s) { out.push({ id: row.id, error: 'the answer could not be read' }); continue; }
    await env.DB.prepare(`UPDATE photos SET ai_caption = ?, ai_activity_id = ?, ai_location = ?, ai_sure = ?, ai_model = ?, ai_state = 'proposed' WHERE project_id = ? AND id = ?`)
      .bind(s.caption, s.activity_id || null, s.location, s.sure, ans.model || '', pid, row.id).run();
    out.push({ id: row.id, ...s });
  }
  const left = await env.DB.prepare(`SELECT COUNT(*) AS n FROM photos WHERE project_id = ? AND report_date = ? AND COALESCE(ai_state, '') NOT IN ('confirmed', 'proposed')`).bind(pid, day).first();
  return { ok: true, read: out.filter((x) => !x.error).length, results: out, remaining: Number(left && left.n) || 0 };
}

// The day's photos, with what the AI proposed and what was confirmed.
export async function dayPhotos(env, pid, day) {
  await ensurePhotoAiColumns(env);
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.caption, p.activity_id, p.location, p.created_at, p.submitted_by, p.ai_caption, p.ai_activity_id, p.ai_location, p.ai_sure, p.ai_model, p.ai_state,
            p.confirmed_by, a.name AS activity_name, b.name AS ai_activity_name
       FROM photos p LEFT JOIN activities a ON a.project_id = p.project_id AND a.id = p.activity_id
                     LEFT JOIN activities b ON b.project_id = p.project_id AND b.id = p.ai_activity_id
      WHERE p.project_id = ? AND p.report_date = ? ORDER BY p.created_at LIMIT 48`).bind(pid, day).all();
  return { photos: results || [], activities: await liveActivities(env, pid, day) };
}

// A person's word: the caption, activity and location they confirm (typed over
// the proposal where they changed it), or "not right" — the proposal set aside.
export async function confirmPhoto(env, pid, body, who) {
  await ensurePhotoAiColumns(env);
  const row = await env.DB.prepare('SELECT * FROM photos WHERE project_id = ? AND id = ?').bind(pid, clean(body.id, 60)).first();
  if (!row) return { error: 'no such photo on this project', status: 404 };
  const at = new Date().toISOString();
  if (body.reject) {
    await env.DB.prepare(`UPDATE photos SET ai_state = 'rejected', confirmed_by = ?, confirmed_at = ? WHERE project_id = ? AND id = ?`).bind(clean(who, 120), at, pid, row.id).run();
    return { ok: true, state: 'rejected' };
  }
  let actId = clean(body.activity_id, 60);
  if (actId) {
    const a = await env.DB.prepare('SELECT id FROM activities WHERE project_id = ? AND id = ?').bind(pid, actId).first().catch(() => null);
    if (!a) return { error: actId + ' is not an activity on this project’s programme.', status: 400 };
  }
  const caption = clean(body.caption, 300);
  if (!caption) return { error: 'Give the photo a caption.', status: 400 };
  await env.DB.prepare(`UPDATE photos SET caption = ?, activity_id = ?, location = ?, ai_state = 'confirmed', confirmed_by = ?, confirmed_at = ? WHERE project_id = ? AND id = ?`)
    .bind(caption, actId || null, clean(body.location, 120) || null, clean(who, 120), at, pid, row.id).run();
  return { ok: true, state: 'confirmed' };
}
