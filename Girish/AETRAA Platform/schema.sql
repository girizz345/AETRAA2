-- Site Progress Monitor - database schema (multi-project)
-- Fresh install only:
--   npx wrangler d1 execute site-monitor --remote --file=./schema.sql
-- An existing database is moved to this shape by migrate-multiproject.sql instead,
-- which keeps every row.

DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS updates;
DROP TABLE IF EXISTS manpower;
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS targets;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS meta;
DROP TABLE IF EXISTS orgs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS sign_in_codes;
DROP TABLE IF EXISTS audit;
DROP TABLE IF EXISTS rates;

-- One row per project. Access codes are stored as SHA-256 hashes, never in the clear.
-- The owner code is a Worker secret and is not in here: it opens every project.
CREATE TABLE projects (
  id                  TEXT PRIMARY KEY,   -- short slug, e.g. "maj"
  org_id              TEXT,               -- which customer owns it
  name                TEXT NOT NULL,
  ref                 TEXT,
  contract_completion TEXT,
  target_name         TEXT,
  target_deadline     TEXT,
  manager_code_hash   TEXT,               -- PM: sees and reports on this project
  site_code_hash      TEXT,               -- site team: the phone page for this project
  view_code_hash      TEXT,               -- read-only dashboard for this project
  report_emails       TEXT,               -- who gets the report emails
  report_daily        INTEGER DEFAULT 0,  -- 1 = send the daily automatically each evening
  report_weekly       INTEGER DEFAULT 0,  -- 1 = send the weekly automatically each Monday
  report_monthly      INTEGER DEFAULT 0,  -- 1 = send last month's report on the 1st
  report_digest       INTEGER DEFAULT 0,  -- 1 = email each person their 'needs your attention' list at 06:00
  engineer_name       TEXT,               -- who RFIs and notices are addressed to
  contractor_name     TEXT,               -- who they are sent from
  notice_clause       TEXT,               -- the notice provision of THIS contract, e.g. "Sub-Clause 20.2.1"
  reply_days          INTEGER,            -- default reply period for an RFI
  diary_trades        TEXT,               -- the diary's trade roster, JSON. Blank = the built-in list
  diary_plant         TEXT,               -- the diary's plant categories, JSON
  diary_off_days      TEXT,               -- days with no diary expected, 0=Sun..6=Sat, e.g. "5". Blank = Friday
  diary_positions     TEXT,               -- what a subcontractor's man is on site as, JSON. Blank = the built-in list
  logo_consultant     TEXT,               -- data: URLs printed on the diary sheet
  logo_consultant2    TEXT,
  logo_contractor     TEXT,
  logo_client         TEXT,               -- the employer / client logo
  proof_at_100        INTEGER DEFAULT 1,  -- 1 = an activity cannot be claimed complete without a photo
  materials           TEXT,               -- the project's material list, JSON [{m,u}]
  currency            TEXT,               -- AED unless set otherwise
  modules             TEXT,               -- JSON list of the modules switched on (src/modules.js). Blank = all
  response_days       TEXT,               -- JSON {type: days} overriding the default response periods (src/records.js)
  -- contract commercial terms (set by AETRAA Admin at project onboarding)
  client_name         TEXT,               -- the client / employer
  location            TEXT,               -- site location / emirate
  retention_pct       REAL,               -- % retained on each interim certificate
  retention_limit_pct REAL,               -- cap on total retention (e.g. 5%)
  advance_pct         REAL,               -- advance payment %
  payment_days        INTEGER,            -- days the client has to pay a certified IPC
  payment_terms       TEXT,               -- JSON: advance recovery, materials on site %, VAT %, days to certify (src/ipc.js)
  setup_state         TEXT,               -- 'draft' | 'live' — onboarding state
  -- the baseline logic, imported from the contract .xer
  data_date           TEXT,               -- what the baseline was last calculated to
  default_calendar    TEXT,
  retained_logic      INTEGER DEFAULT 1,  -- 0 = progress override, which severs the critical path
  contract_finish     TEXT,               -- what float is measured against
  archived            INTEGER DEFAULT 0,
  sort_order          INTEGER,
  created_at          TEXT
);

-- The programme. One row per activity (and per summary/WBS heading), per project.
CREATE TABLE activities (
  project_id      TEXT NOT NULL,
  id              TEXT NOT NULL,      -- activity ID as it comes from P6
  wbs             TEXT,
  name            TEXT NOT NULL,
  level           INTEGER DEFAULT 1,  -- 0 = summary heading, 1+ = detail
  planned_start   TEXT,
  planned_finish  TEXT,
  weight          REAL,               -- blank = weight by duration
  trade           TEXT,               -- drives the site page
  trade_group     TEXT,               -- "Civil" / "MEP" - groups the trade picker
  floor           TEXT,
  discipline      TEXT,
  phase           TEXT,
  responsible     TEXT,
  sort_order      INTEGER,
  -- from the baseline .xer, and the reason a forecast is possible at all
  calendar_id     TEXT,               -- which calendar this activity is worked on
  act_type        TEXT,               -- TT_Task | TT_Mile | TT_FinMile | TT_LOE
  status          TEXT,               -- not_started | in_progress | complete
  orig_minutes    INTEGER,            -- original duration, in working minutes
  remain_minutes  INTEGER,            -- what is still to run
  phys_pct        REAL,
  actual_start    TEXT,
  actual_finish   TEXT,
  constraint_type TEXT,               -- start_on_or_after, finish_on_or_before, …
  constraint_date TEXT,
  -- P6's own answer, kept so the engine can be marked against the programme
  -- everybody else is reading rather than against an opinion
  p6_early_start  TEXT,
  p6_early_finish TEXT,
  p6_total_float  INTEGER,
  -- what the platform made of it on import
  kind            TEXT,               -- site | drawing | material | procurement
  source          TEXT,               -- programme | derived
  derive_note     TEXT,               -- why a derived date is what it is
  work_starts     TEXT,               -- the site work a deliverable is needed for
  PRIMARY KEY (project_id, id)
);
CREATE INDEX idx_activities_trade ON activities(project_id, trade);
CREATE INDEX idx_activities_floor ON activities(project_id, floor);

-- Every progress update ever submitted. Never overwritten.
CREATE TABLE updates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT NOT NULL,
  activity_id   TEXT NOT NULL,
  report_date   TEXT NOT NULL,
  pct           REAL,
  actual_start  TEXT,
  actual_finish TEXT,
  status        TEXT,                 -- not_started | in_progress | complete | at_risk | delayed | on_hold
  delay_reason  TEXT,
  remarks       TEXT,
  submitted_by  TEXT,
  source        TEXT NOT NULL DEFAULT 'site',   -- 'site' = a person, 'import' = bulk from the programme
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_updates_activity ON updates(project_id, activity_id, id);
CREATE INDEX idx_updates_date ON updates(project_id, report_date);

CREATE TABLE manpower (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id   TEXT NOT NULL,
  report_date  TEXT NOT NULL,
  trade        TEXT NOT NULL,
  headcount    INTEGER DEFAULT 0,
  plant        TEXT,
  submitted_by TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_manpower_date ON manpower(project_id, report_date);

-- Photos live in D1 as base64 so there is no R2 setup; the site form resizes
-- every image in the browser before upload.
CREATE TABLE photos (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL,
  activity_id  TEXT,
  report_date  TEXT,
  caption      TEXT,
  mime         TEXT,
  data         TEXT NOT NULL,
  submitted_by TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_photos_project ON photos(project_id, created_at);

-- A target campaign: activities that must be cleared by a fixed date, laid over the
-- programme. Status is never stored here - it is derived from what site reports.
CREATE TABLE targets (
  project_id    TEXT NOT NULL,
  activity_id   TEXT NOT NULL,
  target_group  TEXT,
  work          TEXT,
  level         TEXT,
  days_left     REAL,
  target_start  TEXT,
  target_finish TEXT,
  sort_order    INTEGER,
  PRIMARY KEY (project_id, activity_id)
);
CREATE INDEX idx_targets_group ON targets(project_id, target_group);

-- The issues register: RFIs, notices and inspection requests raised against an
-- activity. raised_date is the date the person on site became aware, which is the
-- date that matters later; issued_date is when it left the office.
CREATE TABLE issues (
  project_id    TEXT NOT NULL,
  no            INTEGER NOT NULL,   -- sequence within the project and type
  ref           TEXT NOT NULL,      -- RFI-0001, ACC-0003 …
  type          TEXT NOT NULL,      -- rfi | drawing | access | material | instruction | inspection | other
  activity_id   TEXT,
  title         TEXT NOT NULL,
  detail        TEXT,
  trade         TEXT,
  floor         TEXT,
  raised_by     TEXT,
  raised_date   TEXT,               -- the awareness date — where the clock starts
  status        TEXT,               -- draft | issued | answered | closed | withdrawn
  issued_date   TEXT,
  reply_due     TEXT,
  answered_date TEXT,
  answer        TEXT,
  closed_date   TEXT,
  impact_days   REAL,
  notice_ref    TEXT,               -- your own outgoing letter reference, once issued
  photo_id      TEXT,
  created_at    TEXT,
  updated_at    TEXT,
  PRIMARY KEY (project_id, ref)
);
CREATE INDEX idx_issues_status ON issues(project_id, status);
CREATE INDEX idx_issues_activity ON issues(project_id, activity_id);
CREATE INDEX idx_issues_raised ON issues(project_id, raised_date);

-- Access codes. A project can hand out as many as it needs, each scoped to the
-- trade groups and trades it covers. The scope is enforced on the server, not
-- merely hidden in the page, and revoking one takes effect immediately.
CREATE TABLE access_codes (
  id            TEXT PRIMARY KEY,   -- ac_xxxxxxxx, carried in the sign-in cookie
  project_id    TEXT NOT NULL,
  label         TEXT NOT NULL,      -- "Civil / Architecture — Rakesh"
  role          TEXT NOT NULL,      -- manager | lead | site | view
  scope_groups  TEXT,               -- JSON ["Civil"] — blank means the whole project
  scope_trades  TEXT,               -- JSON ["Lift Installation"] for odd extras
  code_hash     TEXT NOT NULL,
  active        INTEGER DEFAULT 1,
  created_at    TEXT,
  last_used     TEXT
);
CREATE INDEX idx_access_project ON access_codes(project_id);
CREATE INDEX idx_access_hash ON access_codes(code_hash);

-- The office checking what site has claimed. One row per activity, holding the
-- verdict against the claim it was given for — site reporting again puts the
-- activity back in the queue, which is the point of update_id being here.
CREATE TABLE verifications (
  project_id  TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  update_id   INTEGER,        -- the claim that was examined
  pct         REAL,           -- what was claimed at the time
  status      TEXT,           -- verified | queried
  by          TEXT,
  at          TEXT,
  note        TEXT,           -- required when queried: what site must fix
  PRIMARY KEY (project_id, activity_id)
);
CREATE INDEX idx_verify_status ON verifications(project_id, status);

-- The project manager signing off a day's progress. Progress stays live the
-- moment site sends it; this records that the office has looked at it.
CREATE TABLE day_review (
  project_id  TEXT NOT NULL,
  report_date TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  note        TEXT,
  PRIMARY KEY (project_id, report_date)
);

-- The daily site diary — one record per project per day. The sheet that goes to
-- the Consultant is a print of this, not a separate document. The list columns
-- hold JSON because they are rows on a form, never queried one by one.
CREATE TABLE diary (
  project_id   TEXT NOT NULL,
  report_date  TEXT NOT NULL,
  weather      TEXT,          -- "Sunny, Dusty"
  staff        TEXT,          -- [{t:trade, n:number, h:hours}]
  plant        TEXT,          -- [{t:category, n:number, h:hours}]
  materials    TEXT,          -- [{m:material, q:qty, u:unit}]
  works        TEXT,          -- [{a:activity, q:men}]
  tomorrow     TEXT,          -- [{a:activity, q:men}]  -> becomes tomorrow's works
  subs         TEXT,          -- [{n:name, s:staff, l:labour}]
  remarks      TEXT,
  visitors     TEXT,
  prepared_by  TEXT,
  status       TEXT,          -- draft | submitted
  submitted_at TEXT,
  created_at   TEXT,
  updated_at   TEXT,
  PRIMARY KEY (project_id, report_date)
);

-- Settings that belong to the whole app rather than one project.
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
INSERT INTO meta (key, value) VALUES
  ('org_name', 'Site Progress Monitor'),
  ('currency', 'AED');

-- ---------------------------------------------------------------------------
-- Organisations and real people.
--
-- An organisation is the customer. It owns projects, holds the people, and is
-- what gets billed, suspended or closed. Every project carries org_id, so one
-- contractor can never see another's programme even by guessing an id.
-- ---------------------------------------------------------------------------

CREATE TABLE orgs (
  id          TEXT PRIMARY KEY,     -- org_xxxxxxxx
  name        TEXT NOT NULL,        -- "NAF Contracting LLC"
  slug        TEXT,
  country     TEXT,                 -- AE, SA …
  plan        TEXT,                 -- trial | starter | standard | enterprise
  status      TEXT,                 -- trial | active | suspended | closed
  trial_ends  TEXT,
  seats       INTEGER,
  data_region TEXT,                 -- where this customer's data physically sits
  logo        TEXT,                 -- the client company's logo (data: URL)
  email_domains TEXT,               -- JSON list: people must sign in with these domains (blank = not locked)
  email_allowed TEXT,               -- JSON list: outside domains / addresses also allowed (subcontractor, consultant)
  created_at  TEXT
);

-- A person, not a code. Their name goes on every update they send, which is the
-- whole reason for this table existing.
--
-- Office people sign in with their email and a six-digit code. Site people have
-- no email, so they carry a personal code — the same shape as the old shared
-- codes, but belonging to one man and withdrawable on its own.
CREATE TABLE users (
  id           TEXT PRIMARY KEY,    -- usr_xxxxxxxx, carried in the cookie
  org_id       TEXT NOT NULL,
  name         TEXT NOT NULL,
  email        TEXT,                -- NULL for site people
  phone        TEXT,
  role         TEXT NOT NULL,       -- owner | manager | lead | site | view (legacy, derived from functions)
  functions    TEXT,                -- JSON ["qaqc","site"] — the fine-grained functions this person holds
  status       TEXT,                -- invited | active | suspended
  scope_groups TEXT,                -- JSON ["Civil"] — same shape as access_codes
  scope_trades TEXT,
  project_ids  TEXT,                -- JSON; empty means every project in the org
  invite_hash  TEXT,                -- SHA-256 of their personal code
  invited_by   TEXT,
  created_at   TEXT,
  last_seen    TEXT
);
CREATE INDEX idx_users_org ON users(org_id, status);
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_invite ON users(invite_hash);

-- One-time email codes. Hashed, single use, ten minutes, five guesses.
CREATE TABLE sign_in_codes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  expires    TEXT NOT NULL,
  used       INTEGER DEFAULT 0,
  tries      INTEGER DEFAULT 0,
  created_at TEXT
);
CREATE INDEX idx_signin_user ON sign_in_codes(user_id, used);

-- Who did what. Append-only, and nothing in the app may fail because a line
-- could not be written here.
CREATE TABLE audit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id     TEXT,
  project_id TEXT,
  user_id    TEXT,
  who        TEXT,
  action     TEXT,
  detail     TEXT,
  at         TEXT
);
CREATE INDEX idx_audit_org ON audit(org_id, at);

-- Day-rates and unit rates, per project. Kept apart from everything else because
-- they are the one commercially sensitive thing in the database: the API strips
-- them for anyone but the owner, so a curious person reading the network traffic
-- learns nothing about what labour costs.
CREATE TABLE rates (
  project_id TEXT NOT NULL,
  kind       TEXT NOT NULL,     -- labour | plant | material
  name       TEXT NOT NULL,     -- trade, plant category or material, as it appears on the diary
  rate       REAL,              -- per man-day, per plant-day, or per unit
  unit       TEXT,
  updated_at TEXT,
  PRIMARY KEY (project_id, kind, name)
);

-- ------------------------------------------------------------------ drawings
--
-- The register. One row per sheet per revision: Rev C does not overwrite Rev B,
-- it supersedes it, and Rev B stays readable because what was issued in March is
-- a fact about March.
--
-- trade / trade_group / floor are how a sheet finds its activities. Blank means
-- "applies everywhere", which is what a specification section and a general
-- arrangement actually are.
--
-- The bytes sit in `data` as a data: URL. D1 caps a value at 2 MB, so this holds
-- for trying the thing out and not for a real set — when it moves to object
-- storage, `url` is where the link goes and `data` stays empty.
-- status is the whole lifecycle of a sheet, and what the dashboard, the site
-- page and every activity are shown is derived from it — never set by hand:
--   pending     an engineer uploaded it; the PM has not approved it. It is in
--               the register for all to see, marked "awaiting approval", but it
--               reaches no activity and is not on the dashboard.
--   current     approved. THE live sheet to build to. Exactly one per number.
--   superseded  was live, replaced by a newer approved revision. Kept, stamped.
--   rejected    the PM bounced it back with a note; the engineer revises it.
-- A pending revision does not retire the live one — the sheet on site does not
-- move until the PM approves. Retiring happens at the moment of approval.
CREATE TABLE drawings (
  project_id    TEXT NOT NULL,
  id            TEXT NOT NULL,
  number        TEXT NOT NULL,      -- AR-101, SK-12, SPEC-03 30 00
  revision      TEXT,               -- C, 2, P1
  title         TEXT,
  kind          TEXT,               -- shop | ifc | spec | sketch | other
  discipline    TEXT,               -- Architectural / Structural / MEP
  trade         TEXT,               -- matches activities.trade
  trade_group   TEXT,               -- matches activities.trade_group
  floor         TEXT,               -- matches activities.floor
  status        TEXT DEFAULT 'current',   -- pending | current | superseded | rejected
  superseded_by TEXT,               -- the drawing id that replaced this one
  mime          TEXT,
  size          INTEGER,
  data          TEXT,               -- data:...;base64,...  (small sheets, testing only)
  url           TEXT,               -- a link instead of a file
  r2_key        TEXT,               -- the object-storage key for a real set (R2 binding "DRAWINGS")
  uploaded_by   TEXT,
  uploaded_at   TEXT,
  approved_by   TEXT,               -- the PM who approved it
  approved_at   TEXT,
  reject_note   TEXT,               -- why the PM sent it back, when rejected
  PRIMARY KEY (project_id, id)
);
CREATE INDEX idx_drawings_number ON drawings(project_id, number, status);
CREATE INDEX idx_drawings_status ON drawings(project_id, status);

-- A pin: this sheet, this activity, said by hand. Overrides the trade/floor rule
-- in one direction only — a pin adds a drawing, it never takes one away.
CREATE TABLE drawing_links (
  project_id  TEXT NOT NULL,
  drawing_id  TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  by          TEXT,
  at          TEXT,
  PRIMARY KEY (project_id, drawing_id, activity_id)
);
CREATE INDEX idx_dlinks_act ON drawing_links(project_id, activity_id);

-- ------------------------------------------------------- the schedule logic
--
-- What follows what. Without this the app can say an activity is late and
-- nothing more; with it, the same lateness can be pushed through the network
-- and come out as a date at the end of the job.
--
-- Imported from the contract baseline .xer and then left alone: the baseline is
-- the thing progress is measured against, so it does not move when site does.
CREATE TABLE links (
  project_id  TEXT NOT NULL,
  from_id     TEXT NOT NULL,      -- predecessor activity id
  to_id       TEXT NOT NULL,      -- successor
  type        TEXT NOT NULL,      -- FS | SS | FF | SF
  lag_minutes INTEGER DEFAULT 0,  -- may be negative; measured on the predecessor's calendar
  PRIMARY KEY (project_id, from_id, to_id, type)
);
CREATE INDEX idx_links_from ON links(project_id, from_id);
CREATE INDEX idx_links_to ON links(project_id, to_id);

-- Which days are worked, and which are Eid. A forecast that counts Fridays as
-- working days is wrong by a fortnight before it does anything else.
CREATE TABLE calendars (
  project_id  TEXT NOT NULL,
  id          TEXT NOT NULL,
  name        TEXT,
  day_minutes INTEGER,            -- what one working day is worth, in minutes
  data        TEXT,               -- JSON: the weekly pattern and the dated exceptions
  PRIMARY KEY (project_id, id)
);
