'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  /** Custom async refresh callback. If omitted, calls router.refresh(). */
  onRefresh?: () => Promise<void>;
}

// Logical pixels of downward travel required to trigger a refresh on release
const TRIGGER_PX = 72;

export function PullToRefresh({ onRefresh }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'pulling' | 'loading'>('idle');
  const [pullPct, setPullPct] = useState(0); // 0..100 — drives arc rotation during pull

  // Refs hold gesture state so event handlers don't capture stale closures
  const tracking   = useRef(false);
  const startY     = useRef(0);
  const startX     = useRef(0);
  const pullDist   = useRef(0);
  const phaseRef   = useRef<'idle' | 'pulling' | 'loading'>('idle');
  const inFlight   = useRef(false);

  const doRefresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    phaseRef.current = 'loading';
    setPhase('loading');
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        router.refresh();
        // Give the server component re-render time to settle before hiding indicator
        await new Promise<void>(r => setTimeout(r, 700));
      }
    } finally {
      inFlight.current = false;
      phaseRef.current = 'idle';
      setPhase('idle');
      setPullPct(0);
      pullDist.current = 0;
    }
  }, [onRefresh, router]);

  useEffect(() => {
    // Belt-and-suspenders: CSS property alone prevents browser PTR in most
    // Chromium browsers; preventDefault() in touchmove handles the rest.
    const prevOverscroll = document.body.style.overscrollBehaviorY;
    document.body.style.overscrollBehaviorY = 'none';

    function reset() {
      tracking.current = false;
      if (phaseRef.current === 'pulling') {
        phaseRef.current = 'idle';
        setPhase('idle');
        setPullPct(0);
        pullDist.current = 0;
      }
    }

    function onTouchStart(e: TouchEvent) {
      if (phaseRef.current !== 'idle') return;
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      pullDist.current = 0;
      tracking.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!tracking.current) return;

      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - startX.current;

      // Cancel if clearly horizontal (map pan, swipe navigation)
      if (Math.abs(dx) > Math.abs(dy) * 0.7 && Math.abs(dx) > 10) {
        reset();
        return;
      }

      if (dy <= 4) {
        if (dy < 0) reset();
        return;
      }

      // Intercept touch to prevent browser's native pull-to-refresh
      e.preventDefault();

      // Apply rubber-band damping beyond the trigger point
      const damped = dy > TRIGGER_PX
        ? TRIGGER_PX + (dy - TRIGGER_PX) * 0.25
        : dy;
      pullDist.current = damped;

      if (phaseRef.current !== 'pulling') {
        phaseRef.current = 'pulling';
        setPhase('pulling');
      }
      // Clamp at 100 so the arc "fills" at the trigger point, not beyond
      setPullPct(Math.min((dy / TRIGGER_PX) * 100, 100));
    }

    function onTouchEnd() {
      if (!tracking.current) return;
      tracking.current = false;
      if (phaseRef.current !== 'pulling') return;

      if (pullDist.current >= TRIGGER_PX) {
        void doRefresh();
      } else {
        phaseRef.current = 'idle';
        setPhase('idle');
        setPullPct(0);
        pullDist.current = 0;
      }
    }

    document.addEventListener('touchstart',  onTouchStart, { passive: true  });
    document.addEventListener('touchmove',   onTouchMove,  { passive: false });
    document.addEventListener('touchend',    onTouchEnd,   { passive: true  });
    document.addEventListener('touchcancel', onTouchEnd,   { passive: true  });

    return () => {
      document.body.style.overscrollBehaviorY = prevOverscroll;
      document.removeEventListener('touchstart',  onTouchStart);
      document.removeEventListener('touchmove',   onTouchMove);
      document.removeEventListener('touchend',    onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [doRefresh]);

  if (phase === 'idle') return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-1/2 z-50"
      style={{ top: 64, transform: 'translateX(-50%)' }}
    >
      {/* Pill backdrop keeps the spinner readable over any background */}
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-surface-card border border-border">
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: '2.5px solid var(--border)',
            borderTopColor: 'var(--copper)',
            // During pull: rotate proportionally to progress (0→360°)
            // During loading: CSS animation takes over
            transform: phase === 'pulling' ? `rotate(${pullPct * 3.6}deg)` : undefined,
            animation: phase === 'loading' ? 'spin 0.65s linear infinite' : undefined,
          }}
        />
      </div>
    </div>
  );
}
