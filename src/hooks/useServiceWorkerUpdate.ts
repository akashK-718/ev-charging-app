'use client';

import { useState, useEffect, useRef } from 'react';

export type UpdatePhase = 'idle' | 'updating' | 'ready' | 'failed';

interface ServiceWorkerUpdate {
  hasUpdate: boolean;
  phase: UpdatePhase;
  triggerUpdate: () => void;
}

const UPDATE_TIMEOUT_MS = 15_000;

export function useServiceWorkerUpdate(): ServiceWorkerUpdate {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onControllerChangeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    const cleanupFns: Array<() => void> = [];

    function onInstalling(worker: ServiceWorker) {
      worker.addEventListener('statechange', () => {
        // 'installed' + a controller means a previous version is still active —
        // this is a genuine update waiting to take over, not a first install.
        if (worker.state === 'installed' && navigator.serviceWorker.controller && !cancelled) {
          setWaitingWorker(worker);
        }
      });
    }

    navigator.serviceWorker.getRegistration('/sw.js').then(reg => {
      if (!reg || cancelled) return;

      // Case 1: a new SW is already waiting when the hook mounts — most common
      // scenario when the user reopens the app after a deployment landed.
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(reg.waiting);
        return;
      }

      // Case 1b: a new SW started installing BEFORE the hook mounted.
      if (reg.installing) onInstalling(reg.installing);

      // Case 2: a new SW begins installing while the app is open.
      reg.addEventListener('updatefound', () => {
        if (reg.installing) onInstalling(reg.installing);
      });

      // Explicit check on mount — users who leave the PWA open all day would
      // otherwise never be notified until the next navigation.
      reg.update().catch(() => {});

      // Re-check when the user returns from background — important for PWA.
      function onVisibilityChange() {
        if (document.visibilityState === 'visible' && !cancelled) {
          reg?.update().catch(() => {});
        }
      }
      document.addEventListener('visibilitychange', onVisibilityChange);
      cleanupFns.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));
    });

    return () => {
      cancelled = true;
      cleanupFns.forEach(fn => fn());
    };
  }, []);

  function triggerUpdate() {
    // Allow retry from 'failed'; guard against double-tap while already updating.
    if (!waitingWorker || (phase !== 'idle' && phase !== 'failed')) return;

    // Synchronous — the user sees immediate feedback before any async work.
    setPhase('updating');

    // Clean up any listener and timeout left over from a previous (failed) attempt.
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (onControllerChangeRef.current) {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChangeRef.current);
      onControllerChangeRef.current = null;
    }

    // When the new SW takes control: briefly show 'ready', then reload.
    function onControllerChange() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setPhase('ready');
      window.location.reload();
    }

    onControllerChangeRef.current = onControllerChange;
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true });

    // Failure timeout — if controllerchange hasn't fired after 15 s, give up
    // and let the user retry rather than being stuck on "Updating…" forever.
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setPhase(prev => (prev === 'updating' ? 'failed' : prev));
    }, UPDATE_TIMEOUT_MS);

    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }

  return { hasUpdate: !!waitingWorker, phase, triggerUpdate };
}
