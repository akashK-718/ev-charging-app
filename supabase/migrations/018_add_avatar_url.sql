-- Add avatar_url to users.
-- Existing users start with NULL (shows initials fallback in the UI).
-- Newly-approved lenders get their KYC selfie copied here by the approve API.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;
