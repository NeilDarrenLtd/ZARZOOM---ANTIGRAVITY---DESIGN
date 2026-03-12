import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resolvePostAuthRedirect } from "@/lib/auth/postAuthRedirect";
import {
  ACTIVE_WORKSPACE_COOKIE,
  getActiveWorkspaceCookieOptions,
} from "@/lib/workspace/active";
import { NextResponse } from "next/server";

const ANALYSIS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Attempt to claim an analysis for a newly authenticated user.
 * Non-fatal — a failed claim does not block the signup flow.
 */
async function claimAnalysis(
  baseUrl: string,
  analysisId: string,
  userId: string
): Promise<void> {
  try {
    const { createClient: createAdminSupa } = await import("@supabase/supabase-js");
    const admin = createAdminSupa(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Guard: only claim if unclaimed
    const { data: row } = await admin
      .from("analysis_cache")
      .select("claimed_user_id")
      .eq("id", analysisId)
      .maybeSingle();

    if (!row) return; // analysis not found
    if (row.claimed_user_id && row.claimed_user_id !== userId) return; // owned by another user

    await Promise.allSettled([
      admin
        .from("analysis_cache")
        .update({ claimed_user_id: userId })
        .eq("id", analysisId)
        .is("claimed_user_id", null),
      admin
        .from("analysis_queue")
        .update({ claimed_user_id: userId })
        .eq("id", analysisId)
        .is("claimed_user_id", null),
    ]);
  } catch (err) {
    console.error("[AuthCallback] claimAnalysis error:", err);
  }
}

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
  // analysis_id: persist the analyzer funnel unlock through signup
  const rawAnalysisId = searchParams.get("analysis_id") ?? null;
  const analysisId =
    rawAnalysisId && ANALYSIS_ID_RE.test(rawAnalysisId) ? rawAnalysisId : null;
  const baseUrl = getBaseUrl(request.url);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // ── Analyzer unlock flow ───────────────────────────────────────────
      // If the user arrived from the teaser report's "Unlock" CTA, claim the
      // analysis and redirect straight back to the report — do NOT start
      // onboarding before the user sees their report (per spec).
      if (analysisId) {
        await claimAnalysis(baseUrl, analysisId, data.user.id);
        const res = NextResponse.redirect(
          `${baseUrl}/en/analyzer/${analysisId}?claimed=1`
        );
        return res;
      }

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
