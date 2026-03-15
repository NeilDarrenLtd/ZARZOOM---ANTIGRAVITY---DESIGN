import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const VALID_LIMITS = [50, 100, 500] as const;
type ValidLimit = (typeof VALID_LIMITS)[number];

/**
 * GET /api/v1/admin/activity/logs
 *
 * Returns paginated activity_logs rows for the /admin/logs page.
 *
 * Query params:
 *   limit    – rows per page: 50 | 100 | 500 (default 50)
 *   offset   – row offset for pagination (default 0)
 *   category – optional category filter (e.g. "analyzer")
 *   search   – optional keyword filter (case-insensitive match on stage or details)
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

    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10);
    const limit: ValidLimit = VALID_LIMITS.includes(rawLimit as ValidLimit)
      ? (rawLimit as ValidLimit)
      : 50;
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
    const category = searchParams.get("category")?.trim() || null;
    const search = searchParams.get("search")?.trim() || null;

    const adminSupabase = await createAdminClient();

    let query = adminSupabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq("category", category);
    }

    if (search) {
      query = query.or(
        `stage.ilike.%${search}%,profile_url.ilike.%${search}%`
      );
    }

    const { data: rows, error, count } = await query;

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[activity_logs] Failed to fetch logs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const userIds = [
      ...new Set(
        (rows || [])
          .map((r: Record<string, unknown>) => r.user_id as string | null)
          .filter(Boolean) as string[]
      ),
    ];

    let emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await adminSupabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      if (profiles) {
        emailMap = Object.fromEntries(
          profiles.map((p: Record<string, unknown>) => [
            p.id as string,
            p.email as string,
          ])
        );
      }
    }

    const enriched = (rows || []).map((row: Record<string, unknown>) => ({
      ...row,
      user_email: row.user_id ? emailMap[row.user_id as string] || null : null,
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
    // eslint-disable-next-line no-console
    console.error("[activity_logs] API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

