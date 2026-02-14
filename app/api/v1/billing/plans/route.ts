import { createApiHandler, ok } from "@/lib/api";
import { getPlans } from "@/lib/billing/queries";

/**
 * GET /api/v1/billing/plans
 * Public -- returns active plans with prices.
 */
export const GET = createApiHandler({
  auth: false,
  handler: async (ctx) => {
    const plans = await getPlans({ status: "active" });
    return ok({ plans }, ctx.requestId);
  },
});
