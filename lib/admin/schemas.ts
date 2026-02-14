import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Provider keys                                                      */
/* ------------------------------------------------------------------ */

export const providerEnum = z.enum([
  "uploadpost",
  "openai",
  "heygen",
  "kling",
  "veo3",
  "openrouter",
]);
export type Provider = z.infer<typeof providerEnum>;

export const putKeySchema = z.object({
  provider: providerEnum,
  key_name: z.string().min(1).max(255),
  plaintext_value: z.string().min(1).max(10_000),
  make_active: z.boolean().default(true),
});
export type PutKeyInput = z.infer<typeof putKeySchema>;

/* ------------------------------------------------------------------ */
/*  Prompt templates                                                   */
/* ------------------------------------------------------------------ */

export const templateKeyEnum = z.enum([
  "research_social",
  "generate_article",
  "generate_script",
]);
export type TemplateKey = z.infer<typeof templateKeyEnum>;

export const putPromptSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  system_prompt: z.string().min(1).max(50_000),
  user_prompt_template: z.string().min(1).max(50_000),
  output_schema: z.record(z.unknown()).optional(),
  activate: z.boolean().default(false),
});
export type PutPromptInput = z.infer<typeof putPromptSchema>;

export const testPromptSchema = z.object({
  template_key: templateKeyEnum,
  test_input_json: z.record(z.unknown()),
  language: z.string().min(2).max(10).optional(),
});
export type TestPromptInput = z.infer<typeof testPromptSchema>;

/* ------------------------------------------------------------------ */
/*  Default language                                                   */
/* ------------------------------------------------------------------ */

export const putLanguageSchema = z.object({
  default_language: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[a-z]{2,3}(-[A-Za-z]{2,8})*$/, "Must be a valid BCP-47 / ISO code"),
});
export type PutLanguageInput = z.infer<typeof putLanguageSchema>;
