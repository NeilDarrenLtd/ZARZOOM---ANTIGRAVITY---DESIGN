import { createApiHandler, ok } from "@/lib/api";

/**
 * GET /api/v1/health
 *
 * Public health-check endpoint. No authentication required.
 * Returns the service status, current timestamp, and API version.
 */
export const GET = createApiHandler({
  auth: false,
  handler: async (ctx) => {
    return ok(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
      ctx.requestId
    );
  },
});
