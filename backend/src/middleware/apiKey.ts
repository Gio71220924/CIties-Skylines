import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

// Minimal placeholder until real user auth + per-city ownership checks exist.
// TODO: replace with session/JWT auth and verify req.params.cityId belongs to the caller.
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.API_KEY;

  // Fail closed: no configured key means no access, in every environment.
  // (Set API_KEY locally too — there is no dev-mode bypass.)
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
