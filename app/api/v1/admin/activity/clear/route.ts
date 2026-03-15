import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/v1/admin/activity/clear
 * Body (optional): { category?: string } — e.g. "analyzer" or "wizard". Omit to clear all.
 * Deletes activity log rows. Admin only.
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const category = typeof body.category === "string" ? body.category.trim() : null;

    const admin = await createAdminClient();
    const query = category
      ? admin.from("activity_logs").delete().eq("category", category)
      : admin.from("activity_logs").delete();

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, cleared: category || "all" });
  } catch (err) {
    console.error("[activity/clear] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
