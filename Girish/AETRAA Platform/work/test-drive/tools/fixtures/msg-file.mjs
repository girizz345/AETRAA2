// A minimal Outlook .msg for the tests: a version-3 Compound File (512-byte
// sectors, 64-byte mini sectors) holding the message's property streams the
// way Outlook writes them (MS-OXMSG). Small streams go in the mini stream, a
// stream of 4096 bytes or more in ordinary sectors — so the reader is tested
// on both paths.
//   buildMsg({ subject, body, senderName, senderEmail, to, sent: Date, ansiSubject })
const FREE = 0xffffffff, END = 0xfffffffe, FATSECT = 0xfffffffd;

const utf16 = (s) => { const b = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { b[i * 2] = s.charCodeAt(i) & 255; b[i * 2 + 1] = s.charCodeAt(i) >> 8; } return b; };

export function buildMsg(o) {
  const streams = [];
  const add = (name, bytes) => streams.push({ name, bytes });
  if (o.ansiSubject) add('__substg1.0_0037001E', new TextEncoder().encode(o.subject || ''));
  else add('__substg1.0_0037001F', utf16(o.subject || ''));
  add('__substg1.0_1000001F', utf16(o.body || ''));
  if (o.senderName) add('__substg1.0_0C1A001F', utf16(o.senderName));
  if (o.senderEmail) add('__substg1.0_5D01001F', utf16(o.senderEmail));
  if (o.to) add('__substg1.0_0E04001F', utf16(o.to));
  // Fixed properties: a 32-byte header, then 16 bytes per property.
  const props = new Uint8Array(32 + 16);
  if (o.sent) {
    const dv = new DataView(props.buffer);
    dv.setUint32(32, (0x0039 << 16) | 0x0040, true); dv.setUint32(36, 6, true);
    const ft = BigInt(o.sent.getTime() + 11644473600000) * 10000n;
    dv.setUint32(40, Number(ft & 0xffffffffn), true); dv.setUint32(44, Number(ft >> 32n), true);
  }
  add('__properties_version1.0', props);

  // The mini stream: every stream under 4096 bytes, each padded to 64.
  const small = streams.filter((s) => s.bytes.length < 4096), big = streams.filter((s) => s.bytes.length >= 4096);
  const miniFat = [];
  let miniLen = 0;
  for (const s of small) {
    const n = Math.max(1, Math.ceil(s.bytes.length / 64));
    s.start = miniFat.length;
    for (let i = 0; i < n; i++) miniFat.push(i === n - 1 ? END : miniFat.length + 1);
    s.mini = true; miniLen += n * 64;
  }
  const mini = new Uint8Array(miniLen);
  for (const s of small) mini.set(s.bytes, s.start * 64);

  const per = (len) => Math.max(1, Math.ceil(len / 512));
  const dirCount = per((streams.length + 1) * 128);
  const miniFatCount = miniFat.length ? per(miniFat.length * 4) : 0;
  const miniCount = miniLen ? per(miniLen) : 0;
  const bigCounts = big.map((s) => per(s.bytes.length));
  const content = dirCount + miniFatCount + miniCount + bigCounts.reduce((a, b) => a + b, 0);
  let fatCount = 1;
  while (fatCount * 128 < fatCount + content) fatCount++;
  const total = fatCount + content;
  const fat = new Array(fatCount * 128).fill(FREE);
  let next = 0;
  const alloc = (n) => { const start = next; for (let i = 0; i < n; i++) fat[next + i] = i === n - 1 ? END : next + i + 1; next += n; return start; };
  for (let i = 0; i < fatCount; i++) fat[next++] = FATSECT;
  const dirStart = alloc(dirCount);
  const miniFatStart = miniFatCount ? alloc(miniFatCount) : END;
  const miniStart = miniCount ? alloc(miniCount) : END;
  big.forEach((s, i) => { s.start = alloc(bigCounts[i]); });

  const out = new Uint8Array(512 + total * 512);
  const dv = new DataView(out.buffer);
  [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].forEach((b, i) => { out[i] = b; });
  dv.setUint16(0x18, 0x3e, true); dv.setUint16(0x1a, 3, true); dv.setUint16(0x1c, 0xfffe, true);
  dv.setUint16(0x1e, 9, true); dv.setUint16(0x20, 6, true);
  dv.setUint32(0x2c, fatCount, true); dv.setUint32(0x30, dirStart, true); dv.setUint32(0x38, 4096, true);
  dv.setUint32(0x3c, miniFatStart, true); dv.setUint32(0x40, miniFatCount, true);
  dv.setUint32(0x44, END, true); dv.setUint32(0x48, 0, true);
  for (let i = 0; i < 109; i++) dv.setUint32(0x4c + i * 4, i < fatCount ? i : FREE, true);
  const sec = (n) => 512 + n * 512;
  fat.forEach((v, i) => dv.setUint32(sec(Math.floor(i / 128)) + (i % 128) * 4, v, true));
  // The directory: the root, then each stream, linked through "right".
  const entry = (i, name, type, start, size, child, right) => {
    const o = sec(dirStart) + i * 128;
    const nb = utf16(name + '\u0000'); out.set(nb, o); dv.setUint16(o + 0x40, nb.length, true);
    out[o + 0x42] = type; out[o + 0x43] = 1;
    dv.setUint32(o + 0x44, FREE, true); dv.setUint32(o + 0x48, right, true); dv.setUint32(o + 0x4c, child, true);
    dv.setUint32(o + 0x74, start, true); dv.setUint32(o + 0x78, size, true);
  };
  entry(0, 'Root Entry', 5, miniStart, miniLen, streams.length ? 1 : FREE, FREE);
  streams.forEach((s, i) => entry(i + 1, s.name, 2, s.start, s.bytes.length, FREE, i + 2 <= streams.length ? i + 2 : FREE));
  if (miniFatCount) miniFat.forEach((v, i) => dv.setUint32(sec(miniFatStart) + i * 4, v, true));
  if (miniCount) out.set(mini, sec(miniStart));
  big.forEach((s) => out.set(s.bytes, sec(s.start)));
  return out;
}
