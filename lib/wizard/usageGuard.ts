import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingUpdate } from "@/lib/validation/onboarding";

// ──────────────────────────────────────────────
// Autofill usage guard
// Enforces: 2 runs/day (combined), 10 lifetime before degradation
// ──────────────────────────────────────────────

export interface UsageCheckResult {
  allowed: boolean;
  degraded: boolean;
  reason?: "daily_limit" | "blocked" | "profile_not_found" | "suspended";
  dailyRemaining: number;
  lifetimeTotal: number;
}

/**
 * Check whether a user is allowed to run autofill.
 * Calls the DB function which handles daily reset and degradation.
 */
export async function checkAutofillUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<UsageCheckResult> {
  // First check if user is suspended
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_suspended")
    .eq("id", userId)
    .single();

  if (profile?.is_suspended) {
    return {
      allowed: false,
      degraded: false,
      reason: "suspended",
      dailyRemaining: 0,
      lifetimeTotal: 0,
    };
  }

  const { data, error } = await supabase.rpc("check_autofill_usage", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[usageGuard] Failed to check autofill usage:", error.message);
    // Fail-open: allow but treat as degraded to avoid blocking users
    // due to transient DB issues
    return {
      allowed: true,
      degraded: true,
      dailyRemaining: 0,
      lifetimeTotal: 0,
    };
  }

  const result = data as Record<string, unknown>;

  return {
    allowed: result.allowed === true,
    degraded: result.degraded === true,
    reason: result.reason as UsageCheckResult["reason"],
    dailyRemaining: (result.daily_remaining as number) ?? 0,
    lifetimeTotal: (result.lifetime_total as number) ?? 0,
  };
}

/**
 * Increment autofill usage after a successful run.
 */
export async function incrementAutofillUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc("increment_autofill_usage", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[usageGuard] Failed to increment usage:", error.message);
  }
}

// ──────────────────────────────────────────────
// Free / degraded analysis (no OpenRouter cost)
// ──────────────────────────────────────────────
// Basic regex/heuristic extraction from text content.
// Nowhere near as good as AI but provides something usable
// at zero cost for degraded users.
// ──────────────────────────────────────────────

export function freeBasicAnalysis(
  content: string,
  sourceType: "website" | "file"
): { data: Partial<OnboardingUpdate>; fieldsPopulated: number; missingFields: string[] } {
  const text = content.slice(0, 20000); // Cap processing
  const fields: Partial<OnboardingUpdate> = {};
  const populated: string[] = [];
  const missing: string[] = [];

  // ── Business name ──────────────────────────
  // Try <title> tag, og:title, or first heading
  const titleMatch =
    text.match(/<title[^>]*>([^<]+)<\/title>/i) ||
    text.match(/og:title["\s]*content="([^"]+)"/i);
  if (titleMatch) {
    // Clean up common suffixes like " | Home" or " - Welcome"
    let name = titleMatch[1]
      .split(/\s*[\|–—-]\s*/)[0]
      .trim();
    if (name.length > 2 && name.length < 120) {
      fields.business_name = name;
      populated.push("business_name");
    }
  }
  if (!fields.business_name) missing.push("business_name");

  // ── Business description ───────────────────
  const descMatch =
    text.match(/meta\s+name="description"\s+content="([^"]+)"/i) ||
    text.match(/og:description["\s]*content="([^"]+)"/i);
  if (descMatch && descMatch[1].length > 20) {
    fields.business_description = descMatch[1].trim();
    populated.push("business_description");
  }
  if (!fields.business_description) missing.push("business_description");

  // ── Brand color ────────────────────────────
  const colorMatch =
    text.match(/theme-color["\s]*content="(#[0-9a-fA-F]{3,8})"/i) ||
    text.match(/brand[_-]?colou?r[:\s]*["']?(#[0-9a-fA-F]{3,8})/i);
  if (colorMatch) {
    fields.brand_color_hex = colorMatch[1];
    populated.push("brand_color_hex");
  }
  if (!fields.brand_color_hex) missing.push("brand_color_hex");

  // ── Content language ───────────────────────
  const langMatch = text.match(/<html[^>]*\slang="([a-z]{2})"/i);
  if (langMatch) {
    fields.content_language = langMatch[1];
    populated.push("content_language");
  }

  // ── Goals from keywords ────────────────────
  const goalKeywords: Record<string, string> = {
    "brand awareness": "brand_awareness",
    "lead generation": "lead_gen",
    "seo": "seo",
    "thought leadership": "thought_leadership",
    "sales": "drive_sales",
    "community": "community_building",
    "educate": "educate_audience",
    "social media": "social_growth",
  };
  const detectedGoals: string[] = [];
  const lowerText = text.toLowerCase();
  for (const [keyword, goal] of Object.entries(goalKeywords)) {
    if (lowerText.includes(keyword)) {
      detectedGoals.push(goal);
    }
  }
  if (detectedGoals.length > 0) {
    fields.goals = detectedGoals.slice(0, 3) as OnboardingUpdate["goals"];
    populated.push("goals");
  }

  // Determine which important fields are still missing
  const allImportant = [
    "business_name",
    "business_description",
    "brand_color_hex",
    "goals",
    "content_language",
    "article_styles",
  ];
  for (const f of allImportant) {
    if (!populated.includes(f) && !missing.includes(f)) {
      missing.push(f);
    }
  }

  return {
    data: fields,
    fieldsPopulated: populated.length,
    missingFields: missing,
  };
}
