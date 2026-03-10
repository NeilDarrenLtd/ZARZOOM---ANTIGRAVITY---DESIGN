import { cookies } from "next/headers";
import OnboardingBanner from "@/components/onboarding/OnboardingBanner";
import PaymentRequiredBanner from "@/components/dashboard/PaymentRequiredBanner";
import { ActiveWorkspaceProvider } from "@/lib/workspace/context";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  getActiveWorkspaceId,
  ACTIVE_WORKSPACE_COOKIE,
  getActiveWorkspaceCookieOptions,
} from "@/lib/workspace/active";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let activeWorkspaceId: string | null = null;
  let subscriptionStatus: string = "none";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
    try {
      const result = await getActiveWorkspaceId(
        supabase,
        user.id,
        cookieValue
      );
      activeWorkspaceId = result.activeWorkspaceId;
      if (result.shouldSetCookie) {
        cookieStore.set(ACTIVE_WORKSPACE_COOKIE, result.activeWorkspaceId, {
          ...getActiveWorkspaceCookieOptions(),
        });
      }
    } catch {
      activeWorkspaceId = null;
    }

    if (activeWorkspaceId) {
      try {
        const admin = await createAdminClient();
        const { data: sub } = await admin
          .from("tenant_subscriptions")
          .select("status")
          .eq("tenant_id", activeWorkspaceId)
          .in("status", ["active", "trialing", "past_due", "incomplete", "canceled"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        subscriptionStatus = sub?.status ?? "none";
      } catch {
        subscriptionStatus = "none";
      }
    }
  }

  return (
    <ActiveWorkspaceProvider initialActiveWorkspaceId={activeWorkspaceId}>
      <PaymentRequiredBanner initialStatus={subscriptionStatus} />
      <OnboardingBanner />
      {children}
    </ActiveWorkspaceProvider>
  );
}
