'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { userKey, purgeLegacyKey } from '@/lib/user-storage';
import type { Tip } from '@/lib/home/tips';

const STORAGE_BASE = 'kirin:home:tip';
const WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

interface StoredTip {
  id: string;
  firstShown: number;
}

interface Props {
  userId: string;
  eligibleTips: Tip[];
}

/**
 * Class C — Evergreen tip with stable 6-hour rotation.
 *
 * Selection rules:
 *   1. Read `kirin:home:tip:{userId}` from localStorage.
 *   2. If stored tip is still in the eligible pool AND firstShown was < 6 h ago → keep showing it.
 *   3. Otherwise (tip ineligible, window elapsed, or nothing stored) → pick the next tip:
 *      - Exclude the just-shown tip if the pool has more than one option (avoids immediate repeats).
 *      - Select deterministically by dividing the current epoch into 6-hour windows.
 *   4. Persist { id, firstShown } and render.
 *
 * If the server passes an empty eligibleTips array (e.g. driver-only with no eligible pool),
 * this component renders nothing. That is the correct fallback — no tip beats a blank nudge.
 *
 * Class A and Class B preempt the whole Nudge zone on the server before this component is
 * even reached, so this component never needs to know about them.
 */
export function TipNudge({ userId, eligibleTips }: Props) {
  const [activeTip, setActiveTip] = useState<Tip | null>(null);

  // Use a stable string dep so the effect doesn't re-run on reference inequality
  // when the content of eligibleTips is unchanged across renders.
  const tipPoolKey = eligibleTips.map(t => t.id).join(',');

  useEffect(() => {
    if (eligibleTips.length === 0) return;

    purgeLegacyKey(STORAGE_BASE);
    const key = userKey(STORAGE_BASE, userId);

    // evaluate() runs the selection logic and returns the number of ms until
    // the current window expires (so the caller can schedule the next check).
    // This is extracted so it can be re-called by the timer without remounting.
    function evaluate(): number {
      let stored: StoredTip | null = null;
      try {
        const raw = localStorage.getItem(key);
        if (raw) stored = JSON.parse(raw) as StoredTip;
      } catch {}

      const now = Date.now();

      // Check whether the stored tip is still eligible and within the 6-hour window.
      if (stored) {
        const storedTip = eligibleTips.find(t => t.id === stored!.id);
        if (storedTip && now - stored.firstShown < WINDOW_MS) {
          // Still valid — keep showing it without touching storage.
          setActiveTip(storedTip);
          return WINDOW_MS - (now - stored.firstShown);
        }
      }

      // The window elapsed, the tip became ineligible, or there was nothing stored.
      // Pick the next tip, excluding the just-shown one when the pool has > 1 option.
      const excludeId = stored?.id;
      const candidates =
        eligibleTips.length > 1 && excludeId
          ? eligibleTips.filter(t => t.id !== excludeId)
          : eligibleTips;

      // Deterministic selection: rotate by 6-hour window index so the same tip
      // is always shown for a given window, not a new random one on each page load.
      const windowIdx = Math.floor(now / WINDOW_MS);
      const next = candidates[windowIdx % candidates.length];

      try {
        localStorage.setItem(key, JSON.stringify({ id: next.id, firstShown: now } satisfies StoredTip));
      } catch {}

      setActiveTip(next);
      return WINDOW_MS;
    }

    // Run immediately, then re-schedule at each window boundary so the tip
    // rotates even when the component stays mounted (PWA background, router
    // cache keeping the React tree alive across soft-navigations).
    let timer: ReturnType<typeof setTimeout>;
    function scheduleNext() {
      const msUntilExpiry = evaluate();
      timer = setTimeout(scheduleNext, msUntilExpiry);
    }
    scheduleNext();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tipPoolKey]);

  if (!activeTip) return null;

  return (
    <section aria-label="Suggestion">
      <div className="rise-in bg-white border border-border rounded-3xl px-4 py-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-surface-page grid place-items-center shrink-0">
            <BookOpen className="size-4 text-muted" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink-soft leading-relaxed">{activeTip.body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
