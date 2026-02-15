import { z } from "zod";

/**
 * Validated server-side environment variables.
 *
 * Parsed once on first access; throws at startup if any required var is
 * missing so deployments fail fast rather than at request time.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SITE_URL: z.string().url().optional().default("http://localhost:3000"),
  ENCRYPTION_MASTER_KEY: z.string().min(32).optional(),
  API_KEY_PEPPER: z.string().min(16).optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function env(): Env {
  if (_env) return _env;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    throw new Error(
      `[API] Missing or invalid environment variables:\n${JSON.stringify(formatted, null, 2)}`
    );
  }

  _env = parsed.data;
  return _env;
}
