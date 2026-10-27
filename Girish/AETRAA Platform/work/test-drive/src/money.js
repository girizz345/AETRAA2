// MONEY IN WHOLE FILS.
//
// Spec §27, rule 5: "Amounts in fils, quantities scaled to a fixed precision.
// No floating-point accumulation anywhere a figure reaches a certificate.
// 0.1 + 0.2 is the wrong answer in a BOQ."
//
// Every figure that reaches a payment application is worked here as a whole
// number: money in fils (hundredths of a dirham), quantities in thousandths,
// percentages in ten-thousandths. Numbers are read from their WRITTEN form —
// "1,234.50", or String(1.005) for a value already stored — digit by digit,
// never multiplied through a float, so 1.005 is 1.01 and not 1.00.
//
// One rounding rule, everywhere: half away from zero, applied once per line and
// then summed. It is the rule Excel's ROUND uses, so a workbook that rounds its
// own formulas shows the same fils the platform worked out.
//
// Products go through BigInt: a AED 50m contract is 5,000,000,000 fils, and that
// times a percentage in ten-thousandths is past what a JavaScript number holds
// exactly.

export const MONEY_DP = 2;      // fils
export const QTY_DP = 3;        // thousandths of a unit
export const PCT_DP = 4;        // ten-thousandths of a per cent

// Arabic-Indic digits are digits too (spec §23).
const western = (s) => String(s)
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));

// The written number, as a whole number at `dp` places, or null when it is not
// a plain number ("Included", "Rate only", "-", blank). Brackets and a leading
// minus are a negative (a credit or an omission).
export function toScaled(raw, dp) {
  if (raw == null) return null;
  if (typeof raw === 'bigint') return Number(raw) * 10 ** dp;
  let s = western(typeof raw === 'number' ? (Number.isFinite(raw) ? String(raw) : '') : raw)
    .trim().replace(/,/g, '').replace(/\s+/g, '');
  s = s.replace(/^(AED|USD|EUR|GBP|SAR|QAR|OMR|KWD|BHD)/i, '').replace(/(AED|USD|EUR|GBP|SAR|QAR|OMR|KWD|BHD|%)$/i, '');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s[0] === '-' || s[0] === '+') { if (s[0] === '-') neg = !neg; s = s.slice(1); }
  if (/^\d+(\.\d+)?e[-+]?\d+$/i.test(s)) {
    // Exponent form (a spreadsheet's 1.2E-05): expanded exactly, then read.
    const [m, e] = s.toLowerCase().split('e');
    const [w, f = ''] = m.split('.');
    const exp = Number(e);
    let digits = w + f, point = w.length + exp;
    if (point <= 0) { digits = '0'.repeat(1 - point) + digits; point = 1; }
    if (point > digits.length) digits = digits + '0'.repeat(point - digits.length);
    s = digits.slice(0, point) + '.' + digits.slice(point);
  }
  const m = s.match(/^(\d*)(?:\.(\d*))?$/);
  if (!m || (!m[1] && !m[2])) return null;
  const whole = m[1] || '0';
  const frac = m[2] || '';
  const kept = (frac + '0'.repeat(dp)).slice(0, dp);
  let n = BigInt(whole) * 10n ** BigInt(dp) + BigInt(kept || '0');
  if (frac.length > dp && Number(frac[dp]) >= 5) n += 1n;     // half away from zero
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const v = Number(n);
  return neg ? -v : v;
}

export const fils = (v) => toScaled(v, MONEY_DP);
export const milli = (v) => toScaled(v, QTY_DP);
export const pctUnits = (v) => toScaled(v, PCT_DP);
// The same, with nothing given read as zero (for figures a person already set).
export const fils0 = (v) => fils(v) || 0;

// Integer division of a BigInt, rounded half away from zero.
function divRound(n, d) {
  const neg = (n < 0n) !== (d < 0n);
  const a = n < 0n ? -n : n, b = d < 0n ? -d : d;
  let q = a / b;
  if ((a % b) * 2n >= b) q += 1n;
  return Number(neg ? -q : q);
}

// qty × rate, in fils. qty in thousandths, rate in fils.
export function lineAmount(qtyMilli, rateFils) {
  if (qtyMilli == null || rateFils == null) return null;
  return divRound(BigInt(qtyMilli) * BigInt(rateFils), 1000n);
}

// p per cent of an amount in fils, in fils. p as written ("33.335") or as a number.
export function pctOf(amountFils, p) {
  const u = pctUnits(p);
  if (amountFils == null || u == null) return 0;
  return divRound(BigInt(amountFils) * BigInt(u), 100n * 10n ** BigInt(PCT_DP));
}

// a ÷ b as a percentage to `dp` places (for "x% complete" shown beside money).
export function ratioPct(aFils, bFils, dp = 2) {
  if (!bFils) return 0;
  return divRound(BigInt(aFils) * 100n * 10n ** BigInt(dp), BigInt(bFils)) / 10 ** dp;
}

// Fils back to a number of dirhams for storage and display. Exact: every
// whole number of fils has a nearest double that prints as its two decimals.
export const toAED = (f) => (f == null ? null : Number((f / 100).toFixed(2)));
export const sum = (list) => list.reduce((s, x) => s + (Number(x) || 0), 0);

export function fmtFils(f) {
  if (f == null) return '';
  const neg = f < 0, a = Math.abs(f);
  return (neg ? '-' : '') + String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + String(a % 100).padStart(2, '0');
}

// How many decimals a figure was written with. A bill rounded to whole dirhams
// is checked to half a dirham; one written to fils, to the fil.
export function decimalsOf(raw) {
  const s = western(String(raw == null ? '' : raw)).trim().replace(/,/g, '');
  const m = s.match(/\.(\d+)$/);
  return m ? m[1].length : 0;
}

// SQL that sums a REAL money column exactly: each value to whole fils first
// (an integral double), then the sum, which is exact far past any contract.
// Works the same on SQLite and PostgreSQL.
export const SQL_SUM_FILS = (col) => `SUM(ROUND(COALESCE(${col},0) * 100))`;
