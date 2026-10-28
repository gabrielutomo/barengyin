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

**Order matters — the code change is already committed, but it must be deployed
before or with this dashboard change.**

- [ ] Enable **Enable CAPTCHA protection**
- [ ] Provider: **Cloudflare Turnstile**
- [ ] Secret key: paste the value of `TURNSTILE_SECRET_KEY` from `.env`

Without this step, the app's Turnstile gate is decorative — it was verified
exploitable: a direct call to Supabase signup with no captcha token returned a
session and marked the email verified.

**The dashboard setting alone is not enough, and enabling it without the code
deployed will reject every sign-in.** Supabase only accepts a captcha-protected
auth request when the client sends a `captchaToken`. `app/masuk/page.tsx` now
passes it on the two flows that render the widget:

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

The app reads these env names:

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY   # client widget (app/masuk/page.tsx)
TURNSTILE_SECRET_KEY             # Cloudflare siteverify (app/api/verify-turnstile/route.ts)
```

`app/api/verify-turnstile/route.ts` falls back to Cloudflare's public **test**
secret (`1x0000000000000000000000000000000AA`) when `TURNSTILE_SECRET_KEY` is
unset. That key always passes — it is fine for local dev, dangerous in production.
Ensure the real key is set in the Vercel environment.

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
