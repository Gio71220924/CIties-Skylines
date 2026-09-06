import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

// ssl:true alone fails here with SELF_SIGNED_CERT_IN_CHAIN — Supabase's pooler chain
// isn't fully covered by Node's bundled CA store on every platform. rejectUnauthorized:false
// is the pattern Supabase's own docs use for `pg`: the connection is still TLS-encrypted,
// just not chain-verified, so it's not hardened against active MITM on the network path to
// the pooler. Tighten later with NODE_EXTRA_CA_CERTS pointing at Supabase's published CA
// bundle if that residual risk needs closing for production.
export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      // Without these, a client waiting on a busy pool (Supabase's transaction pooler has
      // a modest concurrent-connection cap) blocks with no timeout — a request just hangs
      // forever instead of failing fast. max caps how many connections this process opens;
      // idleTimeoutMillis releases them back to the pooler promptly instead of sitting on
      // slots between requests.
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    })
  : null;

export function requireDb(): Pool {
  if (!pool) throw new Error('DATABASE_URL not set — see .env.example');
  return pool;
}
