import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { db } from "./database";

/**
 * Runs backfill-plans.sql — the one-shot that moves pre-existing workspaces off
 * the Free tier they were never meant to inherit. Safe to run twice: the
 * statement only touches rows that have never had a plan set.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
  try {
    const sql = readFileSync(resolve(__dirname, "backfill-plans.sql"), "utf-8");
    const result = await db.query(sql);
    console.log(`[backfill] workspaces moved to the beta plan: ${result.rowCount ?? 0}`);
    process.exit(0);
  } catch (err) {
    console.error("[backfill] FAILED — no changes were applied:", err);
    process.exit(1);
  }
}

run();
