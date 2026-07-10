import { cn } from '@/lib/utils';

interface SpecTileProps {
  label: string;
  value: string;
  className?: string;
}

export function SpecTile({ label, value, className }: SpecTileProps) {
  return (
    <div className={cn('flex flex-col gap-0.5 p-3 bg-surface-1 rounded-token', className)}>
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="text-base font-medium text-ink">{value}</span>
    </div>
  );
}
