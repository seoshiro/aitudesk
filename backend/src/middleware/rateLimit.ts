import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000;

function limitFromEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const tooMany = { error: 'Too many attempts, please try again later' };

// Brute-force protection: only failed logins count toward the limit,
// so a legitimate user who signs in successfully is never locked out.
export const loginLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: limitFromEnv('LOGIN_RATE_LIMIT', 10),
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooMany,
});

// Slows down mass account creation and refresh-token abuse.
export const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: limitFromEnv('AUTH_RATE_LIMIT', 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooMany,
});
