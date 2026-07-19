'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, BookOpen, ChevronRight, Download, Share, TrendingDown } from 'lucide-react';
import { readPwaDismissal, writePwaDismissal } from '@/lib/pwa';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' } | void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Serialisable nudge data passed from the server component
export type RuleNudge =
  | { type: 'photos';           chargerId: string; chargerTitle: string }
  | { type: 'lower-price';      chargerId: string; chargerTitle: string }
  | { type: 'hosting-discovery' }
  | { type: 'tip'; id: string; title?: string; body: string; linkLabel?: string; linkHref?: string }
  | null;

type Phase = 'pending' | 'install-chromium' | 'install-ios' | 'rule';

interface Props {
  ruleNudge: RuleNudge;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DynamicNudge({ ruleNudge }: Props) {
  const [phase, setPhase] = useState<Phase>('pending');
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already running as an installed PWA — never show the install card
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    ) {
      setPhase('rule');
      return;
    }

    // Check user's previous dismissal choice
    const dismissal = readPwaDismissal();
    if (dismissal?.mode === 'never') { setPhase('rule'); return; }
    if (dismissal?.mode === 'later' && Date.now() < dismissal.until) { setPhase('rule'); return; }

    // iOS Safari: no beforeinstallprompt — show manual Add to Home Screen instructions
    const ua = navigator.userAgent;
    const isIos    = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios|edgios/i.test(ua);
    if (isIos && isSafari) {
      setPhase('install-ios');
      return;
    }

    // Chromium: beforeinstallprompt captured in layout's inline script
    const w = window as Window & { __pwaPrompt?: BeforeInstallPromptEvent | null };
    if (w.__pwaPrompt) {
      promptRef.current = w.__pwaPrompt;
      setPhase('install-chromium');
      return;
    }

    // Event hasn't fired yet — listen in case it fires shortly after mount,
    // then fall through to rule nudge if it doesn't arrive within 300 ms.
    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      w.__pwaPrompt = e as BeforeInstallPromptEvent;
      clearTimeout(fallback);
      setPhase('install-chromium');
    };
    window.addEventListener('beforeinstallprompt', handler);
    const fallback = setTimeout(() => {
      window.removeEventListener('beforeinstallprompt', handler);
      setPhase('rule');
    }, 300);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(fallback);
    };
  }, []);

  async function handleInstall() {
    const w = window as Window & { __pwaPrompt?: BeforeInstallPromptEvent | null };
    // Re-capture in case the ref was lost between mount and click
    if (!promptRef.current && w.__pwaPrompt) {
      promptRef.current = w.__pwaPrompt;
    }
    const p = promptRef.current;
    if (!p) return;

    try {
      // Call prompt() without awaiting — then await userChoice for the outcome.
      // This pattern works across Chrome 68 (prompt returns void) through Chrome 120+
      // (prompt returns Promise<{outcome}>). Awaiting prompt() directly before
      // userChoice has been observed to silently fail when the event is stale.
      p.prompt();
      const { outcome } = await p.userChoice;
      if (outcome === 'accepted') writePwaDismissal('never');
    } catch {
      // prompt() throws when Chrome has suppressed the event (e.g. already installed,
      // or the event object is stale after a navigation). Fall through to rule nudge.
    } finally {
      promptRef.current = null;
      w.__pwaPrompt = null;
      setPhase('rule');
    }
  }

  function handleLater() { writePwaDismissal('later'); setPhase('rule'); }
  function handleNever() { writePwaDismissal('never'); setPhase('rule'); }

  // ── Pending (checking eligibility) ─────────────────────────────────────────
  if (phase === 'pending') return null;

  // ── Chromium install card ──────────────────────────────────────────────────
  if (phase === 'install-chromium') {
    return (
      <section aria-label="Suggestion">
        <div className="rise-in bg-white border border-border rounded-3xl px-4 py-4 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="size-9 rounded-xl bg-green-soft grid place-items-center shrink-0">
              <Download className="size-4 text-green" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink">Install the app</p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                Add EV Charging to your home screen for faster access while travelling.
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
      </section>
    );
  }

  // ── iOS manual instructions card ───────────────────────────────────────────
  if (phase === 'install-ios') {
    return (
      <section aria-label="Suggestion">
        <div className="rise-in bg-white border border-border rounded-3xl px-4 py-4 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="size-9 rounded-xl bg-green-soft grid place-items-center shrink-0">
              <Share className="size-4 text-green" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink">Add to home screen</p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                Install EV Charging for faster access while travelling.
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
      </section>
    );
  }

  // ── Rule nudge fallback ────────────────────────────────────────────────────
  if (!ruleNudge) return null;

  return (
    <section aria-label="Suggestion">
      {ruleNudge.type === 'photos' && (
        <Link
          href={`/lender/chargers/${ruleNudge.chargerId}/edit`}
          className="rise-in flex items-center gap-3 bg-white border border-border rounded-3xl px-4 py-4 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="size-9 rounded-xl bg-copper-soft grid place-items-center shrink-0">
            <AlertCircle className="size-4 text-copper" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-ink">Add more photos</p>
            <p className="text-xs text-muted">
              Listings with 5+ photos receive more bookings · {ruleNudge.chargerTitle}
            </p>
          </div>
          <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
        </Link>
      )}

      {ruleNudge.type === 'lower-price' && (
        <Link
          href={`/lender/chargers/${ruleNudge.chargerId}/edit`}
          className="rise-in flex items-center gap-3 bg-white border border-border rounded-3xl px-4 py-4 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="size-9 rounded-xl bg-green-soft grid place-items-center shrink-0">
            <TrendingDown className="size-4 text-green" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-ink">No bookings in 30 days</p>
            <p className="text-xs text-muted">
              Adjusting your price may help · {ruleNudge.chargerTitle}
            </p>
          </div>
          <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
        </Link>
      )}

      {ruleNudge.type === 'hosting-discovery' && (
        <div className="rise-in bg-white border border-border rounded-3xl px-4 py-5 shadow-sm">
          <p className="text-base font-bold text-ink mb-1">
            Earn with your home charger.
          </p>
          <p className="text-sm text-muted mb-4 leading-relaxed">
            Share your charger when you&apos;re not using it. Set your own hours and earn extra income.
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-surface-page border border-border text-ink text-sm font-semibold active:scale-95 transition-transform"
          >
            Learn more
          </Link>
        </div>
      )}

      {ruleNudge.type === 'tip' && (
        <div className="rise-in bg-white border border-border rounded-3xl px-4 py-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-surface-page grid place-items-center shrink-0">
              <BookOpen className="size-4 text-muted" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              {ruleNudge.title && (
                <p className="text-xs font-semibold text-muted mb-1 uppercase tracking-wide">{ruleNudge.title}</p>
              )}
              <p className="text-sm text-ink-soft leading-relaxed">{ruleNudge.body}</p>
              {ruleNudge.linkHref && ruleNudge.linkLabel && (
                <Link
                  href={ruleNudge.linkHref}
                  className="inline-block mt-2 text-xs font-semibold text-green underline underline-offset-2"
                >
                  {ruleNudge.linkLabel}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
