import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthRedirect } from "@/lib/auth/postAuthRedirect";
import { NextResponse } from "next/server";

function getBaseUrl(requestUrl: string): string {
  // 1. Explicit site URL (set by admin)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  // 2. Vercel production URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // 3. Vercel preview URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 4. Fall back to request origin
  const { origin } = new URL(requestUrl);
  return origin;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // If a "next" param points to a specific non-dashboard page (e.g. /auth/verified),
  // honour it. Otherwise let the onboarding resolver decide.
  const explicitNext = searchParams.get("next");
  const baseUrl = getBaseUrl(request.url);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // If an explicit non-default next was requested (e.g. email-verify flow), use it
      if (explicitNext && explicitNext !== "/dashboard") {
        return NextResponse.redirect(`${baseUrl}${explicitNext}`);
      }

      // Use centralised onboarding-aware redirect
      const destination = await resolvePostAuthRedirect(data.user.id);
      return NextResponse.redirect(`${baseUrl}${destination}`);
    }
  }

  return NextResponse.redirect(`${baseUrl}/auth/error`);
}
