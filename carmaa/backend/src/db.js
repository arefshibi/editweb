import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: Number(process.env.DB_POOL_SIZE || 15),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  query_timeout: 12_000,
  application_name: 'carmaa-api',
  ssl: config.isProduction && config.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
});
pool.on('error', (err) => {
  // Do not log connection URLs or query parameters.
  console.error(JSON.stringify({ level: 'error', event: 'postgres_pool_error', message: err.message }));
});

export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '10000ms'");
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* connection is already unavailable */ }
    throw error;
  } finally {
    client.release();
  }
}
