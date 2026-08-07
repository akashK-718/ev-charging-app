'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { BackButton, ContainedBackButton } from '@/components/ui/BackButton';

type PayState    = 'idle' | 'pending' | 'paid';
type DeleteState = 'idle' | 'armed'   | 'done';
type VerifyState = 'idle' | 'verifying' | 'verified';

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

// SVG helpers
function SvgCheck({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <polyline points="4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}

export default function DesignPage() {
  const [sheetOpen, setSheetOpen]       = useState(false);
  const [btnLoading, setBtnLoading]     = useState(false);
  const [payState, setPayState]         = useState<PayState>('idle');
  const [deleteState, setDeleteState]   = useState<DeleteState>('idle');
  const [deleteLabel, setDeleteLabel]   = useState('Remove charger');
  const [verifyState, setVerifyState]   = useState<VerifyState>('idle');
  const [otpVerify, setOtpVerify]       = useState<VerifyState>('idle');
  const [resendSeconds, setResendSeconds] = useState(30);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { digits, refs: otpRefs, onChange: otpChange, onKeyDown: otpKeyDown } =
    useOtp(6, ['4', '8', '2', '', '', '']);

  // Sheet scroll lock + ESC
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sheetOpen]);
  useEffect(() => {
    if (!sheetOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheetOpen(false); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [sheetOpen]);

  // Resend countdown
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  // Button loading demo
  function runBtnLoading() {
    setBtnLoading(true);
    setTimeout(() => setBtnLoading(false), 1500);
  }

  // Pay state machine
  function runPay() {
    if (payState !== 'idle') return;
    setPayState('pending');
    setTimeout(() => {
      setPayState('paid');
      setTimeout(() => setPayState('idle'), 2200);
    }, 1300);
  }

  // Delete two-step
  function runDelete() {
    if (deleteState === 'armed') {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      setDeleteState('done');
      setDeleteLabel('Removed');
      setTimeout(() => { setDeleteState('idle'); setDeleteLabel('Remove charger'); }, 2000);
      return;
    }
    if (deleteState === 'idle') {
      setDeleteState('armed');
      setDeleteLabel('Tap again to confirm');
      deleteTimer.current = setTimeout(() => {
        setDeleteState('idle');
        setDeleteLabel('Remove charger');
      }, 3000);
    }
  }

  // Verify state machine (motion cell)
  function runVerify() {
    if (verifyState !== 'idle') return;
    setVerifyState('verifying');
    setTimeout(() => {
      setVerifyState('verified');
      setTimeout(() => setVerifyState('idle'), 2200);
    }, 1300);
  }

  // Verify state machine (OTP card)
  function runOtpVerify() {
    if (otpVerify !== 'idle') return;
    setOtpVerify('verifying');
    setTimeout(() => {
      setOtpVerify('verified');
      setTimeout(() => setOtpVerify('idle'), 2200);
    }, 1300);
  }

  const payClass    = `mo-pay${payState !== 'idle' ? ' ' + payState : ''}`;
  const deleteClass = `mo-delete${deleteState !== 'idle' ? ' ' + deleteState : ''}`;
  const verifyClass = `mo-verify${verifyState !== 'idle' ? ' ' + verifyState : ''}`;
  const otpVClass   = `mo-verify mo-verify-full${otpVerify !== 'idle' ? ' ' + otpVerify : ''}`;

  return (
    <div style={{ background: 'var(--surface-page)', color: 'var(--ink-soft)', fontFamily: 'var(--font-sans)', lineHeight: 1.55 }}>

      {/* ── Nav: flat bar, border only, no shadow ──────────────────────────── */}
      <nav className="top">
        <div className="navrow">
          <div className="logo">
            <span className="logo-mark" />
            Kirin
          </div>
          <a className="navlink" href="/explore">Back to app</a>
        </div>
      </nav>

      <div className="wrap">

        {/* ── Intro ───────────────────────────────────────────────────────── */}
        <header className="intro">
          <div className="intro-kicker">DESIGN FOUNDATION / V3</div>
          <h1 className="pagetitle">Foundation</h1>
          <p>Reworked against the product's own guardrails: no pill-everything, no shadow-everything, no black and white with a neon accent because that's what every template does. Color, type, and shape below are grounded in what the product actually is, a charging network, not a generic SaaS surface.</p>
        </header>

        {/* ── 01 Color — treatment A ──────────────────────────────────────── */}
        <section className="block" id="color">
          <div className="head-a">
            <span className="num">01</span>
            <div>
              <h2>Color</h2>
              <p>Circuit green for action, copper for in-progress states, warm graphite instead of pure black.</p>
            </div>
          </div>
          <div className="swatches">
            {[
              { name: 'ink',          hex: '#1a1f1c', bg: '#1a1f1c' },
              { name: 'ink-soft',     hex: '#3a4139', bg: '#3a4139' },
              { name: 'muted',        hex: '#6b7269', bg: '#6b7269' },
              { name: 'green',        hex: '#1c6b47', bg: '#1c6b47' },
              { name: 'green-deep',   hex: '#124a30', bg: '#124a30' },
              { name: 'green-soft',   hex: '#e7f2ec', bg: '#e7f2ec' },
              { name: 'copper',       hex: '#b5642f', bg: '#b5642f' },
              { name: 'copper-soft',  hex: '#f9ece1', bg: '#f9ece1' },
              { name: 'danger',       hex: '#b3261e', bg: '#b3261e' },
              { name: 'border',       hex: '#e3e0d6', bg: '#e3e0d6' },
              { name: 'surface-page', hex: '#faf9f5', bg: '#faf9f5' },
              { name: 'surface-card', hex: '#ffffff',  bg: '#ffffff', border: true },
            ].map(s => (
              <div key={s.name} className="swatch">
                <div className="fill" style={{ background: s.bg, borderBottom: s.border ? '1px solid var(--border)' : undefined }} />
                <div className="meta">
                  <div className="name">{s.name}</div>
                  <div className="hex">{s.hex}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="palette-note">Copper signals in-progress states (a session mid-charge, a payment pending) and is never a second brand accent. Amber is used for action-needed states (booking requests awaiting approval). App canvas is barely-green off-white, not warm beige. Card borders are green-gray, not sandy.</p>
        </section>

        {/* ── 01b Semantic accents ────────────────────────────────────────── */}
        <section className="block" id="semantic">
          <div className="head-a">
            <span className="num">01b</span>
            <div>
              <h2>Semantic accents</h2>
              <p>Each accent maps to exactly one meaning. Never combine them or use them decoratively. Always pair a soft background with a saturated foreground of the same hue.</p>
            </div>
          </div>
          <div className="accent-grid">

            <div className="accent-cell">
              <span className="lbl">action needed / pending request</span>
              <div className="accent-amber-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="accent-avatar" style={{ background: '#fed7aa', color: '#c2410c' }}>JL</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Jordan Lee wants to charge</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Today, 5:30 to 7:30 PM</div>
                  </div>
                  <span className="accent-pill amber-pill">REQUEST</span>
                </div>
              </div>
              <p className="accent-rule">2 px <code>amber-300/70</code> card border, white bg. Amber-700 text and badge. Used for booking requests awaiting host response.</p>
            </div>

            <div className="accent-cell">
              <span className="lbl">available now</span>
              <div className="accent-demo">
                <span className="tag tag-status-live">
                  <svg className="filled" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>
                  Available now
                </span>
              </div>
              <p className="accent-rule">Green dot + green-700 text on white pill. Never use for non-availability states.</p>
            </div>

            <div className="accent-cell">
              <span className="lbl">in progress / waiting</span>
              <div className="accent-demo">
                <span className="tag tag-status-wait">
                  <svg className="filled" viewBox="0 0 24 24"><path d="M13 2 5 12h5l-1 8 8-10h-5l1-8z"/></svg>
                  Session in progress
                </span>
              </div>
              <p className="accent-rule">Copper background and text. Sessions mid-charge, payments pending. Not a second brand accent.</p>
            </div>

            <div className="accent-cell">
              <span className="lbl">host dashboard surfaces</span>
              <div className="accent-dark-card">
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: '#4ade80', marginBottom: 4 }}>HOSTING · TODAY</p>
                <p style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: 0 }}>$9.05</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>$41.20 this week</p>
              </div>
              <p className="accent-rule">Inverted: zinc-900 card, green-400 eyebrow and accents, white type. Makes the hosting context feel distinct without a mode switch.</p>
            </div>

          </div>
        </section>

        {/* ── 02 Typography — treatment A ─────────────────────────────────── */}
        <section className="block" id="type">
          <div className="head-a">
            <span className="num">02</span>
            <div>
              <h2>Typography</h2>
              <p>The device's own system font for reading, a monospace system font for anything that's actually data, a rate, a spec, a timestamp. No webfont load.</p>
            </div>
          </div>
          <div className="type-list">
            <div className="type-row">
              <div className="type-sample"><span className="t-label">Section label</span></div>
              <span className="type-tag">system mono · 500 · 11.5px</span>
            </div>
            <div className="type-row">
              <div className="type-sample"><span className="t-h1">Page heading</span></div>
              <span className="type-tag">system sans · 700 · 26px</span>
            </div>
            <div className="type-row">
              <div className="type-sample"><span className="t-h2">Section heading</span></div>
              <span className="type-tag">system sans · 700 · 20px</span>
            </div>
            <div className="type-row">
              <div className="type-sample">
                <p className="t-body">Body copy runs on the system sans stack at 15px. It reads plainly at length and renders in whatever the device already has installed, San Francisco, Roboto, Segoe UI, no extra load.</p>
              </div>
              <span className="type-tag">system sans · 400 · 15px</span>
            </div>
            <div className="type-row">
              <div className="type-sample"><span className="t-small">Small label</span></div>
              <span className="type-tag">system sans · 500 · 13.5px</span>
            </div>
            <div className="type-row">
              <div className="type-sample"><span className="t-data">7.4 kW · ₹12/kWh</span></div>
              <span className="type-tag">system mono · 600 · 14px, for data only</span>
            </div>
          </div>
        </section>

        {/* ── 02b Copy guardrails ─────────────────────────────────────────── */}
        <section className="block" id="copy">
          <div className="head-c">
            <span className="ctag">writing</span>
            <h2>Copy guardrails</h2>
          </div>
          <div className="copy-grid">
            <div className="copy-row">
              <span className="copy-avoid">No em dashes</span>
              <span className="copy-rule">Use a comma, a period, or rewrite the sentence. Never use — in UI copy.</span>
            </div>
            <div className="copy-row">
              <span className="copy-avoid">No ellipsis in headings or CTAs</span>
              <span className="copy-rule">Fine for truncated strings in code. Never as a stylistic choice in labels or buttons.</span>
            </div>
            <div className="copy-row">
              <span className="copy-avoid">No filler adverbs</span>
              <span className="copy-rule">Cut "simply", "easily", "just", "seamlessly". If the thing is easy, show it, do not say it.</span>
            </div>
            <div className="copy-row">
              <span className="copy-avoid">No hollow reassurance</span>
              <span className="copy-rule">"Your data is safe" without specifics is noise. Say what is actually kept or deleted.</span>
            </div>
            <div className="copy-row copy-row-last">
              <span className="copy-avoid">Case rules</span>
              <span className="copy-rule">UPPER CASE for eyebrows only (11px tracking-widest labels). Sentence case everywhere else, including section headings, button labels, and navigation items.</span>
            </div>
          </div>
        </section>

        {/* ── Buttons — treatment B ───────────────────────────────────────── */}
        <section className="block" id="buttons">
          <div className="head-b">
            <h2>Buttons</h2>
            <span>10px radius, not a pill. Pill is reserved for status chips below. Skip, Edit, Delete, and Loading have final treatments in Motion.</span>
          </div>
          <div className="btn-grid">
            <div className="btn-cell">
              <span className="lbl">primary</span>
              <button className="btn btn-primary">
                <svg viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.3"/></svg>
                Find a charger
              </button>
            </div>
            <div className="btn-cell">
              <span className="lbl">secondary</span>
              <button className="btn btn-secondary">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M9.5 10h5M9.5 14h3.5"/></svg>
                Earn with your charger
              </button>
            </div>
            <div className="btn-cell">
              <span className="lbl">text</span>
              <button className="btn btn-text">Cancel</button>
            </div>
            <div className="btn-cell">
              <span className="lbl">danger</span>
              <button className="btn btn-danger">
                <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                Remove charger
              </button>
            </div>
            <div className="btn-cell">
              <span className="lbl">copper, secondary action</span>
              <button className="btn btn-copper btn-sm">
                <svg className="filled" viewBox="0 0 24 24"><path d="M13 2 5 12h5l-1 8 8-10h-5l1-8z"/></svg>
                Session in progress
              </button>
            </div>
            <div className="btn-cell">
              <span className="lbl">disabled</span>
              <button className="btn btn-primary" disabled>
                <svg viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.3"/></svg>
                Find a charger
              </button>
            </div>
            <div className="btn-cell" style={{ gridColumn: '1 / -1' }}>
              <span className="lbl">inverse, on a dark band</span>
              <div className="notif-band" style={{ width: '100%' }}>
                <span>New chargers just went live in Sector 15, Gurugram</span>
                <button className="btn btn-inverse">View chargers</button>
              </div>
            </div>
            <div className="btn-cell" style={{ gridColumn: '1 / -1' }}>
              <span className="lbl">full width primary</span>
              <button className="btn btn-primary btn-full">
                <svg viewBox="0 0 24 24"><polyline points="4 12.5 9.5 18 20 6.5"/></svg>
                Confirm booking
              </button>
            </div>
          </div>
        </section>

        {/* ── Button component ────────────────────────────────────────────── */}
        <section className="block" id="button-component">
          <div className="head-c">
            <span className="ctag">component</span>
            <h2>Button component</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, maxWidth: 560, lineHeight: 1.6 }}>
            Import from <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--surface-page)', padding: '1px 4px', borderRadius: 4 }}>src/components/ui/Button.tsx</code>. Handles haptic, disabled state, and loading spinner automatically. Pass <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--surface-page)', padding: '1px 4px', borderRadius: 4 }}>{'loading'}</code> prop to show spinner; pass <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--surface-page)', padding: '1px 4px', borderRadius: 4 }}>{'w-full'}</code> to stretch to container width.
          </p>
          <div className="btn-grid">
            <div className="btn-cell">
              <span className="lbl">variant="primary" (default)</span>
              <Button>Find a charger</Button>
            </div>
            <div className="btn-cell">
              <span className="lbl">variant="secondary"</span>
              <Button variant="secondary">Earn with your charger</Button>
            </div>
            <div className="btn-cell">
              <span className="lbl">variant="ghost"</span>
              <Button variant="ghost">Cancel</Button>
            </div>
            <div className="btn-cell">
              <span className="lbl">variant="danger"</span>
              <Button variant="danger">Remove charger</Button>
            </div>
            <div className="btn-cell">
              <span className="lbl">disabled (any variant)</span>
              <Button disabled>Find a charger</Button>
            </div>
            <div className="btn-cell">
              <span className="lbl">loading — tap to demo</span>
              <Button loading={btnLoading} onClick={runBtnLoading}>
                {!btnLoading && 'Continue'}
              </Button>
            </div>
            <div className="btn-cell">
              <span className="lbl">size="sm"</span>
              <Button size="sm">Save changes</Button>
            </div>
            <div className="btn-cell" style={{ gridColumn: '1/-1' }}>
              <span className="lbl">full width (w-full className)</span>
              <Button className="w-full">Confirm booking</Button>
            </div>
          </div>
          <p className="palette-note">Haptic: primary/danger → medium (25ms). secondary/ghost → light (10ms). Loading disables the button and shows a Loader2 spinner. Use <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{'size="sm"'}</code> for secondary actions; md is the default.</p>
          <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--surface-page)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
              Rule — use <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>PrimaryButton</code> for every primary CTA
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>
              Import from <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>src/components/ui/PrimaryButton.tsx</code>.
              It enforces <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>variant=&quot;primary&quot;</code> and inherits the green glow shadow automatically — no one-off className overrides needed.
              A screen that rolls its own primary button styling is a bug: this recurred in the charger wizard, booking, KYC, session-controls, and rating flows before the consolidation PR (#226).
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--ink)' }}>Correct usage:</strong>{' '}
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{'<PrimaryButton size="lg" className="w-full" disabled={!valid}>Continue</PrimaryButton>'}</code>
              <br />
              <strong style={{ color: 'var(--ink)' }}>Stays secondary:</strong> Cancel, Back, Edit listing, ghost navigation buttons — anything that is not the primary forward action.
            </p>
          </div>
        </section>

        {/* ── Navigation controls ──────────────────────────────────────────── */}
        <section className="block" id="nav-controls">
          <div className="head-c">
            <span className="ctag">navigation</span>
            <h2>Navigation controls</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, maxWidth: 580, lineHeight: 1.6 }}>
            Choose the control based on what is behind it, not the screen name. There are three buckets — the rule is structural.
          </p>
          <div className="nav-ctrl-grid">
            <div className="nav-ctrl-cell">
              <span className="lbl">Bucket 1 — solid/light background</span>
              <div className="nav-ctrl-demo-light">
                <BackButton onClick={() => {}} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>BackButton</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>44dp transparent tap target, opacity-shift on press. No background, border, shadow, or scale. Use on: Notifications, Reviews, Help, Terms, About.</div>
                </div>
              </div>
            </div>
            <div className="nav-ctrl-cell">
              <span className="lbl">Bucket 2 — photo/map/variable background</span>
              <div className="nav-ctrl-demo-photo">
                <ContainedBackButton onClick={() => {}} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>ContainedBackButton</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>40dp white/90 circle, backdrop blur, shadow. Legible over any photo or map tile. Use on: charger detail hero, map editor.</div>
                </div>
              </div>
            </div>
            <div className="nav-ctrl-cell">
              <span className="lbl">Bucket 3 — modal / bottom sheet</span>
              <div className="nav-ctrl-demo-modal">
                <button className="modal-x-btn" aria-label="Close">
                  <svg viewBox="0 0 24 24" width={16} height={16} stroke="currentColor" strokeWidth={2} strokeLinecap="round" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>X dismiss button</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Never a back arrow inside a modal or sheet. Dismissing an overlay is not the same interaction as navigating back. The shared Sheet component handles this automatically.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PageHeader component ─────────────────────────────────────────── */}
        <section className="block" id="page-header">
          <div className="head-c">
            <span className="ctag">layout</span>
            <h2>PageHeader</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, maxWidth: 580, lineHeight: 1.6 }}>
            Every back-navigable screen must use <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-page)', padding: '1px 4px', borderRadius: 4 }}>PageHeader</code> — a one-off layout is a bug. It wraps <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-page)', padding: '1px 4px', borderRadius: 4 }}>BackButton</code> (Bucket 1) with a title and optional subtitle, with fixed self-contained spacing (<code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-page)', padding: '1px 4px', borderRadius: 4 }}>px-4 pt-12 pb-6</code>). Screens using ContainedBackButton (photo/map overlay) are explicitly excluded.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span className="lbl" style={{ marginBottom: 8, display: 'block' }}>Title only</span>
              <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '48px 16px 24px' }}>
                  <BackButton onClick={() => {}} />
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, margin: 0 }}>Payment Methods</h1>
                </div>
              </div>
            </div>
            <div>
              <span className="lbl" style={{ marginBottom: 8, display: 'block' }}>Title + subtitle</span>
              <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '48px 16px 24px' }}>
                  <BackButton onClick={() => {}} />
                  <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, margin: 0 }}>Notifications</h1>
                    <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4, marginBottom: 0 }}>Choose what you want to be notified about</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, background: 'var(--surface-page)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600, marginBottom: 6 }}>Props</p>
            <table style={{ fontSize: 12, color: 'var(--muted)', borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                <tr><td style={{ paddingBottom: 4, paddingRight: 16, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>title</td><td style={{ paddingBottom: 4, paddingRight: 16 }}>string</td><td style={{ paddingBottom: 4 }}>Required. Rendered as h1.</td></tr>
                <tr><td style={{ paddingBottom: 4, paddingRight: 16, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>subtitle</td><td style={{ paddingBottom: 4, paddingRight: 16 }}>string?</td><td style={{ paddingBottom: 4 }}>Optional. Rendered below title in muted text.</td></tr>
                <tr><td style={{ paddingBottom: 4, paddingRight: 16, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>href</td><td style={{ paddingBottom: 4, paddingRight: 16 }}>string?</td><td style={{ paddingBottom: 4 }}>Link destination for the back arrow. Use for static destinations (e.g. /profile).</td></tr>
                <tr><td style={{ paddingBottom: 4, paddingRight: 16, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>onClick</td><td style={{ paddingBottom: 4, paddingRight: 16 }}>() =&gt; void?</td><td style={{ paddingBottom: 4 }}>Click handler for back arrow. Use when destination is dynamic (e.g. router.back()).</td></tr>
                <tr><td style={{ paddingBottom: 4, paddingRight: 16, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>aria-label</td><td style={{ paddingBottom: 4, paddingRight: 16 }}>string?</td><td style={{ paddingBottom: 4 }}>Override accessible label on the back button. Defaults to &quot;Go back&quot;.</td></tr>
                <tr><td style={{ paddingRight: 16, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>className</td><td style={{ paddingRight: 16 }}>string?</td><td>Appended to the root div — for one-off spacing overrides only.</td></tr>
              </tbody>
            </table>
          </div>
          <p className="palette-note" style={{ marginTop: 14 }}>
            Source: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>src/components/ui/PageHeader.tsx</code>. Screens on solid/light backgrounds only — ContainedBackButton screens (charger detail hero, map editor, charger map) are Bucket 2 and excluded.
          </p>
        </section>

        {/* ── Tap feedback tiers ───────────────────────────────────────────── */}
        <section className="block" id="tap-feedback">
          <div className="head-c">
            <span className="ctag">interaction</span>
            <h2>Tap feedback tiers</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, maxWidth: 580, lineHeight: 1.6 }}>
            Every tap must produce visible feedback within ~100ms. Use CSS <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-page)', padding: '1px 4px', borderRadius: 4 }}>:active</code> — it fires within one frame, before any JS executes. Tap the elements below to see each tier.
          </p>
          <div className="tap-demo-grid">
            <div className="tap-demo-cell">
              <span className="lbl">tap-light · scale 0.98 · nav tabs, cards, chips, icon buttons</span>
              <div className="tap-swatch tap-light">Tap me</div>
            </div>
            <div className="tap-demo-cell">
              <span className="lbl">tap-medium · scale 0.96 · primary CTAs, dialog confirm</span>
              <div className="tap-swatch tap-medium">Tap me</div>
            </div>
            <div className="tap-demo-cell">
              <span className="lbl">tap-opacity · fade to 0.6 · back/dismiss/secondary text actions</span>
              <div className="tap-swatch tap-opacity">Tap me</div>
            </div>
          </div>
          <p className="palette-note" style={{ marginTop: 14 }}>All tap classes are suppressed under <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>prefers-reduced-motion: reduce</code>. The <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>Button</code> component applies tap-medium automatically for primary/danger and tap-light for secondary/ghost.</p>
        </section>

        {/* ── Tags & badges — treatment C ─────────────────────────────────── */}
        <section className="block" id="tags">
          <div className="head-c">
            <span className="ctag">status chips</span>
            <h2>Tags &amp; badges</h2>
          </div>
          <div className="tag-row">
            <span className="tag tag-status-live">
              <svg className="filled" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>
              Available now
            </span>
            <span className="tag tag-status-wait">
              <svg className="filled" viewBox="0 0 24 24"><path d="M13 2 5 12h5l-1 8 8-10h-5l1-8z"/></svg>
              Charging in progress
            </span>
            <span className="tag tag-outlined">
              <svg viewBox="0 0 24 24"><path d="M9 2v4M15 2v4M7 6h10v4a5 5 0 0 1-10 0V6z"/><path d="M12 15v4"/></svg>
              Type 2 AC
            </span>
            <span className="tag tag-outlined">
              <svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z"/><path d="M8.5 12.2 11 14.7l4.5-5"/></svg>
              Verified host
            </span>
            <span className="badge">NEW</span>
            <span className="badge">BETA</span>
          </div>
          <div className="trust-row" style={{ marginTop: 14 }}>
            <span className="trust-chip">
              <svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z"/><path d="M8.5 12.2 11 14.7l4.5-5"/></svg>
              Verified hosts
            </span>
            <span className="trust-chip">
              <svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
              Secure payments
            </span>
            <span className="trust-chip">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
              Real-time booking
            </span>
          </div>
        </section>

        {/* ── Activity tiles ──────────────────────────────────────────────── */}
        <section className="block" id="activity-tiles">
          <div className="head-c">
            <span className="ctag">activity feed</span>
            <h2>Kind-coded icon tiles</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, maxWidth: 560, lineHeight: 1.6 }}>
            Every activity item leads with a colored square tile. The color encodes the kind before the user reads the label. Never reuse a color for a different kind.
          </p>
          <div className="tile-row">
            {([
              { kind: 'Booking',  bg: '#eff6ff', color: '#2563eb', path: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
              { kind: 'Payment',  bg: '#f5f3ff', color: '#7c3aed', path: 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7zM2 11h20' },
              { kind: 'Payout',   bg: '#ecfdf5', color: '#059669', path: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
              { kind: 'Hosting',  bg: '#f0fdf4', color: '#16a34a', path: 'M13 2 5 12h5l-1 8 8-10h-5l1-8z' },
              { kind: 'Rating',   bg: '#fffbeb', color: '#d97706', path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
              { kind: 'Notice',   bg: '#f9fafb', color: '#6b7280', path: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8h.01M12 12v4' },
            ] as Array<{ kind: string; bg: string; color: string; path: string }>).map(t => (
              <div key={t.kind} className="tile-cell">
                <div className="tile-icon" style={{ background: t.bg }}>
                  <svg viewBox="0 0 24 24" width={18} height={18} stroke={t.color} fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d={t.path} />
                  </svg>
                </div>
                <span className="tile-label">{t.kind}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16 }}>
            Colors: booking blue-600, payment violet-700, payout emerald-600, hosting green-600, rating amber-600, notice gray-500.
          </p>
        </section>

        {/* ── Text input — treatment C ─────────────────────────────────────── */}
        <section className="block" id="input">
          <div className="head-c">
            <span className="ctag">form field</span>
            <h2>Text input</h2>
          </div>
          <div className="input-grid">
            <div className="input-cell">
              <span className="lbl">default</span>
              <input className="text-input" placeholder="Phone number" />
            </div>
            <div className="input-cell">
              <span className="lbl">focused (click in)</span>
              <input className="text-input" placeholder="Charger nickname" />
            </div>
            <div className="input-cell">
              <span className="lbl">filled</span>
              <input className="text-input" defaultValue="arjun@example.com" />
            </div>
            <div className="input-cell">
              <span className="lbl">disabled</span>
              <input className="text-input" defaultValue="Locked field" disabled />
            </div>
          </div>
        </section>

        {/* ── 03 Cards — treatment A ──────────────────────────────────────── */}
        <section className="block" id="cards">
          <div className="head-a">
            <span className="num">03</span>
            <div>
              <h2>Cards</h2>
              <p>No shadow. Separation comes from the border and the tonal step between page and card.</p>
            </div>
          </div>
          <div className="card-grid">
            <div className="demo-card padded">
              <h3>Card with padding</h3>
              <p>Used for booking summaries, charger detail sections, and profile blocks.</p>
              <div className="cap">surface-card · border · no shadow</div>
            </div>
            <div className="demo-card">
              <div className="card-noPad-inner"><h3>Card without padding</h3><p>Each row manages its own spacing, used for lists.</p></div>
              <div className="card-noPad-inner"><p className="t-small">Second row, same card</p></div>
            </div>
          </div>
          <div className="card-grid" style={{ marginTop: 16 }}>
            <div className="persona-card">
              <span className="tag tag-status-live">For drivers</span>
              <h3>Find a charger nearby</h3>
              <p>Browse verified home chargers, book a slot, and pay in-app.</p>
              <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}>Find a charger</button>
            </div>
            <div className="persona-card">
              <span className="tag tag-status-wait">For hosts</span>
              <h3>List your charger</h3>
              <p>Earn from every session you host, on your own schedule.</p>
              <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}>Earn with your charger</button>
            </div>
          </div>
        </section>

        {/* ── Star rating — treatment C ────────────────────────────────────── */}
        <section className="block" id="rating">
          <div className="head-c">
            <span className="ctag">review display</span>
            <h2>Star rating</h2>
          </div>
          <div className="rating-row">
            <div className="rating-stars">
              {[1,2,3,4].map(i => (
                <svg key={i} viewBox="0 0 20 20"><polygon className="star-fill" points="10 1 12.6 7 19 7.6 14.2 12 15.6 18.3 10 15 4.4 18.3 5.8 12 1 7.6 7.4 7"/></svg>
              ))}
              <svg viewBox="0 0 20 20"><polygon className="star-empty" points="10 1 12.6 7 19 7.6 14.2 12 15.6 18.3 10 15 4.4 18.3 5.8 12 1 7.6 7.4 7"/></svg>
            </div>
            <span className="rating-label">4.6 / 5 · 128 charging sessions</span>
          </div>
        </section>

        {/* ── Spec grid — treatment C ──────────────────────────────────────── */}
        <section className="block" id="spec">
          <div className="head-c">
            <span className="ctag">charger detail</span>
            <h2>Spec grid</h2>
          </div>
          <div className="spec-grid">
            <div className="spec-cell"><div className="k">Connector</div><div className="v">Type 2 AC</div></div>
            <div className="spec-cell"><div className="k">Max power</div><div className="v">7.4 kW</div></div>
            <div className="spec-cell"><div className="k">Rate</div><div className="v">₹12/kWh</div></div>
            <div className="spec-cell"><div className="k">Parking</div><div className="v">Free</div></div>
          </div>
        </section>

        {/* ── 04 Motion — treatment A ─────────────────────────────────────── */}
        <section className="block" id="motion">
          <div className="head-a">
            <span className="num">04</span>
            <div>
              <h2>Motion</h2>
              <p>Every animation below reports a real state. Nothing plays just to look premium, and everything here also has to work as a tap, not a hover, since the app is a mobile PWA first.</p>
            </div>
          </div>

          <div className="motion-grid">

            {/* Loading spinner */}
            <div className="motion-cell">
              <span className="lbl">loading spinner</span>
              <div className="demo-row"><div className="mo-spinner" /></div>
            </div>

            {/* Loading button */}
            <div className="motion-cell">
              <span className="lbl">loading button</span>
              <div className="demo-row">
                <button className="mo-loading-btn">
                  <span className="mo-spinner" style={{ width: 14, height: 14 }} />
                  Loading
                </button>
              </div>
            </div>

            {/* Skip */}
            <div className="motion-cell">
              <span className="lbl">skip</span>
              <div className="demo-row">
                <button className="mo-skip">Skip</button>
              </div>
            </div>

            {/* Log out */}
            <div className="motion-cell">
              <span className="lbl">log out, label always visible</span>
              <div className="demo-row">
                <button className="mo-iconbtn">
                  <svg viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" fill="none" width={15} height={15}>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Log out
                </button>
              </div>
            </div>

            {/* Login */}
            <div className="motion-cell">
              <span className="lbl">login</span>
              <div className="demo-row">
                <button className="mo-iconbtn primary">
                  <svg viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" fill="none" width={15} height={15}>
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  Login
                </button>
              </div>
            </div>

            {/* Pay now */}
            <div className="motion-cell">
              <span className="lbl">pay now · tap to run</span>
              <div className="demo-row">
                <button className={payClass} onClick={runPay}>
                  {payState !== 'paid' && <span className="mo-pay-spin" />}
                  {payState === 'paid' ? (
                    <>
                      <svg viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" stroke="#fff" fill="none" width={15} height={15}>
                        <polyline points="4 12.5 9.5 18 20 6.5"/>
                      </svg>
                      <span>Paid</span>
                    </>
                  ) : (
                    <span className="mo-pay-label">Pay now</span>
                  )}
                </button>
              </div>
            </div>

            {/* Delete */}
            <div className="motion-cell">
              <span className="lbl">delete, tap to arm, tap again to confirm</span>
              <div className="demo-row">
                <button className={deleteClass} onClick={runDelete}>
                  <svg viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" fill="none" width={15} height={15}>
                    <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                  <span className="mo-delete-label">{deleteLabel}</span>
                </button>
              </div>
            </div>

            {/* Edit */}
            <div className="motion-cell">
              <span className="lbl">edit</span>
              <div className="demo-row">
                <button className="mo-edit">
                  <svg viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" fill="none" width={15} height={15}>
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                  </svg>
                  Edit
                </button>
              </div>
            </div>

            {/* Verify */}
            <div className="motion-cell">
              <span className="lbl">verify · tap to run</span>
              <div className="demo-row">
                <button className={verifyClass} onClick={runVerify}>
                  {verifyState !== 'verified' && <span className="mo-v-spin" />}
                  {verifyState === 'verified' ? (
                    <>
                      <svg viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" stroke="#fff" fill="none" width={15} height={15}>
                        <polyline points="4 12.5 9.5 18 20 6.5"/>
                      </svg>
                      <span>Verified</span>
                    </>
                  ) : (
                    <span className="mo-v-label">Verify</span>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* OTP card */}
          <div className="otp-showcase" style={{ marginTop: 1 }}>
            <div className="mo-otp-card">
              <button className="mo-otp-exit" aria-label="Close">×</button>
              <span className="mo-otp-heading">Verify your number</span>
              <p className="mo-otp-sub">Enter the 6-digit code sent to +91 98xxxxxx21</p>
              <div className="mo-otp-inputs">
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
              <button className={otpVClass} onClick={runOtpVerify}>
                {otpVerify !== 'verified' && <span className="mo-v-spin" />}
                {otpVerify === 'verified' ? (
                  <>
                    <svg viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" stroke="#fff" fill="none" width={15} height={15}>
                      <polyline points="4 12.5 9.5 18 20 6.5"/>
                    </svg>
                    <span>Verified</span>
                  </>
                ) : (
                  <span className="mo-v-label">Verify</span>
                )}
              </button>
              <p className="mo-otp-resend">
                Didn't receive a code?{' '}
                {resendSeconds > 0
                  ? <span>Resend in {resendSeconds}s</span>
                  : <button onClick={() => setResendSeconds(30)}>Resend</button>
                }
              </p>
            </div>
          </div>
        </section>

        {/* ── Animation tokens ─────────────────────────────────────────────── */}
        <section className="block" id="animation-tokens">
          <div className="head-c">
            <span className="ctag">motion</span>
            <h2>Animation tokens</h2>
          </div>
          <div className="anim-table">
            {([
              { cls: '.animate-page-in',    dur: '120ms (--dur-fast)',       spec: 'opacity + translateY 8px→0',       use: 'Full-route page loads — applied by PageTransition wrapper automatically' },
              { cls: '.animate-step-in',    dur: '150ms',                    spec: 'opacity only',                     use: 'Wizard step transitions. User-initiated only — never on programmatic redirects. Trigger via key change.' },
              { cls: '.splash-bolt-pulse',  dur: '300ms, delay 200ms, once', spec: 'brightness 1→1.1→1 (filter)',      use: 'Branded intro — bolt accent single restrained pulse' },
              { cls: '.splash-text-in',     dur: '180ms, delay 500ms',       spec: 'opacity 0→1 only',                 use: 'Branded intro — KIRIN wordmark fade-in' },
              { cls: '.shake-error',        dur: '400ms',                    spec: 'translateX oscillation',           use: 'Input error. Apply to the container (not input itself). Re-trigger by changing key prop.' },
              { cls: '.animate-check-pop',  dur: '220ms cubic',              spec: 'scale 0→1 spring',                 use: 'RoutineSuccess checkmark. Use for confirmations that happen multiple times per day.' },
            ] as Array<{ cls: string; dur: string; spec: string; use: string }>).map(a => (
              <div key={a.cls} className="anim-row">
                <code className="anim-cls">{a.cls}</code>
                <span className="anim-dur">{a.dur}</span>
                <span className="anim-spec">{a.spec}</span>
                <span className="anim-use">{a.use}</span>
              </div>
            ))}
          </div>
          <p className="palette-note" style={{ marginTop: 14 }}>Duration variables: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>--dur-fast: 120ms</code> · <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>--dur-normal: 200ms</code> · <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>--ease-out: cubic-bezier(0,0,0.2,1)</code>. All keyframes defined in <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>src/app/globals.css</code>.</p>
        </section>

        {/* ── Haptic tiers ──────────────────────────────────────────────────── */}
        <section className="block" id="haptics">
          <div className="head-c">
            <span className="ctag">haptics</span>
            <h2>Haptic feedback tiers</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, maxWidth: 560, lineHeight: 1.6 }}>
            Use <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-page)', padding: '1px 4px', borderRadius: 4 }}>haptic(tier)</code> from <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-page)', padding: '1px 4px', borderRadius: 4 }}>src/lib/haptics.ts</code> in onClick handlers, before the action fires. Haptics are a bonus layer only — iOS receives none (Vibration API is Android-only by platform design). Visual feedback must communicate fully on its own.
          </p>
          <div className="haptic-table">
            {([
              { call: "haptic('light')",  ms: '10ms',         use: 'Nav tabs, cards, list rows, chips, icon buttons, toggles, checkboxes' },
              { call: "haptic('medium')", ms: '25ms',         use: 'Primary CTAs (Find Charger, Continue, Save), dialog confirm, pay, verify' },
              { call: "haptic('heavy')",  ms: '40ms',         use: 'Start/end session, accept booking, cancel booking (destructive confirms requiring sheet)' },
              { call: "haptic('error')",  ms: '[40, 30, 40]', use: 'OTP failures, form validation errors, payment declined — double-thud pattern' },
            ] as Array<{ call: string; ms: string; use: string }>).map(h => (
              <div key={h.call} className="haptic-row">
                <code className="haptic-call">{h.call}</code>
                <span className="haptic-ms">{h.ms}</span>
                <span className="haptic-use">{h.use}</span>
              </div>
            ))}
          </div>
          <p className="palette-note" style={{ marginTop: 14 }}>The <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>Button</code> component calls haptic automatically: primary/danger → medium, secondary/ghost → light. Only call <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>haptic()</code> manually for elements that are not a <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>Button</code>.</p>
        </section>

        {/* ── Splash intro sequence ─────────────────────────────────────────── */}
        <section className="block" id="splash-intro">
          <div className="head-c">
            <span className="ctag">branded intro</span>
            <h2>Splash intro sequence</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, maxWidth: 580, lineHeight: 1.6 }}>
            Cold-start only. Skipped instantly on return visits via <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-page)', padding: '1px 4px', borderRadius: 4 }}>sessionStorage['kirin_intro_done']</code>. Implemented in <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-page)', padding: '1px 4px', borderRadius: 4 }}>src/components/ui/SplashIntro.tsx</code>.
          </p>
          <div className="splash-timeline">
            {([
              { t: '0ms',    event: 'Logo fully visible — rings static, matches OS native splash background (no drawing, no slide)' },
              { t: '200ms',  event: 'Bolt single brightness pulse: 1.0 → 1.1 → 1.0, 300ms, once (.splash-bolt-pulse)' },
              { t: '500ms',  event: '"KIRIN" wordmark fades in: opacity 0→1, 180ms, no translateY (.splash-text-in)' },
              { t: '800ms',  event: 'Hold' },
              { t: '1000ms', event: 'Overlay cross-fade begins: opacity 1→0, 350ms ease-out (setPhase fading)' },
              { t: '1350ms', event: 'Component unmounts; kirin_intro_done written to sessionStorage' },
            ] as Array<{ t: string; event: string }>).map(row => (
              <div key={row.t} className="splash-row">
                <span className="splash-t">{row.t}</span>
                <span className="splash-event">{row.event}</span>
              </div>
            ))}
          </div>
          <p className="palette-note" style={{ marginTop: 14 }}>Background CSS variables: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>--splash-bg</code> (page bg), <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>--splash-ring</code> (ring stroke), <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>--splash-detail</code> (notch dashes), <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>--splash-text</code>. Both light and dark values defined; iOS startup images match via <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>prefers-color-scheme</code> media queries.</p>
        </section>

        {/* ── Icon conventions ──────────────────────────────────────────────── */}
        <section className="block" id="icons">
          <div className="head-c">
            <span className="ctag">icons</span>
            <h2>Icon conventions</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, maxWidth: 580, lineHeight: 1.6 }}>
            All icons use <strong>Lucide React</strong> (<code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-page)', padding: '1px 4px', borderRadius: 4 }}>lucide-react</code>). Always pass <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-page)', padding: '1px 4px', borderRadius: 4 }}>aria-hidden</code> on decorative icons. Size convention: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>size-4</code> (16px) in buttons · <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>size-5</code> (20px) in nav/headers · <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>size-6</code> (24px) standalone feature icons.
          </p>
          <div className="icon-grid">
            {([
              { label: 'ChevronLeft', d: 'M15 18l-6-6 6-6', note: 'BackButton / nav back' },
              { label: 'X', d: 'M18 6L6 18M6 6l12 12', note: 'Modal dismiss (Bucket 3)' },
              { label: 'Loader2', d: 'M21 12a9 9 0 1 1-6.2-8.6', note: 'Button loading spinner (animated)' },
              { label: 'Sunrise', d: 'M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M17 12A5 5 0 0 0 7 12M3 20h18M5 20a7 7 0 0 1 14 0', note: 'Morning greeting' },
              { label: 'Sun', d: 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', note: 'Afternoon greeting' },
              { label: 'Sunset', d: 'M17 18A5 5 0 0 0 7 18M3 18h18M12 2v8M4.93 10.93l1.41 1.41M19.07 10.93l-1.41 1.41', note: 'Evening greeting' },
              { label: 'Moon', d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z', note: 'Night greeting' },
              { label: 'MapPin', d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6z', note: 'Location / charger pin' },
              { label: 'Zap', d: 'M13 2 5 12h5l-1 8 8-10h-5l1-8z', filled: true, note: 'EV / charging / bolt (filled)' },
              { label: 'Star', d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', note: 'Rating stars' },
              { label: 'Shield', d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', note: 'Verified host badge' },
              { label: 'Bell', d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0', note: 'Notifications (badge on Activity tab, not standalone)' },
            ] as Array<{ label: string; d: string; filled?: boolean; note: string }>).map(ic => (
              <div key={ic.label} className="icon-cell">
                <div className="icon-preview">
                  <svg viewBox="0 0 24 24" width={22} height={22} stroke="var(--ink-soft)" fill={ic.filled ? 'var(--ink-soft)' : 'none'} strokeWidth={ic.filled ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                    {ic.d.split(' M').map((seg, i) => (
                      <path key={i} d={i === 0 ? seg : 'M' + seg} />
                    ))}
                  </svg>
                </div>
                <div className="icon-meta">
                  <div className="icon-name">{ic.label}</div>
                  <div className="icon-note">{ic.note}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Info rows — treatment C ──────────────────────────────────────── */}
        <section className="block" id="info">
          <div className="head-c">
            <span className="ctag">detail screen</span>
            <h2>Info rows</h2>
          </div>
          <div className="info-card">
            <div className="info-row"><span className="k">Location</span><span className="v">Sector 15, Gurugram</span></div>
            <div className="info-row"><span className="k">Connector</span><span className="v">Type 2 AC</span></div>
            <div className="info-row"><span className="k">Available</span><span className="v">Mon to Fri, 6am to 10pm</span></div>
          </div>
        </section>

        {/* ── Avatars — treatment C ────────────────────────────────────────── */}
        <section className="block" id="avatars">
          <div className="head-c">
            <span className="ctag">identity</span>
            <h2>Avatars</h2>
          </div>
          <div className="avatar-row">
            <div className="avatar lg">AK</div>
            <div className="avatar md">AK</div>
            <div className="avatar sm">AK</div>
          </div>
        </section>

        {/* ── Skeletons — treatment C ──────────────────────────────────────── */}
        <section className="block" id="skeletons">
          <div className="head-c">
            <span className="ctag">loading state</span>
            <h2>Skeletons</h2>
          </div>
          <div className="skel-card">
            <div className="skel skel-circle" />
            <div className="skel-lines">
              <div className="skel skel-line" style={{ width: '60%' }} />
              <div className="skel skel-line" style={{ width: '90%' }} />
              <div className="skel skel-line" style={{ width: '40%' }} />
            </div>
          </div>
        </section>

        {/* ── Sheet — treatment C ──────────────────────────────────────────── */}
        <section className="block" id="sheet">
          <div className="head-c">
            <span className="ctag">confirmation flow</span>
            <h2>Sheet</h2>
          </div>
          <div className="sheet-demo-area">
            <button className="btn btn-primary" onClick={() => setSheetOpen(true)}>Open sheet</button>
          </div>
        </section>

        {/* ── 05 Radius & elevation — treatment A ─────────────────────────── */}
        <section className="block" id="radius">
          <div className="head-a">
            <span className="num">05</span>
            <div>
              <h2>Radius &amp; elevation</h2>
              <p>Restraint, not a rule against rounding or depth entirely. Use each tool where it's earned.</p>
            </div>
          </div>
          <p className="principle-note">
            Cards separate from the page through a 1px border and a tonal step (<b>surface-page</b> to <b>surface-card</b>), not a shadow. The bottom sheet is the one exception: it's genuinely floating over the page, so a shadow there is honest, not decorative.
          </p>
          <div className="sr-grid">
            <div className="sr-cell"><div className="box r-sm" /><div className="lbl">radius-sm · 6px, inputs</div></div>
            <div className="sr-cell"><div className="box r-base" /><div className="lbl">radius · 10px, buttons</div></div>
            <div className="sr-cell"><div className="box r-lg" /><div className="lbl">radius-lg · 14px, cards and sheets</div></div>
            <div className="sr-cell"><div className="box r-pill" /><div className="lbl">radius-pill · status chips only</div></div>
          </div>
          <div className="compare-grid">
            <div className="compare-cell compare-avoid">
              <span className="ctag">what we had</span>
              <p>Every button pill-shaped, a glowing shadow just for looking premium, ink black and neon green with nothing else.</p>
              <span className="demo-box">Find a charger</span>
            </div>
            <div className="compare-cell compare-use">
              <span className="ctag">what we use now</span>
              <p>16px radius, no glow, a grounded green. Amber for action-needed, copper for in-progress. No decorative shadows.</p>
              <span className="demo-box">Find a charger</span>
            </div>
          </div>
        </section>

      </div>{/* /wrap */}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="foot">
        <div className="wrap">
          <div className="foot-inner">
            <div className="foot-left">
              <span className="logo-mark" style={{ width: 16, height: 16, display: 'inline-block' }} />
              Kirin, Design Foundation V3
            </div>
            <div className="foot-links">
              {['Terms', 'Privacy', 'Contact'].map(l => (
                <a key={l} href="#">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── Sheet modal ─────────────────────────────────────────────────────── */}
      <div
        className={`backdrop${sheetOpen ? ' show' : ''}`}
        onClick={() => setSheetOpen(false)}
        aria-hidden="true"
      />
      <div
        className={`sheet${sheetOpen ? ' show' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheetTitle"
      >
        <div className="grabber" />
        <h3 id="sheetTitle">Confirm booking</h3>
        <p>Sharma's home charger, Sector 15, Gurugram, 6:00 to 7:00 PM</p>
        <button className="btn btn-primary btn-full" onClick={() => setSheetOpen(false)}>Confirm</button>
      </div>

      {/* ── Scoped styles ───────────────────────────────────────────────────── */}
      <style>{`
        /* reset inside this page */
        .wrap a { color: inherit; text-decoration: none; }
        .wrap a:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }
        .wrap h1, .wrap h2, .wrap h3 { color: var(--ink); font-weight: 700; }

        /* layout */
        .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
        .foot .wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }

        /* nav */
        nav.top { border-bottom: 1px solid var(--border); background: var(--surface-page); }
        .navrow { max-width: 1040px; margin: 0 auto; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
        .logo { display: flex; align-items: center; gap: 9px; font-weight: 700; font-size: 16px; color: var(--ink); }
        .logo-mark { width: 20px; height: 20px; background: var(--green); flex: none; clip-path: polygon(45% 0,100% 0,45% 55%,100% 55%,20% 100%,35% 40%,0 40%); }
        .navlink { font-size: 13.5px; font-weight: 500; color: var(--muted); border-bottom: 1px solid transparent; transition: color .12s, border-color .12s; }
        .navlink:hover { color: var(--ink); border-color: var(--ink); }

        /* intro */
        .intro { padding: 40px 0 36px; border-bottom: 1px solid var(--border); }
        .intro-kicker { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--green); letter-spacing: .04em; margin-bottom: 10px; }
        h1.pagetitle { font-size: 28px; letter-spacing: -.01em; margin-bottom: 10px; color: var(--ink); font-weight: 700; }
        .intro p { font-size: 14.5px; color: var(--muted); max-width: 560px; }

        /* section shells */
        section.block { padding: 40px 0; border-bottom: 1px solid var(--border); }
        section.block:last-of-type { border-bottom: none; }

        /* treatment A */
        .head-a { display: flex; align-items: baseline; gap: 16px; margin-bottom: 24px; }
        .head-a .num { font-family: var(--font-mono); font-size: 13px; color: var(--green); font-weight: 600; flex: none; padding-top: 2px; }
        .head-a h2 { font-size: 20px; }
        .head-a p { font-size: 13px; color: var(--muted); margin-top: 4px; max-width: 520px; }

        /* treatment B */
        .head-b { margin-bottom: 22px; }
        .head-b h2 { font-size: 19px; display: inline; }
        .head-b span { font-size: 13px; color: var(--muted); margin-left: 10px; }

        /* treatment C */
        .head-c { display: flex; flex-direction: column; gap: 2px; margin-bottom: 24px; padding-bottom: 14px; border-bottom: 1px dashed var(--border); }
        .head-c .ctag { font-family: var(--font-mono); font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
        .head-c h2 { font-size: 19px; }

        /* color swatches */
        .swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); }
        .swatch { background: var(--surface-card); }
        .swatch .fill { height: 64px; }
        .swatch .meta { padding: 10px 12px; }
        .swatch .name { font-weight: 600; font-size: 13px; color: var(--ink); }
        .swatch .hex { font-size: 11.5px; color: var(--muted); font-family: var(--font-mono); }
        .palette-note { font-size: 12.5px; color: var(--muted); margin-top: 14px; max-width: 600px; }

        /* typography */
        .type-list { border: 1px solid var(--border); }
        .type-row { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; padding: 18px 20px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
        .type-row:last-child { border-bottom: none; }
        .type-sample { flex: 1; min-width: 260px; }
        .type-tag { font-family: var(--font-mono); font-size: 11px; font-weight: 500; color: var(--muted); white-space: nowrap; }
        .t-label { font-family: var(--font-mono); font-weight: 500; font-size: 11.5px; color: var(--green); letter-spacing: .05em; text-transform: uppercase; }
        .t-h1 { font-size: 26px; font-weight: 700; letter-spacing: -.01em; color: var(--ink); }
        .t-h2 { font-size: 20px; font-weight: 700; color: var(--ink); }
        .t-body { font-size: 15px; line-height: 1.55; max-width: 460px; font-weight: 400; }
        .t-small { font-size: 13.5px; font-weight: 500; color: var(--ink-soft); }
        .t-data { font-family: var(--font-mono); font-size: 14px; font-weight: 600; color: var(--ink); }

        /* buttons */
        .btn-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); }
        .btn-cell { background: var(--surface-card); padding: 20px; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
        .btn-cell .lbl { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
        .btn { font-family: var(--font-sans); font-weight: 600; font-size: 14.5px; padding: 10px 20px; border-radius: var(--radius); cursor: pointer; border: 1px solid transparent; transition: background-color .12s, border-color .12s; display: inline-flex; align-items: center; gap: 8px; }
        .btn svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex: none; }
        .btn svg.filled { fill: currentColor; stroke: none; }
        .btn-primary { background: var(--green); color: #fff; }
        .btn-primary:hover { background: var(--green-deep); }
        .btn-secondary { background: transparent; color: var(--ink); border-color: var(--border); }
        .btn-secondary:hover { border-color: var(--ink); }
        .btn-text { background: transparent; color: var(--green); padding: 10px 4px; border-bottom: 1px solid transparent; }
        .btn-text:hover { border-color: var(--green); }
        .btn-danger { background: var(--danger); color: #fff; }
        .btn-sm { padding: 7px 14px; font-size: 13px; }
        .btn:disabled { opacity: .4; cursor: not-allowed; }
        .btn-full { width: 100%; justify-content: center; display: flex; }
        .btn-copper { background: var(--copper); color: #fff; }
        .notif-band { background: var(--ink); padding: 11px 16px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-radius: var(--radius-sm); }
        .notif-band span { font-size: 13px; color: #fff; font-weight: 400; }
        .btn-inverse { background: #fff; color: var(--ink); padding: 6px 12px; font-size: 12.5px; border-radius: var(--radius-sm); }

        /* tags & badges */
        .tag-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .tag { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-weight: 500; font-size: 11.5px; border-radius: var(--radius-pill); padding: 5px 12px; }
        .tag svg { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex: none; }
        .tag svg.filled { fill: currentColor; stroke: none; }
        .tag-status-live { background: var(--green-soft); color: var(--green-deep); }
        .tag-status-wait { background: var(--copper-soft); color: var(--copper); }
        .tag-outlined { background: transparent; color: var(--ink-soft); border: 1px solid var(--border); }
        .badge { display: inline-flex; align-items: center; font-family: var(--font-mono); font-weight: 600; font-size: 10.5px; border-radius: var(--radius-sm); padding: 3px 8px; background: var(--ink); color: #fff; }
        .trust-row { display: flex; flex-wrap: wrap; gap: 10px; }
        .trust-chip { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 13px; color: var(--ink-soft); background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius-pill); padding: 8px 16px; }
        .trust-chip svg { width: 15px; height: 15px; stroke: var(--green); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex: none; }

        /* text input */
        .input-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px; }
        .input-cell { display: flex; flex-direction: column; gap: 7px; }
        .input-cell .lbl { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
        .text-input { font-family: var(--font-sans); font-size: 14.5px; color: var(--ink-soft); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 13px; background: var(--surface-card); outline: none; transition: border-color .12s; width: 100%; }
        .text-input::placeholder { color: var(--muted); }
        .text-input:focus { border-color: var(--green); }
        .text-input:disabled { color: var(--muted); background: var(--surface-page); cursor: not-allowed; }

        /* cards */
        .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); }
        .demo-card { background: var(--surface-card); }
        .demo-card.padded { padding: 22px; }
        .demo-card .cap { font-family: var(--font-mono); font-size: 11px; color: var(--muted); margin-top: 10px; }
        .demo-card h3 { font-size: 16px; margin-bottom: 6px; }
        .demo-card p { font-size: 13.5px; color: var(--muted); }
        .card-noPad-inner { padding: 18px 22px; border-bottom: 1px solid var(--border); }
        .card-noPad-inner:last-child { border-bottom: none; }
        .persona-card { background: var(--surface-card); border: 1px solid var(--border); padding: 22px; display: flex; flex-direction: column; gap: 10px; }
        .persona-card h3 { font-size: 18px; }
        .persona-card p { font-size: 13.5px; color: var(--muted); }

        /* star rating */
        .rating-row { display: flex; align-items: center; gap: 8px; }
        .rating-stars { display: flex; gap: 2px; }
        .rating-stars svg { width: 13px; height: 13px; }
        .star-fill { fill: var(--copper); stroke: var(--copper); }
        .star-empty { fill: none; stroke: var(--border); stroke-width: 1.5; }
        .rating-label { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted); }

        /* spec grid */
        .spec-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); }
        .spec-cell { background: var(--surface-card); padding: 14px; }
        .spec-cell .k { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin-bottom: 5px; }
        .spec-cell .v { font-family: var(--font-mono); font-weight: 600; font-size: 15px; color: var(--ink); }

        /* motion grid */
        .motion-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); }
        .motion-cell { background: var(--surface-card); padding: 20px; display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 18px; min-height: 100px; }
        .motion-cell .lbl { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
        .motion-cell .demo-row { display: flex; align-items: center; gap: 10px; }

        /* spinner */
        .mo-spinner { width: 20px; height: 20px; border: 2.5px solid var(--border); border-top-color: var(--green); border-radius: 50%; animation: mo-spin .7s linear infinite; display: inline-block; flex-shrink: 0; }
        @keyframes mo-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .mo-spinner { animation: none; } }

        /* loading button */
        .mo-loading-btn { padding: 10px 20px; border-radius: var(--radius); background: var(--surface-page); border: 1px solid var(--border); color: var(--ink-soft); font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 9px; cursor: wait; }

        /* skip */
        .mo-skip { background: transparent; border: none; color: var(--muted); font-weight: 600; font-size: 14px; cursor: pointer; padding: 8px 2px; border-bottom: 1px solid transparent; transition: border-color .12s, color .12s; font-family: var(--font-sans); }
        .mo-skip:hover { color: var(--ink); border-color: var(--ink); }

        /* icon button (log out / login) */
        .mo-iconbtn { display: inline-flex; align-items: center; gap: 8px; background: var(--surface-page); border: 1px solid var(--border); border-radius: var(--radius); padding: 9px 16px; color: var(--ink-soft); font-weight: 600; font-size: 13.5px; cursor: pointer; transition: border-color .12s, background-color .12s; font-family: var(--font-sans); }
        .mo-iconbtn:hover { border-color: var(--ink); background: var(--surface-card); }
        .mo-iconbtn.primary { background: var(--green); border-color: var(--green); color: #fff; }
        .mo-iconbtn.primary:hover { background: var(--green-deep); border-color: var(--green-deep); }

        /* pay now */
        .mo-pay { position: relative; padding: 10px 22px; font-weight: 600; font-size: 14.5px; background: var(--ink); color: #fff; border: none; border-radius: var(--radius); cursor: pointer; display: flex; align-items: center; gap: 9px; min-width: 120px; justify-content: center; transition: background-color .15s; font-family: var(--font-sans); }
        .mo-pay .mo-pay-spin { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; display: none; animation: mo-spin .7s linear infinite; flex-shrink: 0; }
        .mo-pay.pending { background: var(--ink-soft); pointer-events: none; }
        .mo-pay.pending .mo-pay-spin { display: block; }
        .mo-pay.pending .mo-pay-label { display: none; }
        .mo-pay.paid { background: var(--green); pointer-events: none; }
        @keyframes mo-draw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) { .mo-pay .mo-pay-spin { animation: none; } }

        /* delete */
        .mo-delete { display: inline-flex; align-items: center; gap: 8px; background: var(--surface-page); border: 1px solid var(--border); border-radius: var(--radius); padding: 9px 16px; color: var(--ink-soft); font-weight: 600; font-size: 13.5px; cursor: pointer; transition: border-color .15s, background-color .15s, color .15s; font-family: var(--font-sans); }
        .mo-delete.armed { background: var(--danger-soft); border-color: var(--danger); color: var(--danger); }
        .mo-delete.done { background: var(--ink); border-color: var(--ink); color: #fff; }

        /* edit */
        .mo-edit { display: inline-flex; align-items: center; gap: 8px; background: var(--surface-page); border: 1px solid var(--border); border-radius: var(--radius); padding: 9px 16px; color: var(--ink-soft); font-weight: 600; font-size: 13.5px; cursor: pointer; transition: border-color .12s, background-color .12s; font-family: var(--font-sans); }
        .mo-edit:hover { border-color: var(--green); background: var(--green-soft); color: var(--green-deep); }

        /* verify */
        .mo-verify { padding: 10px 22px; border-radius: var(--radius); background: var(--ink); border: none; color: #fff; font-weight: 600; font-size: 14.5px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; min-width: 110px; transition: background-color .15s; font-family: var(--font-sans); }
        .mo-verify-full { width: 100%; }
        .mo-verify .mo-v-spin { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; display: none; animation: mo-spin .7s linear infinite; flex-shrink: 0; }
        .mo-verify.verifying { background: var(--ink-soft); pointer-events: none; }
        .mo-verify.verifying .mo-v-spin { display: block; }
        .mo-verify.verifying .mo-v-label { display: none; }
        .mo-verify.verified { background: var(--green); pointer-events: none; }
        @media (prefers-reduced-motion: reduce) { .mo-verify .mo-v-spin { animation: none; } }

        /* OTP card */
        .otp-showcase { display: flex; justify-content: center; padding: 6px 0; margin-top: 1px; }
        .mo-otp-card { width: 290px; background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius-lg); display: flex; flex-direction: column; align-items: center; padding: 26px 22px; gap: 14px; position: relative; }
        .mo-otp-exit { position: absolute; top: 12px; right: 12px; width: 24px; height: 24px; border-radius: 50%; background: var(--surface-page); border: 1px solid var(--border); color: var(--ink-soft); font-size: 14px; line-height: 1; cursor: pointer; display: grid; place-items: center; }
        .mo-otp-heading { font-size: 17px; font-weight: 700; text-align: center; color: var(--ink); }
        .mo-otp-sub { font-size: 12.5px; color: var(--muted); line-height: 1.5; text-align: center; margin: 0; }
        .mo-otp-inputs { display: flex; gap: 7px; justify-content: center; }
        .mo-otp-input { background: var(--surface-card); border: 1px solid var(--border); width: 34px; height: 38px; text-align: center; border-radius: var(--radius-sm); caret-color: var(--green); color: var(--ink); outline: none; font-family: var(--font-mono); font-weight: 600; font-size: 15px; transition: border-color .15s; }
        .mo-otp-input:focus { border-color: var(--green); }
        .mo-otp-resend { font-size: 12px; color: var(--muted); text-align: center; margin: 0; }
        .mo-otp-resend button { background: transparent; border: none; color: var(--green); cursor: pointer; font-weight: 600; font-size: 12px; padding: 0; font-family: var(--font-sans); }

        /* info rows */
        .info-card { background: var(--surface-card); border: 1px solid var(--border); }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 13px 18px; border-bottom: 1px solid var(--border); }
        .info-row:last-child { border-bottom: none; }
        .info-row .k { font-size: 13px; color: var(--muted); }
        .info-row .v { font-family: var(--font-mono); font-size: 13.5px; font-weight: 600; color: var(--ink); }

        /* avatars */
        .avatar-row { display: flex; align-items: center; gap: 14px; }
        .avatar { border-radius: 50%; background: var(--green-soft); color: var(--green-deep); display: grid; place-items: center; font-weight: 700; flex: none; }
        .avatar.lg { width: 50px; height: 50px; font-size: 16px; }
        .avatar.md { width: 38px; height: 38px; font-size: 13px; }
        .avatar.sm { width: 26px; height: 26px; font-size: 10px; }

        /* skeletons */
        .skel-card { background: var(--surface-card); border: 1px solid var(--border); padding: 20px; display: flex; gap: 14px; align-items: center; }
        .skel { background: linear-gradient(100deg, var(--border) 30%, #efece2 50%, var(--border) 70%); background-size: 220% 100%; animation: shimmer 1.5s ease-in-out infinite; }
        @keyframes shimmer { to { background-position: -120% 0; } }
        @media (prefers-reduced-motion: reduce) { .skel { animation: none; background: var(--border); } }
        .skel-circle { width: 44px; height: 44px; border-radius: 50%; flex: none; }
        .skel-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .skel-line { height: 10px; border-radius: 4px; }

        /* sheet */
        .sheet-demo-area { display: flex; align-items: center; gap: 16px; }
        .backdrop { position: fixed; inset: 0; background: rgba(26,31,28,.45); opacity: 0; pointer-events: none; transition: opacity .2s ease; z-index: 60; }
        .backdrop.show { opacity: 1; pointer-events: auto; }
        .sheet { position: fixed; left: 0; right: 0; bottom: 0; background: var(--surface-card); border-top: 1px solid var(--border); border-radius: var(--radius-lg) var(--radius-lg) 0 0; box-shadow: var(--shadow-elevated); padding: 14px 24px 26px; max-width: 440px; margin: 0 auto; transform: translateY(100%); transition: transform .25s cubic-bezier(.2,.8,.2,1); z-index: 61; }
        .sheet.show { transform: translateY(0); }
        .sheet .grabber { width: 34px; height: 4px; border-radius: 99px; background: var(--border); margin: 0 auto 16px; }
        .sheet h3 { font-size: 17px; margin-bottom: 6px; color: var(--ink); font-weight: 700; }
        .sheet p { font-size: 13.5px; color: var(--muted); margin-bottom: 18px; }

        /* radius & elevation */
        .principle-note { font-size: 13.5px; color: var(--ink-soft); max-width: 640px; line-height: 1.6; margin-bottom: 22px; }
        .principle-note b { color: var(--ink); }
        .sr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); }
        .sr-cell { background: var(--surface-card); padding: 20px 14px; text-align: center; }
        .sr-cell .box { width: 100%; height: 46px; background: var(--surface-page); margin-bottom: 12px; border: 1px solid var(--border); }
        .sr-cell .lbl { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
        .r-sm { border-radius: var(--radius-sm); }
        .r-base { border-radius: var(--radius); }
        .r-lg { border-radius: var(--radius-lg); }
        .r-pill { border-radius: var(--radius-pill); }
        .compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); margin-top: 20px; }
        .compare-cell { background: var(--surface-card); padding: 18px; }
        .compare-cell .ctag { font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
        .compare-avoid .ctag { color: var(--danger); }
        .compare-use .ctag { color: var(--green); }
        .compare-cell p { font-size: 12.5px; color: var(--muted); margin-top: 6px; }
        .compare-avoid .demo-box { margin-top: 12px; padding: 14px 18px; border-radius: 999px; background: #0c1611; color: #fff; font-weight: 600; font-size: 13px; box-shadow: 0 12px 28px rgba(16,217,106,.35); display: inline-block; }
        .compare-use .demo-box { margin-top: 12px; padding: 10px 20px; border-radius: var(--radius); background: var(--green); color: #fff; font-weight: 600; font-size: 13px; display: inline-block; }

        /* footer */
        footer.foot { padding: 28px 0 44px; }
        .foot-inner { display: flex; justify-content: space-between; align-items: center; padding-top: 20px; border-top: 1px solid var(--border); }
        .foot-left { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--muted); }
        .foot-links { display: flex; gap: 18px; font-size: 12.5px; font-weight: 500; }
        .foot-links a { color: var(--muted); text-decoration: none; }
        .foot-links a:hover { color: var(--green); }

        /* semantic accents */
        .accent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); }
        .accent-cell { background: var(--surface-card); padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .accent-cell .lbl { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
        .accent-rule { font-size: 12px; color: var(--muted); line-height: 1.55; margin: 0; }
        .accent-rule code { font-family: var(--font-mono); font-size: 11px; background: var(--surface-page); padding: 1px 4px; border-radius: 4px; }
        .accent-amber-card { background: #fff; border: 2px solid rgba(252,211,77,0.7); border-radius: var(--radius); padding: 14px; }
        .accent-avatar { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: 12px; flex: none; }
        .accent-pill { display: inline-flex; align-items: center; font-family: var(--font-mono); font-weight: 600; font-size: 10px; border-radius: var(--radius-pill); padding: 3px 8px; letter-spacing: .04em; }
        .amber-pill { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
        .accent-demo { display: flex; align-items: center; }
        .accent-dark-card { background: #18181b; border-radius: var(--radius); padding: 16px; }

        /* copy guardrails */
        .copy-grid { border: 1px solid var(--border); }
        .copy-row { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; padding: 14px 18px; border-bottom: 1px solid var(--border); align-items: baseline; }
        .copy-row-last { border-bottom: none; }
        .copy-avoid { font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; color: var(--danger); white-space: nowrap; }
        .copy-rule { font-size: 13px; color: var(--muted); line-height: 1.55; }

        /* activity tiles */
        .tile-row { display: flex; flex-wrap: wrap; gap: 12px; }
        .tile-cell { display: flex; flex-direction: column; align-items: center; gap: 7px; }
        .tile-icon { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; }
        .tile-label { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }

        /* navigation controls */
        .nav-ctrl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); }
        .nav-ctrl-cell { background: var(--surface-card); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .nav-ctrl-cell .lbl { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
        .nav-ctrl-demo-light { display: flex; align-items: flex-start; gap: 10px; background: var(--surface-page); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; }
        .nav-ctrl-demo-photo { display: flex; align-items: flex-start; gap: 10px; background: linear-gradient(135deg, #3a4139 0%, #1a1f1c 100%); border-radius: var(--radius); padding: 14px; }
        .nav-ctrl-demo-modal { display: flex; align-items: flex-start; gap: 10px; background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; position: relative; }
        .modal-x-btn { width: 28px; height: 28px; border-radius: 50%; background: var(--surface-page); border: 1px solid var(--border); color: var(--ink-soft); cursor: pointer; display: grid; place-items: center; flex: none; }

        /* tap feedback demo */
        .tap-demo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); }
        .tap-demo-cell { background: var(--surface-card); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .tap-demo-cell .lbl { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
        .tap-swatch { padding: 12px 20px; border-radius: var(--radius); background: var(--surface-page); border: 1px solid var(--border); color: var(--ink-soft); font-weight: 600; font-size: 13.5px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; user-select: none; }
        .tap-light:active { transform: scale(0.98); transition: transform 80ms ease-out; }
        .tap-medium:active { transform: scale(0.96); transition: transform 80ms ease-out; }
        .tap-opacity:active { opacity: 0.6; transition: opacity 80ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .tap-light:active, .tap-medium:active { transform: none; }
          .tap-opacity:active { opacity: 1; }
        }

        /* animation tokens */
        .anim-table { border: 1px solid var(--border); }
        .anim-row { display: grid; grid-template-columns: 1fr 1fr 1fr 2fr; gap: 12px; padding: 13px 18px; border-bottom: 1px solid var(--border); align-items: baseline; }
        .anim-row:last-child { border-bottom: none; }
        .anim-cls { font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; color: var(--green); }
        .anim-dur { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
        .anim-spec { font-size: 12px; color: var(--ink-soft); }
        .anim-use { font-size: 12px; color: var(--muted); line-height: 1.5; }

        /* haptic tiers */
        .haptic-table { border: 1px solid var(--border); }
        .haptic-row { display: grid; grid-template-columns: 1fr 100px 2fr; gap: 12px; padding: 13px 18px; border-bottom: 1px solid var(--border); align-items: baseline; }
        .haptic-row:last-child { border-bottom: none; }
        .haptic-call { font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; color: var(--green); }
        .haptic-ms { font-family: var(--font-mono); font-size: 11px; color: var(--muted); white-space: nowrap; }
        .haptic-use { font-size: 12.5px; color: var(--muted); line-height: 1.5; }

        /* splash timeline */
        .splash-timeline { border: 1px solid var(--border); }
        .splash-row { display: grid; grid-template-columns: 80px 1fr; gap: 16px; padding: 12px 18px; border-bottom: 1px solid var(--border); align-items: baseline; }
        .splash-row:last-child { border-bottom: none; }
        .splash-t { font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; color: var(--green); }
        .splash-event { font-size: 13px; color: var(--ink-soft); line-height: 1.55; }

        /* icon conventions */
        .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); }
        .icon-cell { background: var(--surface-card); padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
        .icon-preview { width: 40px; height: 40px; border-radius: var(--radius-sm); background: var(--surface-page); display: grid; place-items: center; flex: none; }
        .icon-meta { flex: 1; min-width: 0; }
        .icon-name { font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: var(--ink); }
        .icon-note { font-size: 11.5px; color: var(--muted); margin-top: 2px; }

        @media (max-width: 720px) {
          .wrap { padding: 0 18px; }
          .navrow { padding: 14px 18px; }
          .card-grid { grid-template-columns: 1fr; }
          .spec-grid { grid-template-columns: repeat(2, 1fr); }
          .compare-grid { grid-template-columns: 1fr; }
          .copy-row { grid-template-columns: 1fr; gap: 4px; }
          .accent-grid { grid-template-columns: 1fr; }
          .nav-ctrl-grid { grid-template-columns: 1fr; }
          .anim-row { grid-template-columns: 1fr 1fr; }
          .anim-spec, .anim-use { grid-column: 1/-1; }
          .haptic-row { grid-template-columns: 1fr 80px; }
          .haptic-use { grid-column: 1/-1; }
          .splash-row { grid-template-columns: 60px 1fr; }
        }
      `}</style>

    </div>
  );
}
