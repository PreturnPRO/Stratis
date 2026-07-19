// Migration runner. Applies schema.sql. `--reset` drops all tables
// first so `npm run db:reset` gives a clean, seedable database.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { db } from "./database";

const __dirname = dirname(fileURLToPath(import.meta.url));
const reset = process.argv.includes("--reset");

const TABLES = [
  "decisions",
  "consent_logs",
  "notifications",
  "node_relationships",
  "nodes",
  "document_versions",
  "documents",
  "transcripts",
  "sessions",
  "meetings",
  "users",
  "organizations",
];

async function run() {
  try {
    if (reset) {
      // PostgreSQL handles foreign keys strictly; CASCADE forces the drop
      for (const t of TABLES) {
        await db.query(`DROP TABLE IF EXISTS ${t} CASCADE;`);
      }
      console.log("[migrate] dropped existing tables");
    }

    const schema = readFileSync(resolve(__dirname, "schema.sql"), "utf-8");
    await db.query(schema);
    console.log("[migrate] schema applied");
  } catch (err) {
    console.error("[migrate] error:", err);
  } finally {
    process.exit(0); // Exit the pool connection so the terminal doesn't hang
  }
}

run();