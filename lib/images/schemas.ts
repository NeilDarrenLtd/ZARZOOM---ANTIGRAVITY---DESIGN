import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Image generation schemas                                           */
/* ------------------------------------------------------------------ */

export const imageGenerateSchema = z.object({
  prompt: z.string().min(1, "prompt is required").max(4000),
  model: z
    .enum(["gpt-image-1", "dall-e-3", "dall-e-2"])
    .optional()
    .default("gpt-image-1"),
  size: z
    .enum([
      "1024x1024",
      "1536x1024",
      "1024x1536",
      "256x256",
      "512x512",
      "auto",
    ])
    .optional()
    .default("auto"),
  quality: z
    .enum(["auto", "high", "medium", "low", "standard", "hd"])
    .optional()
    .default("auto"),
  n: z.coerce.number().int().min(1).max(4).optional().default(1),
  language: z
    .string()
    .max(10)
    .optional()
    .describe("Language hint for text labels in the generated image"),
  callback_url: z.string().url().optional(),
});

export type ImageGenerateInput = z.infer<typeof imageGenerateSchema>;

/* ------------------------------------------------------------------ */
/*  Image edit schemas                                                 */
/* ------------------------------------------------------------------ */

export const imageEditSchema = z.object({
  prompt: z.string().min(1, "prompt is required").max(4000),
  model: z
    .enum(["gpt-image-1", "dall-e-2"])
    .optional()
    .default("gpt-image-1"),
  image_asset_id: z.string().uuid("image_asset_id must be a valid UUID"),
  mask_asset_id: z.string().uuid().optional(),
  background: z
    .enum(["transparent", "opaque", "auto"])
    .optional(),
  input_fidelity: z
    .enum(["high", "low", "auto"])
    .optional(),
  language: z
    .string()
    .max(10)
    .optional()
    .describe("Language hint for text labels in the edited image"),
  callback_url: z.string().url().optional(),
});

export type ImageEditInput = z.infer<typeof imageEditSchema>;
