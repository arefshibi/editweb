import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../migrations');
const client = await pool.connect();
let lockHeld = false;
try {
  // Only one replica may apply schema changes at a time.
  await client.query('SELECT pg_advisory_lock($1)', [724190260]);
  lockHeld = true;
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const files = (await fs.readdir(migrationsDir))
    .filter((name) => /^\d{3}_[a-z0-9_-]+\.sql$/i.test(name))
    .sort();
  if (!files.length) throw new Error('No migration files found');
  for (const name of files) {
    const seen = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
    if (seen.rowCount) continue;
    const sql = await fs.readFile(path.join(migrationsDir, name), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
      await client.query('COMMIT');
      console.log(`Applied migration: ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw Object.assign(error, { migrationName: name });
    }
  }
  console.log('Database migrations are up to date.');
} catch (error) {
  console.error(`Migration failed${error.migrationName ? ` (${error.migrationName})` : ''}: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (lockHeld) {
    try { await client.query('SELECT pg_advisory_unlock($1)', [724190260]); } catch { /* connection may be unavailable */ }
  }
  client.release();
  await pool.end();
}
