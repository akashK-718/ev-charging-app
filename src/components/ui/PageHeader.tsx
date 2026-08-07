'use client';

import { cn } from '@/lib/utils';
import { BackButton } from '@/components/ui/BackButton';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  'aria-label'?: string;
  className?: string;
}

/**
 * Standard header for back-navigable screens.
 * Back arrow (Bucket 1 — solid/light background), title, optional subtitle.
 * Self-contained spacing: px-4 pt-12 pb-6.
 * Every screen with a back-navigable header must use this — a one-off layout is a bug.
 */
export function PageHeader({
  title,
  subtitle,
  href,
  onClick,
  'aria-label': ariaLabel,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3 px-4 pt-12 pb-6', className)}>
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
