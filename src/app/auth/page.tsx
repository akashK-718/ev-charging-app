'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { RoutineSuccess } from '@/components/ui/RoutineSuccess';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

type AuthStep = 'phone' | 'otp' | 'profile';

const OTP_LENGTH = 6;
const INITIAL_COOLDOWN = 30;
const RESEND_COOLDOWN = 60;
// Indian mobile numbers start with 6–9 and are 10 digits
const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;
const NAME_REGEX = /^[\p{L}\s]{2,50}$/u;

// Subtle green glow on primary auth CTAs — matches --green at 35% opacity
const CTA_GLOW = 'shadow-[0_4px_20px_-4px_rgba(28,107,71,0.35)]';

function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const restart = useCallback((from: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSeconds(from);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(intervalRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return { seconds, restart };
}

function useShake() {
  const [shaking, setShaking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shake = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShaking(true);
    timerRef.current = setTimeout(() => setShaking(false), 450);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return { shaking, shake };
}

function validateName(v: string): string | null {
  const t = v.trim();
  if (!t) return 'Name is required.';
  if (t.length < 2) return 'Name must be at least 2 characters.';
  if (t.length > 50) return 'Name must be 50 characters or fewer.';
  if (!NAME_REGEX.test(t)) return 'Name can only contain letters and spaces.';
  return null;
}

function AuthFlow() {
  const router = useRouter();

  const [step, setStep] = useState<AuthStep>('phone');
  // Tracks whether a step transition has occurred — controls animate-step-in.
  // False on initial load (PageTransition handles the page entrance); true after
  // any user-initiated step change so cross-fade fires on subsequent steps.
  const [hasTransitioned, setHasTransitioned] = useState(false);

  // ── Phone step ──────────────────────────────────────────────────────────────
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const { shaking: phoneShaking, shake: shakePhone } = useShake();

  // ── OTP step ────────────────────────────────────────────────────────────────
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const { seconds, restart } = useCountdown();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // null = not yet determined; string = name (may be empty) for existing-user welcome-back
  const [welcomeBackName, setWelcomeBackName] = useState<string | null>(null);
  const { shaking: otpShaking, shake: shakeOtp } = useShake();

  // ── Profile step ────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { shaking: nameShaking, shake: shakeName } = useShake();

  // User-initiated step change — marks hasTransitioned so animate-step-in fires
  function goToStep(next: AuthStep) {
    setHasTransitioned(true);
    setStep(next);
  }

  // If already signed in, skip to the right step (no entrance animation —
  // this is a programmatic redirect, not a user-initiated transition)
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const existingName = user.user_metadata?.name as string | undefined;
      if (existingName) {
        router.replace('/home');
      } else {
        setStep('profile');
      }
    });
  }, [router]);

  // On entering OTP step: start countdown and focus first box
  useEffect(() => {
    if (step !== 'otp') return;
    restart(INITIAL_COOLDOWN);
    setResendState('idle');
    setResendMessage(null);
    inputRefs.current[0]?.focus();
  }, [step, restart]);

  // ── Phone handlers ──────────────────────────────────────────────────────────
  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!INDIAN_PHONE_RE.test(phone)) {
      setPhoneError('Enter a valid 10-digit Indian mobile number.');
      shakePhone();
      return;
    }
    setPhoneError(null);
    setPhoneLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send verification code');
      setDigits(Array(OTP_LENGTH).fill(''));
      setOtpError(null);
      goToStep('otp');
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : 'Something went wrong');
      shakePhone();
    } finally {
      setPhoneLoading(false);
    }
  }

  // ── OTP handlers ────────────────────────────────────────────────────────────
  const otp = digits.join('');
  const isOtpComplete = otp.length === OTP_LENGTH && digits.every(Boolean);

  async function submitOtp(otpValue: string) {
    setOtpError(null);
    setOtpLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: otpValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'EXPIRED_OTP') {
          setOtpError('This code has expired. Request a new code.');
        } else {
          setOtpError('The code you entered is incorrect. Try again.');
        }
        shakeOtp();
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        setOtpLoading(false);
        return;
      }
      const { isNewUser, isAdmin, name: returnedName } = data.data ?? {};
      if (isNewUser) {
        setDigits(Array(OTP_LENGTH).fill(''));
        setOtpLoading(false);
        goToStep('profile');
      } else if (isAdmin) {
        // Full-page reload so the browser re-reads admin session cookies from scratch
        window.location.href = '/admin';
      } else {
        setHasTransitioned(true);
        setWelcomeBackName(returnedName ?? '');
        setTimeout(() => { router.push('/home'); }, 1800);
      }
    } catch {
      setOtpError('Something went wrong. Please try again.');
      shakeOtp();
      setOtpLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setOtpError(null);
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (digit && index === OTP_LENGTH - 1) void submitOtp(next.join(''));
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((d, i) => { next[i] = d; });
    setDigits(next);
    const lastIdx = Math.min(pasted.length, OTP_LENGTH) - 1;
    inputRefs.current[lastIdx]?.focus();
    if (pasted.length === OTP_LENGTH) void submitOtp(pasted);
  }

  async function handleResend() {
    if (seconds > 0 || resendState === 'sending') return;
    setResendState('sending');
    setResendMessage(null);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setResendMessage(data.error ?? 'Too many requests. Please wait before trying again.');
        setResendState('idle');
        return;
      }
      if (!res.ok) {
        setResendMessage("Couldn't send code. Please try again.");
        setResendState('idle');
        return;
      }
      setResendState('sent');
      setResendMessage(`Code resent to +91 ${phone}`);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      restart(RESEND_COOLDOWN);
      setTimeout(() => setResendState('idle'), 3000);
    } catch {
      setResendMessage("Couldn't send code. Please try again.");
      setResendState('idle');
    }
  }

  // ── Profile handlers ─────────────────────────────────────────────────────────
  function handleNameChange(v: string) {
    setName(v);
    if (nameTouched) setNameError(validateName(v));
  }

  function handleNameBlur() {
    setNameTouched(true);
    setNameError(validateName(name));
  }

  async function handleNameContinue() {
    const err = validateName(name);
    if (err) {
      setNameTouched(true);
      setNameError(err);
      shakeName();
      return;
    }
    setNameLoading(true);
    setNameError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNameError(data.error ?? 'Something went wrong. Please try again.');
        shakeName();
        setNameLoading(false);
        return;
      }
      router.push('/home');
    } catch {
      setNameError('Something went wrong. Please try again.');
      shakeName();
      setNameLoading(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const stepKey = welcomeBackName !== null ? 'welcome' : step;
  const baseCls = cn(
    'min-h-screen flex flex-col px-6 py-12 max-w-sm mx-auto w-full',
    hasTransitioned && 'animate-step-in',
  );

  // Transient welcome-back state — Part D
  if (welcomeBackName !== null) {
    return (
      <main key={stepKey} className={cn(baseCls, 'items-center justify-center')}>
        <RoutineSuccess message="Verified" />
        <p className="mt-1 text-sm text-muted text-center">
          {welcomeBackName ? `Welcome back, ${welcomeBackName}.` : 'Welcome back.'}
        </p>
      </main>
    );
  }

  // Phone step — Part A
  if (step === 'phone') {
    const isPhoneValid = INDIAN_PHONE_RE.test(phone);
    return (
      <main key={stepKey} className={baseCls}>
        <h1 className="text-2xl font-bold text-ink">Welcome</h1>
        <p className="mt-2 text-sm text-muted">
          We&apos;ll send you a 6-digit code to verify.
        </p>

        <form onSubmit={handlePhoneSubmit} className="mt-10 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              Phone number
            </label>
            <div className={cn(
              'flex items-center h-control border rounded-token-lg bg-surface-page transition-colors overflow-hidden',
              phoneShaking && 'shake-error',
              phoneError ? 'border-danger' : 'border-border focus-within:border-green',
            )}>
              <span className="px-4 self-stretch flex items-center text-muted font-semibold text-sm shrink-0 border-r border-border select-none">
                +91
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setPhoneError(null);
                }}
                placeholder="Enter your 10-digit number"
                maxLength={10}
                inputMode="numeric"
                required
                className="flex-1 px-4 bg-transparent focus:outline-none text-ink font-semibold placeholder:text-muted placeholder:font-normal text-base"
              />
            </div>
            {phoneError && (
              <p className="mt-1.5 text-xs text-danger font-medium">{phoneError}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={phoneLoading}
            disabled={!isPhoneValid}
            className={cn('w-full rounded-pill', CTA_GLOW)}
          >
            {!phoneLoading && 'Send OTP'}
          </Button>

          <p className="text-xs text-muted text-center pt-1">
            By continuing, you agree to our{' '}
            <Link href="#" className="underline hover:text-ink transition-colors">Terms</Link>
            {' '}&amp;{' '}
            <Link href="#" className="underline hover:text-ink transition-colors">Privacy Policy</Link>.
          </p>
        </form>
      </main>
    );
  }

  // OTP step — Part B
  if (step === 'otp') {
    const resendDisabled = seconds > 0 || resendState === 'sending';
    return (
      <main key={stepKey} className={baseCls}>
        <button
          onClick={() => goToStep('phone')}
          className="text-muted text-sm mb-8 self-start hover:text-ink transition-colors tap-opacity"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-bold text-ink">Enter the code</h1>
        <p className="mt-2 text-sm text-muted">
          Sent to <span className="font-semibold text-ink">+91 {phone}</span>.{' '}
          <button
            onClick={() => goToStep('phone')}
            className="text-green-deep underline hover:no-underline transition-colors"
          >
            Edit
          </button>
        </p>

        <div className={cn('mt-10 flex gap-2.5', otpShaking && 'shake-error')} onPaste={handleOtpPaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)}
              disabled={otpLoading}
              className={cn(
                'flex-1 min-w-0 h-14 text-center text-2xl font-bold text-ink rounded-token-lg border-2 focus:outline-none transition-all duration-150',
                otpError
                  ? 'border-danger bg-danger-soft'
                  : digit
                    ? 'border-green bg-surface-card scale-[1.05]'
                    : 'border-border bg-surface-page focus:border-green focus:bg-green-soft',
              )}
            />
          ))}
        </div>

        {otpError && (
          <p className="mt-4 text-xs text-danger font-medium">{otpError}</p>
        )}

        <div className="mt-8">
          <Button
            onClick={() => void submitOtp(otp)}
            variant="primary"
            size="lg"
            loading={otpLoading}
            disabled={!isOtpComplete}
            className={cn('w-full rounded-pill', CTA_GLOW)}
          >
            {!otpLoading && 'Verify'}
          </Button>
        </div>

        <div className="mt-6 text-center space-y-1.5">
          <p className="text-sm text-muted">
            Didn&apos;t receive a code?{' '}
            {resendDisabled ? (
              <span className="text-muted">
                {resendState === 'sending' ? 'Sending…' : `Resend in ${seconds}s`}
              </span>
            ) : (
              <button
                onClick={() => void handleResend()}
                className="text-green-deep font-semibold underline hover:no-underline transition-colors"
              >
                Resend code
              </button>
            )}
          </p>

          {resendMessage && (
            <p className={cn(
              'text-xs font-medium',
              resendState === 'sent' ? 'text-green-deep' : 'text-danger',
            )}>
              {resendMessage}
            </p>
          )}
        </div>
      </main>
    );
  }

  // Profile step — Part C
  const nameValid = validateName(name) === null;
  return (
    <main key={stepKey} className={baseCls}>
      <div className="flex justify-end">
        <button
          onClick={() => { void handleSignOut(); }}
          disabled={signingOut}
          className="text-xs font-semibold text-muted hover:text-ink transition-colors disabled:opacity-50 tap-opacity"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <h1 className="text-2xl font-bold text-ink">Let&apos;s get started</h1>
        <p className="mt-2 text-muted">First, what should we call you?</p>

        <div className="mt-10 space-y-1.5">
          <label htmlFor="display-name" className="block text-sm font-semibold text-ink">
            Your name
          </label>
          <input
            id="display-name"
            type="text"
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={e => { if (e.key === 'Enter') void handleNameContinue(); }}
            placeholder="Your name"
            maxLength={50}
            autoComplete="name"
            autoFocus
            className={cn(
              'w-full px-4 py-3 rounded-token-lg border text-sm font-medium text-ink placeholder:text-muted',
              'focus:outline-none focus:ring-2 focus:ring-green transition-colors',
              nameShaking && 'shake-error',
              nameError && nameTouched ? 'border-danger bg-danger-soft' : 'border-border bg-surface-card',
            )}
          />
          {nameError && nameTouched ? (
            <p className="text-xs text-danger font-medium">{nameError}</p>
          ) : (
            <p className="text-xs text-muted">
              This is how others on the platform will see you. You can use your nickname or first name.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <Button
          onClick={() => { void handleNameContinue(); }}
          variant="primary"
          size="lg"
          loading={nameLoading}
          disabled={!nameValid || nameLoading}
          className={cn('w-full rounded-pill', CTA_GLOW)}
        >
          {!nameLoading && 'Continue'}
        </Button>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </main>
    }>
      <AuthFlow />
    </Suspense>
  );
}
