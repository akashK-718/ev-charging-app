import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getRazorpay } from '@/lib/razorpay';
import { PaymentMethodsBody } from '@/components/profile/PaymentMethodsBody';
import type { SavedMethod } from '@/app/api/payments/saved-methods/route';

type KycRow = {
  bank_account_number: string | null;
  bank_ifsc: string | null;
  upi_id: string | null;
  status: string;
};

function buildPayoutDisplay(kyc: KycRow | null): string | null {
  if (!kyc) return null;
  if (kyc.upi_id) return `UPI: ${kyc.upi_id}`;
  if (kyc.bank_account_number && kyc.bank_ifsc) {
    const last4 = kyc.bank_account_number.slice(-4);
    return `Bank: ****${last4} · ${kyc.bank_ifsc}`;
  }
  return null;
}

async function fetchSavedMethods(
  customerId: string | null,
  userName: string | null,
  phone: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<{ methods: SavedMethod[]; customerId: string | null }> {
  try {
    const rp = getRazorpay();
    let cid = customerId;

    if (!cid) {
      const customer = (await rp.customers.create({
        name: userName ?? 'Kirin User',
        contact: phone,
        fail_existing: 0,
      })) as unknown as { id: string };
      cid = customer.id;
      await admin.from('users').update({ razorpay_customer_id: cid }).eq('id', userId);
    }

    const tokenResponse = (await rp.customers.fetchTokens(cid)) as unknown as {
      items?: Record<string, unknown>[];
    };

    const items = tokenResponse.items ?? [];
    const methods = items.reduce<SavedMethod[]>((acc, t) => {
      const method = t.method as string;
      if (method === 'card') {
        const card = ((t.card ?? {}) as Record<string, unknown>);
        const billingLabel = t.billing_label as string | undefined;
        const last4Match = billingLabel?.match(/\((\d{4})\)$/);
        acc.push({
          id: t.id as string,
          method: 'card',
          cardNetwork: card.network as string | undefined,
          cardLast4: last4Match?.[1] ?? (typeof card.token_iin === 'string' ? card.token_iin.slice(-4) : undefined),
          cardExpiry: card.expiry_month && card.expiry_year
            ? `${String(card.expiry_month).padStart(2, '0')}/${String(card.expiry_year).slice(-2)}`
            : undefined,
          cardIssuer: card.issuer as string | undefined,
          billingLabel,
        });
      } else if (method === 'upi') {
        const upi = ((t.upi ?? {}) as Record<string, unknown>);
        acc.push({
          id: t.id as string,
          method: 'upi',
          upiVpa: upi.vpa as string | undefined,
          billingLabel: t.billing_label as string | undefined,
        });
      }
      return acc;
    }, []);

    return { methods, customerId: cid };
  } catch {
    return { methods: [], customerId };
  }
}

export default async function PaymentMethodsPage() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/auth');

  // razorpay_customer_id and default_payment_token_id are added via migration 033
  // and are not yet in the generated Supabase types — use any cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const [userResult, kycResult] = await Promise.all([
    admin
      .from('users')
      .select('name, phone, role, razorpay_customer_id, default_payment_token_id')
      .eq('id', user.id)
      .single(),
    admin
      .from('kyc_submissions')
      .select('bank_account_number, bank_ifsc, upi_id, status')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = userResult.data as {
    name: string | null;
    phone: string;
    role: string;
    razorpay_customer_id: string | null;
    default_payment_token_id: string | null;
  } | null;

  if (!profile) redirect('/auth');

  const isLender = profile.role === 'lender';
  const kyc = kycResult.data as KycRow | null;

  const { methods } = await fetchSavedMethods(
    profile.razorpay_customer_id,
    profile.name,
    profile.phone,
    user.id,
    admin,
  );

  const kycStatus = (kyc?.status ?? 'not_started') as
    'not_started' | 'pending' | 'approved' | 'rejected';

  return (
    <main
      className="max-w-lg mx-auto pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:pb-10"
    >
      <PaymentMethodsBody
        initialMethods={methods}
        defaultTokenId={profile.default_payment_token_id}
        isLender={isLender}
        payoutDisplay={isLender ? buildPayoutDisplay(kyc) : null}
        kycStatus={isLender ? kycStatus : null}
      />
    </main>
  );
}
