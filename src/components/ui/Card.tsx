import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={cn('bg-surface-0 rounded-token-lg shadow-card', padding && 'p-4', className)}>
      {children}
    </div>
  );
}
