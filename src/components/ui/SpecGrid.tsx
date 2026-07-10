import { cn } from '@/lib/utils';

interface SpecGridProps {
  children: React.ReactNode;
  cols?: 2 | 3;
  className?: string;
}

export function SpecGrid({ children, cols = 2, className }: SpecGridProps) {
  return (
    <div className={cn('grid gap-2', cols === 2 ? 'grid-cols-2' : 'grid-cols-3', className)}>
      {children}
    </div>
  );
}
