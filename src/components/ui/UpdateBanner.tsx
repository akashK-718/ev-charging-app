'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useServiceWorkerUpdate } from '@/hooks/useServiceWorkerUpdate';
import { cn } from '@/lib/utils';

/**
 * Non-blocking banner that appears when a new service worker version has
 * downloaded and is waiting to activate.
 *
 * Only renders in standalone (installed PWA) display mode. Browser-tab visits
 * are excluded — a browser tab gets fresh code on most navigations anyway, so
 * the banner would be noise. The installed-app case is the one that can run
 * stale for an extended period without a natural reload.
 *
 * "Update"      → triggers skipWaiting() on the waiting SW, then reloads once
 *                 the new SW takes control. Never reloads without this tap.
 * "Later"       → dismisses for the current session only (React state, no
 *                 localStorage). The banner reappears on the next fresh app open
 *                 if the update is still pending. This is intentionally different
 *                 from the permanent install-pwa nudge dismissal.
 *
 * Positioned above BottomNav (z-50 > nav z-40). On desktop (lg+) the bottom nav
 * is hidden so the banner sits at bottom-4 with no extra offset.
 */
export function UpdateBanner() {
  const { hasUpdate, updateNow } = useServiceWorkerUpdate();
  const [dismissed, setDismissed] = useState(false);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  if (!isStandalone || !hasUpdate || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        // Positioning: above BottomNav on mobile/tablet, near bottom on desktop
        'fixed inset-x-3 z-50',
        'bottom-[calc(4.5rem+env(safe-area-inset-bottom))]',
        'md:bottom-4 md:left-auto md:right-4 md:max-w-sm',
        // Card appearance — matches other surface-card patterns in the app
        'bg-surface-card border border-border rounded-xl',
        'shadow-[var(--shadow-float)]',
        // Rise-in animation (from globals.css)
        'rise-in',
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-soft">
          <RefreshCw className="h-3.5 w-3.5 text-green" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink leading-snug">
            Kirin update available
          </p>
          <p className="mt-0.5 text-[12px] text-muted leading-snug">
            Restart to get the latest.
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="h-[30px] rounded-[var(--radius)] px-3 text-[12px] font-semibold text-muted tap-opacity"
            >
              Later
            </button>
            <button
              type="button"
              onClick={updateNow}
              className="h-[30px] rounded-[var(--radius)] bg-green px-3 text-[12px] font-semibold text-white tap-medium"
            >
              Update
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
