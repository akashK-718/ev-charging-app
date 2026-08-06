'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BackButtonProps {
  onClick?: () => void;
  href?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Bucket 1: predictable solid/light background.
 * 44dp transparent tap target, plain arrow, opacity-shift on press.
 * No background, no border, no shadow, no scale, no haptic.
 */
export function BackButton({
  onClick,
  href,
  className,
  'aria-label': ariaLabel = 'Go back',
}: BackButtonProps) {
  const cls = cn(
    'size-11 grid place-items-center text-ink',
    'active:opacity-60 transition-opacity duration-[var(--dur-fast)]',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cls} aria-label={ariaLabel}>
      <ChevronLeft className="size-5" aria-hidden />
    </button>
  );
}

/**
 * Bucket 2: variable/unpredictable background (photos, maps, carousels).
 * ~40dp visible circle with translucent light fill and shadow for guaranteed contrast.
 * Tap area matches the visible element; shadow extends it slightly beyond.
 */
export function ContainedBackButton({
  onClick,
  href,
  className,
  'aria-label': ariaLabel = 'Go back',
}: BackButtonProps) {
  const cls = cn(
    'size-10 rounded-full',
    'bg-white/90 backdrop-blur-sm shadow-sm',
    'grid place-items-center text-ink',
    'active:opacity-70 transition-opacity duration-[var(--dur-fast)]',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cls} aria-label={ariaLabel}>
      <ChevronLeft className="size-5" aria-hidden />
    </button>
  );
}
