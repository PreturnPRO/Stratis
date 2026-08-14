import { createWriteStream } from "node:fs";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { db } from "./database";

/**
 * A restorable copy of the database, written by Node rather than pg_dump.
 *
 * pg_dump would be the better tool and is not available here: the machines that
 * run this are a Windows laptop and a Render container, neither with Postgres
 * client binaries installed, and a backup that depends on someone installing
 * something is a backup that will not exist on the day it is needed.
 *
 * So this reads every table through the connection the app already has and
 * writes newline-delimited JSON, gzipped. It is a logical export, not a
 * physical one: it captures rows, not indexes, sequences or extensions —
 * schema.sql rebuilds those, and `db:restore` replays the rows into it.
 *
 * What it is NOT: a substitute for the platform's own point-in-time recovery.
 * A file on a laptop is one accident away from the accident it protects
 * against. Treat this as the copy you can hold, and check that Supabase's own
 * backups are on for the copy you cannot lose.
 */

/**
 * Parents before children. A restore replays in this order, so a foreign key
 * never points at a row that has not been written yet.
 */
export const BACKUP_TABLES = [
  "organizations",
  "users",
  "projects",
  "meetings",
  "sessions",
  "documents",
  "document_versions",
  "transcripts",
  "decisions",
  "decision_reactions",
  "live_cards",
  "participant_summaries",
  "summary_blocks",
  "action_items",
  "notifications",
  "invites",
  "invite_redemptions",
  "session_guests",
  "session_participants",
  "plan_requests",
  "plan_codes",
  "plan_code_redemptions",
  "feedback",
  "analytics_events",
  "app_releases",
  "consent_logs",
] as const;

/** Keep this many local backups; older ones are removed after a successful run. */
const KEEP = 7;

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function* rowsFor(table: string): AsyncGenerator<string> {
  // Header first, so a truncated file still says what it was meant to hold.
  yield `${JSON.stringify({ table })}\n`;

  const result = await db.query(`SELECT * FROM ${table}`);
  for (const row of result.rows) {
    yield `${JSON.stringify({ table, row })}\n`;
  }
}

async function* everything(counts: Map<string, number>): AsyncGenerator<string> {
  yield `${JSON.stringify({
    stratisBackup: 1,
    takenAt: new Date().toISOString(),
    tables: BACKUP_TABLES,
  })}\n`;

  for (const table of BACKUP_TABLES) {
    try {
      const result = await db.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${table}`);
      counts.set(table, Number(result.rows[0]?.count ?? 0));
    } catch {
      // A table that does not exist on this database is not a failed backup —
      // it is an older schema. Record it as absent and carry on.
      counts.set(table, -1);
      continue;
    }

    for await (const line of rowsFor(table)) yield line;
  }
}

async function prune(dir: string): Promise<void> {
  const files = (await readdir(dir)).filter((f) => f.startsWith("stratis-") && f.endsWith(".ndjson.gz"));
  if (files.length <= KEEP) return;

  const withTime = await Promise.all(
    files.map(async (f) => ({ f, at: (await stat(resolve(dir, f))).mtimeMs })),
  );
  withTime.sort((a, b) => b.at - a.at);

  for (const { f } of withTime.slice(KEEP)) {
    await unlink(resolve(dir, f));
  }
}

export async function backup(outDir: string): Promise<{ file: string; counts: Map<string, number> }> {
  await mkdir(outDir, { recursive: true });

  const file = resolve(outDir, `stratis-${stamp()}.ndjson.gz`);
  const counts = new Map<string, number>();

  await pipeline(Readable.from(everything(counts)), createGzip(), createWriteStream(file));
  await prune(outDir);

  return { file, counts };
}

async function main(): Promise<void> {
  const outDir = process.argv[2] ?? resolve(process.cwd(), "backups");

  try {
    const { file, counts } = await backup(outDir);

    const missing = [...counts].filter(([, n]) => n < 0).map(([t]) => t);
    const total = [...counts].reduce((sum, [, n]) => sum + Math.max(0, n), 0);

    console.log(`[backup] wrote ${file}`);
    console.log(`[backup] ${total} rows across ${counts.size - missing.length} tables`);
    for (const [table, n] of counts) {
      if (n > 0) console.log(`  ${table.padEnd(26)} ${n}`);
    }
    if (missing.length) console.log(`[backup] not on this database: ${missing.join(", ")}`);

    // An empty backup is the one that looks like it worked. Say so loudly.
    if (total === 0) {
      console.error("[backup] REFUSING to call this a backup: it contains no rows.");
      process.exit(1);
    }

    process.exit(0);
  } catch (err) {
    console.error("[backup] FAILED — no usable file was written:", err);
    process.exit(1);
  }
}

// Only when run directly, so the functions above stay importable by a test.
if (process.argv[1]?.includes("backup")) void main();
