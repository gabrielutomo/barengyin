# Supabase Auth Configuration — Dashboard Steps

These are **dashboard settings**, not SQL. The database migration cannot change them.
Project: `wfvsnuhpzllfiniinaxo`

Verified live before the fix — `/auth/v1/settings` returned:

```
mailer_autoconfirm = true     ← signup confirms email instantly
disable_signup     = false    ← anyone can create an account
(captcha keys absent)         ← no server-side bot protection
```

---

## 1. Require email confirmation

**Authentication → Sign In / Providers → Email**

- [ ] Enable **Confirm email**
- [ ] Disable **Allow new users to sign up** *only if* signup must be invite-only.
      Leave it on if you still want self-serve signup, but then section 3 is mandatory.

Enabling **Confirm email** is what flips `mailer_autoconfirm` to `false`.
Confirm the change actually landed:

```bash
curl -s "$SUPABASE_URL/auth/v1/settings" -H "apikey: $ANON" \
  | python -m json.tool | grep -E "mailer_autoconfirm|disable_signup"
```

Expect `"mailer_autoconfirm": false`.

> Requires a working SMTP sender (Supabase's built-in sender is heavily rate-limited
> and not for production). Configure **Project Settings → Auth → SMTP Settings**
> first, or confirmation emails will not arrive.

## 2. Rate limits

**Authentication → Rate Limits**

| Setting | Suggested | Why |
|---|---|---|
| Sign-ups / hour (per IP) | `10` | caps scripted account creation |
| Token refreshes / hour (per IP) | `150` | limits session farming |
| OTP / magic-link / hour (per IP) | `10` | limits mail abuse |
| Emails / hour (project-wide) | `50` | caps SMTP cost |

These are stored under `rate_limit_*` and are **not** exposed by `/auth/v1/settings`,
so verify in the dashboard after saving.

## 3. Bot protection (captcha)

**Deploy order — three steps, and the order is load-bearing:**

1. **Merge and deploy this branch first.** The live site still runs the old
   code. Verified while writing this: `POST https://barengyinyuk.my.id/api/verify-turnstile`
   with `{"token":"dev-bypass-x"}` still returns `{"success":true}`. The
   `dev-bypass-` guard and the `captchaToken` wiring exist only on this branch,
   so the app's bot gate stays bypassable until it is deployed.
2. **Then enable captcha in the dashboard** (below). Doing this first rejects
   every sign-in, because the deployed code must already send `captchaToken`.
3. **Then verify** the PIN-vault unlock path still works (see the known gap below).

- [ ] Enable **Enable CAPTCHA protection**
- [ ] Provider: **Cloudflare Turnstile**
- [ ] Secret key: paste the value of `TURNSTILE_SECRET_KEY` from `.env`

Without step 2 the app's Turnstile gate is bypassable, and without the Supabase
setting anyone can skip captcha entirely by calling `/auth/v1/signup` directly —
that was reproduced: no captcha token still returned a session with
`email_verified: true`.

**Step 2 alone is not enough, and enabling it before step 1 will reject every
sign-in.** Supabase only accepts a captcha-protected auth request when the
client sends a `captchaToken`. `app/masuk/page.tsx` now passes it on the two
flows that render the widget:

| Call | Location | Sends `captchaToken` |
|---|---|---|
| `supabase.auth.signUp` | `app/masuk/page.tsx` | yes |
| `supabase.auth.signInWithPassword` (email + password) | `app/masuk/page.tsx` | yes |
| `supabase.auth.signInWithPassword` (PIN vault unlock) | `app/masuk/page.tsx` | no — no widget on that path |

> **Known gap:** the PIN-vault unlock path has no Turnstile widget, so it cannot
> send a token. Supabase's captcha protection by default applies to signup, OTP
> and password-recovery — **not** to password sign-in — so this path should keep
> working. Verify it after enabling captcha; if Supabase starts rejecting it,
> either render a widget on that path or turn off captcha for sign-in only.

Both keys must be the **real** Cloudflare ones. Each has a public test
placeholder wired in as a fallback, and a test key on either side breaks
production in a way that looks like "captcha always fails":

```
components/turnstile.tsx:42        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
                                   ⚠ falls back to test sitekey 1x00000000000000000000AA
app/api/verify-turnstile/route.ts  process.env.TURNSTILE_SECRET_KEY
                                   ⚠ falls back to test secret 1x0000000000000000000000000000000AA
```

A **test sitekey with a real secret** mints tokens the real secret rejects, so
every login fails. A **real sitekey with a test secret** is worse — the public
test secret accepts anything, so the gate is decorative. Set both in Vercel and
confirm neither fallback is in play:

```bash
# both must print a real value, not a 1x000... placeholder
grep -rn "NEXT_PUBLIC_TURNSTILE_SITE_KEY\|TURNSTILE_SECRET_KEY" .env.local
```

The test values are fine for local dev only.

Any token prefixed `dev-bypass-` is accepted **only when
`NODE_ENV !== "production"`**. That branch previously ran unconditionally and
was verified exploitable on the live site (`POST /api/verify-turnstile` with
`{"token":"dev-bypass-x"}` returned `{"success":true}`), so do not remove the
guard.

## 4. Prove the service_role key never reaches the browser

Run after `npx next build`:

```bash
# no reference to the role or the env var name in client assets
grep -rIl "service_role"      .next/static && echo "LEAK" || echo "PASS"
grep -rIl "SUPABASE_SERVICE_ROLE" .next/static && echo "LEAK" || echo "PASS"

# the actual key value must be absent from the entire build output
grep -rIl "$SUPABASE_SERVICE_ROLE_KEY" .next/ && echo "LEAK" || echo "PASS"
```

Verified in this repo: all three pass. The key is 219 chars and appears nowhere
in `.next/`.

`NEXT_PUBLIC_*` variables are the only ones inlined into the client bundle. The
service key has no such prefix and is only read in `utils/supabase/admin.ts`,
which **throws** if imported in a browser context.
