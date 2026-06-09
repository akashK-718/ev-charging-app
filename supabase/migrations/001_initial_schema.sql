-- Migration: 001_initial_schema
-- Run this in Supabase SQL Editor (Database → SQL Editor → New query)

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- USERS
-- ============================================
create table public.users (
  id uuid primary key default uuid_generate_v4(),
  phone varchar(15) unique not null,
  name varchar(100),
  role text not null default 'driver' check (role in ('driver', 'lender', 'both')),
  kyc_status text not null default 'pending' check (kyc_status in ('pending', 'verified', 'rejected')),
  kyc_doc_url text,
  avg_rating numeric(3,2),
  razorpay_contact_id text,
  razorpay_fund_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- CHARGERS
-- ============================================
create table public.chargers (
  id uuid primary key default uuid_generate_v4(),
  lender_id uuid not null references public.users(id) on delete cascade,
  title varchar(120) not null,
  charger_type text not null check (charger_type in ('AC_3.3kW', 'AC_7kW', 'AC_22kW', 'DC_fast')),
  connector_type text not null check (connector_type in ('Type2', 'BharatAC', 'CCS2', 'CHAdeMO', 'Type1')),
  price_per_kwh numeric(6,2) not null,
  address text not null,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  photos text[] default '{}',
  instructions text,
  status text not null default 'active' check (status in ('active', 'paused', 'suspended')),
  avg_rating numeric(3,2),
  total_sessions int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_chargers_lender on public.chargers(lender_id);
create index idx_chargers_status on public.chargers(status);

-- ============================================
-- BOOKINGS
-- ============================================
create table public.bookings (
  id uuid primary key default uuid_generate_v4(),
  charger_id uuid not null references public.chargers(id),
  driver_id uuid not null references public.users(id),
  lender_id uuid not null references public.users(id),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  actual_start timestamptz,
  actual_end timestamptz,
  kwh_delivered numeric(6,2),
  status text not null default 'pending' check (
    status in ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'disputed')
  ),
  cancellation_reason text,
  confirmation_code varchar(8) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bookings_charger_slot on public.bookings(charger_id, scheduled_start);
create index idx_bookings_driver on public.bookings(driver_id);
create index idx_bookings_lender_status on public.bookings(lender_id, status);

-- ============================================
-- PAYMENTS
-- ============================================
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_transfer_id text,
  gross_amount int not null,        -- in paise
  platform_fee int not null,        -- in paise
  lender_payout int not null,       -- in paise
  gateway_fee int default 0,
  status text not null default 'created' check (
    status in ('created', 'paid', 'transferred', 'refunded', 'failed')
  ),
  payout_released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payments_razorpay_order on public.payments(razorpay_order_id);
create index idx_payments_payout on public.payments(status, payout_released_at);
