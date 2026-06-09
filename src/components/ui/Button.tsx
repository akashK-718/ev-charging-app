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
        'font-display font-bold rounded-2xl transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-ink text-white hover:bg-ink-soft': variant === 'primary',
          'bg-volt text-ink hover:bg-volt-deep hover:text-white':
            variant === 'secondary',
          'bg-transparent text-ink hover:bg-volt-soft': variant === 'ghost'
        },
        {
          'px-4 py-2 text-sm': size === 'sm',
          'px-6 py-3 text-base': size === 'md',
          'px-8 py-4 text-lg w-full': size === 'lg'
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
