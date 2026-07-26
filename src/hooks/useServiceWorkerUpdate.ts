'use client';

import { useState, useEffect } from 'react';

interface ServiceWorkerUpdate {
  hasUpdate: boolean;
  updateNow: () => void;
}

export function useServiceWorkerUpdate(): ServiceWorkerUpdate {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

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

      // Case 1b: a new SW started installing BEFORE the hook mounted — the
      // inline register() call in layout.tsx can trigger an automatic update
      // check, and if the install completes before React hydrates we would miss
      // the updatefound event entirely. Attach statechange to catch the
      // waiting transition if it hasn't happened yet.
      if (reg.installing) {
        onInstalling(reg.installing);
      }

      // Case 2: a new SW begins installing while the app is open.
      reg.addEventListener('updatefound', () => {
        if (reg.installing) onInstalling(reg.installing);
      });

      // Explicit check on mount — browsers normally check on navigation, but
      // users who leave the PWA open all day would otherwise never be notified.
      reg.update().catch(() => { /* network may be offline; ignore */ });

      // Re-check when the user returns to the app from another tab or app.
      // Important for PWA: long background gaps can mean a deployment has
      // landed since the user last interacted.
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

  function updateNow() {
    if (!waitingWorker) return;

    // Reload as soon as the new SW takes control (fires after skipWaiting activates it).
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    }, { once: true });

    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }

  return { hasUpdate: !!waitingWorker, updateNow };
}
