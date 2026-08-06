import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NotificationsBody } from '@/components/profile/NotificationsBody';

type PrefsRow = {
  booking_updates: boolean;
  charging_reminders: boolean;
  hosting_activity: boolean;
  kyc_updates: boolean;
  payments_payouts: boolean;
  product_announcements: boolean;
  promotions_offers: boolean;
};

const DEFAULTS: PrefsRow = {
  booking_updates: true,
  charging_reminders: true,
  hosting_activity: true,
  kyc_updates: true,
  payments_payouts: true,
  product_announcements: true,
  promotions_offers: false,
};

export default async function NotificationsPage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const adminSupabase = createAdminClient();
  const { data } = await adminSupabase
    .from('notification_preferences')
    .select('booking_updates,charging_reminders,hosting_activity,kyc_updates,payments_payouts,product_announcements,promotions_offers')
    .eq('user_id', user.id)
    .maybeSingle();

  const prefs: PrefsRow = data ?? DEFAULTS;

  return (
    <main
      className="max-w-lg mx-auto"
      style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <NotificationsBody initialPrefs={prefs} />
    </main>
  );
}
