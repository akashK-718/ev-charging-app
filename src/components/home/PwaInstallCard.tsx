'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Share } from 'lucide-react';
import { readPwaDismissal, writePwaDismissal } from '@/lib/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' } | void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Phase = 'pending' | 'install-chromium' | 'install-ios' | 'hidden';

export function PwaInstallCard() {
  const [phase, setPhase] = useState<Phase>('pending');
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    ) {
      setPhase('hidden');
      return;
    }

    const dismissal = readPwaDismissal();
    if (dismissal?.mode === 'never') { setPhase('hidden'); return; }
    if (dismissal?.mode === 'later' && Date.now() < dismissal.until) { setPhase('hidden'); return; }

    const ua = navigator.userAgent;
    const isIos    = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios|edgios/i.test(ua);
    if (isIos && isSafari) {
      setPhase('install-ios');
      return;
    }

    const w = window as Window & { __pwaPrompt?: BeforeInstallPromptEvent | null };
    if (w.__pwaPrompt) {
      promptRef.current = w.__pwaPrompt;
      setPhase('install-chromium');
      return;
    }

    // beforeinstallprompt fires asynchronously — Chrome checks engagement heuristics
    // and installability criteria after page load, often 1-3 seconds in. No timeout:
    // 'pending' already renders null, so the card is invisible until the event arrives.
    // If the event never fires (already installed, browser doesn't support it, etc.)
    // the card simply stays hidden — which is correct, not an error state.
    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      w.__pwaPrompt = e as BeforeInstallPromptEvent;
      setPhase('install-chromium');
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  async function handleInstall() {
    const w = window as Window & { __pwaPrompt?: BeforeInstallPromptEvent | null };
    if (!promptRef.current && w.__pwaPrompt) {
      promptRef.current = w.__pwaPrompt;
    }
    const p = promptRef.current;
    if (!p) return;
    try {
      p.prompt();
      const { outcome } = await p.userChoice;
      if (outcome === 'accepted') writePwaDismissal('never');
    } catch {
      // prompt() throws when the event is stale (already installed, navigated away, etc.)
    } finally {
      promptRef.current = null;
      w.__pwaPrompt = null;
      setPhase('hidden');
    }
  }

  function handleLater() { writePwaDismissal('later'); setPhase('hidden'); }
  function handleNever() { writePwaDismissal('never'); setPhase('hidden'); }

  if (phase === 'pending' || phase === 'hidden') return null;

  if (phase === 'install-chromium') {
    return (
      <div className="rise-in bg-white border border-border rounded-3xl px-4 py-4 shadow-sm">
        <div className="flex items-start gap-3 mb-3">
          <div className="size-9 rounded-xl bg-green-soft grid place-items-center shrink-0">
            <Download className="size-4 text-green" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-ink">Install the app</p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Add Kirin to your home screen for faster access while travelling.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => void handleInstall()}
            className="h-9 px-4 bg-green text-white text-xs font-semibold rounded-full active:scale-95 transition-transform"
          >
            Install app
          </button>
          <button onClick={handleLater} className="text-xs text-muted active:opacity-70 transition-opacity">
            Remind me later
          </button>
          <button onClick={handleNever} className="text-xs text-muted active:opacity-70 transition-opacity">
            Don&apos;t show again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rise-in bg-white border border-border rounded-3xl px-4 py-4 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <div className="size-9 rounded-xl bg-green-soft grid place-items-center shrink-0">
          <Share className="size-4 text-green" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-ink">Add to home screen</p>
          <p className="text-xs text-muted mt-0.5 leading-relaxed">
            Install Kirin for faster access while travelling.
          </p>
        </div>
      </div>
      <ol className="text-xs text-muted space-y-1.5 mb-3 pl-0.5">
        <li>
          1. Tap the <span className="font-semibold text-ink">Share</span> icon{' '}
          <span aria-label="share icon" className="not-italic">⎋</span>{' '}
          at the bottom of Safari
        </li>
        <li>
          2. Scroll down and tap{' '}
          <span className="font-semibold text-ink">Add to Home Screen</span>, then tap{' '}
          <span className="font-semibold text-ink">Add</span>
        </li>
      </ol>
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={handleLater} className="text-xs text-muted active:opacity-70 transition-opacity">
          Remind me later
        </button>
        <button onClick={handleNever} className="text-xs text-muted active:opacity-70 transition-opacity">
          Don&apos;t show again
        </button>
      </div>
    </div>
  );
}
