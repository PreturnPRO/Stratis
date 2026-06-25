import { Pool, QueryResultRow } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';


config({ path: resolve(process.cwd(), '../.env') });


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export const db = {
  query: async <T extends QueryResultRow = any>(text: string, params?: any[]) => {
    return pool.query<T>(text, params);
  },
  getPool: () => pool,
};

export default db;