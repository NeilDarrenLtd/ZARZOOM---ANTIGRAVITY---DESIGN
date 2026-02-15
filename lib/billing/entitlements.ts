import { createAdminClient } from "@/lib/supabase/server";
import type { PlanWithPrices, SubscriptionStatus } from "./types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface EffectivePlan {
  /** The subscription_plans row ID. */
  planId: string;
  /** Human-readable name, e.g. "Pro". */
  planName: string;
  /** URL-safe slug, e.g. "pro". */
  planSlug: string;
  /** Quota policy from subscription_plans.quota_policy. */
  quotaPolicy: Record<string, unknown>;
  /** Feature flags from subscription_plans.entitlements. */
  entitlements: Record<string, unknown>;
  /** Subscription status (active, trialing, past_due, etc.). */
  subscriptionStatus: SubscriptionStatus;
  /** When the current billing period ends (ISO string). */
  currentPeriodEnd: string | null;
  /** Whether the tenant is scheduled to cancel at period end. */
  cancelAtPeriodEnd: boolean;
  /** The plan_prices row ID currently in use. */
  priceId: string | null;
}

/** Returned when a tenant has no active subscription. */
export interface NoActivePlan {
  planId: null;
  planName: "free";
  planSlug: "free";
  quotaPolicy: Record<string, unknown>;
  entitlements: Record<string, unknown>;
  subscriptionStatus: "none";
  currentPeriodEnd: null;
  cancelAtPeriodEnd: false;
  priceId: null;
}

export type EffectivePlanResult = EffectivePlan | NoActivePlan;

/* ------------------------------------------------------------------ */
/*  Default free-tier entitlements (no subscription)                    */
/* ------------------------------------------------------------------ */

const FREE_TIER: NoActivePlan = {
  planId: null,
  planName: "free",
  planSlug: "free",
  quotaPolicy: {
    max_images_per_month: 5,
    max_videos_per_month: 0,
    max_articles_per_month: 2,
    max_social_posts_per_month: 5,
    max_api_keys: 1,
  },
  entitlements: {},
  subscriptionStatus: "none",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  priceId: null,
};

/* ------------------------------------------------------------------ */
/*  In-memory LRU cache                                                */
/* ------------------------------------------------------------------ */

const CACHE_TTL_MS = 60_000; // 1 minute

interface CacheEntry {
  data: EffectivePlanResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 500;

function getCached(tenantId: string): EffectivePlanResult | null {
  const entry = cache.get(tenantId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(tenantId);
    return null;
  }
  return entry.data;
}

function setCache(tenantId: string, data: EffectivePlanResult): void {
  // Simple LRU eviction: if cache is full, delete the oldest entry
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(tenantId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Invalidate a specific tenant's cached entitlements. */
export function invalidateEntitlements(tenantId: string): void {
  cache.delete(tenantId);
}

/* ------------------------------------------------------------------ */
/*  Core resolver                                                      */
/* ------------------------------------------------------------------ */

/**
 * Resolve the effective plan for a tenant.
 *
 * Looks up the tenant's active/trialing/past_due subscription, joins it to
 * the subscription_plans table, and returns a flat entitlements object that
 * the quota middleware can use directly.
 *
 * Results are cached in-memory for 60 seconds to avoid repeated DB hits on
 * every API call. Call `invalidateEntitlements(tenantId)` after subscription
 * changes (e.g. from the webhook) to force a re-read.
 *
 * If the tenant has no active subscription, returns the FREE_TIER defaults.
 */
export async function getEffectivePlanForTenant(
  tenantId: string
): Promise<EffectivePlanResult> {
  // 1. Check cache
  const cached = getCached(tenantId);
  if (cached) return cached;

  // 2. Query DB
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("tenant_subscriptions")
    .select(
      `
      id,
      status,
      plan_id,
      price_id,
      current_period_end,
      cancel_at_period_end,
      plan:subscription_plans (
        id,
        name,
        slug,
        quota_policy,
        entitlements
      )
    `
    )
    .eq("tenant_id", tenantId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Entitlements] DB error:", error);
    // Fail open with free tier rather than breaking the request
    return FREE_TIER;
  }

  if (!data || !data.plan) {
    setCache(tenantId, FREE_TIER);
    return FREE_TIER;
  }

  const plan = data.plan as unknown as {
    id: string;
    name: string;
    slug: string;
    quota_policy: Record<string, unknown>;
    entitlements: Record<string, unknown>;
  };

  const result: EffectivePlan = {
    planId: plan.id,
    planName: plan.name,
    planSlug: plan.slug,
    quotaPolicy: plan.quota_policy ?? {},
    entitlements: plan.entitlements ?? {},
    subscriptionStatus: data.status as SubscriptionStatus,
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
    priceId: data.price_id,
  };

  // 3. Cache and return
  setCache(tenantId, result);
  return result;
}
