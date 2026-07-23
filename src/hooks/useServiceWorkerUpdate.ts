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

      // Case 1: a new SW is already in waiting state when the hook mounts.
      // This happens when the user reopens the app after a deployment landed.
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(reg.waiting);
        return;
      }

      // Case 2: a new SW begins installing while the app is open.
      reg.addEventListener('updatefound', () => {
        if (reg.installing) onInstalling(reg.installing);
      });

      // Trigger an explicit check — browsers normally check on navigation, but
      // users who leave the PWA open all day would otherwise never be notified.
      reg.update().catch(() => { /* network may be offline; ignore */ });
    });

    return () => { cancelled = true; };
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
