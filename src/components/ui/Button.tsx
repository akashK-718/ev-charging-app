import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'font-semibold rounded-xl transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-ink text-white hover:bg-ink-soft': variant === 'primary',
          'bg-volt text-ink hover:bg-volt-deep hover:text-white': variant === 'secondary',
          'bg-transparent text-ink hover:bg-volt-soft': variant === 'ghost'
        },
        {
          'h-9 px-3 text-sm': size === 'sm',
          'h-12 px-4 text-base': size === 'md',
          'h-12 px-4 text-base w-full': size === 'lg'
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
