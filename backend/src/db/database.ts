import { Pool, PoolClient, QueryResultRow } from 'pg';
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

  /**
   * Runs `fn` inside one transaction on one connection.
   *
   * `db.query` takes a connection from the pool per call, so a read-then-write
   * sequence built from it is not atomic — two requests interleave and both act
   * on the same "before" state. Anything that reads a row, computes from it,
   * and writes it back has to run in here and lock the row it read.
   */
  tx: async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {
        // The rollback failing means the connection is already broken; the
        // original error is the one worth reporting.
      });
      throw err;
    } finally {
      client.release();
    }
  },
};

export default db;
