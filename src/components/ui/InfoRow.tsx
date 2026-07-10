import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface InfoRowProps {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function InfoRow({ icon: Icon, label, value, className }: InfoRowProps) {
  return (
    <div className={cn('flex items-center gap-3 py-3 border-b border-border last:border-0', className)}>
      {Icon && <Icon className="w-4 h-4 text-muted shrink-0" />}
      <span className="text-sm font-medium text-muted flex-1">{label}</span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  );
}
