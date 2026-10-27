// Working time.
//
// Everything in a programme is measured in working hours on a calendar, and a
// forecast that counts Fridays and Eid as working days is wrong by a fortnight
// before it has done anything else. This is the piece every schedule tool gets
// subtly wrong and nobody notices until the dates disagree with P6.
//
// A calendar here is exactly what P6 exports: a weekly pattern of working
// periods, plus dated exceptions that either replace the day's hours (a short
// Ramadan day) or empty them (a holiday).
//
// Times are handled as naive wall-clock, held in UTC so that no daylight-saving
// rule anywhere can shift a pour by an hour.

const MIN = 60000;
const DAY_MS = 86400000;

/* -------------------------------------------------------------- the clock */

export const at = (dateStr, minutes = 0) =>
  Date.parse(dateStr + 'T00:00:00Z') + minutes * MIN;

export const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
export const minuteOf = (t) => {
  const d = new Date(t);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
export const weekdayOf = (t) => new Date(t).getUTCDay();      // 0 = Sunday

// P6 writes dates as "2026-09-01 07:00"; a date alone means midnight.
export function parseDate(s) {
  const m = String(s || '').trim().match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
}

export const isoMinute = (t) => new Date(t).toISOString().slice(0, 16).replace('T', ' ');

/* ----------------------------------------------------- reading a calendar */

// P6 packs the calendar into one field with a private bracket syntax:
//
//   (0||DaysOfWeek()( (0||1()()) (0||2()( (0||0(s|07:00|f|17:00)()) )) ... ))
//   (0||Exceptions()( (0||0(d|45678)( (0||0(s|08:00|f|12:00)()) )) ... ))
//
// Day 1 is Sunday. A day or an exception with no periods inside it is not
// worked — that is how both a weekend and a public holiday are written.
const hhmm = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  return m ? +m[1] * 60 + +m[2] : null;
};

function periodsIn(frag) {
  const out = [];
  const re = /\(s\|(\d{1,2}:\d{2})\|f\|(\d{1,2}:\d{2})\)/g;
  let m;
  while ((m = re.exec(frag))) {
    const s = hhmm(m[1]), f = hhmm(m[2]);
    // A period finishing at midnight means the end of the day, not the start.
    if (s !== null && f !== null) out.push([s, f === 0 ? 1440 : f]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

// The sections are nested, so a lazy match would run one into the next. Walk
// the brackets instead and take exactly the section asked for.
function section(data, name) {
  const start = data.indexOf(name + '()(');
  if (start < 0) return '';
  let i = start + name.length + 2, depth = 0;
  for (; i < data.length; i++) {
    if (data[i] === '(') depth++;
    else if (data[i] === ')') { depth--; if (depth === 0) return data.slice(start, i + 1); }
  }
  return data.slice(start);
}

// P6 counts exception days from 31 December 1899 — the spreadsheet epoch, one
// day out from the more familiar 1900 one.
const P6_EPOCH = Date.UTC(1899, 11, 30);
export const p6Day = (n) => P6_EPOCH + Number(n) * DAY_MS;

export function parseCalendar(raw, meta = {}) {
  const data = String(raw || '').replace(/\x7f\x7f/g, '\n');
  const week = [[], [], [], [], [], [], []];
  const exceptions = {};

  const dow = section(data, 'DaysOfWeek');
  // Each day is "(0||<n>()(" ... ")" at the top level of DaysOfWeek.
  const dayRe = /\(0\|\|([1-7])\(\)\(/g;
  let m;
  while ((m = dayRe.exec(dow))) {
    const idx = +m[1] - 1;                       // P6 day 1 = Sunday = index 0
    let i = m.index + m[0].length - 1, depth = 0, end = i;
    for (; i < dow.length; i++) {
      if (dow[i] === '(') depth++;
      else if (dow[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
    }
    week[idx] = periodsIn(dow.slice(m.index, end + 1));
  }

  const exc = section(data, 'Exceptions');
  const excRe = /\(0\|\|\d+\(d\|(\d+)\)\(/g;
  while ((m = excRe.exec(exc))) {
    let i = m.index + m[0].length - 1, depth = 0, end = i;
    for (; i < exc.length; i++) {
      if (exc[i] === '(') depth++;
      else if (exc[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
    }
    exceptions[dayOf(p6Day(m[1]))] = periodsIn(exc.slice(m.index, end + 1));
  }

  const cal = {
    id: meta.id || null,
    name: meta.name || '',
    day_minutes: Math.round((Number(meta.day_hours) || 8) * 60),
    week,
    exceptions,
  };
  cal.empty = week.every((d) => !d.length);
  return cal;
}

// A calendar with nothing worked on any day would send the passes into an
// endless walk, so it falls back to something sane and says so.
export const FALLBACK = {
  id: 'fallback', name: '(none)', day_minutes: 480,
  week: [[], [[480, 1020]], [[480, 1020]], [[480, 1020]], [[480, 1020]], [[480, 1020]], []],
  exceptions: {}, empty: false, fallback: true,
};

/* ------------------------------------------------------------- the walking */

export function periodsOn(cal, t) {
  const key = dayOf(t);
  const e = cal.exceptions[key];
  if (e) return e;
  return cal.week[weekdayOf(t)] || [];
}

export const worksOn = (cal, t) => periodsOn(cal, t).length > 0;

// Working minutes in one day.
export const minutesOn = (cal, t) =>
  periodsOn(cal, t).reduce((n, [s, f]) => n + (f - s), 0);

const MAX_SKIP = 3650;      // ten years of holidays is a broken calendar

// The next moment at which work may happen, t itself if it already is one.
export function snapForward(cal, t) {
  let day = at(dayOf(t)), mins = minuteOf(t);
  for (let n = 0; n < MAX_SKIP; n++) {
    for (const [s, f] of periodsOn(cal, day)) {
      if (mins < s) return day + s * MIN;
      if (mins < f) return day + mins * MIN;
    }
    day += DAY_MS; mins = 0;
  }
  return t;
}

// The last moment at which work could have happened, t itself if it is one.
// A moment sitting exactly on the end of a period belongs to that period —
// 17:00 is the finish of today's work, not the start of tomorrow's.
export function snapBack(cal, t) {
  let day = at(dayOf(t)), mins = minuteOf(t);
  for (let n = 0; n < MAX_SKIP; n++) {
    const p = periodsOn(cal, day);
    for (let i = p.length - 1; i >= 0; i--) {
      const [s, f] = p[i];
      if (mins > f) return day + f * MIN;
      if (mins > s) return day + mins * MIN;
    }
    day -= DAY_MS; mins = 1440;
  }
  return t;
}

// Consume `minutes` of working time from t. Returns the instant the work ends,
// which is kept at the close of a period rather than rolled to the next day —
// an activity finishing at 17:00 finished today.
// A moment sitting exactly on the close of a working period — 17:00 — is the
// end of that day's work, not a gap before tomorrow's.
export function atPeriodEnd(cal, t) {
  const mins = minuteOf(t);
  return periodsOn(cal, t).some(([, f]) => f === mins);
}

export function addMinutes(cal, t, minutes) {
  if (cal.empty) return t + minutes * MIN;
  let left = Math.max(0, Math.round(minutes));
  // Nothing to consume: a milestone, or work already finished. It happens
  // where it stands rather than being pushed to the next working morning.
  if (left === 0) return atPeriodEnd(cal, t) ? t : snapForward(cal, t);
  let cur = snapForward(cal, t);
  for (let n = 0; n < MAX_SKIP; n++) {
    const day = at(dayOf(cur)), mins = minuteOf(cur);
    for (const [s, f] of periodsOn(cal, day)) {
      if (f <= mins) continue;
      const from = Math.max(s, mins);
      const have = f - from;
      if (have >= left) return day + (from + left) * MIN;
      left -= have;
    }
    cur = snapForward(cal, at(dayOf(cur)) + DAY_MS);
  }
  return cur;
}

// The same walk backwards: the instant `minutes` of work before t.
export function subMinutes(cal, t, minutes) {
  if (cal.empty) return t - minutes * MIN;
  let left = Math.max(0, Math.round(minutes));
  let cur = snapBack(cal, t);
  if (left === 0) return cur;
  for (let n = 0; n < MAX_SKIP; n++) {
    const day = at(dayOf(cur)), mins = minuteOf(cur);
    const p = periodsOn(cal, day);
    for (let i = p.length - 1; i >= 0; i--) {
      const [s, f] = p[i];
      if (s >= mins) continue;
      const to = Math.min(f, mins);
      const have = to - s;
      if (have >= left) return day + (to - left) * MIN;
      left -= have;
    }
    cur = snapBack(cal, at(dayOf(cur)) - MIN);
  }
  return cur;
}

// Working minutes between two instants — how float is measured, and how a slip
// is turned back into days for somebody to read.
export function between(cal, a, b) {
  if (b === a) return 0;
  if (b < a) return -between(cal, b, a);
  if (cal.empty) return (b - a) / MIN;
  let total = 0;
  let cur = at(dayOf(a));
  const endDay = at(dayOf(b));
  for (let n = 0; cur <= endDay && n < MAX_SKIP; n++, cur += DAY_MS) {
    for (const [s, f] of periodsOn(cal, cur)) {
      const from = Math.max(cur + s * MIN, a);
      const to = Math.min(cur + f * MIN, b);
      if (to > from) total += (to - from) / MIN;
    }
  }
  return total;
}

// Working days, the unit people speak in. Rounded to a tenth because "1.7 days
// late" is honest and "1.6875" is not.
export const toDays = (cal, minutes) =>
  Math.round((minutes / (cal.day_minutes || 480)) * 10) / 10;

export const pack = (cal) => JSON.stringify({
  name: cal.name, day_minutes: cal.day_minutes, week: cal.week, exceptions: cal.exceptions,
});

export function unpack(json, id) {
  try {
    const o = typeof json === 'string' ? JSON.parse(json) : json;
    if (!o || !Array.isArray(o.week)) return { ...FALLBACK, id };
    const cal = { id, name: o.name || '', day_minutes: o.day_minutes || 480,
                  week: o.week, exceptions: o.exceptions || {} };
    cal.empty = cal.week.every((d) => !d || !d.length);
    return cal.empty ? { ...FALLBACK, id } : cal;
  } catch (err) {
    return { ...FALLBACK, id };
  }
}
