'use client';

import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, MouseEvent } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary:   'bg-green text-white enabled:hover:bg-green-deep enabled:active:bg-green-deep/90 enabled:active:scale-[0.96]',
  secondary: 'bg-surface-page text-ink border border-border enabled:hover:bg-border enabled:active:bg-border/70 enabled:active:scale-[0.98]',
  ghost:     'bg-transparent text-ink enabled:hover:bg-surface-page enabled:active:bg-border enabled:active:scale-[0.98]',
  danger:    'bg-danger-soft text-danger enabled:hover:bg-danger-soft/80 enabled:active:bg-danger-soft/60 enabled:active:scale-[0.96]',
};

// primary/danger → medium haptic; secondary/ghost → light
const HAPTIC: Record<Variant, 'medium' | 'light'> = {
  primary:   'medium',
  secondary: 'light',
  ghost:     'light',
  danger:    'medium',
};

const SIZE: Record<Size, string> = {
  md: 'h-[48px] px-[26px] text-[15px]',
  sm: 'h-[38px] px-[18px] text-[13.5px]',
  lg: 'h-[48px] px-[26px] text-[15px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  onClick,
  ...props
}: ButtonProps) {
  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (!disabled && !loading) haptic(HAPTIC[variant]);
    onClick?.(e);
  }

  return (
    <button
      disabled={disabled || loading}
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-token font-semibold',
        // transition covers color + transform so both hover and active:scale animate
        'transition duration-[80ms] ease-out',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
      {children}
    </button>
  );
}
