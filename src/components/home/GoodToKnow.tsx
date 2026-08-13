'use client';

import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
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
 * Class C — Evergreen "Good to know" tip with stable 6-hour rotation.
 *
 * Evaluated completely independently of the Nudge zone — renders whenever an
 * eligible tip exists, regardless of whether Nudge is also showing a card.
 *
 * Selection rules:
 *   1. Read `kirin:home:tip:{userId}` from localStorage.
 *   2. If stored tip is still in the eligible pool AND firstShown was < 6 h ago → keep showing it.
 *   3. Otherwise → pick the next tip, excluding the just-shown one when pool > 1.
 *   4. Persist { id, firstShown } and render.
 *
 * A setTimeout reschedules evaluate() at each window boundary so the tip
 * rotates even when the component stays mounted (PWA background, router cache).
 */
export function GoodToKnow({ userId, eligibleTips }: Props) {
  const [activeTip, setActiveTip] = useState<Tip | null>(null);

  const tipPoolKey = eligibleTips.map(t => t.id).join(',');

  useEffect(() => {
    if (eligibleTips.length === 0) return;

    purgeLegacyKey(STORAGE_BASE);
    const key = userKey(STORAGE_BASE, userId);

    function evaluate(): number {
      let stored: StoredTip | null = null;
      try {
        const raw = localStorage.getItem(key);
        if (raw) stored = JSON.parse(raw) as StoredTip;
      } catch {}

      const now = Date.now();

      if (stored) {
        const storedTip = eligibleTips.find(t => t.id === stored!.id);
        if (storedTip && now - stored.firstShown < WINDOW_MS) {
          setActiveTip(storedTip);
          return WINDOW_MS - (now - stored.firstShown);
        }
      }

      const excludeId = stored?.id;
      const candidates =
        eligibleTips.length > 1 && excludeId
          ? eligibleTips.filter(t => t.id !== excludeId)
          : eligibleTips;

      const windowIdx = Math.floor(now / WINDOW_MS);
      const next = candidates[windowIdx % candidates.length];

      try {
        localStorage.setItem(key, JSON.stringify({ id: next.id, firstShown: now } satisfies StoredTip));
      } catch {}

      setActiveTip(next);
      return WINDOW_MS;
    }

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
    <section aria-label="Good to know">
      <div className="rise-in bg-white border border-border rounded-3xl px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-xl bg-surface-page grid place-items-center shrink-0">
            <Lightbulb className="size-3.5 text-muted" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Good to know</p>
            <p className="text-sm text-ink-soft leading-relaxed">{activeTip.body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
