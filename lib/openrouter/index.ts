/**
 * OpenRouter API client module.
 *
 * SECURITY WARNING: This module is SERVER-ONLY.
 * Never import in client components or pages.
 */

export {
  callOpenRouter,
  callOpenRouterTyped,
  isOpenRouterConfigured,
  OpenRouterError,
  type OpenRouterCallOptions,
  type OpenRouterResponse,
} from "./client";

export {
  websiteInvestigationSchema,
  fileInvestigationSchema,
  OPENROUTER_MODELS,
  type WebsiteInvestigationResult,
  type FileInvestigationResult,
  type OpenRouterModel,
} from "./types";
