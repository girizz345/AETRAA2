// THE FILING CABINET — the sections a document controller actually works in,
// and the ability to move a document between them.
//
// WHY THIS EXISTS. The review screen grouped a drop by how CONFIDENT the engine
// was — ready, unverified, needs a decision, held, unidentified. That is a
// useful view for the five minutes after a drop and useless forever after. A
// document controller does not think "which of these was the engine unsure
// about"; he thinks "show me the IFC drawings", "the contract is in the wrong
// folder, move it", "here are six more shop drawings for that section".
//
// So the navigation becomes the filing cabinet itself, and every section
// answers the same three questions:
//
//   WHAT IS IN IT      a count, and the documents, by name
//   HOW DO I ADD       a drop target on the section, which files there
//   IT LANDED WRONG    move it, in one action, without re-uploading
//
// THE SECTIONS SPAN TWO STORES. Drawings live in the register, keyed by stage;
// everything else lives in the library, keyed by class. A move inside one store
// is a field update. A move ACROSS them is a real migration, and it is the one
// that used to be impossible: a contract that was read as a drawing, or a sheet
// that was filed as "Other", could only be fixed by clearing the project and
// starting the upload again. That is what this replaces.

import { CLASSES, ensureLibraryTable } from './library.js';
import { KINDS, KIND_LABEL, ensureAuthorityColumns } from './drawings.js';
import { SQL_SUM_FILS } from './money.js';   // K1: bill totals summed in whole fils

const nowISO = () => new Date().toISOString();

/* COUNT(*) COMES BACK AS A STRING FROM POSTGRESQL.
 *
 * bigint does not fit a JavaScript number, so the driver hands it over as text —
 * and `0 + "210"` is `"0210"`, not 210. On SQLite, which every test runs on, the
 * same query returns a number and the addition works, so the suite could not see
 * it. In production the Shop drawings tile read "0210109 documents": a zero, then
 * 210 current, then 109 superseded, concatenated.
 *
 * Every number that comes out of the database goes through this. */
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// A file name the operator will recognise, from the mime type we stored.
const EXT = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg',
              'application/acad': '.dwg', 'image/vnd.dwg': '.dwg', 'image/vnd.dxf': '.dxf' };
const extOf = (mime) => EXT[String(mime || '').toLowerCase()] || '';

/* --------------------------------------------------------- the sections */

// store: 'drawings' — a stage in the drawing register, keyed by drawings.kind
//        'library'  — a class in the document library, keyed by library.class
//        'figures'  — a count that is not a document at all (BOQ lines,
//                     programme activities, letter templates). Shown, never
//                     moved, because there is nothing to move: they are rows
//                     imported FROM a document, and the document itself is
//                     already filed in the library beside them.
export const SECTIONS = [
  // Drawings, in the order an office issues them.
  { id: 'dwg.tender',  group: 'Drawings', label: 'Tender drawings',   store: 'drawings', key: 'tender' },
  { id: 'dwg.ifc',     group: 'Drawings', label: 'IFC drawings',      store: 'drawings', key: 'ifc' },
  // What each authority stamped, one sub-section per authority, with the
  // approval number and date read off the stamp. Never retires an IFC sheet.
  { id: 'dwg.authority', group: 'Drawings', label: 'Authority approved drawings', store: 'drawings', key: 'authority',
    note: 'Grouped by authority. Each sheet carries the approval number and date from its stamp.' },
  { id: 'dwg.shop',    group: 'Drawings', label: 'Shop drawings',     store: 'drawings', key: 'shop' },
  { id: 'dwg.asbuilt', group: 'Drawings', label: 'As-built drawings', store: 'drawings', key: 'asbuilt' },
  { id: 'dwg.sketch',  group: 'Drawings', label: 'Sketches / SK',     store: 'drawings', key: 'sketch' },
  { id: 'dwg.spec',    group: 'Drawings', label: 'Specification sheets', store: 'drawings', key: 'spec' },
  // The section that exists so nothing is quietly mis-filed. A sheet whose
  // stage nobody stated lands here and is visibly waiting for an answer.
  { id: 'dwg.other',   group: 'Drawings', label: 'Unsorted drawings', store: 'drawings', key: 'other',
    note: 'No stage was stated on the sheet, in its folder or in its name. Move each one to where it belongs.' },

  // The contract set.
  { id: 'lib.contract',      group: 'Contract', label: 'Contract & conditions', store: 'library', key: 'contract' },
  { id: 'lib.bond',          group: 'Contract', label: 'Bonds & guarantees',    store: 'library', key: 'bond' },
  { id: 'lib.insurance',     group: 'Contract', label: 'Insurance',             store: 'library', key: 'insurance' },
  { id: 'lib.specification', group: 'Contract', label: 'Specifications',        store: 'library', key: 'specification' },

  // Commercial and programme.
  { id: 'fig.boq',       group: 'Commercial', label: 'Priced BOQ',  store: 'figures', key: 'boq' },
  { id: 'fig.programme', group: 'Commercial', label: 'Programme',   store: 'figures', key: 'programme' },
  { id: 'lib.payment',   group: 'Commercial', label: 'Payment applications & certificates', store: 'library', key: 'payment' },

  // Everything the job generates after it starts.
  { id: 'lib.report',   group: 'Records', label: 'Reports & correspondence', store: 'library', key: 'report' },
  { id: 'lib.survey',   group: 'Records', label: 'Surveys & investigations',  store: 'library', key: 'survey' },
  { id: 'lib.photo',    group: 'Records', label: 'Photographs',               store: 'library', key: 'photo' },
  { id: 'lib.o_and_m',  group: 'Handover', label: 'O&M manuals',              store: 'library', key: 'o_and_m' },
  { id: 'lib.warranty', group: 'Handover', label: 'Warranties',               store: 'library', key: 'warranty' },
  { id: 'fig.template', group: 'Handover', label: 'Letter & certificate templates', store: 'figures', key: 'template' },

  // The honest last resort. Anything here is a document the engine could not
  // place, and it is a section rather than a silence so that it gets looked at.
  { id: 'lib.other', group: 'Records', label: 'Unfiled documents', store: 'library', key: 'other',
    note: 'Nothing about these said what they were. Move each one to its section.' },
];

/* WHAT EACH SECTION'S EXTRACTOR READS.
 *
 * Every section runs an extractor on whatever is dropped on it — that is what
 * filing into a section means, as opposed to putting a file in a folder. But
 * which extractor, and what it reads, was written nowhere a person could see.
 * An admin dropping a BOQ could not tell whether it would be read or merely
 * stored, and the three commercial sections did not accept a drop at all: they
 * sent you away to the Setup screen to import there instead.
 *
 * So each section says, in a sentence, what is read off a file dropped on it.
 * Where the only thing read is the reference and the text, it says exactly
 * that, rather than implying a capability that is not there. */
const DRAWING_READS = 'The title block: drawing number, revision, title and stage — read off the face ' +
  'of the sheet first, then its folder, then its file name.';
const LIBRARY_READS = 'The reference number and the full text, so every word in it can be searched.';

export const READS = {
  'dwg.tender': DRAWING_READS, 'dwg.ifc': DRAWING_READS, 'dwg.shop': DRAWING_READS,
  'dwg.asbuilt': DRAWING_READS, 'dwg.sketch': DRAWING_READS, 'dwg.spec': DRAWING_READS,
  'dwg.other': DRAWING_READS,
  'lib.contract': 'Who the Employer, the Engineer and the Contractor are, and the seven commercial ' +
    'figures — retention, retention cap, advance, payment days, RFI reply days, notice clause and ' +
    'completion date — each with the page and clause it came from.',
  'lib.bond': 'The reference number and the full text: bond number, issuing bank and amount can be searched.',
  'lib.insurance': 'The reference number and the full text: policy number, insurer and cover can be searched.',
  'lib.specification': LIBRARY_READS,
  'fig.boq': 'The priced bill: section, item, description, unit, quantity, rate and amount, from the ' +
    'header row. This is the bill every payment certificate is computed from.',
  'fig.programme': 'A Primavera P6 programme (.xer): every activity with its dates and logic, and its ' +
    'WBS branches — which you then assign to a discipline, so each site engineer sees their own work.',
  'lib.payment': LIBRARY_READS,
  'lib.report': LIBRARY_READS, 'lib.survey': LIBRARY_READS,
  'lib.photo': 'The file itself, with its date. A photograph carries no text to read.',
  'lib.o_and_m': LIBRARY_READS, 'lib.warranty': LIBRARY_READS,
  'fig.template': 'The placeholder fields in the form, and which document it is the template for — ' +
    'read from its name (a file called "WIR form" is the WIR template).',
  'lib.other': LIBRARY_READS,
};

// The files each section's picker offers. Everything else still drops — the
// extractor says so if it cannot read it — but the picker should not invite a
// photograph onto the programme.
export const ACCEPT = {
  'fig.boq': '.xlsx,.xls,.csv',
  'fig.programme': '.xer',
  'fig.template': '.docx,.xlsx,.doc,.xls',
};

for (const s of SECTIONS) {
  s.reads = READS[s.id] || LIBRARY_READS;
  s.accept = ACCEPT[s.id] || '';
}

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

// The sections a document can be MOVED into: the ones backed by a real store.
export const MOVABLE = SECTIONS.filter((s) => s.store !== 'figures');

export function sectionFor(store, key) {
  return SECTIONS.find((s) => s.store === store && s.key === key) || null;
}

/* ------------------------------------------------------------- the counts */

// Every section's count in one pass, which is what the navigation is built
// from. A section with nothing in it is still returned: a document controller
// needs to see that As-built is empty as much as that IFC has 104.
export async function sectionCounts(env, pid) {
  const counts = {};
  for (const s of SECTIONS) counts[s.id] = { total: 0, live: 0 };

  try {
    const { results } = await env.DB.prepare(
      `SELECT kind, status, COUNT(*) AS n FROM drawings WHERE project_id = ? GROUP BY kind, status`
    ).bind(pid).all();
    for (const r of results || []) {
      const s = sectionFor('drawings', KINDS.includes(r.kind) ? r.kind : 'other');
      if (!s) continue;
      counts[s.id].total += num(r.n);
      if (r.status === 'current') counts[s.id].live += num(r.n);
    }
  } catch (e) { /* no register yet */ }

  try {
    await ensureLibraryTable(env);
    const { results } = await env.DB.prepare(
      `SELECT class, COUNT(*) AS n FROM library WHERE project_id = ? GROUP BY class`
    ).bind(pid).all();
    for (const r of results || []) {
      const s = sectionFor('library', CLASSES[r.class] ? r.class : 'other');
      if (!s) continue;
      counts[s.id].total += num(r.n);
      counts[s.id].live += num(r.n);
    }
  } catch (e) { /* no library yet */ }

  // The figures. These are counts of rows imported from a document, not of
  // documents — said plainly, because "BOQ: 1" would mean one file while
  // "BOQ: 412 lines" means the bill is actually there.
  counts['fig.boq'] = await figure(env, `SELECT COUNT(*) AS n, ${SQL_SUM_FILS('amount')} / 100.0 AS t FROM boq WHERE project_id = ?`, pid);
  counts['fig.programme'] = await figure(env, `SELECT COUNT(*) AS n FROM activities WHERE project_id = ?`, pid);
  counts['fig.template'] = await figure(env, `SELECT COUNT(*) AS n FROM templates WHERE project_id = ?`, pid);

  return counts;
}

async function figure(env, sql, pid) {
  try {
    const r = await env.DB.prepare(sql).bind(pid).first();
    return { total: num(r && r.n), live: num(r && r.n), amount: num(r && r.t) };
  } catch (e) { return { total: 0, live: 0, amount: 0 }; }
}

/* ------------------------------------------------------------ the contents */

// What is actually in one section, as rows a person can read and tick. Shaped
// the same whichever store it came from, so the screen has one list to render
// and the move has one kind of id to send.
export async function listSection(env, pid, sectionId) {
  const s = SECTION_BY_ID[sectionId];
  if (!s) return { error: 'no such section' };

  if (s.store === 'drawings') {
    try {
      const auth = s.key === 'authority';
      if (auth) await ensureAuthorityColumns(env);
      const { results } = await env.DB.prepare(
        `SELECT id, number, revision, title, kind, discipline, trade_group, floor, status,
                mime, size, uploaded_by, uploaded_at${auth ? ', authority, approval_no, approval_date' : ''}
           FROM drawings WHERE project_id = ? AND ${kindWhere(s.key)}
          ORDER BY ${auth ? 'authority, ' : ''}number, revision`
      ).bind(pid).all();
      return {
        section: shapeSection(s),
        items: (results || []).map((r) => ({
          store: 'drawings', id: r.id,
          ...(auth ? { group: r.authority || 'Authority not stated' } : {}),
          name: [r.number, r.revision ? 'Rev ' + r.revision : ''].filter(Boolean).join(' '),
          title: r.title || '',
          detail: [auth ? r.authority : '', auth && r.approval_no ? 'approval ' + r.approval_no : '',
                   auth && r.approval_date ? r.approval_date : '',
                   r.discipline, r.floor, r.status === 'current' ? '' : r.status].filter(Boolean).join(' · '),
          status: r.status, bytes: num(r.size), at: r.uploaded_at || '', by: r.uploaded_by || '',
        })),
      };
    } catch (e) { return { section: shapeSection(s), items: [] }; }
  }

  if (s.store === 'library') {
    try {
      await ensureLibraryTable(env);
      const { results } = await env.DB.prepare(
        `SELECT id, class, title, reference, doc_date, filename, mime, bytes, added_by, added_at, note
           FROM library WHERE project_id = ? AND ${classWhere(s.key)}
          ORDER BY added_at DESC`
      ).bind(pid).all();
      return {
        section: shapeSection(s),
        items: (results || []).map((r) => ({
          store: 'library', id: r.id,
          name: r.title || r.filename || '(untitled)',
          title: r.filename && r.filename !== r.title ? r.filename : '',
          detail: [r.reference, r.doc_date, r.note].filter(Boolean).join(' · '),
          status: '', bytes: num(r.bytes), at: r.added_at || '', by: r.added_by || '',
        })),
      };
    } catch (e) { return { section: shapeSection(s), items: [] }; }
  }

  // A figures section has no documents of its own — it has the rows that were
  // imported, and it says where the document they came from is sitting.
  return { section: shapeSection(s), items: [], figures: await figureRows(env, pid, s.key) };
}

// A row whose kind is null, blank or something no longer in KINDS belongs in
// Unsorted, not nowhere. Rows written before the stage existed are exactly that
// case, and they must not vanish off the screen.
function kindWhere(key) {
  if (key !== 'other') return 'kind = ?'.replace('?', `'${key}'`);
  return `(kind IS NULL OR kind = '' OR kind NOT IN (${KINDS.filter((k) => k !== 'other').map((k) => `'${k}'`).join(',')}))`;
}
function classWhere(key) {
  if (key !== 'other') return `class = '${key}'`;
  return `(class IS NULL OR class = '' OR class NOT IN (${Object.keys(CLASSES).filter((c) => c !== 'other').map((c) => `'${c}'`).join(',')}))`;
}

function shapeSection(s) {
  return { id: s.id, group: s.group, label: s.label, store: s.store, key: s.key, note: s.note || '',
           reads: s.reads || '', accept: s.accept || '' };
}

async function figureRows(env, pid, key) {
  try {
    if (key === 'boq') {
      const r = await env.DB.prepare(
        `SELECT COUNT(*) AS lines, ${SQL_SUM_FILS('amount')} / 100.0 AS total FROM boq WHERE project_id = ?`).bind(pid).first();
      const src = await env.DB.prepare(
        `SELECT filename, added_at FROM library WHERE project_id = ? AND class = 'contract'
            AND (filename LIKE '%.xls%' OR title LIKE '%BOQ%' OR title LIKE '%bill%')
          ORDER BY added_at DESC LIMIT 1`).bind(pid).first().catch(() => null);
      return { lines: num(r && r.lines), total: num(r && r.total),
               source: src ? src.filename : '', source_at: src ? src.added_at : '' };
    }
    if (key === 'programme') {
      const r = await env.DB.prepare(
        `SELECT COUNT(*) AS n, MIN(planned_start) AS s, MAX(planned_finish) AS f
           FROM activities WHERE project_id = ?`).bind(pid).first();
      return { activities: num(r && r.n), start: (r && r.s) || '', finish: (r && r.f) || '' };
    }
    if (key === 'template') {
      const { results } = await env.DB.prepare(
        `SELECT doc_type, filename, uploaded_at FROM templates WHERE project_id = ?`).bind(pid).all();
      return { templates: results || [] };
    }
  } catch (e) { /* the table may not exist yet */ }
  return {};
}

/* ---------------------------------------------------------------- the move */

// MOVE, which is the action this whole screen was missing.
//
// Inside one store it is a field update and always allowed. Across stores it is
// a migration, and the two directions are not symmetrical:
//
//   register → library   always possible. A sheet is a document; the library
//                        takes the file and the register row goes.
//
//   library → register   needs a NUMBER, because a drawing register keyed on
//                        nothing is not a register. Where the document has no
//                        number the move is REFUSED and says why, rather than
//                        inventing one — an invented number collides with a
//                        real sheet later and there is no way back from that.
//
// Nothing here is silent. Every move returns what happened to each id.
export async function moveItems(env, pid, items, toSectionId, who) {
  const to = SECTION_BY_ID[toSectionId];
  if (!to) return { error: 'no such section' };
  if (to.store === 'figures') {
    return { error: 'The ' + to.label + ' section holds imported figures, not documents. ' +
                    'Import a file into it from the section itself.' };
  }
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return { error: 'nothing was selected' };

  const results = [];
  for (const it of list) {
    const from = String(it.store || '');
    const id = String(it.id || '');
    if (!id) { results.push({ id, ok: false, error: 'no id' }); continue; }
    try {
      results.push(await moveOne(env, pid, from, id, to, who));
    } catch (e) {
      results.push({ id, ok: false, error: 'that document could not be moved' });
    }
  }
  return { ok: true, moved: results.filter((r) => r.ok).length, results };
}

async function moveOne(env, pid, from, id, to, who) {
  // Same store: the cheap, common case — a sheet in the wrong stage.
  if (from === 'drawings' && to.store === 'drawings') {
    const r = await env.DB.prepare('SELECT number FROM drawings WHERE project_id = ? AND id = ?')
      .bind(pid, id).first();
    if (!r) return { id, ok: false, error: 'that sheet is no longer in the register' };
    await env.DB.prepare('UPDATE drawings SET kind = ? WHERE project_id = ? AND id = ?')
      .bind(to.key, pid, id).run();
    return { id, ok: true, to: to.id, what: r.number || id };
  }

  if (from === 'library' && to.store === 'library') {
    await ensureLibraryTable(env);
    const r = await env.DB.prepare('SELECT title, filename FROM library WHERE project_id = ? AND id = ?')
      .bind(pid, id).first();
    if (!r) return { id, ok: false, error: 'that document is no longer in the library' };
    await env.DB.prepare('UPDATE library SET class = ? WHERE project_id = ? AND id = ?')
      .bind(to.key, pid, id).run();
    return { id, ok: true, to: to.id, what: r.title || r.filename || id };
  }

  // Register → library. The sheet becomes a document and leaves the register.
  if (from === 'drawings' && to.store === 'library') {
    const r = await env.DB.prepare(
      'SELECT id, number, revision, title, r2_key, mime, size, uploaded_by, uploaded_at FROM drawings WHERE project_id = ? AND id = ?'
    ).bind(pid, id).first();
    if (!r) return { id, ok: false, error: 'that sheet is no longer in the register' };

    // The library row POINTS AT THE SAME STORED FILE rather than a copy of it.
    // A 40 MB sheet moved between sections must not become 80 MB on disk, and a
    // re-upload to get the bytes back into memory would be minutes of transfer
    // to achieve nothing.
    await ensureLibraryTable(env);
    const newId = 'lib_' + Math.random().toString(36).slice(2, 12);
    await env.DB.prepare(
      `INSERT INTO library (id, project_id, class, title, reference, filename, mime, bytes,
                            file_key, added_by, added_at, source, links, note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'upload','[]',?)`
    ).bind(newId, pid, to.key, r.title || r.number || 'Document', r.number || null,
           (r.number || 'document') + extOf(r.mime), r.mime || null, r.size || 0,
           r.r2_key || null, (who && who.name) || 'AETRAA', nowISO(),
           'moved out of the drawing register — was ' + (r.number || id) +
             (r.revision ? ' Rev ' + r.revision : '')).run();

    await env.DB.prepare('DELETE FROM drawings WHERE project_id = ? AND id = ?').bind(pid, id).run();
    return { id, ok: true, to: to.id, what: r.number || r.title || id, new_id: newId };
  }

  // Library → register. Only where a number can be read; never invented.
  if (from === 'library' && to.store === 'drawings') {
    await ensureLibraryTable(env);
    const r = await env.DB.prepare(
      'SELECT id, class, title, reference, filename, file_key, mime, bytes FROM library WHERE project_id = ? AND id = ?'
    ).bind(pid, id).first();
    if (!r) return { id, ok: false, error: 'that document is no longer in the library' };

    const number = pickNumber(r);
    if (!number) {
      return { id, ok: false,
        error: 'no drawing number could be read from "' + (r.title || r.filename || id) +
               '". Give it a number on the drawing screen, or leave it in the library — ' +
               'a number invented here would collide with a real sheet later.' };
    }
    const dwgId = 'dwg_' + Math.random().toString(36).slice(2, 12);
    await env.DB.prepare(
      `INSERT INTO drawings (project_id, id, number, revision, title, kind, status, mime, size, r2_key, uploaded_by, uploaded_at)
       VALUES (?,?,?,?,?,?,'current',?,?,?,?,?)`
    ).bind(pid, dwgId, number, '', r.title || r.filename || number, to.key,
           r.mime || null, r.bytes || 0, r.file_key || null,
           (who && who.name) || 'AETRAA', nowISO()).run();
    await env.DB.prepare('DELETE FROM library WHERE project_id = ? AND id = ?').bind(pid, id).run();
    return { id, ok: true, to: to.id, what: number, new_id: dwgId };
  }

  return { id, ok: false, error: 'that move is not possible' };
}

// A drawing number already written down somewhere on the library row. Read, not
// guessed: the reference field the operator typed, or a number in the title or
// the file name in the shape a drawing number takes.
const NUMBER_RE = /\b([A-Z]{1,4}\d{0,2}[- ]?\d{2,5}(?:-\d{1,3})?)(?![A-Z0-9])/i;
export function pickNumber(row) {
  for (const v of [row && row.reference, row && row.title, row && row.filename]) {
    const m = String(v || '').match(NUMBER_RE);
    if (m) return m[1].replace(/ /g, '-').toUpperCase();
  }
  return '';
}

/* ------------------------------------------------ what the section list says */

// The navigation, ready to render: the sections in groups, each with its count.
export async function sectionTree(env, pid) {
  const counts = await sectionCounts(env, pid);
  const groups = [];
  for (const s of SECTIONS) {
    let g = groups.find((x) => x.group === s.group);
    if (!g) { g = { group: s.group, sections: [] }; groups.push(g); }
    g.sections.push({ ...shapeSection(s), ...(counts[s.id] || { total: 0, live: 0 }) });
  }
  return { groups, kinds: KINDS.map((k) => [k, KIND_LABEL[k]]), classes: CLASSES,
           movable: MOVABLE.map((s) => ({ id: s.id, label: s.label, group: s.group })) };
}
