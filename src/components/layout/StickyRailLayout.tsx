import { cn } from '@/lib/utils';

interface StickyRailLayoutProps {
  main: React.ReactNode;
  rail: React.ReactNode;
  className?: string;
}

export function StickyRailLayout({ main, rail, className }: StickyRailLayoutProps) {
  return (
    <div className={cn('max-w-6xl mx-auto px-4 md:px-6', className)}>
      <div className="flex gap-8 items-start">
        <main className="flex-1 min-w-0">{main}</main>
        <aside className="w-80 shrink-0 sticky top-6 hidden md:block">{rail}</aside>
      </div>
    </div>
  );
}
