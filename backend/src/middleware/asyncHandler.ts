import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async Express route handlers to catch rejected promises
 * and forward them to Express error middleware.
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
