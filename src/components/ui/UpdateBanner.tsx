'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useServiceWorkerUpdate } from '@/hooks/useServiceWorkerUpdate';
import { cn } from '@/lib/utils';

/**
 * Non-blocking banner that appears when a new service worker version has
 * downloaded and is waiting to activate.
 *
 * "Update now"  → triggers skipWaiting() on the waiting SW, then reloads once
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

  if (!hasUpdate || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        // Positioning: above BottomNav on mobile, near bottom on desktop
        'fixed inset-x-3 z-50',
        'bottom-[calc(4.5rem+env(safe-area-inset-bottom))]',
        'lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm',
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
            Update available
          </p>
          <p className="mt-0.5 text-[12px] text-muted leading-snug">
            A new version of Kirin is ready.
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={updateNow}
              className="h-[30px] rounded-[var(--radius)] bg-green px-3 text-[12px] font-semibold text-white tap-medium"
            >
              Update now
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="h-[30px] rounded-[var(--radius)] px-3 text-[12px] font-semibold text-muted tap-opacity"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
