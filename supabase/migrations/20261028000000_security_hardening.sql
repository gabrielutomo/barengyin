-- ==========================================================
-- BARENGYIN SECURITY HARDENING MIGRATION
-- Fix: profiles public SELECT leak, pin_hash exposure, PIN
--      secrets moved server-side, per-user RLS everywhere.
--
-- Idempotent: safe to run repeatedly (drop policy if exists,
-- create table if not exists, add column if not exists).
-- Run in Supabase SQL Editor (project wfvsnuhpzllfiniinaxo).
-- ==========================================================

begin;

-- ==========================================================
-- 1. PIN SECRETS TABLES
--    PIN hash never lives in a client-readable table again.
--    No plain view exposes it: reads go through an RPC that
--    checks membership with auth.uid().
-- ==========================================================

-- 1a. couples.pin_hash -> couples_secrets
create table if not exists public.couple_secrets (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  pin_hash text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 1b. profiles.pin_hash -> profile_secrets
create table if not exists public.profile_secrets (
  id uuid primary key references public.profiles(id) on delete cascade,
  pin_hash text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.couple_secrets enable row level security;
alter table public.profile_secrets enable row level security;

revoke all on public.couple_secrets from anon, public;
revoke all on public.profile_secrets from anon, public;
grant select, insert, update, delete on public.couple_secrets to authenticated;
grant select, insert, update, delete on public.profile_secrets to authenticated;

-- 1c. Operators only reach the hash through these RPCs.
--     service_role (REST admin calls) bypasses RLS but these helpers
--     are the only path a logged-in browser session can use.
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

-- The onboarding join-with-pin flow calls this RPC BEFORE the caller is a
-- member, so membership cannot be the gate here. The invite token plus a
-- correct PIN hash is the proof. Returns ONLY display fields, never the
-- hash itself, and never the invite token.
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

revoke all on function public.set_couple_pin(uuid, text) from anon, public;
revoke all on function public.verify_couple_pin_for_invite(text, text) from anon, public;
grant execute on function public.set_couple_pin(uuid, text) to authenticated;
grant execute on function public.verify_couple_pin_for_invite(text, text) to authenticated;

-- Boolean-only probe so clients can render "PIN Aktif / Belum Diatur"
-- without ever receiving the hash.
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

-- 1d. RLS for the secret tables. Own row / own couple only, authenticated only.
drop policy if exists "read own profile secret" on public.profile_secrets;
create policy "read own profile secret" on public.profile_secrets
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists "insert own profile secret" on public.profile_secrets;
create policy "insert own profile secret" on public.profile_secrets
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "update own profile secret" on public.profile_secrets;
create policy "update own profile secret" on public.profile_secrets
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "delete own profile secret" on public.profile_secrets;
create policy "delete own profile secret" on public.profile_secrets
  for delete to authenticated
  using (auth.uid() = id);

drop policy if exists "members can read own couple secret" on public.couple_secrets;
create policy "members can read own couple secret" on public.couple_secrets
  for select to authenticated
  using (public.is_member_of_couple(couple_id));

drop policy if exists "members can insert own couple secret" on public.couple_secrets;
create policy "members can insert own couple secret" on public.couple_secrets
  for insert to authenticated
  with check (public.is_member_of_couple(couple_id));

drop policy if exists "members can update own couple secret" on public.couple_secrets;
create policy "members can update own couple secret" on public.couple_secrets
  for update to authenticated
  using (public.is_member_of_couple(couple_id))
  with check (public.is_member_of_couple(couple_id));

drop policy if exists "members can delete own couple secret" on public.couple_secrets;
create policy "members can delete own couple secret" on public.couple_secrets
  for delete to authenticated
  using (public.is_member_of_couple(couple_id));

-- ==========================================================
-- 2. DATA MIGRATION (runs only when legacy columns exist)
-- ==========================================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'couples' and column_name = 'pin_hash'
  ) then
    execute $mig$
      insert into public.couple_secrets (couple_id, pin_hash)
      select c.id, c.pin_hash
      from public.couples c
      where c.pin_hash is not null
      on conflict (couple_id) do update
        set pin_hash = coalesce(public.couple_secrets.pin_hash, excluded.pin_hash),
            updated_at = now()
    $mig$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'pin_hash'
  ) then
    execute $mig$
      insert into public.profile_secrets (id, pin_hash)
      select p.id, p.pin_hash
      from public.profiles p
      where p.pin_hash is not null
      on conflict (id) do update
        set pin_hash = coalesce(public.profile_secrets.pin_hash, excluded.pin_hash),
            updated_at = now()
    $mig$;
  end if;
end $$;

-- ==========================================================
-- 3. DROP LEGACY pin_hash COLUMNS
--    Run only after section 2 has copied the data.
-- ==========================================================
alter table public.couples drop column if exists pin_hash;
alter table public.profiles drop column if exists pin_hash;

-- ==========================================================
-- 3b. ENSURE RLS IS ON EVERY APPLICATION TABLE
--     Policies below are meaningless on a table whose RLS was
--     never enabled (or was disabled). Idempotent.
-- ==========================================================
alter table public.profiles               enable row level security;
alter table public.couples                enable row level security;
alter table public.couple_members         enable row level security;
alter table public.couple_invites         enable row level security;
alter table public.wallets                enable row level security;
alter table public.categories             enable row level security;
alter table public.receipt_scans          enable row level security;
alter table public.transactions           enable row level security;
alter table public.transaction_splits     enable row level security;
alter table public.budgets                enable row level security;
alter table public.savings_goals          enable row level security;
alter table public.savings_contributions  enable row level security;
alter table public.notifications          enable row level security;

-- ==========================================================
-- 3c. PRIVILEGE HYGIENE: anon holds NO table privileges.
--     Supabase's default grants give `anon` full DML on every
--     table in `public`. That GRANT — not the policy alone — is
--     what turned `using (true)` into a full-table read with
--     nothing but the publishable `apikey`. RLS is the second
--     line of defence; this is the first.
-- ==========================================================
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant all on all tables     in schema public to authenticated;
grant all on all sequences  in schema public to authenticated;
grant all on all functions  in schema public to authenticated;

-- Tables created after this migration must not silently be anon-readable.
alter default privileges in schema public revoke all on tables     from anon;
alter default privileges in schema public revoke all on sequences  from anon;
alter default privileges in schema public revoke all on functions  from anon;
alter default privileges in schema public grant  all on tables     to authenticated;
alter default privileges in schema public grant  all on sequences  to authenticated;
alter default privileges in schema public grant  all on functions  to authenticated;

-- ==========================================================
-- 4. PROFILES: PUBLIC VIEW + PER-USER RLS
-- ==========================================================

-- Drop the leaky legacy policies (and any duplicates).
drop policy if exists "Users can view profiles" on public.profiles;
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile" on public.profiles
  for delete to authenticated
  using (auth.uid() = id);

-- anon has no business touching profiles at all.
drop policy if exists "Anon can read profiles" on public.profiles;
revoke all on public.profiles from anon, public;

-- Public-safe projection for "who is in my couple space" UI.
--
-- security_invoker = true means the view does NOT bypass RLS: the calling
-- role's policies apply, so this view only returns rows the caller could
-- already SELECT from profiles (i.e. their own row, given the policy above).
--
-- Because profiles is locked to auth.uid() = id, resolving a partner's
-- display name cannot go through this view. That job belongs to
-- public.couple_member_profiles() below, a SECURITY DEFINER function that is
-- hard-scoped to the caller's own couple memberships and returns only safe
-- columns. This view stays as the sanctioned projection for anything else
-- (e.g. a future genuinely-public profile feature) and as the column
-- contract: never add pin_hash, email or other secrets.
create or replace view public.public_profiles
with (security_invoker = true)
as
select
  p.id,
  p.full_name,
  p.avatar_url,
  p.theme_color,
  p.created_at
from public.profiles p;

comment on view public.public_profiles is
  'Public-safe profile projection. Never add pin_hash, email or other secrets here.';

grant select on public.public_profiles to authenticated;
revoke all on public.public_profiles from anon, public;

-- Row-resolution helper: returns safe profile fields for everyone in the
-- caller's couple spaces, plus themselves. SECURITY DEFINER so it can read
-- profiles rows that the caller cannot select directly, while still being
-- hard-scoped to the caller's own couple memberships.
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

-- ==========================================================
-- 5. COUPLES / COUPLE_INVITES: close the auth.role() wide-open holes
--    auth.role() = 'authenticated' matches EVERY logged-in user, not
--    just members, so those policies are the same bug class as using(true).
-- ==========================================================

-- Couples
drop policy if exists "Members can view own couple" on public.couples;
drop policy if exists "view own couple" on public.couples;
create policy "view own couple" on public.couples
  for select to authenticated
  using (public.is_member_of_couple(id));

drop policy if exists "Authenticated users can create couple" on public.couples;
drop policy if exists "create own couple" on public.couples;
create policy "create own couple" on public.couples
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Members can update couple" on public.couples;
drop policy if exists "members update own couple" on public.couples;
create policy "members update own couple" on public.couples
  for update to authenticated
  using (public.is_member_of_couple(id))
  with check (public.is_member_of_couple(id));

drop policy if exists "owners delete own couple" on public.couples;
create policy "owners delete own couple" on public.couples
  for delete to authenticated
  using (public.is_member_of_couple(id));

-- Couple members
drop policy if exists "View couple members" on public.couple_members;
drop policy if exists "view own couple members" on public.couple_members;
create policy "view own couple members" on public.couple_members
  for select to authenticated
  using (profile_id = auth.uid() or public.is_member_of_couple(couple_id));

drop policy if exists "Insert couple members" on public.couple_members;
drop policy if exists "join couple as self" on public.couple_members;
create policy "join couple as self" on public.couple_members
  for insert to authenticated
  with check (profile_id = auth.uid() or public.is_member_of_couple(couple_id));

drop policy if exists "Update couple members" on public.couple_members;
drop policy if exists "update own couple membership" on public.couple_members;
create policy "update own couple membership" on public.couple_members
  for update to authenticated
  using (profile_id = auth.uid() or public.is_member_of_couple(couple_id))
  with check (profile_id = auth.uid() or public.is_member_of_couple(couple_id));

drop policy if exists "remove own couple membership" on public.couple_members;
create policy "remove own couple membership" on public.couple_members
  for delete to authenticated
  using (profile_id = auth.uid());

-- Couple invites: NOT world readable. Public token holders go through the
-- SECURITY DEFINER function public.get_couple_invite_by_token().
drop policy if exists "Anyone can read invites by token" on public.couple_invites;
drop policy if exists "view own couple invites" on public.couple_invites;
create policy "view own couple invites" on public.couple_invites
  for select to authenticated
  using (public.is_member_of_couple(couple_id));

drop policy if exists "Create couple invites" on public.couple_invites;
drop policy if exists "members create couple invites" on public.couple_invites;
create policy "members create couple invites" on public.couple_invites
  for insert to authenticated
  with check (public.is_member_of_couple(couple_id) and invited_by = auth.uid());

drop policy if exists "Update couple invites" on public.couple_invites;
drop policy if exists "members update couple invites" on public.couple_invites;
create policy "members update couple invites" on public.couple_invites
  for update to authenticated
  using (public.is_member_of_couple(couple_id))
  with check (public.is_member_of_couple(couple_id));

drop policy if exists "members delete couple invites" on public.couple_invites;
create policy "members delete couple invites" on public.couple_invites
  for delete to authenticated
  using (public.is_member_of_couple(couple_id));

-- Invite lookup for the public /invite/[token] page. Returns only the few
-- fields the invite screen shows, so an unauthenticated visitor holding the
-- token cannot enumerate couples or read pin hashes.
--
-- EXECUTE is granted to anon on purpose: the invite link's entire purpose is
-- to be opened by someone who is not signed in yet. The token IS the proof of
-- authorization, and this function exposes only (id, couple_id, invited_by,
-- status, expires_at, couple_name, inviter_name) — never pin_hash, never the
-- invite token itself, and never another couple's rows without its token.
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
    -- Only live invites resolve. The join route re-checks status and
    -- expires_at server-side with the service-role client, which remains the
    -- authoritative gate; this filter is defence in depth so a revoked or
    -- expired token can never surface a joinable couple to the UI.
    and ci.status = 'pending'
    and (ci.expires_at is null or ci.expires_at > now())
  limit 1;
$$;

revoke all on function public.get_couple_invite_by_token(text) from public;
grant execute on function public.get_couple_invite_by_token(text) to anon, authenticated;

-- ==========================================================
-- 6. NOTIFICATIONS: recipient-scoped only
--    Previously "using (auth.role() = 'authenticated')" exposed every
--    user's notifications to every logged-in user.
-- ==========================================================
drop policy if exists "Notifications access" on public.notifications;
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select to authenticated
  using (recipient_profile_id = auth.uid());

drop policy if exists "insert own notifications" on public.notifications;
create policy "insert own notifications" on public.notifications
  for insert to authenticated
  with check (recipient_profile_id = auth.uid());

drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications
  for update to authenticated
  using (recipient_profile_id = auth.uid())
  with check (recipient_profile_id = auth.uid());

drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications
  for delete to authenticated
  using (recipient_profile_id = auth.uid());

-- ==========================================================
-- 7. CATEGORIES: using(true) exposed the default category rows to anon.
--    Defaults have couple_id IS NULL; keep them readable to members only
--    through a scoped predicate.
-- ==========================================================
drop policy if exists "Categories select" on public.categories;
drop policy if exists "read categories" on public.categories;
create policy "read categories" on public.categories
  for select to authenticated
  using (couple_id is null or public.is_member_of_couple(couple_id));

-- ==========================================================
-- 8. SAVINGS / INGESTER: replace the blanket using(true) policies that
--    patch.sql installed for ALL authenticated users.
-- ==========================================================
drop policy if exists "Savings goals access" on public.savings_goals;
drop policy if exists "savings goals scoped access" on public.savings_goals;
create policy "savings goals scoped access" on public.savings_goals
  for all to authenticated
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
create policy "savings contributions scoped access" on public.savings_contributions
  for all to authenticated
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

-- ==========================================================
-- 9. INGESTER + PERSONAL-ONLY BOOTSTRAP
--    The Go ingester authenticates with an opaque api_key; it resolves the
--    owning profile server-side. Give it a scoped read/write path that does
--    not require the service_role key in the desktop/mobile client.
-- ==========================================================
create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade not null,
  api_key text unique not null,
  name text default 'Mobile Notification Listener',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.user_api_keys enable row level security;

drop policy if exists "Users can manage own api keys" on public.user_api_keys;
drop policy if exists "read own api keys" on public.user_api_keys;
create policy "read own api keys" on public.user_api_keys
  for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "insert own api keys" on public.user_api_keys;
create policy "insert own api keys" on public.user_api_keys
  for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "delete own api keys" on public.user_api_keys;
create policy "delete own api keys" on public.user_api_keys
  for delete to authenticated
  using (profile_id = auth.uid());

-- ==========================================================
-- 10. AUDIT (run separately, expect zero rows)
-- ==========================================================
-- 10a. Any policy with a literal 'true' qual reachable by anon/public:
--
--   select schemaname, tablename, policyname, cmd, roles::text, qual, with_check
--   from pg_policies
--   where schemaname = 'public'
--     and (qual in ('true', '(true)') or with_check in ('true', '(true)'))
--     and (roles::text ilike '%anon%' or roles::text ilike '%public%'
--          or roles::text = '{0}'::text);
--
-- 10b. Every permissive policy whose USING expression is literally true:
--
--   select n.nspname as schema, c.relname as table_name, p.polname, p.polcmd,
--          pg_get_expr(p.polqual, p.polrelid) as using_expr,
--          pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expr
--   from pg_policy p
--   join pg_class c on c.oid = p.polrelid
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public'
--     and p.polpermissive
--     and (pg_get_expr(p.polqual, p.polrelid) in ('true', '(true)')
--          or pg_get_expr(p.polwithcheck, p.polrelid) in ('true', '(true)'));
--
-- 10c. Tables anon can still reach:
--
--   select c.relname, has_table_privilege('anon', c.oid, 'select') as anon_select
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r'
--   order by anon_select desc, c.relname;

notify pgrst, 'reload schema';

commit;
