-- Migration 041: Budget-based booking — constraint_type / constraint_value
--
-- Adds two columns to bookings so the system records whether a booking was
-- created by time selection (constraint_type = 'duration') or budget selection
-- (constraint_type = 'budget').
--
-- Both types are fully resolved at creation time to a concrete
-- scheduled_start / scheduled_end window. All downstream logic (payment,
-- sweeps, buffer, receipts, Activity) is identical between types.
--
-- constraint_type:  'duration' | 'budget'
-- constraint_value: minutes (duration) | ₹ amount in whole rupees (budget)
--
-- NULL is allowed on both columns so that rows created before this migration
-- (via older API clients) are never rejected. Application code treats NULL as
-- 'duration' when displaying or reporting.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS constraint_type  TEXT
    CHECK (constraint_type IN ('duration', 'budget')),
  ADD COLUMN IF NOT EXISTS constraint_value INTEGER;

-- Re-create create_booking_with_payment to accept + store the new fields.
-- Default NULL on both keeps full backwards compatibility: existing callers
-- (tests, webhooks, older clients) that omit these params continue to work.
CREATE OR REPLACE FUNCTION create_booking_with_payment(
  p_charger_id          uuid,
  p_driver_id           uuid,
  p_lender_id           uuid,
  p_scheduled_start     timestamptz,
  p_scheduled_end       timestamptz,
  p_confirmation_code   text,
  p_gross_amount        integer,
  p_platform_fee        integer,
  p_lender_payout       integer,
  p_razorpay_order_id   text,
  p_razorpay_payment_id text,
  p_vehicle_id          uuid  DEFAULT NULL,
  p_payment_method      text  DEFAULT NULL,
  p_card_network        text  DEFAULT NULL,
  p_card_last4          text  DEFAULT NULL,
  p_constraint_type     text  DEFAULT NULL,
  p_constraint_value    integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking_id uuid;
BEGIN
  -- Idempotency: if this payment_id was already processed (e.g. a retried
  -- verify request), return the existing booking_id immediately.
  SELECT booking_id INTO v_booking_id
    FROM public.payments
    WHERE razorpay_payment_id = p_razorpay_payment_id;
  IF FOUND THEN
    RETURN v_booking_id;
  END IF;

  -- Serialise concurrent booking attempts for the same charger.
  PERFORM id FROM public.chargers WHERE id = p_charger_id FOR UPDATE;

  -- Reject if any active booking's effective window overlaps the requested slot.
  -- Effective window = [scheduled_start, scheduled_end + 15 min buffer).
  IF EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE charger_id = p_charger_id
      AND status IN (
        'pending',
        'confirmed',
        'awaiting_driver_confirmation',
        'in_progress',
        'awaiting_end_confirmation'
      )
      AND tstzrange(scheduled_start, scheduled_end + interval '15 minutes', '[)')
          && tstzrange(p_scheduled_start, p_scheduled_end, '[)')
  ) THEN
    RAISE EXCEPTION 'SLOT_CONFLICT'
      USING HINT = 'The requested time slot overlaps with an existing booking on this charger.';
  END IF;

  INSERT INTO public.bookings (
    charger_id, driver_id, lender_id, scheduled_start, scheduled_end,
    status, confirmation_code, vehicle_id,
    constraint_type, constraint_value
  ) VALUES (
    p_charger_id, p_driver_id, p_lender_id, p_scheduled_start, p_scheduled_end,
    'pending', p_confirmation_code, p_vehicle_id,
    p_constraint_type, p_constraint_value
  )
  RETURNING id INTO v_booking_id;

  INSERT INTO public.payments (
    booking_id, razorpay_order_id, razorpay_payment_id,
    gross_amount, platform_fee, lender_payout, status,
    payment_method, card_network, card_last4
  ) VALUES (
    v_booking_id, p_razorpay_order_id, p_razorpay_payment_id,
    p_gross_amount, p_platform_fee, p_lender_payout, 'paid',
    p_payment_method, p_card_network, p_card_last4
  );

  RETURN v_booking_id;
END;
$$;
