import { createAdminClient } from "@/lib/supabase/server";

export type ActivityLogLevel = "info" | "warn" | "error";

export interface ActivityLogInput {
  category: string;
  stage: string;
  level?: ActivityLogLevel;
  analysisId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  profileUrl?: string | null;
  platform?: string | null;
  source?: "frontend" | "backend" | "worker" | string | null;
  details?: Record<string, unknown> | null;
}

/**
 * Append a row to activity_logs.
 *
 * All stages are always logged. This helper is intentionally best-effort:
 * it should never throw back into the primary request/worker path.
 * Failures are logged to stderr.
 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    const admin = await createAdminClient();
    const { error } = await admin.from("activity_logs").insert({
      category: input.category,
      stage: input.stage,
      level: input.level ?? "info",
      analysis_id: input.analysisId ?? null,
      user_id: input.userId ?? null,
      session_id: input.sessionId ?? null,
      profile_url: input.profileUrl ?? null,
      platform: input.platform ?? null,
      source: input.source ?? "backend",
      details: input.details ?? null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[activity_logs] Failed to insert log row", error);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[activity_logs] Unexpected failure while logging", err);
  }
}
