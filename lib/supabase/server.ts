import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/api/env'

export async function createClient() {
  const cookieStore = await cookies()
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env()

  return createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from Server Component - ignored if middleware handles refresh
          }
        },
      },
    },
  )
}

/**
 * Service-role admin client.
 * Uses the raw @supabase/supabase-js createClient (no cookies) so that
 * auth.role() evaluates to 'service_role' and RLS service-role policies work.
 */
export async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  return createSupabaseClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
