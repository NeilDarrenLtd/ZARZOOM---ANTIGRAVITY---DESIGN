/**
 * Canonical job statuses.
 *
 * The ONLY values that may be persisted in the `jobs.status` column.
 * Any provider-specific status (e.g. "succeeded") must be normalised
 * to one of these values before writing to the database.
 */
export const VALID_JOB_STATUSES = [
  "pending",
  "scheduled",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type JobStatus = (typeof VALID_JOB_STATUSES)[number];

/**
 * Normalises a job status string to the canonical set.
 *
 * Specifically maps the legacy "succeeded" value to "completed".
 * All other values pass through unchanged.
 *
 * Call this function on every status value received from external
 * providers (HeyGen, Kling, UploadPost, worker callbacks, etc.)
 * **before** writing to the database.
 */
export function normalizeJobStatus(status: string): string {
  if (status === "succeeded") return "completed";
  return status;
}
