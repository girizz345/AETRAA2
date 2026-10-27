// The authorities a UAE project has to clear, by emirate.
//
// The design team picks the ones that apply to this project's location and may
// add any others — no list is ever complete, and a plot in a free zone or a
// master community brings its own. Each one chosen becomes an authority record,
// so it lands in the authority register with an action date and a status and is
// tracked exactly like every other submission.

export const AUTHORITIES = {
  'Dubai': [
    { code: 'DEWA',     name: 'DEWA',                          scope: 'Power & water — substation, connection, NOC' },
    { code: 'DM',       name: 'Dubai Municipality',            scope: 'Building permit, drainage, completion' },
    { code: 'DCD',      name: 'Dubai Civil Defence',           scope: 'Fire & life safety design and completion' },
    { code: 'RTA',      name: 'RTA',                           scope: 'Access, road works, hoarding NOC' },
    { code: 'DDA',      name: 'Dubai Development Authority',   scope: 'Permit within DDA jurisdiction' },
    { code: 'TRAKHEES', name: 'Trakhees',                      scope: 'Permit & inspections within Ports/Free-zone areas' },
    { code: 'EMPOWER',  name: 'Empower / district cooling',    scope: 'District cooling connection' },
    { code: 'DU-ETIS',  name: 'du / Etisalat',                 scope: 'Telecom infrastructure NOC' },
    { code: 'DPOLICE',  name: 'Dubai Police',                  scope: 'Security systems / CCTV NOC' },
    { code: 'NAKHEEL',  name: 'Nakheel',                       scope: 'Master-developer NOC' },
  ],
  'Abu Dhabi': [
    { code: 'ADDC',     name: 'ADDC',                          scope: 'Power & water connection, NOC' },
    { code: 'DMT',      name: 'DMT / Abu Dhabi City Municipality', scope: 'Building permit, completion' },
    { code: 'ADCD',     name: 'Abu Dhabi Civil Defence',       scope: 'Fire & life safety approval' },
    { code: 'ESTIDAMA', name: 'Estidama',                      scope: 'Pearl rating compliance' },
    { code: 'ADM-ITC',  name: 'Integrated Transport Centre',   scope: 'Access & road NOC' },
    { code: 'ALDAR',    name: 'Aldar',                         scope: 'Master-developer NOC' },
  ],
  'Sharjah': [
    { code: 'SEWA',     name: 'SEWA',                          scope: 'Power & water connection' },
    { code: 'SM',       name: 'Sharjah Municipality',          scope: 'Building permit, completion' },
    { code: 'SCD',      name: 'Sharjah Civil Defence',         scope: 'Fire & life safety approval' },
  ],
  'Ajman':        [ { code: 'FEWA', name: 'FEWA', scope: 'Power & water' }, { code: 'AJM', name: 'Ajman Municipality', scope: 'Building permit' }, { code: 'AJCD', name: 'Ajman Civil Defence', scope: 'Fire & life safety' } ],
  'Ras Al Khaimah': [ { code: 'RAKM', name: 'RAK Municipality', scope: 'Building permit' }, { code: 'FEWA', name: 'FEWA', scope: 'Power & water' }, { code: 'RAKCD', name: 'RAK Civil Defence', scope: 'Fire & life safety' } ],
  'Fujairah':     [ { code: 'FUJM', name: 'Fujairah Municipality', scope: 'Building permit' }, { code: 'FEWA', name: 'Etihad WE', scope: 'Power & water' } ],
  'Umm Al Quwain':[ { code: 'UAQM', name: 'UAQ Municipality', scope: 'Building permit' }, { code: 'FEWA', name: 'Etihad WE', scope: 'Power & water' } ],
  'Federal / any emirate': [
    { code: 'GCAA',   name: 'GCAA',                  scope: 'Building height / crane clearance' },
    { code: 'TDRA',   name: 'TDRA',                  scope: 'Telecom regulatory approval' },
    { code: 'ENV',    name: 'Environment authority', scope: 'Environmental permit / EIA' },
  ],
};

// Best guess at which emirate list to offer, from the project's location text.
export function emirateFor(location) {
  const s = String(location || '').toLowerCase();
  const hit = Object.keys(AUTHORITIES).find((k) => s.includes(k.toLowerCase()));
  if (hit) return hit;
  if (/\bauh?\b|abudhabi|abu-dhabi/.test(s)) return 'Abu Dhabi';
  if (/\brak\b/.test(s)) return 'Ras Al Khaimah';
  if (/\buaq\b/.test(s)) return 'Umm Al Quwain';
  return 'Dubai';
}

// Turn the chosen authorities into authority records on the project.
// createRecord is passed in so this module stays free of the records plumbing.
export async function seedAuthorities(env, pid, chosen, createRecord, who) {
  if (!pid) return { error: 'which project?' };
  const list = Array.isArray(chosen) ? chosen : [];
  if (!list.length) return { error: 'choose at least one authority' };
  const added = [], failed = [], already = [];
  for (const a of list) {
    const name = String((a && a.name) || '').slice(0, 120);
    if (!name) continue;
    // K5 (spec §6): an approval imported from the old system is that
    // authority's item on this project — a second one is not added beside it.
    const had = await env.DB.prepare(`SELECT ref FROM records WHERE project_id = ? AND type = 'authority' AND imported = 1 AND lower(title) = lower(?)`)
      .bind(pid, name).first().catch(() => null);
    if (had) { already.push({ ref: had.ref, name }); continue; }
    const scope = String((a && a.scope) || '').slice(0, 200);
    const r = await createRecord(env, pid, {
      type: 'authority',
      title: name,
      data: {
        Authority: name,
        Scope: scope,
        Code: String((a && a.code) || '').slice(0, 24),
        'Required approval by': String((a && a.due) || '').slice(0, 10),
      },
    }, who);
    if (r && r.ok) added.push({ ref: r.ref, name }); else failed.push(name);
  }
  if (!added.length && !already.length) return { error: 'could not add those authorities' };
  return { ok: true, added, failed, already };
}
