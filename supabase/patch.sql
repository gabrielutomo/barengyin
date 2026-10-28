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
drop policy if exists "savings goals scoped access" on savings_goals;
create policy "savings goals scoped access" on public.savings_goals for all
to authenticated
using (
  (coalesce(scope, 'couple') = 'personal' and created_by = auth.uid())
  or (coalesce(scope, 'couple') = 'couple' and couple_id in (
    select couple_id from public.couple_members where profile_id = auth.uid()
  ))
)
with check (
  (coalesce(scope, 'couple') = 'personal' and created_by = auth.uid())
  or (coalesce(scope, 'couple') = 'couple' and couple_id in (
    select couple_id from public.couple_members where profile_id = auth.uid()
  ))
);

alter table public.savings_contributions enable row level security;
drop policy if exists "Savings contributions access" on public.savings_contributions;
drop policy if exists "savings contributions scoped access" on savings_contributions;
create policy "savings contributions scoped access" on public.savings_contributions for all
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.savings_goals sg
    where sg.id = savings_goal_id
      and (
        (coalesce(sg.scope, 'couple') = 'personal' and sg.created_by = auth.uid())
        or (coalesce(sg.scope, 'couple') = 'couple' and sg.couple_id in (
          select couple_id from public.couple_members where profile_id = auth.uid()
        ))
      )
  )
)
with check (
  profile_id = auth.uid()
  or exists (
    select 1 from public.savings_goals sg
    where sg.id = savings_goal_id
      and (
        (coalesce(sg.scope, 'couple') = 'personal' and sg.created_by = auth.uid())
        or (coalesce(sg.scope, 'couple') = 'couple' and sg.couple_id in (
          select couple_id from public.couple_members where profile_id = auth.uid()
        ))
      )
  )
);

-- 5. COUPLES TABLE
-- pin_hash moved to public.couple_secrets. See
-- supabase/migrations/20261028000000_security_hardening.sql — it creates the
-- table, copies the data, then drops this column.
-- alter table public.couples add column if not exists pin_hash text;  -- REMOVED

-- 6. PROFILES TABLE
-- pin_hash moved to public.profile_secrets. Same migration.
-- alter table public.profiles add column if not exists pin_hash text;  -- REMOVED

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
revoke all on public.user_api_keys from anon;
grant select, insert, update, delete on public.user_api_keys to authenticated;

drop policy if exists "Users can manage own api keys" on public.user_api_keys;
drop policy if exists "read own api keys" on public.user_api_keys;
create policy "read own api keys" on public.user_api_keys for select
to authenticated using (profile_id = auth.uid());

drop policy if exists "insert own api keys" on public.user_api_keys;
create policy "insert own api keys" on public.user_api_keys for insert
to authenticated with check (profile_id = auth.uid());

drop policy if exists "update own api keys" on public.user_api_keys;
create policy "update own api keys" on public.user_api_keys for update
to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "delete own api keys" on public.user_api_keys;
create policy "delete own api keys" on public.user_api_keys for delete
to authenticated using (profile_id = auth.uid());

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

-- 8. REVOKE ANON TABLE PRIVILEGES
-- Supabase grants anon full DML on public by default. That GRANT is what
-- turned the leaky profiles SELECT policy into a full-table read for
-- `apikey`-only requests. RLS must never be the only line of defence.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all routines in schema public from anon;

-- 9. RELOAD POSTGREST SCHEMA CACHE
notify pgrst, 'reload schema';

