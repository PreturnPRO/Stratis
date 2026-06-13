// SQLite connection using Node's built-in `node:sqlite` (Node 22.5+/24).
// No native build step required — works on Windows without Visual Studio.
//
// A thin wrapper exposes a better-sqlite3-style API (`prepare().run/get/all`,
// `exec`, `pragma`) so route/service code stays storage-agnostic.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "../config/env";

mkdirSync(dirname(env.dbFile), { recursive: true });

const raw = new DatabaseSync(env.dbFile);

export interface Stmt {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get<T = any>(...params: unknown[]): T | undefined;
  all<T = any>(...params: unknown[]): T[];
}

export const db = {
  prepare(sql: string): Stmt {
    const s = raw.prepare(sql);
    return {
      run: (...p) => s.run(...(p as any)) as any,
      get: <T,>(...p: unknown[]) => s.get(...(p as any)) as T | undefined,
      all: <T,>(...p: unknown[]) => s.all(...(p as any)) as T[],
    };
  },
  exec(sql: string): void {
    raw.exec(sql);
  },
  pragma(stmt: string): void {
    raw.exec(`PRAGMA ${stmt};`);
  },
  get raw() {
    return raw;
  },
};

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export default db;
