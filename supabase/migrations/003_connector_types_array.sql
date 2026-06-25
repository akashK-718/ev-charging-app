-- Migration: 003_connector_types_array
-- Converts connector_type (single text) → connector_types (text[])
-- to match the multi-select UI in the lender registration form (Step 1).
--
-- Run in Supabase: Database → SQL Editor → New query → paste → Run

-- 1. Drop the old single-value CHECK constraint.
ALTER TABLE public.chargers
  DROP CONSTRAINT IF EXISTS chargers_connector_type_check;

-- 2. Rename the column.
ALTER TABLE public.chargers
  RENAME COLUMN connector_type TO connector_types;

-- 3. Retype from text → text[], wrapping the existing value in a single-element array.
ALTER TABLE public.chargers
  ALTER COLUMN connector_types TYPE text[]
  USING ARRAY[connector_types]::text[];

-- 4. Add a new CHECK constraint:
--    • cardinality >= 1  →  at least one connector required
--    • <@  →  all elements must be from the allowed set
ALTER TABLE public.chargers
  ADD CONSTRAINT chargers_connector_types_check
  CHECK (
    cardinality(connector_types) >= 1
    AND connector_types <@ ARRAY['Type2', 'BharatAC', 'CCS2', 'CHAdeMO', 'Type1']::text[]
  );
