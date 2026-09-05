import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { requireDb } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  const pool = requireDb();
  await pool.query(sql);
  console.log('migration applied');
  await pool.end();
}

migrate().catch((err: unknown) => {
  console.error('migration failed:', err);
  process.exit(1);
});
