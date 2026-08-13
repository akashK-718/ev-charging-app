-- Migration 035: Add optional vehicle_id to bookings for analytics
--
-- Drivers can attach a vehicle from their garage to a booking so we know
-- which vehicle was charged. NULL is always valid — this is analytics-only,
-- never required for booking creation.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- Index: future queries filtering by vehicle (e.g. "sessions for this vehicle")
CREATE INDEX IF NOT EXISTS bookings_vehicle_id_idx
  ON public.bookings (vehicle_id)
  WHERE vehicle_id IS NOT NULL;

-- Re-create create_booking_with_payment with optional p_vehicle_id parameter.
-- Default NULL keeps backwards compatibility — existing callers work unchanged.
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
  p_vehicle_id          uuid DEFAULT NULL
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
    status, confirmation_code, vehicle_id
  ) VALUES (
    p_charger_id, p_driver_id, p_lender_id, p_scheduled_start, p_scheduled_end,
    'pending', p_confirmation_code, p_vehicle_id
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
