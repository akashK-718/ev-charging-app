import type { SavedMethod } from '../../types/payment';

export function transformToken(token: Record<string, unknown>): SavedMethod | null {
  const id = token.id as string;
  const method = token.method as string;

  if (method === 'card') {
    const card = (token.card ?? {}) as Record<string, unknown>;
    const billingLabel = token.billing_label as string | undefined;
    const last4Match = billingLabel?.match(/\((\d{4})\)$/);
    return {
      id,
      method: 'card',
      cardNetwork: card.network as string | undefined,
      cardLast4: last4Match?.[1] ?? (typeof card.token_iin === 'string' ? card.token_iin.slice(-4) : undefined),
      cardExpiry:
        card.expiry_month && card.expiry_year
          ? `${String(card.expiry_month).padStart(2, '0')}/${String(card.expiry_year).slice(-2)}`
          : undefined,
      cardIssuer: card.issuer as string | undefined,
      billingLabel,
    };
  }

  if (method === 'upi') {
    const upi = (token.upi ?? {}) as Record<string, unknown>;
    return {
      id,
      method: 'upi',
      upiVpa: upi.vpa as string | undefined,
      billingLabel: token.billing_label as string | undefined,
    };
  }

  return null;
}
