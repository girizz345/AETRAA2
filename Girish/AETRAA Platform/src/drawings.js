// The drawing register, and the link from an activity to the sheet it is built from.
//
// A shared folder of PDFs is not a register. What makes it one is that it can
// say which revision is the live one — so a man on a slab opening a drawing from
// his activity gets Rev C and cannot reach Rev B by accident, while Rev B stays
// readable for the record, stamped as superseded.
//
// Attaching 4,277 activities to drawings by hand is not work anybody will do. So
// a drawing is tagged once with its trade and its floor, and it appears against
// every activity that matches. A blank tag means "applies to everything" — which
// is how a specification section behaves, and how a general arrangement does.
// Where the rule is wrong, a drawing can be pinned to one activity, and a pin
// always wins.
//
// Storage is behind one seam. Today the bytes sit in the database, which is fine
// for trying it out and hopeless for a real set; moving to object storage means
// changing putFile and getFile and nothing else.

import { checkIncoming, prefixOf } from './gate.js';
import { hold } from './quarantine.js';

export const KINDS = ['tender', 'ifc', 'shop', 'spec', 'sketch', 'other'];
export const KIND_LABEL = {
  tender: 'Tender drawing', ifc: 'IFC drawing', shop: 'Shop drawing',
  spec: 'Specification', sketch: 'Sketch / SK', other: 'Other',
};

// D1 caps a single value at 2 MB, and base64 adds a third. This is the honest
// ceiling for keeping files in the database, and the reason it is a testing
// arrangement rather than a permanent one.
export const MAX_BYTES = 1_400_000;

const nowISO = () => new Date().toISOString();
const id = () => 'dwg_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
const clean = (v, max = 200) => String(v === null || v === undefined ? '' : v).trim().slice(0, max);

// Trade and floor names come off the P6 codes on one side and off a title block
// on the other. Matched on a flattened form so "Level 02" and "level-02" are one
// floor.
export const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/* ------------------------------------------------------------ the register */

export async function listDrawings(env, pid, opts = {}) {
  try {
    const where = ['project_id = ?'];
    const args = [pid];
    if (opts.status) { where.push('status = ?'); args.push(opts.status); }
    if (opts.kind) { where.push('kind = ?'); args.push(opts.kind); }
    const { results } = await env.DB.prepare(
      `SELECT id, number, revision, title, kind, discipline, trade, trade_group, floor,
              status, superseded_by, mime, size, url, uploaded_by, uploaded_at,
              approved_by, approved_at, reject_note,
              CASE WHEN data IS NULL AND r2_key IS NULL THEN 0 ELSE 1 END AS has_file
         FROM drawings WHERE ${where.join(' AND ')}
        ORDER BY number, revision DESC`
    ).bind(...args).all();
    return results || [];
  } catch (err) {
    return null;                       // not migrated
  }
}

export async function getDrawing(env, pid, did) {
  try {
    return await env.DB.prepare('SELECT * FROM drawings WHERE project_id = ? AND id = ?')
      .bind(pid, String(did)).first();
  } catch (err) {
    return null;
  }
}

// Saving a drawing.
//
// Who is saving it decides what happens. A PM (opts.canApprove) puts a sheet
// straight onto the register as the live one, retiring whatever it replaces in
// the same breath — the PM is the approver, so there is no second step. A
// discipline engineer's upload lands as PENDING: it is on the register for all
// to see, but it retires nothing and reaches no activity until the PM approves
// it. That is the whole point of the gate — the sheet on site never moves under
// anybody's feet without the PM's sign-off.
//
// The lock: once a sheet is approved (current or superseded), only a PM may
// change it. A pending or rejected sheet may be corrected by the engineer who
// uploaded it, or by a PM.
export async function saveDrawing(env, pid, body, who, opts = {}) {
  const canApprove = opts.canApprove !== false;   // absent = PM path (keeps callers without opts working)
  let unverified = false;                         // filed, but the gate had nothing to check it against
  const number = clean(body.number, 60);
  if (!number) return { error: 'a drawing needs its number' };
  const revision = clean(body.revision, 12);
  const kind = KINDS.includes(body.kind) ? body.kind : 'shop';

  const data = typeof body.data === 'string' ? body.data : null;
  const url = clean(body.url, 600);
  // A sheet already sitting in object storage: the register row just names the
  // key, and the file itself never touches the database.
  const r2key = clean(body.r2_key, 300) || null;
  if (data) {
    if (!/^data:[\w.+-]+\/[\w.+-]+;base64,/.test(data)) {
      return { error: 'that file did not arrive in a form the app can store' };
    }
    if (data.length > MAX_BYTES) {
      return { error: `that file is too large to keep in the database — ${Math.round(data.length / 1024)} KB, ` +
                      `and the limit is ${Math.round(MAX_BYTES / 1024)} KB. Link to it instead, or move the ` +
                      `register to object storage.` };
    }
  }
  if (!data && !url && !r2key && !body.id) return { error: 'upload a file, or give a link to one' };

  // ---- THE GATE ---------------------------------------------------------
  //
  // Here, and not beside the bulk loader, because EVERY route to this register
  // comes through this function — the single upload screen, a bulk drop, and
  // whatever is written next. A gate placed anywhere else is one an importer
  // can decline to ask.
  //
  // Only a NEW sheet is checked. Editing a row already in the register is not
  // an import, and re-checking it would hold work that was let in months ago.
  if (!body.id && opts.project && opts.gate !== false) {
    const g = checkIncoming(opts.project, {
      kind: 'drawing', number, filename: clean(body.filename, 300) || number,
    });
    if (g.verdict === 'conflict') {
      const held = await hold(env, pid, {
        org_id: opts.project.org_id, kind: 'drawing',
        filename: clean(body.filename, 300) || number,
        number, prefix: prefixOf(number),
        reason: g.reason, evidence: g.evidence,
        payload: body,
      }, who);
      if (held.error) return { error: held.error };
      // Not an error: it was received, it is visible, and it is with AETRAA.
      return { ok: true, held: true, quarantine_id: held.id, number, reason: g.reason };
    }
    unverified = g.verdict === 'unknown';
  }

  // The live revision of this number, if any — what a new approved revision
  // would retire. A pending upload does not touch it.
  const existing = await env.DB.prepare(
    `SELECT id, revision FROM drawings WHERE project_id = ? AND number = ? AND status = 'current'`
  ).bind(pid, number).first();

  const row = {
    number,
    revision,
    title: clean(body.title, 300),
    kind,
    discipline: clean(body.discipline, 80),
    trade: clean(body.trade, 120),
    trade_group: clean(body.trade_group, 60),
    floor: clean(body.floor, 120),
    mime: data ? data.slice(5, data.indexOf(';')) : clean(body.mime, 80),
    size: data ? data.length : (Number(body.size) || null),
    url: url || null,
    r2_key: r2key,
  };

  if (body.id) {
    const cur = await getDrawing(env, pid, body.id);
    if (!cur) return { error: 'unknown drawing' };
    // The lock. An approved sheet — live or superseded — is the PM's to change.
    // A pending or rejected one belongs to the engineer who uploaded it until it
    // is approved.
    const approvedLineage = cur.status === 'current' || cur.status === 'superseded';
    if (!canApprove) {
      if (approvedLineage) {
        return { error: 'that drawing is approved — only the project manager can change it now' };
      }
      if (clean(who, 120) && cur.uploaded_by && clean(who, 120) !== cur.uploaded_by) {
        return { error: 'that drawing was uploaded by someone else — ask them or the project manager to change it' };
      }
    }
    // Correcting a tag must not touch the file. Only what was actually sent is
    // written, so an edit of the trade cannot quietly empty the mime type, the
    // size or the link the sheet is kept behind.
    const fields = ['number', 'revision', 'title', 'kind', 'discipline', 'trade', 'trade_group', 'floor'];
    if (data) fields.push('mime', 'size');
    if (data || 'url' in body) fields.push('url');
    const sql = fields.map((k) => `${k} = ?`).concat(data ? ['data = ?'] : []);
    const vals = fields.map((k) => row[k]).concat(data ? [data] : []);
    await env.DB.prepare(`UPDATE drawings SET ${sql.join(', ')} WHERE project_id = ? AND id = ?`)
      .bind(...vals, pid, String(body.id)).run();
    return { ok: true, id: String(body.id) };
  }

  const did = id();
  const now = nowISO();
  // A PM's upload is live at once; an engineer's waits for approval.
  const status = canApprove ? 'current' : 'pending';
  await env.DB.prepare(
    `INSERT INTO drawings (project_id, id, number, revision, title, kind, discipline,
                           trade, trade_group, floor, status, mime, size, data, url, r2_key,
                           uploaded_by, uploaded_at, approved_by, approved_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    pid, did, row.number, row.revision, row.title, row.kind, row.discipline,
    row.trade, row.trade_group, row.floor, status, row.mime, row.size, data, row.url, row.r2_key,
    clean(who, 120), now, canApprove ? clean(who, 120) : null, canApprove ? now : null
  ).run();

  // The previous revision stops being current only when a LIVE one lands — a
  // PM upload, or an approval. An engineer's pending upload retires nothing;
  // the live sheet stays live until the PM approves this one.
  let superseded = null;
  if (canApprove && existing && existing.id !== did) {
    await env.DB.prepare(
      `UPDATE drawings SET status = 'superseded', superseded_by = ? WHERE project_id = ? AND id = ?`
    ).bind(did, pid, existing.id).run();
    superseded = existing.revision || '(no revision)';
  }
  return { ok: true, id: did, status, superseded, pending: status === 'pending',
    // Filed, but the gate had nothing to check it against. Said out loud rather
    // than left to look like a verified sheet.
    unverified: unverified || undefined };
}

/* --------------------------------------------------------- the approval gate */

// The PM approving a pending sheet. This is the moment the register moves: the
// pending revision becomes the live one, and whatever was live before it is
// retired in the same breath, so there is never an instant with two live.
export async function approveDrawing(env, pid, did, who) {
  const cur = await getDrawing(env, pid, did);
  if (!cur) return { error: 'unknown drawing' };
  if (cur.status === 'current') return { ok: true, already: true };
  if (cur.status !== 'pending' && cur.status !== 'rejected') {
    return { error: 'only a sheet awaiting approval can be approved' };
  }
  const now = nowISO();
  // Retire the live revision of this number, if there is one, before this takes
  // its place.
  const live = await env.DB.prepare(
    `SELECT id, revision FROM drawings
       WHERE project_id = ? AND number = ? AND status = 'current' AND id <> ?`
  ).bind(pid, cur.number, String(did)).first();
  let superseded = null;
  if (live) {
    await env.DB.prepare(
      `UPDATE drawings SET status = 'superseded', superseded_by = ? WHERE project_id = ? AND id = ?`
    ).bind(String(did), pid, live.id).run();
    superseded = live.revision || '(no revision)';
  }
  await env.DB.prepare(
    `UPDATE drawings SET status = 'current', approved_by = ?, approved_at = ?, reject_note = NULL
      WHERE project_id = ? AND id = ?`
  ).bind(clean(who, 120), now, pid, String(did)).run();
  return { ok: true, superseded };
}

// The PM sending a pending sheet back, with the reason. The live revision is
// untouched — nothing on site changes — and the engineer revises and resubmits.
export async function rejectDrawing(env, pid, did, who, note) {
  const cur = await getDrawing(env, pid, did);
  if (!cur) return { error: 'unknown drawing' };
  if (cur.status !== 'pending') return { error: 'only a sheet awaiting approval can be sent back' };
  await env.DB.prepare(
    `UPDATE drawings SET status = 'rejected', reject_note = ?, approved_by = ?, approved_at = ?
      WHERE project_id = ? AND id = ?`
  ).bind(clean(note, 600) || 'sent back for revision', clean(who, 120), nowISO(), pid, String(did)).run();
  return { ok: true };
}

export async function removeDrawing(env, pid, did) {
  const cur = await getDrawing(env, pid, did);
  if (!cur) return { error: 'unknown drawing' };
  await env.DB.prepare('DELETE FROM drawing_links WHERE project_id = ? AND drawing_id = ?')
    .bind(pid, String(did)).run();
  await env.DB.prepare('DELETE FROM drawings WHERE project_id = ? AND id = ?')
    .bind(pid, String(did)).run();
  // Whatever this one superseded becomes current again, rather than leaving the
  // register with nothing marked live against that number.
  if (cur.status === 'current') {
    await env.DB.prepare(
      `UPDATE drawings SET status = 'current', superseded_by = NULL
        WHERE project_id = ? AND superseded_by = ?`
    ).bind(pid, String(did)).run();
  }
  return { ok: true };
}

/* ------------------------------------------------------------- the pinning */

export async function pin(env, pid, did, activityId, who, off) {
  const act = String(activityId || '').slice(0, 60);
  if (!act) return { error: 'which activity?' };
  if (off) {
    await env.DB.prepare(
      'DELETE FROM drawing_links WHERE project_id = ? AND drawing_id = ? AND activity_id = ?'
    ).bind(pid, String(did), act).run();
    return { ok: true, pinned: false };
  }
  if (!(await getDrawing(env, pid, did))) return { error: 'unknown drawing' };
  await env.DB.prepare(
    `INSERT INTO drawing_links (project_id, drawing_id, activity_id, by, at) VALUES (?,?,?,?,?)
     ON CONFLICT(project_id, drawing_id, activity_id) DO NOTHING`
  ).bind(pid, String(did), act, clean(who, 120), nowISO()).run();
  return { ok: true, pinned: true };
}

/* --------------------------------------------------- which sheet, which job */

// A drawing applies to an activity when its trade and its floor do not
// contradict the activity's. A blank tag is not a mismatch — it is "everywhere",
// which is what a specification section and a general arrangement actually are.
export function applies(drawing, activity) {
  const t = key(drawing.trade), g = key(drawing.trade_group), f = key(drawing.floor);
  const at = key(activity.trade), ag = key(activity.trade_group), af = key(activity.floor);
  if (t && t !== at) return false;
  if (!t && g && g !== ag) return false;
  if (f && f !== af) return false;
  return true;
}

// How close a match is, so the sheet somebody actually wants is at the top:
// pinned by hand first, then trade and floor together, then one of them, then
// the general ones.
export function closeness(drawing, activity) {
  let n = 0;
  if (key(drawing.trade) && key(drawing.trade) === key(activity.trade)) n += 4;
  else if (key(drawing.trade_group) && key(drawing.trade_group) === key(activity.trade_group)) n += 2;
  if (key(drawing.floor) && key(drawing.floor) === key(activity.floor)) n += 3;
  return n;
}

// Every drawing an activity should show, in the order to show them.
export async function forActivity(env, pid, activity) {
  if (!activity) return [];
  let current = [], pinned = new Set();
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, number, revision, title, kind, discipline, trade, trade_group, floor,
              mime, size, url, CASE WHEN data IS NULL AND r2_key IS NULL THEN 0 ELSE 1 END AS has_file
         FROM drawings WHERE project_id = ? AND status = 'current'`
    ).bind(pid).all();
    current = results || [];
    const { results: links } = await env.DB.prepare(
      'SELECT drawing_id FROM drawing_links WHERE project_id = ? AND activity_id = ?'
    ).bind(pid, String(activity.id)).all();
    for (const l of links || []) pinned.add(l.drawing_id);
  } catch (err) {
    return [];                          // not migrated
  }

  return current
    .filter((d) => pinned.has(d.id) || applies(d, activity))
    .map((d) => ({ ...d, pinned: pinned.has(d.id), rank: pinned.has(d.id) ? 99 : closeness(d, activity) }))
    .sort((a, b) => b.rank - a.rank || String(a.number).localeCompare(String(b.number)));
}

// How many drawings each of a set of activities carries, for the count on a
// button. Done in one pass over the register rather than a query per activity.
export async function countsFor(env, pid, activities) {
  if (!activities || !activities.length) return {};
  let current = [], links = [];
  try {
    const a = await env.DB.prepare(
      `SELECT id, trade, trade_group, floor FROM drawings
        WHERE project_id = ? AND status = 'current'`
    ).bind(pid).all();
    current = a.results || [];
    const b = await env.DB.prepare(
      'SELECT drawing_id, activity_id FROM drawing_links WHERE project_id = ?'
    ).bind(pid).all();
    links = b.results || [];
  } catch (err) {
    return {};
  }
  const pinnedBy = {};
  for (const l of links) (pinnedBy[l.activity_id] || (pinnedBy[l.activity_id] = new Set())).add(l.drawing_id);

  const out = {};
  for (const act of activities) {
    const pins = pinnedBy[act.id] || new Set();
    let n = 0;
    for (const d of current) if (pins.has(d.id) || applies(d, act)) n++;
    if (n) out[act.id] = n;
  }
  return out;
}

// The other direction: how many activities a drawing reaches. This is the only
// check there is on a tag being right — a sheet tagged to a trade that nobody
// spelled that way in the programme reaches nothing, and the register should say
// so on the row rather than leaving it to be discovered on site.
export async function reachFor(env, pid, drawings) {
  if (!drawings || !drawings.length) return {};
  let acts = [], links = [];
  try {
    const a = await env.DB.prepare(
      `SELECT id, trade, trade_group, floor FROM activities
        WHERE project_id = ? AND COALESCE(level,1) >= 1`
    ).bind(pid).all();
    acts = a.results || [];
    const b = await env.DB.prepare(
      'SELECT drawing_id, activity_id FROM drawing_links WHERE project_id = ?'
    ).bind(pid).all();
    links = b.results || [];
  } catch (err) {
    return {};
  }
  const pinnedOn = {};
  for (const l of links) (pinnedOn[l.drawing_id] || (pinnedOn[l.drawing_id] = new Set())).add(l.activity_id);

  const out = {};
  for (const d of drawings) {
    if (d.status && d.status !== 'current') continue;
    const pins = pinnedOn[d.id] || new Set();
    let n = 0;
    for (const a of acts) if (pins.has(a.id) || applies(d, a)) n++;
    out[d.id] = { activities: n, pinned: pins.size };
  }
  return out;
}

/* ------------------------------------------------------------ the title block */

// What can be read off a drawing's own file name. Not a title-block reader —
// that needs the PDF opened and is a separate job — but the number and revision
// are in the file name often enough that typing them again is a waste.
//
//   AR-101 Rev C Ground Floor Plan.pdf  ->  AR-101, C
//   SK-12_R2.pdf                        ->  SK-12, 2
export function fromFileName(name) {
  const raw = String(name || '').replace(/\.[a-z0-9]+$/i, '').trim();
  if (!raw) return {};
  const out = {};

  // An underscore is a word character, so "SK-12_R2" has no word boundary in it
  // anywhere — and a drawing office types underscores as often as spaces. Match
  // against a copy where they are spaces.
  const base = raw.replace(/_/g, ' ');

  const num = base.match(/\b([A-Z]{1,4}[- ]?\d{2,5}(?:-\d{1,3})?)(?![A-Z0-9])/i);
  if (num) out.number = num[1].replace(/ /g, '-').toUpperCase();

  const rev = base.match(/\b(?:rev(?:ision)?|r)[- .]?([A-Z]|\d{1,2})\b/i);
  if (rev) out.revision = rev[1].toUpperCase();

  let title = base;
  if (num) title = title.replace(num[0], ' ');
  if (rev) title = title.replace(rev[0], ' ');
  title = title.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (title) out.title = title;

  return out;
}
