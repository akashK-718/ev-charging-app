import { cn } from '@/lib/utils';

interface DisplayTitleProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}

export function DisplayTitle({ children, className, as: Tag = 'h1' }: DisplayTitleProps) {
  return (
    <Tag className={cn('text-3xl font-medium text-ink leading-tight tracking-tight', className)}>
      {children}
    </Tag>
  );
}
