// THE AZURE EMAIL DRIVER.
//
//   node tools/test-email-azure.mjs
//
// The signature is the whole risk. ACS does not take a bearer token — every
// request is signed HMAC-SHA256 — and a signature that is merely well-shaped is
// useless: the service answers 401, the sign-in code never arrives, and the
// failure looks exactly like somebody mistyping their own email address.
//
// So the signing chain is checked against node:crypto, which is an entirely
// separate implementation from the WebCrypto subtle the driver uses. If both
// agree on a fixed key and a fixed string, the chain is right; if the driver
// ever signs the base64 TEXT of the key instead of its decoded bytes — the
// classic ACS mistake — the two stop agreeing and this file says so.
import { createHash, createHmac } from 'node:crypto';
import {
  acsConfig, parseConnectionString, acsSign, stringToSign, splitAddress,
  acsErrorText, plainTextOf, sendViaAzure, b64, unb64,
} from '../src/email-azure.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + String(d).slice(0, 300) : '')); if (!c) fails++; };

const KEY = Buffer.from('aetraa-access-key-for-tests-only').toString('base64');
const ENDPOINT = 'https://aetraa.uaenorth.communication.azure.com';

console.log('\n— configuration —');
{
  check('no ACS settings means no azure driver', acsConfig({}) === null);
  check('an endpoint with no key is not enough', acsConfig({ ACS_ENDPOINT: ENDPOINT }) === null);
  check('a key with no endpoint is not enough', acsConfig({ ACS_KEY: KEY }) === null);

  const c = acsConfig({ ACS_ENDPOINT: ENDPOINT + '/', ACS_KEY: KEY });
  check('a trailing slash on the endpoint is dropped', c && c.endpoint === ENDPOINT, c && c.endpoint);
  check('the api version has a default', c && c.apiVersion === '2025-09-01', c && c.apiVersion);
  check('the api version can be overridden',
    acsConfig({ ACS_ENDPOINT: ENDPOINT, ACS_KEY: KEY, ACS_API_VERSION: '2024-07-01-preview' }).apiVersion === '2024-07-01-preview');

  const cs = parseConnectionString(`endpoint=${ENDPOINT}/;accesskey=${KEY}`);
  check('the portal connection string splits into both halves',
    cs && cs.endpoint === ENDPOINT + '/' && cs.key === KEY, JSON.stringify(cs));
  check('a base64 key containing "=" survives the split — it is split on the FIRST "=" only',
    parseConnectionString('endpoint=https://x/;accesskey=YWJjZA==').key === 'YWJjZA==');
  check('the field names are read case-insensitively',
    !!parseConnectionString(`Endpoint=${ENDPOINT};AccessKey=${KEY}`));
  check('rubbish is not a connection string', parseConnectionString('re_not_a_connection_string') === null);
  check('an empty connection string is not a connection string', parseConnectionString('') === null);

  const whole = acsConfig({ ACS_CONNECTION_STRING: `endpoint=${ENDPOINT}/;accesskey=${KEY}` });
  check('the connection string alone configures the driver', whole && whole.key === KEY);
  check('an endpoint written without https gets it',
    acsConfig({ ACS_ENDPOINT: 'aetraa.communication.azure.com', ACS_KEY: KEY }).endpoint
      === 'https://aetraa.communication.azure.com');
}

console.log('\n— base64 —');
{
  const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
  check('base64 round-trips through the driver helpers',
    [...unb64(b64(bytes))].join(',') === [...bytes].join(','));
  check('the driver agrees with node on base64',
    b64(bytes) === Buffer.from(bytes).toString('base64'));
}

console.log('\n— the string ACS signs —');
{
  const sts = stringToSign({
    method: 'post', pathAndQuery: '/emails:send?api-version=2025-09-01',
    date: 'Mon, 21 Sep 2026 08:00:00 GMT', host: 'aetraa.communication.azure.com',
    contentHash: 'HASH==',
  });
  const lines = sts.split('\n');
  check('it is exactly three lines', lines.length === 3, JSON.stringify(sts));
  check('the verb is upper-cased', lines[0] === 'POST', lines[0]);
  check('the second line is the path AND its query', lines[1] === '/emails:send?api-version=2025-09-01', lines[1]);
  check('the third line is date;host;content-hash, semicolon separated',
    lines[2] === 'Mon, 21 Sep 2026 08:00:00 GMT;aetraa.communication.azure.com;HASH==', lines[2]);
  check('the host line carries no scheme', !/https?:/.test(lines[2]));
}

console.log('\n— the signature itself, against node:crypto —');
{
  const body = JSON.stringify({ senderAddress: 'no-reply@aetraa.ae', content: { subject: 'Test' } });
  const date = 'Mon, 21 Sep 2026 08:00:00 GMT';
  const host = 'aetraa.uaenorth.communication.azure.com';
  const pathAndQuery = '/emails:send?api-version=2025-09-01';

  const signed = await acsSign({ key: KEY, method: 'POST', pathAndQuery, date, host, body });

  const wantHash = createHash('sha256').update(body, 'utf8').digest('base64');
  check('the content hash is base64(sha256(utf8 body)) — node agrees',
    signed.contentHash === wantHash, signed.contentHash + ' vs ' + wantHash);

  const wantSts = `POST\n${pathAndQuery}\n${date};${host};${wantHash}`;
  check('the signed string is built from that same hash', signed.stringToSign === wantSts, signed.stringToSign);

  const wantSig = createHmac('sha256', Buffer.from(KEY, 'base64')).update(wantSts, 'utf8').digest('base64');
  check('the signature is HMAC-SHA256 over the DECODED key — node agrees',
    signed.signature === wantSig, signed.signature + ' vs ' + wantSig);

  // The mistake this whole file exists to catch.
  const wrongSig = createHmac('sha256', KEY).update(wantSts, 'utf8').digest('base64');
  check('it is NOT the key signed as base64 text (the classic ACS 401)',
    signed.signature !== wrongSig);

  check('the Authorization header names the three signed headers, in order',
    signed.authorization ===
      'HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=' + wantSig,
    signed.authorization);

  // Determinism: the same inputs must produce the same signature every time,
  // or a retry would be signed differently from the request it repeats.
  const again = await acsSign({ key: KEY, method: 'POST', pathAndQuery, date, host, body });
  check('signing is deterministic', again.signature === signed.signature);

  const other = await acsSign({ key: KEY, method: 'POST', pathAndQuery, date, host, body: body + ' ' });
  check('one changed byte in the body changes the signature', other.signature !== signed.signature);

  const empty = await acsSign({ key: KEY, method: 'POST', pathAndQuery, date, host, body: '' });
  check('an empty body hashes to the empty sha256, not to nothing',
    empty.contentHash === createHash('sha256').update('', 'utf8').digest('base64'));

  const uni = 'أ — “quoted” — ok';
  const uniSigned = await acsSign({ key: KEY, method: 'POST', pathAndQuery, date, host, body: uni });
  check('Arabic and smart quotes hash as UTF-8, not as bytes-per-char',
    uniSigned.contentHash === createHash('sha256').update(uni, 'utf8').digest('base64'));
}

console.log('\n— addresses —');
{
  check('"Name <a@b>" splits into name and address',
    JSON.stringify(splitAddress('AETRAA Platform <no-reply@aetraa.ae>')) ===
      JSON.stringify({ name: 'AETRAA Platform', address: 'no-reply@aetraa.ae' }));
  check('a bare address has no name',
    JSON.stringify(splitAddress('no-reply@aetraa.ae')) ===
      JSON.stringify({ name: '', address: 'no-reply@aetraa.ae' }));
  check('surrounding quotes on the name are dropped',
    splitAddress('"AETRAA, Site" <a@b.ae>').name === 'AETRAA, Site');
  check('whitespace around the address inside the brackets is trimmed',
    splitAddress('X < a@b.ae >').address === 'a@b.ae');
  check('an empty value gives an empty address', splitAddress('').address === '');
  check('a null value does not throw', splitAddress(null).address === '');
}

console.log('\n— plain text fallback —');
{
  const html = '<style>p{color:red}</style><h1>Overdue</h1><p>Two items:</p>' +
               '<ul><li>RFI-004</li><li>MAT-012</li></ul><p>Sign in &amp; clear them.</p>';
  const t = plainTextOf(html);
  check('no tags survive', !/[<>]/.test(t), t);
  check('the style block is removed, not flattened', !/color:red/.test(t), t);
  check('each list item is on its own line', /RFI-004\nMAT-012/.test(t), JSON.stringify(t));
  check('entities are decoded', /Sign in & clear/.test(t), t);
  check('there is never a run of three newlines', !/\n{3}/.test(t));
  check('a script block is removed', !/alert/.test(plainTextOf('<script>alert(1)</script>hi')));
  check('table cells are separated rather than run together',
    /A {2}B/.test(plainTextOf('<table><tr><td>A</td><td>B</td></tr></table>')),
    JSON.stringify(plainTextOf('<table><tr><td>A</td><td>B</td></tr></table>')));
  check('empty html gives an empty string', plainTextOf('') === '');
  check('null html does not throw', plainTextOf(null) === '');
}

console.log('\n— reading Azure\'s refusals —');
{
  check('a nested ACS error becomes one sentence',
    acsErrorText(JSON.stringify({ error: { code: 'DomainNotLinked', message: 'The sender domain is not linked.' } }))
      === 'DomainNotLinked — The sender domain is not linked.');
  check('an inner error is included',
    /not provisioned/.test(acsErrorText(JSON.stringify({
      error: { code: 'BadRequest', message: 'Invalid sender.', innererror: { message: 'domain not provisioned' } } }))));
  check('non-JSON comes back as the text it is', acsErrorText('502 Bad Gateway') === '502 Bad Gateway');
  check('an empty body gives an empty string', acsErrorText('') === '');
  check('a very long refusal is cut, not passed on whole',
    acsErrorText('x'.repeat(5000)).length <= 400);
}

console.log('\n— sending: the refusals that never reach the network —');
{
  const noFetch = () => { throw new Error('the driver reached the network when it should not have'); };
  const realFetch = globalThis.fetch;
  globalThis.fetch = noFetch;
  try {
    let r = await sendViaAzure({}, ['a@b.ae'], 'S', '<p>b</p>', 'x@y.ae');
    check('an unconfigured environment refuses before sending', !r.ok && r.reason === 'no-key', JSON.stringify(r));

    const env = { ACS_ENDPOINT: ENDPOINT, ACS_KEY: KEY };
    r = await sendViaAzure(env, [], 'S', '<p>b</p>', 'x@y.ae');
    check('no recipients refuses before sending', !r.ok && r.reason === 'no-recipients', JSON.stringify(r));

    r = await sendViaAzure(env, ['a@b.ae'], 'S', '<p>b</p>', 'not-an-address');
    check('a sender that is not an address refuses before sending',
      !r.ok && r.status === 400 && /not an email address/.test(r.error), JSON.stringify(r));

    r = await sendViaAzure({ ACS_ENDPOINT: ENDPOINT, ACS_KEY: 'not base64 at all !!!' },
      ['a@b.ae'], 'S', '<p>b</p>', 'x@y.ae');
    check('a malformed access key is caught here rather than as a 401 from Azure',
      !r.ok && r.reason === 'azure-key', JSON.stringify(r));
  } finally { globalThis.fetch = realFetch; }
}

console.log('\n— sending: what actually goes on the wire —');
{
  const realFetch = globalThis.fetch;
  let seen = null;
  globalThis.fetch = async (u, init) => {
    seen = { url: String(u), init };
    return { ok: true, status: 202, async text() { return JSON.stringify({ id: 'op-123', status: 'Running' }); } };
  };
  try {
    const env = { ACS_ENDPOINT: ENDPOINT, ACS_KEY: KEY };
    const r = await sendViaAzure(env, ['Site Manager <pm@contractor.ae>', 'qs@contractor.ae'],
      'RFI-004 is overdue', '<p>Please reply.</p>', 'AETRAA <no-reply@aetraa.ae>');

    check('a 202 is a send', r.ok === true, JSON.stringify(r));
    check('the operation id is kept', r.id === 'op-123', JSON.stringify(r));
    check('the result names the driver that ran', r.driver === 'azure');

    check('it posts to emails:send with the api version',
      seen.url === ENDPOINT + '/emails:send?api-version=2025-09-01', seen.url);
    check('it is a POST', seen.init.method === 'POST');

    const h = seen.init.headers;
    check('x-ms-date is an RFC 1123 date, which is what ACS signs',
      /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(h['x-ms-date']), h['x-ms-date']);
    check('the Authorization header is the HMAC scheme, not a bearer token',
      /^HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=/.test(h.Authorization),
      h.Authorization);
    check('the content hash header matches the body actually sent',
      h['x-ms-content-sha256'] === createHash('sha256').update(seen.init.body, 'utf8').digest('base64'));
    check('a repeatability id is sent, so a double-click cannot send twice',
      typeof h['repeatability-request-id'] === 'string' && h['repeatability-request-id'].length >= 32,
      h['repeatability-request-id']);
    check('repeatability-first-sent matches x-ms-date',
      h['repeatability-first-sent'] === h['x-ms-date']);

    // And the signature on the wire must verify against the body on the wire.
    const host = ENDPOINT.replace(/^https:\/\//, '');
    const want = createHmac('sha256', Buffer.from(KEY, 'base64'))
      .update(`POST\n/emails:send?api-version=2025-09-01\n${h['x-ms-date']};${host};${h['x-ms-content-sha256']}`, 'utf8')
      .digest('base64');
    check('the signature on the wire verifies against the request on the wire',
      h.Authorization.endsWith('&Signature=' + want), h.Authorization);

    const body = JSON.parse(seen.init.body);
    check('the sender goes as a bare address, not "Name <address>"',
      body.senderAddress === 'no-reply@aetraa.ae', body.senderAddress);
    check('both recipients are carried', body.recipients.to.length === 2);
    check('a named recipient keeps its display name',
      body.recipients.to[0].address === 'pm@contractor.ae' && body.recipients.to[0].displayName === 'Site Manager',
      JSON.stringify(body.recipients.to[0]));
    check('an unnamed recipient carries no empty display name',
      body.recipients.to[1].displayName === undefined, JSON.stringify(body.recipients.to[1]));
    check('the subject is carried', body.content.subject === 'RFI-004 is overdue');
    check('the html is carried', body.content.html === '<p>Please reply.</p>');
    check('a plain-text part is always included', body.content.plainText === 'Please reply.', body.content.plainText);
    check('tracking is left alone unless it is turned off',
      body.userEngagementTrackingDisabled === undefined);

    seen = null;
    await sendViaAzure({ ACS_ENDPOINT: ENDPOINT, ACS_KEY: KEY, ACS_DISABLE_TRACKING: '1' },
      ['a@b.ae'], 'S', '<p>b</p>', 'x@y.ae');
    check('tracking can be turned off by configuration',
      JSON.parse(seen.init.body).userEngagementTrackingDisabled === true);

    // Two sends must not reuse one repeatability id, or the second would be
    // swallowed as a duplicate — and a second sign-in code would never arrive.
    seen = null;
    await sendViaAzure({ ACS_ENDPOINT: ENDPOINT, ACS_KEY: KEY }, ['a@b.ae'], 'S', '<p>1</p>', 'x@y.ae');
    const first = seen.init.headers['repeatability-request-id'];
    await sendViaAzure({ ACS_ENDPOINT: ENDPOINT, ACS_KEY: KEY }, ['a@b.ae'], 'S', '<p>2</p>', 'x@y.ae');
    check('each send gets its own repeatability id',
      seen.init.headers['repeatability-request-id'] !== first);
  } finally { globalThis.fetch = realFetch; }
}

console.log('\n— sending: what comes back when Azure says no —');
{
  const realFetch = globalThis.fetch;
  const env = { ACS_ENDPOINT: ENDPOINT, ACS_KEY: KEY };
  const refuse = (status, text) => async () => ({ ok: false, status, async text() { return text; } });
  try {
    globalThis.fetch = refuse(401, JSON.stringify({ error: { code: 'Unauthorized', message: 'bad signature' } }));
    let r = await sendViaAzure(env, ['a@b.ae'], 'S', '<p>b</p>', 'x@y.ae');
    check('a 401 is reported as an azure refusal with its status',
      !r.ok && r.status === 401 && r.reason === 'azure', JSON.stringify(r));
    check('the refusal carries Azure\'s own words', /bad signature/.test(r.error), r.error);

    globalThis.fetch = refuse(403, '{"error":{"code":"DomainNotLinked","message":"no"}}');
    r = await sendViaAzure(env, ['a@b.ae'], 'S', '<p>b</p>', 'x@y.ae');
    check('a 403 is reported with its status', !r.ok && r.status === 403);

    globalThis.fetch = async () => { throw new Error('ENOTFOUND'); };
    r = await sendViaAzure(env, ['a@b.ae'], 'S', '<p>b</p>', 'x@y.ae');
    check('an unreachable service is a network failure, not a refusal',
      !r.ok && r.reason === 'network', JSON.stringify(r));

    // A 202 with no body at all is legal; it must not be read as a failure.
    globalThis.fetch = async () => ({ ok: true, status: 202, async text() { return ''; } });
    r = await sendViaAzure(env, ['a@b.ae'], 'S', '<p>b</p>', 'x@y.ae');
    check('an accepted send with no body is still a send', r.ok === true && r.id === null, JSON.stringify(r));
  } finally { globalThis.fetch = realFetch; }
}

console.log('\n— the one door above the drivers —');
{
  const { default: _worker } = await import('../src/index.js');
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8'));

  check('sendEmail is the only place that reaches a provider',
    (src.match(/api\.resend\.com/g) || []).length === 1,
    'a second caller would bypass the driver choice');
  check('the azure driver is reached through sendEmail, not beside it',
    /sendViaAzure\(env, to, subject, htmlBody, from\)/.test(src));
  check('nothing outside emailDriver() still tests RESEND_KEY to decide if email works',
    (src.match(/!!env\.RESEND_KEY/g) || []).length === 0,
    'found a leftover Resend-only check');
  check('azure is preferred when both are configured',
    /if \(acsConfig\(env\)\) return 'azure';[\s\S]{0,120}RESEND_KEY\) return 'resend'/.test(src));
  check('Resend\'s shared sender is not offered as a default on azure',
    /driver === 'resend' \? FROM_DEFAULT : ''/.test(src));
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
