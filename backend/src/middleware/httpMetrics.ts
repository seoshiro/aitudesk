import { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpRequestDuration } from '../lib/metrics';

const UUID_RE = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const CUID_RE = /\/c[a-z0-9]{20,30}\b/g; // Prisma default @id @default(cuid())
const NUMERIC_ID_RE = /\/\d+\b/g;
const HEX_TOKEN_RE = /\/[a-f0-9]{24,}\b/gi; // generic long hex (e.g. tokens, ObjectIDs)

/**
 * Normalize dynamic path segments so Prometheus label cardinality stays
 * bounded.  Without this every UUID/cuid becomes its own time-series and
 * legend explodes (`GET /api/tickets/3f1c..d12  200`, ...).
 *
 * Examples:
 *   /api/tickets/3f1c4d3a-...-c0d12        → /api/tickets/:id
 *   /api/kb/articles/cl9z8x7y6w5v4u3t2s1r → /api/kb/articles/:id
 *   /api/users/42                          → /api/users/:id
 *   /uploads/abc123.../avatar.png          → /uploads/:id/avatar.png
 */
export function normalizeRoute(path: string): string {
  const normalized = path
    .replace(UUID_RE, '/:id')
    .replace(CUID_RE, '/:id')
    .replace(HEX_TOKEN_RE, '/:id')
    .replace(NUMERIC_ID_RE, '/:id');
  // Strip trailing slash (except root) so `/api/tickets` and `/api/tickets/`
  // collapse into the same series.
  return normalized.length > 1 && normalized.endsWith('/')
    ? normalized.slice(0, -1)
    : normalized;
}

export const httpMetrics = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    // Prefer the Express route template (already has ":id") when matched,
    // otherwise normalize the raw path for unmatched/static routes.
    const matched = req.route?.path as string | undefined;
    const baseUrl = req.baseUrl ?? '';
    const rawRoute = matched ? `${baseUrl}${matched}` : req.path;
    const route = normalizeRoute(rawRoute);

    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    const elapsed = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(labels, elapsed);
  });

  next();
};
