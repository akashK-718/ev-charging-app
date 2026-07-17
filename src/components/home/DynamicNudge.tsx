'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, BookOpen, ChevronRight, Download, Share, TrendingDown } from 'lucide-react';
import { readPwaDismissal, writePwaDismissal } from '@/lib/pwa';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
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
    const p = promptRef.current;
    if (!p) return;
    await p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome === 'accepted') writePwaDismissal('never');
    promptRef.current = null;
    (window as Window & { __pwaPrompt?: null }).__pwaPrompt = null;
    setPhase('rule');
  }

  function handleLater() { writePwaDismissal('later'); setPhase('rule'); }
  function handleNever() { writePwaDismissal('never'); setPhase('rule'); }

  // ── Pending (checking eligibility) ─────────────────────────────────────────
  if (phase === 'pending') return null;

  // ── Chromium install card ──────────────────────────────────────────────────
  if (phase === 'install-chromium') {
    return (
      <section aria-label="Suggestion">
        <div className="bg-surface-card border border-border rounded-token-lg px-4 py-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-token bg-green-soft flex items-center justify-center shrink-0">
              <Download className="w-4 h-4 text-green" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">Install the app</p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                Add EV Charging to your home screen for faster access while travelling.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => void handleInstall()}
              className="px-4 py-2 bg-green text-white text-xs font-semibold rounded-token hover:bg-green-deep transition-colors"
            >
              Install app
            </button>
            <button onClick={handleLater} className="text-xs text-muted hover:text-ink-soft transition-colors">
              Remind me later
            </button>
            <button onClick={handleNever} className="text-xs text-muted hover:text-ink-soft transition-colors">
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
        <div className="bg-surface-card border border-border rounded-token-lg px-4 py-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-token bg-green-soft flex items-center justify-center shrink-0">
              <Share className="w-4 h-4 text-green" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">Add to home screen</p>
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
            <button onClick={handleLater} className="text-xs text-muted hover:text-ink-soft transition-colors">
              Remind me later
            </button>
            <button onClick={handleNever} className="text-xs text-muted hover:text-ink-soft transition-colors">
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
          className="flex items-start gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-4 hover:bg-surface-page transition-colors"
        >
          <div className="w-9 h-9 rounded-token bg-copper-soft flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 text-copper" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">Add more photos</p>
            <p className="text-xs text-muted">
              Listings with 5 or more photos receive more bookings.{' '}
              {ruleNudge.chargerTitle}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
        </Link>
      )}

      {ruleNudge.type === 'lower-price' && (
        <Link
          href={`/lender/chargers/${ruleNudge.chargerId}/edit`}
          className="flex items-start gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-4 hover:bg-surface-page transition-colors"
        >
          <div className="w-9 h-9 rounded-token bg-green-soft flex items-center justify-center shrink-0 mt-0.5">
            <TrendingDown className="w-4 h-4 text-green" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">No bookings in 30 days</p>
            <p className="text-xs text-muted">
              Adjusting your price may help attract bookings for {ruleNudge.chargerTitle}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
        </Link>
      )}

      {ruleNudge.type === 'hosting-discovery' && (
        <div className="bg-surface-card border border-border rounded-token-lg px-4 py-5">
          <p className="text-base font-semibold text-ink mb-1">
            Earn with your home charger.
          </p>
          <p className="text-sm text-muted mb-4">
            Share your charger when you&apos;re not using it. Set your own hours and earn extra income.
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 bg-surface-page text-ink text-sm font-semibold px-4 py-2.5 rounded-token border border-border hover:bg-border transition-colors"
          >
            Learn more
          </Link>
        </div>
      )}

      {ruleNudge.type === 'tip' && (
        <div className="bg-surface-card border border-border rounded-token-lg px-4 py-4">
          <div className="flex items-start gap-3">
            <BookOpen className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              {ruleNudge.title && (
                <p className="text-xs font-semibold text-muted mb-1">{ruleNudge.title}</p>
              )}
              <p className="text-sm text-ink-soft leading-relaxed">{ruleNudge.body}</p>
              {ruleNudge.linkHref && ruleNudge.linkLabel && (
                <Link
                  href={ruleNudge.linkHref}
                  className="inline-block mt-1.5 text-xs font-semibold text-copper hover:underline underline-offset-2"
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
