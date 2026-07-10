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
  primary:   'bg-volt text-volt-deep hover:bg-volt/90 active:bg-volt/80',
  secondary: 'bg-surface-2 text-ink border border-border hover:bg-surface-1 active:bg-surface-2/70',
  ghost:     'bg-transparent text-ink hover:bg-surface-1 active:bg-surface-2',
  danger:    'bg-danger-soft text-danger hover:bg-danger-soft/80 active:bg-danger-soft/60',
};

const SIZE: Record<Size, string> = {
  md: 'h-[46px] px-5 text-[15px]',
  sm: 'h-[38px] px-4 text-[14px]',
  lg: 'h-[46px] px-5 text-[15px]',
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
        'inline-flex items-center justify-center gap-2 rounded-token font-medium',
        'transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
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
