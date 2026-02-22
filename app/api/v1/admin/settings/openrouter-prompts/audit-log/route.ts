import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/api/auth-helpers";

export async function GET() {
  try {
    const { user } = await requireAuthenticatedUser();
    const adminSb = await createAdminClient();

    // Check admin
    const { data: profile } = await adminSb
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch recent audit logs with user email
    const { data: logs, error } = await adminSb
      .from("wizard_autofill_audit")
      .select(`
        id,
        user_id,
        source_type,
        source_identifier,
        status,
        error_message,
        fields_populated,
        confidence_scores,
        debug_data,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[v0] Failed to fetch audit logs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with user emails
    const userIds = [...new Set((logs || []).map((l: any) => l.user_id))];
    const { data: users } = await adminSb
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds);

    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    const enrichedLogs = (logs || []).map((log: any) => {
      const u = userMap.get(log.user_id);
      return {
        ...log,
        user_email: u?.email || u?.display_name || log.user_id,
        debug_data: typeof log.debug_data === "string"
          ? JSON.parse(log.debug_data)
          : log.debug_data,
      };
    });

    return NextResponse.json({ data: enrichedLogs });
  } catch (err: any) {
    console.error("[v0] Audit log fetch error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
