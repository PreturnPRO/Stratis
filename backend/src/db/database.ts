import { Pool, QueryResultRow } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';


config({ path: resolve(process.cwd(), '../.env') });


// SSL heuristic:
//  - local Postgres (localhost / 127.0.0.1) has no SSL
//  - Railway PRIVATE networking (*.railway.internal) has no SSL either —
//    forcing it there fails with "The server does not support SSL connections"
//  - public/proxied hosts (e.g. *.proxy.rlwy.net) require SSL
// DATABASE_SSL=true|false overrides the heuristic when a host doesn't fit it.
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