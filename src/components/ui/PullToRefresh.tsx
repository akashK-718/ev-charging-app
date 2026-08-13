'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  /**
   * Async data-refresh callback. If omitted, calls router.refresh() — correct
   * for RSC pages (Home, Activity, Profile) whose data lives in server components.
   *
   * Pull-to-refresh means "give me fresher data," not "reset this screen."
   * Callbacks must never clear or reset any UI state (tabs, filters, map position,
   * form values). Each page owns what its callback refetches; this component owns
   * all gesture, threshold, animation, and overscroll-suppression logic.
   */
  onRefresh?: () => Promise<void>;
}

// Raw finger travel (px) required to trigger a refresh.
// Resistance makes visual travel ~55 px at this point (TRIGGER_RAW_PX × RESISTANCE).
const TRIGGER_RAW_PX = 100;
const RESISTANCE      = 0.55; // visual_px = raw_px × RESISTANCE (unused beyond pullPct calc)
const COOLDOWN_MS     = 3_000; // min ms between network-hitting refreshes

// IDLE → PULLING → READY → REFRESHING → COMPLETING → IDLE
// PULLING → IDLE if released below threshold
type Phase = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'completing';

export function PullToRefresh({ onRefresh }: Props) {
  const router = useRouter();
  const [phase, setPhase]     = useState<Phase>('idle');
  const [pullPct, setPullPct] = useState(0); // 0..100, drives arc rotation during pull

  // Refs hold gesture + flight state so event handlers don't capture stale closures
  const tracking    = useRef(false);
  const startY      = useRef(0);
  const startX      = useRef(0);
  const phaseRef    = useRef<Phase>('idle');
  const inFlight    = useRef(false);
  const lastRefresh = useRef(0);

  const doRefresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current    = true;
    phaseRef.current    = 'refreshing';
    setPhase('refreshing');

    try {
      const now = Date.now();
      if (now - lastRefresh.current >= COOLDOWN_MS) {
        if (onRefresh) {
          await onRefresh();
        } else {
          // RSC pages: router.refresh() re-runs the server component tree and
          // delivers fresh data while preserving all client component state.
          router.refresh();
          // Allow the RSC round-trip to settle before dismissing the indicator.
          await new Promise<void>(r => setTimeout(r, 700));
        }
        lastRefresh.current = Date.now();
      } else {
        // Within cooldown window — visual feedback only, no network hit.
        await new Promise<void>(r => setTimeout(r, 380));
      }
    } finally {
      // Brief settle/complete animation before returning to idle.
      phaseRef.current = 'completing';
      setPhase('completing');
      await new Promise<void>(r => setTimeout(r, 380));

      inFlight.current = false;
      phaseRef.current = 'idle';
      setPhase('idle');
      setPullPct(0);
    }
  }, [onRefresh, router]);

  useEffect(() => {
    // Belt-and-suspenders on top of the static `overscroll-behavior: none`
    // already set on html, body in globals.css — covers inline-style overrides.
    const prevOverscroll = document.body.style.overscrollBehaviorY;
    document.body.style.overscrollBehaviorY = 'none';

    function reset() {
      tracking.current = false;
      if (phaseRef.current === 'pulling' || phaseRef.current === 'ready') {
        phaseRef.current = 'idle';
        setPhase('idle');
        setPullPct(0);
      }
    }

    function isInteractiveOrigin(target: EventTarget | null): boolean {
      if (!(target instanceof Element)) return false;
      // Skip maps (Mapbox canvas), form inputs, range sliders, carousels,
      // and any element explicitly opting out with data-no-ptr.
      return !!target.closest(
        'canvas, input, textarea, select, [role="slider"], [data-no-ptr]',
      );
    }

    function onTouchStart(e: TouchEvent) {
      if (phaseRef.current !== 'idle') return;
      if (window.scrollY > 0) return;
      if (isInteractiveOrigin(e.target)) return;
      startY.current   = e.touches[0].clientY;
      startX.current   = e.touches[0].clientX;
      tracking.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!tracking.current) return;

      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - startX.current;

      // Cancel on predominantly horizontal gesture (map pan, carousel, swipe-nav).
      if (Math.abs(dx) > Math.abs(dy) * 0.7 && Math.abs(dx) > 10) {
        reset();
        return;
      }

      if (dy <= 4) {
        if (dy < 0) reset();
        return;
      }

      // Block native browser pull-to-refresh at the gesture level.
      e.preventDefault();

      // Resistance: visual travel is meaningfully less than raw finger travel.
      // pullPct drives the arc (clamped at 100 so arc "fills" at threshold).
      const pct = Math.min((dy / TRIGGER_RAW_PX) * 100, 100);
      setPullPct(pct);

      const nextPhase: Phase = dy >= TRIGGER_RAW_PX ? 'ready' : 'pulling';
      if (phaseRef.current !== nextPhase) {
        phaseRef.current = nextPhase;
        setPhase(nextPhase);
      }
    }

    function onTouchEnd() {
      if (!tracking.current) return;
      tracking.current = false;

      if (phaseRef.current === 'ready') {
        void doRefresh();
      } else if (phaseRef.current === 'pulling') {
        // Released below threshold — snap back to idle.
        phaseRef.current = 'idle';
        setPhase('idle');
        setPullPct(0);
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

  const isReady      = phase === 'ready';
  const isSpinning   = phase === 'refreshing';
  const isCompleting = phase === 'completing';

  // Full green ring for ready/refreshing/completing; partial arc tracking pull for pulling.
  const ringBorderColor = (isReady || isSpinning || isCompleting)
    ? 'var(--green)'
    : 'var(--border)';

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-1/2 z-50"
      style={{
        top: 'calc(var(--screen-top-inset) + 12px)',
        transform: 'translateX(-50%)',
      }}
    >
      {/* Pill backdrop keeps the indicator readable over any background color */}
      <div
        className="flex items-center justify-center w-9 h-9 rounded-full bg-surface-card border border-border"
        style={{
          transform: isReady ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.15s ease-out',
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: '2.5px solid',
            // Full ring (all sides green) in ready/refreshing/completing;
            // partial arc (top green only) that tracks pull progress during pulling.
            borderColor: ringBorderColor,
            borderTopColor: 'var(--green)',
            transform: isSpinning
              ? undefined
              : `rotate(${isCompleting ? 360 : pullPct * 3.6}deg)`,
            animation: isSpinning
              ? 'spin 0.65s linear infinite'
              : isCompleting
              ? 'ptr-complete 0.38s ease-out forwards'
              : undefined,
          }}
        />
      </div>
    </div>
  );
}
