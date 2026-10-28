import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service_role key.
 *
 * The service_role key bypasses RLS, so this client MUST never be imported
 * from a Client Component. If it were, the key would land in the browser
 * bundle and every RLS policy in the database would be decorative.
 *
 * There is deliberately NO fallback to NEXT_PUBLIC_SUPABASE_ANON_KEY. A
 * missing service_role key is a configuration error: falling back to the
 * anon key turns every privileged write into a silent no-op (or an RLS
 * denial) and, worse, invites re-introducing world-readable policies to
 * "fix" it. Fail loudly instead.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL is not configured."
    );
  }

  if (!serviceKey) {
    throw new Error(
      "createAdminClient: SUPABASE_SERVICE_ROLE_KEY is not configured. " +
        "Set it in Vercel (Server-side env vars) and in .env.local for local dev. " +
        "Do not fall back to the anon key — privileged operations must not run unprivileged."
    );
  }

  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient: attempted to run the service_role client in the browser. " +
        "Move this call into a Server Action, Route Handler, or Server Component."
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
