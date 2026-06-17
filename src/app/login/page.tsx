'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send OTP');

      router.push(`/verify-otp?phone=${encodeURIComponent(phone)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col px-6 py-12">
      <h1 className="font-display font-extrabold text-3xl text-ink">
        Welcome
      </h1>
      <p className="mt-2 text-muted">
        Enter your phone number to get started.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Phone number
          </label>
          <div className="flex gap-2">
            <span className="px-4 py-3 bg-gray-100 rounded-2xl font-semibold text-ink">
              +91
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              maxLength={10}
              required
              className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-volt"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-sm font-semibold">{error}</p>
        )}

        <Button
          type="submit"
          variant="secondary"
          size="lg"
          disabled={loading || phone.length !== 10}
        >
          {loading ? 'Sending OTP…' : 'Send OTP'}
        </Button>
      </form>
    </main>
  );
}
