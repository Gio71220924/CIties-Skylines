import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

function isLoopback(ip: string | undefined): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

// Minimal placeholder until real user auth + per-city ownership checks exist.
// TODO: replace with session/JWT auth and verify req.params.cityId belongs to the caller.
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  // Explicit, double opt-in dev bypass: the frontend can't safely hold a static secret
  // (any VITE_* env var ships in the client bundle), so there's no way for a browser
  // client to authenticate here short of real session auth. NODE_ENV alone was rejected
  // by security review as too weak a boundary (unset/misconfigured on plenty of deploy
  // platforms) — this requires BOTH a dedicated env var AND the request actually coming
  // from loopback, so a misconfigured production deploy can't silently open this up.
  if (process.env.ALLOW_UNAUTHENTICATED_DEV === 'true' && isLoopback(req.ip)) {
    next();
    return;
  }

  const configured = process.env.API_KEY;

  // Fail closed: no configured key means no access.
  if (!configured) {
    res.status(500).json({ error: 'server misconfigured: API_KEY not set' });
    return;
  }

  const provided = Buffer.from(req.header('x-api-key') ?? '');
  const expected = Buffer.from(configured);
  const valid = provided.length === expected.length && timingSafeEqual(provided, expected);

  if (!valid) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  next();
}
