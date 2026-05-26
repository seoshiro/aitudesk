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
  return process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'fallback_secret';
}

export function getRefreshTokenSecret(): string {
  return process.env.JWT_REFRESH_SECRET ?? 'refresh_secret';
}

export function getAllowedOrigins(): string[] {
  return [
    ...splitOrigins(process.env.CORS_ORIGIN),
    ...splitOrigins(process.env.FRONTEND_URL),
    ...splitOrigins(process.env.CLIENT_URL),
    ...splitOrigins(process.env.EXTRA_CORS_ORIGINS),
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:7754',
    'http://localhost:80',
    'http://localhost',
  ];
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin) || LOCAL_ORIGIN_RE.test(origin);
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
