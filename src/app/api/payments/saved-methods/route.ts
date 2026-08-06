import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getRazorpay } from '@/lib/razorpay';

export type SavedMethod = {
  id: string;
  method: 'card' | 'upi';
  // Card fields
  cardNetwork?: string;
  cardLast4?: string;
  cardExpiry?: string;
  cardIssuer?: string;
  // UPI fields
  upiVpa?: string;
  // Razorpay's own display label (may not always be present)
  billingLabel?: string;
};

function transformToken(token: Record<string, unknown>): SavedMethod | null {
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

/**
 * GET /api/payments/saved-methods
 *
 * Lazily creates a Razorpay customer for this user if one doesn't exist,
 * then returns their saved payment tokens (UPI + cards).
 *
 * razorpay_customer_id and default_payment_token_id are added via migration 033
 * and are not yet in the generated Supabase types, so we use `any` casts.
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: userRow } = await admin
    .from('users')
    .select('name, phone, razorpay_customer_id, default_payment_token_id')
    .eq('id', user.id)
    .single();

  if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const row = userRow as {
    name: string | null;
    phone: string;
    razorpay_customer_id: string | null;
    default_payment_token_id: string | null;
  };

  let customerId = row.razorpay_customer_id;

  try {
    const rp = getRazorpay();

    // Lazily create Razorpay customer — fail_existing:0 returns the existing
    // customer rather than erroring if the contact number is already registered.
    if (!customerId) {
      const customer = (await rp.customers.create({
        name: row.name ?? 'Kirin User',
        contact: row.phone,
        fail_existing: 0,
      })) as unknown as { id: string };

      customerId = customer.id;
      await admin.from('users').update({ razorpay_customer_id: customerId }).eq('id', user.id);
    }

    const tokenResponse = (await rp.customers.fetchTokens(customerId)) as unknown as {
      items?: Record<string, unknown>[];
    };

    const items = tokenResponse.items ?? [];
    const methods: SavedMethod[] = items.reduce<SavedMethod[]>((acc, t) => {
      const m = transformToken(t);
      if (m) acc.push(m);
      return acc;
    }, []);

    return NextResponse.json({
      methods,
      defaultTokenId: row.default_payment_token_id,
      customerId,
    });
  } catch (err) {
    console.warn('[saved-methods] Razorpay error:', err);
    // Razorpay not configured or network error — return empty gracefully
    return NextResponse.json({
      methods: [],
      defaultTokenId: row.default_payment_token_id,
      customerId,
    });
  }
}
