// A WHOLE PROJECT, SO THE PLATFORM CAN BE SEEN DOING ITS JOB.
//
// Everything here goes in through the real API, exactly as a real project team
// would put it in — no rows written behind the platform's back. What comes out
// on screen is therefore what the platform actually does with it.
//
// Used by tools/demo.mjs (a live demo you can click through) and by
// tools/build-demo.mjs (the single-file demo).

const PHOTO_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TRADES = ['Civil', 'MEP', 'Architecture'];

// A G+2P+12 residential tower, the shape of a real Dubai job.
function programme() {
  const rows = [['ID', 'Activity', 'WBS', 'Planned Start', 'Planned Finish', 'Trade Group', 'Weight'].join(',')];
  // A field with a comma in it ("rebar, formwork & pour") is quoted, or the row's columns shift.
  const q = (v) => (/[",]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  const add = (id, name, wbs, s, f, trade, w) => rows.push([id, name, wbs, s, f, trade, w].map(q).join(','));

  add('A1000', 'Site establishment & hoarding', 'Preliminaries', '2026-01-05', '2026-01-23', 'Civil', 40);
  add('A1010', 'Shoring & dewatering', 'Substructure', '2026-01-26', '2026-03-06', 'Civil', 120);
  add('A1020', 'Excavation to formation', 'Substructure', '2026-03-09', '2026-04-03', 'Civil', 90);
  add('A1030', 'Raft foundation — rebar & pour', 'Substructure', '2026-04-06', '2026-05-15', 'Civil', 180);
  add('A1040', 'Basement 2 slab & columns', 'Substructure', '2026-05-18', '2026-06-19', 'Civil', 140);
  add('A1050', 'Basement 1 slab & columns', 'Substructure', '2026-06-22', '2026-07-24', 'Civil', 140);
  add('A1060', 'Ground floor slab', 'Superstructure', '2026-07-27', '2026-08-21', 'Civil', 120);
  add('A1070', 'Podium level 1 — slab & columns', 'Superstructure', '2026-08-24', '2026-09-18', 'Civil', 110);
  add('A1080', 'Podium level 2 — slab & columns', 'Superstructure', '2026-09-21', '2026-10-16', 'Civil', 110);
  add('A1090', 'L1 slab — rebar, formwork & pour', 'Superstructure', '2026-10-19', '2026-11-06', 'Civil', 100);
  add('A1100', 'L2 slab — rebar, formwork & pour', 'Superstructure', '2026-11-09', '2026-11-27', 'Civil', 100);
  add('A1110', 'L3 slab — rebar, formwork & pour', 'Superstructure', '2026-11-30', '2026-12-18', 'Civil', 100);
  add('A1120', 'L4 slab — rebar, formwork & pour', 'Superstructure', '2026-12-21', '2027-01-15', 'Civil', 100);

  add('A2000', 'Blockwork — basement & podium', 'Architecture', '2026-08-03', '2026-10-30', 'Architecture', 150);
  add('A2010', 'Blockwork — L1 to L4', 'Architecture', '2026-11-02', '2027-01-29', 'Architecture', 150);
  add('A2020', 'Internal plaster — podium', 'Architecture', '2026-10-05', '2026-12-11', 'Architecture', 90);
  add('A2030', 'Facade — mock-up & approval', 'Facade', '2026-09-07', '2026-10-16', 'Architecture', 60);
  add('A2040', 'Facade — unitised install L1 to L4', 'Facade', '2026-12-07', '2027-03-26', 'Architecture', 200);
  add('A2050', 'Waterproofing — podium roof', 'Architecture', '2026-10-19', '2026-11-20', 'Architecture', 50);

  add('A3000', 'MEP — underground services', 'MEP', '2026-04-06', '2026-06-05', 'MEP', 80);
  add('A3010', 'MEP 1st fix — basement', 'MEP', '2026-06-08', '2026-08-28', 'MEP', 120);
  add('A3020', 'MEP 1st fix — podium', 'MEP', '2026-09-07', '2026-11-27', 'MEP', 120);
  add('A3030', 'MEP 1st fix — L1 to L4', 'MEP', '2026-11-30', '2027-02-26', 'MEP', 140);
  add('A3040', 'Chiller plant — install & align', 'MEP', '2026-11-02', '2026-12-25', 'MEP', 90);
  add('A3050', 'LV room & main switchgear', 'MEP', '2026-10-05', '2026-11-27', 'MEP', 80);
  add('A3060', 'Fire fighting — risers & pumps', 'MEP', '2026-11-09', '2027-01-15', 'MEP', 70);
  add('A3070', 'Substation — build & handover', 'MEP', '2026-08-03', '2026-11-27', 'MEP', 100);

  add('A4000', 'Lift installation — cars 1 & 2', 'Vertical transport', '2027-01-04', '2027-04-02', 'MEP', 110);
  add('A4010', 'Testing & commissioning — MEP', 'Commissioning', '2027-03-01', '2027-05-28', 'MEP', 120);
  add('A4020', 'Snagging & de-snagging', 'Handover', '2027-05-03', '2027-06-25', 'Architecture', 80);
  add('A4030', 'Authority inspections & completion', 'Handover', '2027-06-01', '2027-07-30', 'Civil', 60);
  return rows.join('\n');
}

// How far each activity has actually got. Deliberately uneven — a job where
// everything is on plan teaches nobody anything.
const PROGRESS = {
  A1000: 100, A1010: 100, A1020: 100, A1030: 100, A1040: 100, A1050: 100,
  A1060: 100, A1070: 100, A1080: 92, A1090: 55, A1100: 20,
  A2000: 78, A2010: 12, A2020: 35, A2030: 100, A2050: 40,
  A3000: 100, A3010: 88, A3020: 45, A3050: 30, A3070: 62,
};
const FLAGGED = { A1090: 'delayed', A3070: 'at_risk', A2010: 'delayed' };

// A demo company, invented on purpose: no real contractor, consultant or
// employer is named anywhere in it, so it can be shown to any of them.
export const DEMO = {
  company: 'Contracting Company LLC',
  project: 'Residential Tower — G+2P+12',
  location: 'Dubai, UAE',
  ref: 'PRJ-0001',
  engineer: 'Consulting Engineer',
  client: 'Client Company',
  domain: 'demo.aetraa.ae',
};
const at = (who) => who + '@' + DEMO.domain;

// Seats, not people. A demo audience should see the job title that will be
// theirs, not somebody else's name — and no invented person can be mistaken for
// a reference.
export const TEAM = [
  ['Principal',              at('principal'),  ['principal'],  []],
  ['Project Manager',        at('pm'),         ['pm'],         []],
  ['Planning Engineer',      at('planning'),   ['planning'],   []],
  // The civil engineer also reports the architectural works (blockwork, finishes) — the seed sends them.
  ['Site Engineer — Civil',  at('civil'),      ['site'],       ['Civil', 'Architecture']],
  ['Site Engineer — MEP',    at('mep'),        ['site'],       ['MEP']],
  ['Design Manager',         at('design'),     ['design'],     []],
  ['Document Controller',    at('dc'),         ['dc'],         []],
  ['QA/QC Engineer',         at('qaqc'),       ['qaqc'],       []],
  ['HSE Officer',            at('hse'),        ['hse'],        []],
  ['Quantity Surveyor',      at('qs'),         ['commercial', 'procurement', 'finance'], []],
  ['Consultant (read-only)', at('consultant'), ['consultant'], []],
];

export async function seedDemo(api, log, ownerCode) {
  const say = log || (() => {});
  // A step that fails quietly leaves a demo that looks built and is empty.
  const must = (what, r) => {
    if (!r || r.error || r._status >= 400) {
      throw new Error('demo seed failed at "' + what + '": ' + JSON.stringify(r).slice(0, 200));
    }
    return r;
  };
  // Each demo person carries a personal code (see saveUser: the 'demo' plan),
  // so the seeding signs in the way a demo audience will. On the in-memory demo
  // there is a fixed test code instead, which is what the fallback is for.
  const CODES = {};
  const as = async (email) => {
    api.reset();
    if (CODES[email]) {
      const r = await api.post('/api/login', { code: CODES[email] });
      if (r && !r.error) return;
    }
    const r = await api.post('/api/signin/code', { email, code: '246810' });
    if (!r || r.error) throw new Error('could not sign in as ' + email + ': ' + JSON.stringify(r).slice(0, 120));
  };

  // ---- AETRAA sets the project up -------------------------------------
  api.reset();
  must('the AETRAA Admin signing in', await api.post('/api/login', { code: ownerCode || 'MASTERCODE' }));
  const admin = api.cookie();

  const on = must('onboarding the project', await api.post('/api/setup/onboard', {
    company: { name: DEMO.company, plan: 'demo', email_domains: [DEMO.domain] },
    project: {
      name: DEMO.project, location: DEMO.location, ref: DEMO.ref,
      currency: 'AED', retention_pct: 10, retention_limit_pct: 5, payment_days: 56,
      contract_completion: '2027-07-30',
      engineer_name: DEMO.engineer, contractor_name: DEMO.company,
      client_name: DEMO.client,
    },
    principal: { name: 'Principal', email: at('principal') },
  }));
  const PID = on.project_id;
  const OID = on.company_id;            // named explicitly: a live server has more
  if (!PID) throw new Error('onboarding returned no project id');  // than one company on it
  say('project ' + PID);

  for (const [name, email, functions, groups] of TEAM) {
    if (email === at('principal')) continue;
    const r = must('creating ' + email, await api.post('/api/person',
      { org: OID, name, email, functions, groups, projects: [PID] }));
    if (r && r.code) CODES[email] = r.code;
  }
  say(TEAM.length + ' people');

  // The owner is not inside a project, so it names one: ?p= is how the platform
  // lets the platform owner act on a particular project.
  must('importing the programme', await api.post('/api/import?p=' + PID, { replace: true, text: programme() }));
  say('programme imported');

  must('importing the BOQ', await api.post('/api/boq/import', { project_id: PID, rows: [
    { ref: 'A', section: 'Preliminaries', description: 'Site set-up, staff, plant, insurances', amount: 3200000 },
    { ref: 'B', section: 'Substructure', description: 'Shoring, excavation, raft, basements', amount: 14800000 },
    { ref: 'C', section: 'Superstructure', description: 'RC frame, slabs, columns, cores', amount: 18400000 },
    { ref: 'D', section: 'Architecture', description: 'Blockwork, plaster, finishes', amount: 9600000 },
    { ref: 'E', section: 'Facade', description: 'Unitised curtain wall & glazing', amount: 12200000 },
    { ref: 'F', section: 'MEP', description: 'Mechanical, electrical, plumbing', amount: 16900000 },
    { ref: 'G', section: 'Vertical transport', description: 'Lifts — supply and install', amount: 3400000 },
    { ref: 'H', section: 'Handover', description: 'Commissioning, snagging, authority', amount: 1500000 },
  // K1: a bill priced as section lump sums has no rates, and every line with no
  // rate is flagged (v5 E7). The QS accepts them with the reason, as a real QS would.
  ], accept: { note: 'Priced as section lump sums at tender — no unit rates in this bill' } }));
  say('BOQ imported — AED 80.0m, waiting for the PM');

  must('importing the BOM', await api.post('/api/bom/import', { project_id: PID, rows: [
    // Each material names the BOQ line it is used in (v5 E8 step 2).
    { material: 'C40/20 ready-mix concrete', unit: 'm3', budget_qty: 12400, rate: 245, boq_ref: 'C', discipline: 'Civil' },
    { material: 'Reinforcement T12–T32', unit: 't', budget_qty: 1860, rate: 2750, boq_ref: 'C', discipline: 'Civil' },
    { material: 'Solid block 200mm', unit: 'no', budget_qty: 38000, rate: 3.1, boq_ref: 'D', discipline: 'Architecture' },
    { material: 'Cement — OPC 50kg', unit: 'bag', budget_qty: 21000, rate: 14.5, boq_ref: 'D', discipline: 'Architecture' },
    { material: 'Waterproofing membrane', unit: 'm2', budget_qty: 9400, rate: 38, boq_ref: 'B', discipline: 'Civil' },
    { material: 'uPVC drainage pipe 110mm', unit: 'm', budget_qty: 4200, rate: 22, boq_ref: 'F', discipline: 'MEP' },
  ] }));
  say('BOM imported — each material matched to its BOQ line');

  // The authorities to deal with are chosen (the route takes a list now).
  await api.post('/api/setup/authorities', { project_id: PID, authorities: [
    { name: 'Dubai Municipality', code: 'DM' }, { name: 'Dubai Civil Defence', code: 'DCD' }, { name: 'DEWA', code: 'DEWA' }] }).catch(() => {});

  // ---- the site reports progress, through the real API -----------------
  await as(at('civil'));
  for (const [id, pct] of Object.entries(PROGRESS)) {
    if (!/^A1|^A2/.test(id)) continue;      // Civil and Architecture
    // An activity claimed complete needs its photograph first (the platform's rule).
    if (pct >= 100) await api.post('/api/photo', { activity_id: id, data: PHOTO_PNG, caption: 'Completed — ' + id }).catch(() => {});
    await api.post('/api/update', { activity_id: id, pct, status: FLAGGED[id] || null });
  }
  await as(at('mep'));
  for (const [id, pct] of Object.entries(PROGRESS)) {
    if (!/^A3|^A4/.test(id)) continue;         // MEP, lifts and commissioning
    // An activity claimed complete needs its photograph first (the platform's rule).
    if (pct >= 100) await api.post('/api/photo', { activity_id: id, data: PHOTO_PNG, caption: 'Completed — ' + id }).catch(() => {});
    await api.post('/api/update', { activity_id: id, pct, status: FLAGGED[id] || null });
  }
  say('progress reported by the site engineers');

  // ---- the registers fill up, each by the function that owns it --------
  const raise = async (email, type, title, data) => {
    await as(email);
    const r = await api.post('/api/records', { type, title, data: data || {} });
    return r && r.ref;
  };

  await as(at('design'));
  for (const [t, d] of [
    ['External paint system', { Title: 'External paint system', Discipline: 'Architectural', 'Spec section': '09 91 00', 'Required reply by': '2026-10-02' }],
    ['L4 slab formwork drawings', { Title: 'L4 slab formwork drawings', Discipline: 'Structural', 'Spec section': '03 11 00', 'Required reply by': '2026-09-30' }],
    ['Unitised facade — shop drawings', { Title: 'Unitised facade — shop drawings', Discipline: 'Facade', 'Required reply by': '2026-10-09' }],
  ]) await api.post('/api/records', { type: 'submittal', title: t, data: d });
  for (const [t, d] of [
    ['L5 beam / duct clash at grid E-7', { Subject: 'L5 beam / duct clash at grid E-7', Discipline: 'MEP', Priority: 'Urgent', 'Drawing ref': 'ME-150 / ST-210', 'Reply needed by': '2026-09-26' }],
    ['Basement sump pump location', { Subject: 'Basement sump pump location', Discipline: 'MEP', Priority: 'Normal', 'Reply needed by': '2026-10-06' }],
    ['Podium roof parapet detail', { Subject: 'Podium roof parapet detail', Discipline: 'Architectural', Priority: 'Normal', 'Reply needed by': '2026-10-10' }],
  ]) await api.post('/api/records', { type: 'rfi', title: d.Subject, data: d });
  await api.post('/api/records', { type: 'material', title: 'Rebar mill certificates — batch 14',
    data: { Material: 'Rebar mill certificates — batch 14', 'Spec section': '03 21 00' } });

  await as(at('qaqc'));
  for (const [t, d] of [
    ['L4 slab — pre-pour inspection', { 'Activity / element': 'L4 slab — pre-pour', Discipline: 'Civil', 'Inspection date': '2026-09-24' }],
    ['Podium 2 waterproofing — flood test', { 'Activity / element': 'Podium 2 waterproofing', Discipline: 'Civil', 'Inspection date': '2026-09-23' }],
    ['Blockwork L1 — line & level', { 'Activity / element': 'Blockwork L1', Discipline: 'Architecture', 'Inspection date': '2026-09-25' }],
  ]) await api.post('/api/records', { type: 'wir', title: t, data: d });
  await api.post('/api/records', { type: 'ncr', title: 'Blockwork alignment out of tolerance — L3 Zone C',
    data: { 'Non-conformance': 'Blockwork alignment out of tolerance — L3 Zone C', Location: 'L3 Zone C', Severity: 'Major', Disposition: 'Rework' } });
  await api.post('/api/records', { type: 'ncr', title: 'Concrete cube result below 40N — pour P-118',
    data: { 'Non-conformance': 'Concrete cube result below 40N — pour P-118', Location: 'Podium 2 slab', Severity: 'Major', Disposition: 'Repair' } });

  await as(at('hse'));
  for (const [t, d] of [
    ['Hot work — L2 core, welding', { 'Activity / type': 'Hot work', Location: 'L2 core', 'Valid until': '2026-09-24', 'Fire watch / standby': 'Assigned', 'Precautions taken': 'Extinguisher, screens, combustibles cleared' }],
    ['Lifting — facade unit trial lift', { 'Activity / type': 'Lifting', Location: 'Podium 2 east', 'Valid until': '2026-09-23', 'Fire watch / standby': 'Not required', 'Precautions taken': 'Exclusion zone, banksman, certified gear' }],
  ]) await api.post('/api/records', { type: 'ptw', title: t, data: d });
  for (const [t, d] of [
    ['Edge protection missing — L2 east', { Finding: 'Edge protection missing — L2 east', Location: 'L2 east', Risk: 'High', 'Action required': 'Install guardrail before shift end' }],
    ['Housekeeping — basement 1 access route', { Finding: 'Housekeeping — basement 1 access route', Location: 'Basement 1', Risk: 'Medium', 'Action required': 'Clear route, reinstate lighting' }],
  ]) await api.post('/api/records', { type: 'obs', title: d.Finding, data: d });
  await api.post('/api/records', { type: 'incident', title: 'Dropped scaffold clip — no injury',
    data: { Type: 'Near-miss', Location: 'Podium 2', 'What happened': 'Clip fell 4m inside exclusion zone', 'Immediate action': 'Area swept, toolbox talk given' } });
  for (const [t, d] of [
    ['Tower crane — third party certificate', { Certificate: 'Tower crane — third party', 'Issued by': 'Third-party inspection body', 'Serial / plant no': 'TC-4412', Issued: '2026-03-14', Expires: '2027-03-13' }],
    ['Lifting gear — chains & slings', { Certificate: 'Lifting gear — chains & slings', 'Issued by': 'Third-party inspection body', 'Serial / plant no': 'LG-221', Issued: '2026-02-01', Expires: '2026-10-05' }],
    ['Crane operator licence', { Certificate: 'Crane operator licence', 'Issued by': 'Transport authority', Issued: '2026-01-10', Expires: '2027-01-09' }],
  ]) await api.post('/api/records', { type: 'cert', title: d.Certificate, data: d });

  await as(at('qs'));
  for (const [t, d] of [
    ['Podium landscape — client addition', { Description: 'Podium landscape — client addition', Origin: 'Instruction', 'Estimated cost (AED)': '640,000', 'Time effect (days)': '14', 'Basis of claim': 'Client instruction CI-08 dated 2026-08-19' }],
    ['Services diversion — authority requirement', { Description: 'Services diversion — authority requirement', Origin: 'Site condition', 'Estimated cost (AED)': '96,500', 'Time effect (days)': '4', 'Basis of claim': 'Authority comment on substation submission' }],
    ['Facade spandrel change to fritted glass', { Description: 'Facade spandrel change to fritted glass', Origin: 'Design change', 'Estimated cost (AED)': '1,180,000', 'Time effect (days)': '0', 'Basis of claim': 'Architect revision Rev C' }],
  ]) await api.post('/api/records', { type: 'variation', title: d.Description, data: d });
  await api.post('/api/records', { type: 'letter', title: 'Notice of delay — authority substation energisation',
    data: { Subject: 'Notice of delay — authority substation energisation', Type: 'Notice', To: 'Consultant', Body: 'Notice under Clause 20.1 in respect of delayed authority energisation.', 'Required issue by': '2026-09-28' } });

  await as(at('civil'));
  for (const [t, d] of [
    ['Screed 30N — podium 2', { Material: 'Screed 30N', Quantity: '150 m3', 'For (location)': 'Podium 2', 'Needed by': '2026-10-05', Notes: 'Ahead of waterproofing' }],
    ['Solid block 200mm — L1', { Material: 'Solid block 200mm', Quantity: '4,200 no', 'For (location)': 'L1 partitions', 'Needed by': '2026-10-01', Notes: '' }],
  ]) await api.post('/api/records', { type: 'mr', title: d.Material, data: d });
  say('registers filled by each function');

  // ---- the office moves things along ------------------------------------
  await as(at('pm'));
  // K1: the PM approves the bills before anything is valued or ordered against them.
  must('the PM approving the BOQ', await api.post('/api/bills/approve', { kind: 'boq' }));
  must('the PM approving the BOM', await api.post('/api/bills/approve', { kind: 'bom' }));
  say('the PM approved the BOQ and the BOM');
  const all = (await api.get('/api/records')).records || [];
  for (const r of all.filter((x) => ['submittal', 'wir', 'variation', 'ptw'].includes(x.type)).slice(0, 7)) {
    await api.post('/api/record/advance', { ref: r.ref, action: 'advance' });
  }
  say('the PM moved items along');

  // ---- procurement draws against the BOM, including one overrun --------
  await as(at('qs'));
  for (const [material, qty, ref] of [
    ['C40/20 ready-mix concrete', 8600, 'LPO-0114'],
    ['Reinforcement T12–T32', 1240, 'LPO-0115'],
    ['Solid block 200mm', 39200, 'LPO-0116'],
    ['Cement — OPC 50kg', 12800, 'LPO-0117'],
  ]) await api.post('/api/bom/order', { material, qty, ref });
  for (const [material, qty, ref] of [
    ['C40/20 ready-mix concrete', 8100, 'GRN-0231'],
    ['Reinforcement T12–T32', 1180, 'GRN-0232'],
    ['Solid block 200mm', 35600, 'GRN-0233'],
  ]) await api.post('/api/bom/grn', { material, qty, ref });
  say('orders and deliveries recorded — one line over the BOM');

  // ---- the safety log, a week of it ------------------------------------
  await as(at('hse'));
  const day = (back) => new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
  const men = [186, 192, 178, 201, 197, 164, 188];
  for (let i = 0; i < 7; i++) {
    await api.post('/api/hse/log', {
      log_date: day(i), men_on_site: men[i],
      toolbox_talks: i === 5 ? 1 : 2, toolbox_attended: i === 5 ? 22 : 40 + (i * 3),
      inductions: i % 3 === 0 ? 4 : 1,
      ppe_checked: 40, ppe_compliant: 40 - (i % 3),
      notes: i === 2 ? 'Wind stopped lifting after 14:00.' : '',
    });
  }
  say('a week of safety logs');

  // ---- and the money ----------------------------------------------------
  // A valuation the audience can argue with: each section priced where the job
  // actually is, not a flat percentage. Then the full chain — the QS prepares,
  // the PM approves, Document Control issues to the Engineer, and the
  // Engineer's certificate comes back a little under the application, which is
  // what happens on every job in the Gulf.
  const VALUED = {
    Preliminaries: 62, Substructure: 100, Superstructure: 46, Architecture: 24,
    Facade: 6, MEP: 34, 'Vertical transport': 0, Handover: 0,
  };
  await as(at('qs'));
  const prop = await api.post('/api/ipc/propose', {});
  if (prop && prop.lines) {
    const lines = prop.lines.map((l) => ({
      id: l.id, ref: l.ref, section: l.section, amount: l.amount,
      pct: VALUED[l.section] !== undefined ? VALUED[l.section]
        : Math.max(0, Math.round((l.proposed_pct || 0) * 0.92)),
    }));
    const ipc = await api.post('/api/ipc', { lines, reviewed: true, reviewed_by: 'Quantity Surveyor',
      materials_on_site: 840000, advance_recovery: 0,
      period_from: day(30), period_to: day(0) });
    if (ipc && ipc.ref) {
      say('valuation prepared — ' + ipc.ref + ' gross AED ' + Math.round((ipc.gross || 0) / 1000) + 'k');
      await as(at('pm'));
      await api.post('/api/ipc/advance', { ref: ipc.ref, action: 'approve' });
      await as(at('dc'));
      await api.post('/api/ipc/advance', { ref: ipc.ref, action: 'issue' });
      await as(at('qs'));
      // The Engineer's certificate, recorded by the office: 3% down on the claim.
      const certified = Math.round((ipc.net || ipc.gross || 0) * 0.97);
      const done = await api.post('/api/ipc/advance', {
        ref: ipc.ref, action: 'certify', certified_amount: certified,
        engineer_ref: "IPC-01",
      });
      say(done && !done.error ? 'certificate recorded — AED ' + Math.round(certified / 1000) + 'k'
        : 'certificate step said: ' + JSON.stringify(done).slice(0, 120));
    }
  }

  api.reset();
  return { PID, OID, admin, CODES };
}
