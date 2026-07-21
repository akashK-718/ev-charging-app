import Link from 'next/link';

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-10 bg-surface-card border-b border-border">
      <div className="max-w-5xl mx-auto px-4 md:px-10 flex justify-between items-center py-3 md:py-4">
        <div className="flex items-center">
          <img src="/brand/kirin-wordmark.svg" alt="Kirin" className="h-8 w-auto" />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="font-semibold text-sm text-ink px-3 py-2 rounded-token hover:bg-surface-page transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/login"
            className="font-semibold text-sm bg-ink text-white px-4 py-2 rounded-token hover:bg-ink-soft transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
