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
alter table public.savings_goals add column if not exists creator_name text;
alter table public.savings_goals add column if not exists updated_by uuid references public.profiles(id);
alter table public.savings_goals add column if not exists updater_name text;
alter table public.savings_goals add column if not exists updated_at timestamptz default timezone('utc'::text, now()) not null;

-- 3. SAVINGS_CONTRIBUTIONS TABLE
alter table public.savings_contributions add column if not exists contributor_name text;

-- 4. COUPLES TABLE
alter table public.couples add column if not exists pin_hash text;

-- 5. PROFILES TABLE
alter table public.profiles add column if not exists pin_hash text;

-- 6. RELOAD POSTGREST SCHEMA CACHE
notify pgrst, 'reload schema';
