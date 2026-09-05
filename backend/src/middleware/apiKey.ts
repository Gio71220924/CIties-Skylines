import type { NextFunction, Request, Response } from 'express';

// Minimal placeholder until real user auth + per-city ownership checks exist.
// TODO: replace with session/JWT auth and verify req.params.cityId belongs to the caller.
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.API_KEY;

  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({ error: 'server misconfigured: API_KEY not set' });
      return;
    }
    console.warn('API_KEY not set — mutating routes are unprotected in dev mode');
    next();
    return;
  }

  if (req.header('x-api-key') !== configured) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  next();
}
