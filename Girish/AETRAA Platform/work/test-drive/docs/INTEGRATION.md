# Connecting Revit and other programs to AETRAA

This guide is for whoever writes the code on the other side: the Revit add-in, and the services for the other two programs. AETRAA and those programs talk in both directions:

- **In:** your code calls AETRAA. It lists a company's projects and sends items (quantities, models, progress, issues…) into a project's **inbox**.
- **Out:** AETRAA calls your code. A person presses a button on `/integrations`, or the platform asks for something. AETRAA sends a signed `POST` to a URL you run.

The code is in `src/integrations.js`. The machine-readable description is [`openapi.json`](openapi.json). `tools/test-integrations.mjs` runs every case below, including the signature check.

---

## 1. Getting a key

A company's **Principal** opens **Integrations** in the menu (`/integrations`), then makes a key under **API keys**:

- **Name:** what it is for, e.g. *Revit add-in, Ajay's laptop*.
- **Scopes:** `read` (list projects and inbox items), `write` (send items and files), or both.

The key looks like `aet_AbCd1234_…` (48 characters). It is **shown once**: AETRAA keeps only a SHA-256 hash of it. A key reaches **only its own company's projects**. Revoking it on the same screen stops it working at once.

Send it on every request, as either header:

```
Authorization: Bearer aet_AbCd1234_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
X-API-Key: aet_AbCd1234_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`/api/v1/…` answers **only** to keys. A browser's sign-in cookie is ignored there, so a web page can't make these calls on someone's behalf.

**Limits:**
- 1,200 requests per key per 15 minutes. Past that you get `429 {"throttled": true}`; wait and retry.
- Item `data` up to 2 MB.
- Files up to 200 MB (the `INTEGRATION_MAX_MB` setting).
- The server refuses any request over 256 MB (`MAX_BODY_MB`).

---

## 2. Endpoints (your code → AETRAA)

The base URL is the platform's address, e.g. `https://app.aetraa.ae`.

| Method | Path | Scope | What it does |
|---|---|---|---|
| `GET` | `/api/v1/ping` | any | Checks the key. Returns the company, the key's name and scopes, and the server time. |
| `GET` | `/api/v1/projects` | read | The company's projects: `id`, `name`, `ref`, `location`, `archived`. |
| `GET` | `/api/v1/projects/{project_id}/inbox` | read | Items in that project's inbox, newest change first. Optional query: `?since=<ISO time>&status=<status>&limit=<1-500>`. |
| `POST` | `/api/v1/projects/{project_id}/inbox` | write | Sends an item (below). `201` when new; `200` when it updated an existing item. |
| `GET` | `/api/v1/inbox/{item_id}` | read | One item, with its `data`. |
| `POST` | `/api/v1/inbox/{item_id}/file?name=<file name>` | write | Attaches a file to the item. The body is the raw bytes (`Content-Type: application/octet-stream`). A second file replaces the first. |

### Sending an item

```json
{
  "source": "revit",
  "kind": "quantities",
  "title": "Level 3 walls",
  "external_id": "L3-walls",
  "data": { "walls": [ { "type": "W1", "area_m2": 412.5 } ] }
}
```

| Field | Required | Notes |
|---|---|---|
| `source` | yes | The program sending it: `revit`, `navisworks`, … Letters, digits, `-` and `_` only. |
| `kind` | yes | One of `model`, `quantities`, `progress`, `drawing`, `schedule`, `issue`, `document`, `other`. |
| `title` | no | What a person sees in the list (up to 300 characters). |
| `external_id` | no | **Your own id for this thing.** Sending the same `source` + `external_id` to the same project again **updates** that item instead of adding another. Use this for anything you re-send: a level's quantities, a model's latest export. |
| `data` | no | Any JSON, up to 2 MB. Anything bigger goes in as a file. |

The response:

```json
{ "ok": true, "id": "inb_3f9a…", "updated": false, "status": "received" }
```

**Status** is one of:
- `received`: waiting for a person on `/integrations`.
- `applied`: a handler turned it into platform records (see section 5).
- `failed`: a handler tried and failed. The item is kept, and `note` says why.
- `reviewed` or `archived`: set by a person.

**Files refused:**
- programs, scripts and web pages (`.exe .msi .bat .cmd .js .ps1 .sh .html .svg .php .jar .dll` and similar);
- empty files.

Models (`.rvt`, `.ifc`, `.nwd`, `.nwc`), PDFs, spreadsheets and pictures are fine. When the team downloads a file, the browser always saves it; it never opens it as a page.

### Errors

Every error is JSON, `{"error": "…a sentence a person can read…"}`, with one of these statuses:

| Status | Meaning |
|---|---|
| `400` | The request is wrong (the message says which field). |
| `401` | No key, or the key is wrong or revoked. |
| `403` | The key lacks the scope, or the company is suspended. |
| `404` | No such project or item **for this key's company**. |
| `413` | Too large. |
| `429` | Too many requests. |

---

## 3. Examples

### curl

```bash
KEY=aet_AbCd1234_...
BASE=https://app.aetraa.ae
curl -s $BASE/api/v1/ping -H "Authorization: Bearer $KEY"
curl -s $BASE/api/v1/projects -H "Authorization: Bearer $KEY"
curl -s -X POST $BASE/api/v1/projects/$PID/inbox -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"source":"revit","kind":"quantities","title":"Level 3 walls","external_id":"L3-walls","data":{"walls":[{"type":"W1","area_m2":412.5}]}}'
curl -s -X POST "$BASE/api/v1/inbox/$ITEM/file?name=L3.ifc" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/octet-stream" --data-binary @L3.ifc
```

### C# (a Revit add-in; .NET 4.8 or .NET 8)

```csharp
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;

static readonly HttpClient http = new HttpClient { BaseAddress = new Uri("https://app.aetraa.ae") };

static async Task<string> SendQuantities(string key, string projectId, string json)
{
    var req = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/projects/{projectId}/inbox");
    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
    // json = {"source":"revit","kind":"quantities","title":"…","external_id":"…","data":{…}}
    req.Content = new StringContent(json, Encoding.UTF8, "application/json");
    var res = await http.SendAsync(req);
    var body = await res.Content.ReadAsStringAsync();
    if (!res.IsSuccessStatusCode) throw new Exception($"AETRAA {(int)res.StatusCode}: {body}");
    return body;                                       // {"ok":true,"id":"inb_…",…}
}

static async Task AttachFile(string key, string itemId, string path)
{
    var req = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/inbox/{itemId}/file?name={Uri.EscapeDataString(Path.GetFileName(path))}");
    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
    req.Content = new StreamContent(File.OpenRead(path));
    req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
    (await http.SendAsync(req)).EnsureSuccessStatusCode();
}
```

Revit's API runs on its own thread. Do the HTTP call off it, e.g. collect the quantities in an `IExternalEventHandler`, then send them with `Task.Run`.

### Python

```python
import requests
BASE, KEY = "https://app.aetraa.ae", "aet_AbCd1234_..."
H = {"Authorization": f"Bearer {KEY}"}

projects = requests.get(f"{BASE}/api/v1/projects", headers=H, timeout=30).json()["projects"]
pid = projects[0]["id"]
r = requests.post(f"{BASE}/api/v1/projects/{pid}/inbox", headers=H, timeout=30, json={
    "source": "navisworks", "kind": "issue", "title": "Duct vs beam, grid C4",
    "external_id": "clash-C4-017", "data": {"clash_id": "C4-017", "level": "L3"}})
r.raise_for_status()
item = r.json()["id"]
with open("clash-report.pdf", "rb") as f:
    requests.post(f"{BASE}/api/v1/inbox/{item}/file", params={"name": "clash-report.pdf"},
                  headers={**H, "Content-Type": "application/octet-stream"}, data=f, timeout=300).raise_for_status()
```

---

## 4. AETRAA calling your code (connectors)

Each program you run a service for is a **connector**, set on the AETRAA server only:

```
INTEGRATIONS=revit,navisworks
INTEGRATION_REVIT_URL=https://revit-bridge.example.ae/aetraa
INTEGRATION_REVIT_SECRET=<a long random string, the same on both sides>
INTEGRATION_REVIT_LABEL=Autodesk Revit           (optional: what the screen calls it)
```

On the server: `sudo aetraa-config INTEGRATIONS revit,navisworks`, and so on for each setting. Restart afterwards. The connector then appears on `/integrations`, with a **Test** button that sends `ping`.

### What AETRAA sends

```
POST {INTEGRATION_REVIT_URL}/{action}
Content-Type: application/json
X-AETRAA-Timestamp: 1793260800
X-AETRAA-Signature: sha256=5f1c…
User-Agent: AETRAA-Integrations/1

{
  "action": "export-quantities",
  "request_id": "req_9b2e…",
  "sent_at": "2026-10-27T08:00:00.000Z",
  "org_id": "org_…",
  "project": { "id": "prj_…", "name": "Faris Mall", "ref": "FM-1" },
  "payload": { "level": 3 },
  "reply_to": "https://app.aetraa.ae/api/v1/projects/prj_…/inbox"
}
```

- `action` is letters, digits, `-` and `_`. Your side decides which actions exist; `ping` should always answer `200`.
- Answer with JSON within **30 seconds** (`INTEGRATION_TIMEOUT_MS`). A 2xx counts as success. The reply is shown to the person and logged.
- For anything slow (exporting a model), answer `202` at once. Later, send the result to `reply_to` with an API key, as in section 2, using `external_id` = the `request_id`.

### Checking the signature (do this; it is what makes the URL safe to expose)

The signature is `HMAC-SHA256(secret, timestamp + "." + raw_body)`, in hex, prefixed `sha256=`. Refuse the request if:
- the signature doesn't match (compare in constant time), or
- the timestamp is more than 5 minutes from your clock (a replay).

Use the **raw body bytes**, before any JSON parsing.

```csharp
// ASP.NET Core
static bool FromAetraa(HttpRequest req, string rawBody, string secret)
{
    var ts = req.Headers["X-AETRAA-Timestamp"].ToString();
    var sig = req.Headers["X-AETRAA-Signature"].ToString();
    if (!long.TryParse(ts, out var t) || Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - t) > 300) return false;
    using var h = new System.Security.Cryptography.HMACSHA256(Encoding.UTF8.GetBytes(secret));
    var mac = "sha256=" + Convert.ToHexString(h.ComputeHash(Encoding.UTF8.GetBytes(ts + "." + rawBody))).ToLowerInvariant();
    return System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(mac), Encoding.UTF8.GetBytes(sig));
}
```

```python
import hmac, hashlib, time
def from_aetraa(headers, raw_body: bytes, secret: str) -> bool:
    ts, sig = headers.get("X-AETRAA-Timestamp", ""), headers.get("X-AETRAA-Signature", "")
    if not ts.isdigit() or abs(time.time() - int(ts)) > 300:
        return False
    mac = "sha256=" + hmac.new(secret.encode(), ts.encode() + b"." + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(mac, sig)
```

Every call is written to the `integration_log` table: connector, action, success, HTTP status, time taken and error. The last call per connector shows on `/integrations`.

---

## 5. Turning items into platform records (the one place to edit)

An item that arrives waits on `/integrations` for a person to review it. Nothing is written into the registers (BOQ, progress, RFIs…) automatically **until a handler exists for it**. This is deliberate: the shape of each program's data isn't known yet, and guessing would put wrong figures in front of a client.

Once the shape is agreed, add a handler in `src/integrations.js`:

```js
export const INBOX_HANDLERS = {
  'revit:quantities': async (env, item) => {
    // item.project_id, item.title, item.external_id, item.data (already parsed JSON)
    // … write BOQ lines with env.DB.prepare(…).bind(…).run() …
    return { applied: true, note: '42 wall lines updated' };   // or { error: 'why not' }
  },
};
```

The key is `"source:kind"`, or `"*:kind"` for any source. The handler runs as soon as the item arrives, and again each time the same `external_id` is re-sent. If it throws or returns `{error}`, the item is marked `failed` with that note and kept, and the sender still gets its response. `tools/test-integrations.mjs` shows both cases.
