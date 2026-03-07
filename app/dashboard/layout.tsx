import { cookies } from "next/headers";
import OnboardingBanner from "@/components/onboarding/OnboardingBanner";
import { ActiveWorkspaceProvider } from "@/lib/workspace/context";
import { createClient } from "@/lib/supabase/server";
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
  }

  return (
    <ActiveWorkspaceProvider initialActiveWorkspaceId={activeWorkspaceId}>
      <OnboardingBanner />
      {children}
    </ActiveWorkspaceProvider>
  );
}
