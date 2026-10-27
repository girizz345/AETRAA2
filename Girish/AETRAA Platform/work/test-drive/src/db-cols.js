// Adding a column once, without a statement that fails.
//
// "ALTER TABLE ... ADD COLUMN" on a column that is already there fails, and on
// PostgreSQL a failed statement can cost the connection it ran on. So the
// columns are looked up first and only the missing ones are added. The lookup
// itself is tried the PostgreSQL way first: on SQLite that query simply fails,
// which costs nothing, and the SQLite way is used instead.
export async function columnsOf(env, table) {
  try {
    const r = await env.DB.prepare(
      `SELECT column_name AS name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = ?`
    ).bind(table).all();
    const names = (r.results || []).map((x) => String(x.name).toLowerCase());
    if (names.length) return names;
  } catch (e) { /* not PostgreSQL */ }
  try {
    const r = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    return (r.results || []).map((x) => String(x.name).toLowerCase());
  } catch (e) { return []; }
}

export async function addColumns(env, table, cols) {
  const have = await columnsOf(env, table);
  if (!have.length) return false;              // table not there yet, or unreadable
  for (const [name, type] of cols) {
    if (have.includes(name.toLowerCase())) continue;
    try { await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type || 'TEXT'}`).run(); }
    catch (e) { /* added by a parallel request */ }
  }
  return true;
}
