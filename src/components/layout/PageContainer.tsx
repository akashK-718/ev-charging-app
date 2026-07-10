import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}

export function PageContainer({ children, className, narrow = false }: PageContainerProps) {
  return (
    <div className={cn(
      'mx-auto px-4 py-6 md:px-6 md:py-8',
      narrow ? 'max-w-lg' : 'max-w-4xl',
      className,
    )}>
      {children}
    </div>
  );
}
