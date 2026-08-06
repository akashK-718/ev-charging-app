-- Stores the Razorpay customer_id created for each user so saved payment
-- methods (tokens) can be fetched and managed via the Customers API.
-- Also stores which token the user has marked as their default.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS razorpay_customer_id text,
  ADD COLUMN IF NOT EXISTS default_payment_token_id text;
