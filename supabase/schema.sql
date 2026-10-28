-- ==========================================================
-- BARENGYIN DATABASE SCHEMA (SUPABASE / POSTGRESQL)
-- Versi: 1.1 — Full Production Ready with Complete RLS Policies
-- ==========================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Extends Supabase auth.users)
-- pin_hash lives in public.profile_secrets (RLS: auth.uid() = id), never here.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
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
-- pin_hash lives in public.couple_secrets (RLS: is_member_of_couple), never here.
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- e.g. "Dompet Aris & Nisa"
  wallet_mode text check (wallet_mode in ('combined', 'separate')) default 'combined' not null,
  default_split_ratio_a numeric(5,2) default 50.00 not null,
  default_split_ratio_b numeric(5,2) default 50.00 not null,
  currency text default 'IDR' not null,
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
  couple_id uuid references public.couples(id) on delete cascade,
  name text not null,
  type text check (type in ('shared', 'individual')) default 'shared' not null,
  scope text check (scope in ('couple', 'personal')) default 'couple' not null,
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
  couple_id uuid references public.couples(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade not null,
  limit_amount numeric(15,2) not null,
  period text check (period in ('monthly', 'weekly', 'custom')) default 'monthly' not null,
  period_start date not null,
  period_end date not null,
  scope text check (scope in ('couple', 'personal')) default 'couple' not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 11. SAVINGS_GOALS & CONTRIBUTIONS
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade,
  scope text check (scope in ('couple', 'personal')) default 'couple' not null,
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
-- Private: receipts carry amounts and merchant names. Reads are scoped by
-- the storage.objects policy further down (owner folder prefix).
-- ==========================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do update set public = false;

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
-- Per-user only. Public display data goes through public.public_profiles
-- (security_invoker = true) or public.couple_member_profiles().
drop policy if exists "Users can view profiles" on public.profiles;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile" on public.profiles for delete
to authenticated
using (id = auth.uid());

-- anon never touches profiles.
revoke all on public.profiles from anon;

-- Public-safe projection for member display names.
create or replace view public.public_profiles
with (security_invoker = true)
as
select p.id, p.full_name, p.avatar_url, p.theme_color, p.created_at
from public.profiles p;

grant select on public.public_profiles to authenticated;
revoke all on public.public_profiles from anon;

-- PIN secrets: declared here so the RPCs below can reference them. RLS is
-- enabled and policies are attached in section 13. Nothing client-readable
-- ever selects pin_hash; writes go through set_couple_pin().
create table if not exists public.couple_secrets (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  pin_hash text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists public.profile_secrets (
  id uuid primary key references public.profiles(id) on delete cascade,
  pin_hash text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.couple_secrets enable row level security;
alter table public.profile_secrets enable row level security;

revoke all on public.couple_secrets from anon;
revoke all on public.profile_secrets from anon;
grant select, insert, update, delete on public.couple_secrets to authenticated;
grant select, insert, update, delete on public.profile_secrets to authenticated;

-- 2. Couples Policies
-- Never auth.role() = 'authenticated': that matches every logged-in user.
drop policy if exists "Members can view own couple" on public.couples;
drop policy if exists "view own couple" on public.couples;
create policy "view own couple" on public.couples for select
to authenticated
using (public.is_member_of_couple(id));

drop policy if exists "Authenticated users can create couple" on public.couples;
drop policy if exists "create own couple" on public.couples;
create policy "create own couple" on public.couples for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Members can update couple" on public.couples;
drop policy if exists "members update own couple" on public.couples;
create policy "members update own couple" on public.couples for update
to authenticated
using (public.is_member_of_couple(id))
with check (public.is_member_of_couple(id));

drop policy if exists "owners delete own couple" on public.couples;
create policy "owners delete own couple" on public.couples for delete
to authenticated
using (public.is_member_of_couple(id));

-- 3. Couple Members Policies
drop policy if exists "View couple members" on public.couple_members;
drop policy if exists "view own couple members" on public.couple_members;
create policy "view own couple members" on public.couple_members for select
to authenticated
using (profile_id = auth.uid() or public.is_member_of_couple(couple_id));

drop policy if exists "Insert couple members" on public.couple_members;
drop policy if exists "join couple as self" on public.couple_members;
create policy "join couple as self" on public.couple_members for insert
to authenticated
with check (profile_id = auth.uid() or public.is_member_of_couple(couple_id));

drop policy if exists "Update couple members" on public.couple_members;
drop policy if exists "update own couple membership" on public.couple_members;
create policy "update own couple membership" on public.couple_members for update
to authenticated
using (profile_id = auth.uid() or public.is_member_of_couple(couple_id))
with check (profile_id = auth.uid() or public.is_member_of_couple(couple_id));

drop policy if exists "remove own couple membership" on public.couple_members;
create policy "remove own couple membership" on public.couple_members for delete
to authenticated
using (profile_id = auth.uid());

-- 4. Couple Invites Policies
-- NOT world readable. Token holders resolve via
-- public.get_couple_invite_by_token() (SECURITY DEFINER, token is the proof).
drop policy if exists "Anyone can read invites by token" on public.couple_invites;
drop policy if exists "view own couple invites" on public.couple_invites;
create policy "view own couple invites" on public.couple_invites for select
to authenticated
using (public.is_member_of_couple(couple_id));

drop policy if exists "members create couple invites" on public.couple_invites;
create policy "members create couple invites" on public.couple_invites for insert
to authenticated
with check (public.is_member_of_couple(couple_id) and invited_by = auth.uid());

drop policy if exists "members update couple invites" on public.couple_invites;
create policy "members update couple invites" on public.couple_invites for update
to authenticated
using (public.is_member_of_couple(couple_id))
with check (public.is_member_of_couple(couple_id));

drop policy if exists "members delete couple invites" on public.couple_invites;
create policy "members delete couple invites" on public.couple_invites for delete
to authenticated
using (public.is_member_of_couple(couple_id));

-- Invite lookup for the public /invite/[token] page. The token IS the proof of
-- authorization, so this is the ONLY couple_invites path reachable by anon.
-- Returns display fields only: never pin_hash, never the invite token itself.
create or replace function public.get_couple_invite_by_token(token_value text)
returns table (
  id uuid,
  couple_id uuid,
  invited_by uuid,
  status text,
  expires_at timestamptz,
  couple_name text,
  inviter_name text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    ci.id,
    ci.couple_id,
    ci.invited_by,
    ci.status,
    ci.expires_at,
    c.name,
    p.full_name
  from public.couple_invites ci
  join public.couples c on c.id = ci.couple_id
  left join public.profiles p on p.id = ci.invited_by
  where ci.invite_token = token_value
  limit 1;
$$;

revoke all on function public.get_couple_invite_by_token(text) from public;
grant execute on function public.get_couple_invite_by_token(text) to anon, authenticated;

-- Member display data for the signed-in app (partner names, avatars).
-- SECURITY DEFINER because profiles SELECT is scoped to auth.uid() = id, so a
-- security_invoker view could never resolve a partner's row.
create or replace function public.couple_member_profiles()
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  theme_color text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select p.id, p.full_name, p.avatar_url, p.theme_color, p.created_at
  from public.profiles p
  where p.id = auth.uid()
     or p.id in (
       select cm_sibling.profile_id
       from public.couple_members cm_self
       join public.couple_members cm_sibling
         on cm_sibling.couple_id = cm_self.couple_id
       where cm_self.profile_id = auth.uid()
     );
$$;

revoke all on function public.couple_member_profiles() from anon, public;
grant execute on function public.couple_member_profiles() to authenticated;

-- Boolean-only PIN probe: lets the UI render "PIN Aktif / Belum Diatur"
-- without the hash ever crossing the wire.
create or replace function public.couple_pin_configured(target_couple_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  configured boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.couple_members
    where couple_id = target_couple_id and profile_id = auth.uid()
  ) then
    raise exception 'not a member of this couple space' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.couple_secrets cs
    where cs.couple_id = target_couple_id and cs.pin_hash is not null
  ) into configured;

  return configured;
end;
$$;

revoke all on function public.couple_pin_configured(uuid) from anon, public;
grant execute on function public.couple_pin_configured(uuid) to authenticated;

-- PIN writes go through this RPC: membership is checked inside, so the hash is
-- never selectable from a client-readable table.
create or replace function public.set_couple_pin(
  target_couple_id uuid,
  pin_hash_value text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.couple_members
    where couple_id = target_couple_id and profile_id = auth.uid()
  ) then
    raise exception 'not a member of this couple space' using errcode = '42501';
  end if;

  insert into public.couple_secrets (couple_id, pin_hash, updated_at)
  values (target_couple_id, pin_hash_value, now())
  on conflict (couple_id) do update
    set pin_hash = excluded.pin_hash,
        updated_at = now();
end;
$$;

revoke all on function public.set_couple_pin(uuid, text) from anon, public;
grant execute on function public.set_couple_pin(uuid, text) to authenticated;

-- Onboarding join: the caller is not a member yet, so membership cannot gate
-- this. The invite token plus a matching hash is the proof.
create or replace function public.verify_couple_pin_for_invite(
  invite_token_value text,
  pin_hash_value text
)
returns table (couple_id uuid, couple_name text, inviter_name text)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    ci.couple_id,
    c.name,
    coalesce(p.full_name, 'Pasangan')
  from public.couple_invites ci
  join public.couples c on c.id = ci.couple_id
  left join public.profiles p on p.id = ci.invited_by
  join public.couple_secrets cs on cs.couple_id = ci.couple_id
  where ci.invite_token = invite_token_value
    and ci.status = 'pending'
    and ci.expires_at > now()
    and cs.pin_hash is not null
    and cs.pin_hash = pin_hash_value
  limit 1;
$$;

revoke all on function public.verify_couple_pin_for_invite(text, text) from anon, public;
grant execute on function public.verify_couple_pin_for_invite(text, text) to authenticated;

-- 5. Wallets Policies
-- Scoped by couple membership or personal ownership (see patch.sql for the
-- full dual-space predicate; base seed keeps it strict).
drop policy if exists "Wallets access" on public.wallets;
drop policy if exists "wallets scoped access" on public.wallets;
create policy "wallets scoped access" on public.wallets for all
to authenticated
using (
  (coalesce(scope, 'couple') = 'personal'
     and (owner_profile_id = auth.uid() or (couple_id is null and owner_profile_id = auth.uid())))
  or (coalesce(scope, 'couple') = 'couple' and public.is_member_of_couple(couple_id))
)
with check (
  (coalesce(scope, 'couple') = 'personal'
     and (owner_profile_id = auth.uid() or (couple_id is null and owner_profile_id = auth.uid())))
  or (coalesce(scope, 'couple') = 'couple' and public.is_member_of_couple(couple_id))
);

-- 6. Categories Policies
-- Default system categories have couple_id IS NULL. Narrowed from using(true):
-- a default row is readable to any authenticated user, a custom row only to
-- its own couple.
drop policy if exists "Categories select" on public.categories;
drop policy if exists "read categories" on public.categories;
create policy "read categories" on public.categories for select
to authenticated
using (couple_id is null or public.is_member_of_couple(couple_id));

drop policy if exists "Categories insert" on public.categories;
drop policy if exists "members insert categories" on public.categories;
create policy "members insert categories" on public.categories for insert
to authenticated
with check (public.is_member_of_couple(couple_id));

drop policy if exists "members update categories" on public.categories;
create policy "members update categories" on public.categories for update
to authenticated
using (public.is_member_of_couple(couple_id))
with check (public.is_member_of_couple(couple_id));

drop policy if exists "members delete categories" on public.categories;
create policy "members delete categories" on public.categories for delete
to authenticated
using (public.is_member_of_couple(couple_id));

-- 7. Receipt Scans Policies
drop policy if exists "Receipt scans access" on public.receipt_scans;
drop policy if exists "receipt scans scoped access" on public.receipt_scans;
create policy "receipt scans scoped access" on public.receipt_scans for all
to authenticated
using (uploaded_by = auth.uid() or public.is_member_of_couple(couple_id))
with check (uploaded_by = auth.uid() or public.is_member_of_couple(couple_id));

-- 8. Transactions Policies
-- Superseded by patch.sql's "Transactions dual-space access" (personal vs
-- couple scope). Members or the creator only.
drop policy if exists "Transactions access" on public.transactions;
drop policy if exists "transactions scoped access" on public.transactions;
create policy "transactions scoped access" on public.transactions for all
to authenticated
using (created_by = auth.uid() or public.is_member_of_couple(couple_id))
with check (created_by = auth.uid() or public.is_member_of_couple(couple_id));

-- 9. Transaction Splits Policies
drop policy if exists "Transaction splits access" on public.transaction_splits;
drop policy if exists "transaction splits scoped access" on public.transaction_splits;
create policy "transaction splits scoped access" on public.transaction_splits for all
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.transactions t
    where t.id = transaction_id
      and (t.created_by = auth.uid() or public.is_member_of_couple(t.couple_id))
  )
)
with check (
  profile_id = auth.uid()
  or exists (
    select 1 from public.transactions t
    where t.id = transaction_id
      and (t.created_by = auth.uid() or public.is_member_of_couple(t.couple_id))
  )
);

-- 10. Budgets Policies
drop policy if exists "Budgets access" on public.budgets;
drop policy if exists "budgets scoped access" on public.budgets;
create policy "budgets scoped access" on public.budgets for all
to authenticated
using (
  (coalesce(scope, 'couple') = 'personal' and couple_id is null)
  or (coalesce(scope, 'couple') = 'couple' and public.is_member_of_couple(couple_id))
)
with check (
  (coalesce(scope, 'couple') = 'personal' and couple_id is null)
  or (coalesce(scope, 'couple') = 'couple' and public.is_member_of_couple(couple_id))
);

-- 11. Savings Goals & Contributions Policies
drop policy if exists "Savings goals access" on public.savings_goals;
drop policy if exists "savings goals scoped access" on public.savings_goals;
create policy "savings goals scoped access" on public.savings_goals for all
to authenticated
using (
  (coalesce(scope, 'couple') = 'personal' and created_by = auth.uid())
  or (coalesce(scope, 'couple') = 'couple' and public.is_member_of_couple(couple_id))
)
with check (
  (coalesce(scope, 'couple') = 'personal' and created_by = auth.uid())
  or (coalesce(scope, 'couple') = 'couple' and public.is_member_of_couple(couple_id))
);

drop policy if exists "Savings contributions access" on public.savings_contributions;
drop policy if exists "savings contributions scoped access" on public.savings_contributions;
create policy "savings contributions scoped access" on public.savings_contributions for all
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.savings_goals sg
    where sg.id = savings_goal_id
      and (
        (coalesce(sg.scope, 'couple') = 'personal' and sg.created_by = auth.uid())
        or (coalesce(sg.scope, 'couple') = 'couple' and public.is_member_of_couple(sg.couple_id))
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
        or (coalesce(sg.scope, 'couple') = 'couple' and public.is_member_of_couple(sg.couple_id))
      )
  )
);

-- 12. Notifications Policies
-- Recipient only. Was auth.role() = 'authenticated': every logged-in user
-- could read every other user's notifications.
drop policy if exists "Notifications access" on public.notifications;
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select
to authenticated
using (recipient_profile_id = auth.uid());

drop policy if exists "insert own notifications" on public.notifications;
create policy "insert own notifications" on public.notifications for insert
to authenticated
with check (recipient_profile_id = auth.uid());

drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications for update
to authenticated
using (recipient_profile_id = auth.uid())
with check (recipient_profile_id = auth.uid());

drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications for delete
to authenticated
using (recipient_profile_id = auth.uid());

-- 13. PIN Secrets Policies
-- Table DDL lives near the top of this file (before the RPCs that reference
-- them); only the policies are declared here.

drop policy if exists "read own profile secret" on public.profile_secrets;
create policy "read own profile secret" on public.profile_secrets for select
to authenticated
using (auth.uid() = id);

drop policy if exists "insert own profile secret" on public.profile_secrets;
create policy "insert own profile secret" on public.profile_secrets for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "update own profile secret" on public.profile_secrets;
create policy "update own profile secret" on public.profile_secrets for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "delete own profile secret" on public.profile_secrets;
create policy "delete own profile secret" on public.profile_secrets for delete
to authenticated
using (auth.uid() = id);

drop policy if exists "members can read own couple secret" on public.couple_secrets;
create policy "members can read own couple secret" on public.couple_secrets for select
to authenticated
using (public.is_member_of_couple(couple_id));

drop policy if exists "members can insert own couple secret" on public.couple_secrets;
create policy "members can insert own couple secret" on public.couple_secrets for insert
to authenticated
with check (public.is_member_of_couple(couple_id));

drop policy if exists "members can update own couple secret" on public.couple_secrets;
create policy "members can update own couple secret" on public.couple_secrets for update
to authenticated
using (public.is_member_of_couple(couple_id))
with check (public.is_member_of_couple(couple_id));

drop policy if exists "members can delete own couple secret" on public.couple_secrets;
create policy "members can delete own couple secret" on public.couple_secrets for delete
to authenticated
using (public.is_member_of_couple(couple_id));

-- ==========================================================
-- STORAGE POLICIES
-- ==========================================================
drop policy if exists "Authenticated users can upload receipts" on storage.objects;
create policy "Authenticated users can upload receipts"
on storage.objects for insert
to authenticated
with check (bucket_id = 'receipts');

-- Receipts contain transaction amounts and merchant names, so the bucket is
-- private and reads are scoped to the uploading owner's folder (path prefix
-- `<auth.uid()>/...`).
drop policy if exists "Public can view receipts" on storage.objects;
drop policy if exists "Owners can view own receipts" on storage.objects;
create policy "Owners can view own receipts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

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

-- anon MUST NOT hold table privileges: Supabase grants them by default, and
-- that default is exactly what let `apikey`-only requests read profiles.
-- RLS is the second line of defence, GRANTs are the first.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all routines in schema public from anon;

grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant all on all routines in schema public to authenticated;

-- THE ONE EXCEPTION. The public invite page is opened by visitors who are not
-- signed in yet, so anon must be able to resolve an invite token. This is the
-- only routine anon may execute, and it returns display fields only.
grant execute on function public.get_couple_invite_by_token(text) to anon;

-- New tables created later must not silently become anon-readable.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on routines from anon;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
alter default privileges in schema public grant all on routines to authenticated;

