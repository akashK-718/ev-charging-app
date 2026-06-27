-- Migration: 005_users_rls_policies
-- Run this in Supabase SQL Editor (Database → SQL Editor → New query)
-- Safe to re-run — all statements use IF NOT EXISTS / DO blocks.

-- Enable RLS on users (safe to run again if already enabled)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'users_select_own'
  ) THEN
    CREATE POLICY users_select_own ON public.users
      FOR SELECT TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

-- Users can update their own profile row (role, name, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'users_update_own'
  ) THEN
    CREATE POLICY users_update_own ON public.users
      FOR UPDATE TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;
