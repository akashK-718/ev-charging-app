'use client';

import { useEffect, useState } from 'react';
import { toJpegUrl } from '@/lib/cloudinary-url';

const SIZE_CLASS = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-20 h-20 text-xl',
};

function getInitials(name: string | null): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

interface AvatarProps {
  avatarUrl: string | null;
  name: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ avatarUrl, name, size = 'md' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgError(false); }, [avatarUrl]);

  const sizeClass = SIZE_CLASS[size];

  if (avatarUrl && !imgError) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden shrink-0`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={toJpegUrl(avatarUrl)}
          alt={name ?? 'Profile photo'}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-volt-soft flex items-center justify-center shrink-0 select-none`}>
      <span className="font-medium text-ink leading-none">{getInitials(name)}</span>
    </div>
  );
}
