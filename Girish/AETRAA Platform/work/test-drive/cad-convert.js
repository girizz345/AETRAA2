// DWG → DXF, so a drawing's title block can be read.
//
// WHY THIS FILE SITS OUTSIDE src/
//
// Everything under src/ runs unchanged on Cloudflare Workers, where there is no
// filesystem and no way to start a process. Converting a DWG needs both. So the
// conversion lives here, beside server.js, and is handed to the app through
// `env` the way the database and the mail key are. On Cloudflare `env.CONVERT_CAD`
// is simply absent and intake falls back to the file name, which is exactly what
// it did before this existed.
//
// WHY THE CONVERTER IS NOT NAMED IN THE CODE
//
// There is no DWG reader in the Ubuntu repositories, and the two that exist are
// installed by hand: LibreDWG's `dwg2dxf`, built from source, and the Open
// Design Alliance's `ODAFileConverter`, downloaded after accepting their
// licence. Which one an operator ends up with is their decision, not ours, and
// a platform that only works with the one we guessed is a platform that does
// not work. So this looks for either, uses whichever is there, and says plainly
// when there is neither.
//
// WHAT IS NOT KEPT
//
// The DXF is a means of reading the sheet, never a record. It is written to a
// private temporary directory, read once, and the whole directory is removed —
// on the error path too. The DWG the customer dropped is the document; the DXF
// is scaffolding and is not allowed to outlive the read.
//
// WHAT PROTECTS THE SERVER
//
// A 1 GB machine serves every customer on the platform. A 200 MB model file
// converted without limits takes the site down for all of them, so: a size cap
// before anything starts, a wall-clock timeout that kills the process, and one
// conversion at a time. A conversion that cannot be done inside those limits is
// reported as unread, which is honest and costs one drawing's title rather than
// everybody's afternoon.

import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A drawing sheet is a few MB. A federated model is hundreds, carries no title
// block worth reading, and is not what this is for.
const MAX_BYTES = 64 * 1024 * 1024;
const TIMEOUT_MS = 45000;
const MAX_DXF_BYTES = 256 * 1024 * 1024;

// One at a time. Two concurrent conversions on a 1 GB box is how a drop of
// forty DWGs becomes an outage.
let busy = Promise.resolve();

function run(cmd, args, { cwd, timeout = TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      resolve({ ok: false, code: -1, err: String(e && e.message || e) });
      return;
    }
    let err = '', out = '', done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (e) {}
      finish({ ok: false, code: -1, err: 'conversion timed out' });
    }, timeout);
    child.stdout.on('data', (d) => { if (out.length < 8000) out += String(d); });
    child.stderr.on('data', (d) => { if (err.length < 8000) err += String(d); });
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, code: -1, err: String(e && e.message || e) }); });
    child.on('close', (code) => { clearTimeout(timer); finish({ ok: code === 0, code, out, err }); });
  });
}

async function have(cmd) {
  const r = await run('sh', ['-c', 'command -v ' + JSON.stringify(cmd)], { timeout: 4000 });
  return r.ok;
}

// Which converter this machine has, worked out once and remembered. A server
// that gains one after starting is restarted by the installer anyway.
let converterPromise = null;
export function detectConverter() {
  if (!converterPromise) {
    converterPromise = (async () => {
      if (await have('dwg2dxf')) return 'libredwg';
      if (await have('ODAFileConverter')) return 'oda';
      return null;
    })();
  }
  return converterPromise;
}

// ODA writes into an output DIRECTORY rather than to a named file, and on most
// builds wants a display even with no window to draw. xvfb-run supplies one.
async function convertOda(dir, inName) {
  const outDir = join(dir, 'out');
  const args = [dir, outDir, 'ACAD2018', 'DXF', '0', '1'];
  let r = await run('ODAFileConverter', args, { cwd: dir });
  if (!r.ok && await have('xvfb-run')) {
    r = await run('xvfb-run', ['-a', 'ODAFileConverter', ...args], { cwd: dir });
  }
  // ODA reports success on its exit code unreliably; the output file is truth.
  const files = await readdir(outDir).catch(() => []);
  const dxf = files.find((f) => /\.dxf$/i.test(f));
  if (!dxf) return { error: r.err || 'the converter produced no DXF' };
  return { path: join(outDir, dxf) };
}

async function convertLibreDwg(dir, inName) {
  const outPath = join(dir, 'out.dxf');
  const r = await run('dwg2dxf', ['-o', outPath, join(dir, inName)], { cwd: dir });
  const files = await readdir(dir).catch(() => []);
  if (!files.includes('out.dxf')) {
    return { error: r.err || 'the converter produced no DXF' };
  }
  return { path: outPath };
}

/**
 * Convert DWG bytes to DXF text. Returns { dxf } or { error }.
 * Never throws, and never leaves a file behind.
 */
export async function convertCad(bytes, filename = 'drawing.dwg') {
  if (!bytes || !bytes.length) return { error: 'no bytes' };
  if (bytes.length > MAX_BYTES) {
    return { error: `that CAD file is ${Math.round(bytes.length / 1048576)} MB, over the `
                  + `${Math.round(MAX_BYTES / 1048576)} MB limit for reading a title block` };
  }
  const which = await detectConverter();
  if (!which) {
    return { error: 'no DWG converter is installed on this server — install LibreDWG (dwg2dxf) '
                  + 'or the ODA File Converter to read DWG title blocks' };
  }

  // Queue behind whatever is converting now, and make sure a failure here does
  // not leave the queue permanently broken.
  const mine = busy.then(() => doConvert(bytes, filename, which), () => doConvert(bytes, filename, which));
  busy = mine.then(() => {}, () => {});
  return mine;
}

async function doConvert(bytes, filename, which) {
  let dir = null;
  try {
    dir = await mkdtemp(join(tmpdir(), 'aetraa-cad-'));
    const inName = 'in' + (/\.dxf$/i.test(filename) ? '.dxf' : '.dwg');
    await writeFile(join(dir, inName), bytes);

    const r = which === 'oda' ? await convertOda(dir, inName) : await convertLibreDwg(dir, inName);
    if (r.error) return { error: r.error, converter: which };

    const buf = await readFile(r.path).catch(() => null);
    if (!buf || !buf.length) return { error: 'the converted DXF was empty', converter: which };
    if (buf.length > MAX_DXF_BYTES) return { error: 'the converted DXF was too large to read', converter: which };

    return { dxf: buf.toString('latin1'), converter: which };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  } finally {
    // The DXF is scaffolding. It does not outlive the read, on any path.
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
