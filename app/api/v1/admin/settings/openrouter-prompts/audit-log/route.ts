import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const VALID_LIMITS = [50, 100, 500] as const;
type ValidLimit = (typeof VALID_LIMITS)[number];

/**
 * GET /api/v1/admin/settings/openrouter-prompts/audit-log
 * Returns paginated autofill audit records for admin view.
 *
 * Query params:
 *   limit  – rows per page: 50 | 100 | 500  (default 50)
 *   offset – row offset for pagination        (default 0)
 */
export async function GET(req: NextRequest) {
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

    // Parse pagination params
    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10);
    const limit: ValidLimit = VALID_LIMITS.includes(rawLimit as ValidLimit)
      ? (rawLimit as ValidLimit)
      : 50;
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

    const adminSupabase = await createAdminClient();

    // Fetch the page + total count in one query
    const { data: auditRows, error, count } = await adminSupabase
      .from("wizard_autofill_audit")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Failed to fetch audit logs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const userIds = [
      ...new Set((auditRows || []).map((r: Record<string, unknown>) => r.user_id as string)),
    ];
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
      user_email: emailMap[row.user_id as string] || null,
    }));

    return NextResponse.json({
      data: enriched,
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        has_more: offset + limit < (count ?? 0),
      },
    });
  } catch (err) {
    console.error("Audit log API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
