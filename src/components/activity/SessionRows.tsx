'use client';

import {
  DRIVER_STATUS_LABEL,
  HOST_STATUS_LABEL,
  STATUS_COLOR,
  driverAmountDisplay,
  fmtDate,
  historyItemKind,
  hostAmountDisplay,
  sessionEyebrow,
} from '@/lib/activity/presentation';
import { cn } from '@/lib/utils';
import type { HistoryItem } from '@/types/activity';
import { ChevronRight, RotateCw, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { KIND_ICON } from './icons';

export function DriverCompactRow({
  item,
  onSelect,
  isSelected,
}: {
  item: HistoryItem;
  onSelect?: (item: HistoryItem) => void;
  isSelected?: boolean;
}) {
  const router      = useRouter();
  const navigating  = useRef(false);
  const detailHref  = `/bookings/${item.bookingId}`;
  const statusLabel = DRIVER_STATUS_LABEL[item.status] ?? item.status;
  const statusColor = STATUS_COLOR[item.status] ?? 'bg-surface-page text-muted';
  const amountText  = driverAmountDisplay(item);
  const kind        = historyItemKind(item);
  const cfg         = KIND_ICON[kind];
  const showRate     = item.status === 'completed' && !item.hasRated;
  const showBookAgain = item.status === 'completed';
  const isTerminal  = ['cancelled', 'no_show', 'auto_reject'].includes(item.status);

  function handleRowClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (navigating.current) { e.preventDefault(); return; }
    navigating.current = true;
  }

  function handleBookAgain(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    router.push(`/explore/${item.chargerId}`);
  }

  const rowClass = cn(
    'flex items-center gap-3 px-4 py-3.5 tap-light w-full text-left transition-colors',
    isSelected && 'bg-green-soft/60',
  );

  const inner = (
    <>
      <div className={cn('size-10 rounded-2xl grid place-items-center shrink-0', cfg.bg)}>
        {cfg.icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold tracking-wider uppercase text-muted leading-none mb-0.5">
          {sessionEyebrow(item)}
        </p>
        <p className="text-sm font-semibold text-ink truncate">{item.chargerTitle}</p>
        <p className="text-xs text-muted truncate">
          {item.counterpartyName
            ? `Hosted by ${item.counterpartyName} \u00B7 ${fmtDate(item.scheduledStart)}`
            : fmtDate(item.scheduledStart)}
        </p>
        {item.lifecycleReason && isTerminal && (
          <p className="text-[10px] text-muted/60 truncate">{item.lifecycleReason}</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        {amountText ? (
          <p className="text-xs font-semibold text-ink">{amountText}</p>
        ) : (
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', statusColor)}>
            {statusLabel}
          </span>
        )}
        {showRate ? (
          <span className="flex items-center gap-1 px-2.5 min-h-[44px] rounded-lg bg-green text-white text-[11px] font-semibold whitespace-nowrap">
            <Star className="w-3 h-3 shrink-0 fill-white" aria-hidden />
            Rate
          </span>
        ) : showBookAgain ? (
          <button
            type="button"
            onClick={handleBookAgain}
            className="flex items-center gap-1 px-2.5 min-h-[44px] rounded-lg border border-green/25 bg-green-soft text-green text-[11px] font-semibold whitespace-nowrap transition-colors hover:bg-green-soft/80"
          >
            <RotateCw className="w-3 h-3 shrink-0" aria-hidden />
            Book again
          </button>
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted mt-0.5" aria-hidden />
        )}
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(item)} className={rowClass}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={detailHref} className={rowClass} onClick={handleRowClick}>
      {inner}
    </Link>
  );
}

export function HostCompactRow({
  item,
  onSelect,
  isSelected,
}: {
  item: HistoryItem;
  onSelect?: (item: HistoryItem) => void;
  isSelected?: boolean;
}) {
  const navigating  = useRef(false);
  const detailHref  = `/lender/bookings/${item.bookingId}`;
  const statusLabel = HOST_STATUS_LABEL[item.status] ?? item.status;
  const statusColor = STATUS_COLOR[item.status] ?? 'bg-surface-page text-muted';
  const amountText  = hostAmountDisplay(item);
  const kind        = historyItemKind(item);
  const cfg         = KIND_ICON[kind];
  const isTerminal  = ['cancelled', 'no_show', 'auto_reject'].includes(item.status);

  function handleRowClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (navigating.current) { e.preventDefault(); return; }
    navigating.current = true;
  }

  const rowClass = cn(
    'flex items-center gap-3 px-4 py-3.5 tap-light w-full text-left transition-colors',
    isSelected && 'bg-green-soft/60',
  );

  const inner = (
    <>
      <div className={cn('size-10 rounded-2xl grid place-items-center shrink-0', cfg.bg)}>
        {cfg.icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold tracking-wider uppercase text-muted leading-none mb-0.5">
          {sessionEyebrow(item)}
        </p>
        <p className="text-sm font-semibold text-ink truncate">{item.chargerTitle}</p>
        <p className="text-xs text-muted truncate">
          {item.counterpartyName
            ? `Guest: ${item.counterpartyName} \u00B7 ${fmtDate(item.scheduledStart)}`
            : fmtDate(item.scheduledStart)}
        </p>
        {item.lifecycleReason && isTerminal && (
          <p className="text-[10px] text-muted/60 truncate">{item.lifecycleReason}</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        {amountText ? (
          <p className="text-xs font-semibold text-green">{amountText}</p>
        ) : (
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', statusColor)}>
            {statusLabel}
          </span>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-muted mt-0.5" aria-hidden />
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(item)} className={rowClass}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={detailHref} className={rowClass} onClick={handleRowClick}>
      {inner}
    </Link>
  );
}
