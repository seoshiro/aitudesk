import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error, _req: Request, res: Response, _next: NextFunction
): void => {
  console.error('[Error]', err.message);
  if (err.message?.startsWith('CORS blocked')) {
    res.status(403).json({ error: 'Origin not allowed', message: err.message });
    return;
  }
  res.status(500).json({ error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? err.message : undefined });
};
