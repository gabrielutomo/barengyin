# Security Hardening — Runbook

Remediation for the `profiles` public-read leak and `pin_hash` exposure.
Project: `wfvsnuhpzllfiniinaxo` (barengyinyuk.my.id)

---

## 1. What was wrong

Verified live against production before the fix:

| # | Issue | Evidence |
|---|-------|----------|
| 1 | Anyone with the publishable key could read **every** profile row | `GET /rest/v1/profiles?select=*` with only `apikey` → `200`, `Content-Range: 0-4/*` (all 5 rows) |
| 2 | `pin_hash` was one of the leaked columns | 2 of 5 rows returned a 64-char hash |
| 3 | Two users shared one hash | static salt → identical hash for the same PIN |
| 4 | Signup was open and email auto-confirmed | `/auth/v1/settings` → `mailer_autoconfirm: true`, `disable_signup: false` |
| 5 | Captcha was enforced **only in app code** | `POST /auth/v1/signup` with no captcha → `200` + session |

Root cause of #1: the policy `using (true)` on `profiles`, *combined with* Supabase's
default `grant all on all tables in schema public to anon`. RLS is the second line of
defence; the default GRANT was the first, and it was wide open.

## 2. Apply the database fix

> **Order matters.** Apply this migration **before** deploying the new app code.
> Verified live: `couple_secrets`, `profile_secrets` and all three new RPCs
> (`couple_member_profiles`, `couple_pin_configured`,
> `verify_couple_pin_for_invite`) currently return **404** in production. The new
> frontend calls them on nearly every page. Database first, then deploy.

Run `supabase/migrations/20261028000000_security_hardening.sql` in
**Supabase Dashboard → SQL Editor** for project `wfvsnuhpzllfiniinaxo`.

It is idempotent — running it twice is safe. It:

1. creates `couple_secrets` / `profile_secrets`, RLS on, `anon` revoked;
2. copies existing `pin_hash` values across, then drops the legacy columns;
3. turns RLS on for every application table;
4. revokes **all** table/sequence/function privileges from `anon` and changes
   default privileges so future tables are not silently exposed;
5. replaces every `using (true)` / `auth.role() = 'authenticated'` policy with
   a scoped one.

The only privilege `anon` keeps is `execute` on `get_couple_invite_by_token(text)`,
because the invite page is opened by visitors who are not signed in yet.

## 3. Apply the auth config fix

Database cannot fix these — they are dashboard settings. See
`documentation/SECURITY-AUTH-CONFIG.md`.

## 4. Verify

Run these after section 2. `$ANON` is `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

```bash
ANON=... URL=https://wfvsnuhpzllfiniinaxo.supabase.co

# (1) anon, apikey only -> MUST be 401 or []
curl -s -i "$URL/rest/v1/profiles?select=*" -H "apikey: $ANON"

# (2) signed-in user reads own row -> MUST be exactly 1 row
curl -s -i "$URL/rest/v1/profiles?select=id,full_name" \
  -H "apikey: $ANON" -H "Authorization: Bearer $USER_A_JWT"

# (3) user A reads user B -> MUST be []
curl -s -i "$URL/rest/v1/profiles?select=id,full_name&id=eq.$USER_B_ID" \
  -H "apikey: $ANON" -H "Authorization: Bearer $USER_A_JWT"
```

Audit query — expect **zero rows**:

```sql
select c.relname, p.polname, p.polqual, p.polwithcheck
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and (p.polqual::text = 'true' or p.polwithcheck::text = 'true');
```

## 5. Known follow-ups

- `lib/pin-auth.ts` hashes the PIN with SHA-256 and a **static** salt
  (`barengyin-salt:<pin>`). That is why two users with the same PIN share a hash.
  Moving to per-user `crypt()`/bcrypt is a format change and needs a migration of
  live hashes — decide before changing.
- `couple_member_profiles()` is `SECURITY DEFINER`, not a `security_invoker` view.
  Required: under `auth.uid() = id` a view cannot return a partner's row.
  It is hard-scoped to the caller's own couple memberships and returns safe
  columns only.
- Captcha must be enabled in Supabase (Authentication → Attack Protection),
  not just in app code — otherwise `/auth/v1/signup` can be called directly.
