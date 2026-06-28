'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

const NAME_REGEX = /^[\p{L}\s]{2,50}$/u;

function validateName(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) return 'Name is required.';
  if (trimmed.length < 2) return 'Name must be at least 2 characters.';
  if (trimmed.length > 50) return 'Name must be 50 characters or fewer.';
  if (!NAME_REGEX.test(trimmed)) return 'Name can only contain letters and spaces.';
  return null;
}

export default function CollectNamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/chargers';

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const err = validateName(name);
    if (err) { setTouched(true); setError(err); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save. Please try again.');
        setLoading(false);
        return;
      }
      router.push(next);
    } catch {
      setError('Could not save. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col justify-center px-6 py-12 max-w-sm mx-auto">
      <h1 className="font-display font-extrabold text-3xl text-ink">One quick thing</h1>
      <p className="mt-2 text-muted">
        We&apos;d like to know what to call you on the platform.
      </p>

      <div className="mt-8 space-y-1.5">
        <label htmlFor="display-name" className="block text-sm font-semibold text-ink">
          What should we call you?
        </label>
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); if (touched) setError(validateName(e.target.value)); }}
          onBlur={() => { setTouched(true); setError(validateName(name)); }}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="Your name"
          maxLength={50}
          autoComplete="name"
          autoFocus
          className={cn(
            'w-full px-4 py-3 rounded-2xl border text-sm font-medium text-ink placeholder:text-muted',
            'focus:outline-none focus:ring-2 focus:ring-volt transition-colors',
            error && touched ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white',
          )}
        />
        {error && touched ? (
          <p className="text-xs text-red-600 font-medium">{error}</p>
        ) : (
          <p className="text-xs text-muted">
            This is how others on the platform will see you. You can use your nickname or first name.
          </p>
        )}
      </div>

      <div className="mt-8">
        <Button
          onClick={handleSubmit}
          variant="secondary"
          size="lg"
          disabled={!name.trim() || loading}
        >
          {loading ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </main>
  );
}
