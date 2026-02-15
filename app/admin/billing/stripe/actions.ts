"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard – same pattern as the parent billing actions            */
/* ------------------------------------------------------------------ */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  if (user.user_metadata?.is_admin === true) return user;

  const adminSupabase = await createAdminClient();
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) throw new Error("Not authorised");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Env-var readiness check                                            */
/* ------------------------------------------------------------------ */

export type EnvStatus = {
  key: string;
  set: boolean;
  hint: string;
};

export async function fetchEnvStatus(): Promise<{
  vars: EnvStatus[];
  webhookUrl: string;
  error?: string;
}> {
  try {
    await requireAdmin();

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.SITE_URL ||
      "http://localhost:3000";

    const vars: EnvStatus[] = [
      {
        key: "STRIPE_SECRET_KEY",
        set: !!process.env.STRIPE_SECRET_KEY,
        hint: "Stripe Dashboard > Developers > API keys > Secret key",
      },
      {
        key: "STRIPE_WEBHOOK_SECRET",
        set: !!process.env.STRIPE_WEBHOOK_SECRET,
        hint: "Stripe Dashboard > Developers > Webhooks > Signing secret (whsec_...)",
      },
      {
        key: "NEXT_PUBLIC_APP_URL",
        set: !!process.env.NEXT_PUBLIC_APP_URL,
        hint: "Your deployed app URL, e.g. https://app.zarzoom.com",
      },
    ];

    return {
      vars,
      webhookUrl: `${appUrl}/api/v1/webhooks/billing`,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to check env";
    return { vars: [], webhookUrl: "", error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Last 10 dedupe rows                                                */
/* ------------------------------------------------------------------ */

export type DedupeRow = {
  id: string;
  received_at: string;
};

export async function fetchRecentDedupeEvents(): Promise<{
  events: DedupeRow[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const admin = await createAdminClient();

    const { data, error } = await admin
      .from("stripe_event_dedupe")
      .select("id, received_at")
      .order("received_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    return { events: (data ?? []) as DedupeRow[] };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch dedupe events";
    return { events: [], error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Tenant subscription status (current admin's first tenant)          */
/* ------------------------------------------------------------------ */

export type SubRow = {
  id: string;
  tenant_id: string;
  status: string;
  billing_provider: string | null;
  billing_provider_subscription_id: string | null;
  billing_provider_customer_id: string | null;
  plan_name: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export async function fetchCurrentSubscription(): Promise<{
  subscription: SubRow | null;
  error?: string;
}> {
  try {
    const user = await requireAdmin();
    const admin = await createAdminClient();

    // Find the admin's first membership
    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { subscription: null };
    }

    const { data: sub, error } = await admin
      .from("tenant_subscriptions")
      .select(
        `id, tenant_id, status, billing_provider,
         billing_provider_subscription_id,
         billing_provider_customer_id,
         current_period_start, current_period_end,
         cancel_at_period_end,
         plan_id`
      )
      .eq("tenant_id", membership.tenant_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (!sub) return { subscription: null };

    // Resolve plan name
    let planName: string | null = null;
    if (sub.plan_id) {
      const { data: plan } = await admin
        .from("subscription_plans")
        .select("name")
        .eq("id", sub.plan_id)
        .single();
      planName = plan?.name ?? null;
    }

    return {
      subscription: {
        id: sub.id,
        tenant_id: sub.tenant_id,
        status: sub.status,
        billing_provider: sub.billing_provider,
        billing_provider_subscription_id:
          sub.billing_provider_subscription_id,
        billing_provider_customer_id: sub.billing_provider_customer_id,
        plan_name: planName,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch subscription";
    return { subscription: null, error: message };
  }
}
