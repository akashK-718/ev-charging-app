'use client';

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const OTP_LENGTH = 6;
const INITIAL_COOLDOWN = 30;
const RESEND_COOLDOWN = 60;

function useCountdown(initial: number) {
  const [seconds, setSeconds] = useState(initial);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback((from: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSeconds(from);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    start(initial);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [initial, start]);

  return { seconds, restart: start };
}

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') ?? '';
  const intent = searchParams.get('intent') ?? '';

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const { seconds, restart } = useCountdown(INITIAL_COOLDOWN);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const otp = digits.join('');
  const isComplete = otp.length === OTP_LENGTH && digits.every(Boolean);

  useEffect(() => {
    if (!phone) {
      router.replace('/login');
      return;
    }
    inputRefs.current[0]?.focus();
  }, [phone, router]);

  async function submit(otpValue: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: otpValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Incorrect code. Please try again.');
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }
      const { isNewUser, role, isAdmin } = data.data ?? {};
      // Full-page navigation so the browser Supabase client re-reads the
      // session cookies that were set server-side, triggering onAuthStateChange
      // and preventing a blank navbar on first login.
      if (isNewUser) {
        window.location.href = intent ? `/welcome/name?intent=${intent}` : '/welcome/name';
      } else if (isAdmin) {
        window.location.href = '/admin';
      } else if (role === 'lender' || role === 'both') {
        window.location.href = '/lender/dashboard';
      } else {
        window.location.href = '/chargers';
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
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

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError(null);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-submit on last digit
    if (digit && index === OTP_LENGTH - 1) {
      submit(next.join(''));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((d, i) => { next[i] = d; });
    setDigits(next);
    const lastIdx = Math.min(pasted.length, OTP_LENGTH) - 1;
    inputRefs.current[lastIdx]?.focus();
    if (pasted.length === OTP_LENGTH) submit(pasted);
  }

  const resendDisabled = seconds > 0 || resendState === 'sending';

  return (
    <main className="min-h-screen flex flex-col px-6 py-12 animate-page-in">
      <button
        onClick={() => router.back()}
        className="text-muted text-sm mb-8 self-start hover:text-ink transition-colors"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-medium text-ink">Enter the code</h1>
      <p className="mt-2 text-sm text-muted">
        Sent to{' '}
        <span className="text-muted">+91</span>{' '}
        <span className="font-semibold text-ink">{phone}</span>.{' '}
        <button
          onClick={() => router.push('/login')}
          className="text-volt-deep underline hover:no-underline transition-colors"
        >
          Edit
        </button>
      </p>

      {/* OTP boxes */}
      <div className="mt-10 flex gap-2.5" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={loading}
            className={cn(
              'flex-1 min-w-0 h-14 text-center text-2xl font-bold text-ink rounded-2xl border-2 focus:outline-none transition-all duration-150',
              error
                ? 'border-red-400 bg-red-50'
                : digit
                  ? 'border-volt bg-white scale-[1.05]'
                  : 'border-gray-200 bg-gray-50 focus:border-volt focus:bg-volt-soft',
            )}
          />
        ))}
      </div>

      {error && (
        <p className="mt-4 text-red-600 text-sm font-semibold">{error}</p>
      )}

      <div className="mt-8">
        <Button
          onClick={() => submit(otp)}
          variant="primary"
          size="lg"
          loading={loading}
          disabled={!isComplete}
        >
          {loading ? 'Verifying…' : 'Verify'}
        </Button>
      </div>

      {/* Resend section */}
      <div className="mt-6 text-center space-y-1.5">
        <p className="text-sm text-muted">
          Didn&apos;t receive a code?{' '}
          {resendDisabled ? (
            <span className="text-muted">
              {resendState === 'sending' ? 'Sending…' : `Resend in ${seconds}s`}
            </span>
          ) : (
            <button
              onClick={handleResend}
              className="text-volt-deep font-semibold underline hover:no-underline transition-colors"
            >
              Resend code
            </button>
          )}
        </p>

        {resendMessage && (
          <p className={cn(
            'text-sm',
            resendState === 'sent' ? 'text-volt-deep' : 'text-red-600',
          )}>
            {resendMessage}
          </p>
        )}
      </div>
    </main>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-muted">Loading…</p>
        </main>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
