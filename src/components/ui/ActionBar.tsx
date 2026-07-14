import { cn } from '@/lib/utils';

interface ActionBarProps {
  children: React.ReactNode;
  className?: string;
}

export function ActionBar({ children, className }: ActionBarProps) {
  return (
    <div className={cn(
      'fixed bottom-0 left-0 right-0 z-30',
      'bg-surface-card/95 backdrop-blur-sm border-t border-border',
      'px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
      className,
    )}>
      <div className="max-w-lg mx-auto">{children}</div>
    </div>
  );
}
