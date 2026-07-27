import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { db } from "./database";

const __dirname = dirname(fileURLToPath(import.meta.url));
const reset = process.argv.includes("--reset");

async function run() {
  try {
    // The drop list lives in reset.sql, not inline here and never in schema.sql:
    // the previous inline TABLES array silently omitted projects, documents,
    // participant_summaries, summary_blocks, action_items and decisions, so
    // --reset left half the database standing while schema.sql's own DROP block
    // wiped everything on EVERY run, reset or not.
    if (reset) {
      const resetSql = readFileSync(resolve(__dirname, "reset.sql"), "utf-8");
      await db.query(resetSql);
      console.log("[migrate] dropped existing tables (--reset)");
    }

    const schema = readFileSync(resolve(__dirname, "schema.sql"), "utf-8");
    await db.query(schema);
    console.log("[migrate] schema applied");
    process.exit(0);
  } catch (err) {
    // Non-zero, or a failed migration reports success: pg runs a multi-statement
    // query in one implicit transaction, so ONE bad statement rolls back the
    // whole file — including the additive ALTERs at the bottom — while the
    // deploy that called this goes green and the app 500s on the missing column.
    console.error("[migrate] FAILED — no changes were applied:", err);
    process.exit(1);
  }
}

run();
