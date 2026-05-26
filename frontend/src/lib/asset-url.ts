const API_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '/api';

export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;

  const normalized = url.startsWith('/') ? url : `/${url}`;
  if (!normalized.startsWith('/uploads/')) return normalized;

  if (/^https?:\/\//i.test(API_URL)) {
    const api = new URL(API_URL);
    return `${api.origin}${normalized}`;
  }

  return normalized;
}
