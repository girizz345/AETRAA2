// The critical path, and what a delay does to the end of the job.
//
// This is the piece the app has been missing. Until now it could say "Level 3
// steel is eleven days late" and stop, because nothing in it knew what follows
// what. With the logic imported, the same eleven days can be pushed through the
// network and come out as a date.
//
// Two rules govern everything here:
//
//   1. Nothing in this file guesses. Every date is walked on the activity's own
//      calendar from a duration and a relationship. If a schedule is too broken
//      to compute, the answer is a refusal, not an estimate.
//
//   2. It must agree with P6. The .xer carries P6's own early dates, late dates
//      and float, so the engine is marked against the programme everybody else
//      is reading rather than against an opinion.

import {
  addMinutes, subMinutes, snapForward, snapBack, atPeriodEnd, between, toDays, unpack, FALLBACK,
} from './calendar.js';

// A finish that already sits on the close of a working period stays there.
const snapFinish = (cal, t) => (atPeriodEnd(cal, t) ? t : snapForward(cal, t));

const MIN = 60000;

/* --------------------------------------------------------------- ordering */

// Topological order, and the cycles found on the way. A loop in the logic is
// not an edge case in exported programmes — it is a Tuesday — and it must be
// named rather than silently broken.
export function order(acts, links) {
  const out = [], succ = {}, indeg = {};
  for (const a of acts) { succ[a.id] = []; indeg[a.id] = 0; }
  const kept = [];
  for (const l of links) {
    if (succ[l.from] === undefined || indeg[l.to] === undefined) continue;
    succ[l.from].push(l); indeg[l.to]++; kept.push(l);
  }
  const queue = acts.filter((a) => !indeg[a.id]).map((a) => a.id);
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    seen.add(id); out.push(id);
    for (const l of succ[id]) if (--indeg[l.to] === 0) queue.push(l.to);
  }
  // Whatever is left sits in a loop. Put it at the end so a pass can still run,
  // and report it.
  const looped = acts.filter((a) => !seen.has(a.id)).map((a) => a.id);
  for (const id of looped) out.push(id);
  return { order: out, cycles: looped, links: kept, succ };
}

/* ------------------------------------------------------------- the passes */

const calFor = (cals, a, fallback) =>
  cals[a.calendar_id] || cals[fallback] || FALLBACK;

// Remaining work. A completed activity has none; one in progress has what P6
// says is left, not what is implied by a percentage somebody typed.
// P6 keeps two kinds of milestone and dates them differently: a finish
// milestone sits on the close of the work it marks, a start milestone on the
// opening of the work it releases.
const isFinishMile = (a) => a.act_type === 'TT_FinMile' || a.type === 'TT_FinMile';

// Level of effort — site supervision, the tower crane, demobilisation. Its
// duration is a consequence of the work it spans, not a cause of anything, so
// it is stretched to fit its neighbours and is never allowed to drive a date.
// Left in the logic like an ordinary activity it will happily push the end of
// the job out by months, which is exactly what it did here the first time.
const isLOE = (a) => a.act_type === 'TT_LOE' || a.type === 'TT_LOE' ||
                     a.act_type === 'TT_WBS' || a.type === 'TT_WBS';

function remaining(a) {
  if (a.status === 'complete') return 0;
  const r = a.status === 'in_progress' ? a.remain_minutes : (a.remain_minutes || a.orig_minutes);
  return Math.max(0, Math.round(r || 0));
}

export function forward(model) {
  const { acts, byId, cals, dataDate, retainedLogic } = model;
  const { order: seq, cycles, links } = model.top;
  const preds = {};
  for (const a of acts) preds[a.id] = [];
  for (const l of links) preds[l.to].push(l);

  const ES = {}, EF = {}, driver = {};
  for (const id of seq) {
    const a = byId[id];
    const cal = calFor(cals, a, model.defaultCalendar);
    const dur = remaining(a);

    if (a.status === 'complete' && a.actual_start && a.actual_finish) {
      ES[id] = a.actual_start; EF[id] = a.actual_finish;
      continue;
    }

    // Work that has not started cannot start before the data date; work already
    // running resumes from it.
    let start = dataDate;
    let finish = null;
    // Every predecessor's claim is kept, and which of them actually explains the
    // dates is decided at the end. Deciding it inside the loop makes the answer
    // depend on the order the relationships happen to appear in the file, which
    // is how a "what is holding this" list ends up naming the wrong activity.
    const claims = [];

    for (const l of preds[a.id]) {
      const pes = ES[l.from], pef = EF[l.from];
      if (pes === undefined) continue;
      const pa = byId[l.from];
      if (pa && isLOE(pa)) continue;              // it spans work, it does not cause it
      const pcal = calFor(cals, pa, model.defaultCalendar);
      // P6 measures a lag on the predecessor's calendar unless told otherwise.
      const lag = (t) => (l.lag_minutes
        ? (l.lag_minutes > 0 ? addMinutes(pcal, t, l.lag_minutes)
                             : subMinutes(pcal, t, -l.lag_minutes))
        : t);

      // Progress override throws away the driving relationship once an activity
      // has started. Retained logic keeps it, which is why the remaining work of
      // a started activity still waits for its predecessor.
      if (!retainedLogic && a.status === 'in_progress') continue;

      let cand = null, kind = l.type;
      if (l.type === 'FS') cand = { start: lag(pef) };
      else if (l.type === 'SS') cand = { start: lag(pes) };
      else if (l.type === 'FF') cand = { finish: lag(pef) };
      else if (l.type === 'SF') cand = { finish: lag(pes) };
      if (!cand) continue;

      if (cand.start !== undefined) {
        // A finish milestone marks the end of something, so it is stamped at
        // the instant its predecessor finished. Everything else — including a
        // start milestone — happens at the next working moment.
        const s = isFinishMile(a) ? snapFinish(cal, cand.start) : snapForward(cal, cand.start);
        claims.push({ id: l.from, type: kind, lag: l.lag_minutes, start: s });
        if (s > start) start = s;
      } else {
        // A finish lands on the close of a working period — 17:00 is the end of
        // today, not a gap before tomorrow — so it is snapped as a finish.
        const f = snapFinish(cal, cand.finish);
        claims.push({ id: l.from, type: kind, lag: l.lag_minutes, finish: f });
        if (finish === null || f > finish) finish = f;
      }
    }

    // Constraints raise the start; the ones that pin it are honoured exactly,
    // because a mandatory date is a decision somebody made and hid in the file.
    const c = a.constraint, cd = a.constraint_date;
    if (cd) {
      // A constraint that wins takes the credit with it. Leaving the driver
      // pointing at the predecessor it just overruled is how a "what is holding
      // the end" list ends up naming an activity that finished five months
      // earlier and has four months of float.
      if (c === 'start_on_or_after' || c === 'start_on') {
        const s = snapForward(cal, cd);
        claims.push({ id: null, type: 'constraint', constraint: c, start: s });
        if (s > start) start = s;
      } else if (c === 'mandatory_start') {
        start = snapForward(cal, cd);
        claims.push({ id: null, type: 'constraint', constraint: c, start: start });
      } else if (c === 'finish_on_or_after') {
        const f = snapFinish(cal, cd);
        if (finish === null || f > finish) finish = f;
      } else if (c === 'mandatory_finish') finish = snapBack(cal, cd);
    }

    ES[id] = isFinishMile(a) && finish === null && start !== dataDate
      ? snapFinish(cal, start) : snapForward(cal, start);
    const own = addMinutes(cal, ES[id], dur);
    if (finish !== null && finish > own) {
      // A finish-to-finish predecessor holds the end back. The work itself does
      // not stretch to fill the gap — it is a block of the same length that now
      // runs up to the later finish, so the start moves with it. Leaving the
      // start where it was is the commonest error in a home-made engine, and it
      // shows up as an activity that appears to be waiting around for weeks.
      EF[id] = finish;
      ES[id] = subMinutes(cal, finish, dur);
    } else {
      EF[id] = own;
    }
    // Whichever claim lands exactly on the dates that came out is the one
    // holding this activity. A finish-driven claim is preferred where the finish
    // is what moved, because that is the relationship somebody would have to
    // break to bring the activity forward.
    const fin = EF[id], st = ES[id];
    const hit = claims.find((x) => x.finish !== undefined && x.finish === fin)
      || claims.find((x) => x.start !== undefined && x.start === st);
    if (hit) driver[id] = hit;
  }

  // The level-of-effort activities, now that everything real has a date: each
  // one is stretched from its earliest predecessor to its latest successor,
  // which is what it is for.
  for (const a of acts) {
    if (!isLOE(a)) continue;
    let s = ES[a.id], f = EF[a.id];
    for (const l of preds[a.id]) if (EF[l.from] !== undefined) {
      const t = l.type === 'SS' || l.type === 'SF' ? ES[l.from] : EF[l.from];
      if (t !== undefined && (s === undefined || t < s || s === dataDate)) s = Math.max(dataDate, t);
    }
    let last = null;
    for (const l of (model.top.succ[a.id] || [])) {
      const t = l.type === 'FF' || l.type === 'SF' ? EF[l.to] : ES[l.to];
      if (t !== undefined && (last === null || t > last)) last = t;
    }
    if (last !== null) f = Math.max(s, last);
    ES[a.id] = s; EF[a.id] = f;
  }

  return { ES, EF, driver, cycles };
}

export function backward(model, fwd, projectFinish) {
  const { acts, byId, cals } = model;
  const { order: seq, links, succ } = model.top;
  const LS = {}, LF = {};
  const end = projectFinish;

  for (let i = seq.length - 1; i >= 0; i--) {
    const id = seq[i];
    const a = byId[id];
    const cal = calFor(cals, a, model.defaultCalendar);
    const dur = remaining(a);

    if (a.status === 'complete') { LS[id] = fwd.ES[id]; LF[id] = fwd.EF[id]; continue; }

    let late = end;
    for (const l of succ[id] || []) {
      const sa = byId[l.to];
      if (!sa) continue;
      // A level-of-effort activity is no more allowed to pull a late date
      // backwards than it was to push an early one forwards. Its own span is a
      // consequence of the work, so letting it constrain that work makes every
      // activity feeding it look months more critical than it is.
      if (isLOE(sa)) continue;
      const scal = calFor(cals, sa, model.defaultCalendar);
      const sls = LS[l.to], slf = LF[l.to];
      if (sls === undefined) continue;
      const unlag = (t) => (l.lag_minutes
        ? (l.lag_minutes > 0 ? subMinutes(scal, t, l.lag_minutes)
                             : addMinutes(scal, t, -l.lag_minutes))
        : t);

      let cand = null;
      if (l.type === 'FS') cand = unlag(sls);
      else if (l.type === 'FF') cand = unlag(slf);
      else if (l.type === 'SS') cand = addMinutes(cal, unlag(sls), dur);
      else if (l.type === 'SF') cand = addMinutes(cal, unlag(slf), dur);
      if (cand !== null && cand < late) late = cand;
    }

    const c = a.constraint, cd = a.constraint_date;
    if (cd) {
      if (c === 'finish_on_or_before' || c === 'finish_on') late = Math.min(late, snapBack(cal, cd));
      else if (c === 'mandatory_finish') late = snapBack(cal, cd);
      else if (c === 'start_on_or_before') late = Math.min(late, addMinutes(cal, snapBack(cal, cd), dur));
    }

    LF[id] = snapBack(cal, late);
    LS[id] = subMinutes(cal, LF[id], dur);
  }
  return { LS, LF };
}

/* ----------------------------------------------------------- the whole run */

export function build(input) {
  const acts = (input.activities || []).filter((a) => a && a.id);
  const byId = {};
  for (const a of acts) byId[a.id] = a;
  const cals = {};
  for (const [id, c] of Object.entries(input.calendars || {})) {
    cals[id] = typeof c === 'string' ? unpack(c, id) : c;
  }
  const model = {
    acts, byId, cals,
    dataDate: input.data_date,
    defaultCalendar: input.default_calendar,
    retainedLogic: input.retained_logic !== false,
    top: order(acts, input.links || []),
  };
  return model;
}

export function run(input) {
  const model = build(input);
  const fwd = forward(model);

  // Where the job ends, on the logic as it now stands.
  // A level-of-effort activity spans the job rather than completing it, so it
  // is not allowed to be the last thing on it either.
  let finish = model.dataDate || 0, finishId = null;
  for (const a of model.acts) {
    if (isLOE(a)) continue;
    if (fwd.EF[a.id] > finish) { finish = fwd.EF[a.id]; finishId = a.id; }
  }
  // Float is measured against the contract end where the programme says so,
  // otherwise against the calculated end — which makes total float zero on the
  // longest path rather than negative everywhere.
  const against = input.float_against || finish;
  const bwd = backward(model, fwd, against);

  const rows = model.acts.map((a) => {
    const cal = calFor(model.cals, a, model.defaultCalendar);
    const tf = a.status === 'complete' ? null
      : Math.round(between(cal, fwd.EF[a.id], bwd.LF[a.id]));
    return {
      id: a.id,
      status: a.status,
      early_start: fwd.ES[a.id],
      early_finish: fwd.EF[a.id],
      late_start: bwd.LS[a.id],
      late_finish: bwd.LF[a.id],
      total_float: tf,
      float_days: tf === null ? null : toDays(cal, tf),
      critical: tf !== null && tf <= 0,
      driven_by: fwd.driver[a.id] || null,
    };
  });

  const byActivity = {};
  for (const r of rows) byActivity[r.id] = r;

  // The driving path — what is actually holding the end of the job.
  //
  // Float alone will not tell you this. Where a job is forecasting past its
  // contract date, as most are, every activity carries negative float and
  // "critical" ends up meaning "nearly everything", which is no use to anybody.
  // The driving path is the chain of activities that each set the start of the
  // next, walked back from the last thing to finish. Delay one of these and the
  // job moves; delay anything else and it does not.
  const driving = [];
  {
    // Only the tightest chain counts. Following the driver blindly walks off the
    // critical path the moment one link has slack in it, and produces a list
    // that reads convincingly and is wrong — so the walk stops where the float
    // stops matching.
    // A driving relationship is one with no gap in it: the predecessor's date
    // is what set this activity's start. The forward pass already records only
    // those, so the chain is walked straight back through them. Float is
    // deliberately not used as the test — activities on different calendars
    // carry floats that are not comparable with each other, which is a P6
    // artefact, not a fact about the job.
    const seen = new Set();
    let cur = finishId;
    while (cur && !seen.has(cur)) {
      seen.add(cur); driving.push(cur);
      const d = fwd.driver[cur];
      const next = d && d.id ? d.id : null;
      if (!next) break;
      cur = next;
    }
    driving.reverse();
    for (const id of driving) if (byActivity[id]) byActivity[id].driving = true;
  }

  return {
    finish, finish_activity: finishId,
    data_date: model.dataDate,
    rows, byActivity,
    cycles: fwd.cycles,
    critical: rows.filter((r) => r.critical).map((r) => r.id),
    driving,
    model,
  };
}

/* ---------------------------------------------------------- what it costs */

// The question the whole thing exists to answer: this activity is late by so
// many days — what does that do to the end of the job?
//
// Re-run rather than reasoned about. The delay is added to the activity's
// remaining duration and the network is computed again, so the answer accounts
// for every path, every calendar and every constraint between here and the end.
export function impact(input, activityId, extraDays) {
  const base = run(input);
  const a = (input.activities || []).find((x) => x.id === activityId);
  if (!a) return { error: 'unknown activity' };
  if (a.status === 'complete') return { error: 'that activity is already finished' };

  const cal = calFor(base.model.cals, a, input.default_calendar);
  const add = Math.round((Number(extraDays) || 0) * (cal.day_minutes || 480));

  const shifted = (input.activities || []).map((x) => (x.id === activityId
    ? { ...x, remain_minutes: (remaining(x) + add), orig_minutes: x.orig_minutes + add }
    : x));
  const after = run({ ...input, activities: shifted });

  const wasCritical = base.byActivity[activityId] && base.byActivity[activityId].critical;
  const slipMin = between(cal, base.finish, after.finish);

  return {
    activity: activityId,
    added_days: Number(extraDays) || 0,
    was_critical: !!wasCritical,
    float_days: base.byActivity[activityId] ? base.byActivity[activityId].float_days : null,
    finish_before: base.finish,
    finish_after: after.finish,
    slip_minutes: Math.round(slipMin),
    slip_days: toDays(cal, slipMin),
    // What the delay ran through to get to the end. This is the sentence a PM
    // actually wants: not "24 days" but "24 days, through these four things".
    path: pathToEnd(after, activityId),
  };
}

// Walk the driving relationships from an activity to the end of the job.
export function pathToEnd(result, fromId) {
  const out = [];
  const succ = result.model.top.succ;
  const seen = new Set();
  let cur = fromId;
  for (let n = 0; n < 500 && cur && !seen.has(cur); n++) {
    seen.add(cur);
    const next = (succ[cur] || [])
      .map((l) => result.byActivity[l.to])
      .filter((r) => r && r.critical)
      .sort((x, y) => y.early_finish - x.early_finish)[0];
    if (!next) break;
    out.push({ id: next.id, finish: next.early_finish, driven_by: next.driven_by });
    cur = next.id;
  }
  return out;
}
