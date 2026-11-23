'use client';

import { useState, type FormEvent } from 'react';
import { AuthError } from '@/components/auth/AuthError';
import { BackHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { validatePin, validateUsername } from '@/lib/auth/pin';
import type { PinField, PinSession } from '@/lib/auth/pin';
import { AUTH_MESSAGES, validateMobile } from '@/lib/auth/validation';
import { cn } from '@/lib/utils';

type FieldErrors = Partial<Record<PinField, string | undefined>>;
const inputClass = 'w-full h-control px-4 rounded-token-lg border bg-surface-page text-base text-ink focus:outline-none focus:ring-2 focus:ring-green';
const linkClass = 'text-sm font-semibold text-green-deep underline hover:no-underline disabled:opacity-50';

export function PinAuthForm({ onBack, onSignedIn }: {
  onBack: () => void;
  onSignedIn: (result: PinSession) => Promise<boolean>;
}) {
  const [registering, setRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  function clearField(name: PinField) {
    setFieldErrors(previous => ({ ...previous, [name]: undefined }));
    setError(null);
  }

  function changeMode() {
    setRegistering(!registering);
    setPin('');
    setFieldErrors({});
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    const errors: FieldErrors = {
      username: validateUsername(username),
      pin: validatePin(pin),
      phone: registering ? validateMobile(phone) : undefined,
    };
    setFieldErrors(errors);
    const firstInvalid = Object.entries(errors).find(([, message]) => message)?.[0];
    if (firstInvalid) {
      const input = event.currentTarget.elements.namedItem(firstInvalid);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }

    setLoading(true);
    const fallback = registering ? AUTH_MESSAGES.register : AUTH_MESSAGES.signIn;
    try {
      const response = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: registering ? 'register' : 'login', username, pin,
          ...(registering ? { phone } : {}),
        }),
      });
      const result = await response.json().catch(() => null) as {
        error?: string; field?: PinField; data?: PinSession;
      } | null;
      if (!response.ok || !result?.data) {
        if (result?.field && result.error) setFieldErrors({ [result.field]: result.error });
        else setError(result?.error ?? fallback);
        return;
      }
      if (!await onSignedIn(result.data)) setError(AUTH_MESSAGES.session);
    } catch {
      setError(fallback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <BackHeader
        title={registering ? 'Create an account' : 'Sign in with a PIN'}
        onClick={() => { if (!loading) onBack(); }}
        className="-ml-3 px-0 pb-0"
      />

      <form noValidate onSubmit={submit} className="mt-8 space-y-4" aria-busy={loading}>
        <div className="space-y-1.5">
          <label htmlFor="auth-username" className="block text-sm font-semibold text-ink">Username</label>
          <input id="auth-username" name="username" className={cn(inputClass, fieldErrors.username ? 'border-danger' : 'border-border')}
            value={username} required disabled={loading}
            autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={30}
            aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? 'auth-username-error' : undefined}
            onChange={event => { setUsername(event.target.value); clearField('username'); }} />
          <AuthError id="auth-username-error">{fieldErrors.username}</AuthError>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="auth-pin" className="block text-sm font-semibold text-ink">PIN</label>
          <input id="auth-pin" name="pin" className={cn(inputClass, fieldErrors.pin ? 'border-danger' : 'border-border')}
            type="password" value={pin} required disabled={loading}
            inputMode="numeric" pattern="[0-9]{4}"
            aria-invalid={Boolean(fieldErrors.pin)}
            aria-describedby={fieldErrors.pin ? 'auth-pin-error' : 'auth-pin-hint'}
            autoComplete={registering ? 'new-password' : 'current-password'}
            onChange={event => { setPin(event.target.value); clearField('pin'); }} />
          <AuthError id="auth-pin-error">{fieldErrors.pin}</AuthError>
          {!fieldErrors.pin && <p id="auth-pin-hint" className="text-xs text-muted">4 digits.</p>}
        </div>
        {registering && (
          <div className="space-y-1.5">
            <label htmlFor="auth-contact-phone" className="block text-sm font-semibold text-ink">Phone number</label>
            <div className={cn('flex items-center h-control rounded-token-lg border bg-surface-page',
              fieldErrors.phone ? 'border-danger' : 'border-border focus-within:border-green')}>
              <span className="px-4 text-sm font-semibold text-muted">+91</span>
              <input id="auth-contact-phone" name="phone" type="tel" value={phone} required disabled={loading}
                className="min-w-0 flex-1 pr-4 bg-transparent text-base text-ink focus:outline-none"
                autoComplete="tel-national" inputMode="numeric" maxLength={10}
                aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'auth-phone-error' : 'auth-phone-hint'}
                onChange={event => { setPhone(event.target.value.replace(/\D/g, '').slice(0, 10)); clearField('phone'); }} />
            </div>
            <AuthError id="auth-phone-error">{fieldErrors.phone}</AuthError>
            {!fieldErrors.phone && <p id="auth-phone-hint" className="text-xs text-muted">For booking contact. We won&apos;t send an SMS.</p>}
          </div>
        )}
        <AuthError>{error}</AuthError>
        <PrimaryButton type="submit" size="lg" loading={loading} className="w-full rounded-pill">
          {registering ? 'Create account' : 'Sign in'}
        </PrimaryButton>
      </form>

      <div className="mt-4 flex flex-col items-center gap-3">
        <button type="button" onClick={changeMode} disabled={loading} className={linkClass}>
          {registering ? 'Already have an account? Sign in' : 'New to Kirin? Create an account'}
        </button>
      </div>
    </>
  );
}
