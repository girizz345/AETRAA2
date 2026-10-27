// An Outlook .msg, read by rule (Ajay, 6 Oct 2026, decision 15).
//
// A .msg is a Compound File (MS-CFB): a small FAT file system inside one file.
// Outlook keeps each property of the message as a stream named
// "__substg1.0_<id><type>" (MS-OXMSG), and the fixed-size ones (the date) in
// "__properties_version1.0". This reads the top-level message only — the
// subject, the sender, who it went to, the date and the plain-text body — and
// gives them in the same shape as parseEml, so a dropped .msg is read like an
// .eml. Attachments and recipients' own storages are not opened. Nothing here
// is a guess: a value that is not in the file is left empty.

const SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const FREE = 0xffffffff, END = 0xfffffffe;

export function isCfb(bytes) {
  const b = bytes || [];
  return b.length >= 512 && SIG.every((x, i) => b[i] === x);
}

// The streams directly under the root storage: name → bytes.
export function cfbStreams(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (!isCfb(u8)) throw new Error('not a compound file');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const u32 = (o) => dv.getUint32(o, true), u16 = (o) => dv.getUint16(o, true);
  const shift = u16(0x1e), size = 1 << shift, miniSize = 1 << u16(0x20);
  if (shift !== 9 && shift !== 12) throw new Error('unsupported sector size');
  const cutoff = u32(0x38) || 4096;
  const sectorAt = (n) => (n + 1) * size;
  // The FAT sectors: 109 in the header, the rest down the DIFAT chain.
  const fatSectors = [];
  for (let i = 0; i < 109; i++) { const s = u32(0x4c + i * 4); if (s !== FREE && s !== END) fatSectors.push(s); }
  let dif = u32(0x44), guard = 0;
  while (dif !== END && dif !== FREE && guard++ < 1000) {
    const o = sectorAt(dif), per = size / 4 - 1;
    for (let i = 0; i < per; i++) { const s = u32(o + i * 4); if (s !== FREE && s !== END) fatSectors.push(s); }
    dif = u32(o + per * 4);
  }
  const fat = [];
  for (const s of fatSectors) { const o = sectorAt(s); for (let i = 0; i < size / 4; i++) fat.push(u32(o + i * 4)); }
  const chain = (start, table) => {
    const out = [];
    let s = start, n = 0;
    while (s !== END && s !== FREE && s < table.length && n++ < 1e6) { out.push(s); s = table[s]; }
    return out;
  };
  const readChain = (start, len) => {
    const out = new Uint8Array(len); let at = 0;
    for (const s of chain(start, fat)) { const o = sectorAt(s); const take = Math.min(size, len - at); if (take <= 0) break; out.set(u8.subarray(o, o + take), at); at += take; }
    return out.subarray(0, at);
  };
  // The directory.
  const dirBytes = readChain(u32(0x30), chain(u32(0x30), fat).length * size);
  const entries = [];
  for (let o = 0; o + 128 <= dirBytes.length; o += 128) {
    const e = new DataView(dirBytes.buffer, dirBytes.byteOffset + o, 128);
    const nlen = e.getUint16(0x40, true);
    let name = '';
    for (let i = 0; i + 1 < Math.max(0, nlen - 2); i += 2) name += String.fromCharCode(e.getUint16(i, true));
    entries.push({ name, type: e.getUint8(0x42), left: e.getUint32(0x44, true), right: e.getUint32(0x48, true),
      child: e.getUint32(0x4c, true), start: e.getUint32(0x74, true), size: e.getUint32(0x78, true) });
  }
  const root = entries[0];
  if (!root || root.type !== 5) throw new Error('no root storage');
  // The mini stream (small streams live in it, in 64-byte sectors).
  const miniFat = [];
  { const mf = u32(0x3c); if (mf !== END && mf !== FREE) { const b = readChain(mf, chain(mf, fat).length * size); for (let i = 0; i + 4 <= b.length; i += 4) miniFat.push(new DataView(b.buffer, b.byteOffset + i, 4).getUint32(0, true)); } }
  const mini = root.start !== END ? readChain(root.start, root.size) : new Uint8Array(0);
  const readMini = (start, len) => {
    const out = new Uint8Array(len); let at = 0;
    for (const s of chain(start, miniFat)) { const o = s * miniSize; const take = Math.min(miniSize, len - at); if (take <= 0) break; out.set(mini.subarray(o, o + take), at); at += take; }
    return out.subarray(0, at);
  };
  // The root's children: a red-black tree, walked through left and right.
  const out = {};
  const seen = new Set();
  const walk = (i) => {
    if (i === FREE || i >= entries.length || seen.has(i)) return;
    seen.add(i);
    const e = entries[i];
    walk(e.left); walk(e.right);
    if (e.type === 2) out[e.name] = e.size < cutoff ? readMini(e.start, e.size) : readChain(e.start, e.size);
  };
  walk(root.child);
  return out;
}

const utf16 = (b) => { let s = ''; for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode(b[i] | (b[i + 1] << 8)); return s.replace(/\u0000+$/, ''); };
const ansi = (b) => new TextDecoder('windows-1252').decode(b).replace(/\u0000+$/, '');
// A string property: Unicode (001F) where Outlook wrote it, else 8-bit (001E).
function prop(streams, id) {
  const u = streams['__substg1.0_' + id + '001F'];
  if (u) return utf16(u);
  const a = streams['__substg1.0_' + id + '001E'];
  return a ? ansi(a) : '';
}
// A date property (PT_SYSTIME, 0040) from the fixed-size property stream.
function timeProp(streams, id) {
  const p = streams.__properties_version1_0 || streams['__properties_version1.0'];
  if (!p || p.length < 32) return null;
  const dv = new DataView(p.buffer, p.byteOffset, p.byteLength);
  for (let o = 32; o + 16 <= p.length; o += 16) {
    const tag = dv.getUint32(o, true);
    if ((tag >>> 16) === id && (tag & 0xffff) === 0x0040) {
      const lo = dv.getUint32(o + 8, true), hi = dv.getUint32(o + 12, true);
      const ms = (hi * 4294967296 + lo) / 10000 - 11644473600000;
      return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
  }
  return null;
}
// "Wed, 16 Sep 2026 10:00:00 +0400" — in UAE time, as an .eml's Date header reads.
const uaeDate = (ms) => new Date(ms + 4 * 3600000).toUTCString().replace('GMT', '+0400');

// → { headers: { from, to, date, subject }, text }, the shape parseEml gives.
export function parseMsg(bytes) {
  const s = cfbStreams(bytes);
  const name = prop(s, '0C1A') || prop(s, '0042'), addr = prop(s, '5D01') || prop(s, '0C1F') || prop(s, '0065');
  const from = name && addr && !name.includes(addr) ? name + ' <' + addr + '>' : (name || addr);
  const transport = prop(s, '007D');
  const hdrDate = (transport.match(/^Date:\s*(.+)$/mi) || [])[1] || '';
  const sent = timeProp(s, 0x0039) || timeProp(s, 0x0E06);
  let text = prop(s, '1000');
  if (!text) {
    const html = s['__substg1.0_10130102'] ? new TextDecoder('utf-8').decode(s['__substg1.0_10130102']) : prop(s, '1013');
    if (html) text = html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  }
  return { headers: { from, to: prop(s, '0E04'), date: hdrDate.trim() || (sent ? uaeDate(sent) : ''), subject: prop(s, '0037') },
    text: String(text || '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() };
}
