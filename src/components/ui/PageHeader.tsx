'use client';

import { cn } from '@/lib/utils';
import { BackButton } from '@/components/ui/BackButton';

interface BackHeaderProps {
  title: string;
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  'aria-label'?: string;
  className?: string;
}

interface TitleHeaderProps {
  eyebrow?: string;
  title: string;
  className?: string;
}

/** Back-navigable screen header: back arrow + title + optional subtitle. */
export function BackHeader({
  title,
  subtitle,
  href,
  onClick,
  'aria-label': ariaLabel,
  className,
}: BackHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3 px-4 pt-[var(--screen-top-inset)] pb-6', className)}>
      <BackButton href={href} onClick={onClick} aria-label={ariaLabel} />
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-ink leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted mt-0.5 leading-snug">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

/** Root-tab screen header: optional eyebrow + title, no back navigation. */
export function TitleHeader({ eyebrow, title, className }: TitleHeaderProps) {
  return (
    <div className={cn('px-4 pt-[var(--screen-top-inset)] pb-4', className)}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-green mb-1">{eyebrow}</p>
      )}
      <h1 className="text-2xl font-bold text-ink leading-tight">{title}</h1>
    </div>
  );
}

/** @deprecated Use BackHeader */
export const PageHeader = BackHeader;
