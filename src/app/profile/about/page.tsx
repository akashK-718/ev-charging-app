import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';

const APP_VERSION = '0.1.0';

export default function AboutKirinPage() {
  return (
    <main className="max-w-lg mx-auto px-4 pt-12 pb-16">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/profile"
          className="size-9 rounded-xl bg-surface-page grid place-items-center hover:bg-green-soft transition-colors"
          aria-label="Back to profile"
        >
          <ArrowLeft className="w-4 h-4 text-ink" />
        </Link>
        <h1 className="text-xl font-bold text-ink">About Kirin</h1>
      </div>

      <div className="space-y-6">
        {/* App identity */}
        <div className="bg-white border border-border rounded-3xl p-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="size-14 rounded-2xl bg-green grid place-items-center shrink-0">
              <span className="text-white font-bold text-2xl leading-none">K</span>
            </div>
            <div>
              <p className="text-lg font-bold text-ink">Kirin</p>
              <p className="text-sm text-muted">EV Charging Network</p>
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted">Version</span>
              <span className="text-sm font-semibold text-ink">{APP_VERSION}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted">Build</span>
              <span className="text-xs font-mono text-muted">0.1.0-dev</span>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="bg-white border border-border rounded-3xl overflow-hidden divide-y divide-border">
          {/* Release notes — future scope */}
          <div className="flex items-center justify-between px-5 py-3.5 opacity-40 cursor-not-allowed">
            <span className="text-sm font-medium text-ink">Release notes</span>
            <span className="text-xs text-muted">Coming soon</span>
          </div>
          <Link
            href="/help"
            className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-page transition-colors"
          >
            <span className="text-sm font-medium text-ink">Contact us</span>
            <ExternalLink className="size-4 text-muted" />
          </Link>
        </div>

        {/* Legal */}
        <div className="bg-white border border-border rounded-3xl overflow-hidden divide-y divide-border">
          <Link
            href="/terms"
            className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-page transition-colors"
          >
            <span className="text-sm font-medium text-ink">Terms of service</span>
            <ExternalLink className="size-4 text-muted" />
          </Link>
          {/* Privacy policy — no /privacy page yet, placeholder */}
          <div className="flex items-center justify-between px-5 py-3.5 opacity-40 cursor-not-allowed">
            <span className="text-sm font-medium text-ink">Privacy policy</span>
            <span className="text-xs text-muted">Coming soon</span>
          </div>
        </div>

        {/* Copyright */}
        <p className="text-center text-xs text-muted leading-relaxed">
          © {new Date().getFullYear()} Kirin EV Charging. All rights reserved.
        </p>
      </div>
    </main>
  );
}
