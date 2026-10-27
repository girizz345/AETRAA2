// The AETRAA Assistant (A14 as a conversation) on SQLite: refused outside
// AETRAA and the project, in three layers; only what the person may see;
// read-only; logged; daily limits. The PostgreSQL run is test-pg-assistant.mjs.
//   node tools/test-assistant.mjs
import { db, env, call, admin, as, check, done, onboard } from './_harness.mjs';
import { run } from './_assistant-cases.mjs';

const sql = async (q, args = []) => db.prepare(q).all(...args);
await run({ env, call, admin, as, onboard, sql, check });
done();
