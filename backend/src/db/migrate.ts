import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { db } from "./database";
import { applySchema } from "./applySchema";

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
      // The local .env points DATABASE_URL at the hosted database, and this
      // command drops 27 tables CASCADE. Nothing about `npm run db:reset`
      // announces that it is about to do so to production, and there is no
      // undo — so refuse unless the host looks local, or the operator has
      // typed the override in full.
      const url = process.env.DATABASE_URL ?? "";
      const looksLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url);
      const override = process.env.I_UNDERSTAND_THIS_DROPS_EVERY_TABLE === "yes";

      if (!looksLocal && !override) {
        const host = url.replace(/^[^@]*@/, "").split(/[:/]/)[0] || "(unset DATABASE_URL)";
        console.error(
          `[migrate] REFUSING --reset against ${host}.\n` +
            "  This drops every table and all customer data, and the connection " +
            "string is not a local one.\n" +
            "  If you are certain, re-run with " +
            "I_UNDERSTAND_THIS_DROPS_EVERY_TABLE=yes",
        );
        process.exit(1);
      }

      const resetSql = readFileSync(resolve(__dirname, "reset.sql"), "utf-8");
      await db.query(resetSql);
      console.log("[migrate] dropped existing tables (--reset)");
    }

    await applySchema();
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
