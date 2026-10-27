// POSTGRESQL, BEHIND THE SAME THREE CALLS.
//
// Every one of the platform's ~250 database call sites goes through one narrow
// shape — prepare(sql).bind(...).all() / .first() / .run() — because that is
// what Cloudflare D1 offers. This file provides exactly that shape over
// PostgreSQL, so the move to Oracle Cloud is a change of configuration and not
// a rewrite. Nothing above this file knows which database it is talking to.
//
// It takes any client with a `query(text, values)` returning `{ rows }` —
// node-postgres, PGlite, a pool, a transaction — so it can be tested against a
// real PostgreSQL rather than a mock that agrees with whatever it is told.

/* ------------------------------------------------------------ SQL rewriting
 *
 * D1 uses positional `?`. PostgreSQL uses `$1, $2, …`. The substitution has to
 * skip anything inside a string literal, a quoted identifier or a comment —
 * a `?` inside 'text?' is data, and renaming it corrupts the query silently.
 */
export function toPg(sql) {
  let out = '', n = 0, i = 0;
  const s = String(sql);
  while (i < s.length) {
    const c = s[i];
    // '...' string literal, with '' as an escaped quote
    if (c === "'") {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "'" && s[j + 1] === "'") { j += 2; continue; }
        if (s[j] === "'") { j++; break; }
        j++;
      }
      out += s.slice(i, j); i = j; continue;
    }
    // "..." quoted identifier
    if (c === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') j++;
      out += s.slice(i, j + 1); i = j + 1; continue;
    }
    // -- line comment
    if (c === '-' && s[i + 1] === '-') {
      let j = s.indexOf('\n', i);
      if (j === -1) j = s.length;
      out += s.slice(i, j); i = j; continue;
    }
    // /* block comment */
    if (c === '/' && s[i + 1] === '*') {
      let j = s.indexOf('*/', i);
      j = j === -1 ? s.length : j + 2;
      out += s.slice(i, j); i = j; continue;
    }
    // ?NNN is SQLite's numbered parameter (the same value used more than once):
    // it is $NNN, not the next $n followed by the digits ("?1" → "$11" was the
    // wrong-code 500 on PostgreSQL).
    if (c === '?' && /[0-9]/.test(s[i + 1] || '')) {
      let j = i + 1;
      while (j < s.length && /[0-9]/.test(s[j])) j++;
      const k = Number(s.slice(i + 1, j));
      out += '$' + k; n = Math.max(n, k); i = j; continue;
    }
    if (c === '?') { out += '$' + (++n); i++; continue; }
    out += c; i++;
  }
  return { text: out, count: n };
}

// The handful of SQLite spellings the platform uses that PostgreSQL does not.
// Kept here rather than in the call sites, so the same source runs on both.
export function portSql(sql) {
  return String(sql)
    .replace(/\bdate\('now'\)/gi, 'CURRENT_DATE')
    .replace(/\bdatetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'BIGSERIAL PRIMARY KEY')
    .replace(/\bAUTOINCREMENT\b/gi, '')
    .replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO')   // see note below
    .replace(/\bIFNULL\s*\(/gi, 'COALESCE(')
    // SQLite's REAL is an 8-byte float; PostgreSQL's is 4 bytes (about 7
    // digits), which would turn AED 12,345,678.91 into 12,345,679. Money and
    // quantities need the 8-byte type. (Upper case only: that is how every
    // column type in this code base is written.)
    .replace(/\bREAL\b/g, 'DOUBLE PRECISION');
}
// Note on INSERT OR IGNORE: PostgreSQL's equivalent is ON CONFLICT DO NOTHING,
// which has to go at the END of the statement, so it is appended rather than
// swapped in place.
function needsOnConflict(original, ported) {
  return /\bINSERT\s+OR\s+IGNORE\b/i.test(original) && !/ON\s+CONFLICT/i.test(ported);
}

/* ------------------------------------------------------------- the adapter */

export function makePostgres(client, opts) {
  const o = opts || {};
  const log = typeof o.log === 'function' ? o.log : null;

  async function run(sql, args, via) {
    const ported = portSql(sql);
    const withConflict = needsOnConflict(sql, ported)
      ? ported.replace(/;?\s*$/, ' ON CONFLICT DO NOTHING')
      : ported;
    const { text } = toPg(withConflict);
    if (log) log(text, args);
    // undefined is not a value PostgreSQL accepts; D1 treats it as null.
    const values = (args || []).map((v) => (v === undefined ? null : v));
    return (via || client).query(text, values);
  }

  const api = {
    prepare(sql) {
      let args = [];
      const st = {
        // For batch(): the same statement, on a connection it chooses.
        _runOn(conn) { return run(sql, args, conn); },
        bind(...a) { args = a; return st; },
        async all() {
          const r = await run(sql, args);
          return { results: r.rows || [], success: true, meta: { rows_read: (r.rows || []).length } };
        },
        async first(col) {
          const r = await run(sql, args);
          const row = (r.rows || [])[0] ?? null;
          return col && row ? row[col] : row;
        },
        async run() {
          const r = await run(sql, args);
          return {
            success: true,
            meta: {
              changes: r.rowCount != null ? r.rowCount : 0,
              // D1 hands back the rowid of the last insert. PostgreSQL only
              // offers that with RETURNING, so it is null rather than a
              // number that would be wrong.
              last_row_id: null,
            },
          };
        },
        async raw() {
          const r = await run(sql, args);
          return (r.rows || []).map((row) => Object.values(row));
        },
      };
      return st;
    },

    // D1 runs a batch in one implicit transaction. So does this — a half-written
    // batch is worse than a failed one.
    //
    // With a connection POOL (node-postgres Pool on Oracle) every query() may go
    // to a different connection, so BEGIN, the statements and COMMIT must all be
    // sent down ONE connection checked out for the purpose. Otherwise BEGIN opens
    // a transaction on one connection that nothing ever commits, and every later
    // query that lands there is silently inside it.
    async batch(list) {
      const out = [];
      const pooled = typeof client.connect === 'function' && typeof client.totalCount === 'number';
      const conn = pooled ? await client.connect() : client;
      try {
        await conn.query('BEGIN');
        try {
          for (const st of list || []) {
            const r = await st._runOn(conn);
            out.push({ success: true, meta: { changes: r.rowCount != null ? r.rowCount : 0, last_row_id: null } });
          }
          await conn.query('COMMIT');
        } catch (e) {
          try { await conn.query('ROLLBACK'); } catch (e2) { /* the error below is the one that matters */ }
          throw e;
        }
      } finally {
        if (pooled && typeof conn.release === 'function') conn.release();
      }
      return out;
    },

    async exec(sql) {
      // Whole-script execution: the schema arrives as many statements at once.
      // node-postgres accepts that through query() when there are no
      // parameters; PGlite refuses it and offers exec() instead. Both are
      // used rather than assuming one of them.
      const text = portSql(sql);
      if (typeof client.exec === 'function') await client.exec(text);
      else await client.query(text);
      return { count: (text.match(/;/g) || []).length };
    },
  };
  return api;
}

/* ------------------------------------------------------- the environment
 *
 * Builds the `env` the worker expects. Everything else — the file store, the
 * secrets — already reads from the same place on both platforms.
 */
export function makeEnv(client, extra) {
  return Object.assign({ DB: makePostgres(client) }, extra || {});
}
