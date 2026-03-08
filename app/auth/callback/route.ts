import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resolvePostAuthRedirect } from "@/lib/auth/postAuthRedirect";
import {
  ACTIVE_WORKSPACE_COOKIE,
  getActiveWorkspaceCookieOptions,
} from "@/lib/workspace/active";
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

      // Ensure every user has at least one workspace ("Un-Named")
      const { data: memberships, error: memError } = await supabase
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: true });

      let activeWorkspaceId: string | null = null;

      if (memError || !memberships?.length) {
        try {
          const admin = await createAdminClient();
          const { data: tenant, error: tenantError } = await admin
            .from("tenants")
            .insert({ name: "Un-Named", status: "draft" })
            .select("id")
            .single();
          if (!tenantError && tenant) {
            await admin.from("tenant_memberships").insert({
              tenant_id: tenant.id,
              user_id: data.user.id,
              role: "owner",
            });
            activeWorkspaceId = tenant.id;
          }
        } catch {
          // continue without setting cookie; GET /api/v1/workspaces will create workspace later
        }
      } else {
        // Use first membership only to set initial cookie and redirect target (not for workspace-scoped data).
        activeWorkspaceId = memberships[0].tenant_id;
      }

      const destination = await resolvePostAuthRedirect(data.user.id, activeWorkspaceId);
      const res = NextResponse.redirect(`${baseUrl}${destination}`);
      if (activeWorkspaceId) {
        const opts = getActiveWorkspaceCookieOptions();
        res.cookies.set(ACTIVE_WORKSPACE_COOKIE, activeWorkspaceId, opts);
      }
      return res;
    }
  }

  return NextResponse.redirect(`${baseUrl}/auth/error`);
}
