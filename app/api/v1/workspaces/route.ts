import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ──────────────────────────────────────────────
// GET /api/v1/workspaces
// Returns all workspaces the authenticated user belongs to,
// with their subscription status and the user's role.
// ──────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all memberships for this user
    const { data: memberships, error: membershipError } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (membershipError) {
      return NextResponse.json(
        { error: "Failed to fetch workspaces", details: membershipError.message },
        { status: 500 }
      );
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ workspaces: [] });
    }

    const tenantIds = memberships.map((m) => m.tenant_id);

    // Fetch subscription status for these tenants
    const { data: subscriptions } = await supabase
      .from("tenant_subscriptions")
      .select("tenant_id, status")
      .in("tenant_id", tenantIds);

    const subscriptionMap = new Map<string, string>(
      (subscriptions ?? []).map((s) => [s.tenant_id, s.status])
    );

    // Fetch onboarding profiles to get business name per tenant
    // The onboarding_profiles table is user-scoped, so we use the user's profile
    // for the primary workspace name. For additional workspaces we fall back to the tenant_id.
    const { data: onboarding } = await supabase
      .from("onboarding_profiles")
      .select("business_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const primaryTenantId = memberships[0]?.tenant_id;

    const workspaces = memberships.map((m, index) => {
      const subStatus = subscriptionMap.get(m.tenant_id);

      // Derive a display status
      let status: "active" | "setup_incomplete" | "payment_required";
      if (subStatus === "active" || subStatus === "trialing") {
        status = "active";
      } else if (subStatus === "past_due" || subStatus === "unpaid") {
        status = "payment_required";
      } else {
        status = "setup_incomplete";
      }

      // Use business name for primary workspace, generic label for others
      const name =
        m.tenant_id === primaryTenantId && onboarding?.business_name
          ? onboarding.business_name
          : `Workspace ${index + 1}`;

      return {
        id: m.tenant_id,
        name,
        status,
        role: m.role as "owner" | "admin" | "member" | "viewer",
        created_at: m.created_at,
      };
    });

    return NextResponse.json({ workspaces });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
