import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { db } from "./database";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Applying `schema.sql` — the one implementation, used by the CLI (`db:migrate`)
 * and by the server at boot.
 *
 * Every statement in that file is idempotent (`CREATE TABLE IF NOT EXISTS`,
 * `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), which is what makes running it
 * on every boot safe — and what makes it the right thing to do. The failure it
 * removes is the one that costs a launch: code that needs a new column reaching
 * production before anyone remembers to run the migration, and every request
 * touching that column 500ing until someone notices.
 *
 * pg runs a multi-statement query in one implicit transaction, so a single bad
 * statement rolls the whole file back rather than leaving the schema half
 * applied.
 */

/** Namespaced so the lock cannot collide with an application-level one. */
const SCHEMA_LOCK_KEY = 4_827_100_1;

export async function applySchema(): Promise<void> {
  const schema = readFileSync(resolve(__dirname, "schema.sql"), "utf-8");

  // Two instances booting together would otherwise run the same CREATEs at the
  // same time and one would fail on a duplicate. The lock is released with the
  // connection, so a crash mid-migration cannot leave it held.
  const client = await db.getPool().connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [SCHEMA_LOCK_KEY]);
    await client.query(schema);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [SCHEMA_LOCK_KEY]).catch(() => {
      // Releasing is best-effort: the lock dies with the connection anyway.
    });
    client.release();
  }
}
