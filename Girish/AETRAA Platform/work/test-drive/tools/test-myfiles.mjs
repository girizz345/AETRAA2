// My files (src/myfiles.js): each person's own private files — upload, list,
// folders, open, rename, move, delete, a storage limit, attach to a record —
// and that nobody else, inside the company or outside it, reaches them.
//   node tools/test-myfiles.mjs
import { db, env, call, callRaw, check, done, onboard, as, admin } from './_harness.mjs';

const enc = (s) => new TextEncoder().encode(s);
const pdf = enc('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const up = (folder, name, bytes) => callRaw('/api/myfiles/upload?folder=' + encodeURIComponent(folder) + '&name=' + encodeURIComponent(name), bytes);

const { pid } = await onboard('Files Tower', 'FT-1', [['The Designer', 'design@ft.test', ['design']], ['The PM', 'pm@ft.test', ['pm']]]);
await onboard('Other Co', 'OC-1', [['Outsider', 'out@oc.test', ['pm']]]);

console.log('— nobody signed in —');
await call('/api/logout');
let r = await call('/api/myfiles');
check('the API needs a signed-in person', r.status === 401);
await admin();
r = await call('/api/myfiles');
check('the owner code (no person) has no files of its own', r.status === 401);

console.log('\n— upload and list —');
await as('design@ft.test');
r = await call('/api/myfiles');
check('an empty drive to start', r.status === 200 && r.json.folder === '/' && r.json.files.length === 0 && r.json.usage.used === 0, r.text);
r = await up('/', 'Level 3 notes.pdf', pdf);
check('a PDF uploads', r.status === 200 && r.json.ok && r.json.size === pdf.length, r.text);
const pdfId = r.json.id;
r = await up('/Site photos', 'slab.png', png);
check('a picture uploads into a new folder', r.status === 200 && r.json.folder === '/Site photos', r.text);
const pngId = r.json.id;
r = await up('/', 'model.rvt', enc('RVT bytes'));
check('a Revit model is kept', r.status === 200, r.text);
const rvtId = r.json.id;
r = await call('/api/myfiles');
check('the top folder lists the files and the sub-folder', r.json.files.length === 2 && r.json.folders.includes('Site photos'), r.text);
check('usage is counted', r.json.usage.used === pdf.length + 9 + png.length && r.json.usage.files === 3, r.json.usage);
const row = db.prepare('SELECT * FROM user_files WHERE id = ?').get(pdfId);
check('the stored key is the person’s own, not the file’s name', row.file_key.startsWith('myfiles/') && !row.file_key.includes('Level'), row.file_key);

console.log('\n— what is refused —');
for (const [name, why] of [['page.html', 'a web page'], ['logo.svg', 'an SVG'], ['setup.exe', 'a program'], ['run.ps1', 'a script'], ['x.js', 'a script']]) {
  r = await up('/', name, enc('<script>alert(1)</script>'));
  check(why + ' (' + name + ') is refused', r.status === 400, r.text);
}
r = await up('/', 'empty.txt', new Uint8Array(0));
check('an empty file is refused', r.status === 400);
r = await up('/../../etc', 'x.pdf', pdf);
check('a path with .. is folded back inside the drive', r.status === 200 && r.json.folder === '/etc', r.text);
await call('/api/myfiles/delete', { id: r.json.id });

console.log('\n— opening a file —');
r = await call('/api/myfiles/file?id=' + pdfId);
check('a PDF opens in the browser, not sniffed', r.status === 200 && r.headers.get('content-type') === 'application/pdf' &&
  /^inline/.test(r.headers.get('content-disposition')) && r.headers.get('x-content-type-options') === 'nosniff', [...r.headers]);
check('and comes back byte for byte', r.bytes.length === pdf.length && r.bytes.every((b, i) => b === pdf[i]));
r = await call('/api/myfiles/file?id=' + pdfId + '&download=1');
check('…or downloads when asked', /^attachment/.test(r.headers.get('content-disposition')));
r = await call('/api/myfiles/file?id=' + pngId);
check('a picture opens sandboxed (it can run nothing)', r.headers.get('content-type') === 'image/png' && /sandbox/.test(r.headers.get('content-security-policy') || ''));
r = await call('/api/myfiles/file?id=' + rvtId);
check('anything else only downloads, as plain bytes', r.headers.get('content-type') === 'application/octet-stream' && /^attachment/.test(r.headers.get('content-disposition')));

console.log('\n— rename, move, replace, folders, search —');
r = await call('/api/myfiles/rename', { id: pdfId, name: 'L3 notes.pdf' });
check('rename', r.status === 200);
r = await call('/api/myfiles/rename', { id: pdfId, name: 'L3 notes.html' });
check('renaming into a web page is refused', r.status === 400);
r = await call('/api/myfiles/move', { id: pdfId, folder: '/Site photos' });
check('move', r.status === 200 && db.prepare('SELECT folder FROM user_files WHERE id = ?').get(pdfId).folder === '/Site photos');
r = await up('/Site photos', 'slab.png', Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 1]));
check('the same name in the same folder replaces it', r.status === 200 && r.json.replaced && r.json.id === pngId, r.text);
r = await call('/api/myfiles/folder', { path: '/Contracts' });
r = await call('/api/myfiles');
check('an empty folder shows', r.json.folders.includes('Contracts'));
r = await call('/api/myfiles/folder/delete', { path: '/Site photos' });
check('a folder with files cannot be removed', r.status === 400);
r = await call('/api/myfiles/folder/delete', { path: '/Contracts' });
check('an empty one can', r.status === 200 && !(await call('/api/myfiles')).json.folders.includes('Contracts'));
r = await call('/api/myfiles/search?q=notes');
check('search finds by name across folders', r.json.files.length === 1 && r.json.files[0].id === pdfId, r.text);

console.log('\n— nobody else —');
await as('pm@ft.test');
r = await call('/api/myfiles');
check('a colleague sees an empty drive of their own', r.json.files.length === 0);
r = await call('/api/myfiles/file?id=' + pdfId);
check('a colleague cannot open the file by its id', r.status === 404);
r = await call('/api/myfiles/delete', { id: pdfId });
check('…nor delete it', r.status === 400 && db.prepare('SELECT COUNT(*) AS n FROM user_files WHERE id = ?').get(pdfId).n === 1);
r = await call('/api/myfiles/rename', { id: pdfId, name: 'mine now.pdf' });
check('…nor rename it', r.status === 400);
await as('out@oc.test');
r = await call('/api/myfiles/file?id=' + pdfId);
check('another company cannot open it either', r.status === 404);

console.log('\n— attach to a record —');
await as('design@ft.test');
const rfi = (await call('/api/records', { type: 'rfi', title: 'Slab edge detail', data: { Question: 'Which edge detail?' } })).json.ref;
r = await call('/api/myfiles/attach', { id: pdfId, ref: rfi });
check('a file is attached to a record on the project', r.status === 200 && r.json.ok, r.text);
r = await call('/api/attachments?ref=' + encodeURIComponent(rfi));
check('and shows on the record for the team', JSON.stringify(r.json).includes('L3 notes.pdf'), r.text);
r = await call('/api/myfiles/attach', { id: rvtId, ref: rfi });
check('a type a record does not carry (RVT) is refused by the record’s own rule', r.status === 400, r.text);
check('the original stays in My files', (await call('/api/myfiles/file?id=' + pdfId)).status === 200);

console.log('\n— the storage limit —');
env.MYFILES_QUOTA_MB = '1';
r = await up('/', 'big.zip', new Uint8Array(1100000));
check('over the limit is refused with a 413', r.status === 413 && r.json.quota, r.text);
delete env.MYFILES_QUOTA_MB;
env.MYFILES_MAX_MB = '1';
r = await up('/', 'big.zip', new Uint8Array(1100000));
check('a single file over the size cap is refused', r.status === 413, r.text);
delete env.MYFILES_MAX_MB;

console.log('\n— delete —');
r = await call('/api/myfiles/delete', { id: rvtId });
check('delete removes it', r.status === 200 && (await call('/api/myfiles/file?id=' + rvtId)).status === 404);

console.log('\n— the page —');
r = await call('/myfiles');
check('the My files page opens', r.status === 200 && r.text.includes('My files') && r.text.includes('/api/myfiles/upload'));
r = await call('/');
check('every dashboard’s menu has My files', r.text.includes("'My files',''") && r.text.includes("'My files': { page: '/myfiles' }"));

done();
