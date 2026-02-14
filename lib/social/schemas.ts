import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Shared constants                                                   */
/* ------------------------------------------------------------------ */

export const SUPPORTED_PLATFORMS = [
  "twitter",
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "pinterest",
  "threads",
] as const;

export type Platform = (typeof SUPPORTED_PLATFORMS)[number];

/* ------------------------------------------------------------------ */
/*  Profile schemas                                                    */
/* ------------------------------------------------------------------ */

export const createProfileSchema = z.object({
  profile_username: z
    .string()
    .min(1, "profile_username is required")
    .max(100),
});

export const connectProfileSchema = z.object({
  redirect_url: z.string().url().optional(),
});

/* ------------------------------------------------------------------ */
/*  Publishing schemas                                                 */
/* ------------------------------------------------------------------ */

const basePostSchema = z.object({
  profile_username: z.string().min(1),
  platforms: z
    .array(z.enum(SUPPORTED_PLATFORMS))
    .min(1, "At least one platform required"),
  text: z.string().min(1).max(5000),
  schedule_at: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().max(50).optional(),
  callback_url: z.string().url().optional(),
});

export const textPostSchema = basePostSchema;

export const photoPostSchema = basePostSchema.extend({
  image_asset_id: z.string().uuid().optional(),
  image_url: z.string().url().optional(),
}).refine(
  (d) => d.image_asset_id || d.image_url,
  { message: "Either image_asset_id or image_url is required" }
);

export const videoPostSchema = basePostSchema.extend({
  video_asset_id: z.string().uuid().optional(),
  video_url: z.string().url().optional(),
}).refine(
  (d) => d.video_asset_id || d.video_url,
  { message: "Either video_asset_id or video_url is required" }
);

/* ------------------------------------------------------------------ */
/*  Read-helper schemas                                                */
/* ------------------------------------------------------------------ */

export const historyQuerySchema = z.object({
  profile_username: z.string().min(1),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const analyticsQuerySchema = z.object({
  profile_username: z.string().min(1),
  platforms: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? (v.split(",").filter(Boolean) as Platform[])
        : undefined
    ),
});

/* ------------------------------------------------------------------ */
/*  Webhook schemas                                                    */
/* ------------------------------------------------------------------ */

export const webhookPayloadSchema = z.object({
  event: z.string().min(1),
  job_id: z.string().optional(),
  provider_job_id: z.string().optional(),
  status: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});
