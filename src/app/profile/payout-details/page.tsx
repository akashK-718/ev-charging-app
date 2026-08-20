'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { cn } from '@/lib/utils';

type PaymentMethod = 'bank' | 'upi';

export default function PayoutDetailsPage() {
  const router = useRouter();

  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [upiId, setUpiId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isValid = method === 'bank'
    ? bankAccount.trim().length > 5 && bankIfsc.trim().length === 11
    : upiId.trim().length > 3;

  async function handleSubmit() {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const payload = method === 'bank'
      ? { bank_account_number: bankAccount.trim(), bank_ifsc: bankIfsc.trim().toUpperCase() }
      : { upi_id: upiId.trim() };

    try {
      const res = await fetch('/api/lender/payout-details', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setSubmitError(data.error ?? 'Failed to update. Please try again.');
        return;
      }

      router.push('/profile/payment-methods');
    } catch {
      setSubmitError('Failed to update. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className="max-w-lg mx-auto min-h-screen flex flex-col pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:pb-10"
    >
      <PageHeader title="Payout details" onClick={() => router.back()} />

      <div className="flex-1 space-y-6 px-4">
        <p className="text-sm text-muted">
          Choose how you want to receive your earnings. This updates your payout account
          without affecting your verified identity documents.
        </p>

        {/* Method toggle */}
        <div className="flex rounded-xl overflow-hidden border border-border">
          <button
            type="button"
            onClick={() => setMethod('upi')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors',
              method === 'upi' ? 'bg-ink text-white' : 'bg-surface-card text-muted hover:text-ink',
            )}
          >
            <CreditCard className="w-4 h-4" />
            UPI
          </button>
          <button
            type="button"
            onClick={() => setMethod('bank')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors',
              method === 'bank' ? 'bg-ink text-white' : 'bg-surface-card text-muted hover:text-ink',
            )}
          >
            <Building2 className="w-4 h-4" />
            Bank account
          </button>
        </div>

        {/* Fields */}
        {method === 'upi' ? (
          <div className="space-y-1">
            <label className="text-sm font-semibold text-ink" htmlFor="upi_id">
              UPI ID
            </label>
            <input
              id="upi_id"
              type="text"
              placeholder="yourname@upi"
              value={upiId}
              onChange={e => setUpiId(e.target.value.trim())}
              className="w-full rounded-xl border border-border px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green bg-surface-card"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-ink" htmlFor="bank_acc">
                Account number
              </label>
              <input
                id="bank_acc"
                type="tel"
                inputMode="numeric"
                placeholder="Enter account number"
                value={bankAccount}
                onChange={e => setBankAccount(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-xl border border-border px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green bg-surface-card"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-ink" htmlFor="bank_ifsc">
                IFSC code
              </label>
              <input
                id="bank_ifsc"
                type="text"
                maxLength={11}
                placeholder="e.g. SBIN0001234"
                value={bankIfsc}
                onChange={e => setBankIfsc(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-border px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green bg-surface-card font-mono"
              />
            </div>
          </div>
        )}

        {submitError && (
          <p className="px-4 py-3 bg-danger-soft rounded-xl text-sm text-danger font-semibold">
            {submitError}
          </p>
        )}
      </div>

      <div className="mt-8 px-4">
        <PrimaryButton
          size="lg"
          className="w-full"
          disabled={!isValid || isSubmitting}
          onClick={() => { void handleSubmit(); }}
        >
          {isSubmitting ? 'Saving…' : 'Save payout details'}
        </PrimaryButton>
      </div>
    </main>
  );
}
