// Uploaded files are served so a browser cannot run them as a page: anything
// but a PDF or a picture comes back as a plain download, whatever type the
// uploader claimed. (A web page uploaded as a "drawing" used to open in the
// site itself and could read other people's data.)
//   node tools/test-upload-safety.mjs
import { call, check, done, onboard, as } from './_harness.mjs';

await onboard('Tower X', 'TX-1', [['The DC', 'dc@tx.test', ['dc']], ['The PM', 'pm@tx.test', ['pm']]]);
await as('dc@tx.test');
const page = Buffer.from('<script>fetch("/api/people").then(r=>r.text()).then(t=>alert(t))</script>').toString('base64');
const safeDownload = (r) => r.headers.get('content-type') === 'application/octet-stream' && /^attachment/.test(r.headers.get('content-disposition') || '') &&
  r.headers.get('x-content-type-options') === 'nosniff';

console.log('— a drawing that is really a web page —');
let r = await call('/api/drawing', { number: 'A-101', kind: 'ifc', filename: 'A-101.pdf', data: 'data:text/html;base64,' + page });
check('the upload itself is accepted', r.status === 200 && r.json.id, r.text);
r = await call('/dwg/' + r.json.id);
check('it comes back as a download, never as a page', r.status === 200 && safeDownload(r), [r.headers.get('content-type'), r.headers.get('content-disposition')]);

console.log('\n— a library file claiming to be text/html —');
r = await call('/api/library', { class: 'other', title: 'x', filename: 'x.html', mime: 'text/html', data: 'data:application/pdf;base64,' + page });
const lid = r.json && (r.json.id || (r.json.doc && r.json.doc.id));
check('the upload is accepted', r.status === 200 && lid, r.text);
r = await call('/api/library/file?id=' + lid);
check('it comes back as a download', r.status === 200 && safeDownload(r), [r.headers.get('content-type'), r.headers.get('content-disposition')]);

console.log('\n— a real PDF still opens in the browser —');
const pdf = Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64');
r = await call('/api/library', { class: 'other', title: 'spec', filename: 'spec.pdf', mime: 'application/pdf', data: 'data:application/pdf;base64,' + pdf });
r = await call('/api/library/file?id=' + (r.json.id || r.json.doc.id));
check('shown inline as a PDF', r.headers.get('content-type') === 'application/pdf' && /^inline/.test(r.headers.get('content-disposition') || ''), [r.headers.get('content-type'), r.headers.get('content-disposition')]);

done();
