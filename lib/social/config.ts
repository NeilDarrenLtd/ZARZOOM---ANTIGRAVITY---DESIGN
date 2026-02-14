import { z } from "zod";
import { env } from "@/lib/api/env";

/* ------------------------------------------------------------------ */
/*  Upload-Post provider configuration                                 */
/* ------------------------------------------------------------------ */

/**
 * Upload-Post base URL.
 *
 * IMPORTANT: The base URL MUST NOT include a trailing `/api` unless the
 * provider explicitly requires it. Confirm with a one-time curl test:
 *
 *   curl -s "$UPLOADPOST_BASE_URL/profiles" \
 *     -H "Authorization: Bearer $UPLOADPOST_API_KEY" | jq .
 *
 * If you get 404, try appending `/api`:
 *   UPLOADPOST_BASE_URL=https://app.uploadpost.io/api
 */

const configSchema = z.object({
  UPLOADPOST_BASE_URL: z
    .string()
    .url()
    .default("https://app.uploadpost.io"),
  UPLOADPOST_API_KEY: z.string().min(1),
  UPLOADPOST_WEBHOOK_SECRET: z.string().min(1).optional(),
});

export type UploadPostConfig = z.infer<typeof configSchema>;

let _config: UploadPostConfig | null = null;

/**
 * Return validated Upload-Post configuration.
 *
 * Reads from environment variables. Throws on first call if required
 * vars are missing. Results are cached for subsequent calls.
 */
export function uploadPostConfig(): UploadPostConfig {
  if (_config) return _config;

  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    throw new Error(
      `[social] Missing Upload-Post config:\n${JSON.stringify(flat, null, 2)}`
    );
  }

  _config = parsed.data;
  return _config;
}

/**
 * Build a full URL for an Upload-Post endpoint path.
 * Handles base URL trailing-slash normalization.
 */
export function uploadPostUrl(path: string): string {
  const cfg = uploadPostConfig();
  const base = cfg.UPLOADPOST_BASE_URL.replace(/\/+$/, "");
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${base}${clean}`;
}
