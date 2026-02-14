/**
 * Queue Integration -- barrel export.
 *
 * Vercel route handlers use `enqueueNow()` and `enqueueDelayed()` to
 * produce messages. An external Worker consumes them.
 *
 * ```ts
 * import { enqueueNow, enqueueDelayed, verifyQueueSignature } from "@/lib/queue";
 * ```
 */

// Producer (Vercel side)
export {
  enqueueNow,
  enqueueDelayed,
  type EnqueueOptions,
  type EnqueueResult,
} from "./producer";

// Signing / verification
export { signMessage, verifyQueueSignature } from "./signing";

// Types & retry config
export {
  QueueMessageSchema,
  type QueueMessage,
  type RetryConfig,
  RETRY_DEFAULTS,
  getRetryConfig,
  calculateBackoff,
} from "./types";
