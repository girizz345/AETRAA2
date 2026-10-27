// TENDER ↔ IFC DEVIATIONS (P1 step 3; Ajay, 6 Oct 2026, decision 20: build
// the Tender vs IFC agent into the platform).
//
// What was priced (the tender drawings) against what is to be built (the IFC
// drawings). A difference is where a variation starts, so it is found by rule
// and decided by a person:
//
//   1 PAIRING (rule). Each IFC sheet with its tender sheet: by drawing number;
//     else by the number without its stage marks (T-, TD-, -T, -TEN …); else by
//     an identical title. A sheet with no partner is listed: an IFC-only sheet
//     is scope the tender never showed.
//   2 COMPARISON (rule). Each pair's first page, drawn at one scale: the ink
//     each has that the other has not (a pixel or two of drift is forgiven),
//     counted in a grid; the changed cells joined into regions; an overlay
//     image — removed in red, added in green. And the words: lines on one
//     sheet and not the other.
//   3 THE AI (where it is on) looks at the two sheets and the comparison and
//     describes each deviation in plain words: what changed, where, what kind,
//     and whether it may be a variation. It decides nothing.
//   4 A PERSON (Design, the PM or the QS) decides each deviation: a possible
//     variation (listed for the QS), no cost impact, or not a real change.
//     With AI off, each changed line of text is a deviation to decide.

import { callModel, aiEnabled } from './ai.js';
import { getFile, putFile, b64ToBytes } from './storage.js';
import { pdfPageLines } from './pdf-text.js';
import { firstJson } from './ai-readers.js';

export const TIFC_RULES = 'tifc-2026.10.07';
const nowISO = () => new Date().toISOString();
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clean = (s, n = 300) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const safeJson = (s, f) => { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } };
export const DEV_KINDS = ['scope_added', 'scope_removed', 'dimension', 'specification', 'annotation', 'other'];

let ready = false;
export async function ensureTifcTables(env) {
  if (ready) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS tifc_pair (
       id TEXT PRIMARY KEY, project_id TEXT NOT NULL, tender_id TEXT, ifc_id TEXT, number TEXT, title TEXT, paired_by TEXT,
       state TEXT, change_pct REAL, regions TEXT, text_added TEXT, text_removed TEXT, overlay_key TEXT, note TEXT,
       summary TEXT, model TEXT, compared_at TEXT, rules TEXT)`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS tifc_deviation (
       id TEXT PRIMARY KEY, project_id TEXT NOT NULL, pair_id TEXT, number TEXT, what TEXT, kind TEXT, place TEXT, variation INTEGER,
       source TEXT, decision TEXT, note TEXT, decided_by TEXT, decided_at TEXT, created_at TEXT)`
  ).run();
  ready = true;
}

/* ------------------------------------------------------------ 1 pairing */

// A drawing number without its stage marks: T-A-101, A-101-T, A-101 (TENDER) → A-101.
export function baseNumber(n) {
  return String(n || '').toUpperCase().replace(/\s+/g, '')
    .replace(/^(T|TD|TDR|TEN|TENDER|IFC|C|CON)[-_.]/, '').replace(/[-_.](T|TD|TEN|TENDER|IFC)$/, '').replace(/\((TENDER|IFC)\)$/, '');
}
const normTitle = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
export function pairSheets(drawings) {
  const live = (drawings || []).filter((d) => d.status === 'current' || d.status === 'superseded' || d.status === 'pending');
  const newest = (list) => { const by = new Map(); for (const d of list) { const k = String(d.number).toUpperCase(); const p = by.get(k); if (!p || String(d.uploaded_at || '') > String(p.uploaded_at || '')) by.set(k, d); } return [...by.values()]; };
  const tender = newest(live.filter((d) => d.kind === 'tender')), ifc = newest(live.filter((d) => d.kind === 'ifc' && d.status !== 'superseded'));
  const used = new Set(), paired = new Set(), pairs = [];
  const take = (pred, by) => {
    for (const i of ifc) {
      if (paired.has(i)) continue;
      const t = tender.find((x) => !used.has(x) && pred(x, i));
      if (t) { used.add(t); paired.add(i); pairs.push({ tender: t, ifc: i, by }); }
    }
  };
  take((t, i) => String(t.number).toUpperCase() === String(i.number).toUpperCase(), 'number');
  take((t, i) => baseNumber(t.number) && baseNumber(t.number) === baseNumber(i.number), 'number without stage marks');
  take((t, i) => normTitle(t.title).length > 6 && normTitle(t.title) === normTitle(i.title), 'identical title');
  return { pairs, ifc_only: ifc.filter((i) => !paired.has(i)), tender_only: tender.filter((t) => !used.has(t)) };
}

/* ------------------------------------------------------------ 2 comparison */

async function sheetBytes(env, pid, d0) {
  // The register's list leaves the file out; the row carries where it is.
  const d = d0.r2_key || d0.data ? d0 : (await env.DB.prepare('SELECT r2_key, data, mime FROM drawings WHERE project_id = ? AND id = ?').bind(pid, d0.id).first().catch(() => null)) || d0;
  if (d.r2_key) { const f = await getFile(env, d.r2_key).catch(() => null); if (f) return { bytes: f.bytes, mime: d.mime || '' }; }
  if (d.data) { try { return { bytes: b64ToBytes(String(d.data).split(',')[1] || ''), mime: d.mime || '' }; } catch (e) { return null; } }
  return null;
}
async function canvasLib() { try { return await import('@napi-rs/canvas'); } catch (e) { return null; } }
const W = 1400;
// The sheet's first page, drawn W pixels wide on white.
async function drawSheet(C, s) {
  const isPdf = s.bytes[0] === 0x25 && s.bytes[1] === 0x50;
  if (isPdf) {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    let fonts;
    try { const { fileURLToPath } = await import('node:url'); fonts = fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)); } catch (e) { fonts = undefined; }
    const pdf = await getDocument({ data: new Uint8Array(s.bytes), verbosity: 0, isEvalSupported: false, ...(fonts ? { standardFontDataUrl: fonts } : {}) }).promise;
    const page = await pdf.getPage(1);
    const v1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: W / v1.width });
    const cv = C.createCanvas(W, Math.ceil(vp.height));
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    page.cleanup(); await pdf.destroy();
    return cv;
  }
  const img = await C.loadImage(Buffer.from(s.bytes));
  const h = Math.round(img.height * W / img.width);
  const cv = C.createCanvas(W, h);
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, h); ctx.drawImage(img, 0, 0, W, h);
  return cv;
}
// Ink maps at half resolution (a 2×2 block is ink if any pixel is).
function inkMap(cv, w, h) {
  const data = cv.getContext('2d').getImageData(0, 0, w * 2, h * 2).data;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let ink = 0;
    for (let dy = 0; dy < 2 && !ink; dy++) for (let dx = 0; dx < 2 && !ink; dx++) {
      const o = ((y * 2 + dy) * w * 2 + (x * 2 + dx)) * 4;
      if (data[o] + data[o + 1] + data[o + 2] < 600) ink = 1;
    }
    m[y * w + x] = ink;
  }
  return m;
}
const dilated = (m, w, h, x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx]) return true; } return false; };

// → { change_pct, regions: [{x,y,w,h} as fractions], overlay: PNG bytes, note }
export async function compareSheets(a, b) {
  const C = await canvasLib();
  if (!C || !C.createCanvas) return { error: 'this server cannot draw the sheets (the image library is not installed)' };
  const ca = await drawSheet(C, a), cb = await drawSheet(C, b);
  const note = Math.abs(ca.height - cb.height) > 4 ? 'The two sheets are not the same size; they are compared from the top-left corner at the same width.' : '';
  const w = W / 2, h = Math.floor(Math.min(ca.height, cb.height) / 2);
  const A = inkMap(ca, w, h), B = inkMap(cb, w, h);
  const CELL = 16, gw = Math.ceil(w / CELL), gh = Math.ceil(h / CELL);
  const added = new Uint8Array(w * h), removed = new Uint8Array(w * h);
  const cellCount = new Uint16Array(gw * gh), inkCells = new Uint8Array(gw * gh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, c = Math.floor(y / CELL) * gw + Math.floor(x / CELL);
    if (A[i] || B[i]) inkCells[c] = 1;
    if (B[i] && !dilated(A, w, h, x, y)) { added[i] = 1; cellCount[c]++; }
    else if (A[i] && !dilated(B, w, h, x, y)) { removed[i] = 1; cellCount[c]++; }
  }
  const changed = new Uint8Array(gw * gh);
  let nChanged = 0, nInk = 0;
  for (let c = 0; c < gw * gh; c++) { if (inkCells[c]) nInk++; if (cellCount[c] >= 6) { changed[c] = 1; nChanged++; } }
  // Changed cells joined into regions (4-neighbour), each as a fraction of the sheet.
  const seen = new Uint8Array(gw * gh), regions = [];
  for (let c = 0; c < gw * gh; c++) {
    if (!changed[c] || seen[c]) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0; const q = [c]; seen[c] = 1;
    while (q.length) {
      const k = q.pop(), cx = k % gw, cy = Math.floor(k / gw); n++;
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; const nk = ny * gw + nx; if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && changed[nk] && !seen[nk]) { seen[nk] = 1; q.push(nk); } }
    }
    if (n >= 1) regions.push({ x: +(x0 / gw).toFixed(3), y: +(y0 / gh).toFixed(3), w: +((x1 - x0 + 1) / gw).toFixed(3), h: +((y1 - y0 + 1) / gh).toFixed(3), cells: n });
  }
  regions.sort((p, q2) => q2.cells - p.cells);
  // The overlay: both sheets faint, removed in red, added in green, regions boxed.
  const ov = C.createCanvas(w, h), ctx = ov.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    let r = 255, g = 255, bl = 255;
    if (A[i] || B[i]) { r = g = bl = 205; }
    if (removed[i]) { r = 215; g = 30; bl = 30; }
    if (added[i]) { r = 20; g = 160; bl = 50; }
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = bl; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 2;
  for (const rg of regions.slice(0, 40)) ctx.strokeRect(rg.x * w - 3, rg.y * h - 3, rg.w * w + 6, rg.h * h + 6);
  return { change_pct: nInk ? +(100 * nChanged / nInk).toFixed(1) : 0, regions: regions.slice(0, 60), overlay: new Uint8Array(await ov.encode('png')), note,
    images: { tender: new Uint8Array(await ca.encode('png')), ifc: new Uint8Array(await cb.encode('png')) } };
}

// Lines on one sheet and not the other. The title block's own revision and
// date lines are left out — they always differ between stages.
export function textDiff(ta, tb) {
  const lines = (t) => String(t || '').split(/\n|\s{3,}/).map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.length >= 3 && !/^(rev(ision)?|date|drawn|checked|approved|issue|status|stage)\b/i.test(l) && !/^(tender|ifc|issued for construction|for tender)$/i.test(l));
  const A = lines(ta), B = lines(tb);
  const a = new Set(A.map((l) => l.toUpperCase())), b = new Set(B.map((l) => l.toUpperCase()));
  return { added: [...new Set(B.filter((l) => !a.has(l.toUpperCase())))].slice(0, 60), removed: [...new Set(A.filter((l) => !b.has(l.toUpperCase())))].slice(0, 60) };
}

/* ------------------------------------------------------------ 3 the AI */

const SYSTEM = 'You compare a construction drawing\'s TENDER issue with its IFC (issued for construction) issue for a contractor\'s design and '
  + 'commercial team, who decide every line. Describe only differences you can see in the two images or read in the listed text changes. '
  + 'Never estimate cost, never claim an entitlement, never invent a dimension. Answer with JSON only.';
export function deviationPrompt(pair, cmp, txt) {
  return 'Sheet ' + pair.ifc.number + ' — ' + (pair.ifc.title || '') + '. The first image is the TENDER issue, the second the IFC issue. '
    + 'The comparison found ' + cmp.regions.length + ' changed area(s) (' + cmp.change_pct + '% of the drawn area).\n'
    + (txt.added.length ? 'Text only on the IFC: ' + txt.added.slice(0, 25).join(' | ') + '\n' : '')
    + (txt.removed.length ? 'Text only on the tender: ' + txt.removed.slice(0, 25).join(' | ') + '\n' : '')
    + 'List each deviation: what changed (one line), where on the sheet, kind (scope_added, scope_removed, dimension, specification, annotation, other), '
    + 'and variation: true if it may change what the contractor priced (more or different work or material), false if it is only a correction or a note.\n'
    + 'Answer with JSON only: {"summary":"","deviations":[{"what":"","where":"","kind":"","variation":false}]}';
}

/* ------------------------------------------------------------ the run */

// Compare the pairs not compared since either sheet changed, a few at a time.
export async function runComparison(env, pid, drawings, opts = {}) {
  await ensureTifcTables(env);
  const { pairs, ifc_only, tender_only } = pairSheets(drawings);
  const have = new Map((((await env.DB.prepare('SELECT * FROM tifc_pair WHERE project_id = ?').bind(pid).all()).results) || []).map((r) => [r.tender_id + '|' + r.ifc_id, r]));
  const todo = pairs.filter((p) => !have.has(p.tender.id + '|' + p.ifc.id));
  const limit = Math.max(1, Math.min(Number(opts.limit) || 3, 10));
  const results = [];
  const useAi = aiEnabled(env) && opts.useAi !== false;
  for (const p of todo.slice(0, limit)) {
    const id = uid('tp_');
    const a = await sheetBytes(env, pid, p.tender), b = await sheetBytes(env, pid, p.ifc);
    let state = 'compared', cmp = null, txt = { added: [], removed: [] }, note = '', summary = null, model = null, err = null;
    if (!a || !b) { state = 'error'; err = 'one of the two sheets could not be read back'; }
    else {
      try { cmp = await compareSheets(a, b); } catch (e) { cmp = { error: 'the sheets could not be drawn' }; }
      if (cmp.error) { state = 'error'; err = cmp.error; }
      const isPdf = (x) => x.bytes[0] === 0x25 && x.bytes[1] === 0x50;
      if (isPdf(a) && isPdf(b)) { try { const la = await pdfPageLines(a.bytes, { pages: 1 }), lb = await pdfPageLines(b.bytes, { pages: 1 }); txt = textDiff(la.join('\n'), lb.join('\n')); } catch (e) { /* drawings without text */ } }
      if (cmp && !cmp.error) {
        note = cmp.note;
        if (!cmp.regions.length && !txt.added.length && !txt.removed.length) state = 'no_change';
      }
    }
    let overlayKey = null;
    if (cmp && cmp.overlay) { const put = await putFile(env, 'tifc/' + pid + '/' + id + '.png', cmp.overlay, 'image/png'); if (put && put.ok) overlayKey = put.key; }
    const devs = [];
    if (state === 'compared' && useAi) {
      const ans = await callModel(env, { task: 'tifc-deviations', system: SYSTEM, prompt: deviationPrompt(p, cmp, txt),
        documents: [{ bytes: cmp.images.tender, media_type: 'image/png' }, { bytes: cmp.images.ifc, media_type: 'image/png' }], max_tokens: 2500, temperature: 0, project_id: pid, who: opts.who || '' });
      const j = ans.error ? null : firstJson(ans.text);
      if (j && Array.isArray(j.deviations)) {
        model = ans.model; summary = clean(j.summary, 400);
        for (const d of j.deviations.slice(0, 40)) {
          const what = clean(d && d.what, 300);
          if (what) devs.push({ what, kind: DEV_KINDS.includes(String(d.kind)) ? String(d.kind) : 'other', place: clean(d.where, 120), variation: d.variation === true ? 1 : 0, source: 'ai' });
        }
      }
    }
    if (state === 'compared' && !devs.length) {
      // AI off (or no answer): each changed line of text is a deviation to decide; a change only in the drawing is one, by its area.
      for (const l of txt.added) devs.push({ what: 'Only on the IFC: “' + clean(l, 200) + '”', kind: 'other', place: '', variation: 0, source: 'text' });
      for (const l of txt.removed) devs.push({ what: 'Only on the tender: “' + clean(l, 200) + '”', kind: 'other', place: '', variation: 0, source: 'text' });
      if (!txt.added.length && !txt.removed.length && cmp && cmp.regions.length) devs.push({ what: cmp.regions.length + ' area(s) of the drawing changed (' + cmp.change_pct + '%) — see the overlay', kind: 'other', place: '', variation: 0, source: 'drawing' });
    }
    const at = nowISO();
    await env.DB.prepare(`INSERT INTO tifc_pair (id, project_id, tender_id, ifc_id, number, title, paired_by, state, change_pct, regions, text_added, text_removed, overlay_key, note, summary, model, compared_at, rules)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, pid, p.tender.id, p.ifc.id, p.ifc.number, clean(p.ifc.title, 200), p.by, state, cmp && !cmp.error ? cmp.change_pct : null, JSON.stringify(cmp && cmp.regions ? cmp.regions : []),
        JSON.stringify(txt.added), JSON.stringify(txt.removed), overlayKey, err || note || null, summary, model, at, TIFC_RULES).run();
    for (const d of devs) {
      await env.DB.prepare('INSERT INTO tifc_deviation (id, project_id, pair_id, number, what, kind, place, variation, source, decision, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .bind(uid('td_'), pid, id, p.ifc.number, d.what, d.kind, d.place, d.variation, d.source, 'proposed', at).run();
    }
    results.push({ id, number: p.ifc.number, state, change_pct: cmp && !cmp.error ? cmp.change_pct : null, deviations: devs.length });
  }
  return { ok: true, compared: results, remaining: Math.max(0, todo.length - limit), pairs: pairs.length, ifc_only: ifc_only.length, tender_only: tender_only.length };
}

export async function deviationsView(env, pid, drawings) {
  await ensureTifcTables(env);
  const { ifc_only, tender_only } = pairSheets(drawings);
  const pairs = (((await env.DB.prepare('SELECT * FROM tifc_pair WHERE project_id = ? ORDER BY number').bind(pid).all()).results) || [])
    .map((r) => ({ ...r, regions: safeJson(r.regions, []), text_added: safeJson(r.text_added, []), text_removed: safeJson(r.text_removed, []) }));
  const devs = (((await env.DB.prepare('SELECT * FROM tifc_deviation WHERE project_id = ? ORDER BY number, created_at').bind(pid).all()).results) || []);
  return { pairs, deviations: devs, ifc_only: ifc_only.map((d) => ({ id: d.id, number: d.number, title: d.title })), tender_only: tender_only.map((d) => ({ id: d.id, number: d.number, title: d.title })) };
}

// A person's decision on one deviation.
export async function decideDeviation(env, pid, b, who) {
  await ensureTifcTables(env);
  const d = await env.DB.prepare('SELECT * FROM tifc_deviation WHERE project_id = ? AND id = ?').bind(pid, clean(b.id, 60)).first();
  if (!d) return { error: 'no such deviation on this project', status: 404 };
  const decision = ['variation', 'no_impact', 'not_a_change'].includes(String(b.decision)) ? String(b.decision) : '';
  if (!decision) return { error: 'Say whether it is a possible variation, has no cost impact, or is not a real change.', status: 400 };
  const note = clean(b.note, 400);
  if (decision === 'variation' && !note) return { error: 'Say what the variation is — the QS reads it.', status: 400 };
  await env.DB.prepare('UPDATE tifc_deviation SET decision = ?, note = ?, decided_by = ?, decided_at = ? WHERE project_id = ? AND id = ?').bind(decision, note || null, clean(who, 120), nowISO(), pid, d.id).run();
  return { ok: true, decision };
}
