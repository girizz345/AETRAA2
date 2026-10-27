// ATTACHMENTS. The files that hang off a record — the gap that made a WIR
// "with all attachments" impossible.
//
//   node tools/test-attachments.mjs
import { DatabaseSync } from 'node:sqlite';
import {
  addAttachment, listAttachments, getAttachment, removeAttachment, removeAllFor,
  attachmentCounts, checkUpload, humanSize, MAX_ATTACHMENT, MAX_PER_RECORD, ALLOWED,
} from '../src/attachments.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };

function makeDb() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql) => {
    const st = db.prepare(sql); let args = [];
    const api = { bind(...a) { args = a; return api; },
      async all() { return { results: st.all(...args), success: true }; },
      async first(c) { const r = st.get(...args) ?? null; return c && r ? r[c] : r; },
      async run() { st.run(...args); return { success: true, meta: {} }; } };
    return api;
  };
  return { prepare: stmt, async exec(s) { db.exec(s); return { count: 1 }; } };
}
const env = () => ({ DB: makeDb() });
const PDF = new Uint8Array(40000).map((_, i) => (i * 13) % 256);
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);

// ---- what may be attached ----------------------------------------------
check('a PDF is allowed', checkUpload('L4 slab.pdf', 'application/pdf', 1000).ok === true);
check('a photograph is allowed', checkUpload('pour.jpg', 'image/jpeg', 1000).ok === true);
check('a Word file is allowed',
  checkUpload('method.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1000).ok === true);
check('a DWG is allowed', checkUpload('plan.dwg', 'application/octet-stream', 1000).ok === true);

check('a program is REFUSED', !!checkUpload('setup.exe', 'application/octet-stream', 1000).error,
  'a platform that forwards whatever it was given is a delivery service for malware');
check('a script is REFUSED', !!checkUpload('run.sh', 'application/octet-stream', 1000).error);
check('an HTML page is REFUSED', !!checkUpload('page.html', 'text/html', 1000).error);
check('an SVG is REFUSED', !!checkUpload('logo.svg', 'image/svg+xml', 1000).error);
check('the check is case-blind', !!checkUpload('SETUP.EXE', 'application/octet-stream', 1000).error);
check('an unknown media type is REFUSED', !!checkUpload('x.odt', 'application/vnd.oasis.opendocument.text', 10).error);

check('an empty file is refused', !!checkUpload('a.pdf', 'application/pdf', 0).error);
check('a nameless file is refused', !!checkUpload('   ', 'application/pdf', 10).error);
check('a file over 25 MB is refused', !!checkUpload('huge.pdf', 'application/pdf', MAX_ATTACHMENT + 1).error);
check('and 25 MB exactly is accepted', checkUpload('big.pdf', 'application/pdf', MAX_ATTACHMENT).ok === true);
check('a path in the name is flattened',
  checkUpload('../../etc/passwd.pdf', 'application/pdf', 10).name === '.._.._etc_passwd.pdf',
  checkUpload('../../etc/passwd.pdf', 'application/pdf', 10).name);

check('sizes read the way a person says them', humanSize(900) === '900 B' && humanSize(2048) === '2 KB' &&
  humanSize(3 * 1024 * 1024) === '3.0 MB' && humanSize(20 * 1024 * 1024) === '20 MB',
  [humanSize(900), humanSize(2048), humanSize(3 * 1024 * 1024), humanSize(20 * 1024 * 1024)].join(' | '));

// ---- adding, listing, fetching -----------------------------------------
{
  const e = env();
  const a = await addAttachment(e, 'p1', 'WIR-001', 'L4 slab pre-pour.pdf', 'application/pdf', PDF, 'R. Kumar');
  check('an attachment is added', a.ok === true, JSON.stringify(a));
  check('it reports a readable size', a.size_text === '39 KB', a.size_text);

  const list = await listAttachments(e, 'p1', 'WIR-001');
  check('it appears against its record', list.length === 1 && list[0].filename === 'L4 slab pre-pour.pdf', JSON.stringify(list));
  check('it names who attached it', list[0].uploaded_by === 'R. Kumar', list[0].uploaded_by);

  const got = await getAttachment(e, 'p1', a.id);
  check('the file itself comes back', same(got && got.bytes, PDF), got ? String(got.bytes.length) : 'nothing');
  check('with its name and type', got.filename === 'L4 slab pre-pour.pdf' && got.mime === 'application/pdf');

  // THE ONE THAT MATTERS: another project must not be able to read it.
  check('another project CANNOT fetch it', (await getAttachment(e, 'p2', a.id)) === null,
    'one database holds every client — this is the wall between them');
  check('nor list it', (await listAttachments(e, 'p2', 'WIR-001')).length === 0);
  check('nor remove it', !!(await removeAttachment(e, 'p2', a.id)).error);
  check('and it is still there afterwards', (await listAttachments(e, 'p1', 'WIR-001')).length === 1);

  const rm = await removeAttachment(e, 'p1', a.id);
  check('the owner can remove it', rm.ok === true, JSON.stringify(rm));
  check('it is gone from the list', (await listAttachments(e, 'p1', 'WIR-001')).length === 0);
  check('and the file itself is gone too', (await getAttachment(e, 'p1', a.id)) === null,
    'a file that outlives its record turns up in the wrong hands later');
}

// ---- several records, several files -------------------------------------
{
  const e = env();
  await addAttachment(e, 'p1', 'WIR-001', 'a.pdf', 'application/pdf', PDF, 'R. Kumar');
  await addAttachment(e, 'p1', 'WIR-001', 'b.jpg', 'image/jpeg', PDF, 'R. Kumar');
  await addAttachment(e, 'p1', 'SUB-004', 'c.pdf', 'application/pdf', PDF, 'S. Menon');
  await addAttachment(e, 'p2', 'WIR-001', 'other-company.pdf', 'application/pdf', PDF, 'X');

  check('each record keeps its own files', (await listAttachments(e, 'p1', 'WIR-001')).length === 2);
  check('and another record is unaffected', (await listAttachments(e, 'p1', 'SUB-004')).length === 1);

  const counts = await attachmentCounts(e, 'p1');
  check('the register gets its counts in one query', counts['WIR-001'] === 2 && counts['SUB-004'] === 1,
    JSON.stringify(counts));
  check('counts do not leak across projects', !Object.keys(await attachmentCounts(e, 'p2')).some((k) => counts[k] === 99) &&
    (await attachmentCounts(e, 'p2'))['WIR-001'] === 1, JSON.stringify(await attachmentCounts(e, 'p2')));

  const all = await listAttachments(e, 'p1');
  check('a project-wide list shows all of its own, and only its own',
    all.length === 3 && all.every((x) => x.filename !== 'other-company.pdf'), String(all.length));

  const cleared = await removeAllFor(e, 'p1', 'WIR-001');
  check('a record can be cleared in one go', cleared.ok && cleared.removed === 2, JSON.stringify(cleared));
  check('and only that record', (await listAttachments(e, 'p1', 'SUB-004')).length === 1);
  check('the other company is untouched', (await listAttachments(e, 'p2', 'WIR-001')).length === 1);
}

// ---- the limit per record ------------------------------------------------
{
  const e = env();
  const tiny = new Uint8Array([1, 2, 3]);
  let last = null;
  for (let i = 0; i < MAX_PER_RECORD + 2; i++) {
    last = await addAttachment(e, 'p1', 'WIR-009', 'f' + i + '.pdf', 'application/pdf', tiny, 'R');
  }
  check('a record stops accepting files past its limit', !!last.error, JSON.stringify(last));
  check('and holds exactly the limit', (await listAttachments(e, 'p1', 'WIR-009')).length === MAX_PER_RECORD,
    String((await listAttachments(e, 'p1', 'WIR-009')).length));
}

// ---- a file with no record is refused ------------------------------------
{
  const e = env();
  check('an attachment must belong to something', !!(await addAttachment(e, 'p1', '', 'a.pdf', 'application/pdf', PDF, 'R')).error);
  check('and to a project', !!(await addAttachment(e, '', 'WIR-001', 'a.pdf', 'application/pdf', PDF, 'R')).error);
  check('a refused file leaves nothing behind', (await listAttachments(e, 'p1', 'WIR-001')).length === 0);
}

// ---- a real drawing, through the database driver --------------------------
{
  const e = env();
  const BIG = new Uint8Array(4 * 1024 * 1024).map((_, i) => (i * 7 + (i >> 9)) % 256);
  const a = await addAttachment(e, 'p1', 'SUB-010', 'GA plan Rev C.pdf', 'application/pdf', BIG, 'S. Menon');
  check('a 4 MB drawing attaches with no bucket configured', a.ok === true, JSON.stringify(a));
  const got = await getAttachment(e, 'p1', a.id);
  check('and comes back byte for byte', same(got && got.bytes, BIG),
    got ? String(got.bytes.length) + ' of ' + BIG.length : 'nothing');
}

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
