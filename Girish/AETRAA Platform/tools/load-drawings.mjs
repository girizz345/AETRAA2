// Bulk-load a real drawing set into the register, backed by object storage.
//
//   node tools/load-drawings.mjs <project_id> <kind> "<folder>" [more folders…]
//
// It walks each folder, reads the number/revision/title off every file name and
// the discipline off the sub-folder, and writes two things next to each other:
//
//   out/r2-upload.sh          — one `wrangler r2 object put` per sheet
//   out/drawings-<pid>.sql    — the register rows, each pointing at its R2 key
//
// The bytes never touch the database. A sheet of any size is fine, because the
// register only ever holds the key and the file lives in R2.
//
// It does not talk to Cloudflare itself — it only writes the two scripts, which
// you run. So it is safe to run as often as you like while getting the tagging
// right; nothing is uploaded or changed until you run r2-upload.sh.
//
// Run it once per kind:
//   node tools/load-drawings.mjs j179 tender "…/Tender Drawings "
//   node tools/load-drawings.mjs j179 ifc    "…/IFC Drawings "
// then:
//   bash out/r2-upload.sh
//   npx wrangler d1 execute jbbc-site-monitor --remote --file=out/drawings-j179.sql
//   npx wrangler deploy

import { readdirSync, statSync, mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { createHash } from 'node:crypto';

const [pid, kind, ...folders] = process.argv.slice(2);
if (!pid || !kind || !folders.length) {
  console.error('usage: node tools/load-drawings.mjs <project_id> <kind> "<folder>" [more…]');
  process.exit(1);
}
const KINDS = ['tender', 'ifc', 'shop', 'spec', 'sketch', 'other'];
if (!KINDS.includes(kind)) {
  console.error(`kind must be one of: ${KINDS.join(', ')}`);
  process.exit(1);
}
const BUCKET = process.env.BUCKET || `${pid}-drawings`;

// The same reading the app does — number, revision and title off the file name.
function fromFileName(name) {
  const raw = String(name || '').replace(/\.[a-z0-9]+$/i, '').trim();
  if (!raw) return {};
  const out = {};
  const base = raw.replace(/_/g, ' ');
  const num = base.match(/\b([A-Z]{1,4}[- ]?\d{1,5}(?:-\d{1,3})?)(?![A-Z0-9])/i);
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

// The sub-folder is the discipline. "01-ARCHITECTURE" -> "Architecture",
// "03-HVAC (AC)" -> "HVAC (AC)". Short all-caps words are acronyms and kept.
function disciplineOf(rel) {
  const top = rel.split('/')[0] || '';
  const cleaned = top.replace(/^\d+[-_ ]*/, '').trim();
  if (!cleaned) return '';
  return cleaned.split(/\s+/).map((w) =>
    /[()]/.test(w) || /^[A-Z0-9]{2,5}$/.test(w)
      ? w
      : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

function walk(dir, rel = '') {
  let out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const r = rel ? rel + '/' + name : name;
    const st = statSync(full);
    if (st.isDirectory()) out = out.concat(walk(full, r));
    else if (/\.pdf$/i.test(name)) out.push({ full, rel: r, size: st.size });
  }
  return out;
}

const sqlStr = (v) => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

// Gather every file across the folders given for this kind.
let files = [];
for (const f of folders) {
  if (!existsSync(f)) { console.error(`no such folder: ${f}`); process.exit(1); }
  files = files.concat(walk(f));
}
files.sort((a, b) => a.rel.localeCompare(b.rel));

// Build a register row per file.
const rows = files.map((f) => {
  const fn = basename(f.rel);
  const g = fromFileName(fn);
  const revised = /\(revised\)|revised|\bapp\b/i.test(fn);
  const number = g.number || fn.replace(extname(fn), '').slice(0, 60);
  const key = `${pid}/${kind}/${number.replace(/[^A-Za-z0-9._-]+/g, '_')}-${createHash('sha1').update(f.rel).digest('hex').slice(0, 8)}.pdf`;
  return {
    ...f, number, revision: g.revision || (revised ? 'B' : 'A'),
    title: g.title || '', discipline: disciplineOf(f.rel), revised, key,
  };
});

// Where two files carry the same number in this kind, the newest/"revised" one
// is live and the rest are superseded — so the register never shows two live of
// one number, exactly as an upload would behave.
const byNumber = {};
for (const r of rows) (byNumber[r.number] || (byNumber[r.number] = [])).push(r);
const rank = (r) => (r.revised ? 2 : 0);
for (const num of Object.keys(byNumber)) {
  const grp = byNumber[num].sort((a, b) => rank(a) - rank(b) || a.rel.localeCompare(b.rel));
  const live = grp[grp.length - 1];
  live.status = 'current';
  for (const r of grp) if (r !== live) { r.status = 'superseded'; r.superseded_by = live.id; }
}

// Ids are needed for superseded_by, so assign them, then wire the links.
let n = 0;
for (const r of rows) r.id = `dwg_${createHash('sha1').update(r.key).digest('hex').slice(0, 16)}`;
for (const num of Object.keys(byNumber)) {
  const grp = byNumber[num];
  const live = grp.find((r) => r.status === 'current');
  for (const r of grp) if (r.status === 'superseded') r.superseded_by = live.id;
}

const outDir = join(process.cwd(), 'out');
mkdirSync(outDir, { recursive: true });
const shPath = join(outDir, 'r2-upload.sh');
const sqlPath = join(outDir, `drawings-${pid}.sql`);

// The upload script — appended to across kinds, so run the loader for each kind
// first, then run r2-upload.sh once.
if (!existsSync(shPath)) {
  writeFileSync(shPath, `#!/bin/bash\n# Uploads every drawing to R2 bucket ${BUCKET}.\n` +
    `# Generated by tools/load-drawings.mjs — run: bash out/r2-upload.sh\nset -euo pipefail\n\n`);
}
for (const r of rows) {
  appendFileSync(shPath, `npx --yes wrangler r2 object put ${BUCKET}/${r.key} ` +
    `--file=${JSON.stringify(r.full)} --content-type=application/pdf --remote\n`);
}

const now = new Date().toISOString();
const header = `-- ${rows.length} ${kind} drawings for ${pid}, generated ${now}\n`;
const sql = rows.map((r) =>
  `INSERT OR REPLACE INTO drawings (project_id,id,number,revision,title,kind,discipline,` +
  `status,superseded_by,mime,size,r2_key,uploaded_by,uploaded_at,approved_by,approved_at) VALUES (` +
  `${sqlStr(pid)},${sqlStr(r.id)},${sqlStr(r.number)},${sqlStr(r.revision)},${sqlStr(r.title)},` +
  `${sqlStr(kind)},${sqlStr(r.discipline)},${sqlStr(r.status)},${sqlStr(r.superseded_by || null)},` +
  `'application/pdf',${r.size},${sqlStr(r.key)},'(bulk load)',${sqlStr(now)},'(bulk load)',${sqlStr(now)});`
).join('\n') + '\n';
if (!existsSync(sqlPath)) writeFileSync(sqlPath, '');
appendFileSync(sqlPath, header + sql);

const live = rows.filter((r) => r.status === 'current').length;
console.log(`${kind}: ${rows.length} sheets (${live} live, ${rows.length - live} superseded), ` +
  `${(rows.reduce((s, r) => s + r.size, 0) / 1048576).toFixed(1)} MB`);
console.log(`  → appended ${rows.length} uploads to out/r2-upload.sh`);
console.log(`  → appended ${rows.length} rows to out/drawings-${pid}.sql`);
