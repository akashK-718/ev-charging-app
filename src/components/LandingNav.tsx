import Link from 'next/link';

function LogoPin({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2a11 11 0 0 1 11 11c0 8-11 17-11 17S5 21 5 13A11 11 0 0 1 16 2z" fill="#1c6b47" />
      <path d="M17.6 7 11 15.5h4.2L13.8 23l7.2-9.5h-4.2L17.6 7z" fill="#ffffff" />
    </svg>
  );
}

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-10 bg-surface-card border-b border-border">
      <div className="max-w-5xl mx-auto px-4 md:px-10 flex justify-between items-center py-3 md:py-4">
        <div className="flex items-center gap-2">
          <LogoPin size={24} />
          <span className="font-sans font-bold text-base md:text-[17px] text-ink leading-none">
            BrandName
          </span>
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
