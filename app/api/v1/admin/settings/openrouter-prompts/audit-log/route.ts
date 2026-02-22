import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/v1/admin/settings/openrouter-prompts/audit-log
 * Returns recent autofill audit records for admin view.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminSupabase = await createAdminClient();
    const { data: auditRows, error } = await adminSupabase
      .from("wizard_autofill_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Failed to fetch audit logs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const userIds = [...new Set((auditRows || []).map((r: Record<string, unknown>) => r.user_id as string))];
    let emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await adminSupabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      if (profiles) {
        emailMap = Object.fromEntries(
          profiles.map((p: Record<string, unknown>) => [p.id as string, p.email as string])
        );
      }
    }

    const enriched = (auditRows || []).map((row: Record<string, unknown>) => ({
      ...row,
      profiles: { email: emailMap[row.user_id as string] || null },
    }));

    return NextResponse.json({ data: enriched });
  } catch (err) {
    console.error("Audit log API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
