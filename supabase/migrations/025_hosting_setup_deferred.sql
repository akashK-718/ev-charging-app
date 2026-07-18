-- Migration: 025_hosting_setup_deferred
-- Adds hosting_setup_deferred flag so Profile can show a softer "Resume setup"
-- card after a user chooses "Not now" from Setup in Progress, rather than
-- continuing to show "Setup in progress" which reads as a nag.
--
-- Safe to re-run — uses ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hosting_setup_deferred boolean NOT NULL DEFAULT false;
