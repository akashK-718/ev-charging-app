import { cn } from '@/lib/utils';

interface ActionBarProps {
  children: React.ReactNode;
  className?: string;
}

export function ActionBar({ children, className }: ActionBarProps) {
  return (
    <div className={cn(
      'fixed bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] lg:bottom-0 left-0 right-0 z-50',
      'bg-surface-card/95 backdrop-blur-sm border-t border-border',
      'px-4 py-3',
      className,
    )}>
      <div className="max-w-lg mx-auto">{children}</div>
    </div>
  );
}
