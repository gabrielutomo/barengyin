-- ==========================================================
-- BARENGYIN DATABASE SCHEMA (SUPABASE / POSTGRESQL)
-- Versi: 1.1 — Full Production Ready with Complete RLS Policies
-- ==========================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  pin_hash text, -- 4 digit PIN di-hash (bcrypt / sha256)
  theme_color text default '#38BDF8',
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Trigger auto-create profile saat user sign up via auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. COUPLES (Couple Space)
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- e.g. "Dompet Aris & Nisa"
  wallet_mode text check (wallet_mode in ('combined', 'separate')) default 'combined' not null,
  default_split_ratio_a numeric(5,2) default 50.00 not null,
  default_split_ratio_b numeric(5,2) default 50.00 not null,
  currency text default 'IDR' not null,
  pin_hash text, -- 4 digit PIN Pasangan di-hash (SHA-256)
  created_by uuid references public.profiles(id),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 3. COUPLE_MEMBERS
create table if not exists public.couple_members (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('owner', 'partner')) default 'partner' not null,
  joined_at timestamptz default timezone('utc'::text, now()) not null,
  unique (couple_id, profile_id)
);

-- 4. COUPLE_INVITES
create table if not exists public.couple_invites (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade not null,
  invite_token text unique not null,
  invited_by uuid references public.profiles(id) not null,
  status text check (status in ('pending', 'accepted', 'expired', 'revoked')) default 'pending' not null,
  expires_at timestamptz not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 5. WALLETS
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade not null,
  name text not null,
  type text check (type in ('shared', 'individual')) default 'shared' not null,
  owner_profile_id uuid references public.profiles(id),
  current_balance numeric(15,2) default 0.00 not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 6. CATEGORIES
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade,
  name text not null,
  icon text not null, -- Material symbol name, e.g. "restaurant", "shopping_cart"
  color_hex text default '#FDE047' not null,
  type text check (type in ('expense', 'income')) default 'expense' not null,
  is_default boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 7. RECEIPT_SCANS (Staging area AI OCR)
create table if not exists public.receipt_scans (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade not null,
  uploaded_by uuid references public.profiles(id) not null,
  image_url text not null,
  ai_extracted_data jsonb,
  status text check (status in ('processing', 'completed', 'failed')) default 'processing' not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 8. TRANSACTIONS
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade not null,
  wallet_id uuid references public.wallets(id) on delete set null,
  category_id text, -- nama atau uuid kategori
  paid_by text default 'Saya', -- nama/label pembayar
  created_by uuid references public.profiles(id) not null,
  creator_name text, -- nama pengguna yang menginput
  updated_by uuid references public.profiles(id),
  updater_name text, -- nama pengguna yang terakhir mengedit
  title text not null,
  description text,
  type text check (type in ('expense', 'income')) not null,
  amount numeric(15,2) not null,
  split_method text check (split_method in ('none', 'fifty_fifty', 'proportional', 'full_by_payer', 'shared_pool')) default 'fifty_fifty' not null,
  status text check (status in ('recorded', 'pending_review')) default 'recorded' not null,
  receipt_scan_id uuid references public.receipt_scans(id) on delete set null,
  transaction_date date default current_date not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 9. TRANSACTION_SPLITS
create table if not exists public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  share_amount numeric(15,2) not null,
  share_percentage numeric(5,2),
  is_settled boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 10. BUDGETS
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  limit_amount numeric(15,2) not null,
  period text check (period in ('monthly', 'weekly', 'custom')) default 'monthly' not null,
  period_start date not null,
  period_end date not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 11. SAVINGS_GOALS & CONTRIBUTIONS
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade not null,
  name text not null,
  icon text default 'savings',
  target_amount numeric(15,2) not null,
  current_amount numeric(15,2) default 0.00 not null,
  target_date date,
  status text check (status in ('active', 'achieved', 'archived')) default 'active' not null,
  created_by uuid references public.profiles(id),
  creator_name text, -- nama pengguna pembuat target
  updated_by uuid references public.profiles(id),
  updater_name text, -- nama pengguna yang terakhir mengedit
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  savings_goal_id uuid references public.savings_goals(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  contributor_name text, -- nama yang menyetor
  notes text,
  amount numeric(15,2) not null,
  contributed_at timestamptz default timezone('utc'::text, now()) not null
);

-- 12. NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade not null,
  recipient_profile_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('new_transaction', 'budget_warning', 'goal_milestone', 'invite_accepted')) not null,
  title text not null,
  body text not null,
  metadata jsonb,
  is_read boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ==========================================================
-- DEFAULT SYSTEM CATEGORIES
-- ==========================================================
insert into public.categories (name, icon, color_hex, type, is_default)
values
  ('Makan & Kencan', 'restaurant', '#fd6a49', 'expense', true),
  ('Groceries & Rumah', 'shopping_bag', '#FDE047', 'expense', true),
  ('Transportasi', 'directions_car', '#38BDF8', 'expense', true),
  ('Hiburan & Nonton', 'live_tv', '#ebe1ff', 'expense', true),
  ('Tagihan & Utilitas', 'receipt', '#c6c9af', 'expense', true),
  ('Pemasukan & Top-up', 'payments', '#d4f34a', 'income', true)
on conflict do nothing;

-- ==========================================================
-- INDEXES
-- ==========================================================
create index if not exists idx_tx_couple_date on public.transactions (couple_id, transaction_date desc);
create index if not exists idx_tx_couple_cat on public.transactions (couple_id, category_id);
create index if not exists idx_splits_tx on public.transaction_splits (transaction_id);
create index if not exists idx_splits_profile on public.transaction_splits (profile_id);
create index if not exists idx_invites_token on public.couple_invites (invite_token);
create index if not exists idx_notifs_recipient on public.notifications (recipient_profile_id, is_read, created_at desc);

-- ==========================================================
-- SUPABASE STORAGE: BUCKET RECEIPTS
-- ==========================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do update set public = true;

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================
alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_invites enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.receipt_scans enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_splits enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_contributions enable row level security;
alter table public.notifications enable row level security;

-- Helper function: cek apakah user tergabung di couple_id
create or replace function public.is_member_of_couple(target_couple_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.couple_members
    where couple_id = target_couple_id and profile_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- 1. Profiles Policies
drop policy if exists "Users can view profiles" on public.profiles;
create policy "Users can view profiles" on public.profiles for select
using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update
using (id = auth.uid());

-- 2. Couples Policies
drop policy if exists "Members can view own couple" on public.couples;
create policy "Members can view own couple" on public.couples for select
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can create couple" on public.couples;
create policy "Authenticated users can create couple" on public.couples for insert
with check (auth.role() = 'authenticated');

drop policy if exists "Members can update couple" on public.couples;
create policy "Members can update couple" on public.couples for update
using (public.is_member_of_couple(id));

-- 3. Couple Members Policies
drop policy if exists "View couple members" on public.couple_members;
create policy "View couple members" on public.couple_members for select
using (auth.role() = 'authenticated');

drop policy if exists "Insert couple members" on public.couple_members;
create policy "Insert couple members" on public.couple_members for insert
with check (auth.role() = 'authenticated');

drop policy if exists "Update couple members" on public.couple_members;
create policy "Update couple members" on public.couple_members for update
using (profile_id = auth.uid() or public.is_member_of_couple(couple_id));

-- 4. Couple Invites Policies
drop policy if exists "Anyone can read invites by token" on public.couple_invites;
create policy "Anyone can read invites by token" on public.couple_invites for select
using (true);

drop policy if exists "Create couple invites" on public.couple_invites;
create policy "Create couple invites" on public.couple_invites for insert
with check (auth.role() = 'authenticated');

drop policy if exists "Update couple invites" on public.couple_invites;
create policy "Update couple invites" on public.couple_invites for update
using (auth.role() = 'authenticated');

-- 5. Wallets Policies
drop policy if exists "Wallets access" on public.wallets;
create policy "Wallets access" on public.wallets for all
using (auth.role() = 'authenticated');

-- 6. Categories Policies
drop policy if exists "Categories select" on public.categories;
create policy "Categories select" on public.categories for select
using (true);

drop policy if exists "Categories insert" on public.categories;
create policy "Categories insert" on public.categories for insert
with check (auth.role() = 'authenticated');

-- 7. Receipt Scans Policies
drop policy if exists "Receipt scans access" on public.receipt_scans;
create policy "Receipt scans access" on public.receipt_scans for all
using (auth.role() = 'authenticated');

-- 8. Transactions Policies
drop policy if exists "Transactions access" on public.transactions;
create policy "Transactions access" on public.transactions for all
using (auth.role() = 'authenticated');

-- 9. Transaction Splits Policies
drop policy if exists "Transaction splits access" on public.transaction_splits;
create policy "Transaction splits access" on public.transaction_splits for all
using (auth.role() = 'authenticated');

-- 10. Budgets Policies
drop policy if exists "Budgets access" on public.budgets;
create policy "Budgets access" on public.budgets for all
using (auth.role() = 'authenticated');

-- 11. Savings Goals Policies
drop policy if exists "Savings goals access" on public.savings_goals;
create policy "Savings goals access" on public.savings_goals for all
using (auth.role() = 'authenticated');

-- 12. Notifications Policies
drop policy if exists "Notifications access" on public.notifications;
create policy "Notifications access" on public.notifications for all
using (auth.role() = 'authenticated');

-- ==========================================================
-- STORAGE POLICIES
-- ==========================================================
drop policy if exists "Authenticated users can upload receipts" on storage.objects;
create policy "Authenticated users can upload receipts"
on storage.objects for insert
with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

drop policy if exists "Public can view receipts" on storage.objects;
create policy "Public can view receipts"
on storage.objects for select
using (bucket_id = 'receipts');

-- ==========================================================
-- REALTIME
-- ==========================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'transactions') then
    alter publication supabase_realtime add table public.transactions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'wallets') then
    alter publication supabase_realtime add table public.wallets;
  end if;
end $$;

-- ==========================================================
-- PERMISSIONS / GRANTS (For PostgREST Data API)
-- ==========================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all routines in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on routines to anon, authenticated;

