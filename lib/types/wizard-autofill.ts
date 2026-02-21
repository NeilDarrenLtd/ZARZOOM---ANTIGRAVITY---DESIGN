/**
 * TypeScript types for wizard auto-fill feature
 * Corresponds to database schema from scripts/006_wizard_autofill_feature.sql
 */

// ──────────────────────────────────────────────
// Enums and constants
// ──────────────────────────────────────────────

export const AUTOFILL_SOURCE_TYPES = ["website", "file"] as const;
export type AutofillSourceType = (typeof AUTOFILL_SOURCE_TYPES)[number];

export const AUTOFILL_STATUS_TYPES = ["success", "partial", "error"] as const;
export type AutofillStatus = (typeof AUTOFILL_STATUS_TYPES)[number];

// ──────────────────────────────────────────────
// Database table types
// ──────────────────────────────────────────────

/**
 * wizard_autofill_settings table
 * Singleton table for admin-configurable OpenRouter prompts
 */
export interface WizardAutofillSettings {
  id: string;
  website_prompt_text: string;
  file_prompt_text: string;
  website_autofill_enabled: boolean;
  file_autofill_enabled: boolean;
  openrouter_model: string;
  max_tokens: number;
  temperature: number;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

/**
 * wizard_autofill_audit table
 * Audit logs for all auto-fill analysis runs
 */
export interface WizardAutofillAudit {
  id: string;
  user_id: string;
  source_type: AutofillSourceType;
  source_value: string; // URL or filename
  status: AutofillStatus;
  extracted_fields: Record<string, unknown> | null;
  fields_filled: string[] | null;
  error_message: string | null;
  error_code: string | null;
  openrouter_model: string | null;
  tokens_used: number | null;
  processing_time_ms: number | null;
  file_size_bytes: number | null;
  file_mime_type: string | null;
  file_storage_path: string | null;
  created_at: string;
}

/**
 * Enhanced onboarding_profiles columns
 * Additional columns added to track auto-fill metadata
 */
export interface OnboardingProfileAutofillMetadata {
  autofilled_from_source: AutofillSourceType | null;
  autofill_source_value: string | null;
  autofill_performed_at: string | null;
  autofill_fields_filled: string[] | null;
  autofill_audit_id: string | null;
}

// ──────────────────────────────────────────────
// API request/response types
// ──────────────────────────────────────────────

/**
 * Request body for website auto-fill analysis
 */
export interface AnalyzeWebsiteRequest {
  url: string;
}

/**
 * Request body for file auto-fill analysis
 */
export interface AnalyzeFileRequest {
  file_path: string; // Path in Supabase Storage
  file_name: string;
  file_size: number;
  file_mime_type: string;
}

/**
 * Extracted brand data from OpenRouter analysis
 */
export interface ExtractedBrandData {
  business_name?: string;
  business_description?: string;
  brand_color_hex?: string;
  content_language?: string;
  article_styles?: string[];
  website_url?: string;
  // Add other fields that can be extracted
}

/**
 * Response from auto-fill analysis
 */
export interface AutofillAnalysisResponse {
  status: AutofillStatus;
  extracted_data: ExtractedBrandData;
  fields_filled: string[];
  audit_id: string;
  error_message?: string;
  error_code?: string;
  tokens_used?: number;
  processing_time_ms?: number;
}

// ──────────────────────────────────────────────
// Admin settings update types
// ──────────────────────────────────────────────

/**
 * Request body for updating wizard auto-fill settings (admin only)
 */
export interface UpdateWizardAutofillSettingsRequest {
  website_prompt_text?: string;
  file_prompt_text?: string;
  website_autofill_enabled?: boolean;
  file_autofill_enabled?: boolean;
  openrouter_model?: string;
  max_tokens?: number;
  temperature?: number;
}

// ──────────────────────────────────────────────
// Helper types for UI components
// ──────────────────────────────────────────────

/**
 * UI state for auto-fill buttons
 */
export type AutofillUIStatus = "idle" | "loading" | "success" | "partial" | "error";

/**
 * File upload validation result
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  file?: File;
  size_bytes?: number;
  mime_type?: string;
}

/**
 * OpenRouter API response structure (simplified)
 */
export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

// ──────────────────────────────────────────────
// Database function return types
// ──────────────────────────────────────────────

/**
 * Return type for get_wizard_autofill_settings() function
 */
export interface WizardAutofillSettingsResult {
  website_prompt: string;
  file_prompt: string;
  website_enabled: boolean;
  file_enabled: boolean;
  model: string;
  max_tokens: number;
  temperature: number;
}
