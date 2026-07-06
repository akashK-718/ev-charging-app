import { cn } from '@/lib/utils';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  auto_rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-red-50 text-red-700',
  awaiting_driver_confirmation: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-blue-50 text-blue-700',
  awaiting_end_confirmation: 'bg-orange-50 text-orange-700',
  completed: 'bg-gray-100 text-muted',
  no_show: 'bg-orange-50 text-orange-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  rejected: 'Declined',
  auto_rejected: 'Declined',
  cancelled: 'Cancelled',
  awaiting_driver_confirmation: 'Awaiting driver',
  in_progress: 'Session in progress',
  awaiting_end_confirmation: 'Awaiting confirmation',
  completed: 'Completed',
  no_show: 'No show',
};

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap',
        STATUS_STYLE[status] ?? 'bg-gray-100 text-muted',
        className,
      )}
    >
      {label ?? STATUS_LABEL[status] ?? status}
    </span>
  );
}
