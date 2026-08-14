import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

/**
 * A TEXT column may not be compared to a timestamp.
 *
 * `decisions.due_date` is TEXT on purpose — the room says "end of month" and we
 * keep the phrase — so `d.due_date <= NOW()` is not a subtle bug that returns
 * the wrong rows. Postgres refuses to resolve the operator, the statement fails
 * to parse on zero rows, and the endpoint 500s for every user in every
 * workspace. The dashboard shipped that way: typecheck clean, 155 tests green,
 * and the only symptom was the home screen being dead.
 *
 * `queryParams.test.ts` cannot see this — it counts placeholders. This one
 * reads the declared column types out of schema.sql and checks them against
 * every date comparison in the backend's SQL.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_SRC = resolve(__dirname, "..");

/** column name -> declared type, from schema.sql. */
function declaredTypes(): Map<string, string> {
  const schema = readFileSync(resolve(__dirname, "schema.sql"), "utf-8");
  const types = new Map<string, string>();

  for (const line of schema.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--")) continue;

    // "    due_date TEXT," and "ALTER TABLE x ADD COLUMN IF NOT EXISTS y TIMESTAMPTZ"
    const column = trimmed.match(/^([a-z_]+)\s+(TEXT|TIMESTAMPTZ|BOOLEAN|INTEGER|JSONB|DATE)\b/);
    const altered = trimmed.match(
      /ADD COLUMN IF NOT EXISTS\s+([a-z_]+)\s+(TEXT|TIMESTAMPTZ|BOOLEAN|INTEGER|JSONB|DATE)\b/i,
    );
    const hit = column ?? altered;
    if (!hit) continue;

    const [, name, type] = hit;
    // A name declared with two types in two tables is ambiguous; treat it as
    // TEXT so the stricter rule wins and someone has to look.
    types.set(name, types.get(name) === "TEXT" ? "TEXT" : type.toUpperCase());
  }

  return types;
}

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFilesUnder(full));
    else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

/** `alias.column <= NOW()` and friends, with the cast-guarded forms excluded. */
const DATE_COMPARISON =
  /(?:([a-z_]+)\.)?([a-z_]+)\s*(?:<=|>=|<|>)\s*(?:NOW\(\)|CURRENT_DATE|CURRENT_TIMESTAMP)/gi;

test("no TEXT column is compared to a timestamp", () => {
  const types = declaredTypes();
  const offenders: string[] = [];

  for (const file of tsFilesUnder(BACKEND_SRC)) {
    // Comments are where the wrong form gets quoted as a warning, so strip
    // both flavours before scanning — otherwise the note explaining this very
    // bug reads as the bug.
    const source = readFileSync(file, "utf-8")
      .split(/\r?\n/)
      .map((line) => (line.trim().startsWith("--") || line.trim().startsWith("//") ? "" : line))
      .join("\n");

    for (const match of source.matchAll(DATE_COMPARISON)) {
      const [whole, , column] = match;
      if (types.get(column) !== "TEXT") continue;

      // `d.due_date::date <= CURRENT_DATE` is the correct guarded form.
      const castBefore = source.slice(Math.max(0, match.index - 40), match.index + whole.length);
      if (castBefore.includes("::date") || castBefore.includes("::timestamptz")) continue;

      const line = source.slice(0, match.index).split("\n").length;
      offenders.push(`${relative(BACKEND_SRC, file)}:${line} — ${whole.trim()} (${column} is TEXT)`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Postgres cannot compare TEXT to a timestamp; the statement fails to parse:\n${offenders.join("\n")}`,
  );
});

test("schema.sql is parsed well enough for the check to mean something", () => {
  const types = declaredTypes();
  // Anchors: if these stop resolving, the parser above has drifted and the
  // test would start passing by seeing nothing at all.
  assert.equal(types.get("due_date"), "TEXT", "decisions.due_date should read as TEXT");
  assert.equal(types.get("created_at"), "TIMESTAMPTZ");
});
