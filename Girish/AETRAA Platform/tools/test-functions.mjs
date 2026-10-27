// Exercises the functions / access matrix so a broken rule shows up here, not in
// production. Pure logic — no database needed.
//
//   node tools/test-functions.mjs
//
import { userFunctions, legacyRole, accessForUser, levelFor, canAssignPeople, cleanFunctions } from '../src/functions.js';

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) fails++;
}
const dashSet = (u) => accessForUser(u).map((v) => v[0]);
const lvl = (u, d) => levelFor(u, d);

/* multi-function user: QA/QC + Site */
const rahman = { functions: JSON.stringify(['qaqc', 'site']) };
check('multi-function parsed', userFunctions(rahman).join('+') === 'qaqc+site');
check('QA/QC full for QA engineer', lvl(rahman, 'qaqc') === 'full');
check('Site full for QA+Site engineer', lvl(rahman, 'site') === 'full');
check('Design read for site engineer', lvl(rahman, 'design') === 'read');
check('no team for a site engineer', lvl(rahman, 'team') === null);

/* commercial: read all + own full, no team */
const nair = { functions: JSON.stringify(['commercial', 'procurement', 'finance']) };
check('commercial own full', lvl(nair, 'commercial') === 'full');
check('procurement own full', lvl(nair, 'procurement') === 'full');
check('commercial reads QA/QC', lvl(nair, 'qaqc') === 'read');
check('commercial reads design', lvl(nair, 'design') === 'read');
check('commercial has NO team', lvl(nair, 'team') === null);

/* document control: see all + reports, own full, no team */
const george = { functions: JSON.stringify(['dc', 'design']) };
check('DC own full', lvl(george, 'dc') === 'full');
check('DC design full (also holds design)', lvl(george, 'design') === 'full');
check('DC reads commercial', lvl(george, 'commercial') === 'read');
check('DC has NO team', lvl(george, 'team') === null);

/* planning: own + read design + read discipline */
const menon = { functions: JSON.stringify(['planning']) };
check('planning own full', lvl(menon, 'planning') === 'full');
check('planning reads design', lvl(menon, 'design') === 'read');
check('planning reads discipline (site)', lvl(menon, 'site') === 'read');
check('planning cannot see commercial', lvl(menon, 'commercial') === null);

/* principal & PM: everything, incl. team */
const ajay = { functions: JSON.stringify(['principal']) };
const said = { functions: JSON.stringify(['pm']) };
check('principal sees team', lvl(ajay, 'team') === 'full');
check('principal full on commercial', lvl(ajay, 'commercial') === 'full');
check('PM sees team', lvl(said, 'team') === 'full');
check('PM full on hse', lvl(said, 'hse') === 'full');

/* who can assign people */
check('principal can assign people', canAssignPeople(ajay) === true);
check('PM can assign people', canAssignPeople(said) === true);
check('DC cannot assign people', canAssignPeople(george) === false);
check('commercial cannot assign people', canAssignPeople(nair) === false);
check('site cannot assign people', canAssignPeople(rahman) === false);

/* legacy fallback: a user with only an old role still resolves */
check('legacy owner → principal access', lvl({ role: 'owner' }, 'team') === 'full');
check('legacy site → site full', lvl({ role: 'site' }, 'site') === 'full');
check('legacy site → design read', lvl({ role: 'site' }, 'design') === 'read');
check('legacy manager → team', lvl({ role: 'manager' }, 'team') === 'full');

/* legacy role written back for a function set (keeps scope/login working) */
check('functions→legacy: principal=owner', legacyRole(['principal']) === 'owner');
check('functions→legacy: pm=manager', legacyRole(['pm']) === 'manager');
check('functions→legacy: site alone=site', legacyRole(['site']) === 'site');
check('functions→legacy: qaqc+site=lead', legacyRole(['qaqc', 'site']) === 'lead');
check('functions→legacy: consultant alone=view', legacyRole(['consultant']) === 'view');

/* cleanFunctions drops junk */
check('cleanFunctions filters unknown + dupes',
  cleanFunctions(['pm', 'pm', 'nope', 'qaqc']).join(',') === 'pm,qaqc');

console.log(fails ? '\n' + fails + ' checks failed.\n' : '\nAll checks passed.\n');
process.exit(fails ? 1 : 0);
