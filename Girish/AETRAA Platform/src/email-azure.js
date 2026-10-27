// AZURE COMMUNICATION SERVICES — the second email driver.
//
// Email leaves this platform through one door (sendEmail in index.js). Behind
// that door there are now two drivers, chosen by configuration exactly the way
// storage.js chooses between a bucket, S3 and the database:
//
//   azure     ACS_ENDPOINT + ACS_KEY are set   — Azure Communication Services
//   resend    RESEND_KEY is set                — Resend
//   none      neither                          — the app never emails, and says so
//
// Azure is the driver that matters for AETRAA: the rest of the platform already
// runs in the customer's own Azure tenant, so this keeps the sign-in codes and
// the daily reports inside the same subscription, the same invoice and the same
// audit trail rather than a second vendor nobody reviewed.
//
// WHY THE SIGNING IS ITS OWN EXPORTED FUNCTION, pinned by a test:
// ACS does not take a bearer token. Every request is signed HMAC-SHA256 with
// the access key, and a signature that is merely well-shaped is useless — the
// service answers 401, the sign-in code never arrives, and the failure looks
// exactly like a typo in somebody's email address. So acsSign() is separate,
// deterministic, and tested against a known key / known string producing a
// known signature. The same reasoning put sigv4() on its own in storage.js.

const enc = (s) => new TextEncoder().encode(s);

export function b64(bytes) {
  const u8 = new Uint8Array(bytes);
  if (typeof btoa === 'function') {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  return Buffer.from(u8).toString('base64');
}

export function unb64(s) {
  const clean = String(s || '');
  if (typeof atob === 'function') {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(clean, 'base64'));
}

async function sha256B64(bytes) {
  return b64(await crypto.subtle.digest('SHA-256', bytes));
}

async function hmacB64(keyBytes, msg) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', k, enc(msg)));
}

// ---------------------------------------------------------------- configuration

// An ACS connection string is what the portal hands you:
//   endpoint=https://x.communication.azure.com/;accesskey=BASE64==
// Accepting it whole means nobody has to split it by hand and get it wrong, and
// the two parts can still be set separately when a secret store prefers that.
export function parseConnectionString(cs) {
  const out = {};
  for (const part of String(cs || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).trim();
    if (k === 'endpoint') out.endpoint = v;
    else if (k === 'accesskey') out.key = v;
  }
  return out.endpoint && out.key ? out : null;
}

export function acsConfig(env) {
  const e = env || {};
  let endpoint = e.ACS_ENDPOINT ? String(e.ACS_ENDPOINT) : '';
  let key = e.ACS_KEY ? String(e.ACS_KEY) : '';

  if (!endpoint || !key) {
    const cs = parseConnectionString(e.ACS_CONNECTION_STRING);
    if (cs) { endpoint = endpoint || cs.endpoint; key = key || cs.key; }
  }
  if (!endpoint || !key) return null;

  endpoint = endpoint.replace(/\/+$/, '');
  if (!/^https:\/\//i.test(endpoint)) endpoint = 'https://' + endpoint.replace(/^\/+/, '');
  return { endpoint, key, apiVersion: String(e.ACS_API_VERSION || '2025-09-01') };
}

// ---------------------------------------------------------------- signing

// The string ACS signs is exactly three lines:
//
//   VERB\n{path-and-query}\n{x-ms-date};{host};{x-ms-content-sha256}
//
// The access key is base64 in the portal and is HMAC'd as the DECODED bytes —
// signing the base64 text instead produces a perfectly valid-looking signature
// that ACS rejects every time, which is the mistake this comment exists to stop.
export function stringToSign({ method, pathAndQuery, date, host, contentHash }) {
  return [
    String(method || 'POST').toUpperCase(),
    pathAndQuery,
    `${date};${host};${contentHash}`,
  ].join('\n');
}

export async function acsSign({ key, method, pathAndQuery, date, host, body }) {
  const contentHash = await sha256B64(enc(body == null ? '' : String(body)));
  const sts = stringToSign({ method, pathAndQuery, date, host, contentHash });
  const signature = await hmacB64(unb64(key), sts);
  return {
    contentHash,
    stringToSign: sts,
    signature,
    authorization:
      'HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=' + signature,
  };
}

// ---------------------------------------------------------------- sending

// "Name <a@b.com>" → { name, address }. ACS wants the two apart; the rest of
// the platform writes senders and recipients the way a person does.
export function splitAddress(v) {
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/^(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>$/);
  if (m) return { name: m[1].replace(/^["']|["']$/g, '').trim(), address: m[2] };
  return { name: '', address: s };
}

// ACS reports the useful part of a refusal in a nested error object. Digging it
// out here means emailAdvice() gets a sentence rather than a wall of JSON.
export function acsErrorText(raw) {
  const text = String(raw || '');
  try {
    const j = JSON.parse(text);
    const e = j.error || j;
    const inner = (e && e.innererror) || (e && e.innerError) || null;
    const bits = [e && e.code, e && e.message, inner && inner.message].filter(Boolean);
    if (bits.length) return bits.join(' — ').slice(0, 400);
  } catch (err) { /* not JSON; the raw text is what there is */ }
  return text.slice(0, 400);
}

// Send one message. Returns the same shape as the Resend path so that nothing
// above sendEmail() can tell which driver ran.
export async function sendViaAzure(env, to, subject, htmlBody, from) {
  const cfg = acsConfig(env);
  if (!cfg) return { ok: false, error: 'azure email is not configured', reason: 'no-key' };
  if (!to || !to.length) return { ok: false, error: 'no recipients', reason: 'no-recipients' };

  const sender = splitAddress(from);
  if (!sender.address || !/@/.test(sender.address)) {
    return { ok: false, status: 400, reason: 'azure',
      error: 'the sender address "' + String(from || '') + '" is not an email address' };
  }

  const payload = {
    senderAddress: sender.address,
    content: {
      subject: String(subject || ''),
      html: String(htmlBody || ''),
      // A plain-text part keeps the message out of the spam bucket and readable
      // in a mail client that will not render HTML.
      plainText: plainTextOf(htmlBody),
    },
    recipients: {
      to: to.map((a) => {
        const p = splitAddress(a);
        return p.name ? { address: p.address, displayName: p.name } : { address: p.address };
      }),
    },
    // Azure's own request-level dedupe. The same message resent within the
    // service's window is delivered once, which matters because a sign-in code
    // page that is double-clicked must not post two different codes.
    ...(env && env.ACS_DISABLE_TRACKING ? { userEngagementTrackingDisabled: true } : {}),
  };

  const body = JSON.stringify(payload);
  const pathAndQuery = '/emails:send?api-version=' + encodeURIComponent(cfg.apiVersion);
  const host = cfg.endpoint.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  const date = new Date().toUTCString();

  let signed;
  try {
    signed = await acsSign({ key: cfg.key, method: 'POST', pathAndQuery, date, host, body });
  } catch (err) {
    // An access key that is not valid base64 fails here rather than at Azure,
    // and saying so is far more useful than a 401.
    console.log('email: the Azure access key could not be used —', String((err && err.message) || err));
    return { ok: false, reason: 'azure-key',
      error: 'the Azure access key is not in the form Azure issues (base64)' };
  }

  let res;
  try {
    res = await fetch(cfg.endpoint + pathAndQuery, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ms-date': date,
        'x-ms-content-sha256': signed.contentHash,
        Authorization: signed.authorization,
        'repeatability-request-id': uuid(),
        'repeatability-first-sent': date,
      },
      body,
    });
  } catch (err) {
    console.log('email: could not reach Azure —', String((err && err.message) || err));
    return { ok: false, error: 'could not reach the email service', reason: 'network' };
  }

  if (!res.ok) {
    const raw = await res.text();
    const msg = acsErrorText(raw);
    // Printed so the server log shows the real reason. Azure's refusals are
    // specific — an unverified domain, a sender not linked to this resource —
    // and swallowing them is what turns this into a mystery.
    console.log(`email: Azure refused ${res.status} — ${msg}`);
    return { ok: false, status: res.status, error: `${res.status} ${msg}`, reason: 'azure' };
  }

  // 202 with an operation id. Delivery is asynchronous, so an ok here means
  // accepted for delivery, not delivered — the same promise Resend makes.
  let id = null;
  try { id = (JSON.parse(await res.text()) || {}).id || null; } catch (e) { /* no body */ }
  return { ok: true, driver: 'azure', id };
}

// ---------------------------------------------------------------- odds and ends

function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i++) s += h[Math.floor(Math.random() * 16)];
  return s.slice(0, 8) + '-' + s.slice(8, 12) + '-4' + s.slice(13, 16) + '-a' + s.slice(17, 20) + '-' + s.slice(20);
}

// A readable fallback, not a renderer. Block tags become line breaks so a list
// of overdue items does not arrive as one run-on paragraph.
export function plainTextOf(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/td>\s*<td[^>]*>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
