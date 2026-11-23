'use client';

import {
  DRIVER_STATUS_LABEL,
  HOST_STATUS_LABEL,
  STATUS_COLOR,
  driverAmountDisplay,
  fmtDate,
  fmtTime,
  hostAmountDisplay,
  sessionEyebrow,
} from '@/lib/activity/presentation';
import { cn } from '@/lib/utils';
import type { HistoryItem } from '@/types/activity';
import { ChevronRight, MapPin, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { SessionMapThumbnail } from './SessionMapThumbnail';

export function DriverFeaturedCard({ item }: { item: HistoryItem }) {
  const [mapImgError, setMapImgError] = useState(false);
  const detailHref   = `/bookings/${item.bookingId}`;
  const sessionHref  = `/bookings/${item.bookingId}/session`;
  const statusLabel = DRIVER_STATUS_LABEL[item.status] ?? item.status;
  const statusColor = STATUS_COLOR[item.status] ?? 'bg-surface-page text-muted';
  const amountText  = driverAmountDisplay(item);
  const showRate    = item.status === 'completed' && !item.hasRated;

  const isUpcoming     = ['pending', 'confirmed'].includes(item.status);
  const isReadyToStart = item.status === 'awaiting_driver_confirmation';
  const isInProgress   = item.status === 'in_progress' || item.status === 'awaiting_end_confirmation';
  const isCompleted    = item.status === 'completed';
  const isTerminal     = ['cancelled', 'no_show', 'auto_reject'].includes(item.status);

  const mapsUrl = item.chargerLat !== null && item.chargerLng !== null
    ? `https://www.google.com/maps/dir/?api=1&destination=${item.chargerLat},${item.chargerLng}`
    : null;

  // Session CTA targets the live session screen for active sessions
  const secondaryCtaHref =
    isReadyToStart || isInProgress ? sessionHref : detailHref;

  const secondaryCtaLabel =
    isReadyToStart ? 'Start session' :
    isInProgress   ? 'View session'  :
    isTerminal     ? 'View details'  : null;

  const ctaBtnClass = 'flex items-center justify-center h-11 w-full rounded-xl border border-border text-sm font-semibold text-ink bg-surface-card hover:bg-surface-page transition-colors';

  return (
    <div className="bg-surface-card border border-border rounded-3xl shadow-sm overflow-hidden">
      {!mapImgError && (
        <SessionMapThumbnail item={item} href={detailHref} onError={() => setMapImgError(true)} />
      )}
      {mapImgError && (
        <Link href={detailHref} className="block h-36 bg-surface-page overflow-hidden">
          {item.chargerPhoto
            ? <img src={item.chargerPhoto} alt="" className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
            : <div className="w-full h-full flex items-center justify-center"><MapPin className="w-8 h-8 text-muted/40" aria-hidden /></div>
          }
        </Link>
      )}

      <div className="px-4 pt-3.5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold tracking-wider uppercase text-muted">{sessionEyebrow(item)}</p>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusColor)}>
            {statusLabel}
          </span>
        </div>

        <Link href={detailHref} className="block">
          <p className="text-base font-semibold text-ink leading-snug">{item.chargerTitle}</p>
        </Link>

        {item.counterpartyName && (
          <p className="text-xs text-muted mt-0.5">Hosted by {item.counterpartyName}</p>
        )}

        <p className="text-xs text-muted mt-1">
          {fmtDate(item.scheduledStart)} at {fmtTime(item.scheduledStart)}
        </p>

        {item.lifecycleReason && isTerminal && (
          <p className="text-xs text-muted/70 mt-0.5">{item.lifecycleReason}</p>
        )}

        {amountText && (
          <p className="text-sm font-bold mt-1 text-ink">{amountText}</p>
        )}

        <div className="space-y-2 mt-3.5">
          {isCompleted ? (
            <div className="flex items-center gap-2">
              {showRate && (
                <Link href={detailHref} className="flex-1 flex items-center justify-center h-11 rounded-xl border border-border text-sm font-semibold text-ink bg-surface-card hover:bg-surface-page transition-colors">
                  Rate session
                </Link>
              )}
              <Link
                href={`/explore/${item.chargerId}`}
                className={cn(
                  'flex items-center justify-center gap-1.5 h-11 rounded-xl text-sm font-semibold bg-green text-white hover:bg-green-deep transition-colors',
                  showRate ? 'flex-1' : 'w-full',
                )}
              >
                <RotateCw className="w-3.5 h-3.5 shrink-0" aria-hidden />
                Book again
              </Link>
            </div>
          ) : isUpcoming ? (
            mapsUrl
              ? <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={ctaBtnClass}>Get directions</a>
              : <Link href={detailHref} className={ctaBtnClass}>View booking</Link>
          ) : secondaryCtaLabel ? (
            <Link href={secondaryCtaHref} className={ctaBtnClass}>{secondaryCtaLabel}</Link>
          ) : null}
          {!isTerminal && (
            <Link
              href={detailHref}
              className="flex items-center justify-center gap-1 py-0.5 w-full text-sm font-semibold text-muted hover:text-ink transition-colors"
            >
              View booking
              <ChevronRight className="w-3.5 h-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Host featured card ────────────────────────────────────────────────────────

export function HostFeaturedCard({ item }: { item: HistoryItem }) {
  const [mapImgError, setMapImgError] = useState(false);
  const detailHref  = `/lender/bookings/${item.bookingId}`;
  const statusLabel = HOST_STATUS_LABEL[item.status] ?? item.status;
  const statusColor = STATUS_COLOR[item.status] ?? 'bg-surface-page text-muted';
  const amountText  = hostAmountDisplay(item);
  const isTerminal  = ['cancelled', 'no_show', 'auto_reject'].includes(item.status);

  return (
    <div className="bg-surface-card border border-border rounded-3xl shadow-sm overflow-hidden">
      {!mapImgError && (
        <SessionMapThumbnail item={item} href={detailHref} onError={() => setMapImgError(true)} />
      )}
      {mapImgError && (
        <Link href={detailHref} className="block h-36 bg-surface-page overflow-hidden">
          {item.chargerPhoto
            ? <img src={item.chargerPhoto} alt="" className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
            : <div className="w-full h-full flex items-center justify-center"><MapPin className="w-8 h-8 text-muted/40" aria-hidden /></div>
          }
        </Link>
      )}

      <div className="px-4 pt-3.5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold tracking-wider uppercase text-muted">{sessionEyebrow(item)}</p>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusColor)}>
            {statusLabel}
          </span>
        </div>

        <Link href={detailHref} className="block">
          <p className="text-base font-semibold text-ink leading-snug">{item.chargerTitle}</p>
        </Link>

        {item.counterpartyName && (
          <p className="text-xs text-muted mt-0.5">Guest: {item.counterpartyName}</p>
        )}

        <p className="text-xs text-muted mt-1">
          {fmtDate(item.scheduledStart)} at {fmtTime(item.scheduledStart)}
        </p>

        {item.lifecycleReason && isTerminal && (
          <p className="text-xs text-muted/70 mt-0.5">{item.lifecycleReason}</p>
        )}

        {amountText && (
          <p className="text-sm font-bold mt-1 text-green">{amountText}</p>
        )}

        <div className="mt-3.5">
          <Link
            href={detailHref}
            className="flex items-center justify-center gap-1 h-9 w-full rounded-xl border border-border text-sm font-semibold text-ink bg-surface-card hover:bg-surface-page transition-colors"
          >
            View booking
            <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
