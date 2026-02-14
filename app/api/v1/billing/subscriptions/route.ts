import { createApiHandler, ok, notFound } from "@/lib/api";
import { getTenantSubscription } from "@/lib/billing/queries";

/**
 * GET /api/v1/billing/subscriptions
 * Returns the authenticated user's tenant subscription.
 */
export const GET = createApiHandler({
  requiredRole: "viewer",
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    if (!ctx.membership) {
      return notFound("No active tenant found", ctx.requestId);
    }

    const subscription = await getTenantSubscription(ctx.membership.tenantId);

    if (!subscription) {
      return ok(
        { subscription: null, message: "No active subscription" },
        ctx.requestId
      );
    }

    return ok({ subscription }, ctx.requestId);
  },
});
