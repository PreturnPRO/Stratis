// Migration runner (S1-T00-A). Applies schema.sql. `--reset` drops all tables
// first so `npm run db:reset` gives a clean, seedable database.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { db } from "./database";

const __dirname = dirname(fileURLToPath(import.meta.url));
const reset = process.argv.includes("--reset");

const TABLES = [
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

function run() {
  if (reset) {
    db.pragma("foreign_keys = OFF");
    for (const t of TABLES) db.exec(`DROP TABLE IF EXISTS ${t};`);
    db.pragma("foreign_keys = ON");
    console.log("[migrate] dropped existing tables");
  }

  const schema = readFileSync(resolve(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);
  console.log("[migrate] schema applied");
}

run();