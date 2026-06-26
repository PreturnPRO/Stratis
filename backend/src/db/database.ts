import { Pool, QueryResultRow } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';


config({ path: resolve(process.cwd(), '../.env') });


// Managed Postgres (Railway/most cloud hosts) requires SSL; a local Postgres
// (localhost / 127.0.0.1) does not support it. Force SSL only for remote hosts
// so local development and tests can connect.
const connectionString = process.env.DATABASE_URL;
const isLocalDb = /@(localhost|127\.0\.0\.1)\b/.test(connectionString ?? '');

const pool = new Pool({
  connectionString,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

export const db = {
  query: async <T extends QueryResultRow = any>(text: string, params?: any[]) => {
    return pool.query<T>(text, params);
  },
  getPool: () => pool,
};

export default db;