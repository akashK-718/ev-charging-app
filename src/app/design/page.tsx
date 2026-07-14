'use client';

import { useEffect, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
type VerifyState = 'idle' | 'verifying' | 'verified';

// ── Helpers ──────────────────────────────────────────────────────────────────
function BlockHead({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-[26px] flex-wrap">
      <div className="flex flex-col gap-1.5">
        <span className="font-sans font-extrabold text-[11px] tracking-[.16em] uppercase text-muted">
          {eyebrow}
        </span>
        <h2 className="font-display font-bold text-[23px] tracking-[-0.01em] text-ink">{title}</h2>
      </div>
      <p className="text-[13.5px] text-muted max-w-[360px] md:text-right">{note}</p>
    </div>
  );
}

// ── Swatches data ────────────────────────────────────────────────────────────
const SWATCHES = [
  { name: 'ink',         hex: '#0c1611', style: { background: '#0c1611' } },
  { name: 'ink-soft',    hex: '#28332c', style: { background: '#28332c' } },
  { name: 'muted',       hex: '#6d7a72', style: { background: '#6d7a72' } },
  { name: 'volt',        hex: '#10d96a', style: { background: '#10d96a' } },
  { name: 'volt-deep',   hex: '#0a9e4c', style: { background: '#0a9e4c' } },
  { name: 'volt-soft',   hex: '#e4faee', style: { background: '#e4faee' } },
  { name: 'surface-0',   hex: '#ffffff', style: { background: '#ffffff', borderBottom: '1px solid #ebebeb' } },
  { name: 'surface-1',   hex: '#f5f6f5', style: { background: '#f5f6f5' } },
  { name: 'surface-2',   hex: '#ebebeb', style: { background: '#ebebeb' } },
  { name: 'danger',      hex: '#dc2626', style: { background: '#dc2626' } },
  { name: 'danger-soft', hex: '#fef2f2', style: { background: '#fef2f2' } },
];

// ── OTP input hook ───────────────────────────────────────────────────────────
function useOtp(len: number, initial: string[]) {
  const [digits, setDigits] = useState<string[]>(initial);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function onChange(i: number, val: string) {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < len - 1) refs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits];
      next[i - 1] = '';
      setDigits(next);
      refs.current[i - 1]?.focus();
    }
  }

  return { digits, refs, onChange, onKeyDown };
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function DesignPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const [verifyLabel, setVerifyLabel] = useState('Verify');
  const { digits, refs: otpRefs, onChange: otpChange, onKeyDown: otpKeyDown } = useOtp(4, ['4', '8', '', '']);
  const [resendSeconds, setResendSeconds] = useState(30);

  // Sheet body-scroll lock
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sheetOpen]);

  // Sheet ESC dismiss
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheetOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  // Resend countdown
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  // Verify state machine
  function runVerify() {
    if (verifyState !== 'idle') return;
    setVerifyState('verifying');
    setTimeout(() => {
      setVerifyState('verified');
      setVerifyLabel('Verified');
      setTimeout(() => {
        setVerifyState('idle');
        setVerifyLabel('Verify');
      }, 2200);
    }, 1400);
  }

  const verifyClass = [
    'mo-verify',
    verifyState === 'verifying' ? 'mo-verifying' : '',
    verifyState === 'verified'  ? 'mo-verified'  : '',
  ].join(' ').trim();

  return (
    <div className="min-h-screen font-sans" style={{ background: '#f5f6f5', color: '#0c1611' }}>

      {/* ── Floating pill nav ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 py-4" style={{ background: 'linear-gradient(#f5f6f5 60%, transparent)' }}>
        <div className="max-w-[1080px] mx-auto px-6 flex justify-between items-center bg-white rounded-pill px-5 py-[10px]"
          style={{ boxShadow: 'var(--shadow-float)', borderRadius: 'var(--radius-pill)', padding: '10px 10px 10px 20px' }}>
          <div className="flex items-center gap-[10px] font-display font-extrabold text-[18px]">
            <span className="w-7 h-7 rounded-full bg-volt flex items-center justify-center flex-none">
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M9 1 3 9h4l-1 6 7-9H8l1-5z" fill="#0c1611"/></svg>
            </span>
            BrandName
          </div>
          <a href="/chargers" className="font-bold text-[13.5px] bg-surface-1 px-[18px] py-[9px] rounded-pill hover:bg-surface-2 transition-colors"
            style={{ borderRadius: 'var(--radius-pill)' }}>
            Back to app
          </a>
        </div>
      </nav>

      <div className="max-w-[1080px] mx-auto px-6">

        {/* ── Intro ─────────────────────────────────────────────────────── */}
        <header className="py-14 pb-11">
          <span className="inline-flex items-center gap-[7px] font-sans font-extrabold text-[11.5px] tracking-[.14em] uppercase text-volt-deep bg-volt-soft rounded-pill px-[14px] py-[6px] mb-[18px]"
            style={{ borderRadius: 'var(--radius-pill)' }}>
            Design system
          </span>
          <h1 className="font-display font-extrabold text-[40px] leading-[1.08] tracking-[-0.02em] mb-3">Foundation</h1>
          <p className="text-[16.5px] text-muted max-w-[560px]">
            Tokens, primitives, and layout components for the EV Charging app. Typography and shape are carried over from the marketing site, colors are unchanged from the locked app tokens.
          </p>
        </header>

        {/* ── Color palette ─────────────────────────────────────────────── */}
        <section className="py-11 border-t border-surface-2" id="color">
          <BlockHead eyebrow="Foundation" title="Color palette" note="Ink for text, volt for action, surfaces for layering. Danger reserved for destructive states." />
          <div className="grid gap-[14px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {SWATCHES.map(s => (
              <div key={s.name} className="bg-white rounded-token overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="h-[74px]" style={s.style} />
                <div className="px-[14px] py-3">
                  <div className="font-bold text-[13.5px]">{s.name}</div>
                  <div className="text-[12px] text-muted font-mono">{s.hex}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Typography ────────────────────────────────────────────────── */}
        <section className="py-11 border-t border-surface-2" id="type">
          <BlockHead eyebrow="Foundation" title="Typography" note="Bricolage Grotesque 800 for display and headings, Manrope for everything functional." />
          <div className="bg-white rounded-token-lg px-7 py-2" style={{ boxShadow: 'var(--shadow-card)' }}>
            {[
              { sample: <span className="font-sans font-extrabold text-[11.5px] tracking-[.16em] uppercase text-muted">Eyebrow label</span>, tag: 'Manrope · 800 · 11.5px · uppercase' },
              { sample: <span className="font-display font-extrabold text-[32px] tracking-[-0.02em]">Display title</span>, tag: 'Bricolage Grotesque · 800 · 32px' },
              { sample: <span className="font-display font-bold text-[24px] tracking-[-0.01em]">Heading h1</span>, tag: 'Bricolage Grotesque · 700 · 24px' },
              { sample: <span className="font-display font-bold text-[20px] tracking-[-0.01em]">Heading h2</span>, tag: 'Bricolage Grotesque · 700 · 20px' },
              { sample: <p className="font-sans text-[16px] leading-[1.6] max-w-[460px]">Body text sits on Manrope at 16px with 1.6 line height, tuned for booking details and host descriptions that run a few lines long.</p>, tag: 'Manrope · 400 · 16px / 1.6' },
              { sample: <span className="font-sans font-semibold text-[14px] text-muted">Small label</span>, tag: 'Manrope · 600 · 14px · muted' },
              { sample: <span className="font-sans text-[12px] text-muted">XS meta text</span>, tag: 'Manrope · 400 · 12px · muted' },
            ].map(({ sample, tag }, i) => (
              <div key={i} className="flex items-baseline justify-between gap-6 py-[22px] border-b border-surface-2 last:border-b-0 flex-wrap">
                <div className="flex-1 min-w-[260px]">{sample}</div>
                <span className="text-[12px] font-bold text-muted font-mono whitespace-nowrap">{tag}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Buttons ───────────────────────────────────────────────────── */}
        <section className="py-11 border-t border-surface-2" id="buttons">
          <BlockHead eyebrow="Foundation" title="Buttons" note="Full pill radius, matching the marketing site's CTAs. Primary uses dark text on volt for reliable contrast." />
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {[
              { label: 'Primary',      el: <button className="btn-demo btn-demo-primary">Find a charger</button> },
              { label: 'Secondary',    el: <button className="btn-demo btn-demo-secondary">Earn with your charger</button> },
              { label: 'Ghost',        el: <button className="btn-demo btn-demo-ghost">Cancel</button> },
              { label: 'Danger',       el: <button className="btn-demo btn-demo-danger">Remove charger</button> },
              { label: 'Primary sm',   el: <button className="btn-demo btn-demo-primary btn-demo-sm">Book slot</button> },
              { label: 'Secondary sm', el: <button className="btn-demo btn-demo-secondary btn-demo-sm">Edit</button> },
              { label: 'Ghost sm',     el: <button className="btn-demo btn-demo-ghost btn-demo-sm">Skip</button> },
              { label: 'Danger sm',    el: <button className="btn-demo btn-demo-danger btn-demo-sm">Delete</button> },
              { label: 'Loading',      el: <button className="btn-demo btn-demo-primary" disabled><span className="btn-spinner" />Booking…</button> },
              { label: 'Disabled',     el: <button className="btn-demo btn-demo-primary" disabled>Find a charger</button> },
            ].map(({ label, el }) => (
              <div key={label} className="bg-white rounded-token p-[22px] flex flex-col items-start gap-[14px]" style={{ boxShadow: 'var(--shadow-card)' }}>
                <span className="text-[12px] font-bold text-muted tracking-[.02em]">{label}</span>
                {el}
              </div>
            ))}
            {/* Full width — spans all columns */}
            <div className="bg-white rounded-token p-[22px] flex flex-col items-start gap-[14px]" style={{ gridColumn: '1 / -1', boxShadow: 'var(--shadow-card)' }}>
              <span className="text-[12px] font-bold text-muted tracking-[.02em]">Full width primary</span>
              <button className="btn-demo btn-demo-primary w-full justify-center">Confirm booking</button>
            </div>
          </div>
        </section>

        {/* ── Motion & interactive states ───────────────────────────────── */}
        <section className="py-11 border-t border-surface-2" id="motion">
          <BlockHead eyebrow="Foundation" title="Motion & interactive states" note="Timing and mechanics kept as found, recolored and reshaped to the tokens above." />

          <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>

            {/* Three-body spinner */}
            <div className="bg-white rounded-token p-[22px] flex flex-col justify-between gap-5 min-h-[112px]" style={{ boxShadow: 'var(--shadow-card)' }}>
              <span className="text-[12px] font-bold text-muted tracking-[.02em]">Loading spinner</span>
              <div className="flex items-center gap-[10px]">
                <div className="mo-three-body">
                  <div className="mo-three-body__dot" />
                  <div className="mo-three-body__dot" />
                  <div className="mo-three-body__dot" />
                </div>
              </div>
            </div>

            {/* Loading button */}
            <div className="bg-white rounded-token p-[22px] flex flex-col justify-between gap-5 min-h-[112px]" style={{ boxShadow: 'var(--shadow-card)' }}>
              <span className="text-[12px] font-bold text-muted tracking-[.02em]">Loading button</span>
              <div className="flex items-center gap-[10px]">
                <button className="mo-loading-btn"><span className="mo-loading-ring" />Loading</button>
              </div>
            </div>

            {/* Skip */}
            <div className="bg-white rounded-token p-[22px] flex flex-col justify-between gap-5 min-h-[112px]" style={{ boxShadow: 'var(--shadow-card)' }}>
              <span className="text-[12px] font-bold text-muted tracking-[.02em]">Skip · hover to preview</span>
              <div className="flex items-center gap-[10px]">
                <button className="mo-skip">
                  Skip
                  <svg className="mo-skip-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>

            {/* Log out */}
            <div className="bg-white rounded-token p-[22px] flex flex-col justify-between gap-5 min-h-[112px]" style={{ boxShadow: 'var(--shadow-card)' }}>
              <span className="text-[12px] font-bold text-muted tracking-[.02em]">Log out · hover to preview</span>
              <div className="flex items-center gap-[10px]">
                <button className="mo-logout">
                  <span className="mo-logout-sign">
                    <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  </span>
                  <span className="mo-logout-text">Log out</span>
                </button>
              </div>
            </div>

            {/* Login */}
            <div className="bg-white rounded-token p-[22px] flex flex-col justify-between gap-5 min-h-[112px]" style={{ boxShadow: 'var(--shadow-card)' }}>
              <span className="text-[12px] font-bold text-muted tracking-[.02em]">Login · hover to preview</span>
              <div className="flex items-center gap-[10px]">
                <button className="mo-login">
                  <span className="mo-login-sign">
                    <svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  </span>
                  <span className="mo-login-text">Login</span>
                </button>
              </div>
            </div>

            {/* Pay now */}
            <div className="bg-white rounded-token p-[22px] flex flex-col justify-between gap-5 min-h-[112px]" style={{ boxShadow: 'var(--shadow-card)' }}>
              <span className="text-[12px] font-bold text-muted tracking-[.02em]">Pay now · hover then click</span>
              <div className="flex items-center gap-[10px]">
                <button className="mo-pay">
                  <span className="mo-pay-icon mo-pay-default">
                    <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M16 14h.01"/></svg>
                  </span>
                  <span className="mo-pay-icon mo-pay-card">
                    <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  </span>
                  <span className="mo-pay-icon mo-pay-bolt">
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13 2 5 12h5l-1 8 8-10h-5l1-8z"/></svg>
                  </span>
                  <span className="mo-pay-icon mo-pay-rupee">₹</span>
                  <span className="mo-pay-icon mo-pay-check">
                    <svg viewBox="0 0 24 24"><polyline points="4 12.5 9.5 18 20 6.5"/></svg>
                  </span>
                  <span>Pay now</span>
                </button>
              </div>
            </div>

            {/* Delete */}
            <div className="bg-white rounded-token p-[22px] flex flex-col justify-between gap-5 min-h-[112px]" style={{ boxShadow: 'var(--shadow-card)' }}>
              <span className="text-[12px] font-bold text-muted tracking-[.02em]">Delete · hover to preview</span>
              <div className="flex items-center gap-[10px]">
                <button className="mo-delete">
                  <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
              </div>
            </div>

            {/* Edit */}
            <div className="bg-white rounded-token p-[22px] flex flex-col justify-between gap-5 min-h-[112px]" style={{ boxShadow: 'var(--shadow-card)' }}>
              <span className="text-[12px] font-bold text-muted tracking-[.02em]">Edit · hover to preview</span>
              <div className="flex items-center gap-[10px]">
                <button className="mo-edit">
                  <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
              </div>
            </div>

            {/* Verify */}
            <div className="bg-white rounded-token p-[22px] flex flex-col justify-between gap-5 min-h-[112px]" style={{ boxShadow: 'var(--shadow-card)' }}>
              <span className="text-[12px] font-bold text-muted tracking-[.02em]">Verify · tap to run</span>
              <div className="flex items-center gap-[10px]">
                <button className={verifyClass} onClick={runVerify}>
                  <svg className="mo-shield" viewBox="0 0 24 24">
                    <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4-6.3 6.3z"/>
                  </svg>
                  <span className="mo-label">{verifyLabel}</span>
                  <span className="mo-ring-spin" />
                  <svg className="mo-check" viewBox="0 0 24 24"><path d="M4 12.5 9.5 18 20 6.5"/></svg>
                </button>
              </div>
            </div>

          </div>

          {/* OTP card */}
          <div className="flex justify-center py-1.5">
            <div className="w-[260px] bg-white rounded-token-lg flex flex-col items-center px-[26px] py-7 gap-4 relative" style={{ boxShadow: 'var(--shadow-float)' }}>
              <button className="absolute top-3 right-3 w-[26px] h-[26px] rounded-full bg-white grid place-items-center text-[15px] leading-none border-0 cursor-pointer" style={{ boxShadow: 'var(--shadow-card)' }} aria-label="Close">×</button>
              <span className="font-display font-bold text-[18px] text-center">Verify your number</span>
              <p className="font-sans text-[12.5px] text-muted leading-[1.55] text-center">Enter the 4-digit code sent to +91 98xxxxxx21</p>
              <div className="flex gap-[9px] justify-center">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    className="mo-otp-input"
                    maxLength={1}
                    inputMode="numeric"
                    value={d}
                    onChange={e => otpChange(i, e.target.value)}
                    onKeyDown={e => otpKeyDown(i, e)}
                  />
                ))}
              </div>
              <button className="w-full h-10 border-0 bg-volt text-ink font-sans font-bold text-[14.5px] cursor-pointer rounded-pill transition-transform hover:-translate-y-px" style={{ boxShadow: '0 8px 18px rgba(16,217,106,.32)', borderRadius: 'var(--radius-pill)' }}>
                Verify
              </button>
              <div className="font-sans text-[12.5px] text-muted flex flex-col items-center gap-1">
                <span>Did not get a code?</span>
                {resendSeconds > 0
                  ? <span>Resend in {resendSeconds}s</span>
                  : <button onClick={() => setResendSeconds(60)} className="border-0 bg-transparent text-volt-deep font-sans text-[13px] font-bold cursor-pointer">Resend</button>
                }
              </div>
            </div>
          </div>
        </section>

        {/* ── Cards ─────────────────────────────────────────────────────── */}
        <section className="py-11 border-t border-surface-2" id="cards">
          <BlockHead eyebrow="Foundation" title="Cards" note="The popover shape from the landing page, reused as the app's base surface." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px]">
            <div className="bg-white rounded-token-lg p-[26px]" style={{ boxShadow: 'var(--shadow-card)' }}>
              <h3 className="font-display font-bold text-[18px] mb-1.5">Card with default padding</h3>
              <p className="text-[14px] text-muted">Used for booking summaries, charger detail sections, and profile blocks.</p>
              <div className="mt-2.5 font-mono text-[12px] text-muted">bg-surface-0 · radius-lg · shadow-card</div>
            </div>
            <div className="bg-white rounded-token-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="px-[26px] py-[22px] border-b border-surface-2">
                <h3 className="font-display font-bold text-[18px] mb-1.5">Card without padding</h3>
                <p className="text-[14px] text-muted">Each row manages its own spacing, used for lists and stacked rows.</p>
              </div>
              <div className="px-[26px] py-[22px]">
                <p className="font-sans font-semibold text-[14px] text-muted">Second row, same card</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Spec grid ─────────────────────────────────────────────────── */}
        <section className="py-11 border-t border-surface-2" id="spec">
          <BlockHead eyebrow="Foundation" title="Spec grid" note="Charger detail facts, laid out as an even grid." />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-surface-2 rounded-token-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            {[
              { k: 'Connector', v: 'Type 2 AC' },
              { k: 'Max power', v: '7.4 kW' },
              { k: 'Rate',      v: '₹12/kWh' },
              { k: 'Parking',   v: 'Free' },
            ].map(({ k, v }) => (
              <div key={k} className="bg-white px-4 py-[18px]">
                <div className="font-sans font-extrabold text-[11.5px] tracking-[.08em] uppercase text-muted mb-1.5">{k}</div>
                <div className="font-display font-bold text-[17px]">{v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Info rows ─────────────────────────────────────────────────── */}
        <section className="py-11 border-t border-surface-2" id="info">
          <BlockHead eyebrow="Foundation" title="Info rows" note="Key–value pairs for detail and confirmation screens." />
          <div className="bg-white rounded-token-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            {[
              { k: 'Location',  v: 'Sector 15, Gurugram' },
              { k: 'Connector', v: 'Type 2 AC' },
              { k: 'Available', v: 'Mon–Fri, 6am–10pm' },
            ].map(({ k, v }) => (
              <div key={k} className="flex justify-between items-center px-[22px] py-4 border-b border-surface-2 last:border-b-0">
                <span className="text-[13.5px] text-muted font-semibold">{k}</span>
                <span className="text-[14.5px] font-bold">{v}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Avatars ───────────────────────────────────────────────────── */}
        <section className="py-11 border-t border-surface-2" id="avatars">
          <BlockHead eyebrow="Foundation" title="Avatars" note="Volt-soft fill with volt-deep initials, three sizes." />
          <div className="flex items-center gap-4">
            {[
              { size: 56, text: 18, label: 'lg' },
              { size: 42, text: 14.5, label: 'md' },
              { size: 30, text: 11, label: 'sm' },
            ].map(({ size, text, label }) => (
              <div key={label} className="rounded-full bg-volt-soft text-volt-deep grid place-items-center font-display font-bold flex-none"
                style={{ width: size, height: size, fontSize: text }}>
                AK
              </div>
            ))}
          </div>
        </section>

        {/* ── Skeletons ─────────────────────────────────────────────────── */}
        <section className="py-11 border-t border-surface-2" id="skeletons">
          <BlockHead eyebrow="Foundation" title="Skeletons" note="Loading state for cards while charger or booking data resolves." />
          <div className="bg-white rounded-token-lg p-[22px] flex gap-4 items-center" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="skel-demo rounded-full flex-none" style={{ width: 52, height: 52 }} />
            <div className="flex-1 flex flex-col gap-[9px]">
              <div className="skel-demo rounded-lg h-3" style={{ width: '60%' }} />
              <div className="skel-demo rounded-lg h-3" style={{ width: '90%' }} />
              <div className="skel-demo rounded-lg h-3" style={{ width: '40%' }} />
            </div>
          </div>
        </section>

        {/* ── Sheet ─────────────────────────────────────────────────────── */}
        <section className="py-11 border-t border-surface-2" id="sheet">
          <BlockHead eyebrow="Foundation" title="Sheet" note="Bottom sheet with backdrop dismiss, used for booking confirmation and filters." />
          <div className="flex items-center gap-[18px]">
            <button
              onClick={() => setSheetOpen(true)}
              className="btn-demo btn-demo-primary"
            >
              Open sheet
            </button>
          </div>
        </section>

        {/* ── Shadows & radius ──────────────────────────────────────────── */}
        <section className="py-11 border-t border-surface-2" id="shadows">
          <BlockHead eyebrow="Foundation" title="Shadows & radius" note="Two shadow levels, three radii, reused everywhere above." />
          <div className="grid gap-[18px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
            {[
              { box: { boxShadow: 'var(--shadow-card)' },  radius: {}, label: 'shadow-card' },
              { box: { boxShadow: 'var(--shadow-float)' }, radius: {}, label: 'shadow-float' },
              { box: { boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius-sm)' }, radius: {}, label: 'radius-sm · 10px' },
              { box: { boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius)' },    radius: {}, label: 'radius · 16px' },
              { box: { boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius-lg)' }, radius: {}, label: 'radius-lg · 20px' },
            ].map(({ box, label }) => (
              <div key={label} className="bg-white rounded-token px-[18px] py-[26px] text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="w-full h-14 bg-surface-1 mb-[14px]" style={box} />
                <div className="text-[12.5px] font-bold text-muted font-mono">{label}</div>
              </div>
            ))}
          </div>
        </section>

      </div>{/* /wrap */}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="pt-10 pb-16 px-6">
        <div className="max-w-[1080px] mx-auto">
          <div className="bg-white rounded-pill flex justify-between items-center px-[22px] py-[14px]" style={{ borderRadius: 'var(--radius-pill)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center gap-[9px] text-[13px] text-muted font-semibold">
              <span className="w-[22px] h-[22px] rounded-full bg-volt inline-grid place-items-center">
                <svg width="10" height="10" viewBox="0 0 16 16"><path d="M9 1 3 9h4l-1 6 7-9H8l1-5z" fill="#0c1611"/></svg>
              </span>
              © 2026 BrandName
            </div>
            <div className="flex gap-[22px] text-[13px] font-bold">
              {['Terms', 'Privacy', 'Contact'].map(l => (
                <a key={l} href="#" className="hover:text-volt-deep transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── Sheet modal ───────────────────────────────────────────────────── */}
      <div
        onClick={() => setSheetOpen(false)}
        className="fixed inset-0 z-[60] transition-opacity duration-[250ms]"
        style={{ background: 'rgba(12,22,17,.42)', opacity: sheetOpen ? 1 : 0, pointerEvents: sheetOpen ? 'auto' : 'none' }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheetTitle"
        className="fixed left-0 right-0 bottom-0 bg-white z-[61] px-[26px] pb-7 pt-[14px] max-w-[480px] mx-auto transition-transform duration-300"
        style={{
          borderRadius: '22px 22px 0 0',
          boxShadow: '0 -12px 40px rgba(12,22,17,.22)',
          transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)',
          transitionTimingFunction: 'cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div className="w-[38px] h-1 rounded-full bg-surface-2 mx-auto mb-[18px]" />
        <h3 id="sheetTitle" className="font-display font-bold text-[19px] mb-2">Confirm booking</h3>
        <p className="text-[14px] text-muted mb-5">Sharma's home charger · Sector 15, Gurugram · 6:00–7:00 PM</p>
        <button onClick={() => setSheetOpen(false)} className="btn-demo btn-demo-primary w-full justify-center">
          Confirm
        </button>
      </div>

      {/* ── Local button + skeleton styles ────────────────────────────────── */}
      <style>{`
        .btn-demo {
          font-family: var(--font-sans);
          font-weight: 700;
          font-size: 15px;
          padding: 13px 26px;
          border-radius: var(--radius-pill);
          cursor: pointer;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: transform .12s ease, box-shadow .12s ease, opacity .12s ease;
        }
        .btn-demo:hover { transform: translateY(-1px); }
        .btn-demo:active { transform: translateY(0); }
        .btn-demo:disabled { opacity: .4; cursor: not-allowed; transform: none; box-shadow: none !important; }
        .btn-demo-primary  { background: var(--volt); color: var(--ink); box-shadow: 0 8px 20px rgba(16,217,106,.32); }
        .btn-demo-secondary{ background: var(--surface-0); color: var(--ink); border: 1.5px solid var(--ink); }
        .btn-demo-ghost    { background: transparent; color: var(--ink); }
        .btn-demo-ghost:hover { background: var(--surface-1); }
        .btn-demo-danger   { background: var(--danger); color: #fff; box-shadow: 0 8px 20px rgba(220,38,38,.25); }
        .btn-demo-sm { padding: 9px 18px; font-size: 13.5px; }
        .btn-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(12,22,17,.25); border-top-color: var(--ink); animation: spin .7s linear infinite; display: inline-block; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .btn-spinner { animation: none; } }
        .skel-demo {
          background: linear-gradient(100deg, var(--surface-2) 30%, #f4f3ef 50%, var(--surface-2) 70%);
          background-size: 220% 100%;
          animation: shimmer2 1.6s ease-in-out infinite;
        }
        @keyframes shimmer2 { to { background-position: -120% 0; } }
        @media (prefers-reduced-motion: reduce) { .skel-demo { animation: none; background: var(--surface-2); } }
      `}</style>

    </div>
  );
}
