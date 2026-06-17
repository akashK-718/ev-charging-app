'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const OTP_LENGTH = 6;

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') ?? '';

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const { isNewUser, role } = data.data ?? {};
      if (isNewUser) {
        router.push('/welcome');
      } else if (role === 'lender' || role === 'both') {
        router.push('/lender/dashboard');
      } else {
        router.push('/chargers');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
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
    pasted.split('').forEach((d, i) => {
      next[i] = d;
    });
    setDigits(next);
    const lastIdx = Math.min(pasted.length, OTP_LENGTH) - 1;
    inputRefs.current[lastIdx]?.focus();
    if (pasted.length === OTP_LENGTH) {
      submit(pasted);
    }
  }

  return (
    <main className="min-h-screen flex flex-col px-6 py-12">
      <button
        onClick={() => router.back()}
        className="text-muted text-sm mb-8 self-start hover:text-ink transition-colors"
      >
        ← Back
      </button>

      <h1 className="font-display font-extrabold text-3xl text-ink">Enter the code</h1>
      <p className="mt-2 text-muted">
        We sent a 6-digit code to{' '}
        <span className="font-semibold text-volt-deep">+91 {phone}</span>.
      </p>

      <div
        className="mt-10 flex gap-3"
        onPaste={handlePaste}
      >
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={loading}
            className={cn(
              'flex-1 min-w-0 h-14 text-center text-2xl font-bold text-ink rounded-2xl border-2 bg-gray-50 focus:outline-none focus:border-volt transition-colors',
              digit ? 'border-ink' : 'border-gray-200',
              error && 'border-red-400 bg-red-50',
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
          variant="secondary"
          size="lg"
          disabled={!isComplete || loading}
        >
          {loading ? 'Verifying…' : 'Verify'}
        </Button>
      </div>

      <p className="mt-6 text-center text-muted text-sm">
        Didn't receive a code?{' '}
        <button
          onClick={() => router.push('/login')}
          className="text-ink font-semibold underline"
        >
          Try again
        </button>
      </p>
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
