import { useState } from 'react';
import { cn } from '@/lib/utils';
import { colorFromString, initialsOf } from '@/lib/mappers';
import { resolveAssetUrl } from '@/lib/asset-url';

export interface AvatarUser {
  name: string;
  avatarUrl?: string | null;
  id?: string;
  email?: string;
}

function shade(hex: string, percent: number) {
  const h = hex.replace('#', '');
  const num = parseInt(h, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + Math.round((percent / 100) * 255));
  const g = clamp(((num >> 8) & 0xff) + Math.round((percent / 100) * 255));
  const b = clamp((num & 0xff) + Math.round((percent / 100) * 255));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function UserAvatar({
  user,
  size = 32,
  className,
}: {
  user: AvatarUser;
  size?: number;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const base = colorFromString(user.id ?? user.email ?? user.name);
  const fs = Math.round(size * 0.38);
  const url = imageFailed ? null : resolveAssetUrl(user.avatarUrl);

  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
      aria-label={user.name}
    >
      {url ? (
        <img
          src={url}
          alt={user.name}
          className="h-full w-full rounded-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
          style={{
            background: `linear-gradient(135deg, ${base} 0%, ${shade(base, -18)} 100%)`,
            fontSize: fs,
          }}
        >
          {initialsOf(user.name)}
        </span>
      )}
    </span>
  );
}
