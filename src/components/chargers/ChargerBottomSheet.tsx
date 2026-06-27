'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { X, Zap, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChargerRow } from './ChargerCard';

const CHARGER_TYPE_LABEL: Record<string, string> = {
  'AC_3.3kW': '3.3 kW · AC',
  'AC_7kW': '7 kW · AC',
  'AC_22kW': '22 kW · AC',
  'DC_fast': 'DC Fast',
};

interface ChargerBottomSheetProps {
  charger: ChargerRow | null;
  distanceKm?: number;
  onClose: () => void;
}

export function ChargerBottomSheet({ charger, distanceKm, onClose }: ChargerBottomSheetProps) {
  const isOpen = charger !== null;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop — mobile only, transparent so map stays interactive */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Mobile: compact bottom sheet (~120px content) */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl lg:hidden',
          'transition-transform duration-200 ease-out',
          isOpen ? 'translate-y-0' : 'translate-y-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={charger?.title ?? 'Charger preview'}
      >
        {charger && <MobileCard charger={charger} distanceKm={distanceKm} onClose={onClose} />}
      </div>

      {/* Desktop: right-side drawer with full details */}
      <div
        className={cn(
          'hidden lg:flex lg:flex-col fixed top-14 right-0 bottom-0 w-80 bg-white shadow-2xl z-50',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={charger?.title ?? 'Charger details'}
      >
        {charger && <DesktopDrawer charger={charger} distanceKm={distanceKm} onClose={onClose} />}
      </div>
    </>
  );
}

function MobileCard({
  charger,
  distanceKm,
  onClose,
}: {
  charger: ChargerRow;
  distanceKm?: number;
  onClose: () => void;
}) {
  const cover = charger.photos?.[0];
  const powerLabel = CHARGER_TYPE_LABEL[charger.charger_type] ?? charger.charger_type;
  const isActive = charger.status === 'active';

  const distLabel = distanceKm === undefined
    ? null
    : distanceKm < 1
      ? `${Math.round(distanceKm * 1000)} m away`
      : `${distanceKm.toFixed(1)} km away`;

  return (
    <div>
      {/* Drag handle + close */}
      <div className="flex items-center px-4 pt-3 pb-2">
        <div className="flex-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-muted" />
        </button>
      </div>

      {/* Tappable card — full area navigates to detail */}
      <Link href={`/chargers/${charger.id}`} className="flex items-center gap-3 px-4 pb-5">
        {/* Cover photo */}
        <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-volt-soft">
          {cover ? (
            <img src={cover} alt={charger.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Zap className="w-7 h-7 text-volt opacity-40" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-ink text-sm leading-snug line-clamp-2 flex-1">
              {charger.title}
            </p>
            <span className="flex items-center gap-1 shrink-0 mt-0.5">
              <span className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-volt' : 'bg-gray-400')} />
              <span className={cn('text-[10px] font-semibold', isActive ? 'text-volt-deep' : 'text-muted')}>
                {isActive ? 'Available' : 'Unavailable'}
              </span>
            </span>
          </div>

          <p className="text-xs text-muted mt-1">
            {powerLabel} · <span className="font-semibold text-ink">₹{charger.price_per_kwh}/kWh</span>
          </p>

          {distLabel && (
            <p className="text-xs text-muted mt-0.5">{distLabel}</p>
          )}

          <p className="text-xs font-semibold text-volt-deep mt-2">Tap for details →</p>
        </div>
      </Link>
    </div>
  );
}

function DesktopDrawer({
  charger,
  distanceKm,
  onClose,
}: {
  charger: ChargerRow;
  distanceKm?: number;
  onClose: () => void;
}) {
  const cover = charger.photos?.[0];
  const powerLabel = CHARGER_TYPE_LABEL[charger.charger_type] ?? charger.charger_type;
  const isActive = charger.status === 'active';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center px-4 pt-4 pb-2">
        <div className="w-10 h-1 rounded-full bg-gray-300 lg:hidden mx-auto" />
        <button
          onClick={onClose}
          className="ml-auto p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-muted" />
        </button>
      </div>

      {/* Cover photo */}
      <div className="mx-4 aspect-[16/9] rounded-xl overflow-hidden bg-volt-soft">
        {cover ? (
          <img src={cover} alt={charger.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Zap className="w-10 h-10 text-volt opacity-40" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="px-4 pt-3 pb-6 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-bold text-ink leading-snug flex-1">{charger.title}</h3>
          <div className="flex flex-col items-end gap-1">
            {charger.avg_rating !== null && (
              <div className="flex items-center gap-1 shrink-0">
                <Star className="w-3.5 h-3.5 text-volt fill-volt" />
                <span className="text-xs font-semibold text-ink">{Number(charger.avg_rating).toFixed(1)}</span>
              </div>
            )}
            <span className="flex items-center gap-1 shrink-0">
              <span className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-volt' : 'bg-gray-400')} />
              <span className={cn('text-[10px] font-semibold', isActive ? 'text-volt-deep' : 'text-muted')}>
                {isActive ? 'Available' : 'Unavailable'}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-muted">{powerLabel}</span>
          {distanceKm !== undefined && (
            <>
              <span className="text-gray-300 select-none">·</span>
              <span className="text-xs text-muted">
                {distanceKm < 1
                  ? `${Math.round(distanceKm * 1000)} m away`
                  : `${distanceKm.toFixed(1)} km away`}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mt-2">
          {charger.connector_types.map(ct => (
            <span key={ct} className="px-1.5 py-0.5 rounded-md bg-volt-soft text-ink text-[10px] font-semibold">
              {ct}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className="font-bold text-ink text-xl">₹{charger.price_per_kwh}/kWh</span>
          <Link
            href={`/chargers/${charger.id}`}
            className="px-4 py-2 rounded-xl bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-colors"
          >
            View details
          </Link>
        </div>
      </div>
    </div>
  );
}
