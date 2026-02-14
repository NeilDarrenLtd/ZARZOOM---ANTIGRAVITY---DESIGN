import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { env } from "./env";
import { AuthError } from "./errors";

export interface AuthResult {
  user: User;
  supabase: SupabaseClient;
}

/**
 * Authenticate an incoming API request.
 *
 * Supports two patterns:
 *   1. Bearer token in the `Authorization` header (for machine-to-machine).
 *   2. Supabase session cookies (for browser-initiated requests).
 *
 * Returns the verified user and a scoped Supabase client.
 * Throws `AuthError` if no valid credentials are found.
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<AuthResult> {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();

  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  // Build a Supabase client that reads cookies from the request
  const supabase = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        /* Route handlers cannot set cookies on the response via this path;
           the handler factory will forward any Set-Cookie headers if needed. */
        setAll() {},
      },
      ...(bearerToken
        ? { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
        : {}),
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError("Invalid or expired authentication credentials");
  }

  return { user, supabase };
}
