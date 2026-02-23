/**
 * GET /api/v1/billing/plans
 * 
 * Canonical public pricing API.
 * Returns active plans with all prices (all currencies + intervals).
 * 
 * Features:
 * - No authentication required
 * - Cached for 120 seconds (2 minutes)
 * - Uses new `plans` + `plan_prices` schema
 * 
 * Response shape:
 * {
 *   plans: [
 *     {
 *       planKey: "basic",
 *       name: "Basic",
 *       description: "...",
 *       sortOrder: 1,
 *       entitlements: { ... },
 *       quotaPolicy: { ... },
 *       features: [ ... ],
 *       prices: [
 *         { currency: "GBP", interval: "month", amountMinor: 999 },
 *         { currency: "GBP", interval: "year", amountMinor: 9990 },
 *         ...
 *       ]
 *     }
 *   ]
 * }
 */

import { NextResponse } from "next/server";
import { getActivePlansWithPrices } from "@/lib/billing/queries";

// Cache for 120 seconds (2 minutes)
export const revalidate = 120;

export async function GET() {
  const requestId = crypto.randomUUID();

  try {
    console.log("[v0] Fetching active plans with prices");
    
    const plansWithPrices = await getActivePlansWithPrices();

    // Transform to canonical API shape
    const response = {
      plans: plansWithPrices.map((plan) => ({
        planKey: plan.plan_key,
        name: plan.name,
        description: plan.description,
        sortOrder: plan.sort_order,
        isActive: plan.is_active,
        entitlements: plan.entitlements,
        quotaPolicy: plan.quota_policy,
        features: plan.features,
        prices: plan.prices.map((price) => ({
          id: price.id,
          currency: price.currency,
          interval: price.interval,
          amountMinor: price.amount_minor,
          isActive: price.is_active,
          billingProviderId: price.billing_provider_price_id,
        })),
      })),
    };

    console.log(`[v0] Returning ${response.plans.length} active plans`);

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "X-Request-Id": requestId,
        "Cache-Control": "public, max-age=120, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[v0] Error in GET /api/v1/billing/plans:", error);
    
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch pricing plans",
          requestId,
        },
      },
      {
        status: 500,
        headers: {
          "X-Request-Id": requestId,
        },
      }
    );
  }
}
