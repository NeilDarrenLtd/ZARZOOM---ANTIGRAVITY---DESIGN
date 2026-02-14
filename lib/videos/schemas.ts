import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Video generation schemas                                           */
/* ------------------------------------------------------------------ */

const heygenOptionsSchema = z.object({
  mode: z.enum(["video_agent", "avatar"]).optional().default("avatar"),
  avatar_id: z.string().optional(),
  voice_id: z.string().optional(),
});

const klingOptionsSchema = z.object({
  image_asset_id: z.string().uuid().optional(),
  motion_prompt: z.string().max(2000).optional(),
});

const veo3OptionsSchema = z.object({
  input_image_asset_id: z.string().uuid().optional(),
  gcs_output_prefix: z.string().max(500).optional(),
});

export const videoGenerateSchema = z.object({
  provider: z.enum(["heygen", "kling", "veo3"]),
  prompt: z.string().min(1, "prompt is required").max(4000),
  language: z.string().max(10).optional(),
  duration_seconds: z.coerce.number().int().min(1).max(300).optional(),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
  resolution: z.string().max(20).optional(),
  callback_url: z.string().url().optional(),

  /** Optional: use a previously generated script artefact as input */
  script_artefact_id: z.string().uuid().optional(),

  heygen: heygenOptionsSchema.optional(),
  kling: klingOptionsSchema.optional(),
  veo3: veo3OptionsSchema.optional(),
});

export type VideoGenerateInput = z.infer<typeof videoGenerateSchema>;

/* ------------------------------------------------------------------ */
/*  HeyGen webhook payload                                             */
/* ------------------------------------------------------------------ */

export const heygenWebhookSchema = z.object({
  event_type: z.string().min(1),
  data: z.object({
    video_id: z.string().optional(),
    status: z.string().optional(),
    video_url: z.string().url().optional(),
    callback_id: z.string().optional(),
    error: z.string().optional(),
  }),
});

export type HeyGenWebhookPayload = z.infer<typeof heygenWebhookSchema>;

/* ------------------------------------------------------------------ */
/*  Kling webhook payload (optional -- only if plan supports callbacks)*/
/* ------------------------------------------------------------------ */

export const klingWebhookSchema = z.object({
  task_id: z.string().min(1),
  status: z.string().min(1),
  video_url: z.string().url().optional(),
  error_message: z.string().optional(),
});

export type KlingWebhookPayload = z.infer<typeof klingWebhookSchema>;
