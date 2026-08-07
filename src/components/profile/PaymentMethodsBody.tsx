'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CreditCard, Smartphone, Info, Banknote, CheckCircle2, Trash2, Star } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { cn } from '@/lib/utils';
import type { SavedMethod } from '@/app/api/payments/saved-methods/route';

// ─── helpers ─────────────────────────────────────────────────────────────────

function cardLabel(m: SavedMethod): string {
  if (m.billingLabel) return m.billingLabel;
  const network = m.cardNetwork ?? 'Card';
  const last4 = m.cardLast4 ? ` (${m.cardLast4})` : '';
  const issuer = m.cardIssuer ? `${m.cardIssuer} ` : '';
  return `${issuer}${network}${last4}`;
}

function cardSublabel(m: SavedMethod): string | undefined {
  return m.cardExpiry ? `Expires ${m.cardExpiry}` : undefined;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-wider uppercase text-muted mb-2 px-4">
      {children}
    </p>
  );
}

function MethodCard({
  icon,
  label,
  sublabel,
  isDefault,
  onSetDefault,
  onRemove,
  removing,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  isDefault: boolean;
  onSetDefault: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <div className="bg-surface-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3">
      <div className="size-9 rounded-xl bg-green-soft text-green-deep grid place-items-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate">{label}</p>
        {sublabel && <p className="text-xs text-muted">{sublabel}</p>}
        {isDefault && (
          <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold text-green-deep">
            <Star className="w-2.5 h-2.5 fill-current" aria-hidden />
            Default
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!isDefault && (
          <button
            onClick={onSetDefault}
            aria-label="Set as default"
            className="p-2 rounded-xl text-muted hover:text-green-deep hover:bg-green-soft transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden />
          </button>
        )}
        <button
          onClick={onRemove}
          disabled={removing}
          aria-label="Remove payment method"
          className="p-2 rounded-xl text-muted hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-40"
        >
          <Trash2 className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function EmptySection({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-muted">
      <div className="size-8 rounded-xl bg-surface-page border border-border grid place-items-center shrink-0">
        {icon}
      </div>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function PaymentMethodsBody({
  initialMethods,
  defaultTokenId,
  isLender,
  payoutDisplay,
  kycStatus,
}: {
  initialMethods: SavedMethod[];
  defaultTokenId: string | null;
  isLender: boolean;
  payoutDisplay: string | null;
  /** Actual account-level KYC status — used to route payout CTA correctly. */
  kycStatus: 'not_started' | 'pending' | 'approved' | 'rejected' | null;
}) {
  const router = useRouter();
  const [methods, setMethods] = useState<SavedMethod[]>(initialMethods);
  const [defaultId, setDefaultId] = useState<string | null>(defaultTokenId);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = useCallback(async (tokenId: string) => {
    setRemovingId(tokenId);
    // Optimistic remove
    setMethods(prev => prev.filter(m => m.id !== tokenId));
    if (defaultId === tokenId) setDefaultId(null);

    try {
      const res = await fetch(`/api/payments/saved-methods/${tokenId}`, { method: 'DELETE' });
      if (!res.ok) {
        // Rollback on failure — refetch by reloading
        router.refresh();
      }
    } catch {
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  }, [defaultId, router]);

  const handleSetDefault = useCallback(async (tokenId: string) => {
    const prev = defaultId;
    setDefaultId(tokenId); // Optimistic
    try {
      const res = await fetch(`/api/payments/saved-methods/${tokenId}/set-default`, { method: 'POST' });
      if (!res.ok) setDefaultId(prev);
    } catch {
      setDefaultId(prev);
    }
  }, [defaultId]);

  const upiMethods = methods.filter(m => m.method === 'upi');
  const cardMethods = methods.filter(m => m.method === 'card');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-6">
        <BackButton onClick={() => router.back()} />
        <h1 className="text-xl font-bold text-ink">Payment Methods</h1>
      </div>

      <div className="space-y-6 px-4">

        {/* UPI section */}
        <section aria-label="UPI">
          <SectionLabel>UPI</SectionLabel>
          <div className="space-y-2">
            {upiMethods.length === 0 ? (
              <EmptySection
                icon={<Smartphone className="w-3.5 h-3.5" />}
                message="No UPI addresses saved"
              />
            ) : (
              upiMethods.map(m => (
                <MethodCard
                  key={m.id}
                  icon={<Smartphone className="w-4 h-4" />}
                  label={m.upiVpa ?? m.billingLabel ?? 'UPI'}
                  isDefault={m.id === defaultId}
                  onSetDefault={() => handleSetDefault(m.id)}
                  onRemove={() => handleRemove(m.id)}
                  removing={removingId === m.id}
                />
              ))
            )}
          </div>
        </section>

        {/* Cards section */}
        <section aria-label="Cards">
          <SectionLabel>Cards</SectionLabel>
          <div className="space-y-2">
            {cardMethods.length === 0 ? (
              <EmptySection
                icon={<CreditCard className="w-3.5 h-3.5" />}
                message="No cards saved"
              />
            ) : (
              cardMethods.map(m => (
                <MethodCard
                  key={m.id}
                  icon={<CreditCard className="w-4 h-4" />}
                  label={cardLabel(m)}
                  sublabel={cardSublabel(m)}
                  isDefault={m.id === defaultId}
                  onSetDefault={() => handleSetDefault(m.id)}
                  onRemove={() => handleRemove(m.id)}
                  removing={removingId === m.id}
                />
              ))
            )}
          </div>
        </section>

        {/* How methods are added */}
        <div className="flex gap-3 bg-surface-page border border-border rounded-2xl px-4 py-3.5">
          <Info className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-muted leading-relaxed">
            Payment methods you save during checkout appear here. When paying for a booking,
            choose "Save for later" to store your UPI or card.
          </p>
        </div>

        {/* Receiving Payouts — lenders only */}
        {isLender && (
          <section aria-label="Receiving Payouts">
            <SectionLabel>Receiving Payouts</SectionLabel>
            <div className="bg-surface-card border border-border rounded-2xl px-4 py-3.5">
              {payoutDisplay ? (
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-green-soft text-green-deep grid place-items-center shrink-0">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Payout account</p>
                    <p className="text-xs text-muted font-mono mt-0.5">{payoutDisplay}</p>
                    <p className="text-[11px] text-muted mt-1.5">
                      Earnings from each session are sent here automatically.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-surface-page border border-border text-muted grid place-items-center shrink-0">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">No payout account set up</p>
                    <p className="text-xs text-muted mt-0.5">
                      Add a bank account or UPI to receive earnings from hosting.
                    </p>
                  </div>
                </div>
              )}
              {/*
               * Approved users go to /profile/payout-details — a lightweight
               * form that only updates bank/UPI without re-collecting identity
               * documents. All other statuses go to the full KYC wizard since
               * documents are not yet on file (or were rejected and need re-upload).
               */}
              <Link
                href={kycStatus === 'approved' ? '/profile/payout-details' : '/profile/verify'}
                className="mt-3 flex items-center justify-center w-full min-h-[44px] rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surface-page transition-colors"
              >
                {kycStatus === 'approved' ? 'Manage payout details' : 'Set up payout account'}
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
