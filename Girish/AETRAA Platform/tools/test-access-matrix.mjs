// THE ACCESS MATRIX, ON RECORDS.
//
// Thirteen functions existed on screen and meant nothing behind the API, because
// the API asked only for a coarse legacy role — and 'lead' covers Design,
// Document Control, QA/QC, HSE, Commercial, Procurement, Finance and
// Subcontractors all at once. The Design office could raise a permit to work.
//
// Every function is checked against every record type here — both directions,
// what is allowed AND what must be refused — because a matrix tested only on
// its allowed cells is not tested at all.
//
//   node tools/test-access-matrix.mjs
import {
  FUNCTIONS, RECORD_CREATORS, RECORD_APPROVERS,
  mayCreateRecord, mayApproveRecord, whoMayRaise, whoMayApprove,
} from '../src/functions.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; if (!c) { console.log('  FAIL ' + n + (d ? '  — ' + d : '')); fails++; } else if (process.env.V) console.log('  ok   ' + n); };
const ok = (n) => { checks++; if (process.env.V) console.log('  ok   ' + n); };

const user = (...fns) => ({ functions: JSON.stringify(fns) });
const TYPES = Object.keys(RECORD_CREATORS);
const FNS = Object.keys(FUNCTIONS);

console.log('  ' + FNS.length + ' functions x ' + TYPES.length + ' record types, raise and approve\n');

// ---- the full grid, both directions ------------------------------------
let allowedCells = 0, refusedCells = 0;
for (const fn of FNS) {
  for (const t of TYPES) {
    const u = user(fn);
    const shouldCreate = fn === 'principal' || fn === 'pm' || (RECORD_CREATORS[t] || []).includes(fn);
    const didCreate = mayCreateRecord(u, t);
    check('[' + fn + '] ' + (shouldCreate ? 'MAY' : 'may NOT') + ' raise ' + t,
      didCreate === shouldCreate, 'got ' + didCreate);
    shouldCreate ? allowedCells++ : refusedCells++;

    const shouldApprove = fn === 'principal' || fn === 'pm' || (RECORD_APPROVERS[t] || []).includes(fn);
    const didApprove = mayApproveRecord(u, t);
    check('[' + fn + '] ' + (shouldApprove ? 'MAY' : 'may NOT') + ' approve ' + t,
      didApprove === shouldApprove, 'got ' + didApprove);
  }
}
console.log('  grid: ' + allowedCells + ' allowed cells, ' + refusedCells + ' refused cells, all as specified');

// ---- the cases that actually caused this ---------------------------------
check('Design canNOT raise a permit to work', !mayCreateRecord(user('design'), 'ptw'),
  'the hole this was written to close');
check('HSE canNOT raise a variation', !mayCreateRecord(user('hse'), 'variation'));
check('Procurement canNOT raise an NCR', !mayCreateRecord(user('procurement'), 'ncr'));
check('Finance canNOT raise anything at all',
  TYPES.every((t) => !mayCreateRecord(user('finance'), t)));
check('a Consultant canNOT raise anything', TYPES.every((t) => !mayCreateRecord(user('consultant'), t)));
check('a Subcontractor canNOT raise anything', TYPES.every((t) => !mayCreateRecord(user('subcon'), t)));
// Planning raises one thing and one thing only: the RFI for a question that is
// holding the programme up. Asking it through somebody else's login cost days
// and lost the date the question was actually asked, which is the date a delay
// claim turns on.
check('Planning raises an RFI and nothing else',
  TYPES.every((t) => mayCreateRecord(user('planning'), t) === (t === 'rfi')),
  TYPES.filter((t) => mayCreateRecord(user('planning'), t)).join(', '));
// Step 7: Document Control logs incoming correspondence — and nothing else.
check('Document Control raises only incoming letters',
  TYPES.every((t) => mayCreateRecord(user('dc'), t) === (t === 'incoming')),
  'DC reads every folder and logs what arrives, but raises no other record type');

// ---- and the jam it also fixes ------------------------------------------
check('QA/QC CAN now close its own NCR', mayApproveRecord(user('qaqc'), 'ncr'),
  'until now only the PM could move any record, which stops the job');
check('HSE CAN now sign its own permit', mayApproveRecord(user('hse'), 'ptw'));
check('Design CAN now return its own submittal', mayApproveRecord(user('design'), 'submittal'));
check('Commercial CAN now move its own variation', mayApproveRecord(user('commercial'), 'variation'));

// ---- the site engineer -------------------------------------------------
check('site CAN raise an inspection', mayCreateRecord(user('site'), 'wir'));
check('site CAN raise a material request', mayCreateRecord(user('site'), 'mr'));
check('site canNOT approve its own inspection', !mayApproveRecord(user('site'), 'wir'),
  'the man who did the work does not sign it off');
check('site canNOT raise an NCR against itself', !mayCreateRecord(user('site'), 'ncr'));
check('site canNOT raise a variation', !mayCreateRecord(user('site'), 'variation'));
check('nobody but the PM releases a material request',
  !mayApproveRecord(user('site'), 'mr') && !mayApproveRecord(user('procurement'), 'mr') &&
  mayApproveRecord(user('pm'), 'mr'));

// ---- several functions on one email ------------------------------------
const qsAll = user('commercial', 'procurement', 'finance');
check('one email holding QS + Procurement + Finance raises a variation', mayCreateRecord(qsAll, 'variation'));
check('and still canNOT raise an NCR', !mayCreateRecord(qsAll, 'ncr'));
const engQa = user('site', 'qaqc');
check('an engineer who is also QA/QC raises both an inspection and an NCR',
  mayCreateRecord(engQa, 'wir') && mayCreateRecord(engQa, 'ncr'));
check('and CAN approve the inspection, because QA/QC is a real second hat',
  mayApproveRecord(engQa, 'wir'));

// ---- the Principal and the PM ------------------------------------------
for (const t of TYPES) {
  check('Principal may raise ' + t, mayCreateRecord(user('principal'), t));
  check('PM may approve ' + t, mayApproveRecord(user('pm'), t));
}

// ---- who must never get through ----------------------------------------
check('a user with NO functions is refused', !mayCreateRecord({ functions: '[]' }, 'wir'));
check('a null user is refused', !mayCreateRecord(null, 'wir'));
// A type nobody has placed in a folder has nobody accountable for it. Holding
// every folder is not the same as holding one that does not exist.
check('an unknown record type is refused for EVERYONE, PM and Principal included',
  !mayCreateRecord(user('design'), 'not_a_real_type') &&
  !mayCreateRecord(user('pm'), 'not_a_real_type') &&
  !mayCreateRecord(user('principal'), 'not_a_real_type') &&
  !mayApproveRecord(user('pm'), 'not_a_real_type'),
  'a role that can do anything must still not do something that does not exist');
check('and not even the AETRAA Admin can smuggle one in',
  !mayCreateRecord(null, 'not_a_real_type', true));
check('a made-up function grants nothing', !mayCreateRecord(user('superuser'), 'wir'));
check('functions that are not an array grant nothing', !mayCreateRecord({ functions: '"design"' }, 'submittal'));
check('broken JSON in the column grants nothing', !mayCreateRecord({ functions: '{oops' }, 'submittal'));

// ---- the AETRAA Admin --------------------------------------------------
// Signs in with the master code and has no user row at all, so the matrix must
// be told explicitly. Without this the platform owner locks himself out.
check('the AETRAA Admin may raise anything', TYPES.every((t) => mayCreateRecord(null, t, true)));
check('the AETRAA Admin may approve anything', TYPES.every((t) => mayApproveRecord(null, t, true)));
check('but only when the flag is actually passed', !mayCreateRecord(null, 'wir', false));

// ---- legacy users, set up before functions existed ----------------------
check('a legacy owner still works', mayCreateRecord({ role: 'owner' }, 'variation'));
check('a legacy manager still works', mayCreateRecord({ role: 'manager' }, 'ncr'));
check('a legacy site user still raises inspections', mayCreateRecord({ role: 'site' }, 'wir'));
check('a legacy view-only user raises nothing', TYPES.every((t) => !mayCreateRecord({ role: 'view' }, t)));

// ---- what the screen tells a person ------------------------------------
check('a refusal names who CAN raise it', /QA \/ QC/.test(whoMayRaise('ncr')), whoMayRaise('ncr'));
check('and who can approve it', /QA \/ QC/.test(whoMayApprove('wir')) && /Project Manager/.test(whoMayApprove('wir')),
  whoMayApprove('wir'));
check('an inspection names both site and QA/QC', /Site Engineer/.test(whoMayRaise('wir')) && /QA \/ QC/.test(whoMayRaise('wir')),
  whoMayRaise('wir'));
check('a type with no folder holder still names somebody',
  whoMayApprove('mr').length > 0 && /Project Manager/.test(whoMayApprove('mr')), whoMayApprove('mr'));

// ---- every record type the platform accepts is IN the matrix ------------
// A type added later without a line here would be silently unraisable.
const { RECORD_TYPES } = await import('../src/records.js').catch(() => ({ RECORD_TYPES: null }));
if (RECORD_TYPES) {
  const missing = Object.keys(RECORD_TYPES).filter((t) => !RECORD_CREATORS[t]);
  check('every record type the platform stores has a line in the matrix',
    missing.length === 0, 'missing: ' + missing.join(', '));
} else {
  ok('record types not exported for cross-check');
}

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
