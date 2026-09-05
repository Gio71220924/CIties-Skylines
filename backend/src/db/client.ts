import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

// Supabase's pooler presents a publicly-trusted cert (not self-signed), so plain
// ssl:true verifies it against Node's default CA store — no need to disable verification.
export const pool = connectionString ? new Pool({ connectionString, ssl: true }) : null;

export function requireDb(): Pool {
  if (!pool) throw new Error('DATABASE_URL not set — see .env.example');
  return pool;
}
