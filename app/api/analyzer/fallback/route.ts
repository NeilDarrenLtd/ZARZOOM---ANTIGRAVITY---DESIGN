/**
 * POST /api/analyzer/fallback
 *
 * Public endpoint called when the main analyzer service is unavailable,
 * times out, or is under high load.
 *
 * Inserts a fallback queue record so the analysis can be prepared and emailed
 * to the user when capacity is restored. No auth required.
 *
 * Request body:
 *   { profile_url: string; email?: string }
 *
 * Response 202:
 *   { queued: true; has_email: boolean; queue_id: string }
 *
 * Response 429 — IP rate-limited (max 3 fallback requests per IP per hour)
 * Response 422 — validation error
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

// ── Validation ────────────────────────────────────────────────────────────────

const FallbackRequestSchema = z.object({
  profile_url: z.string().url("Must be a valid URL"),
  email: z.string().email("Must be a valid email address").optional().or(z.literal("")),
});

// ── Simple in-memory IP rate-limiter (3 req / IP / hour) ─────────────────────
// Intentionally lightweight — a full Redis limiter would be overkill for this
// low-traffic fallback path.

const ipFallbackMap = new Map<string, { count: number; resetAt: number }>();

function checkFallbackIpLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipFallbackMap.get(ip);

  if (!entry || entry.resetAt < now) {
    ipFallbackMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }

  if (entry.count >= 3) return false;

  entry.count += 1;
  return true;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = FallbackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 422 }
    );
  }

  const { profile_url, email } = parsed.data;
  const cleanEmail = email && email.length > 0 ? email : null;

  // IP rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkFallbackIpLimit(ip)) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many fallback requests from this IP. Please try again later.",
        },
      },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  const sessionId =
    req.headers.get("x-analyzer-session-id") ?? `anon-fallback-${Date.now()}`;

  // Insert fallback queue row
  const supabase = await createAdminClient();

  const { data: row, error: dbErr } = await supabase
    .from("analysis_queue")
    .insert({
      profile_url,
      platform: detectPlatformLabel(profile_url),
      email: cleanEmail,
      session_id: sessionId,
      ip_address: ip,
      status: "pending",
      is_fallback: true,
      payload_json: {
        profile_url,
        email: cleanEmail,
        timestamp: new Date().toISOString(),
        source: "fallback_widget",
      },
    })
    .select("id")
    .single();

  if (dbErr || !row) {
    console.error("[Analyzer/fallback] DB insert failed:", dbErr);
    // Return success anyway — we don't want to show a second error to the user
    return NextResponse.json(
      { queued: true, has_email: !!cleanEmail, queue_id: null },
      { status: 202 }
    );
  }

  return NextResponse.json(
    {
      queued: true,
      has_email: !!cleanEmail,
      queue_id: row.id,
    },
    { status: 202 }
  );
}

// ── Platform detection (label only, no enum needed here) ─────────────────────

function detectPlatformLabel(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("x.com") || u.includes("twitter.com")) return "twitter";
  if (u.includes("facebook.com")) return "facebook";
  if (u.includes("pinterest.com")) return "pinterest";
  if (u.includes("threads.net")) return "threads";
  if (u.includes("reddit.com")) return "reddit";
  if (u.includes("bsky.app")) return "bluesky";
  return "unknown";
}
