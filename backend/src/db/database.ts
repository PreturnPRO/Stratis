import { Pool, QueryResultRow } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === 'production') {
  console.error(
    '[db] DATABASE_URL is not set — point it at your Railway Postgres instance.',
  );
}

const noSslHost = /@(localhost|127\.0\.0\.1)\b|\.railway\.internal/i.test(
  connectionString ?? '',
);
const sslOverride = process.env.DATABASE_SSL;
const useSsl = sslOverride != null ? sslOverride === 'true' : !noSslHost;

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

export const db = {
  query: async <T extends QueryResultRow = any>(text: string, params?: any[]) => {
    return pool.query<T>(text, params);
  },
  getPool: () => pool,
};

export default db;
