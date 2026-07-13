'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

// Allows letters (including Unicode for Indian scripts) and spaces, 2–50 chars
const NAME_REGEX = /^[\p{L}\s]{2,50}$/u;

function validateName(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) return 'Name is required.';
  if (trimmed.length < 2) return 'Name must be at least 2 characters.';
  if (trimmed.length > 50) return 'Name must be 50 characters or fewer.';
  if (!NAME_REGEX.test(trimmed)) return 'Name can only contain letters and spaces.';
  return null;
}

export function WelcomeNameForm({ initialName, intent }: { initialName: string; intent?: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const nameValid = validateName(name) === null;

  function handleChange(v: string) {
    setName(v);
    if (touched) setError(validateName(v));
  }

  function handleBlur() {
    setTouched(true);
    setError(validateName(name));
  }

  async function handleContinue() {
    const nameErr = validateName(name);
    if (nameErr) {
      setTouched(true);
      setError(nameErr);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }
      router.push(intent ? `/welcome/role?intent=${intent}` : '/welcome/role');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <main className="min-h-screen flex flex-col px-6 py-12 max-w-sm mx-auto w-full">
      <div className="flex justify-end">
        <button
          onClick={() => { void handleSignOut(); }}
          disabled={signingOut}
          className="text-xs font-semibold text-muted hover:text-ink transition-colors disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <h1 className="text-2xl font-medium text-ink">Let&apos;s get started</h1>
        <p className="mt-2 text-muted">First, what should we call you?</p>

        <div className="mt-10 space-y-1.5">
          <label htmlFor="display-name" className="block text-sm font-semibold text-ink">
            Your name
          </label>
          <input
            id="display-name"
            type="text"
            value={name}
            onChange={e => handleChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={e => { if (e.key === 'Enter') void handleContinue(); }}
            placeholder="Your name"
            maxLength={50}
            autoComplete="name"
            autoFocus
            className={cn(
              'w-full px-4 py-3 rounded-xl border text-sm font-medium text-ink placeholder:text-muted',
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
      </div>

      <div className="mt-8">
        <Button
          onClick={() => { void handleContinue(); }}
          variant="secondary"
          size="lg"
          disabled={!nameValid || loading}
        >
          {loading ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </main>
  );
}
