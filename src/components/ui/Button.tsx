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
  primary:   'bg-volt text-ink shadow-[0_8px_20px_rgba(16,217,106,.32)] enabled:hover:bg-volt/90 enabled:active:bg-volt/80 disabled:shadow-none',
  secondary: 'bg-surface-0 text-ink border-[1.5px] border-ink enabled:hover:bg-surface-1 enabled:active:bg-surface-2',
  ghost:     'bg-transparent text-ink enabled:hover:bg-surface-1 enabled:active:bg-surface-2',
  danger:    'bg-danger text-white shadow-[0_8px_20px_rgba(220,38,38,.25)] enabled:hover:bg-danger/90 enabled:active:bg-danger/80 disabled:shadow-none',
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
        'inline-flex items-center justify-center gap-2 rounded-pill font-bold',
        'transition-all duration-[120ms] ease-out',
        'enabled:hover:-translate-y-px enabled:active:translate-y-0',
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
