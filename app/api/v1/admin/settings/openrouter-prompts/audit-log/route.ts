import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    // Check admin auth
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

    // Use admin client to read all audit records
    const adminSupabase = await createAdminClient();
    const { data: auditRows, error } = await adminSupabase
      .from("wizard_autofill_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[v0] Failed to fetch audit logs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with user emails from profiles table
    const userIds = [...new Set((auditRows || []).map((r: any) => r.user_id))];
    let emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await adminSupabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      if (profiles) {
        emailMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.email]));
      }
    }

    const enriched = (auditRows || []).map((row: any) => ({
      ...row,
      profiles: { email: emailMap[row.user_id] || null },
    }));

    return NextResponse.json({ data: enriched });
  } catch (err) {
    console.error("[v0] Audit log API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
