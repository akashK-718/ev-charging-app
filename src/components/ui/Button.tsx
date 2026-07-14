import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary:   'bg-green text-white enabled:hover:bg-green-deep enabled:active:bg-green-deep/90',
  secondary: 'bg-surface-page text-ink border border-border enabled:hover:bg-border enabled:active:bg-border/70',
  ghost:     'bg-transparent text-ink enabled:hover:bg-surface-page enabled:active:bg-border',
  danger:    'bg-danger-soft text-danger enabled:hover:bg-danger-soft/80 enabled:active:bg-danger-soft/60',
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
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-token font-semibold',
        'transition-colors duration-[120ms] ease-out',
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
