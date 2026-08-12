import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

/**
 * Every `$n` in a query must be used.
 *
 * Postgres numbers placeholders from the text of the statement, so a query that
 * mentions `$1` and `$3` but never `$2` is rejected at parse time — "could not
 * determine data type of parameter $2" — no matter how many values the caller
 * passes. It is a runtime 500 on a query that reads perfectly well, typechecks
 * clean, and only fails on the request that runs it.
 *
 * That is exactly how it reached production: a WHERE clause was simplified from
 * `($2 = 'admin' OR s.facilitator_id = $3)` to `s.facilitator_id = $3`, the
 * unused `role` stayed in the params array, and the dashboard and the session
 * recovery endpoint both 500'd for every user until someone signed in and
 * looked.
 *
 * This test reads the source rather than the database, so it needs no
 * connection and it catches the next one at `npm test` instead of at a
 * customer.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_SRC = resolve(__dirname, "..");

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFilesUnder(full));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

/** Every template literal or plain string handed to a `.query(...)` call. */
function queryLiterals(source: string): string[] {
  const found: string[] = [];
  const call = /\.query(?:<[^>]*>)?\(\s*(`[\s\S]*?`|"[^"]*"|'[^']*')/g;
  let match: RegExpExecArray | null;
  while ((match = call.exec(source)) !== null) found.push(match[1]);
  return found;
}

function gapsIn(sql: string): number[] {
  const used = new Set<number>();
  for (const m of sql.matchAll(/\$(\d+)/g)) used.add(Number(m[1]));
  if (used.size === 0) return [];
  const highest = Math.max(...used);
  const missing: number[] = [];
  for (let i = 1; i <= highest; i++) if (!used.has(i)) missing.push(i);
  return missing;
}

test("no query skips a parameter number", () => {
  const offenders: string[] = [];

  for (const file of tsFilesUnder(BACKEND_SRC)) {
    const source = readFileSync(file, "utf-8");
    for (const literal of queryLiterals(source)) {
      const missing = gapsIn(literal);
      if (missing.length > 0) {
        offenders.push(
          `${relative(BACKEND_SRC, file)}: skips ${missing.map((n) => `$${n}`).join(", ")}`,
        );
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Postgres rejects a statement with an unused placeholder:\n${offenders.join("\n")}`,
  );
});

test("gapsIn recognises the shape that broke the dashboard", () => {
  assert.deepEqual(gapsIn("WHERE org = $1 AND facilitator = $3 LIMIT $4"), [2]);
  assert.deepEqual(gapsIn("WHERE org = $1 AND facilitator = $2 LIMIT $3"), []);
  assert.deepEqual(gapsIn("SELECT 1"), []);
});
