import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

// Minimal placeholder until real user auth + per-city ownership checks exist.
// TODO: replace with session/JWT auth and verify req.params.cityId belongs to the caller.
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  // Explicit dev bypass: the frontend can't safely hold a static secret (any VITE_* env
  // var ships in the client bundle), so there is no way for a browser client to
  // authenticate against this middleware at all short of real session auth. Gating on
  // NODE_ENV (an explicit, deliberate setting) rather than "API_KEY happens to be unset"
  // keeps this from being the same silent-misconfiguration bypass flagged before —
  // production must still set NODE_ENV=production or every mutation is unauthenticated.
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  const configured = process.env.API_KEY;

  // Fail closed: no configured key means no access in production.
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
