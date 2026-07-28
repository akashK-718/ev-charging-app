-- Migration 029: Add slot-conflict guard to create_booking_with_payment
--
-- Previously the function performed a raw INSERT with no overlap check, making
-- double-bookings on the same charger possible. This migration replaces it to:
--
--   1. Lock the charger row (FOR UPDATE) to serialise concurrent requests.
--   2. Reject the booking if any active booking's effective blocking window
--      [scheduled_start, scheduled_end + 15 min) overlaps the requested window.
--      "pending" counts as blocking — prevents two drivers racing for the same
--      slot before the host has responded.
--
-- The 15-minute buffer value (BOOKING_BUFFER_MINUTES) is a Phase-2 placeholder.
-- When it is promoted to an admin-configurable value, update the interval here
-- alongside the TypeScript getter in src/lib/bookings/availability.ts.

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
  p_razorpay_payment_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking_id uuid;
BEGIN
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
    status, confirmation_code
  ) VALUES (
    p_charger_id, p_driver_id, p_lender_id, p_scheduled_start, p_scheduled_end,
    'pending', p_confirmation_code
  )
  RETURNING id INTO v_booking_id;

  INSERT INTO public.payments (
    booking_id, razorpay_order_id, razorpay_payment_id,
    gross_amount, platform_fee, lender_payout, status
  ) VALUES (
    v_booking_id, p_razorpay_order_id, p_razorpay_payment_id,
    p_gross_amount, p_platform_fee, p_lender_payout, 'paid'
  );

  RETURN v_booking_id;
END;
$$;
