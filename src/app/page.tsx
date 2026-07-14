import Link from 'next/link';
import { Shield, Lock, Clock } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BrandName — Home EV Charging Network',
  description:
    'Find and book home EV chargers near you. A community-powered network: browse the map, pick a slot, and charge.',
};

// ── Step data ──────────────────────────────────────────────────────────────────

const STEPS = [
  {
    title: 'Find a charger nearby',
    desc: 'Browse verified home chargers on the map.',
    icon: (
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        <circle cx="22" cy="22" r="20" fill="#e7f2ec" />
        <path d="M22 10a8 8 0 0 1 8 8c0 6-8 14-8 14s-8-8-8-14a8 8 0 0 1 8-8z" fill="none" stroke="#124a30" strokeWidth="2.2" />
        <circle cx="22" cy="18" r="3" fill="#1c6b47" />
      </svg>
    ),
  },
  {
    title: 'Book a slot and pay',
    desc: 'Reserve your time, pay securely in-app.',
    icon: (
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        <circle cx="22" cy="22" r="20" fill="#e7f2ec" />
        <rect x="12" y="13" width="20" height="17" rx="2.5" fill="none" stroke="#124a30" strokeWidth="2.2" />
        <path d="M12 19h20M17 10v5M27 10v5" stroke="#124a30" strokeWidth="2.2" />
        <circle cx="22" cy="24.5" r="2.4" fill="#1c6b47" />
      </svg>
    ),
  },
  {
    title: 'Plug in and charge',
    desc: 'Show up, charge, and get back on the road.',
    icon: (
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        <circle cx="22" cy="22" r="20" fill="#e7f2ec" />
        <path d="M24.5 9 13 24h7.5L18 35l11.5-15H22l2.5-11z" fill="#1c6b47" stroke="#124a30" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
];

// ── SVG sub-components ─────────────────────────────────────────────────────────

function LogoPin({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2a11 11 0 0 1 11 11c0 8-11 17-11 17S5 21 5 13A11 11 0 0 1 16 2z" fill="#1c6b47" />
      <path d="M17.6 7 11 15.5h4.2L13.8 23l7.2-9.5h-4.2L17.6 7z" fill="#ffffff" />
    </svg>
  );
}

function WaypointPin() {
  return (
    <svg
      width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"
    >
      <path d="M16 2a11 11 0 0 1 11 11c0 8-11 17-11 17S5 21 5 13A11 11 0 0 1 16 2z" fill="#1a1f1c" />
      <circle cx="16" cy="13" r="4.5" fill="#fff" />
    </svg>
  );
}

function IndiaMap({ width }: { width: string }) {
  return (
    <svg viewBox="0 0 340 330" width={width} role="img" aria-label="Map of India with Delhi NCR marked">
      <path
        d="M96 22 L128 14 L150 26 L176 20 L198 36 L226 40 L240 60 L262 72 L256 96 L276 112 L268 134 L246 142 L238 166 L222 186 L212 214 L196 244 L182 274 L170 300 L160 312 L150 296 L142 268 L128 244 L112 226 L96 210 L84 188 L70 172 L58 150 L64 128 L52 110 L64 92 L58 70 L74 56 L84 38 Z"
        fill="#faf9f5" stroke="#1a1f1c" strokeWidth="2.5" strokeLinejoin="round"
      />
      <circle className="pulse-ring" cx="138" cy="108" r="7" fill="none" stroke="#1c6b47" strokeWidth="2.5" />
      <g transform="translate(124,80)">
        <path d="M14 0a12 12 0 0 1 12 12c0 9-12 19-12 19S2 21 2 12A12 12 0 0 1 14 0z" fill="#1c6b47" stroke="#fff" strokeWidth="2" />
        <path d="M16 5.5 9.5 14h4.3L12.4 21.5l7-9.5h-4.3L16 5.5z" fill="#ffffff" />
      </g>
      <circle cx="152" cy="118" r="4"   fill="#1c6b47" stroke="#fff" strokeWidth="1.5" />
      <circle cx="127" cy="119" r="3.5" fill="#1c6b47" stroke="#fff" strokeWidth="1.5" />
      <circle cx="148" cy="98"  r="3"   fill="#1c6b47" stroke="#fff" strokeWidth="1.5" />
      <text x="170" y="98"  fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="13" fill="#1a1f1c">Delhi NCR</text>
      <text x="170" y="114" fontFamily="system-ui, sans-serif" fontSize="11"  fill="#6b7269">Live now</text>
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      {/* Fixed map-texture background: block fill + park blobs */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          backgroundColor: '#ece8da',
          backgroundImage: [
            'radial-gradient(200px 130px at 10% 20%, #cfe4c4 0 60%, transparent 61%)',
            'radial-gradient(220px 140px at 88% 70%, #cfe4c4 0 60%, transparent 61%)',
            'radial-gradient(170px 110px at 30% 88%, #cfe4c4 0 60%, transparent 61%)',
          ].join(','),
        }}
      />
      {/* Fixed street-grid overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: [
            'linear-gradient(transparent 84px, #fbfaf5 84px, #fbfaf5 102px, transparent 102px)',
            'linear-gradient(90deg, transparent 84px, #fbfaf5 84px, #fbfaf5 102px, transparent 102px)',
          ].join(','),
          backgroundSize: '190px 190px, 190px 190px',
          opacity: 0.9,
        }}
      />

      {/* Page content, sits above the fixed background */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── NAV ──────────────────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-10 bg-surface-card border-b border-border">
          <div className="max-w-5xl mx-auto px-4 md:px-10 flex justify-between items-center py-3 md:py-4">
            <div className="flex items-center gap-2">
              <LogoPin size={24} />
              <span className="font-sans font-bold text-base md:text-[17px] text-ink leading-none">
                BrandName
              </span>
            </div>
            <Link
              href="/login"
              className="font-semibold text-sm bg-ink text-white px-4 py-2 rounded-token hover:bg-ink-soft transition-colors"
            >
              Log in
            </Link>
          </div>
        </nav>

        {/* ── Main content container ────────────────────────────────────────── */}
        <div className="relative max-w-5xl mx-auto px-4 md:px-10">

          {/* Desktop centre route line — z:-1 keeps it behind all cards */}
          <div
            className="hidden md:block absolute left-1/2 inset-y-0 pointer-events-none"
            aria-hidden="true"
            style={{ borderLeft: '3px dashed #1c6b47', opacity: 0.35, zIndex: -1 }}
          />

          {/* ── HERO ─────────────────────────────────────────────────────── */}
          <div className="pt-6 md:grid md:grid-cols-2 md:gap-11 md:items-center md:py-16">

            {/* Hero card */}
            <div className="bg-surface-card border border-border rounded-token-lg p-6 md:p-10 mb-4 md:mb-0">

              {/* Eyebrow chip */}
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase text-green-deep bg-green-soft rounded-pill px-3 py-1.5 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
                You are here
              </span>

              {/* Headline */}
              <h1 className="font-sans font-bold text-[28px] md:text-[44px] text-ink leading-[1.08] tracking-tight mb-3 md:mb-4">
                Charge your EV at a{' '}
                <em className="not-italic text-green-deep relative">
                  neighbour&apos;s home.
                  <span
                    className="hidden md:block absolute left-0 right-0"
                    aria-hidden="true"
                    style={{ bottom: 2, borderBottom: '2px dashed #1c6b47', opacity: 0.5 }}
                  />
                </em>
              </h1>

              {/* Subhead — no em dash */}
              <p className="text-sm md:text-[16px] text-muted leading-relaxed mb-5 md:mb-7 md:max-w-md">
                A community-powered network of home EV chargers. Find one nearby,
                book a slot, charge, and pay. All in one app.
              </p>

              {/* CTAs */}
              <div className="flex flex-col md:flex-row gap-3 mb-5 md:mb-7">
                <Link
                  href="/login"
                  className="font-semibold text-[15px] px-5 py-3 rounded-token text-center bg-green text-white hover:bg-green-deep transition-colors"
                >
                  Find a charger
                </Link>
                <Link
                  href="/login?intent=lender"
                  className="font-semibold text-[15px] px-5 py-3 rounded-token text-center bg-surface-card text-ink border border-border hover:border-ink transition-colors"
                >
                  Earn with your charger
                </Link>
              </div>

              {/* Trust list */}
              <ul className="flex flex-col gap-1.5">
                {['Verified hosts', 'Secure payments', 'Real-time booking'].map(label => (
                  <li key={label} className="flex items-center gap-2 text-[13px] text-muted">
                    <span className="text-green font-bold select-none">–</span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Neighbourhood map scene */}
            <div className="relative mb-2 md:mb-0">
              <svg
                viewBox="0 0 480 380"
                width="100%"
                role="img"
                aria-label="Neighbourhood map: house with EV charger and a route to a car nearby"
                style={{ display: 'block' }}
              >
                {/* Map card */}
                <rect x="10" y="10" width="460" height="360" rx="16" fill="#faf9f5" stroke="#e3e0d6" strokeWidth="2" />
                {/* Roads */}
                <path d="M10 250 H470" stroke="#fff" strokeWidth="30" />
                <path d="M150 10 V250" stroke="#fff" strokeWidth="26" />
                <path d="M20 250 H460" stroke="#e3e0d6" strokeWidth="2" strokeDasharray="12 12" />
                {/* Park blob */}
                <ellipse cx="390" cy="90" rx="70" ry="48" fill="#cfe4c4" />
                <circle cx="372" cy="82" r="9"  fill="#a8cfa0" />
                <circle cx="402" cy="98" r="11" fill="#a8cfa0" />
                <circle cx="418" cy="76" r="7"  fill="#a8cfa0" />
                {/* Host house lot */}
                <rect x="34" y="60" width="92" height="80" rx="8" fill="#e3e0d6" />
                <path d="M52 108 80 86 108 108 V 138 H 52 Z" fill="#fff" stroke="#1a1f1c" strokeWidth="3" strokeLinejoin="round" />
                <rect x="72" y="118" width="16" height="20" fill="#1a1f1c" />
                {/* Wall charger */}
                <rect x="112" y="108" width="14" height="22" rx="3" fill="#1c6b47" stroke="#124a30" strokeWidth="2" />
                <path d="M120 112l-4 6h3.4l-2 5 5-6h-3.4l1-5z" fill="#ffffff" />
                {/* Dashed route */}
                <path d="M120 150 C 120 210 200 232 240 250 C 300 276 330 264 352 258" fill="none" stroke="#1c6b47" strokeWidth="4" strokeDasharray="10 10" strokeLinecap="round" />
                {/* Car */}
                <g transform="translate(330,236)">
                  <path d="M6 22 h74 a8 8 0 0 0 8-8 v-3 a9 9 0 0 0-9-9 l-13-3 -13-13 h-28 l-11 15 h-4 a5 5 0 0 0-5 5 v9 a7 7 0 0 0 7 7 z" fill="#1a1f1c" />
                  <path d="M29 0 l-9 13 h20 l8-9 z" fill="#8fb4d6" transform="translate(8,1)" />
                  <circle cx="24" cy="24" r="9"   fill="#111a22" /><circle cx="24" cy="24" r="3.5" fill="#faf9f5" />
                  <circle cx="66" cy="24" r="9"   fill="#111a22" /><circle cx="66" cy="24" r="3.5" fill="#faf9f5" />
                </g>
                {/* Charger map pin */}
                <g transform="translate(62,18)">
                  <path d="M18 0a15 15 0 0 1 15 15c0 11-15 24-15 24S3 26 3 15A15 15 0 0 1 18 0z" fill="#1c6b47" stroke="#fff" strokeWidth="2.5" />
                  <path d="M20.4 7 12 18h5.4L15.6 27l9-12h-5.4L20.4 7z" fill="#ffffff" />
                </g>
                {/* Other neighbourhood charger dots */}
                <circle cx="300" cy="150" r="6" fill="#1c6b47" stroke="#fff" strokeWidth="2" />
                <circle cx="220" cy="90"  r="6" fill="#1c6b47" stroke="#fff" strokeWidth="2" />
                <circle cx="60"  cy="200" r="6" fill="#9aada4" stroke="#fff" strokeWidth="2" />
                {/* Building blocks */}
                <rect x="190" y="300" width="70" height="46" rx="6" fill="#e3e0d6" />
                <rect x="290" y="304" width="88" height="42" rx="6" fill="#e3e0d6" />
                <rect x="60"  y="296" width="90" height="50" rx="6" fill="#e3e0d6" />
              </svg>

              {/* Floating bubble — availability */}
              <div
                className="absolute bg-surface-card border border-border rounded-token px-3 py-2 text-[11px] font-bold flex items-center gap-1.5 animate-bob z-[2]"
                style={{ top: '6%', left: '44%' }}
              >
                <span className="w-2 h-2 rounded-full bg-green shrink-0" />
                Sharma&apos;s charger · Free now
              </div>

              {/* Floating bubble — power spec */}
              <div
                className="flex absolute bg-surface-card border border-border rounded-token px-3 py-2 text-[12.5px] font-bold items-center gap-2 animate-bob-delayed z-[2]"
                style={{ bottom: '14%', right: '2%' }}
              >
                ⚡ 7.4 kW · ₹ per slot
              </div>
            </div>
          </div>

          {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
          <section className="py-10 md:py-20">
            <div className="flex flex-col items-center mb-10 md:mb-11">
              <WaypointPin />
              <span className="font-mono text-[11px] md:text-xs font-semibold tracking-[0.1em] uppercase text-green mt-3.5">
                How it works
              </span>
              <h2 className="font-sans font-bold text-[24px] md:text-[34px] text-ink tracking-tight mt-2 text-center">
                Charging made simple
              </h2>
            </div>

            {/* Mobile: vertical stack with route connector */}
            <div className="md:hidden relative">
              <div
                className="absolute inset-y-0 pointer-events-none"
                aria-hidden="true"
                style={{ left: '20px', borderLeft: '3px dashed #1c6b47', opacity: 0.4 }}
              />
              <div className="space-y-5 pl-[44px]">
                {STEPS.map((step, i) => (
                  <div key={i} className="bg-surface-card border border-border rounded-token-lg p-[22px] relative landing-step">
                    <div className="flex items-center gap-3 mb-2">
                      {step.icon}
                      <div>
                        <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-green-deep bg-green-soft rounded-pill px-2.5 py-1 font-mono">
                          Stop {i + 1}
                        </span>
                        <h3 className="font-sans font-bold text-[17px] text-ink mt-1 leading-snug">{step.title}</h3>
                      </div>
                    </div>
                    <p className="text-[13.5px] text-muted leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: 3-column grid */}
            <div className="hidden md:grid grid-cols-3 gap-[24px]">
              {STEPS.map((step, i) => (
                <div key={i} className="bg-surface-card border border-border rounded-token-lg p-[28px] text-center">
                  <span className="inline-block text-[10px] font-bold tracking-[0.1em] uppercase text-green-deep bg-green-soft rounded-pill px-3 py-1 mb-[14px] font-mono">
                    Stop {i + 1}
                  </span>
                  <div className="flex justify-center mb-4">{step.icon}</div>
                  <h3 className="font-sans font-bold text-[18px] text-ink mb-2">{step.title}</h3>
                  <p className="text-[14.5px] text-muted leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── COVERAGE ─────────────────────────────────────────────────── */}
          <section className="pb-10 md:pb-20">
            <div className="flex flex-col items-center mb-8 md:mb-10">
              <WaypointPin />
              <span className="font-mono text-[11px] md:text-xs font-semibold tracking-[0.1em] uppercase text-green mt-3.5">
                Coverage
              </span>
            </div>

            {/* Coverage card */}
            <div className="bg-surface-card border border-border rounded-token-lg overflow-hidden">
              {/* Mobile */}
              <div className="md:hidden p-6 text-center">
                <h2 className="font-sans font-bold text-[24px] text-ink tracking-tight mb-2">
                  Built for India&apos;s roads
                </h2>
                {/* No em dash */}
                <p className="text-sm text-muted mb-5">Starting in Delhi NCR, expanding city by city.</p>
                <div className="flex justify-center">
                  <IndiaMap width="76%" />
                </div>
              </div>
              {/* Desktop: 2-column split */}
              <div className="hidden md:grid grid-cols-2">
                <div className="p-12 flex flex-col justify-center">
                  <h2 className="font-sans font-bold text-[34px] text-ink tracking-tight leading-tight mb-3">
                    Built for India&apos;s roads
                  </h2>
                  {/* No em dash */}
                  <p className="text-[16px] text-muted">Starting in Delhi NCR, expanding city by city.</p>
                </div>
                <div className="bg-surface-page p-9 grid place-items-center border-l border-border">
                  <IndiaMap width="88%" />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <footer className="pb-8 md:pb-10 px-4 md:px-10 max-w-5xl mx-auto">
          <div className="bg-surface-card border border-border rounded-token flex justify-between items-center px-5 py-3 md:px-6 md:py-4 flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs md:text-sm text-muted font-semibold">
              <LogoPin size={18} />
              &copy; 2026 BrandName
            </div>
            <div className="flex gap-4 md:gap-6 text-xs md:text-sm font-semibold text-ink-soft">
              <Link href="#" className="hover:text-green transition-colors">Terms</Link>
              <Link href="#" className="hover:text-green transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-green transition-colors">Contact</Link>
            </div>
          </div>
        </footer>

      </div>{/* /relative z-1 */}
    </>
  );
}
