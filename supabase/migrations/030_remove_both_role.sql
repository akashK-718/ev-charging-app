-- Migration 030: Remove 'both' role value
--
-- 'both' was introduced as a workaround for an incorrect middleware guard that
-- blocked lender-role users from driver routes (/bookings/*). That guard has
-- been removed — lender implies full driver capability. All 'both' rows are
-- migrated back to 'lender', and the check constraint is updated accordingly.
--
-- Verified before migration: 8 rows had role = 'both' (7 regular users + 1 admin).

-- Step 1: Migrate existing 'both' rows to 'lender'
UPDATE users SET role = 'lender' WHERE role = 'both';

-- Step 2: Tighten the check constraint to exclude 'both'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('driver', 'lender', 'admin'));
