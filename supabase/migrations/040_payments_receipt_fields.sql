-- Migration 040: Payment method fields for receipt display + idempotency
-- constraint on razorpay_payment_id.
--
-- Part A of the Kirin-native receipt feature (feature/kirin-payment-receipt).
-- Razorpay invoice objects are confirmed unsupported for retroactive-paid state
-- (investigate/razorpay-invoice-retroactive-state); Kirin generates its own
-- receipts using the stored Razorpay IDs as reference numbers only.

-- ── 1. New columns on payments ───────────────────────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method text,      -- 'card', 'upi', 'wallet', 'netbanking', …
  ADD COLUMN IF NOT EXISTS card_network   text,      -- 'Visa', 'MasterCard', etc. (null if non-card)
  ADD COLUMN IF NOT EXISTS card_last4     char(4);   -- last 4 digits (null if non-card)

-- ── 2. Idempotency: prevent duplicate payment rows for the same Razorpay payment
-- Uses a partial unique index so NULL values (legacy rows without a payment_id)
-- are not constrained against each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id_unique
  ON public.payments(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- ── 3. Update create_booking_with_payment to accept + store method fields ────
-- Default NULL keeps backwards compatibility; older callers (tests, etc.) work
-- unchanged. The idempotency early-return also moves into the function so that
-- a duplicate verify call returns the existing booking_id rather than raising.
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
  p_card_last4          text  DEFAULT NULL
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
