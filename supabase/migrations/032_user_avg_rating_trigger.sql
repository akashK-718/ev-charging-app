-- Recomputes users.avg_rating whenever a lender or driver review is inserted/updated.
-- Charger reviews (review_type='charger') are excluded — they update chargers.avg_rating instead.
CREATE OR REPLACE FUNCTION update_user_avg_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.users
  SET avg_rating = (
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM public.reviews
    WHERE reviewee_id = NEW.reviewee_id
      AND review_type IN ('lender', 'driver')
  )
  WHERE id = NEW.reviewee_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_avg_rating_update ON public.reviews;
CREATE TRIGGER user_avg_rating_update
AFTER INSERT OR UPDATE ON public.reviews
FOR EACH ROW
WHEN (NEW.review_type IN ('lender', 'driver'))
EXECUTE FUNCTION update_user_avg_rating();
