import { getEffectivePlanForTenant, type EffectivePlanResult } from "./entitlements";
import { ForbiddenError } from "@/lib/api/errors";

/* ------------------------------------------------------------------ */
/*  Plan tier hierarchy                                                */
/* ------------------------------------------------------------------ */

/**
 * Well-known plan slugs in ascending capability order.
 * `free` is implicit for tenants with no active subscription.
 */
const PLAN_TIER_ORDER = ["free", "basic", "pro", "advanced", "enterprise"] as const;
export type PlanTier = (typeof PLAN_TIER_ORDER)[number];

function tierIndex(slug: string): number {
  const idx = PLAN_TIER_ORDER.indexOf(slug as PlanTier);
  return idx === -1 ? 0 : idx; // unknown plans treated as free
}

/**
 * Returns `true` when `currentTier` is at least as high as `requiredTier`.
 */
export function meetsMinimumTier(
  currentTier: string,
  requiredTier: PlanTier
): boolean {
  return tierIndex(currentTier) >= tierIndex(requiredTier);
}

/* ------------------------------------------------------------------ */
/*  Action -> minimum plan mapping                                     */
/* ------------------------------------------------------------------ */

/**
 * Every gated action type and the minimum plan tier required.
 *
 * Routes declare their `requiredEntitlement` by key.
 * The handler factory calls `enforcePlanEntitlement` before
 * the route handler runs.
 *
 * Actions not listed here are considered **ungated** (any
 * authenticated tenant can use them).
 *
 * ----------------------------------------------------------------
 *  Basic   -- social publishing, image editing, basic image gen
 *  Pro     -- research, article writing, script writing
 *  Advanced -- video generation
 * ----------------------------------------------------------------
 */
export const ACTION_PLAN_MAP: Record<string, PlanTier> = {
  // Basic tier
  "social.publish":       "basic",
  "social.post.text":     "basic",
  "social.post.photo":    "basic",
  "social.post.video":    "basic",
  "social.profile.create":"basic",
  image_generate:         "basic",
  image_edit:             "basic",

  // Pro tier
  research_social:        "pro",
  generate_article:       "pro",

  // Advanced tier
  generate_script:        "advanced",
  video_generate:         "advanced",
  video_heygen:           "advanced",
  video_kling:            "advanced",
  video_veo3:             "advanced",
} as const;

/* ------------------------------------------------------------------ */
/*  Core enforcement                                                   */
/* ------------------------------------------------------------------ */

/**
 * Check whether a tenant's current plan allows the given `actionType`.
 *
 * 1. Resolve the effective plan (cached, 60 s TTL).
 * 2. Look up the action in `ACTION_PLAN_MAP`.
 * 3. Compare the tenant's plan tier against the required tier.
 * 4. Additionally check the plan's `entitlements` JSONB for an explicit
 *    `action:false` override (allows admins to revoke individual features
 *    from a plan without changing the tier).
 *
 * Throws `ForbiddenError` (403) if the tenant's plan is too low, or if
 * the feature is explicitly disabled.
 */
export async function enforcePlanEntitlement(
  tenantId: string,
  actionType: string
): Promise<EffectivePlanResult> {
  const plan = await getEffectivePlanForTenant(tenantId);

  const requiredTier = ACTION_PLAN_MAP[actionType];

  // If the action isn't in the map, it's ungated -- allow it.
  if (!requiredTier) return plan;

  // Check tier hierarchy
  const currentSlug = plan.planSlug; // "free" | "basic" | "pro" | "advanced" | ...
  if (!meetsMinimumTier(currentSlug, requiredTier)) {
    throw new ForbiddenError(
      `Your current plan (${plan.planName}) does not include "${actionType}". ` +
        `Upgrade to ${requiredTier} or higher to unlock this feature.`
    );
  }

  // Check explicit entitlement override (e.g. admin disabled the feature)
  const explicitFlag = plan.entitlements[actionType];
  if (explicitFlag === false) {
    throw new ForbiddenError(
      `The "${actionType}" feature is not enabled on your plan. ` +
        "Please contact support or upgrade."
    );
  }

  return plan;
}

/* ------------------------------------------------------------------ */
/*  Convenience: enforce plan + quota in a single call                 */
/* ------------------------------------------------------------------ */

export { getEffectivePlanForTenant } from "./entitlements";
