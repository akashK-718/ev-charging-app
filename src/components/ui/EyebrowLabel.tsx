import { cn } from '@/lib/utils';

interface EyebrowLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function EyebrowLabel({ children, className }: EyebrowLabelProps) {
  return (
    <p className={cn('text-xs font-medium tracking-widest uppercase text-muted', className)}>
      {children}
    </p>
  );
}
