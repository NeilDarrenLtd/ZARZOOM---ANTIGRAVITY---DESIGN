import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Research schemas                                                   */
/* ------------------------------------------------------------------ */

export const researchSocialSchema = z.object({
  platform: z.enum(["youtube", "x", "both"]),
  niche: z.string().min(1, "niche is required").max(500),
  seed_keywords: z.array(z.string().max(100)).max(20).optional(),
  geo: z.string().max(10).optional(),
  timeframe: z.enum(["24h", "7d", "30d", "90d"]).optional().default("7d"),
  language: z
    .string()
    .max(10)
    .optional()
    .describe("Default from tenant_settings, else 'en'"),
  callback_url: z.string().url().optional(),
});

export type ResearchSocialInput = z.infer<typeof researchSocialSchema>;

/* ------------------------------------------------------------------ */
/*  Article schemas                                                    */
/* ------------------------------------------------------------------ */

export const writeArticleSchema = z.object({
  research_job_id: z.string().uuid().optional(),
  research_summary: z.record(z.unknown()).optional(),
  title_preferences: z
    .object({
      include: z.array(z.string().max(200)).max(10).optional(),
      avoid: z.array(z.string().max(200)).max(10).optional(),
    })
    .optional(),
  hashtags: z.array(z.string().max(100)).max(30).optional(),
  audience: z.string().max(500).optional(),
  language: z.string().max(10).optional(),
  callback_url: z.string().url().optional(),
});

export type WriteArticleInput = z.infer<typeof writeArticleSchema>;

/* ------------------------------------------------------------------ */
/*  Script schemas                                                     */
/* ------------------------------------------------------------------ */

export const writeScriptSchema = z.object({
  article_job_id: z.string().uuid().optional(),
  article_text: z.string().max(50_000).optional(),
  hashtags: z.array(z.string().max(100)).max(30).optional(),
  duration_seconds: z.union([z.literal(10), z.literal(20), z.literal(30)]),
  platform: z.enum(["tiktok", "reels", "youtube_shorts"]).optional(),
  language: z.string().max(10).optional(),
  callback_url: z.string().url().optional(),
});

export type WriteScriptInput = z.infer<typeof writeScriptSchema>;
