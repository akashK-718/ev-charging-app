-- Stores per-user push notification category preferences.
-- Security alerts are enforced in application code and are not stored here.
-- Promotions & offers defaults to false; all other toggleable categories default to true.
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id               uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  booking_updates       boolean NOT NULL DEFAULT true,
  charging_reminders    boolean NOT NULL DEFAULT true,
  hosting_activity      boolean NOT NULL DEFAULT true,
  kyc_updates           boolean NOT NULL DEFAULT true,
  payments_payouts      boolean NOT NULL DEFAULT true,
  product_announcements boolean NOT NULL DEFAULT true,
  promotions_offers     boolean NOT NULL DEFAULT false,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prefs_select_own" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "prefs_modify_own" ON public.notification_preferences
  FOR ALL USING (auth.uid() = user_id);
