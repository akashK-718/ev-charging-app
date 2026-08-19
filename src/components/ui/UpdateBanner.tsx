'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useServiceWorkerUpdate } from '@/hooks/useServiceWorkerUpdate';
import { cn } from '@/lib/utils';

/**
 * Non-blocking banner that appears when a new service worker version has
 * downloaded and is waiting to activate.
 *
 * Only renders in standalone (installed PWA) display mode — browser-tab visits
 * are excluded since a browser tab gets fresh code on most navigations anyway.
 *
 * State machine: idle → updating → ready → (reload) | failed → idle (retry)
 *
 * "Update" / "Try again" → triggerUpdate(): synchronously enters 'updating',
 *   both buttons disabled; transitions to 'ready' on controllerchange then
 *   reloads; or to 'failed' after 15 s if controllerchange never fires.
 * "Later" → session-only dismiss (React state, no localStorage). Intentionally
 *   different from the permanent install-pwa nudge dismissal.
 */
export function UpdateBanner() {
  const { hasUpdate, phase, triggerUpdate } = useServiceWorkerUpdate();
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
  }, []);

  if (!isStandalone || !hasUpdate || dismissed) return null;

  const isUpdating = phase === 'updating' || phase === 'ready';
  const isFailed   = phase === 'failed';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-x-3 z-50',
        'bottom-[calc(4.5rem+env(safe-area-inset-bottom))]',
        'md:bottom-4 md:left-auto md:right-4 md:max-w-sm',
        'bg-surface-card border border-border rounded-xl',
        'shadow-[var(--shadow-float)]',
        'rise-in',
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-soft">
          <RefreshCw
            className={cn('h-3.5 w-3.5 text-green', isUpdating && 'animate-spin')}
            aria-hidden
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink leading-snug">
            {isFailed ? 'Update failed' : isUpdating ? 'Updating Kirin…' : 'Kirin update available'}
          </p>
          <p className="mt-0.5 text-[12px] text-muted leading-snug">
            {isFailed
              ? 'Check your connection and try again.'
              : isUpdating
              ? 'Getting the latest version.'
              : 'Restart to get the latest.'}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            {/* Later — disabled while update is in flight; still works in idle + failed */}
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => setDismissed(true)}
              className={cn(
                'h-[30px] rounded-[var(--radius)] px-3 text-[12px] font-semibold text-muted',
                isUpdating ? 'opacity-40 cursor-not-allowed' : 'tap-opacity',
              )}
            >
              Later
            </button>

            {/* Update / Updating… / Try again — fixed min-width prevents layout shift */}
            <button
              type="button"
              disabled={isUpdating}
              onClick={triggerUpdate}
              className={cn(
                'h-[30px] min-w-[4.5rem] flex items-center justify-center',
                'rounded-[var(--radius)] bg-green px-3 text-[12px] font-semibold text-white',
                isUpdating ? 'opacity-75 cursor-not-allowed' : 'tap-medium',
              )}
            >
              {isUpdating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Updating" />
              ) : isFailed ? (
                'Try again'
              ) : (
                'Update'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
