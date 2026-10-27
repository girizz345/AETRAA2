// P1 — THE PROJECT KNOWLEDGE BASE (approved 5 Oct 2026).
//
// Read everything once at setup and keep it: the contract terms, the BOQ, the
// drawing register, the specification index, the programme — cross-linked
// (drawing <-> specification section <-> BOQ line <-> programme activity).
//
//   step 4  the AETRAA Admin reviews the summary — what was read, what is
//           missing, what was flagged, the links to confirm, the tender-vs-IFC
//           changes, the templates found and missing — and ISSUES it
//   step 5  the PM approves the issued knowledge base
//   step 6  the four schedules (P2-P5) are generated and go live after it
//   step 7  reissued documents are compared with what was approved and the
//           changes are flagged to the PM
//
// The links are proposed by rules (discipline, trade, floor, shared words),
// never by guessing silently: each carries the basis it was proposed on and
// waits for the Admin. An AI pass may propose more (P1 step 3) — it is marked
// as such and confirmed the same way. Nothing here changes a source document.

import { listDrawings, applies } from './drawings.js';
import { pairSheets } from './tender-ifc.js';
import { listTemplates, DOC_TYPES } from './templates-store.js';
import { liveSections } from './spec-index.js';
import { addColumns } from './db-cols.js';
import { fils, toAED } from './money.js';

const nowISO = () => new Date().toISOString();
const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);
const safeJson = (s, f) => { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } };
const safe = async (fn, f) => { try { return await fn(); } catch (e) { return f; } };

// The BOQ's line count and total, summed in whole fils (money.js) like every
// other total on the platform — never a floating-point SUM.
async function boqTotal(env, pid) {
  const rows = ((await safe(() => env.DB.prepare('SELECT amount FROM boq WHERE project_id = ?').bind(pid).all(), { results: [] })).results) || [];
  return { n: rows.length, v: toAED(rows.reduce((t, r) => t + (fils(r.amount) || 0), 0)) };
}

let ready = false;
export async function ensureKbTables(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS kb (
         project_id TEXT PRIMARY KEY, state TEXT, summary TEXT, snapshot TEXT, version INTEGER,
         issued_by TEXT, issued_at TEXT, approved_by TEXT, approved_at TEXT, reviewed_at TEXT)`
    ).run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS kb_link (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, from_kind TEXT, from_ref TEXT, from_label TEXT,
         to_kind TEXT, to_ref TEXT, to_label TEXT, basis TEXT, state TEXT, decided_by TEXT, decided_at TEXT, created_at TEXT)`
    ).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_kb_link_p ON kb_link(project_id, state)').run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS kb_drawing_contents (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, drawing_id TEXT, number TEXT, contents TEXT,
         source TEXT, created_at TEXT, confirmed_by TEXT, confirmed_at TEXT)`
    ).run();
    await addColumns(env, 'kb', [['changes_ack', 'TEXT']]);
    ready = true;
    return true;
  } catch (e) { return false; }
}

// ---------------------------------------------------------------- words
const STOP = new Set(('with from that this into over under plan plans floor level levels general works work details detail ' +
  'section sections drawing drawings typical layout schedule part parts system systems other first ground second third ' +
  'fourth roof basement area areas zone block tower building project sheet sheets elevation elevations including ' +
  'supply install installation complete provide providing fixing fixed item items type types misc sundry').split(/\s+/));
export function words(text) {
  return [...new Set(String(text || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w)))];
}
const shared = (a, b) => { const B = new Set(b); return a.filter((w) => B.has(w)); };
const discOf = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const sameDiscipline = (a, b) => !a || !b || discOf(a).startsWith(discOf(b).slice(0, 5)) || discOf(b).startsWith(discOf(a).slice(0, 5));

// ---------------------------------------------------------------- the snapshot
// What the project holds now, in a form two moments can be compared by.
export async function snapshot(env, pid) {
  const drawings = (await safe(() => listDrawings(env, pid, {}), [])) || [];
  const live = {};
  for (const d of drawings) if (d.status === 'current') live[d.number + '|' + (d.kind || '')] = { rev: d.revision || '', title: d.title || '' };
  const boq = await boqTotal(env, pid);
  const acts = await safe(() => env.DB.prepare('SELECT COUNT(*) AS n FROM activities WHERE project_id = ?').bind(pid).first(), null);
  const proj = await safe(() => env.DB.prepare('SELECT data_date FROM projects WHERE id = ?').bind(pid).first(), null);
  const secs = (await safe(() => liveSections(env, pid), [])) || [];
  return {
    drawings: live,
    boq: { lines: Number(boq && boq.n) || 0, total: Math.round((Number(boq && boq.v) || 0) * 100) / 100 },
    programme: { activities: Number(acts && acts.n) || 0, data_date: (proj && proj.data_date) || '' },
    spec: secs.map((s) => s.code).sort(),
  };
}

// The differences between the approved knowledge base and now (step 7).
export function diffSnapshots(a, b) {
  const out = [];
  if (!a || !b) return out;
  for (const k of Object.keys(b.drawings).sort()) {
    const [num, kind] = k.split('|');
    const was = a.drawings[k], now = b.drawings[k];
    if (!was) out.push({ kind: 'drawing', ref: num, what: 'new ' + (kind || 'drawing') + ' sheet ' + num + (now.rev ? ' rev ' + now.rev : '') });
    else if (was.rev !== now.rev) out.push({ kind: 'drawing', ref: num, what: num + ' reissued: rev ' + (was.rev || '—') + ' → rev ' + (now.rev || '—') + (was.title !== now.title ? ', title changed' : '') });
    else if (was.title !== now.title) out.push({ kind: 'drawing', ref: num, what: num + ' title changed: "' + was.title + '" → "' + now.title + '"' });
  }
  for (const k of Object.keys(a.drawings).sort()) if (!b.drawings[k]) out.push({ kind: 'drawing', ref: k.split('|')[0], what: k.split('|')[0] + ' is no longer current' });
  if (a.boq.lines !== b.boq.lines || a.boq.total !== b.boq.total) {
    out.push({ kind: 'boq', ref: 'BOQ', what: 'BOQ reissued: ' + a.boq.lines + ' → ' + b.boq.lines + ' lines, total ' + a.boq.total + ' → ' + b.boq.total });
  }
  if (a.programme.activities !== b.programme.activities || a.programme.data_date !== b.programme.data_date) {
    out.push({ kind: 'programme', ref: 'Programme', what: 'Programme updated: ' + a.programme.activities + ' → ' + b.programme.activities + ' activities, data date ' + (a.programme.data_date || '—') + ' → ' + (b.programme.data_date || '—') });
  }
  const added = b.spec.filter((c) => !a.spec.includes(c)), gone = a.spec.filter((c) => !b.spec.includes(c));
  if (added.length || gone.length) out.push({ kind: 'spec', ref: 'Specification', what: 'Specification index changed: ' + (added.length ? 'added ' + added.join(', ') : '') + (added.length && gone.length ? '; ' : '') + (gone.length ? 'removed ' + gone.join(', ') : '') });
  return out;
}

// ---------------------------------------------------------------- tender vs IFC
// The sheets paired as the Tender vs IFC agent pairs them (tender-ifc.js,
// decision 20): by number, by number without stage marks, by identical title.
// Here only revision and title are compared; the content of each pair is
// compared, and each deviation decided, on /deviations.
export function tenderVsIfc(drawings) {
  const { pairs, ifc_only, tender_only } = pairSheets((drawings || []).filter((d) => d.status === 'current'));
  const changed = pairs.filter((p) => (p.tender.title || '') !== (p.ifc.title || '') || (p.tender.revision || '') !== (p.ifc.revision || ''))
    .map((p) => ({ number: p.ifc.number, tender_number: p.tender.number, tender_revision: p.tender.revision || '', ifc_revision: p.ifc.revision || '',
      title_changed: (p.tender.title || '') !== (p.ifc.title || ''), tender_title: p.tender.title || '', ifc_title: p.ifc.title || '' }));
  return { changed, ifc_only: ifc_only.map((d) => ({ number: d.number, revision: d.revision || '', title: d.title || '' })),
           tender_only: tender_only.map((d) => ({ number: d.number, revision: d.revision || '', title: d.title || '' })),
           note: pairs.length + ' sheets paired by the Tender vs IFC agent. Their drawings and notes are compared, and each deviation decided, on the Tender vs IFC page (/deviations).' };
}

// ---------------------------------------------------------------- links
// Proposed by rules, each with its basis. Kept small: the closest few per item.
export async function proposeLinks(env, pid) {
  await ensureKbTables(env);
  const drawings = ((await safe(() => listDrawings(env, pid, {}), [])) || []).filter((d) => d.status === 'current' && d.kind !== 'tender');
  const secs = (await safe(() => liveSections(env, pid), [])) || [];
  const boq = ((await safe(() => env.DB.prepare('SELECT id, ref, section, description FROM boq WHERE project_id = ? ORDER BY COALESCE(sort_order, 999999)').bind(pid).all(), { results: [] })).results) || [];
  const acts = ((await safe(() => env.DB.prepare("SELECT id, name, wbs, trade, trade_group, floor, discipline FROM activities WHERE project_id = ? AND COALESCE(level,1) > 0 AND COALESCE(kind,'site') = 'site'").bind(pid).all(), { results: [] })).results) || [];
  const proposals = [];
  const add = (fk, fr, fl, tk, tr, tl, basis) => proposals.push({ from_kind: fk, from_ref: fr, from_label: fl, to_kind: tk, to_ref: tr, to_label: tl, basis });
  const best = (list, n) => list.sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1)).slice(0, n);

  // drawing -> specification section: same discipline and a shared word
  for (const d of drawings) {
    const dw = words(d.title);
    const hits = secs.map((s) => ({ s, sh: shared(dw, words(s.title)), key: s.code }))
      .filter((x) => x.sh.length && sameDiscipline(d.discipline, x.s.discipline)).map((x) => ({ ...x, score: x.sh.length }));
    for (const h of best(hits, 3)) add('drawing', d.number, d.number + ' ' + (d.title || ''), 'spec', h.s.code, h.s.code + ' ' + h.s.title, 'shared words: ' + h.sh.join(', ') + (d.discipline ? '; discipline ' + d.discipline : ''));
  }
  // specification section -> BOQ line: shared words with the line or its bill section
  for (const s of secs) {
    const sw = words(s.title);
    const hits = boq.map((l) => ({ l, sh: shared(sw, words(l.description + ' ' + (l.section || ''))), key: String(l.ref || l.id) }))
      .filter((x) => x.sh.length).map((x) => ({ ...x, score: x.sh.length }));
    for (const h of best(hits, 5)) add('spec', s.code, s.code + ' ' + s.title, 'boq', String(h.l.ref || h.l.id), (h.l.ref ? h.l.ref + ' ' : '') + h.l.description, 'shared words: ' + h.sh.join(', '));
  }
  // BOQ line -> activity: shared words between the description and the activity
  for (const l of boq) {
    const lw = words(l.description + ' ' + (l.section || ''));
    const hits = acts.map((a) => ({ a, sh: shared(lw, words(a.name + ' ' + (a.trade || ''))), key: a.id }))
      .filter((x) => x.sh.length).map((x) => ({ ...x, score: x.sh.length }));
    for (const h of best(hits, 3)) add('boq', String(l.ref || l.id), (l.ref ? l.ref + ' ' : '') + l.description, 'activity', h.a.id, h.a.id + ' ' + h.a.name, 'shared words: ' + h.sh.join(', '));
  }
  // drawing -> activity: trade and floor agree (the register's own rule) and a shared word
  for (const d of drawings) {
    const dw = words(d.title + ' ' + (d.trade || ''));
    const hits = acts.filter((a) => applies(d, a)).map((a) => ({ a, sh: shared(dw, words(a.name + ' ' + (a.trade || ''))), key: a.id }))
      .filter((x) => x.sh.length).map((x) => ({ ...x, score: x.sh.length + (d.floor && d.floor === x.a.floor ? 2 : 0) }));
    for (const h of best(hits, 3)) add('drawing', d.number, d.number + ' ' + (d.title || ''), 'activity', h.a.id, h.a.id + ' ' + h.a.name,
      'trade/floor agree; shared words: ' + h.sh.join(', '));
  }
  return await storeProposals(env, pid, proposals);
}

export async function storeProposals(env, pid, proposals) {
  await ensureKbTables(env);
  const existing = ((await env.DB.prepare('SELECT from_kind, from_ref, to_kind, to_ref FROM kb_link WHERE project_id = ?').bind(pid).all()).results) || [];
  const have = new Set(existing.map((e) => [e.from_kind, e.from_ref, e.to_kind, e.to_ref].join('|')));
  let added = 0;
  for (const p of proposals) {
    const k = [p.from_kind, p.from_ref, p.to_kind, p.to_ref].join('|');
    if (have.has(k)) continue;      // a link already proposed, confirmed or rejected stays as decided
    have.add(k);
    await env.DB.prepare(
      `INSERT INTO kb_link (id, project_id, from_kind, from_ref, from_label, to_kind, to_ref, to_label, basis, state, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(uid('kbl'), pid, p.from_kind, str(p.from_ref, 80), str(p.from_label, 200), p.to_kind, str(p.to_ref, 80), str(p.to_label, 200),
           str(p.basis, 300), 'proposed', nowISO()).run();
    added++;
  }
  return { proposed: added, total: proposals.length };
}

export async function listLinks(env, pid, state) {
  await ensureKbTables(env);
  const q = state ? 'SELECT * FROM kb_link WHERE project_id = ? AND state = ? ORDER BY from_kind, from_ref, to_kind, to_ref'
                  : 'SELECT * FROM kb_link WHERE project_id = ? ORDER BY from_kind, from_ref, to_kind, to_ref';
  const r = state ? await env.DB.prepare(q).bind(pid, state).all() : await env.DB.prepare(q).bind(pid).all();
  return r.results || [];
}

export async function decideLinks(env, pid, ids, decision, who) {
  await ensureKbTables(env);
  const st = decision === 'reject' ? 'rejected' : 'confirmed';
  let n = 0;
  for (const id of (ids || []).slice(0, 2000)) {
    const r = await env.DB.prepare("UPDATE kb_link SET state = ?, decided_by = ?, decided_at = ? WHERE id = ? AND project_id = ?")
      .bind(st, str(who, 120), nowISO(), String(id), pid).run();
    n += (r && r.meta && r.meta.changes) || 0;
  }
  return { ok: true, decided: n, state: st };
}

// ---------------------------------------------------------------- the summary
export async function buildSummary(env, pid) {
  const drawings = (await safe(() => listDrawings(env, pid, {}), [])) || [];
  const byKind = {};
  for (const d of drawings) if (d.status === 'current') byKind[d.kind || 'other'] = (byKind[d.kind || 'other'] || 0) + 1;
  const awaited = drawings.filter((d) => d.status === 'awaited').length;
  const pending = drawings.filter((d) => d.status === 'pending').length;
  const one = (sql, ...a) => safe(() => env.DB.prepare(sql).bind(...a).first(), null);
  const boq = await boqTotal(env, pid);
  const bom = await one('SELECT COUNT(*) AS n FROM bom WHERE project_id = ?', pid);
  const acts = await one('SELECT COUNT(*) AS n FROM activities WHERE project_id = ?', pid);
  const proj = await one('SELECT * FROM projects WHERE id = ?', pid);
  const secs = (await safe(() => liveSections(env, pid), [])) || [];
  const specProposed = await one("SELECT COUNT(*) AS n FROM spec_index WHERE project_id = ? AND state = 'proposed'", pid);
  const tpls = (await safe(() => listTemplates(env, pid), [])) || [];
  const lib = ((await safe(() => env.DB.prepare('SELECT class, COUNT(*) AS n FROM library WHERE project_id = ? GROUP BY class').bind(pid).all(), { results: [] })).results) || [];
  const libBy = Object.fromEntries(lib.map((x) => [x.class, x.n]));
  const held = await one("SELECT COUNT(*) AS n FROM quarantine WHERE project_id = ? AND status = 'held'", pid);
  const failed = await one("SELECT COUNT(*) AS n FROM intake_item WHERE project_id = ? AND state = 'failed'", pid);
  const unknown = await one("SELECT COUNT(*) AS n FROM intake_item WHERE project_id = ? AND family = 'unknown' AND state IN ('proposed','confirmed')", pid);
  const links = ((await safe(() => env.DB.prepare('SELECT state, COUNT(*) AS n FROM kb_link WHERE project_id = ? GROUP BY state').bind(pid).all(), { results: [] })).results) || [];
  const linkBy = Object.fromEntries(links.map((x) => [x.state, x.n]));
  const makers = secs.reduce((n, s) => n + ((s.manufacturers || []).length ? 1 : 0), 0);

  const read = {
    drawings: { current: Object.values(byKind).reduce((a, b) => a + b, 0), by_kind: byKind, awaited, pending_approval: pending },
    boq: { lines: Number(boq && boq.n) || 0, total: Math.round((Number(boq && boq.v) || 0) * 100) / 100 },
    bom: { lines: Number(bom && bom.n) || 0 },
    programme: { activities: Number(acts && acts.n) || 0, data_date: (proj && proj.data_date) || null },
    specification: { sections: secs.length, with_manufacturers: makers },
    contract: { documents: libBy.contract || 0, terms_state: (proj && proj.terms_state) || 'none',
                retention_pct: proj && proj.retention_pct, payment_days: proj && proj.payment_days },
    library: libBy,
  };
  const found = [...new Set(tpls.map((t) => t.doc_type))];
  const templates = { found: found.map((k) => ({ type: k, label: DOC_TYPES[k] || k })),
                      missing: Object.keys(DOC_TYPES).filter((k) => !found.includes(k)).map((k) => ({ type: k, label: DOC_TYPES[k] })) };
  const missing = [];
  if (!read.contract.documents) missing.push('No contract has been filed.');
  if (!read.boq.lines) missing.push('No priced BOQ has been loaded.');
  if (!read.programme.activities) missing.push('No programme (.xer) has been loaded.');
  if (!byKind.ifc) missing.push('No IFC drawings are in the register.');
  if (!secs.length) missing.push(specProposed && specProposed.n ? 'The specification index is waiting for Design to confirm it.' : 'No specification index is live.');
  if (secs.length && !makers) missing.push('No approved manufacturers were found in the specification.');
  if (templates.missing.length) missing.push(templates.missing.length + ' consultant templates are missing: ' + templates.missing.map((t) => t.label).join(', ') + '.');
  if (awaited) missing.push(awaited + ' drawings on the designer’s list have not been received.');
  const flagged = [];
  if (held && held.n) flagged.push(held.n + ' documents are held for AETRAA (another project’s numbering or reference).');
  if (failed && failed.n) flagged.push(failed.n + ' files could not be filed.');
  if (unknown && unknown.n) flagged.push(unknown.n + ' files were not identified.');
  if (read.contract.terms_state === 'pending') flagged.push('The payment terms are waiting for the Principal’s approval.');
  if (pending) flagged.push(pending + ' drawings are waiting for the PM’s approval.');
  if (linkBy.proposed) flagged.push(linkBy.proposed + ' links are proposed and waiting to be confirmed.');
  return {
    read, missing, flagged, templates,
    links: { proposed: linkBy.proposed || 0, confirmed: linkBy.confirmed || 0, rejected: linkBy.rejected || 0 },
    tender_vs_ifc: tenderVsIfc(drawings),
    built_at: nowISO(),
  };
}

// ---------------------------------------------------------------- issue and approve
export async function getKb(env, pid) {
  await ensureKbTables(env);
  const r = await env.DB.prepare('SELECT * FROM kb WHERE project_id = ?').bind(pid).first();
  return r ? { ...r, summary: safeJson(r.summary, null), snapshot: safeJson(r.snapshot, null) } : { project_id: pid, state: 'draft' };
}

export async function issueKb(env, pid, who) {
  await ensureKbTables(env);
  const summary = await buildSummary(env, pid);
  const snap = await snapshot(env, pid);
  const cur = await env.DB.prepare('SELECT version FROM kb WHERE project_id = ?').bind(pid).first();
  const version = ((cur && cur.version) || 0) + 1;
  await env.DB.prepare('DELETE FROM kb WHERE project_id = ?').bind(pid).run();
  await env.DB.prepare(
    `INSERT INTO kb (project_id, state, summary, snapshot, version, issued_by, issued_at) VALUES (?,?,?,?,?,?,?)`
  ).bind(pid, 'issued', JSON.stringify(summary), JSON.stringify(snap), version, str(who, 120), nowISO()).run();
  return { ok: true, state: 'issued', version, summary };
}

export async function approveKb(env, pid, who) {
  const kb = await getKb(env, pid);
  if (kb.state === 'approved') return { ok: true, already: true };
  if (kb.state !== 'issued') return { error: 'AETRAA issues the knowledge base before the PM approves it.' };
  const snap = await snapshot(env, pid);
  await env.DB.prepare('UPDATE kb SET state = ?, approved_by = ?, approved_at = ?, snapshot = ?, reviewed_at = ? WHERE project_id = ?')
    .bind('approved', str(who, 120), nowISO(), JSON.stringify(snap), nowISO(), pid).run();
  return { ok: true, state: 'approved' };
}

// Step 7: what changed since the knowledge base was approved (or since the PM
// last marked the changes reviewed).
export async function kbChanges(env, pid) {
  const kb = await getKb(env, pid);
  if (kb.state !== 'approved' || !kb.snapshot) return { state: kb.state, changes: [] };
  return { state: kb.state, since: kb.reviewed_at || kb.approved_at, changes: diffSnapshots(kb.snapshot, await snapshot(env, pid)) };
}

export async function reviewChanges(env, pid, who) {
  const kb = await getKb(env, pid);
  if (kb.state !== 'approved') return { error: 'the knowledge base is not approved yet' };
  const snap = await snapshot(env, pid);
  await env.DB.prepare('UPDATE kb SET snapshot = ?, reviewed_at = ?, changes_ack = ? WHERE project_id = ?')
    .bind(JSON.stringify(snap), nowISO(), str(who, 120), pid).run();
  return { ok: true };
}

// ---------------------------------------------------------------- AI proposals (P1 steps 2-3)
// What an IFC drawing shows, read by AI: a proposal kept beside the drawing,
// never written into the register.
export async function saveDrawingContents(env, pid, drawing, contents) {
  await ensureKbTables(env);
  await env.DB.prepare('DELETE FROM kb_drawing_contents WHERE project_id = ? AND drawing_id = ? AND confirmed_by IS NULL').bind(pid, drawing.id).run();
  await env.DB.prepare(
    'INSERT INTO kb_drawing_contents (id, project_id, drawing_id, number, contents, source, created_at) VALUES (?,?,?,?,?,?,?)'
  ).bind(uid('kbc'), pid, drawing.id, drawing.number, JSON.stringify(contents), 'ai', nowISO()).run();
}

export async function listDrawingContents(env, pid) {
  await ensureKbTables(env);
  const r = await env.DB.prepare('SELECT * FROM kb_drawing_contents WHERE project_id = ? ORDER BY number').bind(pid).all();
  return (r.results || []).map((x) => ({ ...x, contents: safeJson(x.contents, {}) }));
}

export const CONTENTS_SYSTEM = 'You read construction drawings. You list only what is shown on the sheet. You never invent.';
export const CONTENTS_PROMPT = 'List the building elements, systems and materials shown on this IFC drawing sheet. ' +
  'Answer as JSON only: {"elements": [..], "systems": [..], "materials": [..]} — short phrases, at most 15 each, ' +
  'only what is drawn or written on the sheet.';

export const LINKS_SYSTEM = 'You propose cross-references between construction project documents. You never invent references that are not in the lists given.';
export function linksPrompt(unlinked, targets) {
  return 'Here are items with no link yet and the candidates they may relate to. Propose links only where the two clearly concern the same work. ' +
    'Answer as JSON only: {"links": [{"from_kind": "...", "from_ref": "...", "to_kind": "...", "to_ref": "...", "why": "..."}]} using refs exactly as given.\n\n' +
    'UNLINKED:\n' + unlinked.map((u) => u.kind + '|' + u.ref + '|' + u.label).join('\n') + '\n\nCANDIDATES:\n' +
    targets.map((t) => t.kind + '|' + t.ref + '|' + t.label).join('\n');
}
