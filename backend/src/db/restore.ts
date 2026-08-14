import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { db } from "./database";
import { applySchema } from "./applySchema";

/**
 * Replay a backup into a database.
 *
 * A backup nobody has restored is a hypothesis. This is the other half, and it
 * is deliberately blunt: apply the schema, then insert every row in the order
 * the backup wrote them, skipping rows that are already there.
 *
 * `ON CONFLICT DO NOTHING` makes it re-runnable and makes a partial restore
 * safe to repeat, at the cost of not overwriting a row that exists — which is
 * the right trade when the alternative is a half-restored table nobody can
 * reason about.
 *
 * Refuses a non-local target unless the operator says otherwise in full, for
 * the same reason db:reset does: the connection string in .env points at the
 * hosted database, and restoring over live data is not something to do by
 * reflex.
 */

interface Line {
  table?: string;
  row?: Record<string, unknown>;
  stratisBackup?: number;
  takenAt?: string;
}

function refuseIfNotLocal(): void {
  const url = process.env.DATABASE_URL ?? "";
  const looksLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url);
  if (looksLocal || process.env.I_UNDERSTAND_THIS_WRITES_OVER_DATA === "yes") return;

  const host = url.replace(/^[^@]*@/, "").split(/[:/]/)[0] || "(unset DATABASE_URL)";
  console.error(
    `[restore] REFUSING to restore into ${host}.\n` +
      "  This writes rows into a database that is not local.\n" +
      "  If that is the intent, re-run with I_UNDERSTAND_THIS_WRITES_OVER_DATA=yes",
  );
  process.exit(1);
}

async function insert(table: string, row: Record<string, unknown>): Promise<void> {
  const columns = Object.keys(row);
  if (columns.length === 0) return;

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  await db.query(
    `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(", ")})
     VALUES (${placeholders})
     ON CONFLICT DO NOTHING`,
    columns.map((c) => row[c]),
  );
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error("[restore] usage: npm run db:restore -- <path-to-backup.ndjson.gz>");
    process.exit(1);
  }

  refuseIfNotLocal();

  try {
    await applySchema();
    console.log("[restore] schema applied");

    const input = createInterface({
      input: createReadStream(file).pipe(createGunzip()),
      crlfDelay: Infinity,
    });

    const counts = new Map<string, number>();
    let failures = 0;

    for await (const raw of input) {
      if (!raw.trim()) continue;

      let line: Line;
      try {
        line = JSON.parse(raw) as Line;
      } catch {
        failures += 1;
        continue;
      }

      if (line.stratisBackup) {
        console.log(`[restore] backup taken ${line.takenAt}`);
        continue;
      }
      if (!line.table || !line.row) continue;

      try {
        await insert(line.table, line.row);
        counts.set(line.table, (counts.get(line.table) ?? 0) + 1);
      } catch (err) {
        failures += 1;
        if (failures <= 5) console.error(`[restore] ${line.table}:`, (err as Error).message);
      }
    }

    for (const [table, n] of counts) console.log(`  ${table.padEnd(26)} ${n}`);
    console.log(`[restore] done — ${failures} row(s) could not be written`);
    process.exit(failures > 0 ? 1 : 0);
  } catch (err) {
    console.error("[restore] FAILED:", err);
    process.exit(1);
  }
}

void main();
