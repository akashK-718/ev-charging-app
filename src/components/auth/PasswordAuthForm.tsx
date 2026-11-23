'use client';

import { useState, type FormEvent } from 'react';
import { BackHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MOBILE_PATTERN, normalizeUsername, PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, passwordByteLength, USERNAME_PATTERN } from '@/lib/auth/password';
import type { PasswordSession } from '@/lib/auth/password';

const fieldClass = 'w-full h-control px-4 rounded-token-lg border border-border bg-surface-page text-base text-ink focus:outline-none focus:ring-2 focus:ring-green';

export function PasswordAuthForm({ onBack, onSignedIn }: {
  onBack: () => void;
  onSignedIn: (result: PasswordSession) => Promise<void>;
}) {
  const [registering, setRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (registering) {
      if (!USERNAME_PATTERN.test(normalizeUsername(username))) {
        setError('Use 3–30 letters, numbers, or underscores, starting with a letter.');
        return;
      }
      if (Array.from(password).length < PASSWORD_MIN_LENGTH || passwordByteLength(password) > PASSWORD_MAX_BYTES) {
        setError('Use at least 12 characters and at most 72 bytes for your password.');
        return;
      }
      if (!MOBILE_PATTERN.test(phone)) {
        setError('Enter a valid 10-digit Indian mobile number.');
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: registering ? 'register' : 'login', username, password,
          ...(registering ? { phone } : {}),
        }),
      });
      const result = await response.json() as { error?: string; data?: PasswordSession };
      if (!response.ok || !result.data) throw new Error(result.error ?? 'Could not sign in. Please try again.');
      await onSignedIn(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setRegistering(!registering);
    setPassword('');
    setError(null);
  }

  return (
    <>
      <BackHeader
        title={registering ? 'Create an account' : 'Sign in with a password'}
        onClick={() => { if (!loading) onBack(); }}
        className="-ml-3 px-0 pb-0"
      />

      <form onSubmit={submit} className="mt-8 space-y-4" aria-busy={loading}>
        <div className="space-y-1.5">
          <label htmlFor="auth-username" className="block text-sm font-semibold text-ink">Username</label>
          <input id="auth-username" className={fieldClass} value={username} required disabled={loading}
            autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={30}
            onChange={event => { setUsername(event.target.value); setError(null); }} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="auth-password" className="block text-sm font-semibold text-ink">Password</label>
          <input id="auth-password" className={fieldClass} type="password" value={password} required disabled={loading}
            aria-describedby={registering ? 'auth-password-hint' : undefined}
            autoComplete={registering ? 'new-password' : 'current-password'} maxLength={PASSWORD_MAX_BYTES}
            onChange={event => { setPassword(event.target.value); setError(null); }} />
          {registering && <p id="auth-password-hint" className="text-xs text-muted">At least 12 characters.</p>}
        </div>
        {registering && (
          <div className="space-y-1.5">
            <label htmlFor="auth-contact-phone" className="block text-sm font-semibold text-ink">Phone number</label>
            <div className="flex items-center h-control rounded-token-lg border border-border bg-surface-page focus-within:border-green">
              <span className="px-4 text-sm font-semibold text-muted">+91</span>
              <input id="auth-contact-phone" type="tel" value={phone} required disabled={loading}
                className="min-w-0 flex-1 pr-4 bg-transparent text-base text-ink focus:outline-none"
                autoComplete="tel-national" inputMode="numeric" maxLength={10} aria-describedby="auth-phone-hint"
                onChange={event => { setPhone(event.target.value.replace(/\D/g, '').slice(0, 10)); setError(null); }} />
            </div>
            <p id="auth-phone-hint" className="text-xs text-muted">For booking contact. We won&apos;t send an SMS.</p>
          </div>
        )}
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        <PrimaryButton type="submit" size="lg" loading={loading} className="w-full rounded-pill">
          {registering ? 'Create account' : 'Sign in'}
        </PrimaryButton>
      </form>

      <div className="mt-4 text-center">
        <button type="button" onClick={switchMode} disabled={loading}
          className="text-sm font-semibold text-green-deep underline hover:no-underline disabled:opacity-50">
          {registering ? 'Already have an account? Sign in' : 'New to Kirin? Create an account'}
        </button>
      </div>
    </>
  );
}
