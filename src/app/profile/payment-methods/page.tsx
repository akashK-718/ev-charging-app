import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { fetchSavedMethods } from '@/lib/payments/saved-methods.server';
import { PaymentMethodsBody } from '@/components/profile/PaymentMethodsBody';

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

export default async function PaymentMethodsPage() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/auth');

  const admin = createAdminClient();

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

  const profile = userResult.data;

  if (!profile) redirect('/auth');

  const isLender = profile.role === 'lender';
  const kyc = kycResult.data as KycRow | null;

  const { methods } = await fetchSavedMethods(admin, user.id, profile);

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
