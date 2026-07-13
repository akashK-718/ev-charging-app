'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = searchParams.get('intent') ?? '';

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = phone.length === 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send OTP');

      const params = new URLSearchParams({ phone });
      if (intent) params.set('intent', intent);
      router.push(`/verify-otp?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col px-6 py-12 animate-page-in">
      <h1 className="text-2xl font-medium text-ink">Welcome</h1>
      <p className="mt-2 text-muted text-sm">
        We&apos;ll send you a 6-digit code to verify.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Phone number
          </label>

          {/* Unified phone input */}
          <div
            className={cn(
              'flex items-center h-12 border-2 rounded-xl bg-gray-50 transition-colors overflow-hidden',
              error ? 'border-red-400' : 'border-gray-200 focus-within:border-volt',
            )}
          >
            <span className="px-4 self-stretch flex items-center text-muted font-semibold text-sm shrink-0 border-r-2 border-gray-200 select-none">
              +91
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Enter your 10-digit number"
              maxLength={10}
              inputMode="numeric"
              required
              className="flex-1 px-4 bg-transparent focus:outline-none text-ink font-semibold placeholder:text-muted placeholder:font-normal text-base"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-sm font-semibold">{error}</p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          disabled={!isValid}
        >
          {loading ? 'Sending…' : 'Send OTP'}
        </Button>

        <p className="text-xs text-muted text-center pt-1">
          By continuing, you agree to our{' '}
          <Link href="#" className="underline hover:text-ink transition-colors">Terms</Link>
          {' '}
          &amp;{' '}
          <Link href="#" className="underline hover:text-ink transition-colors">Privacy Policy</Link>
          .
        </p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-muted">Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
