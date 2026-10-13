-- ==========================================================
-- BARENGYIN SCHEMA UPDATE PATCH (Jalankan di Supabase SQL Editor)
-- ==========================================================

-- 1. TRANSACTIONS TABLE
-- Drop foreign key constraints jika sebelumnya category_id / paid_by berupa UUID FK
alter table public.transactions drop constraint if exists transactions_category_id_fkey;
alter table public.transactions drop constraint if exists transactions_paid_by_fkey;

-- Ubah tipe kolom category_id dan paid_by menjadi TEXT agar fleksibel
alter table public.transactions alter column category_id drop not null;
alter table public.transactions alter column category_id type text using category_id::text;
alter table public.transactions alter column paid_by drop not null;
alter table public.transactions alter column paid_by type text using paid_by::text;
alter table public.transactions alter column paid_by set default 'Saya';

-- Tambahkan kolom audit yang baru
alter table public.transactions add column if not exists creator_name text;
alter table public.transactions add column if not exists updated_by uuid references public.profiles(id);
alter table public.transactions add column if not exists updater_name text;
alter table public.transactions add column if not exists updated_at timestamptz default timezone('utc'::text, now()) not null;

-- 2. SAVINGS_GOALS TABLE
alter table public.savings_goals add column if not exists icon text default 'savings';
alter table public.savings_goals add column if not exists created_by uuid references public.profiles(id);
alter table public.savings_goals add column if not exists creator_name text;
alter table public.savings_goals add column if not exists updated_by uuid references public.profiles(id);
alter table public.savings_goals add column if not exists updater_name text;
alter table public.savings_goals add column if not exists updated_at timestamptz default timezone('utc'::text, now()) not null;

-- 3. SAVINGS_CONTRIBUTIONS TABLE
alter table public.savings_contributions add column if not exists notes text;
alter table public.savings_contributions add column if not exists contributor_name text;

-- 4. RLS POLICIES FOR SAVINGS GOALS & CONTRIBUTIONS
alter table public.savings_goals enable row level security;
drop policy if exists "Savings goals access" on public.savings_goals;
create policy "Savings goals access" on public.savings_goals for all
to authenticated
using (true)
with check (true);

alter table public.savings_contributions enable row level security;
drop policy if exists "Savings contributions access" on public.savings_contributions;
create policy "Savings contributions access" on public.savings_contributions for all
to authenticated
using (true)
with check (true);

-- 5. COUPLES TABLE
alter table public.couples add column if not exists pin_hash text;

-- 6. PROFILES TABLE
alter table public.profiles add column if not exists pin_hash text;

-- ==========================================================
-- 7. DUAL-SPACE (PERSONAL VS COUPLE) & AUTO-CAPTURE NOTIFICATION
-- ==========================================================

-- A. TRANSACTIONS: Scope & Notification Ingestion Fields
alter table public.transactions add column if not exists scope text check (scope in ('couple', 'personal')) default 'couple';
alter table public.transactions alter column couple_id drop not null;
alter table public.transactions add column if not exists is_auto_captured boolean default false;
alter table public.transactions add column if not exists source_app text;
alter table public.transactions add column if not exists raw_notification_text text;

-- B. WALLETS: Scope
alter table public.wallets add column if not exists scope text check (scope in ('couple', 'personal')) default 'couple';
alter table public.wallets alter column couple_id drop not null;

-- C. BUDGETS: Scope
alter table public.budgets add column if not exists scope text check (scope in ('couple', 'personal')) default 'couple';
alter table public.budgets alter column couple_id drop not null;

-- D. USER API KEYS (Untuk autentikasi cepat notifikasi mobile Android ke Ingestion Service)
create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade not null,
  api_key text unique not null,
  name text default 'Mobile Notification Listener',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.user_api_keys enable row level security;
drop policy if exists "Users can manage own api keys" on public.user_api_keys;
create policy "Users can manage own api keys" on public.user_api_keys for all
to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- E. RLS POLICIES DUAL-SPACE (Isolasi data Personal vs Couple)
drop policy if exists "Transactions access" on public.transactions;
drop policy if exists "Transactions dual-space access" on public.transactions;
create policy "Transactions dual-space access" on public.transactions for all
to authenticated
using (
  (coalesce(scope, 'couple') = 'personal' and created_by = auth.uid())
  or
  (coalesce(scope, 'couple') = 'couple' and (
    couple_id in (select couple_id from public.couple_members where profile_id = auth.uid())
    or created_by = auth.uid()
  ))
)
with check (
  (coalesce(scope, 'couple') = 'personal' and created_by = auth.uid())
  or
  (coalesce(scope, 'couple') = 'couple' and (
    couple_id in (select couple_id from public.couple_members where profile_id = auth.uid())
    or created_by = auth.uid()
  ))
);

drop policy if exists "Wallets access" on public.wallets;
drop policy if exists "Wallets dual-space access" on public.wallets;
create policy "Wallets dual-space access" on public.wallets for all
to authenticated
using (
  (coalesce(scope, 'couple') = 'personal' and (owner_profile_id = auth.uid() or couple_id is null))
  or
  (coalesce(scope, 'couple') = 'couple' and couple_id in (
    select couple_id from public.couple_members where profile_id = auth.uid()
  ))
)
with check (
  (coalesce(scope, 'couple') = 'personal' and (owner_profile_id = auth.uid() or couple_id is null))
  or
  (coalesce(scope, 'couple') = 'couple' and couple_id in (
    select couple_id from public.couple_members where profile_id = auth.uid()
  ))
);

drop policy if exists "Budgets access" on public.budgets;
drop policy if exists "Budgets dual-space access" on public.budgets;
create policy "Budgets dual-space access" on public.budgets for all
to authenticated
using (
  (coalesce(scope, 'couple') = 'personal' and couple_id is null)
  or
  (coalesce(scope, 'couple') = 'couple' and couple_id in (
    select couple_id from public.couple_members where profile_id = auth.uid()
  ))
)
with check (
  (coalesce(scope, 'couple') = 'personal' and couple_id is null)
  or
  (coalesce(scope, 'couple') = 'couple' and couple_id in (
    select couple_id from public.couple_members where profile_id = auth.uid()
  ))
);

-- Index baru untuk performa query scope
create index if not exists idx_tx_scope_created on public.transactions (scope, created_by, transaction_date desc);
create index if not exists idx_tx_pending on public.transactions (created_by, status) where status = 'pending_review';

-- 8. RELOAD POSTGREST SCHEMA CACHE
notify pgrst, 'reload schema';

