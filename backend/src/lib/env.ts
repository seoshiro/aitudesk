import type { CookieOptions } from 'express';

export const isProduction = process.env.NODE_ENV === 'production';

const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i;

function splitOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getAccessTokenSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET;
  if (secret) return secret;
  if (isProduction) {
    throw new Error('JWT_ACCESS_SECRET or JWT_SECRET must be set in production');
  }
  return 'aitudesk_jwt_super_secret_key_change_in_production';
}

export function getRefreshTokenSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (secret) return secret;
  if (isProduction) {
    throw new Error('JWT_REFRESH_SECRET must be set in production');
  }
  return 'aitudesk_refresh_secret_change_in_production';
}

// Local origins are trusted outside production, and in production only when
// explicitly opted in (the local docker-compose stack runs with NODE_ENV=production).
function localOriginsAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCALHOST_ORIGINS === 'true';
}

export function getAllowedOrigins(): string[] {
  return [
    ...splitOrigins(process.env.CORS_ORIGIN),
    ...splitOrigins(process.env.FRONTEND_URL),
    ...splitOrigins(process.env.CLIENT_URL),
    ...splitOrigins(process.env.EXTRA_CORS_ORIGINS),
  ];
}

export function isOriginAllowed(origin: string | undefined): boolean {
  // Requests without an Origin header (curl, server-to-server, health checks)
  // are not cross-origin browser requests, so CORS does not apply to them.
  if (!origin) return true;
  if (getAllowedOrigins().includes(origin)) return true;
  return localOriginsAllowed() && LOCAL_ORIGIN_RE.test(origin);
}

export function getRefreshCookieOptions(expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    ...(expires ? { expires } : {}),
  };
}
