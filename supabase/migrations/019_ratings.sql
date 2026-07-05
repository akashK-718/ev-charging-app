-- Migration: 019_ratings
-- Creates the reviews table with charger avg_rating trigger and auto-pause rule.

-- ============================================
-- REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  uuid        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  charger_id  uuid        NOT NULL REFERENCES public.chargers(id),
  reviewer_id uuid        NOT NULL REFERENCES public.users(id),
  reviewee_id uuid        NOT NULL REFERENCES public.users(id),
  review_type text        NOT NULL CHECK (review_type IN ('charger', 'lender', 'driver')),
  rating      int         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text        CHECK (review_text IS NULL OR length(review_text) <= 200),
  updated_at  timestamptz DEFAULT now(),
  locked_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_booking_type_unique UNIQUE (booking_id, reviewer_id, review_type)
);

CREATE INDEX IF NOT EXISTS idx_reviews_booking  ON public.reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_charger  ON public.reviews(charger_id, review_type);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id, review_type);

-- ============================================
-- AVG RATING + AUTO-PAUSE TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_charger_avg_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE chargers
  SET avg_rating = (
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM reviews
    WHERE charger_id = NEW.charger_id
      AND review_type = 'charger'
  )
  WHERE id = NEW.charger_id;

  IF (SELECT COUNT(*) FROM reviews WHERE charger_id = NEW.charger_id AND review_type = 'charger') >= 10 THEN
    UPDATE chargers
    SET status = 'paused'
    WHERE id = NEW.charger_id
      AND avg_rating < 3.5
      AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS charger_avg_rating_update ON public.reviews;
CREATE TRIGGER charger_avg_rating_update
AFTER INSERT OR UPDATE ON public.reviews
FOR EACH ROW
WHEN (NEW.review_type = 'charger')
EXECUTE FUNCTION update_charger_avg_rating();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_own" ON public.reviews;
CREATE POLICY "reviews_select_own"
  ON public.reviews FOR SELECT
  USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE
  USING (reviewer_id = auth.uid() AND (locked_at IS NULL OR locked_at > now()));
